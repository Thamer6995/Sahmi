import { logger } from './logger';
import { JOB_LOCK_TIMEOUT_MS } from '../config/env';

const runningJobs = new Set<string>();

export type JobLockOutcome<T> =
  | { status: 'busy' }
  | { status: 'timeout' }
  | { status: 'completed'; result: T };

/**
 * قفل بسيط بالذاكرة يمنع تشغيل نفس المهمة المجدولة أكثر من مرة بالتزامن،
 * مع مهلة قصوى إجبارية (Hard Timeout - راجع JOB_LOCK_TIMEOUT_MS في
 * config/env.ts للقيمة الافتراضية والسبب) تحرّر القفل تلقائيًا حتى لو
 * علّقت المهمة الأصلية لسبب خارجي (بطء SAHMK/Firestore).
 *
 * لوحظ فعليًا قبل هذا الإصلاح: عندما ينتهي curl في حلقة GitHub Actions
 * بفشل/مهلة بينما الطلب الأصلي لسا شغّال على السيرفر، كانت الحلقة تطلق
 * طلبًا جديدًا فيبدأ تشغيلة موازية أخرى فوق القديمة - القفل وحده (بدون
 * مهلة) منع هذا، لكن كشف عيبًا آخر: لو عُلِّقت المهمة الأصلية فعليًا (لا
 * تنتهي أبدًا)، يبقى القفل محجوزًا للأبد - مؤكَّد فعليًا يوم 19 يوليو 2026
 * (daily-price-and-alert-scan بقي busy:true لمدة ساعة كاملة متواصلة).
 *
 * عند انتهاء المهلة: يُحرَّر القفل فورًا (يسمح بتشغيلة جديدة)، لكن الـ
 * Promise الأصلي (fn()) يستمر بالعمل بالخلفية دون انتظاره - لا توجد طريقة
 * فعلية لإلغاء Promise قيد التنفيذ في JavaScript. هذا يعني احتمال نادر
 * لمعالجة مزدوجة جزئية إذا اكتملت المهمة "المهملة" لاحقًا وكتبت بياناتها -
 * وهذا مقبول صراحة كثمن بديل لتفادي التعليق الدائم (بدل تعليق لا نهائي
 * مؤكَّد الحدوث، ضد احتمال نادر لتكرار جزئي).
 */
export async function withJobLock<T>(
  jobKey: string,
  fn: () => Promise<T>,
  timeoutMs: number = JOB_LOCK_TIMEOUT_MS()
): Promise<JobLockOutcome<T>> {
  if (runningJobs.has(jobKey)) {
    logger.warn('job_lock_rejected_busy', { jobKey });
    return { status: 'busy' };
  }

  runningJobs.add(jobKey);
  logger.info('job_lock_acquired', { jobKey, timeoutMs });

  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<{ status: 'timeout' }>((resolve) => {
    timeoutHandle = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs);
  });

  // نلتقط رفض fn() صراحة هنا (وليس فقط عبر try/catch أدناه) حتى لو استمرت
  // بالخلفية بعد انتهاء المهلة وفوز سباق الـ Promise.race بجهة أخرى - بدون
  // هذا، رفض متأخر بلا مستمع يُسجَّل كـ Unhandled Promise Rejection.
  const taskPromise = fn()
    .then((result): { status: 'completed'; result: T } => ({ status: 'completed', result }))
    .catch((error) => {
      logger.error('job_lock_task_rejected', { jobKey, message: (error as Error).message });
      throw error;
    });

  try {
    const outcome = await Promise.race([taskPromise, timeoutPromise]);

    if (outcome.status === 'timeout') {
      logger.warn('job_lock_timeout', { jobKey, timeoutMs });
      // نضمن وجود مستمع على taskPromise دائمًا (حتى لو رفضت لاحقًا بعد
      // إرجاعنا نتيجة timeout) - المستمع الحقيقي (logger.error) مسجَّل أعلاه
      // بالفعل؛ هذا فقط يمنع ظهورها كـ Unhandled Rejection على مستوى العملية.
      taskPromise.catch(() => {});
      return { status: 'timeout' };
    }

    return outcome;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    runningJobs.delete(jobKey);
    logger.info('job_lock_released', { jobKey });
  }
}

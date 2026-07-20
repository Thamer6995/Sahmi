import { logger } from './logger';
import { JOB_LOCK_TIMEOUT_MS, JOB_LOCK_ABORT_GRACE_MS } from '../config/env';

const runningJobs = new Set<string>();

export type JobLockOutcome<T> =
  | { status: 'busy' }
  | { status: 'completed'; result: T }
  /** انتهت المهلة، طُلِب الإلغاء، والمهمة توقفت فعليًا خلال مهلة السماح - القفل محرَّر، يمكن تشغيل مهمة جديدة. */
  | { status: 'timed_out_and_cancelled' }
  /** انتهت المهلة وطُلِب الإلغاء، لكن المهمة تجاهلت AbortSignal واستمرت بعد مهلة السماح - القفل يبقى محجوزًا. */
  | { status: 'timed_out_but_still_running' };

type TaskSettlement<T> = { ok: true; result: T } | { ok: false; error: unknown };

/** يُعيد Promise مع دالة clear لإلغاء المؤقّت لو خسر السباق - يمنع بقاء
 *  Timer معلّقًا بالخلفية بعد أن يُحسم السباق بالطرف الآخر (مهم خصوصًا في
 *  الاختبارات: Jest يُبلّغ "worker process failed to exit gracefully" لو
 *  تُرِك أي مؤقّت شغّالًا دون clearTimeout). */
function cancellableDelay<V>(ms: number, value: V): { promise: Promise<V>; clear: () => void } {
  let handle: ReturnType<typeof setTimeout>;
  const promise = new Promise<V>((resolve) => {
    handle = setTimeout(() => resolve(value), ms);
  });
  return { promise, clear: () => clearTimeout(handle) };
}

/**
 * قفل بالذاكرة يمنع تشغيل نفس المهمة المجدولة أكثر من مرة بالتزامن، مع
 * إلغاء تعاوني حقيقي (AbortSignal) بدل مجرد "نسيان" المهمة المعلَّقة.
 *
 * لوحظ فعليًا قبل هذا الإصلاح: (1) بدون قفل إطلاقًا - عشرات النسخ المتزامنة
 * لنفس المهمة كانت تعالج نفس البيانات فوق بعض وتضاعف الكتابة على Firestore
 * حتى استنزاف الحصة اليومية. (2) بعد إضافة قفل بسيط بدون مهلة - لو عُلِّقت
 * المهمة الأصلية فعليًا، يبقى القفل محجوزًا للأبد (مؤكَّد فعليًا 19 يوليو
 * 2026: daily-price-and-alert-scan بقي busy:true لمدة ساعة كاملة). (3) بعد
 * إضافة Hard Timeout وحده (بدون إلغاء فعلي) - القفل يتحرر عند انتهاء المهلة،
 * لكن المهمة القديمة تستمر بالخلفية وقد تُكمل طلبات SAHMK وكتابات Firestore
 * وحتى إرسال Telegram بعد أن بدأت مهمة جديدة فعليًا - يخاطر بمضاعفة الكتابة
 * وتكرار التنبيهات بالضبط كما في المشكلة الأصلية، فقط بصيغة أهدأ.
 *
 * الحل هنا: عند انتهاء JOB_LOCK_TIMEOUT_MS، نطلب إلغاءً تعاونيًا فعليًا عبر
 * AbortSignal (تحمله المهمة لكل استدعاء SAHMK/Firestore داخلها وتتحقق منه
 * قبل كل خطوة كتابية جديدة - راجع batchRunner.ts وhttpClient.ts وevaluateAlert.ts)،
 * ثم ننتظر JOB_LOCK_ABORT_GRACE_MS إضافية لتتوقف المهمة فعليًا قبل تحرير
 * القفل. لو لم تستجب خلال مهلة السماح (تجاهلت الإشارة)، **لا يُحرَّر القفل
 * إطلاقًا** - يبقى محجوزًا حتى تستقر المهمة فعليًا مهما طال ذلك، مانعًا أي
 * تشغيلة جديدة متزامنة معها في نفس العملية.
 */
export async function withJobLock<T>(
  jobKey: string,
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = JOB_LOCK_TIMEOUT_MS(),
  abortGraceMs: number = JOB_LOCK_ABORT_GRACE_MS()
): Promise<JobLockOutcome<T>> {
  if (runningJobs.has(jobKey)) {
    logger.warn('job_lock_rejected_busy', { jobKey });
    return { status: 'busy' };
  }

  runningJobs.add(jobKey);
  logger.info('job_lock_acquired', { jobKey, timeoutMs, abortGraceMs });

  const controller = new AbortController();

  function release(reason: string): void {
    runningJobs.delete(jobKey);
    logger.info('job_lock_released', { jobKey, reason });
  }

  // settlement لا ترفض أبدًا (تحوّل أي خطأ لقيمة بيانات) - يضمن عدم وجود
  // Unhandled Promise Rejection مهما عدد المرات/الأماكن اللي نستهلكها منها،
  // بما فيها الاستمرار بمراقبتها بالخلفية لفترة طويلة بعد انتهاء المهلتين.
  const settlement: Promise<TaskSettlement<T>> = fn(controller.signal).then(
    (result): TaskSettlement<T> => ({ ok: true, result }),
    (error): TaskSettlement<T> => {
      logger.error('job_lock_task_rejected', { jobKey, message: (error as Error)?.message ?? String(error) });
      return { ok: false, error };
    }
  );

  const settledSignal = settlement.then(() => 'settled' as const);
  const hardTimeout = cancellableDelay(timeoutMs, 'timeout' as const);

  const first = await Promise.race([settledSignal, hardTimeout.promise]);
  hardTimeout.clear();

  if (first === 'settled') {
    const outcome = await settlement;
    release('completed');
    if (!outcome.ok) throw outcome.error;
    return { status: 'completed', result: outcome.result };
  }

  // انتهت المهلة القصوى - نطلب إلغاءً تعاونيًا فعليًا
  logger.warn('job_lock_timeout', { jobKey, timeoutMs });
  controller.abort();
  logger.warn('job_lock_abort_requested', { jobKey });

  const graceExpired = cancellableDelay(abortGraceMs, 'grace_expired' as const);
  const second = await Promise.race([settledSignal, graceExpired.promise]);
  graceExpired.clear();

  if (second === 'settled') {
    // استجابت المهمة للإلغاء (أو انتهت طبيعيًا) خلال مهلة السماح - آمن نحرّر القفل
    release('timed_out_and_cancelled');
    return { status: 'timed_out_and_cancelled' };
  }

  // تجاهلت المهمة AbortSignal ولا تزال تعمل بعد مهلة السماح - لا نحرّر القفل
  // إطلاقًا. نراقبها بالخلفية (بدون أي مهلة إضافية) ونحرّر القفل فقط عندما
  // تستقر فعليًا مهما طال - هذا يمنع أي تشغيلة جديدة متزامنة معها.
  logger.error('job_lock_unresponsive_after_grace', { jobKey, timeoutMs, abortGraceMs });
  settlement.then(() => {
    release('late_settle_after_unresponsive_abort');
  });

  return { status: 'timed_out_but_still_running' };
}

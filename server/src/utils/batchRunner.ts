import { randomUUID } from 'node:crypto';
import { logger } from './logger';

export interface BatchRunSummary {
  jobId: string;
  total: number;
  succeeded: number;
  failed: number;
  errors: { item: string; message: string }[];
  /** true إذا توقّف التشغيل قبل معالجة كل العناصر بسبب إلغاء تعاوني (AbortSignal). */
  cancelled: boolean;
}

/**
 * ينفّذ معالجة لكل عنصر من قائمة (مثلًا رموز أسهم) بشكل منعزل: فشل عنصر
 * واحد لا يوقف بقية المعالجة أبدًا (متطلب صريح: "لا تجعل فشل سهم واحد
 * يوقف تحليل جميع السوق").
 *
 * ملاحظة (Storage Refactor Phase 1): كان تقدّم كل دفعة يُسجَّل سابقًا في
 * Firestore (collection: syncJobs، مستند جديد لكل استدعاء). تأكَّد أنه لا
 * يوجد أي مستهلك فعلي لهذه المجموعة في كامل المشروع (لا لوحة إدارة تقرأها،
 * لا مسار API يعرضها) - كانت فقط تتراكم بلا سقف، مستند جديد مع كل تشغيلة
 * مجدولة، للأبد. أُزيلت الكتابة كليًا بدل تحديد سقف (20 تشغيلة مثلًا) لأن
 * تحديد سقف لبيانات لا يقرأها أحد لا يحل شيئًا - فقط يبطئ التراكم. jobId
 * يبقى معرّفًا محليًا (UUID) لغرض الربط في السجلات (logs) فقط، دون أي علاقة
 * بـ Firestore.
 *
 * يفحص `signal` (إن وُجدت) قبل بدء أي دفعة جديدة - لا يبدأ أي طلب SAHMK أو
 * كتابة Firestore لعناصر لم تبدأ معالجتها بعد إذا طُلِب الإلغاء. العناصر
 * التي بدأت فعليًا ضمن الدفعة الجارية وقت الإلغاء تُترَك لتكتمل طبيعيًا
 * (Promise.allSettled على الدفعة الحالية) - هذا مقبول ومقصود.
 */
export async function runBatched<T>(
  jobName: string,
  items: T[],
  keyOf: (item: T) => string,
  handler: (item: T, signal?: AbortSignal) => Promise<void>,
  batchSize = 25,
  signal?: AbortSignal
): Promise<BatchRunSummary> {
  const jobId = randomUUID();

  const summary: BatchRunSummary = { jobId, total: items.length, succeeded: 0, failed: 0, errors: [], cancelled: false };

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    if (signal?.aborted) {
      summary.cancelled = true;
      logger.warn('batch_run_cancelled', {
        jobName,
        processed: summary.succeeded + summary.failed,
        remaining: items.length - (summary.succeeded + summary.failed),
      });
      break;
    }

    const results = await Promise.allSettled(batch.map((item) => handler(item, signal)));

    results.forEach((result, idx) => {
      const item = batch[idx];
      if (result.status === 'fulfilled') {
        summary.succeeded += 1;
      } else {
        summary.failed += 1;
        const message = (result.reason as Error)?.message ?? String(result.reason);
        summary.errors.push({ item: keyOf(item), message });
        logger.warn('batch_item_failed', { jobName, item: keyOf(item), message });
      }
    });
  }

  logger.info('batch_run_completed', {
    jobName,
    total: summary.total,
    succeeded: summary.succeeded,
    failed: summary.failed,
    cancelled: summary.cancelled,
  });

  return summary;
}

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from './logger';

export interface BatchRunSummary {
  jobId: string;
  total: number;
  succeeded: number;
  failed: number;
  errors: { item: string; message: string }[];
}

/**
 * ينفّذ معالجة لكل عنصر من قائمة (مثلًا رموز أسهم) بشكل منعزل: فشل عنصر
 * واحد لا يوقف بقية المعالجة أبدًا (متطلب صريح: "لا تجعل فشل سهم واحد
 * يوقف تحليل جميع السوق"). يسجّل تقدم كل دفعة في Firestore
 * (collection: syncJobs) حتى يمكن متابعته من لوحة الإدارة لاحقًا.
 */
export async function runBatched<T>(
  jobName: string,
  items: T[],
  keyOf: (item: T) => string,
  handler: (item: T) => Promise<void>,
  batchSize = 25
): Promise<BatchRunSummary> {
  const db = getFirestore();
  const jobRef = db.collection('syncJobs').doc();
  const jobId = jobRef.id;

  const summary: BatchRunSummary = { jobId, total: items.length, succeeded: 0, failed: 0, errors: [] };

  await jobRef.set({
    jobName,
    status: 'running',
    total: items.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    startedAt: FieldValue.serverTimestamp(),
  });

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const results = await Promise.allSettled(batch.map((item) => handler(item)));

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

    await jobRef.update({
      processed: summary.succeeded + summary.failed,
      succeeded: summary.succeeded,
      failed: summary.failed,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await jobRef.update({
    status: 'completed',
    finishedAt: FieldValue.serverTimestamp(),
    errors: summary.errors.slice(0, 100), // نحتفظ بعينة فقط لتفادي تضخم الوثيقة
  });

  logger.info('batch_run_completed', {
    jobName,
    total: summary.total,
    succeeded: summary.succeeded,
    failed: summary.failed,
  });

  return summary;
}

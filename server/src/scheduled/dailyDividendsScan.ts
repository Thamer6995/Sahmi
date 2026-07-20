import { refreshDividends } from '../jobs/refreshDividends';
import { getScanTargetSymbols } from '../jobs/scanTargets';
import { getChunkProgress, saveChunkProgress, clearChunkProgress } from '../repo/scheduleStateRepo';
import { logger } from '../utils/logger';

const JOB_KEY = 'dailyDividendsScan';
const CHUNK_SIZE = 100; // طلب SAHMK واحد فقط لكل رمز هنا (بخلاف المالية) فحجم الدفعة أكبر

export interface DailyDividendsScanResult {
  done: boolean;
  processed: number;
  total: number;
  chunkFailed: number;
}

/**
 * يُستدعى يوميًا (4:00 صباحًا بتوقيت الرياض عبر GitHub Actions cron).
 * مقسّم لدفعات لنفس السبب الموجود في weeklyFinancialsScan.ts - استدعاء واحد
 * يمر على كل رموز السوق قد يتوقف بصمت قبل اكتماله.
 */
export async function runDailyDividendsScan(signal?: AbortSignal): Promise<DailyDividendsScanResult> {
  let progress = await getChunkProgress(JOB_KEY);

  if (!progress) {
    logger.info('daily_dividends_scan_cycle_started');
    const symbols = await getScanTargetSymbols();
    progress = { remaining: symbols, total: symbols.length };
  }

  if (signal?.aborted) return { done: false, processed: progress.total - progress.remaining.length, total: progress.total, chunkFailed: 0 };

  const chunk = progress.remaining.slice(0, CHUNK_SIZE);
  const summary = await refreshDividends(chunk, signal);
  const actuallyProcessed = summary.succeeded + summary.failed;
  const remainingAfter = progress.remaining.slice(actuallyProcessed);
  const processed = progress.total - remainingAfter.length;

  if (remainingAfter.length === 0) {
    await clearChunkProgress(JOB_KEY);
    logger.info('daily_dividends_scan_cycle_completed', { total: progress.total });
  } else {
    await saveChunkProgress(JOB_KEY, remainingAfter, progress.total);
  }

  return {
    done: remainingAfter.length === 0,
    processed,
    total: progress.total,
    chunkFailed: summary.failed,
  };
}

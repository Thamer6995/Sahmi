import { refreshCompanies } from '../jobs/refreshCompanies';
import { refreshFinancialsAndRatios } from '../jobs/refreshFinancialsAndRatios';
import { getScanTargetSymbols } from '../jobs/scanTargets';
import { getChunkProgress, saveChunkProgress, clearChunkProgress } from '../repo/scheduleStateRepo';
import { logger } from '../utils/logger';

const JOB_KEY = 'weeklyFinancialsScan';
const CHUNK_SIZE = 50;

export interface WeeklyFinancialsScanResult {
  done: boolean;
  processed: number;
  total: number;
  chunkFailed: number;
}

/**
 * يُستدعى أسبوعيًا (الأحد 3:00 صباحًا بتوقيت الرياض عبر GitHub Actions cron).
 * ينفّذ دفعة واحدة فقط بحجم CHUNK_SIZE في كل استدعاء بدل كل السوق مرة واحدة
 * (انظر التعليق في scheduleStateRepo.ts لسبب هذا التصميم)، ويُعيد `done`
 * ليعرف المستدعي (workflow الأسبوعي أو اختبار يدوي) هل يحتاج يستدعي مرة
 * أخرى لإكمال الدورة أم انتهت.
 */
export async function runWeeklyFinancialsScan(): Promise<WeeklyFinancialsScanResult> {
  let progress = await getChunkProgress(JOB_KEY);

  if (!progress) {
    logger.info('weekly_financials_scan_cycle_started');
    await refreshCompanies();
    const symbols = await getScanTargetSymbols();
    progress = { remaining: symbols, total: symbols.length };
  }

  const chunk = progress.remaining.slice(0, CHUNK_SIZE);
  const summary = await refreshFinancialsAndRatios(chunk);
  const remainingAfter = progress.remaining.slice(chunk.length);
  const processed = progress.total - remainingAfter.length;

  if (remainingAfter.length === 0) {
    await clearChunkProgress(JOB_KEY);
    logger.info('weekly_financials_scan_cycle_completed', { total: progress.total });
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

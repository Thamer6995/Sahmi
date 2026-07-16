import { refreshCompanies } from '../jobs/refreshCompanies';
import { refreshFinancialsAndRatios } from '../jobs/refreshFinancialsAndRatios';
import { getScanTargetSymbols } from '../jobs/scanTargets';
import { logger } from '../utils/logger';

/** يُستدعى أسبوعيًا (الأحد 3:00 صباحًا بتوقيت الرياض عبر GitHub Actions cron). */
export async function runWeeklyFinancialsScan(): Promise<{ symbolsCount: number; failed: number }> {
  logger.info('weekly_financials_scan_started');
  await refreshCompanies();
  const symbols = await getScanTargetSymbols();
  const summary = await refreshFinancialsAndRatios(symbols);
  logger.info('weekly_financials_scan_completed', { symbolsCount: symbols.length, failed: summary.failed });
  return { symbolsCount: symbols.length, failed: summary.failed };
}

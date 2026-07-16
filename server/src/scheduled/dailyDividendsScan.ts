import { refreshDividends } from '../jobs/refreshDividends';
import { getScanTargetSymbols } from '../jobs/scanTargets';
import { logger } from '../utils/logger';

/** يُستدعى يوميًا (4:00 صباحًا بتوقيت الرياض عبر GitHub Actions cron). */
export async function runDailyDividendsScan(): Promise<{ symbolsCount: number; failed: number }> {
  logger.info('daily_dividends_scan_started');
  const symbols = await getScanTargetSymbols();
  const summary = await refreshDividends(symbols);
  logger.info('daily_dividends_scan_completed', { symbolsCount: symbols.length, failed: summary.failed });
  return { symbolsCount: symbols.length, failed: summary.failed };
}

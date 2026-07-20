import { runAlertCheckForSymbol } from './runAlertCheck';
import { runBatched, BatchRunSummary } from '../utils/batchRunner';
import { logger } from '../utils/logger';

const CONCURRENCY = 5;

/** يحسب التقييم ويطبّق قواعد التنبيه لكل رمز - فشل سهم واحد لا يوقف البقية. */
export async function scanAndAlertAllSymbols(symbols: string[], signal?: AbortSignal): Promise<BatchRunSummary> {
  return runBatched(
    'scanAndAlert',
    symbols,
    (symbol) => symbol,
    async (symbol, itemSignal) => {
      try {
        await runAlertCheckForSymbol(symbol, itemSignal);
      } catch (error) {
        logger.error('scan_and_alert_symbol_failed', { symbol, message: (error as Error).message });
        throw error;
      }
    },
    CONCURRENCY,
    signal
  );
}

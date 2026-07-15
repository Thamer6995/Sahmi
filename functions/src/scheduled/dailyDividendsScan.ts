import { onSchedule } from 'firebase-functions/v2/scheduler';
import { SAHMK_API_KEY } from '../config/secrets';
import { refreshDividends } from '../jobs/refreshDividends';
import { getScanTargetSymbols } from '../jobs/scanTargets';
import { logger } from '../utils/logger';

/** تُنفَّذ يوميًا (4:00 صباحًا بتوقيت الرياض) لتحديث سجل التوزيعات. */
export const dailyDividendsScan = onSchedule(
  {
    schedule: '0 4 * * *',
    timeZone: 'Asia/Riyadh',
    secrets: [SAHMK_API_KEY],
    timeoutSeconds: 1800,
    memory: '512MiB',
  },
  async () => {
    logger.info('daily_dividends_scan_started');
    const symbols = await getScanTargetSymbols();
    const summary = await refreshDividends(symbols);
    logger.info('daily_dividends_scan_completed', { symbolsCount: symbols.length, failed: summary.failed });
  }
);

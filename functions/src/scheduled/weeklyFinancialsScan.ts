import { onSchedule } from 'firebase-functions/v2/scheduler';
import { SAHMK_API_KEY } from '../config/secrets';
import { refreshCompanies } from '../jobs/refreshCompanies';
import { refreshFinancialsAndRatios } from '../jobs/refreshFinancialsAndRatios';
import { getScanTargetSymbols } from '../jobs/scanTargets';
import { logger } from '../utils/logger';

/**
 * تُنفَّذ أسبوعيًا (الأحد 3:00 صباحًا بتوقيت الرياض - خارج ساعات التداول
 * تمامًا) لتحديث دليل الشركات (نادرًا ما يتغير) ثم القوائم المالية والنسب.
 */
export const weeklyFinancialsScan = onSchedule(
  {
    schedule: '0 3 * * 0',
    timeZone: 'Asia/Riyadh',
    secrets: [SAHMK_API_KEY],
    timeoutSeconds: 1800,
    memory: '512MiB',
  },
  async () => {
    logger.info('weekly_financials_scan_started');
    await refreshCompanies();
    const symbols = await getScanTargetSymbols();
    const summary = await refreshFinancialsAndRatios(symbols);
    logger.info('weekly_financials_scan_completed', { symbolsCount: symbols.length, failed: summary.failed });
  }
);

import { APP_TIMEZONE } from '../config/env';
import { getSettings } from '../repo/settingsRepo';
import { hasRunToday, markRunToday } from '../repo/scheduleStateRepo';
import { getScanTargetSymbols } from '../jobs/scanTargets';
import { refreshQuotes } from '../jobs/refreshQuotes';
import { refreshHistorical } from '../jobs/refreshHistorical';
import { scanAndAlertAllSymbols } from '../jobs/scanAndAlertAll';
import { logger } from '../utils/logger';

const JOB_KEY = 'dailyPriceAndAlertScan';

function riyadhNow(): { date: string; time: string } {
  const tz = APP_TIMEZONE() || 'Asia/Riyadh';
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  return { date, time };
}

/**
 * تُستدعى بشكل متكرر (كل 30 دقيقة عبر GitHub Actions cron)، لكنها لا
 * تُنفّذ الفحص الفعلي (أسعار + OHLCV + تقييم + تنبيهات) إلا مرة واحدة
 * يوميًا عند بلوغ الوقت المضبوط في settings.scanSchedule (بتوقيت الرياض).
 * هذا يجعل "وقت الفحص" قابلًا للتعديل فعليًا من صفحة الإعدادات دون
 * الحاجة لتعديل جدول GitHub Actions نفسه.
 */
export async function runDailyPriceAndAlertScan(): Promise<{ ranToday: boolean; symbolsCount?: number }> {
  const { date, time } = riyadhNow();

  if (await hasRunToday(JOB_KEY, date)) {
    return { ranToday: false };
  }

  const settings = await getSettings();
  if (time < settings.scanSchedule) {
    return { ranToday: false }; // لم يحن وقت الفحص المضبوط بعد
  }

  logger.info('daily_scan_started', { date, time, scheduledFor: settings.scanSchedule });

  const symbols = await getScanTargetSymbols();
  const quotesSummary = await refreshQuotes(symbols);
  const historicalSummary = await refreshHistorical(symbols);
  const alertsSummary = await scanAndAlertAllSymbols(symbols);

  await markRunToday(JOB_KEY, date);

  logger.info('daily_scan_completed', {
    symbolsCount: symbols.length,
    quotesFailed: quotesSummary.failed,
    historicalFailed: historicalSummary.failed,
    alertsFailed: alertsSummary.failed,
  });

  return { ranToday: true, symbolsCount: symbols.length };
}

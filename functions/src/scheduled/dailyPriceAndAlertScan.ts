import { onSchedule } from 'firebase-functions/v2/scheduler';
import { SAHMK_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, APP_TIMEZONE } from '../config/secrets';
import { getSettings } from '../repo/settingsRepo';
import { hasRunToday, markRunToday } from '../repo/scheduleStateRepo';
import { getScanTargetSymbols } from '../jobs/scanTargets';
import { refreshQuotes } from '../jobs/refreshQuotes';
import { refreshHistorical } from '../jobs/refreshHistorical';
import { scanAndAlertAllSymbols } from '../jobs/scanAndAlertAll';
import { logger } from '../utils/logger';

const JOB_KEY = 'dailyPriceAndAlertScan';

function riyadhNow(): { date: string; time: string } {
  const tz = APP_TIMEZONE.value() || 'Asia/Riyadh';
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
 * تُستدعى كل 30 دقيقة على مدار اليوم، لكنها لا تُنفّذ الفحص الفعلي (أسعار
 * + OHLCV + تقييم + تنبيهات) إلا مرة واحدة يوميًا عند بلوغ الوقت المضبوط
 * في الإعدادات (settings.scanSchedule، افتراضيًا بعد إغلاق السوق
 * السعودي ~17:30 بتوقيت الرياض). بهذا يصبح "وقت الفحص" قابلًا للتعديل
 * فعليًا من صفحة الإعدادات دون الحاجة لإعادة نشر Functions في كل مرة.
 */
export const dailyPriceAndAlertScan = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'Asia/Riyadh',
    secrets: [SAHMK_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID],
    timeoutSeconds: 1800,
    memory: '512MiB',
  },
  async () => {
    const { date, time } = riyadhNow();

    if (await hasRunToday(JOB_KEY, date)) return;

    const settings = await getSettings();
    if (time < settings.scanSchedule) return; // لم يحن وقت الفحص المضبوط بعد

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
  }
);

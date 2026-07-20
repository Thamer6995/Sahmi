import { APP_TIMEZONE } from '../config/env';
import { getSettings } from '../repo/settingsRepo';
import { hasRunToday, markRunToday, getDailyScanState, saveDailyScanState, clearDailyScanState } from '../repo/scheduleStateRepo';
import { getScanTargetSymbols } from '../jobs/scanTargets';
import { refreshQuotes } from '../jobs/refreshQuotes';
import { refreshHistorical } from '../jobs/refreshHistorical';
import { scanAndAlertAllSymbols } from '../jobs/scanAndAlertAll';
import { logger } from '../utils/logger';

const JOB_KEY = 'dailyPriceAndAlertScan';
const HISTORICAL_CHUNK_SIZE = 60;

export interface DailyScanResult {
  ranToday: boolean;
  done: boolean;
  /** true فقط عندما تكون دورة معالجة دفعات (البيانات التاريخية) شغّالة فعليًا وتحتاج استدعاءً آخر قريبًا. */
  active?: boolean;
  processed?: number;
  total?: number;
}

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
 * تُنفّذ الفحص الفعلي إلا مرة واحدة يوميًا عند بلوغ الوقت المضبوط في
 * settings.scanSchedule (بتوقيت الرياض) - هذا يجعل "وقت الفحص" قابلًا
 * للتعديل فعليًا من صفحة الإعدادات دون الحاجة لتعديل جدول GitHub Actions.
 *
 * الأسعار (refreshQuotes) تُجلب بالجملة (Bulk) في استدعاء واحد سريع، لكن
 * البيانات التاريخية (refreshHistorical) تحتاج طلب SAHMK منفصل لكل رمز -
 * فمقسّمة لدفعات عبر استدعاءات متكررة لنفس السبب الموثّق في
 * weeklyFinancialsScan.ts (استدعاء واحد يمر على كل السوق دفعة واحدة يتوقف
 * أحيانًا بصمت قبل اكتماله). مرحلة التقييم والتنبيهات (Firestore فقط، بلا
 * طلبات SAHMK) سريعة بما يكفي لتبقى دفعة واحدة.
 */
export async function runDailyPriceAndAlertScan(signal?: AbortSignal): Promise<DailyScanResult> {
  const { date, time } = riyadhNow();

  if (await hasRunToday(JOB_KEY, date)) {
    return { ranToday: false, done: true };
  }

  let state = await getDailyScanState();
  if (state && state.date !== date) {
    state = undefined; // حالة من يوم سابق (لم يكتمل بالأمس مثلًا) - تُهمَل ونبدأ دورة جديدة
  }

  if (!state) {
    const settings = await getSettings();
    if (time < settings.scanSchedule) {
      return { ranToday: false, done: false }; // لم يحن وقت الفحص المضبوط بعد
    }

    logger.info('daily_scan_started', { date, time, scheduledFor: settings.scanSchedule });
    const symbols = await getScanTargetSymbols();
    await refreshQuotes(symbols, signal); // Bulk - سريع، لا يحتاج تقسيم
    state = { date, phase: 'historical', historicalRemaining: symbols, allSymbols: symbols, total: symbols.length };
  }

  if (signal?.aborted) return { ranToday: false, done: false, active: true, total: state.total };

  if (state.phase === 'historical') {
    const remaining = state.historicalRemaining;
    const chunk = remaining.slice(0, HISTORICAL_CHUNK_SIZE);
    await refreshHistorical(chunk, signal);
    const remainingAfter = remaining.slice(chunk.length);

    if (remainingAfter.length > 0 || signal?.aborted) {
      const nextState = { ...state, historicalRemaining: remainingAfter };
      await saveDailyScanState(nextState);
      return {
        ranToday: false,
        done: false,
        active: true,
        processed: state.total - remainingAfter.length,
        total: state.total,
      };
    }
    state = { ...state, phase: 'alerts', historicalRemaining: [] };
  }

  if (signal?.aborted) return { ranToday: false, done: false, active: true, total: state.total };

  // state.phase === 'alerts': تقييم + تنبيهات لكل السوق دفعة واحدة (Firestore فقط، بلا طلبات SAHMK)
  const alertsSummary = await scanAndAlertAllSymbols(state.allSymbols, signal);

  if (signal?.aborted) {
    // لا نعلّم اليوم كمكتمل ولا نمسح حالة التقدّم إذا أُلغي أثناء مرحلة التنبيهات -
    // التشغيلة التالية تعيد محاولة التنبيهات لأي رمز لم تتم معالجته فعليًا.
    return { ranToday: false, done: false, active: true, total: state.total };
  }

  await markRunToday(JOB_KEY, date);
  await clearDailyScanState();

  logger.info('daily_scan_completed', { symbolsCount: state.total, alertsFailed: alertsSummary.failed });

  return { ranToday: true, done: true, total: state.total };
}

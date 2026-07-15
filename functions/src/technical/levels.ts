import { OhlcvBar } from './types';

const TRADING_SESSIONS_PER_YEAR = 252; // تقريب شائع لعدد جلسات التداول خلال 52 أسبوعًا

/** أعلى سعر (high) خلال آخر 52 أسبوعًا تداولًا (~252 جلسة). */
export function fiftyTwoWeekHigh(bars: OhlcvBar[]): number | undefined {
  if (bars.length === 0) return undefined;
  const window = bars.slice(-TRADING_SESSIONS_PER_YEAR);
  return Math.max(...window.map((b) => b.high));
}

/** أدنى سعر (low) خلال آخر 52 أسبوعًا تداولًا - يُستخدم في مقارنة التقييم (القسم B). */
export function fiftyTwoWeekLow(bars: OhlcvBar[]): number | undefined {
  if (bars.length === 0) return undefined;
  const window = bars.slice(-TRADING_SESSIONS_PER_YEAR);
  return Math.min(...window.map((b) => b.low));
}

/**
 * أدنى سعر إغلاق خلال آخر 52 أسبوعًا - يُستخدم تحديدًا في قاعدة "القرب
 * من دعم سنوي" (القسم D) لأن المواصفة تنص صراحة على "أدنى إغلاق" وليس
 * أدنى سعر تداول داخل الجلسة.
 */
export function fiftyTwoWeekLowClose(closes: number[]): number | undefined {
  if (closes.length === 0) return undefined;
  const window = closes.slice(-TRADING_SESSIONS_PER_YEAR);
  return Math.min(...window);
}

/** المسافة النسبية المئوية لـ value عن reference: موجبة إن كان value أعلى. */
export function relativeDistancePercent(value: number, reference: number): number | undefined {
  if (reference === 0) return undefined;
  return ((value - reference) / reference) * 100;
}

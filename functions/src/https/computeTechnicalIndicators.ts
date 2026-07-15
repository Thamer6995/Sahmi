import { onCall } from 'firebase-functions/v2/https';
import { requireAuth } from '../utils/auth';
import { validateSymbol } from '../utils/validate';
import { getRecentBars } from '../repo/historicalPricesRepo';
import { sma50, sma200, rsi14, fiftyTwoWeekHigh, fiftyTwoWeekLow, fiftyTwoWeekLowClose, relativeDistancePercent } from '../technical';

/**
 * دالة تحقّق (المرحلة 4): تحسب المؤشرات الفنية من البيانات المخزَّنة
 * فعليًا في Firestore لسهم معين، للتأكد من صحة الحسابات على بيانات
 * حقيقية قبل استخدامها في نظام التقييم (المرحلة 5).
 */
export const computeTechnicalIndicators = onCall({ region: 'me-central1' }, async (request) => {
  requireAuth(request);
  const symbol = validateSymbol(request.data?.symbol);

  const bars = await getRecentBars(symbol, 250);
  if (bars.length === 0) {
    return { ok: false, message: 'لا توجد بيانات تاريخية مخزَّنة لهذا السهم بعد.' };
  }

  const closes = bars.map((b) => b.close);
  const lastClose = closes[closes.length - 1];
  const high52w = fiftyTwoWeekHigh(bars);
  const low52w = fiftyTwoWeekLow(bars);
  const low52wClose = fiftyTwoWeekLowClose(closes);

  return {
    ok: true,
    symbol,
    sessionsAvailable: bars.length,
    lastClose,
    lastDate: bars[bars.length - 1].date,
    sma50: sma50(closes),
    sma200: sma200(closes),
    rsi14: rsi14(closes),
    fiftyTwoWeekHigh: high52w,
    fiftyTwoWeekLow: low52w,
    fiftyTwoWeekLowClose: low52wClose,
    distanceFromHighPercent: high52w !== undefined ? relativeDistancePercent(lastClose, high52w) : undefined,
    distanceFromLowClosePercent:
      low52wClose !== undefined ? relativeDistancePercent(lastClose, low52wClose) : undefined,
  };
});

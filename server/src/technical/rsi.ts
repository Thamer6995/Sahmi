/**
 * RSI (Relative Strength Index) بطريقة Wilder's Smoothing القياسية
 * (نفس الطريقة المستخدمة في معظم منصات التداول). closes يجب أن تكون
 * مرتبة تصاعديًا زمنيًا (الأقدم أولًا). period الافتراضي 14.
 *
 * يُعيد undefined إذا لم تتوفر بيانات كافية (نحتاج period+1 إغلاقًا على
 * الأقل) بدل قيمة وهمية.
 */
export function rsi14(closes: number[], period = 14): number | undefined {
  if (closes.length < period + 1) return undefined;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum += -diff;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgGain === 0 && avgLoss === 0) return 50; // لا تغيّر في السعر إطلاقًا
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

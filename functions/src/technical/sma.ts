/**
 * المتوسط المتحرك البسيط (Simple Moving Average) لآخر `period` قيمة من
 * سلسلة أسعار الإغلاق مرتبة زمنيًا تصاعديًا (الأقدم أولًا). يُعيد
 * undefined إذا لم تتوفر بيانات كافية بدل قيمة وهمية.
 */
export function sma(closes: number[], period: number): number | undefined {
  if (closes.length < period || period <= 0) return undefined;
  const window = closes.slice(closes.length - period);
  const sum = window.reduce((acc, v) => acc + v, 0);
  return sum / period;
}

export function sma50(closes: number[]): number | undefined {
  return sma(closes, 50);
}

export function sma200(closes: number[]): number | undefined {
  return sma(closes, 200);
}

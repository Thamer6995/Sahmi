import { CategoryResult, ScoreCheck, sumCategory } from './types';
import { sma50, sma200, rsi14, fiftyTwoWeekLowClose } from '../technical';
import { OhlcvBar } from '../technical/types';

/** القسم D - التوقيت الفني (15 نقطة). `bars` يجب أن تكون مرتّبة تصاعديًا (الأقدم أولًا). */
export function computeTechnicalScore(bars: OhlcvBar[], currentPrice?: number): CategoryResult {
  const closes = bars.map((b) => b.close);
  const ma50 = sma50(closes);
  const ma200 = sma200(closes);

  const checks: ScoreCheck[] = [
    computeRsiCheck(closes),
    computeMa200Check(currentPrice, ma200),
    computeMa50Check(currentPrice, ma50),
    computeMa50AboveMa200Check(ma50, ma200),
    computeAnnualSupportCheck(currentPrice, closes),
  ];

  return sumCategory(checks, 15);
}

function computeRsiCheck(closes: number[]): ScoreCheck {
  const rsi = rsi14(closes);
  if (rsi === undefined) {
    return { key: 'rsi14', points: 0, maxPoints: 4, available: false, missingDataNote: 'لا تتوفر بيانات كافية لحساب RSI' };
  }

  let points = 0;
  let reason: string | undefined;
  let warning: string | undefined;

  if (rsi >= 30 && rsi < 40) {
    points = 4;
    reason = `RSI (${rsi.toFixed(1)}) في نطاق تشبّع بيعي معتدل`;
  } else if (rsi < 30) {
    points = 3;
    warning = `RSI (${rsi.toFixed(1)}) منخفض جدًا - قد يشير إلى استمرار هبوط قوي`;
  } else if (rsi >= 40 && rsi < 55) {
    points = 2;
    reason = `RSI (${rsi.toFixed(1)}) في نطاق محايد إيجابي`;
  } else if (rsi > 70) {
    warning = `RSI (${rsi.toFixed(1)}) يشير إلى تشبع شرائي`;
  }

  return { key: 'rsi14', points, maxPoints: 4, available: true, reason, warning };
}

function computeMa200Check(price?: number, ma200?: number): ScoreCheck {
  if (price === undefined || ma200 === undefined) {
    return {
      key: 'ma200_position',
      points: 0,
      maxPoints: 4,
      available: false,
      missingDataNote: 'لا تتوفر بيانات كافية لحساب المتوسط المتحرك 200 يوم',
    };
  }

  const distance = ((price - ma200) / ma200) * 100;
  let points = 0;
  let reason: string | undefined;
  let warning: string | undefined;

  if (price > ma200) {
    points = 4;
    reason = 'السعر أعلى المتوسط المتحرك 200 يوم';
  } else if (distance >= -5) {
    points = 2;
    reason = 'السعر أسفل المتوسط المتحرك 200 يوم بفارق بسيط (أقل من 5%)';
  } else if (distance < -10) {
    warning = 'السعر أسفل المتوسط المتحرك 200 يوم بأكثر من 10% - اتجاه هابط';
  }

  return { key: 'ma200_position', points, maxPoints: 4, available: true, reason, warning };
}

function computeMa50Check(price?: number, ma50?: number): ScoreCheck {
  if (price === undefined || ma50 === undefined) {
    return {
      key: 'ma50_position',
      points: 0,
      maxPoints: 2,
      available: false,
      missingDataNote: 'لا تتوفر بيانات كافية لحساب المتوسط المتحرك 50 يوم',
    };
  }
  const points = price > ma50 ? 2 : 0;
  return {
    key: 'ma50_position',
    points,
    maxPoints: 2,
    available: true,
    reason: points > 0 ? 'السعر أعلى المتوسط المتحرك 50 يوم' : undefined,
  };
}

function computeMa50AboveMa200Check(ma50?: number, ma200?: number): ScoreCheck {
  if (ma50 === undefined || ma200 === undefined) {
    return {
      key: 'ma50_above_ma200',
      points: 0,
      maxPoints: 2,
      available: false,
      missingDataNote: 'لا تتوفر بيانات كافية للمقارنة بين المتوسطين 50 و200 يوم',
    };
  }
  const points = ma50 > ma200 ? 2 : 0;
  return {
    key: 'ma50_above_ma200',
    points,
    maxPoints: 2,
    available: true,
    reason: points > 0 ? 'المتوسط المتحرك 50 يوم أعلى من المتوسط المتحرك 200 يوم' : undefined,
  };
}

function computeAnnualSupportCheck(price?: number, closes?: number[]): ScoreCheck {
  const lowClose = closes ? fiftyTwoWeekLowClose(closes) : undefined;
  if (price === undefined || lowClose === undefined || lowClose === 0) {
    return {
      key: 'annual_support_proximity',
      points: 0,
      maxPoints: 3,
      available: false,
      missingDataNote: 'لا تتوفر بيانات كافية لحساب القرب من الدعم السنوي',
    };
  }

  const distance = ((price - lowClose) / lowClose) * 100;
  const points = distance <= 5 ? 3 : 0;

  return {
    key: 'annual_support_proximity',
    points,
    maxPoints: 3,
    available: true,
    reason:
      points > 0
        ? 'السعر ضمن منطقة سعرية تاريخية محتملة (قرب أدنى إغلاق خلال 52 أسبوعًا) - وليست دعمًا مؤكدًا'
        : undefined,
  };
}

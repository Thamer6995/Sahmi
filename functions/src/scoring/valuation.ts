import { CategoryResult, ScoreCheck, sumCategory } from './types';

/**
 * القسم B - التقييم المالي (25 نقطة، مجموع البنود المفصّلة أدناه = 23
 * كحد أقصى نظري حسب توزيع النقاط المحدد صراحة لكل بند في المواصفة).
 * الأفضلية دائمًا للمقارنة داخل نفس القطاع - متوسط القطاع (sectorAvgPE/
 * sectorAvgPB) يُحسب خارجيًا من بيانات الشركات الأخرى المخزَّنة في نفس
 * القطاع (انظر scoring/sectorAverages.ts) ويُمرَّر هنا جاهزًا.
 */

interface ValuationInputs {
  pe?: number;
  pb?: number;
  sectorAvgPE?: number;
  sectorAvgPB?: number;
  price?: number;
  fiftyTwoWeekLow?: number;
}

function isValidPositive(value?: number): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

export function computeValuationScore(inputs: ValuationInputs): CategoryResult {
  const checks: ScoreCheck[] = [
    computePeCheck(inputs.pe, inputs.sectorAvgPE),
    computePbCheck(inputs.pb, inputs.sectorAvgPB),
    computeEarningsYieldCheck(inputs.pe),
    computeProximityToLowCheck(inputs.price, inputs.fiftyTwoWeekLow),
  ];

  return sumCategory(checks, 25);
}

function computePeCheck(pe?: number, sectorAvg?: number): ScoreCheck {
  if (pe === undefined) {
    return { key: 'pe_vs_sector', points: 0, maxPoints: 10, available: false, missingDataNote: 'لا تتوفر بيانات P/E' };
  }
  if (!isValidPositive(pe)) {
    return {
      key: 'pe_vs_sector',
      points: 0,
      maxPoints: 10,
      available: true,
      warning: 'الشركة خاسرة أو نسبة P/E غير صالحة (سالبة) - لا تُعتبر فرصة تقييم منخفض',
      critical: true,
    };
  }
  if (sectorAvg === undefined) {
    return {
      key: 'pe_vs_sector',
      points: 0,
      maxPoints: 10,
      available: false,
      missingDataNote: 'لا تتوفر بيانات كافية لحساب متوسط P/E للقطاع',
    };
  }

  let points = 0;
  if (pe < sectorAvg * 0.8) points = 10;
  else if (pe < sectorAvg) points = 7;
  else if (pe <= sectorAvg * 1.15) points = 4;

  return {
    key: 'pe_vs_sector',
    points,
    maxPoints: 10,
    available: true,
    reason:
      points >= 7 ? 'مكرر ربحية أقل من متوسط القطاع' : points === 4 ? 'مكرر ربحية قريب من متوسط القطاع' : undefined,
    warning: points === 0 ? 'مكرر الربحية أعلى بكثير من متوسط القطاع' : undefined,
  };
}

function computePbCheck(pb?: number, sectorAvg?: number): ScoreCheck {
  if (pb === undefined) {
    return { key: 'pb_vs_sector', points: 0, maxPoints: 5, available: false, missingDataNote: 'لا تتوفر بيانات P/B' };
  }
  if (!isValidPositive(pb)) {
    return { key: 'pb_vs_sector', points: 0, maxPoints: 5, available: true, warning: 'نسبة P/B غير صالحة' };
  }
  if (sectorAvg === undefined) {
    return {
      key: 'pb_vs_sector',
      points: 0,
      maxPoints: 5,
      available: false,
      missingDataNote: 'لا تتوفر بيانات كافية لحساب متوسط P/B للقطاع',
    };
  }

  let points = 0;
  if (pb < sectorAvg * 0.8) points = 5;
  else if (pb < sectorAvg) points = 3;
  else if (pb <= sectorAvg * 1.15) points = 1;

  return {
    key: 'pb_vs_sector',
    points,
    maxPoints: 5,
    available: true,
    reason: points > 0 ? 'القيمة الدفترية معقولة مقارنة بمتوسط القطاع' : undefined,
  };
}

function computeEarningsYieldCheck(pe?: number): ScoreCheck {
  if (pe === undefined) {
    return {
      key: 'earnings_yield',
      points: 0,
      maxPoints: 4,
      available: false,
      missingDataNote: 'لا تتوفر بيانات P/E لحساب Earnings Yield',
    };
  }
  if (!isValidPositive(pe)) {
    return {
      key: 'earnings_yield',
      points: 0,
      maxPoints: 4,
      available: true,
      warning: 'لا يمكن حساب Earnings Yield لشركة خاسرة (P/E سالب أو غير صالح)',
    };
  }

  const earningsYield = (1 / pe) * 100;
  let points = 0;
  if (earningsYield >= 10) points = 4;
  else if (earningsYield >= 7) points = 3;
  else if (earningsYield >= 5) points = 2;
  else if (earningsYield >= 3) points = 1;

  return {
    key: 'earnings_yield',
    points,
    maxPoints: 4,
    available: true,
    reason: points > 0 ? `عائد الأرباح (Earnings Yield) ${earningsYield.toFixed(1)}%` : undefined,
  };
}

function computeProximityToLowCheck(price?: number, low?: number): ScoreCheck {
  if (price === undefined || low === undefined || low === 0) {
    return {
      key: 'proximity_to_52w_low',
      points: 0,
      maxPoints: 4,
      available: false,
      missingDataNote: 'لا تتوفر بيانات كافية لحساب القرب من أدنى سعر خلال 52 أسبوعًا',
    };
  }

  const distance = ((price - low) / low) * 100;
  let points = 0;
  if (distance <= 10) points = 4;
  else if (distance <= 20) points = 2;

  return {
    key: 'proximity_to_52w_low',
    points,
    maxPoints: 4,
    available: true,
    reason: points > 0 ? `السعر قريب من أدنى سعر خلال 52 أسبوعًا (+${distance.toFixed(1)}%)` : undefined,
  };
}

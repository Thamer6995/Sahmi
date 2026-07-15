import { CategoryResult, ScoreCheck, sumCategory } from './types';
import { NormalizedFinancialPeriod, NormalizedRatios } from '../services/sahmk/mappers';

/**
 * القسم A - جودة الشركة (35 نقطة). يتوقع أن `annualPeriods` مرتّبة
 * تصاعديًا حسب الفترة (الأقدم أولًا) - المُستدعي مسؤول عن الترتيب
 * والتصفية (سنوي فقط) قبل الاستدعاء.
 *
 * حدود CAGR ونمو الأرباح (15%/10%) واستقرار هامش الربح (تحمّل 1 نقطة
 * مئوية) هي افتراضات معقولة غير منصوص عليها رقميًا في المواصفة الأصلية
 * (التي تركت "حتى 7 نقاط" مفتوحة) - يمكن تعديلها هنا مباشرة إن رغبت.
 */

interface QualityInputs {
  annualPeriods: NormalizedFinancialPeriod[];
  ratios?: NormalizedRatios;
}

export function computeQualityScore(inputs: QualityInputs): CategoryResult {
  const checks: ScoreCheck[] = [];
  const periods = inputs.annualPeriods;

  checks.push(computePositiveNetIncomeCheck(periods));
  checks.push(computeNetIncomeGrowthCheck(periods));
  checks.push(computeOperatingCashFlowCheck(periods));
  checks.push(computeRoeCheck(inputs.ratios?.roe));
  checks.push(computeDebtToEquityCheck(inputs.ratios?.debtToEquity));
  checks.push(computeProfitMarginTrendCheck(periods));

  return sumCategory(checks, 35);
}

function computePositiveNetIncomeCheck(periods: NormalizedFinancialPeriod[]): ScoreCheck {
  const netIncomes = periods.map((p) => p.netIncome).filter((v): v is number => v !== undefined);
  if (netIncomes.length === 0) {
    return {
      key: 'positive_net_income_all_years',
      points: 0,
      maxPoints: 8,
      available: false,
      missingDataNote: 'لا تتوفر بيانات صافي الربح لتقييم هذا الشرط',
    };
  }
  const allPositive = netIncomes.every((v) => v > 0);
  return {
    key: 'positive_net_income_all_years',
    points: allPositive ? 8 : 0,
    maxPoints: 8,
    available: true,
    reason: allPositive ? 'أرباح موجبة في كل السنوات المتاحة' : undefined,
    warning: allPositive ? undefined : 'صافي الربح كان سالبًا في إحدى السنوات المتاحة على الأقل',
  };
}

function computeNetIncomeGrowthCheck(periods: NormalizedFinancialPeriod[]): ScoreCheck {
  const values = periods.map((p) => p.netIncome).filter((v): v is number => v !== undefined);
  if (values.length < 2) {
    return {
      key: 'net_income_growth',
      points: 0,
      maxPoints: 7,
      available: false,
      missingDataNote: 'لا تتوفر سنتان على الأقل من صافي الربح لتقييم النمو',
    };
  }

  const first = values[0];
  const last = values[values.length - 1];
  const years = values.length - 1;
  const limitedData = values.length < 3;

  if (first <= 0) {
    // لا يمكن حساب معدل نمو نسبي (CAGR) موثوق إن كانت سنة الأساس خاسرة
    const improved = last > first;
    return {
      key: 'net_income_growth',
      points: improved ? 3 : 0,
      maxPoints: 7,
      available: true,
      reason: improved ? 'تحسّن صافي الربح مقارنة ببداية الفترة (كانت خاسرة)' : undefined,
      warning: 'لا يمكن حساب معدل نمو (CAGR) موثوق لأن الأرباح كانت سالبة في بداية الفترة',
    };
  }

  const cagr = Math.pow(last / first, 1 / years) - 1;
  const declineCount = values.slice(1).filter((v, i) => v < values[i]).length;
  const stable = declineCount <= 1;

  let awarded = 0;
  if (cagr >= 0.15 && stable) awarded = 7;
  else if (cagr >= 0.1 && stable) awarded = 5;
  else if (cagr > 0) awarded = 3;

  const limitedNote = limitedData ? ' (بيانات محدودة - أقل من 3 سنوات)' : '';
  return {
    key: 'net_income_growth',
    points: awarded,
    maxPoints: 7,
    available: true,
    reason: awarded > 0 ? `نمو صافي الربح ${(cagr * 100).toFixed(1)}%${limitedNote}` : undefined,
    warning: awarded === 0 ? `نمو الأرباح ضعيف أو غير مستقر${limitedNote}` : undefined,
  };
}

function computeOperatingCashFlowCheck(periods: NormalizedFinancialPeriod[]): ScoreCheck {
  const latestWithCf = [...periods].reverse().find((p) => p.operatingCashFlow !== undefined);
  if (!latestWithCf) {
    return {
      key: 'positive_operating_cash_flow',
      points: 0,
      maxPoints: 6,
      available: false,
      missingDataNote: 'لا تتوفر بيانات التدفق النقدي التشغيلي',
    };
  }
  const positive = (latestWithCf.operatingCashFlow as number) > 0;
  return {
    key: 'positive_operating_cash_flow',
    points: positive ? 6 : 0,
    maxPoints: 6,
    available: true,
    reason: positive ? 'تدفق نقدي تشغيلي موجب' : undefined,
    warning: positive ? undefined : 'التدفق النقدي التشغيلي سالب في آخر فترة متاحة',
  };
}

function computeRoeCheck(roe?: number): ScoreCheck {
  if (roe === undefined) {
    return { key: 'roe', points: 0, maxPoints: 6, available: false, missingDataNote: 'لا تتوفر بيانات ROE' };
  }
  let points = 0;
  if (roe >= 15) points = 6;
  else if (roe >= 10) points = 4;
  else if (roe >= 5) points = 2;

  return {
    key: 'roe',
    points,
    maxPoints: 6,
    available: true,
    reason: points > 0 ? `العائد على حقوق الملكية ${roe.toFixed(1)}%` : undefined,
    warning: points === 0 ? 'العائد على حقوق الملكية ضعيف (أقل من 5%)' : undefined,
  };
}

function computeDebtToEquityCheck(debtToEquity?: number): ScoreCheck {
  if (debtToEquity === undefined) {
    return {
      key: 'debt_to_equity',
      points: 0,
      maxPoints: 5,
      available: false,
      missingDataNote: 'لا تتوفر بيانات نسبة الدين إلى حقوق الملكية',
    };
  }
  let points = 0;
  if (debtToEquity <= 0.5) points = 5;
  else if (debtToEquity <= 1) points = 3;

  return {
    key: 'debt_to_equity',
    points,
    maxPoints: 5,
    available: true,
    reason: points > 0 ? 'مستوى دين منخفض إلى معتدل مقارنة بحقوق الملكية' : undefined,
    warning: points === 0 ? 'نسبة الدين إلى حقوق الملكية مرتفعة (أكبر من 1)' : undefined,
  };
}

function computeProfitMarginTrendCheck(periods: NormalizedFinancialPeriod[]): ScoreCheck {
  const margins = periods
    .filter((p) => p.revenue !== undefined && p.revenue > 0 && p.netIncome !== undefined)
    .map((p) => (p.netIncome as number) / (p.revenue as number));

  if (margins.length < 2) {
    return {
      key: 'profit_margin_trend',
      points: 0,
      maxPoints: 3,
      available: false,
      missingDataNote: 'لا تتوفر بيانات كافية لتقييم اتجاه هامش صافي الربح',
    };
  }

  const last = margins[margins.length - 1];
  const prev = margins[margins.length - 2];
  const improvingOrStable = last >= prev - 0.01; // تحمّل بسيط (نقطة مئوية واحدة تقريبًا) لاعتباره مستقرًا

  return {
    key: 'profit_margin_trend',
    points: improvingOrStable ? 3 : 0,
    maxPoints: 3,
    available: true,
    reason: improvingOrStable ? 'هامش صافي الربح مستقر أو يتحسن' : undefined,
    warning: improvingOrStable ? undefined : 'هامش صافي الربح يتراجع',
  };
}

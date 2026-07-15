import { CategoryResult, ScoreCheck, sumCategory } from './types';
import { NormalizedDividend, NormalizedRatios } from '../services/sahmk/mappers';
import { pickNumber } from '../services/sahmk/fieldPicker';

/**
 * القسم C - التوزيعات (25 نقطة). `dividends` يجب أن تكون مرتّبة تصاعديًا
 * حسب التاريخ (الأقدم أولًا) - المُستدعي مسؤول عن الترتيب.
 */

interface DividendInputs {
  dividends: NormalizedDividend[];
  ratios?: NormalizedRatios;
}

function extractYear(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const year = parseInt(dateStr.slice(0, 4), 10);
  return Number.isFinite(year) ? year : undefined;
}

export function computeDividendScore(inputs: DividendInputs): CategoryResult {
  const checks: ScoreCheck[] = [
    computeDividendYieldCheck(inputs.ratios?.dividendYield),
    computeRegularityCheck(inputs.dividends),
    computeGrowthStabilityCheck(inputs.dividends),
    computePayoutRatioCheck(inputs.dividends, inputs.ratios),
    computeUpcomingDividendCheck(inputs.dividends),
  ];

  return sumCategory(checks, 25);
}

function computeDividendYieldCheck(dividendYield?: number): ScoreCheck {
  if (dividendYield === undefined) {
    return {
      key: 'dividend_yield',
      points: 0,
      maxPoints: 8,
      available: false,
      missingDataNote: 'لا تتوفر بيانات عائد التوزيعات',
    };
  }
  let points = 0;
  if (dividendYield >= 6) points = 8;
  else if (dividendYield >= 5) points = 6;
  else if (dividendYield >= 4) points = 4;
  else if (dividendYield >= 3) points = 2;

  return {
    key: 'dividend_yield',
    points,
    maxPoints: 8,
    available: true,
    reason: points > 0 ? `عائد توزيعات ${dividendYield.toFixed(1)}%` : undefined,
  };
}

function yearsWithDividendPaid(dividends: NormalizedDividend[]): number[] {
  const years = dividends
    .filter((d) => d.amountPerShare !== undefined && d.amountPerShare > 0)
    .map((d) => extractYear(d.distributionDate ?? d.eligibilityDate ?? d.announcementDate))
    .filter((y): y is number => y !== undefined);
  return Array.from(new Set(years)).sort((a, b) => a - b);
}

function computeRegularityCheck(dividends: NormalizedDividend[]): ScoreCheck {
  const years = yearsWithDividendPaid(dividends);
  if (years.length < 2) {
    return {
      key: 'dividend_regularity',
      points: 0,
      maxPoints: 6,
      available: false,
      missingDataNote: 'لا تتوفر سجلات كافية (سنتان على الأقل) لتقييم انتظام التوزيعات',
    };
  }

  const minYear = years[0];
  const maxYear = years[years.length - 1];
  const expectedYears = maxYear - minYear + 1;
  const gaps = expectedYears - years.length;

  let points = 0;
  if (gaps === 0) points = 6;
  else if (gaps === 1) points = 3;

  return {
    key: 'dividend_regularity',
    points,
    maxPoints: 6,
    available: true,
    reason: gaps === 0 ? 'وزّعت الشركة أرباحًا في كل سنة متاحة ضمن السجل' : undefined,
    warning: gaps === 1 ? 'انقطاع توزيعات لسنة واحدة ضمن السجل' : gaps > 1 ? 'توزيعات غير منتظمة (أكثر من انقطاع سنة)' : undefined,
  };
}

function yearlyTotals(dividends: NormalizedDividend[]): { year: number; total: number }[] {
  const byYear = new Map<number, number>();
  for (const d of dividends) {
    if (d.amountPerShare === undefined) continue;
    const year = extractYear(d.distributionDate ?? d.eligibilityDate ?? d.announcementDate);
    if (year === undefined) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + d.amountPerShare);
  }
  return Array.from(byYear.entries())
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => a.year - b.year);
}

function computeGrowthStabilityCheck(dividends: NormalizedDividend[]): ScoreCheck {
  const totals = yearlyTotals(dividends);
  if (totals.length < 2) {
    return {
      key: 'dividend_growth_stability',
      points: 0,
      maxPoints: 5,
      available: false,
      missingDataNote: 'لا تتوفر سنتان على الأقل من إجمالي التوزيعات لتقييم النمو/الاستقرار',
    };
  }

  const prev = totals[totals.length - 2].total;
  const last = totals[totals.length - 1].total;
  if (prev <= 0) {
    return {
      key: 'dividend_growth_stability',
      points: 0,
      maxPoints: 5,
      available: false,
      missingDataNote: 'لا يمكن حساب نسبة تغيّر موثوقة (السنة السابقة بلا توزيعات)',
    };
  }

  const changeRatio = last / prev;
  let points = 0;
  if (changeRatio >= 0.95) points = 5;
  else if (changeRatio >= 0.7) points = 2;

  return {
    key: 'dividend_growth_stability',
    points,
    maxPoints: 5,
    available: true,
    reason: points === 5 ? 'التوزيعات في نمو أو استقرار مقارنة بالسنة السابقة' : undefined,
    warning: points === 2 ? 'انخفاض محدود في التوزيعات مقارنة بالسنة السابقة' : points === 0 ? 'انخفاض حاد في التوزيعات مقارنة بالسنة السابقة' : undefined,
  };
}

function computePayoutRatioCheck(dividends: NormalizedDividend[], ratios?: NormalizedRatios): ScoreCheck {
  const eps = ratios?.rawMetrics ? pickNumber(ratios.rawMetrics, ['eps', 'earnings_per_share', 'basic_eps']) : undefined;
  const latestDividend = [...dividends].reverse().find((d) => d.amountPerShare !== undefined);

  if (eps === undefined || eps <= 0 || !latestDividend) {
    return {
      key: 'payout_ratio',
      points: 0,
      maxPoints: 4,
      available: false,
      missingDataNote: 'لا تُطبَّق نسبة تغطية التوزيعات (EPS غير متوفر أو سالب)',
    };
  }

  const payoutRatio = ((latestDividend.amountPerShare as number) / eps) * 100;
  let points = 0;
  let warning: string | undefined;
  if (payoutRatio <= 70) points = 4;
  else if (payoutRatio <= 90) points = 2;
  else warning = 'نسبة توزيع الأرباح (Payout Ratio) مرتفعة جدًا - فوق 90% من الأرباح';

  return {
    key: 'payout_ratio',
    points,
    maxPoints: 4,
    available: true,
    reason: points > 0 ? `نسبة تغطية التوزيعات من الأرباح ${payoutRatio.toFixed(0)}%` : undefined,
    warning,
  };
}

function computeUpcomingDividendCheck(dividends: NormalizedDividend[]): ScoreCheck {
  const now = new Date();
  const upcoming = dividends
    .filter((d) => d.eligibilityDate)
    .map((d) => ({ dividend: d, date: new Date(d.eligibilityDate as string) }))
    .filter((x) => !Number.isNaN(x.date.getTime()) && x.date.getTime() > now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  if (!upcoming) {
    return {
      key: 'upcoming_dividend',
      points: 0,
      maxPoints: 2,
      available: false,
      missingDataNote: 'لا يوجد توزيع معلن بتاريخ أحقية قادم',
    };
  }

  const daysRemaining = Math.ceil((upcoming.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    key: 'upcoming_dividend',
    points: 2,
    maxPoints: 2,
    available: true,
    reason:
      `يوجد توزيع معلن وتاريخ أحقية بعد ${daysRemaining} يومًا - ملاحظة: سعر السهم عادة يتعدل ` +
      `نزولًا بقيمة التوزيع تقريبًا في تاريخ الاستحقاق، ولا يُعد ذلك بحد ذاته إشارة شراء`,
  };
}

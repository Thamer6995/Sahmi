import { CategoryResult } from './types';
import { computeQualityScore } from './quality';
import { computeValuationScore } from './valuation';
import { computeDividendScore } from './dividend';
import { computeTechnicalScore } from './technical';
import { isExcludedFinancialSector } from './sectorClassification';
import { NormalizedFinancialPeriod, NormalizedRatios, NormalizedDividend } from '../services/sahmk/mappers';
import { OhlcvBar, fiftyTwoWeekLow } from '../technical';

export interface InvestmentScoreResult {
  symbol: string;
  excluded: boolean;
  exclusionReason?: string;
  totalScore?: number;
  dataCompleteness?: number;
  quality?: CategoryResult;
  valuation?: CategoryResult;
  dividend?: CategoryResult;
  technical?: CategoryResult;
  reasons: string[];
  warnings: string[];
  missingData: string[];
  /** هل آخر فترة سنوية متاحة كانت مربحة؟ undefined إن لم تتوفر بيانات - يُستخدم في قواعد التنبيه (شرط 3). */
  latestYearProfitable?: boolean;
  /** هل يوجد تحذير مالي حرج (وليس فنيًا) ضمن الجودة/التقييم/التوزيعات - يمنع إرسال أي تنبيه (شرط 4). */
  hasCriticalFinancialWarning: boolean;
  calculatedAt: string;
}

export interface InvestmentScoreInputs {
  symbol: string;
  sector?: string;
  industry?: string;
  price?: number;
  annualFinancials: NormalizedFinancialPeriod[]; // مرتّبة تصاعديًا
  ratios?: NormalizedRatios;
  dividends: NormalizedDividend[]; // مرتّبة تصاعديًا
  bars: OhlcvBar[]; // مرتّبة تصاعديًا
  sectorAvgPE?: number;
  sectorAvgPB?: number;
}

/**
 * النقطة المركزية لحساب Investment Score (100 نقطة): تستبعد القطاع
 * المالي أولًا (بنوك/تأمين - انظر sectorClassification.ts)، ثم تحسب
 * الأقسام الأربعة وتُجمّع النتيجة الإجمالية ونسبة اكتمال البيانات
 * (متوسط توفّر كل بنود التقييم - وليس فقط الحقول الخام).
 */
export function computeInvestmentScore(inputs: InvestmentScoreInputs): InvestmentScoreResult {
  const calculatedAt = new Date().toISOString();

  if (isExcludedFinancialSector(inputs.sector, inputs.industry)) {
    return {
      symbol: inputs.symbol,
      excluded: true,
      exclusionReason:
        'الشركة ضمن القطاع المالي (بنوك/تأمين) - لا تنطبق عليها قواعد Debt-to-Equity ولا نموذج القوائم المالية ' +
        'العام المستخدم هنا، ولم تُبنَ بعد قواعد تقييم منفصلة لهذا القطاع في هذه النسخة، لذا استُبعدت من التقييم ' +
        'بدل إعطائها درجة مضللة.',
      reasons: [],
      warnings: [],
      missingData: [],
      hasCriticalFinancialWarning: false,
      calculatedAt,
    };
  }

  const quality = computeQualityScore({ annualPeriods: inputs.annualFinancials, ratios: inputs.ratios });
  const valuation = computeValuationScore({
    pe: inputs.ratios?.pe,
    pb: inputs.ratios?.pb,
    sectorAvgPE: inputs.sectorAvgPE,
    sectorAvgPB: inputs.sectorAvgPB,
    price: inputs.price,
    fiftyTwoWeekLow: fiftyTwoWeekLow(inputs.bars),
  });
  const dividend = computeDividendScore({ dividends: inputs.dividends, ratios: inputs.ratios });
  const technical = computeTechnicalScore(inputs.bars, inputs.price);

  const categories = [quality, valuation, dividend, technical];
  const totalScore = categories.reduce((acc, c) => acc + c.score, 0);

  const allChecks = categories.flatMap((c) => c.checks);
  const availableCount = allChecks.filter((c) => c.available).length;
  const dataCompleteness = allChecks.length > 0 ? (availableCount / allChecks.length) * 100 : 0;

  const financialChecks = [...quality.checks, ...valuation.checks, ...dividend.checks];
  const hasCriticalFinancialWarning = financialChecks.some((c) => c.critical && c.warning);

  const lastAnnualNetIncome = [...inputs.annualFinancials].reverse().find((p) => p.netIncome !== undefined)?.netIncome;
  const latestYearProfitable = lastAnnualNetIncome !== undefined ? lastAnnualNetIncome > 0 : undefined;

  return {
    symbol: inputs.symbol,
    excluded: false,
    totalScore,
    dataCompleteness,
    quality,
    valuation,
    dividend,
    technical,
    reasons: allChecks.filter((c) => c.reason).map((c) => c.reason as string),
    warnings: allChecks.filter((c) => c.warning).map((c) => c.warning as string),
    missingData: allChecks.filter((c) => c.missingDataNote).map((c) => c.missingDataNote as string),
    latestYearProfitable,
    hasCriticalFinancialWarning,
    calculatedAt,
  };
}

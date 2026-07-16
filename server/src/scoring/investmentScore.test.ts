import { computeInvestmentScore } from './investmentScore';
import { NormalizedFinancialPeriod, NormalizedDividend, NormalizedRatios } from '../services/sahmk/mappers';
import { OhlcvBar } from '../technical';

function annualPeriod(year: string, overrides: Partial<NormalizedFinancialPeriod>): NormalizedFinancialPeriod {
  return {
    symbol: 'TEST',
    period: year,
    periodType: 'annual',
    rawMetrics: {},
    ...overrides,
  };
}

function makeBars(count: number, startClose: number, dailyStep: number): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let close = startClose;
  for (let i = 0; i < count; i++) {
    close += dailyStep;
    const date = new Date(2024, 0, 1 + i).toISOString().slice(0, 10);
    bars.push({ date, open: close, high: close * 1.01, low: close * 0.99, close, volume: 100000 });
  }
  return bars;
}

describe('computeInvestmentScore', () => {
  it('يستبعد القطاع المالي (بنوك/تأمين) ويظهر سبب الاستبعاد بدل درجة مضللة', () => {
    const result = computeInvestmentScore({
      symbol: '1010',
      sector: 'البنوك',
      annualFinancials: [],
      dividends: [],
      bars: [],
    });

    expect(result.excluded).toBe(true);
    expect(result.exclusionReason).toBeDefined();
    expect(result.totalScore).toBeUndefined();
  });

  it('لا يستبعد الشركات غير المالية', () => {
    const result = computeInvestmentScore({
      symbol: '2222',
      sector: 'الصناعات الأساسية',
      annualFinancials: [],
      dividends: [],
      bars: [],
    });
    expect(result.excluded).toBe(false);
  });

  it('يُعيد dataCompleteness منخفضة و0 نقاط عند غياب كل البيانات دون افتراض قيم وهمية', () => {
    const result = computeInvestmentScore({
      symbol: '9999',
      sector: 'قطاع تجريبي',
      annualFinancials: [],
      dividends: [],
      bars: [],
    });

    expect(result.excluded).toBe(false);
    expect(result.totalScore).toBe(0);
    expect(result.dataCompleteness).toBe(0);
    expect(result.missingData.length).toBeGreaterThan(0);
    expect(result.reasons.length).toBe(0);
  });

  it('يمنح درجة عالية وأسبابًا واضحة لشركة قوية بكل المعايير، بدون تحذيرات', () => {
    const annualFinancials: NormalizedFinancialPeriod[] = [
      annualPeriod('2021', { netIncome: 100, revenue: 1000, operatingCashFlow: 150 }),
      annualPeriod('2022', { netIncome: 130, revenue: 1100, operatingCashFlow: 180 }),
      annualPeriod('2023', { netIncome: 170, revenue: 1250, operatingCashFlow: 220 }),
    ];
    const ratios: NormalizedRatios = {
      symbol: '2222',
      pe: 8,
      pb: 1.2,
      roe: 20,
      debtToEquity: 0.3,
      dividendYield: 6.5,
      rawMetrics: { eps: 2 },
    };
    const dividends: NormalizedDividend[] = [
      { symbol: '2222', distributionDate: '2021-06-01', amountPerShare: 1 },
      { symbol: '2222', distributionDate: '2022-06-01', amountPerShare: 1.1 },
      { symbol: '2222', distributionDate: '2023-06-01', amountPerShare: 1.2 },
    ];
    // سعر يتحرك صعودًا بثبات فوق المتوسطات، وقريب جدًا من قاع بداية الفترة (52 أسبوعًا) نسبيًا مرتفع لكن ليس قريبًا من القاع
    const bars = makeBars(260, 20, 0.05);
    const lastClose = bars[bars.length - 1].close;

    const result = computeInvestmentScore({
      symbol: '2222',
      sector: 'الصناعات الأساسية',
      price: lastClose,
      annualFinancials,
      ratios,
      dividends,
      bars,
      sectorAvgPE: 15,
      sectorAvgPB: 2,
    });

    expect(result.excluded).toBe(false);
    expect(result.totalScore).toBeGreaterThan(60);
    expect(result.dataCompleteness).toBeGreaterThan(70);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('لا يعتبر P/E السالب فرصة تقييم منخفض، ويظهر تحذيرًا بدل درجة مضللة', () => {
    const ratios: NormalizedRatios = { symbol: 'X', pe: -5, pb: -2, rawMetrics: {} };
    const result = computeInvestmentScore({
      symbol: 'X',
      sector: 'قطاع تجريبي',
      price: 10,
      annualFinancials: [annualPeriod('2023', { netIncome: -50, revenue: 500 })],
      ratios,
      dividends: [],
      bars: [],
      sectorAvgPE: 15,
    });

    expect(result.valuation?.checks.find((c) => c.key === 'pe_vs_sector')?.points).toBe(0);
    expect(result.valuation?.checks.find((c) => c.key === 'pe_vs_sector')?.warning).toMatch(/خاسرة|غير صالحة/);
    expect(result.warnings.some((w) => w.includes('سالبًا') || w.includes('خاسرة'))).toBe(true);
  });
});

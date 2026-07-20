// eslint-disable-next-line @typescript-eslint/no-var-requires -- lazy require إلزامي داخل jest.mock factory لتفادي قيد hoisting
jest.mock('firebase-admin/firestore', () => require('../testUtils/fakeFirestoreState').fakeFirestoreModule);

import { reset, seed, writeLog } from '../testUtils/fakeFirestoreState';
import { upsertFinancials } from './financialsRepo';
import { NormalizedFinancialPeriod } from '../services/sahmk/mappers';

function period(overrides: Partial<NormalizedFinancialPeriod> = {}): NormalizedFinancialPeriod {
  return {
    symbol: '2222',
    period: '2025-Q4',
    periodType: 'quarterly',
    revenue: 1000,
    netIncome: 200,
    operatingCashFlow: 150,
    totalAssets: 5000,
    totalLiabilities: 2000,
    totalEquity: 3000,
    totalDebt: 800,
    rawMetrics: { eps: 1.2, margin: 0.2 },
    ...overrides,
  };
}

describe('upsertFinancials - تخطي الكتابة عند عدم وجود تغيّر فعلي', () => {
  beforeEach(() => reset());

  it('1. البيانات غير المتغيرة لا تُكتب مجددًا (حتى مع اختلاف ترتيب مفاتيح rawMetrics)', async () => {
    seed('financials/2222_quarterly_2025-Q4', {
      symbol: '2222',
      period: '2025-Q4',
      periodType: 'quarterly',
      revenue: 1000,
      netIncome: 200,
      operatingCashFlow: 150,
      totalAssets: 5000,
      totalLiabilities: 2000,
      totalEquity: 3000,
      totalDebt: 800,
      // نفس القيم لكن بترتيب مفاتيح مختلف تمامًا عن period() أعلاه
      rawMetrics: { margin: 0.2, eps: 1.2 },
    });

    const result = await upsertFinancials([period()]);

    expect(result).toEqual({ changed: 0, skipped: 1 });
    expect(writeLog.length).toBe(0);
  });

  it('2. البيانات المتغيرة فعليًا تُكتب مرة واحدة فقط', async () => {
    seed('financials/2222_quarterly_2025-Q4', {
      symbol: '2222',
      period: '2025-Q4',
      periodType: 'quarterly',
      revenue: 900, // مختلف عن القيمة الجديدة (1000)
      netIncome: 200,
      operatingCashFlow: 150,
      totalAssets: 5000,
      totalLiabilities: 2000,
      totalEquity: 3000,
      totalDebt: 800,
      rawMetrics: { eps: 1.2, margin: 0.2 },
    });

    const result = await upsertFinancials([period()]);

    expect(result).toEqual({ changed: 1, skipped: 0 });
    expect(writeLog.length).toBe(1);
    expect(writeLog[0].path).toBe('financials/2222_quarterly_2025-Q4');
    expect(writeLog[0].data.revenue).toBe(1000);
  });

  it('فترة جديدة كليًا (لا يوجد مستند سابق) تُكتب كتغيّر', async () => {
    const result = await upsertFinancials([period({ period: '2026-Q1' })]);
    expect(result).toEqual({ changed: 1, skipped: 0 });
    expect(writeLog.length).toBe(1);
  });

  it('دفعة مختلطة: فترة تغيّرت وفترة لم تتغيّر تُحسبان بشكل منفصل، وتُكتب فقط المتغيّرة', async () => {
    seed('financials/2222_quarterly_2025-Q3', {
      symbol: '2222',
      period: '2025-Q3',
      periodType: 'quarterly',
      revenue: 900,
      netIncome: 180,
      operatingCashFlow: 140,
      totalAssets: 4800,
      totalLiabilities: 1900,
      totalEquity: 2900,
      totalDebt: 750,
      rawMetrics: { eps: 1.0 },
    });
    seed('financials/2222_quarterly_2025-Q4', {
      symbol: '2222',
      period: '2025-Q4',
      periodType: 'quarterly',
      revenue: 1000,
      netIncome: 200,
      operatingCashFlow: 150,
      totalAssets: 5000,
      totalLiabilities: 2000,
      totalEquity: 3000,
      totalDebt: 800,
      rawMetrics: { eps: 1.2, margin: 0.2 },
    });

    const changedPeriod = period({ period: '2025-Q3', netIncome: 999 }); // تغيّر فعليًا
    const unchangedPeriod = period(); // نفس المخزَّن تمامًا

    const result = await upsertFinancials([changedPeriod, unchangedPeriod]);

    expect(result).toEqual({ changed: 1, skipped: 1 });
    expect(writeLog.length).toBe(1);
    expect(writeLog[0].path).toBe('financials/2222_quarterly_2025-Q3');
  });
});

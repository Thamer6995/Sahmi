// eslint-disable-next-line @typescript-eslint/no-var-requires -- lazy require إلزامي داخل jest.mock factory لتفادي قيد hoisting
jest.mock('firebase-admin/firestore', () => require('../testUtils/fakeFirestoreState').fakeFirestoreModule);

import { reset, seed, writeLog } from '../testUtils/fakeFirestoreState';
import { upsertRatios } from './ratiosRepo';
import { NormalizedRatios } from '../services/sahmk/mappers';

function ratios(overrides: Partial<NormalizedRatios> = {}): NormalizedRatios {
  return {
    symbol: '2222',
    pe: 15,
    pb: 2,
    roe: 0.18,
    roa: 0.09,
    debtToEquity: 0.4,
    profitMargin: 0.2,
    revenueGrowth: 0.05,
    netIncomeGrowth: 0.08,
    dividendYield: 0.03,
    rawMetrics: { sector_pe: 14, note: 'x' },
    ...overrides,
  };
}

describe('upsertRatios - تخطي الكتابة عند عدم وجود تغيّر فعلي', () => {
  beforeEach(() => reset());

  it('1. البيانات غير المتغيرة لا تُكتب مجددًا (حتى مع اختلاف ترتيب مفاتيح rawMetrics)', async () => {
    seed('ratios/2222', {
      symbol: '2222',
      pe: 15,
      pb: 2,
      roe: 0.18,
      roa: 0.09,
      debtToEquity: 0.4,
      profitMargin: 0.2,
      revenueGrowth: 0.05,
      netIncomeGrowth: 0.08,
      dividendYield: 0.03,
      // نفس القيم لكن بترتيب مفاتيح مختلف
      rawMetrics: { note: 'x', sector_pe: 14 },
    });

    const result = await upsertRatios(ratios());

    expect(result).toEqual({ changed: false });
    expect(writeLog.length).toBe(0);
  });

  it('2. البيانات المتغيرة فعليًا (pe مختلف) تُكتب مرة واحدة فقط', async () => {
    seed('ratios/2222', {
      symbol: '2222',
      pe: 12, // مختلف عن القيمة الجديدة (15)
      pb: 2,
      roe: 0.18,
      roa: 0.09,
      debtToEquity: 0.4,
      profitMargin: 0.2,
      revenueGrowth: 0.05,
      netIncomeGrowth: 0.08,
      dividendYield: 0.03,
      rawMetrics: { sector_pe: 14, note: 'x' },
    });

    const result = await upsertRatios(ratios());

    expect(result).toEqual({ changed: true });
    expect(writeLog.length).toBe(1);
    expect(writeLog[0].data.pe).toBe(15);
  });

  it('لا يوجد مستند سابق إطلاقًا - يُعتبر تغيّرًا ويُكتب', async () => {
    const result = await upsertRatios(ratios());
    expect(result).toEqual({ changed: true });
    expect(writeLog.length).toBe(1);
  });

  it('تغيّر dividendYield فقط (المُحدَّث يوميًا من مصدر منفصل) لا يُعتبر وحده سببًا لإعادة الكتابة', async () => {
    seed('ratios/2222', {
      symbol: '2222',
      pe: 15,
      pb: 2,
      roe: 0.18,
      roa: 0.09,
      debtToEquity: 0.4,
      profitMargin: 0.2,
      revenueGrowth: 0.05,
      netIncomeGrowth: 0.08,
      dividendYield: 0.09, // قيمة مختلفة، حدّثها job التوزيعات اليومي مسبقًا
      rawMetrics: { sector_pe: 14, note: 'x' },
    });

    const result = await upsertRatios(ratios({ dividendYield: 0.03 }));

    expect(result).toEqual({ changed: false });
    expect(writeLog.length).toBe(0);
  });
});

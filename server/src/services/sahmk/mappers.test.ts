import { normalizeRatios } from './mappers';
import { SahmkRatiosResponse } from './types';

describe('normalizeRatios - حماية من key_metrics/ratios غير الصالحين', () => {
  it('لا يفكّك key_metrics لحروف لو وصل كنص بدل كائن (الحالة الفعلية المرصودة لسهم 2222: "core")', () => {
    const raw = {
      ratios: [
        {
          ratios: { roe: 0.08, roa: 0.045, debt_to_equity: 0.21, net_margin: 26.11 },
          key_metrics: 'core',
        },
      ],
      meta: { warnings: ['Some metrics unavailable'] },
    } as unknown as SahmkRatiosResponse;

    const result = normalizeRatios('2222', raw);

    expect(result.rawMetrics).not.toHaveProperty('0');
    expect(result.rawMetrics).not.toHaveProperty('1');
    expect(result.rawMetrics).not.toHaveProperty('2');
    expect(result.rawMetrics).not.toHaveProperty('3');
    expect(result.rawMetrics).toEqual({
      roe: 0.08,
      roa: 0.045,
      debt_to_equity: 0.21,
      net_margin: 26.11,
      warnings: ['Some metrics unavailable'],
    });
  });

  it('لا يفكّك ratios لحروف لو وصل كنص بدل كائن (نفس الحماية بالاتجاه الآخر)', () => {
    const raw = {
      ratios: [
        {
          ratios: 'core',
          key_metrics: { eps: 3.45, total_revenue: 467236000000 },
        },
      ],
    } as unknown as SahmkRatiosResponse;

    const result = normalizeRatios('2222', raw);

    expect(result.rawMetrics).not.toHaveProperty('0');
    expect(result.rawMetrics).toEqual({
      eps: 3.45,
      total_revenue: 467236000000,
      warnings: undefined,
    });
  });

  it('يعمل بشكل طبيعي عندما تكون ratios وkey_metrics كائنين صالحين فعليًا', () => {
    const raw = {
      ratios: [
        {
          ratios: { roe: 0.08 },
          key_metrics: { eps: 3.45 },
        },
      ],
    } as unknown as SahmkRatiosResponse;

    const result = normalizeRatios('2222', raw);

    expect(result.roe).toBe(0.08);
    expect(result.rawMetrics).toEqual({ eps: 3.45, roe: 0.08, warnings: undefined });
  });
});

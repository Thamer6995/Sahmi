import { fiftyTwoWeekHigh, fiftyTwoWeekLow, fiftyTwoWeekLowClose, relativeDistancePercent } from './levels';
import { OhlcvBar } from './types';

function makeBar(overrides: Partial<OhlcvBar>): OhlcvBar {
  return {
    date: '2025-01-01',
    open: 10,
    high: 10,
    low: 10,
    close: 10,
    volume: 1000,
    ...overrides,
  };
}

describe('fiftyTwoWeekHigh / fiftyTwoWeekLow', () => {
  it('يُعيد undefined لمصفوفة فارغة', () => {
    expect(fiftyTwoWeekHigh([])).toBeUndefined();
    expect(fiftyTwoWeekLow([])).toBeUndefined();
  });

  it('يحسب أعلى high وأدنى low ضمن النافذة', () => {
    const bars = [makeBar({ high: 15, low: 8 }), makeBar({ high: 20, low: 5 }), makeBar({ high: 12, low: 9 })];
    expect(fiftyTwoWeekHigh(bars)).toBe(20);
    expect(fiftyTwoWeekLow(bars)).toBe(5);
  });

  it('يتجاهل الجلسات الأقدم من 252 جلسة (52 أسبوعًا تقريبًا)', () => {
    const oldExtreme = Array.from({ length: 60 }, () => makeBar({ high: 999, low: 0.01 }));
    const recent = Array.from({ length: 252 }, () => makeBar({ high: 50, low: 40 }));
    const bars = [...oldExtreme, ...recent];
    expect(fiftyTwoWeekHigh(bars)).toBe(50);
    expect(fiftyTwoWeekLow(bars)).toBe(40);
  });
});

describe('fiftyTwoWeekLowClose', () => {
  it('يستخدم أسعار الإغلاق فقط (وليس أدنى سعر داخل الجلسة)', () => {
    const closes = [30, 25, 28, 22, 26];
    expect(fiftyTwoWeekLowClose(closes)).toBe(22);
  });

  it('يُعيد undefined لمصفوفة فارغة', () => {
    expect(fiftyTwoWeekLowClose([])).toBeUndefined();
  });
});

describe('relativeDistancePercent', () => {
  it('يحسب المسافة المئوية الموجبة والسالبة بشكل صحيح', () => {
    expect(relativeDistancePercent(110, 100)).toBeCloseTo(10, 5);
    expect(relativeDistancePercent(90, 100)).toBeCloseTo(-10, 5);
  });

  it('يُعيد undefined إذا كانت القيمة المرجعية صفرًا (تفادي القسمة على صفر)', () => {
    expect(relativeDistancePercent(10, 0)).toBeUndefined();
  });
});

import { stableEqual } from './firestoreHelpers';

describe('stableEqual', () => {
  it('يعتبر كائنين متساويين حتى مع اختلاف ترتيب المفاتيح (سطحيًا)', () => {
    const a = { pe: 15, pb: 2, note: 'x' };
    const b = { note: 'x', pb: 2, pe: 15 };
    expect(stableEqual(a, b)).toBe(true);
  });

  it('يعتبر كائنين متساويين حتى مع اختلاف ترتيب المفاتيح في كائنات متداخلة', () => {
    const a = { rawMetrics: { eps: 1.2, margin: 0.2, meta: { warnings: ['w1'] } } };
    const b = { rawMetrics: { meta: { warnings: ['w1'] }, margin: 0.2, eps: 1.2 } };
    expect(stableEqual(a, b)).toBe(true);
  });

  it('يكتشف اختلاف قيمة فعلية رغم تطابق باقي الحقول', () => {
    const a = { eps: 1.2, margin: 0.2 };
    const b = { eps: 1.3, margin: 0.2 };
    expect(stableEqual(a, b)).toBe(false);
  });

  it('يكتشف اختلاف بنية المصفوفات', () => {
    expect(stableEqual({ warnings: ['a', 'b'] }, { warnings: ['b', 'a'] })).toBe(false);
    expect(stableEqual({ warnings: ['a', 'b'] }, { warnings: ['a', 'b'] })).toBe(true);
  });

  it('يعتبر undefined مساويًا لـ undefined (حقل غير موجود في كلا الجانبين)', () => {
    expect(stableEqual({ a: undefined }, {})).toBe(true);
  });
});

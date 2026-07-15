import { sma, sma50, sma200 } from './sma';

describe('sma', () => {
  it('يحسب المتوسط المتحرك البسيط بشكل صحيح', () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(sma([1, 2, 3, 4, 5], 3)).toBe(4); // متوسط آخر 3 قيم: 3,4,5
  });

  it('يُعيد undefined عند عدم توفر بيانات كافية بدل قيمة وهمية', () => {
    expect(sma([1, 2, 3], 5)).toBeUndefined();
    expect(sma([], 1)).toBeUndefined();
  });

  it('يتجاهل القيم الأقدم من النافذة المطلوبة', () => {
    // آخر 3 قيم فقط يجب أن تدخل الحساب
    expect(sma([100, 100, 100, 3, 6, 9], 3)).toBe(6);
  });

  it('sma50 وsma200 يستخدمان الفترة الصحيحة', () => {
    const closes50 = Array.from({ length: 50 }, () => 10);
    expect(sma50(closes50)).toBe(10);
    expect(sma200(closes50)).toBeUndefined();

    const closes200 = Array.from({ length: 200 }, () => 20);
    expect(sma200(closes200)).toBe(20);
  });
});

import { rsi14 } from './rsi';

function buildCloses(diffs: number[], start = 100): number[] {
  const closes = [start];
  for (const d of diffs) {
    closes.push(closes[closes.length - 1] + d);
  }
  return closes;
}

describe('rsi14', () => {
  it('يُعيد undefined عند عدم توفر period+1 من الإغلاقات على الأقل', () => {
    const closes = buildCloses(Array(10).fill(1)); // 11 قيمة فقط، نحتاج 15
    expect(rsi14(closes)).toBeUndefined();
  });

  it('يُعيد 100 عندما تكون كل التغيرات صعودًا (لا خسائر إطلاقًا)', () => {
    const closes = buildCloses(Array(20).fill(1));
    expect(rsi14(closes)).toBe(100);
  });

  it('يُعيد 0 عندما تكون كل التغيرات هبوطًا (لا مكاسب إطلاقًا)', () => {
    const closes = buildCloses(Array(20).fill(-1));
    expect(rsi14(closes)).toBe(0);
  });

  it('يُعيد 50 عند عدم وجود أي تغيّر في السعر (سعر ثابت تمامًا)', () => {
    const closes = buildCloses(Array(20).fill(0));
    expect(rsi14(closes)).toBe(50);
  });

  it('يُعيد 50 عندما يتساوى متوسط المكاسب مع متوسط الخسائر (حركة متماثلة)', () => {
    // 14 تغيّر متبادل: +1،-1 بالتساوي => avgGain = avgLoss = 0.5 => RS=1 => RSI=50
    const diffs = Array.from({ length: 14 }, (_, i) => (i % 2 === 0 ? 1 : -1));
    const closes = buildCloses(diffs);
    expect(rsi14(closes)).toBeCloseTo(50, 5);
  });

  it('القيمة محصورة دائمًا بين 0 و100', () => {
    const diffs = [1, -2, 3, -1, 0.5, -0.5, 2, -3, 1, 1, -1, 2, -2, 0.5, 1, -1];
    const closes = buildCloses(diffs);
    const value = rsi14(closes);
    expect(value).toBeDefined();
    expect(value as number).toBeGreaterThanOrEqual(0);
    expect(value as number).toBeLessThanOrEqual(100);
  });
});

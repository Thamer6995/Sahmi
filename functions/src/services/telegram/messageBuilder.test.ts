import { buildAlertMessage } from './messageBuilder';
import { InvestmentScoreResult } from '../../scoring/investmentScore';

function makeScore(overrides: Partial<InvestmentScoreResult> = {}): InvestmentScoreResult {
  return {
    symbol: '3010',
    excluded: false,
    totalScore: 84,
    dataCompleteness: 91,
    quality: { score: 30, maxScore: 35, checks: [] },
    valuation: { score: 20, maxScore: 25, checks: [] },
    dividend: { score: 22, maxScore: 25, checks: [] },
    technical: { score: 12, maxScore: 15, checks: [] },
    reasons: ['عائد توزيعات مرتفع', 'أرباح موجبة', 'تدفق نقدي تشغيلي موجب'],
    warnings: ['نمو الأرباح ضعيف في آخر سنة'],
    missingData: [],
    hasCriticalFinancialWarning: false,
    calculatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const FORBIDDEN_PHRASES = ['اشترِ الآن', 'اشتري الان', 'مضمون', 'buy now', 'guaranteed'];

describe('buildAlertMessage', () => {
  it('يتضمن كل الحقول الأساسية المطلوبة بالتنسيق المحدد', () => {
    const { text } = buildAlertMessage({
      companyNameAr: 'أسمنت العربية',
      symbol: '3010',
      price: 23.2,
      score: makeScore(),
      alertType: '80-89',
      updatedAtRiyadh: '15 يوليو 2026، 5:00 م',
    });

    expect(text).toContain('فرصة استثمارية محتملة');
    expect(text).toContain('الشركة: أسمنت العربية');
    expect(text).toContain('الرمز: 3010');
    expect(text).toContain('السعر: 23.20 ريال');
    expect(text).toContain('التقييم: 84/100');
    expect(text).toContain('اكتمال البيانات: 91%');
    expect(text).toContain('الجودة: 30/35');
    expect(text).toContain('✅ عائد توزيعات مرتفع');
    expect(text).toContain('⚠️ نمو الأرباح ضعيف في آخر سنة');
    expect(text).toContain('هذا تنبيه آلي وليس توصية مالية.');
  });

  it('لا يحتوي أبدًا على عبارات توصية شراء أو ضمان', () => {
    const { text } = buildAlertMessage({
      symbol: '3010',
      score: makeScore(),
      alertType: '90-100',
      updatedAtRiyadh: 'اليوم',
    });

    const lowerText = text.toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(lowerText).not.toContain(phrase.toLowerCase());
    }
  });

  it('يستخدم عنوان النطاق الصحيح لكل مستوى تنبيه', () => {
    expect(buildAlertMessage({ symbol: 'X', score: makeScore(), alertType: '70-79', updatedAtRiyadh: 't' }).text).toContain(
      'سهم يستحق المراقبة'
    );
    expect(buildAlertMessage({ symbol: 'X', score: makeScore(), alertType: '90-100', updatedAtRiyadh: 't' }).text).toContain(
      'فرصة قوية تستحق الدراسة'
    );
  });

  it('يبني رابط الزر بشكل صحيح عند توفر appUrl', () => {
    const { buttonUrl } = buildAlertMessage({
      symbol: '3010',
      score: makeScore(),
      alertType: '80-89',
      updatedAtRiyadh: 't',
      appUrl: 'https://sahmi.example.com/',
    });
    expect(buttonUrl).toBe('https://sahmi.example.com/stocks/3010');
  });

  it('لا يُنشئ رابط زر إن لم يتوفر appUrl', () => {
    const { buttonUrl } = buildAlertMessage({ symbol: '3010', score: makeScore(), alertType: '80-89', updatedAtRiyadh: 't' });
    expect(buttonUrl).toBeUndefined();
  });
});

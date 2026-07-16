/**
 * تصنيف القطاع المالي (بنوك/تأمين) لاستبعاده من التقييم في هذه النسخة
 * الأولى - لا تتوفر قواعد Debt-to-Equity ولا هيكل قوائم مالية مناسب لهذه
 * القطاعات (تختلف جذريًا عن الشركات غير المالية: لا "دين مقابل حقوق
 * ملكية" بالمعنى التقليدي للبنوك، ونسب التأمين الفنية مختلفة تمامًا).
 *
 * المطابقة نصية (عربي/إنجليزي) على حقل sector/industry القادم من SAHMK،
 * لأن التسمية الدقيقة لقيم القطاع غير موثقة علنًا. إن ثبت لاحقًا (عبر
 * مراجعة raw response) أن SAHMK تستخدم قيمًا مختلفة عن المتوقع، يكفي
 * تحديث القوائم أدناه فقط.
 */

const FINANCIAL_SECTOR_KEYWORDS = [
  'bank',
  'insurance',
  'البنوك',
  'بنك',
  'تأمين',
  'التأمين',
];

export function isExcludedFinancialSector(sector?: string, industry?: string): boolean {
  const haystack = `${sector ?? ''} ${industry ?? ''}`.toLowerCase();
  if (haystack.trim() === '') return false;
  return FINANCIAL_SECTOR_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

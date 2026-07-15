import { SahmkCompany, SahmkQuote } from './types';

/**
 * دوال تحويل استجابات SAHMK الخام إلى الشكل المخزَّن في Firestore حسب
 * التصميم المطلوب. نتعامل بحذر مع اختلاف تسمية الحقول المحتمل (مثلاً
 * name مقابل name_ar) لأن التوثيق العلني لا يعرض مثالًا كاملاً لكل
 * Endpoint - إن ثبت لاحقًا (عبر مراجعة raw response في وضع التطوير) أن
 * التسمية مختلفة، التعديل يقتصر على هذا الملف فقط.
 */

export interface NormalizedCompany {
  symbol: string;
  nameAr?: string;
  nameEn?: string;
  sector?: string;
  industry?: string;
  market?: string;
}

export interface NormalizedQuote {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  value?: number;
  quoteDate?: string;
}

/** يُعيد null إذا لم يكن للشركة رمز صالح (لا يمكن تخزينها بدون معرّف). */
export function normalizeCompany(raw: SahmkCompany): NormalizedCompany | null {
  const symbol = raw.symbol?.trim();
  if (!symbol) return null;

  return {
    symbol,
    // بعض استجابات SAHMK تستخدم name كاسم عربي أساسي، وname_en كاسم إنجليزي.
    // نعطي الأولوية لـ name_ar الصريح إن وُجد.
    nameAr: raw.name_ar ?? raw.name,
    nameEn: raw.name_en,
    sector: raw.sector,
    industry: raw.industry,
    market: raw.market,
  };
}

export function normalizeQuote(raw: SahmkQuote): NormalizedQuote | null {
  const symbol = (raw.resolved_symbol ?? raw.symbol)?.trim();
  if (!symbol) return null;

  return {
    symbol,
    price: raw.price,
    change: raw.change,
    changePercent: raw.change_percent,
    volume: raw.volume,
    value: raw.value ?? raw.liquidity?.net_value,
    quoteDate: raw.quote_date,
  };
}

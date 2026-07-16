import { z } from 'zod';

/**
 * ⚠️ ملاحظة مهمة حول هذا الملف:
 *
 * حقول الاستجابة أدناه مبنية على ما هو موثّق فعليًا في SDK الرسمي
 * (sahmk-python README / PyPI) وليست اختراعًا، لكن التوثيق العلني لا
 * يعرض أمثلة JSON كاملة لكل Endpoint. لذلك:
 *
 * 1. كل Schema هنا يستخدم `.passthrough()` كي لا نفقد أي حقل فعلي غير
 *    متوقّع، ونحتفظ به ضمن rawMetrics/rawResponse للتخزين والمراجعة.
 * 2. جميع الحقول "المعروفة" اختيارية (optional) بحيث لا ينهار النظام لو
 *    اختلف اسم حقل معين قليلاً عن المتوقع - سيظهر فقط كـ "بيانات غير
 *    متوفرة" بدل توقف التطبيق.
 * 3. في المرحلة 1 سنستدعي فعليًا `company('2222')` ونحفظ الـ raw response
 *    (بيئة تطوير فقط) لمراجعة الحقول الحقيقية وتثبيت هذه الـ interfaces.
 */

export const QuoteSchema = z
  .object({
    symbol: z.string().optional(),
    requested_identifier: z.string().optional(),
    resolved_symbol: z.string().optional(),
    name_en: z.string().optional(),
    name_ar: z.string().optional(),
    price: z.number().optional(),
    change: z.number().optional(),
    change_percent: z.number().optional(),
    volume: z.number().optional(),
    value: z.number().optional(),
    liquidity: z.object({ net_value: z.number().optional() }).partial().optional(),
    quote_date: z.string().optional(),
  })
  .passthrough();
export type SahmkQuote = z.infer<typeof QuoteSchema>;

export const BulkQuotesResponseSchema = z
  .object({
    quotes: z.array(QuoteSchema).optional(),
    ambiguous: z.array(z.unknown()).optional(),
    unknown: z.array(z.unknown()).optional(),
  })
  .passthrough();
export type SahmkBulkQuotesResponse = z.infer<typeof BulkQuotesResponseSchema>;

export const CompanySchema = z
  .object({
    symbol: z.string().optional(),
    name: z.string().optional(),
    name_en: z.string().optional(),
    name_ar: z.string().optional(),
    // ⚠️ مؤكَّد من raw response فعلي (company/2222/): SAHMK يستخدم sector_name/
    // sector_name_ar وmarket_id - وليس sector/market كما افترضنا قبل التحقق.
    // نُبقي sector/industry/market كاحتمال احتياطي فقط (endpoints أخرى قد تختلف).
    sector_name: z.string().optional(),
    sector_name_ar: z.string().optional(),
    market_id: z.string().optional(),
    sector: z.string().optional(),
    industry: z.string().optional(),
    market: z.string().optional(),
  })
  .passthrough();
export type SahmkCompany = z.infer<typeof CompanySchema>;

export const CompaniesListResponseSchema = z
  .object({
    results: z.array(CompanySchema).optional(),
    count: z.number().optional(),
    total: z.number().optional(),
    offset: z.number().optional(),
    limit: z.number().optional(),
    next: z.string().nullable().optional(),
  })
  .passthrough();
export type SahmkCompaniesListResponse = z.infer<typeof CompaniesListResponseSchema>;

export const OhlcvBarSchema = z
  .object({
    date: z.string().optional(),
    t: z.string().optional(),
    open: z.number().optional(),
    high: z.number().optional(),
    low: z.number().optional(),
    close: z.number().optional(),
    volume: z.number().optional(),
  })
  .passthrough();
export type SahmkOhlcvBar = z.infer<typeof OhlcvBarSchema>;

export const HistoricalResponseSchema = z
  .object({
    symbol: z.string().optional(),
    interval: z.string().optional(),
    bars: z.array(OhlcvBarSchema).optional(),
    results: z.array(OhlcvBarSchema).optional(),
    data: z.array(OhlcvBarSchema).optional(),
  })
  .passthrough();
export type SahmkHistoricalResponse = z.infer<typeof HistoricalResponseSchema>;

export const FinancialsResponseSchema = z
  .object({
    symbol: z.string().optional(),
    income_statements: z.array(z.record(z.unknown())).optional(),
    balance_sheets: z.array(z.record(z.unknown())).optional(),
    cash_flows: z.array(z.record(z.unknown())).optional(),
  })
  .passthrough();
export type SahmkFinancialsResponse = z.infer<typeof FinancialsResponseSchema>;

export const RatiosResponseSchema = z
  .object({
    symbol: z.string().optional(),
    period: z.string().optional(),
    metrics: z.record(z.unknown()).optional(),
    warnings: z.array(z.string()).optional(),
    meta: z
      .object({
        period: z.string().optional(),
        metrics: z.record(z.unknown()).optional(),
        warnings: z.array(z.string()).optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();
export type SahmkRatiosResponse = z.infer<typeof RatiosResponseSchema>;

export const DividendEntrySchema = z
  .object({
    announcement_date: z.string().optional(),
    eligibility_date: z.string().optional(),
    distribution_date: z.string().optional(),
    amount_per_share: z.number().optional(),
    dividend_yield: z.number().optional(),
    status: z.string().optional(),
  })
  .passthrough();
export type SahmkDividendEntry = z.infer<typeof DividendEntrySchema>;

export const DividendsResponseSchema = z
  .object({
    symbol: z.string().optional(),
    dividends: z.array(DividendEntrySchema).optional(),
    results: z.array(DividendEntrySchema).optional(),
  })
  .passthrough();
export type SahmkDividendsResponse = z.infer<typeof DividendsResponseSchema>;

export const CompareResponseSchema = z
  .object({
    symbols: z.array(z.string()).optional(),
    metrics: z.record(z.unknown()).optional(),
    results: z.array(z.record(z.unknown())).optional(),
  })
  .passthrough();
export type SahmkCompareResponse = z.infer<typeof CompareResponseSchema>;

/** أنواع أخطاء SAHMK المعروفة من التوثيق، تُستخدم لتصنيف الاستجابة. */
export type SahmkErrorKind =
  | 'INVALID_API_KEY'
  | 'PLAN_LIMIT'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'SCHEMA_CHANGED'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export class SahmkApiError extends Error {
  readonly kind: SahmkErrorKind;
  readonly status?: number;
  readonly endpoint: string;

  constructor(kind: SahmkErrorKind, message: string, endpoint: string, status?: number) {
    super(message);
    this.name = 'SahmkApiError';
    this.kind = kind;
    this.status = status;
    this.endpoint = endpoint;
  }
}

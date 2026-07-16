import { sahmkGet } from './httpClient';
import { sahmkCache } from './cache';
import { saveRawResponseForReview } from './devRawStore';
import { logger } from '../../utils/logger';
import {
  CompaniesListResponseSchema,
  CompanySchema,
  BulkQuotesResponseSchema,
  QuoteSchema,
  HistoricalResponseSchema,
  FinancialsResponseSchema,
  RatiosResponseSchema,
  DividendsResponseSchema,
  CompareResponseSchema,
  SahmkCompaniesListResponse,
  SahmkCompany,
  SahmkBulkQuotesResponse,
  SahmkQuote,
  SahmkHistoricalResponse,
  SahmkFinancialsResponse,
  SahmkRatiosResponse,
  SahmkDividendsResponse,
  SahmkCompareResponse,
} from './types';

const MAX_SYMBOLS_PER_BULK_QUOTE = 50; // حد باقة Starter الموثّق لـ /quotes/

function validate<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, raw: unknown, endpoint: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    logger.warn('sahmk_schema_mismatch', { endpoint });
  }
  // حتى لو فشل التحقق الصارم، نُعيد raw كما هو (passthrough) بدل رمي خطأ،
  // لأن هدفنا عدم إيقاف تحليل السوق كامل بسبب اختلاف حقل واحد.
  return (result.data ?? (raw as T)) as T;
}

/**
 * SahmkService - الطبقة الوحيدة في المشروع التي تتواصل مباشرة مع SAHMK API.
 * كل الجلب (companies, quotes, historical, financials, ratios, dividends)
 * يمر من هنا حتى تبقى منطق الـ retry/cache/rate-limit/logging في مكان واحد.
 */
export class SahmkService {
  /** دليل الشركات مع دعم Pagination (limit/offset) وبحث اختياري. */
  async getCompanies(params: { search?: string; market?: string; limit?: number; offset?: number } = {}): Promise<SahmkCompaniesListResponse> {
    const raw = await sahmkGet<unknown>('/companies/', {
      query: { search: params.search, market: params.market, limit: params.limit, offset: params.offset },
    });
    await saveRawResponseForReview('/companies/', raw);
    return validate(CompaniesListResponseSchema, raw, '/companies/');
  }

  /** يجلب كل الصفحات من /companies/ (يُستخدم مرة واحدة أو أسبوعيًا فقط). */
  async getAllCompanies(pageSize = 100): Promise<SahmkCompany[]> {
    const all: SahmkCompany[] = [];
    let offset = 0;
    for (;;) {
      const page = await this.getCompanies({ limit: pageSize, offset });
      const results = page.results ?? [];
      all.push(...results);
      const total = page.total ?? page.count;
      offset += pageSize;
      if (results.length === 0) break;
      if (total !== undefined && offset >= total) break;
      if (results.length < pageSize) break; // احتياط إذا الـ API لا يرجع total
    }
    return all;
  }

  /** بيانات شركة واحدة أساسية. */
  async getCompany(symbol: string): Promise<SahmkCompany> {
    const raw = await sahmkGet<unknown>(`/company/${encodeURIComponent(symbol)}/`);
    await saveRawResponseForReview(`/company/${symbol}/`, raw);
    return validate(CompanySchema, raw, `/company/${symbol}/`);
  }

  /** سعر فردي (احتياطي - نستخدم bulk عادة). */
  async getQuote(symbol: string): Promise<SahmkQuote> {
    const raw = await sahmkGet<unknown>(`/quote/${encodeURIComponent(symbol)}/`);
    return validate(QuoteSchema, raw, `/quote/${symbol}/`);
  }

  /**
   * Bulk quotes - يقسّم الرموز تلقائيًا إلى دفعات لا تتجاوز 50 رمزًا
   * (حد باقة Starter)، ويجمع النتائج في استجابة واحدة.
   */
  async getBulkQuotes(symbols: string[]): Promise<SahmkQuote[]> {
    const quotes: SahmkQuote[] = [];
    for (let i = 0; i < symbols.length; i += MAX_SYMBOLS_PER_BULK_QUOTE) {
      const batch = symbols.slice(i, i + MAX_SYMBOLS_PER_BULK_QUOTE);
      const raw = await sahmkGet<unknown>('/quotes/', { query: { symbols: batch } });
      await saveRawResponseForReview('/quotes/', raw);
      const parsed = validate<SahmkBulkQuotesResponse>(BulkQuotesResponseSchema, raw, '/quotes/');
      quotes.push(...(parsed.quotes ?? []));
    }
    return quotes;
  }

  /**
   * بيانات OHLCV يومية. باقة Starter تدعم فقط 1d/1w/1m (لا 30m/60m).
   * from/to اختياريان بصيغة YYYY-MM-DD.
   */
  async getHistorical(
    symbol: string,
    params: { interval?: '1d' | '1w' | '1m'; from?: string; to?: string } = {}
  ): Promise<SahmkHistoricalResponse> {
    const raw = await sahmkGet<unknown>(`/historical/${encodeURIComponent(symbol)}/`, {
      query: { interval: params.interval ?? '1d', from: params.from, to: params.to },
    });
    await saveRawResponseForReview(`/historical/${symbol}/`, raw);
    return validate(HistoricalResponseSchema, raw, `/historical/${symbol}/`);
  }

  /** القوائم المالية (دخل/ميزانية/تدفقات نقدية). */
  async getFinancials(symbol: string, params: { history?: number } = {}): Promise<SahmkFinancialsResponse> {
    const raw = await sahmkGet<unknown>(`/financials/${encodeURIComponent(symbol)}/`, {
      query: { history: params.history },
    });
    await saveRawResponseForReview(`/financials/${symbol}/`, raw);
    return validate(FinancialsResponseSchema, raw, `/financials/${symbol}/`);
  }

  /** النسب المالية لشركة واحدة. */
  async getRatios(symbol: string): Promise<SahmkRatiosResponse> {
    const raw = await sahmkGet<unknown>(`/analytics/ratios/${encodeURIComponent(symbol)}/`);
    await saveRawResponseForReview(`/analytics/ratios/${symbol}/`, raw);
    return validate(RatiosResponseSchema, raw, `/analytics/ratios/${symbol}/`);
  }

  /** مقارنة نسب بين عدة شركات (تُستخدم لحساب متوسط القطاع). */
  async getCompare(symbols: string[], metrics?: string[]): Promise<SahmkCompareResponse> {
    const raw = await sahmkGet<unknown>('/analytics/compare/', {
      query: { symbols, metrics },
    });
    return validate(CompareResponseSchema, raw, '/analytics/compare/');
  }

  /** سجل التوزيعات. */
  async getDividends(symbol: string): Promise<SahmkDividendsResponse> {
    const raw = await sahmkGet<unknown>(`/dividends/${encodeURIComponent(symbol)}/`);
    await saveRawResponseForReview(`/dividends/${symbol}/`, raw);
    return validate(DividendsResponseSchema, raw, `/dividends/${symbol}/`);
  }
}

// نسخة مشتركة (الخدمة عديمة الحالة بخلاف الـ cache المشترك)
export const sahmkService = new SahmkService();
export { sahmkCache };

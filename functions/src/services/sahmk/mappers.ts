import { SahmkCompany, SahmkQuote, SahmkFinancialsResponse, SahmkRatiosResponse, SahmkDividendEntry } from './types';
import { pickNumber, extractPeriodKey, detectPeriodType } from './fieldPicker';

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

export interface NormalizedFinancialPeriod {
  symbol: string;
  period: string;
  periodType: 'annual' | 'quarterly';
  revenue?: number;
  netIncome?: number;
  operatingCashFlow?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  totalDebt?: number;
  rawMetrics: Record<string, unknown>;
}

const REVENUE_KEYS = ['revenue', 'total_revenue', 'net_revenue', 'sales'];
const NET_INCOME_KEYS = ['net_income', 'net_profit', 'profit_for_the_period', 'net_income_attributable'];
const OPERATING_CASH_FLOW_KEYS = ['operating_cash_flow', 'cash_from_operations', 'net_cash_from_operating_activities'];
const TOTAL_ASSETS_KEYS = ['total_assets'];
const TOTAL_LIABILITIES_KEYS = ['total_liabilities'];
const TOTAL_EQUITY_KEYS = ['total_equity', 'shareholders_equity', 'total_shareholders_equity'];
const TOTAL_DEBT_KEYS = ['total_debt', 'total_borrowings', 'total_loans'];

/**
 * يدمج القوائم الثلاث (دخل/ميزانية/تدفقات نقدية) حسب الفترة المكتشفة من
 * كل سجل. إن تعذّر استخراج معرّف فترة من سجل ما، يُستبعد بدل تخمين قيمة
 * (لا نفترض ترتيب المصفوفات). rawMetrics يحتفظ بكل الحقول الأصلية من كل
 * مصدر متاح لتلك الفترة حتى لو لم نستطع تعيينها لحقل معروف أعلاه.
 */
export function normalizeFinancials(symbol: string, raw: SahmkFinancialsResponse): NormalizedFinancialPeriod[] {
  type PeriodBucket = {
    periodType: 'annual' | 'quarterly';
    income?: Record<string, unknown>;
    balance?: Record<string, unknown>;
    cashFlow?: Record<string, unknown>;
  };
  const byPeriod = new Map<string, PeriodBucket>();

  function ingest(records: Record<string, unknown>[] | undefined, kind: 'income' | 'balance' | 'cashFlow') {
    for (const record of records ?? []) {
      const periodKey = extractPeriodKey(record);
      if (!periodKey) continue; // لا يمكن دمج سجل بلا فترة معروفة
      const periodType = detectPeriodType(record) ?? 'annual'; // افتراض سنوي إن لم يُحدَّد صراحة
      const bucket = byPeriod.get(periodKey) ?? { periodType };
      bucket[kind] = record;
      byPeriod.set(periodKey, bucket);
    }
  }

  ingest(raw.income_statements, 'income');
  ingest(raw.balance_sheets, 'balance');
  ingest(raw.cash_flows, 'cashFlow');

  const results: NormalizedFinancialPeriod[] = [];
  for (const [period, bucket] of byPeriod.entries()) {
    const income = bucket.income ?? {};
    const balance = bucket.balance ?? {};
    const cashFlow = bucket.cashFlow ?? {};

    results.push({
      symbol,
      period,
      periodType: bucket.periodType,
      revenue: pickNumber(income, REVENUE_KEYS),
      netIncome: pickNumber(income, NET_INCOME_KEYS),
      operatingCashFlow: pickNumber(cashFlow, OPERATING_CASH_FLOW_KEYS),
      totalAssets: pickNumber(balance, TOTAL_ASSETS_KEYS),
      totalLiabilities: pickNumber(balance, TOTAL_LIABILITIES_KEYS),
      totalEquity: pickNumber(balance, TOTAL_EQUITY_KEYS),
      totalDebt: pickNumber(balance, TOTAL_DEBT_KEYS),
      rawMetrics: { income, balance, cashFlow },
    });
  }

  return results;
}

export interface NormalizedRatios {
  symbol: string;
  pe?: number;
  pb?: number;
  roe?: number;
  roa?: number;
  debtToEquity?: number;
  profitMargin?: number;
  revenueGrowth?: number;
  netIncomeGrowth?: number;
  dividendYield?: number;
  rawMetrics: Record<string, unknown>;
}

export function normalizeRatios(symbol: string, raw: SahmkRatiosResponse): NormalizedRatios {
  const metrics = (raw.metrics ?? raw.meta?.metrics ?? {}) as Record<string, unknown>;

  return {
    symbol,
    pe: pickNumber(metrics, ['pe', 'pe_ratio', 'price_to_earnings', 'p_e']),
    pb: pickNumber(metrics, ['pb', 'pb_ratio', 'price_to_book', 'p_b']),
    roe: pickNumber(metrics, ['roe', 'return_on_equity']),
    roa: pickNumber(metrics, ['roa', 'return_on_assets']),
    debtToEquity: pickNumber(metrics, ['debt_to_equity', 'de_ratio', 'debt_equity_ratio']),
    profitMargin: pickNumber(metrics, ['net_profit_margin', 'profit_margin', 'net_margin']),
    revenueGrowth: pickNumber(metrics, ['revenue_growth', 'sales_growth']),
    netIncomeGrowth: pickNumber(metrics, ['net_income_growth', 'earnings_growth']),
    dividendYield: pickNumber(metrics, ['dividend_yield', 'div_yield']),
    rawMetrics: { ...metrics, warnings: raw.warnings ?? raw.meta?.warnings },
  };
}

export interface NormalizedDividend {
  symbol: string;
  announcementDate?: string;
  eligibilityDate?: string;
  distributionDate?: string;
  amountPerShare?: number;
  dividendYield?: number;
  status?: string;
}

export function normalizeDividendEntry(symbol: string, raw: SahmkDividendEntry): NormalizedDividend {
  return {
    symbol,
    announcementDate: raw.announcement_date,
    eligibilityDate: raw.eligibility_date,
    distributionDate: raw.distribution_date,
    amountPerShare: raw.amount_per_share,
    dividendYield: raw.dividend_yield,
    status: raw.status,
  };
}

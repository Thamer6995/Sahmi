import { sahmkService } from '../services/sahmk/SahmkService';
import { normalizeFinancials, normalizeRatios, extractCompanyFundamentals } from '../services/sahmk/mappers';
import { upsertFinancials } from '../repo/financialsRepo';
import { upsertRatios } from '../repo/ratiosRepo';
import { getAllCompanySymbols } from '../repo/companiesRepo';
import { runBatched, BatchRunSummary } from '../utils/batchRunner';
import { logger } from '../utils/logger';

const CONCURRENCY = 5;

/**
 * يحدّث القوائم المالية والنسب لكل رمز على حدة. الاثنان (financials و
 * ratios) يُجلبان بشكل مستقل لكل سهم: فشل أحدهما لا يمنع حفظ الآخر (مثلاً
 * إن كانت /analytics/ratios/ غير متاحة مؤقتًا لكن /financials/ نجحت).
 * فشل الاثنين معًا لسهم واحد يُسجَّل كفشل لهذا السهم فقط دون إيقاف الباقي.
 */
export async function refreshFinancialsAndRatios(symbols?: string[]): Promise<BatchRunSummary> {
  const targetSymbols = symbols && symbols.length > 0 ? symbols : await getAllCompanySymbols();

  return runBatched(
    'refreshFinancialsAndRatios',
    targetSymbols,
    (symbol) => symbol,
    async (symbol) => {
      const partialErrors: string[] = [];

      try {
        const financialsRaw = await sahmkService.getFinancials(symbol);
        const periods = normalizeFinancials(symbol, financialsRaw);
        await upsertFinancials(periods);
      } catch (err) {
        partialErrors.push(`financials: ${(err as Error).message}`);
      }

      try {
        const ratiosRaw = await sahmkService.getRatios(symbol);
        const ratios = normalizeRatios(symbol, ratiosRaw);

        // P/E وP/B غير متوفرين في /analytics/ratios/ إطلاقًا (مؤكَّد من raw
        // response فعلي) - مصدرهما fundamentals ضمن /company/{symbol}/.
        // فشل هذا الاستدعاء الإضافي لا يمنع حفظ بقية النسب.
        try {
          const companyRaw = await sahmkService.getCompany(symbol);
          const { pe, pb, eps } = extractCompanyFundamentals(companyRaw);
          ratios.pe = ratios.pe ?? pe;
          ratios.pb = ratios.pb ?? pb;
          if (eps !== undefined) ratios.rawMetrics.eps = eps;
        } catch (err) {
          logger.warn('refresh_ratios_company_fundamentals_failed', { symbol, message: (err as Error).message });
        }

        await upsertRatios(ratios);
      } catch (err) {
        partialErrors.push(`ratios: ${(err as Error).message}`);
      }

      if (partialErrors.length === 2) {
        throw new Error(partialErrors.join(' | '));
      }
      if (partialErrors.length === 1) {
        logger.warn('refresh_financials_partial_failure', { symbol, error: partialErrors[0] });
      }
    },
    CONCURRENCY
  );
}

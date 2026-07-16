import { sahmkService } from '../services/sahmk/SahmkService';
import { normalizeFinancials, normalizeRatios } from '../services/sahmk/mappers';
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

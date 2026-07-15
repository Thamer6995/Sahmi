import { sahmkService } from '../services/sahmk/SahmkService';
import { normalizeQuote } from '../services/sahmk/mappers';
import { upsertQuotes } from '../repo/quotesRepo';
import { getAllCompanySymbols } from '../repo/companiesRepo';
import { runBatched, BatchRunSummary } from '../utils/batchRunner';
import { chunk } from '../utils/firestoreHelpers';
import { logger } from '../utils/logger';

const SYMBOLS_PER_BULK_REQUEST = 50; // حد باقة Starter لـ /quotes/
const CONCURRENT_BULK_REQUESTS = 5;

/**
 * يحدّث أسعار كل الشركات (أو قائمة رموز محددة) عبر Bulk Quotes. يُقسّم
 * الرموز إلى دفعات من 50 (حد الباقة)، ويحفظ نتيجة كل دفعة فور وصولها
 * حتى لو فشلت دفعة أخرى لاحقًا (لا يوقف فشل سهم/دفعة واحدة بقية التحديث).
 */
export async function refreshQuotes(symbols?: string[]): Promise<BatchRunSummary> {
  const targetSymbols = symbols && symbols.length > 0 ? symbols : await getAllCompanySymbols();

  if (targetSymbols.length === 0) {
    logger.warn('refresh_quotes_no_symbols');
  }

  const symbolBatches = chunk(targetSymbols, SYMBOLS_PER_BULK_REQUEST);

  return runBatched(
    'refreshQuotes',
    symbolBatches,
    (batch) => `${batch[0] ?? '?'}..${batch[batch.length - 1] ?? '?'} (${batch.length})`,
    async (batch) => {
      const rawQuotes = await sahmkService.getBulkQuotes(batch);
      const normalized = rawQuotes
        .map(normalizeQuote)
        .filter((q): q is NonNullable<typeof q> => q !== null);
      await upsertQuotes(normalized);
    },
    CONCURRENT_BULK_REQUESTS
  );
}

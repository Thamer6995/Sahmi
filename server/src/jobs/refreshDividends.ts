import { sahmkService } from '../services/sahmk/SahmkService';
import { normalizeDividendEntry } from '../services/sahmk/mappers';
import { upsertDividends } from '../repo/dividendsRepo';
import { getAllCompanySymbols } from '../repo/companiesRepo';
import { runBatched, BatchRunSummary } from '../utils/batchRunner';

const CONCURRENCY = 5;

/** يحدّث سجل التوزيعات لكل رمز (جدولة يومية في المرحلة 8). */
export async function refreshDividends(symbols?: string[]): Promise<BatchRunSummary> {
  const targetSymbols = symbols && symbols.length > 0 ? symbols : await getAllCompanySymbols();

  return runBatched(
    'refreshDividends',
    targetSymbols,
    (symbol) => symbol,
    async (symbol) => {
      const raw = await sahmkService.getDividends(symbol);
      const entries = raw.dividends ?? raw.results ?? [];
      const normalized = entries.map((entry) => normalizeDividendEntry(symbol, entry));
      await upsertDividends(normalized);
    },
    CONCURRENCY
  );
}

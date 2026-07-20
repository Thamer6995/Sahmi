import { sahmkService } from '../services/sahmk/SahmkService';
import { normalizeDividendEntry } from '../services/sahmk/mappers';
import { SahmkDividendEntry } from '../services/sahmk/types';
import { upsertDividends } from '../repo/dividendsRepo';
import { updateDividendYield } from '../repo/ratiosRepo';
import { getAllCompanySymbols } from '../repo/companiesRepo';
import { runBatched, BatchRunSummary } from '../utils/batchRunner';

const CONCURRENCY = 5;

/** يدمج history وupcoming ويزيل التكرار المحتمل بينهما (نفس التوزيع قد يظهر في الاثنين). */
function dedupeDividendEntries(entries: SahmkDividendEntry[]): SahmkDividendEntry[] {
  const seen = new Map<string, SahmkDividendEntry>();
  for (const entry of entries) {
    const key = `${entry.eligibility_date ?? ''}|${entry.announcement_date ?? ''}|${entry.value ?? entry.amount_per_share ?? ''}`;
    seen.set(key, entry);
  }
  return Array.from(seen.values());
}

/** يحدّث سجل التوزيعات لكل رمز (جدولة يومية في المرحلة 8). */
export async function refreshDividends(symbols?: string[], signal?: AbortSignal): Promise<BatchRunSummary> {
  const targetSymbols = symbols && symbols.length > 0 ? symbols : await getAllCompanySymbols();

  return runBatched(
    'refreshDividends',
    targetSymbols,
    (symbol) => symbol,
    async (symbol, itemSignal) => {
      const raw = await sahmkService.getDividends(symbol, itemSignal);
      if (itemSignal?.aborted) return; // لا نكتب Firestore بعد الإلغاء حتى لو نجح الطلب

      // مؤكَّد من raw response فعلي: الحقل الصحيح history/upcoming (وليس dividends/results)
      const entries = dedupeDividendEntries([...(raw.history ?? []), ...(raw.upcoming ?? []), ...(raw.dividends ?? []), ...(raw.results ?? [])]);
      const normalized = entries.map((entry) => normalizeDividendEntry(symbol, entry));
      await upsertDividends(normalized);

      // عائد التوزيعات (trailing 12 شهر) مصدره هذا الـ endpoint فعليًا، وليس /analytics/ratios/
      if (raw.trailing_12m_yield !== undefined) {
        await updateDividendYield(symbol, raw.trailing_12m_yield);
      }
    },
    CONCURRENCY,
    signal
  );
}

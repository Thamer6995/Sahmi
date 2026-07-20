import { sahmkService } from '../services/sahmk/SahmkService';
import { normalizeOhlcvBar } from '../services/sahmk/mappers';
import { upsertHistoricalBars, getLatestStoredDate } from '../repo/historicalPricesRepo';
import { getAllCompanySymbols } from '../repo/companiesRepo';
import { runBatched, BatchRunSummary } from '../utils/batchRunner';

const CONCURRENCY = 5;
const INITIAL_LOOKBACK_DAYS = 400; // تقويمي - يغطي عادة أكثر من 250 جلسة تداول فعلية
const INITIAL_SESSIONS_TO_KEEP = 250;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * يحدّث بيانات OHLCV اليومية لكل رمز. عند أول تحميل لسهم (لا يوجد تاريخ
 * مخزَّن بعد) يجلب نافذة تقويمية كبيرة بما يكفي (400 يوم) ثم يحتفظ بآخر
 * 250 جلسة فقط، تمامًا كما هو مطلوب. في التحديثات اللاحقة يجلب فقط الأيام
 * الجديدة بعد آخر تاريخ مخزَّن بدل إعادة تحميل التاريخ كاملًا.
 */
export async function refreshHistorical(symbols?: string[], signal?: AbortSignal): Promise<BatchRunSummary> {
  const targetSymbols = symbols && symbols.length > 0 ? symbols : await getAllCompanySymbols();
  const today = formatDate(new Date());

  return runBatched(
    'refreshHistorical',
    targetSymbols,
    (symbol) => symbol,
    async (symbol, itemSignal) => {
      const latestDate = await getLatestStoredDate(symbol);
      const isInitialLoad = !latestDate;

      let from: string;
      if (latestDate) {
        const next = new Date(latestDate);
        next.setDate(next.getDate() + 1);
        from = formatDate(next);
        if (from > today) return; // محدّث بالفعل اليوم، لا حاجة لأي طلب
      } else {
        const lookback = new Date();
        lookback.setDate(lookback.getDate() - INITIAL_LOOKBACK_DAYS);
        from = formatDate(lookback);
      }

      const raw = await sahmkService.getHistorical(symbol, { interval: '1d', from, to: today }, itemSignal);
      const rawBars = raw.bars ?? raw.results ?? raw.data ?? [];
      let bars = rawBars.map(normalizeOhlcvBar).filter((b): b is NonNullable<typeof b> => b !== null);

      // ترتيب تصاعدي بالتاريخ قبل أي قص، لضمان الاحتفاظ بأحدث الجلسات فقط
      bars = bars.sort((a, b) => a.date.localeCompare(b.date));
      if (isInitialLoad && bars.length > INITIAL_SESSIONS_TO_KEEP) {
        bars = bars.slice(bars.length - INITIAL_SESSIONS_TO_KEEP);
      }

      if (itemSignal?.aborted) return; // لا نكتب Firestore بعد الإلغاء حتى لو نجح طلب SAHMK قبل الإلغاء مباشرة

      await upsertHistoricalBars(symbol, bars);
    },
    CONCURRENCY,
    signal
  );
}

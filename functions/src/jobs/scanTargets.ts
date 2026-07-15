import { getAllCompanySymbols } from '../repo/companiesRepo';
import { getWatchlistSymbols } from '../repo/watchlistRepo';
import { getSettings } from '../repo/settingsRepo';

/** يُعيد رموز الشركات المستهدفة بالفحص: كل السوق أو قائمة المراقبة فقط حسب الإعدادات. */
export async function getScanTargetSymbols(): Promise<string[]> {
  const settings = await getSettings();
  if (settings.watchlistOnly) {
    const watchlistSymbols = await getWatchlistSymbols();
    if (watchlistSymbols.length > 0) return watchlistSymbols;
  }
  return getAllCompanySymbols();
}

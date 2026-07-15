import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCollection } from '../hooks/useCollection';
import { Company, Quote, Score, WatchlistItem } from '../types/models';
import { ScoreBadge } from '../components/ScoreBadge';

export default function Watchlist() {
  const { data: watchlist } = useCollection<WatchlistItem>('watchlist');
  const { data: companies } = useCollection<Company>('companies');
  const { data: quotes } = useCollection<Quote>('quotes');
  const { data: scores } = useCollection<Score>('scores');

  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { notes: string; targetPrice: string }>>({});

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.symbol, c])), [companies]);
  const quoteMap = useMemo(() => new Map(quotes.map((q) => [q.symbol, q])), [quotes]);
  const scoreMap = useMemo(() => new Map(scores.map((s) => [s.symbol, s])), [scores]);
  const watchedSymbols = useMemo(() => new Set(watchlist.map((w) => w.symbol ?? w.id)), [watchlist]);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return companies
      .filter((c) => !watchedSymbols.has(c.symbol) && (c.symbol.includes(term) || c.nameAr?.toLowerCase().includes(term)))
      .slice(0, 8);
  }, [search, companies, watchedSymbols]);

  async function addToWatchlist(symbol: string) {
    await setDoc(doc(db, 'watchlist', symbol), { symbol, addedAt: serverTimestamp() }, { merge: true });
    setSearch('');
  }

  async function removeFromWatchlist(symbol: string) {
    await deleteDoc(doc(db, 'watchlist', symbol));
  }

  function draftFor(symbol: string, item: WatchlistItem & { id: string }) {
    return drafts[symbol] ?? { notes: item.notes ?? '', targetPrice: item.targetPrice?.toString() ?? '' };
  }

  async function saveDraft(symbol: string) {
    const draft = drafts[symbol];
    if (!draft) return;
    await setDoc(
      doc(db, 'watchlist', symbol),
      {
        symbol,
        notes: draft.notes || undefined,
        targetPrice: draft.targetPrice ? Number(draft.targetPrice) : undefined,
      },
      { merge: true }
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-xl font-bold text-slate-900">قائمة المراقبة</h1>

      <div className="relative mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو الرمز لإضافته لقائمة المراقبة"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {searchResults.length > 0 && (
          <ul className="absolute inset-x-4 z-10 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg">
            {searchResults.map((c) => (
              <li key={c.symbol}>
                <button
                  onClick={() => addToWatchlist(c.symbol)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <span>
                    {c.nameAr} ({c.symbol})
                  </span>
                  <span className="text-brand-600">إضافة +</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {watchlist.length === 0 ? (
        <p className="text-sm text-slate-400">لا توجد أسهم في قائمة المراقبة بعد.</p>
      ) : (
        <div className="space-y-3">
          {watchlist.map((item) => {
            const symbol = item.symbol ?? item.id;
            const company = companyMap.get(symbol);
            const quote = quoteMap.get(symbol);
            const score = scoreMap.get(symbol);
            const draft = draftFor(symbol, item);

            return (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <Link to={`/stocks/${symbol}`} className="font-semibold text-brand-700 hover:underline">
                    {company?.nameAr ?? symbol} ({symbol})
                  </Link>
                  <div className="flex items-center gap-3">
                    <ScoreBadge score={score?.totalScore} excluded={score?.excluded} />
                    <span className="text-sm text-slate-500">{quote?.price !== undefined ? `${quote.price.toFixed(2)} ريال` : '—'}</span>
                    <button onClick={() => removeFromWatchlist(symbol)} className="text-xs text-red-600 hover:underline">
                      حذف
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input
                    placeholder="ملاحظات شخصية"
                    value={draft.notes}
                    onChange={(e) => setDrafts((d) => ({ ...d, [symbol]: { ...draft, notes: e.target.value } }))}
                    onBlur={() => saveDraft(symbol)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <input
                    placeholder="سعر مستهدف شخصي"
                    type="number"
                    value={draft.targetPrice}
                    onChange={(e) => setDrafts((d) => ({ ...d, [symbol]: { ...draft, targetPrice: e.target.value } }))}
                    onBlur={() => saveDraft(symbol)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

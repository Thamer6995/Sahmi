import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../hooks/useCollection';
import { Company, Quote, Ratios, Score } from '../types/models';
import { ScoreBadge } from '../components/ScoreBadge';

type SortKey = 'symbol' | 'score' | 'pe' | 'roe' | 'debtToEquity' | 'dividendYield';

interface Row {
  symbol: string;
  nameAr?: string;
  sector?: string;
  price?: number;
  totalScore?: number;
  excluded?: boolean;
  dataCompleteness?: number;
  pe?: number;
  roe?: number;
  debtToEquity?: number;
  dividendYield?: number;
}

export default function Explorer() {
  const { data: companies, loading: loadingCompanies } = useCollection<Company>('companies');
  const { data: quotes } = useCollection<Quote>('quotes');
  const { data: ratios } = useCollection<Ratios>('ratios');
  const { data: scores } = useCollection<Score>('scores');

  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [minScore, setMinScore] = useState('');
  const [minDividendYield, setMinDividendYield] = useState('');
  const [maxPe, setMaxPe] = useState('');
  const [minRoe, setMinRoe] = useState('');
  const [maxDebtToEquity, setMaxDebtToEquity] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const rows: Row[] = useMemo(() => {
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));
    const ratioMap = new Map(ratios.map((r) => [r.symbol, r]));
    const scoreMap = new Map(scores.map((s) => [s.symbol, s]));

    return companies.map((c) => {
      const quote = quoteMap.get(c.symbol);
      const ratio = ratioMap.get(c.symbol);
      const score = scoreMap.get(c.symbol);
      return {
        symbol: c.symbol,
        nameAr: c.nameAr,
        sector: c.sector,
        price: quote?.price,
        totalScore: score?.totalScore,
        excluded: score?.excluded,
        dataCompleteness: score?.dataCompleteness,
        pe: ratio?.pe,
        roe: ratio?.roe,
        debtToEquity: ratio?.debtToEquity,
        dividendYield: ratio?.dividendYield,
      };
    });
  }, [companies, quotes, ratios, scores]);

  const sectors = useMemo(() => Array.from(new Set(companies.map((c) => c.sector).filter(Boolean))) as string[], [companies]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !r.symbol.toLowerCase().includes(term) && !r.nameAr?.toLowerCase().includes(term)) return false;
      if (sector && r.sector !== sector) return false;
      if (minScore && (r.totalScore ?? -Infinity) < Number(minScore)) return false;
      if (minDividendYield && (r.dividendYield ?? -Infinity) < Number(minDividendYield)) return false;
      if (maxPe && (r.pe === undefined || r.pe > Number(maxPe))) return false;
      if (minRoe && (r.roe ?? -Infinity) < Number(minRoe)) return false;
      if (maxDebtToEquity && (r.debtToEquity === undefined || r.debtToEquity > Number(maxDebtToEquity))) return false;
      return true;
    });
  }, [rows, search, sector, minScore, minDividendYield, maxPe, minRoe, maxDebtToEquity]);

  const sorted = useMemo(() => {
    const withValue = (r: Row): number => {
      switch (sortKey) {
        case 'symbol':
          return Number(r.symbol) || 0;
        case 'score':
          return r.totalScore ?? -Infinity;
        case 'pe':
          return r.pe ?? Infinity;
        case 'roe':
          return r.roe ?? -Infinity;
        case 'debtToEquity':
          return r.debtToEquity ?? Infinity;
        case 'dividendYield':
          return r.dividendYield ?? -Infinity;
      }
    };
    const copy = [...filtered];
    copy.sort((a, b) => (withValue(a) - withValue(b)) * (sortDir === 'asc' ? 1 : -1));
    return copy;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function sortIndicator(key: SortKey): string {
    if (key !== sortKey) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-xl font-bold text-slate-900">مستكشف الأسهم</h1>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4 lg:grid-cols-7">
        <input
          placeholder="ابحث بالاسم أو الرمز"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="col-span-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm md:col-span-1"
        />
        <select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">كل القطاعات</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          placeholder="أدنى تقييم"
          type="number"
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input
          placeholder="أدنى Dividend Yield %"
          type="number"
          value={minDividendYield}
          onChange={(e) => setMinDividendYield(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input
          placeholder="أعلى P/E"
          type="number"
          value={maxPe}
          onChange={(e) => setMaxPe(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input
          placeholder="أدنى ROE %"
          type="number"
          value={minRoe}
          onChange={(e) => setMinRoe(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input
          placeholder="أعلى Debt/Equity"
          type="number"
          value={maxDebtToEquity}
          onChange={(e) => setMaxDebtToEquity(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
              <th className="cursor-pointer select-none p-3" onClick={() => toggleSort('symbol')}>
                الرمز{sortIndicator('symbol')}
              </th>
              <th className="p-3">الشركة</th>
              <th className="p-3">القطاع</th>
              <th className="p-3">السعر</th>
              <th className="cursor-pointer select-none p-3" onClick={() => toggleSort('score')}>
                التقييم{sortIndicator('score')}
              </th>
              <th className="p-3">اكتمال البيانات</th>
              <th className="cursor-pointer select-none p-3" onClick={() => toggleSort('pe')}>
                P/E{sortIndicator('pe')}
              </th>
              <th className="cursor-pointer select-none p-3" onClick={() => toggleSort('roe')}>
                ROE{sortIndicator('roe')}
              </th>
              <th className="cursor-pointer select-none p-3" onClick={() => toggleSort('debtToEquity')}>
                D/E{sortIndicator('debtToEquity')}
              </th>
              <th className="cursor-pointer select-none p-3" onClick={() => toggleSort('dividendYield')}>
                عائد التوزيعات{sortIndicator('dividendYield')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loadingCompanies && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-slate-400">
                  جارٍ التحميل...
                </td>
              </tr>
            )}
            {!loadingCompanies && sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-slate-400">
                  لا توجد نتائج مطابقة.
                </td>
              </tr>
            )}
            {sorted.map((r) => (
              <tr key={r.symbol} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="p-3">
                  <Link to={`/stocks/${r.symbol}`} className="font-medium text-brand-700 hover:underline">
                    {r.symbol}
                  </Link>
                </td>
                <td className="p-3 text-slate-700">{r.nameAr ?? '—'}</td>
                <td className="p-3 text-slate-500">{r.sector ?? '—'}</td>
                <td className="p-3">{r.price !== undefined ? r.price.toFixed(2) : '—'}</td>
                <td className="p-3">
                  <ScoreBadge score={r.totalScore} excluded={r.excluded} />
                </td>
                <td className="p-3 text-slate-500">
                  {r.dataCompleteness !== undefined ? `${Math.round(r.dataCompleteness)}%` : '—'}
                </td>
                <td className="p-3">{r.pe !== undefined ? r.pe.toFixed(1) : '—'}</td>
                <td className="p-3">{r.roe !== undefined ? `${r.roe.toFixed(1)}%` : '—'}</td>
                <td className="p-3">{r.debtToEquity !== undefined ? r.debtToEquity.toFixed(2) : '—'}</td>
                <td className="p-3">{r.dividendYield !== undefined ? `${r.dividendYield.toFixed(1)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

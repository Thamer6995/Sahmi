import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  limit as fbLimit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { backendCallable } from '../lib/backend';
import { Company, Quote, Ratios, FinancialPeriod, Dividend, Score, Alert, HistoricalBar } from '../types/models';
import { ScoreBadge } from '../components/ScoreBadge';
import { PriceChart } from '../components/PriceChart';

interface TechnicalIndicators {
  ok: boolean;
  sma50?: number;
  sma200?: number;
  rsi14?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekLowClose?: number;
}

function daysUntil(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return undefined;
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function StockDetail() {
  const { symbol = '' } = useParams<{ symbol: string }>();

  const [company, setCompany] = useState<Company | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [scoreHistory, setScoreHistory] = useState<{ totalScore?: number; calculatedAt?: { seconds: number } }[]>([]);
  const [ratios, setRatios] = useState<Ratios | null>(null);
  const [financials, setFinancials] = useState<FinancialPeriod[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [bars, setBars] = useState<HistoricalBar[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [technical, setTechnical] = useState<TechnicalIndicators | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    const unsubQuote = onSnapshot(doc(db, 'quotes', symbol), (snap) => setQuote(snap.exists() ? (snap.data() as Quote) : null));
    const unsubScore = onSnapshot(doc(db, 'scores', symbol), (snap) => setScore(snap.exists() ? (snap.data() as Score) : null));
    const unsubRatios = onSnapshot(doc(db, 'ratios', symbol), (snap) => setRatios(snap.exists() ? (snap.data() as Ratios) : null));

    getDoc(doc(db, 'companies', symbol)).then((snap) => setCompany(snap.exists() ? (snap.data() as Company) : null));

    const historyQuery = query(collection(db, 'scores', symbol, 'history'), orderBy('calculatedAt', 'asc'), fbLimit(30));
    const unsubHistory = onSnapshot(historyQuery, (snap) => setScoreHistory(snap.docs.map((d) => d.data())));

    const financialsQuery = query(collection(db, 'financials'), where('symbol', '==', symbol));
    getDocs(financialsQuery).then((snap) =>
      setFinancials(snap.docs.map((d) => d.data() as FinancialPeriod).sort((a, b) => a.period.localeCompare(b.period)))
    );

    const dividendsQuery = query(collection(db, 'dividends'), where('symbol', '==', symbol));
    const unsubDividends = onSnapshot(dividendsQuery, (snap) => setDividends(snap.docs.map((d) => d.data() as Dividend)));

    const barsQuery = query(collection(db, 'historicalPrices'), where('symbol', '==', symbol), orderBy('date', 'asc'), fbLimit(250));
    getDocs(barsQuery).then((snap) => setBars(snap.docs.map((d) => d.data() as HistoricalBar)));

    const alertsQuery = query(collection(db, 'alerts'), where('symbol', '==', symbol), orderBy('createdAt', 'desc'), fbLimit(10));
    const unsubAlerts = onSnapshot(alertsQuery, (snap) => setAlerts(snap.docs.map((d) => d.data() as Alert)));

    backendCallable<{ symbol: string }, TechnicalIndicators>('computeTechnicalIndicators')({ symbol })
      .then((res) => setTechnical(res.data))
      .catch(() => setTechnical(null));

    return () => {
      unsubQuote();
      unsubScore();
      unsubRatios();
      unsubHistory();
      unsubDividends();
      unsubAlerts();
    };
  }, [symbol]);

  async function handleManualRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        backendCallable('manualRefreshQuotes')({ symbol }),
        backendCallable('manualRefreshFinancials')({ symbol }),
        backendCallable('manualRefreshDividends')({ symbol }),
        backendCallable('manualRefreshHistorical')({ symbol }),
      ]);
      await backendCallable('runAlertCheck')({ symbol });
    } finally {
      setRefreshing(false);
    }
  }

  const upcomingDividend = dividends
    .filter((d) => d.eligibilityDate && daysUntil(d.eligibilityDate) !== undefined && (daysUntil(d.eligibilityDate) as number) > 0)
    .sort((a, b) => (a.eligibilityDate ?? '').localeCompare(b.eligibilityDate ?? ''))[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {company?.nameAr ?? symbol} <span className="text-slate-400">({symbol})</span>
          </h1>
          <p className="text-sm text-slate-500">{company?.sector ?? 'قطاع غير معروف'}</p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {refreshing ? 'جارٍ التحديث...' : 'تحديث بيانات هذا السهم'}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">السعر</p>
          <p className="mt-1 text-2xl font-bold">{quote?.price !== undefined ? `${quote.price.toFixed(2)} ريال` : '—'}</p>
          <p className="mt-1 text-xs text-slate-400">{quote?.quoteDate ?? ''}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Investment Score</p>
          <div className="mt-1">
            <ScoreBadge score={score?.totalScore} excluded={score?.excluded} />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            اكتمال البيانات: {score?.dataCompleteness !== undefined ? `${Math.round(score.dataCompleteness)}%` : '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">أعلى/أدنى 52 أسبوعًا</p>
          <p className="mt-1 text-sm font-semibold">
            {technical?.fiftyTwoWeekHigh?.toFixed(2) ?? '—'} / {technical?.fiftyTwoWeekLow?.toFixed(2) ?? '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">RSI14</p>
          <p className="mt-1 text-2xl font-bold">{technical?.rsi14 !== undefined ? technical.rsi14.toFixed(1) : '—'}</p>
        </div>
      </div>

      {score?.exclusionReason && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {score.exclusionReason}
        </div>
      )}

      {!score?.excluded && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">تفصيل النقاط</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>الجودة</span>
                <span className="font-medium">{score?.qualityScore ?? '—'}/35</span>
              </li>
              <li className="flex justify-between">
                <span>التقييم المالي</span>
                <span className="font-medium">{score?.valuationScore ?? '—'}/25</span>
              </li>
              <li className="flex justify-between">
                <span>التوزيعات</span>
                <span className="font-medium">{score?.dividendScore ?? '—'}/25</span>
              </li>
              <li className="flex justify-between">
                <span>التوقيت الفني</span>
                <span className="font-medium">{score?.technicalScore ?? '—'}/15</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">السعر اليومي</h2>
            <PriceChart bars={bars} />
            <p className="mt-2 text-xs text-slate-400">
              SMA50: {technical?.sma50?.toFixed(2) ?? '—'} — SMA200: {technical?.sma200?.toFixed(2) ?? '—'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-green-700">✅ أبرز الأسباب</h2>
            {score?.reasons?.length ? (
              <ul className="space-y-1 text-sm text-slate-700">
                {score.reasons.map((r, i) => (
                  <li key={i}>✅ {r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">لا توجد أسباب مسجّلة.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-amber-700">⚠️ تحذيرات</h2>
            {score?.warnings?.length ? (
              <ul className="space-y-1 text-sm text-slate-700">
                {score.warnings.map((w, i) => (
                  <li key={i}>⚠️ {w}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">لا توجد تحذيرات.</p>
            )}
            {score?.missingData && score.missingData.length > 0 && (
              <>
                <h3 className="mb-1 mt-3 text-xs font-semibold text-slate-500">بيانات غير متوفرة</h3>
                <ul className="space-y-1 text-xs text-slate-400">
                  {score.missingData.map((m, i) => (
                    <li key={i}>• {m}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">النسب المالية</h2>
          <ul className="grid grid-cols-2 gap-y-1 text-sm text-slate-700">
            <li>P/E: {ratios?.pe?.toFixed(1) ?? '—'}</li>
            <li>P/B: {ratios?.pb?.toFixed(1) ?? '—'}</li>
            <li>ROE: {ratios?.roe !== undefined ? `${ratios.roe.toFixed(1)}%` : '—'}</li>
            <li>ROA: {ratios?.roa !== undefined ? `${ratios.roa.toFixed(1)}%` : '—'}</li>
            <li>Debt/Equity: {ratios?.debtToEquity?.toFixed(2) ?? '—'}</li>
            <li>هامش صافي الربح: {ratios?.profitMargin !== undefined ? `${(ratios.profitMargin * 100).toFixed(1)}%` : '—'}</li>
            <li>عائد التوزيعات: {ratios?.dividendYield !== undefined ? `${ratios.dividendYield.toFixed(1)}%` : '—'}</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">البيانات المالية (سنوي)</h2>
          {financials.length === 0 ? (
            <p className="text-sm text-slate-400">لا تتوفر بيانات مالية بعد.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-1 text-right">الفترة</th>
                  <th className="p-1 text-right">الإيرادات</th>
                  <th className="p-1 text-right">صافي الربح</th>
                </tr>
              </thead>
              <tbody>
                {financials.map((f) => (
                  <tr key={f.period} className="border-t border-slate-100">
                    <td className="p-1">{f.period}</td>
                    <td className="p-1">{f.revenue?.toLocaleString('ar-SA') ?? '—'}</td>
                    <td className="p-1">{f.netIncome?.toLocaleString('ar-SA') ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">سجل التوزيعات</h2>
          {dividends.length === 0 ? (
            <p className="text-sm text-slate-400">لا يوجد سجل توزيعات.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dividends.map((d, i) => (
                <li key={i} className="flex justify-between border-b border-slate-100 pb-1 last:border-0">
                  <span>{d.eligibilityDate ?? d.distributionDate ?? d.announcementDate ?? '—'}</span>
                  <span>{d.amountPerShare !== undefined ? `${d.amountPerShare.toFixed(2)} ريال/سهم` : '—'}</span>
                </li>
              ))}
            </ul>
          )}
          {upcomingDividend && (
            <div className="mt-3 rounded-lg bg-brand-50 p-3 text-xs text-brand-800">
              توزيع قادم بعد {daysUntil(upcomingDividend.eligibilityDate)} يومًا - ملاحظة: السعر عادة يتعدل نزولًا في
              تاريخ الاستحقاق، وهذا ليس إشارة شراء.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">سجل تغيّر التقييم</h2>
          {scoreHistory.length === 0 ? (
            <p className="text-sm text-slate-400">لا يوجد سجل تقييم سابق بعد.</p>
          ) : (
            <ul className="space-y-1 text-xs text-slate-600">
              {scoreHistory.map((h, i) => (
                <li key={i} className="flex justify-between">
                  <span>{h.calculatedAt ? new Date(h.calculatedAt.seconds * 1000).toLocaleString('ar-SA') : '—'}</span>
                  <span className="font-medium">{h.totalScore !== undefined ? Math.round(h.totalScore) : '—'}/100</span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-3 mt-4 text-sm font-semibold text-slate-700">سجل التنبيهات</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-400">لا يوجد سجل تنبيهات لهذا السهم.</p>
          ) : (
            <ul className="space-y-1 text-xs text-slate-600">
              {alerts.map((a, i) => (
                <li key={i} className="flex justify-between">
                  <span>{a.alertType}</span>
                  <span>{a.sentToTelegram ? 'أُرسل عبر Telegram' : 'داخل التطبيق فقط'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

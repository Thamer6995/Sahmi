import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, orderBy, query, limit as fbLimit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { backendCallable } from '../lib/backend';
import { useCollection } from '../hooks/useCollection';
import { Company, Score, Alert } from '../types/models';
import { StatCard } from '../components/StatCard';
import { ScoreBadge } from '../components/ScoreBadge';

const ALERT_LABELS: Record<Alert['alertType'], string> = {
  '70-79': 'يستحق المراقبة',
  '80-89': 'فرصة محتملة',
  '90-100': 'فرصة قوية',
};

function todayRiyadhDocId(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
}

export default function Dashboard() {
  const { data: companies } = useCollection<Company>('companies');
  const { data: scores } = useCollection<Score>('scores');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [apiUsage, setApiUsage] = useState<{ requestCount?: number; updatedAt?: { seconds: number } } | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'), fbLimit(10));
    return onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map((d) => ({ ...(d.data() as Omit<Alert, 'id'>), id: d.id })));
    });
  }, []);

  useEffect(() => {
    const ref = doc(db, 'apiUsage', todayRiyadhDocId());
    return onSnapshot(ref, (snap) => setApiUsage(snap.exists() ? (snap.data() as typeof apiUsage) : null));
  }, []);

  async function testTelegram() {
    setTelegramStatus('checking');
    try {
      const fn = backendCallable<unknown, { ok: boolean }>('testTelegramConnection');
      const res = await fn();
      setTelegramStatus(res.data.ok ? 'ok' : 'fail');
    } catch {
      setTelegramStatus('fail');
    }
  }

  const companyMap = new Map(companies.map((c) => [c.symbol, c]));
  const analyzedScores = scores.filter((s) => !s.excluded);
  const above80 = analyzedScores.filter((s) => (s.totalScore ?? 0) >= 80);
  const top10 = [...analyzedScores].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)).slice(0, 10);

  const usageCount = apiUsage?.requestCount ?? 0;
  const usageUpdatedAt = apiUsage?.updatedAt ? new Date(apiUsage.updatedAt.seconds * 1000) : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-xl font-bold text-slate-900">لوحة التحكم</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="الأسهم المحللة" value={analyzedScores.length} />
        <StatCard label="أسهم فوق 80" value={above80.length} tone="good" />
        <StatCard
          label="استهلاك API اليوم"
          value={`${usageCount} / 5000`}
          hint={usageUpdatedAt ? `آخر تحديث ${usageUpdatedAt.toLocaleTimeString('ar-SA')}` : 'لا استخدام بعد اليوم'}
          tone={usageCount > 4000 ? 'warning' : 'default'}
        />
        <StatCard
          label="حالة اتصال SAHMK"
          value={usageCount > 0 ? 'نشط اليوم' : 'لم يُستخدم اليوم'}
          tone={usageCount > 0 ? 'good' : 'default'}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">أفضل 10 أسهم حسب التقييم</h2>
          {top10.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد نتائج تقييم محسوبة بعد.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-slate-500">
                  <th className="pb-2">الرمز</th>
                  <th className="pb-2">الشركة</th>
                  <th className="pb-2">التقييم</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((s) => (
                  <tr key={s.symbol} className="border-t border-slate-100">
                    <td className="py-2">
                      <Link to={`/stocks/${s.symbol}`} className="text-brand-700 hover:underline">
                        {s.symbol}
                      </Link>
                    </td>
                    <td className="py-2 text-slate-700">{companyMap.get(s.symbol)?.nameAr ?? '—'}</td>
                    <td className="py-2">
                      <ScoreBadge score={s.totalScore} excluded={s.excluded} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">حالة Telegram</h2>
            <button
              onClick={testTelegram}
              disabled={telegramStatus === 'checking'}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              اختبار الآن
            </button>
          </div>
          {telegramStatus === 'idle' && <p className="text-sm text-slate-400">لم يُختبر بعد في هذه الجلسة.</p>}
          {telegramStatus === 'checking' && <p className="text-sm text-slate-400">جارٍ الاختبار...</p>}
          {telegramStatus === 'ok' && <p className="text-sm text-green-700">✅ الاتصال يعمل بنجاح.</p>}
          {telegramStatus === 'fail' && <p className="text-sm text-red-700">⚠️ فشل الاتصال - تحقق من الإعدادات.</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">آخر التنبيهات</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-400">لا توجد تنبيهات بعد.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <div>
                  <Link to={`/stocks/${a.symbol}`} className="font-medium text-brand-700 hover:underline">
                    {companyMap.get(a.symbol)?.nameAr ?? a.symbol}
                  </Link>
                  <span className="mr-2 text-xs text-slate-400">{ALERT_LABELS[a.alertType]}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{Math.round(a.score)}/100</span>
                  {a.sentToTelegram && <span className="text-green-600">أُرسل</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

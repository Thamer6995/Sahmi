import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useCollection } from '../hooks/useCollection';
import { AppSettings, Company, DEFAULT_APP_SETTINGS } from '../types/models';

type ActionStatus = 'idle' | 'running' | 'done' | 'error';

export default function Settings() {
  const { data: companies } = useCollection<Company>('companies');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<ActionStatus>('idle');
  const [telegramStatus, setTelegramStatus] = useState<ActionStatus>('idle');
  const [healthStatus, setHealthStatus] = useState<ActionStatus>('idle');
  const [healthResult, setHealthResult] = useState<unknown>(null);
  const [refreshStatus, setRefreshStatus] = useState<ActionStatus>('idle');

  const sectors = useMemo(() => Array.from(new Set(companies.map((c) => c.sector).filter(Boolean))) as string[], [companies]);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'app'), (snap) => {
      if (snap.exists()) setSettings({ ...DEFAULT_APP_SETTINGS, ...(snap.data() as Partial<AppSettings>) });
    });
  }, []);

  async function saveSettings(partial: Partial<AppSettings>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    setSaveStatus('running');
    try {
      const fn = httpsCallable(functions, 'updateSettings');
      await fn(partial);
      setSaveStatus('done');
    } catch {
      setSaveStatus('error');
    }
  }

  function toggleExcludedSector(sector: string) {
    const current = settings.excludedSectors ?? [];
    const next = current.includes(sector) ? current.filter((s) => s !== sector) : [...current, sector];
    saveSettings({ excludedSectors: next });
  }

  async function runTestTelegram() {
    setTelegramStatus('running');
    try {
      const fn = httpsCallable<unknown, { ok: boolean }>(functions, 'testTelegramConnection');
      const res = await fn();
      setTelegramStatus(res.data.ok ? 'done' : 'error');
    } catch {
      setTelegramStatus('error');
    }
  }

  async function runHealthCheck() {
    setHealthStatus('running');
    try {
      const fn = httpsCallable(functions, 'healthCheck');
      const res = await fn();
      setHealthResult(res.data);
      setHealthStatus('done');
    } catch {
      setHealthStatus('error');
    }
  }

  async function runManualRefreshAll() {
    setRefreshStatus('running');
    try {
      await httpsCallable(functions, 'manualRefreshCompanies')();
      await httpsCallable(functions, 'manualRefreshQuotes')();
      setRefreshStatus('done');
    } catch {
      setRefreshStatus('error');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">الإعدادات</h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">أوزان التقييم (المجموع يُفضَّل أن يبقى 100)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(['quality', 'valuation', 'dividend', 'technical'] as const).map((key) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block text-xs text-slate-500">
                {{ quality: 'الجودة', valuation: 'التقييم المالي', dividend: 'التوزيعات', technical: 'التوقيت الفني' }[key]}
              </span>
              <input
                type="number"
                value={settings.scoringWeights[key]}
                onChange={(e) =>
                  saveSettings({ scoringWeights: { ...settings.scoringWeights, [key]: Number(e.target.value) } })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">قواعد التنبيه</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">الحد الأدنى للتنبيه</span>
            <input
              type="number"
              value={settings.minimumAlertScore}
              onChange={(e) => saveSettings({ minimumAlertScore: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">Cooldown (أيام)</span>
            <input
              type="number"
              value={settings.alertCooldownDays}
              onChange={(e) => saveSettings({ alertCooldownDays: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">وقت الفحص اليومي (بتوقيت الرياض)</span>
            <input
              type="time"
              value={settings.scanSchedule}
              onChange={(e) => saveSettings({ scanSchedule: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.telegramEnabled}
            onChange={(e) => saveSettings({ telegramEnabled: e.target.checked })}
          />
          تفعيل إرسال تنبيهات Telegram
        </label>

        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.watchlistOnly}
            onChange={(e) => saveSettings({ watchlistOnly: e.target.checked })}
          />
          تحليل قائمة المراقبة فقط (بدل كل السوق)
        </label>

        {saveStatus === 'running' && <p className="mt-2 text-xs text-slate-400">جارٍ الحفظ...</p>}
        {saveStatus === 'done' && <p className="mt-2 text-xs text-green-600">تم الحفظ.</p>}
        {saveStatus === 'error' && <p className="mt-2 text-xs text-red-600">فشل الحفظ.</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">القطاعات المستبعدة من التحليل</h2>
        <p className="mb-2 text-xs text-slate-400">
          البنوك والتأمين مستبعدة دائمًا من نظام التقييم (لا قواعد مناسبة لها بعد). يمكنك استبعاد قطاعات إضافية هنا.
        </p>
        <div className="flex flex-wrap gap-2">
          {sectors.map((s) => (
            <button
              key={s}
              onClick={() => toggleExcludedSector(s)}
              className={`rounded-full border px-3 py-1 text-xs ${
                settings.excludedSectors?.includes(s)
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">أدوات النظام</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={runManualRefreshAll}
            disabled={refreshStatus === 'running'}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {refreshStatus === 'running' ? 'جارٍ التحديث...' : 'تحديث يدوي (الشركات + الأسعار)'}
          </button>
          <button
            onClick={runHealthCheck}
            disabled={healthStatus === 'running'}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            فحص النظام
          </button>
          <button
            onClick={runTestTelegram}
            disabled={telegramStatus === 'running'}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            اختبار اتصال تيليجرام
          </button>
        </div>

        {refreshStatus === 'done' && <p className="mt-2 text-xs text-green-600">تم التحديث بنجاح.</p>}
        {refreshStatus === 'error' && <p className="mt-2 text-xs text-red-600">فشل التحديث.</p>}
        {telegramStatus === 'done' && <p className="mt-2 text-xs text-green-600">✅ اتصال Telegram يعمل.</p>}
        {telegramStatus === 'error' && <p className="mt-2 text-xs text-red-600">⚠️ فشل اتصال Telegram.</p>}
        {healthStatus === 'done' && (
          <pre className="mt-2 overflow-auto rounded-lg bg-slate-900 p-3 text-left text-xs text-green-400" dir="ltr">
            {JSON.stringify(healthResult, null, 2)}
          </pre>
        )}
        {healthStatus === 'error' && <p className="mt-2 text-xs text-red-600">فشل فحص النظام.</p>}
      </section>
    </div>
  );
}

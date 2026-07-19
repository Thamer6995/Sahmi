import { useEffect, useState } from 'react';
import { backendCallable } from '../lib/backend';

interface DiagnosticRunResult {
  success: boolean;
  executionTimeMs: number;
  error?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

interface HistoryEntry extends DiagnosticRunResult {
  testType: string;
}

const TEST_TYPE_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  sahmk: 'SAHMK',
  firestore: 'Firestore',
  scheduler: 'Scheduler',
  alertSimulation: 'Alert Simulation',
};

function ResultBadge({ success }: { success: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {success ? 'Success' : 'Failed'}
    </span>
  );
}

function DetailsBlock({ details, error }: { details?: Record<string, unknown>; error?: string }) {
  if (!details && !error) return null;
  return (
    <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
      {error && <p className="text-red-700">Error: {error}</p>}
      {details &&
        Object.entries(details).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3">
            <span className="text-slate-500">{key}</span>
            <span className="max-w-[60%] break-words text-left text-slate-800" dir="ltr">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
    </div>
  );
}

interface DiagnosticCardProps {
  title: string;
  description: string;
  buttonLabel: string;
  endpoint: string;
  onDone: (result: DiagnosticRunResult) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
  lastResult?: DiagnosticRunResult;
}

function DiagnosticCard({ title, description, buttonLabel, endpoint, onDone, running, setRunning, lastResult }: DiagnosticCardProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setLocalError(null);
    try {
      const fn = backendCallable<unknown, DiagnosticRunResult>(endpoint);
      const res = await fn();
      onDone(res.data);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {lastResult && <ResultBadge success={lastResult.success} />}
      </div>
      <p className="mb-3 text-xs text-slate-500">{description}</p>
      <button
        onClick={run}
        disabled={running}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {running ? 'جارٍ التنفيذ...' : buttonLabel}
      </button>

      {lastResult && (
        <div className="mt-3 text-xs text-slate-500">
          مدة التنفيذ: {lastResult.executionTimeMs} ms
        </div>
      )}
      <DetailsBlock details={lastResult?.details} error={lastResult?.error ?? localError ?? undefined} />
    </div>
  );
}

export default function SystemDiagnostics() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, DiagnosticRunResult>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const fn = backendCallable<unknown, { history: HistoryEntry[] }>('diagnostics/history');
      const res = await fn();
      setHistory(res.data.history);
    } catch {
      // صامت - سجل التشخيص نفسه ليس حرجًا لعرض بقية الصفحة
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  function handleDone(key: string, result: DiagnosticRunResult) {
    setResults((prev) => ({ ...prev, [key]: result }));
    loadHistory();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-xl font-bold text-slate-900">System Diagnostics</h1>
      <p className="mb-6 text-sm text-slate-500">
        اختبار مستقل لكل خدمة أساسية في النظام. لا يعتمد أي اختبار هنا على وجود فرصة استثمارية حقيقية أو بيانات سوق فعلية.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DiagnosticCard
          title="Telegram Test"
          description="يرسل رسالة اختبار حقيقية عبر نفس TelegramService المستخدم في النظام."
          buttonLabel="Send Test Message"
          endpoint="diagnostics/telegram"
          running={running}
          setRunning={setRunning}
          onDone={(r) => handleDone('telegram', r)}
          lastResult={results.telegram}
        />
        <DiagnosticCard
          title="SAHMK Test"
          description="طلب حقيقي واحد إلى SAHMK API (بيانات شركة 2222) - يقيس الوصول والزمن والحالة."
          buttonLabel="Test SAHMK Connection"
          endpoint="diagnostics/sahmk"
          running={running}
          setRunning={setRunning}
          onDone={(r) => handleDone('sahmk', r)}
          lastResult={results.sahmk}
        />
        <DiagnosticCard
          title="Firestore Test"
          description="ينشئ مستندًا تجريبيًا، يقرأه، يحدّثه، ثم يحذفه - على Firestore الفعلي."
          buttonLabel="Test Firestore"
          endpoint="diagnostics/firestore"
          running={running}
          setRunning={setRunning}
          onDone={(r) => handleDone('firestore', r)}
          lastResult={results.firestore}
        />
        <DiagnosticCard
          title="Scheduler Test"
          description="يشغّل نفس خطوات الفحص المجدول يدويًا على عيّنة صغيرة من الرموز (لا يمس جدولة الإنتاج)."
          buttonLabel="Run Scan Now"
          endpoint="diagnostics/scheduler"
          running={running}
          setRunning={setRunning}
          onDone={(r) => handleDone('scheduler', r)}
          lastResult={results.scheduler}
        />
        <DiagnosticCard
          title="Alert Simulation"
          description="سهم وهمي بالكامل بالذاكرة (Score=95, Confidence=100, بدون تحذيرات) يمرّ عبر محرك التنبيهات الحقيقي ثم Telegram - بدون أي اعتماد على SAHMK أو بيانات سوق حقيقية."
          buttonLabel="Simulate Alert"
          endpoint="diagnostics/alert-simulation"
          running={running}
          setRunning={setRunning}
          onDone={(r) => handleDone('alertSimulation', r)}
          lastResult={results.alertSimulation}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Diagnostics History (آخر 20 اختبارًا)</h2>
          <button onClick={loadHistory} className="text-xs text-brand-700 hover:underline">
            تحديث
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
                <th className="p-2">الوقت</th>
                <th className="p-2">نوع الاختبار</th>
                <th className="p-2">النتيجة</th>
                <th className="p-2">مدة التنفيذ</th>
                <th className="p-2">رسالة الخطأ</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400">جارٍ التحميل...</td>
                </tr>
              )}
              {!historyLoading && history.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400">لا توجد اختبارات مسجَّلة بعد.</td>
                </tr>
              )}
              {history.map((h, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="p-2 text-xs text-slate-500">{new Date(h.timestamp).toLocaleString('ar-SA')}</td>
                  <td className="p-2">{TEST_TYPE_LABELS[h.testType] ?? h.testType}</td>
                  <td className="p-2">
                    <ResultBadge success={h.success} />
                  </td>
                  <td className="p-2 text-xs">{h.executionTimeMs} ms</td>
                  <td className="p-2 text-xs text-red-700">{h.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

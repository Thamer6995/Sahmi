import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

/**
 * صفحة اختبار المرحلة 1 فقط - متاحة في وضع التطوير (VITE_DEV_MODE=true).
 * تستدعي دالة testCompanyFetch (تجلب شركة 2222 من SAHMK عبر Backend)
 * وتعرض الاستجابة الآمنة (بدون أي سر) للتأكد من نجاح الربط.
 *
 * يجب حذف الرابط لهذه الصفحة (أو تعطيلها) قبل النشر النهائي للإنتاج.
 */
export default function DevTest() {
  const [result, setResult] = useState<unknown>(null);
  const [rawResponses, setRawResponses] = useState<unknown>(null);
  const [companiesResult, setCompaniesResult] = useState<unknown>(null);
  const [quotesResult, setQuotesResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runTestCompanyFetch() {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'testCompanyFetch');
      const res = await fn();
      setResult(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRawResponses() {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'getDevRawResponses');
      const res = await fn({ limit: 10 });
      setRawResponses(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runRefreshCompanies() {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'manualRefreshCompanies');
      const res = await fn();
      setCompaniesResult(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runRefreshQuotes() {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'manualRefreshQuotes');
      const res = await fn();
      setQuotesResult(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-lg font-bold">اختبار المرحلة ١ - الاتصال بـ SAHMK</h1>
      <p className="mb-6 text-sm text-slate-500">
        هذه الصفحة لأغراض التطوير فقط. تحقق من نجاح جلب بيانات شركة أرامكو السعودية (2222).
      </p>

      <div className="mb-6 flex gap-3">
        <button
          onClick={runTestCompanyFetch}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          جلب شركة 2222
        </button>
        <button
          onClick={loadRawResponses}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          عرض آخر Raw Responses
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">خطأ: {error}</p>}

      {result !== null && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">نتيجة testCompanyFetch:</h2>
          <pre className="overflow-auto rounded-lg bg-slate-900 p-4 text-left text-xs text-green-400" dir="ltr">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {rawResponses !== null && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">آخر Raw Responses المحفوظة:</h2>
          <pre className="overflow-auto rounded-lg bg-slate-900 p-4 text-left text-xs text-amber-300" dir="ltr">
            {JSON.stringify(rawResponses, null, 2)}
          </pre>
        </div>
      )}

      <hr className="my-6 border-slate-200" />

      <h1 className="mb-2 text-lg font-bold">اختبار المرحلة ٢ - الشركات وBulk Quotes</h1>
      <p className="mb-4 text-sm text-slate-500">
        تحديث دليل الشركات كاملًا أولًا، ثم تحديث الأسعار بالجملة (Bulk Quotes) لكل الشركات المخزّنة.
      </p>

      <div className="mb-6 flex gap-3">
        <button
          onClick={runRefreshCompanies}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          تحديث الشركات
        </button>
        <button
          onClick={runRefreshQuotes}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          تحديث الأسعار (Bulk)
        </button>
      </div>

      {companiesResult !== null && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">نتيجة تحديث الشركات:</h2>
          <pre className="overflow-auto rounded-lg bg-slate-900 p-4 text-left text-xs text-green-400" dir="ltr">
            {JSON.stringify(companiesResult, null, 2)}
          </pre>
        </div>
      )}

      {quotesResult !== null && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">نتيجة تحديث الأسعار:</h2>
          <pre className="overflow-auto rounded-lg bg-slate-900 p-4 text-left text-xs text-green-400" dir="ltr">
            {JSON.stringify(quotesResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

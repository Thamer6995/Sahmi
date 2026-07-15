import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-bold">سهمي</h1>
        <button onClick={() => signOut(auth)} className="text-sm text-slate-500 hover:text-slate-800">
          تسجيل الخروج
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          المرحلة الأولى جاهزة: المشروع، Firebase Auth، وSahmkService. لوحة التحكم الكاملة
          (المرحلة السابعة) ستُبنى بعد استكمال جلب البيانات والتقييم.
        </p>
        {isDevMode && (
          <Link
            to="/dev-test"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            الذهاب لصفحة اختبار الاتصال بـ SAHMK
          </Link>
        )}
      </div>
    </div>
  );
}

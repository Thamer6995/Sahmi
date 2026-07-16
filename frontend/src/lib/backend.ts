import { auth } from './firebase';

/**
 * الخادم الخلفي (server/) لم يعد Firebase Cloud Functions - انتقلنا
 * لاستضافة مستقلة (Render) لأن Cloud Functions تتطلب خطة Blaze إجباريًا،
 * وفوترة Google Cloud الشخصية غير متاحة حاليًا في السعودية إلا عبر شريك
 * معتمد (CNTXT) الذي يقبل حاليًا حسابات Business فقط.
 *
 * المصادقة تبقى عبر Firebase Auth (مجانية تمامًا) - نرسل ID Token في
 * Header: Authorization: Bearer <token> مع كل طلب.
 *
 * backendCallable(name) يحاكي توقيع httpsCallable(functions, name) من
 * Firebase حتى تبقى بقية الكود (استدعاءات fn(data) و res.data) كما هي
 * بأقل تعديل ممكن في نقاط الاستخدام.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export function backendCallable<TData = unknown, TResult = unknown>(name: string) {
  return async (data?: TData): Promise<{ data: TResult }> => {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول لاستخدام هذه الوظيفة.');

    const token = await user.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data ?? {}),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json?.message || `فشل الاتصال بالخادم (${name})`);
    }

    return { data: json as TResult };
  };
}

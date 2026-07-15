import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

/**
 * التطبيق شخصي بحساب واحد فقط (لا تسجيل عام). يكفي التحقق من وجود مستخدم
 * مصادَق عبر Firebase Authentication - الحساب الوحيد يُنشأ يدويًا من
 * Firebase Console (انظر README - قسم المصادقة).
 */
export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول لاستخدام هذه الوظيفة.');
  }
  return request.auth.uid;
}

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { isDevMode } from '../../config/secrets';
import { logger } from '../../utils/logger';

/**
 * يحفظ Raw Response في Firestore (collection مخصصة: _devRawResponses)
 * لمراجعة الحقول الفعلية أثناء التطوير فقط. لا يعمل إطلاقًا إذا كان
 * DEV_MODE=false (الوضع الافتراضي والآمن للإنتاج).
 *
 * القراءة تتم عبر دالة HTTPS محمية بالمصادقة (انظر https/devRawResponse.ts)
 * ولا تُعرض هذه البيانات لأي مستخدم غير مسجل دخول.
 */
export async function saveRawResponseForReview(endpoint: string, raw: unknown): Promise<void> {
  if (!isDevMode()) return;
  try {
    const db = getFirestore();
    await db.collection('_devRawResponses').add({
      endpoint,
      raw,
      capturedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.warn('dev_raw_store_failed', { endpoint, message: (error as Error).message });
  }
}

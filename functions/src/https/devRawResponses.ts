import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAuth } from '../utils/auth';
import { isDevMode, DEV_MODE } from '../config/secrets';

/**
 * تعرض آخر Raw Responses المحفوظة من SAHMK لمراجعة أسماء الحقول الفعلية
 * أثناء التطوير فقط. تُرفض تمامًا إذا DEV_MODE=false (الوضع الافتراضي في
 * الإنتاج)، وتتطلب تسجيل دخول دائمًا.
 */
export const getDevRawResponses = onCall(
  { secrets: [DEV_MODE], region: 'me-central1' },
  async (request) => {
    requireAuth(request);
    if (!isDevMode()) {
      throw new HttpsError('failed-precondition', 'هذه الوظيفة متاحة فقط في وضع التطوير (DEV_MODE=true).');
    }

    const db = getFirestore();
    const limit = Math.min(Number(request.data?.limit) || 20, 50);
    const snap = await db
      .collection('_devRawResponses')
      .orderBy('capturedAt', 'desc')
      .limit(limit)
      .get();

    return {
      items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Rate limiting بسيط للوظائف اليدوية (manual refresh, test telegram...)
 * كي لا يُساء استخدامها لاستنزاف حصة SAHMK اليومية أو إغراق Telegram.
 * يعتمد نافذة ثابتة (fixed window) مخزّنة في Firestore تحت _rateLimits.
 */
export async function enforceRateLimit(key: string, maxCalls: number, windowSeconds: number): Promise<void> {
  const db = getFirestore();
  const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
  const docRef = db.collection('_rateLimits').doc(`${key}_${windowId}`);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const count = (snap.data()?.count as number | undefined) ?? 0;
    if (count >= maxCalls) {
      return false;
    }
    tx.set(
      docRef,
      { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return true;
  });

  if (!result) {
    throw new HttpsError('resource-exhausted', 'تم تجاوز الحد المسموح من الطلبات، حاول لاحقًا.');
  }
}

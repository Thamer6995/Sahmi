import { onCall } from 'firebase-functions/v2/https';
import { requireAuth } from '../utils/auth';
import { getTodayUsage } from '../services/sahmk/rateTracker';

/**
 * فحص عام لصحة النظام: حالة الاتصال بـ Firestore وعداد استخدام SAHMK
 * اليومي التقريبي. تُستخدم في لوحة التحكم وزر "فحص النظام" بالإعدادات.
 */
export const healthCheck = onCall({ region: 'me-central1' }, async (request) => {
  requireAuth(request);
  const usage = await getTodayUsage();
  return {
    ok: true,
    firestore: 'connected',
    sahmkUsageToday: usage,
    checkedAt: new Date().toISOString(),
  };
});

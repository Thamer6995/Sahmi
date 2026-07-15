import { onCall } from 'firebase-functions/v2/https';
import { SAHMK_API_KEY } from '../config/secrets';
import { requireAuth } from '../utils/auth';
import { enforceRateLimit } from '../utils/rateLimit';
import { refreshCompanies } from '../jobs/refreshCompanies';
import { SahmkApiError } from '../services/sahmk/types';
import { logger } from '../utils/logger';

/** زر "تحديث يدوي" لدليل الشركات (صفحة الإعدادات / مستكشف الأسهم). */
export const manualRefreshCompanies = onCall(
  { secrets: [SAHMK_API_KEY], region: 'me-central1', timeoutSeconds: 300 },
  async (request) => {
    requireAuth(request);
    await enforceRateLimit('manualRefreshCompanies', 3, 3600); // 3 مرات كحد أقصى بالساعة

    try {
      const result = await refreshCompanies();
      return { ok: true, ...result };
    } catch (error) {
      if (error instanceof SahmkApiError) {
        logger.error('manual_refresh_companies_failed', { kind: error.kind });
        return { ok: false, errorKind: error.kind, message: error.message };
      }
      logger.error('manual_refresh_companies_unknown_error', { message: (error as Error).message });
      return { ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع أثناء تحديث الشركات.' };
    }
  }
);

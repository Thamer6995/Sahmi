import { onCall } from 'firebase-functions/v2/https';
import { SAHMK_API_KEY } from '../config/secrets';
import { requireAuth } from '../utils/auth';
import { enforceRateLimit } from '../utils/rateLimit';
import { sahmkService } from '../services/sahmk/SahmkService';
import { SahmkApiError } from '../services/sahmk/types';
import { logger } from '../utils/logger';

/**
 * دالة اختبار المرحلة 1: تجلب شركة أرامكو السعودية (2222) من SAHMK للتأكد
 * من صحة مفتاح الـ API وسلامة الاتصال. تتطلب تسجيل الدخول (الحساب الشخصي
 * الوحيد)، ولا تُعيد أي سر (API Key/Token) في الاستجابة.
 */
export const testCompanyFetch = onCall(
  { secrets: [SAHMK_API_KEY], region: 'me-central1' },
  async (request) => {
    requireAuth(request);
    await enforceRateLimit('testCompanyFetch', 10, 60);

    try {
      const company = await sahmkService.getCompany('2222');
      return { ok: true, company };
    } catch (error) {
      if (error instanceof SahmkApiError) {
        logger.error('test_company_fetch_failed', { kind: error.kind, endpoint: error.endpoint });
        return { ok: false, errorKind: error.kind, message: error.message };
      }
      logger.error('test_company_fetch_unknown_error', { message: (error as Error).message });
      return { ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع.' };
    }
  }
);

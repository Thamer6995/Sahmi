import { onCall } from 'firebase-functions/v2/https';
import { SAHMK_API_KEY } from '../config/secrets';
import { requireAuth } from '../utils/auth';
import { enforceRateLimit } from '../utils/rateLimit';
import { validateSymbol } from '../utils/validate';
import { refreshFinancialsAndRatios } from '../jobs/refreshFinancialsAndRatios';
import { logger } from '../utils/logger';

/**
 * زر "تحديث يدوي" لسهم معين من صفحة السهم - يحدّث القوائم المالية
 * والنسب لهذا الرمز فقط (التحديث الجماعي أسبوعي عبر الجدولة - المرحلة 8).
 */
export const manualRefreshFinancials = onCall(
  { secrets: [SAHMK_API_KEY], region: 'me-central1', timeoutSeconds: 120 },
  async (request) => {
    requireAuth(request);
    await enforceRateLimit('manualRefreshFinancials', 20, 3600);
    const symbol = validateSymbol(request.data?.symbol);

    try {
      const summary = await refreshFinancialsAndRatios([symbol]);
      return { ok: summary.failed === 0, ...summary };
    } catch (error) {
      logger.error('manual_refresh_financials_unknown_error', { symbol, message: (error as Error).message });
      return { ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع أثناء تحديث البيانات المالية.' };
    }
  }
);

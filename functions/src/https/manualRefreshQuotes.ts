import { onCall } from 'firebase-functions/v2/https';
import { SAHMK_API_KEY } from '../config/secrets';
import { requireAuth } from '../utils/auth';
import { enforceRateLimit } from '../utils/rateLimit';
import { refreshQuotes } from '../jobs/refreshQuotes';
import { logger } from '../utils/logger';

/**
 * زر "تحديث يدوي" للأسعار. يقبل رمزًا واحدًا اختياريًا (تحديث سهم معين
 * من صفحة السهم) أو يحدّث كل الشركات المخزّنة إذا لم يُمرَّر شيء.
 */
export const manualRefreshQuotes = onCall(
  { secrets: [SAHMK_API_KEY], region: 'me-central1', timeoutSeconds: 300 },
  async (request) => {
    requireAuth(request);
    await enforceRateLimit('manualRefreshQuotes', 10, 3600);

    const symbol = typeof request.data?.symbol === 'string' ? request.data.symbol.trim() : undefined;

    try {
      const summary = await refreshQuotes(symbol ? [symbol] : undefined);
      return { ok: true, ...summary };
    } catch (error) {
      logger.error('manual_refresh_quotes_unknown_error', { message: (error as Error).message });
      return { ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع أثناء تحديث الأسعار.' };
    }
  }
);

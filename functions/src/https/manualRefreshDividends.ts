import { onCall } from 'firebase-functions/v2/https';
import { SAHMK_API_KEY } from '../config/secrets';
import { requireAuth } from '../utils/auth';
import { enforceRateLimit } from '../utils/rateLimit';
import { validateSymbol } from '../utils/validate';
import { refreshDividends } from '../jobs/refreshDividends';
import { logger } from '../utils/logger';

/** زر تحديث يدوي لتوزيعات سهم معين (التحديث الجماعي يومي عبر الجدولة - المرحلة 8). */
export const manualRefreshDividends = onCall(
  { secrets: [SAHMK_API_KEY], region: 'me-central1', timeoutSeconds: 60 },
  async (request) => {
    requireAuth(request);
    await enforceRateLimit('manualRefreshDividends', 20, 3600);
    const symbol = validateSymbol(request.data?.symbol);

    try {
      const summary = await refreshDividends([symbol]);
      return { ok: summary.failed === 0, ...summary };
    } catch (error) {
      logger.error('manual_refresh_dividends_unknown_error', { symbol, message: (error as Error).message });
      return { ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع أثناء تحديث التوزيعات.' };
    }
  }
);

import { onCall } from 'firebase-functions/v2/https';
import { SAHMK_API_KEY } from '../config/secrets';
import { requireAuth } from '../utils/auth';
import { enforceRateLimit } from '../utils/rateLimit';
import { validateSymbol } from '../utils/validate';
import { refreshHistorical } from '../jobs/refreshHistorical';
import { logger } from '../utils/logger';

/** زر تحديث يدوي لبيانات OHLCV لسهم معين (التحديث الجماعي يومي بعد إغلاق السوق - المرحلة 8). */
export const manualRefreshHistorical = onCall(
  { secrets: [SAHMK_API_KEY], region: 'me-central1', timeoutSeconds: 120 },
  async (request) => {
    requireAuth(request);
    await enforceRateLimit('manualRefreshHistorical', 20, 3600);
    const symbol = validateSymbol(request.data?.symbol);

    try {
      const summary = await refreshHistorical([symbol]);
      return { ok: summary.failed === 0, ...summary };
    } catch (error) {
      logger.error('manual_refresh_historical_unknown_error', { symbol, message: (error as Error).message });
      return { ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع أثناء تحديث بيانات الأسعار التاريخية.' };
    }
  }
);

import { onCall } from 'firebase-functions/v2/https';
import { SAHMK_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../config/secrets';
import { requireAuth } from '../utils/auth';
import { enforceRateLimit } from '../utils/rateLimit';
import { validateSymbol } from '../utils/validate';
import { runAlertCheckForSymbol } from '../jobs/runAlertCheck';
import { logger } from '../utils/logger';

/**
 * دالة اختبار المرحلة 6: تحسب التقييم لسهم معين وتطبّق قواعد التنبيه
 * كاملة (بما فيها إرسال Telegram الفعلي إن تحققت الشروط) - تُستخدم
 * للتحقق من التكامل الكامل بين التقييم والتنبيهات والـ Cooldown.
 */
export const runAlertCheck = onCall(
  { secrets: [SAHMK_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID], region: 'me-central1', timeoutSeconds: 120 },
  async (request) => {
    requireAuth(request);
    await enforceRateLimit('runAlertCheck', 20, 3600);
    const symbol = validateSymbol(request.data?.symbol);

    try {
      const { result, evaluation } = await runAlertCheckForSymbol(symbol);
      return { ok: true, result, evaluation };
    } catch (error) {
      logger.error('run_alert_check_failed', { symbol, message: (error as Error).message });
      return { ok: false, message: 'حدث خطأ غير متوقع أثناء فحص التنبيه.' };
    }
  }
);

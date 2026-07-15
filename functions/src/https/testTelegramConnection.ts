import { onCall } from 'firebase-functions/v2/https';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../config/secrets';
import { requireAuth } from '../utils/auth';
import { enforceRateLimit } from '../utils/rateLimit';
import { telegramService } from '../services/telegram/TelegramService';

/** زر "اختبار اتصال تيليجرام" في صفحة الإعدادات. */
export const testTelegramConnection = onCall(
  { secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID], region: 'me-central1' },
  async (request) => {
    requireAuth(request);
    await enforceRateLimit('testTelegramConnection', 10, 3600);

    const result = await telegramService.sendTestMessage();
    return result;
  }
);

import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../../config/secrets';
import { logger } from '../../utils/logger';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const MAX_RETRIES = 2;
const BACKOFF_FACTOR_MS = 500;

export interface InlineButton {
  text: string;
  url: string;
}

export interface SendMessageResult {
  ok: boolean;
  messageId?: number;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * TelegramService - الطبقة الوحيدة في المشروع التي تتواصل مع Telegram
 * Bot API. BOT_TOKEN وCHAT_ID يُقرآن من Firebase Secrets ولا يظهران في
 * أي سجل (logger هنا لا يمرّر التوكن مطلقًا في رسائل السجل).
 */
export class TelegramService {
  /** يرسل رسالة نصية (Markdown أو HTML) مع زر اختياري، ويعيد محاولة الإرسال عند فشل مؤقت. */
  async sendMessage(
    text: string,
    options: { parseMode?: 'MarkdownV2' | 'HTML'; button?: InlineButton } = {}
  ): Promise<SendMessageResult> {
    const token = TELEGRAM_BOT_TOKEN.value();
    const chatId = TELEGRAM_CHAT_ID.value();

    if (!token || !chatId) {
      logger.error('telegram_not_configured');
      return { ok: false, error: 'لم يتم إعداد بيانات اتصال Telegram (BOT_TOKEN/CHAT_ID).' };
    }

    const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: options.parseMode,
      disable_web_page_preview: true,
    };

    if (options.button) {
      body.reply_markup = {
        inline_keyboard: [[{ text: options.button.text, url: options.button.url }]],
      };
    }

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const json = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          result?: { message_id?: number };
          description?: string;
        };

        if (response.ok && json.ok) {
          return { ok: true, messageId: json.result?.message_id };
        }

        lastError = json.description ?? `HTTP ${response.status}`;
        const retryable = response.status === 429 || response.status >= 500;
        logger.warn('telegram_send_failed', { attempt, status: response.status, retryable, description: lastError });

        if (!retryable) break;
      } catch (error) {
        lastError = (error as Error).message;
        logger.warn('telegram_send_exception', { attempt, message: lastError });
      }

      if (attempt < MAX_RETRIES) {
        await sleep(BACKOFF_FACTOR_MS * Math.pow(2, attempt));
      }
    }

    return { ok: false, error: lastError ?? 'فشل إرسال رسالة Telegram لسبب غير معروف' };
  }

  async sendTestMessage(): Promise<SendMessageResult> {
    return this.sendMessage('✅ اختبار اتصال سهمي بـ Telegram - الاتصال يعمل بنجاح.\n\nهذا تنبيه آلي وليس توصية مالية.');
  }
}

export const telegramService = new TelegramService();

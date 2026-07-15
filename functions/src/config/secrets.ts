import { defineSecret, defineString } from 'firebase-functions/params';

// أسرار حقيقية - تُضبط عبر: firebase functions:secrets:set <NAME>
// لا تُقرأ هذه القيم إلا داخل تنفيذ الدالة (Backend)، ولا تصل أبدًا للـ Frontend.
export const SAHMK_API_KEY = defineSecret('SAHMK_API_KEY');
export const TELEGRAM_BOT_TOKEN = defineSecret('TELEGRAM_BOT_TOKEN');
export const TELEGRAM_CHAT_ID = defineSecret('TELEGRAM_CHAT_ID');

// قيم تهيئة غير حساسة (يمكن ضبطها بمتغيرات بيئة عادية)
export const SAHMK_BASE_URL = defineString('SAHMK_BASE_URL', {
  default: 'https://app.sahmk.sa/api/v1',
});

export const APP_TIMEZONE = defineString('APP_TIMEZONE', {
  default: 'Asia/Riyadh',
});

// وضع التطوير: يسمح بحفظ/عرض Raw API Response لأغراض المراجعة فقط.
// يجب أن يكون false في الإنتاج (هذا هو الافتراضي الآمن).
export const DEV_MODE = defineString('DEV_MODE', { default: 'false' });

export function isDevMode(): boolean {
  return DEV_MODE.value() === 'true';
}

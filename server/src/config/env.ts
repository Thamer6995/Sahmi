/**
 * إعدادات البيئة - كلها من process.env مباشرة (لا Firebase Secrets هنا،
 * لأن هذا الخادم يعمل على منصة مستقلة عن Google Cloud - انظر README
 * لسبب هذا القرار: Cloud Functions تتطلب خطة Blaze إجباريًا لأي اتصال
 * خارجي، وهذا غير متاح حاليًا للحسابات الشخصية في السعودية عبر CNTXT).
 *
 * القيم الحساسة (SAHMK_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
 * CRON_SECRET, FIREBASE_SERVICE_ACCOUNT_BASE64) تُضبط كمتغيرات بيئة سرية
 * من لوحة تحكم منصة الاستضافة (Render) ولا تُكتب أبدًا في الكود.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`متغيّر البيئة المطلوب غير موجود: ${name}`);
  }
  return value;
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const SAHMK_API_KEY = () => required('SAHMK_API_KEY');
export const SAHMK_BASE_URL = () => optional('SAHMK_BASE_URL', 'https://app.sahmk.sa/api/v1');

export const TELEGRAM_BOT_TOKEN = () => required('TELEGRAM_BOT_TOKEN');
export const TELEGRAM_CHAT_ID = () => required('TELEGRAM_CHAT_ID');

export const APP_TIMEZONE = () => optional('APP_TIMEZONE', 'Asia/Riyadh');
export const APP_URL = () => optional('APP_URL', '');

export const CRON_SECRET = () => required('CRON_SECRET');

export const FRONTEND_ORIGIN = () => optional('FRONTEND_ORIGIN', '*');

export function isDevMode(): boolean {
  return process.env.DEV_MODE === 'true';
}

export const PORT = Number(process.env.PORT ?? 8080);

/**
 * المهلة القصوى (Hard Timeout) لقفل التزامن بين المهام المجدولة (jobLock.ts)
 * بالميلي ثانية. القيمة الافتراضية (480000 = 8 دقائق) مبنية على أسوأ حالة
 * واقعية رُصدت فعليًا: دفعة معالجة واحدة (~60 رمزًا) تحت تقييد SAHMK (429)
 * الحقيقي مع إعادة محاولة صبورة قد تحتاج عدة دقائق لتكتمل بشكل طبيعي دون
 * أي خلل - 8 دقائق تمنح هامشًا كافيًا لهذا دون السماح للقفل بالبقاء محجوزًا
 * لساعة كاملة كما حدث فعليًا يوم 19 يوليو 2026 قبل هذا الإصلاح.
 */
export const JOB_LOCK_TIMEOUT_MS = () => Number(optional('JOB_LOCK_TIMEOUT_MS', '480000'));

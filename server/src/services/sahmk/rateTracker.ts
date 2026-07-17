import { logger } from '../../utils/logger';

/**
 * تتبّع عدد طلبات SAHMK API المستخدمة يوميًا كهامش أمان ضد حلقة لا نهائية
 * غير متوقعة - بالذاكرة فقط (وليس Firestore).
 *
 * كان هذا العداد مبنيًا على Firestore سابقًا (collection: apiUsage)، لكن
 * ذلك تسبب فعليًا في استنزاف حصة الكتابة اليومية المجانية لـ Firestore
 * (20,000 كتابة/يوم على خطة Spark) لأن كل استدعاء SAHMK - بما فيها كل
 * إعادة محاولة - كان يكتب سطرًا (مؤكَّد من سجل فعلي: "8 RESOURCE_EXHAUSTED:
 * Quota exceeded" أثناء اختبار شامل متكرر لنفس اليوم). ومؤكَّد أيضًا (سجلات
 * سابقة) أن SAHMK نفسها لا تفرض حدًا يوميًا فعليًا (فقط throttling مؤقت
 * بالثانية، يُعالَج بشكل منفصل تمامًا في httpClient.ts عبر رؤوس 429). لذا
 * لا داعي إطلاقًا لتثبيت هذا العداد في قاعدة بيانات - عداد بالذاكرة (يُصفَّر
 * مع كل إعادة تشغيل للسيرفر) كافٍ تمامًا لغرضه الوحيد: منع حلقة لا نهائية.
 */

const DAILY_SOFT_CAP = 20000;

let countDate = '';
let requestCount = 0;

function todayKey(timeZone = 'Asia/Riyadh'): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function currentCount(): number {
  const today = todayKey();
  if (today !== countDate) {
    countDate = today;
    requestCount = 0;
  }
  return requestCount;
}

export class RateLimitExceededError extends Error {
  constructor(used: number) {
    super(`تم تجاوز الحد اليومي التقريبي لطلبات SAHMK (${used}/${DAILY_SOFT_CAP})`);
    this.name = 'RateLimitExceededError';
  }
}

export async function assertWithinDailyBudget(): Promise<void> {
  const used = currentCount();
  if (used >= DAILY_SOFT_CAP) {
    logger.warn('sahmk_rate_limit_soft_cap_reached', { used, cap: DAILY_SOFT_CAP });
    throw new RateLimitExceededError(used);
  }
}

export async function recordApiRequest(_endpoint: string): Promise<void> {
  currentCount();
  requestCount += 1;
}

export async function getTodayUsage(): Promise<{ used: number; cap: number }> {
  return { used: currentCount(), cap: DAILY_SOFT_CAP };
}

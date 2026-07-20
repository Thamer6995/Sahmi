import { resourceExhausted } from './httpError';

/**
 * Rate limiting بسيط للوظائف اليدوية (manual refresh, test telegram...) كي
 * لا يُساء استخدامها لاستنزاف حصة SAHMK اليومية أو إغراق Telegram. يعتمد
 * نافذة ثابتة (fixed window) بالذاكرة فقط - كان مخزَّنًا سابقًا في Firestore
 * تحت _rateLimits (Storage Refactor Phase 1: أُزيل ذلك بالكامل).
 *
 * أثر إعادة تشغيل Render على العداد: يُصفَّر العداد بالكامل مع كل إعادة
 * تشغيل (سواء تلقائية بسبب "spin down" على الخطة المجانية، أو نشر جديد).
 * هذا مقبول هنا تحديدًا لأن: (1) الغرض الوحيد لهذا الحد هو منع سوء استخدام
 * عرضي من نفس المستخدم الوحيد للمشروع (وليس حماية أمنية صارمة)، (2) المشروع
 * نسخة واحدة فقط (Render single instance، بلا Horizontal Scaling) فلا يوجد
 * خطر تعدد نسخ تتشارك عدادات غير متزامنة، (3) إعادة التشغيل نفسها نادرة
 * نسبيًا مقارنةً بنافذة الساعة (3600 ثانية) المستخدمة لكل الحدود الحالية.
 */
const windowCounts = new Map<string, number>();

export async function enforceRateLimit(key: string, maxCalls: number, windowSeconds: number): Promise<void> {
  const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
  const mapKey = `${key}_${windowId}`;

  const count = windowCounts.get(mapKey) ?? 0;
  if (count >= maxCalls) {
    throw resourceExhausted();
  }
  windowCounts.set(mapKey, count + 1);

  // تنظيف مفاتيح النوافذ المنتهية لنفس key كي لا تتراكم بالذاكرة للأبد
  // (Map لا تُصفَّر تلقائيًا مثل Firestore TTL) - المفاتيح القديمة لنفس
  // key لم تعد تُستخدَم أبدًا بمجرد انتهاء نافذتها.
  for (const existingKey of windowCounts.keys()) {
    if (existingKey.startsWith(`${key}_`) && existingKey !== mapKey) {
      windowCounts.delete(existingKey);
    }
  }
}

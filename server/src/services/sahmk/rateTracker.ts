import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../utils/logger';

/**
 * تتبّع عدد طلبات SAHMK API المستخدمة يوميًا، لضمان عدم تجاوز السقف
 * المحدد يدويًا (5000 طلب/يوم) بما أن SAHMK لا تنشر رقمًا دقيقًا لحدود
 * باقة Starter. العداد تقريبي ويُخزَّن في Firestore (collection: apiUsage)
 * حتى يبقى صحيحًا عبر استدعاءات Functions المختلفة (لا تشترك في ذاكرة واحدة).
 */

const DAILY_SOFT_CAP = 5000;

function todayDocId(timeZone = 'Asia/Riyadh'): string {
  // تنسيق YYYY-MM-DD بتوقيت الرياض حتى يتوافق العداد مع "يوم تداول" واحد
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export class RateLimitExceededError extends Error {
  constructor(used: number) {
    super(`تم تجاوز الحد اليومي التقريبي لطلبات SAHMK (${used}/${DAILY_SOFT_CAP})`);
    this.name = 'RateLimitExceededError';
  }
}

export async function assertWithinDailyBudget(): Promise<void> {
  const db = getFirestore();
  const docRef = db.collection('apiUsage').doc(todayDocId());
  const snap = await docRef.get();
  const used = (snap.data()?.requestCount as number | undefined) ?? 0;
  if (used >= DAILY_SOFT_CAP) {
    logger.warn('sahmk_rate_limit_soft_cap_reached', { used, cap: DAILY_SOFT_CAP });
    throw new RateLimitExceededError(used);
  }
}

export async function recordApiRequest(endpoint: string): Promise<void> {
  const db = getFirestore();
  const docRef = db.collection('apiUsage').doc(todayDocId());
  await docRef.set(
    {
      requestCount: FieldValue.increment(1),
      lastEndpoint: endpoint,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getTodayUsage(): Promise<{ used: number; cap: number }> {
  const db = getFirestore();
  const docRef = db.collection('apiUsage').doc(todayDocId());
  const snap = await docRef.get();
  const used = (snap.data()?.requestCount as number | undefined) ?? 0;
  return { used, cap: DAILY_SOFT_CAP };
}

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { omitUndefined } from '../utils/firestoreHelpers';

export type AlertType = '70-79' | '80-89' | '90-100';

export interface CreateAlertInput {
  symbol: string;
  alertType: AlertType;
  score: number;
  price?: number;
  reasons: string[];
  sentToTelegram: boolean;
  telegramMessageId?: number;
}

export async function createAlert(input: CreateAlertInput): Promise<void> {
  const db = getFirestore();
  await db.collection('alerts').add(
    omitUndefined({
      symbol: input.symbol,
      alertType: input.alertType,
      score: input.score,
      price: input.price,
      reasons: input.reasons,
      sentToTelegram: input.sentToTelegram,
      telegramMessageId: input.telegramMessageId,
      createdAt: FieldValue.serverTimestamp(),
    })
  );
}

/** هل أُرسل نفس نوع التنبيه لهذا السهم فعليًا عبر Telegram خلال آخر `cooldownDays` يومًا؟ */
export async function hasRecentAlert(symbol: string, alertType: AlertType, cooldownDays: number): Promise<boolean> {
  const db = getFirestore();
  const cutoff = Timestamp.fromMillis(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
  const snap = await db
    .collection('alerts')
    .where('symbol', '==', symbol)
    .where('alertType', '==', alertType)
    .where('sentToTelegram', '==', true)
    .where('createdAt', '>=', cutoff)
    .limit(1)
    .get();
  return !snap.empty;
}

export async function getRecentAlerts(limit = 20): Promise<Array<CreateAlertInput & { id: string }>> {
  const db = getFirestore();
  const snap = await db.collection('alerts').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CreateAlertInput) }));
}

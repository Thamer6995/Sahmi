import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { chunk, omitUndefined } from '../utils/firestoreHelpers';
import { OhlcvBar } from '../technical/types';

const FIRESTORE_BATCH_LIMIT = 400;

export async function upsertHistoricalBars(symbol: string, bars: OhlcvBar[]): Promise<void> {
  if (bars.length === 0) return;
  const db = getFirestore();
  const batches = chunk(bars, FIRESTORE_BATCH_LIMIT);

  for (const group of batches) {
    const batch = db.batch();
    for (const bar of group) {
      const ref = db.collection('historicalPrices').doc(`${symbol}_${bar.date}`);
      batch.set(
        ref,
        omitUndefined({
          symbol,
          date: bar.date,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          updatedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );
    }
    await batch.commit();
  }
}

/** أحدث تاريخ مخزَّن لسهم معين، أو undefined إن لم تتوفر بيانات سابقة بعد. */
export async function getLatestStoredDate(symbol: string): Promise<string | undefined> {
  const db = getFirestore();
  const snap = await db
    .collection('historicalPrices')
    .where('symbol', '==', symbol)
    .orderBy('date', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return undefined;
  return snap.docs[0].data().date as string;
}

/** آخر `limit` شمعة مخزَّنة لسهم، مرتبة تصاعديًا (الأقدم أولًا) لاستخدامها في حسابات SMA/RSI. */
export async function getRecentBars(symbol: string, limit = 250): Promise<OhlcvBar[]> {
  const db = getFirestore();
  const snap = await db
    .collection('historicalPrices')
    .where('symbol', '==', symbol)
    .orderBy('date', 'desc')
    .limit(limit)
    .get();

  const bars = snap.docs.map((d) => {
    const data = d.data();
    return {
      date: data.date as string,
      open: data.open as number,
      high: data.high as number,
      low: data.low as number,
      close: data.close as number,
      volume: data.volume as number,
    };
  });

  return bars.reverse();
}

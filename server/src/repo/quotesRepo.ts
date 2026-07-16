import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { chunk, omitUndefined } from '../utils/firestoreHelpers';
import { NormalizedQuote } from '../services/sahmk/mappers';

const FIRESTORE_BATCH_LIMIT = 400;

/** يكتب/يحدّث الأسعار في Firestore على دفعات (doc id = symbol). */
export async function upsertQuotes(quotes: NormalizedQuote[]): Promise<void> {
  const db = getFirestore();
  const batches = chunk(quotes, FIRESTORE_BATCH_LIMIT);

  for (const group of batches) {
    const batch = db.batch();
    for (const quote of group) {
      const ref = db.collection('quotes').doc(quote.symbol);
      batch.set(
        ref,
        omitUndefined({
          symbol: quote.symbol,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          value: quote.value,
          quoteDate: quote.quoteDate,
          updatedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );
    }
    await batch.commit();
  }
}

export async function getQuote(symbol: string): Promise<NormalizedQuote | undefined> {
  const db = getFirestore();
  const snap = await db.collection('quotes').doc(symbol).get();
  if (!snap.exists) return undefined;
  return snap.data() as NormalizedQuote;
}

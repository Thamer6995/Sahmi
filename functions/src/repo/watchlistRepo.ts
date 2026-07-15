import { getFirestore } from 'firebase-admin/firestore';

export async function getWatchlistSymbols(): Promise<string[]> {
  const db = getFirestore();
  const snap = await db.collection('watchlist').select().get();
  return snap.docs.map((d) => d.id);
}

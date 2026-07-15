import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { omitUndefined } from '../utils/firestoreHelpers';
import { NormalizedDividend } from '../services/sahmk/mappers';

function safeDocId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function upsertDividends(dividends: NormalizedDividend[]): Promise<void> {
  if (dividends.length === 0) return;
  const db = getFirestore();
  const batch = db.batch();

  dividends.forEach((d, index) => {
    const dateKey = d.eligibilityDate ?? d.announcementDate ?? d.distributionDate ?? `entry${index}`;
    const docId = `${d.symbol}_${safeDocId(dateKey)}`;
    const ref = db.collection('dividends').doc(docId);
    batch.set(
      ref,
      omitUndefined({
        symbol: d.symbol,
        announcementDate: d.announcementDate,
        eligibilityDate: d.eligibilityDate,
        distributionDate: d.distributionDate,
        amountPerShare: d.amountPerShare,
        dividendYield: d.dividendYield,
        status: d.status,
        updatedAt: FieldValue.serverTimestamp(),
      }),
      { merge: true }
    );
  });

  await batch.commit();
}

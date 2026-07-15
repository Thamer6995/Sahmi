import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { chunk, omitUndefined } from '../utils/firestoreHelpers';
import { NormalizedCompany } from '../services/sahmk/mappers';

const FIRESTORE_BATCH_LIMIT = 400; // أقل من حد Firestore الفعلي (500) كهامش أمان

/** يكتب/يحدّث الشركات في Firestore على دفعات (doc id = symbol). */
export async function upsertCompanies(companies: NormalizedCompany[]): Promise<void> {
  const db = getFirestore();
  const batches = chunk(companies, FIRESTORE_BATCH_LIMIT);

  for (const group of batches) {
    const batch = db.batch();
    for (const company of group) {
      const ref = db.collection('companies').doc(company.symbol);
      batch.set(
        ref,
        omitUndefined({
          symbol: company.symbol,
          nameAr: company.nameAr,
          nameEn: company.nameEn,
          sector: company.sector,
          industry: company.industry,
          market: company.market,
          updatedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );
    }
    await batch.commit();
  }
}

export async function getAllCompanySymbols(): Promise<string[]> {
  const db = getFirestore();
  const snap = await db.collection('companies').select().get();
  return snap.docs.map((d) => d.id);
}

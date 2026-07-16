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

/**
 * تحديث جزئي لقطاع/سوق شركة واحدة فقط. مطلوب لأن endpoint الجملة
 * /companies/ (المستخدم في upsertCompanies) لا يرجع sector_name/
 * sector_name_ar/market_id إطلاقًا (مؤكَّد من raw response فعلي) - فقط
 * /company/{symbol}/ المفرد يحوي هذه الحقول. يُستدعى من
 * jobs/refreshFinancialsAndRatios.ts الذي يجلب /company/{symbol}/ أصلًا
 * لاستخراج P/E وP/B، فلا حاجة لاستدعاء API إضافي.
 */
export async function updateCompanySector(
  symbol: string,
  data: { sector?: string; industry?: string; market?: string }
): Promise<void> {
  const db = getFirestore();
  const update = omitUndefined({
    sector: data.sector,
    industry: data.industry,
    market: data.market,
  });
  if (Object.keys(update).length === 0) return;
  await db
    .collection('companies')
    .doc(symbol)
    .set({ ...update, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function getAllCompanySymbols(): Promise<string[]> {
  const db = getFirestore();
  const snap = await db.collection('companies').select().get();
  return snap.docs.map((d) => d.id);
}

export async function getCompany(symbol: string): Promise<NormalizedCompany | undefined> {
  const db = getFirestore();
  const snap = await db.collection('companies').doc(symbol).get();
  if (!snap.exists) return undefined;
  return snap.data() as NormalizedCompany;
}

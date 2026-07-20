import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { omitUndefined } from '../utils/firestoreHelpers';
import { NormalizedDividend } from '../services/sahmk/mappers';

function safeDocId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** الحقول الفعلية للمقارنة عند تحديد إن كان السجل تغيّر فعليًا (باستثناء updatedAt). */
function dividendContentEquals(a: NormalizedDividend, b: Record<string, unknown>): boolean {
  return (
    a.announcementDate === b.announcementDate &&
    a.eligibilityDate === b.eligibilityDate &&
    a.distributionDate === b.distributionDate &&
    a.amountPerShare === b.amountPerShare &&
    a.dividendYield === b.dividendYield &&
    a.status === b.status
  );
}

/**
 * تكتب فقط السجلات الجديدة أو المتغيّرة فعليًا (مقارنة بما هو مخزَّن أصلًا)،
 * بدل إعادة كتابة كل سجلات التوزيعات لكل شركة في كل تشغيلة يومية - سجلات
 * التوزيعات القديمة تكاد لا تتغيّر أبدًا بعد نشرها، فإعادة كتابتها يوميًا
 * تستهلك آلاف عمليات الكتابة على Firestore بلا أي فائدة فعلية (مؤكَّد أنه
 * أحد أكبر أسباب استنزاف حصة الكتابة اليومية المجانية المتكررة). القراءة
 * هنا رخيصة نسبيًا (حصة يومية أكبر بكثير: 50 ألف مقابل 20 ألف للكتابة).
 */
export async function upsertDividends(dividends: NormalizedDividend[]): Promise<void> {
  if (dividends.length === 0) return;
  const db = getFirestore();

  const refs = dividends.map((d, index) => {
    const dateKey = d.eligibilityDate ?? d.announcementDate ?? d.distributionDate ?? `entry${index}`;
    return db.collection('dividends').doc(`${d.symbol}_${safeDocId(dateKey)}`);
  });

  const existingSnaps = await db.getAll(...refs);

  const batch = db.batch();
  let hasChanges = false;

  dividends.forEach((d, i) => {
    const existing = existingSnaps[i];
    if (existing.exists && dividendContentEquals(d, existing.data() ?? {})) {
      return; // لا تغيير فعلي - تخطَّ الكتابة تمامًا
    }
    hasChanges = true;
    batch.set(
      refs[i],
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

  if (hasChanges) {
    await batch.commit();
  }
}

/** سجل التوزيعات لسهم، مرتّب تصاعديًا حسب أقرب تاريخ متاح (استحقاق/صرف/إعلان). */
export async function getDividendsForSymbol(symbol: string): Promise<NormalizedDividend[]> {
  const db = getFirestore();
  const snap = await db.collection('dividends').where('symbol', '==', symbol).get();
  const dividends = snap.docs.map((d) => d.data() as NormalizedDividend);

  function sortKey(d: NormalizedDividend): string {
    return d.eligibilityDate ?? d.distributionDate ?? d.announcementDate ?? '';
  }

  return dividends.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

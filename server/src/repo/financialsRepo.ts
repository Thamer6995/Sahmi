import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { omitUndefined, stableEqual } from '../utils/firestoreHelpers';
import { NormalizedFinancialPeriod } from '../services/sahmk/mappers';

function safeDocId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** الحقول الفعلية للمقارنة عند تحديد إن كانت الفترة المالية تغيّرت فعليًا
 *  (باستثناء updatedAt). rawMetrics تُقارَن بمقارنة مستقرة (stableEqual) لا
 *  تتأثر بترتيب المفاتيح، لأنها كائن خام مصدره استجابة SAHMK مباشرة. */
function financialContentEquals(a: NormalizedFinancialPeriod, b: Record<string, unknown>): boolean {
  return (
    a.revenue === b.revenue &&
    a.netIncome === b.netIncome &&
    a.operatingCashFlow === b.operatingCashFlow &&
    a.totalAssets === b.totalAssets &&
    a.totalLiabilities === b.totalLiabilities &&
    a.totalEquity === b.totalEquity &&
    a.totalDebt === b.totalDebt &&
    stableEqual(a.rawMetrics, b.rawMetrics)
  );
}

export interface UpsertFinancialsResult {
  changed: number;
  skipped: number;
}

/**
 * تكتب فقط الفترات المالية الجديدة أو المتغيّرة فعليًا - القوائم المالية
 * المنشورة تاريخيًا لا تتغيّر أبدًا عمليًا، فإعادة كتابتها أسبوعيًا لكل
 * الفترات لكل الشركات كانت أحد مصادر استنزاف حصة الكتابة اليومية المجانية.
 */
export async function upsertFinancials(periods: NormalizedFinancialPeriod[]): Promise<UpsertFinancialsResult> {
  if (periods.length === 0) return { changed: 0, skipped: 0 };
  const db = getFirestore();

  const refs = periods.map((p) => db.collection('financials').doc(`${p.symbol}_${p.periodType}_${safeDocId(p.period)}`));
  const existingSnaps = await db.getAll(...refs);

  const batch = db.batch();
  let changed = 0;
  let skipped = 0;

  periods.forEach((p, i) => {
    const existing = existingSnaps[i];
    if (existing.exists && financialContentEquals(p, existing.data() ?? {})) {
      skipped += 1;
      return; // لا تغيير فعلي - تخطَّ الكتابة تمامًا
    }
    changed += 1;
    batch.set(
      refs[i],
      omitUndefined({
        symbol: p.symbol,
        period: p.period,
        periodType: p.periodType,
        revenue: p.revenue,
        netIncome: p.netIncome,
        operatingCashFlow: p.operatingCashFlow,
        totalAssets: p.totalAssets,
        totalLiabilities: p.totalLiabilities,
        totalEquity: p.totalEquity,
        totalDebt: p.totalDebt,
        rawMetrics: p.rawMetrics,
        updatedAt: FieldValue.serverTimestamp(),
      }),
      { merge: true }
    );
  });

  if (changed > 0) {
    await batch.commit();
  }

  return { changed, skipped };
}

/** الفترات السنوية لسهم، مرتّبة تصاعديًا حسب الفترة (الأقدم أولًا). */
export async function getAnnualPeriods(symbol: string): Promise<NormalizedFinancialPeriod[]> {
  const db = getFirestore();
  const snap = await db
    .collection('financials')
    .where('symbol', '==', symbol)
    .where('periodType', '==', 'annual')
    .get();

  const periods = snap.docs.map((d) => d.data() as NormalizedFinancialPeriod);
  return periods.sort((a, b) => a.period.localeCompare(b.period));
}

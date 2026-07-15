import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { omitUndefined } from '../utils/firestoreHelpers';
import { NormalizedFinancialPeriod } from '../services/sahmk/mappers';

function safeDocId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function upsertFinancials(periods: NormalizedFinancialPeriod[]): Promise<void> {
  if (periods.length === 0) return;
  const db = getFirestore();
  const batch = db.batch();

  for (const p of periods) {
    const docId = `${p.symbol}_${p.periodType}_${safeDocId(p.period)}`;
    const ref = db.collection('financials').doc(docId);
    batch.set(
      ref,
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
  }

  await batch.commit();
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

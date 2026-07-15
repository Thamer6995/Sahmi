import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { omitUndefined } from '../utils/firestoreHelpers';
import { NormalizedRatios } from '../services/sahmk/mappers';

export async function upsertRatios(ratios: NormalizedRatios): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('ratios').doc(ratios.symbol);
  await ref.set(
    omitUndefined({
      symbol: ratios.symbol,
      pe: ratios.pe,
      pb: ratios.pb,
      roe: ratios.roe,
      roa: ratios.roa,
      debtToEquity: ratios.debtToEquity,
      profitMargin: ratios.profitMargin,
      revenueGrowth: ratios.revenueGrowth,
      netIncomeGrowth: ratios.netIncomeGrowth,
      dividendYield: ratios.dividendYield,
      rawMetrics: ratios.rawMetrics,
      updatedAt: FieldValue.serverTimestamp(),
    }),
    { merge: true }
  );
}

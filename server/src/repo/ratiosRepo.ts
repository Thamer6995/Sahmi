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

export async function getRatios(symbol: string): Promise<NormalizedRatios | undefined> {
  const db = getFirestore();
  const snap = await db.collection('ratios').doc(symbol).get();
  if (!snap.exists) return undefined;
  return snap.data() as NormalizedRatios;
}

/**
 * يحدّث عائد التوزيعات فقط (merge جزئي) - مصدره الفعلي /dividends/ (حقل
 * trailing_12m_yield) وليس /analytics/ratios/، والتحديث اليومي للتوزيعات
 * منفصل عن التحديث الأسبوعي لبقية النسب المالية.
 */
export async function updateDividendYield(symbol: string, dividendYield: number): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('ratios').doc(symbol);
  const existing = await ref.get();
  // تخطَّ الكتابة إن كانت القيمة نفسها فعليًا (تُستدعى يوميًا لكل شركة - القيمة
  // نادرًا ما تتغيّر بين يوم وآخر، وإعادة الكتابة بلا تغيير حقيقي كانت أحد
  // أسباب استنزاف حصة الكتابة اليومية المجانية لـ Firestore.
  if (existing.exists && existing.data()?.dividendYield === dividendYield) {
    return;
  }
  await ref.set({ symbol, dividendYield, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

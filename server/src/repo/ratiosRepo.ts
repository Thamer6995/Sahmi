import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { omitUndefined, stableEqual } from '../utils/firestoreHelpers';
import { NormalizedRatios } from '../services/sahmk/mappers';

/** الحقول الفعلية للمقارنة عند تحديد إن كانت النسب تغيّرت فعليًا (باستثناء
 *  updatedAt وdividendYield - الأخير يُحدَّث بشكل منفصل يوميًا عبر
 *  updateDividendYield، فلا نريد أن يمنع تغيّره وحده كتابة بقية النسب هنا
 *  ولا العكس). rawMetrics تُقارَن بمقارنة مستقرة لا تتأثر بترتيب المفاتيح. */
function ratiosContentEquals(a: NormalizedRatios, b: Record<string, unknown>): boolean {
  return (
    a.pe === b.pe &&
    a.pb === b.pb &&
    a.roe === b.roe &&
    a.roa === b.roa &&
    a.debtToEquity === b.debtToEquity &&
    a.profitMargin === b.profitMargin &&
    a.revenueGrowth === b.revenueGrowth &&
    a.netIncomeGrowth === b.netIncomeGrowth &&
    stableEqual(a.rawMetrics, b.rawMetrics)
  );
}

export interface UpsertRatiosResult {
  changed: boolean;
}

/** تكتب فقط إذا تغيّرت النسب فعليًا مقارنةً بما هو مخزَّن - نفس سبب التخطي
 *  في financialsRepo.ts: تحديث أسبوعي لكل السوق بلا فحص تغيّر فعلي كان
 *  يستهلك كتابة واحدة لكل شركة أسبوعيًا حتى لو لم تتغيّر أي قيمة. */
export async function upsertRatios(ratios: NormalizedRatios): Promise<UpsertRatiosResult> {
  const db = getFirestore();
  const ref = db.collection('ratios').doc(ratios.symbol);
  const existing = await ref.get();

  if (existing.exists && ratiosContentEquals(ratios, existing.data() ?? {})) {
    return { changed: false };
  }

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
  return { changed: true };
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

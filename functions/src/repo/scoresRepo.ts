import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { omitUndefined } from '../utils/firestoreHelpers';
import { InvestmentScoreResult } from '../scoring/investmentScore';

/**
 * يخزّن نتيجة التقييم في collection: scores. الحقول الأساسية مطابقة
 * للتصميم المطلوب (symbol/qualityScore/valuationScore/dividendScore/
 * technicalScore/totalScore/reasons/warnings/calculatedAt)، مع إضافتين
 * ضروريتين وظيفيًا غير مذكورتين صراحة في القائمة الأصلية: dataCompleteness
 * (مطلوبة لقواعد التنبيه ولرسالة Telegram) وexcluded/exclusionReason
 * (للشركات المالية المستبعدة) وmissingData (لعرض "بيانات غير متوفرة").
 */
export async function upsertScore(result: InvestmentScoreResult): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('scores').doc(result.symbol);

  await ref.set(
    omitUndefined({
      symbol: result.symbol,
      excluded: result.excluded,
      exclusionReason: result.exclusionReason,
      qualityScore: result.quality?.score,
      valuationScore: result.valuation?.score,
      dividendScore: result.dividend?.score,
      technicalScore: result.technical?.score,
      totalScore: result.totalScore,
      dataCompleteness: result.dataCompleteness,
      reasons: result.reasons,
      warnings: result.warnings,
      missingData: result.missingData,
      calculatedAt: FieldValue.serverTimestamp(),
    }),
    { merge: false } // كل تقييم جديد يستبدل السابق بالكامل (لا نُبقي حقولًا قديمة متضاربة)
  );
}

export async function getScore(symbol: string): Promise<(InvestmentScoreResult & { totalScore?: number }) | undefined> {
  const db = getFirestore();
  const snap = await db.collection('scores').doc(symbol).get();
  if (!snap.exists) return undefined;
  return snap.data() as InvestmentScoreResult;
}

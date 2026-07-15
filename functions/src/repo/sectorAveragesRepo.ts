import { getFirestore } from 'firebase-admin/firestore';

export interface SectorAverages {
  avgPE?: number;
  avgPB?: number;
  peerCount: number;
}

const MIN_PEERS_FOR_AVERAGE = 2;

/**
 * يحسب متوسط P/E وP/B لشركات نفس القطاع من بيانات Firestore المخزَّنة
 * فعليًا (وليس عبر /analytics/compare/ لتفادي استهلاك حصة SAHMK اليومية
 * لكل عملية تقييم - البيانات محدَّثة أسبوعيًا أصلًا). يتطلب نظيرين على
 * الأقل بنسبة صالحة حتى يُعتبر المتوسط ذا دلالة إحصائية.
 */
export async function computeSectorAverages(sector: string, excludeSymbol: string): Promise<SectorAverages> {
  const db = getFirestore();
  const companiesSnap = await db.collection('companies').where('sector', '==', sector).select().get();
  const symbols = companiesSnap.docs.map((d) => d.id).filter((s) => s !== excludeSymbol);

  if (symbols.length === 0) return { peerCount: 0 };

  const refs = symbols.map((s) => db.collection('ratios').doc(s));
  const snaps = await db.getAll(...refs);

  const peValues: number[] = [];
  const pbValues: number[] = [];
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() ?? {};
    const pe = data.pe as number | undefined;
    const pb = data.pb as number | undefined;
    if (typeof pe === 'number' && Number.isFinite(pe) && pe > 0) peValues.push(pe);
    if (typeof pb === 'number' && Number.isFinite(pb) && pb > 0) pbValues.push(pb);
  }

  return {
    avgPE: peValues.length >= MIN_PEERS_FOR_AVERAGE ? peValues.reduce((a, b) => a + b, 0) / peValues.length : undefined,
    avgPB: pbValues.length >= MIN_PEERS_FOR_AVERAGE ? pbValues.reduce((a, b) => a + b, 0) / pbValues.length : undefined,
    peerCount: symbols.length,
  };
}

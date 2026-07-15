import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * يتتبّع آخر تاريخ (بتوقيت الرياض) نُفِّذ فيه الفحص اليومي، حتى لا يُعاد
 * تشغيله أكثر من مرة في نفس اليوم رغم أن الدالة المجدولة تُستدعى كل 30
 * دقيقة (لجعل "وقت الفحص" في الإعدادات قابلًا للتعديل فعليًا بدون إعادة نشر).
 */
export async function hasRunToday(jobKey: string, todayRiyadh: string): Promise<boolean> {
  const db = getFirestore();
  const snap = await db.collection('_scheduleState').doc(jobKey).get();
  return snap.exists && snap.data()?.lastRunDate === todayRiyadh;
}

export async function markRunToday(jobKey: string, todayRiyadh: string): Promise<void> {
  const db = getFirestore();
  await db
    .collection('_scheduleState')
    .doc(jobKey)
    .set({ lastRunDate: todayRiyadh, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

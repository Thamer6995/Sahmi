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

interface ChunkProgress {
  remaining: string[];
  total: number;
}

/**
 * تتبّع تقدّم مهمة قابلة للتقسيم على عدة استدعاءات HTTP منفصلة، بدل تنفيذها
 * كاملة في طلب واحد طويل. لوحظ فعليًا (سجلات Render) أن طلبًا واحدًا يمر
 * على كل شركات السوق يُقطَع بصمت أحيانًا (سواء بسبب مهلة داخلية عند
 * Render أو سلوك غير موثّق آخر) قبل اكتماله - دون أي حدث Crash/Restart
 * ظاهر. تقسيم العمل إلى دفعات صغيرة عبر استدعاءات متكررة (كل استدعاء
 * يكمل من حيث توقف السابق) يجعل كل طلب HTTP قصيرًا بما يكفي ليكتمل بأمان.
 */
export async function getChunkProgress(jobKey: string): Promise<ChunkProgress | undefined> {
  const db = getFirestore();
  const snap = await db.collection('_scheduleState').doc(jobKey).get();
  const data = snap.data();
  if (!data?.remaining) return undefined;
  return { remaining: data.remaining as string[], total: data.total as number };
}

export async function saveChunkProgress(jobKey: string, remaining: string[], total: number): Promise<void> {
  const db = getFirestore();
  await db
    .collection('_scheduleState')
    .doc(jobKey)
    .set({ remaining, total, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function clearChunkProgress(jobKey: string): Promise<void> {
  const db = getFirestore();
  await db
    .collection('_scheduleState')
    .doc(jobKey)
    .set({ remaining: FieldValue.delete(), total: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export interface DailyScanState {
  date: string;
  phase: 'historical' | 'alerts';
  historicalRemaining: string[];
  allSymbols: string[];
  total: number;
}

const DAILY_SCAN_STATE_DOC = 'dailyScanCycle';

/**
 * حالة مخصّصة لدورة الفحص اليومي (dailyPriceAndAlertScan.ts) - متعددة
 * المراحل (أسعار ثم بيانات تاريخية مقسّمة ثم تقييم/تنبيهات)، بخلاف
 * getChunkProgress/saveChunkProgress أعلاه المخصّصة لمهمة بمرحلة واحدة فقط.
 */
export async function getDailyScanState(): Promise<DailyScanState | undefined> {
  const db = getFirestore();
  const snap = await db.collection('_scheduleState').doc(DAILY_SCAN_STATE_DOC).get();
  const data = snap.data();
  if (!data?.allSymbols) return undefined;
  return data as DailyScanState;
}

export async function saveDailyScanState(state: DailyScanState): Promise<void> {
  const db = getFirestore();
  await db
    .collection('_scheduleState')
    .doc(DAILY_SCAN_STATE_DOC)
    .set({ ...state, updatedAt: FieldValue.serverTimestamp() });
}

export async function clearDailyScanState(): Promise<void> {
  const db = getFirestore();
  await db.collection('_scheduleState').doc(DAILY_SCAN_STATE_DOC).delete();
}

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export type DiagnosticTestType = 'telegram' | 'sahmk' | 'firestore' | 'scheduler' | 'alertSimulation';

const TEST_TYPE_DOC_ID: Record<DiagnosticTestType, string> = {
  telegram: 'telegramTests',
  sahmk: 'sahmkTests',
  firestore: 'firestoreTests',
  scheduler: 'schedulerTests',
  alertSimulation: 'alertSimulationTests',
};

const MAX_RUNS_PER_TYPE = 20;

export interface DiagnosticRun {
  success: boolean;
  executionTimeMs: number;
  error?: string;
  details?: Record<string, unknown>;
  timestamp: string; // ISO - وليس FieldValue.serverTimestamp() حتى يمكن فرزه في مصفوفة بدون قراءة إضافية
}

export interface DiagnosticHistoryEntry extends DiagnosticRun {
  testType: DiagnosticTestType;
}

/**
 * يخزّن نتيجة اختبار تشخيصي واحد ضمن `systemDiagnostics/{testType}Tests`
 * (حسب المسار المطلوب صراحة لاختبار Telegram: systemDiagnostics/telegramTests،
 * وعُمِّم نفس النمط لبقية الاختبارات). كل مستند يحتفظ بمصفوفة `runs` بحد
 * أقصى 20 عنصرًا (الأحدث أولًا) بدل subcollection منفصلة، لتبسيط قراءة
 * "آخر 20 اختبارًا" دفعة واحدة بلا استعلامات متعددة.
 */
export async function recordDiagnosticRun(testType: DiagnosticTestType, run: DiagnosticRun): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('systemDiagnostics').doc(TEST_TYPE_DOC_ID[testType]);
  const snap = await ref.get();
  const existingRuns = (snap.data()?.runs as DiagnosticRun[] | undefined) ?? [];
  // Firestore يرفض قيم undefined (على عكس omitUndefined العادية، `details` كائن
  // متداخل قد يحتوي undefined في أي مستوى - JSON round-trip يزيلها جميعًا دفعة واحدة).
  const cleanRun = JSON.parse(JSON.stringify(run)) as DiagnosticRun;
  const updatedRuns = [cleanRun, ...existingRuns].slice(0, MAX_RUNS_PER_TYPE);
  await ref.set({ runs: updatedRuns, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

/** يجمع آخر الاختبارات من كل الأنواع الخمسة ويفرزها زمنيًا (الأحدث أولًا). */
export async function getDiagnosticsHistory(limit = 20): Promise<DiagnosticHistoryEntry[]> {
  const db = getFirestore();
  const testTypes = Object.keys(TEST_TYPE_DOC_ID) as DiagnosticTestType[];

  const docs = await Promise.all(
    testTypes.map(async (testType) => {
      const snap = await db.collection('systemDiagnostics').doc(TEST_TYPE_DOC_ID[testType]).get();
      const runs = (snap.data()?.runs as DiagnosticRun[] | undefined) ?? [];
      return runs.map((run) => ({ ...run, testType }));
    })
  );

  return docs
    .flat()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

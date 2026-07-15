import { getFirestore } from 'firebase-admin/firestore';

export interface ScoringWeights {
  quality: number;
  valuation: number;
  dividend: number;
  technical: number;
}

export interface AppSettings {
  minimumAlertScore: number;
  telegramEnabled: boolean;
  alertCooldownDays: number;
  scoringWeights: ScoringWeights;
  excludedSectors: string[];
  watchlistOnly: boolean;
  /** وقت الفحص اليومي بصيغة HH:mm بتوقيت الرياض - يُستخدم في جدولة المرحلة 8 */
  scanSchedule: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  minimumAlertScore: 80,
  telegramEnabled: true,
  alertCooldownDays: 7,
  scoringWeights: { quality: 35, valuation: 25, dividend: 25, technical: 15 },
  excludedSectors: [],
  watchlistOnly: false,
  scanSchedule: '17:30',
};

const SETTINGS_DOC_ID = 'app';

/** يُعيد إعدادات التطبيق، مع الرجوع للقيم الافتراضية لأي حقل غير مضبوط بعد. */
export async function getSettings(): Promise<AppSettings> {
  const db = getFirestore();
  const snap = await db.collection('settings').doc(SETTINGS_DOC_ID).get();
  if (!snap.exists) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AppSettings>) };
}

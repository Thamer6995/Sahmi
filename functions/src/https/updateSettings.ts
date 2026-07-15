import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '../utils/auth';
import { enforceRateLimit } from '../utils/rateLimit';

const ScoringWeightsSchema = z
  .object({
    quality: z.number().min(0).max(100),
    valuation: z.number().min(0).max(100),
    dividend: z.number().min(0).max(100),
    technical: z.number().min(0).max(100),
  })
  .partial();

const SettingsInputSchema = z.object({
  minimumAlertScore: z.number().min(0).max(100).optional(),
  telegramEnabled: z.boolean().optional(),
  alertCooldownDays: z.number().min(1).max(90).optional(),
  scoringWeights: ScoringWeightsSchema.optional(),
  excludedSectors: z.array(z.string().max(100)).max(50).optional(),
  watchlistOnly: z.boolean().optional(),
  scanSchedule: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'صيغة الوقت يجب أن تكون HH:mm')
    .optional(),
});

/**
 * تحديث إعدادات التطبيق (settings/app). لا نسمح بالكتابة المباشرة من
 * العميل عبر Firestore Rules (settings.write=false) حتى تُتحقّق كل
 * القيم أولًا (مثلاً منع alertCooldownDays سالب أو scanSchedule بصيغة
 * خاطئة) قبل أن تؤثر على الجدولة والتنبيهات الفعلية.
 */
export const updateSettings = onCall({ region: 'me-central1' }, async (request) => {
  requireAuth(request);
  await enforceRateLimit('updateSettings', 30, 3600);

  const parsed = SettingsInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `بيانات الإعدادات غير صالحة: ${parsed.error.message}`);
  }

  const db = getFirestore();
  await db
    .collection('settings')
    .doc('app')
    .set({ ...parsed.data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  return { ok: true };
});

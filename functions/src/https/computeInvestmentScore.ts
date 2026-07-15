import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { requireAuth } from '../utils/auth';
import { enforceRateLimit } from '../utils/rateLimit';
import { validateSymbol } from '../utils/validate';
import { computeScoreForSymbol } from '../jobs/computeScores';
import { logger } from '../utils/logger';

const MAX_SYMBOLS_PER_CALL = 10;

/**
 * دالة اختبار المرحلة 5: تحسب Investment Score لسهم واحد أو عدة أسهم
 * (حتى 10) من البيانات المخزَّنة فعليًا، وتُعيد تفصيل كل قسم وأسبابه
 * وتحذيراته - تُستخدم لاختبار التقييم على شركات من قطاعات مختلفة.
 */
export const computeInvestmentScoreBatch = onCall({ region: 'me-central1', timeoutSeconds: 120 }, async (request) => {
  requireAuth(request);
  await enforceRateLimit('computeInvestmentScoreBatch', 20, 3600);

  const rawSymbols = request.data?.symbols;
  if (!Array.isArray(rawSymbols) || rawSymbols.length === 0) {
    throw new HttpsError('invalid-argument', 'يجب تمرير قائمة رموز (symbols).');
  }
  if (rawSymbols.length > MAX_SYMBOLS_PER_CALL) {
    throw new HttpsError('invalid-argument', `الحد الأقصى ${MAX_SYMBOLS_PER_CALL} رموز لكل استدعاء.`);
  }

  const symbols = rawSymbols.map((s) => validateSymbol(s));

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        return await computeScoreForSymbol(symbol);
      } catch (error) {
        logger.error('compute_investment_score_failed', { symbol, message: (error as Error).message });
        return { symbol, error: 'تعذّر حساب التقييم لهذا الرمز', excluded: false, reasons: [], warnings: [], missingData: [], calculatedAt: new Date().toISOString() };
      }
    })
  );

  return { ok: true, results };
});

import { Router } from 'express';
import { z } from 'zod';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { enforceRateLimit } from '../utils/rateLimit';
import { validateSymbol } from '../utils/validate';
import { invalidArgument, failedPrecondition } from '../utils/httpError';
import { isDevMode } from '../config/env';
import { logger } from '../utils/logger';

import { sahmkService } from '../services/sahmk/SahmkService';
import { SahmkApiError } from '../services/sahmk/types';
import { getTodayUsage } from '../services/sahmk/rateTracker';
import { telegramService } from '../services/telegram/TelegramService';

import { refreshCompanies } from '../jobs/refreshCompanies';
import { refreshQuotes } from '../jobs/refreshQuotes';
import { refreshFinancialsAndRatios } from '../jobs/refreshFinancialsAndRatios';
import { refreshDividends } from '../jobs/refreshDividends';
import { refreshHistorical } from '../jobs/refreshHistorical';
import { computeScoreForSymbol } from '../jobs/computeScores';
import { runAlertCheckForSymbol } from '../jobs/runAlertCheck';

import { getRecentBars } from '../repo/historicalPricesRepo';
import { sma50, sma200, rsi14, fiftyTwoWeekHigh, fiftyTwoWeekLow, fiftyTwoWeekLowClose, relativeDistancePercent } from '../technical';
import { diagnosticsRouter } from './diagnostics';

/**
 * كل مسارات الـ API (استبدال onCall functions السابقة على Firebase
 * Functions). كل مسار محمي بمصادقة Firebase ID Token (requireAuth)،
 * ويطابق نفس منطق ورسائل النسخة الأصلية حرفيًا - فقط طبقة النقل تغيّرت
 * (Express بدل onCall) بسبب الانتقال بعيدًا عن Google Cloud Functions.
 */
export const apiRouter = Router();
apiRouter.use(requireAuth);
apiRouter.use('/diagnostics', diagnosticsRouter);

const MAX_SYMBOLS_PER_SCORE_CALL = 10;

apiRouter.post(
  '/testCompanyFetch',
  asyncHandler(async (_req, res) => {
    await enforceRateLimit('testCompanyFetch', 10, 60);
    try {
      const company = await sahmkService.getCompany('2222');
      res.json({ ok: true, company });
    } catch (error) {
      if (error instanceof SahmkApiError) {
        logger.error('test_company_fetch_failed', { kind: error.kind, endpoint: error.endpoint });
        res.json({ ok: false, errorKind: error.kind, message: error.message });
        return;
      }
      logger.error('test_company_fetch_unknown_error', { message: (error as Error).message });
      res.json({ ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع.' });
    }
  })
);

apiRouter.post(
  '/getDevRawResponses',
  asyncHandler(async (req, res) => {
    if (!isDevMode()) {
      throw failedPrecondition('هذه الوظيفة متاحة فقط في وضع التطوير (DEV_MODE=true).');
    }
    const db = getFirestore();
    const limit = Math.min(Number(req.body?.limit) || 20, 50);
    const snap = await db.collection('_devRawResponses').orderBy('capturedAt', 'desc').limit(limit).get();
    res.json({ items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  })
);

apiRouter.post(
  '/healthCheck',
  asyncHandler(async (_req, res) => {
    const usage = await getTodayUsage();
    res.json({ ok: true, firestore: 'connected', sahmkUsageToday: usage, checkedAt: new Date().toISOString() });
  })
);

apiRouter.post(
  '/manualRefreshCompanies',
  asyncHandler(async (_req, res) => {
    await enforceRateLimit('manualRefreshCompanies', 3, 3600);
    try {
      const result = await refreshCompanies();
      res.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof SahmkApiError) {
        logger.error('manual_refresh_companies_failed', { kind: error.kind });
        res.json({ ok: false, errorKind: error.kind, message: error.message });
        return;
      }
      logger.error('manual_refresh_companies_unknown_error', { message: (error as Error).message });
      res.json({ ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع أثناء تحديث الشركات.' });
    }
  })
);

apiRouter.post(
  '/manualRefreshQuotes',
  asyncHandler(async (req, res) => {
    await enforceRateLimit('manualRefreshQuotes', 10, 3600);
    const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim() : undefined;
    try {
      const summary = await refreshQuotes(symbol ? [symbol] : undefined);
      res.json({ ok: true, ...summary });
    } catch (error) {
      logger.error('manual_refresh_quotes_unknown_error', { message: (error as Error).message });
      res.json({ ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع أثناء تحديث الأسعار.' });
    }
  })
);

apiRouter.post(
  '/manualRefreshFinancials',
  asyncHandler(async (req, res) => {
    await enforceRateLimit('manualRefreshFinancials', 20, 3600);
    const symbol = validateSymbol(req.body?.symbol);
    try {
      const summary = await refreshFinancialsAndRatios([symbol]);
      res.json({ ok: summary.failed === 0, ...summary });
    } catch (error) {
      logger.error('manual_refresh_financials_unknown_error', { symbol, message: (error as Error).message });
      res.json({ ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع أثناء تحديث البيانات المالية.' });
    }
  })
);

apiRouter.post(
  '/manualRefreshDividends',
  asyncHandler(async (req, res) => {
    await enforceRateLimit('manualRefreshDividends', 20, 3600);
    const symbol = validateSymbol(req.body?.symbol);
    try {
      const summary = await refreshDividends([symbol]);
      res.json({ ok: summary.failed === 0, ...summary });
    } catch (error) {
      logger.error('manual_refresh_dividends_unknown_error', { symbol, message: (error as Error).message });
      res.json({ ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع أثناء تحديث التوزيعات.' });
    }
  })
);

apiRouter.post(
  '/manualRefreshHistorical',
  asyncHandler(async (req, res) => {
    await enforceRateLimit('manualRefreshHistorical', 20, 3600);
    const symbol = validateSymbol(req.body?.symbol);
    try {
      const summary = await refreshHistorical([symbol]);
      res.json({ ok: summary.failed === 0, ...summary });
    } catch (error) {
      logger.error('manual_refresh_historical_unknown_error', { symbol, message: (error as Error).message });
      res.json({ ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع أثناء تحديث بيانات الأسعار التاريخية.' });
    }
  })
);

apiRouter.post(
  '/computeTechnicalIndicators',
  asyncHandler(async (req, res) => {
    const symbol = validateSymbol(req.body?.symbol);
    const bars = await getRecentBars(symbol, 250);
    if (bars.length === 0) {
      res.json({ ok: false, message: 'لا توجد بيانات تاريخية مخزَّنة لهذا السهم بعد.' });
      return;
    }

    const closes = bars.map((b) => b.close);
    const lastClose = closes[closes.length - 1];
    const high52w = fiftyTwoWeekHigh(bars);
    const low52w = fiftyTwoWeekLow(bars);
    const low52wClose = fiftyTwoWeekLowClose(closes);

    res.json({
      ok: true,
      symbol,
      sessionsAvailable: bars.length,
      lastClose,
      lastDate: bars[bars.length - 1].date,
      sma50: sma50(closes),
      sma200: sma200(closes),
      rsi14: rsi14(closes),
      fiftyTwoWeekHigh: high52w,
      fiftyTwoWeekLow: low52w,
      fiftyTwoWeekLowClose: low52wClose,
      distanceFromHighPercent: high52w !== undefined ? relativeDistancePercent(lastClose, high52w) : undefined,
      distanceFromLowClosePercent: low52wClose !== undefined ? relativeDistancePercent(lastClose, low52wClose) : undefined,
    });
  })
);

apiRouter.post(
  '/computeInvestmentScoreBatch',
  asyncHandler(async (req, res) => {
    await enforceRateLimit('computeInvestmentScoreBatch', 20, 3600);

    const rawSymbols = req.body?.symbols;
    if (!Array.isArray(rawSymbols) || rawSymbols.length === 0) {
      throw invalidArgument('يجب تمرير قائمة رموز (symbols).');
    }
    if (rawSymbols.length > MAX_SYMBOLS_PER_SCORE_CALL) {
      throw invalidArgument(`الحد الأقصى ${MAX_SYMBOLS_PER_SCORE_CALL} رموز لكل استدعاء.`);
    }

    const symbols = rawSymbols.map((s) => validateSymbol(s));

    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          return await computeScoreForSymbol(symbol);
        } catch (error) {
          logger.error('compute_investment_score_failed', { symbol, message: (error as Error).message });
          return {
            symbol,
            error: 'تعذّر حساب التقييم لهذا الرمز',
            excluded: false,
            reasons: [],
            warnings: [],
            missingData: [],
            calculatedAt: new Date().toISOString(),
          };
        }
      })
    );

    res.json({ ok: true, results });
  })
);

apiRouter.post(
  '/testTelegramConnection',
  asyncHandler(async (_req, res) => {
    await enforceRateLimit('testTelegramConnection', 10, 3600);
    const result = await telegramService.sendTestMessage();
    res.json(result);
  })
);

apiRouter.post(
  '/runAlertCheck',
  asyncHandler(async (req, res) => {
    await enforceRateLimit('runAlertCheck', 20, 3600);
    const symbol = validateSymbol(req.body?.symbol);
    try {
      const { result, evaluation } = await runAlertCheckForSymbol(symbol);
      res.json({ ok: true, result, evaluation });
    } catch (error) {
      logger.error('run_alert_check_failed', { symbol, message: (error as Error).message });
      res.json({ ok: false, message: 'حدث خطأ غير متوقع أثناء فحص التنبيه.' });
    }
  })
);

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

apiRouter.post(
  '/updateSettings',
  asyncHandler(async (req, res) => {
    await enforceRateLimit('updateSettings', 30, 3600);

    const parsed = SettingsInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw invalidArgument(`بيانات الإعدادات غير صالحة: ${parsed.error.message}`);
    }

    const db = getFirestore();
    await db
      .collection('settings')
      .doc('app')
      .set({ ...parsed.data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    res.json({ ok: true });
  })
);


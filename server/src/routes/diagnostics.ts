import { Router } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { isDevMode, APP_TIMEZONE } from '../config/env';
import { telegramService } from '../services/telegram/TelegramService';
import { sahmkService } from '../services/sahmk/SahmkService';
import { SahmkApiError } from '../services/sahmk/types';
import { getScanTargetSymbols } from '../jobs/scanTargets';
import { refreshQuotes } from '../jobs/refreshQuotes';
import { refreshHistorical } from '../jobs/refreshHistorical';
import { runAlertCheckForSymbol } from '../jobs/runAlertCheck';
import { evaluateAndMaybeSendAlert } from '../alerts/evaluateAlert';
import { InvestmentScoreResult } from '../scoring/investmentScore';
import { recordDiagnosticRun, getDiagnosticsHistory, DiagnosticRun } from '../repo/diagnosticsRepo';

const SERVER_VERSION = '1.0.0'; // مطابق لـ server/package.json - لا مصدر ديناميكي آخر متاح حاليًا
const DIAG_SCRATCH_SYMBOL = 'DIAGTEST'; // رمز وهمي واضح لا يتقاطع مع أي رمز سوق حقيقي (أرقام فقط في SAHMK)

/**
 * صفحة System Diagnostics - كل مسار هنا يختبر خدمة واحدة بشكل مستقل تمامًا
 * عن بقية النظام (لا يعتمد أي اختبار على وجود فرصة استثمارية حقيقية أو
 * بيانات سوق فعلية). الهدف تشخيصي بحت: معرفة أين بالضبط تتوقف كل خدمة،
 * وليس إضافة أي منطق استثماري جديد.
 */
export const diagnosticsRouter = Router();

// ==================== 1. Telegram Test ====================
diagnosticsRouter.post(
  '/telegram',
  asyncHandler(async (_req, res) => {
    logger.info('diagnostics_telegram_test_started');
    const start = Date.now();

    const text = [
      '✅ Sahmi System Test',
      '',
      `Time: ${new Date().toLocaleString('ar-SA', { timeZone: APP_TIMEZONE() || 'Asia/Riyadh' })}`,
      `Environment: ${isDevMode() ? 'development' : 'production'}`,
      'Server: Render (sahmi-server)',
      `Version: ${SERVER_VERSION}`,
      '',
      'This is a diagnostics message.',
    ].join('\n');

    const sendResult = await telegramService.sendMessage(text);
    const executionTimeMs = Date.now() - start;

    const run: DiagnosticRun = {
      success: sendResult.ok,
      executionTimeMs,
      error: sendResult.error,
      details: { httpStatus: sendResult.httpStatus, telegramResponse: sendResult.rawResponse, messageId: sendResult.messageId },
      timestamp: new Date().toISOString(),
    };
    await recordDiagnosticRun('telegram', run);

    logger.info('diagnostics_telegram_test_completed', { success: sendResult.ok, executionTimeMs });
    res.json({ ok: true, ...run });
  })
);

// ==================== 2. SAHMK Test ====================
diagnosticsRouter.post(
  '/sahmk',
  asyncHandler(async (_req, res) => {
    logger.info('diagnostics_sahmk_test_started');
    const endpoint = '/company/2222/';
    const start = Date.now();

    let success = false;
    let errorMessage: string | undefined;
    let statusCode: number | undefined;
    let errorKind: string | undefined;

    try {
      await sahmkService.getCompany('2222');
      success = true;
      statusCode = 200;
    } catch (err) {
      if (err instanceof SahmkApiError) {
        errorMessage = err.message;
        statusCode = err.status;
        errorKind = err.kind;
      } else {
        errorMessage = (err as Error).message;
      }
    }

    const executionTimeMs = Date.now() - start;
    const run: DiagnosticRun = {
      success,
      executionTimeMs,
      error: errorMessage,
      details: { endpoint, apiReachable: success, statusCode, errorKind },
      timestamp: new Date().toISOString(),
    };
    await recordDiagnosticRun('sahmk', run);

    logger.info('diagnostics_sahmk_test_completed', { success, executionTimeMs });
    res.json({ ok: true, ...run });
  })
);

// ==================== 3. Firestore Test ====================
diagnosticsRouter.post(
  '/firestore',
  asyncHandler(async (_req, res) => {
    logger.info('diagnostics_firestore_test_started');
    const db = getFirestore();
    const ref = db.collection('systemDiagnostics').doc('_firestoreScratch');
    const steps: Record<string, boolean> = { write: false, read: false, update: false, delete: false };
    const start = Date.now();
    let error: string | undefined;

    try {
      await ref.set({ probe: true, createdAt: new Date().toISOString() });
      steps.write = true;

      const snap = await ref.get();
      if (!snap.exists) throw new Error('المستند غير موجود بعد الكتابة مباشرة');
      steps.read = true;

      await ref.update({ probe: false, updatedAt: new Date().toISOString() });
      steps.update = true;

      await ref.delete();
      steps.delete = true;
    } catch (err) {
      error = (err as Error).message;
    }

    const executionTimeMs = Date.now() - start;
    const success = steps.write && steps.read && steps.update && steps.delete;

    const run: DiagnosticRun = {
      success,
      executionTimeMs,
      error,
      details: steps,
      timestamp: new Date().toISOString(),
    };
    await recordDiagnosticRun('firestore', run);

    logger.info('diagnostics_firestore_test_completed', { success, executionTimeMs, steps });
    res.json({ ok: true, ...run });
  })
);

// ==================== 4. Scheduler Test (Run Scan Now) ====================
const SCHEDULER_TEST_SAMPLE_SIZE = 5;

diagnosticsRouter.post(
  '/scheduler',
  asyncHandler(async (_req, res) => {
    logger.info('diagnostics_scheduler_test_started');
    const start = new Date();

    const allSymbols = await getScanTargetSymbols();
    const sample = allSymbols.slice(0, SCHEDULER_TEST_SAMPLE_SIZE);

    const quotesSummary = await refreshQuotes(sample);
    const historicalSummary = await refreshHistorical(sample);

    let alertsCreated = 0;
    let telegramAttempted = 0;
    let errors = 0;
    for (const symbol of sample) {
      try {
        const { evaluation } = await runAlertCheckForSymbol(symbol);
        if (evaluation.tier !== null) alertsCreated += 1;
        if (evaluation.reason.includes('Telegram')) telegramAttempted += 1;
      } catch {
        errors += 1;
      }
    }

    const end = new Date();
    const executionTimeMs = end.getTime() - start.getTime();
    const errorsTotal = quotesSummary.failed + historicalSummary.failed + errors;

    const run: DiagnosticRun = {
      success: errorsTotal === 0,
      executionTimeMs,
      details: {
        startedAt: start.toISOString(),
        finishedAt: end.toISOString(),
        symbolsScanned: sample.length,
        symbolsUpdated: quotesSummary.succeeded,
        errors: errorsTotal,
        alertsCreated,
        telegramMessagesAttempted: telegramAttempted,
        note: `عيّنة تشخيصية من ${SCHEDULER_TEST_SAMPLE_SIZE} رموز فقط (لا يشغّل الفحص الكامل لكل السوق ولا يمس حالة "hasRunToday" الإنتاجية)`,
      },
      timestamp: new Date().toISOString(),
    };
    await recordDiagnosticRun('scheduler', run);

    logger.info('diagnostics_scheduler_test_completed', { success: run.success, executionTimeMs, errorsTotal });
    res.json({ ok: true, ...run });
  })
);

// ==================== 5. Alert Simulation ====================
diagnosticsRouter.post(
  '/alert-simulation',
  asyncHandler(async (_req, res) => {
    logger.info('diagnostics_alert_simulation_started');
    const start = Date.now();

    // سهم وهمي بالكامل بالذاكرة فقط - لا SAHMK ولا Investment Score حقيقي
    const fakeResult: InvestmentScoreResult = {
      symbol: DIAG_SCRATCH_SYMBOL,
      excluded: false,
      totalScore: 95,
      dataCompleteness: 100,
      quality: { score: 35, maxScore: 35, checks: [] },
      valuation: { score: 25, maxScore: 25, checks: [] },
      dividend: { score: 25, maxScore: 25, checks: [] },
      technical: { score: 10, maxScore: 15, checks: [] },
      reasons: ['بيانات محاكاة تشخيصية - ليست سهمًا حقيقيًا'],
      warnings: [],
      missingData: [],
      latestYearProfitable: true,
      hasCriticalFinancialWarning: false,
      calculatedAt: new Date().toISOString(),
    };

    const evaluation = await evaluateAndMaybeSendAlert(fakeResult, undefined, undefined);
    const executionTimeMs = Date.now() - start;

    // تنظيف: حذف أي تنبيه وهمي أُنشئ بهذا الاختبار حتى لا يبقى فعليًا ضمن سجل التنبيهات الحقيقي
    const db = getFirestore();
    const cleanupSnap = await db.collection('alerts').where('symbol', '==', DIAG_SCRATCH_SYMBOL).get();
    await Promise.all(cleanupSnap.docs.map((d) => d.ref.delete()));

    const run: DiagnosticRun = {
      success: evaluation.sent,
      executionTimeMs,
      error: evaluation.sent ? undefined : evaluation.reason,
      details: { tier: evaluation.tier, reason: evaluation.reason, cleanedUpAlertDocs: cleanupSnap.size },
      timestamp: new Date().toISOString(),
    };
    await recordDiagnosticRun('alertSimulation', run);

    logger.info('diagnostics_alert_simulation_completed', { success: evaluation.sent, executionTimeMs, reason: evaluation.reason });
    res.json({ ok: true, ...run });
  })
);

// ==================== 6. Diagnostics History ====================
diagnosticsRouter.post(
  '/history',
  asyncHandler(async (_req, res) => {
    const history = await getDiagnosticsHistory(20);
    res.json({ ok: true, history });
  })
);

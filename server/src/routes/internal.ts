import { Router } from 'express';
import { requireCronSecret } from '../middleware/cronAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { runDailyPriceAndAlertScan } from '../scheduled/dailyPriceAndAlertScan';
import { runWeeklyFinancialsScan } from '../scheduled/weeklyFinancialsScan';
import { runDailyDividendsScan } from '../scheduled/dailyDividendsScan';
import { withJobLock } from '../utils/jobLock';

/**
 * مسارات الجدولة الداخلية - تُستدعى من GitHub Actions (cron) بدل Cloud
 * Scheduler، ومحمية بسر مشترك (X-Cron-Secret) بدل مصادقة المستخدم.
 */
export const internalRouter = Router();
internalRouter.use(requireCronSecret);

/** يحوّل حالتي timeout الجديدتين لنفس شكل رد busy الحالي - حلقة GitHub Actions
 *  تعامله كـ"لسا نشتغل" وتعيد المحاولة، بدون أي تغيير في عقد الاستجابة الأساسي.
 *  timedOut/stillRunning إضافيان للتشخيص فقط. */
function timeoutStatusFields(status: 'timed_out_and_cancelled' | 'timed_out_but_still_running') {
  return { timedOut: true, stillRunning: status === 'timed_out_but_still_running' };
}

internalRouter.post(
  '/daily-scan',
  asyncHandler(async (_req, res) => {
    const outcome = await withJobLock('dailyPriceAndAlertScan', (signal) => runDailyPriceAndAlertScan(signal));
    if (outcome.status === 'busy') {
      res.json({ ok: true, ranToday: false, done: false, active: true, busy: true });
      return;
    }
    if (outcome.status === 'timed_out_and_cancelled' || outcome.status === 'timed_out_but_still_running') {
      res.json({ ok: true, ranToday: false, done: false, active: true, busy: true, ...timeoutStatusFields(outcome.status) });
      return;
    }
    res.json({ ok: true, ...outcome.result });
  })
);

internalRouter.post(
  '/weekly-financials',
  asyncHandler(async (_req, res) => {
    const outcome = await withJobLock('weeklyFinancialsScan', (signal) => runWeeklyFinancialsScan(signal));
    if (outcome.status === 'busy') {
      res.json({ ok: true, done: false, busy: true });
      return;
    }
    if (outcome.status === 'timed_out_and_cancelled' || outcome.status === 'timed_out_but_still_running') {
      res.json({ ok: true, done: false, busy: true, ...timeoutStatusFields(outcome.status) });
      return;
    }
    res.json({ ok: true, ...outcome.result });
  })
);

internalRouter.post(
  '/daily-dividends',
  asyncHandler(async (_req, res) => {
    const outcome = await withJobLock('dailyDividendsScan', (signal) => runDailyDividendsScan(signal));
    if (outcome.status === 'busy') {
      res.json({ ok: true, done: false, busy: true });
      return;
    }
    if (outcome.status === 'timed_out_and_cancelled' || outcome.status === 'timed_out_but_still_running') {
      res.json({ ok: true, done: false, busy: true, ...timeoutStatusFields(outcome.status) });
      return;
    }
    res.json({ ok: true, ...outcome.result });
  })
);

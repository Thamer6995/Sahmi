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

internalRouter.post(
  '/daily-scan',
  asyncHandler(async (_req, res) => {
    const outcome = await withJobLock('dailyPriceAndAlertScan', runDailyPriceAndAlertScan);
    if (outcome.busy) {
      res.json({ ok: true, ranToday: false, done: false, active: true, busy: true });
      return;
    }
    res.json({ ok: true, ...outcome.result });
  })
);

internalRouter.post(
  '/weekly-financials',
  asyncHandler(async (_req, res) => {
    const outcome = await withJobLock('weeklyFinancialsScan', runWeeklyFinancialsScan);
    if (outcome.busy) {
      res.json({ ok: true, done: false, busy: true });
      return;
    }
    res.json({ ok: true, ...outcome.result });
  })
);

internalRouter.post(
  '/daily-dividends',
  asyncHandler(async (_req, res) => {
    const outcome = await withJobLock('dailyDividendsScan', runDailyDividendsScan);
    if (outcome.busy) {
      res.json({ ok: true, done: false, busy: true });
      return;
    }
    res.json({ ok: true, ...outcome.result });
  })
);

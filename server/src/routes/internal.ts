import { Router } from 'express';
import { requireCronSecret } from '../middleware/cronAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { runDailyPriceAndAlertScan } from '../scheduled/dailyPriceAndAlertScan';
import { runWeeklyFinancialsScan } from '../scheduled/weeklyFinancialsScan';
import { runDailyDividendsScan } from '../scheduled/dailyDividendsScan';

/**
 * مسارات الجدولة الداخلية - تُستدعى من GitHub Actions (cron) بدل Cloud
 * Scheduler، ومحمية بسر مشترك (X-Cron-Secret) بدل مصادقة المستخدم.
 */
export const internalRouter = Router();
internalRouter.use(requireCronSecret);

internalRouter.post(
  '/daily-scan',
  asyncHandler(async (_req, res) => {
    const result = await runDailyPriceAndAlertScan();
    res.json({ ok: true, ...result });
  })
);

internalRouter.post(
  '/weekly-financials',
  asyncHandler(async (_req, res) => {
    const result = await runWeeklyFinancialsScan();
    res.json({ ok: true, ...result });
  })
);

internalRouter.post(
  '/daily-dividends',
  asyncHandler(async (_req, res) => {
    const result = await runDailyDividendsScan();
    res.json({ ok: true, ...result });
  })
);

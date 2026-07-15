import { initializeApp } from 'firebase-admin/app';

initializeApp();

// ---- المرحلة 1: دوال الاختبار والفحص ----
export { testCompanyFetch } from './https/testCompanyFetch';
export { getDevRawResponses } from './https/devRawResponses';
export { healthCheck } from './https/healthCheck';

// ---- المرحلة 2: الشركات + Bulk Quotes ----
export { manualRefreshCompanies } from './https/manualRefreshCompanies';
export { manualRefreshQuotes } from './https/manualRefreshQuotes';

// ---- المرحلة 3: القوائم المالية + النسب + التوزيعات ----
export { manualRefreshFinancials } from './https/manualRefreshFinancials';
export { manualRefreshDividends } from './https/manualRefreshDividends';

// ---- المرحلة 4: OHLCV والمؤشرات الفنية ----
export { manualRefreshHistorical } from './https/manualRefreshHistorical';
export { computeTechnicalIndicators } from './https/computeTechnicalIndicators';

// ---- المرحلة 5: نظام Investment Score ----
export { computeInvestmentScoreBatch } from './https/computeInvestmentScore';

// ---- المرحلة 6: Telegram والتنبيهات ----
export { testTelegramConnection } from './https/testTelegramConnection';
export { runAlertCheck } from './https/runAlertCheck';

// ---- المرحلة 7: الإعدادات ----
export { updateSettings } from './https/updateSettings';

// ---- المرحلة 8: الجدولة ----
export { dailyPriceAndAlertScan } from './scheduled/dailyPriceAndAlertScan';
export { weeklyFinancialsScan } from './scheduled/weeklyFinancialsScan';
export { dailyDividendsScan } from './scheduled/dailyDividendsScan';
// - المرحلة 6: sendTelegramAlerts, testTelegramConnection
// - المرحلة 8: الجدولة scheduled functions

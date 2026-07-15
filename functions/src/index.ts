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

// سيتم إضافة دوال المراحل القادمة هنا تباعًا:
// - المرحلة 4: refreshHistorical
// - المرحلة 5: runScoring
// - المرحلة 6: sendTelegramAlerts, testTelegramConnection
// - المرحلة 8: الجدولة scheduled functions

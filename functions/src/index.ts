import { initializeApp } from 'firebase-admin/app';

initializeApp();

// ---- المرحلة 1: دوال الاختبار والفحص ----
export { testCompanyFetch } from './https/testCompanyFetch';
export { getDevRawResponses } from './https/devRawResponses';
export { healthCheck } from './https/healthCheck';

// سيتم إضافة دوال المراحل القادمة هنا تباعًا:
// - المرحلة 2: refreshCompaniesAndQuotes (يدوي + مجدول)
// - المرحلة 3: refreshFinancials, refreshDividends
// - المرحلة 4: refreshHistorical
// - المرحلة 5: runScoring
// - المرحلة 6: sendTelegramAlerts, testTelegramConnection
// - المرحلة 8: الجدولة scheduled functions

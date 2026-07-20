import { sahmkService } from '../services/sahmk/SahmkService';
import { normalizeFinancials, normalizeRatios, normalizeCompany, extractCompanyFundamentals } from '../services/sahmk/mappers';
import { upsertFinancials } from '../repo/financialsRepo';
import { upsertRatios } from '../repo/ratiosRepo';
import { getAllCompanySymbols, updateCompanySector } from '../repo/companiesRepo';
import { runBatched, BatchRunSummary } from '../utils/batchRunner';
import { logger } from '../utils/logger';

// أقل من باقي المهام (5) لأن كل رمز هنا يستدعي حتى 3 طلبات SAHMK متتالية
// (financials + ratios + company) - تزامن أعلى أدى فعليًا إلى throttling
// متكرر (429) أثناء تحديث شامل لكامل السوق (مؤكَّد من سجلات Render فعلية).
const CONCURRENCY = 3;

/**
 * يحدّث القوائم المالية والنسب لكل رمز على حدة. الاثنان (financials و
 * ratios) يُجلبان بشكل مستقل لكل سهم: فشل أحدهما لا يمنع حفظ الآخر (مثلاً
 * إن كانت /analytics/ratios/ غير متاحة مؤقتًا لكن /financials/ نجحت).
 * فشل الاثنين معًا لسهم واحد يُسجَّل كفشل لهذا السهم فقط دون إيقاف الباقي.
 */
export async function refreshFinancialsAndRatios(symbols?: string[], signal?: AbortSignal): Promise<BatchRunSummary> {
  const targetSymbols = symbols && symbols.length > 0 ? symbols : await getAllCompanySymbols();

  return runBatched(
    'refreshFinancialsAndRatios',
    targetSymbols,
    (symbol) => symbol,
    async (symbol, itemSignal) => {
      const partialErrors: string[] = [];

      try {
        const financialsRaw = await sahmkService.getFinancials(symbol, {}, itemSignal);
        if (itemSignal?.aborted) return;
        const periods = normalizeFinancials(symbol, financialsRaw);
        await upsertFinancials(periods);
      } catch (err) {
        partialErrors.push(`financials: ${(err as Error).message}`);
      }

      if (itemSignal?.aborted) return; // لا نبدأ طلب ratios جديدًا بعد الإلغاء

      try {
        const ratiosRaw = await sahmkService.getRatios(symbol, itemSignal);
        const ratios = normalizeRatios(symbol, ratiosRaw);

        // P/E وP/B غير متوفرين في /analytics/ratios/ إطلاقًا (مؤكَّد من raw
        // response فعلي) - مصدرهما fundamentals ضمن /company/{symbol}/.
        // فشل هذا الاستدعاء الإضافي لا يمنع حفظ بقية النسب. نفس الاستدعاء
        // نستغله أيضًا لتحديث القطاع/السوق في مجموعة companies، لأن
        // endpoint الجملة /companies/ لا يرجع sector_name/sector_name_ar
        // إطلاقًا (مؤكَّد من raw response فعلي) - وبدون قطاع صحيح لا يمكن
        // استبعاد الشركات المالية (بنوك/تأمين) من التقييم كما يتطلب التصميم.
        try {
          const companyRaw = await sahmkService.getCompany(symbol, itemSignal);
          const { pe, pb, eps } = extractCompanyFundamentals(companyRaw);
          ratios.pe = ratios.pe ?? pe;
          ratios.pb = ratios.pb ?? pb;
          if (eps !== undefined) ratios.rawMetrics.eps = eps;

          const company = normalizeCompany(companyRaw);
          if (company && !itemSignal?.aborted) {
            await updateCompanySector(symbol, {
              sector: company.sector,
              industry: company.industry,
              market: company.market,
            });
          }
        } catch (err) {
          logger.warn('refresh_ratios_company_fundamentals_failed', { symbol, message: (err as Error).message });
        }

        if (itemSignal?.aborted) return; // لا نكتب النسب بعد الإلغاء

        await upsertRatios(ratios);
      } catch (err) {
        partialErrors.push(`ratios: ${(err as Error).message}`);
      }

      if (partialErrors.length === 2) {
        throw new Error(partialErrors.join(' | '));
      }
      if (partialErrors.length === 1) {
        logger.warn('refresh_financials_partial_failure', { symbol, error: partialErrors[0] });
      }
    },
    CONCURRENCY,
    signal
  );
}

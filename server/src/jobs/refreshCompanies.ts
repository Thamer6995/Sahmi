import { sahmkService } from '../services/sahmk/SahmkService';
import { normalizeCompany } from '../services/sahmk/mappers';
import { upsertCompanies } from '../repo/companiesRepo';
import { logger } from '../utils/logger';

export interface RefreshCompaniesResult {
  fetched: number;
  upserted: number;
  skipped: number;
}

/**
 * يجلب دليل الشركات كاملًا من SAHMK (مع Pagination) ويخزّنه في Firestore.
 * يُستدعى يدويًا الآن (زر تحديث)، وسيُربط بجدولة أسبوعية في المرحلة 8
 * (دليل الشركات نادرًا ما يتغير خلافًا للأسعار).
 */
export async function refreshCompanies(signal?: AbortSignal): Promise<RefreshCompaniesResult> {
  const rawCompanies = await sahmkService.getAllCompanies(100, signal);

  if (signal?.aborted) {
    logger.warn('refresh_companies_aborted');
    return { fetched: rawCompanies.length, upserted: 0, skipped: 0 };
  }

  const normalized = rawCompanies.map(normalizeCompany);
  const valid = normalized.filter((c): c is NonNullable<typeof c> => c !== null);
  const skipped = normalized.length - valid.length;

  if (skipped > 0) {
    logger.warn('refresh_companies_skipped_invalid', { skipped });
  }

  await upsertCompanies(valid);

  const result: RefreshCompaniesResult = { fetched: rawCompanies.length, upserted: valid.length, skipped };
  logger.info('refresh_companies_completed', { ...result });
  return result;
}

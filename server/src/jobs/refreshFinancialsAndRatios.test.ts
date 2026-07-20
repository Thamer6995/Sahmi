jest.mock('../services/sahmk/SahmkService', () => ({
  sahmkService: {
    getFinancials: jest.fn(),
    getRatios: jest.fn(),
    getCompany: jest.fn(),
  },
}));

jest.mock('../services/sahmk/mappers', () => ({
  normalizeFinancials: jest.fn((symbol: string) => [{ symbol, period: '2025-Q4', periodType: 'quarterly', rawMetrics: {} }]),
  normalizeRatios: jest.fn((symbol: string) => ({ symbol, rawMetrics: {} })),
  normalizeCompany: jest.fn(() => undefined),
  extractCompanyFundamentals: jest.fn(() => ({})),
}));

jest.mock('../repo/financialsRepo', () => ({ upsertFinancials: jest.fn() }));
jest.mock('../repo/ratiosRepo', () => ({ upsertRatios: jest.fn() }));
jest.mock('../repo/companiesRepo', () => ({
  getAllCompanySymbols: jest.fn(),
  updateCompanySector: jest.fn(),
}));

import { sahmkService } from '../services/sahmk/SahmkService';
import { upsertFinancials } from '../repo/financialsRepo';
import { upsertRatios } from '../repo/ratiosRepo';
import { refreshFinancialsAndRatios } from './refreshFinancialsAndRatios';

const mockGetFinancials = sahmkService.getFinancials as jest.Mock;
const mockGetRatios = sahmkService.getRatios as jest.Mock;
const mockGetCompany = sahmkService.getCompany as jest.Mock;
const mockUpsertFinancials = upsertFinancials as jest.Mock;
const mockUpsertRatios = upsertRatios as jest.Mock;

describe('refreshFinancialsAndRatios - إحصاءات fetched/changed/skipped/failed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFinancials.mockResolvedValue({});
    mockGetRatios.mockResolvedValue({});
    mockGetCompany.mockRejectedValue(new Error('company fundamentals unavailable in test'));
  });

  it('يجمع fetched/changed/skipped بشكل صحيح عبر عدة رموز مختلطة (بعضها تغيّر وبعضها لا)', async () => {
    // رمز A: financials تغيّرت (changed=1)، ratios لم تتغيّر (skipped=1)
    // رمز B: financials وratios كلاهما لم يتغيّرا (skipped=2)
    mockUpsertFinancials.mockImplementation(async (periods: unknown[]) => {
      const symbol = (periods[0] as { symbol: string }).symbol;
      return symbol === 'A' ? { changed: 1, skipped: 0 } : { changed: 0, skipped: 1 };
    });
    mockUpsertRatios.mockImplementation(async () => {
      return { changed: false }; // كلاهما بلا تغيّر في النسب لهذا الاختبار
    });

    const result = await refreshFinancialsAndRatios(['A', 'B']);

    expect(result.stats.fetched).toBe(2); // كلا الرمزين نجح جلب بياناتهما
    expect(result.stats.changed).toBe(1); // financials لرمز A فقط
    expect(result.stats.skipped).toBe(3); // ratios لـ A + financials وratios لـ B
    expect(result.stats.failed).toBe(0);
    expect(result.succeeded).toBe(2);
  });

  it('فشل financials وratios معًا لرمز واحد يُحتسب failed ولا يُحتسب fetched', async () => {
    mockGetFinancials.mockRejectedValue(new Error('financials down'));
    mockGetRatios.mockRejectedValue(new Error('ratios down'));

    const result = await refreshFinancialsAndRatios(['C']);

    expect(result.stats.fetched).toBe(0);
    expect(result.stats.changed).toBe(0);
    expect(result.stats.skipped).toBe(0);
    expect(result.stats.failed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(mockUpsertFinancials).not.toHaveBeenCalled();
    expect(mockUpsertRatios).not.toHaveBeenCalled();
  });

  it('نجاح جزئي (financials فقط) يُحتسب fetched وsucceeded رغم فشل ratios', async () => {
    mockGetRatios.mockRejectedValue(new Error('ratios down'));
    mockUpsertFinancials.mockResolvedValue({ changed: 1, skipped: 0 });

    const result = await refreshFinancialsAndRatios(['D']);

    expect(result.stats.fetched).toBe(1);
    expect(result.stats.changed).toBe(1);
    expect(result.stats.failed).toBe(0);
    expect(result.succeeded).toBe(1);
  });
});

import { getCompany, getAllCompanySymbols } from '../repo/companiesRepo';
import { getQuote } from '../repo/quotesRepo';
import { getAnnualPeriods } from '../repo/financialsRepo';
import { getRatios } from '../repo/ratiosRepo';
import { getDividendsForSymbol } from '../repo/dividendsRepo';
import { getRecentBars } from '../repo/historicalPricesRepo';
import { computeSectorAverages } from '../repo/sectorAveragesRepo';
import { upsertScore } from '../repo/scoresRepo';
import { getSettings } from '../repo/settingsRepo';
import { computeInvestmentScore, InvestmentScoreResult } from '../scoring/investmentScore';
import { runBatched, BatchRunSummary } from '../utils/batchRunner';

/** يحسب Investment Score لسهم واحد من البيانات المخزَّنة فعليًا في Firestore، ويخزّن النتيجة. */
export async function computeScoreForSymbol(symbol: string): Promise<InvestmentScoreResult> {
  const [company, quote, annualFinancials, ratios, dividends, bars, settings] = await Promise.all([
    getCompany(symbol),
    getQuote(symbol),
    getAnnualPeriods(symbol),
    getRatios(symbol),
    getDividendsForSymbol(symbol),
    getRecentBars(symbol, 250),
    getSettings(),
  ]);

  let sectorAvgPE: number | undefined;
  let sectorAvgPB: number | undefined;
  if (company?.sector) {
    const averages = await computeSectorAverages(company.sector, symbol);
    sectorAvgPE = averages.avgPE;
    sectorAvgPB = averages.avgPB;
  }

  const result = computeInvestmentScore({
    symbol,
    sector: company?.sector,
    industry: company?.industry,
    price: quote?.price,
    annualFinancials,
    ratios,
    dividends,
    bars,
    sectorAvgPE,
    sectorAvgPB,
    weights: settings.scoringWeights,
  });

  await upsertScore(result);
  return result;
}

/** يحسب التقييم لكل الشركات (أو قائمة محددة) - يُستخدم بعد كل فحص مجدول (المرحلة 8). */
export async function computeScoresForSymbols(symbols?: string[]): Promise<BatchRunSummary> {
  const targetSymbols = symbols && symbols.length > 0 ? symbols : await getAllCompanySymbols();
  return runBatched(
    'computeScores',
    targetSymbols,
    (symbol) => symbol,
    async (symbol) => {
      await computeScoreForSymbol(symbol);
    },
    10
  );
}

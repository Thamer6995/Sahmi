export interface Company {
  symbol: string;
  nameAr?: string;
  nameEn?: string;
  sector?: string;
  industry?: string;
  market?: string;
}

export interface Quote {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  value?: number;
  quoteDate?: string;
}

export interface ScoreCheck {
  key: string;
  points: number;
  maxPoints: number;
  available: boolean;
  reason?: string;
  warning?: string;
  missingDataNote?: string;
  critical?: boolean;
}

export interface CategoryResult {
  score: number;
  maxScore: number;
  checks: ScoreCheck[];
}

export interface Score {
  symbol: string;
  excluded?: boolean;
  exclusionReason?: string;
  qualityScore?: number;
  valuationScore?: number;
  dividendScore?: number;
  technicalScore?: number;
  totalScore?: number;
  dataCompleteness?: number;
  reasons?: string[];
  warnings?: string[];
  missingData?: string[];
  calculatedAt?: { seconds: number; nanoseconds: number } | null;
}

export interface FinancialPeriod {
  symbol: string;
  period: string;
  periodType: 'annual' | 'quarterly';
  revenue?: number;
  netIncome?: number;
  operatingCashFlow?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  totalDebt?: number;
}

export interface Ratios {
  symbol: string;
  pe?: number;
  pb?: number;
  roe?: number;
  roa?: number;
  debtToEquity?: number;
  profitMargin?: number;
  revenueGrowth?: number;
  netIncomeGrowth?: number;
  dividendYield?: number;
}

export interface Dividend {
  symbol: string;
  announcementDate?: string;
  eligibilityDate?: string;
  distributionDate?: string;
  amountPerShare?: number;
  dividendYield?: number;
  status?: string;
}

export interface Alert {
  id: string;
  symbol: string;
  alertType: '70-79' | '80-89' | '90-100';
  score: number;
  price?: number;
  reasons?: string[];
  sentToTelegram: boolean;
  createdAt?: { seconds: number; nanoseconds: number } | null;
}

export interface WatchlistItem {
  symbol: string;
  notes?: string;
  targetPrice?: number;
  addedAt?: unknown;
}

export interface HistoricalBar {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AppSettings {
  minimumAlertScore: number;
  telegramEnabled: boolean;
  alertCooldownDays: number;
  scoringWeights: { quality: number; valuation: number; dividend: number; technical: number };
  excludedSectors: string[];
  watchlistOnly: boolean;
  scanSchedule: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  minimumAlertScore: 80,
  telegramEnabled: true,
  alertCooldownDays: 7,
  scoringWeights: { quality: 35, valuation: 25, dividend: 25, technical: 15 },
  excludedSectors: [],
  watchlistOnly: false,
  scanSchedule: '17:30',
};

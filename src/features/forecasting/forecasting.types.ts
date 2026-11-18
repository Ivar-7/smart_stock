export type ForecastModelName =
  'holt_winters_seasonal' | 'holt_damped_trend' | 'croston_sba' | 'moving_baseline';

export interface DailyDemandPoint {
  date: string;
  rawTotalUnits: number;
  normalUnits: number;
  bulkUnits: number;
  cleanedBaselineUnits: number;
  isPromoDay: boolean;
  promoTags: string[];
  anomalyType: 'none' | 'spike' | 'drop';
  anomalyScore: number;
  isDampened: boolean;
}

export interface ForecastHorizonPoint {
  date: string;
  predictedUnits: number;
  lower80: number;
  upper80: number;
  lower95: number;
  upper95: number;
}

export interface DetectedAnomaly {
  id: string;
  productId: string;
  productName: string;
  date: string;
  type: 'spike' | 'drop';
  actualNormalUnits: number;
  expectedUnits: number;
  zScore: number;
  isDampened: boolean;
  saleIds: string[];
  explanation: string;
}

export interface BacktestMetrics {
  sampleDays: number;
  wmape: number;
  mae: number;
  bias: number;
  accuracyPercent: number;
}

export interface ProductForecast {
  productId: string;
  modelUsed: ForecastModelName;
  modelLabel: string;
  historyDays: number;
  avgDailyNormalUnits: number;
  avgDailyBulkUnits: number;
  totalBulkUnits90d: number;
  bulkOrderCount90d: number;
  promoLiftMultiplier: number;
  promoDayCount: number;
  projected7dUnits: number;
  projected14dUnits: number;
  projected30dUnits: number;
  trendDirection: 'rising' | 'steady' | 'softening';
  trendPercent30d: number;
  residualStdDev: number;
  history: DailyDemandPoint[];
  horizon30d: ForecastHorizonPoint[];
  anomalies: DetectedAnomaly[];
  backtest: BacktestMetrics;
  plainEnglishSummary: string;
}

export interface ShopForecastOverview {
  forecastsByProductId: Record<string, ProductForecast>;
  overallAccuracyPercent: number;
  totalProjected14dUnits: number;
  totalProjected14dRevenue: number;
  prior14dUnits: number;
  demandGrowthPercent: number;
  totalBulkUnitsSeparated: number;
  totalPromoDaysTagged: number;
  allAnomalies: DetectedAnomaly[];
}

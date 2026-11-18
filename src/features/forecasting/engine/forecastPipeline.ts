import { todayIsoDate } from '../../../shared/utils/date';
import type { Product } from '../../inventory/inventory.types';
import type { SaleRecord } from '../../sales/sales.types';
import type { DetectedAnomaly, ProductForecast, ShopForecastOverview } from '../forecasting.types';
import { runWalkForwardBacktest } from './backtester';
import { selectAndFitForecastModel } from './forecastModels';
import { buildProductPlainEnglishSummary } from './plainEnglish';
import { buildCleanedProductSeries } from './seriesBuilder';
import { mean, safeDiv } from './stats';

export function forecastSingleProduct(
  product: Product,
  productSales: readonly SaleRecord[],
  bulkMultiplierThreshold: number,
  referenceToday: string = todayIsoDate(),
): ProductForecast {
  const built = buildCleanedProductSeries(
    product,
    productSales,
    bulkMultiplierThreshold,
    referenceToday,
  );
  const cleanedSeries = built.points.map((p) => p.cleanedBaselineUnits);
  const dates = built.points.map((p) => p.date);

  const fit = selectAndFitForecastModel(cleanedSeries, dates, 30);
  const backtest = runWalkForwardBacktest(cleanedSeries, dates);

  const recent28 = cleanedSeries.slice(-28);
  const recent14 = cleanedSeries.slice(-14);
  const prior14 = cleanedSeries.slice(-28, -14);
  const avgDailyNormalUnits = Math.round(mean(recent28) * 100) / 100;
  const avgDailyBulkUnits =
    Math.round(safeDiv(built.totalBulkUnits, Math.max(built.points.length, 1)) * 100) / 100;

  const projected7dUnits =
    Math.round(fit.horizon.slice(0, 7).reduce((sum, p) => sum + p.predictedUnits, 0) * 10) / 10;
  const projected14dUnits =
    Math.round(fit.horizon.slice(0, 14).reduce((sum, p) => sum + p.predictedUnits, 0) * 10) / 10;
  const projected30dUnits =
    Math.round(fit.horizon.slice(0, 30).reduce((sum, p) => sum + p.predictedUnits, 0) * 10) / 10;

  const recent14Avg = mean(recent14);
  const prior14Avg = mean(prior14);
  const trendPercent30d =
    prior14Avg > 0.05
      ? Math.round(safeDiv(recent14Avg - prior14Avg, prior14Avg, 0) * 1000) / 10
      : 0;
  const trendDirection =
    trendPercent30d >= 6 ? 'rising' : trendPercent30d <= -6 ? 'softening' : 'steady';

  const partialForecast: Omit<ProductForecast, 'plainEnglishSummary'> = {
    productId: product.id,
    modelUsed: fit.modelUsed,
    modelLabel: fit.modelLabel,
    historyDays: built.points.length,
    avgDailyNormalUnits,
    avgDailyBulkUnits,
    totalBulkUnits90d: Math.round(built.totalBulkUnits * 10) / 10,
    bulkOrderCount90d: built.bulkOrderCount,
    promoLiftMultiplier: built.promoLiftMultiplier,
    promoDayCount: built.promoDayCount,
    projected7dUnits,
    projected14dUnits,
    projected30dUnits,
    trendDirection,
    trendPercent30d,
    residualStdDev: fit.residualStdDev,
    history: built.points,
    horizon30d: fit.horizon,
    anomalies: built.anomalies,
    backtest,
  };

  return {
    ...partialForecast,
    plainEnglishSummary: buildProductPlainEnglishSummary(product, partialForecast),
  };
}

export function computeShopForecastOverview(
  products: readonly Product[],
  sales: readonly SaleRecord[],
  bulkMultiplierThreshold: number,
  referenceToday: string = todayIsoDate(),
): ShopForecastOverview {
  const salesByProduct = new Map<string, SaleRecord[]>();
  for (const sale of sales) {
    const list = salesByProduct.get(sale.productId);
    if (list) {
      list.push(sale);
    } else {
      salesByProduct.set(sale.productId, [sale]);
    }
  }

  const forecastsByProductId: Record<string, ProductForecast> = {};
  const allAnomalies: DetectedAnomaly[] = [];
  let weightedAccuracySum = 0;
  let accuracyWeightSum = 0;
  let totalProjected14dUnits = 0;
  let totalProjected14dRevenue = 0;
  let prior14dUnits = 0;
  let totalBulkUnitsSeparated = 0;
  const promoDateSet = new Set<string>();

  for (const product of products) {
    if (!product.isActive) {
      continue;
    }
    const productSales = salesByProduct.get(product.id) ?? [];
    const forecast = forecastSingleProduct(
      product,
      productSales,
      bulkMultiplierThreshold,
      referenceToday,
    );
    forecastsByProductId[product.id] = forecast;
    allAnomalies.push(...forecast.anomalies);

    const volumeWeight = Math.max(forecast.projected14dUnits, 1);
    weightedAccuracySum += forecast.backtest.accuracyPercent * volumeWeight;
    accuracyWeightSum += volumeWeight;

    totalProjected14dUnits += forecast.projected14dUnits;
    totalProjected14dRevenue += forecast.projected14dUnits * product.sellingPrice;
    prior14dUnits += forecast.history
      .slice(-14)
      .reduce((acc, point) => acc + point.cleanedBaselineUnits, 0);
    totalBulkUnitsSeparated += forecast.totalBulkUnits90d;

    for (const point of forecast.history) {
      if (point.isPromoDay) {
        promoDateSet.add(`${product.id}_${point.date}`);
      }
    }
  }

  allAnomalies.sort((a, b) => b.date.localeCompare(a.date));

  const overallAccuracyPercent =
    accuracyWeightSum > 0 ? Math.round((weightedAccuracySum / accuracyWeightSum) * 10) / 10 : 88;
  const demandGrowthPercent =
    prior14dUnits > 0
      ? Math.round(((totalProjected14dUnits - prior14dUnits) / prior14dUnits) * 1000) / 10
      : 0;

  return {
    forecastsByProductId,
    overallAccuracyPercent,
    totalProjected14dUnits: Math.round(totalProjected14dUnits),
    totalProjected14dRevenue: Math.round(totalProjected14dRevenue * 100) / 100,
    prior14dUnits: Math.round(prior14dUnits),
    demandGrowthPercent,
    totalBulkUnitsSeparated: Math.round(totalBulkUnitsSeparated),
    totalPromoDaysTagged: promoDateSet.size,
    allAnomalies,
  };
}

import { describe, expect, it } from 'vitest';
import { todayIsoDate } from '../../../shared/utils/date';
import { computeAllRestockRecommendations } from '../../restock/engine/restockCalculator';
import { parseAndCleanSalesCsv } from '../../sales/utils/csvCleaner';
import { buildMessySamplePosCsv, buildProductionSeedBundle } from '../../seed/seedDataset';
import { computeShopForecastOverview, forecastSingleProduct } from './forecastPipeline';

describe('Smart Stock Forecasting & Restock Engine', () => {
  const refToday = '2026-11-18';
  const seed = buildProductionSeedBundle(refToday);

  it('generates realistic 90-day multi-SKU seed data and valid forecasts', () => {
    const overview = computeShopForecastOverview(seed.products, seed.sales, 3.5, refToday);

    expect(Object.keys(overview.forecastsByProductId)).toHaveLength(seed.products.length);
    expect(overview.overallAccuracyPercent).toBeGreaterThan(70);
    expect(overview.totalBulkUnitsSeparated).toBeGreaterThanOrEqual(70);
    expect(overview.totalPromoDaysTagged).toBeGreaterThanOrEqual(3);
    expect(overview.allAnomalies.length).toBeGreaterThanOrEqual(2);
  });

  it('separates bulk B2B purchases from everyday Oat Barista retail velocity', () => {
    const oatProduct = seed.products.find((p) => p.id === 'prod-oat-milk')!;
    const oatSales = seed.sales.filter((s) => s.productId === oatProduct.id);
    const forecast = forecastSingleProduct(oatProduct, oatSales, 3.5, refToday);

    expect(forecast.bulkOrderCount90d).toBe(2);
    expect(forecast.totalBulkUnits90d).toBe(48);
    expect(forecast.avgDailyNormalUnits).toBeLessThan(10);
    expect(forecast.modelUsed).toBe('holt_winters_seasonal');
  });

  it('detects positive retail spike on Cold Brew without treating it as bulk', () => {
    const coldBrew = seed.products.find((p) => p.id === 'prod-cold-brew')!;
    const coldBrewSales = seed.sales.filter((s) => s.productId === coldBrew.id);
    const forecast = forecastSingleProduct(coldBrew, coldBrewSales, 3.5, refToday);

    expect(forecast.anomalies.some((a) => a.type === 'spike')).toBe(true);
    expect(forecast.totalBulkUnits90d).toBe(0);
  });

  it('selects Croston SBA for intermittent slow-moving Dishwashing Liquid', () => {
    const dishProduct = seed.products.find((p) => p.id === 'prod-dish-soap')!;
    const dishSales = seed.sales.filter((s) => s.productId === dishProduct.id);
    const forecast = forecastSingleProduct(dishProduct, dishSales, 3.5, refToday);

    expect(forecast.modelUsed).toBe('croston_sba');
    expect(forecast.projected14dUnits).toBeGreaterThan(5);
  });

  it('detects critical stockouts, perishable spoilage risk, healthy majority, and shelf-life order caps', () => {
    const overview = computeShopForecastOverview(seed.products, seed.sales, 3.5, refToday);
    const recs = computeAllRestockRecommendations({
      products: seed.products,
      suppliers: seed.suppliers,
      overview,
      serviceLevelTarget: 0.95,
      defaultReviewCycleDays: 7,
      referenceToday: refToday,
    });

    const milkRec = recs.find((r) => r.productId === 'prod-milk-1l')!;
    const yogurtRec = recs.find((r) => r.productId === 'prod-yogurt-500')!;
    const sourdoughRec = recs.find((r) => r.productId === 'prod-sourdough')!;
    const healthyCount = recs.filter((r) => r.urgency === 'healthy').length;

    expect(milkRec.urgency).toBe('critical');
    expect(milkRec.recommendedOrderQty).toBeGreaterThan(0);
    expect(yogurtRec.spoilageRiskUnits).toBeGreaterThan(0);
    expect(sourdoughRec.cappedByShelfLife).toBe(true);
    expect(healthyCount).toBeGreaterThanOrEqual(8);
  });

  it('cleans messy POS CSV exports against live seeded history cleanly', () => {
    const csv = buildMessySamplePosCsv(refToday);
    const summary = parseAndCleanSalesCsv(csv, seed.products, seed.sales);

    expect(summary.totalRows).toBe(8);
    expect(summary.duplicateCount).toBe(1);
    expect(summary.invalidCount).toBe(3);
    expect(summary.readyCount).toBe(4);
    expect(summary.bulkDetectedCount).toBe(1);
    expect(summary.promoDetectedCount).toBe(1);

    // Confirm today-relative helper also works cleanly
    expect(buildMessySamplePosCsv(todayIsoDate()).length).toBeGreaterThan(50);
  });
});

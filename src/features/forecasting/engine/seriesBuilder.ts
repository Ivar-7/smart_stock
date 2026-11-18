import { addDaysIso, diffDaysIso, rangeIsoDates, todayIsoDate } from '../../../shared/utils/date';
import { pluralizeUnit } from '../../../shared/utils/format';
import type { Product } from '../../inventory/inventory.types';
import type { SaleRecord } from '../../sales/sales.types';
import type { DailyDemandPoint, DetectedAnomaly } from '../forecasting.types';
import { clamp, mean, median, modifiedZScore, safeDiv } from './stats';

export interface BuiltSeriesResult {
  points: DailyDemandPoint[];
  anomalies: DetectedAnomaly[];
  promoLiftMultiplier: number;
  promoDayCount: number;
  totalBulkUnits: number;
  bulkOrderCount: number;
}

interface DayBucket {
  normalUnits: number;
  bulkUnits: number;
  isPromo: boolean;
  promoTags: Set<string>;
  saleIds: string[];
  keepCount: number;
  dampenCount: number;
}

/**
 * Classifies individual sales into normal retail vs. bulk wholesale orders,
 * de-biases promotional lift, and detects unusual daily spikes or drops.
 */
export function buildCleanedProductSeries(
  product: Product,
  productSales: readonly SaleRecord[],
  bulkMultiplierThreshold: number,
  referenceToday: string = todayIsoDate(),
): BuiltSeriesResult {
  const sortedSales = [...productSales].sort((a, b) => a.soldDate.localeCompare(b.soldDate));
  const earliestSaleDate = sortedSales[0]?.soldDate;
  const maxLookbackDate = addDaysIso(referenceToday, -89);
  const startDate =
    earliestSaleDate && earliestSaleDate < maxLookbackDate
      ? earliestSaleDate
      : earliestSaleDate && diffDaysIso(earliestSaleDate, referenceToday) >= 14
        ? earliestSaleDate
        : maxLookbackDate;

  const dates = rangeIsoDates(startDate, referenceToday);
  const buckets = new Map<string, DayBucket>();
  for (const date of dates) {
    buckets.set(date, {
      normalUnits: 0,
      bulkUnits: 0,
      isPromo: false,
      promoTags: new Set(),
      saleIds: [],
      keepCount: 0,
      dampenCount: 0,
    });
  }

  // Transaction-level baseline to auto-separate bulk purchases even if unlabelled
  const nonZeroTxQuantities = sortedSales.map((s) => s.quantity).filter((q) => q > 0);
  const txMedian = nonZeroTxQuantities.length > 0 ? median(nonZeroTxQuantities) : 1;
  const effectiveBulkCutoff = Math.max(
    product.bulkUnitThreshold,
    Math.ceil(txMedian * bulkMultiplierThreshold),
  );

  let totalBulkUnits = 0;
  let bulkOrderCount = 0;

  for (const sale of sortedSales) {
    const bucket = buckets.get(sale.soldDate);
    if (!bucket) {
      continue;
    }

    const txZ = modifiedZScore(sale.quantity, nonZeroTxQuantities);
    const isBulk =
      sale.orderType === 'bulk' ||
      (sale.quantity >= effectiveBulkCutoff && (nonZeroTxQuantities.length < 6 || txZ > 2.8));

    if (isBulk) {
      bucket.bulkUnits += sale.quantity;
      totalBulkUnits += sale.quantity;
      bulkOrderCount += 1;
    } else {
      bucket.normalUnits += sale.quantity;
      bucket.saleIds.push(sale.id);
    }

    if (sale.isPromotion) {
      bucket.isPromo = true;
      if (sale.promoTag) {
        bucket.promoTags.add(sale.promoTag);
      }
    }

    if (sale.anomalyAction === 'keep') {
      bucket.keepCount += 1;
    } else if (sale.anomalyAction === 'dampen') {
      bucket.dampenCount += 1;
    }
  }

  // Estimate promo lift multiplier comparing promo days to non-promo trailing baselines
  const promoValues: number[] = [];
  const nonPromoValues: number[] = [];
  for (const date of dates) {
    const bucket = buckets.get(date);
    if (!bucket) {
      continue;
    }
    if (bucket.isPromo) {
      promoValues.push(bucket.normalUnits);
    } else {
      nonPromoValues.push(bucket.normalUnits);
    }
  }

  let promoLiftMultiplier = 1;
  if (promoValues.length > 0) {
    const nonPromoAvg = mean(nonPromoValues.filter((v) => v > 0));
    const promoAvg = mean(promoValues);
    if (promoValues.length >= 2 && nonPromoAvg > 0) {
      promoLiftMultiplier = clamp(safeDiv(promoAvg, nonPromoAvg, 1.3), 1.05, 2.5);
    } else if (nonPromoAvg > 0 && promoAvg > nonPromoAvg) {
      promoLiftMultiplier = clamp(safeDiv(promoAvg, nonPromoAvg, 1.25), 1.05, 2.2);
    } else {
      promoLiftMultiplier = 1.25;
    }
  }

  // Build de-promoted series first before detecting statistical anomalies
  const dePromotedSeries = dates.map((date) => {
    const bucket = buckets.get(date)!;
    return bucket.isPromo ? bucket.normalUnits / promoLiftMultiplier : bucket.normalUnits;
  });

  const points: DailyDemandPoint[] = [];
  const anomalies: DetectedAnomaly[] = [];

  for (let i = 0; i < dates.length; i += 1) {
    const date = dates[i]!;
    const bucket = buckets.get(date)!;
    const adjustedNormal = dePromotedSeries[i] ?? 0;

    // Rolling window of surrounding days (excluding current day) for robust local baseline
    const windowStart = Math.max(0, i - 14);
    const windowEnd = Math.min(dates.length, i + 7);
    const neighbors: number[] = [];
    for (let j = windowStart; j < windowEnd; j += 1) {
      if (j !== i) {
        neighbors.push(dePromotedSeries[j] ?? 0);
      }
    }

    const localBaseline = neighbors.length >= 4 ? median(neighbors) : median(dePromotedSeries);
    const z = modifiedZScore(adjustedNormal, neighbors.length >= 5 ? neighbors : dePromotedSeries);

    let anomalyType: 'none' | 'spike' | 'drop' = 'none';
    if (
      !bucket.isPromo &&
      z > 3.0 &&
      adjustedNormal > Math.max(localBaseline * 1.85, localBaseline + 4)
    ) {
      anomalyType = 'spike';
    } else if (
      localBaseline >= 3.5 &&
      (z < -2.6 || (adjustedNormal === 0 && mean(neighbors) >= 4.5))
    ) {
      // Avoid flagging leading zero days before first recorded sale
      const hasEarlierSale = sortedSales.some((s) => s.soldDate < date);
      if (hasEarlierSale) {
        anomalyType = 'drop';
      }
    }

    const forceKeep = bucket.keepCount > 0 && bucket.dampenCount === 0;
    const forceDampen = bucket.dampenCount > 0;
    const isDampened =
      forceDampen || (anomalyType !== 'none' && !forceKeep && i < dates.length - 1);

    let cleanedBaselineUnits = adjustedNormal;
    if (isDampened && anomalyType === 'spike') {
      cleanedBaselineUnits = Math.max(localBaseline * 1.25, 1);
    } else if (isDampened && anomalyType === 'drop') {
      cleanedBaselineUnits = Math.max(localBaseline * 0.9, 0.5);
    }

    if (anomalyType !== 'none') {
      const expectedRounded = Math.round(localBaseline * 10) / 10;
      const actualRounded = Math.round(bucket.normalUnits * 10) / 10;
      anomalies.push({
        id: `anomaly_${product.id}_${date}`,
        productId: product.id,
        productName: product.name,
        date,
        type: anomalyType,
        actualNormalUnits: actualRounded,
        expectedUnits: expectedRounded,
        zScore: Math.round(z * 100) / 100,
        isDampened,
        saleIds: bucket.saleIds,
        explanation:
          anomalyType === 'spike'
            ? `Unusual surge: sold ${actualRounded} ${pluralizeUnit(product.unit, actualRounded)} vs ~${expectedRounded} typical daily baseline.`
            : `Unexpected drop: sold ${actualRounded} ${pluralizeUnit(product.unit, actualRounded)} vs ~${expectedRounded} typical daily baseline.`,
      });
    }

    points.push({
      date,
      rawTotalUnits: bucket.normalUnits + bucket.bulkUnits,
      normalUnits: bucket.normalUnits,
      bulkUnits: bucket.bulkUnits,
      cleanedBaselineUnits,
      isPromoDay: bucket.isPromo,
      promoTags: [...bucket.promoTags],
      anomalyType,
      anomalyScore: Math.round(z * 100) / 100,
      isDampened,
    });
  }

  return {
    points,
    anomalies,
    promoLiftMultiplier: Math.round(promoLiftMultiplier * 100) / 100,
    promoDayCount: promoValues.length,
    totalBulkUnits,
    bulkOrderCount,
  };
}

import { addDaysIso, diffDaysIso, todayIsoDate } from '../../../shared/utils/date';
import { pluralizeUnit } from '../../../shared/utils/format';
import type { ProductForecast, ShopForecastOverview } from '../../forecasting/forecasting.types';
import type { Product, Supplier } from '../../inventory/inventory.types';
import type {
  AlertStateRecord,
  RestockRecommendation,
  RestockUrgency,
  ShopAlert,
} from '../restock.types';

function serviceLevelToZ(serviceLevelTarget: number): number {
  if (serviceLevelTarget >= 0.99) return 2.33;
  if (serviceLevelTarget >= 0.97) return 1.88;
  if (serviceLevelTarget >= 0.95) return 1.65;
  if (serviceLevelTarget >= 0.92) return 1.41;
  if (serviceLevelTarget >= 0.9) return 1.28;
  return 1.04;
}

function simulateRunoutDay(
  startingEffectiveStock: number,
  forecast: ProductForecast,
  referenceToday: string,
): { daysUntilStockout: number | null; projectedRunoutDate: string | null } {
  if (startingEffectiveStock <= 0) {
    return { daysUntilStockout: 0, projectedRunoutDate: referenceToday };
  }
  const avgDaily = Math.max(forecast.avgDailyNormalUnits, 0);
  if (avgDaily <= 0.02 && forecast.projected30dUnits <= 0.5) {
    return { daysUntilStockout: null, projectedRunoutDate: null };
  }

  let remaining = startingEffectiveStock;
  for (let i = 0; i < forecast.horizon30d.length; i += 1) {
    const day = forecast.horizon30d[i]!;
    remaining -= Math.max(day.predictedUnits, 0);
    if (remaining <= 0) {
      return {
        daysUntilStockout: i + 1,
        projectedRunoutDate: day.date,
      };
    }
  }

  // Extrapolate smoothly past 30 days using trailing forecast average
  const horizonDailyAvg = forecast.projected30dUnits / 30;
  if (horizonDailyAvg <= 0.05) {
    return { daysUntilStockout: null, projectedRunoutDate: null };
  }
  const extraDays = Math.ceil(remaining / horizonDailyAvg);
  const totalDays = Math.min(365, 30 + extraDays);
  return {
    daysUntilStockout: totalDays,
    projectedRunoutDate: addDaysIso(referenceToday, totalDays),
  };
}

export function computeProductRestockRecommendation(params: {
  product: Product;
  supplier: Supplier | undefined;
  forecast: ProductForecast;
  serviceLevelTarget: number;
  defaultReviewCycleDays: number;
  referenceToday?: string;
}): RestockRecommendation {
  const {
    product,
    supplier,
    forecast,
    serviceLevelTarget,
    defaultReviewCycleDays,
    referenceToday = todayIsoDate(),
  } = params;

  const leadTimeDays = Math.max(1, product.leadTimeDays);
  const zScore = serviceLevelToZ(serviceLevelTarget);

  // Sum seasonal forecast over lead time window
  let leadTimeDemand = 0;
  for (let d = 0; d < leadTimeDays; d += 1) {
    const horizonPoint = forecast.horizon30d[d];
    leadTimeDemand += horizonPoint?.predictedUnits ?? forecast.avgDailyNormalUnits;
  }

  // Lower safety stock cushion slightly for short-life perishables to limit spoilage waste
  const effectiveZ =
    product.isPerishable && (product.shelfLifeDays ?? 30) <= 5 ? Math.min(zScore, 1.28) : zScore;
  const statisticalSafety = effectiveZ * forecast.residualStdDev * Math.sqrt(leadTimeDays);
  const minSafetyFromDays = product.safetyDays * forecast.avgDailyNormalUnits;
  const safetyStockUnits = Math.max(1, Math.round(Math.max(statisticalSafety, minSafetyFromDays)));
  const reorderPoint = Math.max(1, Math.ceil(leadTimeDemand + safetyStockUnits));

  const effectiveStock = Math.max(0, product.currentStock + product.onOrderQty);
  const { daysUntilStockout, projectedRunoutDate } = simulateRunoutDay(
    effectiveStock,
    forecast,
    referenceToday,
  );

  // Perishable expiry & spoilage exposure check
  let daysUntilExpiry: number | null = null;
  let spoilageRiskUnits = 0;
  if (product.isPerishable && product.nearestExpiryDate) {
    daysUntilExpiry = diffDaysIso(referenceToday, product.nearestExpiryDate);
    if (daysUntilExpiry <= 0) {
      spoilageRiskUnits = Math.round(product.currentStock);
    } else {
      let projectedSalesBeforeExpiry = 0;
      for (let d = 0; d < Math.min(daysUntilExpiry, forecast.horizon30d.length); d += 1) {
        projectedSalesBeforeExpiry += forecast.horizon30d[d]?.predictedUnits ?? 0;
      }
      if (daysUntilExpiry > forecast.horizon30d.length) {
        projectedSalesBeforeExpiry +=
          (daysUntilExpiry - forecast.horizon30d.length) * forecast.avgDailyNormalUnits;
      }
      spoilageRiskUnits = Math.max(
        0,
        Math.floor(product.currentStock - projectedSalesBeforeExpiry),
      );
    }
  }

  // Compute ideal order quantity covering lead time + review cycle
  const targetWindowDays = leadTimeDays + defaultReviewCycleDays;
  let targetCycleDemand = 0;
  for (let d = 0; d < targetWindowDays; d += 1) {
    const point = forecast.horizon30d[d];
    targetCycleDemand += point?.predictedUnits ?? forecast.avgDailyNormalUnits;
  }
  const desiredStockCeiling = Math.ceil(targetCycleDemand + safetyStockUnits);

  let rawRecommendedQty = Math.max(0, desiredStockCeiling - effectiveStock);
  let cappedByShelfLife = false;

  if (product.isPerishable && product.shelfLifeDays) {
    // Only order up to ~85% of what sells within one shelf life after delivery arrives
    const safeSellDays = Math.max(1, Math.floor(product.shelfLifeDays * 0.9));
    let demandWithinShelfLife = 0;
    for (let d = 0; d < safeSellDays; d += 1) {
      const idx = Math.min(leadTimeDays + d, forecast.horizon30d.length - 1);
      demandWithinShelfLife +=
        forecast.horizon30d[idx]?.predictedUnits ?? forecast.avgDailyNormalUnits;
    }
    const maxFreshBatch = Math.max(1, Math.floor(demandWithinShelfLife));
    if (rawRecommendedQty > maxFreshBatch) {
      rawRecommendedQty = maxFreshBatch;
      cappedByShelfLife = true;
    }
  }

  // Round to supplier pack size if ordering is actually needed
  let recommendedOrderQty = 0;
  if (effectiveStock <= reorderPoint && rawRecommendedQty > 0) {
    const pack = Math.max(1, product.packSize);
    recommendedOrderQty = Math.ceil(rawRecommendedQty / pack) * pack;
    if (
      product.isPerishable &&
      product.shelfLifeDays &&
      recommendedOrderQty > rawRecommendedQty + pack &&
      rawRecommendedQty >= pack
    ) {
      recommendedOrderQty = Math.floor(rawRecommendedQty / pack) * pack;
    }
  }

  let urgency: RestockUrgency = 'healthy';
  if (
    product.currentStock <= 0 ||
    (daysUntilStockout !== null && daysUntilStockout <= leadTimeDays)
  ) {
    urgency = 'critical';
  } else if (
    effectiveStock <= reorderPoint ||
    (daysUntilStockout !== null && daysUntilStockout <= leadTimeDays + 4) ||
    spoilageRiskUnits >= 3
  ) {
    urgency = 'warning';
  } else if (
    product.isPerishable &&
    spoilageRiskUnits > 0 &&
    product.currentStock > reorderPoint * 1.5
  ) {
    urgency = 'overstocked';
  }

  let plainEnglishAction: string;
  if (urgency === 'critical') {
    const orderQty = Math.max(recommendedOrderQty, product.packSize);
    plainEnglishAction =
      product.currentStock <= 0
        ? `Out of stock now. Order ${orderQty} ${pluralizeUnit(product.unit, orderQty)} immediately.`
        : `Runs out in ${daysUntilStockout ?? 0} day${daysUntilStockout === 1 ? '' : 's'}, before a ${leadTimeDays}-day delivery can arrive. Order ${orderQty} ${pluralizeUnit(product.unit, orderQty)} today.`;
  } else if (urgency === 'warning' && spoilageRiskUnits >= 3) {
    plainEnglishAction = `${spoilageRiskUnits} ${pluralizeUnit(product.unit, spoilageRiskUnits)} may expire before selling (${product.nearestExpiryDate ?? 'soon'}). Pause new orders and run a quick markdown.`;
  } else if (urgency === 'warning') {
    const orderQty = Math.max(recommendedOrderQty, product.packSize);
    plainEnglishAction = `Approaching reorder level (${effectiveStock} left vs ${reorderPoint} ROP). Plan to order ${orderQty} ${pluralizeUnit(product.unit, orderQty)} soon.`;
  } else {
    plainEnglishAction =
      daysUntilStockout !== null
        ? `Healthy cover for about ${daysUntilStockout} days at current pace.`
        : 'Stock level is healthy with steady cover.';
  }

  return {
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    category: product.category,
    unit: product.unit,
    supplierId: product.supplierId,
    supplierName: supplier?.name ?? 'Primary Supplier',
    currentStock: product.currentStock,
    onOrderQty: product.onOrderQty,
    effectiveStock,
    leadTimeDays,
    reorderPoint,
    safetyStockUnits,
    daysUntilStockout,
    projectedRunoutDate,
    recommendedOrderQty,
    estimatedOrderCost: Math.round(recommendedOrderQty * product.unitCost * 100) / 100,
    urgency,
    isPerishable: product.isPerishable,
    shelfLifeDays: product.shelfLifeDays,
    nearestExpiryDate: product.nearestExpiryDate,
    daysUntilExpiry,
    spoilageRiskUnits,
    cappedByShelfLife,
    plainEnglishAction,
  };
}

export function computeAllRestockRecommendations(params: {
  products: readonly Product[];
  suppliers: readonly Supplier[];
  overview: ShopForecastOverview;
  serviceLevelTarget: number;
  defaultReviewCycleDays: number;
  referenceToday?: string;
}): RestockRecommendation[] {
  const supplierById = new Map<string, Supplier>();
  for (const supplier of params.suppliers) {
    supplierById.set(supplier.id, supplier);
  }

  const recommendations: RestockRecommendation[] = [];
  for (const product of params.products) {
    if (!product.isActive) {
      continue;
    }
    const forecast = params.overview.forecastsByProductId[product.id];
    if (!forecast) {
      continue;
    }
    recommendations.push(
      computeProductRestockRecommendation({
        product,
        supplier: supplierById.get(product.supplierId),
        forecast,
        serviceLevelTarget: params.serviceLevelTarget,
        defaultReviewCycleDays: params.defaultReviewCycleDays,
        referenceToday: params.referenceToday,
      }),
    );
  }

  const rank: Record<RestockUrgency, number> = {
    critical: 0,
    warning: 1,
    overstocked: 2,
    healthy: 3,
  };

  recommendations.sort((a, b) => {
    const rankDiff = rank[a.urgency] - rank[b.urgency];
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999);
  });

  return recommendations;
}

export function buildShopAlerts(params: {
  recommendations: readonly RestockRecommendation[];
  overview: ShopForecastOverview;
  alertStates: readonly AlertStateRecord[];
  referenceToday?: string;
}): ShopAlert[] {
  const referenceToday = params.referenceToday ?? todayIsoDate();
  const stateMap = new Map<string, AlertStateRecord>();
  for (const record of params.alertStates) {
    stateMap.set(record.id, record);
  }

  const resolveState = (id: string): { state: ShopAlert['state']; snoozedUntil: string | null } => {
    const record = stateMap.get(id);
    if (!record) {
      return { state: 'active', snoozedUntil: null };
    }
    if (
      record.status === 'snoozed' &&
      record.snoozedUntil &&
      record.snoozedUntil <= referenceToday
    ) {
      return { state: 'active', snoozedUntil: null };
    }
    return { state: record.status, snoozedUntil: record.snoozedUntil };
  };

  const alerts: ShopAlert[] = [];

  for (const rec of params.recommendations) {
    if (rec.urgency === 'critical') {
      const id = `stockout_${rec.productId}`;
      const { state, snoozedUntil } = resolveState(id);
      alerts.push({
        id,
        kind: 'stockout',
        severity: 'critical',
        productId: rec.productId,
        productName: rec.productName,
        title:
          rec.currentStock <= 0
            ? `${rec.productName} is out of stock`
            : `${rec.productName} runs out in ${rec.daysUntilStockout ?? 0}d`,
        message: rec.plainEnglishAction,
        actionLabel: `Order ${rec.recommendedOrderQty || 1} ${rec.unit}`,
        recommendedQty: rec.recommendedOrderQty || 1,
        createdDate: referenceToday,
        state,
        snoozedUntil,
      });
    } else if (rec.urgency === 'warning' && rec.recommendedOrderQty > 0) {
      const id = `reorder_${rec.productId}`;
      const { state, snoozedUntil } = resolveState(id);
      alerts.push({
        id,
        kind: 'reorder_soon',
        severity: 'warning',
        productId: rec.productId,
        productName: rec.productName,
        title: `Reorder soon: ${rec.productName}`,
        message: rec.plainEnglishAction,
        actionLabel: `Order ${rec.recommendedOrderQty} ${rec.unit}`,
        recommendedQty: rec.recommendedOrderQty,
        createdDate: referenceToday,
        state,
        snoozedUntil,
      });
    }

    if (rec.spoilageRiskUnits > 0) {
      const id = `expiry_${rec.productId}`;
      const { state, snoozedUntil } = resolveState(id);
      alerts.push({
        id,
        kind: 'expiry_risk',
        severity: rec.daysUntilExpiry !== null && rec.daysUntilExpiry <= 2 ? 'critical' : 'warning',
        productId: rec.productId,
        productName: rec.productName,
        title: `${rec.spoilageRiskUnits} ${pluralizeUnit(rec.unit, rec.spoilageRiskUnits)} of ${rec.productName} risk expiring`,
        message: `Batch expires ${rec.nearestExpiryDate ?? 'soon'}. Current pace won't clear all ${rec.currentStock} ${pluralizeUnit(rec.unit, rec.currentStock)} in time — consider a store promo.`,
        actionLabel: 'Review stock',
        recommendedQty: null,
        createdDate: referenceToday,
        state,
        snoozedUntil,
      });
    }
  }

  // Include recent 21-day demand anomalies
  const cutoffDate = addDaysIso(referenceToday, -21);
  for (const anomaly of params.overview.allAnomalies) {
    if (anomaly.date < cutoffDate) {
      continue;
    }
    const id = anomaly.id;
    const { state, snoozedUntil } = resolveState(id);
    alerts.push({
      id,
      kind: 'anomaly',
      severity: 'info',
      productId: anomaly.productId,
      productName: anomaly.productName,
      title: `${anomaly.type === 'spike' ? 'Demand spike' : 'Demand drop'} on ${anomaly.productName}`,
      message: `${anomaly.date}: ${anomaly.explanation} ${anomaly.isDampened ? 'Dampened automatically in baseline forecast.' : 'Kept in baseline.'}`,
      actionLabel: 'Inspect forecast',
      recommendedQty: null,
      createdDate: anomaly.date,
      state,
      snoozedUntil,
    });
  }

  const severityRank: Record<ShopAlert['severity'], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  return alerts;
}

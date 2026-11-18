import { pluralizeUnit } from '../../../shared/utils/format';
import type { Product } from '../../inventory/inventory.types';
import type { RestockRecommendation } from '../../restock/restock.types';
import type { ProductForecast } from '../forecasting.types';

export function buildProductPlainEnglishSummary(
  product: Product,
  forecast: Omit<ProductForecast, 'plainEnglishSummary'>,
): string {
  const dailyText =
    forecast.avgDailyNormalUnits >= 1
      ? `about ${forecast.avgDailyNormalUnits.toFixed(1)} ${pluralizeUnit(product.unit, forecast.avgDailyNormalUnits)} a day`
      : `about ${(forecast.avgDailyNormalUnits * 7).toFixed(1)} ${pluralizeUnit(product.unit, forecast.avgDailyNormalUnits * 7)} a week`;

  const trendPhrase =
    forecast.trendDirection === 'rising'
      ? `Demand is rising (+${Math.abs(forecast.trendPercent30d).toFixed(0)}% pace).`
      : forecast.trendDirection === 'softening'
        ? `Demand has cooled slightly (${forecast.trendPercent30d.toFixed(0)}% pace).`
        : 'Everyday retail demand is steady.';

  const extras: string[] = [];
  if (forecast.bulkOrderCount90d > 0) {
    extras.push(
      `${forecast.bulkOrderCount90d} bulk order${forecast.bulkOrderCount90d === 1 ? '' : 's'} (${Math.round(forecast.totalBulkUnits90d)} units) were set aside so one-off wholesale buys do not inflate daily shelf forecasts.`,
    );
  }
  if (forecast.promoDayCount > 0 && forecast.promoLiftMultiplier > 1.05) {
    const liftPct = Math.round((forecast.promoLiftMultiplier - 1) * 100);
    extras.push(
      `Past promotions lifted sales by +${liftPct}%, which was adjusted out of the baseline.`,
    );
  }
  if (product.isPerishable && product.shelfLifeDays) {
    extras.push(
      `Shelf life is ${product.shelfLifeDays} days, so order caps protect against spoilage.`,
    );
  }

  return `Regular shoppers buy ${dailyText}. ${trendPhrase} ${extras.join(' ')}`.trim();
}

export function buildShopBriefingLines(params: {
  recommendations: readonly RestockRecommendation[];
  totalBulkSeparated: number;
  totalPromoDays: number;
  anomalyCount: number;
}): string[] {
  const lines: string[] = [];
  const critical = params.recommendations.filter((r) => r.urgency === 'critical');
  const warning = params.recommendations.filter((r) => r.urgency === 'warning');
  const expiryItems = params.recommendations.filter((r) => r.spoilageRiskUnits > 0);

  if (critical.length > 0) {
    const top = critical[0]!;
    const more =
      critical.length > 1
        ? ` and ${critical.length - 1} more urgent SKU${critical.length > 2 ? 's' : ''}`
        : '';
    lines.push(
      `Order ${top.recommendedOrderQty} ${pluralizeUnit(top.unit, top.recommendedOrderQty)} of ${top.productName} today${more} — current stock will run dry before the supplier's ${top.leadTimeDays}-day delivery arrives.`,
    );
  } else if (warning.length > 0) {
    const top = warning[0]!;
    lines.push(
      `${warning.length} item${warning.length === 1 ? ' is' : 's are'} approaching reorder threshold, led by ${top.productName} (${top.daysUntilStockout ?? 0} days left).`,
    );
  } else {
    lines.push(
      'All core shelf items are comfortably stocked above their supplier lead-time buffers.',
    );
  }

  if (expiryItems.length > 0) {
    const first = expiryItems[0]!;
    lines.push(
      `Watch ${first.spoilageRiskUnits} ${pluralizeUnit(first.unit, first.spoilageRiskUnits)} of ${first.productName} projected to outlast its ${first.nearestExpiryDate ?? 'upcoming'} expiry window — consider a short-term markdown.`,
    );
  }

  if (params.totalBulkSeparated > 0 || params.totalPromoDays > 0) {
    lines.push(
      `Data hygiene separated ${Math.round(params.totalBulkSeparated)} bulk wholesale units and ${params.totalPromoDays} promotional sales days from baseline velocity${params.anomalyCount > 0 ? `, plus flagged ${params.anomalyCount} unusual spike/drop days` : ''}.`,
    );
  }

  return lines;
}

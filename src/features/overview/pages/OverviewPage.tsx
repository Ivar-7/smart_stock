import { Boxes, Plus, Sparkles, Upload } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DonutChart, type DonutSegment } from '../../../shared/charts/DonutChart';
import { ForecastAreaChart, type DualSeriesPoint } from '../../../shared/charts/ForecastAreaChart';
import { GroupedBarChart, type GroupedBarBucket } from '../../../shared/charts/GroupedBarChart';
import { RadialGauge } from '../../../shared/charts/RadialGauge';
import { Button } from '../../../shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../../shared/ui/StateViews';
import { addDaysIso, formatShortDate, todayIsoDate } from '../../../shared/utils/date';
import { formatCurrency, formatNumber } from '../../../shared/utils/format';
import { buildShopBriefingLines } from '../../forecasting/engine/plainEnglish';
import { useShopData } from '../../settings/useShopData';
import { KpiSparkCard } from '../components/KpiSparkCard';
import { OverviewBriefingAndQueue } from '../components/OverviewBriefingAndQueue';

export function OverviewPage() {
  const {
    profile,
    products,
    sales,
    forecastOverview,
    recommendations,
    isLoading,
    isSeeding,
    seedStatusMessage,
    error,
    runSeedSampleShop,
    retrySync,
  } = useShopData();

  const referenceToday = todayIsoDate();
  const currency = profile?.currency ?? 'USD';

  // Build 4 top-level gauge percentages matching the visual composition of Reference Image 2
  const gaugeMetrics = useMemo(() => {
    const activeProducts = products.filter((p) => p.isActive);
    const totalActive = Math.max(activeProducts.length, 1);

    const healthySkus = recommendations.filter((r) => r.urgency === 'healthy').length;
    const stockHealthPct = Math.round((healthySkus / totalActive) * 100);

    const perishableProducts = recommendations.filter((r) => r.isPerishable);
    const totalPerishableUnits = perishableProducts.reduce((s, r) => s + r.currentStock, 0);
    const atRiskUnits = perishableProducts.reduce((s, r) => s + r.spoilageRiskUnits, 0);
    const shelfLifeSafePct =
      totalPerishableUnits > 0
        ? Math.round(Math.max(0, 1 - atRiskUnits / totalPerishableUnits) * 100)
        : 100;

    let covered7dDemand = 0;
    let total7dDemand = 0;
    for (const product of activeProducts) {
      const fc = forecastOverview.forecastsByProductId[product.id];
      if (!fc) continue;
      const demand7d = fc.projected7dUnits;
      total7dDemand += demand7d;
      covered7dDemand += Math.min(demand7d, product.currentStock + product.onOrderQty);
    }
    const readinessPct =
      total7dDemand > 0 ? Math.round((covered7dDemand / total7dDemand) * 100) : 100;

    return {
      stockHealthPct,
      healthySkus,
      totalActive: activeProducts.length,
      accuracyPct: Math.round(forecastOverview.overallAccuracyPercent),
      shelfLifeSafePct,
      atRiskUnits,
      readinessPct,
    };
  }, [products, recommendations, forecastOverview]);

  // Build 28-day actual vs 14-day forecast dual chart series (Reference Image 3 left chart)
  const dualChartData = useMemo(() => {
    const historyDates: string[] = [];
    for (let offset = -27; offset <= 0; offset += 1) {
      historyDates.push(addDaysIso(referenceToday, offset));
    }

    const actualByDate = new Map<string, number>();
    const baselineByDate = new Map<string, number>();
    for (const fc of Object.values(forecastOverview.forecastsByProductId)) {
      for (const pt of fc.history) {
        actualByDate.set(pt.date, (actualByDate.get(pt.date) ?? 0) + pt.normalUnits);
        baselineByDate.set(pt.date, (baselineByDate.get(pt.date) ?? 0) + pt.cleanedBaselineUnits);
      }
    }

    const points: DualSeriesPoint[] = historyDates.map((date) => ({
      label: formatShortDate(date),
      sublabel: date,
      primary: Math.round((actualByDate.get(date) ?? 0) * 10) / 10,
      secondary: Math.round((baselineByDate.get(date) ?? 0) * 10) / 10,
    }));

    // Append 14 days of aggregated forecast horizon
    const splitIndex = points.length - 1;
    const futureTotals = new Map<string, { pred: number; low: number; high: number }>();
    for (const fc of Object.values(forecastOverview.forecastsByProductId)) {
      for (const h of fc.horizon30d.slice(0, 14)) {
        const cur = futureTotals.get(h.date) ?? { pred: 0, low: 0, high: 0 };
        cur.pred += h.predictedUnits;
        cur.low += h.lower80;
        cur.high += h.upper80;
        futureTotals.set(h.date, cur);
      }
    }
    for (const [date, agg] of [...futureTotals.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      points.push({
        label: formatShortDate(date),
        sublabel: `${date} (Forecast)`,
        primary: Math.round(agg.pred * 10) / 10,
        secondary: null,
        bandLow: Math.round(agg.low * 10) / 10,
        bandHigh: Math.round(agg.high * 10) / 10,
      });
    }

    return {
      points,
      splitIndex,
      spark14d: historyDates.slice(-14).map((d) => actualByDate.get(d) ?? 0),
    };
  }, [forecastOverview, referenceToday]);

  // Build 6-week grouped bar buckets: Normal Retail vs Promo Lift vs Bulk Orders (Image 3 right chart)
  const weeklyBarBuckets = useMemo<GroupedBarBucket[]>(() => {
    const buckets: GroupedBarBucket[] = [];
    for (let w = 5; w >= 0; w -= 1) {
      const startIso = addDaysIso(referenceToday, -(w * 7 + 6));
      const endIso = addDaysIso(referenceToday, -(w * 7));
      let normalRetail = 0;
      let promoUnits = 0;
      let bulkUnits = 0;

      for (const sale of sales) {
        if (sale.soldDate >= startIso && sale.soldDate <= endIso) {
          if (sale.orderType === 'bulk') {
            bulkUnits += sale.quantity;
          } else if (sale.isPromotion) {
            promoUnits += sale.quantity;
          } else {
            normalRetail += sale.quantity;
          }
        }
      }

      buckets.push({
        label: formatShortDate(endIso),
        values: [normalRetail, promoUnits, bulkUnits],
      });
    }
    return buckets;
  }, [sales, referenceToday]);

  // Build Category Revenue Forecast Donut breakdown (Image 3 bottom wide card)
  const categoryDonut = useMemo<{
    segments: DonutSegment[];
    totalFormatted: string;
  }>(() => {
    const byCategory = new Map<string, number>();
    for (const product of products) {
      if (!product.isActive) continue;
      const fc = forecastOverview.forecastsByProductId[product.id];
      const projectedRevenue = (fc?.projected14dUnits ?? 0) * product.sellingPrice;
      byCategory.set(product.category, (byCategory.get(product.category) ?? 0) + projectedRevenue);
    }

    const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    const top4 = sorted.slice(0, 4);
    const restSum = sorted.slice(4).reduce((s, [, val]) => s + val, 0);

    const segments: DonutSegment[] = top4.map(([label, val]) => ({
      label,
      value: Math.round(val),
      formattedValue: formatCurrency(val, currency),
    }));
    if (restSum > 0) {
      segments.push({
        label: 'Other Categories',
        value: Math.round(restSum),
        formattedValue: formatCurrency(restSum, currency),
      });
    }

    return {
      segments,
      totalFormatted: formatCurrency(forecastOverview.totalProjected14dRevenue, currency),
    };
  }, [products, forecastOverview, currency]);

  const urgentRecommendations = useMemo(
    () => recommendations.filter((r) => r.urgency === 'critical' || r.urgency === 'warning'),
    [recommendations],
  );

  const totalRestockCost = useMemo(
    () => recommendations.reduce((sum, r) => sum + r.estimatedOrderCost, 0),
    [recommendations],
  );

  const criticalRiskValue = useMemo(
    () =>
      recommendations
        .filter((r) => r.urgency === 'critical')
        .reduce((sum, r) => {
          const prod = products.find((p) => p.id === r.productId);
          const fc = forecastOverview.forecastsByProductId[r.productId];
          const uncovered = Math.max(0, (fc?.projected7dUnits ?? 0) - r.effectiveStock);
          return sum + uncovered * (prod?.sellingPrice ?? 0);
        }, 0),
    [recommendations, products, forecastOverview],
  );

  const briefingLines = useMemo(
    () =>
      buildShopBriefingLines({
        recommendations,
        totalBulkSeparated: forecastOverview.totalBulkUnitsSeparated,
        totalPromoDays: forecastOverview.totalPromoDaysTagged,
        anomalyCount: forecastOverview.allAnomalies.length,
      }),
    [recommendations, forecastOverview],
  );

  if (error) {
    return <ErrorState message={error.userMessage} onRetry={retrySync} />;
  }

  if (isLoading || isSeeding) {
    return (
      <LoadingSkeleton
        rows={5}
        label={seedStatusMessage ?? 'Syncing shop catalog and demand forecasts...'}
      />
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Boxes className="h-5 w-5" />}
        title="Your shop catalog is empty"
        description="Load our realistic 16-product Cornerstone Provisions starter shop with 90 days of POS sales history, or begin adding your own items manually."
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              isLoading={isSeeding}
              onClick={() => void runSeedSampleShop(false)}
              leftIcon={<Sparkles className="h-4 w-4" />}
            >
              Load Sample Shop Data
            </Button>
            <Link to="/inventory">
              <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />}>
                Add First Product
              </Button>
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Editorial Header + Primary Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-ink-muted text-xs font-medium tracking-widest uppercase">
            {(profile?.name ?? 'Cornerstone Provisions').toUpperCase()} · 14-DAY HORIZON
          </p>
          <h1 className="text-ink mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Stock health, at a glance
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/sales">
            <Button variant="secondary" size="sm" leftIcon={<Upload className="h-3.5 w-3.5" />}>
              Import / Log Sales
            </Button>
          </Link>
          <Link to="/restock">
            <Button variant="primary" size="sm">
              Restock Queue ({urgentRecommendations.length})
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Signature Radial Ring Gauges (Reference Image 2) */}
      <Card className="p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
          <RadialGauge
            valuePercent={gaugeMetrics.stockHealthPct}
            ringText="STOCK HEALTH · TARGET 95%"
            label="Healthy SKUs"
            sublabel={`${gaugeMetrics.healthySkus} of ${gaugeMetrics.totalActive} above ROP`}
          />
          <RadialGauge
            valuePercent={gaugeMetrics.accuracyPct}
            ringText="FORECAST ACCURACY · 14D BACKTEST"
            label="Forecast accuracy"
            sublabel={`Walk-forward WMAPE ${(100 - forecastOverview.overallAccuracyPercent).toFixed(1)}%`}
          />
          <RadialGauge
            valuePercent={gaugeMetrics.shelfLifeSafePct}
            ringText="PERISHABLE SAFETY · ZERO WASTE"
            label="Shelf-life safe"
            sublabel={
              gaugeMetrics.atRiskUnits > 0
                ? `${gaugeMetrics.atRiskUnits} units risk expiry`
                : 'Zero spoilage risk projected'
            }
          />
          <RadialGauge
            valuePercent={gaugeMetrics.readinessPct}
            ringText="7-DAY COVERAGE · LEAD BUFFER"
            label="7-day readiness"
            sublabel="On-hand + incoming orders"
          />
        </div>
      </Card>

      {/* 3 KPI Sparkline Cards (Reference Image 3 Top Row) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiSparkCard
          title="Projected 14-day demand"
          value={`${formatNumber(forecastOverview.totalProjected14dUnits)} units`}
          deltaText={`${forecastOverview.demandGrowthPercent >= 0 ? '+' : ''}${forecastOverview.demandGrowthPercent}% vs prior 14d`}
          deltaTone={forecastOverview.demandGrowthPercent >= 0 ? 'positive' : 'negative'}
          sparkValues={dualChartData.spark14d}
        />
        <KpiSparkCard
          title="Recommended restock spend"
          value={formatCurrency(totalRestockCost, currency)}
          deltaText={`${recommendations.filter((r) => r.recommendedOrderQty > 0).length} SKUs due for PO`}
          deltaTone="neutral"
          sparkValues={weeklyBarBuckets.map((b) => b.values[0])}
        />
        <KpiSparkCard
          title="7-day stockout exposure"
          value={formatCurrency(criticalRiskValue, currency)}
          deltaText={
            urgentRecommendations.filter((r) => r.urgency === 'critical').length > 0
              ? `${urgentRecommendations.filter((r) => r.urgency === 'critical').length} urgent SKU alerts`
              : 'No critical stockouts'
          }
          deltaTone={criticalRiskValue > 0 ? 'negative' : 'positive'}
          sparkValues={dualChartData.points.slice(-14).map((p) => p.primary)}
        />
      </div>

      {/* Plain-English Briefing & Priority Watchlist */}
      <OverviewBriefingAndQueue
        briefingLines={briefingLines}
        urgentRecommendations={urgentRecommendations}
      />

      {/* 2-Column Analytical Charts (Reference Image 3 Middle Row) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <div>
              <CardTitle>Demand vs. Baseline Forecast</CardTitle>
              <CardDescription>
                Trailing 28d retail demand &amp; 14d seasonal projection (bulk isolated)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ForecastAreaChart
              points={dualChartData.points}
              primaryLabel="Retail Demand / Forecast"
              secondaryLabel="Cleaned Baseline"
              splitIndex={dualChartData.splitIndex}
              valueUnit="units"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Weekly Demand Mix</CardTitle>
              <CardDescription>
                Normal retail separated from promo lift &amp; bulk B2B
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <GroupedBarChart
              buckets={weeklyBarBuckets}
              seriesLabels={['Normal', 'Promo', 'Bulk']}
              unit="u"
            />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Full-Width Category Breakdown Donut (Reference Image 3 Bottom Card) */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Where the next 14 days of projected revenue come from</CardTitle>
            <CardDescription>Projected retail demand value by product category</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <DonutChart
            segments={categoryDonut.segments}
            centerCaption="14-Day Est."
            centerTotal={categoryDonut.totalFormatted}
          />
        </CardContent>
      </Card>
    </div>
  );
}

import {
  AlertCircle,
  CheckCircle2,
  Layers,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ForecastAreaChart, type DualSeriesPoint } from '../../../shared/charts/ForecastAreaChart';
import { toAppError } from '../../../shared/errors';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { Select } from '../../../shared/ui/FormFields';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../../shared/ui/StateViews';
import { useToast } from '../../../shared/ui/useToast';
import { formatShortDate } from '../../../shared/utils/date';
import { pluralizeUnit } from '../../../shared/utils/format';
import { updateSaleClassification } from '../../sales/sales.api';
import { useShopData } from '../../settings/useShopData';

export function ForecastsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    shopId,
    products,
    sales,
    forecastOverview,
    recommendations,
    isLoading,
    error,
    retrySync,
  } = useShopData();
  const { pushToast } = useToast();

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);
  const paramProductId = searchParams.get('productId');
  const [selectedId, setSelectedId] = useState<string>(paramProductId ?? '');
  const [updatingAnomalyId, setUpdatingAnomalyId] = useState<string | null>(null);

  const resolvedProductId =
    paramProductId && activeProducts.some((p) => p.id === paramProductId)
      ? paramProductId
      : selectedId && activeProducts.some((p) => p.id === selectedId)
        ? selectedId
        : (activeProducts[0]?.id ?? '');

  const selectedProduct = useMemo(
    () => activeProducts.find((p) => p.id === resolvedProductId) ?? null,
    [activeProducts, resolvedProductId],
  );

  const selectedForecast = selectedProduct
    ? (forecastOverview.forecastsByProductId[selectedProduct.id] ?? null)
    : null;

  const selectedRecommendation = selectedProduct
    ? (recommendations.find((r) => r.productId === selectedProduct.id) ?? null)
    : null;

  const chartPoints = useMemo<DualSeriesPoint[]>(() => {
    if (!selectedForecast) {
      return [];
    }
    const recentHistory = selectedForecast.history.slice(-45);
    const historyPts: DualSeriesPoint[] = recentHistory.map((pt) => {
      const marker: DualSeriesPoint['marker'] =
        pt.anomalyType !== 'none'
          ? 'anomaly'
          : pt.bulkUnits > 0
            ? 'bulk'
            : pt.isPromoDay
              ? 'promo'
              : null;
      return {
        label: formatShortDate(pt.date),
        sublabel: pt.date,
        primary: pt.normalUnits,
        secondary: pt.cleanedBaselineUnits,
        marker,
      };
    });

    const horizonPts: DualSeriesPoint[] = selectedForecast.horizon30d.slice(0, 21).map((pt) => ({
      label: formatShortDate(pt.date),
      sublabel: `${pt.date} (Forecast)`,
      primary: pt.predictedUnits,
      secondary: null,
      bandLow: pt.lower80,
      bandHigh: pt.upper80,
    }));

    return [...historyPts, ...horizonPts];
  }, [selectedForecast]);

  const handleSelectProduct = (nextId: string) => {
    setSelectedId(nextId);
    setSearchParams({ productId: nextId });
  };

  const handleToggleAnomalyMode = async (
    anomalyId: string,
    saleIds: readonly string[],
    currentlyDampened: boolean,
  ) => {
    if (saleIds.length === 0) {
      pushToast({
        title: 'Zero-sale outage day',
        description: 'Unexpected zero-sale days are automatically smoothed from trailing days.',
        tone: 'info',
      });
      return;
    }

    setUpdatingAnomalyId(anomalyId);
    try {
      const nextAction = currentlyDampened ? 'keep' : 'dampen';
      await Promise.all(
        saleIds.map((saleId) =>
          updateSaleClassification(shopId, saleId, { anomalyAction: nextAction }),
        ),
      );
      pushToast({
        title: nextAction === 'keep' ? 'Spike kept in forecast' : 'Anomaly dampened',
        description: 'Forecast curve and reorder point updated immediately.',
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Could not update anomaly setting',
        description: toAppError(err).userMessage,
        tone: 'error',
      });
    } finally {
      setUpdatingAnomalyId(null);
    }
  };

  if (error) {
    return <ErrorState message={error.userMessage} onRetry={retrySync} />;
  }

  if (isLoading) {
    return <LoadingSkeleton rows={5} label="Calculating demand models..." />;
  }

  if (!selectedProduct || !selectedForecast) {
    return (
      <EmptyState
        icon={<Layers className="h-5 w-5" />}
        title="No products to forecast yet"
        description="Add products and record sales or load the sample catalog to see adaptive demand forecasts and backtest accuracy."
        action={
          <Link to="/overview">
            <Button variant="primary">Go to Overview</Button>
          </Link>
        }
      />
    );
  }

  const productSalesCount = sales.filter((s) => s.productId === selectedProduct.id).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-ink-muted text-xs font-medium tracking-widest uppercase">
            Forecast Engine · {selectedForecast.modelLabel}
          </p>
          <h1 className="text-ink mt-1 text-2xl font-semibold tracking-tight">
            Demand Forecasts &amp; Accuracy
          </h1>
        </div>
        <div className="w-full sm:w-72">
          <Select
            id="forecast-product-select"
            aria-label="Select product to inspect forecast"
            value={selectedProduct.id}
            onChange={(e) => handleSelectProduct(e.target.value)}
          >
            {activeProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Responsive Split: SKU Selector List on Large Desktop + Deep Dive */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="hidden xl:col-span-4 xl:block">
          <CardHeader>
            <div>
              <CardTitle>Catalog Models</CardTitle>
              <CardDescription>{activeProducts.length} active SKUs analyzed</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="max-h-screen space-y-1.5 overflow-y-auto pr-3">
            {activeProducts.map((product) => {
              const fc = forecastOverview.forecastsByProductId[product.id];
              const isSelected = product.id === selectedProduct.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleSelectProduct(product.id)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-panel-active border-edge-strong text-ink'
                      : 'hover:bg-panel-hover text-ink-secondary border-transparent'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-ink truncate text-sm font-medium">{product.name}</p>
                    <p className="text-ink-muted text-xs">
                      {fc?.avgDailyNormalUnits.toFixed(1) ?? '0'}/day ·{' '}
                      {fc?.modelUsed === 'croston_sba'
                        ? 'Croston SBA'
                        : fc?.modelUsed === 'holt_winters_seasonal'
                          ? 'Seasonal HW'
                          : 'Damped Trend'}
                    </p>
                  </div>
                  <Badge
                    tone={
                      (fc?.backtest.accuracyPercent ?? 0) >= 85
                        ? 'healthy'
                        : (fc?.backtest.accuracyPercent ?? 0) >= 70
                          ? 'neutral'
                          : 'warning'
                    }
                  >
                    {Math.round(fc?.backtest.accuracyPercent ?? 0)}%
                  </Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6 xl:col-span-8">
          {/* Plain-English Product Insight Banner */}
          <Card className="p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-ink text-lg font-semibold">{selectedProduct.name}</h2>
                  <Badge tone="neutral">{selectedForecast.modelLabel}</Badge>
                  {selectedProduct.isPerishable ? (
                    <Badge tone="warning">
                      Perishable · {selectedProduct.shelfLifeDays ?? '?'}d shelf life
                    </Badge>
                  ) : null}
                </div>
                <p className="text-ink-secondary text-sm leading-relaxed">
                  {selectedForecast.plainEnglishSummary}
                </p>
              </div>
              {selectedRecommendation && selectedRecommendation.recommendedOrderQty > 0 ? (
                <Link to="/restock" className="shrink-0">
                  <Button variant="primary" size="sm">
                    Reorder {selectedRecommendation.recommendedOrderQty}{' '}
                    {pluralizeUnit(
                      selectedProduct.unit,
                      selectedRecommendation.recommendedOrderQty,
                    )}
                  </Button>
                </Link>
              ) : null}
            </div>
          </Card>

          {/* SKU Metrics Strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-ink-muted text-xs">Next 14d Forecast</p>
              <p className="text-ink mt-1.5 text-xl font-semibold tabular-nums">
                {selectedForecast.projected14dUnits.toFixed(0)}{' '}
                {pluralizeUnit(
                  selectedProduct.unit,
                  Math.round(selectedForecast.projected14dUnits),
                )}
              </p>
              <p className="text-ink-muted mt-1 flex items-center gap-1 text-xs">
                {selectedForecast.trendDirection === 'rising' ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : selectedForecast.trendDirection === 'softening' ? (
                  <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
                ) : null}
                <span>
                  {selectedForecast.trendPercent30d >= 0 ? '+' : ''}
                  {selectedForecast.trendPercent30d}% trend
                </span>
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-ink-muted text-xs">Backtest Accuracy</p>
              <p className="text-ink mt-1.5 text-xl font-semibold tabular-nums">
                {selectedForecast.backtest.accuracyPercent.toFixed(1)}%
              </p>
              <p className="text-ink-muted mt-1 text-xs tabular-nums">
                MAE {selectedForecast.backtest.mae.toFixed(2)} {selectedProduct.unit}/day
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-ink-muted text-xs">Bulk Orders Isolated</p>
              <p className="text-ink mt-1.5 text-xl font-semibold tabular-nums">
                {selectedForecast.totalBulkUnits90d}{' '}
                {pluralizeUnit(selectedProduct.unit, selectedForecast.totalBulkUnits90d)}
              </p>
              <p className="text-ink-muted mt-1 text-xs">
                Across {selectedForecast.bulkOrderCount90d} B2B order
                {selectedForecast.bulkOrderCount90d === 1 ? '' : 's'}
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-ink-muted text-xs">Promo Lift Adjusted</p>
              <p className="text-ink mt-1.5 text-xl font-semibold tabular-nums">
                +{Math.round((selectedForecast.promoLiftMultiplier - 1) * 100)}%
              </p>
              <p className="text-ink-muted mt-1 text-xs">
                {selectedForecast.promoDayCount} tagged promo day
                {selectedForecast.promoDayCount === 1 ? '' : 's'} · {productSalesCount} records
              </p>
            </Card>
          </div>

          {/* Interactive History + 21-Day Forecast Chart */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>45-Day History &amp; 21-Day Demand Projection</CardTitle>
                <CardDescription>
                  Green dots = promo days · Amber = bulk orders · Red = detected spike/drop
                  anomalies
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ForecastAreaChart
                points={chartPoints}
                primaryLabel="Observed / Forecast"
                secondaryLabel="Cleaned Organic Baseline"
                splitIndex={Math.max(0, chartPoints.length - 22)}
                valueUnit={selectedProduct.unit}
              />
            </CardContent>
          </Card>

          {/* Detected Anomalies Inspector */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="text-ink-secondary h-4 w-4" />
                  <span>Detected Spikes &amp; Drops ({selectedForecast.anomalies.length})</span>
                </CardTitle>
                <CardDescription>
                  Modified Z-Score outlier checks prevent one-off events from skewing reorder points
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {selectedForecast.anomalies.length === 0 ? (
                <div className="bg-panel-subtle border-edge flex items-center gap-3 rounded-xl border p-4 text-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="text-ink-secondary">
                    No unusual sales spikes or unexpected drop-offs were flagged for this SKU in the
                    last 90 days.
                  </span>
                </div>
              ) : (
                <div className="divide-edge divide-y">
                  {selectedForecast.anomalies.map((anomaly) => (
                    <div
                      key={anomaly.id}
                      className="flex flex-col justify-between gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-ink text-sm font-medium">
                            {anomaly.date} ·{' '}
                            {anomaly.type === 'spike' ? 'Unusual Spike' : 'Unexpected Drop'}
                          </span>
                          <Badge tone={anomaly.isDampened ? 'neutral' : 'warning'}>
                            {anomaly.isDampened ? 'Dampened in forecast' : 'Kept in baseline'}
                          </Badge>
                          <span className="text-ink-muted font-mono text-xs">
                            z={anomaly.zScore}
                          </span>
                        </div>
                        <p className="text-ink-muted text-xs">{anomaly.explanation}</p>
                      </div>

                      {anomaly.saleIds.length > 0 ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          isLoading={updatingAnomalyId === anomaly.id}
                          onClick={() =>
                            void handleToggleAnomalyMode(
                              anomaly.id,
                              anomaly.saleIds,
                              anomaly.isDampened,
                            )
                          }
                        >
                          {anomaly.isDampened ? 'Treat as real shift' : 'Dampen outlier'}
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

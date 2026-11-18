import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { RestockRecommendation } from '../../restock/restock.types';
import { createRestockOrder } from '../../restock/restock.api';
import { useShopData } from '../../settings/useShopData';
import { addDaysIso, todayIsoDate } from '../../../shared/utils/date';
import { formatCurrency, pluralizeUnit } from '../../../shared/utils/format';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { useToast } from '../../../shared/ui/useToast';
import { toAppError } from '../../../shared/errors';

export function OverviewBriefingAndQueue({
  briefingLines,
  urgentRecommendations,
}: {
  briefingLines: readonly string[];
  urgentRecommendations: readonly RestockRecommendation[];
}) {
  const { shopId, products, suppliers, profile } = useShopData();
  const { pushToast } = useToast();
  const [orderingId, setOrderingId] = useState<string | null>(null);

  const currency = profile?.currency ?? 'USD';

  const handleQuickOrder = async (rec: RestockRecommendation) => {
    const product = products.find((p) => p.id === rec.productId);
    if (!product || rec.recommendedOrderQty <= 0) {
      return;
    }
    const supplier = suppliers.find((s) => s.id === product.supplierId);
    setOrderingId(rec.productId);
    try {
      await createRestockOrder({
        shopId,
        product,
        supplier,
        quantity: rec.recommendedOrderQty,
        expectedDate: addDaysIso(todayIsoDate(), product.leadTimeDays),
        notes: 'Created from Overview urgent queue',
      });
      pushToast({
        title: `PO created for ${product.name}`,
        description: `Ordered ${rec.recommendedOrderQty} ${product.unit} from ${rec.supplierName}.`,
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Could not place order',
        description: toAppError(err).userMessage,
        tone: 'error',
      });
    } finally {
      setOrderingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-5">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-ink-secondary h-4 w-4" />
              <span>Plain-English Shop Briefing</span>
            </CardTitle>
            <CardDescription>
              Daily summary translated from forecast &amp; expiry checks
            </CardDescription>
          </div>
          <Link to="/forecasts" className="text-ink-muted hover:text-ink text-xs font-medium">
            Details →
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {briefingLines.map((line, idx) => (
            <div
              key={idx}
              className="bg-panel-subtle border-edge rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed sm:text-sm"
            >
              <p className="text-ink-secondary">{line}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="xl:col-span-7">
        <CardHeader>
          <div>
            <CardTitle>Priority Restock Watchlist</CardTitle>
            <CardDescription>
              Items needing immediate purchase orders or shelf review
            </CardDescription>
          </div>
          <Link
            to="/restock"
            className="text-ink-secondary hover:text-ink inline-flex items-center gap-1 text-xs font-medium"
          >
            <span>Open full queue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {urgentRecommendations.length === 0 ? (
            <div className="bg-panel-subtle border-edge flex items-center gap-3 rounded-xl border p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-ink text-sm font-medium">Nothing urgent right now</p>
                <p className="text-ink-muted text-xs">
                  All products are covered beyond their supplier lead times.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-edge divide-y">
              {urgentRecommendations.slice(0, 5).map((rec) => {
                const badgeTone =
                  rec.urgency === 'critical'
                    ? 'critical'
                    : rec.urgency === 'warning'
                      ? 'warning'
                      : 'neutral';
                return (
                  <div
                    key={rec.productId}
                    className="flex flex-col justify-between gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/forecasts?productId=${encodeURIComponent(rec.productId)}`}
                          className="text-ink text-sm font-medium hover:underline"
                        >
                          {rec.productName}
                        </Link>
                        <Badge tone={badgeTone}>
                          {rec.daysUntilStockout !== null
                            ? `${rec.daysUntilStockout}d cover`
                            : rec.urgency}
                        </Badge>
                        {rec.spoilageRiskUnits > 0 ? (
                          <Badge tone="warning">{rec.spoilageRiskUnits} expiry risk</Badge>
                        ) : null}
                      </div>
                      <p className="text-ink-muted mt-0.5 text-xs">{rec.plainEnglishAction}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right text-xs tabular-nums">
                        <p className="text-ink font-medium">
                          {rec.currentStock} {pluralizeUnit(rec.unit, rec.currentStock)} on hand
                        </p>
                        {rec.onOrderQty > 0 ? (
                          <p className="text-ink-muted">+{rec.onOrderQty} incoming</p>
                        ) : (
                          <p className="text-ink-muted">ROP {rec.reorderPoint}</p>
                        )}
                      </div>
                      {rec.recommendedOrderQty > 0 ? (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={orderingId === rec.productId}
                          onClick={() => void handleQuickOrder(rec)}
                        >
                          Order {rec.recommendedOrderQty} (
                          {formatCurrency(rec.estimatedOrderCost, currency)})
                        </Button>
                      ) : (
                        <Link to={`/inventory`}>
                          <Button variant="secondary" size="sm">
                            Adjust
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

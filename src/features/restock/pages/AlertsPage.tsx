import { Bell, Check, Clock, EyeOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toAppError } from '../../../shared/errors';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Card, CardContent } from '../../../shared/ui/Card';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../../shared/ui/StateViews';
import { useToast } from '../../../shared/ui/useToast';
import { addDaysIso, todayIsoDate } from '../../../shared/utils/date';
import { useShopData } from '../../settings/useShopData';
import { createRestockOrder, setAlertState } from '../restock.api';
import type { ShopAlert } from '../restock.types';

export function AlertsPage() {
  const { shopId, alerts, products, suppliers, isLoading, error, retrySync } = useShopData();
  const { pushToast } = useToast();

  const [tab, setTab] = useState<'active' | 'resolved' | 'all'>('active');
  const [busyAlertId, setBusyAlertId] = useState<string | null>(null);

  const visibleAlerts = useMemo(() => {
    if (tab === 'active') return alerts.filter((a) => a.state === 'active');
    if (tab === 'resolved') return alerts.filter((a) => a.state !== 'active');
    return alerts;
  }, [alerts, tab]);

  const handleOrderFromAlert = async (alert: ShopAlert) => {
    const product = products.find((p) => p.id === alert.productId);
    if (!product) return;
    const qty = alert.recommendedQty ?? product.packSize;
    const supplier = suppliers.find((s) => s.id === product.supplierId);

    setBusyAlertId(alert.id);
    try {
      await createRestockOrder({
        shopId,
        product,
        supplier,
        quantity: qty,
        expectedDate: addDaysIso(todayIsoDate(), product.leadTimeDays),
        notes: `Ordered from inbox alert (${alert.title})`,
      });
      await setAlertState(shopId, alert.id, 'read', null);
      pushToast({
        title: `Ordered ${qty} ${product.unit} of ${product.name}`,
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Action failed',
        description: toAppError(err).userMessage,
        tone: 'error',
      });
    } finally {
      setBusyAlertId(null);
    }
  };

  if (error) {
    return <ErrorState message={error.userMessage} onRetry={retrySync} />;
  }

  if (isLoading) {
    return <LoadingSkeleton rows={5} label="Loading shop notifications..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-ink-muted text-xs font-medium tracking-widest uppercase">
            Restock &amp; Anomaly Notifications
          </p>
          <h1 className="text-ink mt-1 text-2xl font-semibold tracking-tight">
            Inbox &amp; Alerts
          </h1>
        </div>

        <div className="bg-panel-subtle border-edge inline-flex rounded-xl border p-1">
          {(
            [
              {
                id: 'active',
                label: `Active (${alerts.filter((a) => a.state === 'active').length})`,
              },
              {
                id: 'resolved',
                label: `Handled (${alerts.filter((a) => a.state !== 'active').length})`,
              },
              { id: 'all', label: `All (${alerts.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                tab === item.id ? 'bg-panel text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {visibleAlerts.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="Inbox is clear"
          description="No active stockouts, expiry risks, or anomalies match this filter."
        />
      ) : (
        <div className="space-y-3">
          {visibleAlerts.map((alert) => {
            const tone =
              alert.severity === 'critical'
                ? 'critical'
                : alert.severity === 'warning'
                  ? 'warning'
                  : 'info';

            return (
              <Card key={alert.id}>
                <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tone}>{alert.severity}</Badge>
                      <span className="text-ink text-sm font-semibold">{alert.title}</span>
                      {alert.state !== 'active' ? (
                        <Badge tone="neutral">{alert.state}</Badge>
                      ) : null}
                    </div>
                    <p className="text-ink-secondary text-xs leading-relaxed sm:text-sm">
                      {alert.message}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {alert.recommendedQty ? (
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={busyAlertId === alert.id}
                        onClick={() => void handleOrderFromAlert(alert)}
                      >
                        {alert.actionLabel}
                      </Button>
                    ) : (
                      <Link to={`/forecasts?productId=${encodeURIComponent(alert.productId)}`}>
                        <Button variant="secondary" size="sm">
                          {alert.actionLabel}
                        </Button>
                      </Link>
                    )}

                    {alert.state === 'active' ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Snooze for 3 days"
                          leftIcon={<Clock className="h-3.5 w-3.5" />}
                          onClick={() =>
                            void setAlertState(
                              shopId,
                              alert.id,
                              'snoozed',
                              addDaysIso(todayIsoDate(), 3),
                            )
                          }
                        >
                          Snooze 3d
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Mark read"
                          leftIcon={<Check className="h-3.5 w-3.5" />}
                          onClick={() => void setAlertState(shopId, alert.id, 'read', null)}
                        >
                          Done
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Dismiss alert"
                          onClick={() => void setAlertState(shopId, alert.id, 'dismissed', null)}
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

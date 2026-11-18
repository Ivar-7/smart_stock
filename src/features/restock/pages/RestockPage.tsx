import { CheckCircle2, Download, PackageCheck, ShoppingCart, XCircle } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toAppError } from '../../../shared/errors';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { FieldLabel, Input, Select } from '../../../shared/ui/FormFields';
import { Modal } from '../../../shared/ui/Modal';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../../shared/ui/StateViews';
import { useToast } from '../../../shared/ui/useToast';
import { addDaysIso, todayIsoDate } from '../../../shared/utils/date';
import { formatCurrency } from '../../../shared/utils/format';
import { useShopData } from '../../settings/useShopData';
import { cancelRestockOrder, createRestockOrder, receiveRestockOrder } from '../restock.api';
import type { RestockOrder, RestockRecommendation } from '../restock.types';

export function RestockPage() {
  const {
    shopId,
    profile,
    products,
    suppliers,
    recommendations,
    restockOrders,
    isLoading,
    error,
    retrySync,
  } = useShopData();
  const { pushToast } = useToast();

  const [urgencyFilter, setUrgencyFilter] = useState<
    'needs_order' | 'all' | 'critical' | 'warning'
  >('needs_order');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, number>>({});
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  const [receivingOrder, setReceivingOrder] = useState<RestockOrder | null>(null);
  const [receivedQty, setReceivedQty] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);

  const currency = profile?.currency ?? 'USD';

  const filteredRecs = useMemo(() => {
    return recommendations.filter((r) => {
      if (supplierFilter !== 'all' && r.supplierId !== supplierFilter) return false;
      if (urgencyFilter === 'needs_order') {
        return r.recommendedOrderQty > 0 || r.urgency === 'critical' || r.urgency === 'warning';
      }
      if (urgencyFilter === 'critical') return r.urgency === 'critical';
      if (urgencyFilter === 'warning') return r.urgency === 'warning';
      return true;
    });
  }, [recommendations, urgencyFilter, supplierFilter]);

  const handlePlaceOrder = async (rec: RestockRecommendation) => {
    const product = products.find((p) => p.id === rec.productId);
    if (!product) return;
    const qty = qtyDrafts[rec.productId] ?? Math.max(rec.recommendedOrderQty, product.packSize);
    if (qty < 1) return;

    const supplier = suppliers.find((s) => s.id === product.supplierId);
    setBusyProductId(rec.productId);
    try {
      await createRestockOrder({
        shopId,
        product,
        supplier,
        quantity: qty,
        expectedDate: addDaysIso(todayIsoDate(), product.leadTimeDays),
        notes: rec.cappedByShelfLife
          ? 'Shelf-life capped fresh order'
          : 'Recommended by Smart Stock',
      });
      pushToast({
        title: `Purchase order placed for ${product.name}`,
        description: `${qty} ${product.unit} expected in ${product.leadTimeDays} days.`,
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Could not create order',
        description: toAppError(err).userMessage,
        tone: 'error',
      });
    } finally {
      setBusyProductId(null);
    }
  };

  const handleExportPoCsv = () => {
    const rows = [
      'SKU,Product,Supplier,CurrentStock,ReorderPoint,OrderQty,EstimatedCost,Urgency,ActionNote',
      ...filteredRecs
        .filter((r) => (qtyDrafts[r.productId] ?? r.recommendedOrderQty) > 0)
        .map((r) => {
          const qty = qtyDrafts[r.productId] ?? r.recommendedOrderQty;
          return [
            r.sku,
            `"${r.productName.replace(/"/g, '""')}"`,
            `"${r.supplierName.replace(/"/g, '""')}"`,
            r.currentStock,
            r.reorderPoint,
            qty,
            (qty * (products.find((p) => p.id === r.productId)?.unitCost ?? 0)).toFixed(2),
            r.urgency,
            `"${r.plainEnglishAction.replace(/"/g, '""')}"`,
          ].join(',');
        }),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart-stock-restock-${todayIsoDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openReceiveModal = (order: RestockOrder) => {
    const product = products.find((p) => p.id === order.productId);
    setReceivingOrder(order);
    setReceivedQty(String(order.quantity));
    setNewExpiry(
      product?.isPerishable && product.shelfLifeDays
        ? addDaysIso(todayIsoDate(), product.shelfLifeDays)
        : '',
    );
  };

  const handleReceiveSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!receivingOrder) return;
    setIsReceiving(true);
    try {
      await receiveRestockOrder(shopId, {
        orderId: receivingOrder.id,
        receivedQty: Number(receivedQty),
        newExpiryDate: newExpiry || null,
        note: `Checked in ${receivedQty} units`,
      });
      pushToast({
        title: `Received delivery for ${receivingOrder.productName}`,
        description: 'On-hand stock incremented and open order cleared.',
        tone: 'success',
      });
      setReceivingOrder(null);
    } catch (err) {
      pushToast({
        title: 'Could not receive order',
        description: toAppError(err).userMessage,
        tone: 'error',
      });
    } finally {
      setIsReceiving(false);
    }
  };

  if (error) {
    return <ErrorState message={error.userMessage} onRetry={retrySync} />;
  }

  if (isLoading) {
    return <LoadingSkeleton rows={6} label="Calculating restock recommendations..." />;
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-5 w-5" />}
        title="No products to restock"
        description="Add products or load the sample shop catalog to receive restock schedules."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-ink-muted text-xs font-medium tracking-widest uppercase">
            Procurement &amp; Replenishment
          </p>
          <h1 className="text-ink mt-1 text-2xl font-semibold tracking-tight">
            Restock Queue &amp; Purchase Orders
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPoCsv}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            Export PO Sheet (CSV)
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="bg-panel-subtle border-edge inline-flex flex-wrap rounded-xl border p-1">
            {(
              [
                { id: 'needs_order', label: 'Action Needed' },
                { id: 'critical', label: 'Critical' },
                { id: 'warning', label: 'Watch' },
                { id: 'all', label: 'All SKUs' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setUrgencyFilter(opt.id)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  urgencyFilter === opt.id
                    ? 'bg-panel text-ink shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Select
            id="restock-supplier-filter"
            aria-label="Filter by supplier"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full sm:w-64"
          >
            <option value="all">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Recommendations Table */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recommended Reorders ({filteredRecs.length})</CardTitle>
            <CardDescription>
              Calculated from seasonal day-of-week depletion, supplier lead time, and perishable
              shelf life
            </CardDescription>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-edge text-ink-muted border-y text-xs font-medium">
                <th className="px-5 py-3">Product &amp; Reason</th>
                <th className="px-4 py-3 text-right">Stock / ROP</th>
                <th className="px-4 py-3 text-right">Runway</th>
                <th className="px-4 py-3 text-right">Order Qty</th>
                <th className="px-4 py-3 text-right">Est. Cost</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-edge divide-y">
              {filteredRecs.map((rec) => {
                const product = products.find((p) => p.id === rec.productId);
                const draftQty =
                  qtyDrafts[rec.productId] ??
                  (rec.recommendedOrderQty > 0
                    ? rec.recommendedOrderQty
                    : (product?.packSize ?? 6));
                const estCost = draftQty * (product?.unitCost ?? 0);
                const tone =
                  rec.urgency === 'critical'
                    ? 'critical'
                    : rec.urgency === 'warning'
                      ? 'warning'
                      : 'healthy';

                return (
                  <tr key={rec.productId} className="hover:bg-panel-subtle/50">
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ink font-medium">{rec.productName}</span>
                        <Badge tone={tone}>{rec.urgency}</Badge>
                        {rec.cappedByShelfLife ? (
                          <Badge tone="info">Shelf-life capped</Badge>
                        ) : null}
                      </div>
                      <p className="text-ink-muted mt-0.5 text-xs">{rec.plainEnglishAction}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs tabular-nums">
                      <p className="text-ink font-semibold">
                        {rec.currentStock} {rec.unit}
                      </p>
                      <p className="text-ink-muted">
                        ROP {rec.reorderPoint}
                        {rec.onOrderQty > 0 ? ` · +${rec.onOrderQty} open` : ''}
                      </p>
                    </td>
                    <td className="text-ink px-4 py-3.5 text-right text-xs font-medium tabular-nums">
                      {rec.daysUntilStockout !== null
                        ? `${rec.daysUntilStockout} days`
                        : '30+ days'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <input
                        id={`restock-qty-${rec.productId}`}
                        type="number"
                        min="1"
                        aria-label={`Order quantity for ${rec.productName}`}
                        value={draftQty}
                        onChange={(e) =>
                          setQtyDrafts((prev) => ({
                            ...prev,
                            [rec.productId]: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        className="border-edge bg-panel-subtle text-ink h-8 w-20 rounded-lg border px-2 text-right text-xs tabular-nums"
                      />
                    </td>
                    <td className="text-ink px-4 py-3.5 text-right text-xs font-medium tabular-nums">
                      {formatCurrency(estCost, currency)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant={rec.urgency === 'critical' ? 'primary' : 'secondary'}
                        size="sm"
                        isLoading={busyProductId === rec.productId}
                        onClick={() => void handlePlaceOrder(rec)}
                      >
                        Place PO
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Open & Completed Purchase Orders */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Purchase Orders ({restockOrders.length})</CardTitle>
            <CardDescription>
              Track incoming supplier deliveries and check items directly into shelf stock
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {restockOrders.length === 0 ? (
            <p className="text-ink-muted py-6 text-center text-xs">
              No purchase orders created yet. Place a PO above to track incoming deliveries.
            </p>
          ) : (
            <div className="divide-edge divide-y">
              {restockOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col justify-between gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ink text-sm font-medium">{order.productName}</span>
                      <Badge
                        tone={
                          order.status === 'received'
                            ? 'healthy'
                            : order.status === 'cancelled'
                              ? 'neutral'
                              : 'warning'
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-ink-muted mt-0.5 text-xs">
                      {order.supplierName} · Qty {order.quantity} ·{' '}
                      {formatCurrency(order.totalCost, currency)} · Expected {order.expectedDate}
                    </p>
                  </div>

                  {order.status === 'ordered' ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<PackageCheck className="h-3.5 w-3.5" />}
                        onClick={() => openReceiveModal(order)}
                      >
                        Mark Received
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<XCircle className="h-3.5 w-3.5" />}
                        onClick={() => void cancelRestockOrder(shopId, order)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : order.receivedDate ? (
                    <span className="text-ink-muted inline-flex items-center gap-1 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Checked in {order.receivedDate}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={Boolean(receivingOrder)}
        onClose={() => setReceivingOrder(null)}
        maxWidth="md"
        title={`Receive Delivery · ${receivingOrder?.productName ?? ''}`}
        description="Confirm units checked in and update expiry date if perishable."
      >
        <form onSubmit={handleReceiveSubmit} className="space-y-4">
          <div>
            <FieldLabel htmlFor="rec-qty">Received quantity</FieldLabel>
            <Input
              id="rec-qty"
              type="number"
              min="1"
              value={receivedQty}
              onChange={(e) => setReceivedQty(e.target.value)}
            />
          </div>
          {products.find((p) => p.id === receivingOrder?.productId)?.isPerishable ? (
            <div>
              <FieldLabel htmlFor="rec-exp">Batch expiry date</FieldLabel>
              <Input
                id="rec-exp"
                type="date"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
              />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReceivingOrder(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isReceiving}>
              Check into stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

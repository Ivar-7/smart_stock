import { Plus, ReceiptText, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toAppError } from '../../../shared/errors';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { FieldError, FieldLabel, Input, Select } from '../../../shared/ui/FormFields';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../../shared/ui/StateViews';
import { useToast } from '../../../shared/ui/useToast';
import { todayIsoDate } from '../../../shared/utils/date';
import { formatCurrency } from '../../../shared/utils/format';
import { useShopData } from '../../settings/useShopData';
import { CsvCleanerWorkbench } from '../components/CsvCleanerWorkbench';
import { deleteSaleRecord, recordManualSale, updateSaleClassification } from '../sales.api';
import { saleInputSchema } from '../sales.schema';
import type { SalesOrderType } from '../sales.types';

export function SalesPage() {
  const { shopId, profile, products, sales, isLoading, error, retrySync } = useShopData();
  const { pushToast } = useToast();

  const [tab, setTab] = useState<'log' | 'csv'>('log');
  const [filterType, setFilterType] = useState<'all' | 'normal' | 'bulk' | 'promo'>('all');
  const [filterProductId, setFilterProductId] = useState('all');

  const [productId, setProductId] = useState('');
  const [soldDate, setSoldDate] = useState(todayIsoDate());
  const [quantity, setQuantity] = useState('4');
  const [unitPrice, setUnitPrice] = useState('');
  const [orderType, setOrderType] = useState<SalesOrderType>('normal');
  const [isPromotion, setIsPromotion] = useState(false);
  const [promoTag, setPromoTag] = useState('');
  const [notes, setNotes] = useState('');
  const [deductStock, setDeductStock] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currency = profile?.currency ?? 'USD';
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === (productId || products[0]?.id)) ?? null,
    [products, productId],
  );

  const qtyNumber = Number(quantity) || 0;
  const exceedsBulkThreshold =
    selectedProduct !== null && qtyNumber >= selectedProduct.bulkUnitThreshold;

  const filteredSales = useMemo(() => {
    return sales
      .filter((s) => {
        if (filterProductId !== 'all' && s.productId !== filterProductId) return false;
        if (filterType === 'bulk' && s.orderType !== 'bulk') return false;
        if (filterType === 'normal' && (s.orderType !== 'normal' || s.isPromotion)) return false;
        if (filterType === 'promo' && !s.isPromotion) return false;
        return true;
      })
      .slice(0, 120);
  }, [sales, filterProductId, filterType]);

  const handleProductChange = (nextId: string) => {
    setProductId(nextId);
    const prod = products.find((p) => p.id === nextId);
    if (prod) {
      setUnitPrice(String(prod.sellingPrice));
    }
  };

  const handleAddSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProduct) return;
    setFormErrors({});

    const effectivePrice =
      unitPrice.trim().length > 0 ? Number(unitPrice) : selectedProduct.sellingPrice;

    const parsed = saleInputSchema.safeParse({
      productId: selectedProduct.id,
      soldDate,
      quantity: Number(quantity),
      unitPrice: effectivePrice,
      orderType: exceedsBulkThreshold && orderType === 'normal' ? 'bulk' : orderType,
      isPromotion,
      promoTag: isPromotion ? promoTag.trim() : '',
      anomalyAction: 'auto',
      notes: notes.trim(),
      deductStock,
    });

    if (!parsed.success) {
      const nextErr: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        nextErr[String(issue.path[0] ?? 'form')] = issue.message;
      }
      setFormErrors(nextErr);
      return;
    }

    setIsSubmitting(true);
    try {
      await recordManualSale(shopId, parsed.data, selectedProduct);
      pushToast({
        title: `Logged ${parsed.data.quantity} ${selectedProduct.unit} of ${selectedProduct.name}`,
        tone: 'success',
      });
      setNotes('');
      setPromoTag('');
      setIsPromotion(false);
    } catch (err) {
      pushToast({
        title: 'Could not save sale',
        description: toAppError(err).userMessage,
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error) {
    return <ErrorState message={error.userMessage} onRetry={retrySync} />;
  }

  if (isLoading) {
    return <LoadingSkeleton rows={6} label="Loading sales ledger..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-ink-muted text-xs font-medium tracking-widest uppercase">
            POS Ledger &amp; Hygiene
          </p>
          <h1 className="text-ink mt-1 text-2xl font-semibold tracking-tight">
            Sales Log &amp; Data Cleaner
          </h1>
        </div>
        <div className="bg-panel-subtle border-edge inline-flex rounded-xl border p-1">
          <button
            type="button"
            onClick={() => setTab('log')}
            className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              tab === 'log' ? 'bg-panel text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Manual Entry &amp; Log
          </button>
          <button
            type="button"
            onClick={() => setTab('csv')}
            className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              tab === 'csv' ? 'bg-panel text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            CSV Upload &amp; Cleaner
          </button>
        </div>
      </div>

      {tab === 'csv' ? (
        <CsvCleanerWorkbench onImported={() => setTab('log')} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-5 w-5" />}
          title="Add products before recording sales"
          description="Create items in your Products catalog or load the sample shop first."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <CardHeader>
              <div>
                <CardTitle>Record Sale</CardTitle>
                <CardDescription>
                  Tag wholesale bulk orders or promotions so forecasts stay clean
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddSale} className="space-y-4">
                <div>
                  <FieldLabel htmlFor="sale-product">Product</FieldLabel>
                  <Select
                    id="sale-product"
                    value={selectedProduct?.id ?? ''}
                    onChange={(e) => handleProductChange(e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.currentStock} {p.unit} left)
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor="sale-date">Sale date</FieldLabel>
                    <Input
                      id="sale-date"
                      type="date"
                      value={soldDate}
                      onChange={(e) => setSoldDate(e.target.value)}
                    />
                    <FieldError message={formErrors.soldDate} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="sale-qty">Quantity</FieldLabel>
                    <Input
                      id="sale-qty"
                      type="number"
                      min="1"
                      step="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                    <FieldError message={formErrors.quantity} />
                  </div>
                </div>

                {exceedsBulkThreshold ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                    Quantity meets or exceeds bulk threshold ({selectedProduct.bulkUnitThreshold}{' '}
                    {selectedProduct.unit}). It will be separated as a B2B bulk order.
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor="sale-price">Unit price</FieldLabel>
                    <Input
                      id="sale-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        unitPrice || (selectedProduct ? String(selectedProduct.sellingPrice) : '')
                      }
                      onChange={(e) => setUnitPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="sale-type">Order type</FieldLabel>
                    <Select
                      id="sale-type"
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value as SalesOrderType)}
                    >
                      <option value="normal">Normal retail</option>
                      <option value="bulk">Bulk / Wholesale</option>
                    </Select>
                  </div>
                </div>

                <div className="bg-panel-subtle border-edge space-y-2.5 rounded-xl border p-3.5">
                  <label
                    htmlFor="sale-is-promo"
                    className="flex cursor-pointer items-center gap-2 text-xs font-medium"
                  >
                    <input
                      id="sale-is-promo"
                      type="checkbox"
                      checked={isPromotion}
                      onChange={(e) => setIsPromotion(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-zinc-900 dark:accent-zinc-100"
                    />
                    <span className="text-ink">Tagged promotional / discounted day</span>
                  </label>
                  {isPromotion ? (
                    <div>
                      <Input
                        id="sale-promo-tag"
                        aria-label="Promotion tag"
                        value={promoTag}
                        onChange={(e) => setPromoTag(e.target.value)}
                        placeholder="e.g., Weekend 20% Off"
                      />
                      <FieldError message={formErrors.promoTag} />
                    </div>
                  ) : null}
                </div>

                <label
                  htmlFor="sale-deduct-stock"
                  className="flex cursor-pointer items-center gap-2 text-xs"
                >
                  <input
                    id="sale-deduct-stock"
                    type="checkbox"
                    checked={deductStock}
                    onChange={(e) => setDeductStock(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span className="text-ink-secondary">Deduct sold units from current stock</span>
                </label>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  leftIcon={<Plus className="h-4 w-4" />}
                  className="w-full"
                >
                  Save sale entry
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="xl:col-span-8">
            <CardHeader className="flex-col sm:flex-row sm:items-center">
              <div>
                <CardTitle>Recent Sales Ledger ({sales.length} total)</CardTitle>
                <CardDescription>Showing latest 120 matching records</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  id="sales-filter-product"
                  aria-label="Filter by product"
                  value={filterProductId}
                  onChange={(e) => setFilterProductId(e.target.value)}
                  className="w-44"
                >
                  <option value="all">All products</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Select
                  id="sales-filter-type"
                  aria-label="Filter by order tag"
                  value={filterType}
                  onChange={(e) =>
                    setFilterType(e.target.value as 'all' | 'normal' | 'bulk' | 'promo')
                  }
                  className="w-36"
                >
                  <option value="all">All tags</option>
                  <option value="normal">Normal retail</option>
                  <option value="bulk">Bulk B2B</option>
                  <option value="promo">Promotions</option>
                </Select>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-edge text-ink-muted border-y text-xs font-medium">
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                    <th className="px-4 py-2.5">Tags</th>
                    <th className="px-5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-edge divide-y">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-panel-subtle/50">
                      <td className="text-ink-secondary px-5 py-3 font-mono text-xs">
                        {sale.soldDate}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-ink font-medium">{sale.productName}</p>
                        {sale.notes ? <p className="text-ink-muted text-xs">{sale.notes}</p> : null}
                      </td>
                      <td className="text-ink px-4 py-3 text-right font-medium tabular-nums">
                        {sale.quantity}
                      </td>
                      <td className="text-ink-secondary px-4 py-3 text-right text-xs tabular-nums">
                        {formatCurrency(sale.quantity * sale.unitPrice, currency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={sale.orderType === 'bulk' ? 'warning' : 'neutral'}>
                            {sale.orderType}
                          </Badge>
                          {sale.isPromotion ? (
                            <Badge tone="info">{sale.promoTag || 'Promo'}</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void updateSaleClassification(shopId, sale.id, {
                                orderType: sale.orderType === 'bulk' ? 'normal' : 'bulk',
                              })
                            }
                          >
                            {sale.orderType === 'bulk' ? 'Mark retail' : 'Mark bulk'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Delete sale record"
                            onClick={() => void deleteSaleRecord(shopId, sale.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

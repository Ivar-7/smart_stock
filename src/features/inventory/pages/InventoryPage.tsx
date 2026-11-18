import { Boxes, Edit3, Plus, Search, SlidersHorizontal, Truck } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toAppError } from '../../../shared/errors';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { FieldLabel, Input, Select, Textarea } from '../../../shared/ui/FormFields';
import { Modal } from '../../../shared/ui/Modal';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../../shared/ui/StateViews';
import { useToast } from '../../../shared/ui/useToast';
import { formatCurrency } from '../../../shared/utils/format';
import { useShopData } from '../../settings/useShopData';
import { ProductFormModal, StockAdjustmentModal } from '../components/InventoryModals';
import { createSupplier } from '../inventory.api';
import { supplierInputSchema } from '../inventory.schema';
import { PRODUCT_CATEGORIES, type Product } from '../inventory.types';

export function InventoryPage() {
  const {
    shopId,
    profile,
    products,
    suppliers,
    stockMovements,
    recommendations,
    isLoading,
    error,
    retrySync,
  } = useShopData();
  const { pushToast } = useToast();

  const [tab, setTab] = useState<'products' | 'suppliers' | 'movements'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supLead, setSupLead] = useState('3');
  const [supNotes, setSupNotes] = useState('');
  const [savingSupplier, setSavingSupplier] = useState(false);

  const currency = profile?.currency ?? 'USD';

  const recByProductId = useMemo(
    () => new Map(recommendations.map((r) => [r.productId, r])),
    [recommendations],
  );
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) {
        return false;
      }
      const rec = recByProductId.get(p.id);
      if (statusFilter === 'perishable' && !p.isPerishable) {
        return false;
      }
      if (
        (statusFilter === 'critical' || statusFilter === 'warning' || statusFilter === 'healthy') &&
        rec?.urgency !== statusFilter
      ) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, categoryFilter, statusFilter, recByProductId]);

  const handleCreateSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = supplierInputSchema.safeParse({
      name: supName,
      contactName: supContact,
      email: supEmail,
      phone: supPhone,
      defaultLeadTimeDays: Number(supLead),
      orderDays: ['Mon', 'Thu'],
      notes: supNotes,
    });
    if (!parsed.success) {
      pushToast({
        title: 'Invalid supplier details',
        description: parsed.error.issues[0]?.message ?? 'Check fields and retry.',
        tone: 'error',
      });
      return;
    }

    setSavingSupplier(true);
    try {
      await createSupplier(shopId, parsed.data);
      pushToast({ title: 'Supplier added', description: parsed.data.name, tone: 'success' });
      setSupplierModalOpen(false);
      setSupName('');
      setSupContact('');
      setSupEmail('');
      setSupPhone('');
      setSupNotes('');
    } catch (err) {
      pushToast({
        title: 'Could not add supplier',
        description: toAppError(err).userMessage,
        tone: 'error',
      });
    } finally {
      setSavingSupplier(false);
    }
  };

  if (error) {
    return <ErrorState message={error.userMessage} onRetry={retrySync} />;
  }

  if (isLoading) {
    return <LoadingSkeleton rows={6} label="Loading inventory catalog..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-ink-muted text-xs font-medium tracking-widest uppercase">
            Catalog &amp; Stock Control
          </p>
          <h1 className="text-ink mt-1 text-2xl font-semibold tracking-tight">
            Products &amp; Stock Levels
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {tab === 'suppliers' ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setSupplierModalOpen(true)}
            >
              Add Supplier
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => {
                setEditingProduct(null);
                setProductModalOpen(true);
              }}
            >
              Add Product
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-panel-subtle border-edge inline-flex rounded-xl border p-1">
        {(
          [
            { id: 'products', label: `Products (${products.length})` },
            { id: 'suppliers', label: `Suppliers (${suppliers.length})` },
            { id: 'movements', label: `Stock Log (${stockMovements.length})` },
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

      {tab === 'products' ? (
        <>
          {/* Filter Bar */}
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="relative sm:col-span-5">
                <Search className="text-ink-muted pointer-events-none absolute top-2.5 left-3 h-4 w-4" />
                <Input
                  id="inventory-search"
                  aria-label="Search SKU or product name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search SKU or product name..."
                  className="pl-9"
                />
              </div>
              <div className="sm:col-span-4">
                <Select
                  id="inventory-category-filter"
                  aria-label="Filter by category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-3">
                <Select
                  id="inventory-status-filter"
                  aria-label="Filter by stock status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="critical">Critical stock</option>
                  <option value="warning">Watch / Reorder soon</option>
                  <option value="healthy">Healthy cover</option>
                  <option value="perishable">Perishable only</option>
                </Select>
              </div>
            </div>
          </Card>

          {filteredProducts.length === 0 ? (
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title="No matching products"
              description="Adjust your search or add a new SKU to begin tracking stock levels."
            />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-edge text-ink-muted border-b text-xs font-medium">
                      <th className="px-5 py-3">Product</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">On Hand</th>
                      <th className="px-4 py-3 text-right">ROP</th>
                      <th className="px-4 py-3">Shelf / Lead</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-edge divide-y">
                    {filteredProducts.map((product) => {
                      const rec = recByProductId.get(product.id);
                      const supplier = supplierById.get(product.supplierId);
                      const tone =
                        rec?.urgency === 'critical'
                          ? 'critical'
                          : rec?.urgency === 'warning'
                            ? 'warning'
                            : 'healthy';
                      return (
                        <tr key={product.id} className="hover:bg-panel-subtle/60 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="text-ink font-medium">{product.name}</p>
                            <p className="text-ink-muted font-mono text-xs">
                              {product.sku} · {formatCurrency(product.sellingPrice, currency)}/
                              {product.unit}
                            </p>
                          </td>
                          <td className="text-ink-secondary px-4 py-3.5 text-xs">
                            <p>{product.category}</p>
                            <p className="text-ink-muted">{supplier?.name ?? 'Supplier'}</p>
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums">
                            <p className="text-ink font-semibold">
                              {product.currentStock} {product.unit}
                            </p>
                            {product.onOrderQty > 0 ? (
                              <p className="text-ink-muted text-xs">
                                +{product.onOrderQty} ordered
                              </p>
                            ) : null}
                          </td>
                          <td className="text-ink-secondary px-4 py-3.5 text-right text-xs tabular-nums">
                            {rec ? `${rec.reorderPoint} ${product.unit}` : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            <p className="text-ink-secondary">{product.leadTimeDays}d lead</p>
                            {product.isPerishable ? (
                              <p className="text-amber-600 dark:text-amber-400">
                                {product.nearestExpiryDate
                                  ? `Exp ${product.nearestExpiryDate}`
                                  : `${product.shelfLifeDays ?? '?'}d life`}
                              </p>
                            ) : (
                              <p className="text-ink-muted">Non-perishable</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge tone={tone}>
                              {rec?.daysUntilStockout !== null &&
                              rec?.daysUntilStockout !== undefined
                                ? `${rec.daysUntilStockout}d cover`
                                : (rec?.urgency ?? 'active')}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setAdjustingProduct(product)}
                                leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                              >
                                Stock
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Edit ${product.name}`}
                                onClick={() => {
                                  setEditingProduct(product);
                                  setProductModalOpen(true);
                                }}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      ) : null}

      {tab === 'suppliers' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((sup) => (
            <Card key={sup.id}>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="text-ink-secondary h-4 w-4" />
                    <span>{sup.name}</span>
                  </CardTitle>
                  <CardDescription>
                    {sup.contactName || 'Primary wholesale contact'}
                  </CardDescription>
                </div>
                <Badge tone="neutral">{sup.defaultLeadTimeDays}d lead</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {sup.email ? <p className="text-ink-secondary">{sup.email}</p> : null}
                {sup.phone ? <p className="text-ink-secondary">{sup.phone}</p> : null}
                <p className="text-ink-muted">{sup.notes || 'Standard delivery schedule.'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === 'movements' ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent Stock Movements</CardTitle>
              <CardDescription>
                Audit log of sales deductions, deliveries, and shrinkage
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {stockMovements.length === 0 ? (
              <p className="text-ink-muted py-6 text-center text-xs">
                No stock adjustments recorded yet.
              </p>
            ) : (
              <div className="divide-edge divide-y">
                {stockMovements.map((mov) => (
                  <div
                    key={mov.id}
                    className="flex flex-col justify-between gap-2 py-3 text-xs sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-ink text-sm font-medium">{mov.productName}</p>
                      <p className="text-ink-muted">{mov.note || mov.reason}</p>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <Badge tone={mov.delta >= 0 ? 'healthy' : 'warning'}>
                        {mov.delta >= 0 ? `+${mov.delta}` : mov.delta}
                      </Badge>
                      <span className="text-ink-secondary">
                        {mov.previousStock} → <strong className="text-ink">{mov.newStock}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {productModalOpen ? (
        <ProductFormModal
          key={editingProduct?.id ?? 'new'}
          isOpen={productModalOpen}
          onClose={() => setProductModalOpen(false)}
          shopId={shopId}
          suppliers={suppliers}
          editingProduct={editingProduct}
        />
      ) : null}

      {adjustingProduct ? (
        <StockAdjustmentModal
          key={adjustingProduct.id}
          product={adjustingProduct}
          shopId={shopId}
          onClose={() => setAdjustingProduct(null)}
        />
      ) : null}

      <Modal
        isOpen={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        title="Add Supplier"
        description="Track lead time and delivery contact details for reorder scheduling."
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div>
            <FieldLabel htmlFor="sup-name">Supplier name</FieldLabel>
            <Input
              id="sup-name"
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              placeholder="Summit Roasters Wholesale"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="sup-contact">Contact person</FieldLabel>
              <Input
                id="sup-contact"
                value={supContact}
                onChange={(e) => setSupContact(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="sup-lead">Default lead time (days)</FieldLabel>
              <Input
                id="sup-lead"
                type="number"
                min="1"
                value={supLead}
                onChange={(e) => setSupLead(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="sup-email">Order email</FieldLabel>
              <Input
                id="sup-email"
                type="email"
                value={supEmail}
                onChange={(e) => setSupEmail(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="sup-phone">Phone</FieldLabel>
              <Input
                id="sup-phone"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="sup-notes">Notes</FieldLabel>
            <Textarea
              id="sup-notes"
              value={supNotes}
              onChange={(e) => setSupNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSupplierModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={savingSupplier}>
              Save supplier
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

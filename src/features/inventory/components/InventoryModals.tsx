import { useState, type FormEvent } from 'react';
import { toAppError } from '../../../shared/errors';
import { Button } from '../../../shared/ui/Button';
import { FieldError, FieldLabel, Input, Select, Textarea } from '../../../shared/ui/FormFields';
import { Modal } from '../../../shared/ui/Modal';
import { useToast } from '../../../shared/ui/useToast';
import { addDaysIso, todayIsoDate } from '../../../shared/utils/date';
import { createProduct, updateProduct } from '../inventory.api';
import { productInputSchema } from '../inventory.schema';
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductInput,
  type Supplier,
} from '../inventory.types';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  suppliers: readonly Supplier[];
  editingProduct: Product | null;
}

export function ProductFormModal({
  isOpen,
  onClose,
  shopId,
  suppliers,
  editingProduct,
}: ProductFormModalProps) {
  const { pushToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const defaultSupplierId = editingProduct?.supplierId ?? suppliers[0]?.id ?? 'default';

  const [sku, setSku] = useState(editingProduct?.sku ?? '');
  const [name, setName] = useState(editingProduct?.name ?? '');
  const [category, setCategory] = useState<Product['category']>(
    editingProduct?.category ?? PRODUCT_CATEGORIES[0],
  );
  const [unit, setUnit] = useState(editingProduct?.unit ?? 'unit');
  const [currentStock, setCurrentStock] = useState(String(editingProduct?.currentStock ?? 20));
  const [unitCost, setUnitCost] = useState(String(editingProduct?.unitCost ?? 2.0));
  const [sellingPrice, setSellingPrice] = useState(String(editingProduct?.sellingPrice ?? 4.0));
  const [supplierId, setSupplierId] = useState(defaultSupplierId);
  const [leadTimeDays, setLeadTimeDays] = useState(String(editingProduct?.leadTimeDays ?? 3));
  const [safetyDays, setSafetyDays] = useState(String(editingProduct?.safetyDays ?? 2));
  const [packSize, setPackSize] = useState(String(editingProduct?.packSize ?? 6));
  const [bulkUnitThreshold, setBulkUnitThreshold] = useState(
    String(editingProduct?.bulkUnitThreshold ?? 15),
  );
  const [isPerishable, setIsPerishable] = useState(editingProduct?.isPerishable ?? false);
  const [shelfLifeDays, setShelfLifeDays] = useState(String(editingProduct?.shelfLifeDays ?? 7));
  const [nearestExpiryDate, setNearestExpiryDate] = useState(
    editingProduct?.nearestExpiryDate ?? addDaysIso(todayIsoDate(), 7),
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const payload: ProductInput = {
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      category,
      unit: unit.trim(),
      currentStock: Number(currentStock),
      onOrderQty: editingProduct?.onOrderQty ?? 0,
      unitCost: Number(unitCost),
      sellingPrice: Number(sellingPrice),
      supplierId,
      leadTimeDays: Number(leadTimeDays),
      safetyDays: Number(safetyDays),
      packSize: Number(packSize),
      isPerishable,
      shelfLifeDays: isPerishable ? Number(shelfLifeDays) : null,
      nearestExpiryDate: isPerishable && nearestExpiryDate ? nearestExpiryDate : null,
      bulkUnitThreshold: Number(bulkUnitThreshold),
      isActive: editingProduct?.isActive ?? true,
    };

    const parsed = productInputSchema.safeParse(payload);
    if (!parsed.success) {
      const nextErr: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        nextErr[String(issue.path[0] ?? 'form')] = issue.message;
      }
      setErrors(nextErr);
      return;
    }

    setIsSaving(true);
    try {
      if (editingProduct) {
        await updateProduct(shopId, editingProduct.id, parsed.data);
        pushToast({ title: 'Product updated', description: parsed.data.name, tone: 'success' });
      } else {
        await createProduct(shopId, parsed.data);
        pushToast({ title: 'Product added', description: parsed.data.name, tone: 'success' });
      }
      onClose();
    } catch (err) {
      pushToast({
        title: 'Save failed',
        description: toAppError(err).userMessage,
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={editingProduct ? `Edit ${editingProduct.name}` : 'Add product'}
      description="Configure stock levels, supplier lead time, bulk threshold, and shelf-life limits."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="prod-name">Product name</FieldLabel>
            <Input
              id="prod-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Whole Milk 1L"
            />
            <FieldError message={errors.name} />
          </div>
          <div>
            <FieldLabel htmlFor="prod-sku">SKU code</FieldLabel>
            <Input
              id="prod-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="DAIRY-MILK-1L"
            />
            <FieldError message={errors.sku} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="prod-cat">Category</FieldLabel>
            <Select
              id="prod-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as Product['category'])}
            >
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="prod-unit">Unit</FieldLabel>
            <Input
              id="prod-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="carton"
            />
            <FieldError message={errors.unit} />
          </div>
          <div>
            <FieldLabel htmlFor="prod-supplier">Supplier</FieldLabel>
            <Select
              id="prod-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <FieldError message={errors.supplierId} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <FieldLabel htmlFor="prod-stock">Current stock</FieldLabel>
            <Input
              id="prod-stock"
              type="number"
              min="0"
              step="1"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
            />
            <FieldError message={errors.currentStock} />
          </div>
          <div>
            <FieldLabel htmlFor="prod-cost">Unit cost</FieldLabel>
            <Input
              id="prod-cost"
              type="number"
              min="0"
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="prod-price">Selling price</FieldLabel>
            <Input
              id="prod-price"
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="prod-pack">Case pack size</FieldLabel>
            <Input
              id="prod-pack"
              type="number"
              min="1"
              step="1"
              value={packSize}
              onChange={(e) => setPackSize(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="prod-lead">Lead time (days)</FieldLabel>
            <Input
              id="prod-lead"
              type="number"
              min="1"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="prod-safety">Safety buffer (days)</FieldLabel>
            <Input
              id="prod-safety"
              type="number"
              min="0"
              value={safetyDays}
              onChange={(e) => setSafetyDays(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="prod-bulk" hint="Flags B2B orders">
              Bulk cutoff (units)
            </FieldLabel>
            <Input
              id="prod-bulk"
              type="number"
              min="2"
              value={bulkUnitThreshold}
              onChange={(e) => setBulkUnitThreshold(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-panel-subtle border-edge space-y-3 rounded-xl border p-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={isPerishable}
              onChange={(e) => setIsPerishable(e.target.checked)}
              className="h-4 w-4 rounded accent-zinc-900 dark:accent-zinc-100"
            />
            <span className="text-ink">
              Perishable product (track expiry &amp; cap order sizes)
            </span>
          </label>
          {isPerishable ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="prod-shelf">Shelf life (days)</FieldLabel>
                <Input
                  id="prod-shelf"
                  type="number"
                  min="1"
                  value={shelfLifeDays}
                  onChange={(e) => setShelfLifeDays(e.target.value)}
                />
                <FieldError message={errors.shelfLifeDays} />
              </div>
              <div>
                <FieldLabel htmlFor="prod-expiry">Nearest batch expiry</FieldLabel>
                <Input
                  id="prod-expiry"
                  type="date"
                  value={nearestExpiryDate}
                  onChange={(e) => setNearestExpiryDate(e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving}>
            {editingProduct ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function StockAdjustmentModal({
  product,
  shopId,
  onClose,
}: {
  product: Product | null;
  shopId: string;
  onClose: () => void;
}) {
  const { pushToast } = useToast();
  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');
  const [quantity, setQuantity] = useState('12');
  const [reason, setReason] = useState<'restock_received' | 'spoilage' | 'cycle_count'>(
    'restock_received',
  );
  const [expiryDate, setExpiryDate] = useState(product?.nearestExpiryDate ?? '');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!product) {
    return null;
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const { adjustProductStock } = await import('../inventory.api');
      await adjustProductStock(shopId, {
        productId: product.id,
        mode,
        quantity: Number(quantity),
        reason,
        expiryDate: product.isPerishable && expiryDate ? expiryDate : null,
        note: note.trim() || `Manual ${reason.replace('_', ' ')} adjustment`,
      });
      pushToast({
        title: `Stock updated for ${product.name}`,
        tone: 'success',
      });
      onClose();
    } catch (err) {
      pushToast({
        title: 'Adjustment failed',
        description: toAppError(err).userMessage,
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(product)}
      onClose={onClose}
      maxWidth="md"
      title={`Adjust Stock · ${product.name}`}
      description={`Current on hand: ${product.currentStock} ${product.unit}`}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="adj-mode">Action</FieldLabel>
            <Select
              id="adj-mode"
              value={mode}
              onChange={(e) => {
                const next = e.target.value as 'add' | 'remove' | 'set';
                setMode(next);
                if (next === 'remove') setReason('spoilage');
                else if (next === 'set') setReason('cycle_count');
                else setReason('restock_received');
              }}
            >
              <option value="add">Add units (+)</option>
              <option value="remove">Remove shrinkage (-)</option>
              <option value="set">Set exact count (=)</option>
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="adj-qty">Quantity ({product.unit})</FieldLabel>
            <Input
              id="adj-qty"
              type="number"
              min="0"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="adj-reason">Reason</FieldLabel>
          <Select
            id="adj-reason"
            value={reason}
            onChange={(e) =>
              setReason(e.target.value as 'restock_received' | 'spoilage' | 'cycle_count')
            }
          >
            <option value="restock_received">Delivery / Restock received</option>
            <option value="spoilage">Spoilage / Damaged goods</option>
            <option value="cycle_count">Physical shelf cycle count</option>
          </Select>
        </div>

        {product.isPerishable ? (
          <div>
            <FieldLabel htmlFor="adj-expiry">Updated nearest expiry date</FieldLabel>
            <Input
              id="adj-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        ) : null}

        <div>
          <FieldLabel htmlFor="adj-note">Note</FieldLabel>
          <Textarea
            id="adj-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Morning shelf check..."
          />
        </div>

        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving}>
            Apply adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
}

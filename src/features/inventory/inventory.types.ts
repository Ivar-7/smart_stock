export const PRODUCT_CATEGORIES = [
  'Dairy & Chilled',
  'Fresh Produce',
  'Bakery',
  'Beverages',
  'Pantry Staples',
  'Snacks',
  'Household & Care',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  defaultLeadTimeDays: number;
  orderDays: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  defaultLeadTimeDays: number;
  orderDays: string[];
  notes: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  unit: string;
  currentStock: number;
  onOrderQty: number;
  unitCost: number;
  sellingPrice: number;
  supplierId: string;
  leadTimeDays: number;
  safetyDays: number;
  packSize: number;
  isPerishable: boolean;
  shelfLifeDays: number | null;
  nearestExpiryDate: string | null;
  bulkUnitThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  sku: string;
  name: string;
  category: ProductCategory;
  unit: string;
  currentStock: number;
  onOrderQty: number;
  unitCost: number;
  sellingPrice: number;
  supplierId: string;
  leadTimeDays: number;
  safetyDays: number;
  packSize: number;
  isPerishable: boolean;
  shelfLifeDays: number | null;
  nearestExpiryDate: string | null;
  bulkUnitThreshold: number;
  isActive: boolean;
}

export type StockMovementReason =
  'sale' | 'restock_received' | 'spoilage' | 'cycle_count' | 'initial_seed';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  delta: number;
  previousStock: number;
  newStock: number;
  reason: StockMovementReason;
  note: string;
  createdAt: string;
}

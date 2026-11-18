export type RestockUrgency = 'critical' | 'warning' | 'healthy' | 'overstocked';

export interface RestockRecommendation {
  productId: string;
  sku: string;
  productName: string;
  category: string;
  unit: string;
  supplierId: string;
  supplierName: string;
  currentStock: number;
  onOrderQty: number;
  effectiveStock: number;
  leadTimeDays: number;
  reorderPoint: number;
  safetyStockUnits: number;
  daysUntilStockout: number | null;
  projectedRunoutDate: string | null;
  recommendedOrderQty: number;
  estimatedOrderCost: number;
  urgency: RestockUrgency;
  isPerishable: boolean;
  shelfLifeDays: number | null;
  nearestExpiryDate: string | null;
  daysUntilExpiry: number | null;
  spoilageRiskUnits: number;
  cappedByShelfLife: boolean;
  plainEnglishAction: string;
}

export type RestockOrderStatus = 'ordered' | 'received' | 'cancelled';

export interface RestockOrder {
  id: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  status: RestockOrderStatus;
  expectedDate: string;
  receivedDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ShopAlertKind = 'stockout' | 'reorder_soon' | 'expiry_risk' | 'anomaly';
export type AlertVisibilityState = 'active' | 'read' | 'dismissed' | 'snoozed';

export interface ShopAlert {
  id: string;
  kind: ShopAlertKind;
  severity: 'critical' | 'warning' | 'info';
  productId: string;
  productName: string;
  title: string;
  message: string;
  actionLabel: string;
  recommendedQty: number | null;
  createdDate: string;
  state: AlertVisibilityState;
  snoozedUntil: string | null;
}

export interface AlertStateRecord {
  id: string;
  status: 'read' | 'dismissed' | 'snoozed';
  snoozedUntil: string | null;
  updatedAt: string;
}

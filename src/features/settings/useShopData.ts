import { createContext, useContext } from 'react';
import type { ShopForecastOverview } from '../forecasting/forecasting.types';
import type { Product, StockMovement, Supplier } from '../inventory/inventory.types';
import type { RestockOrder, RestockRecommendation, ShopAlert } from '../restock/restock.types';
import type { SaleRecord } from '../sales/sales.types';
import type { AppError } from '../../shared/errors';
import type { ShopProfile } from './settings.types';

export interface ShopDataContextValue {
  shopId: string;
  profile: ShopProfile | null;
  suppliers: Supplier[];
  products: Product[];
  sales: SaleRecord[];
  restockOrders: RestockOrder[];
  stockMovements: StockMovement[];
  forecastOverview: ShopForecastOverview;
  recommendations: RestockRecommendation[];
  alerts: ShopAlert[];
  activeAlertCount: number;
  isLoading: boolean;
  isSeeding: boolean;
  seedStatusMessage: string | null;
  error: AppError | null;
  runSeedSampleShop: (clearExisting?: boolean) => Promise<void>;
  retrySync: () => void;
}

export const ShopDataContext = createContext<ShopDataContextValue | null>(null);

export function useShopData(): ShopDataContextValue {
  const ctx = useContext(ShopDataContext);
  if (!ctx) {
    throw new Error('useShopData must be used within ShopProvider');
  }
  return ctx;
}

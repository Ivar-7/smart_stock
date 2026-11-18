import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../features/auth/useAuth';
import { computeShopForecastOverview } from '../features/forecasting/engine/forecastPipeline';
import {
  subscribeToProducts,
  subscribeToStockMovements,
  subscribeToSuppliers,
} from '../features/inventory/inventory.api';
import type { Product, StockMovement, Supplier } from '../features/inventory/inventory.types';
import {
  buildShopAlerts,
  computeAllRestockRecommendations,
} from '../features/restock/engine/restockCalculator';
import { subscribeToAlertStates, subscribeToRestockOrders } from '../features/restock/restock.api';
import type { AlertStateRecord, RestockOrder } from '../features/restock/restock.types';
import { subscribeToSales } from '../features/sales/sales.api';
import type { SaleRecord } from '../features/sales/sales.types';
import { seedShopWorkspace } from '../features/seed/seed.api';
import { ensureShopProfile, subscribeToShopProfile } from '../features/settings/settings.api';
import type { ShopProfile } from '../features/settings/settings.types';
import { ShopDataContext } from '../features/settings/useShopData';
import { toAppError, type AppError } from '../shared/errors';
import { useToast } from '../shared/ui/useToast';
import { todayIsoDate } from '../shared/utils/date';

function ShopWorkspaceSession({
  shopId,
  displayName,
  children,
}: {
  shopId: string;
  displayName: string | null;
  children: ReactNode;
}) {
  const { pushToast } = useToast();

  const [syncEpoch, setSyncEpoch] = useState(0);
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [restockOrders, setRestockOrders] = useState<RestockOrder[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [alertStates, setAlertStates] = useState<AlertStateRecord[]>([]);

  const [loadedFlags, setLoadedFlags] = useState({
    profile: false,
    suppliers: false,
    products: false,
    sales: false,
  });
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatusMessage, setSeedStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  const notifiedAlertIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!shopId) {
      return undefined;
    }

    ensureShopProfile(shopId, displayName ?? 'Cornerstone Provisions').catch((err) => {
      setError(toAppError(err));
    });

    const handleErr = (err: AppError) => setError(err);

    const unsubs = [
      subscribeToShopProfile(
        shopId,
        (next) => {
          setProfile(next);
          setLoadedFlags((prev) => ({ ...prev, profile: true }));
        },
        handleErr,
      ),
      subscribeToSuppliers(
        shopId,
        (next) => {
          setSuppliers(next);
          setLoadedFlags((prev) => ({ ...prev, suppliers: true }));
        },
        handleErr,
      ),
      subscribeToProducts(
        shopId,
        (next) => {
          setProducts(next);
          setLoadedFlags((prev) => ({ ...prev, products: true }));
        },
        handleErr,
      ),
      subscribeToSales(
        shopId,
        (next) => {
          setSales(next);
          setLoadedFlags((prev) => ({ ...prev, sales: true }));
        },
        handleErr,
      ),
      subscribeToRestockOrders(shopId, setRestockOrders, handleErr),
      subscribeToStockMovements(shopId, setStockMovements, handleErr),
      subscribeToAlertStates(shopId, setAlertStates, handleErr),
    ];

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [shopId, displayName, syncEpoch]);

  const runSeedSampleShop = useCallback(
    async (clearExisting = true) => {
      if (!shopId) {
        return;
      }
      setIsSeeding(true);
      setSeedStatusMessage('Preparing production sample catalog...');
      try {
        await seedShopWorkspace(shopId, {
          shopName: profile?.name ?? 'Cornerstone Provisions',
          clearExisting,
          onProgress: setSeedStatusMessage,
        });
        pushToast({
          title: 'Sample shop loaded',
          description: '16 products, 4 suppliers, and 90 days of POS sales synced to Firestore.',
          tone: 'success',
        });
      } catch (err) {
        const mapped = toAppError(err);
        pushToast({
          title: 'Seed failed',
          description: mapped.userMessage,
          tone: 'error',
        });
      } finally {
        setIsSeeding(false);
        setSeedStatusMessage(null);
      }
    },
    [shopId, profile, pushToast],
  );

  const retrySync = useCallback(() => {
    setError(null);
    setLoadedFlags({ profile: false, suppliers: false, products: false, sales: false });
    setSyncEpoch((prev) => prev + 1);
  }, []);

  const referenceToday = todayIsoDate();
  const bulkThreshold = profile?.bulkMultiplierThreshold ?? 3.5;
  const serviceLevel = profile?.serviceLevelTarget ?? 0.95;
  const reviewCycleDays = profile?.defaultReviewCycleDays ?? 7;

  const forecastOverview = useMemo(
    () => computeShopForecastOverview(products, sales, bulkThreshold, referenceToday),
    [products, sales, bulkThreshold, referenceToday],
  );

  const recommendations = useMemo(
    () =>
      computeAllRestockRecommendations({
        products,
        suppliers,
        overview: forecastOverview,
        serviceLevelTarget: serviceLevel,
        defaultReviewCycleDays: reviewCycleDays,
        referenceToday,
      }),
    [products, suppliers, forecastOverview, serviceLevel, reviewCycleDays, referenceToday],
  );

  const alerts = useMemo(
    () =>
      buildShopAlerts({
        recommendations,
        overview: forecastOverview,
        alertStates,
        referenceToday,
      }),
    [recommendations, forecastOverview, alertStates, referenceToday],
  );

  const activeAlertCount = useMemo(
    () => alerts.filter((a) => a.state === 'active').length,
    [alerts],
  );

  useEffect(() => {
    if (!profile?.browserAlertsEnabled || typeof Notification === 'undefined') {
      return;
    }
    if (Notification.permission !== 'granted') {
      return;
    }
    const criticalUnread = alerts.filter((a) => a.state === 'active' && a.severity === 'critical');
    for (const alert of criticalUnread) {
      if (!notifiedAlertIds.current.has(alert.id)) {
        notifiedAlertIds.current.add(alert.id);
        new Notification(`Smart Stock Alert: ${alert.title}`, { body: alert.message });
      }
    }
  }, [alerts, profile?.browserAlertsEnabled]);

  const isLoading =
    Boolean(shopId) &&
    (!loadedFlags.profile || !loadedFlags.suppliers || !loadedFlags.products || !loadedFlags.sales);

  const value = useMemo(
    () => ({
      shopId,
      profile,
      suppliers,
      products,
      sales,
      restockOrders,
      stockMovements,
      forecastOverview,
      recommendations,
      alerts,
      activeAlertCount,
      isLoading,
      isSeeding,
      seedStatusMessage,
      error,
      runSeedSampleShop,
      retrySync,
    }),
    [
      shopId,
      profile,
      suppliers,
      products,
      sales,
      restockOrders,
      stockMovements,
      forecastOverview,
      recommendations,
      alerts,
      activeAlertCount,
      isLoading,
      isSeeding,
      seedStatusMessage,
      error,
      runSeedSampleShop,
      retrySync,
    ],
  );

  return <ShopDataContext.Provider value={value}>{children}</ShopDataContext.Provider>;
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user, isProvisioning } = useAuth();
  const shopId = user && !isProvisioning ? user.uid : '';
  return (
    <ShopWorkspaceSession
      key={shopId || 'signed-out'}
      shopId={shopId}
      displayName={user?.displayName ?? null}
    >
      {children}
    </ShopWorkspaceSession>
  );
}

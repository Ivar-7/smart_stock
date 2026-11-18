import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { LoadingSkeleton } from '../shared/ui/StateViews';
import { AppLayout } from './AppLayout';

const AuthPage = lazy(() =>
  import('../features/auth/pages/AuthPage').then((m) => ({ default: m.AuthPage })),
);
const OverviewPage = lazy(() =>
  import('../features/overview/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
const AlertsPage = lazy(() =>
  import('../features/restock/pages/AlertsPage').then((m) => ({ default: m.AlertsPage })),
);
const ForecastsPage = lazy(() =>
  import('../features/forecasting/pages/ForecastsPage').then((m) => ({ default: m.ForecastsPage })),
);
const InventoryPage = lazy(() =>
  import('../features/inventory/pages/InventoryPage').then((m) => ({ default: m.InventoryPage })),
);
const SalesPage = lazy(() =>
  import('../features/sales/pages/SalesPage').then((m) => ({ default: m.SalesPage })),
);
const RestockPage = lazy(() =>
  import('../features/restock/pages/RestockPage').then((m) => ({ default: m.RestockPage })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function RouteFallback() {
  return (
    <div className="p-6">
      <LoadingSkeleton rows={5} label="Loading view..." />
    </div>
  );
}

export function AppRouter() {
  const { user, isReady, isProvisioning } = useAuth();

  if (!isReady || isProvisioning) {
    return (
      <div className="bg-canvas flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <LoadingSkeleton
            rows={3}
            label={
              isProvisioning ? 'Provisioning shop workspace...' : 'Initializing Smart Stock...'
            }
          />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AppLayout>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/forecasts" element={<ForecastsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/restock" element={<RestockPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </BrowserRouter>
  );
}

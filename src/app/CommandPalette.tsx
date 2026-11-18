import { ArrowRight, Package, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShopData } from '../features/settings/useShopData';
import { Badge } from '../shared/ui/Badge';

interface QuickDestination {
  label: string;
  hint: string;
  to: string;
}

const DESTINATIONS: QuickDestination[] = [
  { label: 'Overview & Stock Health', hint: 'Home dashboard', to: '/overview' },
  { label: 'Inbox & Alerts', hint: 'Stockouts, expiries, anomalies', to: '/alerts' },
  { label: 'Demand Forecasts', hint: 'Holt-Winters & Croston models', to: '/forecasts' },
  { label: 'Products & Stock', hint: 'Catalog & stock adjustments', to: '/inventory' },
  { label: 'Sales & Data Cleaner', hint: 'Manual entry & CSV cleaning', to: '/sales' },
  { label: 'Restock Queue & POs', hint: 'Recommended orders & deliveries', to: '/restock' },
  { label: 'Shop Settings', hint: 'Thresholds, theme & sample seed', to: '/settings' },
];

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [queryText, setQueryText] = useState('');
  const navigate = useNavigate();
  const { products, recommendations } = useShopData();

  useEffect(() => {
    const onGlobalKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (isOpen && event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [isOpen, onClose]);

  const recById = useMemo(() => {
    const map = new Map(recommendations.map((r) => [r.productId, r]));
    return map;
  }, [recommendations]);

  const trimmed = queryText.trim().toLowerCase();

  const matchingPages = useMemo(
    () =>
      DESTINATIONS.filter(
        (d) =>
          !trimmed ||
          d.label.toLowerCase().includes(trimmed) ||
          d.hint.toLowerCase().includes(trimmed),
      ),
    [trimmed],
  );

  const matchingProducts = useMemo(
    () =>
      products
        .filter(
          (p) =>
            !trimmed ||
            p.name.toLowerCase().includes(trimmed) ||
            p.sku.toLowerCase().includes(trimmed) ||
            p.category.toLowerCase().includes(trimmed),
        )
        .slice(0, 6),
    [products, trimmed],
  );

  const goTo = (to: string) => {
    setQueryText('');
    onClose();
    navigate(to);
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="bg-panel border-edge relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl"
          >
            <div className="border-edge flex items-center gap-3 border-b px-4 py-3">
              <Search className="text-ink-muted h-4 w-4 shrink-0" />
              <input
                id="command-palette-search"
                autoFocus
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Jump to a product, SKU, or workspace section..."
                className="text-ink placeholder:text-ink-muted flex-1 bg-transparent text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close search"
                className="text-ink-muted hover:text-ink rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              {matchingPages.length > 0 ? (
                <div className="mb-2">
                  <p className="text-ink-muted px-3 py-1.5 text-xs font-medium tracking-wider uppercase">
                    Pages
                  </p>
                  {matchingPages.map((dest) => (
                    <button
                      key={dest.to}
                      type="button"
                      onClick={() => goTo(dest.to)}
                      className="hover:bg-panel-hover flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left transition-colors"
                    >
                      <div>
                        <p className="text-ink text-sm font-medium">{dest.label}</p>
                        <p className="text-ink-muted text-xs">{dest.hint}</p>
                      </div>
                      <ArrowRight className="text-ink-muted h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              ) : null}

              {matchingProducts.length > 0 ? (
                <div>
                  <p className="text-ink-muted px-3 py-1.5 text-xs font-medium tracking-wider uppercase">
                    Products
                  </p>
                  {matchingProducts.map((product) => {
                    const rec = recById.get(product.id);
                    const tone =
                      rec?.urgency === 'critical'
                        ? 'critical'
                        : rec?.urgency === 'warning'
                          ? 'warning'
                          : 'neutral';
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() =>
                          goTo(`/forecasts?productId=${encodeURIComponent(product.id)}`)
                        }
                        className="hover:bg-panel-hover flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Package className="text-ink-muted h-4 w-4 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-ink truncate text-sm font-medium">{product.name}</p>
                            <p className="text-ink-muted text-xs">
                              {product.sku} · {product.currentStock} {product.unit} on hand
                            </p>
                          </div>
                        </div>
                        {rec ? (
                          <Badge tone={tone}>
                            {rec.daysUntilStockout !== null
                              ? `${rec.daysUntilStockout}d left`
                              : 'Healthy'}
                          </Badge>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {matchingPages.length === 0 && matchingProducts.length === 0 ? (
                <p className="text-ink-muted px-4 py-8 text-center text-xs">
                  No matching pages or products for &ldquo;{queryText}&rdquo;.
                </p>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

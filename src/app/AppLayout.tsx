import {
  Activity,
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { useShopData } from '../features/settings/useShopData';
import { useTheme } from '../shared/hooks/useTheme';
import { cn } from '../shared/utils/cn';
import { CommandPalette } from './CommandPalette';

interface NavItemConfig {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
  hasChevron?: boolean;
}

const ROUTE_TITLES: Record<string, string> = {
  '/overview': 'Home',
  '/alerts': 'Inbox',
  '/forecasts': 'Analytics',
  '/inventory': 'Products',
  '/sales': 'Sales & Cleaning',
  '/restock': 'Restock Queue',
  '/settings': 'Settings',
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, activeAlertCount, restockOrders } = useShopData();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  const shopName = profile?.name ?? 'Cornerstone Provisions';
  const shopMonogram = shopName.trim().charAt(0).toUpperCase() || 'S';
  const pendingOrdersCount = restockOrders.filter((o) => o.status === 'ordered').length;
  const pageTitle = ROUTE_TITLES[pathname] ?? 'Overview';

  const primaryItems: NavItemConfig[] = [
    { to: '/overview', label: 'Home', icon: LayoutGrid },
    { to: '/alerts', label: 'Inbox', icon: Bell, badge: activeAlertCount },
    { to: '/forecasts', label: 'Analytics', icon: Activity },
  ];

  const workspaceItems: NavItemConfig[] = [
    { to: '/inventory', label: 'Products', icon: Boxes, hasChevron: true },
    { to: '/sales', label: 'Sales & CSV', icon: ReceiptText },
    {
      to: '/restock',
      label: 'Restock Queue',
      icon: ClipboardList,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
      hasChevron: true,
    },
  ];

  const renderNavItem = (item: NavItemConfig, compact: boolean) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={() => setMobileOpen(false)}
        title={compact ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            'group flex items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors duration-150',
            isActive
              ? 'bg-panel-active text-ink font-medium'
              : 'text-ink-secondary hover:bg-panel-hover hover:text-ink',
          )
        }
      >
        {({ isActive }) => (
          <>
            <span className="flex min-w-0 items-center gap-2.5">
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-ink' : 'text-ink-muted group-hover:text-ink',
                )}
              />
              {!compact ? <span className="truncate">{item.label}</span> : null}
            </span>
            {!compact ? (
              <span className="flex shrink-0 items-center gap-1">
                {item.badge !== undefined && item.badge > 0 ? (
                  <span className="bg-panel-subtle border-edge text-ink rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums">
                    {item.badge}
                  </span>
                ) : null}
                {item.hasChevron && !item.badge ? (
                  <ChevronRight className="text-ink-muted h-3.5 w-3.5 opacity-60" />
                ) : null}
              </span>
            ) : null}
          </>
        )}
      </NavLink>
    );
  };

  const sidebarContent = (compact: boolean) => (
    <div className="flex h-full flex-col justify-between p-3">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2 px-1 pt-0.5">
          <Link
            to="/overview"
            onClick={() => setMobileOpen(false)}
            className="flex min-w-0 items-center gap-2.5"
          >
            <span className="bg-contrast-bg text-contrast-ink flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
              {shopMonogram}
            </span>
            {!compact ? (
              <div className="min-w-0">
                <p className="text-ink truncate text-sm font-semibold tracking-tight">{shopName}</p>
                <p className="text-ink-muted truncate text-xs">
                  {user?.isAnonymous ? 'Demo Workspace' : 'Smart Stock'}
                </p>
              </div>
            ) : null}
          </Link>
          {!compact ? (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                navigate('/settings');
              }}
              aria-label="Shop workspace settings"
              className="text-ink-muted hover:bg-panel-hover hover:text-ink rounded-md p-1 transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              setPaletteOpen(true);
            }}
            title={compact ? 'Search (Ctrl+K)' : undefined}
            className="text-ink-secondary hover:bg-panel-hover hover:text-ink flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Search className="text-ink-muted h-4 w-4 shrink-0" />
              {!compact ? <span>Search</span> : null}
            </span>
            {!compact ? (
              <kbd className="bg-panel-subtle border-edge text-ink-muted rounded border px-1.5 py-0.5 font-mono text-xs">
                ⌘K
              </kbd>
            ) : null}
          </button>

          {primaryItems.map((item) => renderNavItem(item, compact))}
        </div>

        <div>
          {!compact ? (
            <p className="text-ink-muted mb-1.5 px-2.5 text-xs font-medium tracking-wider uppercase">
              Workspace
            </p>
          ) : null}
          <div className="space-y-1">
            {workspaceItems.map((item) => renderNavItem(item, compact))}
          </div>
        </div>
      </div>

      <div className="border-edge space-y-1 border-t pt-3">
        <button
          type="button"
          onClick={toggleTheme}
          title={compact ? 'Toggle color theme' : undefined}
          className="text-ink-secondary hover:bg-panel-hover hover:text-ink flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors"
        >
          <span className="flex items-center gap-2.5">
            {resolvedTheme === 'dark' ? (
              <Sun className="text-ink-muted h-4 w-4 shrink-0" />
            ) : (
              <Moon className="text-ink-muted h-4 w-4 shrink-0" />
            )}
            {!compact ? <span>{resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}</span> : null}
          </span>
        </button>

        {renderNavItem({ to: '/settings', label: 'Settings', icon: Settings }, compact)}

        <button
          type="button"
          onClick={() => void signOut()}
          title={compact ? 'Log out' : undefined}
          className="text-ink-secondary hover:bg-panel-hover hover:text-ink flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors"
        >
          <LogOut className="text-ink-muted h-4 w-4 shrink-0" />
          {!compact ? <span>Log out</span> : null}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-canvas text-ink flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'bg-sidebar border-edge sticky top-0 hidden h-screen shrink-0 border-r transition-all duration-200 lg:block',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        {sidebarContent(collapsed)}
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.18 }}
              className="bg-sidebar border-edge relative z-10 h-full w-64 border-r"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="text-ink-muted hover:text-ink absolute top-3.5 right-3 rounded-lg p-1.5"
              >
                <X className="h-4 w-4" />
              </button>
              {sidebarContent(false)}
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-edge bg-canvas/90 sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="text-ink-secondary hover:bg-panel-hover hover:text-ink rounded-lg p-1.5 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="text-ink-muted hover:bg-panel-hover hover:text-ink hidden cursor-pointer rounded-lg p-1.5 transition-colors lg:inline-flex"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
              <span className="text-ink-muted hidden truncate sm:inline">{shopName}</span>
              <span className="text-ink-muted hidden sm:inline">/</span>
              <span className="text-ink truncate font-medium">{pageTitle}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="bg-panel-subtle border-edge text-ink-muted hover:border-edge-strong hover:text-ink hidden h-8 w-52 cursor-pointer items-center justify-between rounded-lg border px-3 text-xs transition-colors sm:flex md:w-64"
            >
              <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                <span>Quick search...</span>
              </span>
              <span className="font-mono">Ctrl+K</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/alerts')}
              aria-label="Open alerts inbox"
              className="bg-panel-subtle border-edge text-ink-secondary hover:bg-panel-hover hover:text-ink relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition-colors"
            >
              <Bell className="h-3.5 w-3.5" />
              {activeAlertCount > 0 ? (
                <span className="bg-ink absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full" />
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => navigate('/settings')}
              title={user?.email ?? 'Demo Shop Account'}
              aria-label="Account & settings"
              className="bg-panel-subtle border-edge text-ink hover:border-edge-strong flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-xs font-semibold transition-colors"
            >
              {shopMonogram}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
          {children}
        </main>
      </div>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

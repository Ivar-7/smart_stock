import { BellRing, Download, Monitor, Moon, RefreshCw, Sun } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toAppError } from '../../../shared/errors';
import { useTheme } from '../../../shared/hooks/useTheme';
import { Button } from '../../../shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { FieldLabel, Input, Select } from '../../../shared/ui/FormFields';
import { Modal } from '../../../shared/ui/Modal';
import { ErrorState, LoadingSkeleton } from '../../../shared/ui/StateViews';
import { useToast } from '../../../shared/ui/useToast';
import { todayIsoDate } from '../../../shared/utils/date';
import type { SupportedCurrency } from '../../../shared/utils/format';
import { updateShopSettings } from '../settings.api';
import { shopSettingsSchema } from '../settings.schema';
import { useShopData } from '../useShopData';

export function SettingsPage() {
  const {
    shopId,
    profile,
    products,
    suppliers,
    sales,
    restockOrders,
    isLoading,
    isSeeding,
    error,
    runSeedSampleShop,
    retrySync,
  } = useShopData();
  const { preference, setPreference } = useTheme();
  const { pushToast } = useToast();

  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftCurrency, setDraftCurrency] = useState<SupportedCurrency | null>(null);
  const [draftServiceLevel, setDraftServiceLevel] = useState<string | null>(null);
  const [draftReviewCycle, setDraftReviewCycle] = useState<string | null>(null);
  const [draftBulkMult, setDraftBulkMult] = useState<string | null>(null);
  const [draftBrowserAlerts, setDraftBrowserAlerts] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const name = draftName ?? profile?.name ?? 'Cornerstone Provisions';
  const currency = draftCurrency ?? profile?.currency ?? 'USD';
  const serviceLevel = draftServiceLevel ?? String(profile?.serviceLevelTarget ?? 0.95);
  const reviewCycle = draftReviewCycle ?? String(profile?.defaultReviewCycleDays ?? 7);
  const bulkMult = draftBulkMult ?? String(profile?.bulkMultiplierThreshold ?? 3.5);
  const browserAlerts = draftBrowserAlerts ?? profile?.browserAlertsEnabled ?? false;

  const setName = (val: string) => setDraftName(val);
  const setCurrency = (val: SupportedCurrency) => setDraftCurrency(val);
  const setServiceLevel = (val: string) => setDraftServiceLevel(val);
  const setReviewCycle = (val: string) => setDraftReviewCycle(val);
  const setBulkMult = (val: string) => setDraftBulkMult(val);
  const setBrowserAlerts = (val: boolean) => setDraftBrowserAlerts(val);

  const handleToggleBrowserAlerts = async (enabled: boolean) => {
    if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        pushToast({
          title: 'Browser notification permission denied',
          description:
            'Enable notifications in your browser site settings if you want desktop alerts.',
          tone: 'info',
        });
        setBrowserAlerts(false);
        return;
      }
    }
    setBrowserAlerts(enabled);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = shopSettingsSchema.safeParse({
      name: name.trim(),
      currency,
      serviceLevelTarget: Number(serviceLevel),
      defaultReviewCycleDays: Number(reviewCycle),
      bulkMultiplierThreshold: Number(bulkMult),
      browserAlertsEnabled: browserAlerts,
    });

    if (!parsed.success) {
      pushToast({
        title: 'Invalid settings',
        description: parsed.error.issues[0]?.message ?? 'Check fields and try again.',
        tone: 'error',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateShopSettings(shopId, parsed.data);
      pushToast({
        title: 'Shop settings saved',
        description: 'Reorder points and forecasts recalculated.',
        tone: 'success',
      });
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

  const handleExportBackupJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      suppliers,
      products,
      sales,
      restockOrders,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-stock-backup-${todayIsoDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return <ErrorState message={error.userMessage} onRetry={retrySync} />;
  }

  if (isLoading) {
    return <LoadingSkeleton rows={4} label="Loading shop settings..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-xs font-medium tracking-widest uppercase">
          Workspace Configuration
        </p>
        <h1 className="text-ink mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <div>
              <CardTitle>Shop Profile &amp; Forecasting Rules</CardTitle>
              <CardDescription>
                Tune safety buffers, order cycles, and bulk-order separation sensitivity
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="set-name">Shop name</FieldLabel>
                  <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <FieldLabel htmlFor="set-currency">Display currency</FieldLabel>
                  <Select
                    id="set-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="KES">KES (KSh)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <FieldLabel htmlFor="set-sl">Target service level</FieldLabel>
                  <Select
                    id="set-sl"
                    value={serviceLevel}
                    onChange={(e) => setServiceLevel(e.target.value)}
                  >
                    <option value="0.9">90% (Lean buffer)</option>
                    <option value="0.92">92% (Balanced)</option>
                    <option value="0.95">95% (Recommended)</option>
                    <option value="0.97">97% (High safety)</option>
                    <option value="0.99">99% (Zero stockout)</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel htmlFor="set-cycle">Restock cycle (days)</FieldLabel>
                  <Input
                    id="set-cycle"
                    type="number"
                    min="1"
                    max="30"
                    value={reviewCycle}
                    onChange={(e) => setReviewCycle(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="set-bulk" hint="x median tx">
                    Bulk multiplier
                  </FieldLabel>
                  <Input
                    id="set-bulk"
                    type="number"
                    min="2"
                    max="10"
                    step="0.5"
                    value={bulkMult}
                    onChange={(e) => setBulkMult(e.target.value)}
                  />
                </div>
              </div>

              <label
                htmlFor="set-browser-alerts"
                className="bg-panel-subtle border-edge flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4"
              >
                <div className="flex items-center gap-3">
                  <BellRing className="text-ink-secondary h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-ink text-sm font-medium">Desktop Stockout Notifications</p>
                    <p className="text-ink-muted text-xs">
                      Send browser notifications when urgent stockout alerts appear
                    </p>
                  </div>
                </div>
                <input
                  id="set-browser-alerts"
                  type="checkbox"
                  checked={browserAlerts}
                  onChange={(e) => void handleToggleBrowserAlerts(e.target.checked)}
                  className="h-4 w-4 rounded accent-zinc-900 dark:accent-zinc-100"
                />
              </label>

              <div className="flex justify-end">
                <Button type="submit" variant="primary" isLoading={isSaving}>
                  Save settings
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Full light and dark theme support across every view
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark', icon: Moon },
                    { id: 'system', label: 'System', icon: Monitor },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = preference === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPreference(item.id)}
                      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border py-3 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-panel-active border-edge-strong text-ink'
                          : 'bg-panel-subtle border-edge text-ink-secondary hover:text-ink'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Backup &amp; Production Seed Data</CardTitle>
                <CardDescription>
                  Download your ledger or reset to the Cornerstone Provisions dataset
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleExportBackupJson}
                leftIcon={<Download className="h-4 w-4" />}
              >
                Export Shop Backup (JSON)
              </Button>
              <Button
                variant="danger"
                className="w-full"
                isLoading={isSeeding}
                onClick={() => setResetModalOpen(true)}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Reset &amp; Re-Seed Sample Shop
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        maxWidth="md"
        title="Reset workspace to sample data?"
        description="This replaces your current products, sales, suppliers, and orders in Firestore with the fresh 16-item Cornerstone Provisions 90-day seed dataset."
      >
        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="ghost" onClick={() => setResetModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isSeeding}
            onClick={async () => {
              setResetModalOpen(false);
              await runSeedSampleShop(true);
            }}
          >
            Confirm Reset &amp; Seed
          </Button>
        </div>
      </Modal>
    </div>
  );
}

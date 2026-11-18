import { ArrowRight, Boxes, Moon, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTheme } from '../../../shared/hooks/useTheme';
import { Button } from '../../../shared/ui/Button';
import { Card, CardContent } from '../../../shared/ui/Card';
import { FieldError, FieldLabel, Input } from '../../../shared/ui/FormFields';
import { signInSchema, signUpSchema } from '../auth.schema';
import { useAuth } from '../useAuth';

export function AuthPage() {
  const { signInEmail, signUpEmail, signInGoogle, signInDemo, isBusy, error, clearError } =
    useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [seedSampleData, setSeedSampleData] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setFieldErrors({});

    if (mode === 'signin') {
      const parsed = signInSchema.safeParse({ email, password });
      if (!parsed.success) {
        const nextErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? 'form');
          nextErrors[key] = issue.message;
        }
        setFieldErrors(nextErrors);
        return;
      }
      await signInEmail(parsed.data.email, parsed.data.password).catch(() => undefined);
      return;
    }

    const parsed = signUpSchema.safeParse({ email, password, shopName });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }
    await signUpEmail(
      parsed.data.email,
      parsed.data.password,
      parsed.data.shopName,
      seedSampleData,
    ).catch(() => undefined);
  };

  return (
    <div className="bg-canvas text-ink relative flex min-h-screen w-full flex-col justify-between p-6 sm:p-10">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-contrast-bg text-contrast-ink flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold">
            S
          </span>
          <div>
            <p className="text-ink text-sm font-semibold tracking-tight">Smart Stock</p>
            <p className="text-ink-muted text-xs">Shop Demand &amp; Restock Intelligence</p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={toggleTheme}
          leftIcon={
            resolvedTheme === 'dark' ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )
          }
        >
          {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
        </Button>
      </header>

      <main className="mx-auto my-10 grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <section className="space-y-6 lg:col-span-6">
          <p className="text-ink-muted text-xs font-medium tracking-widest uppercase">
            Built for Independent Shops
          </p>
          <h1 className="text-ink text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Know what sells next, before shelves run bare.
          </h1>
          <p className="text-ink-secondary max-w-xl text-sm leading-relaxed sm:text-base">
            Smart Stock separates wholesale bulk orders and weekend promotions from everyday retail
            velocity, protects perishable shelf life, and tells you in plain English when and how
            much to reorder.
          </p>

          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
            <div className="bg-panel border-edge rounded-xl border p-4">
              <div className="text-ink flex items-center gap-2 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Adaptive Forecasting</span>
              </div>
              <p className="text-ink-muted mt-1.5 text-xs leading-relaxed">
                Holt-Winters 7-day seasonal smoothing paired with Croston&apos;s SBA for slow
                movers.
              </p>
            </div>
            <div className="bg-panel border-edge rounded-xl border p-4">
              <div className="text-ink flex items-center gap-2 text-xs font-semibold">
                <Boxes className="h-3.5 w-3.5" />
                <span>Perishable &amp; Bulk Safe</span>
              </div>
              <p className="text-ink-muted mt-1.5 text-xs leading-relaxed">
                Caps fresh orders by shelf life and isolates one-off B2B buys from baseline trends.
              </p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6">
          <Card className="mx-auto w-full max-w-md">
            <CardContent className="p-6 sm:p-8">
              <div className="bg-panel-subtle border-edge mb-6 flex rounded-xl border p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setFieldErrors({});
                    clearError();
                  }}
                  className={`flex-1 cursor-pointer rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    mode === 'signin'
                      ? 'bg-panel text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setFieldErrors({});
                    clearError();
                  }}
                  className={`flex-1 cursor-pointer rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    mode === 'signup'
                      ? 'bg-panel text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Create shop
                </button>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-600 dark:text-rose-300"
                >
                  {error.userMessage}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' ? (
                  <div>
                    <FieldLabel htmlFor="shopName">Shop name</FieldLabel>
                    <Input
                      id="shopName"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="Cornerstone Provisions"
                      autoComplete="organization"
                    />
                    <FieldError message={fieldErrors.shopName} />
                  </div>
                ) : null}

                <div>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@yourshop.com"
                    autoComplete="email"
                  />
                  <FieldError message={fieldErrors.email} />
                </div>

                <div>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  />
                  <FieldError message={fieldErrors.password} />
                </div>

                {mode === 'signup' ? (
                  <label
                    htmlFor="signup-seed-sample"
                    className="bg-panel-subtle border-edge flex cursor-pointer items-start gap-2.5 rounded-lg border p-3"
                  >
                    <input
                      id="signup-seed-sample"
                      type="checkbox"
                      checked={seedSampleData}
                      onChange={(e) => setSeedSampleData(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded accent-zinc-900 dark:accent-zinc-100"
                    />
                    <span className="text-ink-secondary text-xs leading-snug">
                      Pre-load 16 realistic products, 4 suppliers &amp; 90 days of POS sales history
                      so forecasts run immediately.
                    </span>
                  </label>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isBusy}
                  className="w-full"
                >
                  {mode === 'signin' ? 'Sign in to shop' : 'Create shop workspace'}
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="bg-edge h-px flex-1" />
                <span className="text-ink-muted text-xs">or</span>
                <div className="bg-edge h-px flex-1" />
              </div>

              <div className="space-y-2.5">
                <Button
                  variant="secondary"
                  size="md"
                  disabled={isBusy}
                  onClick={() => void signInGoogle().catch(() => undefined)}
                  className="w-full"
                >
                  Continue with Google
                </Button>

                <Button
                  variant="ghost"
                  size="md"
                  disabled={isBusy}
                  onClick={() => void signInDemo().catch(() => undefined)}
                  rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                  className="border-edge w-full border border-dashed"
                >
                  Explore Live Seeded Shop Demo
                </Button>
              </div>

              <div className="text-ink-muted mt-5 flex items-center justify-center gap-1.5 text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Isolated Firebase shop data secured per account</span>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="text-ink-muted mx-auto flex w-full max-w-6xl items-center justify-between text-xs">
        <span>Smart Stock · Forecast &amp; Restock System</span>
        <span>All calculations run securely on your shop ledger</span>
      </footer>
    </div>
  );
}

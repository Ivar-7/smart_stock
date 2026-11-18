import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export function LoadingSkeleton({
  rows = 4,
  label = 'Loading shop workspace...',
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className="space-y-4" role="status" aria-label={label}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="bg-panel border-edge h-36 animate-pulse rounded-xl border p-5">
            <div className="bg-panel-subtle h-3 w-24 rounded" />
            <div className="bg-panel-subtle mt-5 h-7 w-28 rounded" />
            <div className="bg-panel-subtle mt-3 h-3 w-36 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-panel border-edge space-y-3 rounded-xl border p-5">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="bg-panel-subtle h-10 w-full animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-panel border-edge flex flex-col items-center justify-center rounded-xl border px-6 py-12 text-center">
      <div className="bg-panel-subtle border-edge text-ink-muted mb-3 flex h-11 w-11 items-center justify-center rounded-xl border">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-ink text-sm font-semibold">{title}</h3>
      <p className="text-ink-muted mt-1 max-w-md text-xs leading-relaxed">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Unable to load this section',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="bg-panel flex flex-col items-center justify-center rounded-xl border border-rose-500/30 px-6 py-10 text-center"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-500">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-ink text-sm font-semibold">{title}</h3>
      <p className="text-ink-secondary mt-1 max-w-md text-xs leading-relaxed">{message}</p>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          className="mt-4"
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}

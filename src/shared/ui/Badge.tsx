import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

export type BadgeTone = 'neutral' | 'healthy' | 'warning' | 'critical' | 'info';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-panel-subtle text-ink-secondary border-edge',
  healthy: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
  critical: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
  info: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

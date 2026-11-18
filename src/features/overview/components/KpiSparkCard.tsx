import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Sparkline } from '../../../shared/charts/Sparkline';
import { Card } from '../../../shared/ui/Card';
import { cn } from '../../../shared/utils/cn';

interface KpiSparkCardProps {
  title: string;
  value: string;
  deltaText: string;
  deltaTone: 'positive' | 'negative' | 'neutral';
  sparkValues: readonly number[];
}

export function KpiSparkCard({
  title,
  value,
  deltaText,
  deltaTone,
  sparkValues,
}: KpiSparkCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-ink-muted text-xs font-medium">{title}</p>
          <p className="text-ink mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
            {value}
          </p>
          <div
            className={cn(
              'mt-2 inline-flex items-center gap-1 text-xs font-medium',
              deltaTone === 'positive'
                ? 'text-emerald-600 dark:text-emerald-400'
                : deltaTone === 'negative'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-ink-secondary',
            )}
          >
            {deltaTone === 'positive' ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : deltaTone === 'negative' ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
            ) : null}
            <span>{deltaText}</span>
          </div>
        </div>
        <div className="pt-3">
          <Sparkline values={sparkValues} />
        </div>
      </div>
    </Card>
  );
}

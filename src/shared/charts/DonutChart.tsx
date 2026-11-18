export interface DonutSegment {
  label: string;
  value: number;
  formattedValue: string;
}

interface DonutChartProps {
  segments: readonly DonutSegment[];
  centerCaption: string;
  centerTotal: string;
}

const SEGMENT_SHADES = [
  'var(--ss-series-primary)',
  'var(--ss-series-secondary)',
  'var(--ss-series-tertiary)',
  'var(--ss-ink-muted)',
  'var(--ss-edge-strong)',
] as const;

export function DonutChart({ segments, centerCaption, centerTotal }: DonutChartProps) {
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const cx = 90;
  const cy = 90;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--ss-gauge-track)"
            strokeWidth="24"
          />
          {total > 0
            ? segments.map((seg, idx) => {
                const share = Math.max(0, seg.value) / total;
                const arcLen = Math.max(0, share * circumference - 2.5);
                const offset = -cumulativeOffset * circumference;
                cumulativeOffset += share;
                if (arcLen <= 0.5) {
                  return null;
                }
                return (
                  <circle
                    key={seg.label}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke={SEGMENT_SHADES[idx % SEGMENT_SHADES.length]}
                    strokeWidth="24"
                    strokeDasharray={`${arcLen.toFixed(2)} ${circumference.toFixed(2)}`}
                    strokeDashoffset={offset.toFixed(2)}
                  />
                );
              })
            : null}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-ink-muted text-xs">{centerCaption}</span>
          <span className="text-ink mt-0.5 text-lg font-semibold tracking-tight tabular-nums">
            {centerTotal}
          </span>
        </div>
      </div>

      <div className="w-full max-w-md flex-1 space-y-2.5">
        {segments.map((seg, idx) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div
              key={seg.label}
              className="flex items-center justify-between gap-4 text-xs sm:text-sm"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-xs"
                  style={{ backgroundColor: SEGMENT_SHADES[idx % SEGMENT_SHADES.length] }}
                />
                <span className="text-ink-secondary truncate">{seg.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3 tabular-nums">
                <span className="text-ink font-medium">{seg.formattedValue}</span>
                <span className="text-ink-muted w-9 text-right">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

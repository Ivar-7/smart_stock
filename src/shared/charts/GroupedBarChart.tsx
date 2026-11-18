import { useState } from 'react';
import { formatCompactNumber } from '../utils/format';

export interface GroupedBarBucket {
  label: string;
  values: [number, number, number];
}

interface GroupedBarChartProps {
  buckets: readonly GroupedBarBucket[];
  seriesLabels: [string, string, string];
  unit?: string;
}

const SERIES_COLORS = [
  'var(--ss-series-primary)',
  'var(--ss-series-secondary)',
  'var(--ss-series-tertiary)',
] as const;

export function GroupedBarChart({ buckets, seriesLabels, unit = 'units' }: GroupedBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (buckets.length === 0) {
    return (
      <div className="text-ink-muted flex h-56 items-center justify-center text-xs">
        No grouped demand bars available yet.
      </div>
    );
  }

  const width = 520;
  const height = 240;
  const padLeft = 38;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(4, ...buckets.flatMap((b) => b.values));
  const yMax = Math.ceil(maxVal * 1.15);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t));

  const groupWidth = plotW / buckets.length;
  const barWidth = Math.min(11, Math.max(5, groupWidth * 0.17));
  const barGap = 4;

  const activeBucket = hoveredIdx !== null ? buckets[hoveredIdx] : null;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {seriesLabels.map((label, idx) => (
            <span key={label} className="text-ink-secondary inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: SERIES_COLORS[idx] }}
              />
              {label}
            </span>
          ))}
        </div>
        {activeBucket ? (
          <div className="text-ink-secondary text-xs tabular-nums">
            <span className="text-ink font-medium">{activeBucket.label}: </span>
            {activeBucket.values.map((v, idx) => (
              <span key={seriesLabels[idx]} className="ml-2">
                {seriesLabels[idx]} {Math.round(v)} {unit}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full overflow-visible sm:h-64"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {yTicks.map((tickVal, idx) => {
          const y = padTop + plotH - (tickVal / Math.max(yMax, 1)) * plotH;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="var(--ss-edge)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                fill="var(--ss-ink-muted)"
                fontSize="10.5"
              >
                {formatCompactNumber(tickVal)}
              </text>
            </g>
          );
        })}

        {buckets.map((bucket, idx) => {
          const groupCenter = padLeft + groupWidth * (idx + 0.5);
          const totalBarsW = barWidth * 3 + barGap * 2;
          const startX = groupCenter - totalBarsW / 2;

          return (
            <g
              key={bucket.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              className="cursor-pointer"
            >
              <rect
                x={padLeft + groupWidth * idx}
                y={padTop}
                width={groupWidth}
                height={plotH}
                fill={hoveredIdx === idx ? 'var(--ss-panel-subtle)' : 'transparent'}
                rx="6"
              />
              {bucket.values.map((val, barIdx) => {
                const rawH = (Math.max(0, val) / Math.max(yMax, 1)) * plotH;
                const barH = val > 0 ? Math.max(3, rawH) : 0;
                const x = startX + barIdx * (barWidth + barGap);
                const y = padTop + plotH - barH;
                return (
                  <rect
                    key={barIdx}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx={barWidth / 2}
                    fill={SERIES_COLORS[barIdx]}
                  />
                );
              })}
              <text
                x={groupCenter}
                y={height - 6}
                textAnchor="middle"
                fill="var(--ss-ink-muted)"
                fontSize="10.5"
              >
                {bucket.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

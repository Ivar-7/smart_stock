import { useId, useState } from 'react';
import { formatCompactNumber } from '../utils/format';

export interface DualSeriesPoint {
  label: string;
  sublabel?: string;
  primary: number;
  secondary?: number | null;
  bandLow?: number | null;
  bandHigh?: number | null;
  marker?: 'promo' | 'bulk' | 'anomaly' | null;
}

interface ForecastAreaChartProps {
  points: readonly DualSeriesPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  splitIndex?: number;
  valueUnit?: string;
}

function buildSmoothLinePath(pts: ReadonlyArray<{ x: number; y: number }>): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;

  let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function ForecastAreaChart({
  points,
  primaryLabel,
  secondaryLabel,
  splitIndex,
  valueUnit = 'units',
}: ForecastAreaChartProps) {
  const uid = useId().replace(/:/g, '');
  const areaGradId = `area-grad-${uid}`;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="text-ink-muted flex h-56 items-center justify-center text-xs">
        Not enough history points to render chart yet.
      </div>
    );
  }

  const width = 760;
  const height = 250;
  const padLeft = 46;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allValues: number[] = [];
  for (const pt of points) {
    allValues.push(pt.primary);
    if (pt.secondary !== undefined && pt.secondary !== null) {
      allValues.push(pt.secondary);
    }
    if (pt.bandHigh !== undefined && pt.bandHigh !== null) {
      allValues.push(pt.bandHigh);
    }
  }
  const rawMax = Math.max(...allValues, 4);
  const yMax = Math.ceil(rawMax * 1.15);

  const xForIndex = (idx: number) => padLeft + (idx / Math.max(points.length - 1, 1)) * plotW;
  const yForValue = (val: number) =>
    padTop + plotH - (Math.max(0, val) / Math.max(yMax, 1)) * plotH;

  const primaryCoords = points.map((pt, idx) => ({
    x: xForIndex(idx),
    y: yForValue(pt.primary),
  }));
  const primaryPath = buildSmoothLinePath(primaryCoords);
  const areaPath = `${primaryPath} L ${primaryCoords[primaryCoords.length - 1]!.x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${primaryCoords[0]!.x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

  const secondarySegments: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < points.length; i += 1) {
    const sec = points[i]!.secondary;
    if (sec !== undefined && sec !== null) {
      secondarySegments.push({ x: xForIndex(i), y: yForValue(sec) });
    }
  }
  const secondaryPath = secondarySegments.length >= 2 ? buildSmoothLinePath(secondarySegments) : '';

  // Optional confidence band polygon
  const bandPoints = points
    .map((pt, idx) => ({ pt, idx }))
    .filter(
      (entry) =>
        entry.pt.bandLow !== undefined &&
        entry.pt.bandLow !== null &&
        entry.pt.bandHigh !== undefined &&
        entry.pt.bandHigh !== null,
    );
  const bandPolygon =
    bandPoints.length >= 2
      ? [
          ...bandPoints.map(
            (e) => `${xForIndex(e.idx).toFixed(1)},${yForValue(e.pt.bandHigh!).toFixed(1)}`,
          ),
          ...[...bandPoints]
            .reverse()
            .map((e) => `${xForIndex(e.idx).toFixed(1)},${yForValue(e.pt.bandLow!).toFixed(1)}`),
        ].join(' ')
      : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t));
  const labelStep = Math.max(1, Math.floor(points.length / 6));

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;
  const activeCoord = hoveredIdx !== null ? primaryCoords[hoveredIdx] : null;

  return (
    <div className="relative w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-ink inline-flex items-center gap-1.5">
            <span className="bg-series-primary h-2 w-2 rounded-full" />
            {primaryLabel}
          </span>
          {secondaryLabel ? (
            <span className="text-ink-muted inline-flex items-center gap-1.5">
              <span className="bg-series-secondary h-2 w-2 rounded-full" />
              {secondaryLabel}
            </span>
          ) : null}
          {bandPoints.length >= 2 ? (
            <span className="text-ink-muted inline-flex items-center gap-1.5">
              <span className="bg-panel-hover border-edge-strong h-2.5 w-3 rounded-xs border" />
              80% Confidence Band
            </span>
          ) : null}
        </div>
        {activePoint ? (
          <div className="text-ink-secondary flex flex-wrap items-center gap-3 text-xs tabular-nums">
            <span className="text-ink font-medium">
              {activePoint.sublabel ?? activePoint.label}
            </span>
            <span>
              {primaryLabel}: <strong className="text-ink">{activePoint.primary.toFixed(1)}</strong>{' '}
              {valueUnit}
            </span>
            {activePoint.secondary !== undefined && activePoint.secondary !== null ? (
              <span>
                {secondaryLabel}:{' '}
                <strong className="text-ink">{activePoint.secondary.toFixed(1)}</strong> {valueUnit}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full overflow-visible sm:h-64"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ss-series-primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--ss-series-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tickVal, idx) => {
          const y = yForValue(tickVal);
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

        {splitIndex !== undefined && splitIndex > 0 && splitIndex < points.length ? (
          <g>
            <line
              x1={xForIndex(splitIndex)}
              y1={padTop}
              x2={xForIndex(splitIndex)}
              y2={padTop + plotH}
              stroke="var(--ss-edge-strong)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <text
              x={xForIndex(splitIndex) + 6}
              y={padTop + 11}
              fill="var(--ss-ink-muted)"
              fontSize="10"
            >
              Forecast →
            </text>
          </g>
        ) : null}

        {bandPolygon ? (
          <polygon points={bandPolygon} fill="var(--ss-series-secondary)" fillOpacity="0.13" />
        ) : null}

        <path d={areaPath} fill={`url(#${areaGradId})`} />

        {secondaryPath ? (
          <path
            d={secondaryPath}
            fill="none"
            stroke="var(--ss-series-secondary)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ) : null}

        <path
          d={primaryPath}
          fill="none"
          stroke="var(--ss-series-primary)"
          strokeWidth="2.1"
          strokeLinecap="round"
        />

        {points.map((pt, idx) => {
          const x = xForIndex(idx);
          const y = yForValue(pt.primary);
          if (!pt.marker) {
            return null;
          }
          const markerFill =
            pt.marker === 'anomaly' ? '#f43f5e' : pt.marker === 'bulk' ? '#f59e0b' : '#10b981';
          return (
            <circle
              key={`mk-${idx}`}
              cx={x}
              cy={y}
              r="3.6"
              fill={markerFill}
              stroke="var(--ss-panel)"
              strokeWidth="1.5"
            />
          );
        })}

        {points.map((pt, idx) => {
          const showLabel = idx === 0 || idx === points.length - 1 || idx % labelStep === 0;
          if (!showLabel) {
            return null;
          }
          return (
            <text
              key={`xl-${idx}`}
              x={xForIndex(idx)}
              y={height - 6}
              textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
              fill="var(--ss-ink-muted)"
              fontSize="10.5"
            >
              {pt.label}
            </text>
          );
        })}

        {activeCoord ? (
          <g>
            <line
              x1={activeCoord.x}
              y1={padTop}
              x2={activeCoord.x}
              y2={padTop + plotH}
              stroke="var(--ss-edge-strong)"
              strokeWidth="1"
            />
            <circle
              cx={activeCoord.x}
              cy={activeCoord.y}
              r="4"
              fill="var(--ss-series-primary)"
              stroke="var(--ss-panel)"
              strokeWidth="2"
            />
          </g>
        ) : null}

        {points.map((_, idx) => {
          const sliceW = plotW / Math.max(points.length, 1);
          return (
            <rect
              key={`hit-${idx}`}
              x={xForIndex(idx) - sliceW / 2}
              y={padTop}
              width={Math.max(sliceW, 6)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(idx)}
            />
          );
        })}
      </svg>
    </div>
  );
}

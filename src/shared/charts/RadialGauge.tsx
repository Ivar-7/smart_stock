import { useId } from 'react';
import { motion } from 'motion/react';

interface RadialGaugeProps {
  valuePercent: number;
  ringText: string;
  label: string;
  sublabel: string;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function describeClockwiseArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const clampedAngle = Math.min(359.5, Math.max(0.5, endAngle - startAngle));
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle + clampedAngle);
  const largeArcFlag = clampedAngle > 180 ? '1' : '0';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function RadialGauge({ valuePercent, ringText, label, sublabel }: RadialGaugeProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `gauge-grad-${uid}`;
  const textPathId = `gauge-text-${uid}`;

  const clampedPct = Math.min(100, Math.max(0, Math.round(valuePercent)));
  const cx = 110;
  const cy = 110;
  const ringRadius = 74;
  const outerTextRadius = 93;

  const sweepDeg = (clampedPct / 100) * 360;
  const knobPos = polarToCartesian(cx, cy, ringRadius, Math.max(2, Math.min(358, sweepDeg)));

  // Build circular path starting at top (12 o'clock) for outer curved ring typography
  const textCirclePath = [
    `M ${cx} ${cy - outerTextRadius}`,
    `A ${outerTextRadius} ${outerTextRadius} 0 1 1 ${(cx - 0.1).toFixed(2)} ${cy - outerTextRadius}`,
  ].join(' ');

  const repeatedRingText = `${ringText} · ${ringText} ·`;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative h-44 w-44 sm:h-48 sm:w-48">
        <svg viewBox="0 0 220 220" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0.85" y1="0.1" x2="0.15" y2="0.9">
              <stop offset="0%" stopColor="var(--ss-gauge-lavender)" />
              <stop offset="52%" stopColor="var(--ss-gauge-sand)" />
              <stop offset="100%" stopColor="var(--ss-gauge-mint)" />
            </linearGradient>
            <path id={textPathId} d={textCirclePath} fill="none" />
          </defs>

          <text fill="var(--ss-ink-muted)" fontSize="6.8" fontWeight="500">
            <textPath
              href={`#${textPathId}`}
              startOffset="0.5%"
              textLength="564"
              lengthAdjust="spacing"
            >
              {repeatedRingText}
            </textPath>
          </text>

          <circle
            cx={cx}
            cy={cy}
            r={ringRadius}
            fill="none"
            stroke="var(--ss-gauge-track)"
            strokeWidth="12"
          />

          {clampedPct > 0 ? (
            <motion.path
              d={describeClockwiseArc(cx, cy, ringRadius, 0, sweepDeg)}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="12"
              strokeLinecap="round"
              initial={{ pathLength: 0.25, opacity: 0.6 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          ) : null}

          {clampedPct > 0 ? (
            <g>
              <circle cx={knobPos.x} cy={knobPos.y} r="7.5" fill="var(--ss-panel)" />
              <circle
                cx={knobPos.x}
                cy={knobPos.y}
                r="5.2"
                fill="#ffffff"
                stroke="var(--ss-edge-strong)"
                strokeWidth="1"
              />
            </g>
          ) : null}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-baseline gap-0.5 tabular-nums">
            <span className="text-ink text-3xl font-semibold tracking-tight">{clampedPct}</span>
            <span className="text-ink-secondary text-sm font-medium">%</span>
          </div>
        </div>
      </div>

      <p className="text-ink mt-1 text-sm font-medium tracking-tight">{label}</p>
      <p className="text-ink-muted mt-0.5 text-xs">{sublabel}</p>
    </div>
  );
}

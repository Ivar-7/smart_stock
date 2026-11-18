interface SparklineProps {
  values: readonly number[];
  className?: string;
}

export function Sparkline({ values, className }: SparklineProps) {
  if (values.length < 2) {
    return null;
  }

  const width = 112;
  const height = 34;
  const padY = 4;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = Math.max(maxVal - minVal, 1e-3);

  const coords = values.map((v, idx) => {
    const x = (idx / (values.length - 1)) * (width - 4) + 2;
    const y = height - padY - ((v - minVal) / span) * (height - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className ?? 'h-8 w-24 shrink-0'}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="var(--ss-series-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(' ')}
      />
    </svg>
  );
}

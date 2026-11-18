export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  return denominator === 0 ? fallback : numerator / denominator;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function medianAbsoluteDeviation(values: readonly number[], center?: number): number {
  if (values.length === 0) {
    return 0;
  }
  const med = center ?? median(values);
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations);
}

export function meanAbsoluteDeviation(values: readonly number[], center?: number): number {
  if (values.length === 0) {
    return 0;
  }
  const avg = center ?? mean(values);
  return mean(values.map((v) => Math.abs(v - avg)));
}

export function stdDev(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const avg = mean(values);
  let sumSq = 0;
  for (const v of values) {
    const diff = v - avg;
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq / (values.length - 1));
}

export function modifiedZScore(value: number, baselineValues: readonly number[]): number {
  if (baselineValues.length < 4) {
    return 0;
  }
  const med = median(baselineValues);
  const mad = medianAbsoluteDeviation(baselineValues, med);
  if (mad > 0) {
    return (0.6745 * (value - med)) / mad;
  }
  // Fallback when >50% of points are identical (MAD = 0)
  const meanAd = meanAbsoluteDeviation(baselineValues, med);
  if (meanAd === 0) {
    return 0;
  }
  return (value - med) / (1.2533 * meanAd);
}

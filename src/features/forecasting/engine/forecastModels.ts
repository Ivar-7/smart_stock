import { addDaysIso, getDayOfWeekIndex } from '../../../shared/utils/date';
import type { ForecastHorizonPoint, ForecastModelName } from '../forecasting.types';
import { clamp, mean, stdDev } from './stats';

export interface FittedForecastOutput {
  modelUsed: ForecastModelName;
  modelLabel: string;
  fittedValues: number[];
  horizon: ForecastHorizonPoint[];
  residualStdDev: number;
  trendSlopePerDay: number;
}

const SEASONAL_PERIOD = 7;

function buildConfidenceIntervals(
  startDate: string,
  pointForecasts: readonly number[],
  residualSigma: number,
): ForecastHorizonPoint[] {
  const sigma = Math.max(residualSigma, 0.35);
  return pointForecasts.map((rawPred, index) => {
    const h = index + 1;
    const stepScale = Math.sqrt(1 + 0.06 * index);
    const predictedUnits = Math.max(0, Math.round(rawPred * 100) / 100);
    const margin80 = 1.28 * sigma * stepScale;
    const margin95 = 1.96 * sigma * stepScale;
    return {
      date: addDaysIso(startDate, h),
      predictedUnits,
      lower80: Math.max(0, Math.round((predictedUnits - margin80) * 100) / 100),
      upper80: Math.round((predictedUnits + margin80) * 100) / 100,
      lower95: Math.max(0, Math.round((predictedUnits - margin95) * 100) / 100),
      upper95: Math.round((predictedUnits + margin95) * 100) / 100,
    };
  });
}

/**
 * Holt-Winters Multiplicative Day-of-Week Seasonal Smoothing with Damped Trend.
 * Optimal for steady/trending retail SKUs with >= 21 days of demand history.
 */
export function fitHoltWintersSeasonal(
  series: readonly number[],
  dates: readonly string[],
  horizonDays: number,
): FittedForecastOutput {
  const alpha = 0.25;
  const beta = 0.08;
  const gamma = 0.2;
  const phi = 0.88;

  const firstWeek = series.slice(0, SEASONAL_PERIOD);
  const secondWeek = series.slice(SEASONAL_PERIOD, SEASONAL_PERIOD * 2);
  let level = Math.max(mean(firstWeek), 0.25);
  let trend =
    secondWeek.length === SEASONAL_PERIOD
      ? clamp((mean(secondWeek) - mean(firstWeek)) / SEASONAL_PERIOD, -level * 0.1, level * 0.1)
      : 0;

  // Initialize day-of-week seasonal indices mapped by calendar day of week (0=Sun..6=Sat)
  const dowTotals = new Array<number>(7).fill(0);
  const dowCounts = new Array<number>(7).fill(0);
  const globalMean = Math.max(mean(series.slice(0, 28)), 0.25);
  const initLen = Math.min(series.length, 28);
  for (let i = 0; i < initLen; i += 1) {
    const dow = getDayOfWeekIndex(dates[i]!);
    dowTotals[dow] = (dowTotals[dow] ?? 0) + (series[i] ?? 0);
    dowCounts[dow] = (dowCounts[dow] ?? 0) + 1;
  }

  const seasonals = dowTotals.map((total, dow) => {
    const count = dowCounts[dow] ?? 0;
    const rawIndex = count > 0 ? total / count / globalMean : 1;
    return clamp(rawIndex, 0.35, 2.4);
  });

  // Normalize seasonal factors to average 1.0
  const seasonalAvg = mean(seasonals) || 1;
  for (let d = 0; d < 7; d += 1) {
    seasonals[d] = (seasonals[d] ?? 1) / seasonalAvg;
  }

  const fittedValues: number[] = [];
  const residuals: number[] = [];

  for (let i = 0; i < series.length; i += 1) {
    const actual = series[i] ?? 0;
    const dow = getDayOfWeekIndex(dates[i]!);
    const seasonal = seasonals[dow] ?? 1;

    const forecast = Math.max(0, (level + phi * trend) * seasonal);
    fittedValues.push(forecast);
    residuals.push(actual - forecast);

    const prevLevel = level;
    level = Math.max(0.1, alpha * (actual / seasonal) + (1 - alpha) * (prevLevel + phi * trend));
    trend = clamp(
      beta * (level - prevLevel) + (1 - beta) * phi * trend,
      -level * 0.12,
      level * 0.12,
    );
    seasonals[dow] = clamp(gamma * (actual / level) + (1 - gamma) * seasonal, 0.35, 2.5);
  }

  // Re-normalize seasonal weights after full pass
  const postAvg = mean(seasonals) || 1;
  for (let d = 0; d < 7; d += 1) {
    seasonals[d] = (seasonals[d] ?? 1) / postAvg;
  }

  const lastDate = dates[dates.length - 1]!;
  const futurePoints: number[] = [];
  let phiPower = phi;
  let cumulativePhi = 0;
  for (let h = 1; h <= horizonDays; h += 1) {
    cumulativePhi += phiPower;
    phiPower *= phi;
    const futureDate = addDaysIso(lastDate, h);
    const dow = getDayOfWeekIndex(futureDate);
    const pred = Math.max(0, (level + cumulativePhi * trend) * (seasonals[dow] ?? 1));
    futurePoints.push(pred);
  }

  const recentResiduals = residuals.slice(-28);
  const residualSigma = stdDev(recentResiduals.length >= 7 ? recentResiduals : residuals);

  return {
    modelUsed: 'holt_winters_seasonal',
    modelLabel: 'Holt-Winters 7-Day Seasonal',
    fittedValues,
    horizon: buildConfidenceIntervals(lastDate, futurePoints, residualSigma),
    residualStdDev: Math.round(residualSigma * 100) / 100,
    trendSlopePerDay: trend,
  };
}

/**
 * Damped Holt's Linear Trend model for newer SKUs (7 to 20 days of history).
 */
export function fitDampedHolt(
  series: readonly number[],
  dates: readonly string[],
  horizonDays: number,
): FittedForecastOutput {
  const alpha = 0.3;
  const beta = 0.1;
  const phi = 0.85;

  let level = Math.max(series[0] ?? 0.5, 0.2);
  let trend = series.length >= 4 ? clamp((series[3]! - series[0]!) / 3, -1, 1) : 0;

  const fittedValues: number[] = [];
  const residuals: number[] = [];

  for (const actual of series) {
    const forecast = Math.max(0, level + phi * trend);
    fittedValues.push(forecast);
    residuals.push(actual - forecast);

    const prevLevel = level;
    level = Math.max(0.05, alpha * actual + (1 - alpha) * (prevLevel + phi * trend));
    trend = clamp(
      beta * (level - prevLevel) + (1 - beta) * phi * trend,
      -level * 0.15,
      level * 0.15,
    );
  }

  const lastDate = dates[dates.length - 1]!;
  const futurePoints: number[] = [];
  let phiPower = phi;
  let cumulativePhi = 0;
  for (let h = 1; h <= horizonDays; h += 1) {
    cumulativePhi += phiPower;
    phiPower *= phi;
    futurePoints.push(Math.max(0, level + cumulativePhi * trend));
  }

  const residualSigma = stdDev(residuals);
  return {
    modelUsed: 'holt_damped_trend',
    modelLabel: 'Damped Holt Trend',
    fittedValues,
    horizon: buildConfidenceIntervals(lastDate, futurePoints, residualSigma),
    residualStdDev: Math.round(residualSigma * 100) / 100,
    trendSlopePerDay: trend,
  };
}

/**
 * Syntetos-Boylan Approximation (Croston's SBA) for intermittent/slow-moving SKUs
 * where zero-sale days exceed 40% of history.
 */
export function fitCrostonSBA(
  series: readonly number[],
  dates: readonly string[],
  horizonDays: number,
): FittedForecastOutput {
  const alpha = 0.22;
  const nonZeroIndices = series.reduce<number[]>((acc, v, idx) => {
    if (v > 0) {
      acc.push(idx);
    }
    return acc;
  }, []);

  let demandSize = nonZeroIndices.length > 0 ? (series[nonZeroIndices[0]!] ?? 1) : 0.25;
  let interval =
    nonZeroIndices.length > 1 ? Math.max(1, nonZeroIndices[1]! - nonZeroIndices[0]!) : 3;
  let periodsSinceLastSale = 1;

  const fittedValues: number[] = [];
  const residuals: number[] = [];

  for (const actual of series) {
    const rate = Math.max(0, (1 - alpha / 2) * (demandSize / Math.max(interval, 1)));
    fittedValues.push(rate);
    residuals.push(actual - rate);

    if (actual > 0) {
      demandSize = alpha * actual + (1 - alpha) * demandSize;
      interval = alpha * periodsSinceLastSale + (1 - alpha) * interval;
      periodsSinceLastSale = 1;
    } else {
      periodsSinceLastSale += 1;
    }
  }

  const steadyRate = Math.max(0, (1 - alpha / 2) * (demandSize / Math.max(interval, 1)));
  const lastDate = dates[dates.length - 1]!;
  const futurePoints = new Array<number>(horizonDays).fill(steadyRate);
  const residualSigma = stdDev(residuals.slice(-30));

  return {
    modelUsed: 'croston_sba',
    modelLabel: "Croston's SBA (Intermittent)",
    fittedValues,
    horizon: buildConfidenceIntervals(lastDate, futurePoints, residualSigma),
    residualStdDev: Math.round(residualSigma * 100) / 100,
    trendSlopePerDay: 0,
  };
}

export function fitMovingBaseline(
  series: readonly number[],
  dates: readonly string[],
  horizonDays: number,
): FittedForecastOutput {
  const avg = mean(series);
  const lastDate = dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10);
  const fittedValues = new Array<number>(series.length).fill(avg);
  const futurePoints = new Array<number>(horizonDays).fill(avg);
  const residualSigma = stdDev(series);

  return {
    modelUsed: 'moving_baseline',
    modelLabel: 'Moving Baseline',
    fittedValues,
    horizon: buildConfidenceIntervals(lastDate, futurePoints, residualSigma),
    residualStdDev: Math.round(residualSigma * 100) / 100,
    trendSlopePerDay: 0,
  };
}

export function selectAndFitForecastModel(
  cleanedSeries: readonly number[],
  dates: readonly string[],
  horizonDays = 30,
): FittedForecastOutput {
  if (cleanedSeries.length < 7) {
    return fitMovingBaseline(cleanedSeries, dates, horizonDays);
  }

  const zeroDays = cleanedSeries.filter((v) => v <= 0.01).length;
  const zeroRatio = zeroDays / cleanedSeries.length;

  if (zeroRatio > 0.42 && cleanedSeries.length >= 14) {
    return fitCrostonSBA(cleanedSeries, dates, horizonDays);
  }

  if (cleanedSeries.length >= 21) {
    return fitHoltWintersSeasonal(cleanedSeries, dates, horizonDays);
  }

  return fitDampedHolt(cleanedSeries, dates, horizonDays);
}

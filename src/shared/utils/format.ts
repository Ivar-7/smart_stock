export type SupportedCurrency = 'USD' | 'EUR' | 'GBP' | 'KES' | 'CAD' | 'AUD';

export function formatCurrency(amount: number, currency: SupportedCurrency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function pluralizeUnit(unit: string, quantity: number): string {
  const rounded = Math.round(quantity * 10) / 10;
  if (Math.abs(rounded) === 1) {
    return unit;
  }
  const lower = unit.toLowerCase();
  if (lower === 'loaf') return 'loaves';
  if (
    lower.endsWith('s') ||
    lower.endsWith('x') ||
    lower.endsWith('z') ||
    lower.endsWith('ch') ||
    lower.endsWith('sh')
  ) {
    return `${unit}es`;
  }
  return `${unit}s`;
}

export function formatUnits(quantity: number, unit: string): string {
  const rounded = Math.round(quantity * 10) / 10;
  const label = pluralizeUnit(unit, rounded);
  return `${formatNumber(rounded, Number.isInteger(rounded) ? 0 : 1)} ${label}`;
}

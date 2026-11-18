const MS_PER_DAY = 86_400_000;

function parseIsoParts(iso: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) {
    throw new Error(`Invalid ISO date string: ${iso}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function toUtcNoonMs(iso: string): number {
  const [year, month, day] = parseIsoParts(iso);
  return Date.UTC(year, month - 1, day, 12, 0, 0);
}

function formatUtcNoonToIso(utcMs: number): string {
  const date = new Date(utcMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

export function addDaysIso(iso: string, deltaDays: number): string {
  return formatUtcNoonToIso(toUtcNoonMs(iso) + deltaDays * MS_PER_DAY);
}

export function diffDaysIso(fromIso: string, toIso: string): number {
  return Math.round((toUtcNoonMs(toIso) - toUtcNoonMs(fromIso)) / MS_PER_DAY);
}

export function getDayOfWeekIndex(iso: string): number {
  return new Date(toUtcNoonMs(iso)).getUTCDay();
}

export function rangeIsoDates(startIso: string, endIso: string): string[] {
  const startMs = toUtcNoonMs(startIso);
  const endMs = toUtcNoonMs(endIso);
  if (endMs < startMs) {
    return [];
  }
  const totalDays = Math.round((endMs - startMs) / MS_PER_DAY);
  const dates: string[] = [];
  for (let offset = 0; offset <= totalDays; offset += 1) {
    dates.push(formatUtcNoonToIso(startMs + offset * MS_PER_DAY));
  }
  return dates;
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatShortDate(iso: string): string {
  if (!isValidIsoDate(iso)) {
    return iso;
  }
  const [, month, day] = parseIsoParts(iso);
  return `${SHORT_MONTHS[month - 1] ?? ''} ${day}`;
}

export function formatWeekdayShortDate(iso: string): string {
  if (!isValidIsoDate(iso)) {
    return iso;
  }
  const dow = getDayOfWeekIndex(iso);
  return `${SHORT_WEEKDAYS[dow] ?? ''}, ${formatShortDate(iso)}`;
}

export function parseFlexibleDateToIso(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (isValidIsoDate(trimmed)) {
    return trimmed;
  }

  const slashOrDash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (slashOrDash) {
    const first = Number(slashOrDash[1]);
    const second = Number(slashOrDash[2]);
    const year = Number(slashOrDash[3]);
    // Prefer MM/DD/YYYY unless first > 12 (DD/MM/YYYY)
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return isValidIsoDate(candidate) ? candidate : null;
  }

  const isoPrefix = /^(\d{4})-(\d{2})-(\d{2})T/.exec(trimmed);
  if (isoPrefix) {
    const candidate = `${isoPrefix[1]}-${isoPrefix[2]}-${isoPrefix[3]}`;
    return isValidIsoDate(candidate) ? candidate : null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const candidate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  return isValidIsoDate(candidate) ? candidate : null;
}

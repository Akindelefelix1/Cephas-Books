export const FISCAL_YEAR_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const TIME_ZONE_KEY = 'cephas:reporting-timezone';
const FISCAL_START_KEY = 'cephas:fiscal-year-start';
const FALLBACK_TIME_ZONES = ['UTC', 'Africa/Lagos', 'Africa/Accra', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Tokyo', 'Australia/Sydney'];

export function getTimeZoneOptions() {
  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  let values = FALLBACK_TIME_ZONES;
  try {
    if (typeof supportedValuesOf === 'function') values = supportedValuesOf('timeZone');
  } catch {
    values = FALLBACK_TIME_ZONES;
  }
  return [...new Set(['UTC', ...values])].sort((a, b) => a.localeCompare(b));
}

export function getReportingTimeZone() {
  const saved = localStorage.getItem(TIME_ZONE_KEY) || 'Africa/Lagos';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: saved });
    return saved;
  } catch {
    return 'Africa/Lagos';
  }
}

export function isValidReportingTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function setReportingTimeZone(timeZone: string) {
  localStorage.setItem(TIME_ZONE_KEY, timeZone);
  window.dispatchEvent(new CustomEvent('cephas:financial-configuration-changed'));
}

export function getFiscalYearStartMonth() {
  const value = localStorage.getItem(FISCAL_START_KEY);
  return FISCAL_YEAR_MONTHS.includes(value as (typeof FISCAL_YEAR_MONTHS)[number]) ? value! : 'January';
}

export function setFiscalYearStartMonth(month: string) {
  if (!FISCAL_YEAR_MONTHS.includes(month as (typeof FISCAL_YEAR_MONTHS)[number])) return;
  localStorage.setItem(FISCAL_START_KEY, month);
  window.dispatchEvent(new CustomEvent('cephas:financial-configuration-changed'));
}

export function getBusinessToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: getReportingTimeZone(), year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function daysBetweenBusinessDates(earlier: string, later = getBusinessToday()) {
  const earlierDate = /^\d{4}-\d{2}-\d{2}/.exec(earlier)?.[0];
  const laterDate = /^\d{4}-\d{2}-\d{2}/.exec(later)?.[0];
  if (!earlierDate || !laterDate) return null;
  const toUtcDay = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  };
  return toUtcDay(laterDate) - toUtcDay(earlierDate);
}

export function formatBusinessDate(value: string | Date, locale = 'en-NG') {
  const raw = value instanceof Date ? value.toISOString() : value;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw) || /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(raw);
  const date = new Date(dateOnly ? `${raw}T00:00:00.000Z` : raw);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { timeZone: dateOnly ? 'UTC' : getReportingTimeZone(), dateStyle: 'medium' }).format(date);
}

export function formatBusinessDateTime(value: string | Date, locale = 'en-NG') {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    timeZone: getReportingTimeZone(), dateStyle: 'medium', timeStyle: 'short',
  }).format(date);
}

export function getFiscalYearRange(monthName = getFiscalYearStartMonth(), now = new Date()) {
  const monthIndex = Math.max(0, FISCAL_YEAR_MONTHS.indexOf(monthName as (typeof FISCAL_YEAR_MONTHS)[number]));
  const today = getBusinessToday(now);
  const [year, month] = today.split('-').map(Number);
  const startYear = month - 1 >= monthIndex ? year : year - 1;
  const start = new Date(Date.UTC(startYear, monthIndex, 1));
  const end = new Date(Date.UTC(startYear + 1, monthIndex, 0));
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end), startYear, endYear: end.getUTCFullYear() };
}

export function getFiscalPeriods(monthName = getFiscalYearStartMonth(), now = new Date()) {
  const range = getFiscalYearRange(monthName, now);
  const monthIndex = FISCAL_YEAR_MONTHS.indexOf(monthName as (typeof FISCAL_YEAR_MONTHS)[number]);
  return Array.from({ length: 12 }, (_, index) => {
    const start = new Date(Date.UTC(range.startYear, monthIndex + index, 1));
    const end = new Date(Date.UTC(range.startYear, monthIndex + index + 1, 0));
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    return {
      name: FISCAL_YEAR_MONTHS[start.getUTCMonth()],
      from: iso(start),
      to: iso(end),
      period: index + 1,
    };
  });
}

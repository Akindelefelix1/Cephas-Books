export const todayDateInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export function addDaysToDateInput(date: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(days)) return '';
  const result = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(result.getTime())) return '';
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function daysUntilDate(date: string) {
  if (!date) return Number.NaN;
  const today = todayDateInput();
  const start = new Date(`${today}T00:00:00.000Z`).getTime();
  const end = new Date(`${date.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / 86_400_000);
}

export function duePeriodForDate(date: string) {
  const days = daysUntilDate(date);
  if (!Number.isFinite(days)) return '';
  if (days < 0) return 'OVERDUE';
  if (days <= 7) return 'DUE_7';
  if (days <= 30) return 'DUE_8_30';
  return 'DUE_30_PLUS';
}

export function dueTimingLabel(date: string) {
  if (!date) return '—';
  const days = daysUntilDate(date);
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}

export function parsePaymentTermDays(value?: string) {
  if (!value?.trim()) return 30;
  if (/^(due on receipt|due immediately|immediate)$/i.test(value.trim())) return 0;
  const match = value.match(/\d+/);
  return match ? Math.min(3650, Math.max(0, Number(match[0]))) : 30;
}

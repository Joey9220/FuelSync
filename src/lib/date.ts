export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeDateKey(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return toDateKey(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : toDateKey(parsed);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function startOfWeek(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay() || 7;
  current.setDate(current.getDate() - day + 1);
  current.setHours(0, 0, 0, 0);
  return current;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function weekDays(anchor = new Date()) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short" }).format(parseDateKey(dateKey));
}

export function formatDayName(date: Date) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
}

function parseDateKey(dateKey: string) {
  const normalized = normalizeDateKey(dateKey);
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day);
}

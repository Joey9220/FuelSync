export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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
  return new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short" }).format(new Date(dateKey));
}

export function formatDayName(date: Date) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
}

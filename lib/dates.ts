export function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function todayIso(now = new Date()): string {
  return iso(now);
}

export function clockOf(reminder: { at?: string; custom?: string } | undefined): string | null {
  const value = reminder?.at || reminder?.custom || "";
  return /^\d{2}:\d{2}$/.test(value) ? value : null;
}

export function clockNow(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function parseIso(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatLong(value: string, now = new Date()): string {
  const date = parseIso(value);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function formatShort(value: string, now = new Date()): string {
  const date = parseIso(value);
  const base = `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base}.${date.getFullYear()}`;
}

export function formatWeekday(value: string): string {
  return parseIso(value).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatWhen(due: string, time: string | null, now = new Date()): string {
  const day = formatLong(due, now);
  return time ? `${day}, ${time}` : day;
}

export function isPastDue(due: string, now = new Date()): boolean {
  return due < todayIso(now);
}

export function formatMoney(value: number | null): string | null {
  if (value === null) return null;
  return `${new Intl.NumberFormat("ru-RU").format(value)} Br`;
}

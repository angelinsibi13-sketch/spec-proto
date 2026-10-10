import { addDays, iso, parseIso } from "@/lib/dates";
import type { Reminder, ReminderItem, ReminderKind } from "@/lib/types";

const clock = /^\d{2}:\d{2}$/;
const day = /^\d{4}-\d{2}-\d{2}$/;

export function packReminder(items: ReminderItem[]): Reminder {
  const first = items[0];
  return {
    mode: first?.kind === "day" || first?.kind === "hour" ? first.kind : "custom",
    custom: first ? `${first.date} ${first.at}` : "",
    at: first?.at,
    items,
  };
}

export function atEvent(due: string, time: string | null): { date: string; at: string } {
  return { date: due, at: time && clock.test(time) ? time : "09:00" };
}

export function minutesBefore(due: string, time: string | null, amount: number): { date: string; at: string } {
  const base = time && clock.test(time) ? time : "09:00";
  const [hours, minutes] = base.split(":").map(Number);
  const stamp = parseIso(due);
  stamp.setHours(hours, minutes - amount, 0, 0);
  return {
    date: iso(stamp),
    at: `${String(stamp.getHours()).padStart(2, "0")}:${String(stamp.getMinutes()).padStart(2, "0")}`,
  };
}

export function dayBefore(due: string, time: string | null): { date: string; at: string } {
  return { date: iso(addDays(parseIso(due), -1)), at: time && clock.test(time) ? time : "09:00" };
}

export function hourBefore(due: string, time: string | null): { date: string; at: string } {
  const base = time && clock.test(time) ? time : "09:00";
  const [hours, minutes] = base.split(":").map(Number);
  if (hours === 0) {
    return { date: iso(addDays(parseIso(due), -1)), at: `23:${String(minutes).padStart(2, "0")}` };
  }
  return { date: due, at: `${String(hours - 1).padStart(2, "0")}:${String(minutes).padStart(2, "0")}` };
}

export function reminderItems(reminder: Reminder | undefined, event?: { due: string; time: string | null }): ReminderItem[] {
  if (!reminder) return [];
  if (Array.isArray(reminder.items) && reminder.items.length > 0) {
    return reminder.items.filter((item) => day.test(item.date) && clock.test(item.at) && kindOk(item.kind));
  }
  if (!event) return [];
  if (reminder.mode === "day") {
    return [{ id: "legacy-day", kind: "day", ...dayBefore(event.due, event.time) }];
  }
  if (reminder.mode === "hour") {
    return [{ id: "legacy-hour", kind: "hour", ...hourBefore(event.due, event.time) }];
  }
  const at = reminder.at && clock.test(reminder.at) ? reminder.at : clock.test(reminder.custom) ? reminder.custom : "";
  if (!at) return [];
  return [{ id: "legacy-custom", kind: "custom", date: event.due, at }];
}

function kindOk(kind: string): kind is ReminderKind {
  return kind === "at" || kind === "ten" || kind === "hour" || kind === "day" || kind === "custom";
}

export function reminderLabel(item: ReminderItem): string {
  const when = `${item.date.split("-").reverse().join(".")}, ${item.at}`;
  if (item.kind === "at") return `В указанное время · ${when}`;
  if (item.kind === "ten") return `За 10 минут · ${when}`;
  if (item.kind === "hour") return `За 1 час · ${when}`;
  if (item.kind === "day") return `За 1 день · ${when}`;
  return `Пользовательское · ${when}`;
}

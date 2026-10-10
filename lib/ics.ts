import type { CalEvent } from "@/lib/types";

function stamp(due: string, time: string): string {
  const [y, m, d] = due.split("-");
  const [hh, mm] = time.split(":");
  return `${y}${m}${d}T${hh}${mm}00`;
}

function dayStamp(due: string): string {
  return due.replaceAll("-", "");
}

function escapeText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function eventBlock(event: CalEvent): string {
  const summary = escapeText(event.title);
  const description = escapeText(`${event.company}. ${event.client}`);
  const uid = `${event.id}@fix.mts`;
  if (!event.time) {
    const [y, m, d] = event.due.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(next.getDate()).padStart(2, "0")}`;
    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `DTSTART;VALUE=DATE:${dayStamp(event.due)}`,
      `DTEND;VALUE=DATE:${end}`,
      "END:VEVENT",
    ].join("\r\n");
  }
  const start = stamp(event.due, event.time);
  const [hh, mm] = event.time.split(":").map(Number);
  const endMinutes = hh * 60 + mm + 30;
  const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `DTSTART:${start}`,
    `DTEND:${stamp(event.due, endTime)}`,
    "END:VEVENT",
  ].join("\r\n");
}

export function toIcs(events: CalEvent[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MTS Fix//Demo//RU",
    "CALSCALE:GREGORIAN",
    ...events.map(eventBlock),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

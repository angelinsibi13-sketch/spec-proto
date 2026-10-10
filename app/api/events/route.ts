import { NextResponse } from "next/server";
import { createEvent } from "@/lib/server/api";
import type { Priority, ReminderItem, ReminderKind } from "@/lib/types";

function kindOf(value: unknown): ReminderKind | null {
  return value === "at" || value === "ten" || value === "hour" || value === "day" || value === "custom" ? value : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    due?: string;
    time?: string;
    priority?: Priority;
    reminders?: ReminderItem[];
  } | null;
  const title = body?.title?.trim() ?? "";
  const due = body?.due ?? "";
  const time = body?.time ?? "";
  const priority = body?.priority;
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    return NextResponse.json({ error: "Нужны название и дата" }, { status: 400 });
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: "Нужно время события" }, { status: 400 });
  }
  if (priority !== "high" && priority !== "medium" && priority !== "low") {
    return NextResponse.json({ error: "Нужен приоритет" }, { status: 400 });
  }
  const reminders: ReminderItem[] = [];
  for (const item of body?.reminders ?? []) {
    const kind = kindOf(item?.kind);
    const date = typeof item?.date === "string" ? item.date : "";
    const at = typeof item?.at === "string" ? item.at : "";
    if (!kind || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(at)) {
      return NextResponse.json({ error: "В напоминании нужны вид, дата и время" }, { status: 400 });
    }
    reminders.push({ id: typeof item.id === "string" && item.id ? item.id : `rem-${reminders.length}`, kind, date, at });
  }
  return NextResponse.json(createEvent({ title, due, time, priority, reminders }));
}

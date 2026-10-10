import { NextResponse } from "next/server";
import { saveReminder } from "@/lib/server/api";
import type { ReminderItem, ReminderKind } from "@/lib/types";

function kindOf(value: unknown): ReminderKind | null {
  return value === "at" || value === "ten" || value === "hour" || value === "day" || value === "custom" ? value : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { items?: ReminderItem[] } | null;
  if (!Array.isArray(body?.items)) {
    return NextResponse.json({ error: "Нужен список напоминаний" }, { status: 400 });
  }
  const items: ReminderItem[] = [];
  for (const item of body.items) {
    const kind = kindOf(item?.kind);
    const date = typeof item?.date === "string" ? item.date : "";
    const at = typeof item?.at === "string" ? item.at : "";
    if (!kind || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(at)) {
      return NextResponse.json({ error: "В напоминании нужны вид, дата и время" }, { status: 400 });
    }
    items.push({ id: typeof item.id === "string" && item.id ? item.id : `rem-${items.length}`, kind, date, at });
  }
  return NextResponse.json(saveReminder(id, items));
}

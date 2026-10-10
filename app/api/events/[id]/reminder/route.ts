import { NextResponse } from "next/server";
import { saveReminder } from "@/lib/server/api";
import type { ReminderMode } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { mode?: ReminderMode; custom?: string } | null;
  if (body?.mode !== "day" && body?.mode !== "hour" && body?.mode !== "custom") {
    return NextResponse.json({ error: "Нужен способ напоминания" }, { status: 400 });
  }
  const custom = typeof body.custom === "string" ? body.custom.trim() : "";
  if (body.mode === "custom" && !custom) {
    return NextResponse.json({ error: "Напишите, когда напомнить" }, { status: 400 });
  }
  return NextResponse.json(saveReminder(id, body.mode, custom));
}

import { NextResponse } from "next/server";
import { createEvent } from "@/lib/server/api";
import type { Priority } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    due?: string;
    time?: string;
    remindAt?: string;
    priority?: Priority;
  } | null;
  const title = body?.title?.trim() ?? "";
  const due = body?.due ?? "";
  const time = body?.time ?? "";
  const remindAt = body?.remindAt ?? "";
  const priority = body?.priority;
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    return NextResponse.json({ error: "Нужны название и дата" }, { status: 400 });
  }
  if (!/^\d{2}:\d{2}$/.test(time) || !/^\d{2}:\d{2}$/.test(remindAt)) {
    return NextResponse.json({ error: "Нужно время события и напоминания" }, { status: 400 });
  }
  if (priority !== "high" && priority !== "medium" && priority !== "low") {
    return NextResponse.json({ error: "Нужен приоритет" }, { status: 400 });
  }
  return NextResponse.json(createEvent({ title, due, time, remindAt, priority }));
}

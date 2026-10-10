import { NextResponse } from "next/server";
import { saveReminder } from "@/lib/server/api";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { at?: string } | null;
  const at = body?.at?.trim() ?? "";
  if (!/^\d{2}:\d{2}$/.test(at)) {
    return NextResponse.json({ error: "Нужно время в формате ЧЧ:ММ" }, { status: 400 });
  }
  return NextResponse.json(saveReminder(id, at));
}

import { NextResponse } from "next/server";
import { patchTask } from "@/lib/server/api";


export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (body?.status !== "open" && body?.status !== "done") {
    return NextResponse.json({ error: "Нужен статус" }, { status: 400 });
  }
  return NextResponse.json(patchTask(id, body.status));
}

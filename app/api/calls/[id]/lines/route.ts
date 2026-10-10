import { NextResponse } from "next/server";
import { addLine } from "@/lib/server/api";


export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    speaker?: string;
    name?: string;
    text?: string;
    fromScript?: boolean;
  } | null;
  if (!body || (body.speaker !== "agent" && body.speaker !== "client")) {
    return NextResponse.json({ error: "Нужна реплика" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!text || !name) return NextResponse.json({ error: "Пустая реплика" }, { status: 400 });
  return NextResponse.json(
    addLine(id, {
      speaker: body.speaker,
      name,
      text,
      fromScript: Boolean(body.fromScript),
    }),
  );
}

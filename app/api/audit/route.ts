import { NextResponse } from "next/server";
import { viewTranscript } from "@/lib/server/api";


export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { detail?: string } | null;
  const detail = typeof body?.detail === "string" ? body.detail.trim() : "";
  if (!detail) return NextResponse.json({ error: "Нет записи" }, { status: 400 });
  return NextResponse.json(viewTranscript(detail));
}

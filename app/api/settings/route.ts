import { NextResponse } from "next/server";
import { patchVoice } from "@/lib/server/api";


export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { voice?: boolean } | null;
  if (!body || typeof body.voice !== "boolean") {
    return NextResponse.json({ error: "Нужно voice" }, { status: 400 });
  }
  return NextResponse.json(patchVoice(body.voice));
}

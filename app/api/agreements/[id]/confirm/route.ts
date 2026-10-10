import { NextResponse } from "next/server";
import { confirm } from "@/lib/server/api";


export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { confirmed?: boolean } | null;
  if (!body || typeof body.confirmed !== "boolean") {
    return NextResponse.json({ error: "Нужно confirmed" }, { status: 400 });
  }
  return NextResponse.json(confirm(id, body.confirmed));
}

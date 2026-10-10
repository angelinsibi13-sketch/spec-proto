import { NextResponse } from "next/server";
import { openCall } from "@/lib/server/api";
import type { Direction } from "@/lib/types";


export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { direction?: Direction } | null;
  if (body?.direction !== "in" && body?.direction !== "out") {
    return NextResponse.json({ error: "Нужно направление in или out" }, { status: 400 });
  }
  return NextResponse.json(openCall(body.direction));
}

import { NextResponse } from "next/server";
import { finishCall } from "@/lib/server/api";


export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json(finishCall(id));
}

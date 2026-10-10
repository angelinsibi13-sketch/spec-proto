import { NextResponse } from "next/server";
import { patchRule } from "@/lib/server/api";
import type { AgreementType, Priority } from "@/lib/types";


const TYPES: AgreementType[] = ["kp", "meeting", "payment", "callback", "docs"];

export async function PATCH(request: Request, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  if (!TYPES.includes(type as AgreementType)) {
    return NextResponse.json({ error: "Неизвестный тип" }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as {
    enabled?: boolean;
    keywords?: string;
    template?: string;
    priority?: Priority;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Нет полей" }, { status: 400 });
  }
  const patch: { enabled?: boolean; keywords?: string; template?: string; priority?: Priority } = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.keywords === "string") patch.keywords = body.keywords;
  if (typeof body.template === "string") patch.template = body.template;
  if (body.priority === "high" || body.priority === "medium" || body.priority === "low") patch.priority = body.priority;
  return NextResponse.json(patchRule(type as AgreementType, patch));
}

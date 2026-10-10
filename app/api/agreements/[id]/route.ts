import { NextResponse } from "next/server";
import { dropAgreement, patchAgreement } from "@/lib/server/api";
import type { AgreementPatch } from "@/lib/machine";
import type { Priority } from "@/lib/types";


export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as AgreementPatch | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Нет полей" }, { status: 400 });
  }
  const patch: AgreementPatch = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.due)) patch.due = body.due;
  if (body.time === null) patch.time = null;
  if (typeof body.time === "string") patch.time = body.time.trim() || null;
  if (body.amount === null) patch.amount = null;
  if (typeof body.amount === "number" && Number.isFinite(body.amount)) patch.amount = Math.round(body.amount);
  if (typeof body.phrase === "string" && body.phrase.trim()) patch.phrase = body.phrase.trim();
  if (body.priority === "high" || body.priority === "medium" || body.priority === "low") {
    patch.priority = body.priority satisfies Priority;
  }
  return NextResponse.json(patchAgreement(id, patch));
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json(dropAgreement(id));
}

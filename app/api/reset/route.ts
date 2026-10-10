import { NextResponse } from "next/server";
import { resetAll } from "@/lib/server/api";


export function POST() {
  return NextResponse.json(resetAll());
}

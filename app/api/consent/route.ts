import { NextResponse } from "next/server";
import { acceptConsent } from "@/lib/server/api";


export function POST() {
  return NextResponse.json(acceptConsent());
}

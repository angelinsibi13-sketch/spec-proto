import { NextResponse } from "next/server";
import { acceptConsent } from "@/lib/server/api";


export async function POST() {
  return NextResponse.json(await acceptConsent());
}

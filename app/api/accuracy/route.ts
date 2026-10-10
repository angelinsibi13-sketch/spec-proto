import { connection, NextResponse } from "next/server";
import { accuracyReport } from "@/lib/server/api";


export async function GET() {
  await connection();
  return NextResponse.json(accuracyReport());
}

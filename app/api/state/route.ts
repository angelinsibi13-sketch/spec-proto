import { connection, NextResponse } from "next/server";
import { getState } from "@/lib/server/api";


export async function GET() {
  await connection();
  return NextResponse.json(getState());
}

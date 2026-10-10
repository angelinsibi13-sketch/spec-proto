import { connection, NextResponse } from "next/server";
import { backendView } from "@/lib/server/api";


export async function GET() {
  await connection();
  return NextResponse.json(backendView());
}

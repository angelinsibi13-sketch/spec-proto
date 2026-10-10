import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { connection, NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await context.params;
  if (!/^[a-z0-9-]{8,80}$/.test(id)) {
    return NextResponse.json({ error: "Нет такой записи" }, { status: 404 });
  }
  const directory = path.join(process.cwd(), "data", "recordings");
  const mp3 = path.join(directory, `${id}.mp3`);
  const wav = path.join(directory, `${id}.wav`);
  const file = existsSync(mp3) ? mp3 : existsSync(wav) ? wav : "";
  if (!file) return NextResponse.json({ error: "Нет такой записи" }, { status: 404 });
  const body = readFileSync(file);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": file.endsWith(".mp3") ? "audio/mpeg" : "audio/wav",
      "content-length": String(body.length),
      "cache-control": "private, max-age=3600",
    },
  });
}

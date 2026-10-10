import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { uploadRecording } from "@/lib/server/api";
import { transcribeFile, whisperReady } from "@/lib/server/transcribe";

const limit = 20 * 1024 * 1024;
const AUDIO = /\.(mp3|wav|ogg|opus|m4a|webm|aac)$/i;

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Нужен аудиофайл" }, { status: 400 });
  }
  if (!AUDIO.test(file.name.toLowerCase())) {
    return NextResponse.json({ error: "Подойдёт WAV, MP3, OGG, M4A или WebM" }, { status: 400 });
  }
  if (file.size < 1000 || file.size > limit) {
    return NextResponse.json({ error: "Файл пустой или больше 20 МБ" }, { status: 400 });
  }
  if (!whisperReady()) {
    return NextResponse.json(
      { error: "Локальное распознавание не установлено. Аудио никуда не отправлялось." },
      { status: 503 },
    );
  }

  const directory = path.join(process.cwd(), "data", "inbox");
  mkdirSync(directory, { recursive: true });
  const audioPath = path.join(directory, `${randomBytes(8).toString("hex")}${path.extname(file.name).toLowerCase()}`);
  writeFileSync(audioPath, Buffer.from(await file.arrayBuffer()));
  let wavPath = "";

  try {
    const transcribed = await transcribeFile(audioPath);
    wavPath = transcribed.wavPath;
    if (transcribed.segments.length === 0) {
      return NextResponse.json({ error: "В записи не нашлось речи" }, { status: 422 });
    }
    const client = String(form?.get("client") ?? "");
    const company = String(form?.get("company") ?? "");
    const result = uploadRecording({
      client,
      company,
      segments: transcribed.segments,
      sourcePath: wavPath,
      ext: ".wav",
    });
    wavPath = "";
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "";
    return NextResponse.json(
      { error: detail || "Не удалось распознать запись на этом компьютере. Аудио никуда не отправлялось." },
      { status: 500 },
    );
  } finally {
    rmSync(audioPath, { force: true });
    if (wavPath) rmSync(wavPath, { force: true });
  }
}

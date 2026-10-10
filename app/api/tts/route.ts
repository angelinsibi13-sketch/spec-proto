import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { NextResponse } from "next/server";

const piper = "/tmp/piper/piper/piper";
const library = "/tmp/piper/piper";

const models: Record<string, { model: string; length: string }> = {
  alexey: { model: "/tmp/piper/ru_RU-dmitri-medium.onnx", length: "1.02" },
  maria: { model: "/tmp/piper/voices/ru_RU-irina-medium.onnx", length: "1.0" },
  oleg: { model: "/tmp/piper/ru_RU-ruslan-medium.onnx", length: "1.07" },
};

function synthesize(text: string, role: string): Promise<Buffer> {
  const voice = models[role];
  return new Promise((resolve, reject) => {
    const proc = spawn(
      piper,
      [
        "--model",
        voice.model,
        "--output_file",
        "-",
        "--length_scale",
        voice.length,
        "--noise_scale",
        "0.45",
        "--noise_w",
        "0.55",
        "--sentence_silence",
        "0.28",
      ],
      { env: { ...process.env, LD_LIBRARY_PATH: library } },
    );
    const chunks: Buffer[] = [];
    let error = "";
    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => {
      error += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
      else reject(new Error(error || "tts"));
    });
    proc.stdin.end(text);
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: string; role?: string } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 400) : "";
  const role = body?.role ?? "";
  if (!text || !models[role] || !existsSync(piper) || !existsSync(models[role].model)) {
    return NextResponse.json({ error: "Голос недоступен" }, { status: 404 });
  }
  try {
    const wav = await synthesize(text, role);
    return new Response(new Uint8Array(wav), { headers: { "content-type": "audio/wav" } });
  } catch {
    return NextResponse.json({ error: "Не удалось озвучить" }, { status: 500 });
  }
}

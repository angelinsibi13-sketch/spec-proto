import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const python = process.env.WHISPER_PYTHON ?? "/tmp/whisper-venv/bin/python";
const script = path.join(process.cwd(), "scripts/transcribe.py");
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  pitch?: number | null;
};

export function whisperReady(): boolean {
  return existsSync(python) && existsSync(script);
}

function run(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { env });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    proc.on("error", reject);
    proc.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      });
    });
  });
}

export async function probeCodec(audioPath: string): Promise<string> {
  const result = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=codec_name",
    "-of",
    "csv=p=0",
    audioPath,
  ]);
  return result.stdout.trim().split("\n")[0]?.trim() ?? "";
}

export function browserSafe(audioPath: string, codec: string): boolean {
  const ext = path.extname(audioPath).toLowerCase();
  if (ext === ".mp3") return codec === "mp3";
  if (ext === ".wav") return codec.startsWith("pcm_");
  return false;
}

export async function renderWav(audioPath: string, wavPath: string): Promise<void> {
  const result = await run(ffmpeg, ["-y", "-i", audioPath, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wavPath]);
  if (result.code !== 0 || !existsSync(wavPath)) {
    throw new Error(result.stderr.trim().slice(-400) || "Не удалось прочитать аудиофайл");
  }
}

function parseSegments(raw: string): TranscriptSegment[] {
  const parsed = JSON.parse(raw) as TranscriptSegment[];
  if (!Array.isArray(parsed)) throw new Error("Распознавание вернуло неожиданный ответ");
  return parsed.filter((item) => item && typeof item.text === "string" && item.text.trim());
}

function whisper(wavPath: string, vad: boolean): Promise<TranscriptSegment[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(python, [script, wavPath], {
      env: {
        ...process.env,
        HF_HOME: process.env.HF_HOME ?? "/tmp/hf-cache",
        WHISPER_MODEL: process.env.WHISPER_MODEL ?? "small",
        WHISPER_BEAM: process.env.WHISPER_BEAM ?? "5",
        WHISPER_VAD: vad ? "1" : "0",
        PYTHONUNBUFFERED: "1",
      },
    });
    const out: Buffer[] = [];
    let error = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Распознавание заняло слишком много времени"));
    }, 600_000);
    proc.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => {
      error += chunk.toString();
    });
    proc.on("error", (cause) => {
      clearTimeout(timer);
      reject(cause);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(error.trim().slice(-400) || "Распознавание не удалось"));
        return;
      }
      try {
        resolve(parseSegments(Buffer.concat(out).toString("utf8")));
      } catch (cause) {
        reject(cause instanceof Error ? cause : new Error("Распознавание вернуло не текст"));
      }
    });
  });
}

export async function transcribeFile(audioPath: string): Promise<{ segments: TranscriptSegment[]; wavPath: string }> {
  const wavPath = path.join(tmpdir(), `fix-${randomBytes(8).toString("hex")}.wav`);
  await renderWav(audioPath, wavPath);
  let segments = await whisper(wavPath, false);
  if (segments.length === 0) segments = await whisper(wavPath, true);
  return { segments, wavPath };
}

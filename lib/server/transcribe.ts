import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const python = process.env.WHISPER_PYTHON ?? "/tmp/whisper-venv/bin/python";
const script = path.join(process.cwd(), "scripts/transcribe.py");

export type TranscriptSegment = { start: number; end: number; text: string };

export function whisperReady(): boolean {
  return existsSync(python) && existsSync(script);
}

export function transcribeFile(audioPath: string): Promise<TranscriptSegment[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(python, [script, audioPath], {
      env: {
        ...process.env,
        HF_HOME: process.env.HF_HOME ?? "/tmp/hf-cache",
        WHISPER_MODEL: process.env.WHISPER_MODEL ?? "small",
        PYTHONUNBUFFERED: "1",
      },
    });
    const out: Buffer[] = [];
    let error = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Распознавание заняло слишком много времени"));
    }, 180_000);
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
        const parsed = JSON.parse(Buffer.concat(out).toString("utf8")) as TranscriptSegment[];
        if (!Array.isArray(parsed)) {
          reject(new Error("Распознавание вернуло неожиданный ответ"));
          return;
        }
        resolve(parsed.filter((item) => item && typeof item.text === "string" && item.text.trim()));
      } catch {
        reject(new Error("Распознавание вернуло не текст"));
      }
    });
  });
}

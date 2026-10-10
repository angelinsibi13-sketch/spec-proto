import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TRANSCRIPT_ENGINE, applyRecordingTranscript, markRecording } from "@/lib/machine";
import type { Vault } from "@/lib/types";
import {
  browserSafe,
  probeCodec,
  renderWav,
  transcribeFile,
  whisperReady,
  type TranscriptSegment,
} from "@/lib/server/transcribe";

const AUDIO = /\.(mp3|wav|ogg|opus|m4a|webm|aac)$/i;
const MISSING_WHISPER = "Файл записи новый или заменён, но локальное распознавание не установлено.";

const PROFILES: Record<string, { client: string; company: string; role: string; phone: string }> = {
  irina: { client: "Ирина Павлова", company: "«БелКанц»", role: "закупки", phone: "+375 29 510-22-14" },
  maria: { client: "Мария Соколова", company: "«Лучи»", role: "закупки", phone: "+375 29 440-19-20" },
  oleg: { client: "Олег Ким", company: "«Неман Логистик»", role: "директор", phone: "+375 33 220-44-18" },
  sergey: { client: "Сергей Волчек", company: "«Минск Принт»", role: "сервис", phone: "+375 33 118-40-77" },
  natalya: { client: "Наталья Гриб", company: "«Светлоторг»", role: "снабжение", phone: "+375 29 663-08-41" },
};

// Demo files shipped with the prototype. A replaced or new file has another hash and is transcribed.
const SCRIPTED = new Set([
  "aa404da9bbcd2ec26227b076e8056afc18647d328e117c134f9627f86fd344ad",
  "1581d3ca2625824d678e517930347205e7910e7ce8e39bbc8ae6ed2e243b59f8",
  "0e0b8aeec2a5c32336dcfada3b86680d3632818d6e8cb447f4f2eb1c27137f85",
  "c0671589cd091df3dab6e3f1d156fc3b90fc738e8ba3a0cec0d1fbbf2b41a9b3",
]);

type Found = { abs: string; url: string; base: string; mtime: number };

function titleFromStem(stem: string): string {
  const words = stem.replace(/[-_]+/g, " ").trim();
  if (!words) return "Новая запись";
  return words
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function profileFor(base: string) {
  const stem = base.replace(/\.[^.]+$/, "").toLowerCase();
  const known = PROFILES[stem];
  if (known) return { ...known, known: true };
  return { client: titleFromStem(stem), company: "Запись", role: "запись", phone: "", known: false };
}

function collect(): Found[] {
  const roots = [
    { abs: path.join(process.cwd(), "public", "recordings"), url: "/recordings" },
    { abs: path.join(process.cwd(), "public", "inbox"), url: "/inbox" },
  ];
  const byBase = new Map<string, Found>();
  for (const root of roots) {
    if (!existsSync(root.abs)) continue;
    for (const name of readdirSync(root.abs)) {
      if (!AUDIO.test(name) || name.startsWith(".")) continue;
      const abs = path.join(root.abs, name);
      const found: Found = { abs, url: `${root.url}/${name}`, base: name, mtime: statSync(abs).mtimeMs };
      const prev = byBase.get(name);
      if (!prev || found.mtime >= prev.mtime) byBase.set(name, found);
    }
  }
  return [...byBase.values()];
}

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function cachePath(hash: string): string {
  return path.join(process.cwd(), "data", "transcripts", `${hash}.json`);
}

function readCache(hash: string): TranscriptSegment[] | null {
  const file = cachePath(hash);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { v?: number; segments?: TranscriptSegment[] };
    if (parsed.v !== 4 || !Array.isArray(parsed.segments)) return null;
    return parsed.segments;
  } catch {
    return null;
  }
}

function writeCache(hash: string, segments: TranscriptSegment[]) {
  const file = cachePath(hash);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ v: 4, segments }));
}

function findCall(vault: Vault, file: Found, client: string, known: boolean) {
  return vault.calls.find(
    (call) =>
      call.origin !== "demo" &&
      (call.sourceFile === file.base ||
        Boolean(call.audio?.endsWith(`/${file.base}`)) ||
        (known && call.client === client)),
  );
}

let gate: Promise<void> = Promise.resolve();

export function syncRecordings(vault: Vault): Promise<{ vault: Vault; changed: boolean }> {
  const run = gate.then(() => syncBody(vault));
  gate = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function playableUrl(file: Found, hash: string, wavPath: string): Promise<string> {
  const codec = await probeCodec(file.abs);
  if (browserSafe(file.abs, codec)) {
    if (wavPath) rmSync(wavPath, { force: true });
    return file.url;
  }
  const directory = path.join(process.cwd(), "data", "recordings");
  mkdirSync(directory, { recursive: true });
  const dest = path.join(directory, `${hash}.wav`);
  if (!existsSync(dest)) {
    if (wavPath) {
      copyFileSync(wavPath, dest);
      rmSync(wavPath, { force: true });
    } else await renderWav(file.abs, dest);
  } else if (wavPath) {
    rmSync(wavPath, { force: true });
  }
  return `/api/recordings/${hash}`;
}

async function syncBody(vault: Vault): Promise<{ vault: Vault; changed: boolean }> {
  if (!vault.consentAt) return { vault, changed: false };
  let next = vault;
  let changed = false;
  for (const file of collect()) {
    const hash = sha256(file.abs);
    const profile = profileFor(file.base);
    const current = findCall(next, file, profile.client, profile.known);
    if (current?.audioSha === hash && current.sourceFile === file.base && current.transcriptEngine === TRANSCRIPT_ENGINE) {
      continue;
    }
    if (SCRIPTED.has(hash)) {
      const marked = markRecording(next, {
        sourceFile: file.base,
        audioSha: hash,
        client: profile.client,
        known: profile.known,
      });
      next = marked.vault;
      changed = changed || marked.changed;
      continue;
    }
    if (!whisperReady()) {
      if (current && current.transcriptNote !== MISSING_WHISPER) {
        next = {
          ...next,
          calls: next.calls.map((call) =>
            call.id === current.id ? { ...call, sourceFile: file.base, transcriptNote: MISSING_WHISPER } : call,
          ),
        };
        changed = true;
      }
      continue;
    }
    let wavPath = "";
    try {
      let segments = readCache(hash);
      if (!segments) {
        const transcribed = await transcribeFile(file.abs);
        segments = transcribed.segments;
        wavPath = transcribed.wavPath;
        writeCache(hash, segments);
      }
      if (segments.length === 0) {
        if (wavPath) rmSync(wavPath, { force: true });
        wavPath = "";
        const marked = markRecording(next, {
          sourceFile: file.base,
          audioSha: hash,
          client: profile.client,
          known: profile.known,
          note: "В этом файле не нашлось речи.",
        });
        next = marked.vault;
        changed = changed || marked.changed;
        continue;
      }
      const audio = await playableUrl(file, hash, wavPath);
      wavPath = "";
      next = applyRecordingTranscript(next, {
        ...profile,
        audio,
        audioSha: hash,
        sourceFile: file.base,
        segments,
      });
      changed = true;
    } catch (cause) {
      if (wavPath) rmSync(wavPath, { force: true });
      const note = cause instanceof Error ? cause.message : "Не удалось распознать запись";
      if (current && current.transcriptNote !== note) {
        next = {
          ...next,
          calls: next.calls.map((call) =>
            call.id === current.id ? { ...call, sourceFile: file.base, transcriptNote: note } : call,
          ),
        };
        changed = true;
      }
    }
  }
  return { vault: next, changed };
}

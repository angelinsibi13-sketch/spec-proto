import { MANAGER } from "@/lib/demo-script";

export type SpeechSegment = {
  text: string;
  start?: number;
  end?: number;
  pitch?: number | null;
  voice?: number | null;
};

export type LabeledSpeech = {
  speaker: "agent" | "client";
  name: string;
  text: string;
  start: number;
};

const MANAGER_CUE =
  /алексей|разговор запис|договоренност|оргтехник|на связи|вас беспоко|я перезвоню|поставлю созвон|кп будет/;

function normalize(text: string): string {
  return text.toLowerCase().replaceAll("ё", "е");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function cluster(pitches: number[]): { low: number; high: number } | null {
  if (pitches.length < 2) return null;
  const sorted = [...pitches].sort((a, b) => a - b);
  let gap = 0;
  let gapAt = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const size = sorted[index] - sorted[index - 1];
    if (size > gap) {
      gap = size;
      gapAt = index;
    }
  }
  const low = sorted.slice(0, gapAt);
  const high = sorted.slice(gapAt);
  if (low.length === 0 || high.length === 0) return null;
  const lowMedian = median(low);
  const highMedian = median(high);
  if (highMedian - lowMedian < 12 || highMedian < lowMedian * 1.08) return null;
  return { low: lowMedian, high: highMedian };
}

function named(speaker: "agent" | "client", client: string, text: string, start: number): LabeledSpeech {
  return {
    speaker,
    name: speaker === "agent" ? MANAGER : client,
    text,
    start,
  };
}

export function labelSpeakers(segments: SpeechSegment[], client: string): LabeledSpeech[] {
  const usable = segments
    .map((segment) => ({ ...segment, text: segment.text.trim() }))
    .filter((segment) => segment.text.length > 0);
  const pitches = usable
    .map((segment) => segment.pitch)
    .filter((pitch): pitch is number => typeof pitch === "number" && pitch >= 70 && pitch <= 450);
  const voices = cluster(pitches);
  const draft = usable.map((segment) => {
    const start = segment.start ?? 0;
    const end = segment.end ?? start;
    const cue = MANAGER_CUE.test(normalize(segment.text));
    if (cue) return { speaker: "agent" as const, locked: true, text: segment.text, start, end };
    if (segment.voice === 0) return { speaker: "agent" as const, locked: true, text: segment.text, start, end };
    if (segment.voice === 1) return { speaker: "client" as const, locked: true, text: segment.text, start, end };
    if (voices && typeof segment.pitch === "number" && segment.pitch >= 70 && segment.pitch <= 450) {
      const toLow = Math.abs(segment.pitch - voices.low);
      const toHigh = Math.abs(segment.pitch - voices.high);
      return {
        speaker: (toLow <= toHigh ? "agent" : "client") as "agent" | "client",
        locked: true,
        text: segment.text,
        start,
        end,
      };
    }
    return { speaker: "client" as const, locked: false, text: segment.text, start, end };
  });
  for (let index = 0; index < draft.length; index += 1) {
    const line = draft[index];
    if (line.locked) continue;
    let previous: (typeof draft)[number] | null = null;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (!draft[cursor].locked) continue;
      if (line.start - draft[cursor].end <= 0.8) previous = draft[cursor];
      break;
    }
    if (previous) line.speaker = previous.speaker;
  }
  return draft.map((line) => named(line.speaker, client, line.text, line.start));
}

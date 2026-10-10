import { MANAGER } from "@/lib/demo-script";

export type SpeechSegment = {
  text: string;
  start?: number;
  pitch?: number | null;
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
  if (highMedian < lowMedian * 1.2) return null;
  return { low: lowMedian, high: highMedian };
}

export function labelSpeakers(segments: SpeechSegment[], client: string): LabeledSpeech[] {
  const usable = segments
    .map((segment) => ({ ...segment, text: segment.text.trim() }))
    .filter((segment) => segment.text.length > 0);
  const pitches = usable
    .map((segment) => segment.pitch)
    .filter((pitch): pitch is number => typeof pitch === "number" && pitch >= 70 && pitch <= 450);
  const voices = cluster(pitches);
  return usable.map((segment) => {
    const cue = MANAGER_CUE.test(normalize(segment.text));
    let speaker: "agent" | "client" = "client";
    if (cue) speaker = "agent";
    else if (voices && typeof segment.pitch === "number" && segment.pitch >= 70 && segment.pitch <= 450) {
      const toLow = Math.abs(segment.pitch - voices.low);
      const toHigh = Math.abs(segment.pitch - voices.high);
      speaker = toLow <= toHigh ? "agent" : "client";
    }
    return {
      speaker,
      name: speaker === "agent" ? MANAGER : client,
      text: segment.text,
      start: segment.start ?? 0,
    };
  });
}

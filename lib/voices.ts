export type VoiceRole = "alexey" | "maria" | "oleg";

const PROFILE: Record<VoiceRole, { pitch: number; rate: number }> = {
  alexey: { pitch: 0.84, rate: 0.95 },
  oleg: { pitch: 0.7, rate: 0.92 },
  maria: { pitch: 1.06, rate: 0.97 },
};

let generation = 0;
let pending = 0;
let chain: Promise<void> = Promise.resolve();
let clip: HTMLAudioElement | null = null;
let onBusy: (busy: boolean) => void = () => {};

export function unlockAudio() {
  const audio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=");
  void audio.play().catch(() => undefined);
}

export function watchSpeech(listener: (busy: boolean) => void) {
  onBusy = listener;
}

export function roleFor(speaker: "agent" | "client", name: string): VoiceRole {
  if (speaker === "agent") return "alexey";
  if (name.includes("Олег")) return "oleg";
  return "maria";
}

function voices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

function pickBrowserVoice(role: VoiceRole): SpeechSynthesisVoice | null {
  const russian = voices().filter((voice) => voice.lang.toLowerCase().startsWith("ru"));
  const pool = russian.length > 0 ? russian : voices();
  const male = pool.find((voice) => /pavel|dmit|ruslan|yuri|юр|male|муж/i.test(voice.name));
  const female = pool.find((voice) => /irina|svetlana|elena|al[eё]na|female|жен/i.test(voice.name));
  if (role === "maria") return female ?? pool[0] ?? null;
  return male ?? pool[0] ?? null;
}

function setBusy(busy: boolean) {
  onBusy(busy);
}

export function stopSpeech() {
  generation += 1;
  pending = 0;
  chain = Promise.resolve();
  clip?.pause();
  clip = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  setBusy(false);
}

function enqueue(task: () => Promise<void>) {
  const ticket = generation;
  pending += 1;
  setBusy(true);
  chain = chain
    .then(async () => {
      if (ticket !== generation) return;
      await task();
    })
    .finally(() => {
      if (ticket !== generation) return;
      pending = Math.max(0, pending - 1);
      if (pending === 0) setBusy(false);
    });
}

export function playClip(src: string) {
  enqueue(() => playUrl(src));
}

function playUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    clip = audio;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (clip === audio) clip = null;
      resolve();
    };
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
    window.setTimeout(finish, 20000);
    void audio.play().catch(finish);
  });
}

function browserSpeak(text: string, role: VoiceRole): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const profile = PROFILE[role];
    utterance.lang = "ru-RU";
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    const voice = pickBrowserVoice(role);
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
    window.setTimeout(resolve, Math.min(12000, 700 + text.length * 70));
  });
}

export function speakAs(text: string, role: VoiceRole) {
  enqueue(async () => {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, role }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        await playUrl(url);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // Телефонный голос ниже, если сервер не озвучил.
    }
    await browserSpeak(text, role);
  });
}

import { ACCURACY_NOW, contextHits, rehearsalHits, scoreAccuracy } from "./accuracy";
import { defaultRules } from "./catalog";
import { extract } from "./extract";
import { labelSpeakers } from "./speakers";

const score = scoreAccuracy();
const misses = score.rows.filter((row) => !row.ok);
const falseHits = score.negatives.filter((item) => item.hit);
const rehearsal = rehearsalHits();
const kinds = rehearsal.map((item) => item.hit.type).join(",");

console.log(`accuracy ${score.passed}/${score.total} ${(score.ratio * 100).toFixed(1)}%`);
for (const miss of misses) {
  console.log(
    `MISS ${miss.phrase} => ${miss.hit ? `${miss.hit.type} ${miss.hit.due} ${miss.hit.time}` : "null"} expected ${miss.type} ${miss.due} ${miss.time ?? ""}`,
  );
}
for (const item of falseHits) {
  console.log(`FALSE ${item.phrase} => ${item.hit?.type}`);
}
console.log(`rehearsal ${kinds}`);

const expected = "kp,meeting,payment,docs,docs,callback";
const context = contextHits();
const rules = defaultRules();
const splitHit = extract(context.split[0] ?? "", rules, ACCURACY_NOW, "Клиент");
const acrossHit = extract(context.across[0] ?? "", rules, ACCURACY_NOW, "Клиент");
const meetingHit = extract(context.meeting[0] ?? "", rules, ACCURACY_NOW, "Клиент");
const contextOk =
  context.split.length === 1 &&
  splitHit?.type === "kp" &&
  splitHit.due === "2026-10-09" &&
  context.across.length === 1 &&
  acrossHit?.type === "kp" &&
  context.meeting.length === 1 &&
  meetingHit?.type === "meeting" &&
  meetingHit.due === "2026-10-12" &&
  meetingHit.time === "11:00" &&
  context.separate.length === 0 &&
  context.consent.length === 0;
if (!contextOk) {
  console.log("CONTEXT", JSON.stringify(context));
}
const dialogue = labelSpeakers(
  [
    { text: "Добрый день", start: 0, end: 0.8, voice: 0, pitch: 120 },
    { text: "Здравствуйте", start: 1.1, end: 1.8, voice: 1, pitch: 230 },
    { text: "Алексей на связи", start: 2.2, end: 3, voice: 1, pitch: 230 },
    { text: "до пятницы", start: 3.1, end: 3.6, voice: null, pitch: null },
    { text: "Хорошо", start: 6, end: 6.4, voice: null, pitch: null },
  ],
  "Ирина Павлова",
);
const speakersOk =
  dialogue.map((line) => line.speaker).join(",") === "agent,client,agent,agent,client" &&
  dialogue[0].name === "Алексей Морозов" &&
  dialogue[1].name === "Ирина Павлова";
if (!speakersOk) console.log("SPEAKERS", JSON.stringify(dialogue));
if (score.ratio < 0.9 || falseHits.length > 0 || kinds !== expected || !contextOk || !speakersOk) {
  process.exit(1);
}

import { ACCURACY_NOW, contextHits, rehearsalHits, scoreAccuracy } from "./accuracy";
import { defaultRules } from "./catalog";
import { extract } from "./extract";

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
if (score.ratio < 0.9 || falseHits.length > 0 || kinds !== expected || !contextOk) {
  process.exit(1);
}

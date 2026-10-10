import { rehearsalHits, scoreAccuracy } from "./accuracy";

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
if (score.ratio < 0.9 || falseHits.length > 0 || kinds !== expected) {
  process.exit(1);
}

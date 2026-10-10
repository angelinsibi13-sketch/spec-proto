import { fillTemplate } from "@/lib/catalog";
import { addDays, iso, startOfDay } from "@/lib/dates";
import type { AgreementType, Hit, Rule } from "@/lib/types";

const MONTHS: [string, number][] = [
  ["январ", 0],
  ["феврал", 1],
  ["март", 2],
  ["апрел", 3],
  ["мая", 4],
  ["мае", 4],
  ["июн", 5],
  ["июл", 6],
  ["август", 7],
  ["сентябр", 8],
  ["октябр", 9],
  ["ноябр", 10],
  ["декабр", 11],
];

const WEEKDAYS: [RegExp, number][] = [
  [/воскресень[а-я]*/, 0],
  [/понедельник[а-я]*/, 1],
  [/вторник[а-я]*/, 2],
  [/сред[аыуе][а-я]*/, 3],
  [/четверг[а-я]*/, 4],
  [/пятниц[а-я]*/, 5],
  [/суббот[а-я]*/, 6],
];

const MONTH_WORD =
  "январ[а-я]*|феврал[а-я]*|март[а-я]*|апрел[а-я]*|мая|мае|июн[а-я]*|июл[а-я]*|август[а-я]*|сентябр[а-я]*|октябр[а-я]*|ноябр[а-я]*|декабр[а-я]*";

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[«»"“”]/g, " ")
    .replace(/к\s*\.\s*п/g, "кп")
    .replace(/(^|[^а-яa-z0-9])ка\s*пэ([^а-яa-z0-9]|$)/g, "$1кп$2")
    .replace(/(^|[^а-яa-z0-9])капэ([^а-яa-z0-9]|$)/g, "$1кп$2")
    .replace(/(^|[^а-яa-z0-9])кэпэ([^а-яa-z0-9]|$)/g, "$1кп$2")
    .replace(/(^|[^а-яa-z0-9])со\s+звон/g, "$1созвон")
    .replace(/комерческ/g, "коммерческ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordIndex(text: string, keyword: string): number {
  const stem = normalize(keyword);
  if (!stem) return -1;
  if (stem.length <= 3) {
    const match = new RegExp(
      `(^|[^а-яa-z0-9])${escapeReg(stem)}([^а-яa-z0-9]|$)`,
    ).exec(text);
    return match ? match.index + match[1].length : -1;
  }
  const index = text.indexOf(stem);
  if (index < 0) return -1;
  if (stem === "договор" && text.startsWith("договорен", index)) return -1;
  return index;
}

function matchType(text: string, rules: Rule[]): { rule: Rule; index: number } | null {
  let best: { rule: Rule; index: number } | null = null;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    for (const keyword of rule.keywords.split(",")) {
      const index = keywordIndex(text, keyword);
      if (index < 0) continue;
      if (!best || index < best.index) best = { rule, index };
    }
  }
  return best;
}

function monthIndex(word: string): number | null {
  for (const [stem, index] of MONTHS) {
    if (word.startsWith(stem)) return index;
  }
  return null;
}

function roll(now: Date, month: number, day: number, year?: number): string | null {
  if (day < 1 || day > 31 || month < 0 || month > 11) return null;
  if (year) {
    const full = year < 100 ? 2000 + year : year;
    const date = new Date(full, month, day);
    if (date.getMonth() !== month) return null;
    return iso(date);
  }
  const thisYear = new Date(now.getFullYear(), month, day);
  if (thisYear.getMonth() !== month) return null;
  if (thisYear < startOfDay(now)) {
    return iso(new Date(now.getFullYear() + 1, month, day));
  }
  return iso(thisYear);
}

function nextWeekday(now: Date, weekday: number): string {
  const delta = (weekday - now.getDay() + 7) % 7;
  return iso(addDays(now, delta));
}

function closest<T extends { index: number }>(items: T[], anchor: number): T | null {
  if (items.length === 0) return null;
  return items.reduce((best, item) =>
    Math.abs(item.index - anchor) < Math.abs(best.index - anchor) ? item : best,
  );
}

function collectDates(text: string, now: Date): { due: string; index: number }[] {
  const found: { due: string; index: number }[] = [];

  for (const match of text.matchAll(/(\d{1,2})[.](\d{1,2})(?:[.](\d{2,4}))?/g)) {
    if (match.index === undefined) continue;
    const year = match[3] ? Number(match[3]) : undefined;
    const due = roll(now, Number(match[2]) - 1, Number(match[1]), year);
    if (due) found.push({ due, index: match.index });
  }

  for (const match of text.matchAll(new RegExp(`(\\d{1,2})\\s+(${MONTH_WORD})`, "g"))) {
    if (match.index === undefined) continue;
    const month = monthIndex(match[2]);
    if (month === null) continue;
    const due = roll(now, month, Number(match[1]));
    if (due) found.push({ due, index: match.index });
  }

  const push = (pattern: RegExp, due: string) => {
    const match = pattern.exec(text);
    if (!match) return;
    const index = match[1] && match[0] !== match[1] ? match.index + match[1].length : match.index;
    found.push({ due, index });
  };

  push(/конц[а-я]+\s+месяц/, iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  push(/послезавтра/, iso(addDays(now, 2)));
  push(/(^|[^а-я])(завтра)/, iso(addDays(now, 1)));
  push(/сегодня/, iso(now));
  push(/конц[а-я]+\s+дня/, iso(now));

  const duration = text.match(/в течение\s+(\d+|[а-я]+)\s+(?:день|дня|дней)/);
  if (duration) {
    const raw = duration[1];
    const words: Record<string, number> = {
      один: 1,
      одного: 1,
      двух: 2,
      трех: 3,
      четырех: 4,
      пяти: 5,
      шести: 6,
      семи: 7,
      восьми: 8,
      девяти: 9,
      десяти: 10,
    };
    const days = /^\d+$/.test(raw) ? Number(raw) : words[raw];
    if (days && days > 0 && days < 366 && duration.index !== undefined) {
      found.push({ due: iso(addDays(now, days)), index: duration.index });
    }
  }

  for (const [pattern, weekday] of WEEKDAYS) {
    const match = pattern.exec(text);
    if (match) found.push({ due: nextWeekday(now, weekday), index: match.index });
  }

  return found;
}

function dateSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  for (const pattern of [
    /\d{1,2}[.]\d{1,2}(?:[.]\d{2,4})?/g,
    new RegExp(`\\d{1,2}\\s+(?:${MONTH_WORD})`, "g"),
  ]) {
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      spans.push([match.index, match.index + match[0].length]);
    }
  }
  return spans;
}

function overlaps(start: number, end: number, spans: [number, number][]): boolean {
  return spans.some(([from, to]) => start < to && end > from);
}

function collectTimes(text: string): { time: string; index: number }[] {
  const spans = dateSpans(text);
  const found: { time: string; index: number }[] = [];

  for (const match of text.matchAll(/утром|днем|вечером/g)) {
    if (match.index === undefined) continue;
    const time = match[0] === "утром" ? "09:00" : match[0] === "днем" ? "13:00" : "18:00";
    found.push({ time, index: match.index });
  }

  for (const match of text.matchAll(/(?:в|до)\s*(\d{1,2})(?::(\d{2}))?(?!\d)/g)) {
    if (match.index === undefined) continue;
    const hour = Number(match[1]);
    const minute = match[2] ?? "00";
    if (hour > 23 || Number(minute) > 59) continue;
    const digitAt = match.index + match[0].search(/\d/);
    if (overlaps(digitAt, digitAt + match[1].length, spans)) continue;
    found.push({
      time: `${String(hour).padStart(2, "0")}:${minute}`,
      index: match.index,
    });
  }

  return found;
}

export function parseAmount(text: string): number | null {
  const thousands = text.match(/(\d[\d\s]*)\s*(?:тысяч|тыс\b)/);
  if (thousands) {
    const value = Number(thousands[1].replace(/\s/g, ""));
    return Number.isFinite(value) ? value * 1000 : null;
  }
  const rubles = text.match(/(\d[\d\s]*)\s*(?:руб|₽)/);
  if (rubles) {
    const value = Number(rubles[1].replace(/\s/g, ""));
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

export function extract(text: string, rules: Rule[], now: Date, client: string): Hit | null {
  const normalized = normalize(text);
  const matched = matchType(normalized, rules);
  if (!matched) return null;
  const timeHit = closest(collectTimes(normalized), matched.index);
  const time = timeHit && Math.abs(timeHit.index - matched.index) <= 60 ? timeHit.time : null;
  const due = closest(collectDates(normalized, now), matched.index)?.due ?? (time ? iso(now) : null);
  if (!due) return null;
  return {
    type: matched.rule.type,
    due,
    time,
    priority: matched.rule.priority,
    title: fillTemplate(matched.rule.template, client),
    amount: parseAmount(normalized),
  };
}

export function dedupeKey(type: AgreementType, due: string): string {
  return `${type}|${due}`;
}

function hasKeyword(text: string, rules: Rule[]): boolean {
  return matchType(normalize(text), rules) !== null;
}

function hasWhen(text: string, now: Date): boolean {
  const normalized = normalize(text);
  return collectDates(normalized, now).length > 0 || collectTimes(normalized).length > 0;
}

function dateNeighbor(phrases: string[], index: number, rules: Rule[], now: Date): number | null {
  for (const step of [1, -1]) {
    const near = index + step;
    if (near < 0 || near >= phrases.length) continue;
    const nearText = phrases[near];
    if (!hasKeyword(nearText, rules) && hasWhen(nearText, now)) return near;
    const far = index + step * 2;
    if (far < 0 || far >= phrases.length) continue;
    const bridge = normalize(nearText);
    const filler = bridge.length > 0 && bridge.length <= 24 && !hasKeyword(nearText, rules) && !hasWhen(nearText, now);
    if (filler && !hasKeyword(phrases[far], rules) && hasWhen(phrases[far], now)) return far;
  }
  return null;
}

export function borrowPhrases(phrases: string[], rules: Rule[], now: Date, client: string): string[] {
  const extra: string[] = [];
  for (let index = 0; index < phrases.length; index += 1) {
    const current = phrases[index];
    if (!current || extract(current, rules, now, client)) continue;
    const own = matchType(normalize(current), rules);
    if (!own) continue;
    const neighbor = dateNeighbor(phrases, index, rules, now);
    if (neighbor === null) continue;
    const joined = neighbor < index ? `${phrases[neighbor]} ${current}` : `${current} ${phrases[neighbor]}`;
    const hit = extract(joined, rules, now, client);
    if (hit && hit.type === own.rule.type) extra.push(joined);
  }
  return extra;
}

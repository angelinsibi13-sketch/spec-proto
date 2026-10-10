import { defaultRules } from "@/lib/catalog";
import { DEMO_SCRIPT } from "@/lib/demo-script";
import { borrowPhrases, dedupeKey, extract } from "@/lib/extract";
import type { AgreementType, Hit, Rule } from "@/lib/types";

export const ACCURACY_NOW = new Date(2026, 9, 9, 10, 0, 0);

export type AccuracyCase = {
  phrase: string;
  type: AgreementType;
  due: string;
  time?: string;
  amount?: number;
};

export const ACCURACY_CASES: AccuracyCase[] = [
  { phrase: "Пришлю КП до пятницы", type: "kp", due: "2026-10-09" },
  { phrase: "Отправлю коммерческое предложение до 17.10", type: "kp", due: "2026-10-17" },
  { phrase: "КП будет в понедельник", type: "kp", due: "2026-10-12" },
  { phrase: "Давайте созвонимся в понедельник в 11", type: "meeting", due: "2026-10-12", time: "11:00" },
  { phrase: "Встреча завтра в 15:00", type: "meeting", due: "2026-10-10", time: "15:00" },
  { phrase: "Поставьте встречу на среду", type: "meeting", due: "2026-10-14" },
  { phrase: "Оплатим счёт до 20 октября", type: "payment", due: "2026-10-20" },
  { phrase: "Оплата до пятницы", type: "payment", due: "2026-10-09" },
  { phrase: "Счёт оплачу завтра", type: "payment", due: "2026-10-10" },
  { phrase: "Перезвоните мне завтра утром", type: "callback", due: "2026-10-10", time: "09:00" },
  { phrase: "Перезвон в четверг", type: "callback", due: "2026-10-15" },
  { phrase: "Я перезвоню сегодня в 16:00", type: "callback", due: "2026-10-09", time: "16:00" },
  { phrase: "Договор на подпись пришлите сегодня до 18:00", type: "docs", due: "2026-10-09", time: "18:00" },
  { phrase: "Пришлите документы до вторника", type: "docs", due: "2026-10-13" },
  { phrase: "Подпишем договор в пятницу", type: "docs", due: "2026-10-09" },
  { phrase: "Вышлите КП до 3 ноября", type: "kp", due: "2026-11-03" },
  { phrase: "Созвон послезавтра в 10", type: "meeting", due: "2026-10-11", time: "10:00" },
  { phrase: "Оплата до 01.11", type: "payment", due: "2026-11-01" },
  { phrase: "Перезвоните в понедельник вечером", type: "callback", due: "2026-10-12", time: "18:00" },
  { phrase: "Коммерческое предложение нужно до конца дня", type: "kp", due: "2026-10-09" },
  { phrase: "Встретимся 12 октября в 14:00", type: "meeting", due: "2026-10-12", time: "14:00" },
  { phrase: "Счёт до среды", type: "payment", due: "2026-10-14" },
  { phrase: "Договор пришлите сегодня", type: "docs", due: "2026-10-09" },
  { phrase: "Перезвоните до 18:00", type: "callback", due: "2026-10-09", time: "18:00" },
  { phrase: "Пришлите КП до 17.05", type: "kp", due: "2027-05-17" },
  { phrase: "Оплатим до конца месяца", type: "payment", due: "2026-10-31" },
  { phrase: "Ответим в течение 3 дней", type: "docs", due: "2026-10-12" },
  { phrase: "Пришлём ответ в течение трех дней", type: "docs", due: "2026-10-12" },
  { phrase: "Счёт на 186 тысяч оплатим до 20 октября", type: "payment", due: "2026-10-20", amount: 186000 },
  { phrase: "Счёт на 6 200 рублей оплатим до 20 октября", type: "payment", due: "2026-10-20", amount: 6200 },
  { phrase: "КП на 45 000 рублей до пятницы", type: "kp", due: "2026-10-09", amount: 45000 },
  { phrase: "Пришлю ка пэ до пятницы", type: "kp", due: "2026-10-09" },
  { phrase: "Давайте со звон в понедельник в 11", type: "meeting", due: "2026-10-12", time: "11:00" },
];

export const NEGATIVE_PHRASES = [
  "Добрый день, это Алексей, оргтехника.",
  "Нам нужны МФУ в офис на Лесной.",
  "Добавьте в поставку цветную печать.",
];

export type ScoreRow = AccuracyCase & { hit: Hit | null; ok: boolean };

export function scoreAccuracy(rules: Rule[] = defaultRules(), now = ACCURACY_NOW) {
  const rows: ScoreRow[] = ACCURACY_CASES.map((item) => {
    const hit = extract(item.phrase, rules, now, "Клиент");
    const ok = Boolean(
      hit &&
        hit.type === item.type &&
        hit.due === item.due &&
        (item.time ? hit.time === item.time : true) &&
        (item.amount !== undefined ? hit.amount === item.amount : true),
    );
    return { ...item, hit, ok };
  });
  const passed = rows.filter((row) => row.ok).length;
  const negatives = NEGATIVE_PHRASES.map((phrase) => ({
    phrase,
    hit: extract(phrase, rules, now, "Клиент"),
  }));
  return {
    rows,
    negatives,
    passed,
    total: rows.length,
    ratio: rows.length === 0 ? 0 : passed / rows.length,
  };
}

export function contextHits(rules: Rule[] = defaultRules(), now = ACCURACY_NOW) {
  const split = borrowPhrases(["Пришлю ка пэ", "до пятницы"], rules, now, "Клиент");
  const across = borrowPhrases(["Пришлю КП", "Хорошо", "до пятницы"], rules, now, "Клиент");
  const meeting = borrowPhrases(["Давайте созвон", "в понедельник в 11"], rules, now, "Клиент");
  const separate = borrowPhrases(["Пришлю КП до пятницы", "Созвон в понедельник"], rules, now, "Клиент");
  const consent = borrowPhrases(["Зафиксировать договоренности", "Да", "до пятницы"], rules, now, "Клиент");
  return { split, across, meeting, separate, consent };
}

export function rehearsalHits(rules: Rule[] = defaultRules(), now = ACCURACY_NOW) {
  const seen = new Set<string>();
  const hits: { phrase: string; hit: Hit }[] = [];
  for (const line of DEMO_SCRIPT) {
    const hit = extract(line.text, rules, now, "Мария Соколова");
    if (!hit) continue;
    const key = dedupeKey(hit.type, hit.due);
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ phrase: line.text, hit });
  }
  return hits;
}

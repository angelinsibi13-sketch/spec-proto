import type { Direction } from "@/lib/types";

export const MANAGER = "Алексей Морозов";

export type DemoProfile = {
  id: string;
  direction: Direction;
  client: string;
  company: string;
  role: string;
  phone: string;
};

export const OUT_CALL: DemoProfile = {
  id: "demo-out",
  direction: "out",
  client: "Мария Соколова",
  company: "«Лучи»",
  role: "закупки",
  phone: "+375 29 440-19-20",
};

export const IN_CALL: DemoProfile = {
  id: "demo-in",
  direction: "in",
  client: "Олег Ким",
  company: "«Неман Логистик»",
  role: "директор",
  phone: "+375 33 220-44-18",
};

const PHONES: [string, string][] = [
  ["Олег", IN_CALL.phone],
  ["Мария", OUT_CALL.phone],
  ["Ирина", "+375 29 510-22-14"],
  ["Сергей", "+375 33 118-40-77"],
  ["Наталья", "+375 29 663-08-41"],
];

export function knownPhone(client: string, phone: string): string {
  const trimmed = phone.trim();
  if (trimmed) return trimmed;
  return PHONES.find(([name]) => client.includes(name))?.[1] ?? "";
}

export function profileFor(direction: Direction): DemoProfile {
  return direction === "in" ? IN_CALL : OUT_CALL;
}

export function recordingFor(
  client: string,
  calls: { client: string; audio?: string; startedAt: string }[],
): string | null {
  const own = calls
    .filter((call) => call.client === client && call.audio)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (own[0]?.audio) return own[0].audio;
  const bundled: [string, string][] = [
    ["Мария", "/recordings/maria.mp3"],
    ["Олег", "/recordings/oleg.mp3"],
    ["Ирина", "/recordings/irina.mp3"],
    ["Сергей", "/recordings/sergey.mp3"],
    ["Наталья", "/recordings/natalya.mp3"],
  ];
  return bundled.find(([name]) => client.includes(name))?.[1] ?? null;
}

export type ScriptLine = {
  speaker: "agent" | "client";
  name: string;
  text: string;
  atMs: number;
};

const GAP = 2200;

function at(step: number): number {
  return 600 + step * GAP;
}

export const OUT_SCRIPT: ScriptLine[] = [
  {
    speaker: "agent",
    name: MANAGER,
    text: "Мария, это Алексей, поставка оргтехники. Разговор записывается, чтобы зафиксировать договорённости. Вы согласны?",
    atMs: at(0),
  },
  {
    speaker: "client",
    name: OUT_CALL.client,
    text: "Да, согласна. Нам нужны МФУ в офис на Лесной.",
    atMs: at(1),
  },
  {
    speaker: "agent",
    name: MANAGER,
    text: "Соберу спецификацию на двадцать аппаратов.",
    atMs: at(2),
  },
  {
    speaker: "client",
    name: OUT_CALL.client,
    text: "Пришлите КП до пятницы, пожалуйста.",
    atMs: at(3),
  },
  {
    speaker: "agent",
    name: MANAGER,
    text: "КП будет у вас до пятницы.",
    atMs: at(4),
  },
  {
    speaker: "client",
    name: OUT_CALL.client,
    text: "И поставьте созвон с инженером в понедельник в 11.",
    atMs: at(5),
  },
  {
    speaker: "agent",
    name: MANAGER,
    text: "Встреча в понедельник в 11:00.",
    atMs: at(6),
  },
  {
    speaker: "client",
    name: OUT_CALL.client,
    text: "Счёт на 6 200 рублей оплатим до 20 октября.",
    atMs: at(7),
  },
  {
    speaker: "agent",
    name: MANAGER,
    text: "Оплата 6 200 рублей до 20 октября, принял.",
    atMs: at(8),
  },
  {
    speaker: "client",
    name: OUT_CALL.client,
    text: "Договор на подпись пришлите сегодня до 18:00.",
    atMs: at(9),
  },
  {
    speaker: "agent",
    name: MANAGER,
    text: "По сервису ответим в течение 3 дней. И я перезвоню завтра утром.",
    atMs: at(10),
  },
  {
    speaker: "client",
    name: OUT_CALL.client,
    text: "Да, перезвоните завтра утром. Спасибо.",
    atMs: at(11),
  },
];

export const IN_SCRIPT: ScriptLine[] = [
  {
    speaker: "agent",
    name: MANAGER,
    text: "Олег, здравствуйте, Алексей на связи. Разговор записывается для фиксации договорённостей. Вы не против?",
    atMs: at(0),
  },
  {
    speaker: "client",
    name: IN_CALL.client,
    text: "Не против. Нужно коммерческое предложение на принтеры до четверга.",
    atMs: at(1),
  },
  {
    speaker: "agent",
    name: MANAGER,
    text: "КП на принтеры подготовлю до четверга.",
    atMs: at(2),
  },
  {
    speaker: "client",
    name: IN_CALL.client,
    text: "Встреча на нашей площадке во вторник в 15:00.",
    atMs: at(3),
  },
  {
    speaker: "agent",
    name: MANAGER,
    text: "Встреча во вторник в 15:00, записал.",
    atMs: at(4),
  },
  {
    speaker: "client",
    name: IN_CALL.client,
    text: "Бюджет 2 800 рублей, счёт оплатим до конца месяца.",
    atMs: at(5),
  },
  {
    speaker: "agent",
    name: MANAGER,
    text: "Договор вышлем в течение 2 дней.",
    atMs: at(6),
  },
  {
    speaker: "client",
    name: IN_CALL.client,
    text: "И перезвоните мне в пятницу вечером.",
    atMs: at(7),
  },
];

export function scriptFor(direction: Direction): ScriptLine[] {
  return direction === "in" ? IN_SCRIPT : OUT_SCRIPT;
}

export const SCRIPT_TAIL_MS = 1400;

export const DEMO_SCRIPT = OUT_SCRIPT;

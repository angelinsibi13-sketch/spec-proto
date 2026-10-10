import { defaultRules } from "@/lib/catalog";
import { addDays, iso } from "@/lib/dates";
import { IN_CALL, IN_SCRIPT, MANAGER, OUT_CALL, profileFor } from "@/lib/demo-script";
import { borrowPhrases, dedupeKey, extract } from "@/lib/extract";
import { buildSummary, describeDeal } from "@/lib/hints";
import { tidySpeech } from "@/lib/speech";
import { packReminder } from "@/lib/reminders";
import { labelSpeakers, type SpeechSegment } from "@/lib/speakers";
import type {
  Agreement,
  AgreementType,
  AuditEntry,
  CalEvent,
  Call,
  Direction,
  Origin,
  Priority,
  Rule,
  ReminderItem,
  Task,
  Vault,
} from "@/lib/types";

export const TRANSCRIPT_ENGINE = 5;

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function audit(vault: Vault, action: string, detail: string, now = new Date()): Vault {
  const last = vault.audit[vault.audit.length - 1];
  if (last && last.action === action && last.detail === detail && Date.now() - Date.parse(last.at) < 4000) {
    return vault;
  }
  const entry: AuditEntry = {
    id: uid("aud"),
    at: now.toISOString(),
    actor: MANAGER,
    action,
    detail,
  };
  return { ...vault, audit: [...vault.audit, entry] };
}

function record(vault: Vault, call: Call, phrase: string, now: Date, origin: Origin = "demo"): Vault {
  const hit = extract(phrase, vault.rules, now, call.client);
  if (!hit) return vault;
  const key = dedupeKey(hit.type, hit.due);
  const exists = vault.agreements.some(
    (item) => item.callId === call.id && dedupeKey(item.type, item.due) === key,
  );
  if (exists) return vault;

  const createdAt = now.toISOString();
  const agreement: Agreement = {
    id: uid("agr"),
    callId: call.id,
    type: hit.type,
    client: call.client,
    company: call.company,
    phrase: describeDeal(hit.type, hit.due, hit.time, hit.amount, now),
    title: hit.title,
    due: hit.due,
    time: hit.time,
    priority: hit.priority,
    amount: hit.amount,
    confirmed: null,
    createdAt,
    origin,
    edited: false,
  };
  const task: Task = {
    id: uid("task"),
    agreementId: agreement.id,
    callId: call.id,
    type: hit.type,
    title: hit.title,
    client: call.client,
    company: call.company,
    due: hit.due,
    time: hit.time,
    priority: hit.priority,
    amount: hit.amount,
    status: "open",
    origin,
  };
  const event: CalEvent = {
    id: uid("evt"),
    agreementId: agreement.id,
    callId: call.id,
    type: hit.type,
    title: hit.title,
    client: call.client,
    company: call.company,
    due: hit.due,
    time: hit.time,
    amount: hit.amount,
    origin,
  };

  return audit(
    {
      ...vault,
      agreements: [...vault.agreements, agreement],
      tasks: [...vault.tasks, task],
      events: [...vault.events, event],
    },
    "Договорённость создана",
    `${hit.type} · ${hit.due}${hit.amount ? ` · ${hit.amount}` : ""}`,
    now,
  );
}

function splitPhrases(text: string): string[] {
  const pieces = text
    .split(/[\n.!?]+/)
    .flatMap((part) => (part.length > 160 ? part.split(/,(?=\s)/) : [part]))
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
  return pieces.length > 0 ? pieces : [text.trim()].filter(Boolean);
}

function stripDerived(vault: Vault, callId: string): Vault {
  const eventIds = new Set(vault.events.filter((event) => event.callId === callId).map((event) => event.id));
  const reminders = { ...vault.reminders };
  for (const id of eventIds) delete reminders[id];
  return {
    ...vault,
    agreements: vault.agreements.filter((item) => item.callId !== callId),
    tasks: vault.tasks.filter((item) => item.callId !== callId),
    events: vault.events.filter((item) => item.callId !== callId),
    reminders,
  };
}

function speakInto(vault: Vault, call: Call, segments: SpeechSegment[], origin: Origin, now: Date): Vault {
  const labeled = labelSpeakers(segments, call.client);
  const raw: string[] = [];
  let next = vault;
  for (const piece of labeled) {
    const line = {
      id: uid("line"),
      speaker: piece.speaker,
      name: piece.name,
      text: tidySpeech(piece.text),
      fromScript: false,
      atMs: Math.round(piece.start * 1000),
    };
    next = {
      ...next,
      calls: next.calls.map((item) =>
        item.id === call.id
          ? {
              ...item,
              lines: [...item.lines, line],
              counterpartyNotified:
                item.counterpartyNotified ||
                (piece.speaker === "client" && partyAgrees(piece.text.toLowerCase())),
            }
          : item,
      ),
    };
    const current = next.calls.find((item) => item.id === call.id) ?? call;
    for (const phrase of splitPhrases(piece.text)) {
      raw.push(phrase);
      next = record(next, current, phrase, now, origin);
    }
  }
  const current = next.calls.find((item) => item.id === call.id) ?? call;
  for (const phrase of borrowPhrases(raw, next.rules, now, call.client)) {
    next = record(next, current, phrase, now, origin);
  }
  return next;
}

export function ingestRecording(
  vault: Vault,
  input: { client: string; company: string; segments: SpeechSegment[] },
  now = new Date(),
): { vault: Vault; created: number; callId: string } {
  const client = input.client.trim() || "Клиент с записи";
  const company = input.company.trim() || "Без компании";
  const call: Call = {
    id: uid("rec"),
    direction: "in",
    client,
    company,
    role: "запись",
    phone: "",
    startedAt: now.toISOString(),
    endedAt: null,
    lines: [],
    summary: null,
    summarySent: false,
    origin: "upload",
    counterpartyNotified: false,
  };
  const seeded: Vault = { ...vault, calls: [...vault.calls, call] };
  const before = seeded.agreements.length;
  let next = speakInto(seeded, call, input.segments, "upload", now);
  next = {
    ...next,
    calls: next.calls.map((item) =>
      item.id === call.id ? { ...item, endedAt: now.toISOString() } : item,
    ),
  };
  return {
    vault: audit(next, "Запись разобрана", `${client}, новых задач ${next.agreements.length - before}`, now),
    created: next.agreements.length - before,
    callId: call.id,
  };
}

export function applyRecordingTranscript(
  vault: Vault,
  input: {
    client: string;
    company: string;
    role: string;
    phone: string;
    audio: string;
    audioSha: string;
    sourceFile: string;
    known: boolean;
    segments: SpeechSegment[];
  },
  now = new Date(),
): Vault {
  const client = input.client.trim() || "Клиент с записи";
  const existing =
    vault.calls.find(
      (call) =>
        call.origin !== "demo" &&
        (call.sourceFile === input.sourceFile || Boolean(call.audio?.endsWith(`/${input.sourceFile}`))),
    ) ??
    (input.known
      ? vault.calls.find((call) => call.origin !== "demo" && call.client === client)
      : undefined);
  const callId = existing?.id ?? uid("rec");
  const origin: Origin = existing?.origin ?? "upload";
  const cleared = existing ? stripDerived(vault, callId) : vault;
  const call: Call = {
    id: callId,
    direction: existing?.direction ?? "in",
    client: existing?.client || client,
    company: existing?.company || input.company.trim() || "Запись",
    role: existing?.role || input.role || "запись",
    phone: existing?.phone || input.phone || "",
    startedAt: existing?.startedAt ?? now.toISOString(),
    endedAt: now.toISOString(),
    lines: [],
    summary: null,
    summarySent: false,
    origin,
    counterpartyNotified: false,
    audio: input.audio,
    audioSha: input.audioSha,
    sourceFile: input.sourceFile,
    transcriptEngine: TRANSCRIPT_ENGINE,
  };
  const seeded: Vault = existing
    ? { ...cleared, calls: cleared.calls.map((item) => (item.id === callId ? call : item)) }
    : { ...cleared, calls: [...cleared.calls, call] };
  const before = seeded.agreements.length;
  const next = speakInto(seeded, call, input.segments, origin, now);
  return audit(
    next,
    "Запись разобрана",
    `${call.client}, новых задач ${next.agreements.length - before}`,
    now,
  );
}

export function markRecording(
  vault: Vault,
  input: { sourceFile: string; audioSha: string; client: string; known: boolean; note?: string },
): { vault: Vault; changed: boolean } {
  const existing =
    vault.calls.find(
      (call) =>
        call.origin !== "demo" &&
        (call.sourceFile === input.sourceFile || Boolean(call.audio?.endsWith(`/${input.sourceFile}`))),
    ) ??
    (input.known ? vault.calls.find((call) => call.origin !== "demo" && call.client === input.client) : undefined);
  if (!existing) return { vault, changed: false };
  if (
    existing.audioSha === input.audioSha &&
    existing.transcriptNote === input.note &&
    existing.sourceFile === input.sourceFile &&
    existing.transcriptEngine === TRANSCRIPT_ENGINE
  ) {
    return { vault, changed: false };
  }
  return {
    changed: true,
    vault: {
      ...vault,
      calls: vault.calls.map((call) =>
        call.id === existing.id
          ? {
              ...call,
              audioSha: input.audioSha,
              sourceFile: input.sourceFile,
              transcriptNote: input.note,
              transcriptEngine: TRANSCRIPT_ENGINE,
            }
          : call,
      ),
    },
  };
}

export function createSeedVault(now = new Date()): Vault {
  const day = (offset: number) => iso(addDays(now, offset));
  const base = blankVault();
  base.consentAt = now.toISOString();

  const seeds: {
    client: string;
    company: string;
    type: AgreementType;
    title: string;
    due: string;
    time: string | null;
    amount: number | null;
    priority: Priority;
    status: "open" | "done";
    phrase: string;
  }[] = [
    {
      client: "Мария Соколова",
      company: "«Лучи»",
      type: "kp",
      title: "Отправить КП — Мария Соколова",
      due: day(-7),
      time: null,
      amount: null,
      priority: "high",
      status: "open",
      phrase: "Вы обещали прислать КП ещё на прошлой неделе",
    },
    {
      client: "Олег Ким",
      company: "«Неман Логистик»",
      type: "payment",
      title: "Проконтролировать оплату — Олег Ким",
      due: day(-1),
      time: null,
      amount: 1850,
      priority: "high",
      status: "open",
      phrase: "Счёт на 1 850 рублей оплатим вчера",
    },
    {
      client: "Мария Соколова",
      company: "«Лучи»",
      type: "meeting",
      title: "Созвон — Мария Соколова",
      due: day(1),
      time: "15:00",
      amount: null,
      priority: "medium",
      status: "open",
      phrase: "Созвон завтра в 15:00",
    },
    {
      client: "Олег Ким",
      company: "«Неман Логистик»",
      type: "docs",
      title: "Отправить документы — Олег Ким",
      due: day(-6),
      time: null,
      amount: null,
      priority: "high",
      status: "done",
      phrase: "Договор уже у юристов",
    },
  ];

  for (const item of seeds) {
    const callId = uid("seed-call");
    const agreementId = uid("agr");
    base.calls.push({
      id: callId,
      direction: "out",
      client: item.client,
      company: item.company,
      role: "клиент",
      phone: item.client.includes("Олег") ? IN_CALL.phone : OUT_CALL.phone,
      startedAt: now.toISOString(),
      endedAt: now.toISOString(),
      lines: [
        {
          id: uid("line"),
          speaker: "agent",
          name: MANAGER,
          text: "Разговор фиксируется, чтобы не потерять договорённость.",
          fromScript: false,
        },
        {
          id: uid("line"),
          speaker: "client",
          name: item.client,
          text: item.phrase,
          fromScript: false,
        },
      ],
      summary: null,
      summarySent: true,
      origin: "seed",
      counterpartyNotified: true,
      audio: item.client.includes("Олег") ? "/recordings/oleg.mp3" : "/recordings/maria.mp3",
    });
    base.agreements.push({
      id: agreementId,
      callId,
      type: item.type,
      client: item.client,
      company: item.company,
      phrase: item.phrase,
      title: item.title,
      due: item.due,
      time: item.time,
      priority: item.priority,
      amount: item.amount,
      confirmed: true,
      createdAt: now.toISOString(),
      origin: "seed",
      edited: false,
    });
    base.tasks.push({
      id: uid("task"),
      agreementId,
      callId,
      type: item.type,
      title: item.title,
      client: item.client,
      company: item.company,
      due: item.due,
      time: item.time,
      priority: item.priority,
      amount: item.amount,
      status: item.status,
      origin: "seed",
    });
    base.events.push({
      id: uid("evt"),
      agreementId,
      callId,
      type: item.type,
      title: item.title,
      client: item.client,
      company: item.company,
      due: item.due,
      time: item.time,
      amount: item.amount,
      origin: "seed",
    });
  }

  for (const bundle of extraBundles(now)) pushBundle(base, bundle, now);
  return audit(base, "Хранилище создано", "Стартовые сделки Алексея", now);
}

type BundleTask = {
  type: AgreementType;
  title: string;
  due: string;
  time: string | null;
  amount: number | null;
  priority: Priority;
  status: "open" | "done";
  phrase: string;
};

type ClientBundle = {
  client: string;
  company: string;
  role: string;
  phone: string;
  audio: string;
  greeting: string;
  tasks: BundleTask[];
};

function extraBundles(now: Date): ClientBundle[] {
  const day = (offset: number) => iso(addDays(now, offset));
  return [
    {
      client: "Ирина Павлова",
      company: "«БелКанц»",
      role: "закупки",
      phone: "+375 29 510-22-14",
      audio: "/recordings/irina.mp3",
      greeting: "Ирина, это Алексей, поставка оргтехники. Разговор записывается, чтобы зафиксировать договорённости. Вы согласны?",
      tasks: [
        {
          type: "kp",
          title: "Отправить КП — Ирина Павлова",
          due: day(4),
          time: null,
          amount: null,
          priority: "high",
          status: "open",
          phrase: "Да, согласна. Пришлите коммерческое предложение до среды.",
        },
        {
          type: "payment",
          title: "Проконтролировать оплату — Ирина Павлова",
          due: day(5),
          time: null,
          amount: 3400,
          priority: "high",
          status: "open",
          phrase: "Счёт на 3 400 рублей оплатим в четверг.",
        },
        {
          type: "docs",
          title: "Отправить документы — Ирина Павлова",
          due: day(6),
          time: null,
          amount: null,
          priority: "medium",
          status: "open",
          phrase: "Договор на подпись пришлите в пятницу.",
        },
        {
          type: "meeting",
          title: "Созвон — Ирина Павлова",
          due: day(5),
          time: "11:00",
          amount: null,
          priority: "medium",
          status: "open",
          phrase: "Созвон в четверг в 11.",
        },
        {
          type: "callback",
          title: "Перезвонить — Ирина Павлова",
          due: day(1),
          time: "10:00",
          amount: null,
          priority: "high",
          status: "open",
          phrase: "Перезвоните завтра утром.",
        },
      ],
    },
    {
      client: "Сергей Волчек",
      company: "«Минск Принт»",
      role: "сервис",
      phone: "+375 33 118-40-77",
      audio: "/recordings/sergey.mp3",
      greeting: "Сергей, здравствуйте, Алексей на связи. Разговор записывается для фиксации договорённостей. Вы не против?",
      tasks: [
        {
          type: "meeting",
          title: "Встреча — Сергей Волчек",
          due: day(2),
          time: "10:00",
          amount: null,
          priority: "medium",
          status: "open",
          phrase: "Не против. Встреча в понедельник в 10.",
        },
        {
          type: "kp",
          title: "Отправить КП — Сергей Волчек",
          due: day(4),
          time: null,
          amount: null,
          priority: "high",
          status: "open",
          phrase: "Коммерческое предложение на принтеры до среды.",
        },
      ],
    },
    {
      client: "Наталья Гриб",
      company: "«Светлоторг»",
      role: "снабжение",
      phone: "+375 29 663-08-41",
      audio: "/recordings/natalya.mp3",
      greeting: "Наталья, это Алексей. Разговор записывается, чтобы не потерять договорённость. Вы согласны?",
      tasks: [
        {
          type: "payment",
          title: "Проконтролировать оплату — Наталья Гриб",
          due: day(3),
          time: null,
          amount: 920,
          priority: "medium",
          status: "open",
          phrase: "Да. Счёт на 920 рублей оплатим во вторник.",
        },
        {
          type: "docs",
          title: "Отправить документы — Наталья Гриб",
          due: day(4),
          time: null,
          amount: null,
          priority: "low",
          status: "open",
          phrase: "Документы пришлите до среды.",
        },
      ],
    },
  ];
}

function pushBundle(base: Vault, bundle: ClientBundle, now: Date) {
  const callId = uid("seed-call");
  base.calls.push({
    id: callId,
    direction: "out",
    client: bundle.client,
    company: bundle.company,
    role: bundle.role,
    phone: bundle.phone,
    startedAt: now.toISOString(),
    endedAt: now.toISOString(),
    lines: [
      {
        id: uid("line"),
        speaker: "agent",
        name: MANAGER,
        text: bundle.greeting,
        fromScript: false,
      },
      ...bundle.tasks.map((item) => ({
        id: uid("line"),
        speaker: "client" as const,
        name: bundle.client,
        text: item.phrase,
        fromScript: false,
      })),
    ],
    summary: null,
    summarySent: true,
    origin: "seed",
    counterpartyNotified: true,
    audio: bundle.audio,
  });
  for (const item of bundle.tasks) {
    const agreementId = uid("agr");
    base.agreements.push({
      id: agreementId,
      callId,
      type: item.type,
      client: bundle.client,
      company: bundle.company,
      phrase: item.phrase,
      title: item.title,
      due: item.due,
      time: item.time,
      priority: item.priority,
      amount: item.amount,
      confirmed: true,
      createdAt: now.toISOString(),
      origin: "seed",
      edited: false,
    });
    base.tasks.push({
      id: uid("task"),
      agreementId,
      callId,
      type: item.type,
      title: item.title,
      client: bundle.client,
      company: bundle.company,
      due: item.due,
      time: item.time,
      priority: item.priority,
      amount: item.amount,
      status: item.status,
      origin: "seed",
    });
    base.events.push({
      id: uid("evt"),
      agreementId,
      callId,
      type: item.type,
      title: item.title,
      client: bundle.client,
      company: bundle.company,
      due: item.due,
      time: item.time,
      amount: item.amount,
      origin: "seed",
    });
  }
}

export function ensureCatalog(vault: Vault, now = new Date()): { vault: Vault; changed: boolean } {
  if (!vault.consentAt) return { vault, changed: false };
  const present = new Set(vault.calls.map((call) => call.client));
  const missing = extraBundles(now).filter((bundle) => !present.has(bundle.client));
  if (missing.length === 0) return { vault, changed: false };
  const next: Vault = {
    ...vault,
    calls: [...vault.calls],
    agreements: [...vault.agreements],
    tasks: [...vault.tasks],
    events: [...vault.events],
    audit: [...vault.audit],
  };
  for (const bundle of missing) pushBundle(next, bundle, now);
  return {
    vault: audit(next, "Клиенты добавлены", missing.map((bundle) => bundle.client).join(", "), now),
    changed: true,
  };
}

export function blankVault(): Vault {
  return {
    consentAt: null,
    voice: true,
    rules: defaultRules(),
    calls: [],
    agreements: [],
    tasks: [],
    events: [],
    reminders: {},
    audit: [],
  };
}

function withoutDemo(vault: Vault): Vault {
  return {
    ...vault,
    calls: vault.calls.filter((item) => item.origin !== "demo"),
    agreements: vault.agreements.filter((item) => item.origin !== "demo"),
    tasks: vault.tasks.filter((item) => item.origin !== "demo"),
    events: vault.events.filter((item) => item.origin !== "demo"),
  };
}

export function beginDemo(vault: Vault, direction: Direction, now = new Date()): Vault {
  const next = withoutDemo(vault);
  const profile = profileFor(direction);
  const call: Call = {
    id: profile.id,
    direction,
    client: profile.client,
    company: profile.company,
    role: profile.role,
    phone: profile.phone,
    startedAt: now.toISOString(),
    endedAt: null,
    lines: [],
    summary: null,
    summarySent: false,
    origin: "demo",
    counterpartyNotified: false,
  };
  return audit(
    { ...next, calls: [...next.calls, call] },
    direction === "in" ? "Входящий звонок" : "Исходящий звонок",
    `${profile.client}, ${profile.company}`,
    now,
  );
}

export function activeDemo(vault: Vault): Call | null {
  return vault.calls.find((call) => call.origin === "demo" && call.endedAt === null) ?? null;
}

export function latestDemo(vault: Vault): Call | null {
  const calls = vault.calls.filter((call) => call.origin === "demo");
  return calls[calls.length - 1] ?? null;
}

function partyAgrees(text: string): boolean {
  return /соглас|не против/.test(text);
}

export function pushLine(
  vault: Vault,
  input: { speaker: "agent" | "client"; name: string; text: string; fromScript: boolean },
  now = new Date(),
): Vault {
  const call = activeDemo(vault);
  if (!call) return vault;
  const line = {
    id: uid("line"),
    speaker: input.speaker,
    name: input.name,
    text: input.text,
    fromScript: input.fromScript,
  };
  const withLine: Vault = {
    ...vault,
    calls: vault.calls.map((item) =>
      item.id === call.id
        ? {
            ...item,
            lines: [...item.lines, line],
            counterpartyNotified:
              item.counterpartyNotified ||
              (input.speaker === "client" && partyAgrees(input.text.toLowerCase())),
          }
        : item,
    ),
  };
  return record(withLine, { ...call, counterpartyNotified: true }, input.text, now);
}

export function confirmAgreement(vault: Vault, agreementId: string, confirmed: boolean): Vault {
  return audit(
    {
      ...vault,
      agreements: vault.agreements.map((item) =>
        item.id === agreementId ? { ...item, confirmed } : item,
      ),
    },
    confirmed ? "Подсказка подтверждена" : "Подсказка отложена",
    agreementId,
  );
}

export type AgreementPatch = {
  title?: string;
  due?: string;
  time?: string | null;
  amount?: number | null;
  phrase?: string;
  priority?: Priority;
};

export function removeAgreement(vault: Vault, agreementId: string): Vault {
  const current = vault.agreements.find((item) => item.id === agreementId);
  if (!current) return vault;
  const reminders = { ...(vault.reminders ?? {}) };
  for (const event of vault.events) {
    if (event.agreementId === agreementId) delete reminders[event.id];
  }
  return audit(
    {
      ...vault,
      agreements: vault.agreements.filter((item) => item.id !== agreementId),
      tasks: vault.tasks.filter((item) => item.agreementId !== agreementId),
      events: vault.events.filter((item) => item.agreementId !== agreementId),
      reminders,
    },
    "Договорённость удалена",
    current.title,
  );
}

export function editAgreement(vault: Vault, agreementId: string, patch: AgreementPatch): Vault {
  const current = vault.agreements.find((item) => item.id === agreementId);
  if (!current) return vault;
  const next = { ...current, ...patch, edited: true };
  return audit(
    {
      ...vault,
      agreements: vault.agreements.map((item) => (item.id === agreementId ? next : item)),
      tasks: vault.tasks.map((task) =>
        task.agreementId === agreementId
          ? {
              ...task,
              title: next.title,
              due: next.due,
              time: next.time,
              amount: next.amount,
              priority: next.priority,
            }
          : task,
      ),
      events: vault.events.map((event) =>
        event.agreementId === agreementId
          ? {
              ...event,
              title: next.title,
              due: next.due,
              time: next.time,
              amount: next.amount,
            }
          : event,
      ),
    },
    "Исправлена договорённость",
    `${next.title} · ${next.due}`,
  );
}

export function endDemo(vault: Vault, now = new Date()): Vault {
  const call = activeDemo(vault);
  if (!call) return vault;
  const ended: Call = { ...call, endedAt: now.toISOString(), summary: "" };
  const summary = buildSummary(ended, vault.agreements, now);
  return audit(
    {
      ...vault,
      calls: vault.calls.map((item) => (item.id === call.id ? { ...ended, summary } : item)),
    },
    "Звонок завершён",
    call.client,
    now,
  );
}

export function markSummarySent(vault: Vault, callId: string): Vault {
  const call = vault.calls.find((item) => item.id === callId);
  return audit(
    {
      ...vault,
      calls: vault.calls.map((item) => (item.id === callId ? { ...item, summarySent: true } : item)),
    },
    "Резюме отдано клиенту",
    call?.client ?? callId,
  );
}

export function setTaskStatus(vault: Vault, taskId: string, status: "open" | "done"): Vault {
  const task = vault.tasks.find((item) => item.id === taskId);
  return audit(
    {
      ...vault,
      tasks: vault.tasks.map((item) => (item.id === taskId ? { ...item, status } : item)),
    },
    status === "done" ? "Задача закрыта" : "Задача возвращена",
    task?.title ?? taskId,
  );
}

export function updateRule(vault: Vault, type: AgreementType, patch: Partial<Rule>): Vault {
  return audit(
    {
      ...vault,
      rules: vault.rules.map((rule) => (rule.type === type ? { ...rule, ...patch, type } : rule)),
    },
    "Правило изменено",
    type,
  );
}

export function setVoice(vault: Vault, voice: boolean): Vault {
  return { ...vault, voice };
}

export function setReminderItems(vault: Vault, eventId: string, items: ReminderItem[]): Vault {
  const event = vault.events.find((item) => item.id === eventId);
  if (!event) return vault;
  const clean = items
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && /^\d{2}:\d{2}$/.test(item.at))
    .slice(0, 8);
  const detail = clean.map((item) => `${item.kind} ${item.date} ${item.at}`).join("; ") || "список пуст";
  return audit(
    {
      ...vault,
      reminders: { ...vault.reminders, [eventId]: packReminder(clean) },
    },
    "Напоминания сохранены",
    `${event.title}: ${detail}`,
  );
}

export function addManualEvent(
  vault: Vault,
  input: { title: string; due: string; time: string; priority: Priority; reminders: ReminderItem[] },
  now = new Date(),
): Vault {
  const title = input.title.trim();
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(input.due)) return vault;
  if (!/^\d{2}:\d{2}$/.test(input.time)) return vault;
  const reminders = input.reminders
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && /^\d{2}:\d{2}$/.test(item.at))
    .slice(0, 8);
  const agreementId = uid("manual");
  const event: CalEvent = {
    id: uid("evt"),
    agreementId,
    callId: "manual",
    type: "meeting",
    title,
    client: "Своё",
    company: "Календарь",
    due: input.due,
    time: input.time,
    amount: null,
    origin: "manual",
  };
  const task: Task = {
    id: uid("task"),
    agreementId,
    callId: "manual",
    type: "meeting",
    title,
    client: "Своё",
    company: "Календарь",
    due: input.due,
    time: input.time,
    priority: input.priority,
    amount: null,
    status: "open",
    origin: "manual",
  };
  return audit(
    {
      ...vault,
      events: [...vault.events, event],
      tasks: [...vault.tasks, task],
      reminders: {
        ...vault.reminders,
        [event.id]: packReminder(reminders),
      },
    },
    "Событие добавлено",
    `${title} · ${input.due} ${input.time}, напоминаний ${reminders.length}`,
    now,
  );
}

export function ensureOlegTranscript(vault: Vault): { vault: Vault; changed: boolean } {
  const oleg = vault.calls.filter((call) => call.client.includes("Олег"));
  if (oleg.length === 0 || oleg.some((call) => call.lines.length >= IN_SCRIPT.length)) {
    return { vault, changed: false };
  }
  const target = [...oleg].sort((a, b) => b.lines.length - a.lines.length)[0];
  const lines = IN_SCRIPT.map((line) => ({
    id: uid("line"),
    speaker: line.speaker,
    name: line.name,
    text: line.text,
    fromScript: true,
  }));
  return {
    changed: true,
    vault: {
      ...vault,
      calls: vault.calls.map((call) =>
        call.id === target.id
          ? { ...call, direction: "in", lines, audio: call.audio || "/recordings/oleg.mp3" }
          : call,
      ),
    },
  };
}

export function noteAccess(vault: Vault, detail: string): Vault {
  return audit(vault, "Просмотр расшифровки", detail);
}

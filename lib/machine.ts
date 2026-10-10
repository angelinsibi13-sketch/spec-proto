import { defaultRules } from "@/lib/catalog";
import { addDays, iso } from "@/lib/dates";
import { IN_CALL, MANAGER, OUT_CALL, profileFor } from "@/lib/demo-script";
import { dedupeKey, extract } from "@/lib/extract";
import { buildSummary } from "@/lib/hints";
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
  Task,
  Vault,
} from "@/lib/types";

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
    phrase,
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

export function ingestRecording(
  vault: Vault,
  input: { client: string; company: string; segments: { text: string }[] },
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
    counterpartyNotified: true,
  };
  let next: Vault = { ...vault, calls: [...vault.calls, call] };
  const before = next.agreements.length;
  const phrases = input.segments.flatMap((segment) => splitPhrases(segment.text));
  for (const phrase of phrases) {
    const line = {
      id: uid("line"),
      speaker: "client" as const,
      name: client,
      text: phrase,
      fromScript: false,
    };
    next = {
      ...next,
      calls: next.calls.map((item) =>
        item.id === call.id ? { ...item, lines: [...item.lines, line] } : item,
      ),
    };
    next = record(next, call, phrase, now, "upload");
  }
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

  return audit(base, "Хранилище создано", "Стартовые сделки Алексея", now);
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

export function setReminder(vault: Vault, eventId: string, mode: "day" | "hour" | "custom", custom: string): Vault {
  const event = vault.events.find((item) => item.id === eventId);
  if (!event) return vault;
  const label = mode === "day" ? "за день" : mode === "hour" ? "за час" : custom.trim();
  return audit(
    {
      ...vault,
      reminders: { ...vault.reminders, [eventId]: { mode, custom: custom.trim() } },
    },
    "Напоминание сохранено",
    `${event.title}: ${label}`,
  );
}

export function noteAccess(vault: Vault, detail: string): Vault {
  return audit(vault, "Просмотр расшифровки", detail);
}

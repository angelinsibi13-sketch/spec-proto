import type { AgreementType, Priority, Rule } from "@/lib/types";

export const TYPE_ORDER: AgreementType[] = [
  "kp",
  "meeting",
  "payment",
  "callback",
  "docs",
];

export const TYPE_INFO: Record<
  AgreementType,
  { label: string; hint: string; description: string }
> = {
  kp: {
    label: "КП",
    hint: "отправить КП",
    description: "Коммерческое предложение",
  },
  meeting: {
    label: "Встреча",
    hint: "созвон",
    description: "Встреча или созвон",
  },
  payment: {
    label: "Оплата",
    hint: "оплата",
    description: "Счёт и оплата",
  },
  callback: {
    label: "Перезвон",
    hint: "перезвонить",
    description: "Обратный звонок",
  },
  docs: {
    label: "Документы",
    hint: "отправить договор",
    description: "Договор и подпись",
  },
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

export function defaultRules(): Rule[] {
  return [
    {
      type: "kp",
      enabled: true,
      keywords: "кп, коммерческ",
      priority: "high",
      template: "Отправить КП",
    },
    {
      type: "meeting",
      enabled: true,
      keywords: "встре, созвон",
      priority: "medium",
      template: "Созвон",
    },
    {
      type: "payment",
      enabled: true,
      keywords: "оплат, счет",
      priority: "high",
      template: "Проконтролировать оплату",
    },
    {
      type: "callback",
      enabled: true,
      keywords: "перезвон",
      priority: "low",
      template: "Перезвонить",
    },
    {
      type: "docs",
      enabled: true,
      keywords: "договор, документ, подпис, ответ",
      priority: "high",
      template: "Отправить документы",
    },
  ];
}

export function fillTemplate(template: string, client: string): string {
  const titled = template.replaceAll("{client}", client).replace(/\s*—\s*$/, "").trim();
  if (!titled) return client;
  if (titled.includes(client)) return titled;
  return `${titled} — ${client}`;
}

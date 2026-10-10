import { TYPE_INFO } from "@/lib/catalog";
import { formatLong, formatMoney, formatShort, formatWhen } from "@/lib/dates";
import type { Agreement, AgreementType, Call } from "@/lib/types";

export function describeDeal(
  type: AgreementType,
  due: string,
  time: string | null,
  amount: number | null,
  now = new Date(),
): string {
  const date = formatLong(due, now);
  const when = time ? `${date} в ${time}` : date;
  const money = amount ? ` на ${formatMoney(amount)}` : "";
  switch (type) {
    case "kp":
      return `Отправить коммерческое предложение${money} до ${when}.`;
    case "meeting":
      return `Созвон ${when}.`;
    case "payment":
      return `Проконтролировать оплату${money} до ${when}.`;
    case "callback":
      return `Перезвонить ${when}.`;
    case "docs":
      return `Отправить документы до ${when}.`;
  }
}

export function hintText(
  type: AgreementType,
  due: string,
  time: string | null,
  now = new Date(),
): string {
  const verb = TYPE_INFO[type].hint;
  const prefix = type === "meeting" || type === "callback" ? "" : "до ";
  const clock = time ? ` в ${time}` : "";
  return `Зафиксирована договорённость: ${verb} ${prefix}${formatShort(due, now)}${clock}. Подтвердить?`;
}

export function firstName(full: string): string {
  return full.split(" ")[0] ?? full;
}

export function buildSummary(call: Call, agreements: Agreement[], now = new Date()): string {
  const items = agreements.filter((item) => item.callId === call.id);
  const lines =
    items.length > 0
      ? items.map(
          (item, index) =>
            `${index + 1}. ${item.title} — ${formatWhen(item.due, item.time, now)}${item.amount ? `, ${formatMoney(item.amount)}` : ""}.`,
        )
      : ["Сроков в этом разговоре не прозвучало."];

  return [
    `${firstName(call.client)}, подведём итоги:`,
    "",
    ...lines,
    "",
    "Если срок или формулировка другие — ответьте на это сообщение.",
    "Алексей Морозов, поставка оргтехники",
  ].join("\n");
}

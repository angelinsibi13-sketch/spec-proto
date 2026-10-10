"use client";

import { Bell, LockKeyhole, Search } from "lucide-react";
import { PageTitle, PriorityPill, Screen, Surface, TypePill } from "@/components/bits";
import { RecordingCard } from "@/components/screens/recording";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWhen } from "@/lib/dates";
import { reminderItems, reminderLabel } from "@/lib/reminders";
import { knownPhone, recordingFor } from "@/lib/demo-script";
import { useFix } from "@/lib/store";
import type { Call, Task } from "@/lib/types";
import { useMemo, useState } from "react";

function priorityRank(priority: "high" | "medium" | "low"): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function initials(name: string): string {
  const parts = name.replace(/[«»"]/g, "").split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function contactCards(calls: Call[], tasks: Task[]) {
  const byClient = new Map<string, Call[]>();
  for (const call of calls) {
    const list = byClient.get(call.client) ?? [];
    list.push(call);
    byClient.set(call.client, list);
  }
  return [...byClient.entries()].map(([client, group]) => {
    const withLines = [...group].sort((a, b) => b.lines.length - a.lines.length);
    const chosen = withLines[0];
    const phone = knownPhone(client, group.find((call) => call.phone.trim())?.phone ?? "");
    const open = tasks.filter((task) => task.client === client && task.status === "open");
    return {
      client,
      company: chosen.company,
      role: chosen.role,
      phone,
      callId: chosen.id,
      tasks: open,
      audio: recordingFor(client, group),
      note: group.find((call) => call.transcriptNote)?.transcriptNote ?? "",
    };
  });
}

const TASKS_BEFORE_MORE = 3;

export function HomeScreen() {
  const { vault, open, openTranscript } = useFix();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const cards = useMemo(
    () => contactCards(vault?.calls ?? [], vault?.tasks ?? []),
    [vault?.calls, vault?.tasks],
  );
  if (!vault) return null;

  const today = new Date().toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const reminders = vault.events
    .flatMap((event) => {
      const task = vault.tasks.find((item) => item.agreementId === event.agreementId && item.title === event.title);
      return reminderItems(vault.reminders?.[event.id], event).map((item) => ({
        event,
        item,
        priority: task?.priority ?? "medium",
      }));
    })
    .sort(
      (a, b) =>
        a.item.date.localeCompare(b.item.date) ||
        a.item.at.localeCompare(b.item.at) ||
        priorityRank(a.priority) - priorityRank(b.priority),
    );
  const needle = query.trim().toLowerCase().replaceAll("ё", "е");
  const needleDigits = digits(query);
  const found = cards.filter((card) => {
    if (!needle && !needleDigits) return true;
    const related = vault.calls.filter((call) => call.client === card.client);
    const phrases = vault.agreements
      .filter((item) => item.client === card.client)
      .map((item) => `${item.phrase} ${item.title} ${item.due}`);
    const lines = related.flatMap((call) => call.lines.map((line) => `${line.name} ${line.text}`));
    const hay = [
      card.client,
      card.company,
      card.phone,
      card.role,
      ...card.tasks.flatMap((task) => [task.title, task.due, task.time ?? "", task.amount ? String(task.amount) : ""]),
      ...phrases,
      ...lines,
    ]
      .join(" ")
      .toLowerCase()
      .replaceAll("ё", "е");
    if (needle && hay.includes(needle)) return true;
    return needleDigits.length > 0 && digits(hay).includes(needleDigits);
  });

  return (
    <Screen>
      <p className="mb-2 text-sm text-[#626c77]">{today.charAt(0).toUpperCase() + today.slice(1)}</p>
      <PageTitle
        title="Добрый день, Алексей"
        text="Карточки клиентов, записи разговоров и задачи, которые из них получились. Новая или заменённая запись разбирается сама."
      />

      <RecordingCard />

      <h2 className="font-heading mb-3 text-lg font-semibold">Клиенты</h2>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#626c77]" />
        <Input
          id="crm-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск"
          aria-label="Поиск по любому полю"
          className="h-10 pl-9"
        />
      </div>

      <div className="max-h-96 space-y-3 overflow-y-auto rounded-2xl bg-white p-3 ring-1 ring-[#1d2023]/8">
        {found.length === 0 ? (
          <p className="text-sm text-[#626c77]">Никого не нашли. Поиск смотрит имя, телефон, компанию, фразу и задачу.</p>
        ) : (
          found.map((card) => {
            const openList = expanded[card.client] ? card.tasks : card.tasks.slice(0, TASKS_BEFORE_MORE);
            const hidden = card.tasks.length - TASKS_BEFORE_MORE;
            return (
              <Surface key={card.client}>
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#ff0032] text-sm font-semibold text-white">
                    {initials(card.client)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{card.client}</p>
                    <p className="mt-0.5 truncate text-xs text-[#626c77]">
                      {card.company}
                      {card.role ? ` · ${card.role}` : ""}
                    </p>
                    {card.phone ? <p className="mt-0.5 text-xs text-[#626c77]">{card.phone}</p> : null}
                  </div>
                  <Button
                    variant="outline"
                    className="h-9 shrink-0"
                    onClick={() => openTranscript(card.callId)}
                  >
                    Просмотр
                  </Button>
                </div>
                {card.audio ? (
                  <audio controls preload="none" src={card.audio} className="mt-3 h-10 w-full">
                    Запись {card.client}
                  </audio>
                ) : (
                  <p className="mt-3 text-xs text-[#626c77]">Файла записи для этой карточки нет.</p>
                )}
                {card.note ? <p className="mt-2 text-sm text-[#d1002b]">{card.note}</p> : null}
                <p className="mt-3 text-xs font-medium text-[#626c77]">Задачи, которые надо выполнить</p>
                {card.tasks.length === 0 ? (
                  <p className="mt-1 text-sm text-[#626c77]">Открытых задач нет.</p>
                ) : (
                  <div className={expanded[card.client] ? "mt-2 max-h-40 overflow-y-auto pr-1" : "mt-2"}>
                    <ul className="space-y-1.5">
                      {openList.map((task) => (
                        <li key={task.id} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#ff0032]" />
                          <span>{task.title}</span>
                        </li>
                      ))}
                    </ul>
                    {hidden > 0 ? (
                      <button
                        type="button"
                        className="mt-2 text-sm font-medium text-[#ff0032]"
                        onClick={() =>
                          setExpanded((current) => ({ ...current, [card.client]: !current[card.client] }))
                        }
                      >
                        {expanded[card.client] ? "Свернуть" : `Ещё ${hidden}`}
                      </button>
                    ) : null}
                  </div>
                )}
              </Surface>
            );
          })
        )}
      </div>

      <div className="mt-6 mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-[#ff0032]" />
          <h2 className="font-heading text-lg font-semibold">Напоминания</h2>
        </div>
        <button type="button" className="text-sm text-[#ff0032]" onClick={() => open("tasks")}>
          Все задачи
        </button>
      </div>
      {reminders.length === 0 ? (
        <Surface>
          <p className="text-sm text-[#626c77]">Напоминаний пока нет. В календаре поставьте время уведомления.</p>
        </Surface>
      ) : (
        <div className="space-y-2">
          {reminders.map((item) => (
            <Surface key={`${item.event.id}:${item.item.id}`}>
              <div className="mb-2 flex flex-wrap gap-1.5">
                <TypePill type={item.event.type} />
                <PriorityPill priority={item.priority} />
              </div>
              <p className="text-sm font-medium">{item.event.title}</p>
              <p className="mt-1 text-xs text-[#626c77]">
                {item.event.company} · событие {formatWhen(item.event.due, item.event.time)} · {reminderLabel(item.item)}
              </p>
            </Surface>
          ))}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-[#626c77]">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
        Разбор фразы и задача считаются на сервере прототипа. Срок сразу появляется в календаре приложения. Запись лежит файлом AES-256-GCM.
      </p>
    </Screen>
  );
}


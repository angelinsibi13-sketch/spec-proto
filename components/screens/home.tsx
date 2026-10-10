"use client";

import { Bell, LockKeyhole, Search } from "lucide-react";
import { PageTitle, PriorityPill, Screen, Surface, TypePill } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLong, formatMoney, isPastDue } from "@/lib/dates";
import { knownPhone, recordingFor } from "@/lib/demo-script";
import { useFix } from "@/lib/store";
import type { Call, Task } from "@/lib/types";
import { useMemo, useState } from "react";

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
    };
  });
}

export function HomeScreen() {
  const { vault, open, openTranscript } = useFix();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
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
  const openTasks = vault.tasks.filter((task) => task.status === "open");
  const upcoming = [...openTasks].sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title));
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
        text="Карточки клиентов, записи разговоров и задачи, которые из них получились."
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">Клиенты</h2>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {searching ? (
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Любое поле: имя, телефон, задача"
              aria-label="Поиск по любому полю"
              className="h-10 w-44 sm:w-64"
            />
          ) : null}
          <button
            type="button"
            aria-label="Поиск"
            aria-expanded={searching}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#1d2023] ring-1 ring-[#1d2023]/10"
            onClick={() => {
              setSearching((value) => {
                if (value) setQuery("");
                return !value;
              });
            }}
          >
            <Search className="size-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
        {found.length === 0 ? (
          <Surface>
            <p className="text-sm text-[#626c77]">Никого не нашли. Лупа ищет по имени, телефону, компании, фразе и задаче.</p>
          </Surface>
        ) : (
          found.map((card) => (
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
              <p className="mt-3 text-xs font-medium text-[#626c77]">Задачи, которые надо выполнить</p>
              {card.tasks.length === 0 ? (
                <p className="mt-1 text-sm text-[#626c77]">Открытых задач нет.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {card.tasks.slice(0, 4).map((task) => (
                    <li key={task.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#ff0032]" />
                      <span>{task.title}</span>
                    </li>
                  ))}
                  {card.tasks.length > 4 ? (
                    <li className="text-sm text-[#626c77]">ещё {card.tasks.length - 4}</li>
                  ) : null}
                </ul>
              )}
            </Surface>
          ))
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
      {upcoming.length === 0 ? (
        <Surface>
          <p className="text-sm text-[#626c77]">Открытых задач нет.</p>
        </Surface>
      ) : (
        <div className="space-y-2">
          {upcoming.map((task) => (
            <TaskRow key={task.id} task={task} />
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

function TaskRow({ task }: { task: Task }) {
  const money = formatMoney(task.amount);
  return (
    <Surface className="flex items-start justify-between gap-3">
      <div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <TypePill type={task.type} />
          <PriorityPill priority={task.priority} />
          {isPastDue(task.due) ? (
            <span className="inline-flex h-6 items-center rounded-full bg-[#ff0032]/10 px-2 text-[11px] font-medium text-[#d1002b]">
              Просрочено
            </span>
          ) : null}
        </div>
        <p className="text-sm font-medium">{task.title}</p>
        <p className="mt-1 text-xs text-[#626c77]">
          {task.company} · {formatLong(task.due)}
          {task.time ? `, ${task.time}` : ""}
          {money ? ` · ${money}` : ""}
        </p>
      </div>
    </Surface>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { PriorityPill, TypePill } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITY_LABEL } from "@/lib/catalog";
import { formatClock, formatMoney, formatWhen } from "@/lib/dates";
import { knownPhone, recordingFor, scriptFor } from "@/lib/demo-script";
import { hintText } from "@/lib/hints";
import { stopSpeech } from "@/lib/voices";
import { useFix } from "@/lib/store";
import type { Agreement, Line, Priority } from "@/lib/types";

function lineStamps(lines: Line[], direction: "in" | "out") {
  const script = scriptFor(direction);
  const stamps = new Map<string, number>();
  let cursor = 0;
  for (const line of lines) {
    if (!line.fromScript) continue;
    const at = script[cursor]?.atMs;
    if (at !== undefined) stamps.set(line.id, at);
    cursor += 1;
  }
  return stamps;
}

export function CallScreen() {
  const { vault, focusCallId, confirm, viewTranscript, deleteAgreement } = useFix();
  const scroller = useRef<HTMLDivElement>(null);
  const audited = useRef<string | null>(null);

  const focused = vault ? (vault.calls.find((item) => item.id === focusCallId) ?? null) : null;
  const related = focused ? vault!.calls.filter((item) => item.client === focused.client) : [];
  const call = focused;
  const agreements = vault && focused ? vault.agreements.filter((item) => item.client === focused.client) : [];
  const hint = agreements.find((item) => item.confirmed === null) ?? null;
  const hintCopy = hint ? hintText(hint.type, hint.due, hint.time) : null;

  const lines = related.flatMap((item) => item.lines);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines.length, agreements.length]);

  useEffect(() => {
    stopSpeech();
    return () => stopSpeech();
  }, [call?.id]);

  useEffect(() => {
    if (!call || call.lines.length === 0) return;
    const key = `${call.id}:${call.lines.length > 0}`;
    if (audited.current === key) return;
    audited.current = key;
    viewTranscript(`Расшифровка · ${call.client}`);
  }, [call, viewTranscript]);

  if (!vault) return null;

  if (!call) {
    return (
      <div className="flex h-full flex-col items-start justify-center px-5 py-10">
        <p className="text-[12px] font-medium tracking-wide text-[#ff0032] uppercase">Звонок</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight">Запись не выбрана</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[#626c77]">
          На главной найдите клиента и нажмите «Просмотр». Здесь будет текст разговора и его запись.
        </p>
      </div>
    );
  }

  const phone = knownPhone(call.client, related.find((item) => item.phone.trim())?.phone ?? call.phone);
  const recording = recordingFor(call.client, related);

  return (
    <div className="flex flex-col bg-[#f6f7f9] md:h-full md:min-h-0">
      <header className="shrink-0 border-b border-[#1d2023]/8 bg-white px-4 py-4 md:px-6">
        <p className="text-[12px] font-medium tracking-wide text-[#ff0032] uppercase">Кого слушаем</p>
        <h1 className="font-heading mt-1 text-lg font-semibold tracking-tight">{call.client}</h1>
        <p className="mt-1 text-sm text-[#626c77]">
          {call.company}
          {phone ? ` · ${phone}` : ""}
          {call.role ? ` · ${call.role}` : ""}
        </p>
      </header>

      <div className="md:grid md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_320px]">
        <div ref={scroller} className="px-4 py-4 md:min-h-0 md:overflow-y-auto md:px-6">
          <div className="sticky top-0 z-10 -mx-4 mb-3 border-b border-[#1d2023]/8 bg-[#f6f7f9] px-4 pt-1 pb-3 md:-mx-6 md:px-6">
            <p className="mb-2 text-xs font-medium text-[#626c77]">Полная запись звонка</p>
            {recording ? (
              <audio controls preload="metadata" src={recording} className="h-10 w-full" />
            ) : (
              <p className="text-sm text-[#626c77]">Файла записи для этого разговора нет.</p>
            )}
            {related.some((item) => item.transcriptNote) ? (
              <p className="mt-2 text-sm text-[#d1002b]">
                {related.find((item) => item.transcriptNote)?.transcriptNote}
              </p>
            ) : null}
          </div>
          <div className="space-y-3">
          {lines.length === 0 ? (
            agreements.length === 0 ? (
              <p className="text-sm text-[#626c77]">В этой записи нет реплик.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-[#626c77]">Полной расшифровки нет. Сохранились фразы, из которых собраны задачи.</p>
                {agreements.map((item) => (
                  <p key={item.id} className="rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[#1d2023]/8">
                    {item.client}: {item.phrase}
                  </p>
                ))}
              </div>
            )
          ) : (
            related.flatMap((item) => {
              const stamps = lineStamps(item.lines, item.direction);
              return item.lines.map((line) => {
                const stamp = line.atMs ?? stamps.get(line.id);
                const mine = line.speaker === "agent";
                return (
                  <div key={line.id} className={mine ? "flex justify-start" : "flex justify-end"}>
                    <div
                      className={
                        mine
                          ? "max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3 py-2 ring-1 ring-[#1d2023]/8"
                          : "max-w-[85%] rounded-2xl rounded-br-md bg-[#1d2023] px-3 py-2 text-white"
                      }
                    >
                      <p className={mine ? "text-[11px] text-[#626c77]" : "text-[11px] text-white/60"}>
                        {line.name}
                        {stamp !== null && stamp !== undefined ? ` · ${formatClock(stamp)}` : ""}
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed">{line.text}</p>
                    </div>
                  </div>
                );
              });
            })
          )}
          </div>
        </div>

        <aside className="border-t border-[#1d2023]/8 bg-white px-4 py-4 md:min-h-0 md:overflow-y-auto md:border-t-0 md:border-l">
          <p className="text-[12px] font-medium tracking-wide text-[#626c77] uppercase">Уже в системах</p>
          {agreements.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-[#626c77]">
              Карточки появятся сами, как только сервер узнает срок в реплике.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {agreements.map((item) => (
                <AgreementCard key={item.id} item={item} onDelete={deleteAgreement} />
              ))}
            </ul>
          )}
        </aside>
      </div>

      {hint && hintCopy ? (
        <footer className="shrink-0 border-t border-[#1d2023]/8 bg-white p-3 md:px-5">
          <div className="rounded-2xl bg-[#ff0032] p-3 text-white" aria-live="polite">
            <p className="text-sm leading-relaxed">{hintCopy}</p>
            <p className="mt-1 text-xs text-white/80">Задача и событие уже созданы. Подтверждение не обязательно.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="h-9 bg-white text-[#1d2023] hover:bg-white/90"
                onClick={() => confirm(hint.id, true)}
              >
                Подтвердить
              </Button>
              <Button
                variant="ghost"
                className="h-9 text-white hover:bg-white/10 hover:text-white"
                onClick={() => confirm(hint.id, false)}
              >
                Не сейчас
              </Button>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function AgreementCard({ item, onDelete }: { item: Agreement; onDelete: (id: string) => void }) {
  const { editAgreement } = useFix();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [due, setDue] = useState(item.due);
  const [time, setTime] = useState(item.time ?? "");
  const [amount, setAmount] = useState(item.amount === null ? "" : String(item.amount));
  const [phrase, setPhrase] = useState(item.phrase);
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [removing, setRemoving] = useState(false);
  const money = formatMoney(item.amount);
  const state =
    item.confirmed === true ? "Подтверждено" : item.confirmed === false ? "Сохранено без подтверждения" : "Ждёт подсказки";

  return (
    <li className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl p-3 ring-1 ring-[#1d2023]/10 duration-300">
      <div className="flex flex-wrap gap-1.5">
        <TypePill type={item.type} />
        <PriorityPill priority={item.priority} />
        {item.edited ? (
          <span className="inline-flex h-6 items-center rounded-full bg-[#eef0f3] px-2 text-[11px] font-medium text-[#626c77]">
            Исправлено
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-medium">{item.title}</p>
      <p className="mt-1 text-xs text-[#626c77]">
        {formatWhen(item.due, item.time)}
        {money ? ` · ${money}` : ""}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[#626c77]">{item.phrase}</p>
      <p className="mt-2 text-[11px] font-medium text-[#027a48]">Задача CRM и событие календаря созданы · {state}</p>
      <div className="mt-2 flex gap-4">
        <button type="button" className="text-xs font-medium text-[#ff0032]" onClick={() => setEditing((value) => !value)}>
          {editing ? "Свернуть" : "Исправить"}
        </button>
        <button
          type="button"
          className="text-xs font-medium text-[#ff0032] disabled:opacity-40"
          disabled={removing}
          onClick={() => {
            setRemoving(true);
            onDelete(item.id);
          }}
        >
          Удалить
        </button>
      </div>
      {editing ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = amount.trim() === "" ? null : Number(amount.replace(/\s/g, "").replace(",", "."));
            if (parsed !== null && !Number.isFinite(parsed)) return;
            editAgreement(item.id, {
              title: title.trim() || item.title,
              due,
              time: time.trim() || null,
              amount: parsed,
              phrase: phrase.trim() || item.phrase,
              priority,
            });
            setEditing(false);
          }}
        >
          <div>
            <Label htmlFor={`title-${item.id}`}>Задача</Label>
            <Input id={`title-${item.id}`} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 h-9" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor={`due-${item.id}`}>Дата</Label>
              <Input id={`due-${item.id}`} type="date" value={due} onChange={(event) => setDue(event.target.value)} className="mt-1 h-9" />
            </div>
            <div>
              <Label htmlFor={`time-${item.id}`}>Время</Label>
              <Input
                id={`time-${item.id}`}
                value={time}
                placeholder="15:00"
                onChange={(event) => setTime(event.target.value)}
                className="mt-1 h-9"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`amount-${item.id}`}>Сумма, Br</Label>
            <Input
              id={`amount-${item.id}`}
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label htmlFor={`phrase-${item.id}`}>Фраза</Label>
            <Textarea id={`phrase-${item.id}`} value={phrase} onChange={(event) => setPhrase(event.target.value)} className="mt-1 min-h-16" />
          </div>
          <div>
            <Label htmlFor={`priority-${item.id}`}>Приоритет</Label>
            <select
              id={`priority-${item.id}`}
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              className="mt-1 h-9 w-full rounded-lg border border-[#1d2023]/15 bg-white px-2 text-sm"
            >
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="h-9 w-full">
            Сохранить правку
          </Button>
        </form>
      ) : null}
    </li>
  );
}

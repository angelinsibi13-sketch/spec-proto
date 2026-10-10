"use client";

import { useMemo, useState } from "react";
import { Bell, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { addDays, formatMoney, formatWhen, iso, parseIso, todayIso } from "@/lib/dates";
import { atEvent, dayBefore, hourBefore, minutesBefore, reminderItems, reminderLabel } from "@/lib/reminders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageTitle, Screen, Surface, TypePill } from "@/components/bits";
import { downloadText, toIcs } from "@/lib/ics";
import { useFix } from "@/lib/store";
import type { CalEvent, Priority, ReminderItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function monthCells(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  const cells = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const lastWeek = cells.slice(35);
  if (lastWeek.every((date) => date.getMonth() !== anchor.getMonth())) return cells.slice(0, 35);
  return cells;
}

function parseClock(value: string | null | undefined): { hours: number; minutes: number } {
  const match = value?.match(/^(\d{2}):(\d{2})$/);
  if (!match) return { hours: 9, minutes: 0 };
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function clockLabel(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function prettyDate(value: string): string {
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function pushDraft(list: ReminderItem[], item: Omit<ReminderItem, "id">): ReminderItem[] {
  if (list.some((entry) => entry.kind === item.kind && entry.date === item.date && entry.at === item.at)) return list;
  return [...list, { ...item, id: `rem-${crypto.randomUUID()}` }];
}

function ChoiceButton({
  label,
  value,
  open,
  onClick,
}: {
  label: string;
  value: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm ring-1 ring-[#1d2023]/10"
    >
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </button>
  );
}

const PRESETS = [
  { kind: "at", label: "В указанное время события" },
  { kind: "ten", label: "За 10 минут" },
  { kind: "hour", label: "За 1 час" },
  { kind: "day", label: "За 1 день" },
] as const;

function slotFor(kind: (typeof PRESETS)[number]["kind"], due: string, time: string | null) {
  if (kind === "at") return atEvent(due, time);
  if (kind === "ten") return minutesBefore(due, time, 10);
  if (kind === "hour") return hourBefore(due, time);
  return dayBefore(due, time);
}

function Mark({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border",
        on ? "border-[#ff0032] bg-[#ff0032] text-white" : "border-[#1d2023]/25",
      )}
    >
      {on ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

function ReminderEditor({
  due,
  time,
  drafts,
  onChange,
  date,
  hours,
  minutes,
  dateOpen,
  timeOpen,
  onDate,
  onHours,
  onMinutes,
  onToggleDate,
  onToggleTime,
  wheelName,
}: {
  due: string;
  time: string | null;
  drafts: ReminderItem[];
  onChange: (next: ReminderItem[]) => void;
  date: string;
  hours: number;
  minutes: number;
  dateOpen: boolean;
  timeOpen: boolean;
  onDate: (value: string) => void;
  onHours: (value: number) => void;
  onMinutes: (value: number) => void;
  onToggleDate: () => void;
  onToggleTime: () => void;
  wheelName: string;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const full = drafts.length >= 8;
  const dateReady = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const customs = drafts.filter((item) => item.kind === "custom");

  function togglePreset(kind: (typeof PRESETS)[number]["kind"]) {
    const current = drafts.find((item) => item.kind === kind);
    if (current) {
      onChange(drafts.filter((item) => item.id !== current.id));
      return;
    }
    if (full) return;
    const slot = slotFor(kind, due, time);
    onChange(pushDraft(drafts, { kind, date: slot.date, at: slot.at }));
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#1d2023]/10">
        {PRESETS.map((preset, index) => {
          const on = drafts.some((item) => item.kind === preset.kind);
          return (
            <button
              key={preset.kind}
              type="button"
              aria-pressed={on}
              onClick={() => togglePreset(preset.kind)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left text-sm",
                index > 0 && "border-t border-[#1d2023]/8",
              )}
            >
              <Mark on={on} />
              <span>{preset.label}</span>
            </button>
          );
        })}
        {customs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed
            onClick={() => onChange(drafts.filter((entry) => entry.id !== item.id))}
            className="flex w-full items-center gap-3 border-t border-[#1d2023]/8 px-4 py-3 text-left text-sm"
          >
            <Mark on />
            <span>
              Пользовательское
              <span className="mt-0.5 block text-xs text-[#626c77]">
                {prettyDate(item.date)}, {item.at}
              </span>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-expanded={customOpen}
        onClick={() => setCustomOpen((open) => !open)}
        className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-sm ring-1 ring-[#1d2023]/10"
      >
        <Plus className="size-4 text-[#ff0032]" />
        Пользовательское
      </button>
      {customOpen ? (
        <div className="space-y-2">
          <ChoiceButton label="Дата уведомления" value={prettyDate(date)} open={dateOpen} onClick={onToggleDate} />
          {dateOpen ? (
            <Input
              type="date"
              aria-label="Дата уведомления"
              value={date}
              onChange={(event) => onDate(event.target.value)}
              className="h-10"
            />
          ) : null}
          <ChoiceButton
            label="Время уведомления"
            value={clockLabel(hours, minutes)}
            open={timeOpen}
            onClick={onToggleTime}
          />
          {timeOpen ? (
            <div className="flex gap-4 rounded-2xl bg-[#f6f7f9] px-4 py-3">
              <Wheel label="Часы" name={`${wheelName}, часы`} value={hours} max={23} onChange={onHours} />
              <Wheel label="Минуты" name={`${wheelName}, минуты`} value={minutes} max={59} onChange={onMinutes} />
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full"
            disabled={full || !dateReady}
            onClick={() => onChange(pushDraft(drafts, { kind: "custom", date, at: clockLabel(hours, minutes) }))}
          >
            Добавить
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Wheel({
  label,
  name,
  value,
  max,
  onChange,
}: {
  label: string;
  name?: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const span = max + 1;
  const prev = (value - 1 + span) % span;
  const next = (value + 1) % span;
  const pad = (item: number) => String(item).padStart(2, "0");
  const title = name ?? label;
  return (
    <div className="flex flex-1 flex-col items-center">
      <p className="mb-1 text-xs text-[#626c77]">{label}</p>
      <button
        type="button"
        aria-label={`${title}: меньше`}
        className="flex flex-col items-center text-[#626c77]"
        onClick={() => onChange(prev)}
      >
        <ChevronUp className="size-4" />
        <span className="text-sm tabular-nums">{pad(prev)}</span>
      </button>
      <p className="font-heading my-1 text-3xl font-semibold tabular-nums text-[#1d2023]">{pad(value)}</p>
      <button
        type="button"
        aria-label={`${title}: больше`}
        className="flex flex-col items-center text-[#626c77]"
        onClick={() => onChange(next)}
      >
        <span className="text-sm tabular-nums">{pad(next)}</span>
        <ChevronDown className="size-4" />
      </button>
    </div>
  );
}

export function CalendarScreen() {
  const { vault, saveReminders, addEvent } = useFix();
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(todayIso());
  const [reminderFor, setReminderFor] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ReminderItem[]>([]);
  const [customDate, setCustomDate] = useState(todayIso());
  const [customHours, setCustomHours] = useState(9);
  const [customMinutes, setCustomMinutes] = useState(0);
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const [customTimeOpen, setCustomTimeOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(todayIso());
  const [eventHours, setEventHours] = useState(10);
  const [eventMinutes, setEventMinutes] = useState(0);
  const [eventDateOpen, setEventDateOpen] = useState(false);
  const [eventTimeOpen, setEventTimeOpen] = useState(false);
  const [eventDrafts, setEventDrafts] = useState<ReminderItem[]>([]);
  const [noteDate, setNoteDate] = useState(todayIso());
  const [noteHours, setNoteHours] = useState(9);
  const [noteMinutes, setNoteMinutes] = useState(0);
  const [noteDateOpen, setNoteDateOpen] = useState(false);
  const [noteTimeOpen, setNoteTimeOpen] = useState(false);
  const [priority, setPriority] = useState<Priority>("medium");
  const events = vault?.events;

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const event of events ?? []) {
      const list = map.get(event.due) ?? [];
      list.push(event);
      map.set(event.due, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.title.localeCompare(b.title));
    }
    return map;
  }, [events]);

  if (!vault || !events) return null;

  const cells = monthCells(anchor);
  const title = `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  const today = todayIso();
  const chosen = byDay.get(selected) ?? [];
  const reminders = vault.reminders ?? {};
  const reminderEvent = chosen.find((event) => event.id === reminderFor) ?? null;
  const monthCount = events.filter((event) => {
    const date = parseIso(event.due);
    return date.getFullYear() === anchor.getFullYear() && date.getMonth() === anchor.getMonth();
  }).length;

  function shift(delta: number) {
    const next = new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
    setAnchor(next);
    setSelected(iso(next));
  }

  return (
    <Screen>
      <PageTitle
        eyebrow="Календарь"
        title="События из разговоров"
        text="Срок из фразы сразу встаёт на день. Скачивать ничего не нужно, файл .ics — если хотите открыть это в телефоне."
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-9" aria-label="Предыдущий месяц" onClick={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <h2 className="font-heading px-2 text-center text-base font-semibold whitespace-nowrap md:text-lg">{title}</h2>
          <Button variant="outline" size="icon" className="size-9" aria-label="Следующий месяц" onClick={() => shift(1)}>
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            className="h-9"
            onClick={() => {
              const now = new Date();
              setAnchor(now);
              setSelected(todayIso());
            }}
          >
            Сегодня
          </Button>
        </div>
        <Button
          variant="outline"
          className="h-9"
          disabled={events.length === 0}
          onClick={() => downloadText("fix-dogovorennosti.ics", toIcs(events), "text/calendar")}
        >
          <Download />
          Скачать всё
        </Button>
      </div>

      <p className="mb-2 text-xs text-[#626c77]">
        Событий в этом месяце: {monthCount}
      </p>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#1d2023]/8">
        <div className="grid grid-cols-7 border-b border-[#1d2023]/8">
          {WEEK.map((day) => (
            <div key={day} className="px-1 py-2 text-center text-[11px] font-medium text-[#626c77]">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date) => {
            const key = iso(date);
            const dayEvents = byDay.get(key) ?? [];
            const outside = date.getMonth() !== anchor.getMonth();
            const isSelected = key === selected;
            const isToday = key === today;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={cn(
                  "min-h-16 border-t border-r border-[#1d2023]/8 p-1 text-left md:min-h-24 md:p-1.5",
                  "[&:nth-child(7n)]:border-r-0",
                  isSelected && "bg-[#ff0032]/8",
                  !isSelected && "hover:bg-[#f6f7f9]",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs",
                    isToday && "bg-[#ff0032] font-semibold text-white",
                    !isToday && outside && "text-[#626c77]/60",
                    !isToday && !outside && "text-[#1d2023]",
                  )}
                >
                  {date.getDate()}
                </span>
                <span className="mt-1 hidden flex-col gap-0.5 md:flex">
                  {dayEvents.slice(0, 2).map((event) => (
                    <span key={event.id} className="truncate rounded bg-[#1d2023] px-1 py-0.5 text-[10px] text-white">
                      {event.time ? `${event.time} ` : ""}
                      {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 2 ? (
                    <span className="text-[10px] text-[#626c77]">ещё {dayEvents.length - 2}</span>
                  ) : null}
                </span>
                {dayEvents.length > 0 ? (
                  <span className="mt-1 flex justify-center gap-0.5 md:hidden" aria-hidden>
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id} className="size-1.5 rounded-full bg-[#ff0032]" />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium capitalize text-[#626c77]">
            {parseIso(selected).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
          </h3>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => {
              const ahead = dayBefore(selected, "10:00");
              setEventTitle("");
              setEventDate(selected);
              setEventHours(10);
              setEventMinutes(0);
              setEventDateOpen(false);
              setEventTimeOpen(false);
              setEventDrafts([]);
              setNoteDate(ahead.date);
              setNoteHours(9);
              setNoteMinutes(0);
              setNoteDateOpen(false);
              setNoteTimeOpen(false);
              setPriority("medium");
              setAdding(true);
            }}
          >
            Добавить событие
          </Button>
        </div>
        {chosen.length === 0 ? (
          <Surface>
            <p className="text-sm text-[#626c77]">На этот день событий нет.</p>
          </Surface>
        ) : (
          <div className="space-y-2">
            <p className="text-sm leading-relaxed text-[#626c77]">
              В этот день:{" "}
              {chosen
                .map((event) => `${event.time ? `${event.time} ` : ""}${event.title}`)
                .join("; ")}
              .
            </p>
            {chosen.map((event) => {
              const saved = reminderItems(reminders[event.id], event);
              return (
                <Surface key={event.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1.5">
                        <TypePill type={event.type} />
                      </div>
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="mt-1 text-xs text-[#626c77]">
                        {event.company} · {formatWhen(event.due, event.time)}
                        {formatMoney(event.amount) ? ` · ${formatMoney(event.amount)}` : ""}
                      </p>
                      {saved.length > 0 ? (
                        <ul className="mt-2 space-y-0.5">
                          {saved.map((item) => (
                            <li key={item.id} className="text-xs font-medium text-[#ff0032]">
                              {reminderLabel(item)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0"
                      aria-label={`Напоминание: ${event.title}`}
                      onClick={() => {
                        const items = reminderItems(reminders[event.id], event);
                        const clock = parseClock(event.time);
                        const ahead = dayBefore(event.due, event.time);
                        setDrafts(items);
                        setCustomDate(ahead.date);
                        setCustomHours(clock.hours);
                        setCustomMinutes(clock.minutes);
                        setCustomDateOpen(false);
                        setCustomTimeOpen(false);
                        setReminderFor(event.id);
                      }}
                    >
                      <Bell />
                    </Button>
                  </div>
                </Surface>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={reminderFor !== null} onOpenChange={(open) => { if (!open) setReminderFor(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Напоминания{reminderEvent ? ` · ${reminderEvent.title}` : ""}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#626c77]">
            Несколько уведомлений на разные дни и время. Карусель часов и дата открываются по нажатию.
          </p>
          {reminderEvent ? (
            <ReminderEditor
              due={reminderEvent.due}
              time={reminderEvent.time}
              drafts={drafts}
              onChange={setDrafts}
              date={customDate}
              hours={customHours}
              minutes={customMinutes}
              dateOpen={customDateOpen}
              timeOpen={customTimeOpen}
              onDate={setCustomDate}
              onHours={setCustomHours}
              onMinutes={setCustomMinutes}
              onToggleDate={() => setCustomDateOpen((open) => !open)}
              onToggleTime={() => setCustomTimeOpen((open) => !open)}
              wheelName="Уведомление"
            />
          ) : null}
          <DialogFooter>
            <Button
              className="h-10"
              onClick={() => {
                if (!reminderFor) return;
                if (drafts.length > 0 && typeof Notification !== "undefined" && Notification.permission === "default") {
                  void Notification.requestPermission();
                }
                saveReminders(reminderFor, drafts);
                setReminderFor(null);
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новое событие</DialogTitle>
          </DialogHeader>
          <label className="block text-sm" htmlFor="event-title">
            Название
            <Input id="event-title" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} className="mt-1.5 h-10" />
          </label>
          <ChoiceButton
            label="Дата события"
            value={prettyDate(eventDate)}
            open={eventDateOpen}
            onClick={() => setEventDateOpen((open) => !open)}
          />
          {eventDateOpen ? (
            <Input
              type="date"
              aria-label="Дата события"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              className="h-10"
            />
          ) : null}
          <ChoiceButton
            label="Время события"
            value={clockLabel(eventHours, eventMinutes)}
            open={eventTimeOpen}
            onClick={() => setEventTimeOpen((open) => !open)}
          />
          {eventTimeOpen ? (
            <div className="flex gap-4 rounded-2xl bg-[#f6f7f9] px-4 py-3">
              <Wheel label="Часы" name="Время события, часы" value={eventHours} max={23} onChange={setEventHours} />
              <Wheel label="Минуты" name="Время события, минуты" value={eventMinutes} max={59} onChange={setEventMinutes} />
            </div>
          ) : null}
          <p className="text-sm text-[#626c77]">Напоминания. Дата и время уведомления — по нажатию.</p>
          <ReminderEditor
            due={eventDate}
            time={clockLabel(eventHours, eventMinutes)}
            drafts={eventDrafts}
            onChange={setEventDrafts}
            date={noteDate}
            hours={noteHours}
            minutes={noteMinutes}
            dateOpen={noteDateOpen}
            timeOpen={noteTimeOpen}
            onDate={setNoteDate}
            onHours={setNoteHours}
            onMinutes={setNoteMinutes}
            onToggleDate={() => setNoteDateOpen((open) => !open)}
            onToggleTime={() => setNoteTimeOpen((open) => !open)}
            wheelName="Уведомление события"
          />
          <div className="flex gap-2">
            {(
              [
                ["high", "Высокий"],
                ["medium", "Средний"],
                ["low", "Низкий"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPriority(value)}
                className={cn(
                  "h-9 flex-1 rounded-full text-xs",
                  priority === value ? "bg-[#1d2023] text-white" : "bg-[#f6f7f9] text-[#626c77]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              className="h-10"
              disabled={!eventTitle.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)}
              onClick={() => {
                if (eventDrafts.length > 0 && typeof Notification !== "undefined" && Notification.permission === "default") {
                  void Notification.requestPermission();
                }
                addEvent({
                  title: eventTitle.trim(),
                  due: eventDate,
                  time: clockLabel(eventHours, eventMinutes),
                  priority,
                  reminders: eventDrafts,
                });
                setEventTitle("");
                setEventDrafts([]);
                setAdding(false);
              }}
            >
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Screen>
  );
}

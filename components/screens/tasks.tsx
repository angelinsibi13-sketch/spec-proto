"use client";

import { Check } from "lucide-react";
import { PageTitle, PriorityPill, Screen, Surface, TypePill } from "@/components/bits";
import { formatLong, formatMoney, formatWhen, isPastDue } from "@/lib/dates";
import { useFix } from "@/lib/store";
import type { Priority, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function byDateThenPriority(a: Task, b: Task): number {
  return a.due.localeCompare(b.due) || RANK[a.priority] - RANK[b.priority] || a.title.localeCompare(b.title, "ru");
}

export function TasksScreen() {
  const { vault, toggleTask } = useFix();
  if (!vault) return null;
  const tasks = [...vault.tasks].sort(byDateThenPriority);
  const days = [...new Set(tasks.map((task) => task.due))];

  return (
    <Screen>
      <PageTitle
        eyebrow="CRM"
        title="Задачи по клиентам"
        text="Каждая договорённость из звонка становится задачей. Внутри одного дня выше стоят более срочные."
      />
      {tasks.length === 0 ? (
        <Surface>
          <p className="text-sm text-[#626c77]">
            Задач пока нет. Запустите демо-звонок — они появятся без ручного ввода.
          </p>
        </Surface>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-medium capitalize text-[#626c77]">{formatLong(day)}</h2>
              <div className="space-y-2">
                {tasks
                  .filter((task) => task.due === day)
                  .map((task) => {
                    const late = task.status === "open" && isPastDue(task.due);
                    return (
                      <Surface key={task.id} className="flex items-start gap-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={task.status === "done"}
                          aria-label={task.status === "done" ? "Вернуть в работу" : "Отметить выполненной"}
                          onClick={() => toggleTask(task.id)}
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md ring-1",
                            task.status === "done"
                              ? "bg-[#027a48] text-white ring-[#027a48]"
                              : "bg-white ring-[#1d2023]/20",
                          )}
                        >
                          {task.status === "done" ? <Check className="size-3.5" /> : null}
                        </button>
                        <div className="min-w-0">
                          <div className="mb-1.5 flex flex-wrap gap-1.5">
                            <TypePill type={task.type} />
                            <PriorityPill priority={task.priority} />
                            {late ? (
                              <span className="inline-flex h-6 items-center rounded-full bg-[#ff0032]/10 px-2 text-[11px] font-medium text-[#d1002b]">
                                Просрочено
                              </span>
                            ) : null}
                          </div>
                          <p
                            className={cn(
                              "text-sm font-medium",
                              task.status === "done" && "text-[#626c77] line-through",
                            )}
                          >
                            {task.title}
                          </p>
                          <p className="mt-1 text-xs text-[#626c77]">
                            {task.client} · {task.company} · {formatWhen(task.due, task.time)}
                            {formatMoney(task.amount) ? ` · ${formatMoney(task.amount)}` : ""}
                          </p>
                        </div>
                      </Surface>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Screen>
  );
}

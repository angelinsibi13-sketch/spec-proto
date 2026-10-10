"use client";

import { Check } from "lucide-react";
import { PageTitle, PriorityPill, Screen, Surface, TypePill } from "@/components/bits";
import { formatMoney, formatWhen, isPastDue } from "@/lib/dates";
import { useFix } from "@/lib/store";
import { cn } from "@/lib/utils";

export function TasksScreen() {
  const { vault, toggleTask } = useFix();
  if (!vault) return null;
  const tasks = [...vault.tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return a.due.localeCompare(b.due);
  });
  const companies = [...new Set(tasks.map((task) => task.company))];

  return (
    <Screen>
      <PageTitle
        eyebrow="CRM"
        title="Задачи по клиентам"
        text="Каждая договорённость из звонка становится задачей. Отметьте выполнение, когда обещание закрыто."
      />
      {tasks.length === 0 ? (
        <Surface>
          <p className="text-sm text-[#626c77]">
            Задач пока нет. Запустите демо-звонок — они появятся без ручного ввода.
          </p>
        </Surface>
      ) : (
        <div className="space-y-6">
          {companies.map((company) => (
            <section key={company}>
              <h2 className="mb-2 text-sm font-medium text-[#626c77]">{company}</h2>
              <div className="space-y-2">
                {tasks
                  .filter((task) => task.company === company)
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
                            {task.client} · {formatWhen(task.due, task.time)}
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

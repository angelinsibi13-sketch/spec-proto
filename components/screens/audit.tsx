"use client";

import { PageTitle, Screen, Surface } from "@/components/bits";
import { useFix } from "@/lib/store";

export function AuditScreen() {
  const { vault } = useFix();
  if (!vault) return null;
  const rows = [...vault.audit].reverse();

  return (
    <Screen>
      <PageTitle
        eyebrow="Доступ"
        title="Кто открывал запись"
        text="Сервер пишет создание договорённости, правку, закрытие задачи и каждый просмотр расшифровки. Действует Алексей Морозов."
      />
      {rows.length === 0 ? (
        <Surface>
          <p className="text-sm text-[#626c77]">Журнал пуст. Он появится после согласия и первого звонка.</p>
        </Surface>
      ) : (
        <ol className="space-y-2">
          {rows.map((entry) => (
            <li key={entry.id}>
              <Surface className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{entry.action}</p>
                  <time className="text-xs text-[#626c77]" dateTime={entry.at}>
                    {new Date(entry.at).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p className="mt-1 text-sm text-[#626c77]">{entry.detail}</p>
                <p className="mt-1 text-xs text-[#626c77]">{entry.actor}</p>
              </Surface>
            </li>
          ))}
        </ol>
      )}
    </Screen>
  );
}

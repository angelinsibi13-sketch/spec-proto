"use client";

import {
  CalendarDays,
  House,
  ListChecks,
  Phone,
  ScrollText,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/bits";
import { ConsentScreen } from "@/components/screens/consent";
import { CalendarScreen } from "@/components/screens/calendar";
import { CallScreen } from "@/components/screens/call";
import { HomeScreen } from "@/components/screens/home";
import { SettingsScreen } from "@/components/screens/settings";
import { TasksScreen } from "@/components/screens/tasks";
import { AuditScreen } from "@/components/screens/audit";
import { Button } from "@/components/ui/button";
import { StoreProvider, useFix } from "@/lib/store";
import type { View } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV: { id: View; label: string; icon: typeof House }[] = [
  { id: "home", label: "Главная", icon: House },
  { id: "call", label: "Звонок", icon: Phone },
  { id: "tasks", label: "Задачи", icon: ListChecks },
  { id: "calendar", label: "Календарь", icon: CalendarDays },
  { id: "audit", label: "Журнал", icon: ScrollText },
  { id: "settings", label: "Настройки", icon: Settings },
];

const MOBILE: View[] = ["home", "call", "tasks", "calendar"];

export function App() {
  return (
    <StoreProvider>
      <Frame />
    </StoreProvider>
  );
}

function Frame() {
  const store = useFix();
  const [more, setMore] = useState(false);

  if (store.status === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <Logo />
          <p className="mt-4 text-sm text-[#626c77]">Читаем хранилище на сервере…</p>
        </div>
      </main>
    );
  }

  if (store.status === "error") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
        <Logo />
        <h1 className="font-heading mt-8 text-2xl font-semibold">Сервер прототипа не ответил</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#626c77]">
          Хранилище читается с сервера. Если файл не расшифровался, сброс создаст его заново.
        </p>
        <Button className="mt-5 h-11" onClick={store.wipe}>
          Сбросить и начать заново
        </Button>
      </main>
    );
  }

  if (!store.vault?.consentAt) return <ConsentScreen />;

  const screen = {
    home: <HomeScreen />,
    call: <CallScreen />,
    tasks: <TasksScreen />,
    calendar: <CalendarScreen />,
    settings: <SettingsScreen />,
    audit: <AuditScreen />,
  }[store.view];

  return (
    <div className="h-dvh bg-[#e7e9ee] md:p-4">
      <div className="mx-auto flex h-full max-w-6xl overflow-hidden bg-[#f6f7f9] md:rounded-3xl md:shadow-[0_20px_60px_rgba(29,32,35,0.12)] md:ring-1 md:ring-black/5">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-[#1d2023]/8 bg-white md:flex">
          <div className="h-1 bg-[#ff0032]" />
          <div className="px-4 pt-5">
            <Logo />
          </div>
          <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
            {NAV.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={store.view === item.id}
                onClick={() => store.open(item.id)}
              />
            ))}
          </nav>
          <div className="border-t border-[#1d2023]/8 px-4 py-4">
            <p className="text-sm font-medium">Алексей Морозов</p>
            <p className="text-xs text-[#626c77]">оргтехника · журнал звонков</p>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="h-1 bg-[#ff0032] md:hidden" />
          <div className="flex items-center justify-between border-b border-[#1d2023]/8 bg-white px-4 py-3 md:hidden">
            <Logo />
            <p className="text-xs text-[#626c77]">Алексей</p>
          </div>
          {store.notice ? (
            <p className="bg-[#1d2023] px-4 py-2 text-center text-sm text-white">{store.notice}</p>
          ) : null}
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              store.view === "call" && "md:overflow-hidden",
            )}
          >
            {screen}
          </div>
        </div>
      </div>

      {store.view === "call" ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#1d2023]/8 bg-white pb-[max(0.4rem,env(safe-area-inset-bottom))] md:hidden">
          {more ? (
            <div className="grid grid-cols-2 gap-2 border-b border-[#1d2023]/8 p-3">
              {NAV.filter((item) => !MOBILE.includes(item.id)).map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={store.view === item.id}
                  onClick={() => {
                    setMore(false);
                    store.open(item.id);
                  }}
                />
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-5">
            {NAV.filter((item) => MOBILE.includes(item.id)).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMore(false);
                  store.open(item.id);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[11px]",
                  store.view === item.id ? "text-[#ff0032]" : "text-[#626c77]",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMore((value) => !value)}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px]",
                more || !MOBILE.includes(store.view) ? "text-[#ff0032]" : "text-[#626c77]",
              )}
            >
              <Settings className="size-5" />
              Ещё
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
        active ? "bg-[#ff0032]/10 font-medium text-[#ff0032]" : "text-[#1d2023] hover:bg-[#f3f4f6]",
      )}
    >
      <item.icon className="size-4" />
      {item.label}
    </button>
  );
}

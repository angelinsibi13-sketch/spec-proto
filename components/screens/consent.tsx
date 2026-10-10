"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/bits";
import { useFix } from "@/lib/store";

const POINTS = [
  {
    title: "Что попадает в запись",
    text: "Расшифровка звонка, имя клиента, компания, сумма и сроки, которые прозвучали.",
  },
  {
    title: "Зачем",
    text: "Чтобы договорённость стала задачей и событием в календаре без ручной пометки.",
  },
  {
    title: "Где лежит",
    text: "На сервере прототипа, файлом AES-256-GCM. Ключ рядом с файлом и в браузер не отдаётся. В бою это был бы контур МТС, не чужой API.",
  },
  {
    title: "Вторая сторона",
    text: "В начале звонка Алексей говорит абоненту, что разговор фиксируется, и ждёт согласия.",
  },
];

export function ConsentScreen() {
  const { acceptConsent } = useFix();
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-8">
      <Logo />
      <p className="mt-10 text-[12px] font-medium tracking-wide text-[#ff0032] uppercase">
        Перед записью звонка
      </p>
      <h1 className="font-heading mt-2 text-3xl leading-tight font-semibold tracking-tight">
        Согласие на обработку разговора
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#626c77]">
        Алексей Морозов, продажи оргтехники. Агент слушает звонок и сам фиксирует обещания. Без согласия запись не начинается.
      </p>
      <ul className="mt-6 space-y-3">
        {POINTS.map((point) => (
          <li key={point.title} className="rounded-2xl bg-white p-4 ring-1 ring-[#1d2023]/8">
            <p className="text-sm font-medium">{point.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#626c77]">{point.text}</p>
          </li>
        ))}
      </ul>
      <label className="mt-6 flex items-start gap-3 text-sm leading-snug">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-0.5 size-4 accent-[#ff0032]"
        />
        <span>Согласен на обработку записи звонка для фиксации договорённостей.</span>
      </label>
      <Button
        className="mt-5 h-11"
        disabled={!checked || pending}
        onClick={() => {
          setPending(true);
          void acceptConsent();
        }}
      >
        {pending ? "Сохраняем согласие…" : "Продолжить"}
      </Button>
      <p className="mt-4 text-xs leading-relaxed text-[#626c77]">
        Это прототип. Звонок — готовая расшифровка, сеть МТС не записывается. Карточки создаёт сервер этого демо.
      </p>
    </main>
  );
}

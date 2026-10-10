"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Slide =
  | { kind: "cover"; kicker: string; title: string; text: string }
  | { kind: "list"; kicker: string; title: string; points: string[] }
  | { kind: "cards"; kicker: string; title: string; cards: { title: string; text: string }[] }
  | { kind: "steps"; kicker: string; title: string; steps: { title: string; text: string }[] }
  | { kind: "close"; kicker: string; title: string; points: string[] };

const SLIDES: Slide[] = [
  {
    kind: "cover",
    kicker: "МТС Беларусь · прототип",
    title: "Фикс",
    text: "Пока идёт звонок, обещание само становится задачей и днём в календаре.",
  },
  {
    kind: "list",
    kicker: "Проблема",
    title: "Договорённость остаётся в блокноте",
    points: [
      "У Алексея 30–40 звонков в день по оргтехнике.",
      "Фраза «пришлите КП до пятницы» легко теряется.",
      "Срок проходит — клиент уходит к другому.",
      "В прототипе это уже видно: КП для «Лучи» просрочено на неделю.",
    ],
  },
  {
    kind: "list",
    kicker: "Решение",
    title: "Агент фиксирует обещание сам",
    points: [
      "Слышит срок, сумму и тип обещания.",
      "Сразу ставит задачу.",
      "Кладёт событие в календарь.",
      "Алексею не нужно нажимать «создать».",
    ],
  },
  {
    kind: "cards",
    kicker: "Кто в демо",
    title: "Один менеджер и два абонента",
    cards: [
      {
        title: "Алексей Морозов",
        text: "Продажи оргтехники. Это его рабочий экран.",
      },
      {
        title: "Мария Соколова",
        text: "«Лучи», закупки. Исходящий звонок, МФУ. +375 29 440-19-20.",
      },
      {
        title: "Олег Ким",
        text: "«Неман Логистик», директор. Входящий звонок, принтеры. +375 33 220-44-18.",
      },
      {
        title: "Деньги",
        text: "Суммы в белорусских рублях. В демо это 6 200 Br и 2 800 Br.",
      },
    ],
  },
  {
    kind: "list",
    kicker: "Что ловит",
    title: "Пять видов обещаний",
    points: [
      "Коммерческое предложение.",
      "Встреча или созвон.",
      "Оплата счёта.",
      "Документы и договор.",
      "Перезвон.",
    ],
  },
  {
    kind: "cards",
    kicker: "Экраны",
    title: "Что можно открыть",
    cards: [
      { title: "Сегодня", text: "Напоминания, просрочка и две кнопки звонка." },
      { title: "Звонок", text: "Диалог, карточки сбоку, пауза и голос." },
      { title: "Задачи", text: "Список по компаниям. Можно отметить выполненным." },
      { title: "Календарь", text: "Месяц, день и кнопка «Скачать всё»." },
      { title: "Журнал", text: "Что сервер записал и кто открыл расшифровку." },
      { title: "Настройки", text: "Слова, шаблон задачи, приоритет и голос." },
    ],
  },
  {
    kind: "steps",
    kicker: "Звонок",
    title: "Как это выглядит",
    steps: [
      {
        title: "Алексей предупреждает",
        text: "Говорит, что разговор фиксируется, и ждёт согласия.",
      },
      {
        title: "Клиент называет срок",
        text: "Например: «Счёт на 6 200 рублей оплатим до 20 октября».",
      },
      {
        title: "Карточка появляется сама",
        text: "Подсказка: «Зафиксирована договорённость… Подтвердить?». Задача уже создана.",
      },
      {
        title: "Можно поправить",
        text: "Дату, сумму, текст и приоритет. Правка уходит и в задачу, и в календарь.",
      },
    ],
  },
  {
    kind: "list",
    kicker: "Как решает",
    title: "Простыми словами",
    points: [
      "Браузер только рисует экран.",
      "Каждая реплика уходит на сервер.",
      "Сервер ищет знакомые слова и дату в этой же фразе.",
      "Нашёл — создаёт задачу и событие. Не нашёл — молчит.",
      "Это правила по словам, не чат-бот.",
    ],
  },
  {
    kind: "list",
    kicker: "Честно",
    title: "Чего в прототипе нет",
    points: [
      "Нет живого звонка по сети МТС.",
      "Нет распознавания речи с трубки: диалог написан заранее.",
      "Нет настоящей CRM и биллинга.",
      "Голоса записаны заранее: Алексей и Олег — мужские, Мария — женский.",
      "Быстрый темп голос выключает, чтобы пролистать разговор.",
    ],
  },
  {
    kind: "close",
    kicker: "На защите",
    title: "Показать за две минуты",
    points: [
      "Сегодня: сделка «Лучи» уже горит.",
      "Позвонить Марии и дождаться фразы про КП.",
      "Карточка справа и тот же день в календаре.",
      "В настройках выключить тип — следующий звонок его не поймает.",
    ],
  },
];

export function Deck() {
  const [index, setIndex] = useState(0);
  const last = SLIDES.length - 1;

  const go = useCallback(
    (next: number) => {
      setIndex(Math.min(last, Math.max(0, next)));
    },
    [last],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        go(index + 1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(index - 1);
      }
      if (event.key === "Home") go(0);
      if (event.key === "End") go(last);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, last]);

  const slide = SLIDES[index];
  const dark = slide.kind === "cover";

  return (
    <div className={dark ? "flex h-dvh flex-col bg-[#1d2023] text-white" : "flex h-dvh flex-col bg-[#f6f7f9] text-[#1d2023]"}>
      <div className="h-1 shrink-0 bg-[#ff0032]" />
      <header className="flex items-center justify-between px-4 py-3 md:px-10">
        <p className="font-heading text-sm font-semibold">Фикс</p>
        <p className={dark ? "text-xs text-white/60" : "text-xs text-[#626c77]"}>
          {index + 1} / {SLIDES.length}
        </p>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-10">
        <div className="mx-auto flex h-full max-w-4xl flex-col justify-center py-4">
          <SlideView slide={slide} />
        </div>
      </main>

      <footer className={dark ? "flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 md:px-10" : "flex items-center justify-between gap-3 border-t border-[#1d2023]/8 bg-white px-4 py-3 md:px-10"}>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm disabled:opacity-30"
            aria-label="Предыдущий слайд"
          >
            <ChevronLeft className="size-4" />
            Назад
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === last}
            className="inline-flex h-10 items-center gap-1 rounded-xl bg-[#ff0032] px-3 text-sm text-white disabled:opacity-30"
            aria-label="Следующий слайд"
          >
            Дальше
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/" className={dark ? "text-white/80 underline-offset-2 hover:underline" : "text-[#626c77] underline-offset-2 hover:underline"}>
            Прототип
          </Link>
          <Link href="/report" className={dark ? "text-white/80 underline-offset-2 hover:underline" : "text-[#626c77] underline-offset-2 hover:underline"}>
            Отчёт
          </Link>
        </div>
      </footer>
    </div>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  if (slide.kind === "cover") {
    return (
      <div>
        <p className="text-sm font-medium tracking-wide text-[#ff0032] uppercase">{slide.kicker}</p>
        <h1 className="font-heading mt-4 text-6xl font-semibold tracking-tight md:text-8xl">{slide.title}</h1>
        <p className="mt-6 max-w-xl text-xl leading-relaxed text-white/80 md:text-2xl">{slide.text}</p>
        <p className="mt-8 text-sm text-white/50">Алексей Морозов · продажи оргтехники</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[12px] font-medium tracking-wide text-[#ff0032] uppercase">{slide.kicker}</p>
      <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight md:text-5xl">{slide.title}</h1>
      {slide.kind === "list" || slide.kind === "close" ? (
        <ul className="mt-8 space-y-3">
          {slide.points.map((point) => (
            <li key={point} className="flex gap-3 text-lg leading-snug md:text-xl">
              <span className="mt-2 size-2 shrink-0 rounded-full bg-[#ff0032]" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {slide.kind === "cards" ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {slide.cards.map((card) => (
            <div key={card.title} className="rounded-2xl bg-white p-4 ring-1 ring-[#1d2023]/8">
              <p className="font-medium">{card.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#626c77]">{card.text}</p>
            </div>
          ))}
        </div>
      ) : null}
      {slide.kind === "steps" ? (
        <ol className="mt-8 space-y-4">
          {slide.steps.map((step, stepIndex) => (
            <li key={step.title} className="flex gap-4">
              <span className="font-heading text-2xl font-semibold text-[#ff0032]">{stepIndex + 1}</span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#626c77] md:text-base">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {slide.kind === "close" ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex h-11 items-center rounded-xl bg-[#ff0032] px-4 text-sm font-medium text-white">
            Открыть прототип
          </Link>
          <Link href="/report" className="inline-flex h-11 items-center rounded-xl bg-white px-4 text-sm font-medium ring-1 ring-[#1d2023]/10">
            Читать отчёт
          </Link>
        </div>
      ) : null}
    </div>
  );
}

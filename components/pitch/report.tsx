"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export function Report() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 print:max-w-none print:px-0 print:py-0">
      <p className="text-[12px] font-medium tracking-wide text-[#ff0032] uppercase">МТС Беларусь · прототип</p>
      <h1 className="font-heading mt-2 text-4xl font-semibold tracking-tight">Фикс. Что есть сейчас</h1>
      <p className="mt-4 text-lg leading-relaxed">
        Алексей Морозов продаёт оргтехнику и делает 30–40 звонков в день. Фраза «пришлите КП до пятницы» легко теряется в блокноте, и срок сгорает. Фикс слушает разговор и сам ставит задачу и день в календаре.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <a href="/otchet-fiks.docx" className="inline-flex h-10 items-center rounded-xl bg-[#ff0032] px-4 text-sm font-medium text-white">
          Скачать Word
        </a>
        <Link href="/present" className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm ring-1 ring-[#1d2023]/10">
          Презентация
        </Link>
        <Link href="/" className="inline-flex h-10 items-center rounded-xl px-4 text-sm text-[#626c77]">
          Прототип
        </Link>
      </div>

      <Section title="Для кого">
        <p>Экран сделан для Алексея. Абоненты белорусские, язык русский, суммы в белорусских рублях.</p>
        <ul>
          <li>Мария Соколова, «Лучи», закупки. Исходящий звонок про МФУ. +375 29 440-19-20.</li>
          <li>Олег Ким, «Неман Логистик», директор. Входящий звонок про принтеры. +375 33 220-44-18.</li>
        </ul>
        <p>На старте уже горит просроченное КП для «Лучи»: сразу видно, зачем агент нужен.</p>
      </Section>

      <Section title="Что умеет">
        <ul>
          <li>Менеджер перед работой даёт согласие. В начале звонка он спрашивает абонента ещё раз.</li>
          <li>Можно звонить и принимать звонки клиентов.</li>
          <li>Когда в реплике есть срок, задача и событие появляются в карточках.</li>
          <li>Подсказка спрашивает «Подтвердить?». Это не обязательно. Дату, сумму и текст можно поправить.</li>
          <li>Задачу можно закрыть. Календарь показывает месяц, день открывается по нажатию, все события скачиваются одним файлом.</li>
          <li>В настройках можно выключить тип обещания, поменять слова и приоритет.</li>
          <li>Журнал пишет, что сделал сервер.</li>
        </ul>
      </Section>

      <Section title="Что узнаёт">
        <p>Пять видов обещаний: коммерческое предложение, встреча или созвон, оплата, документы, перезвон.</p>
        <p>Пример: «Счёт на 6 200 рублей оплатим до 20 октября». У Олега (клиент) бюджет 2 800 Br и оплата до конца месяца.</p>
      </Section>

      <Section title="Как решает">
        <p>
          Каждая реплика уходит на сервер. Сервер ищет знакомое слово и дату в этой же фразе: «до пятницы», «до 20 октября», «завтра утром». Сумму берёт из слова «рублей». Одинаковую карточку второй раз не создаёт.
        </p>
      </Section>

      <Section title="Чего нет">
        <ul>
          <li>Нет живого звонка по сети МТС и нет распознавания речи с трубки. Диалог написан заранее, но каждая фраза всё равно уходит на сервер.</li>
          <li>Нет настоящей CRM и биллинга. Календарь живёт внутри приложения.</li>
          <li>Нет резюме клиенту и нет дашборда для руководителя.</li>
          <li>Свою реплику дописать нельзя: звонок идёт по готовому диалогу.</li>
          <li>Запись прототипа лежит зашифрованным файлом на сервере демо. Это не контур МТС.</li>
        </ul>
      </Section>

      <Section title="Как показать">
        <ol>
          <li>На экране «Сегодня» показать, что КП «Лучи» уже горит.</li>
          <li>Нажать «Позвонить Марии» и дождаться фразы про КП.</li>
          <li>Показать карточку справа и тот же день в календаре.</li>
          <li>По желанию выключить тип в настройках: следующий звонок его не поймает.</li>
        </ol>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-heading text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-[#1d2023] [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}

import type { ReactNode } from "react";
import { TYPE_INFO, PRIORITY_LABEL } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { AgreementType, Priority } from "@/lib/types";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#ff0032" />
        <path
          d="M16 6.4c-3.8 3-6.4 6.7-6.4 10.4 0 3.7 2.8 6.4 6.4 6.4s6.4-2.7 6.4-6.4c0-3.7-2.6-7.4-6.4-10.4z"
          fill="white"
        />
      </svg>
      {compact ? null : (
        <span className="leading-none">
          <span className="font-heading block text-[15px] font-semibold tracking-tight">Фикс</span>
          <span className="mt-1 block text-[11px] text-[#626c77]">МТС Беларусь</span>
        </span>
      )}
    </span>
  );
}

export function TypePill({ type }: { type: AgreementType }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-[#1d2023] px-2 text-[11px] font-medium text-white">
      {TYPE_INFO[type].label}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium",
        priority === "high" && "bg-[#ff0032]/10 text-[#d1002b]",
        priority === "medium" && "bg-[#f5c451]/30 text-[#7a5b00]",
        priority === "low" && "bg-[#eef0f3] text-[#626c77]",
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function Surface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl bg-white p-4 ring-1 ring-[#1d2023]/8", className)}>
      {children}
    </section>
  );
}

export function PageTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
}) {
  return (
    <header className="mb-5">
      {eyebrow ? (
        <p className="mb-2 text-[12px] font-medium tracking-wide text-[#ff0032] uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-heading text-[1.7rem] leading-tight font-semibold tracking-tight text-[#1d2023]">
        {title}
      </h1>
      {text ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#626c77]">{text}</p> : null}
    </header>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="px-4 py-5 pb-32 md:px-8 md:py-8 md:pb-8">{children}</div>;
}

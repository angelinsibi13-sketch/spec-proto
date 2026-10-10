import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
});

export const metadata: Metadata = {
  title: "Фикс — договорённости из звонка",
  description:
    "Прототип агента МТС Беларусь: во время звонка сам фиксирует договорённости, ставит задачу в CRM и событие в календарь.",
  applicationName: "Фикс",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Фикс",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ff0032",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${unbounded.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#e7e9ee] text-[#1d2023]">{children}</body>
    </html>
  );
}

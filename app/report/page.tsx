import type { Metadata } from "next";
import { Report } from "@/components/pitch/report";

export const metadata: Metadata = {
  title: "Отчёт — Фикс",
  description: "Простое описание прототипа: что есть, как это работает и чего нет.",
};

export default function ReportPage() {
  return <Report />;
}

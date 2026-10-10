import type { Metadata } from "next";
import { Deck } from "@/components/pitch/deck";

export const metadata: Metadata = {
  title: "Презентация — Фикс",
  description: "Короткая презентация прототипа: что Фикс умеет сейчас.",
};

export default function PresentPage() {
  return <Deck />;
}

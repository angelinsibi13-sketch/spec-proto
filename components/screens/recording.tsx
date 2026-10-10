"use client";

import { useState } from "react";
import { Surface } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFix } from "@/lib/store";

export function RecordingCard() {
  const { uploadRecording, vault, open } = useFix();
  const [client, setClient] = useState("Мария Соколова");
  const [company, setCompany] = useState("«Лучи»");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<number | null>(null);
  const latest = [...(vault?.calls ?? [])].reverse().find((call) => call.origin === "upload");

  async function loadSample() {
    setError("");
    const response = await fetch("/samples/dogovorennost.wav");
    if (!response.ok) {
      setError("Пример записи не открылся");
      return;
    }
    const blob = await response.blob();
    setFile(new File([blob], "dogovorennost.wav", { type: "audio/wav" }));
  }

  return (
    <Surface className="mb-4">
      <p className="text-sm font-medium">Запись звонка</p>
      <p className="mt-1 text-sm leading-relaxed text-[#626c77]">
        Загрузите WAV, MP3, OGG или M4A — или положите файл в папку записей. Речь и разные голоса разбираются на этом компьютере и сохраняются в карточке. Точность заранее не гарантируется: сверьте текст, прежде чем опираться на задачу.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="rec-client">Клиент</Label>
          <Input id="rec-client" className="mt-1.5 h-10" value={client} onChange={(event) => setClient(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="rec-company">Компания</Label>
          <Input id="rec-company" className="mt-1.5 h-10" value={company} onChange={(event) => setCompany(event.target.value)} />
        </div>
      </div>
      <div className="mt-3">
        <Label htmlFor="rec-file">Файл</Label>
        <Input
          id="rec-file"
          className="mt-1.5 h-10"
          type="file"
          accept="audio/wav,audio/mpeg,audio/ogg,audio/mp4,audio/webm,.wav,.mp3,.ogg,.opus,.m4a,.webm,.aac"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError("");
          }}
        />
        {file ? <p className="mt-1 text-xs text-[#626c77]">{file.name}</p> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          className="h-10"
          disabled={busy || !file}
          onClick={() => {
            if (!file) return;
            setBusy(true);
            setError("");
            setCreated(null);
            void uploadRecording(file, client, company)
              .then((result) => setCreated(result.created))
              .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Не удалось разобрать запись"))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Распознаём…" : "Разобрать запись"}
        </Button>
        <Button variant="outline" className="h-10" disabled={busy} onClick={() => void loadSample()}>
          Подставить пример
        </Button>
      </div>
      {busy ? (
        <p className="mt-3 text-sm text-[#626c77]">Файл обрабатывается локально. Короткая запись обычно занимает меньше минуты.</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[#d1002b]">{error}</p> : null}
      {created !== null ? (
        <p className="mt-3 text-sm">
          Новых задач: {created}.{" "}
          <button type="button" className="font-medium text-[#ff0032]" onClick={() => open("tasks")}>
            Открыть задачи
          </button>
        </p>
      ) : null}
      {latest && latest.lines.length > 0 ? (
        <div className="mt-4 border-t border-[#1d2023]/8 pt-3">
          <p className="text-xs font-medium tracking-wide text-[#626c77] uppercase">Последний распознанный текст</p>
          <ul className="mt-2 space-y-1">
            {latest.lines.map((line) => (
              <li key={line.id} className="text-sm leading-relaxed">
                <span className="text-[#626c77]">{line.name}: </span>
                {line.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Surface>
  );
}

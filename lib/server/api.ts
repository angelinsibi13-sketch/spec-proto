import { scoreAccuracy } from "@/lib/accuracy";
import { ROUTES } from "@/lib/routes";
import {
  beginDemo,
  blankVault,
  confirmAgreement,
  createSeedVault,
  editAgreement,
  endDemo,
  addManualEvent,
  ensureCatalog,
  ensureOlegTranscript,
  removeAgreement,
  ingestRecording,
  markSummarySent,
  noteAccess,
  pushLine,
  setReminderItems,
  setTaskStatus,
  setVoice,
  updateRule,
  type AgreementPatch,
} from "@/lib/machine";
import type { AgreementType, Direction, Priority, ReminderItem, Vault } from "@/lib/types";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { readVault, vaultFile, writeVault } from "@/lib/server/db";
import { listTraces, pushTrace } from "@/lib/server/trace";
import { syncRecordings } from "@/lib/server/recording-sync";
import { whisperReady, type TranscriptSegment } from "@/lib/server/transcribe";

export { ROUTES } from "@/lib/routes";

function mutate(method: string, path: string, summary: string, change: (vault: Vault) => Vault) {
  const started = Date.now();
  const next = change(readVault());
  writeVault(next);
  const trace = pushTrace({ method, path, status: 200, ms: Date.now() - started, summary });
  return { state: next, trace, file: vaultFile() };
}

export async function getState() {
  const catalog = ensureCatalog(readVault());
  const scripted = ensureOlegTranscript(catalog.vault);
  const synced = await syncRecordings(scripted.vault);
  if (catalog.changed || scripted.changed || synced.changed) writeVault(synced.vault);
  return { state: synced.vault, file: vaultFile() };
}

export async function acceptConsent() {
  const started = Date.now();
  const seeded = ensureOlegTranscript(createSeedVault()).vault;
  const synced = await syncRecordings(seeded);
  writeVault(synced.vault);
  const trace = pushTrace({
    method: "POST",
    path: "/api/consent",
    status: 200,
    ms: Date.now() - started,
    summary: "Согласие Алексея записано",
  });
  return { state: synced.vault, trace, file: vaultFile() };
}

export function uploadRecording(input: {
  client: string;
  company: string;
  segments: TranscriptSegment[];
  sourcePath: string;
  ext: ".wav";
}) {
  const current = readVault();
  if (!current.consentAt) {
    return { error: "Сначала нужно согласие на обработку записи", status: 403 as const };
  }
  const started = Date.now();
  const { vault, created, callId } = ingestRecording(current, input);
  const directory = path.join(process.cwd(), "data", "recordings");
  mkdirSync(directory, { recursive: true });
  const stored = path.join(directory, `${callId}${input.ext}`);
  copyFileSync(input.sourcePath, stored);
  rmSync(input.sourcePath, { force: true });
  const saved = {
    ...vault,
    calls: vault.calls.map((call) =>
      call.id === callId ? { ...call, audio: `/api/recordings/${callId}` } : call,
    ),
  };
  writeVault(saved);
  const trace = pushTrace({
    method: "POST",
    path: "/api/recordings",
    status: 200,
    ms: Date.now() - started,
    summary: `Запись: ${created} новых задач`,
  });
  return {
    state: saved,
    trace,
    file: vaultFile(),
    created,
    transcript: input.segments.map((segment) => segment.text.trim()).filter(Boolean).join(" "),
  };
}

export { whisperReady };

export function openCall(direction: Direction) {
  return mutate("POST", "/api/calls", direction === "in" ? "Входящий" : "Исходящий", (vault) => {
    if (!vault.consentAt) return vault;
    return beginDemo(vault, direction);
  });
}

export function addLine(
  callId: string,
  input: { speaker: "agent" | "client"; name: string; text: string; fromScript: boolean },
) {
  const started = Date.now();
  const current = readVault();
  const live = current.calls.some((call) => call.id === callId && call.endedAt === null);
  if (!live) {
    const trace = pushTrace({
      method: "POST",
      path: `/api/calls/${callId}/lines`,
      status: 200,
      ms: Date.now() - started,
      summary: "Звонок уже закрыт",
    });
    return { state: current, trace, file: vaultFile() };
  }
  const before = current.agreements.length;
  const next = pushLine(current, input);
  let summary = "Реплика без договорённости";
  if (next.agreements.length > before) {
    const created = next.agreements[next.agreements.length - 1];
    summary = `Создано ${created.type} до ${created.due}${created.amount ? `, ${created.amount} Br` : ""}`;
  }
  writeVault(next);
  const trace = pushTrace({
    method: "POST",
    path: `/api/calls/${callId}/lines`,
    status: 200,
    ms: Date.now() - started,
    summary,
  });
  return { state: next, trace, file: vaultFile() };
}

export function finishCall(callId: string) {
  return mutate("POST", `/api/calls/${callId}/finish`, "Звонок завершён", (vault) => endDemo(vault));
}

export function sendSummary(callId: string) {
  return mutate("POST", `/api/calls/${callId}/summary`, "Резюме отмечено отправленным", (vault) =>
    markSummarySent(vault, callId),
  );
}

export function patchAgreement(id: string, patch: AgreementPatch) {
  return mutate("PATCH", `/api/agreements/${id}`, "Карточка исправлена", (vault) =>
    editAgreement(vault, id, patch),
  );
}

export function dropAgreement(id: string) {
  return mutate("DELETE", `/api/agreements/${id}`, "Договорённость удалена", (vault) =>
    removeAgreement(vault, id),
  );
}

export function confirm(id: string, confirmed: boolean) {
  return mutate("POST", `/api/agreements/${id}/confirm`, confirmed ? "Подтверждено" : "Отложено", (vault) =>
    confirmAgreement(vault, id, confirmed),
  );
}

export function patchTask(id: string, status: "open" | "done") {
  return mutate("PATCH", `/api/tasks/${id}`, status, (vault) => setTaskStatus(vault, id, status));
}

export function patchRule(
  type: AgreementType,
  patch: { enabled?: boolean; keywords?: string; template?: string; priority?: Priority },
) {
  return mutate("PATCH", `/api/rules/${type}`, "Правило обновлено", (vault) => updateRule(vault, type, patch));
}

export function patchVoice(voice: boolean) {
  return mutate("PATCH", "/api/settings", voice ? "Голос включён" : "Голос выключен", (vault) =>
    setVoice(vault, voice),
  );
}

export function saveReminder(eventId: string, items: ReminderItem[]) {
  return mutate("PATCH", `/api/events/${eventId}/reminder`, "Напоминания сохранены", (vault) =>
    setReminderItems(vault, eventId, items),
  );
}

export function createEvent(input: {
  title: string;
  due: string;
  time: string;
  priority: Priority;
  reminders: ReminderItem[];
}) {
  return mutate("POST", "/api/events", "Событие добавлено", (vault) => addManualEvent(vault, input));
}

export function viewTranscript(detail: string) {
  return mutate("POST", "/api/audit", "Просмотр расшифровки", (vault) => noteAccess(vault, detail));
}

export function accuracyReport() {
  const started = Date.now();
  const rules = readVault().rules;
  const score = scoreAccuracy(rules);
  const trace = pushTrace({
    method: "GET",
    path: "/api/accuracy",
    status: 200,
    ms: Date.now() - started,
    summary: `${score.passed}/${score.total}`,
  });
  return { score, trace, file: vaultFile() };
}

export function backendView() {
  return { routes: ROUTES, traces: listTraces(), file: vaultFile() };
}

export function resetAll() {
  const started = Date.now();
  const state = blankVault();
  writeVault(state);
  const trace = pushTrace({
    method: "POST",
    path: "/api/reset",
    status: 200,
    ms: Date.now() - started,
    summary: "Хранилище очищено",
  });
  return { state, trace, file: vaultFile() };
}

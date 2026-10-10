"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SCRIPT_TAIL_MS, scriptFor, type ScriptLine } from "@/lib/demo-script";
import { activeDemo } from "@/lib/machine";
import type { AgreementPatch } from "@/lib/machine";
import type { AgreementType, Direction, Priority, ReminderItem, Rule, Vault, View } from "@/lib/types";
import { packReminder } from "@/lib/reminders";

type Playback = {
  running: boolean;
  fast: boolean;
  elapsedMs: number;
  nextIndex: number;
  speechHold: boolean;
};

type Status = "loading" | "ready" | "error";

export type VaultFile = {
  alg: string;
  path: string;
  bytes: number;
};

type Session = {
  status: Status;
  vault: Vault | null;
  view: View;
  focusCallId: string | null;
  playback: Playback;
  notice: string | null;
  file: VaultFile | null;
};

type ApiEnvelope = {
  state?: Vault;
  file?: VaultFile;
  error?: string;
};

const idlePlayback: Playback = {
  running: false,
  fast: false,
  elapsedMs: 0,
  nextIndex: 0,
  speechHold: false,
};

async function send(method: string, path: string, body?: unknown): Promise<ApiEnvelope> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope | null;
  if (!response.ok || !payload) throw new Error(path);
  return payload;
}

type Store = Session & {
  acceptConsent: () => Promise<void>;
  startDemo: (direction: Direction) => void;
  togglePlayback: () => void;
  setFast: (fast: boolean) => void;
  setSpeechHold: (speechHold: boolean) => void;
  finishDemo: () => void;
  confirm: (agreementId: string, confirmed: boolean) => void;
  editAgreement: (agreementId: string, patch: AgreementPatch) => void;
  deleteAgreement: (agreementId: string) => void;
  toggleTask: (taskId: string) => void;
  patchRule: (type: AgreementType, patch: Partial<Rule>) => void;
  toggleVoice: (voice: boolean) => void;
  sendSummary: (callId: string) => void;
  viewTranscript: (detail: string) => void;
  openTranscript: (callId: string) => void;
  saveReminders: (eventId: string, items: ReminderItem[]) => void;
  addEvent: (input: { title: string; due: string; time: string; priority: Priority; reminders: ReminderItem[] }) => void;
  uploadRecording: (file: File, client: string, company: string) => Promise<{ created: number; transcript: string }>;
  open: (view: View) => void;
  flash: (text: string) => void;
  wipe: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({
    status: "loading",
    vault: null,
    view: "home",
    focusCallId: null,
    playback: idlePlayback,
    notice: null,
    file: null,
  });
  const sessionRef = useRef(session);
  const chain = useRef(Promise.resolve());
  const epoch = useRef(0);
  const ruleRev = useRef(0);
  const ruleTimer = useRef<Record<string, number>>({});

  function adopt(envelope: ApiEnvelope) {
    if (!envelope.state) return;
    setSession((prev) => ({
      ...prev,
      status: "ready",
      vault: envelope.state ?? prev.vault,
      file: envelope.file ?? prev.file,
    }));
  }

  function enqueue(job: () => Promise<void>) {
    chain.current = chain.current.then(job).catch(() => {
      setSession((prev) => ({
        ...prev,
        playback: { ...prev.playback, running: false, speechHold: false },
        notice: "Сервер не принял шаг. Журнал — на экране «Сервер».",
      }));
    });
  }

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let cancel = false;
    send("GET", "/api/state")
      .then((envelope) => {
        if (cancel || !envelope.state) return;
        const call = activeDemo(envelope.state);
        const script = call ? scriptFor(call.direction) : [];
        const nextIndex = call?.lines.filter((line) => line.fromScript).length ?? 0;
        const elapsedMs = nextIndex > 0 ? (script[Math.min(nextIndex, script.length) - 1]?.atMs ?? 0) : 0;
        setSession((prev) => ({
          ...prev,
          status: "ready",
          vault: envelope.state ?? prev.vault,
          file: envelope.file ?? null,
          playback: { running: false, fast: false, elapsedMs, nextIndex, speechHold: false },
        }));
      })
      .catch(() => {
        if (!cancel) setSession((prev) => ({ ...prev, status: "error" }));
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!session.playback.running) return;
    const ticket = epoch.current;
    const clock = { ...sessionRef.current.playback };
    let frame = 0;
    let last = performance.now();
    let pending = 0;
    let sealed = false;

    const loop = (now: number) => {
      if (epoch.current !== ticket) return;
      pending += now - last;
      last = now;
      const held = sessionRef.current.playback.speechHold && !sessionRef.current.playback.fast;
      if (held) pending = 0;
      if (!held && pending >= 80) {
        const step = pending;
        pending = 0;
        const vault = sessionRef.current.vault;
        const scale = sessionRef.current.playback.fast ? 3.8 : 1;
        const elapsed = clock.elapsedMs + step * scale;
        clock.elapsedMs = elapsed;
        const call = vault ? activeDemo(vault) : null;
        const script = call ? scriptFor(call.direction) : [];
        let nextIndex = clock.nextIndex;
        const due: ScriptLine[] = [];
        while (call && nextIndex < script.length && script[nextIndex].atMs <= elapsed) {
          due.push(script[nextIndex]);
          nextIndex += 1;
        }
        clock.nextIndex = nextIndex;
        const tail = script.length > 0 ? script[script.length - 1].atMs + SCRIPT_TAIL_MS : 0;
        const done = Boolean(call) && nextIndex >= script.length && elapsed >= tail;
        const speakAlong = Boolean(vault?.voice) && !sessionRef.current.playback.fast && due.length > 0;
        setSession((prev) => ({
          ...prev,
          playback: {
            ...prev.playback,
            elapsedMs: elapsed,
            nextIndex,
            running: done ? false : prev.playback.running,
            speechHold: speakAlong ? true : prev.playback.speechHold,
          },
        }));
        if (call) {
          for (const line of due) {
            const callId = call.id;
            enqueue(async () => {
              if (epoch.current !== ticket) return;
              const envelope = await send("POST", `/api/calls/${callId}/lines`, { ...line, fromScript: true });
              if (epoch.current !== ticket) return;
              adopt(envelope);
            });
          }
          if (done && !sealed) {
            sealed = true;
            const callId = call.id;
            enqueue(async () => {
              if (epoch.current !== ticket) return;
              const envelope = await send("POST", `/api/calls/${callId}/finish`);
              if (!envelope.state) return;
              setSession((prev) => ({
                ...prev,
                vault: envelope.state ?? prev.vault,
                file: envelope.file ?? prev.file,
                playback: { ...prev.playback, running: false },
              }));
            });
          }
        }
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [session.playback.running]);

  const api = useMemo<Store>(() => {
    const flash = (text: string) => {
      setSession((prev) => ({ ...prev, notice: text }));
      window.setTimeout(() => {
        setSession((prev) => (prev.notice === text ? { ...prev, notice: null } : prev));
      }, 2600);
    };

    return {
      ...session,
      flash,
      open: (view) => setSession((prev) => ({ ...prev, view })),
      openTranscript: (callId) => setSession((prev) => ({ ...prev, view: "call", focusCallId: callId })),
      acceptConsent: async () => {
        adopt(await send("POST", "/api/consent"));
        setSession((prev) => ({ ...prev, view: "home" }));
      },
      startDemo: (direction) => {
        const ticket = ++epoch.current;
        setSession((prev) => ({
          ...prev,
          view: "call",
          playback: { running: false, fast: prev.playback.fast, elapsedMs: 0, nextIndex: 0, speechHold: false },
        }));
        enqueue(async () => {
          if (epoch.current !== ticket) return;
          const envelope = await send("POST", "/api/calls", { direction });
          if (epoch.current !== ticket || !envelope.state) return;
          setSession((prev) => ({
            ...prev,
            vault: envelope.state ?? prev.vault,
            file: envelope.file ?? prev.file,
            view: "call",
            playback: { running: true, fast: prev.playback.fast, elapsedMs: 0, nextIndex: 0, speechHold: false },
          }));
        });
      },
      togglePlayback: () => {
        setSession((prev) => {
          if (!prev.vault || !activeDemo(prev.vault)) return prev;
          return { ...prev, playback: { ...prev.playback, running: !prev.playback.running } };
        });
      },
      setFast: (fast) => {
        setSession((prev) => ({
          ...prev,
          playback: { ...prev.playback, fast, speechHold: fast ? false : prev.playback.speechHold },
        }));
      },
      setSpeechHold: (speechHold) => {
        setSession((prev) =>
          prev.playback.speechHold === speechHold ? prev : { ...prev, playback: { ...prev.playback, speechHold } },
        );
      },
      finishDemo: () => {
        const ticket = epoch.current;
        const call = session.vault ? activeDemo(session.vault) : null;
        setSession((prev) => ({ ...prev, playback: { ...prev.playback, running: false } }));
        if (!call) return;
        enqueue(async () => {
          if (epoch.current !== ticket) return;
          const envelope = await send("POST", `/api/calls/${call.id}/finish`);
          if (!envelope.state) return;
          setSession((prev) => ({
            ...prev,
            vault: envelope.state ?? prev.vault,
            file: envelope.file ?? prev.file,
            playback: { ...prev.playback, running: false },
          }));
        });
      },
      confirm: (agreementId, confirmed) => {
        enqueue(async () => {
          adopt(await send("POST", `/api/agreements/${agreementId}/confirm`, { confirmed }));
        });
      },
      editAgreement: (agreementId, patch) => {
        enqueue(async () => {
          adopt(await send("PATCH", `/api/agreements/${agreementId}`, patch));
          flash("Карточка исправлена: задача и календарь обновлены");
        });
      },
      deleteAgreement: (agreementId) => {
        enqueue(async () => {
          adopt(await send("DELETE", `/api/agreements/${agreementId}`));
          flash("Договорённость удалена");
        });
      },
      toggleTask: (taskId) => {
        const task = session.vault?.tasks.find((item) => item.id === taskId);
        if (!task) return;
        const status = task.status === "done" ? "open" : "done";
        enqueue(async () => {
          adopt(await send("PATCH", `/api/tasks/${taskId}`, { status }));
        });
      },
      patchRule: (type, patch) => {
        const rev = ++ruleRev.current;
        setSession((prev) => {
          if (!prev.vault) return prev;
          return {
            ...prev,
            vault: {
              ...prev.vault,
              rules: prev.vault.rules.map((rule) => (rule.type === type ? { ...rule, ...patch, type } : rule)),
            },
          };
        });
        window.clearTimeout(ruleTimer.current[type]);
        ruleTimer.current[type] = window.setTimeout(() => {
          enqueue(async () => {
            const envelope = await send("PATCH", `/api/rules/${type}`, patch);
            if (ruleRev.current !== rev || !envelope.state) return;
            adopt(envelope);
          });
        }, 350);
      },
      toggleVoice: (voice) => {
        setSession((prev) => (prev.vault ? { ...prev, vault: { ...prev.vault, voice } } : prev));
        enqueue(async () => {
          adopt(await send("PATCH", "/api/settings", { voice }));
        });
      },
      sendSummary: (callId) => {
        enqueue(async () => {
          adopt(await send("POST", `/api/calls/${callId}/summary`));
          flash("Резюме отмечено отправленным");
        });
      },
      viewTranscript: (detail) => {
        enqueue(async () => {
          adopt(await send("POST", "/api/audit", { detail }));
        });
      },
      saveReminders: (eventId, items) => {
        setSession((prev) =>
          prev.vault
            ? {
                ...prev,
                vault: {
                  ...prev.vault,
                  reminders: { ...(prev.vault.reminders ?? {}), [eventId]: packReminder(items) },
                },
              }
            : prev,
        );
        enqueue(async () => {
          adopt(await send("PATCH", `/api/events/${eventId}/reminder`, { items }));
          flash(items.length ? `Сохранено напоминаний: ${items.length}` : "Напоминания убраны");
        });
      },
      addEvent: (input) => {
        enqueue(async () => {
          adopt(await send("POST", "/api/events", input));
          flash(
            input.reminders.length
              ? `Событие добавлено, напоминаний: ${input.reminders.length}`
              : "Событие добавлено",
          );
        });
      },
      uploadRecording: (file, client, company) => {
        const task = chain.current.then(async () => {
          const body = new FormData();
          body.set("file", file);
          body.set("client", client);
          body.set("company", company);
          const response = await fetch("/api/recordings", { method: "POST", body });
          const payload = (await response.json().catch(() => null)) as (ApiEnvelope & {
            created?: number;
            transcript?: string;
          }) | null;
          if (!response.ok || !payload?.state) {
            throw new Error(payload?.error || "Не удалось разобрать запись");
          }
          adopt(payload);
          return { created: payload.created ?? 0, transcript: payload.transcript ?? "" };
        });
        chain.current = task.then(
          () => undefined,
          () => undefined,
        );
        return task;
      },
      wipe: () => {
        epoch.current += 1;
        enqueue(async () => {
          const envelope = await send("POST", "/api/reset");
          setSession({
            status: "ready",
            vault: envelope.state ?? null,
            view: "home",
            focusCallId: null,
            playback: idlePlayback,
            notice: null,
            file: envelope.file ?? null,
          });
        });
      },
    };
  }, [session]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useFix(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("Store missing");
  return store;
}

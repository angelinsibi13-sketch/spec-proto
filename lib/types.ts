export type AgreementType = "kp" | "meeting" | "payment" | "callback" | "docs";

export type Priority = "high" | "medium" | "low";

export type Origin = "seed" | "demo" | "upload" | "manual";

export type Direction = "in" | "out";

export type Rule = {
  type: AgreementType;
  enabled: boolean;
  keywords: string;
  priority: Priority;
  template: string;
};

export type Line = {
  id: string;
  speaker: "agent" | "client";
  name: string;
  text: string;
  fromScript: boolean;
  atMs?: number;
};

export type Call = {
  id: string;
  direction: Direction;
  client: string;
  company: string;
  role: string;
  phone: string;
  startedAt: string;
  endedAt: string | null;
  lines: Line[];
  summary: string | null;
  summarySent: boolean;
  origin: Origin;
  counterpartyNotified: boolean;
  audio?: string;
  audioSha?: string;
  sourceFile?: string;
  transcriptNote?: string;
};

export type Agreement = {
  id: string;
  callId: string;
  type: AgreementType;
  client: string;
  company: string;
  phrase: string;
  title: string;
  due: string;
  time: string | null;
  priority: Priority;
  amount: number | null;
  confirmed: boolean | null;
  createdAt: string;
  origin: Origin;
  edited: boolean;
};

export type Task = {
  id: string;
  agreementId: string;
  callId: string;
  type: AgreementType;
  title: string;
  client: string;
  company: string;
  due: string;
  time: string | null;
  priority: Priority;
  amount: number | null;
  status: "open" | "done";
  origin: Origin;
};

export type CalEvent = {
  id: string;
  agreementId: string;
  callId: string;
  type: AgreementType;
  title: string;
  client: string;
  company: string;
  due: string;
  time: string | null;
  amount: number | null;
  origin: Origin;
};

export type ReminderMode = "day" | "hour" | "custom";

export type ReminderKind = "at" | "ten" | "hour" | "day" | "custom";

export type ReminderItem = {
  id: string;
  kind: ReminderKind;
  date: string;
  at: string;
};

export type Reminder = {
  mode: ReminderMode;
  custom: string;
  at?: string;
  items: ReminderItem[];
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
};

export type Vault = {
  consentAt: string | null;
  voice: boolean;
  rules: Rule[];
  calls: Call[];
  agreements: Agreement[];
  tasks: Task[];
  events: CalEvent[];
  reminders: Record<string, Reminder>;
  audit: AuditEntry[];
};

export type View =
  | "home"
  | "call"
  | "tasks"
  | "calendar"
  | "settings"
  | "audit";

export type Hit = {
  type: AgreementType;
  due: string;
  time: string | null;
  priority: Priority;
  title: string;
  amount: number | null;
};

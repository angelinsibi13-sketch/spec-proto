export type Trace = {
  id: string;
  at: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  summary: string;
};

const bucket = globalThis as typeof globalThis & { __fixTraces?: Trace[] };

function traces(): Trace[] {
  bucket.__fixTraces ??= [];
  return bucket.__fixTraces;
}

export function pushTrace(trace: Omit<Trace, "id" | "at">): Trace {
  const entry: Trace = {
    id: `tr-${Date.now().toString(36)}-${traces().length}`,
    at: new Date().toISOString(),
    ...trace,
  };
  const list = traces();
  list.push(entry);
  if (list.length > 40) list.splice(0, list.length - 40);
  return entry;
}

export function listTraces(): Trace[] {
  return [...traces()].reverse();
}

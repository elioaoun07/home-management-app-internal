import { transport, PmError, RefusedCommand } from "./transport";

type Body = Record<string, unknown>;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;

export function storedIntent(scope: string, intent: string, storage: Storage) {
  const raw = storage.getItem("pm-command-intent:" + scope + ":" + intent);
  if (!raw) return null;
  const saved = JSON.parse(raw) as { path: string; body: Body; result?: { run_id?: string } };
  if (!saved.path || !saved.body?.command_id) throw new PmError("Command storage is incomplete", 409);
  const body = { ...saved.body };
  delete body.command_id;
  return { path: saved.path, body, completed: saved.result !== undefined, ...(saved.result?.run_id ? { runId: saved.result.run_id } : {}) };
}

/** Explicitly release one cancelled launch; keep its exact receipt before removal. */
export async function retireCancelledLaunch({ scope, intent, storage, readRun }: {
  scope: string; intent: string; storage: Storage;
  readRun: (id: string) => Promise<{ run: { run_id: string; lifecycle: string; closed_outcome: string | null } }>;
}) {
  const key = "pm-command-intent:" + scope + ":" + intent;
  const raw = storage.getItem(key);
  const saved = storedIntent(scope, intent, storage);
  if (!raw || saved?.path !== "deliver" || !saved.completed || !saved.runId)
    throw new PmError("Reconcile the previous command first", 409);
  const { run } = await readRun(saved.runId);
  if (run.run_id !== saved.runId || run.lifecycle !== "CLOSED" || run.closed_outcome !== "cancelled")
    throw new PmError("Cancellation not confirmed", 409);
  if (storage.getItem(key) !== raw) throw new PmError("Command changed; reconcile it first", 409);
  const command = JSON.parse(raw) as { body: Body };
  const archiveKey = "pm-command-receipt:" + scope + ":" + String(command.body.command_id);
  const archive = storage.getItem(archiveKey);
  if (archive !== null && archive !== raw) throw new PmError("Receipt conflict", 409);
  storage.setItem(archiveKey, raw);
  if (storage.getItem(archiveKey) !== raw) throw new PmError("Command storage unavailable", 503);
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw new PmError("Command storage unavailable", 503);
}

export async function newDeliveryIntent(intent: string) {
  const session = await transport().v2Session();
  if (!session.paired || !session.actor || !session.scope) throw new PmError("Reconnect Command Center", 401);
  if (!navigator.locks) throw new PmError("Command locking unavailable", 503);
  const scope = session.scope + ":" + session.actor;
  return navigator.locks.request("pm-intent:" + scope + ":" + intent, () => retireCancelledLaunch({
    scope, intent, storage: localStorage, readRun: id => transport().v2Run(id),
  }));
}

/** Persist before transmission. The original payload remains the retry payload. */
export async function sendDurableIntent<T>({ scope, intent, path, body, storage, send, uuid = () => crypto.randomUUID() }: {
  scope: string; intent: string; path: string; body: Body; storage: Storage;
  send: (path: string, body: Body) => Promise<T>; uuid?: () => string;
}) {
  const key = "pm-command-intent:" + scope + ":" + intent;
  let saved: { path: string; body: Body; result?: T };
  const prior = storage.getItem(key);
  if (prior) {
    saved = JSON.parse(prior);
    const original = { ...saved.body };
    delete original.command_id;
    if (saved.path !== path || canonical(original) !== canonical(body)) throw new PmError("Reconcile the previous command first", 409);
    if (saved.result !== undefined) return saved.result;
  } else {
    saved = { path, body: { ...body, command_id: uuid() } };
    storage.setItem(key, JSON.stringify(saved));
    if (storage.getItem(key) !== JSON.stringify(saved)) throw new PmError("Command storage unavailable", 503);
  }
  let result: T;
  try { result = await send(saved.path, saved.body); }
  catch (error) {
    // Only a definitive refusal permits a new intent after correction. A lost
    // response, failed status read or expired relay receipt keeps the old id.
    if (error instanceof RefusedCommand) storage.removeItem(key);
    throw error;
  }
  // A repeated launch opens its original run, including after a task restart.
  // Other explicit actions may be repeated after their acknowledged completion.
  if (path === "deliver") storage.setItem(key, JSON.stringify({ ...saved, result }));
  else storage.removeItem(key);
  return result;
}

export async function durableV2Command<T>(path: string, intent: string, body: Body, timeoutMs?: number): Promise<T> {
  const session = await transport().v2Session();
  if (!session.paired || !session.actor || !session.scope) throw new PmError("Reconnect Command Center", 401);
  if (!navigator.locks) throw new PmError("Command locking unavailable", 503);
  const scope = session.scope + ":" + session.actor;
  return navigator.locks.request("pm-intent:" + scope + ":" + intent, () => sendDurableIntent<T>({
    scope, intent, path, body, storage: localStorage, send: (target, payload) => transport().v2Command<T>(target, payload, timeoutMs),
  }));
}

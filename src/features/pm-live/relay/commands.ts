// src/features/pm-live/relay/commands.ts
// Durable phone command intents and receipt recovery (DLV-104).
//
//   - The command id exists before the first send and is the relay row id, so a
//     retry, a double tap or a reload re-sends the same command, never a second one.
//   - The intent is written to the device before sending, and settled only by a
//     receipt, so a reload or a lost connection resumes observing it.
//   - Receipt observation (realtime `notify`) is registered by the caller before
//     anything is sent; polling covers a missed event, and `resume` re-queries after
//     a reconnect or a timeout.
//   - Waiting longer than `waitMs` returns the receipt state as it stands. It never
//     means the command failed or stopped.
import { SETTLED_RECEIPT_STATES, receiptState } from "../../../../scripts/pm/relay-shared.mjs";

export interface CommandRow {
  id: string;
  status: string;
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface CommandClient {
  insert(row: { id: string; type: string; payload: Record<string, unknown> }): Promise<{ error: { code?: string; message: string } | null }>;
  status(id: string): Promise<{ row: CommandRow | null; error: { message: string } | null }>;
}

export interface SyncStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Intent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  /** unsent: the insert has not been confirmed. sent: the row exists. settled: a final receipt was seen. */
  phase: "unsent" | "sent" | "settled";
  row: CommandRow | null;
}

export type SendResult =
  | { settled: true; state: "done" | "refused" | "unknown" | "expired"; row: CommandRow }
  | { settled: false; state: "unsent" | "sent" | "acknowledged"; row: CommandRow | null };

const OUTBOX_LIMIT = 50;
export const outboxKey = (ownerId: string) => "pm-relay-outbox:" + ownerId;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createCommandTracker({
  client,
  storage,
  ownerId,
  pollMs = 2000,
  now = () => new Date().toISOString(),
}: {
  client: CommandClient;
  storage: SyncStorage | null;
  ownerId: string;
  pollMs?: number;
  now?: () => string;
}) {
  const intents = new Map<string, Intent>();
  const waiters = new Map<string, Set<(row: CommandRow) => void>>();
  let lastAck: { at: string | null; state: string | null } = { at: null, state: null };

  try {
    const stored = storage ? JSON.parse(storage.getItem(outboxKey(ownerId)) || "[]") : [];
    for (const intent of Array.isArray(stored) ? stored : []) if (intent && intent.id) intents.set(intent.id, intent);
  } catch {
    /* an unreadable outbox is dropped; the relay rows still hold every sent command */
  }

  const persist = () => {
    if (!storage) return;
    const kept = [...intents.values()].slice(-OUTBOX_LIMIT);
    try {
      storage.setItem(outboxKey(ownerId), JSON.stringify(kept));
    } catch {
      /* quota: the relay rows remain authoritative */
    }
  };

  function notify(row: CommandRow) {
    const intent = intents.get(row.id);
    const receipt = receiptState(row);
    if (intent) {
      intent.row = row;
      intent.phase = SETTLED_RECEIPT_STATES.includes(receipt.state) ? "settled" : "sent";
      persist();
    }
    if (receipt.state !== "sent") lastAck = { at: now(), state: receipt.state };
    for (const waiter of waiters.get(row.id) || []) waiter(row);
  }

  async function refresh(id: string) {
    const { row } = await client.status(id);
    if (row) notify(row);
    return row;
  }

  async function insert(intent: Intent) {
    const { error } = await client.insert({ id: intent.id, type: intent.type, payload: intent.payload });
    // 23505: this id is already a row — an earlier attempt landed. Same command.
    if (!error || error.code === "23505") {
      intent.phase = intent.phase === "settled" ? "settled" : "sent";
      persist();
      return { ok: true as const, error: null };
    }
    return { ok: false as const, error };
  }

  /**
   * Send (or re-send) one command and wait up to `waitMs` for a final receipt.
   * Resolves with the receipt state; rejects only when the relay refused the insert
   * itself (for example a type the database does not allow yet).
   */
  async function send(id: string, type: string, payload: Record<string, unknown>, waitMs = 15000): Promise<SendResult> {
    let intent = intents.get(id);
    if (intent && intent.phase === "settled" && intent.row) {
      const receipt = receiptState(intent.row);
      return { settled: true, state: receipt.state as "done", row: intent.row };
    }
    if (!intent) {
      intent = { id, type, payload, createdAt: now(), phase: "unsent", row: null };
      intents.set(id, intent);
      persist();
    }
    let resolveSettled: (row: CommandRow) => void = () => undefined;
    const settled = new Promise<CommandRow>((resolve) => {
      resolveSettled = (row) => {
        if (SETTLED_RECEIPT_STATES.includes(receiptState(row).state)) resolve(row);
      };
    });
    const set = waiters.get(id) || new Set();
    set.add(resolveSettled);
    waiters.set(id, set);
    try {
      if (intent.phase === "unsent") {
        const inserted = await insert(intent);
        if (!inserted.ok) {
          const offline = !inserted.error.code || /fetch|network|failed to|timeout/iu.test(inserted.error.message);
          if (offline) return { settled: false, state: "unsent", row: null };
          throw Object.assign(new Error(inserted.error.message), { code: inserted.error.code });
        }
      }
      const deadline = Date.now() + waitMs;
      let row = await refresh(id);
      while (!row || !SETTLED_RECEIPT_STATES.includes(receiptState(row).state)) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        const winner = await Promise.race([settled, sleep(Math.min(pollMs, remaining)).then(() => null)]);
        row = winner || (await refresh(id));
      }
      const receipt = receiptState(row);
      return row && SETTLED_RECEIPT_STATES.includes(receipt.state)
        ? { settled: true, state: receipt.state as "done", row }
        : { settled: false, state: (receipt.state === "unsent" ? "sent" : receipt.state) as "sent", row };
    } finally {
      set.delete(resolveSettled);
    }
  }

  /** After a reconnect, a reload or a timeout: land unsent intents and re-read every open receipt. */
  async function resume() {
    for (const intent of [...intents.values()]) {
      if (intent.phase === "settled") continue;
      if (intent.phase === "unsent") {
        const inserted = await insert(intent);
        if (!inserted.ok) continue;
      }
      await refresh(intent.id);
    }
  }

  return {
    send,
    notify,
    resume,
    refresh,
    lastAck: () => lastAck,
    intents: () => [...intents.values()],
    clear() {
      intents.clear();
      storage?.removeItem(outboxKey(ownerId));
    },
  };
}

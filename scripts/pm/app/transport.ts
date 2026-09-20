// The one seam between the Command Center views and wherever the work lives.
//
// Command Center Phase 4 (PM Tooling R63): the same React views run locally
// against the Node server and on the phone against the authenticated relay. The
// views never build a URL or assume a permission; they ask the transport, and they
// read `capabilities` to decide what to offer.
import type { RunSummary, Snapshot, V2Assessment, V2Catalogue, V2Queue, V2Allowances, V2TestGate, V2RunDetail, V2RunSummary, V2Session } from "./types";

export class PmError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** What a command's receipt says so far. None of these is a failure. */
export type ReceiptState = "unsent" | "sent" | "acknowledged" | "unknown" | "expired";

/**
 * A command whose outcome is not established yet. Thrown instead of an error so a
 * slow laptop, a lost reply or a timeout never reads as "failed" — and so a retry
 * reuses the same command id.
 */
export class PendingCommand extends Error {
  constructor(
    public command_id: string,
    public state: ReceiptState,
  ) {
    super(state === "unknown" ? "Outcome unknown" : state === "acknowledged" ? "Acknowledged" : state === "expired" ? "Expired" : "Not acknowledged");
  }
}

export interface TransportCapabilities {
  kind: "local" | "relay";
  /** Checklist writes: complete, move, ship, discard, restore. */
  planWrites: boolean;
  /** Inbox capture. */
  capture: boolean;
  v1Launch: boolean;
  v1Detail: boolean;
  v2: boolean;
  /** The local paired-browser flow; the relay authenticates through the account instead. */
  pairing: boolean;
  apply: boolean;
  /** Links into the classic reference UI served by the local server. */
  referenceTools: boolean;
}

export interface ConnectionState {
  /** This device can reach the transport. */
  online: boolean;
  /** The laptop bridge, judged by its heartbeat. `local` when the views run on the laptop. */
  bridge: { state: "local" | "online" | "stale" | "never"; seenAt: string | null };
  /** The latest command receipt this device observed. */
  lastAck: { at: string | null; state: string | null };
  /** Whether a V2 job could run, as the bridge last reported it while reachable. */
  worker: { state: string; detail: string | null };
  /** Data shown is a saved copy, not a live read. */
  stale: boolean;
  savedAt: string | null;
}

export type TransportEvent = { type: "data" } | { type: "delivery" } | { type: "ui" } | { type: "connection" };

export interface Transport {
  capabilities: TransportCapabilities;
  /** Begin live updates; returns the stop function. */
  start(): () => void;
  subscribe(listener: (event: TransportEvent) => void): () => void;
  connection(): ConnectionState;
  snapshot(signal?: AbortSignal): Promise<Snapshot>;
  v1Runs(signal?: AbortSignal): Promise<{ sessions: RunSummary[] }>;
  dispatchMode(signal?: AbortSignal): Promise<{ mode: string }>;
  /** Checklist and Inbox writes. */
  mutate<T>(op: string, body: unknown): Promise<T>;
  /** V1 delivery reads that exist only on the local server. */
  read<T>(path: string, signal?: AbortSignal): Promise<T>;
  /** V1 delivery commands that exist only on the local server. */
  post<T>(path: string, body: unknown, timeoutMs?: number): Promise<T>;
  v2Session(signal?: AbortSignal): Promise<V2Session>;
  v2Pair(code: string): Promise<V2Session>;
  v2Runs(signal?: AbortSignal): Promise<{ runs: V2RunSummary[] }>;
  v2Run(id: string, signal?: AbortSignal): Promise<V2RunDetail>;
  v2Executors(signal?: AbortSignal): Promise<V2Catalogue>;
  /** Slots, waiting items with their verdicts, decisions and pairwise verdicts. Null before any V2 record exists. */
  v2Queue(signal?: AbortSignal): Promise<V2Queue | null>;
  /** Owner allowance settings; null where this transport cannot read them. */
  v2Allowances(signal?: AbortSignal): Promise<V2Allowances | null>;
  /** Owner test gate; null where this transport cannot read it. */
  v2TestGate(signal?: AbortSignal): Promise<V2TestGate | null>;
  /** An item's verdict before launch; null where this transport cannot evaluate one. */
  v2Assess(file: string, id: string, signal?: AbortSignal): Promise<V2Assessment | null>;
  /** One V2 command. `body.command_id` is minted before the first send and reused on retry. */
  v2Command<T>(path: string, body: Record<string, unknown>, timeoutMs?: number): Promise<T>;
  /** Where a V1 session is read when this transport cannot show it. */
  v1SessionHref(sessionId: string): string | null;
}

let active: Transport | null = null;

export function setTransport(next: Transport) {
  active = next;
}

export function transport(): Transport {
  if (!active) throw new Error("Command Center transport is not set");
  return active;
}

export const useTransport = transport;

export const deskOnly = () => new PmError("Desk only", 501);

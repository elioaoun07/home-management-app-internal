// Local transport: the views served by `pnpm pm`, talking to the Node server on
// this machine. Same requests the app always made, now behind the transport seam.
import { RequestTimeoutError, safeFetch } from "@/lib/safeFetch";
import { isReallyOnline, startProbing } from "@/lib/connectivityManager";
import { PendingCommand, PmError, type ConnectionState, type Transport, type TransportEvent } from "./transport";
import type { Snapshot, V2Assessment, V2Queue, V2Session } from "./types";

function refusalText(payload: Record<string, unknown>, status: number) {
  const first = Array.isArray(payload.refusals) ? (payload.refusals[0] as Record<string, unknown> | undefined) : undefined;
  const detail = payload.detail ?? first?.detail;
  const code = payload.error ?? first?.code;
  if (typeof detail === "string" && detail) return detail;
  if (typeof code === "string" && code) return code.replace(/-/gu, " ");
  return `Request failed (${status})`;
}

const firstRefusal = (payload: Record<string, unknown>) =>
  Array.isArray(payload.refusals) ? String((payload.refusals[0] as Record<string, unknown> | undefined)?.code ?? "") : String(payload.error ?? "");

export function createLocalTransport(): Transport {
  // Every V2 read and command carries the session cookie (HttpOnly, set by the
  // server) and the CSRF token the server derives from it.
  let csrf: string | null = null;
  const listeners = new Set<(event: TransportEvent) => void>();
  const emit = (event: TransportEvent) => listeners.forEach((listener) => listener(event));
  let lastAck: ConnectionState["lastAck"] = { at: null, state: null };

  async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(path, { headers: { Accept: "application/json" }, signal });
    const payload = await response.json();
    if (!response.ok) throw new PmError(payload.error || `Request failed (${response.status})`, response.status);
    return payload;
  }

  async function post<T>(path: string, body: unknown, timeoutMs = 60000): Promise<T> {
    const response = await safeFetch(`/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      timeoutMs,
    });
    const payload = await response.json();
    if (!response.ok) throw new PmError(payload.error || payload.refusals?.[0]?.detail || `Request failed (${response.status})`, response.status);
    return payload;
  }

  async function v2Session(signal?: AbortSignal): Promise<V2Session> {
    const session = await read<V2Session>("/api/delivery/v2/session", signal);
    csrf = session.csrf;
    return session;
  }

  async function v2Read<T>(path: string, signal?: AbortSignal): Promise<T> {
    if (!csrf) await v2Session(signal);
    const response = await fetch(path, { headers: { Accept: "application/json", ...(csrf ? { "x-era-csrf": csrf } : {}) }, credentials: "same-origin", signal });
    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) csrf = null;
      throw new PmError(refusalText(payload, response.status), response.status);
    }
    return payload;
  }

  return {
    capabilities: { kind: "local", planWrites: true, capture: true, v1Launch: true, v1Detail: true, v2: true, pairing: true, apply: true, referenceTools: true },

    start() {
      startProbing();
      const connectivity = () => emit({ type: "connection" });
      window.addEventListener("connectivity-changed", connectivity);
      const source = new EventSource("/api/events");
      source.onmessage = () => emit({ type: "data" });
      source.addEventListener("delivery", () => emit({ type: "delivery" }));
      source.addEventListener("ui", () => emit({ type: "ui" }));
      return () => {
        source.close();
        window.removeEventListener("connectivity-changed", connectivity);
      };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    connection() {
      return { online: isReallyOnline(), bridge: { state: "local", seenAt: null }, lastAck, worker: { state: "local", detail: null }, stale: false, savedAt: null };
    },

    async snapshot(signal?: AbortSignal): Promise<Snapshot> {
      const response = await fetch("/api/data", { headers: { Accept: "application/json" }, signal });
      if (!response.ok) throw new PmError("Project unavailable", response.status);
      const data = await response.json();
      if (!Array.isArray(data.files)) throw new PmError("Project response is incomplete", 502);
      return { ...data, offline: response.headers.get("x-pm-offline") === "1", cachedAt: response.headers.get("x-pm-cached-at") };
    },

    v1Runs: (signal) => read("/api/delivery/sessions", signal),
    dispatchMode: (signal) => read("/api/delivery/v2/mode", signal),
    mutate: (op, body) => post(op, body),
    read,
    post: (path, body, timeoutMs) => post(path, body, timeoutMs),
    v2Session,

    async v2Pair(code: string): Promise<V2Session> {
      const response = await safeFetch("/api/delivery/v2/session/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code }),
        timeoutMs: 15000,
      });
      const payload = await response.json();
      if (!response.ok) throw new PmError(refusalText(payload, response.status), response.status);
      csrf = payload.csrf;
      return payload;
    },

    v2Runs: (signal) => v2Read("/api/delivery/v2/runs", signal),
    v2Run: (id, signal) => v2Read("/api/delivery/v2/run?id=" + encodeURIComponent(id), signal),
    v2Executors: (signal) => read("/api/delivery/v2/executors", signal),
    v2Queue: async (signal) => (await v2Read<{ queue: V2Queue | null }>("/api/delivery/v2/queue", signal)).queue,
    v2Assess: (file, id, signal) =>
      v2Read<V2Assessment>("/api/delivery/v2/assess?file=" + encodeURIComponent(file) + "&id=" + encodeURIComponent(id), signal),

    async v2Command<T>(path: string, body: Record<string, unknown>, timeoutMs = 60000): Promise<T> {
      if (!csrf) await v2Session();
      const command_id = String(body.command_id || "");
      let response: Response;
      try {
        response = await safeFetch(`/api/delivery/v2/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrf ? { "x-era-csrf": csrf } : {}) },
          credentials: "same-origin",
          body: JSON.stringify(body),
          timeoutMs,
        });
      } catch (error) {
        // A timeout is latency: the server may still be running this command.
        if (error instanceof RequestTimeoutError && command_id) throw new PendingCommand(command_id, "acknowledged");
        throw error;
      }
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) csrf = null;
        // The same id is still running on the server: not a failure.
        if (firstRefusal(payload) === "command-without-recorded-outcome" && command_id) throw new PendingCommand(command_id, "acknowledged");
        lastAck = { at: new Date().toISOString(), state: "refused" };
        throw new PmError(refusalText(payload, response.status), response.status);
      }
      lastAck = { at: new Date().toISOString(), state: "done" };
      return payload;
    },

    v1SessionHref: (sessionId) => `#/delivery/session/${encodeURIComponent(sessionId)}`,
  };
}

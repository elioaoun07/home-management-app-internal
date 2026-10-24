// scripts/delivery-v2/steward-tools.mjs
// ERA Steward's whole tool surface: four typed operations over Command Center's
// existing authenticated transport. No model, shell, Docker or checker is reachable
// from here; every operation is a deterministic read or the one durable Start.
//
//   start-delivery    persist the intent, then POST /deliver with its UUID
//   read-request      GET /command  (the original receipt; never a new Start)
//   read-run          GET /run + /accounting
//   wait-for-changes  bounded polling of the reads above, no model in the loop
//
// What is deliberately not here: approving a plan, Apply, readiness renewal,
// reconcile/retry, support authorization. Those are owner actions; the server
// refuses them for the Steward credential even if this file were bypassed.
//
// Failure shape: one blocker, then stop. A stale connection returns the last
// confirmed result and says it is stale; it never starts, repairs or retries.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { parseWorkItems } from "./work-ref.mjs";
import { CSRF_HEADER, SESSION_COOKIE } from "./local-auth.mjs";
import { STEWARD_OPERATIONS, classifyStewardOperation } from "./steward-surface.mjs";

export const STEWARD_DIR_REL = ".delivery/v2/steward";
export const DEFAULT_BASE_URL = "http://127.0.0.1:4317";
const START_TIMEOUT_MS = 150_000; // Start collects its own readiness (about 1-2 minutes).
const READ_TIMEOUT_MS = 8_000;
const MAX_WAIT_SECONDS = 60;

const ITEM_ID = /^[A-Za-z0-9][A-Za-z0-9.-]{0,40}$/u;
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;
const PLAIN = z.string().min(1).max(64).regex(/^[A-Za-z0-9._:-]+$/u);

export const STEWARD_SCHEMAS = Object.freeze({
  "start-delivery": z.object({
    id: z.string().regex(ITEM_ID),
    executor: PLAIN.optional(),
    model: PLAIN.optional(),
    effort: PLAIN.optional(),
    workProfile: PLAIN.optional(),
  }).strict(),
  "read-request": z.object({ request_id: z.string().uuid() }).strict(),
  "read-run": z.object({ run_id: z.string().regex(RUN_ID) }).strict(),
  "wait-for-changes": z.object({
    run_id: z.string().regex(RUN_ID).optional(),
    request_id: z.string().uuid().optional(),
    since: z.string().max(64).optional(),
    timeout_seconds: z.number().int().min(1).max(MAX_WAIT_SECONDS).optional(),
  }).strict().refine((value) => !!value.run_id !== !!value.request_id, { message: "give exactly one of run_id, request_id" }),
});

/** JSON Schema for the MCP tool list; derived by hand so the two cannot drift silently (a test pins them). */
export const STEWARD_TOOL_DEFINITIONS = Object.freeze([
  { name: "start-delivery", description: "Press Start once for a checklist item. Returns the run link, or the one blocker. Never starts twice for the same item.",
    inputSchema: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string" }, executor: { type: "string" }, model: { type: "string" }, effort: { type: "string" }, workProfile: { type: "string" } } } },
  { name: "read-request", description: "Read the original Start receipt. Read-only; never sends Start.",
    inputSchema: { type: "object", additionalProperties: false, required: ["request_id"], properties: { request_id: { type: "string" } } } },
  { name: "read-run", description: "Read a run's state, checks and Delivery/Support/Chat usage. Read-only.",
    inputSchema: { type: "object", additionalProperties: false, required: ["run_id"], properties: { run_id: { type: "string" } } } },
  { name: "wait-for-changes", description: "Wait up to 60 s for a run or request to change. Read-only; returns the last confirmed state if the connection is stale.",
    inputSchema: { type: "object", additionalProperties: false, properties: { run_id: { type: "string" }, request_id: { type: "string" }, since: { type: "string" }, timeout_seconds: { type: "integer", minimum: 1, maximum: MAX_WAIT_SECONDS } } } },
]);

const short = (id) => String(id || "").slice(0, 8);
const atomicWrite = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  const temp = path + "." + process.pid + ".tmp";
  writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  renameSync(temp, path);
};
const readJson = (path) => {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Status templates: IDs and evidence timestamps, no prose a model has to write.
// ---------------------------------------------------------------------------

export function renderRequest(request) {
  if (!request) return "request unknown";
  const parts = [
    String(request.workId || "?"),
    "request " + short(request.command_id),
    String(request.status || "pending") + (request.stage && request.stage !== request.status ? " (" + request.stage + ")" : ""),
    "confirmed " + String(request.lastConfirmedAt || "never"),
  ];
  if (request.run_id) parts.push("run " + request.run_id);
  if (request.blocker) parts.push("blocked: " + String(request.blocker.code || "unknown"));
  return parts.join(" · ");
}

export function renderAccounting(report) {
  if (!report) return "usage: not available";
  const known = (value) => (value == null ? "unknown" : "$" + Number(value).toFixed(4));
  const d = report.delivery;
  const s = report.support;
  const c = report.chat;
  return [
    "Delivery " + d.tokens.total + " tok · cost " + known(d.costUsd) + " · known " + d.coverage.known + "/" + d.coverage.total,
    "Support " + (s.coverage.known === 0 && s.coverage.total > 0 ? "unknown" : s.tokens.total) + " tok · cost " + known(s.costUsd) + (s.costUsd != null && !s.costComplete ? " known; remainder unknown" : "") + (s.costBasis === "estimate" ? " (estimate)" : "") + " · known " + s.coverage.known + "/" + s.coverage.total,
    "Chat " + (c.status === "not-measured" ? "not measured" : (c.tokens ?? "unknown") + " tok (owner-entered)"),
  ].join(" | ");
}

export function renderRun(detail, report, base) {
  if (!detail || !detail.run) return "run unknown";
  const run = detail.run;
  const jobs = detail.jobs || [];
  const phase = run.lifecycle === "CLOSED" ? "CLOSED/" + String(run.closed_outcome || "?") : String(run.lifecycle) + (run.waiting_reason ? " (" + run.waiting_reason + ")" : "");
  const parts = [
    "run " + run.run_id,
    phase,
    "owner next: " + String(typeof detail.ownerAction === "object" ? detail.ownerAction?.label || "none" : detail.ownerAction || "none"),
    "jobs " + jobs.length + (jobs.some((job) => job.status === "unknown") ? " (unknown outcome)" : ""),
  ];
  if (detail.result) parts.push("candidate " + (detail.result.candidateVerified ? "verified" : "not verified"));
  const states = (detail.result?.criterion_states || []).map((entry) => entry.criterion_id + ":" + entry.state);
  if (states.length) parts.push("checks " + states.join(","));
  parts.push(base + "/#/delivery/run/" + run.run_id);
  return parts.join(" · ") + (report ? "\n" + renderAccounting(report) : "");
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

/**
 * @param {{root:string, baseUrl?:string, fetchImpl?:typeof fetch, sleep?:(ms:number)=>Promise<void>,
 *   nowMs?:()=>number, now?:()=>string, uuid?:()=>string, kind?:string, sessionFile?:string}} options
 */
export function createStewardClient({ root, baseUrl = DEFAULT_BASE_URL, fetchImpl = globalThis.fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), nowMs = () => Date.now(), now = () => new Date().toISOString(), uuid = randomUUID, kind = "steward", sessionFile = "session.json" }) {
  const base = String(baseUrl).replace(/\/+$/u, "");
  const dir = join(root, ...STEWARD_DIR_REL.split("/"));
  const sessionPath = join(dir, sessionFile);
  const intentPath = (id) => join(dir, "intents", "deliver-" + String(id).toLowerCase() + ".json");
  const lastKnownPath = (key) => join(dir, "last-known", key.replace(/[^A-Za-z0-9_.-]/gu, "_") + ".json");
  let csrf = null;

  async function send(method, path, { query, body, timeoutMs = READ_TIMEOUT_MS, cookie = null, headers = {} } = {}) {
    const url = base + path + (query ? "?" + new URLSearchParams(query).toString() : "");
    const response = await fetchImpl(url, {
      method,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...headers, ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    return { status: response.status, json, response };
  }

  const session = () => readJson(sessionPath);

  /** Exchange an owner-issued pairing code for the restricted Steward credential. */
  async function pair(code) {
    const { status, json, response } = await send("POST", "/api/delivery/v2/session/pair", { body: { code: String(code || ""), kind } });
    const setCookie = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie().join(";") : String(response.headers.get("set-cookie") || "");
    const token = setCookie.match(new RegExp(SESSION_COOKIE + "=([^;\\s]+)"))?.[1];
    if (status !== 200 || !token) return { ok: false, code: json?.error || "pairing-failed", message: "Pairing failed. Ask the owner for a fresh code." };
    atomicWrite(sessionPath, { base, token, paired_at: now() });
    csrf = null;
    return { ok: true, message: kind === "steward" ? "Paired as ERA Steward (restricted)." : "Paired as owner." };
  }

  /** Authenticated call: cookie + the CSRF token the server derives for this session. */
  async function authed(method, path, options = {}) {
    const stored = session();
    if (!stored?.token) return { status: 401, json: { error: "local-session-required" }, response: null };
    const cookie = SESSION_COOKIE + "=" + stored.token;
    if (!csrf) {
      const view = await send("GET", "/api/delivery/v2/session", { cookie });
      csrf = view.json?.csrf || null;
      if (!csrf) return { status: 401, json: { error: "local-session-required" }, response: null };
    }
    return send(method, path, { ...options, cookie, headers: { [CSRF_HEADER]: csrf } });
  }

  const pairingRequired = () => ({ ok: false, status: "pairing-required", message: "Not paired. Tell the owner and stop." });

  /** Find the one checklist row for an item ID, the way the Delivery launch screen does. */
  async function resolveWork(id) {
    const { status, json } = await send("GET", "/api/data");
    if (status !== 200 || !Array.isArray(json?.files)) return { ok: false, status: "data-unavailable", message: "Command Center data is unavailable. Stop." };
    const wanted = String(id).toUpperCase();
    const hits = [];
    for (const file of json.files) {
      if (!/(^|\/)4 - Checklist\.md$/u.test(String(file.relPath))) continue;
      const lines = String(file.raw).split("\n");
      for (const item of parseWorkItems(String(file.raw))) {
        if (item.alias === wanted) hits.push({ file: String(file.relPath), cbidx: item.cbidx, rawLine: lines[item.line] ?? "", alias: item.alias });
      }
    }
    if (hits.length !== 1) return { ok: false, status: hits.length ? "ambiguous-item" : "unknown-item", message: hits.length ? "Item " + wanted + " matches " + hits.length + " rows. Stop." : "Item " + wanted + " was not found. Stop." };
    return { ok: true, work: hits[0] };
  }

  /**
   * The launch screen's own rule: when the policy permits exactly one executor,
   * that is the choice, with the lane's suggested model and effort. Anything the
   * caller names is passed through; the server still validates all of it.
   */
  async function chooseExecutor(args) {
    const workProfile = args.workProfile || "focused";
    if (args.executor) return { ok: true, executor: args.executor, model: args.model ?? null, effort: args.effort ?? null, workProfile };
    const { status, json } = await send("GET", "/api/delivery/v2/executors");
    const allowed = status === 200 ? (json?.executors || []).filter((entry) => entry.available !== false && entry.permitted) : [];
    if (allowed.length !== 1) {
      return { ok: false, status: "executor-required", message: allowed.length ? "More than one executor is permitted. Ask the owner which one. Stop." : "No executor is available. Tell the owner and stop." };
    }
    const suggestion = allowed[0].suggestions?.[workProfile];
    return { ok: true, executor: allowed[0].id, model: args.model ?? suggestion?.model ?? null, effort: args.effort ?? suggestion?.effort ?? null, workProfile };
  }

  const classifyStart = (status, json) => {
    if (status === 200 && json?.ok !== false && json?.run_id) return "started";
    if (status === 503 || json?.error === "steward-outcome-unconfirmed") return "uncertain";
    if (json?.refusals?.[0]?.code === "command-without-recorded-outcome") return "pending";
    if (json?.error === "steward-request-conflict" || json?.error === "launch-request-conflict") return "conflict";
    if (status === 401 || status === 403) return "pairing-required";
    return "blocked";
  };

  const startResult = (state, intent, json) => {
    const run_id = json?.run_id || intent.run_id || null;
    const blocker = state === "blocked" ? (json?.readiness?.blockers?.[0]?.code || json?.refusals?.[0]?.code || json?.error || "start-refused") : null;
    return {
      ok: state === "started",
      status: state,
      request_id: intent.command_id,
      run_id,
      link: run_id ? base + "/#/delivery/run/" + run_id : null,
      blocker,
      detail: state === "blocked" ? (json?.detail || json?.readiness?.blockers?.[0]?.detail || null) : null,
      message: state === "started" ? "Started. Run " + run_id + ". Reply with the link and stop."
        : state === "blocked" ? "Start blocked: " + blocker + ". Request " + intent.command_id + ". Tell the owner and stop."
          : state === "conflict" ? "Another request is already open for this item: " + (json?.command_id || "unknown") + ". Read it; do not start again."
            : "Outcome not confirmed for request " + intent.command_id + ". Use read-request; do not start again.",
    };
  };

  async function startDelivery(args) {
    if (!session()?.token) return pairingRequired();
    const id = String(args.id).toUpperCase();
    const existing = readJson(intentPath(id));

    if (existing && ["pending", "uncertain", "started"].includes(existing.state)) {
      // The same receipt, always. A repeated call reads it; it never mints another UUID.
      const status = await authed("GET", "/api/delivery/v2/command", { query: { id: existing.command_id } }).catch(() => null);
      if (status && status.status === 200) {
        const outcome = status.json?.outcome || null;
        if (outcome) {
          const state = outcome.ok === false ? "blocked" : "started";
          atomicWrite(intentPath(id), { ...existing, state: state === "blocked" ? "refused" : "started", run_id: outcome.run_id || existing.run_id || null, refused_at: state === "blocked" ? now() : null });
          return startResult(state, existing, outcome);
        }
        return startResult("pending", existing, status.json);
      } else if (status && status.status === 404 && existing.state !== "started") {
        // Persisted but never reached the server: the same UUID is safe to send once more.
        return postStart(existing);
      } else {
        return startResult("uncertain", existing, null);
      }
    }
    if (existing?.state === "refused") {
      return { ok: false, status: "blocked", request_id: existing.command_id, run_id: null, link: null, blocker: "already-refused",
        message: "Start was refused earlier (request " + existing.command_id + "). The owner must start any new attempt through Command Center." };
    }

    const found = await resolveWork(id);
    if (!found.ok) return { ok: false, status: found.status, message: found.message };
    const selection = await chooseExecutor(args);
    if (!selection.ok) return { ok: false, status: selection.status, message: selection.message };
    const payload = {
      initiatedBy: "era-steward",
      command_id: uuid(),
      file: found.work.file,
      cbidx: found.work.cbidx,
      expectLine: found.work.rawLine,
      expectId: id,
      executor: selection.executor,
      model: selection.model,
      effort: selection.effort,
      workProfile: selection.workProfile,
    };
    const intent = { id, state: "pending", command_id: payload.command_id, payload, created_at: now(), run_id: null, refused_at: null };
    atomicWrite(intentPath(id), intent); // persisted BEFORE the request leaves
    return postStart(intent);
  }

  async function postStart(intent) {
    let reply;
    try {
      reply = await authed("POST", "/api/delivery/v2/deliver", { body: intent.payload, timeoutMs: START_TIMEOUT_MS });
    } catch {
      atomicWrite(intentPath(intent.id), { ...intent, state: "uncertain" });
      return startResult("uncertain", intent, null);
    }
    const state = classifyStart(reply.status, reply.json);
    if (state === "pairing-required") {
      atomicWrite(intentPath(intent.id), { ...intent, state: "refused", refused_at: now() });
      return pairingRequired();
    }
    const next = state === "started" ? "started" : state === "blocked" ? "refused" : state === "conflict" ? "refused" : "uncertain";
    atomicWrite(intentPath(intent.id), { ...intent, state: next, run_id: reply.json?.run_id || null, refused_at: next === "refused" ? now() : null });
    return startResult(state, intent, reply.json);
  }

  async function readRequest({ request_id }) {
    if (!session()?.token) return pairingRequired();
    try {
      const reply = await authed("GET", "/api/delivery/v2/command", { query: { id: request_id } });
      if (reply.status === 404) return { ok: false, status: "unknown-request", message: "Request " + request_id + " is not known to this Command Center." };
      if (reply.status !== 200) return { ok: false, status: "unavailable", message: "Status unavailable (" + reply.status + ")." };
      const request = reply.json.request;
      const data = { ok: true, status: request.status, request, outcome_recorded: !!reply.json.recorded, run_id: request.run_id || null,
        link: request.run_id ? base + "/#/delivery/run/" + request.run_id : null, message: renderRequest(request) };
      atomicWrite(lastKnownPath("request-" + request_id), { at: now(), signature: signatureOf(data), data });
      return data;
    } catch {
      return staleResult("request-" + request_id);
    }
  }

  async function readRun({ run_id }) {
    if (!session()?.token) return pairingRequired();
    try {
      const [detail, accounting] = await Promise.all([
        authed("GET", "/api/delivery/v2/run", { query: { id: run_id } }),
        authed("GET", "/api/delivery/v2/accounting", { query: { run: run_id } }),
      ]);
      if (detail.status === 404) return { ok: false, status: "unknown-run", message: "Run " + run_id + " is not known to this Command Center." };
      if (detail.status !== 200) return { ok: false, status: "unavailable", message: "Status unavailable (" + detail.status + ")." };
      const report = accounting.status === 200 ? accounting.json.report : null;
      const data = { ok: true, status: detail.json.run.lifecycle, run: detail.json.run, ownerAction: detail.json.ownerAction || null, accounting: report,
        link: base + "/#/delivery/run/" + run_id, message: renderRun(detail.json, report, base) };
      atomicWrite(lastKnownPath("run-" + run_id), { at: now(), signature: signatureOf(data), data });
      return data;
    } catch {
      return staleResult("run-" + run_id);
    }
  }

  const signatureOf = (data) => JSON.stringify([data.status, data.run?.waiting_reason ?? data.request?.stage ?? null, data.run?.closed_outcome ?? null, data.ownerAction ?? null, data.request?.lastConfirmedAt ?? null, data.request?.jobUpdatedAt ?? null, data.run_id ?? null, data.accounting?.delivery?.tokens?.total ?? null]).replace(/[^A-Za-z0-9]/gu, "").slice(0, 64);

  /** The last confirmed result, labelled stale. Never a Start, never a repair. */
  function staleResult(key) {
    const known = readJson(lastKnownPath(key));
    return known
      ? { ...known.data, ok: true, stale: true, last_confirmed_at: known.at, message: "Connection stale since " + known.at + ". Last known: " + known.data.message }
      : { ok: false, status: "stale", stale: true, message: "Command Center is unreachable and nothing was confirmed yet. Tell the owner and stop." };
  }

  /** @param {{run_id?:string, request_id?:string, since?:string, timeout_seconds?:number}} args */
  async function waitForChanges({ run_id, request_id, since, timeout_seconds = 30 }) {
    const read = () => (run_id ? readRun({ run_id }) : readRequest({ request_id }));
    const deadline = nowMs() + Math.min(timeout_seconds, MAX_WAIT_SECONDS) * 1000;
    let latest = await read();
    for (;;) {
      if (latest.status === "pairing-required" || latest.stale || latest.ok === false) return { ...latest, changed: false, token: since || null };
      const token = signatureOf(latest);
      if (since == null || token !== since) return { ...latest, changed: since != null, token };
      if (nowMs() >= deadline) return { ...latest, changed: false, token };
      await sleep(Math.min(3000, Math.max(0, deadline - nowMs())));
      latest = await read();
    }
  }

  return { pair, request: authed, startDelivery, readRequest, readRun, waitForChanges, base };
}

/**
 * The one entry the tool server calls. Anything that is not one of the four
 * operations is refused here with the category of reach it asked for.
 */
export async function handleStewardOperation(client, name, args = {}) {
  const verdict = classifyStewardOperation(name);
  if (!verdict.ok) return { ok: false, status: "refused", refusal: { code: verdict.code, detail: verdict.detail }, message: "Refused: " + verdict.code + ". " + verdict.detail };
  const parsed = STEWARD_SCHEMAS[name].safeParse(args);
  if (!parsed.success) return { ok: false, status: "invalid-arguments", message: "Invalid arguments: " + parsed.error.issues.map((issue) => issue.path.join(".") + " " + issue.message).join("; ") };
  const input = parsed.data;
  switch (name) {
    case "start-delivery": return client.startDelivery(input);
    case "read-request": return client.readRequest(input);
    case "read-run": return client.readRun(input);
    case "wait-for-changes": return client.waitForChanges(input);
    default: return { ok: false, status: "refused", message: "Refused: unknown-operation." };
  }
}

export { STEWARD_OPERATIONS };

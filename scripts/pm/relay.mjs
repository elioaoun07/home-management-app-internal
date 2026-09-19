// scripts/pm/relay.mjs
// Command Center Phase 4 — the laptop half of the phone relay (DLV-104, R63).
//
// Pure, Supabase-free cores the bridge wires together. Each one exists because a
// source-level finding in the Command Center plan named a gap:
//
//   installation     rows and commands are bound to one installation, so two laptops
//                    of the same owner never answer each other's commands.
//   corpus           the phone gets the same Markdown the local app reads, as one
//                    document row per file plus a manifest, and only changed files
//                    are re-sent.
//   secret guard     nothing that contains a host, provider or release secret value
//                    is ever published.
//   command journal  a durable record, on the laptop, of claim → started → effected
//                    → reported for each phone command. A bridge that dies between
//                    the effect and its receipt recovers the same command after a
//                    restart; it never runs it again.
//   V2 commands      phone commands reach the local V2 routes through the paired
//                    bridge credential, with the remote actor derived from the
//                    authenticated Supabase identity of the row.
//   attention        pushes deduplicated by decision or result revision, remembered
//                    across restarts.

import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { RELAY_SCHEMA, ROW_KINDS, V2_COMMAND_TYPES, isInstallationId, rowId } from "./relay-shared.mjs";

export const RELAY_DIR = ".delivery/pm-relay";
const sha = (text) => "sha256:" + createHash("sha256").update(String(text), "utf8").digest("hex");

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = path + ".tmp-" + randomBytes(4).toString("hex");
  writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  renameSync(temp, path);
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Installation
// ---------------------------------------------------------------------------

/** This checkout's relay identity, created once. */
export function readInstallation({ root, random = randomBytes, now = () => new Date().toISOString() }) {
  const path = join(root, ...RELAY_DIR.split("/"), "installation.json");
  const existing = readJson(path);
  if (existing && isInstallationId(existing.installation_id)) return existing;
  const record = { schema: RELAY_SCHEMA, installation_id: "inst-" + random(6).toString("hex"), created_at: now() };
  writeJsonAtomic(path, record);
  return record;
}

// ---------------------------------------------------------------------------
// Secret guard
// ---------------------------------------------------------------------------

/** Environment variables whose values must never reach a phone payload. */
export const SECRET_ENV_KEYS = Object.freeze([
  "NEXT_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "VERCEL_TOKEN",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "NPM_TOKEN",
  "AZURE_SPEECH_KEY",
  "VAPID_PRIVATE_KEY",
  "AWS_SECRET_ACCESS_KEY",
]);

const SECRET_SHAPES = Object.freeze([
  { name: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u },
  { name: "anthropic-key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/u },
  { name: "openai-key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/u },
  { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}/u },
]);

/**
 * Names (never values) of the secrets a serialized payload would disclose.
 *
 * Values of the listed environment variables are matched exactly, plus a few
 * unambiguous credential shapes and any JWT whose payload claims the service role.
 *
 * @param {string} text
 * @param {Record<string, string|undefined>} env
 * @param {string[]} [extraSecrets] in-memory credentials such as the bridge token
 */
export function findSecrets(text, env = process.env, extraSecrets = []) {
  const hits = [];
  const body = String(text || "");
  for (const key of SECRET_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.length >= 12 && body.includes(value)) hits.push("env:" + key);
  }
  extraSecrets.forEach((value, index) => {
    if (typeof value === "string" && value.length >= 12 && body.includes(value)) hits.push("credential:" + index);
  });
  for (const shape of SECRET_SHAPES) if (shape.pattern.test(body)) hits.push("shape:" + shape.name);
  for (const match of body.matchAll(/\beyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/gu)) {
    try {
      const claims = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
      if (claims && claims.role === "service_role") hits.push("shape:service-role-jwt");
    } catch {
      /* not a JWT */
    }
  }
  return [...new Set(hits)];
}

// ---------------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------------

/**
 * Document rows and a manifest for the Markdown corpus the local app reads.
 *
 * @param {{data:{generatedAt:string, cancelledLog?:string, files:{relPath:string, raw:string, mtimeMs?:number}[]},
 *   installation_id:string, previous?:Map<string, string>}} input  previous: relPath → sha last published
 */
export function buildCorpusRows({ data, installation_id, previous = new Map() }) {
  const files = [];
  const upserts = [];
  for (const file of data.files) {
    const digest = sha(file.raw);
    const id = rowId(installation_id, ROW_KINDS.DOC, file.relPath);
    files.push({ relPath: file.relPath, sha: digest, bytes: Buffer.byteLength(file.raw), mtimeMs: file.mtimeMs ?? 0 });
    if (previous.get(file.relPath) !== digest) {
      upserts.push({ id, kind: "cc-" + ROW_KINDS.DOC, payload: { schema: RELAY_SCHEMA, relPath: file.relPath, raw: file.raw, mtimeMs: file.mtimeMs ?? 0, sha: digest } });
    }
  }
  const present = new Set(data.files.map((file) => file.relPath));
  const deletes = [...previous.keys()].filter((relPath) => !present.has(relPath)).map((relPath) => rowId(installation_id, ROW_KINDS.DOC, relPath));
  const manifest = {
    schema: RELAY_SCHEMA,
    installation_id,
    generatedAt: data.generatedAt,
    files,
    cancelledLog: data.cancelledLog || "",
  };
  return {
    manifest: { id: rowId(installation_id, ROW_KINDS.MANIFEST), kind: "cc-" + ROW_KINDS.MANIFEST, payload: manifest },
    upserts,
    deletes,
    shas: new Map(files.map((entry) => [entry.relPath, entry.sha])),
  };
}

/** Stable digest of a payload, so an unchanged row is not re-sent. */
export function payloadDigest(payload) {
  return sha(JSON.stringify(payload ?? null));
}

/**
 * Keep a V2 run detail row small enough to arrive. Drops the least useful parts
 * first and names what it dropped.
 */
export function capRunDetail(detail, maxBytes = 180_000) {
  const size = (value) => Buffer.byteLength(JSON.stringify(value));
  if (size(detail) <= maxBytes) return detail;
  const next = { ...detail, truncated: [] };
  const steps = [
    ["events", () => (next.events = (next.events || []).slice(-15))],
    ["activity", () => (next.activity = (next.activity || []).slice(-15))],
    ["messages", () => (next.messages = (next.messages || []).slice(-6))],
    ["plan text", () => (next.plans = (next.plans || []).map((plan) => ({ ...plan, raw_text: null })))],
    ["older plans", () => (next.plans = (next.plans || []).slice(-2))],
    ["application paths", () => (next.applications = (next.applications || []).map((entry) => ({ ...entry, ops: entry.ops.slice(0, 40), unrelatedDrift: entry.unrelatedDrift.slice(0, 20) })))],
  ];
  for (const [name, apply] of steps) {
    apply();
    next.truncated.push(name);
    if (size(next) <= maxBytes) break;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Durable command journal
// ---------------------------------------------------------------------------

/**
 * The laptop's own record of each phone command it claimed.
 *
 * Append-only NDJSON, flushed per line. The phases are the recovery argument:
 * `claimed` (this installation owns it) → `started` (the effect may have begun) →
 * `effected` (outcome known locally) → `reported` (receipt written to the relay).
 *
 * @param {{dir:string}} input
 */
export function createCommandJournal({ dir }) {
  const path = join(dir, "commands.ndjson");
  let cache = null;

  function load() {
    if (cache) return cache;
    cache = new Map();
    if (!existsSync(path)) return cache;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const current = cache.get(entry.id) || { id: entry.id, type: entry.type ?? null, phases: [], outcome: null };
        current.phases.push(entry.phase);
        if (entry.type) current.type = entry.type;
        if (entry.outcome !== undefined) current.outcome = entry.outcome;
        cache.set(entry.id, current);
      } catch {
        /* a torn final line from a crash is ignored */
      }
    }
    return cache;
  }

  return {
    path,
    record(id, phase, extra = {}) {
      mkdirSync(dir, { recursive: true });
      const entry = { at: new Date().toISOString(), id, phase, ...extra };
      appendFileSync(path, JSON.stringify(entry) + "\n", { encoding: "utf8", flush: true });
      const state = load();
      const current = state.get(id) || { id, type: extra.type ?? null, phases: [], outcome: null };
      current.phases.push(phase);
      if (extra.type) current.type = extra.type;
      if (extra.outcome !== undefined) current.outcome = extra.outcome;
      state.set(id, current);
    },
    /** @returns {{id:string, type:(string|null), phases:string[], outcome:any}|null} */
    stateOf(id) {
      return load().get(id) || null;
    },
  };
}

/**
 * What to do with a command this installation claimed, given its journal.
 *
 *   execute  claimed here and never started: the effect cannot have happened.
 *   report   effected and not reported: write the recorded outcome; never re-run.
 *   recover  started, no local outcome: a V2 command is looked up by its id in the
 *            supervisor store (which records the outcome with the effect); anything
 *            the store cannot answer is `unknown`. A V1 command is `unknown`.
 *   skip     not claimed by this installation, or already reported.
 *
 * @param {{id:string, type:string}} cmd
 * @param {ReturnType<typeof createCommandJournal>} journal
 * @param {{commandState?:(id:string)=>any}|null} journey
 */
export function reconcileClaimedCommand(cmd, journal, journey = null) {
  const state = journal.stateOf(cmd.id);
  if (!state || !state.phases.includes("claimed")) return { action: "skip", reason: "not claimed by this installation" };
  if (state.phases.includes("reported")) return { action: "skip", reason: "already reported" };
  if (state.phases.includes("effected")) return { action: "report", outcome: state.outcome, recovered: true };
  if (!state.phases.includes("started")) return { action: "execute" };
  if (V2_COMMAND_TYPES[cmd.type] && journey && typeof journey.commandState === "function") {
    const recorded = journey.commandState(cmd.id);
    if (recorded && recorded.recorded) {
      const outcome = recorded.outcome || {};
      return { action: "report", outcome: { ok: outcome.ok !== false, ...outcome }, recovered: true };
    }
  }
  return {
    action: "unknown",
    outcome: { ok: false, outcome_unknown: true, detail: "the laptop stopped while this command was running; its effect is not established" },
  };
}

// ---------------------------------------------------------------------------
// V2 commands
// ---------------------------------------------------------------------------

const REMOTE_ACTOR = /^[A-Za-z0-9._@-]{1,128}$/u;

/**
 * Run one phone command against the local V2 routes.
 *
 * The body the phone sent is forwarded unchanged except for `command_id`, which is
 * always the relay row id — the identity the phone generated before sending, so a
 * retry or a replay of that row is the same command to the supervisor store.
 *
 * @param {{cmd:{id:string, type:string, payload:any, user_id:string}, installation_id:string,
 *   route:(req:any)=>Promise<({status:number, json:any}|null)>, credential:string}} input
 */
export async function executeV2Command({ cmd, installation_id, route, credential }) {
  const path = V2_COMMAND_TYPES[cmd.type];
  if (!path) return { ok: false, error: "not a V2 command: " + cmd.type };
  const payload = cmd.payload && typeof cmd.payload === "object" ? cmd.payload : {};
  if (payload.installation_id !== installation_id) {
    return { ok: false, error: "installation-mismatch" };
  }
  if (!REMOTE_ACTOR.test(String(cmd.user_id || ""))) return { ok: false, error: "remote-actor-required" };
  const body = { ...(payload.body && typeof payload.body === "object" ? payload.body : {}), command_id: cmd.id };
  const response = await route({
    method: "POST",
    path: "/api/delivery/v2/" + path,
    query: new URLSearchParams(),
    body,
    headers: { authorization: "Bearer " + credential, "x-era-remote-actor": "supabase:" + cmd.user_id },
  });
  if (!response) return { ok: false, error: "unknown-v2-route" };
  const json = response.json || {};
  if (response.status === 200 && json.ok !== false) return { ok: true, ...json };
  const first = Array.isArray(json.refusals) ? json.refusals[0] : null;
  const detail = json.detail ?? (first && first.detail);
  return {
    ok: false,
    ...json,
    error: String(json.error || (first && first.code) || "refused") + (typeof detail === "string" && detail ? ": " + detail : ""),
  };
}

// ---------------------------------------------------------------------------
// Attention ledger
// ---------------------------------------------------------------------------

/** Remembers which attention keys were pushed, across restarts. */
export function createAttentionLedger({ file, limit = 1000 }) {
  let sent = null;
  const load = () => {
    if (sent) return sent;
    const stored = readJson(file);
    sent = new Set(Array.isArray(stored && stored.sent) ? stored.sent : []);
    return sent;
  };
  return {
    /** No ledger yet: the first pass records what already exists instead of pushing history. */
    isNew: () => !existsSync(file),
    /**
     * @template {{key:string}} T
     * @param {T[]} items
     * @returns {T[]}
     */
    unsent(items) {
      const known = load();
      return items.filter((item) => !known.has(item.key));
    },
    markSent(keys) {
      const known = load();
      for (const key of keys) known.add(key);
      const kept = [...known].slice(-limit);
      sent = new Set(kept);
      writeJsonAtomic(file, { sent: kept });
    },
  };
}

// ---------------------------------------------------------------------------
// Single drainer
// ---------------------------------------------------------------------------

const pidAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && error.code === "EPERM");
  }
};

/**
 * One bridge per checkout drains commands. A second `pnpm pm --bridge` on the same
 * checkout would otherwise reconcile the first one's in-flight commands as crashed.
 *
 * @param {{dir:string, pid?:number, installation_id:string, isAlive?:(pid:number)=>boolean}} input
 */
export function acquireRelayLock({ dir, pid = process.pid, installation_id, isAlive = pidAlive }) {
  const file = join(dir, "bridge.lock");
  const current = readJson(file);
  if (current && Number(current.pid) !== pid && isAlive(Number(current.pid))) {
    return { acquired: false, holder: Number(current.pid) };
  }
  writeJsonAtomic(file, { pid, installation_id, acquired_at: new Date().toISOString() });
  return { acquired: true, holder: pid };
}

export function releaseRelayLock({ dir, pid = process.pid }) {
  const file = join(dir, "bridge.lock");
  const current = readJson(file);
  if (current && Number(current.pid) === pid) writeJsonAtomic(file, { pid: null, released_at: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Worker availability
// ---------------------------------------------------------------------------

/**
 * Whether a V2 job could run right now, from the executor catalogue.
 *
 * @param {{mode:string, catalogue:any, error?:(string|null)}} input
 */
export function availabilitySummary({ mode, catalogue, error = null }) {
  const executors = catalogue && Array.isArray(catalogue.executors)
    ? catalogue.executors.map((entry) => ({ id: entry.id, label: entry.label, permitted: Boolean(entry.permitted), qualified: Boolean(entry.qualified), available: entry.available !== false }))
    : [];
  const refusalCodes = [
    ...((catalogue && catalogue.refusals) || []).map((entry) => entry.code),
    ...((catalogue && catalogue.executors) || []).flatMap((entry) => ((entry.qualification && entry.qualification.refusals) || []).map((refusal) => refusal.code)),
  ];
  let state;
  let detail = null;
  if (error) {
    state = "unavailable";
    detail = error;
  } else if (!catalogue || !catalogue.policy) {
    state = "not-configured";
    detail = "no-policy";
  } else if (refusalCodes.includes("no-worker-runtime-configured")) {
    state = "not-configured";
    detail = "no-runtime";
  } else if (refusalCodes.includes("runtime-binding-unavailable")) {
    state = "unavailable";
    detail = "runtime-unreachable";
  } else if (!executors.some((entry) => entry.permitted && entry.qualified && entry.available)) {
    state = "not-qualified";
  } else {
    state = "ready";
  }
  return { state, detail, mode, dispatchable: state === "ready" && mode === "v2", executors };
}

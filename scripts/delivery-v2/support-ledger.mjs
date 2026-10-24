// scripts/delivery-v2/support-ledger.mjs
// Owner-authorized support jobs, and the one report that keeps AI spend apart.
//
// Why this exists
// ---------------
// R44 ran 25 local Codex dispatch attempts from the Steward chat that sat outside
// every Delivery allowance: nobody could say which model, how many turns, how
// much cache. A support job (an owner-requested Claude/Codex repair of setup or
// code around a delivery) is real, sometimes necessary work. What it may not be
// is invisible. So:
//
//   - there are ZERO automatic support jobs: nothing is admitted without a prior
//     owner authorization naming scope, model tier, effort and an allowance;
//   - an authorization admits ONE job (`max_jobs`); a second needs a second owner
//     decision, and so does any job started while an earlier one has unknown usage;
//   - usage goes through the same counter normalization Delivery uses (cached
//     input stays inside input, a cumulative counter is differenced, a missing
//     baseline is a flagged hole, never a number);
//   - a missing cost is unknown, never $0;
//   - `accountingReport` shows Delivery, Support and Chat overhead as three
//     separate quantities with the coverage each one earned. They are never summed.
//
// Storage: the supervisor's existing `receipts` table (no schema change).
// Pure over a store handle; no clock of its own, no network, no processes.

import { canonicalJson, deepFreeze, fingerprint } from "./contracts.mjs";
import { resourceSummary } from "./jobs.mjs";
import { normalizeJobReadings, COUNTER_SEMANTICS, USAGE_FIELDS } from "./usage-normalization.mjs";

export const SUPPORT_KIND = "support-authorization";
export const CHAT_KIND = "chat-overhead";
export const SUPPORT_EXECUTORS = Object.freeze(["claude", "codex"]);
export const DEFAULT_MAX_SUPPORT_JOBS = 1;

export const SUPPORT_REFUSALS = Object.freeze({
  INVALID: "support-request-invalid",
  CONFLICT: "support-command-conflict",
  NOT_AUTHORIZED: "support-not-authorized",
  CLOSED: "support-authorization-closed",
  JOB_LIMIT: "support-job-limit-reached",
  USAGE_UNKNOWN: "support-usage-unknown",
  ALLOWANCE: "support-allowance-exhausted",
  UNKNOWN_JOB: "support-job-unknown",
  SETTLEMENT_CONFLICT: "support-settlement-conflict",
});

const receiptId = (id) => "support:" + id;
const chatReceiptId = (id) => "chat:" + id;
const parse = (value) => (value ? JSON.parse(String(value)) : null);
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const isCount = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
const refuse = (code, detail) => ({ ok: false, refusals: [{ code, detail }] });

const subjectKey = (subject) => (subject.run_id ? "run:" + subject.run_id : "request:" + subject.request_id);

const tokensOf = (values) => ({
  input: Number(values.input || 0),
  cachedInput: Number(values.cachedInput || 0),
  cacheCreation: Number(values.cacheCreation || 0),
  output: Number(values.output || 0),
  reasoningOutput: Number(values.reasoningOutput || 0),
  // Cached input is inside input and reasoning is inside output: adding either
  // again is the double count DLV-119 removed.
  total: Number(values.input || 0) + Number(values.output || 0),
});

const addTokens = (a, b) => tokensOf({
  input: a.input + b.input,
  cachedInput: a.cachedInput + b.cachedInput,
  cacheCreation: a.cacheCreation + b.cacheCreation,
  output: a.output + b.output,
  reasoningOutput: a.reasoningOutput + b.reasoningOutput,
});

const ZERO = tokensOf({});

function loadAuthorization(store, authorization_id) {
  const row = store.getReceipt(receiptId(authorization_id));
  if (!row || row.kind !== SUPPORT_KIND) return null;
  return { row, auth: parse(row.observed_json) };
}

function save(store, row, auth, state_before) {
  store.putReceipt({
    receipt_id: row.receipt_id,
    kind: SUPPORT_KIND,
    subject_id: row.subject_id,
    actor: row.actor,
    payload_digest: row.payload_digest,
    state_before,
    state_after: auth.state,
    observed: auth,
  });
  return auth;
}

/** Tokens a support authorization has spent, and whether every job is accounted for. */
export function authorizationUsage(auth) {
  let tokens = ZERO;
  const unknown = [];
  for (const job of auth.jobs) {
    if (job.usage && job.usage.tokens) tokens = addTokens(tokens, tokensOf(job.usage.tokens));
    if (job.state !== "settled" || !job.usage || job.usage.complete !== true) {
      unknown.push({ job_id: job.job_id, state: job.state, reason: job.state === "dispatched" ? "dispatched with no outcome recorded" : "usage missing or not a complete measurement" });
    }
  }
  return { tokens, unknown };
}

/**
 * Record the owner's authorization for ONE support job. Idempotent on `command_id`.
 *
 * @param {object} store
 * @param {{command_id:string, subject:{run_id?:(string|null), request_id?:(string|null)}, purpose:string,
 *   scope:string[], executor:string, model_tier:string, effort:string, allowance_tokens:number, max_jobs?:number}} input
 * @param {string} actor the authenticated owner session
 * @param {string} at
 */
export function authorizeSupport(store, input, actor, at) {
  const subject = { run_id: text(input.subject?.run_id, 128) || null, request_id: text(input.subject?.request_id, 128) || null };
  const scope = Array.isArray(input.scope) ? input.scope.map((entry) => text(entry, 200)).filter(Boolean) : [];
  const executor = String(input.executor || "");
  const problems = [];
  if (!subject.run_id && !subject.request_id) problems.push("link the job to a run or a request");
  if (!text(input.command_id, 128)) problems.push("command_id is required");
  if (!text(input.purpose, 200)) problems.push("purpose is required");
  if (!scope.length || scope.length > 10) problems.push("scope needs 1-10 entries");
  if (!SUPPORT_EXECUTORS.includes(executor)) problems.push("executor must be one of " + SUPPORT_EXECUTORS.join(", "));
  if (!text(input.model_tier, 64)) problems.push("model_tier is required");
  if (!text(input.effort, 16)) problems.push("effort is required");
  const allowance = Number(input.allowance_tokens);
  if (!Number.isInteger(allowance) || allowance <= 0) problems.push("allowance_tokens must be a positive integer");
  const maxJobs = input.max_jobs == null ? DEFAULT_MAX_SUPPORT_JOBS : Number(input.max_jobs);
  if (!Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > 3) problems.push("max_jobs must be 1-3");
  if (problems.length) return refuse(SUPPORT_REFUSALS.INVALID, problems.join("; "));

  return store.transaction(() => {
    const digest = fingerprint(canonicalJson({ ...input, scope, subject }));
    const existing = loadAuthorization(store, input.command_id);
    if (existing) {
      if (existing.row.actor !== actor || existing.row.payload_digest !== digest) return refuse(SUPPORT_REFUSALS.CONFLICT, input.command_id);
      return { ok: true, repeated: true, authorization: existing.auth };
    }
    const auth = {
      authorization_id: input.command_id,
      subject,
      purpose: text(input.purpose, 200),
      scope,
      executor,
      model_tier: text(input.model_tier, 64),
      effort: text(input.effort, 16),
      allowance: { unit: "tokens", amount: allowance },
      max_jobs: maxJobs,
      authorized_by: actor,
      authorized_at: at,
      state: "authorized",
      jobs: [],
    };
    store.putReceipt({
      receipt_id: receiptId(input.command_id),
      kind: SUPPORT_KIND,
      subject_id: "support-for:" + subjectKey(subject),
      actor,
      payload_digest: digest,
      state_after: "authorized",
      observed: auth,
    });
    return { ok: true, repeated: false, authorization: auth };
  });
}

/**
 * May this job start under this authorization? Every applicable refusal is
 * returned, so the owner sees unknown usage AND the limit, not just the first.
 */
export function admitSupportJob(store, { authorization_id, job_id }, at) {
  if (!text(authorization_id, 128) || !text(job_id, 128)) return refuse(SUPPORT_REFUSALS.INVALID, "authorization_id and job_id are required");
  return store.transaction(() => {
    const found = loadAuthorization(store, authorization_id);
    if (!found) return refuse(SUPPORT_REFUSALS.NOT_AUTHORIZED, "a support job needs a prior owner authorization; there are no automatic support jobs");
    const { row, auth } = found;
    if (auth.jobs.some((job) => job.job_id === job_id)) return { ok: true, repeated: true, authorization: auth };
    const refusals = [];
    if (auth.state === "closed") refusals.push({ code: SUPPORT_REFUSALS.CLOSED, detail: "the owner closed this authorization" });
    const { tokens, unknown } = authorizationUsage(auth);
    if (unknown.length) refusals.push({ code: SUPPORT_REFUSALS.USAGE_UNKNOWN, detail: unknown });
    if (auth.jobs.length >= auth.max_jobs) refusals.push({ code: SUPPORT_REFUSALS.JOB_LIMIT, detail: auth.max_jobs + " job(s) per authorization; a new job needs a new owner decision" });
    if (tokens.total >= auth.allowance.amount) refusals.push({ code: SUPPORT_REFUSALS.ALLOWANCE, detail: tokens.total + " of " + auth.allowance.amount + " tokens spent" });
    if (refusals.length) return { ok: false, refusals };
    auth.jobs.push({ job_id, state: "dispatched", started_at: at, finished_at: null, thread_id: null, turn_ids: [], observed: null, usage: null, stop_reason: null, cost: { usd: null, provenance: "unknown" } });
    auth.state = "dispatched";
    save(store, row, auth, "authorized");
    return { ok: true, repeated: false, authorization: auth };
  });
}

/**
 * Record what a support job reported when it ended.
 *
 * `usage.readings` are the provider's counters per turn, with the semantics the
 * adapter declared. No readings, or a reading that could not be normalized, leaves
 * the job `unknown` and blocks the next one.
 */
export function settleSupportJob(store, input, at) {
  const { authorization_id, job_id } = input;
  if (!text(authorization_id, 128) || !text(job_id, 128)) return refuse(SUPPORT_REFUSALS.INVALID, "authorization_id and job_id are required");
  const semantics = Object.values(COUNTER_SEMANTICS).includes(input.usage?.semantics) ? input.usage.semantics : COUNTER_SEMANTICS.UNKNOWN;
  const readings = Array.isArray(input.usage?.readings) ? input.usage.readings.filter((entry) => entry && typeof entry.usage === "object") : [];
  const hasRequiredCounters = (usage) => usage && ["input", "output"].every((field) => typeof usage[field] === "number" && Number.isFinite(usage[field]) && usage[field] >= 0);
  if (readings.some((entry) => !hasRequiredCounters(entry.usage)) || (input.usage?.baseline != null && !hasRequiredCounters(input.usage.baseline))) {
    return refuse(SUPPORT_REFUSALS.INVALID, "input and output counters are required; missing usage remains unknown");
  }
  const bad = readings.find((entry) => USAGE_FIELDS.some((field) => entry.usage[field] != null && !isCount(entry.usage[field])));
  if (bad) return refuse(SUPPORT_REFUSALS.INVALID, "usage counters must be non-negative numbers");
  const usd = input.cost?.usd;
  if (usd != null && !isCount(usd)) return refuse(SUPPORT_REFUSALS.INVALID, "cost.usd must be a non-negative number or null");

  return store.transaction(() => {
    const found = loadAuthorization(store, authorization_id);
    if (!found) return refuse(SUPPORT_REFUSALS.NOT_AUTHORIZED, authorization_id);
    const { row, auth } = found;
    const job = auth.jobs.find((entry) => entry.job_id === job_id);
    if (!job) return refuse(SUPPORT_REFUSALS.UNKNOWN_JOB, job_id);
    const digest = fingerprint(canonicalJson({ ...input, at: null }));
    if (job.state !== "dispatched") {
      return job.settlement_digest === digest ? { ok: true, repeated: true, authorization: auth } : refuse(SUPPORT_REFUSALS.SETTLEMENT_CONFLICT, job_id);
    }

    let usage = null;
    if (readings.length) {
      const normalized = normalizeJobReadings({ semantics, readings, baseline: input.usage?.baseline || null, baselineRequired: input.usage?.baselineRequired === true });
      let sum = ZERO;
      for (const entry of normalized.readings) sum = addTokens(sum, tokensOf(entry.normalized.values));
      const last = normalized.readings[normalized.readings.length - 1];
      usage = {
        complete: normalized.incomplete.length === 0,
        incomplete: normalized.incomplete,
        semantics,
        tokens: sum,
        raw: last ? tokensOf(last.normalized.raw) : null,
        turns: readings.length,
      };
    }
    const observed = input.observed && typeof input.observed === "object"
      ? { model: text(input.observed.model, 128) || null, effort: text(input.observed.effort, 16) || null }
      : null;
    job.state = usage && usage.complete ? "settled" : "unknown";
    job.finished_at = at;
    job.thread_id = text(input.thread_id, 128) || null;
    job.turn_ids = Array.isArray(input.turn_ids) ? input.turn_ids.map((id) => text(id, 128)).filter(Boolean).slice(0, 50) : [];
    job.requested = { executor: auth.executor, model_tier: auth.model_tier, effort: auth.effort };
    job.observed = observed;
    // null = the provider did not say; a mismatch is shown, never silently accepted.
    // A documentation tier is not a resolved model selector. Compare only what
    // is actually known; never claim that matching effort proves the model.
    job.effort_match = observed && observed.effort ? observed.effort === auth.effort : null;
    job.usage = usage;
    job.stop_reason = text(input.stop_reason, 64) || null;
    job.cost = usd == null ? { usd: null, provenance: "unknown" } : { usd: Number(usd), provenance: input.cost?.provenance === "estimate" ? "estimate" : "provider-reported" };
    job.settlement_digest = digest;

    const { tokens, unknown } = authorizationUsage(auth);
    auth.state = unknown.length ? "unknown" : tokens.total >= auth.allowance.amount ? "exhausted" : "settled";
    save(store, row, auth, "dispatched");
    return { ok: true, repeated: false, authorization: auth };
  });
}

/** The owner withdraws an authorization; nothing further is admitted under it. */
export function closeSupport(store, { authorization_id }, at) {
  return store.transaction(() => {
    const found = loadAuthorization(store, authorization_id);
    if (!found) return refuse(SUPPORT_REFUSALS.NOT_AUTHORIZED, String(authorization_id));
    const { row, auth } = found;
    if (auth.state === "closed") return { ok: true, repeated: true, authorization: auth };
    const before = auth.state;
    auth.state = "closed";
    auth.closed_at = at;
    save(store, row, auth, before);
    return { ok: true, repeated: false, authorization: auth };
  });
}

/**
 * Owner-entered chat overhead. The Steward chat runs outside this supervisor, so
 * nothing here can measure it; this only records a figure the owner supplies.
 */
export function recordChatOverhead(store, input, actor, at) {
  const subject = { run_id: text(input.subject?.run_id, 128) || null, request_id: text(input.subject?.request_id, 128) || null };
  if ((!subject.run_id && !subject.request_id) || !text(input.command_id, 128)) return refuse(SUPPORT_REFUSALS.INVALID, "command_id and a run or request link are required");
  const tokens = input.tokens == null ? null : Number(input.tokens);
  const usd = input.usd == null ? null : Number(input.usd);
  if ((tokens != null && !isCount(tokens)) || (usd != null && !isCount(usd))) return refuse(SUPPORT_REFUSALS.INVALID, "tokens and usd must be non-negative numbers or null");
  return store.transaction(() => {
    const id = chatReceiptId(input.command_id);
    const digest = fingerprint(canonicalJson({ ...input, subject }));
    const existing = store.getReceipt(id);
    if (existing) return existing.payload_digest === digest && existing.actor === actor ? { ok: true, repeated: true } : refuse(SUPPORT_REFUSALS.CONFLICT, input.command_id);
    store.putReceipt({
      receipt_id: id,
      kind: CHAT_KIND,
      subject_id: "chat-for:" + subjectKey(subject),
      actor,
      payload_digest: digest,
      state_after: "recorded",
      observed: { subject, tokens, usd, note: text(input.note, 200) || null, recorded_by: actor, recorded_at: at },
    });
    return { ok: true, repeated: false };
  });
}

function matches(subject, run_id, requestIds) {
  return (run_id && subject.run_id === run_id) || (subject.request_id && requestIds.has(subject.request_id));
}

/** Requests (Steward or owner) whose recorded outcome created this run. Scans only when a caller has something to match. */
function requestIdsFor(store, run_id, request_id) {
  const ids = new Set(request_id ? [request_id] : []);
  if (!run_id) return ids;
  for (const kind of ["steward-initiation", "delivery-initiation"]) {
    for (const row of store.listReceiptsByKind(kind, 500)) {
      const record = parse(row.observed_json);
      const outcome = record?.outcome || parse(store.getCommand(record?.command_id)?.outcome_json);
      if ((outcome?.run_id || record?.run_id) === run_id) ids.add(String(record.command_id));
    }
  }
  return ids;
}

/**
 * Support authorizations linked to a run, directly or through the request that created it.
 *
 * @param {any} store
 * @param {{run_id?:(string|null), request_id?:(string|null)}} ids
 */
export function supportFor(store, { run_id = null, request_id = null }) {
  const all = store.listReceiptsByKind(SUPPORT_KIND, 500).map((row) => parse(row.observed_json));
  if (!all.length) return [];
  const requestIds = requestIdsFor(store, run_id, request_id);
  return all.filter((auth) => matches(auth.subject, run_id, requestIds)).sort((a, b) => String(a.authorized_at).localeCompare(String(b.authorized_at)));
}

/**
 * Delivery / Support / Chat overhead, separately, with the coverage each earned.
 * Never one total: the three have different provenance.
 *
 * @param {any} store
 * @param {{run_id?:(string|null), request_id?:(string|null)}} ids
 * @param {(string|null)} [at]
 */
export function accountingReport(store, { run_id = null, request_id = null }, at = null) {
  const delivery = (() => {
    if (!run_id) return { jobs: 0, tokens: ZERO, costUsd: null, costBasis: "no run is linked yet", unknown: [], coverage: { known: 0, total: 0 } };
    const jobs = store.listJobs(run_id);
    const summary = resourceSummary(store, { run_id, unit: "tokens" });
    const unknownIds = new Set(summary.unknown.map((entry) => String(entry.job_id)));
    return {
      jobs: jobs.length,
      tokens: tokensOf(summary.nativeTotals),
      costUsd: summary.provenance.providerReportedUsd,
      costBasis: summary.provenance.providerReportedBasis,
      unknown: summary.unknown,
      coverage: { known: jobs.filter((job) => !unknownIds.has(String(job.job_id))).length, total: jobs.length },
    };
  })();

  const authorizations = supportFor(store, { run_id, request_id });
  const support = (() => {
    let tokens = ZERO;
    let usd = null;
    let costComplete = true;
    let estimated = false;
    const unknown = [];
    let jobs = 0;
    let known = 0;
    for (const auth of authorizations) {
      const used = authorizationUsage(auth);
      tokens = addTokens(tokens, used.tokens);
      for (const entry of used.unknown) unknown.push({ authorization_id: auth.authorization_id, ...entry });
      for (const job of auth.jobs) {
        jobs += 1;
        if (job.state === "settled" && job.usage?.complete) known += 1;
        if (job.cost && job.cost.usd != null) {
          usd = (usd || 0) + Number(job.cost.usd);
          if (job.cost.provenance === "estimate") estimated = true;
        }
        else costComplete = false;
      }
    }
    return {
      authorizations: authorizations.map((auth) => ({
        authorization_id: auth.authorization_id,
        purpose: auth.purpose,
        executor: auth.executor,
        model_tier: auth.model_tier,
        effort: auth.effort,
        allowance: auth.allowance,
        state: auth.state,
        authorized_by: auth.authorized_by,
        authorized_at: auth.authorized_at,
        jobs: auth.jobs.map((job) => ({
          job_id: job.job_id,
          state: job.state,
          thread_id: job.thread_id,
          turn_ids: job.turn_ids,
          requested: job.requested || { executor: auth.executor, model_tier: auth.model_tier, effort: auth.effort },
          observed: job.observed,
          effort_match: job.observed?.effort ? job.observed.effort === auth.effort : null,
          tokens: job.usage ? job.usage.tokens : null,
          stop_reason: job.stop_reason,
          cost: job.cost,
        })),
      })),
      jobs,
      tokens,
      // Known part only; `costComplete` says whether it is the whole.
      costUsd: usd,
      costComplete: jobs > 0 && costComplete,
      costBasis: usd == null ? "unknown" : estimated ? "estimate" : "provider-reported",
      unknown,
      coverage: { known, total: jobs },
    };
  })();

  const chat = (() => {
    const rows = store.listReceiptsByKind(CHAT_KIND, 500).map((row) => parse(row.observed_json));
    const requestIds = rows.length ? requestIdsFor(store, run_id, request_id) : new Set();
    const subjects = rows.filter((record) => matches(record.subject, run_id, requestIds));
    if (!subjects.length) {
      return { status: "not-measured", tokens: null, costUsd: null, basis: "the Steward chat runs outside this supervisor; its usage is counted only if the owner enters it" };
    }
    const tokens = subjects.some((entry) => entry.tokens != null) ? subjects.reduce((sum, entry) => sum + Number(entry.tokens || 0), 0) : null;
    const usd = subjects.some((entry) => entry.usd != null) ? subjects.reduce((sum, entry) => sum + Number(entry.usd || 0), 0) : null;
    return { status: "owner-entered", tokens, costUsd: usd, basis: "figures entered by the owner; not measured by Command Center" };
  })();

  return deepFreeze({
    run_id,
    request_id,
    at,
    delivery,
    support,
    chat,
    coverage: {
      delivery: delivery.coverage,
      support: support.coverage,
      chat: chat.status,
      // Delivery and Support are measured here; chat never is, so it cannot make this false.
      complete: delivery.coverage.known === delivery.coverage.total && support.coverage.known === support.coverage.total,
    },
  });
}

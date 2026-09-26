// scripts/delivery-v2/entry.mjs
// PM Delivery V2 — S1.4: the entry adapter that connects existing selection to
// an admitted Run.
//
// "Selected item + applicable policy → admitted Run/Job → visible result and
//  concrete outstanding owner action. One local service persists an
//  installation-wide v1|v2 dispatch switch. Store only selected WorkRef
//  mappings, not an adoption registry."
//   — "PM Delivery — Execution Portfolio.md" S1.4
//
// This is the only module that knows about HTTP, and it knows as little as it
// can: a request shape in, a `{status, json}` out. Everything consequential is
// delegated — selection to work-ref.mjs, admission to jobs.mjs, evaluation to
// results.mjs — because the entry point is exactly where a convenient shortcut
// would bypass all three.
//
// The dispatch switch is a refusal, not a preference
// --------------------------------------------------
// Architecture §10: "For the pilot, drain active V1 writers and use a single
// installation-wide dispatch choice, `v1 | v2`. Enforce it server-side for all
// write-capable launch/resume/fork entry points; a stale UI cannot start the
// other engine."
//
// Server-side is the load-bearing word. A dashboard tab left open from before a
// switch still has its V1 launch button, still has a valid session id, and will
// happily POST to `/api/delivery/start`. `guardV1Route` is what makes that
// request fail, and it is wired into V1's own router rather than into the client.
//
// Switching is refused in both directions while writers are outstanding, and the
// two refusals are not symmetric:
//   → v2 while a V1 writer is active: that writer would keep editing the host
//     workspace underneath a V2 run.
//   → v1 while a V2 job is unreconciled: S1.4's stop/rollback rule — "do not
//     turn an unknown dispatch into a fresh V1 launch".

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ContractError, contentId, deepFreeze, normalizePath, evaluateGrant } from "./contracts.mjs";
import { recordPlan } from "./interaction.mjs";
import { freezeSelectedItem, recheckContractSource } from "./work-ref.mjs";
import { ADMISSION_REFUSALS, admitJob, resourceSummary } from "./jobs.mjs";
import { buildResult } from "./results.mjs";
import { summarizeCriteria } from "./criteria.mjs";
import { EXECUTOR_REFUSALS, listExecutors, resolveExecutorChoice } from "./adapters/registry.mjs";
import {
  SESSION_COOKIE,
  authenticateLocal,
  checkOrigin,
  clearedSessionCookie,
  pairSession,
  parseCookies,
  revokeSession,
  sessionCookie,
  sessionView,
} from "./local-auth.mjs";

/** The installation-wide switch. Exactly two values; there is no per-item choice. */
export const DISPATCH_MODES = Object.freeze(["v1", "v2"]);

/** Where the switch lives. One file, one value, gitignored with the rest of .delivery/. */
export const DISPATCH_MODE_REL = ".delivery/v2/dispatch-mode.json";

/** Where the chosen executor lives. Same shape, same directory, separate decision. */
export const EXECUTOR_SELECTION_REL = ".delivery/v2/executor.json";

/** Why an entry-point request was refused. */
export const ENTRY_REFUSALS = Object.freeze({
  UNAUTHENTICATED: "unauthenticated",
  CROSS_ORIGIN: "cross-origin-request-refused",
  BAD_MODE: "unknown-dispatch-mode",
  V1_WRITER_ACTIVE: "active-v1-writer-blocks-mode-switch",
  V2_JOB_UNRECONCILED: "unreconciled-v2-job-blocks-mode-switch",
  V1_ROUTE_DISABLED: "v1-write-route-disabled-in-v2-mode",
  V2_ROUTE_DISABLED: "v2-dispatch-disabled-in-v1-mode",
  SELECTION: "selection-refused",
  STALE_SOURCE: "stale-selected-source",
  UNKNOWN_RUN: "unknown-run",
  NO_POLICY: "no-deliver-policy-configured",
  NO_EXECUTOR: EXECUTOR_REFUSALS.NONE_SELECTED,
  BAD_EXECUTOR: EXECUTOR_REFUSALS.UNKNOWN,
  EXECUTOR_NOT_PERMITTED: EXECUTOR_REFUSALS.NOT_PERMITTED,
  SELECTION_PER_RUN: "executor-selection-is-per-run",
});

/**
 * V1 routes that can start, continue or steer a writer.
 *
 * `/api/delivery/preflight` is deliberately absent: it is a POST, but it only
 * snapshots the workspace and cannot dispatch anything. Blocking it would break
 * the read-only V1 history surface that S1.4 requires to stay available, for no
 * containment benefit.
 */
export const V1_WRITE_ROUTES = Object.freeze([
  "/api/delivery/start",
  "/api/delivery/resume",
  "/api/delivery/decision",
  "/api/delivery/message",
  "/api/delivery/control",
]);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

// ---------------------------------------------------------------------------
// The dispatch switch
// ---------------------------------------------------------------------------

/** @param {string} root */
export function dispatchModePath(root) {
  return join(root, ...DISPATCH_MODE_REL.split("/"));
}

/**
 * Read the current mode.
 *
 * Defaults to `v1` when the file is absent or unreadable, and that default is a
 * safety property rather than a convenience: an installation that has never made
 * a choice, or whose switch file was corrupted, keeps running the engine that is
 * actually qualified. A missing file must never silently enable V2 dispatch.
 *
 * @param {{root:string}} input
 */
export function readDispatchMode({ root }) {
  const path = dispatchModePath(root);
  if (!existsSync(path)) {
    return deepFreeze({ mode: "v1", updated_at: null, actor: null, note: "no switch has been set; defaulting to v1" });
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const mode = DISPATCH_MODES.includes(parsed.mode) ? parsed.mode : "v1";
    return deepFreeze({
      mode,
      updated_at: parsed.updated_at ?? null,
      actor: parsed.actor ?? null,
      note: mode === parsed.mode ? null : "unrecognised mode in the switch file; defaulting to v1",
    });
  } catch {
    return deepFreeze({ mode: "v1", updated_at: null, actor: null, note: "unreadable switch file; defaulting to v1" });
  }
}

/**
 * Move the installation-wide switch.
 *
 * The caller supplies the outstanding-writer facts rather than this module
 * discovering them, because "active V1 writer" is V1's own question (a
 * non-terminal session in `.delivery/sessions/`) and "unreconciled V2 job" is the
 * V2 store's. Passing them in keeps this function honest about what it is: a
 * gate, not an oracle.
 *
 * @param {{root:string, mode:string, actor:string, activeV1Writers?:string[],
 *   unreconciledV2Jobs?:string[], now?:(string|null)}} input
 * @returns {{ok:boolean, refusals:readonly {code:string, detail:unknown, note?:string}[],
 *   mode:(string|null), record?:object}}
 */
export function setDispatchMode({ root, mode, actor, activeV1Writers = [], unreconciledV2Jobs = [], now = null }) {
  if (!DISPATCH_MODES.includes(mode)) {
    return deepFreeze({ ok: false, refusals: [{ code: ENTRY_REFUSALS.BAD_MODE, detail: mode }], mode: null });
  }
  if (!isNonEmptyString(actor)) {
    return deepFreeze({ ok: false, refusals: [{ code: ENTRY_REFUSALS.UNAUTHENTICATED, detail: "no actor" }], mode: null });
  }

  const refusals = [];
  if (mode === "v2" && activeV1Writers.length) {
    refusals.push({
      code: ENTRY_REFUSALS.V1_WRITER_ACTIVE,
      detail: activeV1Writers,
      note: "drain or reconcile the active V1 writers before switching; they would keep editing the host workspace under a V2 run",
    });
  }
  if (mode === "v1" && unreconciledV2Jobs.length) {
    refusals.push({
      code: ENTRY_REFUSALS.V2_JOB_UNRECONCILED,
      detail: unreconciledV2Jobs,
      note: "an unknown V2 dispatch is not turned into a fresh V1 launch; reconcile it first",
    });
  }
  if (refusals.length) {
    return deepFreeze({ ok: false, refusals, mode: readDispatchMode({ root }).mode });
  }

  const path = dispatchModePath(root);
  mkdirSync(dirname(path), { recursive: true });
  const record = { mode, actor, updated_at: now || new Date().toISOString(), schema: "delivery-v2/dispatch-mode@1" };
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n", "utf8");
  return deepFreeze({ ok: true, refusals: [], mode, record });
}

// ---------------------------------------------------------------------------
// The executor selection
// ---------------------------------------------------------------------------

/** @param {string} root */
export function executorSelectionPath(root) {
  return join(root, ...EXECUTOR_SELECTION_REL.split("/"));
}

/**
 * Which executor is this installation configured to dispatch to?
 *
 * Absent, unreadable or unrecognised all resolve to `null`, and `null` is a
 * refusal rather than a default. That asymmetry with the dispatch-mode switch
 * above is deliberate and is the owner's stated rule: the mode switch may safely
 * default to `v1` because `v1` is the engine that already runs, but there is no
 * safe default *provider* — picking one would spend money with a vendor nobody
 * chose, and a corrupted selection file would silently move an installation from
 * one provider to the other.
 *
 * @param {{root:string}} input
 */
export function readExecutorSelection({ root }) {
  const path = executorSelectionPath(root);
  if (!existsSync(path)) {
    return deepFreeze({
      backend_id: null,
      id: null,
      label: null,
      updated_at: null,
      actor: null,
      note: "no executor has been selected; v2 dispatch refuses until one is chosen",
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return deepFreeze({
      backend_id: null,
      id: null,
      label: null,
      updated_at: null,
      actor: null,
      note: "unreadable executor selection file; no executor is assumed",
    });
  }
  const executor = resolveExecutorChoice(parsed.backend_id ?? parsed.id ?? null);
  if (!executor) {
    return deepFreeze({
      backend_id: null,
      id: null,
      label: null,
      updated_at: parsed.updated_at ?? null,
      actor: parsed.actor ?? null,
      note: "the selection file names an executor this installation does not know; no substitute is chosen",
    });
  }
  return deepFreeze({
    backend_id: executor.backend_id,
    id: executor.id,
    label: executor.label,
    updated_at: parsed.updated_at ?? null,
    actor: parsed.actor ?? null,
    note: null,
  });
}

/**
 * Choose the executor for this installation.
 *
 * Outstanding jobs do NOT block the change, and that is a considered position
 * rather than an oversight. Every job row records the backend it was dispatched
 * to; `reconcileOutstanding` reconciles each job through its own adapter and
 * refuses to inspect one with another's; `dispatchJob` refuses a job reserved for
 * a different backend. So an installation can hold outstanding Codex jobs and
 * start new Claude ones without either losing track of the other — which is the
 * behaviour the owner asked for when they said reconciliation must know which
 * executor owns a job.
 *
 * What *is* refused is a selection this installation cannot name, and a request
 * with no actor. Both are refusals rather than defaults.
 *
 * @param {{root:string, choice:unknown, actor:string, now?:(string|null)}} input
 */
export function setExecutorSelection({ root, choice, actor, now = null }) {
  const executor = resolveExecutorChoice(choice);
  if (!executor) {
    return deepFreeze({
      ok: false,
      refusals: [
        {
          code: ENTRY_REFUSALS.BAD_EXECUTOR,
          detail: String(choice ?? "(none)") + " is not a known executor",
          note: "known executors: " + listExecutors().map((entry) => entry.id).join(", "),
        },
      ],
      selection: readExecutorSelection({ root }),
    });
  }
  if (!isNonEmptyString(actor)) {
    return deepFreeze({
      ok: false,
      refusals: [{ code: ENTRY_REFUSALS.UNAUTHENTICATED, detail: "no actor" }],
      selection: readExecutorSelection({ root }),
    });
  }

  const path = executorSelectionPath(root);
  mkdirSync(dirname(path), { recursive: true });
  const record = {
    schema: "delivery-v2/executor-selection@1",
    backend_id: executor.backend_id,
    id: executor.id,
    actor,
    updated_at: now || new Date().toISOString(),
  };
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n", "utf8");
  return deepFreeze({ ok: true, refusals: [], selection: readExecutorSelection({ root }), record });
}

/**
 * Should V1 handle this request?
 *
 * Called from V1's own router before it dispatches, so a client that never
 * reloaded cannot reach a writer. Read and history routes stay available in both
 * modes — Architecture §10 requires historical V1 inspection to keep working, and
 * no active legacy session is converted.
 *
 * @param {{mode:string, method:string, path:string}} input
 */
export function guardV1Route({ mode, method, path }) {
  if (mode !== "v2") return deepFreeze({ allowed: true, status: 200, reason: null });
  if (method !== "POST") return deepFreeze({ allowed: true, status: 200, reason: null });
  if (!V1_WRITE_ROUTES.includes(path)) return deepFreeze({ allowed: true, status: 200, reason: null });
  return deepFreeze({
    allowed: false,
    status: 409,
    reason: ENTRY_REFUSALS.V1_ROUTE_DISABLED,
    detail: "this installation is in v2 dispatch mode; " + path + " is disabled server-side. History and read routes remain available.",
  });
}

// ---------------------------------------------------------------------------
// Command authentication
// ---------------------------------------------------------------------------

/**
 * Is this origin a loopback address?
 *
 * Accepted on any port, because `pm-server` retries upward when its default port
 * is taken, so the port this process ends up on is not knowable where the context
 * is built. That is a real weakening only against another program already running
 * on this machine — which has the owner's filesystem anyway — while the attack
 * this check exists to stop, a remote page POSTing to `127.0.0.1`, still fails on
 * its own origin. `Sec-Fetch-Site` is checked independently.
 *
 * Parsed rather than pattern-matched: `http://127.0.0.1.evil.com` matches a naive
 * prefix test and is not loopback.
 */
export function isLoopbackOrigin(origin) {
  if (!isNonEmptyString(origin)) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
}

/**
 * Authenticate one consequential local request.
 *
 * Architecture §9: "Local HTTP must authenticate requests and reject
 * cross-origin/CSRF attempts; binding to loopback alone is insufficient."
 *
 * Loopback is not enough because any page in the owner's browser can POST to
 * `127.0.0.1`. So two independent checks, and a request must pass both:
 *
 *   - `Origin`, when present, must be one this server serves. A browser attaches
 *     it to cross-site POSTs and cannot be talked out of it by page script.
 *   - `Sec-Fetch-Site` must be `same-origin` or `none`. This catches the case
 *     where `Origin` is absent, which is itself how some cross-site requests
 *     present.
 *
 * The actor is required separately: an authenticated *request* still has to say
 * who is asking, because every command receipt binds an actor and a same-id
 * retry by a different actor is a conflict rather than a duplicate.
 *
 * @param {{headers?:Record<string, string|undefined>, allowedOrigins?:string[],
 *   actor?:(string|null), allowLoopbackOrigins?:boolean}} input
 * @returns {{ok:boolean, status:number, refusal:({code:string, detail:unknown}|null),
 *   actor:(string|null), installation:(string|null)}}
 */
export function authenticateCommand({ headers = {}, allowedOrigins = [], actor = null, allowLoopbackOrigins = true }) {
  const lower = {};
  for (const [key, value] of Object.entries(headers || {})) lower[String(key).toLowerCase()] = value;

  const origin = lower.origin;
  const originAllowed =
    allowedOrigins.includes(origin) || (allowLoopbackOrigins && isLoopbackOrigin(origin));
  if (isNonEmptyString(origin) && !originAllowed) {
    return deepFreeze({
      ok: false,
      status: 403,
      refusal: { code: ENTRY_REFUSALS.CROSS_ORIGIN, detail: origin },
      actor: null,
      installation: null,
    });
  }
  const site = lower["sec-fetch-site"];
  if (isNonEmptyString(site) && site !== "same-origin" && site !== "none") {
    return deepFreeze({
      ok: false,
      status: 403,
      refusal: { code: ENTRY_REFUSALS.CROSS_ORIGIN, detail: "sec-fetch-site: " + site },
      actor: null,
      installation: null,
    });
  }

  const named = isNonEmptyString(actor) ? actor.trim() : isNonEmptyString(lower["x-era-actor"]) ? String(lower["x-era-actor"]).trim() : null;
  if (!named) {
    return deepFreeze({
      ok: false,
      status: 401,
      refusal: { code: ENTRY_REFUSALS.UNAUTHENTICATED, detail: "no actor on the request" },
      actor: null,
      installation: null,
    });
  }

  return deepFreeze({
    ok: true,
    status: 200,
    refusal: null,
    actor: named,
    installation: isNonEmptyString(lower["x-era-installation"]) ? String(lower["x-era-installation"]) : null,
  });
}

// ---------------------------------------------------------------------------
// Deliver
// ---------------------------------------------------------------------------

/** Deterministic run identity for one contract revision, so a retry finds the same run. */
export function deriveRunId({ work_id, contract_id, contract_revision, attempt = 0 }) {
  // Attempt 0 keeps the original identity; a successor after a closed run is 1, 2…
  return contentId("r", { v: 1, work_id, contract_id, contract_revision, attempt: attempt || undefined });
}

/**
 * Turn a selected checklist row into an admitted Run and Job.
 *
 * The order is the argument, again. Selection and freshness come first, because
 * a stale or ambiguous source must refuse *before* a command id is spent and a
 * reservation is taken — otherwise a refused launch still leaves a job row and a
 * consumed command in the store.
 *
 * The WorkRef mapping is persisted here and nowhere else, and only for the item
 * actually selected. That is the "store only selected WorkRef mappings, not an
 * adoption registry" clause: no backlog is adopted into a lifecycle database by
 * the act of looking at it.
 *
 * The click must carry a witness (the row's alias and exact line). The ordinal is
 * only a hint: a reordered checklist re-resolves the witnessed row or refuses, so
 * a row prepended above the selection can never be the one admitted. `bookRaw` is
 * the campaign Master Book (null when unreadable); its `### <ID>` revision is
 * frozen into the contract, so an acceptance edit invalidates grants bound to it.
 *
 * @param {{store:object, raw:string, file:string, cbidx:number,
 *   witness:(object|null), bookRaw:(string|null),
 *   requestedDisposition:string, outcome?:(string|null),
 *   criteria?:object[], scratchScope:object, publicationScope:object,
 *   grant:import("./contracts.mjs").Grant, profileAdmission:object,
 *   backend_id:string, reservation:object, instruction:string,
 *   workspace:{root:string, backing?:string}, command:{command_id:string, actor:string, payload?:object},
 *   now?:(string|null), nextJobCost?:(number|null), repairDispatchLimit?:(number|null),
 *   purpose?:string, access?:(string|null), settings?:(Record<string, unknown>|null),
 *   native_limits?:Record<string, unknown>, acceptanceVersion?:number, preparedPlan?:object|null,
 *   gate?:(((store:any)=>{code:string, detail:unknown}[])|null)}} input
 */
export function deliverSelection({
  store,
  raw,
  file,
  cbidx,
  witness = null,
  bookRaw,
  requestedDisposition,
  outcome = null,
  criteria = [],
  scratchScope,
  publicationScope,
  grant,
  profileAdmission,
  backend_id,
  reservation,
  instruction,
  workspace,
  command,
  now = null,
  nextJobCost = null,
  repairDispatchLimit = null,
  purpose = "start",
  access = null,
  settings = null,
  native_limits = {},
  gate = null,
  acceptanceVersion = 1,
  preparedPlan = null,
}) {
  if (bookRaw === undefined) {
    throw new ContractError("deliverSelection requires bookRaw (the Master Book text, or null when unreadable)");
  }
  const frozen = freezeSelectedItem({
    raw,
    file,
    cbidx,
    witness,
    bookRaw,
    acceptanceVersion,
    outcome: outcome || undefined,
    requestedDisposition,
    criteria,
    scratchScope,
    publicationScope,
  });
  if (!frozen.ok) {
    return deepFreeze({
      ok: false,
      refusals: [{ code: ENTRY_REFUSALS.SELECTION, detail: frozen.reason }],
      run_id: null,
      workRef: null,
      contract: null,
      job: null,
      request: null,
    });
  }

  // Re-read the bound source through the locator, so the launch is checked
  // against the row as it is *now* rather than as it was when the click landed.
  const recheck = recheckContractSource({ raw, workRef: frozen.workRef, contract: frozen.contract, bookRaw });
  const sourceFresh = Boolean(recheck.resolved && recheck.freshness && recheck.freshness.fresh);

  // A repeated command belongs to the run it first admitted into. Otherwise the
  // first attempt number whose run is not closed: a closed run is history, and a
  // later delivery of the same contract is its successor, not a rewrite.
  const priorCommand = store.getCommand ? store.getCommand(command.command_id) : null;
  let priorRun = null;
  if (priorCommand && priorCommand.outcome_json) {
    try {
      const recorded = JSON.parse(String(priorCommand.outcome_json));
      const priorJob = recorded && recorded.job_id ? store.getJob(recorded.job_id) : null;
      priorRun = priorJob ? String(priorJob.run_id) : recorded?.run_id || null;
    } catch {
      priorRun = null;
    }
  }
  let attempt = 0;
  let run_id = priorRun;
  while (!run_id) {
    const candidate = deriveRunId({
      work_id: frozen.workRef.work_id,
      contract_id: frozen.contract.contract_id,
      contract_revision: frozen.contract.revision,
      attempt,
    });
    const existing = store.getRun(candidate);
    if (!existing || existing.lifecycle !== "CLOSED") run_id = candidate;
    else attempt += 1;
  }

  return store.transaction(() => {
    if (preparedPlan) {
      const admitted = store.admitCommand({ ...command, kind: "Deliver:prepare", subject_id: run_id });
      if (admitted.status === "conflict") return deepFreeze({ ok: false, refusals: [{ code: ADMISSION_REFUSALS.COMMAND_CONFLICT, detail: admitted.reason }], run_id, job: null });
      if (admitted.status === "duplicate") return deepFreeze({ ...admitted.outcome, duplicate: true });
      // No provider/job reservation is created. Real dispatch repeats grant,
      // qualification, resources, holds and coordination through admitContinuation.
      const authority = evaluateGrant(grant, { now: now || store.now(), contract: frozen.contract, executor_profile_id: profileAdmission.profile_id, effect: "native_dispatch", settled: 0, reserved: 0, nextJob: 0 });
      if (!sourceFresh || !authority.permitted) {
        const rejected = { ok: false, refusals: [{ code: !sourceFresh ? ENTRY_REFUSALS.STALE_SOURCE : ADMISSION_REFUSALS.GRANT, detail: authority.refusals }], run_id: null, job: null };
        store.recordCommandOutcome(command.command_id, rejected);
        return deepFreeze(rejected);
      }
      store.putWorkRef(frozen.workRef);
      store.putContract(frozen.contract);
      store.putGrant(grant);
      store.insertRun({ run_id, work_id: frozen.workRef.work_id, contract_id: frozen.contract.contract_id, contract_revision: frozen.contract.revision, grant_id: grant.grant_id, grant_revision: grant.revocation_version, lifecycle: "WAITING", waiting_reason: "plan-review" });
      store.updateRun(run_id, { settings_json: settings, waiting_reason: "plan-review" });
      const proposed = recordPlan({ store, run: store.getRun(run_id), contract: frozen.contract, job_id: null, replyText: JSON.stringify({ ...preparedPlan, preparation: { kind: "selected-item", provenance: preparedPlan.provenance, risk: preparedPlan.risk, ownerReviewed: preparedPlan.ownerReviewed, dependencies: preparedPlan.dependencies, acceptance_fingerprint: frozen.contract.acceptance_fingerprint } }) });
      store.appendRunEvent(run_id, "plan.prepared", { plan_id: proposed.plan.plan_id, source: frozen.contract.acceptance_fingerprint, provenance: preparedPlan.provenance, actor: command.actor });
      const answer = { ok: true, prepared: true, duplicate: false, refusals: [], run_id, workRef: frozen.workRef, contract: frozen.contract, job: null, request: null, sourceFresh };
      store.recordCommandOutcome(command.command_id, answer);
      return deepFreeze(answer);
    }
    store.putWorkRef(frozen.workRef);
    store.putContract(frozen.contract);
    store.putGrant(grant);
    if (!store.getRun(run_id)) {
      store.insertRun({
        run_id,
        work_id: frozen.workRef.work_id,
        contract_id: frozen.contract.contract_id,
        contract_revision: frozen.contract.revision,
        grant_id: grant.grant_id,
        grant_revision: grant.revocation_version,
        lifecycle: "ACTIVE",
      });
      if (settings) store.updateRun(run_id, { settings_json: settings });
    }

    const admission = admitJob({
      store,
      run_id,
      contract: frozen.contract,
      grant,
      profileAdmission,
      purpose,
      backend_id,
      reservation,
      instruction,
      workspace: access ? { ...workspace, access } : workspace,
      command,
      now,
      sourceFresh,
      nextJobCost,
      repairDispatchLimit,
      settings,
      native_limits,
      gate,
    });

    const refusals = [...admission.refusals];
    if (!sourceFresh && !refusals.some((entry) => entry.code === ADMISSION_REFUSALS.SOURCE_STALE)) {
      refusals.push({ code: ENTRY_REFUSALS.STALE_SOURCE, detail: recheck.reason ?? "the bound row has changed" });
    }

    return deepFreeze({
      ok: admission.admitted,
      duplicate: admission.duplicate,
      refusals,
      run_id,
      workRef: frozen.workRef,
      contract: frozen.contract,
      job: admission.job,
      request: admission.request,
      sourceFresh,
    });
  });
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * What the owner sees for a run, and what is actually left for them to do.
 *
 * Built from persisted records every time — no cached view, no in-memory run
 * state. A reload after a crash therefore shows the same unknown jobs, the same
 * pending decisions and the same result, which is the whole of the "reload shows
 * current unknown/decision/result" fixture.
 *
 * When there is no evaluated Result yet, this does not invent one. It reports the
 * run's actual position and the next honest owner action, because a projection
 * that fabricates a provisional verdict is how a dashboard ends up greener than
 * the engineering.
 *
 * @param {{store:object, run_id:string}} input
 * @returns {{ok:boolean, refusal:({code:string, detail:unknown}|null), run?:object,
 *   jobs?:object[], decisions?:object[], unknownJobs?:{job_id:string, reason:string}[],
 *   resources?:object, result?:(object|null), ownerAction?:string}}
 */
export function projectRun({ store, run_id }) {
  const run = store.getRun(run_id);
  if (!run) {
    return deepFreeze({ ok: false, refusal: { code: ENTRY_REFUSALS.UNKNOWN_RUN, detail: run_id } });
  }
  const contract = store.getContract(String(run.contract_id), Number(run.contract_revision));
  const jobs = store.listJobs(run_id);
  const decisions = store.listDecisions(run_id);

  const unknownJobs = jobs
    .filter((job) => job.status === "unknown" || (job.dispatch_started_at && job.status !== "finished"))
    .map((job) => ({
      job_id: String(job.job_id),
      reason: String(job.reason || "outstanding dispatch"),
    }));

  const resources = resourceSummary(store, {
    run_id,
    unit: String(jobs[0] ? jobs[0].reservation_unit : "usd"),
  });

  const result = contract
    ? buildResult({
        contract,
        run_id,
        candidate: null,
        criteriaSummary: summarizeCriteria([], []),
        job_receipt_refs: jobs.map((job) => String(job.job_id)),
        unknownJobs,
        resourceSummary: resources,
        observedDisposition: "none",
        closed_outcome: run.closed_outcome ? String(run.closed_outcome) : null,
        projection_status: "current",
      })
    : null;

  return deepFreeze({
    ok: true,
    refusal: null,
    run: {
      run_id: String(run.run_id),
      work_id: String(run.work_id),
      lifecycle: String(run.lifecycle),
      contract_id: String(run.contract_id),
      contract_revision: Number(run.contract_revision),
      closed_outcome: run.closed_outcome ? String(run.closed_outcome) : null,
    },
    jobs: jobs.map((job) => ({
      job_id: String(job.job_id),
      purpose: String(job.purpose),
      // Which executor actually ran this job. Read off the row rather than off the
      // current selection, so a historical run keeps naming the provider it used
      // even after the installation switches.
      backend_id: String(job.backend_id),
      status: String(job.status),
      outcome: job.outcome ? String(job.outcome) : null,
      dispatched: Boolean(job.dispatch_started_at),
      native_ref: job.native_ref ? String(job.native_ref) : null,
      reservationOpen: Boolean(job.reservation_open),
      publicationRevoked: Boolean(job.publication_revoked),
      reason: job.reason ? String(job.reason) : null,
    })),
    decisions: decisions.map((decision) => ({
      decision_id: String(decision.decision_id),
      subject_id: String(decision.subject_id),
      subject_revision: Number(decision.subject_revision),
      kind: String(decision.kind),
      answer: decision.answer ? String(decision.answer) : null,
    })),
    unknownJobs,
    resources,
    result,
    ownerAction: ownerAction({ run, jobs, unknownJobs, result }),
  });
}

/**
 * The single concrete thing the owner can do next.
 *
 * Ordered by what blocks what, and deliberately short — Hard Rule #28: the
 * screen states what is, not why. Anything longer than a clause belongs in the
 * Result's `next_safe_action`, which is right beside it.
 */
function ownerAction({ run, jobs, unknownJobs, result }) {
  if (unknownJobs.length) return "Reconcile " + unknownJobs.length + " outstanding job" + (unknownJobs.length === 1 ? "" : "s");
  if (!jobs.length) return "Dispatch";
  if (jobs.some((job) => job.status === "reserved" && !job.dispatch_started_at)) return "Dispatch";
  if (result && result.workComplete) return "Nothing outstanding";
  if (result && result.candidateVerified) return "Apply the candidate";
  if (run.lifecycle === "CLOSED") return "Review the result";
  return "Await checks";
}

// ---------------------------------------------------------------------------
// HTTP surface
// ---------------------------------------------------------------------------

const json = (status, body) => ({ status, json: body });

/**
 * Route one V2 entry request.
 *
 * Four routes and no more. `GET mode` is unauthenticated because reading which
 * engine is active is not a consequential command; everything that changes state
 * goes through `authenticateCommand` first.
 *
 * `ctx.deliver` is injected rather than built here: the entry point should not be
 * the thing that decides a contract's criteria, its scratch scope or its grant.
 * Those are policy, they come from the caller, and keeping the seam explicit is
 * what stops this file from growing a default policy nobody authorized.
 *
 * Command Center Phase 3: every consequential request and every run read carries
 * a paired local session (or the bridge credential); the actor comes from that
 * credential, never from the body. The executor is chosen per run.
 *
 * @param {{method:string, path:string, query?:URLSearchParams, body?:any,
 *   headers?:Record<string, any>}} req
 * @param {{root:string, store?:any, allowedOrigins?:string[], deliver?:any, journey?:any,
 *   describeExecutors?:any, hasStore?:any, listExecutors?:any,
 *   activeV1Writers?:any, unreconciledV2Jobs?:any, now?:any}} ctx
 * @returns {Promise<({status:number, json:any, headers?:Record<string, string>}|null)>}
 */
export async function routeDeliveryV2({ method, path, query, body = {}, headers = {} }, ctx) {
  if (!path.startsWith("/api/delivery/v2/")) return null;

  if (method === "GET" && path === "/api/delivery/v2/mode") {
    return json(200, readDispatchMode({ root: ctx.root }));
  }

  // Whether this browser is paired, and its CSRF token. Readable only same-origin.
  if (method === "GET" && path === "/api/delivery/v2/session") {
    return json(200, sessionView({ root: ctx.root, headers }));
  }

  // The executor catalogue with each backend's qualification, supported efforts
  // and the installation's model list. Not a command, so not authenticated.
  if (method === "GET" && (path === "/api/delivery/v2/executor" || path === "/api/delivery/v2/executors")) {
    const catalogue = ctx.describeExecutors
      ? await ctx.describeExecutors()
      : { executors: ctx.listExecutors ? ctx.listExecutors() : listExecutors() };
    return json(200, { ...catalogue, selection: "per-run", legacySelection: readExecutorSelection({ root: ctx.root }) });
  }

  if (method === "POST" && path === "/api/delivery/v2/session/pair") {
    const origin = checkOrigin({ headers, allowedOrigins: ctx.allowedOrigins || [] });
    if (!origin.ok) {
      return json(403, { error: origin.refusal ? origin.refusal.code : ENTRY_REFUSALS.CROSS_ORIGIN, detail: origin.refusal ? origin.refusal.detail : null });
    }
    const paired = pairSession({ root: ctx.root, code: String((body && body.code) || ""), kind: "browser" });
    if (!paired.ok || !paired.token) {
      return json(403, { error: paired.refusal ? paired.refusal.code : "pairing-code-invalid", detail: paired.refusal ? paired.refusal.detail : null });
    }
    const view = sessionView({ root: ctx.root, headers: { cookie: SESSION_COOKIE + "=" + paired.token } });
    return { status: 200, json: view, headers: { "Set-Cookie": sessionCookie(paired.token) } };
  }

  const auth = authenticateLocal({ root: ctx.root, headers, allowedOrigins: ctx.allowedOrigins || [] });
  if (!auth.ok || !auth.actor) {
    return json(auth.status, { error: auth.refusal ? auth.refusal.code : ENTRY_REFUSALS.UNAUTHENTICATED, detail: auth.refusal ? auth.refusal.detail : null });
  }

  if (method === "POST" && path === "/api/delivery/v2/session/revoke") {
    const lower = {};
    for (const [key, value] of Object.entries(headers || {})) lower[String(key).toLowerCase()] = value;
    revokeSession({ root: ctx.root, token: parseCookies(lower.cookie)[SESSION_COOKIE] });
    return { status: 200, json: { paired: false, actor: null, csrf: null }, headers: { "Set-Cookie": clearedSessionCookie() } };
  }

  if (method === "GET" && path === "/api/delivery/v2/runs") {
    const available = ctx.journey && (!ctx.hasStore || ctx.hasStore());
    return json(200, { runs: available ? ctx.journey.list() : [] });
  }

  // Command Center Phase 5: slots, waiting items with their verdicts, owner
  // decisions, and an item's verdict before it launches.
  if (method === "GET" && path === "/api/delivery/v2/queue") {
    const available = ctx.journey && (!ctx.hasStore || ctx.hasStore());
    return json(200, { queue: available ? ctx.journey.queue() : null });
  }

  // Owner test gate: whether a new delivery waits for the laptop test result.
  if (method === "GET" && path === "/api/delivery/v2/test-gate") {
    const available = ctx.journey && (!ctx.hasStore || ctx.hasStore());
    return json(200, { gate: available ? ctx.journey.testGate() : { locked: false, application: null, record: null } });
  }

  // Owner allowance settings (Settings panel): shared window, task default, per-run top-ups.
  if (method === "GET" && path === "/api/delivery/v2/allowances") {
    const available = ctx.journey && (!ctx.hasStore || ctx.hasStore());
    return json(200, { allowances: available ? ctx.journey.allowances() : null });
  }

  if (method === "GET" && path === "/api/delivery/v2/assess") {
    if (!ctx.journey) return json(404, { error: ENTRY_REFUSALS.UNKNOWN_RUN, detail: null });
    const outcome = ctx.journey.assess({
      file: (query && query.get("file")) || "",
      id: (query && query.get("id")) || "",
      withoutStore: Boolean(ctx.hasStore && !ctx.hasStore()),
    });
    return json(outcome.ok ? 200 : 409, outcome);
  }

  // The recorded outcome of one command id, so a caller that lost a reply can ask
  // instead of resending. Only the actor who sent it may read it.
  if (method === "GET" && path === "/api/delivery/v2/command") {
    const command_id = (query && query.get("id")) || "";
    const state = ctx.journey && (!ctx.hasStore || ctx.hasStore()) ? ctx.journey.commandState(command_id) : null;
    if (!state || state.actor !== auth.actor) return json(404, { error: "unknown-command", detail: command_id });
    return json(200, state);
  }

  if (method === "GET" && path === "/api/delivery/v2/run/events") {
    const run_id = (query && query.get("id")) || "";
    const after = Number((query && query.get("after")) || 0);
    if (!ctx.journey) return json(404, { error: ENTRY_REFUSALS.UNKNOWN_RUN, detail: run_id });
    return json(200, { events: ctx.journey.events(run_id, after) });
  }

  if (method === "POST" && path === "/api/delivery/v2/mode") {
    const outcome = setDispatchMode({
      root: ctx.root,
      mode: String(body.mode || ""),
      actor: auth.actor,
      activeV1Writers: ctx.activeV1Writers ? ctx.activeV1Writers() : [],
      unreconciledV2Jobs: ctx.unreconciledV2Jobs ? ctx.unreconciledV2Jobs() : [],
      now: ctx.now ? ctx.now() : null,
    });
    return json(outcome.ok ? 200 : 409, outcome);
  }

  // Superseded 2026-09-11: the executor belongs to the run, not the installation.
  if (method === "POST" && path === "/api/delivery/v2/executor") {
    return json(410, {
      error: ENTRY_REFUSALS.SELECTION_PER_RUN,
      detail: "choose the executor, model and effort on each run",
    });
  }

  if (method === "GET" && path === "/api/delivery/v2/run") {
    const run_id = (query && query.get("id")) || "";
    const projection = ctx.journey ? ctx.journey.detail(run_id) : projectRun({ store: ctx.store, run_id });
    return json(projection.ok ? 200 : 404, projection);
  }

  if (method === "POST" && path === "/api/delivery/v2/deliver") {
    const mode = readDispatchMode({ root: ctx.root });
    if (mode.mode !== "v2") {
      return json(409, {
        error: ENTRY_REFUSALS.V2_ROUTE_DISABLED,
        detail: "this installation is in v1 dispatch mode",
      });
    }
    // The run names its executor. There is no installation default to fall back
    // on, and an unknown name is refused rather than resolved to something.
    if (body.executor == null || String(body.executor).trim() === "") {
      return json(409, { error: ENTRY_REFUSALS.NO_EXECUTOR, detail: "choose Claude or Codex for this run" });
    }
    const requested = resolveExecutorChoice(body.executor);
    if (!requested) {
      return json(409, { error: ENTRY_REFUSALS.BAD_EXECUTOR, detail: String(body.executor) });
    }
    if (ctx.journey) {
      const outcome = await ctx.journey.deliver({
        file: body.file,
        cbidx: body.cbidx,
        witness: body.witness,
        expectLine: body.expectLine,
        expectId: body.expectId,
        executor: requested.backend_id,
        model: body.model ?? null,
        effort: body.effort ?? null,
        workProfile: body.workProfile ?? null,
        requestedDisposition: body.requestedDisposition,
        command_id: body.command_id,
        actor: auth.actor,
      });
      return json(outcome.ok ? 200 : 409, outcome);
    }
    if (typeof ctx.deliver !== "function") {
      // Not an error — the normal state of an installation whose pilot gate
      // policy has not been authorized yet. S1.4: "Future implementation
      // authorization identifies the pilot's gate policy explicitly." The entry
      // point refuses rather than inventing criteria, a scratch scope or a grant.
      return json(409, {
        error: ENTRY_REFUSALS.NO_POLICY,
        detail: "no deliver policy is configured for this installation; a pilot gate policy must be authorized and installed first",
      });
    }
    const outcome = await ctx.deliver({
      ...body,
      actor: auth.actor,
      session: auth.session_id,
      executor: requested.backend_id,
    });
    return json(outcome.ok ? 200 : 409, outcome);
  }

  if (method === "POST" && ctx.journey) {
    const actor = auth.actor;
    const text = (value) => (value == null ? "" : String(value));
    const reply = (outcome) =>
      json(
        outcome.ok ? 200 : outcome.refusals && outcome.refusals.some((entry) => entry.code === ENTRY_REFUSALS.UNKNOWN_RUN) ? 404 : 409,
        outcome,
      );
    if (path === "/api/delivery/v2/apply") {
      return reply(
        await ctx.journey.apply({
          run_id: text(body.run_id),
          action: text(body.action || "apply"),
          candidate_id: body.candidate_id == null ? null : String(body.candidate_id),
          result_ref: body.result_ref == null ? null : String(body.result_ref),
          application_id: body.application_id == null ? null : String(body.application_id),
          preview_digest: body.preview_digest == null ? null : String(body.preview_digest),
          expected_revision: body.expected_revision == null ? null : Number(body.expected_revision),
          command_id: text(body.command_id),
          actor,
        }),
      );
    }
    if (path === "/api/delivery/v2/decision") {
      return reply(
        await ctx.journey.decide({
          run_id: text(body.run_id),
          plan_id: text(body.plan_id),
          plan_revision: Number(body.plan_revision),
          contract_revision: body.contract_revision == null ? null : Number(body.contract_revision),
          decision: text(body.decision),
          feedback: body.feedback == null ? null : String(body.feedback),
          command_id: text(body.command_id),
          actor,
        }),
      );
    }
    if (path === "/api/delivery/v2/answer") {
      return reply(
        await ctx.journey.answer({
          run_id: text(body.run_id),
          question_id: text(body.question_id),
          plan_revision: Number(body.plan_revision),
          answer: text(body.answer),
          command_id: text(body.command_id),
          actor,
        }),
      );
    }
    if (path === "/api/delivery/v2/message") {
      return reply(await ctx.journey.message({ run_id: text(body.run_id), body: text(body.body), command_id: text(body.command_id), actor }));
    }
    if (path === "/api/delivery/v2/test-gate") {
      return reply(
        ctx.journey.recordTests({
          application_id: text(body.application_id),
          result: text(body.result),
          proceed: body.proceed === true,
          note: body.note == null ? null : String(body.note),
          command_id: text(body.command_id) || null,
          actor,
        }),
      );
    }
    if (path === "/api/delivery/v2/allowances") {
      return reply(
        ctx.journey.changeAllowance({
          action: text(body.action),
          limit: body.limit ?? null,
          period: body.period ?? null,
          run_id: body.run_id == null ? null : String(body.run_id),
          amount: body.amount ?? null,
          command_id: text(body.command_id) || null,
          actor,
        }),
      );
    }
    if (path === "/api/delivery/v2/control") {
      return reply(
        await ctx.journey.control({
          run_id: text(body.run_id),
          action: text(body.action),
          command_id: text(body.command_id),
          actor,
          executor: body.executor ?? null,
          model: body.model ?? null,
          effort: body.effort ?? null,
          findings: typeof body.findings === "string" ? body.findings : null,
          authorize_revision: body.authorize_revision === true,
        }),
      );
    }
  }

  return json(404, { error: "unknown v2 delivery route" });
}

/** Convenience for callers that hold a repo-relative path in either separator style. */
export const entryPath = normalizePath;

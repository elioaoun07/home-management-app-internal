// scripts/delivery-v2/journey.mjs
// Command Center Phase 3 — one selected item from plan to a truthful Result.
//
// This is the lifecycle of a single V2 run, expressed as the owner's commands
// (deliver, decide, answer, message, control) over the records that already
// exist. It is not a general orchestration engine: there is no configurable stage
// graph, no scheduler across runs and no role catalogue. Each command admits at
// most one job, every job goes through the same exclusive claim and last-moment
// checks, and every outcome is read back from the store.
//
//   deliver   explicit executor/model/effort → read-only investigation job
//   plan      the investigation's reply becomes plan revision N (+ questions)
//   decide    Approve binds revision N, the contract and the grant → write job
//             that continues the native session; Revise → read-only job again
//   answer    only for the revision a question was asked under
//   message   queued → awaiting next turn → delivered at that job's marker
//   check     quiesce, export, freeze, protected checks in a separate checker,
//             one Result; failed checks may earn one supervisor repair
//   control   pause / stop (stop requested until observed) / resume /
//             reconcile (from retained output, never a relaunch) / recheck /
//             close / retry-projection / acknowledge-usage / handoff
//
// A worker runtime is required to dispatch. Fixtures inject a fake one; the
// installation uses the container boundary in worker-boundary.mjs.

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { ContractError, contentId, deepFreeze, evaluateGrant, makeCheckpoint, makeLocator, makeWorkRef, normalizePath, revokeGrant } from "./contracts.mjs";
import {
  hashFile,
  inspectDestination,
  inspectOperations,
  integratedSnapshot,
  planApplication,
  prepareJournal,
  previewIntegration,
  previewRollback,
  rollbackOperations,
  writeOperations,
} from "./apply.mjs";
import { appendResultVersion } from "./results.mjs";
import {
  ADMISSION_REFUSALS,
  DISPATCH_REFUSALS,
  RETRY_VERDICTS,
  admitJob,
  dispatchJob,
  evaluateResources,
  reconcileOutstanding,
  releaseStaleClaims,
  requestStop,
  resourceSummary,
} from "./jobs.mjs";
import { buildDeliver, buildGrant, loadExecutionPolicy, masterBookFor, recommendWorkProfile, resolveWorkFile, WORK_PROFILE_CONTRACTS } from "./policy.mjs";
import { acceptanceText, recheckContractSource } from "./work-ref.mjs";
import { bindAdapterResult, makeExecutionRef } from "./adapters/adapter.mjs";
import {
  admitExecutorProfile,
  createExecutor,
  describeExecutor,
  resolveExecutorChoice,
  validateRunSettings,
  verifyEffectiveSettings,
} from "./adapters/registry.mjs";
import { loadQualification } from "./qualification.mjs";
import { gateState, readTestGate, recordTestResult, TEST_GATE_REFUSALS } from "./test-gate.mjs";
import { applyAllowanceChange, effectiveGrant, effectivePolicy, fleetWindow, readAllowances, runAllowance, writeAllowances } from "./allowances.mjs";
import {
  STAGES,
  answerQuestion,
  approvalFor,
  decidePlan,
  extractQuestions,
  handoffInstruction,
  implementationInstruction,
  investigationInstruction,
  latestPlan,
  messageReceipt,
  openBlockingQuestions,
  parseEngineerReply,
  queueMessage,
  recordBuildQuestions,
  recordPlan,
  repairInstruction,
  stageProjection,
} from "./interaction.mjs";
import { CHECK_REFUSALS, pinCheckPlan, restrictedEnv, runCheck, verifyReceipt } from "./checks.mjs";
import {
  TYPECHECK_CRITERION_ID,
  TYPECHECK_STATE,
  runTypecheckVerification,
  spawnTypecheck,
  verificationIsFresh,
  writeTypecheckArtifact,
} from "./typecheck.mjs";
import { evaluateCriterion, summarizeCriteria } from "./criteria.mjs";
import { candidateChangedPaths, candidateFreshness, checkPublicationScope } from "./candidate.mjs";
import { candidateReview } from "./review.mjs";
import { buildResult, postCheckRepairPolicy } from "./results.mjs";
import {
  COORDINATION_REFUSALS,
  DEFAULT_CONCURRENCY,
  REASONS as COORDINATION_REASONS,
  VERDICTS,
  VERDICT_LABELS,
  checkResourcesFor,
  consumedPaths,
  coordinate,
  coordinationRules,
  filesUnder,
  fleetOf,
  isQueueable,
  itemFacts,
  itemReasons,
  makeFootprint,
  overlaps,
  readBacklog,
  relate,
  scopeGrowth,
  verdictFromRefusals,
  verdictOf,
} from "./coordination.mjs";
import { ACTIVE_APPLICATION_STATES } from "./store.mjs";
import { fileTasks } from "../pm/shared/tasks.mjs";
import { normalizeWorkId } from "../pm/shared/work-id.mjs";

export const JOURNEY_REFUSALS = Object.freeze({
  NO_POLICY: "no-deliver-policy-configured",
  NO_RUNTIME: "no-worker-runtime-configured",
  COMMAND_REQUIRED: "command-id-required",
  COMMAND_CONFLICT: "command-conflict",
  COMMAND_IN_FLIGHT: "command-without-recorded-outcome",
  RUN_ACTIVE: "work-already-has-active-run",
  UNKNOWN_RUN: "unknown-run",
  RUN_CLOSED: "run-closed",
  OUTSTANDING: "outstanding-job",
  NOT_RESUMABLE: "run-not-resumable",
  PAUSED: "run-paused",
  SOURCE_STALE: "stale-selected-source",
  POLICY_MOVED: "policy-revision-moved",
  APPROVAL: "approval-required",
  SETTINGS_MISMATCH: "effective-settings-mismatch",
  NO_RESULT: "no-result",
  NO_FAILED_PROJECTION: "no-failed-projection",
  NOT_PERMITTED: "executor-not-permitted-by-policy",
  UNKNOWN_ACTION: "unknown-action",
  ERROR: "journey-error",
  CONTRACT_MOVED: "contract-revision-moved",
  APPLY_NOT_VERIFIED: "no-verified-candidate-to-apply",
  APPLY_UNVERIFIED_TYPECHECK: "required-verification-missing-failed-or-stale",
  APPLY_STALE: "apply-approval-stale",
  APPLY_ALREADY: "candidate-already-applied",
  APPLY_REFUSED: "application-refused",
  APPLY_CONFLICT: "application-conflict",
  APPLY_IN_PROGRESS: "application-in-progress",
  APPLY_FAILED: "application-failed",
  APPLY_STATE: "application-not-in-that-state",
  APPLY_REASSESSMENT: "checks-fail-on-current-source",
  ROLLBACK_PREVIEW_REQUIRED: "rollback-preview-required",
  ROLLBACK_PREVIEW_STALE: "rollback-preview-stale",
  NOT_RELEASABLE: "no-candidate-to-release",
});

/** Application states after which a new application of the same candidate may be attempted. */
const RETRYABLE_APPLICATION_STATES = Object.freeze(["refused", "conflict", "failed", "rolled-back", "reassessment-failed"]);

/** Waiting states the queue admits or resumes when their coordination reasons clear. */
const WAITING_REASONS = Object.freeze(["queued", "scope-conflict"]);

/** Owner actions the queue lists as decisions. */
const DECISION_KINDS = Object.freeze([
  "review-plan",
  "revise",
  "answer",
  "apply",
  "reconcile",
  "settings",
  "resolve-application",
  "review-result",
  "retry-projection",
  "resume",
  "application-checks",
]);

/** Reasons an item cannot start at all, as opposed to waiting its turn. */
const START_BLOCKERS = Object.freeze([
  COORDINATION_REASONS.SAME_ITEM,
  COORDINATION_REASONS.HELD,
  COORDINATION_REASONS.DEPENDENCY_OPEN,
  COORDINATION_REASONS.DEPENDENCY_CANCELLED,
  COORDINATION_REASONS.DEPENDENCY_UNRESOLVED,
]);

const OUTSTANDING_STATUSES = Object.freeze(["reserved", "active", "paused", "unknown"]);
const RESUMABLE_REASONS = Object.freeze([
  "paused",
  "refused-at-dispatch",
  "dispatch-error",
  "continuation-refused",
  "investigation-failed",
  "export-failed",
  "repair-refused",
  "approval-stale",
]);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const errorText = (error) => String((error && error.message) || error);

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Supervisor-owned data outside the host checkout (frozen candidates). */
export function defaultDataRoot(root) {
  const base = process.env.LOCALAPPDATA || join(homedir(), ".local", "share");
  return join(base, "era-delivery-v2", createHash("sha256").update(String(root)).digest("hex").slice(0, 12));
}

const planView = (row) => (row ? { plan_id: String(row.plan_id), revision: Number(row.revision), body: parseJson(row.body_json, {}) } : null);

/**
 * The PM writeback: one dated line in the campaign Master Book's Delivery session
 * log. Idempotent by result version, and compare-and-swap on the file, so a retry
 * after a failure writes once and a concurrent CLI edit is not overwritten.
 * It never ticks a checkbox: a verified candidate is not an applied change.
 *
 * @param {{root:string, pmRel:string, workRef:any, run:any, result:any, settings:any, date:string,
 *   readFile?:(path:string)=>string, writeFile?:(path:string, text:string)=>void}} input
 */
export function writeSessionLog({
  root,
  pmRel,
  workRef,
  run,
  result,
  settings,
  date,
  label: labelOverride = null,
  marker: markerOverride = null,
  readFile = (path) => readFileSync(path, "utf8"),
  writeFile = null,
}) {
  const bookRel = masterBookFor(workRef.locator.file);
  if (!bookRel) throw new ContractError("no Master Book beside " + workRef.locator.file);
  const resolved = resolveWorkFile({ root, pmRel, file: bookRel });
  if (!resolved.ok || !resolved.path) throw new ContractError(resolved.detail || "unresolvable Master Book");
  const before = readFile(resolved.path);
  const marker = markerOverride ? "<!-- " + markerOverride + " -->" : "<!-- v2:" + result.result_id + "@" + result.result_version + " -->";
  if (before.includes(marker)) return { written: false, path: resolved.path };
  const lines = before.split("\n");
  const heading = lines.findIndex((line) => /^## Delivery session log\s*$/u.test(line));
  if (heading < 0) throw new ContractError("the Master Book has no Delivery session log section");
  let at = heading + 1;
  while (at < lines.length && (lines[at].trim() === "" || /^\*\(.*\)\*$/u.test(lines[at].trim()))) at += 1;
  const label = labelOverride
    ? labelOverride
    : result.observedDisposition === "applied_change"
      ? "applied; integrated checks passed"
      : result.candidateVerified
        ? "candidate verified; not applied"
        : run.closed_outcome === "cancelled"
          ? "cancelled"
          : "not verified (" + [...new Set(result.remaining_obligations.map((entry) => entry.kind))].join(", ") + ")";
  const line =
    "- " + date + " — **" + (workRef.alias || "item") + "** V2 run `" + run.run_id + "` · " + label + " · " +
    String((settings && settings.executor) || "executor") + (settings && settings.model ? " " + settings.model : "") + " " + marker;
  lines.splice(at, 0, line);
  const next = lines.join("\n");
  const write =
    writeFile ||
    ((path, text) => {
      if (readFile(path) !== before) throw new ContractError("the Master Book changed during writeback; retry");
      const temp = path + ".v2tmp";
      writeFileSync(temp, text, "utf8");
      renameSync(temp, path);
    });
  write(resolved.path, next);
  return { written: true, path: resolved.path };
}

/**
 * @param {{root:string, pmRel:string, store:any, runtime?:any, loadPolicy?:Function,
 *   createAdapter?:Function, describe?:Function, loadQualificationReceipts?:Function,
 *   writeProjection?:Function, readFile?:(path:string)=>string, claimant?:string,
 *   generationsRoot?:string, applicationsRoot?:string, stagingRoot?:string,
 *   applyFaults?:{beforeWrite?:(op:any)=>void, beforeRename?:(op:any)=>void},
 *   now?:()=>string}} input
 */
export function createJourney({
  root,
  pmRel,
  store,
  runtime = null,
  loadPolicy = loadExecutionPolicy,
  createAdapter = createExecutor,
  describe = describeExecutor,
  loadQualificationReceipts = loadQualification,
  writeProjection = writeSessionLog,
  readFile = (path) => readFileSync(path, "utf8"),
  claimant = "journey:" + process.pid + ":" + randomUUID().slice(0, 8),
  generationsRoot = join(defaultDataRoot(root), "generations"),
  applicationsRoot = join(defaultDataRoot(root), "applications"),
  stagingRoot = join(defaultDataRoot(root), "staging"),
  applyFaults = {},
  // The deterministic typecheck runs on the host, outside the model, against the
  // integration target. Injected so fixtures script it without a compiler.
  typecheckExecutor = spawnTypecheck,
  artifactsRoot = join(defaultDataRoot(root), "artifacts"),
  now = () => new Date().toISOString(),
  loadAllowances = readAllowances,
  saveAllowances = writeAllowances,
}) {
  const getStore = typeof store === "function" ? store : () => store;
  const pending = new Set();
  const failures = [];
  const inFlight = new Map();

  const refuse = (code, detail, extra = {}) => deepFreeze({ ok: false, refusals: [{ code, detail }], ...extra });
  const event = (run_id, kind, data = null) => getStore().appendRunEvent(String(run_id), kind, data);

  function track(work) {
    const promise = Promise.resolve()
      .then(work)
      .catch((error) => {
        failures.push(errorText(error));
      })
      .finally(() => pending.delete(promise));
    pending.add(promise);
    return promise;
  }

  async function idle() {
    while (pending.size) await Promise.allSettled([...pending]);
  }

  const schedule = (job_id) => track(() => dispatch(String(job_id)));
  // Owner allowance settings overlay the policy amounts at every check (allowances.mjs).
  const allowancesNow = () => loadAllowances({ root }).settings;
  const fleetSince = () => fleetWindow({ settings: allowancesNow(), now: now() }).since;
  const policyNow = () => {
    const loaded = loadPolicy({ root });
    if (!loaded.ok) return loaded;
    return { ...loaded, policy: effectivePolicy(loaded.policy, { settings: allowancesNow(), now: now() }) };
  };

  // -------------------------------------------------------------------------
  // Coordination (Command Center Phase 5, DLV-106)
  //
  // Rules live in coordination.mjs. Here they are fed the store's and the
  // backlog's facts, evaluated inside each admission transaction and again under
  // the dispatch claim, and a run refused only by them waits in the queue.
  // -------------------------------------------------------------------------

  const host = filesUnder(root);
  let draining = false;
  let drainAgain = false;

  const coordinationOf = (run) => (run ? parseJson(run.coordination_json, null) : null) || {};
  const isWaiting = (run) => Boolean(run) && run.lifecycle === "WAITING" && WAITING_REASONS.includes(String(run.waiting_reason));
  const reservationOf = (policy) => ({ unit: policy.resources.unit, amount: policy.resources.perJobReservation.amount });
  const defaultKind = (purpose, access) => (access !== "write" ? "investigate" : purpose === "repair" ? "repair" : "implement");
  const profileContract = (settings) => WORK_PROFILE_CONTRACTS[settings && settings.work_profile] || WORK_PROFILE_CONTRACTS.investigate;
  /**
   * The limits this dispatch will actually carry — and, when a backend cannot
   * carry one, the fact that it cannot.
   *
   * `maxTurns` reaches the Claude SDK and is enforced there. It is never passed
   * to Codex, whose exec interface has no such option and for whom a whole job
   * is one turn anyway, so recording a number for it states a bound that does
   * not exist (Investigation §5.6, F10). `unsupported` is what the UI reads to
   * avoid showing an inert limit as a live one.
   */
  const backendOf = (executor) => {
    const chosen = resolveExecutorChoice(executor);
    return chosen ? chosen.backend_id : null;
  };
  const nativeLimitsFor = (policy, settings, access, backend_id = null) => {
    const configured = access === "write" ? policy.dispatch.implementationMaxTurns : policy.dispatch.investigationMaxTurns;
    // Focused is a bounded lane even when a legacy policy omitted turn limits.
    const maxTurns = profileContract(settings).investigation === "compact" ? (configured == null ? 12 : Math.min(configured, 12)) : configured;
    const turnsEnforced = String(backend_id || "") !== "codex-exec-sdk";
    return {
      maxTurns: turnsEnforced ? maxTurns : null,
      thresholdUsd: policy.dispatch.thresholdUsd,
      unsupported: turnsEnforced ? [] : ["maxTurns"],
      basis: turnsEnforced
        ? "maxTurns is passed to the executor SDK"
        : "this executor's interface has no turn limit, so none is sent and none is enforced",
    };
  };
  const scheduleDrain = () => track(() => drainQueue());
  const EMPTY_SELF = Object.freeze({ key: null, alias: null, dependencyIds: [], footprint: makeFootprint(), consumes: [], checkResources: [] });

  const backlogNow = () =>
    readBacklog({
      root,
      pmRel,
      readText: (path) => {
        try {
          return readFile(path);
        } catch {
          return null;
        }
      },
    });

  /** An item's declared facts from its checklist row and Master Book, as they read now. */
  function itemSource(file, alias) {
    const sources = readSources(file);
    const key = normalizeWorkId(alias);
    const row = sources.raw && key ? fileTasks(sources.raw).find((task) => task.idChip === key) : null;
    return { sources, title: row ? row.text : "", facts: itemFacts({ alias, title: row ? row.text : "", bookRaw: sources.bookRaw }) };
  }

  const aliasOfRun = (run) => {
    const row = getStore().getWorkRef(String(run.work_id));
    return row && row.alias ? normalizeWorkId(row.alias) : null;
  };
  const sameItemRun = (run, alias) => Boolean(normalizeWorkId(alias)) && aliasOfRun(run) === normalizeWorkId(alias);

  /** What the rules know about a run: declared, approved (or, for display, proposed) and observed scope. */
  function runFacts(run, policy, { intended = false } = {}) {
    const s = getStore();
    const run_id = String(run.run_id);
    const ctx = context(run_id);
    const alias = ctx && ctx.workRef ? ctx.workRef.alias : null;
    const facts = ctx && ctx.workRef ? itemSource(ctx.workRef.locator.file, alias).facts : itemFacts({ alias: null });
    const plans = s.listPlans(run_id).filter((plan) => plan.status === "approved" || (intended && plan.status === "proposed"));
    const planScope = plans.flatMap((plan) => (parseJson(plan.body_json, {}) || {}).scope || []);
    const candidates = s.listCandidates(run_id).map((row) => parseJson(row.record_json, null)).filter(Boolean);
    const observed = candidates.flatMap((candidate) => candidateChangedPaths(candidate).map((entry) => entry.path));
    const footprint = makeFootprint({ declared: facts.declared, plan: planScope, observed });
    const latest = candidates.length ? candidates[candidates.length - 1] : null;
    const rules = coordinationRules(policy.concurrency);
    return {
      run_id,
      key: facts.key,
      alias: facts.alias || run_id,
      held: facts.held,
      dependencyIds: facts.dependencyIds,
      footprint,
      consumes: footprint.known ? consumedPaths({ paths: footprint.paths, readers: latest ? [filesUnder(latest.root), host] : [host] }).paths : [],
      checkResources: ctx && ctx.contract ? checkResourcesFor({ criteria: policy.criteria, criteriaRefs: ctx.contract.criteria_refs || [], rules }) : [],
    };
  }

  /**
   * Runs holding a reservation: a write job that may have written, or a candidate
   * not yet applied, rolled back or released. Only an item's latest run holds one.
   * A run paused on a scope conflict yields until it resumes, so two runs that grew
   * into each other cannot wait on each other forever; the integrator's before-image
   * check still stops a conflicting application.
   */
  function reservingRuns(excludeRunId = null) {
    const s = getStore();
    const runs = s.listRuns();
    const latest = new Map();
    for (const run of runs) {
      const key = aliasOfRun(run) || String(run.work_id);
      const seen = latest.get(key);
      if (!seen || String(run.created_at) > String(seen.created_at)) latest.set(key, run);
    }
    return runs.filter((run) => {
      const run_id = String(run.run_id);
      if (run_id === excludeRunId || (run.lifecycle === "WAITING" && run.waiting_reason === "scope-conflict")) return false;
      const wrote =
        s.listJobs(run_id).some((job) => job.access === "write" && (["reserved", "active", "paused", "unknown"].includes(String(job.status)) || job.dispatch_started_at)) ||
        s.listCandidates(run_id).length > 0;
      if (!wrote) return false;
      if (run.lifecycle !== "CLOSED") return true;
      if (run.closed_outcome !== "verified_candidate" || coordinationOf(run).released_at) return false;
      const application = latestApplication(s, run_id);
      if (application && ["applied", "rolled-back"].includes(String(application.state))) return false;
      const holder = latest.get(aliasOfRun(run) || String(run.work_id));
      return Boolean(holder) && String(holder.run_id) === run_id;
    });
  }

  /** Base-manifest paths within `paths` whose destination bytes changed since the run's snapshot. */
  function baseDrift(run, paths) {
    if (!paths.length) return [];
    const base = parseJson(run.base_manifest_json, []) || [];
    return base
      .filter((entry) => paths.some((path) => overlaps(path, String(entry.path))))
      .filter((entry) => {
        const destination = inspectDestination(root, String(entry.path));
        const current = destination.ok && destination.exists && destination.abs ? hashFile(destination.abs) : null;
        return current !== entry.sha256;
      })
      .map((entry) => String(entry.path));
  }

  function evaluateCoordination(run_id, { access, policy, item = true, pairwise = access === "write", capacity = true, checkDrift = pairwise, reservation = null }) {
    const s = getStore();
    const run = s.getRun(String(run_id));
    if (!run) return coordinate({ self: EMPTY_SELF, item: false, pairwise: false, capacity: false });
    const self = runFacts(run, policy);
    return coordinate({
      self,
      others: pairwise ? reservingRuns(String(run_id)).map((other) => runFacts(other, policy)) : [],
      backlog: item ? backlogNow() : null,
      fleet: capacity ? fleetOf({ store: s, unit: policy.resources.unit, since: fleetSince() }) : null,
      concurrency: policy.concurrency,
      rules: coordinationRules(policy.concurrency),
      access,
      run_id: String(run_id),
      reservation,
      strict: policy.resources.strict,
      drift: checkDrift ? baseDrift(run, self.footprint.paths) : [],
      item,
      pairwise,
      capacity,
    });
  }

  /** Job slots and the fleet allowance only: what a read-only job needs. */
  function evaluateCapacity({ access, policy, run_id = null }) {
    return coordinate({
      self: EMPTY_SELF,
      fleet: fleetOf({ store: getStore(), unit: policy.resources.unit, since: fleetSince() }),
      concurrency: policy.concurrency,
      access,
      run_id,
      reservation: reservationOf(policy),
      strict: policy.resources.strict,
      item: false,
      pairwise: false,
    });
  }

  /** Put a run in (or keep it in) a waiting state with the verdict that holds it. */
  function queueRun(run_id, { verdict, next = undefined, state = "queued" }) {
    const s = getStore();
    const run = s.getRun(String(run_id));
    if (!run || run.lifecycle === "CLOSED") return;
    const prior = coordinationOf(run);
    const reasons = (verdict.reasons || []).slice(0, 12);
    const changed = prior.state !== state || JSON.stringify(prior.reasons || []) !== JSON.stringify(reasons);
    s.updateRun(String(run_id), {
      lifecycle: "WAITING",
      waiting_reason: state,
      coordination_json: {
        ...prior,
        state,
        verdict: verdict.verdict,
        reasons,
        since: prior.state === state && prior.since ? prior.since : now(),
        next: next === undefined ? prior.next ?? null : next,
      },
    });
    if (changed) event(run_id, "coordination.waiting", { state, verdict: verdict.verdict, reasons });
  }

  function clearWaiting(run_id) {
    const s = getStore();
    const run = s.getRun(String(run_id));
    const prior = coordinationOf(run);
    if (!prior.state) return;
    s.updateRun(String(run_id), { coordination_json: { ...prior, state: null, verdict: null, reasons: [], since: null, next: null } });
    event(run_id, "coordination.admitted", { after: prior.state });
  }

  /** The continuation a job refused under its dispatch claim would have been. */
  function nextFor(job) {
    const settings = parseJson(job.settings_json, {}) || {};
    return {
      kind: defaultKind(String(job.purpose), String(job.access)),
      purpose: String(job.purpose),
      access: String(job.access),
      continues_job_id: settings.continues_job_id ?? null,
      actor: "supervisor",
      feedback: null,
    };
  }

  /** Rebuilds a queued continuation's instruction when it is admitted, with the messages queued by then. */
  function instructionFor(run_id, next) {
    return (messages) => {
      const ctx = context(run_id);
      const s = ctx.store;
      const answers = answeredQuestions(run_id);
      const approval = approvalFor({ store: s, run: ctx.run, contract: ctx.contract, grant: ctx.grant });
      const latest = planView(latestPlan(s, run_id));
      const plan = approval.ok ? planView(approval.plan) : latest;
      if ((next.kind === "implement" || next.kind === "repair") && plan) {
        if (next.kind === "implement") return implementationInstruction({ plan, contract: ctx.contract, messages, answers, profile: ctx.settings.work_profile });
        const record = s.latestResult(run_id) ? parseJson(s.latestResult(run_id).record_json, {}) : {};
        return repairInstruction({ plan, failures: (record.criterion_states || []).filter((entry) => entry.state === "failed"), messages });
      }
      if (next.kind === "handoff") {
        const decision = [...s.listDecisions(run_id)].reverse().find((entry) => entry.kind === "executor-handoff");
        const checkpoint = decision ? (parseJson(decision.evidence_seen, {}) || {}).checkpoint : null;
        if (checkpoint) return handoffInstruction({ checkpoint, plan: latest, contract: ctx.contract });
      }
      return investigationInstruction({
        contract: ctx.contract,
        alias: ctx.workRef ? ctx.workRef.alias : null,
        acceptance: acceptanceNow(ctx),
        messages,
        answers,
        feedback: next.feedback || null,
        previous: latest,
      });
    };
  }

  /**
   * Admit what the queue can, oldest first. A waiting run whose own reasons still
   * hold is skipped without spending a command; a later run that can run together
   * with the fleet is not held behind it.
   */
  async function drainQueue() {
    if (draining) {
      drainAgain = true;
      return;
    }
    draining = true;
    try {
      do {
        drainAgain = false;
        const loaded = policyNow();
        if (!loaded.ok || !runtime) return;
        const s = getStore();
        const waiting = s
          .listRuns()
          .filter(isWaiting)
          .sort((a, b) => String(coordinationOf(a).since || a.updated_at).localeCompare(String(coordinationOf(b).since || b.updated_at)));
        for (const row of waiting) {
          const run = s.getRun(String(row.run_id));
          if (!isWaiting(run)) continue;
          if (run.waiting_reason === "scope-conflict") await resumeAfterScopeConflict(run, loaded.policy);
          else await admitQueued(run, loaded.policy);
        }
      } while (drainAgain);
    } finally {
      draining = false;
    }
  }

  async function admitQueued(run, policy) {
    const s = getStore();
    const run_id = String(run.run_id);
    const coordination = coordinationOf(run);
    const next = coordination.next;
    if (!next) return;
    const outstanding = s.listJobs(run_id).find((job) => OUTSTANDING_STATUSES.includes(String(job.status)));
    if (outstanding) {
      // An earlier attempt committed its admission before the run was updated.
      clearWaiting(run_id);
      s.updateRun(run_id, { lifecycle: "ACTIVE", waiting_reason: null });
      if (outstanding.status === "reserved" && !outstanding.dispatch_started_at && !outstanding.dispatch_claim) schedule(outstanding.job_id);
      return;
    }
    const dry =
      next.access === "write"
        ? evaluateCoordination(run_id, { access: "write", policy, reservation: reservationOf(policy) })
        : evaluateCapacity({ access: String(next.access), policy });
    if (!dry.admitted) {
      if (isQueueable(dry.refusals)) {
        queueRun(run_id, { verdict: dry });
      } else {
        s.updateRun(run_id, {
          lifecycle: "WAITING",
          waiting_reason: "continuation-refused",
          coordination_json: { ...coordination, state: null, verdict: dry.verdict, reasons: dry.reasons, since: null, next: null },
        });
        event(run_id, "coordination.refused", { reasons: dry.reasons });
      }
      return;
    }
    const attempt = Number(coordination.attempts || 0) + 1;
    s.updateRun(run_id, { coordination_json: { ...coordination, attempts: attempt } });
    const outcome = await admitContinuation(run_id, {
      kind: next.kind,
      purpose: String(next.purpose),
      access: String(next.access),
      command_id: "queue:" + run_id + ":" + attempt,
      actor: next.actor || "supervisor",
      continues_job_id: next.continues_job_id ?? null,
      feedback: next.feedback ?? null,
      instructionFor: instructionFor(run_id, next),
    });
    if (!outcome.ok && !outcome.queued) {
      const current = s.getRun(run_id);
      s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "continuation-refused", coordination_json: { ...coordinationOf(current), state: null, next: null } });
    }
  }

  async function resumeAfterScopeConflict(run, policy) {
    const s = getStore();
    const run_id = String(run.run_id);
    const verdict = evaluateCoordination(run_id, { access: "write", policy, item: false, capacity: false, checkDrift: false });
    if (verdict.verdict !== VERDICTS.TOGETHER) {
      queueRun(run_id, { verdict, state: "scope-conflict" });
      return;
    }
    const rows = s.listCandidates(run_id);
    const candidate = rows.length ? parseJson(rows[rows.length - 1].record_json, null) : null;
    clearWaiting(run_id);
    if (!candidate) {
      s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "export-failed" });
      return;
    }
    s.updateRun(run_id, { lifecycle: "ACTIVE", waiting_reason: "checking" });
    event(run_id, "coordination.resumed", { candidate_id: candidate.candidate_id });
    await evaluate(run_id, candidate, { allowRepair: true });
  }

  /**
   * Re-observe a candidate's criteria on the source an application would produce.
   * Runs in the checker on a preview generation outside the checkout; writes nothing.
   */
  function reassess(ctx, candidate, policy) {
    const run_id = String(ctx.run.run_id);
    if (!runtime || typeof runtime.checkExecutor !== "function") return { state: "not-run", reason: "no checker runtime" };
    // Evaluated under this application's claim, so its own row is already counted.
    const generation = "P" + ctx.store.listApplications(run_id).length;
    let preview;
    try {
      preview = previewIntegration({ root, candidate, generationsRoot: join(generationsRoot, run_id), generation, stagingRoot });
    } catch (error) {
      return { state: "inconclusive", reason: "preview failed: " + errorText(error), generation };
    }
    const deleted = new Set(candidateChangedPaths(candidate).filter((change) => change.kind === "delete").map((change) => change.path));
    const gaps = preview.refusals.filter((entry) => !(entry.reason === "missing" && (deleted.has(entry.path) || !candidate.manifest.some((file) => file.path === entry.path))));
    const base = parseJson(ctx.run.base_manifest_json, []) || [];
    const { criteria, records, integrity } = evidenceFor({ run_id, candidate: preview.candidate, policy, contract: ctx.contract, base });
    if (!criteria.length) return { state: "not-run", reason: "no criteria", generation };
    const summary = summarizeCriteria(criteria, records);
    const passed = summary.candidate.outstanding.length === 0 && integrity.length === 0 && gaps.length === 0;
    return {
      state: passed ? "passed" : records.some((record) => record.state === "failed") ? "failed" : "inconclusive",
      generation,
      preview_id: preview.candidate.candidate_id,
      evidence: records.map((record) => ({ criterion_id: record.criterion_id, state: record.state, reason: record.reason ?? null, evidence_id: record.evidence_id })),
      integrity,
      gaps,
    };
  }

  /** Mark other runs whose snapshot included paths an application just changed. */
  function noteSourceChange(run_id, paths) {
    if (!paths.length) return;
    const s = getStore();
    const own = context(String(run_id));
    const by = own && own.workRef ? own.workRef.alias : String(run_id);
    for (const other of s.listRuns()) {
      const other_id = String(other.run_id);
      if (other_id === String(run_id) || (other.lifecycle === "CLOSED" && other.closed_outcome !== "verified_candidate")) continue;
      const base = parseJson(other.base_manifest_json, []) || [];
      const touched = base.map((entry) => String(entry.path)).filter((path) => paths.some((changed) => overlaps(changed, path)));
      if (!touched.length) continue;
      s.updateRun(other_id, { coordination_json: { ...coordinationOf(other), source_changed: { by, paths: touched, at: now() } } });
      event(other_id, "coordination.source-changed", { by, paths: touched });
    }
  }

  function coordinationView(run) {
    const value = coordinationOf(run);
    const waiting = isWaiting(run);
    return {
      state: waiting ? String(run.waiting_reason) : null,
      verdict: waiting ? value.verdict || null : null,
      label: waiting && value.verdict ? VERDICT_LABELS[value.verdict] : null,
      reasons: waiting ? value.reasons || [] : [],
      since: waiting ? value.since || null : null,
      grew: value.grew || [],
      released: Boolean(value.released_at),
      sourceChanged: value.source_changed || null,
    };
  }

  /** Aliases of waiting runs whose reasons name this run's item. */
  function holdingFor(ctx) {
    const alias = ctx.workRef ? normalizeWorkId(ctx.workRef.alias) : null;
    if (!alias) return [];
    return getStore()
      .listRuns()
      .filter(isWaiting)
      .filter((run) => (coordinationOf(run).reasons || []).some((reason) => normalizeWorkId(reason.with) === alias))
      .map((run) => {
        const other = context(String(run.run_id));
        return other && other.workRef && other.workRef.alias ? other.workRef.alias : String(run.run_id);
      });
  }

  async function qualify(backend_id) {
    const binding = runtime && typeof runtime.binding === "function" ? await runtime.binding(backend_id) : null;
    return loadQualificationReceipts({ root, backend_id, binding });
  }

  async function profileFor(backend_id, policy) {
    const qualification = await qualify(backend_id);
    const described = await describe(
      backend_id,
      qualification && qualification.ok
        ? {
            observations: qualification.observations,
            qualification_ref: qualification.qualification_ref,
            observed_at: qualification.observed_at,
            runtime: { binding: qualification.binding },
          }
        : {},
    );
    if (!described.ok) return { ok: false, refusal: described.refusal, admission: null, profile: null, qualification };
    const admission = admitExecutorProfile(described.profile, {
      requireConfinement: true,
      strictBoundRequired: policy.executors.strictBoundRequired || policy.resources.strict,
    });
    return {
      ok: admission.admitted,
      refusal: admission.admitted ? null : { code: ADMISSION_REFUSALS.PROFILE, detail: admission.refusals },
      admission,
      profile: described.profile,
      qualification,
    };
  }

  function context(run_id) {
    const s = getStore();
    const run = s.getRun(String(run_id));
    if (!run) return null;
    const contract = s.getContract(String(run.contract_id), Number(run.contract_revision));
    const row = s.getWorkRef(String(run.work_id));
    const workRef = row
      ? makeWorkRef(
          makeLocator({
            file: String(row.file),
            alias: row.alias ? String(row.alias) : null,
            textFingerprint: String(row.text_fingerprint),
            heading: row.heading ? String(row.heading) : null,
            mappingRevision: Number(row.mapping_revision),
          }),
        )
      : null;
    const rawGrant = run.grant_id ? s.getGrant(String(run.grant_id)) : null;
    // Checks see the owner-adjusted allowance; persistence (revocation) uses rawGrant.
    const grant = rawGrant ? effectiveGrant(rawGrant, { settings: allowancesNow(), run_id: String(run.run_id) }) : null;
    return { store: s, run, contract, workRef, grant, rawGrant, settings: parseJson(run.settings_json, {}) || {} };
  }

  function readSources(file) {
    const resolved = resolveWorkFile({ root, pmRel, file });
    if (!resolved.ok || !resolved.path) return { ok: false, reason: resolved.detail, raw: null, bookRaw: null };
    let raw;
    try {
      raw = readFile(resolved.path);
    } catch (error) {
      return { ok: false, reason: errorText(error), raw: null, bookRaw: null };
    }
    const bookRel = masterBookFor(file);
    let bookRaw = null;
    if (bookRel) {
      const book = resolveWorkFile({ root, pmRel, file: bookRel });
      if (book.ok && book.path) {
        try {
          bookRaw = readFile(book.path);
        } catch {
          bookRaw = null;
        }
      }
    }
    return { ok: true, reason: null, raw, bookRaw };
  }

  function sourceFreshness(ctx) {
    if (!ctx.workRef || !ctx.contract) return { fresh: false, reason: "no bound work reference", bookRaw: null };
    const sources = readSources(ctx.workRef.locator.file);
    if (!sources.ok || sources.raw == null) return { fresh: false, reason: sources.reason, bookRaw: null };
    const recheck = recheckContractSource({ raw: sources.raw, workRef: ctx.workRef, contract: ctx.contract, bookRaw: sources.bookRaw });
    const fresh = Boolean(recheck.resolved && recheck.freshness && recheck.freshness.fresh);
    return {
      fresh,
      reason: fresh ? null : recheck.reason || (recheck.freshness ? "changed: " + recheck.freshness.stale.join(", ") : "unresolved"),
      bookRaw: sources.bookRaw,
    };
  }

  const acceptanceNow = (ctx) => (ctx.workRef ? acceptanceText({ bookRaw: readSources(ctx.workRef.locator.file).bookRaw, alias: ctx.workRef.alias }) : null);

  const answeredQuestions = (run_id) =>
    getStore()
      .listQuestions(run_id)
      .filter((question) => question.status === "answered")
      .map((question) => ({ text: String(question.text), answer: String(question.answer) }));

  async function once({ command_id, kind, actor, payload }, perform) {
    if (!isNonEmptyString(command_id)) return refuse(JOURNEY_REFUSALS.COMMAND_REQUIRED, kind);
    const s = getStore();
    const admitted = s.admitCommand({ command_id, kind, actor, payload, subject_id: payload.run_id ?? null });
    if (admitted.status === "conflict") return refuse(JOURNEY_REFUSALS.COMMAND_CONFLICT, admitted.reason);
    if (admitted.status === "duplicate") {
      if (admitted.outcome) return deepFreeze({ ...admitted.outcome, duplicate: true });
      return refuse(JOURNEY_REFUSALS.COMMAND_IN_FLIGHT, command_id);
    }
    let outcome;
    try {
      outcome = await perform();
    } catch (error) {
      outcome = refuse(JOURNEY_REFUSALS.ERROR, errorText(error));
    }
    s.recordCommandOutcome(command_id, outcome);
    return outcome;
  }

  // -------------------------------------------------------------------------
  // Deliver
  // -------------------------------------------------------------------------

  async function deliver(request) {
    const loaded = policyNow();
    if (!loaded.ok) return refuse(JOURNEY_REFUSALS.NO_POLICY, loaded.refusals);
    if (!runtime) return refuse(JOURNEY_REFUSALS.NO_RUNTIME, "configure a container runtime in the execution policy");
    if (!isNonEmptyString(request.command_id)) return refuse(JOURNEY_REFUSALS.COMMAND_REQUIRED, "deliver");
    // Owner test gate: after an Apply, the owner records the laptop test result first.
    const gate = testGate();
    if (gate.locked) return refuse(TEST_GATE_REFUSALS.LOCKED, gate.application);
    const policy = loaded.policy;
    const deliverFn = buildDeliver({ root, pmRel, store: getStore, policyLoader: () => loaded, describeExecutor: describe, readFile, qualify });
    if (!deliverFn) return refuse(JOURNEY_REFUSALS.NO_POLICY, loaded.refusals);
    const capacity = { verdict: null };
    const requestedFacts = itemSource(String(request.file || ""), String(request.expectId || "")).facts;
    const outcome = await deliverFn({
      ...request,
      recommendationFacts: { declared: requestedFacts.declared, dependencyIds: requestedFacts.dependencyIds },
      purpose: "investigate",
      access: "read-only",
      workspace: runtime.workspaceFor({ access: "read-only" }),
      native_limits: nativeLimitsFor(policy, { work_profile: request.workProfile }, "read-only", backendOf(request.executor)),
      instructionFor: ({ contract, workRef, acceptance }) => investigationInstruction({ contract, alias: workRef.alias, acceptance, profile: request.workProfile || "investigate" }),
      beforeAdmit: ({ workRef }) => {
        const s = getStore();
        if (s.getCommand(request.command_id)) return null;
        const open = s.listRuns().filter((run) => run.lifecycle !== "CLOSED");
        // The same item, including one whose row moved to another file.
        const active = open.find((run) => run.work_id === workRef.work_id) || open.find((run) => sameItemRun(run, workRef.alias));
        if (active) return { code: JOURNEY_REFUSALS.RUN_ACTIVE, detail: String(active.run_id) };
        // Held work and unmet prerequisites do not launch early.
        const reasons = itemReasons({ facts: itemSource(workRef.locator.file, workRef.alias).facts, backlog: backlogNow() });
        if (!reasons.length) return null;
        return { code: verdictOf(reasons) === VERDICTS.FOLLOW ? COORDINATION_REFUSALS.FOLLOW : COORDINATION_REFUSALS.SCOPE, detail: reasons };
      },
      // Job slots and the fleet allowance, inside the admission transaction.
      gate: () => {
        capacity.verdict = evaluateCapacity({ access: "read-only", policy });
        return capacity.verdict.refusals;
      },
    });
    if (!outcome.ok && outcome.run_id && isQueueable(outcome.refusals)) {
      const s = getStore();
      const run_id = String(outcome.run_id);
      const run = s.getRun(run_id);
      if (run && run.lifecycle !== "CLOSED") {
        if (!s.listJobs(run_id).length) {
          const first = !coordinationOf(run).next;
          queueRun(run_id, {
            verdict: capacity.verdict || verdictFromRefusals(outcome.refusals),
            next: { kind: "investigate", purpose: "investigate", access: "read-only", continues_job_id: null, actor: request.actor, feedback: null },
          });
          if (first) {
            event(run_id, "run.delivered", {
              queued: true,
              executor: outcome.executor,
              model: outcome.settings ? outcome.settings.model : null,
              effort: outcome.settings ? outcome.settings.effort : null,
              actor: request.actor,
            });
          }
        }
        return deepFreeze({
          ok: true,
          queued: isWaiting(s.getRun(run_id)),
          duplicate: Boolean(outcome.duplicate),
          run_id,
          job_id: null,
          executor: outcome.executor,
          settings: outcome.settings,
          refusals: outcome.refusals,
        });
      }
    }
    if (!outcome.ok || !outcome.job) return outcome;
    const s = getStore();
    const job = s.getJob(String(outcome.job.job_id));
    if (!outcome.duplicate) {
      event(outcome.run_id, "run.delivered", {
        job_id: String(outcome.job.job_id),
        executor: outcome.executor,
        model: outcome.settings ? outcome.settings.model : null,
        effort: outcome.settings ? outcome.settings.effort : null,
        actor: request.actor,
      });
    }
    if (job && job.status === "reserved" && !job.dispatch_started_at && !job.dispatch_claim) schedule(job.job_id);
    return deepFreeze({
      ok: true,
      duplicate: Boolean(outcome.duplicate),
      run_id: String(outcome.run_id),
      job_id: String(outcome.job.job_id),
      executor: outcome.executor,
      settings: outcome.settings,
      refusals: [],
    });
  }

  // -------------------------------------------------------------------------
  // Dispatch
  // -------------------------------------------------------------------------

  function cancelUndispatched(job, reason) {
    const s = getStore();
    const claim = s.transaction(() => s.claimDispatch(String(job.job_id), claimant));
    if (!claim.acquired) return;
    s.updateJob(String(job.job_id), {
      status: "finished",
      outcome: "cancelled",
      reason,
      reservation_open: 0,
      publication_revoked: job.publication_revoked,
    });
    s.requeueMessages(String(job.job_id));
    s.putReceipt({
      receipt_id: "rc-" + job.job_id + "-not-dispatched",
      kind: "job.not-dispatched",
      subject_id: String(job.job_id),
      actor: claimant,
      state_before: "reserved",
      state_after: "finished",
      observed: { reason },
    });
    event(job.run_id, "job.not-dispatched", { job_id: String(job.job_id), reason });
    s.updateRun(String(job.run_id), { lifecycle: "WAITING", waiting_reason: "dispatch-error" });
    scheduleDrain();
  }

  async function preDispatch(current) {
    const refusals = [];
    const ctx = context(String(current.run_id));
    if (!ctx || !ctx.contract || !ctx.grant) {
      return { ok: false, refusals: [{ code: JOURNEY_REFUSALS.UNKNOWN_RUN, detail: String(current.run_id) }] };
    }
    const loaded = policyNow();
    if (ctx.run.lifecycle === "CLOSED") refusals.push({ code: JOURNEY_REFUSALS.RUN_CLOSED, detail: ctx.run.closed_outcome });
    if (["paused", "stop-requested"].includes(String(ctx.run.waiting_reason))) {
      refusals.push({ code: JOURNEY_REFUSALS.PAUSED, detail: ctx.run.waiting_reason });
    }
    if (!loaded.ok) refusals.push({ code: JOURNEY_REFUSALS.NO_POLICY, detail: loaded.refusals });
    else if (loaded.policy.policy_revision !== ctx.grant.policy_revision) {
      refusals.push({ code: JOURNEY_REFUSALS.POLICY_MOVED, detail: "granted under " + ctx.grant.policy_revision + ", installed " + loaded.policy.policy_revision });
    }
    const source = sourceFreshness(ctx);
    if (!source.fresh) refusals.push({ code: JOURNEY_REFUSALS.SOURCE_STALE, detail: source.reason });
    const summary = resourceSummary(ctx.store, { run_id: String(current.run_id), unit: ctx.grant.resource_policy.unit });
    const verdict = evaluateGrant(ctx.grant, {
      now: now(),
      contract: ctx.contract,
      executor_profile_id: String(current.profile_id),
      effect: "native_dispatch",
      settled: summary.settled,
      reserved: summary.reserved,
      nextJob: 0,
    });
    if (!verdict.permitted) refusals.push({ code: ADMISSION_REFUSALS.GRANT, detail: verdict.refusals });
    const resources = evaluateResources({
      grant: ctx.grant,
      summary,
      reservation: { unit: String(current.reservation_unit), amount: current.reservation_amount == null ? null : Number(current.reservation_amount) },
      nextJob: current.reservation_amount == null ? null : 0,
    });
    if (!resources.ok) refusals.push({ code: ADMISSION_REFUSALS.RESOURCES, detail: resources.refusals });
    let profile = null;
    if (loaded.ok) {
      profile = await profileFor(String(current.backend_id), loaded.policy);
      if (!profile.ok) refusals.push(profile.refusal);
      else if (profile.admission.profile_id !== String(current.profile_id)) {
        refusals.push({ code: ADMISSION_REFUSALS.PROFILE, detail: "the executor's qualification changed since admission" });
      }
    }
    if (current.access === "write") {
      const approval = approvalFor({ store: ctx.store, run: ctx.run, contract: ctx.contract, grant: ctx.grant });
      if (!approval.ok) refusals.push({ code: JOURNEY_REFUSALS.APPROVAL, detail: approval.refusal });
      else if (current.plan_id && approval.plan.plan_id !== String(current.plan_id)) {
        refusals.push({ code: JOURNEY_REFUSALS.APPROVAL, detail: "the approved plan changed" });
      }
    }
    if (ctx.settings.mismatch_open) refusals.push({ code: JOURNEY_REFUSALS.SETTINGS_MISMATCH, detail: "an earlier job reported different settings" });
    if (loaded.ok) {
      // Coordination under the claim: a HELD marker, an unmet prerequisite or a
      // reservation that appeared since admission stops this dispatch. Slots were
      // taken at admission, and this job holds its own.
      refusals.push(...evaluateCoordination(String(current.run_id), { access: String(current.access), policy: loaded.policy, capacity: false }).refusals);
    }
    return {
      ok: refusals.length === 0,
      refusals,
      intent: {
        source_fingerprint: ctx.contract.source_fingerprint,
        acceptance_fingerprint: ctx.contract.acceptance_fingerprint,
        grant_id: ctx.grant.grant_id,
        grant_revision: ctx.grant.revocation_version,
        policy_revision: loaded.ok ? loaded.policy.policy_revision : null,
        profile_id: String(current.profile_id),
        qualification_ref: profile && profile.profile ? profile.profile.qualification_ref : null,
        settings: parseJson(current.settings_json, {}),
        plan_id: current.plan_id ?? null,
        checked_at: now(),
      },
    };
  }

  /**
   * Drop the plan JSON from an implementation instruction when — and only when —
   * the thread being resumed is the one that produced that exact plan.
   *
   * Every condition below is a way for the reference to be unresolvable, and each
   * one falls back to the full plan rather than to a cheaper prompt the executor
   * cannot act on:
   *
   *   - not a write continuation, so there is no plan to reference;
   *   - no `priorRef`, so this dispatch is starting a fresh thread;
   *   - the prior job is not the job that produced this plan revision, so the
   *     plan was never in that conversation;
   *   - the instruction does not contain the plan JSON verbatim, so whatever it
   *     contains is not what this function thinks it is.
   *
   * Compaction is never applied when a thread may have been compacted or
   * summarised: `job.purpose === "resume"` with a live `priorRef` is the only
   * shape that qualifies, and a repair — which can follow a long thread — is
   * excluded.
   *
   * Returns a new request, or null to keep the original.
   */
  function planReferenceRequest({ ctx, job, jobSettings, request, priorRef, prior }) {
    if (!priorRef || !prior) return null;
    if (String(job.access) !== "write" || String(job.purpose) !== "resume") return null;
    if (!job.plan_id) return null;
    const s = getStore();
    const plan = planView(s.getPlan(String(job.plan_id)));
    if (!plan) return null;
    // The plan must have been produced BY the job whose thread is being resumed.
    const planRow = s.getPlan(String(job.plan_id));
    if (!planRow || !planRow.job_id || String(planRow.job_id) !== String(prior.job_id)) return null;

    const inline = "\n\nPlan:\n" + JSON.stringify(plan.body);
    const instruction = String(request.instruction || "");
    if (!instruction.includes(inline)) return null;

    const reference =
      "\n\nPlan: the approved plan is revision " +
      plan.revision +
      ", the one you produced earlier in this same conversation. It is unchanged; use it as written.";
    void ctx;
    void jobSettings;
    return { ...request, instruction: instruction.replace(inline, reference) };
  }

  async function dispatch(job_id) {
    const s = getStore();
    const job = s.getJob(job_id);
    if (!job || job.status !== "reserved" || job.dispatch_started_at) return;
    const ctx = context(String(job.run_id));
    if (!ctx || !ctx.contract) return;
    const run_id = String(job.run_id);
    const request = parseJson(job.request_json);
    const jobSettings = parseJson(job.settings_json, {}) || {};

    let provisioned;
    try {
      provisioned = await runtime.provision({
        run_id,
        job,
        include: (ctx.contract.scratchScope && ctx.contract.scratchScope.include) || [],
      });
    } catch (error) {
      cancelUndispatched(job, "provisioning failed: " + errorText(error));
      return;
    }
    if (provisioned.base_manifest && !ctx.run.base_manifest_json) {
      s.updateRun(run_id, { base_manifest_json: provisioned.base_manifest });
    }
    const built = await createAdapter(String(job.backend_id), { importSdk: provisioned.importSdk, now });
    if (!built.ok || !built.adapter) {
      cancelUndispatched(job, (built.refusal && built.refusal.detail) || "executor unavailable");
      return;
    }
    const prior = jobSettings.continues_job_id ? s.getJob(String(jobSettings.continues_job_id)) : null;
    const priorRef =
      prior && prior.native_ref && String(prior.backend_id) === String(job.backend_id)
        ? makeExecutionRef({ backend_id: String(prior.backend_id), dispatch_key: String(prior.dispatch_key), native_ref: String(prior.native_ref) })
        : null;
    if (jobSettings.continues_job_id && !priorRef) {
      event(run_id, "job.continuity-unavailable", { job_id, prior: jobSettings.continues_job_id });
    }

    // Only here is it known whether the thread is really being resumed, so only
    // here can the instruction stop re-sending a plan the thread already holds
    // (F7). Admission cannot know it: `priorRef` may be absent and the dispatch
    // fall back to a fresh thread with the same request. A rewrite is persisted
    // to `request_json`, because the stored request has to be what was sent.
    const compacted = planReferenceRequest({ ctx, job, jobSettings, request, priorRef, prior });
    const effectiveRequest = compacted || request;
    if (compacted) {
      s.setJobRequest(job_id, compacted);
      event(run_id, "job.plan-by-reference", { job_id, plan_revision: jobSettings.plan_revision ?? null });
    }

    inFlight.set(job_id, built.adapter);
    let outcome;
    try {
      outcome = await dispatchJob({
        store: s,
        adapter: built.adapter,
        job_id,
        request: effectiveRequest,
        priorRef,
        claimant,
        preDispatch,
        onDispatchStarted: () => {
          s.markMessagesDelivered(job_id);
          event(run_id, "job.dispatched", { job_id });
        },
      });
    } catch (error) {
      inFlight.delete(job_id);
      const after = s.getJob(job_id);
      if (after && !after.dispatch_started_at) s.requeueMessages(job_id);
      event(run_id, "job.error", { job_id, error: errorText(error) });
      s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: after && after.dispatch_started_at ? "reconcile" : "dispatch-error" });
      return;
    }
    inFlight.delete(job_id);

    if (!outcome.dispatched) {
      s.requeueMessages(job_id);
      event(run_id, "job.not-dispatched", { job_id, refusals: outcome.refusals || [] });
      const current = s.getRun(run_id);
      const checked = (outcome.refusals || []).flatMap((entry) => (entry.code === DISPATCH_REFUSALS.PRECHECK && Array.isArray(entry.detail) ? entry.detail : []));
      if (current && current.lifecycle !== "CLOSED" && !["paused", "stop-requested"].includes(String(current.waiting_reason))) {
        // Refused only by coordination: the run waits its turn instead of failing.
        if (isQueueable(checked)) queueRun(run_id, { verdict: verdictFromRefusals(checked), next: nextFor(job) });
        else s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "refused-at-dispatch" });
      }
      await closeIfStopped(run_id);
      return;
    }

    // A stop requested while the stream was still open is observed now.
    const after = s.getJob(job_id);
    if (after && after.stop_requested_at && !after.stop_observed_at && runtime.stop) {
      const environment = await runtime.stop(after);
      if (environment && environment.stopObserved) {
        s.markStopObserved(job_id);
        if (after.status !== "finished") {
          s.updateJob(job_id, { status: "finished", outcome: "cancelled", reservation_open: 1, publication_revoked: 1 });
        }
      }
    } else if (runtime.release) {
      await runtime.release(after);
    }
    const recorded = s.getJob(job_id);
    event(run_id, "job.recorded", { job_id, status: recorded.status, outcome: recorded.outcome });
    await afterJob(job_id);
    await closeIfStopped(run_id);
    scheduleDrain();
  }

  // -------------------------------------------------------------------------
  // After a job
  // -------------------------------------------------------------------------

  async function afterJob(job_id) {
    const s = getStore();
    const job = s.getJob(job_id);
    if (!job) return;
    const run_id = String(job.run_id);
    const ctx = context(run_id);
    if (!ctx) return;

    const requested = parseJson(job.settings_json, {}) || {};
    const effective = parseJson(job.effective_json, null);
    const verification = verifyEffectiveSettings({ requested, effective });
    s.setJobEffective(job_id, { ...(effective || {}), verification });
    if (verification.mismatch) {
      s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "settings-mismatch", settings_json: { ...ctx.settings, mismatch_open: true } });
      event(run_id, "settings.mismatch", { job_id, verification });
      return;
    }
    // A pause or stop the owner asked for stays the run's stated position; an
    // unknown job under it is shown as its own obligation.
    if (["paused", "stop-requested"].includes(String(ctx.run.waiting_reason)) || ctx.run.lifecycle === "CLOSED") return;
    if (job.status === "unknown") {
      s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "reconcile" });
      return;
    }
    if (job.status !== "finished" || job.outcome === "cancelled") return;

    const observations = (parseJson(job.observations_json, {}) || {}).observations || {};
    const finalText = String(observations.finalText || "");

    if (job.access === "read-only") {
      if (s.listPlans(run_id).some((plan) => plan.job_id === job_id)) return;
      if (job.outcome !== "succeeded") {
        s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "investigation-failed" });
        event(run_id, "investigation.failed", { job_id, reason: job.reason });
        return;
      }
      const recorded = recordPlan({ store: s, run: ctx.run, contract: ctx.contract, job_id, replyText: finalText });
      const blocking = recorded.questions.some((question) => question.blocking);
      s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: blocking ? "question" : "plan-review" });
      return;
    }

    if (s.listCandidates(run_id).some((row) => row.job_id === job_id)) return;
    const parsed = parseEngineerReply(finalText);
    const questions = parsed.ok ? extractQuestions(parsed.value).filter((question) => question.blocking) : [];
    if (questions.length) {
      const plan = latestPlan(s, run_id);
      recordBuildQuestions({ store: s, run: ctx.run, job_id, plan_revision: plan ? Number(plan.revision) : 0, questions });
      s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "question" });
      event(run_id, "question.raised", { job_id, count: questions.length });
      return;
    }
    await freezeAndCheck(run_id, job);
  }

  async function freezeAndCheck(run_id, job) {
    const s = getStore();
    const ctx = context(run_id);
    s.updateRun(run_id, { lifecycle: "ACTIVE", waiting_reason: "checking" });
    const generation = "C" + (s.listCandidates(run_id).length + 1);
    let candidate;
    try {
      candidate = await runtime.exportCandidate({
        run_id,
        job_id: String(job.job_id),
        generation,
        generationsRoot: join(generationsRoot, run_id),
        base_manifest: parseJson(ctx.run.base_manifest_json, []) || [],
      });
    } catch (error) {
      event(run_id, "candidate.export-failed", { job_id: String(job.job_id), error: errorText(error) });
      s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "export-failed" });
      return null;
    }
    s.putCandidate({ run_id, generation, candidate, job_id: String(job.job_id) });
    event(run_id, "candidate.frozen", { generation, candidate_id: candidate.candidate_id, changed: candidateChangedPaths(candidate).length });
    // The writer may have changed paths nobody declared or approved. That scope is
    // re-evaluated against every other reservation before the candidate goes on;
    // a conflict pauses it with its bytes kept, and it resumes when that clears.
    const loaded = policyNow();
    if (loaded.ok) {
      const grown = scopeGrowth(runFacts(s.getRun(run_id), loaded.policy).footprint);
      if (grown.length) {
        const verdict = evaluateCoordination(run_id, { access: "write", policy: loaded.policy, item: false, capacity: false, checkDrift: false });
        event(run_id, "coordination.scope-grew", { generation, paths: grown, verdict: verdict.verdict, reasons: verdict.reasons });
        if (verdict.verdict !== VERDICTS.TOGETHER) {
          s.updateRun(run_id, { coordination_json: { ...coordinationOf(s.getRun(run_id)), grew: grown } });
          queueRun(run_id, { verdict, state: "scope-conflict", next: null });
          scheduleDrain();
          return null;
        }
      }
    }
    return evaluate(run_id, candidate, { allowRepair: true });
  }

  function evidenceFor({ run_id, candidate, policy, contract, base }) {
    const s = getStore();
    const criteria = policy.criteria.filter((criterion) =>
      contract.criteria_refs.some((ref) => ref.criterion_id === criterion.criterion_id && ref.revision === criterion.revision),
    );
    const records = [];
    const integrity = [];
    if (!criteria.length) return { criteria, records, integrity };
    const plan = pinCheckPlan({
      criteria,
      specs: policy.checks.specs,
      checkerInputs: base.filter((entry) => policy.checks.inputs.includes(entry.path)).map((entry) => ({ path: entry.path, sha256: entry.sha256 })),
      toolchain: { runtime: String(runtime.kind || "unknown"), image: runtime.boundary ? runtime.boundary.image : null },
      environmentDescription: String(runtime.kind || "unknown") + " checker; read-only candidate; no network; restricted environment",
    });
    const execute = runtime.checkExecutor({ run_id, candidate });
    for (const criterion of criteria) {
      let outcome;
      try {
        outcome = runCheck({ plan, candidate, criterion, execute, env: restrictedEnv(), now });
      } catch (error) {
        outcome = { receipt: null, observation: null, refused: "check-error", detail: errorText(error) };
      }
      let record;
      if (outcome.refused) {
        // A refused check is never a pass: drift and mutation leave the criterion
        // without eligible evidence and say why.
        const missing = evaluateCriterion(criterion, null, { candidate_ref: candidate.candidate_id });
        const state = outcome.refused === CHECK_REFUSALS.CANDIDATE_MUTATED ? "stale" : "inconclusive";
        record = { ...missing, evidence_id: contentId("e", { base: missing.evidence_id, state, reason: outcome.refused }), state, reason: outcome.refused, detail: outcome.detail };
        if (outcome.refused === CHECK_REFUSALS.ORACLE_DRIFT) integrity.push("a checker input changed in the candidate: " + outcome.detail);
      } else {
        const trusted = verifyReceipt(outcome.receipt, plan);
        if (trusted.trusted) {
          record = evaluateCriterion(criterion, outcome.observation, { candidate_ref: candidate.candidate_id, currentInputs: outcome.receipt.freshnessInputs });
        } else {
          const missing = evaluateCriterion(criterion, null, { candidate_ref: candidate.candidate_id });
          record = { ...missing, evidence_id: contentId("e", { base: missing.evidence_id, reason: trusted.reason }), state: "inconclusive", reason: trusted.reason };
        }
      }
      records.push(record);
      s.putEvidence({
        evidence_id: record.evidence_id,
        run_id,
        candidate_id: candidate.candidate_id,
        criterion_id: record.criterion_id,
        criterion_revision: record.criterion_revision,
        state: record.state,
        reason: record.reason,
        receipt: outcome.receipt,
        record,
      });
    }

    const typechecked = typecheckEvidence({ run_id, candidate, policy });
    if (typechecked) {
      criteria.push(typechecked.criterion);
      records.push(typechecked.record);
    }
    return { criteria, records, integrity };
  }

  /**
   * Run the deterministic typecheck over this candidate and turn it into a
   * criterion the result layer already knows how to weigh.
   *
   * It is appended to the run's criteria rather than selected by the contract,
   * because "does this compile where it is going" is not a question a work item
   * should be able to decline. Under `enforcement: "required"` it is required
   * for the candidate, so an inconclusive or failed typecheck leaves the run
   * `checks-inconclusive` and Apply refuses — which is the whole point: run
   * r-83dddb67fea9 shipped a TS2339 to `verified_candidate` because nothing in
   * the pipeline ever compiled the candidate (F8).
   *
   * Returns null when the owner has not configured it, and the absence is
   * reported by `applyCandidate` rather than passing silently.
   */
  function typecheckEvidence({ run_id, candidate, policy }) {
    const configured = policy.checks && policy.checks.requiredVerifications ? policy.checks.requiredVerifications.typecheck : null;
    if (!configured || !configured.enabled) return null;
    const s = getStore();

    let verification;
    try {
      verification = runTypecheckVerification({
        hostRoot: root,
        candidate,
        argv: [...configured.argv],
        execute: typecheckExecutor,
        env: restrictedEnv(),
        now,
      });
    } catch (error) {
      verification = {
        criterion_id: TYPECHECK_CRITERION_ID,
        state: TYPECHECK_STATE.INCONCLUSIVE,
        reason: "typecheck-error",
        detail: errorText(error),
        candidate_id: String(candidate.candidate_id),
        checked_inputs: null,
        counts: {},
        diagnostics: [],
        verification_id: contentId("tc", { run_id, candidate: String(candidate.candidate_id), error: errorText(error) }),
      };
    }

    let artifact = null;
    try {
      artifact = writeTypecheckArtifact({ dir: join(artifactsRoot, "typecheck"), verification });
    } catch (error) {
      event(run_id, "typecheck.artifact-failed", { error: errorText(error) });
    }
    event(run_id, "typecheck." + verification.state, {
      candidate_id: String(candidate.candidate_id),
      introduced: verification.counts ? verification.counts.introduced : null,
      reason: verification.reason,
    });

    const criterion = {
      criterion_id: TYPECHECK_CRITERION_ID,
      revision: 1,
      proposition: "The candidate introduces no new TypeScript diagnostic in the checkout it would be applied to.",
      // Advisory records the verdict and blocks nothing; required is a gate.
      required_for: configured.enforcement === "advisory" ? "informational" : "candidate",
      observer: { kind: "command", expected: { spec_id: TYPECHECK_CRITERION_ID } },
      oracle_ref: "tsc --noEmit over the host checkout with the candidate laid over it",
      freshness_inputs: ["candidate", "integration-target"],
    };
    const record = {
      criterion_id: TYPECHECK_CRITERION_ID,
      criterion_revision: 1,
      state: verification.state,
      reason: verification.reason || verification.detail || null,
      evidence_id: String(verification.verification_id),
      verification,
      artifact,
    };
    s.putEvidence({
      evidence_id: record.evidence_id,
      run_id,
      candidate_id: candidate.candidate_id,
      criterion_id: record.criterion_id,
      criterion_revision: record.criterion_revision,
      state: record.state,
      reason: record.reason,
      // Not a protected-checker receipt: this observer runs on the host, so it
      // is recorded as what it is rather than borrowing that attribution.
      receipt: null,
      record,
    });
    return { criterion, record };
  }

  function resultFor(ctx, { candidate, criteria, records, integrity, observedDisposition, closed_outcome }) {
    const s = ctx.store;
    const run_id = String(ctx.run.run_id);
    const jobs = s.listJobs(run_id);
    const previous = s.latestResult(run_id);
    const resources = resourceSummary(s, { run_id, unit: ctx.grant.resource_policy.unit });
    return buildResult({
      contract: ctx.contract,
      run_id,
      candidate,
      candidateFresh: candidate ? candidateFreshness(candidate).fresh : true,
      criteriaSummary: summarizeCriteria(criteria, records),
      evidence_refs: records.map((record) => record.evidence_id),
      job_receipt_refs: jobs.map((job) => String(job.job_id)),
      unknownJobs: jobs.filter((job) => job.status === "unknown").map((job) => ({ job_id: String(job.job_id), reason: String(job.reason || "outstanding dispatch") })),
      resourceSummary: { ...resources, enforcementProfile: ctx.grant.resource_policy.strict ? "strict" : "threshold" },
      publicationScopeCheck: candidate ? checkPublicationScope(candidate, ctx.contract.publicationScope) : null,
      integrityViolations: [...integrity, ...(ctx.settings.mismatch_open ? ["effective executor settings did not match the selection"] : [])],
      owner_decision_refs: s.listDecisions(run_id).map((decision) => String(decision.decision_id)),
      observedDisposition,
      closed_outcome,
      projection_status: "pending",
      result_version: s.listResults(run_id).length + 1,
      supersedes: previous ? String(previous.result_id) + "@" + String(previous.result_version) : null,
    });
  }

  async function evaluate(run_id, candidate, { allowRepair }) {
    const s = getStore();
    const ctx = context(run_id);
    const loaded = policyNow();
    if (!loaded.ok) {
      s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "no-policy" });
      return null;
    }
    const policy = loaded.policy;
    const base = parseJson(ctx.run.base_manifest_json, []) || [];
    const { criteria, records, integrity } = evidenceFor({ run_id, candidate, policy, contract: ctx.contract, base });
    const preliminary = resultFor(ctx, { candidate, criteria, records, integrity, observedDisposition: "none", closed_outcome: null });
    // The protected checker is the observer of a verified candidate; nothing else is.
    const observedDisposition = preliminary.candidateVerified ? "verified_candidate" : "none";
    const failed = preliminary.criterion_states.filter((entry) => entry.state === "failed");

    let closed = null;
    let repair = null;
    if (preliminary.candidateVerified) closed = "verified_candidate";
    else if (failed.length) {
      const jobs = s.listJobs(run_id);
      repair = allowRepair
        ? postCheckRepairPolicy({
            result: preliminary,
            repairsDispatched: jobs.filter((job) => job.purpose === "repair").length,
            limit: profileContract(ctx.settings).repairDispatchLimit ?? policy.execution.repairDispatchLimit ?? 0,
            grantVerdict: evaluateGrant(ctx.grant, { now: now(), contract: ctx.contract, effect: "native_dispatch" }),
          })
        : null;
      if (!repair || !repair.permitted) {
        closed = preliminary.criterion_states.some((entry) => entry.state === "satisfied") ? "useful_partial" : "failed";
      }
    }

    const result = resultFor(ctx, { candidate, criteria, records, integrity, observedDisposition, closed_outcome: closed });
    s.putResult(result);
    const ref = result.result_id + "@" + result.result_version;
    event(run_id, "result.recorded", {
      result_version: result.result_version,
      candidateVerified: result.candidateVerified,
      workComplete: result.workComplete,
      closed_outcome: closed,
    });
    if (closed) s.updateRun(run_id, { lifecycle: "CLOSED", closed_outcome: closed, waiting_reason: null, result_ref: ref });
    else if (repair && repair.permitted) s.updateRun(run_id, { lifecycle: "ACTIVE", waiting_reason: "repairing", result_ref: ref });
    else s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "checks-inconclusive", result_ref: ref });
    await project(run_id, result);

    if (repair && repair.permitted) {
      const approval = approvalFor({ store: s, run: s.getRun(run_id), contract: ctx.contract, grant: ctx.grant });
      if (!approval.ok) {
        s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "approval-stale" });
        scheduleDrain();
        return result;
      }
      const lastWrite = [...s.listJobs(run_id)].reverse().find((job) => job.access === "write");
      const admitted = await admitContinuation(run_id, {
        kind: "repair",
        purpose: "repair",
        access: "write",
        command_id: "repair:" + ref,
        actor: "supervisor",
        continues_job_id: lastWrite ? String(lastWrite.job_id) : null,
        instructionFor: (messages) => repairInstruction({ plan: planView(approval.plan), failures: failed, messages }),
      });
      if (!admitted.ok && !admitted.queued) {
        s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "repair-refused" });
        event(run_id, "repair.refused", { refusals: admitted.refusals });
      }
    }
    scheduleDrain();
    return result;
  }

  async function project(run_id, result) {
    const s = getStore();
    const ctx = context(run_id);
    try {
      await writeProjection({ root, pmRel, workRef: ctx.workRef, run: s.getRun(run_id), result, settings: ctx.settings, date: now().slice(0, 10) });
      s.setResultProjection(result.result_id, result.result_version, "current", null);
      event(run_id, "projection.written", { result_version: result.result_version });
    } catch (error) {
      // A failed writeback is a pending projection, never a reason to repeat engineering.
      s.setResultProjection(result.result_id, result.result_version, "failed", errorText(error));
      event(run_id, "projection.failed", { result_version: result.result_version, error: errorText(error) });
    }
  }

  // -------------------------------------------------------------------------
  // Continuations
  // -------------------------------------------------------------------------

  async function admitContinuation(run_id, { kind = null, purpose, access, command_id, actor, continues_job_id = null, feedback = null, instructionFor }) {
    const s = getStore();
    const ctx = context(run_id);
    if (!ctx || !ctx.contract || !ctx.grant) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, run_id);
    const loaded = policyNow();
    if (!loaded.ok) return refuse(JOURNEY_REFUSALS.NO_POLICY, loaded.refusals);
    if (!runtime) return refuse(JOURNEY_REFUSALS.NO_RUNTIME, "no worker runtime");
    if (ctx.run.lifecycle === "CLOSED") return refuse(JOURNEY_REFUSALS.RUN_CLOSED, ctx.run.closed_outcome);
    const policy = loaded.policy;
    const contract = profileContract(ctx.settings);
    const existingJobs = s.listJobs(run_id);
    if (contract.maxPlanJobs != null && access !== "write" && existingJobs.filter((job) => job.access !== "write").length >= contract.maxPlanJobs) {
      return refuse(JOURNEY_REFUSALS.NOT_RESUMABLE, "Focused delivery permits one plan job; start a new Investigate run for further discovery");
    }
    if (contract.maxImplementationJobs != null && access === "write" && purpose !== "repair" && existingJobs.filter((job) => job.access === "write").length >= contract.maxImplementationJobs) {
      return refuse(JOURNEY_REFUSALS.NOT_RESUMABLE, "Focused delivery permits one implementation job; escalate to Investigate for another attempt");
    }
    if (!s.getCommand(command_id)) {
      const outstanding = s.listJobs(run_id).filter((job) => OUTSTANDING_STATUSES.includes(String(job.status)));
      if (outstanding.length) return refuse(JOURNEY_REFUSALS.OUTSTANDING, outstanding.map((job) => String(job.job_id)));
    }
    const backend_id = String(ctx.settings.backend_id);
    const profile = await profileFor(backend_id, policy);
    if (!profile.admission) return refuse(profile.refusal ? profile.refusal.code : ADMISSION_REFUSALS.PROFILE, profile.refusal ? profile.refusal.detail : null);
    const source = sourceFreshness(ctx);
    const extraRefusals = [];
    let plan_id = null;
    if (access === "write") {
      const approval = approvalFor({ store: s, run: ctx.run, contract: ctx.contract, grant: ctx.grant });
      if (!approval.ok) extraRefusals.push({ code: JOURNEY_REFUSALS.APPROVAL, detail: approval.refusal });
      else plan_id = String(approval.plan.plan_id);
    }
    if (ctx.settings.mismatch_open) extraRefusals.push({ code: JOURNEY_REFUSALS.SETTINGS_MISMATCH, detail: "hand off or start a new run" });
    const queued = s.listMessages(run_id).filter((message) => message.status === "queued");
    const coordination = { verdict: null };
    const admission = admitJob({
      store: s,
      run_id,
      contract: ctx.contract,
      grant: ctx.grant,
      profileAdmission: profile.admission,
      purpose,
      backend_id,
      reservation: { unit: policy.resources.unit, amount: policy.resources.perJobReservation.amount, basis: policy.resources.perJobReservation.basis },
      instruction: instructionFor(queued.map((message) => ({ body: String(message.body) }))),
      workspace: runtime.workspaceFor({ access }),
      command: { command_id, actor, payload: { run_id, purpose, access, plan_id, continues_job_id } },
      now: now(),
      sourceFresh: source.fresh,
      nextJobCost: policy.resources.perJobReservation.amount,
      repairDispatchLimit: purpose === "repair" ? (contract.repairDispatchLimit ?? policy.execution.repairDispatchLimit) : null,
      access,
      settings: {
        executor: ctx.settings.executor ?? null,
        backend_id,
        model: ctx.settings.model ?? null,
        effort: ctx.settings.effort ?? null,
        observedAs: ctx.settings.observedAs || [],
        continues_job_id,
        qualification_ref: profile.profile ? profile.profile.qualification_ref : null,
      },
      plan_id,
      native_limits: nativeLimitsFor(policy, ctx.settings, access, backend_id),
      extraRefusals,
      // Command Center Phase 5: held work, prerequisites, reservations and fleet
      // limits, evaluated inside this admission's transaction.
      gate: () => {
        coordination.verdict =
          access === "write"
            ? evaluateCoordination(run_id, { access, policy, reservation: reservationOf(policy) })
            : evaluateCapacity({ access, policy });
        return coordination.verdict.refusals;
      },
    });
    if (!admission.admitted || !admission.job) {
      if (isQueueable(admission.refusals)) {
        queueRun(run_id, {
          verdict: coordination.verdict || verdictFromRefusals(admission.refusals),
          next: { kind: kind || defaultKind(purpose, access), purpose, access, continues_job_id, actor, feedback },
        });
        return deepFreeze({ ok: false, queued: true, duplicate: admission.duplicate, refusals: admission.refusals });
      }
      event(run_id, "job.refused", { purpose, refusals: admission.refusals });
      return deepFreeze({ ok: false, duplicate: admission.duplicate, refusals: admission.refusals });
    }
    const job_id = String(admission.job.job_id);
    if (!admission.duplicate) {
      s.attachQueuedMessages(run_id, job_id);
      clearWaiting(run_id);
      s.updateRun(run_id, { lifecycle: "ACTIVE", waiting_reason: null });
      event(run_id, "job.admitted", { job_id, purpose, access });
    }
    const current = s.getJob(job_id);
    if (current && current.status === "reserved" && !current.dispatch_started_at && !current.dispatch_claim) schedule(job_id);
    return deepFreeze({ ok: true, duplicate: admission.duplicate, job_id, refusals: [] });
  }

  // -------------------------------------------------------------------------
  // Owner commands
  // -------------------------------------------------------------------------

  async function decide({ run_id, plan_id, plan_revision, contract_revision = null, decision, feedback = null, command_id, actor }) {
    const payload = { run_id, plan_id, plan_revision, decision, feedback, ...(contract_revision == null ? {} : { contract_revision: Number(contract_revision) }) };
    return once({ command_id, kind: "V2:decision", actor, payload }, async () => {
      const ctx = context(run_id);
      if (!ctx || !ctx.contract || !ctx.grant) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, run_id);
      if (ctx.run.lifecycle === "CLOSED") return refuse(JOURNEY_REFUSALS.RUN_CLOSED, ctx.run.closed_outcome);
      // An approval sent from a view of an earlier contract revision binds nothing.
      if (contract_revision != null && Number(contract_revision) !== Number(ctx.contract.revision)) {
        return refuse(JOURNEY_REFUSALS.CONTRACT_MOVED, "the run is on contract revision " + ctx.contract.revision);
      }
      const decided = decidePlan({
        store: ctx.store,
        run: ctx.run,
        contract: ctx.contract,
        grant: ctx.grant,
        plan_id,
        plan_revision: Number(plan_revision),
        decision,
        feedback,
        actor,
        command_id,
      });
      if (!decided.ok) return decided;
      const plan = planView(ctx.store.getPlan(plan_id));
      const investigation = ctx.store.getPlan(plan_id).job_id;
      const answers = answeredQuestions(run_id);
      const continuation =
        decision === "approve"
          ? await admitContinuation(run_id, {
              kind: "implement",
              purpose: "resume",
              access: "write",
              command_id: command_id + ":implement",
              actor,
              continues_job_id: investigation ? String(investigation) : null,
              instructionFor: (messages) => implementationInstruction({ plan, contract: ctx.contract, messages, answers, profile: ctx.settings.work_profile }),
            })
          : await admitContinuation(run_id, {
              kind: "revise",
              feedback,
              purpose: "investigate",
              access: "read-only",
              command_id: command_id + ":revise",
              actor,
              continues_job_id: investigation ? String(investigation) : null,
              instructionFor: (messages) =>
                investigationInstruction({ contract: ctx.contract, alias: ctx.workRef.alias, acceptance: acceptanceNow(ctx), messages, answers, feedback, previous: plan, profile: ctx.settings.work_profile }),
            });
      if (!continuation.ok && !continuation.queued) ctx.store.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "continuation-refused" });
      return deepFreeze({ ok: true, decision_id: decided.decision_id, continuation, refusals: [] });
    });
  }

  async function answer({ run_id, question_id, plan_revision, answer: text, command_id, actor }) {
    return once({ command_id, kind: "V2:answer", actor, payload: { run_id, question_id, plan_revision, answer: text } }, async () => {
      const ctx = context(run_id);
      if (!ctx || !ctx.contract || !ctx.grant) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, run_id);
      if (ctx.run.lifecycle === "CLOSED") return refuse(JOURNEY_REFUSALS.RUN_CLOSED, ctx.run.closed_outcome);
      const answered = answerQuestion({ store: ctx.store, run: ctx.run, question_id, plan_revision: Number(plan_revision), answer: text, actor });
      if (!answered.ok || !answered.question) return answered;
      const question = answered.question;
      if (!question.blocking || openBlockingQuestions(ctx.store, run_id, String(question.stage)).length) {
        return deepFreeze({ ok: true, question_id, continuation: null, refusals: [] });
      }
      const answers = answeredQuestions(run_id);
      const continues_job_id = question.job_id ? String(question.job_id) : null;
      let continuation;
      if (question.stage === "plan") {
        const previous = planView(latestPlan(ctx.store, run_id));
        continuation = await admitContinuation(run_id, {
          kind: "investigate",
          purpose: "investigate",
          access: "read-only",
          command_id: command_id + ":continue",
          actor,
          continues_job_id,
          instructionFor: (messages) =>
            investigationInstruction({ contract: ctx.contract, alias: ctx.workRef.alias, acceptance: acceptanceNow(ctx), messages, answers, previous, profile: ctx.settings.work_profile }),
        });
      } else {
        const approval = approvalFor({ store: ctx.store, run: ctx.run, contract: ctx.contract, grant: ctx.grant });
        continuation = approval.ok
          ? await admitContinuation(run_id, {
              kind: "implement",
              purpose: "resume",
              access: "write",
              command_id: command_id + ":continue",
              actor,
              continues_job_id,
              instructionFor: (messages) => implementationInstruction({ plan: planView(approval.plan), contract: ctx.contract, messages, answers }),
            })
          : refuse(JOURNEY_REFUSALS.APPROVAL, approval.refusal);
      }
      if (!continuation.ok && !continuation.queued) ctx.store.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "continuation-refused" });
      return deepFreeze({ ok: true, question_id, continuation, refusals: [] });
    });
  }

  async function message({ run_id, body, command_id, actor }) {
    return once({ command_id, kind: "V2:message", actor, payload: { run_id, body } }, async () => {
      const ctx = context(run_id);
      if (!ctx) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, run_id);
      if (ctx.run.lifecycle === "CLOSED") return refuse(JOURNEY_REFUSALS.RUN_CLOSED, ctx.run.closed_outcome);
      const queued = queueMessage({ store: ctx.store, run: ctx.run, body, actor, message_id: contentId("m", { v: 1, command_id }) });
      if (!queued.ok || !queued.message) return queued;
      return deepFreeze({ ok: true, message_id: String(queued.message.message_id), receipt: messageReceipt(String(queued.message.status)), refusals: [] });
    });
  }

  function stopOnlyAdapter(job) {
    return {
      backend_id: String(job.backend_id),
      stop: async (ref) =>
        bindAdapterResult({
          operation: "stop",
          executionRef: ref,
          status: "unknown",
          observations: { requested: true, locallyStopped: false, providerConfirmed: false, descendantsContained: "unknown" },
          reason: "no adapter was available in this process; the environment is stopped directly",
        }),
    };
  }

  async function stopActiveJobs(ctx) {
    const s = ctx.store;
    const run_id = String(ctx.run.run_id);
    const stops = [];
    for (const job of s.listJobs(run_id)) {
      const job_id = String(job.job_id);
      if (job.status === "reserved" && !job.dispatch_started_at) {
        const claim = s.transaction(() => s.claimDispatch(job_id, claimant + ":stop"));
        if (claim.acquired) {
          s.updateJob(job_id, { status: "finished", outcome: "cancelled", reason: "stopped before dispatch", reservation_open: 0, publication_revoked: 1 });
          s.requeueMessages(job_id);
          stops.push({ job_id, display: "Stopped", stopObserved: true });
        } else {
          // Its dispatcher holds the claim; the last-moment check refuses a paused run.
          stops.push({ job_id, display: "Stop requested", stopObserved: false });
        }
        continue;
      }
      if ((job.status !== "active" && job.status !== "unknown") || job.stop_observed_at) continue;
      const built = inFlight.has(job_id) ? null : await createAdapter(String(job.backend_id), { now });
      const adapter = inFlight.get(job_id) || (built && built.ok ? built.adapter : null) || stopOnlyAdapter(job);
      const stopped = await requestStop({
        store: s,
        adapter,
        job_id,
        observeStop: async (current) => {
          if (!runtime || typeof runtime.stop !== "function") return null;
          const environment = await runtime.stop(current);
          // Removal is observed only once the stream reading it has ended too.
          const streaming = inFlight.has(job_id);
          return { stopObserved: Boolean(environment && environment.stopObserved) && !streaming, detail: streaming ? "the worker stream is still open" : environment && environment.detail };
        },
      });
      event(run_id, "job.stop", { job_id, display: stopped.display });
      stops.push({ job_id, display: stopped.display, stopObserved: stopped.stopObserved });
    }
    return stops;
  }

  async function closeIfStopped(run_id) {
    const ctx = context(run_id);
    if (!ctx || ctx.run.lifecycle === "CLOSED" || ctx.run.waiting_reason !== "stop-requested" || !ctx.grant) return false;
    const s = ctx.store;
    if (s.listJobs(run_id).some((job) => OUTSTANDING_STATUSES.includes(String(job.status)))) return false;
    const candidates = s.listCandidates(run_id);
    const candidate = candidates.length ? parseJson(candidates[candidates.length - 1].record_json) : null;
    const loaded = policyNow();
    const criteria = loaded.ok
      ? loaded.policy.criteria.filter((criterion) => ctx.contract.criteria_refs.some((ref) => ref.criterion_id === criterion.criterion_id && ref.revision === criterion.revision))
      : [];
    const records = candidate ? s.listEvidence(run_id, candidate.candidate_id).map((row) => parseJson(row.record_json, {})) : [];
    const result = resultFor(ctx, { candidate, criteria, records, integrity: [], observedDisposition: "none", closed_outcome: "cancelled" });
    s.putResult(result);
    s.updateRun(run_id, { lifecycle: "CLOSED", closed_outcome: "cancelled", waiting_reason: null, result_ref: result.result_id + "@" + result.result_version });
    event(run_id, "run.cancelled", { result_version: result.result_version });
    await project(run_id, result);
    scheduleDrain();
    return true;
  }

  async function reconcile() {
    const s = getStore();
    const interruptedApplications = recoverApplications();
    const released = releaseStaleClaims({ store: s, claimant });
    const outcomes = await reconcileOutstanding({
      store: s,
      resolveAdapter: async (backend_id) => {
        const built = await createAdapter(backend_id, { now });
        return built.ok ? built.adapter : null;
      },
      recover: async (job) => {
        if (inFlight.has(String(job.job_id))) return { running: true };
        if (!runtime || typeof runtime.recover !== "function") return null;
        const found = await runtime.recover(job);
        if (!found) return null;
        if (found.running) return { running: true };
        const built = await createAdapter(String(job.backend_id), { importSdk: found.importSdk, now });
        if (!built.ok || !built.adapter) return null;
        const request = parseJson(job.request_json);
        const settings = parseJson(job.settings_json, {}) || {};
        const prior = settings.continues_job_id ? s.getJob(String(settings.continues_job_id)) : null;
        // Replays the retained output through the adapter's own reader. The bridge
        // yields recorded lines; nothing is sent anywhere.
        const result =
          prior && prior.native_ref
            ? await built.adapter.resume(
                makeExecutionRef({ backend_id: String(prior.backend_id), dispatch_key: String(prior.dispatch_key), native_ref: String(prior.native_ref) }),
                request,
                {},
              )
            : await built.adapter.start(request, {});
        if (runtime.release) await runtime.release(job);
        return { result, source: found.source };
      },
    });
    for (const outcome of outcomes) {
      const job = s.getJob(String(outcome.job_id));
      if (!job) continue;
      event(job.run_id, "job.reconcile", { job_id: String(job.job_id), verdict: outcome.verdict, detail: outcome.detail });
      if (outcome.verdict === RETRY_VERDICTS.RECONCILED) {
        await afterJob(String(job.job_id));
        await closeIfStopped(String(job.run_id));
      }
    }
    for (const job of s.listOutstandingJobs()) {
      if (job.status !== "reserved" || job.dispatch_started_at || job.dispatch_claim) continue;
      const run = s.getRun(String(job.run_id));
      if (run && run.lifecycle !== "CLOSED" && !["paused", "stop-requested"].includes(String(run.waiting_reason))) schedule(job.job_id);
    }
    scheduleDrain();
    return deepFreeze({ released, outcomes, interruptedApplications });
  }

  async function control({ run_id, action, command_id, actor, executor = null, model = null, effort = null }) {
    return once({ command_id, kind: "V2:control:" + String(action), actor, payload: { run_id, action, executor, model, effort } }, async () => {
      const ctx = context(run_id);
      if (!ctx || !ctx.contract || !ctx.grant) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, run_id);
      const s = ctx.store;
      switch (action) {
        case "pause": {
          if (ctx.run.lifecycle === "CLOSED") return refuse(JOURNEY_REFUSALS.RUN_CLOSED, ctx.run.closed_outcome);
          s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "paused" });
          event(run_id, "run.pause-requested", { actor });
          const stops = await stopActiveJobs(context(run_id));
          scheduleDrain();
          return deepFreeze({ ok: true, stops, refusals: [] });
        }
        case "stop": {
          if (ctx.run.lifecycle === "CLOSED") return refuse(JOURNEY_REFUSALS.RUN_CLOSED, ctx.run.closed_outcome);
          // Authority goes first: nothing further dispatches or publishes under this grant.
          if (!ctx.rawGrant.revocation_version) s.putGrant(revokeGrant(ctx.rawGrant));
          s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "stop-requested" });
          event(run_id, "run.stop-requested", { actor });
          const stops = await stopActiveJobs(context(run_id));
          const closed = await closeIfStopped(run_id);
          scheduleDrain();
          return deepFreeze({ ok: true, stops, closed, refusals: [] });
        }
        case "resume":
          return resumeRun(ctx, { actor, command_id });
        case "reconcile": {
          const reconciled = await reconcile();
          await closeIfStopped(run_id);
          return deepFreeze({ ok: true, released: reconciled.released, outcomes: reconciled.outcomes.filter((entry) => s.getJob(String(entry.job_id)).run_id === run_id), refusals: [] });
        }
        case "recheck": {
          if (ctx.run.lifecycle === "CLOSED") return refuse(JOURNEY_REFUSALS.RUN_CLOSED, ctx.run.closed_outcome);
          const candidates = s.listCandidates(run_id);
          if (!candidates.length) return refuse(JOURNEY_REFUSALS.NO_RESULT, "no candidate to check");
          const result = await evaluate(run_id, parseJson(candidates[candidates.length - 1].record_json), { allowRepair: false });
          return deepFreeze({ ok: Boolean(result), result_version: result ? result.result_version : null, refusals: [] });
        }
        case "close": {
          if (ctx.run.lifecycle === "CLOSED") return refuse(JOURNEY_REFUSALS.RUN_CLOSED, ctx.run.closed_outcome);
          if (s.listJobs(run_id).some((job) => OUTSTANDING_STATUSES.includes(String(job.status)))) {
            return refuse(JOURNEY_REFUSALS.OUTSTANDING, "reconcile or stop first");
          }
          const latest = s.latestResult(run_id);
          const record = latest ? parseJson(latest.record_json, {}) : null;
          const closed = record && record.criterion_states && record.criterion_states.some((entry) => entry.state === "satisfied") ? "useful_partial" : "failed";
          s.updateRun(run_id, { lifecycle: "CLOSED", closed_outcome: closed, waiting_reason: null });
          s.putDecision({ decision_id: contentId("d", { v: 1, run_id, kind: "close", command_id }), run_id, subject_id: run_id, subject_revision: ctx.contract.revision, kind: "run-closed", requested: closed, actor, answer: closed, evidence_seen: { result: latest ? latest.result_id + "@" + latest.result_version : null } });
          event(run_id, "run.closed", { actor, closed_outcome: closed });
          scheduleDrain();
          return deepFreeze({ ok: true, closed_outcome: closed, refusals: [] });
        }
        case "retry-projection": {
          const latest = s.latestResult(run_id);
          if (!latest || latest.projection_status !== "failed") return refuse(JOURNEY_REFUSALS.NO_FAILED_PROJECTION, latest ? latest.projection_status : null);
          await project(run_id, parseJson(latest.record_json, {}));
          const after = s.latestResult(run_id);
          return deepFreeze({ ok: after.projection_status === "current", projection_status: String(after.projection_status), refusals: [] });
        }
        case "acknowledge-usage": {
          const released = [];
          for (const job of s.listJobs(run_id)) {
            if (job.status !== "finished" || !job.reservation_open) continue;
            s.updateJob(String(job.job_id), { reservation_open: 0, publication_revoked: job.publication_revoked });
            s.putReceipt({
              receipt_id: "rc-" + job.job_id + "-usage-acknowledged",
              kind: "reservation.released-unknown-usage",
              subject_id: String(job.job_id),
              actor,
              state_before: "reserved",
              state_after: "released",
              observed: { command_id, note: "usage stays unknown in every summary; only the reservation is released" },
            });
            released.push(String(job.job_id));
          }
          event(run_id, "usage.acknowledged", { actor, released });
          scheduleDrain();
          return deepFreeze({ ok: true, released, refusals: [] });
        }
        case "release": {
          // An unapplied verified candidate stops reserving its paths. The candidate
          // stays readable; a later Apply is still checked against the checkout.
          if (ctx.run.lifecycle !== "CLOSED" || ctx.run.closed_outcome !== "verified_candidate") {
            return refuse(JOURNEY_REFUSALS.NOT_RELEASABLE, ctx.run.closed_outcome || ctx.run.lifecycle);
          }
          const latest = latestApplication(s, run_id);
          if (latest && ACTIVE_APPLICATION_STATES.includes(String(latest.state))) return refuse(JOURNEY_REFUSALS.APPLY_IN_PROGRESS, String(latest.application_id));
          const value = coordinationOf(ctx.run);
          if (!value.released_at) {
            s.updateRun(run_id, { coordination_json: { ...value, released_at: now(), released_by: actor } });
            s.putDecision({
              decision_id: contentId("d", { v: 1, run_id, kind: "release", command_id }),
              run_id,
              subject_id: run_id,
              subject_revision: ctx.contract.revision,
              kind: "candidate-released",
              requested: "release",
              actor,
              answer: "release",
              evidence_seen: { result: ctx.run.result_ref || null },
            });
            event(run_id, "coordination.released", { actor });
          }
          scheduleDrain();
          return deepFreeze({ ok: true, released: true, refusals: [] });
        }
        case "handoff":
          return handoff(ctx, { executor, model, effort, actor, command_id });
        default:
          return refuse(JOURNEY_REFUSALS.UNKNOWN_ACTION, action);
      }
    });
  }

  async function resumeRun(ctx, { actor, command_id }) {
    const s = ctx.store;
    const run_id = String(ctx.run.run_id);
    if (ctx.run.lifecycle === "CLOSED") return refuse(JOURNEY_REFUSALS.RUN_CLOSED, ctx.run.closed_outcome);
    if (!RESUMABLE_REASONS.includes(String(ctx.run.waiting_reason))) {
      return refuse(JOURNEY_REFUSALS.NOT_RESUMABLE, ctx.run.waiting_reason || ctx.run.lifecycle);
    }
    const jobs = s.listJobs(run_id);
    const outstanding = jobs.filter((job) => OUTSTANDING_STATUSES.includes(String(job.status)));
    if (outstanding.length) return refuse(JOURNEY_REFUSALS.OUTSTANDING, outstanding.map((job) => String(job.job_id)));
    const lastWrite = [...jobs].reverse().find((job) => job.access === "write");
    const lastNative = [...jobs].reverse().find((job) => job.native_ref);
    s.updateRun(run_id, { lifecycle: "ACTIVE", waiting_reason: null });
    // A finished implementation whose output was never frozen is checked, not re-run.
    if (lastWrite && lastWrite.status === "finished" && lastWrite.outcome === "succeeded" && !s.listCandidates(run_id).some((row) => row.job_id === lastWrite.job_id)) {
      track(() => freezeAndCheck(run_id, lastWrite));
      return deepFreeze({ ok: true, continuation: { ok: true, action: "check" }, refusals: [] });
    }
    const approval = approvalFor({ store: s, run: s.getRun(run_id), contract: ctx.contract, grant: ctx.grant });
    const answers = answeredQuestions(run_id);
    const continuation = approval.ok
      ? await admitContinuation(run_id, {
          kind: "implement",
          purpose: "resume",
          access: "write",
          command_id: command_id + ":resume",
          actor,
          continues_job_id: lastWrite ? String(lastWrite.job_id) : lastNative ? String(lastNative.job_id) : null,
          instructionFor: (messages) => implementationInstruction({ plan: planView(approval.plan), contract: ctx.contract, messages, answers, profile: ctx.settings.work_profile }),
        })
      : await admitContinuation(run_id, {
          kind: "investigate",
          purpose: "investigate",
          access: "read-only",
          command_id: command_id + ":resume",
          actor,
          continues_job_id: lastNative ? String(lastNative.job_id) : null,
          instructionFor: (messages) =>
            investigationInstruction({
              contract: ctx.contract,
              alias: ctx.workRef.alias,
              acceptance: acceptanceNow(ctx),
              messages,
              answers,
              previous: planView(latestPlan(s, run_id)),
            }),
        });
    if (!continuation.ok && !continuation.queued) s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "continuation-refused" });
    const accepted = continuation.ok || Boolean(continuation.queued);
    return deepFreeze({ ok: accepted, queued: Boolean(continuation.queued), continuation, refusals: accepted ? [] : continuation.refusals });
  }

  async function handoff(ctx, { executor, model, effort, actor, command_id }) {
    const s = ctx.store;
    const run_id = String(ctx.run.run_id);
    if (ctx.run.lifecycle === "CLOSED") return refuse(JOURNEY_REFUSALS.RUN_CLOSED, ctx.run.closed_outcome);
    const jobs = s.listJobs(run_id);
    const outstanding = jobs.filter((job) => OUTSTANDING_STATUSES.includes(String(job.status)));
    if (outstanding.length) return refuse(JOURNEY_REFUSALS.OUTSTANDING, outstanding.map((job) => String(job.job_id)));
    const loaded = policyNow();
    if (!loaded.ok) return refuse(JOURNEY_REFUSALS.NO_POLICY, loaded.refusals);
    const chosen = resolveExecutorChoice(executor);
    if (!chosen) return refuse(ADMISSION_REFUSALS.PROFILE, "choose the executor to hand off to");
    if (!loaded.policy.executors.permitted.includes(chosen.backend_id)) return refuse(JOURNEY_REFUSALS.NOT_PERMITTED, chosen.backend_id);
    const settings = validateRunSettings({ executor: chosen.backend_id, model, effort, catalog: loaded.policy.executors.catalog });
    if (!settings.ok || !settings.settings) return deepFreeze({ ok: false, refusals: settings.refusals });
    const profile = await profileFor(chosen.backend_id, loaded.policy);
    if (!profile.ok || !profile.profile) return refuse(profile.refusal ? profile.refusal.code : ADMISSION_REFUSALS.PROFILE, profile.refusal ? profile.refusal.detail : null);

    const grant = buildGrant({ policy: loaded.policy, contract: ctx.contract, profile: profile.profile });
    s.putGrant(grant);
    const plan = latestPlan(s, run_id);
    const candidates = s.listCandidates(run_id);
    const checkpoint = makeCheckpoint({
      run_id,
      contract_revision: ctx.contract.revision,
      created_at: now(),
      source_manifest_ref: ctx.contract.source_fingerprint,
      candidate_ref: candidates.length ? String(candidates[candidates.length - 1].candidate_id) : null,
      decision_refs: s.listDecisions(run_id).map((decision) => String(decision.decision_id)),
      remaining: [{ ref: "run:" + run_id, next_action: "propose a plan for the remaining work", resolver: chosen.id }],
      native_record_refs: jobs.filter((job) => job.native_ref).map((job) => String(job.native_ref)),
      next_action: "investigate from this checkpoint and propose a plan",
    });
    s.putDecision({
      decision_id: contentId("d", { v: 1, run_id, kind: "handoff", command_id }),
      run_id,
      subject_id: run_id,
      subject_revision: ctx.contract.revision,
      kind: "executor-handoff",
      requested: chosen.backend_id,
      actor,
      answer: JSON.stringify({ from: ctx.settings.backend_id, to: chosen.backend_id, model: settings.settings.model, effort: settings.settings.effort }),
      evidence_seen: { checkpoint },
    });
    // An approval bound the old executor's grant; it does not carry over.
    if (plan && (plan.status === "proposed" || plan.status === "approved")) s.setPlanStatus(String(plan.plan_id), "superseded");
    s.updateRun(run_id, {
      grant_id: grant.grant_id,
      grant_revision: grant.revocation_version,
      lifecycle: "ACTIVE",
      waiting_reason: null,
      settings_json: {
        ...settings.settings,
        work_profile: ctx.settings.work_profile ?? null,
        profile_id: profile.profile.profile_id,
        qualification_ref: profile.profile.qualification_ref ?? null,
        mismatch_open: false,
        history: [...(ctx.settings.history || []), { backend_id: ctx.settings.backend_id, model: ctx.settings.model ?? null, effort: ctx.settings.effort ?? null, until: now() }],
      },
    });
    event(run_id, "run.handoff", { from: ctx.settings.backend_id, to: chosen.backend_id, actor });
    const continuation = await admitContinuation(run_id, {
      kind: "handoff",
      purpose: "investigate",
      access: "read-only",
      command_id: command_id + ":handoff",
      actor,
      continues_job_id: null,
      instructionFor: () => handoffInstruction({ checkpoint, plan: planView(plan), contract: ctx.contract }),
    });
    if (!continuation.ok && !continuation.queued) s.updateRun(run_id, { lifecycle: "WAITING", waiting_reason: "continuation-refused" });
    const accepted = continuation.ok || Boolean(continuation.queued);
    return deepFreeze({ ok: accepted, queued: Boolean(continuation.queued), checkpoint_id: checkpoint.checkpoint_id, continuation, refusals: accepted ? [] : continuation.refusals });
  }

  // -------------------------------------------------------------------------
  // Apply (Command Center Phase 4, DLV-105)
  // -------------------------------------------------------------------------

  const destinationOf = () => {
    try {
      return normalizePath(realpathSync.native ? realpathSync.native(root) : realpathSync(root));
    } catch {
      return normalizePath(root);
    }
  };

  function applicationView(row) {
    if (!row) return null;
    const plan = parseJson(row.plan_json, {}) || {};
    return {
      application_id: String(row.application_id),
      run_id: String(row.run_id),
      candidate_id: String(row.candidate_id),
      result_ref: String(row.result_ref),
      state: String(row.state),
      revision: Number(row.revision || 1),
      plan,
      outcome: parseJson(row.outcome_json, null),
      journal_dir: row.journal_dir ? String(row.journal_dir) : null,
      integrated_id: row.integrated_id ? String(row.integrated_id) : null,
      actor: String(row.actor),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  const latestApplication = (s, run_id) => {
    const rows = s.listApplications(run_id);
    return rows.length ? rows[rows.length - 1] : null;
  };

  /** One application line in the Master Book's session log, retried alone like any writeback. */
  async function projectApplication(run_id, application, label) {
    const s = getStore();
    const ctx = context(run_id);
    const latest = s.latestResult(run_id);
    if (!ctx || !ctx.workRef || !latest) return;
    try {
      await writeProjection({
        root,
        pmRel,
        workRef: ctx.workRef,
        run: s.getRun(run_id),
        result: parseJson(latest.record_json, {}),
        settings: ctx.settings,
        date: now().slice(0, 10),
        label,
        marker: "v2-apply:" + application.application_id + "@" + application.state,
      });
      event(run_id, "application.projection-written", { application_id: application.application_id, state: application.state });
    } catch (error) {
      event(run_id, "application.projection-failed", { application_id: application.application_id, state: application.state, error: errorText(error) });
    }
  }

  /**
   * Copy the checkout's post-application bytes into a fresh generation and run the
   * policy's checks on it in the isolated checker. Never on the host.
   */
  async function integrateAndCheck(run_id, application_id, { fresh = true } = {}) {
    const s = getStore();
    const ctx = context(run_id);
    const row = s.getApplication(application_id);
    if (!ctx || !row) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, run_id);
    const view = applicationView(row);
    const candidateRow = s.listCandidates(run_id).find((entry) => String(entry.candidate_id) === view.candidate_id);
    const candidate = candidateRow ? parseJson(candidateRow.record_json, null) : null;
    const loaded = policyNow();
    const outcome = { ...(view.outcome || {}) };
    // The checkout now holds these bytes: other candidates snapshotted before them
    // are marked, and their own Apply re-observes their evidence first.
    if (fresh) noteSourceChange(run_id, (view.plan.ops || []).filter((op) => !op.noop).map((op) => op.path));

    if (!candidate || !loaded.ok || !runtime || typeof runtime.checkExecutor !== "function") {
      outcome.checks = { state: "not-run", reason: !runtime || typeof runtime.checkExecutor !== "function" ? "no checker runtime" : !loaded.ok ? "no policy" : "candidate record missing" };
      s.updateApplication(application_id, { state: "checks-pending", outcome_json: outcome }, { expectState: view.state });
      event(run_id, "application.checks-pending", { application_id, reason: outcome.checks.reason });
      await projectApplication(run_id, { application_id, state: "checks-pending" }, "applied; integrated checks not run");
      return deepFreeze({ ok: true, application_id, state: "checks-pending", refusals: [] });
    }

    const generation = "A" + (s.listApplications(run_id).filter((entry) => entry.integrated_id).length + 1);
    const paths = [...new Set([...candidate.base_manifest.map((entry) => entry.path), ...candidate.manifest.map((entry) => entry.path)])];
    let snapshot;
    try {
      snapshot = integratedSnapshot({
        root,
        paths,
        generationsRoot: join(generationsRoot, run_id),
        generation,
        base_manifest: candidate.base_manifest,
        stagingRoot,
      });
    } catch (error) {
      outcome.checks = { state: "not-run", reason: "integrated snapshot failed: " + errorText(error) };
      s.updateApplication(application_id, { state: "checks-pending", outcome_json: outcome }, { expectState: view.state });
      event(run_id, "application.checks-pending", { application_id, reason: outcome.checks.reason });
      return deepFreeze({ ok: true, application_id, state: "checks-pending", refusals: [] });
    }
    // A deliberately deleted path is absent, not untrusted.
    const deleted = new Set((view.plan.ops || []).filter((op) => op.kind === "delete").map((op) => op.path));
    const gaps = snapshot.refusals.filter((entry) => !(entry.reason === "missing" && (deleted.has(entry.path) || !candidate.manifest.some((file) => file.path === entry.path))));
    const base = parseJson(ctx.run.base_manifest_json, []) || [];
    const { criteria, records, integrity } = evidenceFor({ run_id, candidate: snapshot.candidate, policy: loaded.policy, contract: ctx.contract, base });
    const summary = summarizeCriteria(criteria, records);
    const passed = criteria.length > 0 && summary.candidate.outstanding.length === 0 && integrity.length === 0 && gaps.length === 0;
    const failed = records.some((record) => record.state === "failed");
    outcome.checks = {
      state: passed ? "passed" : failed ? "failed" : "inconclusive",
      integrated_id: snapshot.candidate.candidate_id,
      generation,
      evidence: records.map((record) => ({ criterion_id: record.criterion_id, state: record.state, reason: record.reason ?? null, evidence_id: record.evidence_id })),
      integrity,
      gaps,
    };
    const nextState = passed ? "applied" : failed ? "checks-failed" : "checks-inconclusive";
    s.updateApplication(application_id, { state: nextState, integrated_id: snapshot.candidate.candidate_id, outcome_json: outcome }, { expectState: view.state });
    event(run_id, "application." + nextState, { application_id, integrated_id: snapshot.candidate.candidate_id });

    if (passed) {
      const receipt_id = "rc-" + application_id + "-applied";
      s.putReceipt({
        receipt_id,
        kind: "application.applied",
        subject_id: application_id,
        actor: "delivery-v2/protected-integrator",
        state_before: "verified_candidate",
        state_after: "applied_change",
        observed: { candidate_id: view.candidate_id, integrated_id: snapshot.candidate.candidate_id, plan_digest: view.plan.plan_digest, evidence: outcome.checks.evidence },
      });
      const latest = s.latestResult(run_id);
      const record = latest ? parseJson(latest.record_json, null) : null;
      // Only a contract that asked for an applied change is completed by one. For
      // any other request the application is its own observed fact.
      if (record && record.requestedDisposition === "applied_change" && record.observedDisposition !== "applied_change") {
        const next = appendResultVersion(record, { observedDisposition: "applied_change", disposition_receipt_refs: [receipt_id], projection_status: "pending" });
        s.putResult(next);
        s.updateRun(run_id, { result_ref: next.result_id + "@" + next.result_version });
        await project(run_id, next);
      } else {
        await projectApplication(run_id, { application_id, state: nextState }, "applied; integrated checks passed");
      }
    } else {
      await projectApplication(run_id, { application_id, state: nextState }, "applied; integrated checks " + (failed ? "failed" : "inconclusive"));
    }
    return deepFreeze({ ok: true, application_id, state: nextState, refusals: [] });
  }

  /**
   * Is the policy's required verification present, passing and about THIS
   * candidate?
   *
   * The three failure modes are kept apart because they mean different things to
   * the owner: not configured (a gap in the pipeline, stated), never recorded
   * for this candidate (the result predates the verification, so it proves
   * nothing about it), and recorded but failed or inconclusive (the checker
   * spoke and the answer was not yes).
   */
  function requiredVerificationGate({ run_id, policy, record, candidate }) {
    const configured = policy.checks && policy.checks.requiredVerifications ? policy.checks.requiredVerifications.typecheck : null;
    if (!configured || !configured.enabled || configured.enforcement === "advisory") return { ok: true, detail: null };

    const state = (record.criterion_states || []).find((entry) => entry.criterion_id === TYPECHECK_CRITERION_ID);
    if (!state) {
      return { ok: false, detail: "this result carries no " + TYPECHECK_CRITERION_ID + " verification, so the candidate has never been typechecked" };
    }
    if (state.state !== TYPECHECK_STATE.SATISFIED) {
      return { ok: false, detail: TYPECHECK_CRITERION_ID + " is " + state.state + (state.reason ? " (" + state.reason + ")" : "") };
    }

    const evidence = getStore()
      .listEvidence(run_id, String(candidate.candidate_id))
      .map((row) => parseJson(row.record_json, null))
      .filter((entry) => entry && entry.criterion_id === TYPECHECK_CRITERION_ID && entry.verification);
    const latest = evidence.length ? evidence[evidence.length - 1].verification : null;
    const fresh = verificationIsFresh({
      verification: latest,
      candidate_id: String(candidate.candidate_id),
      changed: candidateChangedPaths(candidate).map((change) => String(change.path)),
    });
    if (!fresh.fresh) return { ok: false, detail: fresh.reason };
    return { ok: true, detail: null };
  }

  async function applyCandidate(ctx, { candidate_id, result_ref, command_id, actor }) {
    const s = ctx.store;
    const run_id = String(ctx.run.run_id);
    if (ctx.run.lifecycle !== "CLOSED" || ctx.run.closed_outcome !== "verified_candidate") {
      return refuse(JOURNEY_REFUSALS.APPLY_NOT_VERIFIED, ctx.run.closed_outcome || ctx.run.lifecycle);
    }
    const latest = s.latestResult(run_id);
    const record = latest ? parseJson(latest.record_json, null) : null;
    const currentRef = record ? record.result_id + "@" + record.result_version : null;
    if (!record || !record.candidateVerified) return refuse(JOURNEY_REFUSALS.APPLY_NOT_VERIFIED, "the latest result does not verify a candidate");
    // The owner approved one candidate under one result version; anything else binds nothing.
    if (record.candidate_ref !== candidate_id || currentRef !== result_ref) {
      return refuse(JOURNEY_REFUSALS.APPLY_STALE, { candidate_id: record.candidate_ref, result_ref: currentRef });
    }
    const previous = latestApplication(s, run_id);
    if (previous && String(previous.candidate_id) === candidate_id && !RETRYABLE_APPLICATION_STATES.includes(String(previous.state))) {
      return refuse(JOURNEY_REFUSALS.APPLY_ALREADY, { application_id: String(previous.application_id), state: String(previous.state) });
    }
    const candidateRow = s.listCandidates(run_id).find((entry) => String(entry.candidate_id) === candidate_id);
    const candidate = candidateRow ? parseJson(candidateRow.record_json, null) : null;
    if (!candidate) return refuse(JOURNEY_REFUSALS.APPLY_NOT_VERIFIED, "the candidate record is missing");
    const loaded = policyNow();
    if (!loaded.ok) return refuse(JOURNEY_REFUSALS.NO_POLICY, loaded.refusals);

    // A required verification is checked here as well as in the result, and not
    // as a duplicate: `candidateVerified` was computed when the checks ran, and
    // a result recorded before this verification existed carries no trace of it
    // at all. Missing, failed and stale are three different sentences here and
    // none of them is a pass.
    const verificationGate = requiredVerificationGate({ run_id, policy: loaded.policy, record, candidate });
    if (!verificationGate.ok) return refuse(JOURNEY_REFUSALS.APPLY_UNVERIFIED_TYPECHECK, verificationGate.detail);

    const destination = destinationOf();
    const application_id = contentId("app", { v: 1, run_id, candidate_id, command_id });
    const journal_dir = join(applicationsRoot, application_id);
    const plan = planApplication({
      root,
      candidate,
      publicationScope: ctx.contract.publicationScope,
      protectedPaths: loaded.policy.apply ? loaded.policy.apply.protectedPaths : [],
    });
    s.putDecision({
      decision_id: contentId("d", { v: 1, run_id, kind: "apply", command_id }),
      run_id,
      subject_id: candidate_id,
      subject_revision: Number(record.result_version),
      kind: "apply-candidate",
      requested: "apply",
      actor,
      answer: "apply",
      evidence_seen: { result_ref: currentRef, plan_digest: plan.plan_digest, command_id },
    });

    if (!plan.ok) {
      const state = plan.refusals.length ? "refused" : "conflict";
      s.insertApplication({ application_id, run_id, candidate_id, result_ref: currentRef, destination, state, plan, journal_dir: null, outcome: { refusals: plan.refusals, conflicts: plan.conflicts }, actor, command_id });
      event(run_id, "application." + state, { application_id, refusals: plan.refusals, conflicts: plan.conflicts });
      await projectApplication(run_id, { application_id, state }, state === "conflict" ? "not applied; conflicts with the current checkout" : "not applied; refused");
      return refuse(state === "conflict" ? JOURNEY_REFUSALS.APPLY_CONFLICT : JOURNEY_REFUSALS.APPLY_REFUSED, state === "conflict" ? plan.conflicts : plan.refusals, { application_id });
    }

    const claimed = s.insertApplication({ application_id, run_id, candidate_id, result_ref: currentRef, destination, state: "prepared", claim: claimant, plan, journal_dir, outcome: null, actor, command_id });
    if (!claimed.acquired) {
      return refuse(JOURNEY_REFUSALS.APPLY_IN_PROGRESS, claimed.holder ? String(claimed.holder.application_id) : null);
    }
    event(run_id, "application.prepared", { application_id, writes: plan.writes, actor });

    // Command Center Phase 5: once another application or a CLI edit has changed the
    // base this candidate was checked on, its evidence is observed again on the
    // source it would produce — under the claim, before any byte is written.
    let reassessment = null;
    if (plan.unrelatedDrift.length) {
      reassessment = reassess(ctx, candidate, loaded.policy);
      event(run_id, "application.reassessed", { application_id, state: reassessment.state, drift: plan.unrelatedDrift });
      if (reassessment.state === "failed" || reassessment.state === "inconclusive") {
        s.updateApplication(application_id, { state: "reassessment-failed", outcome_json: { reassessment } }, { expectState: "prepared" });
        await projectApplication(run_id, { application_id, state: "reassessment-failed" }, "not applied; checks fail on current source");
        return refuse(
          JOURNEY_REFUSALS.APPLY_REASSESSMENT,
          { state: reassessment.state, evidence: reassessment.evidence || [], reason: reassessment.reason || null },
          { application_id, state: "reassessment-failed" },
        );
      }
      s.updateApplication(application_id, { outcome_json: { reassessment } }, { expectState: "prepared" });
    }
    const kept = reassessment ? { reassessment } : {};
    if (coordinationOf(s.getRun(run_id)).source_changed) {
      s.updateRun(run_id, { coordination_json: { ...coordinationOf(s.getRun(run_id)), source_changed: null } });
    }

    let prepared;
    try {
      prepared = prepareJournal({ dir: journal_dir, root, candidate, plan });
    } catch (error) {
      s.updateApplication(application_id, { state: "failed", outcome_json: { ...kept, error: errorText(error) } }, { expectState: "prepared" });
      event(run_id, "application.failed", { application_id, error: errorText(error) });
      return refuse(JOURNEY_REFUSALS.APPLY_FAILED, errorText(error), { application_id });
    }
    if (!prepared.ok) {
      s.updateApplication(application_id, { state: "conflict", outcome_json: { ...kept, conflicts: prepared.conflicts } }, { expectState: "prepared" });
      event(run_id, "application.conflict", { application_id, conflicts: prepared.conflicts });
      await projectApplication(run_id, { application_id, state: "conflict" }, "not applied; conflicts with the current checkout");
      return refuse(JOURNEY_REFUSALS.APPLY_CONFLICT, prepared.conflicts, { application_id });
    }

    s.updateApplication(application_id, { state: "writing", claim: claimant }, { expectState: "prepared" });
    const written = writeOperations({ root, dir: journal_dir, ops: plan.ops, faults: applyFaults });
    if (!written.ok) {
      // Undo what this attempt wrote; a path someone edited meanwhile is left alone.
      const rolled = rollbackOperations({ root, dir: journal_dir, ops: plan.ops });
      const state = !rolled.ok ? "interrupted" : written.failed && written.failed.code === "conflict" ? "conflict" : "failed";
      s.updateApplication(application_id, { state, claim: state === "interrupted" ? null : undefined, outcome_json: { ...kept, failed: written.failed, rollback: rolled } }, { expectState: "writing" });
      event(run_id, "application." + state, { application_id, failed: written.failed, restored: rolled.restored, foreign: rolled.foreign });
      if (state !== "interrupted") await projectApplication(run_id, { application_id, state }, state === "conflict" ? "not applied; conflicts with the current checkout" : "not applied; write failed and was rolled back");
      return refuse(state === "conflict" ? JOURNEY_REFUSALS.APPLY_CONFLICT : JOURNEY_REFUSALS.APPLY_FAILED, written.failed, { application_id, state });
    }
    s.updateApplication(
      application_id,
      { state: "checking", claim: claimant, outcome_json: { ...kept, written: written.done.length, unrelatedDrift: plan.unrelatedDrift, migrationPaths: plan.migrationPaths } },
      { expectState: "writing" },
    );
    event(run_id, "application.written", { application_id, written: written.done.length });
    const checked = await integrateAndCheck(run_id, application_id);
    scheduleDrain();
    return checked;
  }

  async function resumeApplication(ctx, application_id) {
    const s = ctx.store;
    const run_id = String(ctx.run.run_id);
    const row = s.getApplication(application_id);
    if (!row || String(row.run_id) !== run_id) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, application_id);
    const view = applicationView(row);
    if (view.state !== "interrupted") return refuse(JOURNEY_REFUSALS.APPLY_STATE, view.state);
    const ops = view.plan.ops || [];
    const inspected = inspectOperations({ root, ops });
    if (inspected.foreign.length) return refuse(JOURNEY_REFUSALS.APPLY_CONFLICT, inspected.foreign, { application_id });
    if (!s.updateApplication(application_id, { state: "writing", claim: claimant }, { expectState: "interrupted" })) {
      return refuse(JOURNEY_REFUSALS.APPLY_IN_PROGRESS, application_id);
    }
    event(run_id, "application.resumed", { application_id, applied: inspected.applied.length, pending: inspected.pending.length });
    const written = writeOperations({ root, dir: String(view.journal_dir), ops, faults: applyFaults });
    if (!written.ok) {
      s.updateApplication(application_id, { state: "interrupted", outcome_json: { ...(view.outcome || {}), failed: written.failed } }, { expectState: "writing" });
      event(run_id, "application.interrupted", { application_id, failed: written.failed });
      return refuse(JOURNEY_REFUSALS.APPLY_FAILED, written.failed, { application_id });
    }
    s.updateApplication(application_id, { state: "checking", claim: claimant }, { expectState: "writing" });
    const checked = await integrateAndCheck(run_id, application_id);
    scheduleDrain();
    return checked;
  }

  function rollbackPreview(ctx, application_id) {
    const row = ctx.store.getApplication(application_id);
    if (!row || String(row.run_id) !== String(ctx.run.run_id)) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, application_id);
    const view = applicationView(row);
    if (!['applied', 'checks-failed', 'checks-inconclusive', 'checks-pending', 'interrupted', 'partly-restored'].includes(view.state) || !view.journal_dir) {
      return refuse(JOURNEY_REFUSALS.APPLY_STATE, view.state);
    }
    return previewRollback({
      root,
      dir: view.journal_dir,
      application_id: view.application_id,
      revision: view.revision,
      ops: view.plan.ops || [],
    });
  }

  async function rollbackApplication(ctx, application_id, actor, preview_digest, expected_revision) {
    const s = ctx.store;
    const run_id = String(ctx.run.run_id);
    const row = s.getApplication(application_id);
    if (!row || String(row.run_id) !== run_id) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, application_id);
    const view = applicationView(row);
    if (!["applied", "checks-failed", "checks-inconclusive", "checks-pending", "interrupted", "partly-restored"].includes(view.state) || !view.journal_dir) {
      return refuse(JOURNEY_REFUSALS.APPLY_STATE, view.state);
    }
    if (!preview_digest || expected_revision == null) {
      return refuse(JOURNEY_REFUSALS.ROLLBACK_PREVIEW_REQUIRED, application_id);
    }
    const preview = rollbackPreview(ctx, application_id);
    if (!preview.ok || preview.digest !== preview_digest || preview.revision !== Number(expected_revision)) {
      return refuse(JOURNEY_REFUSALS.ROLLBACK_PREVIEW_STALE, preview, { application_id });
    }
    if (!s.updateApplication(application_id, { state: "rolling-back", claim: claimant }, { expectState: view.state, expectRevision: view.revision })) {
      return refuse(JOURNEY_REFUSALS.ROLLBACK_PREVIEW_STALE, rollbackPreview(ctx, application_id), { application_id });
    }
    const rolled = rollbackOperations({ root, dir: view.journal_dir, ops: view.plan.ops || [] });
    const state = rolled.ok ? "rolled-back" : "partly-restored";
    s.updateApplication(application_id, { state, outcome_json: { ...(view.outcome || {}), rollback: rolled, rolled_back_by: actor } }, { expectState: "rolling-back" });
    event(run_id, "application." + state, { application_id, restored: rolled.restored, deleted: rolled.deleted, recreated: rolled.recreated, foreign: rolled.foreign, actor });
    const latest = s.latestResult(run_id);
    const record = latest ? parseJson(latest.record_json, null) : null;
    if (rolled.ok && record && record.observedDisposition === "applied_change") {
      const receipt_id = "rc-" + application_id + "-rolled-back";
      s.putReceipt({ receipt_id, kind: "application.rolled-back", subject_id: application_id, actor, state_before: "applied_change", state_after: "verified_candidate", observed: { restored: rolled.restored } });
      const next = appendResultVersion(record, { observedDisposition: "verified_candidate", disposition_receipt_refs: [receipt_id], projection_status: "pending" });
      s.putResult(next);
      s.updateRun(run_id, { result_ref: next.result_id + "@" + next.result_version });
      await project(run_id, next);
    } else if (rolled.ok) {
      await projectApplication(run_id, { application_id, state }, "rolled back; candidate still available");
    }
    if (rolled.restored.length) noteSourceChange(run_id, rolled.restored);
    scheduleDrain();
    return rolled.ok
      ? deepFreeze({ ok: true, application_id, state, restored: rolled.restored, deleted: rolled.deleted, recreated: rolled.recreated, refusals: [] })
      : refuse(JOURNEY_REFUSALS.APPLY_CONFLICT, rolled.foreign.length ? rolled.foreign : rolled.failed, { application_id, state });
  }

  async function recheckApplication(ctx, application_id) {
    const s = ctx.store;
    const run_id = String(ctx.run.run_id);
    const row = s.getApplication(application_id);
    if (!row || String(row.run_id) !== run_id) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, application_id);
    const view = applicationView(row);
    if (!["checks-pending", "checks-failed", "checks-inconclusive"].includes(view.state)) return refuse(JOURNEY_REFUSALS.APPLY_STATE, view.state);
    const inspected = inspectOperations({ root, ops: view.plan.ops || [] });
    if (inspected.foreign.length || inspected.pending.length) {
      return refuse(JOURNEY_REFUSALS.APPLY_CONFLICT, { foreign: inspected.foreign, pending: inspected.pending }, { application_id });
    }
    if (!s.updateApplication(application_id, { state: "checking", claim: claimant }, { expectState: view.state })) {
      return refuse(JOURNEY_REFUSALS.APPLY_IN_PROGRESS, application_id);
    }
    const checked = await integrateAndCheck(run_id, application_id, { fresh: false });
    scheduleDrain();
    return checked;
  }

  /**
   * The owner's Apply command and its follow-ups. `apply` names the exact candidate
   * and result version the owner saw; `resume`, `rollback` and `recheck` name the
   * application.
   */
  async function apply({ run_id, action = "apply", candidate_id = null, result_ref = null, application_id = null, preview_digest = null, expected_revision = null, command_id, actor }) {
    if (action === "rollback-preview") {
      const ctx = context(run_id);
      if (!ctx || !ctx.contract) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, run_id);
      return rollbackPreview(ctx, String(application_id || ""));
    }
    return once(
      { command_id, kind: "V2:apply:" + String(action), actor, payload: { run_id, action, candidate_id, result_ref, application_id, preview_digest, expected_revision } },
      async () => {
        const ctx = context(run_id);
        if (!ctx || !ctx.contract) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, run_id);
        switch (action) {
          case "apply":
            return applyCandidate(ctx, { candidate_id: String(candidate_id || ""), result_ref: String(result_ref || ""), command_id, actor });
          case "resume":
            return resumeApplication(ctx, String(application_id || ""));
          case "rollback":
            return rollbackApplication(ctx, String(application_id || ""), actor, preview_digest, expected_revision);
          case "recheck":
            return recheckApplication(ctx, String(application_id || ""));
          default:
            return refuse(JOURNEY_REFUSALS.UNKNOWN_ACTION, action);
        }
      },
    );
  }

  /**
   * After a restart: an application this process does not hold is interrupted.
   * Nothing is written; the owner resumes or rolls back from what the bytes show.
   */
  function recoverApplications() {
    const s = getStore();
    const recovered = [];
    for (const row of s.listActiveApplications()) {
      if (String(row.state) === "interrupted" || String(row.claim || "") === claimant) continue;
      const view = applicationView(row);
      const inspected = inspectOperations({ root, ops: view.plan.ops || [] });
      if (s.updateApplication(view.application_id, { state: "interrupted", outcome_json: { ...(view.outcome || {}), interruptedFrom: view.state, inspected } }, { expectState: view.state })) {
        event(view.run_id, "application.interrupted", { application_id: view.application_id, from: view.state, inspected });
        recovered.push(view.application_id);
      }
    }
    return recovered;
  }

  /** What the store recorded for one command id — for a relay reconciling a claimed command. */
  function commandState(command_id) {
    const row = getStore().getCommand(String(command_id));
    if (!row) return null;
    return deepFreeze({
      command_id: String(row.command_id),
      kind: String(row.kind),
      actor: String(row.actor),
      subject_id: row.subject_id ? String(row.subject_id) : null,
      recorded: row.outcome_json != null,
      outcome: parseJson(row.outcome_json, null),
    });
  }

  // -------------------------------------------------------------------------
  // Projections
  // -------------------------------------------------------------------------

  function ownerActionFor({ run, jobs, plans, questions, resultRow, settings, application = null }) {
    if (application && application.state === "interrupted") return { kind: "resolve-application", label: "Resolve apply" };
    if (application && ["prepared", "writing", "checking", "rolling-back"].includes(application.state)) return { kind: "none", label: "Applying" };
    if (jobs.some((job) => job.status === "unknown")) return { kind: "reconcile", label: "Reconcile" };
    if (jobs.some((job) => job.stop_requested_at && !job.stop_observed_at && job.status !== "finished")) return { kind: "wait", label: "Stop requested" };
    if (isWaiting(run)) return { kind: "waiting", label: "Waiting" };
    if (settings.mismatch_open) return { kind: "settings", label: "Settings mismatch" };
    if (questions.some((question) => question.status === "open" && question.blocking)) return { kind: "answer", label: "Answer" };
    const latest = plans[plans.length - 1];
    if (run.lifecycle !== "CLOSED" && latest && latest.status === "proposed") {
      return latest.malformed ? { kind: "revise", label: "Revise plan" } : { kind: "review-plan", label: "Review plan" };
    }
    if (jobs.some((job) => job.status === "active" || job.status === "reserved")) return { kind: "none", label: "Working" };
    if (resultRow && resultRow.projection_status === "failed") return { kind: "retry-projection", label: "Retry writeback" };
    if (run.lifecycle === "CLOSED") {
      if (run.closed_outcome === "verified_candidate") {
        const state = application ? application.state : null;
        if (state === "applied") return { kind: "none", label: "Applied" };
        if (state === "checks-pending" || state === "checks-failed" || state === "checks-inconclusive") {
          return { kind: "application-checks", label: state === "checks-pending" ? "Checks pending" : state === "checks-failed" ? "Checks failed" : "Checks inconclusive" };
        }
        if (state === "conflict") return { kind: "apply", label: "Conflict" };
        return { kind: "apply", label: "Apply" };
      }
      return { kind: "none", label: run.closed_outcome === "cancelled" ? "Cancelled" : "Review result" };
    }
    if (run.waiting_reason === "checks-inconclusive") return { kind: "review-result", label: "Review result" };
    if (RESUMABLE_REASONS.includes(String(run.waiting_reason))) return { kind: "resume", label: run.waiting_reason === "paused" ? "Resume" : "Retry" };
    return { kind: "none", label: "Working" };
  }

  function summaryOf(run) {
    const ctx = context(String(run.run_id));
    const s = ctx.store;
    const run_id = String(run.run_id);
    const jobs = s.listJobs(run_id);
    const plans = s.listPlans(run_id);
    const candidates = s.listCandidates(run_id);
    const resultRow = s.latestResult(run_id);
    const result = resultRow ? parseJson(resultRow.record_json, null) : null;
    const application = applicationView(latestApplication(s, run_id));
    const stage = stageProjection({ run, plans, jobs, candidates, result, applied: Boolean(application && application.state === "applied") });
    const file = ctx.workRef ? ctx.workRef.locator.file : null;
    return {
      run_id,
      engine: "v2",
      title: ctx.contract ? ctx.contract.outcome : run_id,
      alias: ctx.workRef ? ctx.workRef.alias : null,
      file,
      campaign: file ? file.split("/")[0] : null,
      lifecycle: String(run.lifecycle),
      closed_outcome: run.closed_outcome ? String(run.closed_outcome) : null,
      waiting_reason: run.waiting_reason ? String(run.waiting_reason) : null,
      executor: ctx.settings.executor ?? null,
      model: ctx.settings.model ?? null,
      effort: ctx.settings.effort ?? null,
      stage: STAGES[stage.current],
      branch: stage.branch,
      active: jobs.some((job) => job.status === "active"),
      ownerAction: ownerActionFor({ run, jobs, plans, questions: s.listQuestions(run_id), resultRow, settings: ctx.settings, application }).label,
      ownerActionKind: ownerActionFor({ run, jobs, plans, questions: s.listQuestions(run_id), resultRow, settings: ctx.settings, application }).kind,
      application: application ? { application_id: application.application_id, state: application.state } : null,
      coordination: coordinationView(run),
      resources: resourceBrief(ctx.grant ? resourceSummary(s, { run_id, unit: ctx.grant.resource_policy.unit }) : null),
      created_at: String(run.created_at),
      updated_at: String(run.updated_at),
    };
  }

  /** The dashboard's per-run usage: estimate, tokens and settled amount stay separate. */
  function resourceBrief(resources) {
    if (!resources) return null;
    return {
      unit: resources.unit,
      settled: resources.settled,
      reserved: resources.reserved,
      unknown: resources.unknown.length,
      providerReportedUsd: resources.provenance.providerReportedUsd,
      measuredTokens: resources.provenance.measuredTokens,
    };
  }

  function list() {
    return deepFreeze(getStore().listRuns().map(summaryOf));
  }

  function detail(run_id) {
    const ctx = context(run_id);
    if (!ctx || !ctx.contract) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, run_id);
    const s = ctx.store;
    const jobs = s.listJobs(run_id);
    const plans = s.listPlans(run_id);
    const questions = s.listQuestions(run_id);
    const messages = s.listMessages(run_id);
    const candidates = s.listCandidates(run_id);
    const resultRow = s.latestResult(run_id);
    const result = resultRow
      ? { ...parseJson(resultRow.record_json, {}), projection_status: String(resultRow.projection_status), projection_reason: resultRow.projection_reason ? String(resultRow.projection_reason) : null }
      : null;
    const candidate = candidates.length ? parseJson(candidates[candidates.length - 1].record_json, null) : null;
    const applications = s.listApplications(run_id).map(applicationView);
    const application = applications.length ? applications[applications.length - 1] : null;
    const activity = s.listActivity(run_id, 60).map((row) => ({
      job_id: String(row.job_id),
      at: row.at ? String(row.at) : null,
      kind: String(row.kind),
      agent: parseJson(row.agent_json, { role: "main" }),
      summary: row.summary ? String(row.summary) : null,
    }));
    const agents = new Map();
    for (const entry of activity) {
      const key = entry.agent.role + ":" + (entry.agent.id || "");
      agents.set(key, { role: entry.agent.role, id: entry.agent.id || null, executor: entry.agent.executor || ctx.settings.backend_id, model: entry.agent.model || null, lastAction: entry.summary, lastAt: entry.at });
    }
    const loaded = policyNow();
    const resources = ctx.grant ? resourceSummary(s, { run_id, unit: ctx.grant.resource_policy.unit }) : null;
    const evidence = candidate
      ? s.listEvidence(run_id, candidate.candidate_id).map((row) => {
          const receipt = parseJson(row.receipt_json, null);
          const record = parseJson(row.record_json, {});
          return {
            criterion_id: String(row.criterion_id),
            criterion_revision: Number(row.criterion_revision),
            state: String(row.state),
            reason: row.reason ? String(row.reason) : null,
            label: row.state === "missing" && row.reason === "zero-executed" ? "Not tested" : String(row.state),
            counts: receipt ? receipt.counts : null,
            exitCode: receipt ? receipt.exitCode : null,
            runner: receipt ? String(receipt.produced_by || "checker") : null,
            command: record && record.observation && record.observation.detail && record.observation.detail.argv ? record.observation.detail.argv : null,
            // Check output is intentionally hashed rather than persisted.  State
            // that evidence gap honestly instead of showing an invented log.
            output: receipt ? String(receipt.redaction || "Output unavailable") : "No check receipt",
            created_at: String(row.created_at),
          };
        })
      : [];
    return deepFreeze({
      ok: true,
      engine: "v2",
      run: {
        run_id,
        lifecycle: String(ctx.run.lifecycle),
        closed_outcome: ctx.run.closed_outcome ? String(ctx.run.closed_outcome) : null,
        waiting_reason: ctx.run.waiting_reason ? String(ctx.run.waiting_reason) : null,
        created_at: String(ctx.run.created_at),
        updated_at: String(ctx.run.updated_at),
      },
      work: {
        title: ctx.contract.outcome,
        alias: ctx.workRef ? ctx.workRef.alias : null,
        file: ctx.workRef ? ctx.workRef.locator.file : null,
        campaign: ctx.workRef ? ctx.workRef.locator.file.split("/")[0] : null,
      },
      contract: {
        contract_id: ctx.contract.contract_id,
        revision: ctx.contract.revision,
        requestedDisposition: ctx.contract.requestedDisposition,
      },
      settings: {
        executor: ctx.settings.executor ?? null,
        backend_id: ctx.settings.backend_id ?? null,
        model: ctx.settings.model ?? null,
        effort: ctx.settings.effort ?? null,
        work_profile: ctx.settings.work_profile ?? null,
        qualification_ref: ctx.settings.qualification_ref ?? null,
        history: ctx.settings.history || [],
        recommendation: ctx.settings.recommendation || null,
      },
      stage: stageProjection({ run: ctx.run, plans, jobs, candidates, result, applied: Boolean(application && application.state === "applied") }),
      plans: plans.map((plan) => ({
        plan_id: String(plan.plan_id),
        revision: Number(plan.revision),
        status: String(plan.status),
        malformed: Boolean(plan.malformed),
        body: parseJson(plan.body_json, {}),
        // This is an immutable, stored plan artifact, never text reread from a
        // worker or checkout.  A valid plan must be reviewable before approval.
        raw_text: String(plan.raw_text || ""),
        digest: String(plan.body_digest),
        contract_revision: Number(plan.contract_revision),
        created_at: String(plan.created_at),
      })),
      questions: questions.map((question) => ({
        question_id: String(question.question_id),
        plan_revision: Number(question.plan_revision),
        stage: String(question.stage),
        text: String(question.text),
        blocking: Boolean(question.blocking),
        status: String(question.status),
        answer: question.answer ? String(question.answer) : null,
      })),
      messages: messages.map((entry) => ({
        message_id: String(entry.message_id),
        body: String(entry.body),
        status: String(entry.status),
        receipt: messageReceipt(String(entry.status)),
        created_at: String(entry.created_at),
        delivered_at: entry.delivered_at ? String(entry.delivered_at) : null,
      })),
      jobs: jobs.map((job) => {
        const settings = parseJson(job.settings_json, {}) || {};
        const effective = parseJson(job.effective_json, null);
        return {
          job_id: String(job.job_id),
          purpose: String(job.purpose),
          access: String(job.access),
          backend_id: String(job.backend_id),
          status: String(job.status),
          outcome: job.outcome ? String(job.outcome) : null,
          dispatched: Boolean(job.dispatch_started_at),
          native_ref: job.native_ref ? String(job.native_ref) : null,
          stop: job.stop_requested_at ? (job.stop_observed_at ? "Stopped" : "Stop requested") : null,
          requested: { model: settings.model ?? null, effort: settings.effort ?? null },
          effective: effective ? { model: effective.model ?? null, effort: effective.effort ?? null, source: effective.source ?? null, verification: effective.verification ?? null } : null,
          reservation: {
            unit: String(job.reservation_unit),
            amount: job.reservation_amount == null ? null : Number(job.reservation_amount),
            open: Boolean(job.reservation_open),
            // An estimate used at admission, not a cap on the running job. The
            // investigated build's 50k reservation under-predicted its own use
            // by roughly ten times and stopped nothing.
            kind: "admission-estimate",
          },
          // Shared plan-window readings bracketing this job, when the worker
          // could take them. Not per-job consumption; see subscription-window.mjs.
          subscription: parseJson(job.subscription_json, null),
          reason: job.reason ? String(job.reason) : null,
          created_at: String(job.created_at),
        };
      }),
      agents: agents.size
        ? [...agents.values()]
        : [{ role: "main", id: null, executor: ctx.settings.backend_id ?? null, model: null, lastAction: null, lastAt: null }],
      activity,
      candidate: candidate
        ? { candidate_id: candidate.candidate_id, generation: candidate.generation, changed: candidateReview({ candidate, sourceRoot: root, applications }), refusals: candidate.refusals }
        : null,
      candidates: candidates.map((row) => {
        const value = parseJson(row.record_json, {});
        return {
          candidate_id: String(value.candidate_id || row.candidate_id),
          generation: String(value.generation || row.generation),
          changed: candidateChangedPaths(value),
          created_at: String(row.created_at),
        };
      }),
      applications: applications.map((entry) => ({
        application_id: entry.application_id,
        candidate_id: entry.candidate_id,
        result_ref: entry.result_ref,
        state: entry.state,
        revision: entry.revision,
        writes: Number(entry.plan.writes || 0),
        ops: (entry.plan.ops || []).map((op) => ({ path: op.path, kind: op.kind, noop: Boolean(op.noop) })),
        conflicts: entry.plan.conflicts || (entry.outcome && entry.outcome.conflicts) || [],
        refusals: entry.plan.refusals || [],
        unrelatedDrift: entry.plan.unrelatedDrift || [],
        migrationPaths: entry.plan.migrationPaths || [],
        checks: entry.outcome && entry.outcome.checks ? entry.outcome.checks : null,
        failed: entry.outcome && entry.outcome.failed ? entry.outcome.failed : null,
        rollback: entry.outcome && entry.outcome.rollback ? {
          restored: entry.outcome.rollback.restored,
          deleted: entry.outcome.rollback.deleted || [],
          recreated: entry.outcome.rollback.recreated || [],
          foreign: entry.outcome.rollback.foreign,
        } : null,
        inspected: entry.outcome && entry.outcome.inspected ? entry.outcome.inspected : null,
        reassessment: entry.outcome && entry.outcome.reassessment ? entry.outcome.reassessment : null,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      })),
      evidence,
      result,
      resources: resources
        ? {
            unit: resources.unit,
            settled: resources.settled,
            reserved: resources.reserved,
            unknown: resources.unknown,
            openReservations: resources.openReservations,
            provenance: resources.provenance,
            allowance: ctx.grant.resource_policy.allowance,
            strict: ctx.grant.resource_policy.strict,
            thresholdUsd: loaded.ok ? loaded.policy.dispatch.thresholdUsd : null,
          }
        : null,
      coordination: { ...coordinationView(ctx.run), holding: holdingFor(ctx) },
      ownerAction: ownerActionFor({ run: ctx.run, jobs, plans, questions, resultRow, settings: ctx.settings, application }),
      events: s.listRunEvents(run_id, 0).slice(-40).map((row) => ({ seq: Number(row.seq), kind: String(row.kind), at: String(row.at), data: parseJson(row.data_json, null) })),
    });
  }

  function events(run_id, after = 0) {
    return deepFreeze(
      getStore()
        .listRunEvents(run_id, after)
        .map((row) => ({ seq: Number(row.seq), kind: String(row.kind), at: String(row.at), data: parseJson(row.data_json, null) })),
    );
  }

  /**
   * The fleet at a glance (Command Center Phase 5): writer and job slots, what
   * occupies them with each item's executor, waiting items with their verdicts,
   * owner decisions, candidates holding reservations, the application in flight,
   * and pairwise verdicts between open items.
   */
  function queue() {
    const s = getStore();
    const loaded = policyNow();
    const concurrency = loaded.ok ? loaded.policy.concurrency : DEFAULT_CONCURRENCY;
    const unit = loaded.ok ? loaded.policy.resources.unit : "usd";
    const fleet = fleetOf({ store: s, unit, since: fleetSince() });
    const runById = new Map(fleet.runs.map((run) => [String(run.run_id), run]));
    const views = new Map();
    const viewOf = (run) => {
      const run_id = String(run.run_id);
      if (!views.has(run_id)) views.set(run_id, summaryOf(run));
      return views.get(run_id);
    };
    const identity = (run) => {
      const view = viewOf(run);
      return { run_id: view.run_id, alias: view.alias, title: view.title, campaign: view.campaign, executor: view.executor, model: view.model, effort: view.effort };
    };
    const running = fleet.running.map((job) => ({
      ...identity(runById.get(String(job.run_id))),
      job_id: String(job.job_id),
      access: String(job.access),
      purpose: String(job.purpose),
      status: String(job.status),
      writer: job.access === "write",
      nativeAgents: fleet.subagents[String(job.job_id)] || 0,
    }));
    // A writer between jobs (checking or repairing) holds its slot without a live job.
    for (const run_id of fleet.writers) {
      if (running.some((row) => row.run_id === run_id && row.writer)) continue;
      const run = runById.get(run_id);
      running.push({ ...identity(run), job_id: null, access: "write", purpose: String(run.waiting_reason || "checking"), status: "checking", writer: true, nativeAgents: 0 });
    }
    const open = fleet.runs.filter((run) => run.lifecycle !== "CLOSED");
    const holding = loaded.ok ? reservingRuns(null).filter((run) => run.lifecycle === "CLOSED") : [];
    const decisions = [...open, ...holding]
      .filter((run) => !isWaiting(run) && DECISION_KINDS.includes(String(viewOf(run).ownerActionKind)))
      .map((run) => ({ ...identity(run), kind: viewOf(run).ownerActionKind, label: viewOf(run).ownerAction }));
    const pairs = [];
    if (loaded.ok) {
      const rules = coordinationRules(concurrency);
      const facts = [...open.filter((run) => isWaiting(run) || s.listJobs(String(run.run_id)).length > 0), ...holding]
        .slice(0, 8)
        .map((run) => runFacts(run, loaded.policy, { intended: true }));
      for (let i = 0; i < facts.length; i += 1) for (let j = i + 1; j < facts.length; j += 1) pairs.push(relate(facts[i], facts[j], rules));
    }
    const applying = s.listActiveApplications()[0] || null;
    return deepFreeze({
      limits: { maxWriters: concurrency.maxWriters, maxJobs: concurrency.maxJobs, fleetAllowance: concurrency.fleetAllowance, unit },
      writers: { used: fleet.writers.length, max: concurrency.maxWriters },
      jobs: { used: fleet.running.length, max: concurrency.maxJobs },
      running,
      waiting: open.filter(isWaiting).map((run) => ({ ...identity(run), ...coordinationView(run) })),
      decisions,
      candidates: holding.map((run) => ({ ...identity(run), sourceChanged: coordinationOf(run).source_changed || null })),
      applying: applying ? { ...identity(runById.get(String(applying.run_id))), application_id: String(applying.application_id), state: String(applying.state) } : null,
      pairs,
      unknown: {
        jobs: fleet.jobs.filter((job) => job.status === "unknown").map((job) => ({ run_id: String(job.run_id), job_id: String(job.job_id) })),
        reservationsWithoutAmount: fleet.resources.openReservationsWithoutAmount,
      },
      nativeAgents: Object.values(fleet.subagents).reduce((sum, count) => sum + Number(count), 0),
    });
  }

  /** An item's verdict before it launches, against the reservations and slots as they are now. */
  function assess({ file, id, withoutStore = false }) {
    const loaded = policyNow();
    if (!loaded.ok) return refuse(JOURNEY_REFUSALS.NO_POLICY, loaded.refusals);
    const policy = loaded.policy;
    const key = normalizeWorkId(id);
    if (!key) return refuse(JOURNEY_REFUSALS.UNKNOWN_RUN, "an item id is required");
    const { sources, facts, title } = itemSource(String(file || ""), key);
    if (!sources.ok) return refuse(JOURNEY_REFUSALS.SOURCE_STALE, sources.reason);
    const rules = coordinationRules(policy.concurrency);
    const footprint = makeFootprint({ declared: facts.declared });
    const self = {
      run_id: null,
      key,
      alias: facts.alias || key,
      held: facts.held,
      dependencyIds: facts.dependencyIds,
      footprint,
      consumes: footprint.known ? consumedPaths({ paths: footprint.paths, readers: [host] }).paths : [],
      checkResources: checkResourcesFor({ criteria: policy.criteria, criteriaRefs: policy.criteria.map((entry) => ({ criterion_id: entry.criterion_id, revision: entry.revision })), rules }),
    };
    const s = withoutStore ? null : getStore();
    const verdict = coordinate({
      self,
      // A new run of the same item supersedes that item's earlier candidate.
      others: s ? reservingRuns(null).filter((run) => !sameItemRun(run, key)).map((run) => runFacts(run, policy)) : [],
      backlog: backlogNow(),
      fleet: s ? fleetOf({ store: s, unit: policy.resources.unit, since: fleetSince() }) : null,
      concurrency: policy.concurrency,
      rules,
      access: "write",
      reservation: reservationOf(policy),
      strict: policy.resources.strict,
      capacity: Boolean(s),
    });
    const same = s ? s.listRuns().some((run) => run.lifecycle !== "CLOSED" && sameItemRun(run, key)) : false;
    const reasons = same ? [{ code: COORDINATION_REASONS.SAME_ITEM, with: facts.alias || key }, ...verdict.reasons] : [...verdict.reasons];
    const final = verdictOf(reasons);
    const recommendation = recommendWorkProfile({
      outcome: title,
      acceptance: sources.bookRaw || "",
      declared: facts.declared,
      dependencyIds: facts.dependencyIds,
      catalog: policy.executors.catalog,
    });
    return deepFreeze({
      ok: true,
      alias: facts.alias || key,
      verdict: final,
      label: VERDICT_LABELS[final],
      reasons,
      startable: !reasons.some((reason) => START_BLOCKERS.includes(reason.code)),
      declared: facts.declared,
      recommendation,
      pairs: verdict.pairs,
    });
  }

  /**
   * Owner allowance settings (Settings panel): the shared window and its usage, the
   * default per-task allowance, and every open run's allowance with its top-up.
   */
  function allowances() {
    const s = getStore();
    const read = loadAllowances({ root });
    const settings = read.settings;
    const loaded = loadPolicy({ root });
    const unit = loaded.ok ? loaded.policy.resources.unit : "tokens";
    const policyFleet = loaded.ok ? loaded.policy.concurrency.fleetAllowance : null;
    const window = fleetWindow({ settings, policyFleetAllowance: policyFleet, now: now() });
    const fleet = fleetOf({ store: s, unit, since: window.since });
    const running = new Set(fleet.running.map((job) => String(job.run_id)));
    const runs = fleet.runs
      .filter((run) => run.lifecycle !== "CLOSED")
      .map((run) => {
        const run_id = String(run.run_id);
        const ctx = context(run_id);
        const view = summaryOf(run);
        const limits = runAllowance({ settings, grantAllowance: ctx.rawGrant ? ctx.rawGrant.resource_policy.allowance : null, run_id });
        const used = resourceSummary(s, { run_id, unit });
        return {
          run_id,
          alias: view.alias,
          title: view.title,
          campaign: view.campaign,
          lifecycle: String(run.lifecycle),
          running: running.has(run_id),
          ...limits,
          used: used.settled,
          reserved: used.reserved,
        };
      });
    return deepFreeze({
      ok: true,
      readable: read.ok,
      error: read.error,
      unit,
      fleet: { ...window, policyLimit: policyFleet == null ? null : Number(policyFleet), used: fleet.resources.settled, reserved: fleet.resources.reserved },
      task: { limit: settings.task.limit, policyLimit: loaded.ok ? loaded.policy.resources.allowance : null },
      runs,
      history: settings.history.slice(-12).reverse(),
    });
  }

  /** Owner test gate: the newest written application and the owner's result for it. */
  function testGate() {
    return gateState({ applications: getStore().listAllApplications(), records: readTestGate({ root }).records });
  }

  /** Record the owner's laptop test result for the newest written application. */
  function recordTests({ actor, ...change }) {
    const outcome = recordTestResult({ root, applications: getStore().listAllApplications(), change, actor, now: now() });
    if (outcome.ok && !outcome.repeated) {
      const record = readTestGate({ root }).records.slice(-1)[0];
      event(record.run_id, "tests.recorded", { actor, result: record.result, proceed: record.proceed, application_id: record.application_id });
    }
    return deepFreeze(outcome);
  }

  /** One owner change to the allowance settings; waiting runs are re-evaluated after it. */
  function changeAllowance({ actor, ...change }) {
    const s = getStore();
    const read = loadAllowances({ root });
    if (!read.ok) return refuse("allowance-settings-unreadable", read.error);
    const loaded = loadPolicy({ root });
    const unit = loaded.ok ? loaded.policy.resources.unit : "tokens";
    const outcome = applyAllowanceChange(read.settings, change, {
      actor,
      now: now(),
      usedFor: (run_id) => resourceSummary(s, { run_id, unit }).settled,
      knownRun: (run_id) => Boolean(s.getRun(run_id)),
    });
    if (!outcome.ok) return deepFreeze(outcome);
    if (!outcome.repeated) {
      saveAllowances({ root, settings: outcome.settings });
      const last = outcome.settings.history[outcome.settings.history.length - 1];
      if (change.run_id) event(String(change.run_id), "run.allowance-changed", { actor, action: last.action, detail: last.detail });
      scheduleDrain();
    }
    return deepFreeze({ ok: true, repeated: outcome.repeated, allowances: allowances() });
  }

  return {
    claimant,
    failures,
    allowances,
    changeAllowance,
    testGate,
    recordTests,
    idle,
    deliver,
    decide,
    answer,
    message,
    control,
    apply,
    reconcile,
    recoverApplications,
    commandState,
    list,
    detail,
    events,
    queue,
    assess,
    drainQueue,
  };
}

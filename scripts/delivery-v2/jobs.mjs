// scripts/delivery-v2/jobs.mjs
// PM Delivery V2 — S1.2: admission, dispatch and honest unknowns.
//
// The sequence this module exists to get right is "PM Delivery — V2
// Architecture.md" §7, step by step:
//
//   1. authenticate the actor and verify the command's target and payload digest;
//   2. in ONE transaction, deduplicate the command, validate authority and
//      resources, reserve the job identity and record the dispatch intent;
//   3. commit `dispatch_started_at` immediately before calling the adapter, then
//      dispatch OUTSIDE the transaction;
//   4. commit the observed outcome, keeping raw usage ahead of interpretation;
//   5. answer a repeated command from its own receipt, never by re-running it.
//
// The one rule everything else follows from
// -----------------------------------------
// "An uncertain launch is an outstanding job, not permission to launch again."
//
// A job whose `dispatch_started_at` is set may have reached the provider even if
// the call appears never to have left the process. So `retryEligibility` permits
// a retry only when that marker is absent, and there is no other code path that
// starts a second dispatch against the same intent. On the qualified backend, a
// lost acknowledgement cannot even be reconciled by dispatch key (the SDK resumes
// by provider thread id only), which means "unknown, reservation held" is a
// resting state this system has to be able to live in rather than an error to
// clear.
//
// Resources, and why `unknown` is a list rather than a zero
// -------------------------------------------------------
// Context §7 keeps reconciled billed cost, provider-reported cost, estimated
// equivalents and subscription consumption apart. Under the qualified backend
// there is no monetary reading at all, so a run's dollar-denominated `settled` is
// 0 with every job named in `unknown` — and `evaluateGrant` still counts the open
// reservations, so unresolved cost keeps blocking new paid work. That is the
// intended behaviour: a job whose cost nobody knows is not free capacity.

import {
  ContractError,
  contentId,
  deepFreeze,
  evaluateGrant,
} from "./contracts.mjs";
import { makeExecutionRef, makeJobRequest, makeResumeRequest } from "./adapters/adapter.mjs";

/** Why an admission refused. Fixtures match on codes, not prose. */
export const ADMISSION_REFUSALS = Object.freeze({
  COMMAND_CONFLICT: "command-conflict",
  GRANT: "grant-refused",
  PROFILE: "profile-not-admitted",
  SOURCE_STALE: "source-stale",
  RUN_CLOSED: "run-closed",
  OUTSTANDING_UNKNOWN: "outstanding-unknown-job",
  REPAIR_BUDGET: "repair-dispatch-limit-reached",
  EXECUTOR_MISMATCH: "executor-profile-mismatch",
  RESOURCES: "resources-refused",
});

/** How a dispatch may (or may not) be retried. */
export const RETRY_VERDICTS = Object.freeze({
  ELIGIBLE: "known-undispatched",
  BLOCKED_UNKNOWN: "potentially-dispatched",
  BLOCKED_TERMINAL: "already-terminal",
  RECONCILED: "reconciled-from-native-record",
  STILL_RUNNING: "still-running",
});

/** Why a claimed dispatch did not reach the provider. */
export const DISPATCH_REFUSALS = Object.freeze({
  CLAIM_HELD: "dispatch-claim-held",
  NOT_RESERVED: "job-not-reserved",
  PRECHECK: "refused-at-dispatch",
});

/**
 * Units a resource policy can actually settle. A reading is settled in `usd` only
 * from a provider-reported amount and in `tokens` only from measured counters;
 * any other unit would be accepted and never settled, so it is refused instead.
 */
export const RESOURCE_UNITS = Object.freeze(["usd", "tokens"]);

/**
 * Token counters published by both native SDKs have inclusive subsets.  Cache
 * reads/creation are included in input and reasoning is included in output, so
 * adding those fields again inflates the only token total we expose or enforce.
 */
export const TOKEN_NORMALIZATION_VERSION = "delivery-v2/tokens@1";

export function normalizedTokenTotal(reading) {
  return Number(reading.input || 0) + Number(reading.output || 0);
}

/** Why resources refused an admission or a dispatch. */
export const RESOURCE_REFUSALS = Object.freeze({
  UNSUPPORTED_UNIT: "unsupported-resource-unit",
  UNIT_MISMATCH: "reservation-unit-mismatch",
  NON_FINITE: "non-finite-resource-amount",
  UNKNOWN_NEXT: "unknown-next-reservation-under-allowance",
  UNKNOWN_OPEN: "unknown-open-reservation-under-allowance",
  UNKNOWN_USAGE_STRICT: "unknown-usage-under-strict-allowance",
});

/** Identity of this supervisor process when a caller supplies none. */
export const DEFAULT_CLAIMANT = "supervisor:" + process.pid;

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/**
 * Mint a job identity from its admission facts.
 *
 * Content-derived and including the command id, so re-admitting the same command
 * produces the same job id and a duplicate dispatch collides on the primary key
 * rather than creating a second reservation.
 */
export function deriveJobId({ run_id, purpose, contract_id, contract_revision, grant_id, command_id, sequence }) {
  return contentId("j", {
    v: 1,
    run_id,
    purpose,
    contract_id,
    contract_revision,
    grant_id,
    command_id: command_id ?? null,
    sequence: sequence ?? 0,
  });
}

/**
 * What has this run consumed, reserved, and failed to account for?
 *
 * Returns four separate quantities and never their sum, because they have
 * different provenance. `nativeTotals` is the backend's own unit (tokens here);
 * `settled`/`reserved` are in the *grant's* unit and only count amounts that
 * actually exist in it.
 *
 * @param {ReturnType<import("./store.mjs").openStore>} store
 * `jobs` replaces the run's jobs with an explicit set — the fleet, for coordination.
 *
 * @param {{run_id?:(string|null), unit?:string, jobs?:(object[]|null)}} input
 */
export function resourceSummary(store, { run_id = null, unit = "usd", jobs: given = null }) {
  const jobs = given || store.listJobs(run_id);
  let settled = 0;
  let reserved = 0;
  let providerReportedUsd = null;
  const unknown = [];
  const nativeTotals = { input: 0, cachedInput: 0, cacheCreation: 0, output: 0, reasoningOutput: 0 };
  let openWithoutAmount = 0;

  for (const job of jobs) {
    const readings = store.listUsageReadings(job.job_id);
    let unsettled = null;
    for (const reading of readings) {
      nativeTotals.input += Number(reading.input || 0);
      nativeTotals.cachedInput += Number(reading.cached_input || 0);
      nativeTotals.cacheCreation += Number(reading.cache_creation || 0);
      nativeTotals.output += Number(reading.output || 0);
      nativeTotals.reasoningOutput += Number(reading.reasoning_output || 0);
      if (reading.cost_usd != null) providerReportedUsd = Number(providerReportedUsd || 0) + Number(reading.cost_usd);
      const amount = settledAmount(reading, unit);
      if (amount == null) unsettled = unsettled || reading;
      else settled += amount;
    }

    if (unsettled) {
      unknown.push({
        job_id: job.job_id,
        status: job.status,
        reason: "usage observed in " + (unsettled.unit || "?") + " with no amount in " + unit,
      });
    } else if (readings.length === 0 && job.dispatch_started_at) {
      // Work may have happened and produced nothing readable. Not free.
      unknown.push({ job_id: job.job_id, status: job.status, reason: "dispatch marked but no usage observed" });
    }

    if (job.reservation_open) {
      const amount = job.reservation_amount == null ? null : Number(job.reservation_amount);
      if (job.reservation_unit !== unit) {
        openWithoutAmount += 1;
        unknown.push({ job_id: job.job_id, status: job.status, reason: "open reservation held in " + job.reservation_unit + ", not " + unit });
      } else if (amount == null || !Number.isFinite(amount)) {
        openWithoutAmount += 1;
        unknown.push({ job_id: job.job_id, status: job.status, reason: "open reservation with no numeric amount" });
      } else {
        reserved += amount;
      }
    }
  }

  return deepFreeze({
    unit,
    settled,
    reserved,
    unknown: Object.freeze(unknown),
    // A reservation that is open with no amount cannot be netted off, so an
    // allowance check has to see it as an obstacle rather than as zero.
    openReservations: jobs.filter((job) => job.reservation_open).length,
    openReservationsWithoutAmount: openWithoutAmount,
    nativeTotals: Object.freeze(nativeTotals),
    provenance: Object.freeze({
      providerReportedUsd,
      providerReportedBasis:
        providerReportedUsd == null
          ? "no provider-reported monetary amount was observed"
          : "sum of provider-reported per-turn amounts; an estimate, not a bill",
      measuredTokens: Object.freeze({
        ...nativeTotals,
        total: nativeTotals.input + nativeTotals.output,
      }),
      tokenNormalizationVersion: TOKEN_NORMALIZATION_VERSION,
      reconciledBilled: null,
      subscriptionUsage: null,
      availableQuota: null,
    }),
    basis: "provider counters and any monetary readings, kept separate; nothing here is a reconciled invoice",
  });
}

/** The amount one reading settles in `unit`, or null when it has none in that unit. */
function settledAmount(reading, unit) {
  if (unit === "usd") return reading.cost_usd == null ? null : Number(reading.cost_usd);
  if (unit === "tokens") {
    return (
      normalizedTokenTotal({ input: reading.input, output: reading.output })
    );
  }
  return null;
}

/**
 * Resource checks that must refuse rather than compare their way past a limit.
 *
 * `evaluateGrant` adds settled + reserved + next against the allowance, which is
 * only honest when every term is a finite amount in the grant's unit. These are
 * the cases where one is not, and each refuses instead of becoming zero.
 *
 * @param {{grant:import("./contracts.mjs").Grant, summary:ReturnType<typeof resourceSummary>,
 *   reservation:{unit:string, amount?:(number|null)}, nextJob?:(number|null)}} input
 */
export function evaluateResources({ grant, summary, reservation, nextJob = undefined }) {
  const refusals = [];
  const policy = grant.resource_policy;
  const add = (code, detail) => refusals.push({ code, detail });
  if (!RESOURCE_UNITS.includes(policy.unit)) {
    add(RESOURCE_REFUSALS.UNSUPPORTED_UNIT, policy.unit + " cannot be settled; use " + RESOURCE_UNITS.join(" or "));
  }
  if (reservation && reservation.unit !== policy.unit) {
    add(RESOURCE_REFUSALS.UNIT_MISMATCH, "reservation in " + reservation.unit + ", grant in " + policy.unit);
  }
  const next = nextJob === undefined ? (reservation ? reservation.amount ?? null : null) : nextJob;
  if (next != null && !Number.isFinite(Number(next))) {
    add(RESOURCE_REFUSALS.NON_FINITE, String(next));
  }
  if (policy.allowance != null) {
    if (next == null) {
      add(RESOURCE_REFUSALS.UNKNOWN_NEXT, "a finite allowance needs a numeric reservation for the next job");
    }
    if (summary.openReservationsWithoutAmount > 0) {
      add(RESOURCE_REFUSALS.UNKNOWN_OPEN, summary.openReservationsWithoutAmount + " open reservation(s) have no amount in " + policy.unit);
    }
    if (policy.strict && summary.unknown.length > 0) {
      add(RESOURCE_REFUSALS.UNKNOWN_USAGE_STRICT, summary.unknown.map((entry) => entry.job_id + ": " + entry.reason));
    }
  }
  return deepFreeze({ ok: refusals.length === 0, refusals: Object.freeze(refusals), next });
}

/**
 * Admit one paid dispatch.
 *
 * Everything from the command dedup to the persisted executionRef happens in a
 * single transaction, so a crash anywhere inside it leaves either a complete
 * reservation or nothing — never a job id with no reservation, or a reservation
 * with no recorded intent.
 *
 * The order of the checks matters. Command deduplication comes first because a
 * retry of an already-admitted command must return the original outcome without
 * re-evaluating anything: re-running the authority check on a duplicate would let
 * a since-revoked grant turn a successful admission into a refusal, and the
 * caller would reasonably conclude the work never started.
 *
 * @param {{store:ReturnType<import("./store.mjs").openStore>, run_id:string,
 *   contract:import("./contracts.mjs").Contract, grant:import("./contracts.mjs").Grant,
 *   profileAdmission:{admitted:boolean, refusals:readonly object[], profile_id:string},
 *   purpose?:string, backend_id:string, reservation:{unit:string, amount?:(number|null), basis:string},
 *   instruction:string, workspace:{root:string, backing?:string},
 *   input_manifest?:object[], checkpoint_ref?:(string|null), native_limits?:object,
 *   command:{command_id:string, actor:string, payload?:object},
 *   now?:(string|null), sourceFresh?:boolean, nextJobCost?:(number|null),
 *   repairDispatchLimit?:(number|null), access?:string,
 *   settings?:(Record<string, unknown>|null), plan_id?:(string|null),
 *   extraRefusals?:{code:string, detail:unknown}[],
 *   gate?:(((store:any)=>{code:string, detail:unknown}[])|null)}} input
 */
export function admitJob({
  store,
  run_id,
  contract,
  grant,
  profileAdmission,
  purpose = "start",
  backend_id,
  reservation,
  instruction,
  workspace,
  input_manifest = [],
  checkpoint_ref = null,
  native_limits = {},
  command,
  now = null,
  sourceFresh = true,
  nextJobCost = undefined,
  repairDispatchLimit = null,
  access = "write",
  settings = null,
  plan_id = null,
  extraRefusals = [],
  gate = null,
}) {
  if (!command || !isNonEmptyString(command.command_id) || !isNonEmptyString(command.actor)) {
    throw new ContractError("admitJob requires an authenticated command_id and actor");
  }

  return store.transaction(() => {
    const admission = store.admitCommand({
      command_id: command.command_id,
      kind: "Deliver:" + purpose,
      actor: command.actor,
      payload: command.payload ?? { run_id, purpose, contract: contract.contract_id, grant: grant.grant_id },
      subject_id: run_id,
    });

    if (admission.status === "conflict") {
      return deepFreeze({
        admitted: false,
        duplicate: false,
        refusals: [{ code: ADMISSION_REFUSALS.COMMAND_CONFLICT, detail: admission.reason }],
        job: null,
        request: null,
      });
    }
    if (admission.status === "duplicate") {
      // Same actor, same payload: hand back what happened the first time. No
      // authority re-check, no second reservation, no dispatch.
      const previous = admission.outcome;
      return deepFreeze({
        admitted: Boolean(previous && previous.admitted),
        duplicate: true,
        refusals: (previous && previous.refusals) || [],
        job: previous && previous.job_id ? store.getJob(previous.job_id) : null,
        request: previous ? previous.request : null,
      });
    }

    /** @type {{code:string, detail:unknown}[]} */
    const refusals = [];

    const run = store.getRun(run_id);
    if (!run) throw new ContractError("admitJob: unknown run " + run_id);
    if (run.lifecycle === "CLOSED") {
      refusals.push({ code: ADMISSION_REFUSALS.RUN_CLOSED, detail: run.closed_outcome });
    }
    if (!sourceFresh) {
      refusals.push({ code: ADMISSION_REFUSALS.SOURCE_STALE, detail: "the bound source has changed since authorization" });
    }
    if (!profileAdmission || !profileAdmission.admitted) {
      refusals.push({
        code: ADMISSION_REFUSALS.PROFILE,
        detail: profileAdmission ? profileAdmission.refusals : "no profile admission was supplied",
      });
    }
    // With more than one executor selectable, an admitted profile is no longer
    // self-evidently a profile *for the backend about to be called*. Passing
    // Claude's admission with Codex's backend_id would qualify one provider and
    // dispatch to the other, and the job row would then name a backend nobody
    // qualified. The pairing is checked here, where the reservation is taken.
    if (profileAdmission && profileAdmission.backend_id && profileAdmission.backend_id !== backend_id) {
      refusals.push({
        code: ADMISSION_REFUSALS.EXECUTOR_MISMATCH,
        detail:
          "the admitted profile describes " +
          profileAdmission.backend_id +
          " but this dispatch is addressed to " +
          backend_id,
      });
    }

    const resources = resourceSummary(store, { run_id, unit: grant.resource_policy.unit });
    const resourceVerdict = evaluateResources({ grant, summary: resources, reservation, nextJob: nextJobCost });
    const verdict = evaluateGrant(grant, {
      now: now || store.now(),
      contract,
      executor_profile_id: profileAdmission ? profileAdmission.profile_id : null,
      effect: "native_dispatch",
      settled: resources.settled,
      reserved: resources.reserved,
      nextJob: resourceVerdict.next,
    });
    if (!verdict.permitted) refusals.push({ code: ADMISSION_REFUSALS.GRANT, detail: verdict.refusals });
    if (!resourceVerdict.ok) refusals.push({ code: ADMISSION_REFUSALS.RESOURCES, detail: resourceVerdict.refusals });
    for (const entry of extraRefusals || []) refusals.push(entry);
    // Coordination (Command Center Phase 5) is evaluated here, inside the admission
    // transaction, so two admissions cannot both take the last writer slot.
    if (typeof gate === "function") for (const entry of gate(store) || []) refusals.push(entry);

    if (purpose === "repair" && repairDispatchLimit != null) {
      const repairs = store.listJobs(run_id).filter((job) => job.purpose === "repair").length;
      if (repairs >= repairDispatchLimit) {
        refusals.push({
          code: ADMISSION_REFUSALS.REPAIR_BUDGET,
          detail: repairs + " supervisor-dispatched repair(s) already; the limit is " + repairDispatchLimit,
        });
      }
    }

    if (refusals.length) {
      const outcome = { admitted: false, refusals, job_id: null, request: null };
      store.recordCommandOutcome(command.command_id, outcome);
      return deepFreeze({ admitted: false, duplicate: false, refusals, job: null, request: null });
    }

    const job_id = deriveJobId({
      run_id,
      purpose,
      contract_id: contract.contract_id,
      contract_revision: contract.revision,
      grant_id: grant.grant_id,
      command_id: command.command_id,
      sequence: store.listJobs(run_id).length,
    });

    const request = makeJobRequest({
      job_id,
      run_id,
      purpose,
      contract: { contract_id: contract.contract_id, revision: contract.revision },
      grant: { grant_id: grant.grant_id, revision: grant.revocation_version },
      input_manifest,
      checkpoint_ref,
      workspace: { ...workspace, access: workspace.access || access },
      reservation,
      native_limits,
      backend_id,
      instruction,
      settings,
    });

    // The reservation and the executionRef are persisted here, before anything is
    // dispatched. `dispatch_started_at` stays NULL: this job is known-undispatched
    // until the marker says otherwise.
    store.insertJob({
      job_id,
      run_id,
      purpose,
      backend_id,
      dispatch_key: request.executionRef.dispatch_key,
      contract_id: contract.contract_id,
      contract_revision: contract.revision,
      grant_id: grant.grant_id,
      grant_revision: grant.revocation_version,
      profile_id: profileAdmission.profile_id,
      reservation,
      request,
      access: request.workspace.access,
      settings,
      plan_id,
    });
    store.putReceipt({
      receipt_id: "rc-" + job_id,
      kind: "job.reserved",
      subject_id: job_id,
      actor: command.actor,
      payload_digest: null,
      state_before: "none",
      state_after: "reserved",
      observed: { run_id, purpose, contract_revision: contract.revision, grant_id: grant.grant_id },
    });
    store.recordCommandOutcome(command.command_id, { admitted: true, refusals: [], job_id, request });

    return deepFreeze({ admitted: true, duplicate: false, refusals: [], job: store.getJob(job_id), request });
  });
}

/**
 * May this job be dispatched again?
 *
 * The only "yes" is a job whose dispatch marker was never committed. Everything
 * else — including a job whose adapter call threw before any native identity
 * appeared — is potentially dispatched and stays outstanding.
 *
 * @param {{dispatch_started_at:(string|null), status:string}} job
 */
export function retryEligibility(job) {
  if (job.status === "finished" && job.outcome) {
    return deepFreeze({ eligible: false, verdict: RETRY_VERDICTS.BLOCKED_TERMINAL, reason: "this job already has an outcome" });
  }
  if (job.dispatch_started_at) {
    return deepFreeze({
      eligible: false,
      verdict: RETRY_VERDICTS.BLOCKED_UNKNOWN,
      reason:
        "dispatch_started_at is set, so the request may have reached the provider; reconcile or hold, never launch again",
    });
  }
  return deepFreeze({
    eligible: true,
    verdict: RETRY_VERDICTS.ELIGIBLE,
    reason: "no dispatch marker was committed, so this intent is known not to have been sent",
  });
}

/**
 * Persist what an adapter observed.
 *
 * Usage first, always. Evidence & Autonomy §8: "Preserve raw output/usage and
 * reconstruct from the actual candidate and trusted receipts" — a malformed final
 * message must not erase what the turn spent, and an unknown outcome must not be
 * rounded to `failed` because that is the tidier row to write.
 *
 * `reservation_open` closes only when the job reached a terminal outcome *and*
 * produced a monetary reading. Under a backend with no monetary reading it never
 * closes, which is the honest state and is exactly what keeps the allowance check
 * conservative.
 *
 * @param {{store:ReturnType<import("./store.mjs").openStore>, job_id:string,
 *   result:import("./adapters/adapter.mjs").AdapterResult}} input
 */
export function recordDispatchResult({ store, job_id, result }) {
  return store.transaction(() => {
    const job = store.getJob(job_id);
    if (!job) throw new ContractError("recordDispatchResult: unknown job " + job_id);

    if (result.executionRef && result.executionRef.native_ref) {
      store.bindNativeRef(job_id, result.executionRef.native_ref);
    }

    const readings = (result.observations && result.observations.usageReadings) || [];
    let inserted = 0;
    for (const reading of readings) {
      const outcome = store.recordUsageReading(job_id, {
        reading_key: "turn:" + String(reading.turn ?? 0),
        unit: reading.usage.unit,
        input: reading.usage.input,
        cachedInput: reading.usage.cachedInput,
        cacheCreation: reading.usage.cacheCreation,
        output: reading.usage.output,
        reasoningOutput: reading.usage.reasoningOutput,
        costUsd: reading.usage.costUsd,
        note: reading.usage.basis,
      });
      if (outcome.inserted) inserted += 1;
    }

    // Settled only when every reading carries an amount in the reservation's unit.
    // One unpriced turn keeps the whole reservation open.
    const monetaryObserved =
      readings.length > 0 &&
      (job.reservation_unit === "tokens" || readings.every((reading) => reading.usage.costUsd != null));
    const terminal = result.status === "finished";
    const nativeOutcome = (result.observations && result.observations.nativeOutcome) || null;

    if (result.observations && result.observations.effective) {
      store.setJobEffective(job_id, result.observations.effective);
    }
    if (result.observations && Array.isArray(result.observations.activity) && result.observations.activity.length) {
      store.appendActivity(job.run_id, job_id, result.observations.activity);
    }

    // A stop that was already observed keeps its record: the late end of the
    // stream adds usage and activity, not a different status.
    const stopped = Boolean(job.stop_observed_at) && job.status === "finished";
    const next = store.updateJob(job_id, {
      status: stopped ? job.status : result.status,
      outcome: stopped ? job.outcome : terminal ? nativeOutcome : null,
      observations_json: JSON.stringify({ observations: result.observations, claims: result.claims, reason: result.reason }),
      reason: result.reason,
      // Terminal + a monetary reading closes it. Anything else keeps it open.
      reservation_open: terminal && monetaryObserved ? 0 : 1,
      publication_revoked: job.publication_revoked,
    });

    store.putReceipt({
      receipt_id: "rc-" + job_id + "-" + result.operation,
      kind: "job." + result.operation,
      subject_id: job_id,
      actor: "supervisor",
      state_before: job.status,
      state_after: next.status,
      observed: {
        dispatchAttempted: result.dispatchAttempted,
        quarantined: result.quarantined,
        readingsInserted: inserted,
        readingsSeen: readings.length,
        reason: result.reason,
      },
    });

    return deepFreeze({ job: next, readingsInserted: inserted, readingsSeen: readings.length });
  });
}

/**
 * Dispatch an admitted job through the adapter.
 *
 * The marker is committed by `onDispatchStart`, which the adapter invokes
 * immediately before the external call and after nothing else. That is why this
 * function does not simply write the marker itself before calling `start`: the
 * guarantee wanted is "committed as late as possible while still being before the
 * call", and only the adapter knows where that line is.
 *
 * The dispatch itself happens OUTSIDE any transaction (§7 step 3). Holding a
 * write lock across a network call would serialize the store behind the slowest
 * provider turn, and a crash mid-call would roll back the marker that exists
 * precisely to survive it.
 *
 * @param {{store:ReturnType<import("./store.mjs").openStore>, adapter:any,
 *   job_id:string, request:any, priorRef?:(object|null), runOptions?:object,
 *   claimant?:string, preDispatch?:((job:any)=>any), onDispatchStarted?:((input:{job_id:string, at:string})=>void)}} input
 */
export async function dispatchJob({
  store,
  adapter,
  job_id,
  request,
  priorRef = null,
  runOptions = {},
  claimant = DEFAULT_CLAIMANT,
  preDispatch = null,
  onDispatchStarted = null,
}) {
  const job = store.getJob(job_id);
  if (!job) throw new ContractError("dispatchJob: unknown job " + job_id);
  // The job row names the backend the reservation was taken against. Dispatching
  // it through a different adapter would spend one provider's allowance on
  // another's work and leave the row describing neither.
  if (adapter && adapter.backend_id && String(job.backend_id) !== adapter.backend_id) {
    throw new ContractError(
      "dispatchJob: job " + job_id + " is reserved for " + job.backend_id + "; refusing to dispatch it through " + adapter.backend_id,
    );
  }
  const eligibility = retryEligibility(job);
  if (!eligibility.eligible) {
    return deepFreeze({ dispatched: false, eligibility, job });
  }

  // Exclusive claim first. Two callers racing on one reserved job both see an
  // absent marker; only one can take the claim.
  const claim = store.transaction(() => store.claimDispatch(job_id, claimant));
  if (!claim.acquired) {
    return deepFreeze({
      dispatched: false,
      eligibility,
      job: claim.job,
      refusals: [{ code: DISPATCH_REFUSALS.CLAIM_HELD, detail: claim.reason, holder: claim.holder }],
    });
  }

  // Authority, source and resources are checked again at the last moment before
  // the provider is contacted, not only when the job was admitted.
  if (typeof preDispatch === "function") {
    const verdict = await preDispatch(store.getJob(job_id));
    if (!verdict || !verdict.ok) {
      const refusals = (verdict && verdict.refusals) || [{ code: DISPATCH_REFUSALS.PRECHECK, detail: "no verdict" }];
      const after = store.transaction(() => {
        const current = store.getJob(job_id);
        const next = store.updateJob(job_id, {
          status: "finished",
          outcome: "cancelled",
          reason: "refused before dispatch: " + refusals.map((entry) => entry.code).join(", "),
          observations_json: JSON.stringify({ refusedAtDispatch: refusals }),
          // Provably undispatched: nothing was sent, so nothing stays reserved.
          reservation_open: 0,
          publication_revoked: current.publication_revoked,
        });
        store.putReceipt({
          receipt_id: "rc-" + job_id + "-refused-at-dispatch",
          kind: "job.refused-at-dispatch",
          subject_id: job_id,
          actor: claimant,
          state_before: current.status,
          state_after: next.status,
          observed: { refusals },
        });
        return next;
      });
      return deepFreeze({ dispatched: false, eligibility, job: after, refusals: [{ code: DISPATCH_REFUSALS.PRECHECK, detail: refusals }] });
    }
    store.recordDispatchIntent(job_id, claimant, { ...(verdict.intent || {}), claimant, checked: true });
  }

  const onDispatchStart = ({ at }) => {
    store.markDispatchStarted(job_id, at);
    if (typeof onDispatchStarted === "function") onDispatchStarted({ job_id, at });
  };

  let result;
  try {
    result = priorRef
      ? await adapter.resume(priorRef, request, { ...runOptions, onDispatchStart })
      : await adapter.start(request, { ...runOptions, onDispatchStart });
  } catch (error) {
    const current = store.getJob(job_id);
    if (current && current.dispatch_started_at) {
      // Past the marker: the provider may have been reached. Hold, never retry.
      store.updateJob(job_id, {
        status: "unknown",
        outcome: null,
        reason: "adapter threw after the dispatch marker: " + String((error && error.message) || error),
        reservation_open: 1,
        publication_revoked: current.publication_revoked,
      });
    } else {
      // Before the marker nothing was sent; the claim goes back so the same intent
      // can be dispatched later.
      store.releaseClaim(job_id, claimant);
    }
    throw error;
  }

  const recorded = recordDispatchResult({ store, job_id, result });
  return deepFreeze({ dispatched: true, eligibility, result, ...recorded });
}

/**
 * Release claims left by a supervisor that stopped before its dispatch marker.
 *
 * Safe because the marker is the only evidence of a possible send: a claimed job
 * with no marker is known-undispatched whoever held the claim.
 *
 * @param {{store:ReturnType<import("./store.mjs").openStore>, claimant:string}} input
 */
export function releaseStaleClaims({ store, claimant }) {
  const released = [];
  for (const job of store.listClaimedUndispatched()) {
    if (job.dispatch_claim === claimant) continue;
    if (store.releaseClaim(String(job.job_id), String(job.dispatch_claim))) {
      store.putReceipt({
        receipt_id: "rc-" + job.job_id + "-claim-released-" + String(job.dispatch_claimed_at || ""),
        kind: "job.claim-released",
        subject_id: String(job.job_id),
        actor: claimant,
        state_before: "claimed",
        state_after: "reserved",
        observed: { previousHolder: job.dispatch_claim, reason: "claimant is not this supervisor and no dispatch marker was committed" },
      });
      released.push(String(job.job_id));
    }
  }
  return deepFreeze(released);
}

/**
 * Build the resume request for an admitted continuation.
 *
 * Thin, but it is the only place the prior reference and the new job meet, and
 * `makeResumeRequest` is where the refusals live (same job id, no observed native
 * session, wrong backend).
 *
 * @param {{store:ReturnType<import("./store.mjs").openStore>, priorJobId:string, request:object}} input
 */
export function resumeRequestFor({ store, priorJobId, request }) {
  const prior = store.getJob(priorJobId);
  if (!prior) throw new ContractError("resumeRequestFor: unknown job " + priorJobId);
  const priorRef = makeExecutionRef({
    backend_id: prior.backend_id,
    dispatch_key: prior.dispatch_key,
    native_ref: prior.native_ref,
  });
  return deepFreeze({ priorRef, request: makeResumeRequest(priorRef, request) });
}

/**
 * After a restart, work out what each outstanding job actually is — without
 * dispatching anything.
 *
 * Three verdicts, and the middle one is the one that matters:
 *
 *   - no dispatch marker            → known undispatched; may be dispatched under
 *                                     the same recorded intent
 *   - marker, reconciled            → the backend established what happened
 *   - marker, not reconcilable      → unknown; reservation held; escalate
 *
 * `inspect` is read-only and free. On the qualified backend it cannot reconcile
 * by dispatch key at all, so the third verdict is the common one, and the system
 * has to be able to sit in it indefinitely.
 *
 * Each job is reconciled by *its own* executor. A job row records the backend it
 * was dispatched to, and that column is the authority: with two selectable
 * executors, an installation can hold outstanding jobs from both at once, and
 * asking Claude's adapter about a Codex dispatch would produce an answer about
 * nothing. `resolveAdapter` supplies the right one; the single-`adapter` form is
 * still accepted and now refuses jobs that are not its own rather than
 * confidently inspecting them.
 *
 * @param {{store:ReturnType<import("./store.mjs").openStore>, adapter?:any,
 *   resolveAdapter?:(backend_id:string, job?:any)=>any,
 *   recover?:((job:any)=>any)}} input
 */
export async function reconcileOutstanding({ store, adapter = null, resolveAdapter = null, recover = null }) {
  const outcomes = [];
  const adapterFor = async (backend_id, job) => {
    if (resolveAdapter) return (await resolveAdapter(backend_id, job)) || null;
    if (adapter && adapter.backend_id === backend_id) return adapter;
    if (adapter && !adapter.backend_id) return adapter;
    return null;
  };
  for (const job of store.listOutstandingJobs()) {
    // A native record that still holds the full output (a retained container log,
    // for instance) settles the job from what actually happened. It is read, never
    // re-run: `recover` returns an adapter result or null, and dispatches nothing.
    if (job.dispatch_started_at && typeof recover === "function") {
      const recovered = await recover(job);
      if (recovered && recovered.running) {
        outcomes.push(
          deepFreeze({
            job_id: job.job_id,
            verdict: RETRY_VERDICTS.STILL_RUNNING,
            status: String(job.status),
            backend_id: String(job.backend_id),
            dispatchEstablished: true,
            reservationHeld: true,
            detail: "the job's execution environment is still running; it is left alone",
          }),
        );
        continue;
      }
      if (recovered && recovered.result) {
        const recorded = recordDispatchResult({ store, job_id: String(job.job_id), result: recovered.result });
        store.putReceipt({
          receipt_id: "rc-" + job.job_id + "-recovered",
          kind: "job.recovered",
          subject_id: String(job.job_id),
          actor: "supervisor",
          state_before: String(job.status),
          state_after: String(recorded.job.status),
          observed: { source: recovered.source || "native record", readingsInserted: recorded.readingsInserted },
        });
        outcomes.push(
          deepFreeze({
            job_id: job.job_id,
            verdict: RETRY_VERDICTS.RECONCILED,
            status: String(recorded.job.status),
            backend_id: String(job.backend_id),
            dispatchEstablished: true,
            reservationHeld: Boolean(recorded.job.reservation_open),
            detail: "reconciled from " + (recovered.source || "a native record") + "; nothing was dispatched again",
          }),
        );
        continue;
      }
    }
    if (!job.dispatch_started_at) {
      outcomes.push(
        deepFreeze({
          job_id: job.job_id,
          verdict: RETRY_VERDICTS.ELIGIBLE,
          status: job.status,
          reservationHeld: Boolean(job.reservation_open),
          detail: "no dispatch marker; this intent was never sent",
        }),
      );
      continue;
    }

    const ref = makeExecutionRef({
      backend_id: job.backend_id,
      dispatch_key: job.dispatch_key,
      native_ref: job.native_ref,
    });

    const jobAdapter = await adapterFor(String(job.backend_id), job);
    if (!jobAdapter) {
      // Not an error, and emphatically not a reason to guess: an outstanding job
      // whose executor is unavailable stays outstanding with its reservation
      // held. Reconciling it with the wrong backend would write an authoritative
      // "not established" from an adapter that was never asked about this job.
      outcomes.push(
        deepFreeze({
          job_id: job.job_id,
          verdict: RETRY_VERDICTS.BLOCKED_UNKNOWN,
          status: String(job.status),
          backend_id: String(job.backend_id),
          dispatchEstablished: null,
          reservationHeld: true,
          detail:
            "no adapter for " +
            job.backend_id +
            " is available in this process; the job stays outstanding and is not inspected by another executor",
        }),
      );
      continue;
    }

    const inspection = await jobAdapter.inspect(ref);
    const established = Boolean(inspection.observations && inspection.observations.dispatchEstablished);

    store.updateJob(job.job_id, {
      status: "unknown",
      outcome: job.outcome,
      observations_json: JSON.stringify({ inspect: inspection.observations, reason: inspection.reason }),
      reason: inspection.reason,
      reservation_open: 1,
      publication_revoked: job.publication_revoked,
    });
    store.putReceipt({
      receipt_id: "rc-" + job.job_id + "-inspect-" + store.listReceipts(job.job_id).length,
      kind: "job.inspect",
      subject_id: job.job_id,
      actor: "supervisor",
      state_before: job.status,
      state_after: "unknown",
      observed: { established, reason: inspection.reason },
    });

    outcomes.push(
      deepFreeze({
        job_id: job.job_id,
        verdict: RETRY_VERDICTS.BLOCKED_UNKNOWN,
        status: "unknown",
        backend_id: String(job.backend_id),
        dispatchEstablished: established,
        reservationHeld: true,
        detail: inspection.reason,
      }),
    );
  }
  return deepFreeze(outcomes);
}

/**
 * Request a stop.
 *
 * Publication authority is revoked at the supervisor immediately and
 * unconditionally — that part does not depend on the provider agreeing, and
 * Architecture §7 is explicit that it happens at once. The job's *status*,
 * however, only moves as far as the evidence allows: with a requested-only stop
 * primitive there is no acknowledgement, so it stays `unknown` and its
 * reservation stays open.
 *
 * @param {{store:ReturnType<import("./store.mjs").openStore>, adapter:any, job_id:string,
 *   observeStop?:((job:any)=>any)}} input
 */
export async function requestStop({ store, adapter, job_id, observeStop = null }) {
  const job = store.getJob(job_id);
  if (!job) throw new ContractError("requestStop: unknown job " + job_id);

  // Revoke first. If the adapter call throws, publication is still revoked.
  store.updateJob(job_id, {
    status: job.status,
    outcome: job.outcome,
    observations_json: job.observations_json,
    reason: job.reason,
    reservation_open: job.reservation_open,
    publication_revoked: 1,
  });
  store.markStopRequested(job_id);

  const ref = makeExecutionRef({
    backend_id: job.backend_id,
    dispatch_key: job.dispatch_key,
    native_ref: job.native_ref,
  });
  const result = await adapter.stop(ref);
  const confirmed = Boolean(result.observations && result.observations.providerConfirmed);
  // The execution environment's own observation: for a container worker, its
  // removal ends every process it held. That establishes no further local effect,
  // not that the provider stopped billing.
  const environment = typeof observeStop === "function" ? await observeStop(store.getJob(job_id)) : null;
  const observed = confirmed || Boolean(environment && environment.stopObserved);
  if (observed) store.markStopObserved(job_id);

  // A job that already reached a terminal outcome keeps it. Stopping something
  // that has finished revokes its publication authority — it does not un-observe
  // what happened, and it certainly does not relabel a succeeded job "cancelled".
  const current = store.getJob(job_id);
  const alreadyTerminal = current.status === "finished" && Boolean(current.outcome);
  const next = store.updateJob(job_id, {
    status: alreadyTerminal ? current.status : observed ? "finished" : "unknown",
    outcome: alreadyTerminal ? current.outcome : observed ? "cancelled" : current.outcome,
    observations_json: JSON.stringify({ stop: result.observations, environment, reason: result.reason }),
    reason: result.reason,
    // Usage that was never read stays reserved even when the stop is observed.
    reservation_open: alreadyTerminal ? current.reservation_open : 1,
    publication_revoked: 1,
  });
  store.putReceipt({
    receipt_id: "rc-" + job_id + "-stop",
    kind: "job.stop",
    subject_id: job_id,
    actor: "supervisor",
    state_before: job.status,
    state_after: next.status,
    observed: { ...result.observations, environment },
  });

  return deepFreeze({
    job: next,
    publicationRevoked: true,
    providerConfirmed: confirmed,
    stopObserved: observed,
    display: observed ? "Stopped" : "Stop requested",
    outcomeRetained: alreadyTerminal,
    reason: result.reason,
  });
}

/**
 * Can a late result from this job still publish?
 *
 * Always consulted before anything is applied. A revoked job's output may be
 * preserved and inspected; it may not become an effect.
 *
 * @param {{publication_revoked:number}} job
 */
export function mayPublish(job) {
  return deepFreeze({
    allowed: !job.publication_revoked,
    reason: job.publication_revoked
      ? "publication authority was revoked for this job; late output is preserved but cannot be applied"
      : null,
  });
}

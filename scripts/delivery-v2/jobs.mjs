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
});

/** How a dispatch may (or may not) be retried. */
export const RETRY_VERDICTS = Object.freeze({
  ELIGIBLE: "known-undispatched",
  BLOCKED_UNKNOWN: "potentially-dispatched",
  BLOCKED_TERMINAL: "already-terminal",
});

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
 * @param {{run_id:string, unit?:string}} input
 */
export function resourceSummary(store, { run_id, unit = "usd" }) {
  const jobs = store.listJobs(run_id);
  let settled = 0;
  let reserved = 0;
  const unknown = [];
  const nativeTotals = { input: 0, cachedInput: 0, output: 0, reasoningOutput: 0 };

  for (const job of jobs) {
    const readings = store.listUsageReadings(job.job_id);
    for (const reading of readings) {
      nativeTotals.input += Number(reading.input || 0);
      nativeTotals.cachedInput += Number(reading.cached_input || 0);
      nativeTotals.output += Number(reading.output || 0);
      nativeTotals.reasoningOutput += Number(reading.reasoning_output || 0);
    }

    const monetary = readings.filter((reading) => reading.cost_usd != null);
    if (job.reservation_unit === unit && monetary.length > 0) {
      settled += monetary.reduce((sum, reading) => sum + Number(reading.cost_usd), 0);
    } else if (readings.length > 0 || job.dispatch_started_at) {
      // Work happened (or may have happened) and produced no amount in this unit.
      unknown.push({
        job_id: job.job_id,
        status: job.status,
        reason:
          readings.length === 0
            ? "dispatch marked but no usage observed"
            : "usage observed in " + (readings[0].unit || "?") + " with no amount in " + unit,
      });
    }

    if (job.reservation_open) {
      reserved += job.reservation_amount == null ? 0 : Number(job.reservation_amount);
      if (job.reservation_amount == null) {
        unknown.push({ job_id: job.job_id, status: job.status, reason: "open reservation with no numeric amount" });
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
    nativeTotals: Object.freeze(nativeTotals),
    basis: "provider counters and any monetary readings, kept separate; nothing here is a reconciled invoice",
  });
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
 *   now?:string, sourceFresh?:boolean, nextJobCost?:(number|null),
 *   repairDispatchLimit?:(number|null)}} input
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
  nextJobCost = null,
  repairDispatchLimit = null,
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
    const verdict = evaluateGrant(grant, {
      now: now || store.now(),
      contract,
      executor_profile_id: profileAdmission ? profileAdmission.profile_id : null,
      effect: "native_dispatch",
      settled: resources.settled,
      reserved: resources.reserved,
      nextJob: nextJobCost,
    });
    if (!verdict.permitted) refusals.push({ code: ADMISSION_REFUSALS.GRANT, detail: verdict.refusals });

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
      workspace,
      reservation,
      native_limits,
      backend_id,
      instruction,
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
        output: reading.usage.output,
        reasoningOutput: reading.usage.reasoningOutput,
        costUsd: reading.usage.costUsd,
        note: reading.usage.basis,
      });
      if (outcome.inserted) inserted += 1;
    }

    const monetaryObserved = readings.some((reading) => reading.usage.costUsd != null);
    const terminal = result.status === "finished";
    const nativeOutcome = (result.observations && result.observations.nativeOutcome) || null;

    const next = store.updateJob(job_id, {
      status: result.status,
      outcome: terminal ? nativeOutcome : null,
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
 * @param {{store:ReturnType<import("./store.mjs").openStore>, adapter:object,
 *   job_id:string, request:object, priorRef?:(object|null), runOptions?:object}} input
 */
export async function dispatchJob({ store, adapter, job_id, request, priorRef = null, runOptions = {} }) {
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

  const onDispatchStart = ({ at }) => {
    store.markDispatchStarted(job_id, at);
  };

  const result = priorRef
    ? await adapter.resume(priorRef, request, { ...runOptions, onDispatchStart })
    : await adapter.start(request, { ...runOptions, onDispatchStart });

  const recorded = recordDispatchResult({ store, job_id, result });
  return deepFreeze({ dispatched: true, eligibility, result, ...recorded });
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
 * @param {{store:ReturnType<import("./store.mjs").openStore>, adapter?:object,
 *   resolveAdapter?:(backend_id:string)=>(object|Promise<object|null>|null)}} input
 */
export async function reconcileOutstanding({ store, adapter = null, resolveAdapter = null }) {
  const outcomes = [];
  const adapterFor = async (backend_id) => {
    if (resolveAdapter) return (await resolveAdapter(backend_id)) || null;
    if (adapter && adapter.backend_id === backend_id) return adapter;
    if (adapter && !adapter.backend_id) return adapter;
    return null;
  };
  for (const job of store.listOutstandingJobs()) {
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

    const jobAdapter = await adapterFor(String(job.backend_id));
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
 * @param {{store:ReturnType<import("./store.mjs").openStore>, adapter:object, job_id:string}} input
 */
export async function requestStop({ store, adapter, job_id }) {
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

  const ref = makeExecutionRef({
    backend_id: job.backend_id,
    dispatch_key: job.dispatch_key,
    native_ref: job.native_ref,
  });
  const result = await adapter.stop(ref);
  const confirmed = Boolean(result.observations && result.observations.providerConfirmed);

  // A job that already reached a terminal outcome keeps it. Stopping something
  // that has finished revokes its publication authority — it does not un-observe
  // what happened, and it certainly does not relabel a succeeded job "cancelled".
  const alreadyTerminal = job.status === "finished" && Boolean(job.outcome);
  const next = store.updateJob(job_id, {
    status: alreadyTerminal ? job.status : confirmed ? "finished" : "unknown",
    outcome: alreadyTerminal ? job.outcome : confirmed ? "cancelled" : job.outcome,
    observations_json: JSON.stringify({ stop: result.observations, reason: result.reason }),
    reason: result.reason,
    reservation_open: alreadyTerminal ? job.reservation_open : confirmed ? job.reservation_open : 1,
    publication_revoked: 1,
  });
  store.putReceipt({
    receipt_id: "rc-" + job_id + "-stop",
    kind: "job.stop",
    subject_id: job_id,
    actor: "supervisor",
    state_before: job.status,
    state_after: next.status,
    observed: result.observations,
  });

  return deepFreeze({
    job: next,
    publicationRevoked: true,
    providerConfirmed: confirmed,
    display: confirmed ? "Stopped" : "Stop requested",
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

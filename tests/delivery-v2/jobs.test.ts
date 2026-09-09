// PM Delivery V2 — S1.2 fixtures: admission, dispatch and honest unknowns.
//
// F-AUTH, F-JOB and F-COST from "PM Delivery — Evidence & Autonomy.md" §9, and
// the failure table in §8. Every provider here is a fake with scripted faults —
// the plan is explicit that fake adapters and process injection are the tools for
// these cases and that paid providers are not tests.
//
// The fake below deliberately mirrors the *real* adapter's shapes rather than a
// convenient subset: it returns `bindAdapterResult` records, it invokes
// `onDispatchStart` immediately before its own "external call", and its `inspect`
// refuses to reconcile by dispatch key exactly as the qualified Codex profile
// does. A fake that were more capable than the backend would prove the wrong
// system correct.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authorizeContract,
  authorizeGrant,
  revokeGrant,
} from "../../scripts/delivery-v2/contracts.mjs";
import { bindAdapterResult, makeExecutionRef } from "../../scripts/delivery-v2/adapters/adapter.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import {
  ADMISSION_REFUSALS,
  RETRY_VERDICTS,
  admitJob,
  dispatchJob,
  mayPublish,
  recordDispatchResult,
  reconcileOutstanding,
  requestStop,
  resourceSummary,
  resumeRequestFor,
  retryEligibility,
} from "../../scripts/delivery-v2/jobs.mjs";

const BACKEND = "fake-backend";

const CONTRACT = authorizeContract({
  work_id: "w-1",
  source_fingerprint: "sha256:src1",
  outcome: "change the quick-amount control from 25 to 20",
  scratchScope: { root: "scratch" },
  publicationScope: { allowedPaths: ["src/features/amount.ts"] },
  requestedDisposition: "verified_candidate",
});

function grantWith(overrides: Record<string, unknown> = {}) {
  return authorizeGrant({
    contract_id: CONTRACT.contract_id,
    contract_revision: CONTRACT.revision,
    permitted_effects: ["native_dispatch", "candidate_export"],
    permitted_executors: ["p-1"],
    resource_policy: { unit: "usd", allowance: null },
    ...overrides,
  });
}

const ADMITTED_PROFILE = { admitted: true, refusals: [], profile_id: "p-1" };

/**
 * A scripted backend.
 *
 * `mode` selects the fault:
 *   ok               — a clean turn with usage
 *   lost-launch-ack  — accepts the call, then the response never arrives
 *   fail-after-usage — the provider answers, banks usage, then the turn fails
 *   malformed        — a clean turn whose final message is unusable
 */
function fakeAdapter(mode: string, options: { calls?: string[]; nativeRecords?: unknown[] } = {}) {
  const calls = options.calls ?? [];
  const usage = (turn: number) => ({
    turn,
    usage: {
      unit: "tokens",
      input: 1000,
      cachedInput: 200,
      output: 300,
      reasoningOutput: 50,
      costUsd: null,
      basis: "provider token counters; this interface reports no monetary amount",
    },
  });

  async function run(operation: string, ref: ReturnType<typeof makeExecutionRef>, onDispatchStart?: (arg: { at: string }) => void) {
    calls.push(operation);
    // V1's `failStartSession`: the provider is unreachable or unauthenticated
    // before any turn exists. The marker is never committed, so this job is
    // *provably* undispatched — the one case a retry is permitted.
    if (mode === "fail-before-dispatch") throw new Error("provider unreachable before any dispatch");
    if (onDispatchStart) onDispatchStart({ at: "2026-09-07T12:00:00.000Z" });

    if (mode === "lost-launch-ack") {
      return bindAdapterResult({
        operation,
        executionRef: ref, // no native_ref: the acknowledgement never arrived
        status: "unknown",
        dispatchAttempted: true,
        observations: { usageReadings: [], reachedProvider: false },
        reason: "stream failed before any native identity was observed; dispatch outcome is unknown",
      });
    }

    const withNative = makeExecutionRef({ ...ref, native_ref: "thr_native" });
    if (mode === "fail-after-usage") {
      return bindAdapterResult({
        operation,
        executionRef: withNative,
        status: "finished",
        dispatchAttempted: true,
        observations: { usageReadings: [usage(0)], nativeOutcome: "failed", failure: "provider gave up" },
      });
    }
    if (mode === "malformed") {
      return bindAdapterResult({
        operation,
        executionRef: withNative,
        status: "finished",
        dispatchAttempted: true,
        observations: { usageReadings: [usage(0)], nativeOutcome: "succeeded", finalText: "{not json" },
      });
    }
    return bindAdapterResult({
      operation,
      executionRef: withNative,
      status: "finished",
      dispatchAttempted: true,
      observations: { usageReadings: [usage(0)], nativeOutcome: "succeeded", finalText: "done" },
    });
  }

  return {
    calls,
    backend_id: BACKEND,
    describeProfile: () => ({ backend_id: BACKEND }),
    start: (request: { executionRef: ReturnType<typeof makeExecutionRef> }, runOptions: { onDispatchStart?: (arg: { at: string }) => void } = {}) =>
      run("start", request.executionRef, runOptions.onDispatchStart),
    resume: (
      _prior: unknown,
      request: { executionRef: ReturnType<typeof makeExecutionRef> },
      runOptions: { onDispatchStart?: (arg: { at: string }) => void } = {},
    ) => run("resume", request.executionRef, runOptions.onDispatchStart),
    // Mirrors the qualified backend: no reconciliation by dispatch key.
    inspect: async (ref: { native_ref: string | null }) => {
      calls.push("inspect");
      if (!ref.native_ref) {
        return bindAdapterResult({
          operation: "inspect",
          executionRef: ref as never,
          status: "unknown",
          observations: { lookupByDispatchKey: "unsupported", nativeRecords: [] },
          reason: "no native identity was observed and this backend cannot reconcile by dispatch key",
        });
      }
      const records = options.nativeRecords ?? [];
      return bindAdapterResult({
        operation: "inspect",
        executionRef: ref as never,
        status: "unknown",
        observations: { dispatchEstablished: records.length > 0, liveness: "unobservable", nativeRecords: records },
        reason: records.length > 0 ? "a native session record exists" : "no native session record was found",
      });
    },
    stop: async (ref: unknown) => {
      calls.push("stop");
      return bindAdapterResult({
        operation: "stop",
        executionRef: ref as never,
        status: "unknown",
        observations: { requested: true, locallyStopped: true, providerConfirmed: false, descendantsContained: "unknown" },
        reason: "stop is requested-only on this interface",
      });
    },
    exportCandidate: async () => {
      calls.push("exportCandidate");
      return bindAdapterResult({ operation: "exportCandidate", executionRef: {} as never, status: "finished" });
    },
  };
}

let ROOT: string;
let store: ReturnType<typeof openStore>;
let clock = 0;

function baseAdmission(overrides: Record<string, unknown> = {}) {
  return {
    store,
    run_id: "r-1",
    contract: CONTRACT,
    grant: grantWith(),
    profileAdmission: ADMITTED_PROFILE,
    backend_id: BACKEND,
    reservation: { unit: "usd", amount: null, basis: "no monetary reading is available from this backend" },
    instruction: "do the thing",
    workspace: { root: "C:/scratch/r-1" },
    command: { command_id: "cmd-1", actor: "owner" },
    ...overrides,
  } as Parameters<typeof admitJob>[0];
}

beforeEach(() => {
  clock = 0;
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-jobs-"));
  store = openStore({
    path: join(ROOT, "supervisor.sqlite"),
    now: () => "2026-09-07T00:00:" + String(clock++).padStart(2, "0") + ".000Z",
  });
  store.insertRun({
    run_id: "r-1",
    work_id: "w-1",
    contract_id: CONTRACT.contract_id,
    contract_revision: CONTRACT.revision,
    lifecycle: "ACTIVE",
  });
});

afterEach(() => {
  try {
    store.close();
  } catch {
    /* closed by a test */
  }
  try {
    rmSync(ROOT, { recursive: true, force: true });
  } catch {
    /* leftover temp dir */
  }
});

describe("F-JOB — identity and reservation precede dispatch", () => {
  it("persists the job, its reservation and its executionRef before anything is sent", () => {
    const admission = admitJob(baseAdmission());
    expect(admission.admitted).toBe(true);
    const job = admission.job!;
    expect(job.status).toBe("reserved");
    expect(job.dispatch_key).toBe(job.job_id);
    expect(job.native_ref).toBeNull();
    // The marker is the whole point: absent means known-undispatched.
    expect(job.dispatch_started_at).toBeNull();
    expect(job.reservation_open).toBe(1);
    expect(store.listReceipts(job.job_id).map((entry: Record<string, unknown>) => entry.kind)).toEqual(["job.reserved"]);
  });

  it("commits the dispatch marker before the adapter's external call", async () => {
    const admission = admitJob(baseAdmission());
    const order: string[] = [];
    const adapter = fakeAdapter("ok", { calls: order });
    const spy = vi.spyOn(store, "markDispatchStarted");
    await dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(store.getJob(admission.job!.job_id)!.dispatch_started_at).toBe("2026-09-07T12:00:00.000Z");
  });

  it("gives every start, resume, repair and review its own job id", () => {
    const first = admitJob(baseAdmission());
    const second = admitJob(baseAdmission({ purpose: "resume", command: { command_id: "cmd-2", actor: "owner" } }));
    const third = admitJob(baseAdmission({ purpose: "repair", command: { command_id: "cmd-3", actor: "owner" } }));
    const fourth = admitJob(baseAdmission({ purpose: "review", command: { command_id: "cmd-4", actor: "owner" } }));
    const ids = [first, second, third, fourth].map((entry) => entry.job!.job_id);
    expect(new Set(ids).size).toBe(4);
    expect(store.listJobs("r-1")).toHaveLength(4);
  });

  it("answers a repeated command from its receipt without reserving a second job", () => {
    const first = admitJob(baseAdmission());
    const again = admitJob(baseAdmission());
    expect(again.duplicate).toBe(true);
    expect(again.admitted).toBe(true);
    expect(again.job!.job_id).toBe(first.job!.job_id);
    expect(store.listJobs("r-1")).toHaveLength(1);
  });

  it("conflicts on the same command id with a different payload", () => {
    admitJob(baseAdmission());
    const conflict = admitJob(
      baseAdmission({ command: { command_id: "cmd-1", actor: "owner", payload: { something: "else" } } }),
    );
    expect(conflict.admitted).toBe(false);
    expect(conflict.refusals[0].code).toBe(ADMISSION_REFUSALS.COMMAND_CONFLICT);
    expect(store.listJobs("r-1")).toHaveLength(1);
  });
});

describe("F-JOB — a lost launch acknowledgement is held, never retried", () => {
  it("leaves the job unknown with its marker set and its reservation open", async () => {
    const admission = admitJob(baseAdmission());
    const adapter = fakeAdapter("lost-launch-ack");
    await dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request });

    const job = store.getJob(admission.job!.job_id)!;
    expect(job.status).toBe("unknown");
    expect(job.outcome).toBeNull();
    expect(job.native_ref).toBeNull();
    expect(job.dispatch_started_at).not.toBeNull();
    expect(job.reservation_open).toBe(1);
  });

  it("refuses a second dispatch of that job", async () => {
    const admission = admitJob(baseAdmission());
    const adapter = fakeAdapter("lost-launch-ack");
    await dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request });

    const second = await dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request });
    expect(second.dispatched).toBe(false);
    expect(second.eligibility.verdict).toBe(RETRY_VERDICTS.BLOCKED_UNKNOWN);
    expect(adapter.calls.filter((call) => call === "start")).toHaveLength(1);
  });

  it("leaves a job that failed before the marker provably undispatched", async () => {
    const admission = admitJob(baseAdmission());
    const adapter = fakeAdapter("fail-before-dispatch");
    await expect(
      dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request }),
    ).rejects.toThrow(/unreachable before any dispatch/u);

    const job = store.getJob(admission.job!.job_id)!;
    expect(job.dispatch_started_at).toBeNull();
    expect(job.status).toBe("reserved");
    // The distinction that matters: this one may be sent, because nothing was.
    expect(retryEligibility(job).verdict).toBe(RETRY_VERDICTS.ELIGIBLE);

    const second = await dispatchJob({
      store,
      adapter: fakeAdapter("ok"),
      job_id: admission.job!.job_id,
      request: admission.request,
    });
    expect(second.dispatched).toBe(true);
    expect(store.getJob(admission.job!.job_id)!.outcome).toBe("succeeded");
  });

  it("permits a retry only when no marker was ever committed", () => {
    const admission = admitJob(baseAdmission());
    expect(retryEligibility(store.getJob(admission.job!.job_id)!).verdict).toBe(RETRY_VERDICTS.ELIGIBLE);
    store.markDispatchStarted(admission.job!.job_id);
    expect(retryEligibility(store.getJob(admission.job!.job_id)!).verdict).toBe(RETRY_VERDICTS.BLOCKED_UNKNOWN);
  });

  it("reconciles after a restart by inspecting, and never issues a second start", async () => {
    const path = join(ROOT, "supervisor.sqlite");
    const admission = admitJob(baseAdmission());
    const adapter = fakeAdapter("lost-launch-ack");
    await dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request });
    store.close();

    // The process dies here. A new one comes up and must reconcile before it may
    // dispatch anything.
    const reopened = openStore({ path, now: () => "2026-09-07T13:00:00.000Z" });
    const restartAdapter = fakeAdapter("ok");
    const outcomes = await reconcileOutstanding({ store: reopened, adapter: restartAdapter });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].verdict).toBe(RETRY_VERDICTS.BLOCKED_UNKNOWN);
    expect(outcomes[0].reservationHeld).toBe(true);
    expect(restartAdapter.calls).toEqual(["inspect"]);
    expect(restartAdapter.calls).not.toContain("start");
    expect(reopened.getJob(admission.job!.job_id)!.status).toBe("unknown");
    reopened.close();
    store = reopened;
  });

  it("treats a job that never reached the marker as dispatchable after a restart", async () => {
    const path = join(ROOT, "supervisor.sqlite");
    admitJob(baseAdmission());
    store.close();

    const reopened = openStore({ path, now: () => "2026-09-07T13:00:00.000Z" });
    const adapter = fakeAdapter("ok");
    const outcomes = await reconcileOutstanding({ store: reopened, adapter });
    expect(outcomes[0].verdict).toBe(RETRY_VERDICTS.ELIGIBLE);
    expect(adapter.calls).toEqual([]); // nothing to inspect; nothing was sent
    reopened.close();
    store = reopened;
  });

  it("does not count a read-only inspect as a new paid job", async () => {
    const admission = admitJob(baseAdmission());
    const adapter = fakeAdapter("lost-launch-ack");
    await dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request });
    const before = store.listJobs("r-1").length;
    await reconcileOutstanding({ store, adapter: fakeAdapter("ok") });
    expect(store.listJobs("r-1")).toHaveLength(before);
  });
});

describe("F-COST — usage is conserved and never double counted", () => {
  it("retains the usage a failed job spent", async () => {
    const admission = admitJob(baseAdmission());
    const adapter = fakeAdapter("fail-after-usage");
    await dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request });

    const job = store.getJob(admission.job!.job_id)!;
    expect(job.outcome).toBe("failed");
    expect(store.countUsageReadings(job.job_id)).toBe(1);
    expect(resourceSummary(store, { run_id: "r-1" }).nativeTotals.input).toBe(1000);
  });

  it("keeps the first job's usage when a second job succeeds", async () => {
    const failed = admitJob(baseAdmission());
    await dispatchJob({
      store,
      adapter: fakeAdapter("fail-after-usage"),
      job_id: failed.job!.job_id,
      request: failed.request,
    });
    const retry = admitJob(baseAdmission({ command: { command_id: "cmd-2", actor: "owner" } }));
    await dispatchJob({ store, adapter: fakeAdapter("ok"), job_id: retry.job!.job_id, request: retry.request });

    const summary = resourceSummary(store, { run_id: "r-1" });
    expect(summary.nativeTotals.input).toBe(2000); // both attempts, not just the good one
    expect(store.listJobs("r-1")).toHaveLength(2);
  });

  it("does not double count a result recorded twice", async () => {
    const admission = admitJob(baseAdmission());
    const adapter = fakeAdapter("ok");
    const first = await dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request });
    expect(first.readingsInserted).toBe(1);

    // The same adapter result arriving again — a retried projection, a replayed
    // event, a duplicated commit. It must change nothing.
    const again = recordDispatchResult({ store, job_id: admission.job!.job_id, result: first.result });
    expect(again.readingsSeen).toBe(1);
    expect(again.readingsInserted).toBe(0);
    expect(store.countUsageReadings(admission.job!.job_id)).toBe(1);
    expect(resourceSummary(store, { run_id: "r-1" }).nativeTotals.input).toBe(1000);
  });

  it("keeps the reservation open while the cost is unknown", async () => {
    const admission = admitJob(baseAdmission());
    await dispatchJob({ store, adapter: fakeAdapter("ok"), job_id: admission.job!.job_id, request: admission.request });

    const job = store.getJob(admission.job!.job_id)!;
    expect(job.status).toBe("finished");
    expect(job.outcome).toBe("succeeded");
    // Finished, successful — and still reserved, because this backend reports no
    // monetary amount and an unresolved cost is not a settled one.
    expect(job.reservation_open).toBe(1);

    const summary = resourceSummary(store, { run_id: "r-1" });
    expect(summary.settled).toBe(0);
    expect(summary.unknown.length).toBeGreaterThan(0);
    expect(summary.unknown[0].reason).toMatch(/no amount in usd/u);
  });

  it("does not let a malformed final message erase the usage or the outcome", async () => {
    const admission = admitJob(baseAdmission());
    await dispatchJob({
      store,
      adapter: fakeAdapter("malformed"),
      job_id: admission.job!.job_id,
      request: admission.request,
    });
    const job = store.getJob(admission.job!.job_id)!;
    expect(job.outcome).toBe("succeeded");
    expect(store.countUsageReadings(job.job_id)).toBe(1);
  });

  it("refuses a new dispatch when settled + reserved + next exceeds the allowance", () => {
    const grant = grantWith({ resource_policy: { unit: "usd", allowance: 5, strict: true } });
    const first = admitJob(baseAdmission({ grant, reservation: { unit: "usd", amount: 4, basis: "estimate" } }));
    expect(first.admitted).toBe(true);

    const second = admitJob(
      baseAdmission({
        grant,
        reservation: { unit: "usd", amount: 4, basis: "estimate" },
        nextJobCost: 4,
        command: { command_id: "cmd-2", actor: "owner" },
      }),
    );
    expect(second.admitted).toBe(false);
    expect(second.refusals[0].code).toBe(ADMISSION_REFUSALS.GRANT);
    expect(JSON.stringify(second.refusals[0].detail)).toMatch(/allowance-exhausted/u);
  });
});

describe("F-AUTH — authority is revalidated before every paid continuation", () => {
  it("refuses a resume under a revoked grant", () => {
    const grant = grantWith();
    const first = admitJob(baseAdmission({ grant }));
    expect(first.admitted).toBe(true);

    const revoked = revokeGrant(grant);
    const resume = admitJob(
      baseAdmission({ grant: revoked, purpose: "resume", command: { command_id: "cmd-2", actor: "owner" } }),
    );
    expect(resume.admitted).toBe(false);
    expect(JSON.stringify(resume.refusals)).toMatch(/grant-revoked/u);
  });

  it("refuses an expired grant", () => {
    const grant = grantWith({ expires_at: "2026-09-06T00:00:00.000Z" });
    const admission = admitJob(baseAdmission({ grant, now: "2026-09-07T00:00:00.000Z" }));
    expect(admission.admitted).toBe(false);
    expect(JSON.stringify(admission.refusals)).toMatch(/grant-expired/u);
  });

  it("refuses when the contract has moved to a new revision", () => {
    const grant = grantWith();
    const moved = authorizeContract({
      work_id: "w-1",
      revision: 2,
      source_fingerprint: "sha256:src2",
      outcome: "changed intent",
      scratchScope: { root: "scratch" },
      publicationScope: { allowedPaths: [] },
      requestedDisposition: "verified_candidate",
    });
    const admission = admitJob(baseAdmission({ grant, contract: moved }));
    expect(admission.admitted).toBe(false);
    expect(JSON.stringify(admission.refusals)).toMatch(/contract-revision-moved/u);
  });

  it("refuses an effect the grant does not permit", () => {
    const grant = grantWith({ permitted_effects: ["protected_check"] });
    const admission = admitJob(baseAdmission({ grant }));
    expect(JSON.stringify(admission.refusals)).toMatch(/effect-not-permitted/u);
  });

  it("refuses an executor the grant does not name", () => {
    const grant = grantWith({ permitted_executors: ["p-somewhere-else"] });
    const admission = admitJob(baseAdmission({ grant }));
    expect(JSON.stringify(admission.refusals)).toMatch(/executor-not-permitted/u);
  });

  it("refuses when the profile itself is not admitted", () => {
    const admission = admitJob(
      baseAdmission({
        profileAdmission: {
          admitted: false,
          refusals: [{ code: "confinement-unproven", detail: "filesystem.hostSecretRead" }],
          profile_id: "p-1",
        },
      }),
    );
    expect(admission.admitted).toBe(false);
    expect(admission.refusals[0].code).toBe(ADMISSION_REFUSALS.PROFILE);
    expect(JSON.stringify(admission.refusals)).toMatch(/hostSecretRead/u);
  });

  it("refuses when the bound source has moved on", () => {
    const admission = admitJob(baseAdmission({ sourceFresh: false }));
    expect(admission.admitted).toBe(false);
    expect(admission.refusals[0].code).toBe(ADMISSION_REFUSALS.SOURCE_STALE);
  });

  it("refuses a second supervisor-dispatched repair under the FAST limit of one", () => {
    const first = admitJob(
      baseAdmission({ purpose: "repair", repairDispatchLimit: 1, command: { command_id: "cmd-r1", actor: "owner" } }),
    );
    expect(first.admitted).toBe(true);
    const second = admitJob(
      baseAdmission({ purpose: "repair", repairDispatchLimit: 1, command: { command_id: "cmd-r2", actor: "owner" } }),
    );
    expect(second.admitted).toBe(false);
    expect(second.refusals[0].code).toBe(ADMISSION_REFUSALS.REPAIR_BUDGET);
  });

  it("refuses a dispatch on a closed run", () => {
    store.updateRun("r-1", { lifecycle: "CLOSED", closed_outcome: "cancelled" });
    const admission = admitJob(baseAdmission());
    expect(admission.admitted).toBe(false);
    expect(admission.refusals[0].code).toBe(ADMISSION_REFUSALS.RUN_CLOSED);
  });

  it("does not re-evaluate authority for a duplicate command", () => {
    const grant = grantWith();
    const first = admitJob(baseAdmission({ grant }));
    expect(first.admitted).toBe(true);
    // The grant is revoked between the original command and its retry. The retry
    // must still report what actually happened, not refuse work that already ran.
    const again = admitJob(baseAdmission({ grant: revokeGrant(grant) }));
    expect(again.duplicate).toBe(true);
    expect(again.admitted).toBe(true);
    expect(again.job!.job_id).toBe(first.job!.job_id);
  });
});

describe("F-JOB — a resume is a new job on an existing session", () => {
  it("builds a resume request with its own key and the inherited native reference", async () => {
    const first = admitJob(baseAdmission());
    await dispatchJob({ store, adapter: fakeAdapter("ok"), job_id: first.job!.job_id, request: first.request });

    const second = admitJob(baseAdmission({ purpose: "resume", command: { command_id: "cmd-2", actor: "owner" } }));
    const { priorRef, request } = resumeRequestFor({
      store,
      priorJobId: first.job!.job_id,
      request: second.request,
    });
    expect(priorRef.native_ref).toBe("thr_native");
    expect(request.executionRef.dispatch_key).toBe(second.job!.job_id);
    expect(request.executionRef.native_ref).toBe("thr_native");
    expect(request.job_id).not.toBe(first.job!.job_id);
  });

  it("refuses to resume a session that was never observed", async () => {
    const first = admitJob(baseAdmission());
    await dispatchJob({
      store,
      adapter: fakeAdapter("lost-launch-ack"),
      job_id: first.job!.job_id,
      request: first.request,
    });
    const second = admitJob(baseAdmission({ purpose: "resume", command: { command_id: "cmd-2", actor: "owner" } }));
    expect(() => resumeRequestFor({ store, priorJobId: first.job!.job_id, request: second.request })).toThrow(
      /no session to continue/u,
    );
  });
});

describe("F-JOB — a lost stop acknowledgement revokes publication without claiming a stop", () => {
  it("shows Stop requested on an in-flight job, keeps the reservation, and blocks late output", async () => {
    const admission = admitJob(baseAdmission());
    const adapter = fakeAdapter("lost-launch-ack");
    await dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request });

    const stopped = await requestStop({ store, adapter, job_id: admission.job!.job_id });
    expect(stopped.publicationRevoked).toBe(true);
    expect(stopped.providerConfirmed).toBe(false);
    expect(stopped.display).toBe("Stop requested");
    expect(stopped.job.status).toBe("unknown");
    expect(stopped.job.outcome).toBeNull(); // never "cancelled" on an unconfirmed stop
    expect(stopped.job.reservation_open).toBe(1);

    const publish = mayPublish(stopped.job);
    expect(publish.allowed).toBe(false);
    expect(publish.reason).toMatch(/preserved but cannot be applied/u);
  });

  it("does not relabel an already-finished job as cancelled", async () => {
    const admission = admitJob(baseAdmission());
    const adapter = fakeAdapter("ok");
    await dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request });

    const stopped = await requestStop({ store, adapter, job_id: admission.job!.job_id });
    // Stopping revokes publication. It does not un-observe what already happened,
    // and an unconfirmed stop certainly does not turn "succeeded" into
    // "cancelled" — authority cancellation and execution outcome are separate
    // facts (Architecture §7).
    expect(stopped.outcomeRetained).toBe(true);
    expect(stopped.job.status).toBe("finished");
    expect(stopped.job.outcome).toBe("succeeded");
    expect(mayPublish(stopped.job).allowed).toBe(false);
  });

  it("revokes publication even if the adapter's stop call throws", async () => {
    const admission = admitJob(baseAdmission());
    const adapter = fakeAdapter("ok");
    await dispatchJob({ store, adapter, job_id: admission.job!.job_id, request: admission.request });

    const throwing = { ...adapter, stop: async () => { throw new Error("provider unreachable"); } };
    await expect(requestStop({ store, adapter: throwing, job_id: admission.job!.job_id })).rejects.toThrow(
      /provider unreachable/u,
    );
    // The revocation happened first, on purpose.
    expect(mayPublish(store.getJob(admission.job!.job_id)!).allowed).toBe(false);
  });
});

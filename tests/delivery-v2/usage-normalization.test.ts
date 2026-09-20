// PM Delivery V2 — token accounting under a thread-cumulative counter.
//
// The run these fixtures are built from is r-83dddb67fea9 (BUD-83): a planning
// job and a build job on ONE Codex thread, whose stored readings were summed as
// if they were independent. The investigation
// ("ERA Notes/10 - Project Management/Research/Delivery — Token Consumption
// Investigation.md" §3.2) could not settle whether `turn.completed.usage` is
// per-turn or thread-cumulative; the pinned implementation settles it, and these
// fixtures pin the consequence so a future SDK bump that changes the semantics
// fails here rather than in the owner's budget.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authorizeContract, authorizeGrant } from "../../scripts/delivery-v2/contracts.mjs";
import { bindAdapterResult, makeExecutionRef } from "../../scripts/delivery-v2/adapters/adapter.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { admitJob, recordDispatchResult, resourceSummary } from "../../scripts/delivery-v2/jobs.mjs";
import { CODEX_COUNTER_SEMANTICS, mergeUsageReadings, normalizeCodexUsage } from "../../scripts/delivery-v2/adapters/codex.mjs";
import { CLAUDE_COUNTER_SEMANTICS } from "../../scripts/delivery-v2/adapters/claude.mjs";
import {
  COUNTER_SEMANTICS,
  NORMALIZATION_STATUS,
  normalizeJobReadings,
  normalizeUsageReading,
  threadBaselineFor,
} from "../../scripts/delivery-v2/usage-normalization.mjs";

const BACKEND = "codex-exec-sdk";

// The stored readings of run r-83dddb67fea9, exactly as the supervisor recorded
// them (`usage_readings`, verified against the investigation §3.3).
const PLANNING_RAW = { input: 94_110, cachedInput: 65_024, cacheCreation: 0, output: 1_630, reasoningOutput: 222 };
const BUILD_RAW = { input: 487_742, cachedInput: 425_472, cacheCreation: 0, output: 5_694, reasoningOutput: 1_050 };

const CONTRACT = authorizeContract({
  work_id: "w-bud83",
  source_fingerprint: "sha256:src",
  outcome: "show the Split tag in transaction details",
  scratchScope: { root: "scratch" },
  publicationScope: { allowedPaths: ["src/lib/utils/splitBill.ts"] },
  requestedDisposition: "verified_candidate",
});

const GRANT = authorizeGrant({
  contract_id: CONTRACT.contract_id,
  contract_revision: CONTRACT.revision,
  permitted_effects: ["native_dispatch", "candidate_export"],
  permitted_executors: ["p-codex"],
  resource_policy: { unit: "tokens", allowance: 400_000 },
});

function usageReading(turn: number, raw: Record<string, number>, semantics: string = CODEX_COUNTER_SEMANTICS) {
  return { turn, usage: { unit: "tokens", ...raw, costUsd: null, counterSemantics: semantics, basis: "fixture" } };
}

describe("counter semantics", () => {
  it("reads a Codex turn.completed reading as cumulative for the thread", () => {
    // Not the SDK's doc comment ("usage during a turn") but the exec
    // implementation: turn.completed carries ThreadTokenUsage.total.
    expect(CODEX_COUNTER_SEMANTICS).toBe(COUNTER_SEMANTICS.THREAD_CUMULATIVE);
    expect(normalizeCodexUsage({ input_tokens: 10, cached_input_tokens: 4, output_tokens: 2, reasoning_output_tokens: 1 }).counterSemantics).toBe(
      COUNTER_SEMANTICS.THREAD_CUMULATIVE,
    );
  });

  it("keeps Claude per-turn; the Codex rule is not inherited by proximity", () => {
    expect(CLAUDE_COUNTER_SEMANTICS).toBe(COUNTER_SEMANTICS.PER_TURN);
  });

  it("takes the latest cumulative reading of a dispatch rather than summing its turns", () => {
    const merged = mergeUsageReadings([usageReading(0, PLANNING_RAW), usageReading(1, BUILD_RAW)]);
    expect(merged.input).toBe(BUILD_RAW.input);
    expect(merged.output).toBe(BUILD_RAW.output);
    expect(merged.counterSemantics).toBe(COUNTER_SEMANTICS.THREAD_CUMULATIVE);
  });

  it("still sums turns for a per-turn backend", () => {
    const perTurn = [usageReading(0, PLANNING_RAW, COUNTER_SEMANTICS.PER_TURN), usageReading(1, BUILD_RAW, COUNTER_SEMANTICS.PER_TURN)];
    const merged = mergeUsageReadings(perTurn, { semantics: COUNTER_SEMANTICS.PER_TURN });
    expect(merged.input).toBe(PLANNING_RAW.input + BUILD_RAW.input);
  });

  it("does not double count a replayed reading of the same turn", () => {
    const merged = mergeUsageReadings([usageReading(0, BUILD_RAW), usageReading(0, BUILD_RAW)]);
    expect(merged.input).toBe(BUILD_RAW.input);
    expect(merged.readings).toBe(1);
  });
});

describe("normalizeUsageReading", () => {
  it("subtracts the thread baseline from a resumed cumulative reading", () => {
    const normalized = normalizeUsageReading({ semantics: COUNTER_SEMANTICS.THREAD_CUMULATIVE, raw: BUILD_RAW, baseline: PLANNING_RAW, baselineRequired: true });
    expect(normalized.status).toBe(NORMALIZATION_STATUS.DELTA);
    expect(normalized.complete).toBe(true);
    // The investigation's conditional expectation for build-only usage.
    expect(normalized.values.input).toBe(393_632);
    expect(normalized.values.output).toBe(4_064);
    expect(normalized.values.input + normalized.values.output).toBe(397_696);
    // The raw reading survives: it is the next job's baseline.
    expect(normalized.raw.input).toBe(BUILD_RAW.input);
  });

  it("treats the first reading of a thread as a real zero baseline", () => {
    const normalized = normalizeUsageReading({ semantics: COUNTER_SEMANTICS.THREAD_CUMULATIVE, raw: PLANNING_RAW, baseline: null, baselineRequired: false });
    expect(normalized.status).toBe(NORMALIZATION_STATUS.THREAD_START);
    expect(normalized.complete).toBe(true);
    expect(normalized.values.input).toBe(PLANNING_RAW.input);
  });

  it("flags a missing baseline instead of inventing a complete total", () => {
    const normalized = normalizeUsageReading({ semantics: COUNTER_SEMANTICS.THREAD_CUMULATIVE, raw: BUILD_RAW, baseline: null, baselineRequired: true });
    expect(normalized.status).toBe(NORMALIZATION_STATUS.BASELINE_MISSING);
    expect(normalized.complete).toBe(false);
    expect(normalized.values.input).toBe(BUILD_RAW.input);
  });

  it("treats a counter that went backwards as a reset, not a refund", () => {
    const normalized = normalizeUsageReading({ semantics: COUNTER_SEMANTICS.THREAD_CUMULATIVE, raw: PLANNING_RAW, baseline: BUILD_RAW, baselineRequired: true });
    expect(normalized.status).toBe(NORMALIZATION_STATUS.COUNTER_RESET);
    expect(normalized.complete).toBe(false);
    expect(normalized.values.input).toBe(PLANNING_RAW.input);
  });

  it("leaves an undeclared counter uninterpreted", () => {
    const normalized = normalizeUsageReading({ raw: BUILD_RAW, baseline: PLANNING_RAW, baselineRequired: true });
    expect(normalized.status).toBe(NORMALIZATION_STATUS.UNSUPPORTED);
    expect(normalized.complete).toBe(false);
    expect(normalized.values.input).toBe(BUILD_RAW.input);
  });

  it("passes a per-turn reading through untouched", () => {
    const normalized = normalizeUsageReading({ semantics: COUNTER_SEMANTICS.PER_TURN, raw: BUILD_RAW, baseline: PLANNING_RAW, baselineRequired: true });
    expect(normalized.status).toBe(NORMALIZATION_STATUS.DIRECT);
    expect(normalized.values.input).toBe(BUILD_RAW.input);
  });

  it("chains baselines across turns inside one dispatch", () => {
    const chained = normalizeJobReadings({
      semantics: COUNTER_SEMANTICS.THREAD_CUMULATIVE,
      readings: [usageReading(0, PLANNING_RAW), usageReading(1, BUILD_RAW)],
    });
    expect(chained.readings[0].normalized.values.input).toBe(PLANNING_RAW.input);
    expect(chained.readings[1].normalized.values.input).toBe(393_632);
    expect(chained.incomplete).toEqual([]);
  });
});

describe("threadBaselineFor", () => {
  const job = { job_id: "j-build", backend_id: BACKEND, native_ref: "thread-1" };

  it("requires the same provider thread", () => {
    const other = threadBaselineFor({ job, parent: { job_id: "j-plan", backend_id: BACKEND, native_ref: "thread-2" }, parentReadings: [{ input: 10 }] });
    expect(other.baseline).toBeNull();
    expect(other.required).toBe(false);
    expect(other.reason).toContain("new provider thread");
  });

  it("uses the parent's raw reading, not its normalized one", () => {
    const found = threadBaselineFor({
      job,
      parent: { job_id: "j-plan", backend_id: BACKEND, native_ref: "thread-1" },
      parentReadings: [{ input: 5, output: 1, raw_input: 94_110, raw_output: 1_630, raw_cached_input: 65_024, raw_reasoning_output: 222 }],
    });
    expect(found.baseline?.input).toBe(94_110);
    expect(found.required).toBe(true);
  });

  it("reports a hole when the parent on the same thread has no reading", () => {
    const found = threadBaselineFor({ job, parent: { job_id: "j-plan", backend_id: BACKEND, native_ref: "thread-1" }, parentReadings: [] });
    expect(found.baseline).toBeNull();
    expect(found.required).toBe(true);
  });
});

describe("recorded accounting for a resumed thread", () => {
  let dir: string;
  let store: ReturnType<typeof openStore>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "era-usage-"));
    store = openStore({ path: join(dir, "supervisor.sqlite") });
    store.insertRun({
      run_id: "r-83",
      work_id: CONTRACT.work_id,
      contract_id: CONTRACT.contract_id,
      contract_revision: CONTRACT.revision,
      lifecycle: "ACTIVE",
    });
  });

  afterEach(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function admit(purpose: string, command_id: string, continues_job_id: string | null) {
    const admitted = admitJob({
      store,
      run_id: "r-83",
      contract: CONTRACT,
      grant: GRANT,
      profileAdmission: { admitted: true, refusals: [], profile_id: "p-codex" },
      purpose,
      backend_id: BACKEND,
      reservation: { unit: "tokens", amount: 50_000, basis: "per-job reservation" },
      instruction: "do the thing",
      workspace: { root: join(dir, "work") },
      command: { command_id, actor: "owner", payload: { run_id: "r-83", purpose } },
      now: new Date().toISOString(),
      sourceFresh: true,
      nextJobCost: 50_000,
      access: purpose === "investigate" ? "read-only" : "write",
      settings: { backend_id: BACKEND, continues_job_id },
    });
    expect(admitted.admitted).toBe(true);
    return String(admitted.job.job_id);
  }

  function finish(job_id: string, raw: Record<string, number>, thread: string) {
    const ref = makeExecutionRef({ backend_id: BACKEND, dispatch_key: "dk-" + job_id, native_ref: thread });
    store.markDispatchStarted(job_id, new Date().toISOString());
    recordDispatchResult({
      store,
      job_id,
      result: bindAdapterResult({
        operation: "start",
        executionRef: ref,
        status: "finished",
        dispatchAttempted: true,
        observations: { nativeOutcome: "succeeded", usageReadings: [usageReading(0, raw)], usage: mergeUsageReadings([usageReading(0, raw)]) },
      }),
    });
  }

  it("records the resumed job's own spend, not the thread's restatement", () => {
    const planning = admit("investigate", "cmd-plan", null);
    finish(planning, PLANNING_RAW, "thread-1");
    const build = admit("resume", "cmd-build", planning);
    finish(build, BUILD_RAW, "thread-1");

    const [planningRow] = store.listUsageReadings(planning);
    const [buildRow] = store.listUsageReadings(build);
    expect(planningRow.input).toBe(94_110);
    expect(buildRow.input).toBe(393_632);
    expect(buildRow.raw_input).toBe(487_742);
    expect(JSON.parse(String(buildRow.normalization_json)).status).toBe(NORMALIZATION_STATUS.DELTA);
    expect(JSON.parse(String(buildRow.normalization_json)).baseline_job_id).toBe(planning);

    const summary = resourceSummary(store, { run_id: "r-83", unit: "tokens" });
    // 493,436 — the session total once the build stops restating the plan.
    expect(summary.settled).toBe(493_436);
    expect(summary.provenance.measuredTokens.total).toBe(493_436);
    // The provider's own statement is kept beside it, not silently replaced.
    expect(summary.provenance.rawProviderTokens.total).toBe(589_176);
    expect(summary.provenance.normalization.complete).toBe(true);
  });

  it("flags — and does not settle as measured — a resumed job whose baseline is gone", () => {
    const planning = admit("investigate", "cmd-plan", null);
    // Dispatched, no reading: the parent's cumulative state is unknown.
    store.markDispatchStarted(planning, new Date().toISOString());
    store.updateJob(planning, { status: "finished", outcome: "succeeded" });
    store.bindNativeRef(planning, "thread-1");
    const build = admit("resume", "cmd-build", planning);
    finish(build, BUILD_RAW, "thread-1");

    const [buildRow] = store.listUsageReadings(build);
    expect(JSON.parse(String(buildRow.normalization_json)).status).toBe(NORMALIZATION_STATUS.BASELINE_MISSING);
    const summary = resourceSummary(store, { run_id: "r-83", unit: "tokens" });
    expect(summary.provenance.normalization.complete).toBe(false);
    expect(summary.unknown.some((entry: { reason: string }) => entry.reason.includes("baseline-missing"))).toBe(true);
  });

  it("does not subtract anything when the resume fell back to a fresh thread", () => {
    const planning = admit("investigate", "cmd-plan", null);
    finish(planning, PLANNING_RAW, "thread-1");
    const build = admit("resume", "cmd-build", planning);
    finish(build, BUILD_RAW, "thread-2");

    const [buildRow] = store.listUsageReadings(build);
    expect(buildRow.input).toBe(487_742);
    expect(JSON.parse(String(buildRow.normalization_json)).status).toBe(NORMALIZATION_STATUS.THREAD_START);
  });
});

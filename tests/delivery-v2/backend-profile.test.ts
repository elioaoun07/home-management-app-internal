// PM Delivery V2 — S1.1 fixtures: the executor boundary and the backend profile.
//
// Families F-JOB, F-COST and the qualification half of F-ISOLATION, from
// "PM Delivery — Evidence & Autonomy.md" §9. Written from the refusal side: the
// interesting assertion is almost always that something is NOT permitted, NOT
// qualified, or NOT knowable.
//
// Three of these read the installed @openai/codex-sdk type surface directly.
// That is deliberate — the plan requires unsupported controls to be reported
// explicitly rather than inferred, and the only way an assertion about "this
// interface offers no monetary reading" stays true is if a fixture re-reads the
// interface and fails when the vendor adds one.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { ContractError } from "../../scripts/delivery-v2/contracts.mjs";
import {
  QUARANTINED_RESULT_FIELDS,
  REQUIRED_CONTROLS,
  admitProfile,
  assertAdapterShape,
  bindAdapterResult,
  finalizeProfile,
  makeControl,
  makeExecutionRef,
  makeJobRequest,
  makeResumeRequest,
  withNativeRef,
} from "../../scripts/delivery-v2/adapters/adapter.mjs";
import {
  BACKEND_ID,
  CODEX_SDK_SURFACE,
  buildThreadOptions,
  createCodexAdapter,
  describeProfile,
  mergeUsageReadings,
  newCodexExecutionRef,
  normalizeCodexUsage,
} from "../../scripts/delivery-v2/adapters/codex.mjs";

const SDK_TYPES = fileURLToPath(new URL("../../node_modules/@openai/codex-sdk/dist/index.d.ts", import.meta.url));

/**
 * Adapter observations are deliberately typed as an opaque bag: they are
 * backend-shaped and untrusted, and giving them a comfortable static type would
 * be the first step towards reading one as a decision. Tests reach into them
 * through this, which keeps the widening visible at every call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seen = (result: { observations: Record<string, unknown> }) => result.observations as Record<string, any>;

const CONTRACT = { contract_id: "c-abc123", revision: 1 };
const GRANT = { grant_id: "g-abc123", revision: 2 };

function request(overrides: Record<string, unknown> = {}) {
  return makeJobRequest({
    job_id: "j-0001",
    run_id: "r-0001",
    contract: CONTRACT,
    grant: GRANT,
    workspace: { root: "C:/scratch/j-0001" },
    reservation: { unit: "tokens", amount: null, basis: "provider counters; no monetary bound available" },
    backend_id: BACKEND_ID,
    instruction: "change the quick-amount control from 25 to 20",
    ...overrides,
  });
}

/** A scripted Codex SDK. Records what was called, in order, and never touches a network. */
function fakeSdk(script: {
  events?: Record<string, unknown>[];
  throwOnRun?: string;
  throwOnStart?: string;
  calls?: string[];
}) {
  const calls = script.calls ?? [];
  const thread = {
    id: null as string | null,
    async runStreamed() {
      calls.push("runStreamed");
      if (script.throwOnRun) throw new Error(script.throwOnRun);
      const events = script.events ?? [];
      return {
        events: (async function* stream() {
          for (const event of events) yield event;
        })(),
      };
    },
  };
  return {
    calls,
    module: {
      Codex: class {
        startThread() {
          calls.push("startThread");
          if (script.throwOnStart) throw new Error(script.throwOnStart);
          return thread;
        }
        resumeThread(id: string) {
          calls.push("resumeThread:" + id);
          return thread;
        }
      },
    },
  };
}

const COMPLETED_TURN = [
  { type: "thread.started", thread_id: "thr_native_1" },
  { type: "item.completed", item: { type: "agent_message", text: "done" } },
  {
    type: "turn.completed",
    usage: { input_tokens: 1200, cached_input_tokens: 400, output_tokens: 300, reasoning_output_tokens: 90 },
  },
];

describe("F-JOB — dispatch identity crosses the boundary intact", () => {
  it("makes dispatch_key equal job_id, with no way to disagree", () => {
    const jobRequest = request();
    expect(jobRequest.executionRef.dispatch_key).toBe(jobRequest.job_id);
    expect(jobRequest.executionRef.native_ref).toBeNull();
    expect(jobRequest.executionRef.backend_id).toBe(BACKEND_ID);
  });

  it("treats a missing native_ref as unknown, never as proof of no dispatch", () => {
    const ref = newCodexExecutionRef("j-0002");
    expect(ref.native_ref).toBeNull();
    // The type carries no "notDispatched" field at all: there is nothing to read
    // that would let a caller conclude it from the absence.
    expect(Object.keys(ref).sort()).toEqual(["backend_id", "dispatch_key", "native_ref"]);
  });

  it("refuses to rebind a dispatch key to a second native session", () => {
    const first = withNativeRef(newCodexExecutionRef("j-0003"), "thr_a");
    expect(withNativeRef(first, "thr_a").native_ref).toBe("thr_a"); // idempotent
    expect(() => withNativeRef(first, "thr_b")).toThrow(/refusing to rebind/u);
  });

  it("refuses a resume that reuses the prior dispatch key", () => {
    const prior = withNativeRef(newCodexExecutionRef("j-0004"), "thr_a");
    expect(() => makeResumeRequest(prior, request({ job_id: "j-0004" }))).toThrow(/needs its own job_id/u);
  });

  it("refuses a resume with no observed native session", () => {
    const prior = newCodexExecutionRef("j-0005");
    expect(() => makeResumeRequest(prior, request({ job_id: "j-0006" }))).toThrow(/no session to continue/u);
  });

  it("gives a resume its own key while inheriting the native reference", () => {
    const prior = withNativeRef(newCodexExecutionRef("j-0007"), "thr_a");
    const resumed = makeResumeRequest(prior, request({ job_id: "j-0008" }));
    expect(resumed.job_id).toBe("j-0008");
    expect(resumed.executionRef.dispatch_key).toBe("j-0008");
    expect(resumed.executionRef.native_ref).toBe("thr_a");
    expect(resumed.purpose).toBe("resume");
    expect(prior.dispatch_key).toBe("j-0007"); // predecessor untouched
  });

  it("refuses a resume across backends", () => {
    const prior = withNativeRef(makeExecutionRef({ backend_id: "other", dispatch_key: "j-1" , native_ref: "x" }), "x");
    expect(() => makeResumeRequest(prior, request({ job_id: "j-2" }))).toThrow(/cannot resume a other session/u);
  });

  it("refuses a job request with no confined workspace", () => {
    expect(() => request({ workspace: { root: "" } })).toThrow(/no unconfined mode/u);
  });

  it("refuses a reservation that does not state its basis", () => {
    expect(() => request({ reservation: { unit: "tokens", amount: null, basis: "" } })).toThrow(/unit and basis/u);
  });
});

describe("F-JOB — an adapter answer cannot carry authority", () => {
  it("quarantines every authority-bearing field a backend returns", () => {
    const result = bindAdapterResult({
      operation: "start",
      executionRef: newCodexExecutionRef("j-1"),
      status: "finished",
      observations: {
        finalText: "all done",
        candidateVerified: true,
        workComplete: true,
        grant_id: "g-i-made-this-up",
        observedDisposition: "verified_deployment",
        usage: { input: 1 },
      },
    });
    expect(result.observations.candidateVerified).toBeUndefined();
    expect(result.observations.workComplete).toBeUndefined();
    expect(result.observations.grant_id).toBeUndefined();
    expect(result.observations.observedDisposition).toBeUndefined();
    // Kept, but only where nothing reads it.
    expect(result.claims.candidateVerified).toBe(true);
    expect(result.claims.observedDisposition).toBe("verified_deployment");
    expect(result.quarantined).toEqual(["candidateVerified", "grant_id", "observedDisposition", "workComplete"]);
    // Ordinary observations pass straight through.
    expect(result.observations.finalText).toBe("all done");
    expect(result.observations.usage).toEqual({ input: 1 });
  });

  it("names every field it will quarantine, so the list is auditable", () => {
    for (const field of ["candidateVerified", "workComplete", "grant_id", "reservation", "publish"]) {
      expect(QUARANTINED_RESULT_FIELDS).toContain(field);
    }
  });
});

describe("F-ISOLATION — a profile is qualified by observations, never by assignment", () => {
  it("stays unqualified while any required control is unobserved", () => {
    const profile = describeProfile();
    expect(profile.qualified).toBe(false);
    expect(profile.qualification_ref).toBeNull();
    // resource.wholeJobBound is the one control answered by the interface itself.
    expect(profile.unverifiedControls).toEqual(REQUIRED_CONTROLS.filter((id) => id !== "resource.wholeJobBound"));
  });

  it("refuses to mark a control verified without an evidence reference", () => {
    expect(() => makeControl({ id: "filesystem.linkEscape", state: "supported", verified: true })).toThrow(
      ContractError,
    );
    expect(() =>
      makeControl({ id: "filesystem.linkEscape", state: "unknown", verified: true, evidence_ref: "q:1" }),
    ).toThrow(/both verified and unknown/u);
  });

  it("cannot be qualified by handing finalizeProfile a conclusion", () => {
    // There is no `qualified` input. The nearest thing a caller can try is to
    // supply a qualification_ref with unverified controls, which changes nothing.
    const profile = finalizeProfile({
      backend_id: BACKEND_ID,
      runtime: {},
      controls: [],
      lifecycle: {},
      qualification_ref: "qualification:wishful",
    });
    expect(profile.qualified).toBe(false);
    expect(profile.unverifiedControls).toEqual([...REQUIRED_CONTROLS]);
  });

  it("becomes qualified only when every required control has an observation", () => {
    const controls = REQUIRED_CONTROLS.map((id) =>
      makeControl({ id, state: "supported", verified: true, evidence_ref: "qualification:q-1" }),
    );
    const profile = finalizeProfile({
      backend_id: BACKEND_ID,
      runtime: {},
      controls,
      lifecycle: {},
      qualification_ref: "qualification:q-1",
    });
    expect(profile.qualified).toBe(true);
    expect(admitProfile(profile).admitted).toBe(true);
  });

  it("refuses admission when a containment control is observed to fail", () => {
    const controls = REQUIRED_CONTROLS.map((id) =>
      makeControl({
        id,
        state: id === "filesystem.hostSecretRead" ? "unsupported" : "supported",
        verified: true,
        evidence_ref: "qualification:q-2",
      }),
    );
    const profile = finalizeProfile({
      backend_id: BACKEND_ID,
      runtime: {},
      controls,
      lifecycle: {},
      qualification_ref: "qualification:q-2",
    });
    // "Qualified" means observed, not safe. Admission is where safety is decided.
    expect(profile.qualified).toBe(true);
    const admission = admitProfile(profile);
    expect(admission.admitted).toBe(false);
    expect(admission.refusals).toContainEqual({ code: "confinement-unproven", detail: "filesystem.hostSecretRead" });
  });
});

describe("F-COST — the strict monetary bound is refused, with the reason on the record", () => {
  it("reports no monetary reading, because the installed interface has none", () => {
    const types = readFileSync(SDK_TYPES, "utf8");
    const usageBlock = types.slice(types.indexOf("type Usage = {"), types.indexOf("type Usage = {") + 700);
    for (const field of CODEX_SDK_SURFACE.usageFields) expect(usageBlock).toContain(field);
    // The finding: no cost, price, dollar or spend field anywhere in Usage.
    expect(usageBlock).not.toMatch(/cost|price|usd|spend|dollar/iu);
    expect(CODEX_SDK_SURFACE.monetaryUsageField).toBeNull();
  });

  it("offers no per-turn spend limit to set either", () => {
    const types = readFileSync(SDK_TYPES, "utf8");
    const turnOptions = types.slice(types.indexOf("type TurnOptions = {"), types.indexOf("type TurnOptions = {") + 300);
    expect(turnOptions).toMatch(/outputSchema/u);
    expect(turnOptions).toMatch(/signal/u);
    expect(turnOptions).not.toMatch(/budget|limit|maxCost|maxTokens/iu);
  });

  it("refuses strictBound and says why", () => {
    const profile = describeProfile();
    expect(profile.resources.strictBound).toBe(false);
    expect(profile.resources.wholeJobBound).toBe("unsupported");
    expect(profile.resources.strictBoundRefusalReason).toMatch(/unsupported/u);
    const admission = admitProfile(profile, { strictBoundRequired: true });
    expect(admission.admitted).toBe(false);
    expect(admission.refusals.map((entry) => entry.code)).toContain("strict-bound-unavailable");
  });

  it("never derives a cost from token counters", () => {
    const usage = normalizeCodexUsage({
      input_tokens: 500_000,
      cached_input_tokens: 10,
      output_tokens: 9_000,
      reasoning_output_tokens: 4_000,
    });
    expect(usage.costUsd).toBeNull();
    expect(usage.input).toBe(500_000);
    expect(usage.basis).toMatch(/no monetary amount/u);
  });

  it("does not double count a cumulative reading seen twice", () => {
    const reading = { turn: 0, usage: normalizeCodexUsage({ input_tokens: 100, output_tokens: 10 }) };
    const merged = mergeUsageReadings([reading, reading, reading]);
    expect(merged.input).toBe(100);
    expect(merged.output).toBe(10);
    expect(merged.readings).toBe(1);
  });

  // Changed 2026-09-20 with the Codex counter semantics. This fixture used to
  // assert that distinct turns are SUMMED (100 + 50 = 150). They must not be:
  // `turn.completed.usage` carries the thread's cumulative total, so turn 1
  // already contains turn 0 and adding them invents spend. The dispatch's raw
  // state is its largest reading; the per-job increment is derived later, in
  // usage-normalization.mjs, against the parent job's baseline.
  it("does not sum distinct turns of a cumulative counter, and records a reset as a reset", () => {
    const merged = mergeUsageReadings([
      { turn: 0, usage: normalizeCodexUsage({ input_tokens: 100, output_tokens: 10 }) },
      { turn: 1, usage: normalizeCodexUsage({ input_tokens: 150, output_tokens: 15 }) },
      { turn: 1, usage: normalizeCodexUsage({ input_tokens: 1, output_tokens: 0 }) },
    ]);
    expect(merged.input).toBe(150);
    expect(merged.output).toBe(15);
    expect(merged.resets).toHaveLength(1);
    expect(merged.resets[0].reason).toMatch(/not a refund/u);
  });

  it("retains the usage a failed job already spent", async () => {
    const sdk = fakeSdk({
      events: [
        { type: "thread.started", thread_id: "thr_x" },
        { type: "turn.completed", usage: { input_tokens: 700, output_tokens: 50 } },
        { type: "turn.failed", error: { message: "provider gave up" } },
      ],
    });
    const adapter = createCodexAdapter({ importSdk: async () => sdk.module });
    const result = await adapter.start(request());
    expect(seen(result).usage.input).toBe(700);
    expect(result.observations.nativeOutcome).toBe("failed");
  });
});

describe("the six operations", () => {
  it("exposes exactly the canonical surface", () => {
    const adapter = createCodexAdapter({ importSdk: async () => fakeSdk({}).module });
    expect(() => assertAdapterShape(adapter)).not.toThrow();
    expect(adapter.backend_id).toBe(BACKEND_ID);
  });

  it("refuses an adapter that implements only some of it", () => {
    expect(() => assertAdapterShape({ backend_id: "x", start: () => {} })).toThrow(/missing required operations/u);
  });

  it("declares the launch options and refuses to disable the sandbox", () => {
    const options = buildThreadOptions({ workspaceRoot: "C:/scratch/j-1" });
    expect(options).toMatchObject({
      workingDirectory: "C:/scratch/j-1",
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      networkAccessEnabled: false,
      webSearchEnabled: false,
      // The supported non-Git option, so a metadata-free snapshot can launch
      // without anyone creating a .git directory to satisfy a check.
      skipGitRepoCheck: true,
    });
    expect(() => buildThreadOptions({ workspaceRoot: "C:/scratch", mode: "danger-full-access" })).toThrow(
      /not an available profile/u,
    );
  });

  it("uses an option the installed SDK actually has", () => {
    const types = readFileSync(SDK_TYPES, "utf8");
    expect(types).toContain("skipGitRepoCheck?: boolean");
    for (const key of Object.keys(buildThreadOptions({ workspaceRoot: "C:/x" }))) {
      expect(CODEX_SDK_SURFACE.threadOptions).toContain(key);
    }
  });

  it("commits the dispatch marker immediately before the external call", async () => {
    const order: string[] = [];
    const sdk = fakeSdk({ events: COMPLETED_TURN, calls: order });
    const adapter = createCodexAdapter({ importSdk: async () => sdk.module, now: () => "2026-09-07T00:00:00.000Z" });
    const onDispatchStart = vi.fn(() => order.push("dispatch_started_at"));
    await adapter.start(request(), { onDispatchStart });
    expect(onDispatchStart).toHaveBeenCalledTimes(1);
    // startThread is preparation; runStreamed is the call that can reach the
    // provider. The marker must sit between them.
    expect(order).toEqual(["startThread", "dispatch_started_at", "runStreamed"]);
  });

  it("returns unknown, not failed, when the launch acknowledgement is lost", async () => {
    const sdk = fakeSdk({ throwOnRun: "socket hang up" });
    const adapter = createCodexAdapter({ importSdk: async () => sdk.module });
    const onDispatchStart = vi.fn();
    const result = await adapter.start(request(), { onDispatchStart });
    expect(onDispatchStart).toHaveBeenCalledTimes(1); // the marker was already committed
    expect(result.status).toBe("unknown");
    expect(result.dispatchAttempted).toBe(true);
    expect(result.executionRef.native_ref).toBeNull();
    expect(result.observations.reachedProvider).toBe(false);
    expect(result.reason).toMatch(/dispatch outcome is unknown/u);
  });

  it("fills in the native reference as soon as it is observed", async () => {
    const sdk = fakeSdk({ events: COMPLETED_TURN });
    const adapter = createCodexAdapter({ importSdk: async () => sdk.module });
    const result = await adapter.start(request());
    expect(result.executionRef.native_ref).toBe("thr_native_1");
    expect(result.executionRef.dispatch_key).toBe("j-0001");
    expect(result.status).toBe("finished");
  });

  it("cannot reconcile a lost launch by dispatch key on this backend", async () => {
    const adapter = createCodexAdapter({ importSdk: async () => fakeSdk({}).module });
    const result = await adapter.inspect(newCodexExecutionRef("j-0009"));
    expect(result.status).toBe("unknown");
    expect(result.observations.lookupByDispatchKey).toBe("unsupported");
    expect(describeProfile().lifecycle.inspectByDispatchKey).toBe("unsupported");
  });

  it("inspects read-only: a native record proves dispatch, and nothing is resumed", async () => {
    const sdk = fakeSdk({});
    const adapter = createCodexAdapter({
      importSdk: async () => sdk.module,
      readNativeRecords: async (id: string) => [{ id, path: "sessions/" + id + ".jsonl" }],
    });
    const ref = withNativeRef(newCodexExecutionRef("j-0010"), "thr_native_1");
    const result = await adapter.inspect(ref);
    expect(result.observations.dispatchEstablished).toBe(true);
    expect(result.observations.liveness).toBe("unobservable");
    expect(result.status).toBe("unknown"); // dispatched is not the same as running
    expect(sdk.calls).toEqual([]); // no thread was created, nothing was resumed
  });

  it("does not read a missing native record as proof that nothing was dispatched", async () => {
    const adapter = createCodexAdapter({
      importSdk: async () => fakeSdk({}).module,
      readNativeRecords: async () => [],
    });
    const ref = withNativeRef(newCodexExecutionRef("j-0011"), "thr_gone");
    const result = await adapter.inspect(ref);
    expect(result.observations.dispatchEstablished).toBe(false);
    expect(result.reason).toMatch(/does not prove the dispatch did not happen/u);
  });

  it("resumes the native session under a new dispatch key", async () => {
    const sdk = fakeSdk({ events: COMPLETED_TURN });
    const adapter = createCodexAdapter({ importSdk: async () => sdk.module });
    const prior = withNativeRef(newCodexExecutionRef("j-0012"), "thr_native_1");
    const result = await adapter.resume(prior, request({ job_id: "j-0013", purpose: "resume" }));
    expect(sdk.calls).toContain("resumeThread:thr_native_1");
    expect(result.executionRef.dispatch_key).toBe("j-0013");
    expect(result.executionRef.native_ref).toBe("thr_native_1");
    expect(result.operation).toBe("resume");
  });

  it("reports a stop as requested, never as confirmed", async () => {
    const adapter = createCodexAdapter({ importSdk: async () => fakeSdk({}).module, now: () => "T" });
    const result = await adapter.stop(newCodexExecutionRef("j-0014"));
    expect(result.observations.requested).toBe(true);
    expect(result.observations.providerConfirmed).toBe(false);
    expect(result.observations.descendantsContained).toBe("unknown");
    expect(result.status).toBe("unknown");
    expect(result.reason).toMatch(/requested-only/u);
  });

  it("exports material references and refuses the worker's own digest", async () => {
    const adapter = createCodexAdapter({ importSdk: async () => fakeSdk({}).module });
    const result = await adapter.exportCandidate(newCodexExecutionRef("j-0015"), {
      workspaceRoot: "C:/scratch/j-0015",
      workerClaims: { candidate_id: "cand-i-picked", sha256: "deadbeef", summary: "changed one file" },
    });
    expect(result.observations.materialRoot).toBe("C:/scratch/j-0015");
    expect(seen(result).identityClaim.accepted).toBe(false);
    expect(seen(result).identityClaim.claimedFields).toEqual(["candidate_id", "sha256"]);
    // candidate_id is a quarantined field: it never appears as an observation.
    expect(result.observations.candidate_id).toBeUndefined();
    expect(result.reason).toMatch(/trusted snapshotting/u);
  });
});

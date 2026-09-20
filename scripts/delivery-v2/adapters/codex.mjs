// scripts/delivery-v2/adapters/codex.mjs
// PM Delivery V2 — S1.1: the first (and only) executor adapter.
//
// Codex exec/SDK is the plan's first candidate backend, chosen in
// "PM Delivery — Context & Agent Model.md" §2 because the reassessment found
// documented native Windows containment and automation interfaces. That is a
// *candidate selection*, and this file is careful to keep it one: everything it
// asserts about the installed environment comes from an observation record the
// caller supplies, and everything it asserts about the SDK's shape comes from the
// pinned package's own type surface, which a fixture re-reads.
//
// Relationship to the V1 driver
// -----------------------------
// scripts/delivery/drivers/codex.mjs is a *turn* driver: startSession → runTurn →
// usage, with phase machinery above it. Its `buildThreadOptions` and its event
// mapping are correct and are the reason this file can be short, but the seam
// itself is not reused, for one reason that matters: the V1 driver's session ref
// is the provider's thread id, so its identity *is* the backend's identity. The
// V2 boundary needs the opposite — a supervisor-minted dispatch key that exists
// before the provider has ever been contacted, with the native id filled in later
// if it arrives (Context §3). Building that on top of a ref the provider creates
// would reintroduce exactly the unknown-launch hole S1.2 has to close.
//
// Three findings about this interface are baked in below as refusals rather than
// TODOs, because each one is a promise ERA would otherwise make and could not
// keep. They are stated at their call sites: no monetary reading, no lookup by
// dispatch key, no provider-confirmed stop.

import {
  bindAdapterResult,
  finalizeProfile,
  makeControl,
  makeExecutionRef,
  makeResumeRequest,
  withNativeRef,
} from "./adapter.mjs";
import { ContractError, deepFreeze } from "../contracts.mjs";
import { rejectWorkerIdentity } from "../candidate.mjs";
import { COUNTER_SEMANTICS, USAGE_FIELDS } from "../usage-normalization.mjs";
import { subscriptionRecord } from "../subscription-window.mjs";

export const BACKEND_ID = "codex-exec-sdk";
const SDK_MODULE_SPECIFIER = "@openai/codex-sdk";

/**
 * What the pinned SDK's public surface actually offers, as reviewed in
 * node_modules/@openai/codex-sdk/dist/index.d.ts at version 0.144.1.
 *
 * This is a *static* record of an interface, not a claim about the installed
 * machine, and tests/delivery-v2/backend-profile.test.ts re-reads the .d.ts to
 * check it has not drifted. Keeping it as data is what lets describeProfile()
 * report "unsupported" as a finding with a citation rather than as an opinion.
 */
export const CODEX_SDK_SURFACE = deepFreeze({
  package: SDK_MODULE_SPECIFIER,
  reviewed_version: "0.144.1",
  threadOptions: [
    "model",
    "sandboxMode",
    "workingDirectory",
    "skipGitRepoCheck",
    "modelReasoningEffort",
    "networkAccessEnabled",
    "webSearchMode",
    "webSearchEnabled",
    "approvalPolicy",
    "additionalDirectories",
  ],
  turnOptions: ["outputSchema", "signal"],
  usageFields: ["input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens"],
  // The three findings. Each is the absence of something, which is why each is
  // recorded explicitly: an absent field is invisible until someone writes it
  // down, and the failure mode is promising the capability anyway.
  monetaryUsageField: null,
  lookupByCallerKey: false,
  stopAcknowledgement: false,
  nonGitOption: "skipGitRepoCheck",
});

/** Codex's own sandbox modes; `workspace-write` is the only one a build job may use. */
export const SANDBOX_MODES = Object.freeze(["read-only", "workspace-write", "danger-full-access"]);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/**
 * Build the exact ThreadOptions for one confined job.
 *
 * Every field is set explicitly, including the ones whose default would already
 * be right. A default is a property of the version installed today; a written
 * field is a property of this launch, and the profile records what was written.
 *
 * `skipGitRepoCheck: true` is the SDK equivalent of the CLI's
 * `--skip-git-repo-check`, and it is the whole reason a metadata-free snapshot can
 * be launched at all. Portfolio S1.1 is explicit that the alternative —
 * initialising a repository inside the scratch tree to satisfy the check — is
 * forbidden: it would put a `.git` directory in the candidate, which is the one
 * thing the snapshot rules exclude by name.
 *
 * `danger-full-access` is refused here rather than validated away at a higher
 * layer, so that "turn off the sandbox to make it pass" has no code path.
 *
 * A read-only job gets Codex's `read-only` sandbox as well as a read-only mount.
 *
 * @param {{workspaceRoot:string, mode?:(string|null), access?:string, model?:(string|null),
 *   effort?:(string|null), additionalDirectories?:string[]}} input
 */
export function buildThreadOptions({
  workspaceRoot,
  mode = null,
  access = "write",
  model = null,
  effort = null,
  additionalDirectories = [],
}) {
  if (!isNonEmptyString(workspaceRoot)) throw new ContractError("codex adapter: a job needs a workspace root");
  mode = mode || (access === "read-only" ? "read-only" : "workspace-write");
  if (!SANDBOX_MODES.includes(mode)) throw new ContractError("codex adapter: unknown sandbox mode " + mode);
  if (access === "read-only" && mode !== "read-only") {
    throw new ContractError("codex adapter: a read-only job cannot run in " + mode);
  }
  if (mode === "danger-full-access") {
    throw new ContractError("codex adapter: danger-full-access is not an available profile under this plan");
  }
  const options = {
    workingDirectory: workspaceRoot,
    sandboxMode: mode,
    approvalPolicy: "never",
    networkAccessEnabled: false,
    webSearchEnabled: false,
    skipGitRepoCheck: true,
    additionalDirectories: [...additionalDirectories],
  };
  if (model) options.model = model;
  if (effort) options.modelReasoningEffort = effort;
  return deepFreeze(options);
}

/**
 * Normalize a `turn.completed` usage payload without inventing a currency.
 *
 * The pinned SDK's `Usage` carries four token counters and no cost field. Reading
 * one anyway — by pricing tokens from a table, say — would manufacture the
 * "reconciled billed cost" that Context §7 insists is a separate provenance from
 * an estimate. So `costUsd` is null here, always, and `basis` says why.
 */
export function normalizeCodexUsage(raw) {
  const usage = raw && typeof raw === "object" ? raw : {};
  return deepFreeze({
    unit: "tokens",
    input: Number(usage.input_tokens || 0),
    cachedInput: Number(usage.cached_input_tokens || 0),
    cacheCreation: 0,
    output: Number(usage.output_tokens || 0),
    reasoningOutput: Number(usage.reasoning_output_tokens || 0),
    costUsd: null,
    counterSemantics: CODEX_COUNTER_SEMANTICS,
    basis:
      "provider token counters, cumulative for the whole Codex thread (turn.completed carries ThreadTokenUsage.total, which resume seeds from the rollout); this interface reports no monetary amount",
  });
}

/**
 * What a Codex `turn.completed.usage` counts.
 *
 * Established from the pinned implementation, not from the SDK's doc comment —
 * which says "during a turn" and is what made this look per-turn for two runs.
 * The chain is quoted in `usage-normalization.mjs`; the short form is that the
 * exec JSON processor emits `ThreadTokenUsage.total`, that total accumulates
 * every request, and a resumed thread reloads it from the rollout. So the second
 * job on a resumed thread restates the first job's usage and must be normalized
 * against it before anything is summed.
 */
export const CODEX_COUNTER_SEMANTICS = COUNTER_SEMANTICS.THREAD_CUMULATIVE;

/**
 * Collapse a dispatch's readings into one dispatch-level view, without double
 * counting.
 *
 * Two different mistakes are possible here and this function exists to avoid
 * both. A caller that inspects twice, or that banks a reading from a dying
 * stream and then sees the same turn's `turn.completed`, would count that turn
 * twice; readings are therefore keyed by turn ordinal and merged by
 * *replacement* — the behaviour F-COST asks for ("duplicate-usage does not
 * double-count cumulative readings").
 *
 * The second mistake is summing turns. Codex's counter is cumulative for the
 * whole thread, so turn 2 already contains turn 1 and adding them inflates the
 * dispatch. Under `THREAD_CUMULATIVE` the dispatch's raw state is therefore the
 * *last* (largest) reading, not the sum. This view is still raw: subtracting the
 * parent job's baseline is the supervisor's job, in `usage-normalization.mjs`.
 *
 * A counter that goes *down* between readings of the same turn is a reset, not a
 * refund (Context §7), so the earlier value is retained and the reset recorded.
 */
/** @param {any[]} readings @param {{semantics?:string}} [options] */
export function mergeUsageReadings(readings, { semantics = CODEX_COUNTER_SEMANTICS } = {}) {
  const byTurn = new Map();
  const resets = [];
  for (const reading of readings || []) {
    const key = reading.turn == null ? byTurn.size : reading.turn;
    const existing = byTurn.get(key);
    if (existing) {
      const shrank = USAGE_FIELDS.some((field) => Number(reading.usage[field] || 0) < Number(existing.usage[field] || 0));
      if (shrank) {
        resets.push({ turn: key, reason: "counter decreased between readings; a reset is not a refund" });
        continue;
      }
    }
    byTurn.set(key, reading);
  }
  const cumulative = semantics === COUNTER_SEMANTICS.THREAD_CUMULATIVE;
  const total = { input: 0, cachedInput: 0, cacheCreation: 0, output: 0, reasoningOutput: 0 };
  for (const reading of byTurn.values()) {
    for (const field of USAGE_FIELDS) {
      const value = Number(reading.usage[field] || 0);
      total[field] = cumulative ? Math.max(total[field], value) : total[field] + value;
    }
  }
  return deepFreeze({
    unit: "tokens",
    ...total,
    costUsd: null,
    readings: byTurn.size,
    resets: Object.freeze(resets),
    counterSemantics: semantics,
    basis: cumulative
      ? "the thread's latest cumulative provider counter for this dispatch, before any baseline is subtracted; no monetary amount is available from this interface"
      : "sum of distinct per-turn provider counters; no monetary amount is available from this interface",
  });
}

/**
 * Turn an installed-environment observation record into the controls half of a
 * profile.
 *
 * Called with `null` — which is the state of every host nobody has run the probe
 * on — every control comes back `unknown` and unverified, and finalizeProfile
 * refuses to qualify the profile. That is the intended default: a documented
 * sandbox is not qualification.
 *
 * The one control that does not need the host probe is `resource.wholeJobBound`.
 * Its answer is a property of the interface, not of the machine: the SDK reports
 * token counters and nothing else, so no whole-job monetary bound exists to
 * enforce, on any host, at this version. It is therefore recorded as a *verified
 * unsupported* control citing the type surface — which is a finding, and the
 * reason a strict monetary promise is refused rather than deferred.
 *
 * @param {(object|null)} observations a record produced by probes/codex-qualification.mjs
 */
export function buildControls(observations) {
  const seen = (observations && observations.controls) || {};
  const control = (id, fallbackNote) => {
    const entry = seen[id];
    if (!entry) return makeControl({ id, state: "unknown", note: fallbackNote });
    return makeControl({
      id,
      state: entry.state,
      declared: entry.declared ?? null,
      verified: Boolean(entry.verified),
      evidence_ref: entry.evidence_ref ?? null,
      note: entry.note ?? null,
    });
  };

  return [
    control("filesystem.scratchWrite", "no F-ISOLATION probe has been run on this host"),
    control("filesystem.outsideScratchWrite", "no F-ISOLATION probe has been run on this host"),
    control("filesystem.hostSecretRead", "no F-ISOLATION probe has been run on this host"),
    control("filesystem.linkEscape", "no F-ISOLATION probe has been run on this host"),
    control("network.egress", "networkAccessEnabled=false is declared at launch but unobserved here"),
    control("process.descendantsAfterStop", "stop semantics are unobserved on this host"),
    control("store.workerAccess", "the supervisor store's inaccessibility to the worker is unobserved"),
    makeControl({
      id: "resource.wholeJobBound",
      state: "unsupported",
      declared: "none",
      verified: true,
      evidence_ref: "sdk-surface:" + SDK_MODULE_SPECIFIER + "@" + CODEX_SDK_SURFACE.reviewed_version + "#Usage",
      note:
        "Usage exposes " +
        CODEX_SDK_SURFACE.usageFields.join(", ") +
        " and no monetary field; TurnOptions carries only outputSchema and signal, so there is no per-job spend limit to set or read",
    }),
  ];
}

/**
 * Lifecycle capabilities, stated as the two refusals they imply.
 *
 * `inspectByDispatchKey: "unsupported"` is the consequential one. The SDK can
 * resume a thread by the *provider's* id and offers no lookup by any identifier
 * the caller minted, so a launch whose acknowledgement is lost before
 * `thread.started` arrives cannot be reconciled through this interface. Context §3
 * says what follows: "If unsupported, a lost launch response remains unknown."
 * S1.2 implements that as a held reservation, and it is not a defect to be
 * retried around.
 */
export function buildLifecycle() {
  return deepFreeze({
    inspectByDispatchKey: "unsupported",
    inspectByDispatchKeyReason:
      "the SDK resumes by provider thread id only; no operation accepts a caller-minted correlation key",
    inspectByNativeRef: "local-records-only",
    inspectByNativeRefReason:
      "liveness is not exposed; a persisted native session record establishes that a dispatch happened, not that it is running",
    stop: "requested-only",
    stopReason: "the only interruption primitive is TurnOptions.signal; no provider stop acknowledgement is returned",
    resumeCreatesNewJob: true,
    nativeSessionPersistence: "provider-side session records",
  });
}

/**
 * Build the profile report for this backend.
 *
 * @param {{observations?:(object|null), runtime?:Record<string, unknown>,
 *   qualification_ref?:(string|null), observed_at?:(string|null)}} [input]
 */
export function describeProfile({ observations = null, runtime = {}, qualification_ref = null, observed_at = null } = {}) {
  return finalizeProfile({
    backend_id: BACKEND_ID,
    runtime: {
      sdk: SDK_MODULE_SPECIFIER,
      sdk_version_reviewed: CODEX_SDK_SURFACE.reviewed_version,
      sdk_version_installed: runtime.sdk_version_installed ?? null,
      cli_version: runtime.cli_version ?? null,
      os: runtime.os ?? null,
      node: runtime.node ?? null,
      binary: runtime.binary ?? null,
      sandbox_backend: runtime.sandbox_backend ?? null,
      ...runtime,
    },
    controls: buildControls(observations),
    lifecycle: buildLifecycle(),
    resources: { unit: "usd", nativeUnit: "tokens" },
    qualification_ref,
    observed_at,
    notes: [
      "Codex exec/SDK is the first candidate backend, not a proven security profile (Context & Agent Model §2).",
      "Launch options are declared per job; a declared option is not an observed control.",
    ],
  });
}

// ---------------------------------------------------------------------------
// Observed activity and effective settings
// ---------------------------------------------------------------------------

const ITEM_KINDS = Object.freeze({
  command_execution: "command",
  file_change: "edit",
  mcp_tool_call: "tool",
  web_search: "search",
  agent_message: "message",
});

/**
 * Read what one event says about activity and applied settings.
 *
 * The typed event union at 0.144.1 carries no model or effort, so both stay
 * unreported unless an event actually includes them. Only the main thread is
 * observable here; no child agents are inferred.
 */
export function observeCodexEvent(state, event, now = () => new Date().toISOString()) {
  const model = typeof event.model === "string" && event.model ? event.model : null;
  const effort =
    typeof event.reasoning_effort === "string"
      ? event.reasoning_effort
      : typeof event.model_reasoning_effort === "string"
        ? event.model_reasoning_effort
        : null;
  if (model) {
    state.effective.model = model;
    if (!state.effective.source.includes("event:" + event.type)) state.effective.source.push("event:" + event.type);
  }
  if (effort) {
    state.effective.effort = effort;
    if (!state.effective.source.includes("event:" + event.type)) state.effective.source.push("event:" + event.type);
  }
  if (event.type === "item.completed" && event.item && ITEM_KINDS[event.item.type]) {
    const item = event.item;
    const summary =
      item.type === "command_execution"
        ? item.command
        : item.type === "file_change" && Array.isArray(item.changes)
          ? item.changes.map((change) => change && change.path).filter(Boolean).join(", ")
          : item.type === "mcp_tool_call"
            ? item.tool
            : item.text || item.query || null;
    state.activity.push({
      at: now(),
      kind: ITEM_KINDS[item.type],
      agent: { role: "main", id: null, executor: BACKEND_ID, model: state.effective.model },
      summary: summary == null ? null : String(summary).slice(0, 240),
    });
    if (state.activity.length > 200) state.activity.shift();
  }
}

function codexEffectiveView(state) {
  return {
    model: state.effective.model,
    effort: state.effective.effort,
    source: state.effective.source.length
      ? state.effective.source.join(",")
      : "not reported by " + SDK_MODULE_SPECIFIER + " " + CODEX_SDK_SURFACE.reviewed_version + " events",
  };
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

async function loadSdk() {
  return import(SDK_MODULE_SPECIFIER);
}

/**
 * Create the Codex adapter.
 *
 * Every external dependency is injected: the SDK module, the clock, and the
 * reader that looks for the provider's local session records. That is not test
 * decoration — S1.2 has to prove that `dispatch_started_at` was committed before
 * the external call, and that is only observable if the call and the clock are
 * both things a fixture can hold.
 *
 * @param {{importSdk?:Function, now?:Function, readNativeRecords?:Function,
 *   codexOptions?:Record<string, unknown>}} [options]
 */
export function createCodexAdapter(options = {}) {
  const importSdk = options.importSdk || loadSdk;
  const now = options.now || (() => new Date().toISOString());
  const readNativeRecords = options.readNativeRecords || (() => []);

  /** Live abort handles, keyed by dispatch key, so stop() has something to pull. */
  const inFlight = new Map();

  async function newCodex() {
    const sdk = await importSdk();
    if (!sdk || typeof sdk.Codex !== "function") {
      throw new ContractError("codex adapter: SDK did not export Codex");
    }
    return new sdk.Codex(options.codexOptions || {});
  }

  /**
   * Drain one streamed turn, keeping raw observations ahead of interpretation.
   *
   * Order matters here and is the reason this is not a `for await` with the
   * parsing inline. Context §3: "Retain raw status and usage before parsing an
   * optional structured engineering response." A stream that dies after
   * `turn.completed` has still spent what it spent, and a malformed final message
   * cannot erase it.
   */
  async function drain(streamed, ref, state) {
    for await (const event of streamed.events) {
      state.events.push(event);
      if (!event || typeof event !== "object") continue;
      observeCodexEvent(state, event, now);
      if (event.type === "thread.started" && event.thread_id) {
        state.nativeRef = event.thread_id;
        state.ref = withNativeRef(state.ref, event.thread_id);
      }
      // Kept beside the token counters, never inside them: a plan window is
      // shared with everything else on the account.
      if (event.type === "era_subscription" && event.observation) {
        state.subscription[event.phase === "before" ? "before" : "after"] = event.observation;
      }
      if (event.type === "turn.completed") {
        state.usageReadings.push({ turn: state.turn, usage: normalizeCodexUsage(event.usage) });
        state.turn += 1;
        state.terminal = "finished";
      }
      if (event.type === "turn.failed") {
        state.terminal = "failed";
        state.failure = (event.error && event.error.message) || "turn failed";
      }
      if (event.type === "error") {
        state.terminal = "failed";
        state.failure = event.message || "stream error";
      }
      if (event.type === "item.completed" && event.item && event.item.type === "agent_message") {
        state.finalText = event.item.text || "";
      }
    }
    void ref;
  }

  /**
   * Run one dispatch against a thread the caller already created.
   *
   * `onDispatchStart` is invoked immediately before the external call and after
   * nothing else — no logging, no option building, no await. The supervisor uses
   * it to commit `dispatch_started_at`, and the guarantee it needs is that a crash
   * anywhere after this point may have reached the provider.
   */
  async function dispatch({ thread, request, onDispatchStart, signal }) {
    const state = {
      ref: request.executionRef,
      nativeRef: request.executionRef.native_ref,
      events: [],
      usageReadings: [],
      subscription: { before: null, after: null },
      turn: 0,
      terminal: null,
      failure: null,
      finalText: "",
      effective: { model: null, effort: null, source: [] },
      activity: [],
    };
    const settings = request.settings || { model: null, effort: null };

    if (typeof onDispatchStart === "function") onDispatchStart({ at: now(), job_id: request.job_id });

    let dispatchAttempted = true;
    try {
      const streamed = await thread.runStreamed(request.instruction, signal ? { signal } : {});
      await drain(streamed, request.executionRef, state);
    } catch (error) {
      // A throw here proves nothing about whether the provider was reached. The
      // status stays `unknown` unless the stream got far enough to say otherwise,
      // and any usage already observed is kept.
      return bindAdapterResult({
        operation: request.purpose === "resume" ? "resume" : "start",
        executionRef: state.ref,
        status: state.terminal === "finished" ? "finished" : "unknown",
        dispatchAttempted,
        observations: {
          error: String((error && error.message) || error),
          usage: mergeUsageReadings(state.usageReadings),
          usageReadings: state.usageReadings,
          subscription: subscriptionRecord(state.subscription),
          nativeEventCount: state.events.length,
          finalText: state.finalText,
          reachedProvider: state.nativeRef != null,
          requested: { model: settings.model, effort: settings.effort },
          effective: codexEffectiveView(state),
          activity: state.activity,
        },
        reason: state.nativeRef
          ? "stream failed after the native session was observed"
          : "stream failed before any native identity was observed; dispatch outcome is unknown",
      });
    }

    return bindAdapterResult({
      operation: request.purpose === "resume" ? "resume" : "start",
      executionRef: state.ref,
      status: state.terminal === "failed" ? "finished" : state.terminal || "unknown",
      dispatchAttempted,
      observations: {
        usage: mergeUsageReadings(state.usageReadings),
        usageReadings: state.usageReadings,
        subscription: subscriptionRecord(state.subscription),
        nativeEventCount: state.events.length,
        finalText: state.finalText,
        failure: state.failure,
        nativeOutcome: state.terminal === "failed" ? "failed" : state.terminal === "finished" ? "succeeded" : null,
        requested: { model: settings.model, effort: settings.effort },
        effective: codexEffectiveView(state),
        activity: state.activity,
      },
      reason: state.terminal ? null : "stream ended without a terminal turn event",
    });
  }

  return {
    backend_id: BACKEND_ID,

    describeProfile,

    /**
     * Begin one authorized native job in its confined workspace.
     *
     * @param {import("./adapter.mjs").JobRequest} request
     * @param {{onDispatchStart?:Function, signal?:AbortSignal, model?:string, effort?:string}} [runOptions]
     */
    async start(request, runOptions = {}) {
      if (request.executionRef.backend_id !== BACKEND_ID) {
        throw new ContractError("codex adapter: request is addressed to " + request.executionRef.backend_id);
      }
      if (request.executionRef.dispatch_key !== request.job_id) {
        throw new ContractError("codex adapter: dispatch_key must equal job_id");
      }
      const settings = request.settings || { model: null, effort: null };
      const threadOptions = buildThreadOptions({
        workspaceRoot: request.workspace.root,
        access: request.workspace.access || "write",
        model: settings.model || runOptions.model || null,
        effort: settings.effort || runOptions.effort || null,
      });
      const codex = await newCodex();
      const thread = codex.startThread(threadOptions);
      const controller = runOptions.signal ? null : new AbortController();
      const signal = runOptions.signal || (controller && controller.signal);
      if (controller) inFlight.set(request.job_id, controller);
      try {
        return await dispatch({ thread, request, onDispatchStart: runOptions.onDispatchStart, signal });
      } finally {
        inFlight.delete(request.job_id);
      }
    },

    /**
     * Read-only reconciliation. Never dispatches, never costs anything.
     *
     * With no native reference there is nothing to look up: this interface has no
     * operation that accepts ERA's dispatch key, so the honest answer is
     * `unknown`, and the caller keeps the reservation.
     *
     * With a native reference, the only read-only evidence available is the
     * provider's own persisted session record. Its presence establishes that a
     * dispatch happened — which is exactly what a lost launch acknowledgement
     * needs — and says nothing about whether the job is still running.
     *
     * @param {import("./adapter.mjs").ExecutionRef} executionRef
     */
    async inspect(executionRef) {
      if (!executionRef.native_ref) {
        return bindAdapterResult({
          operation: "inspect",
          executionRef,
          status: "unknown",
          dispatchAttempted: false,
          observations: { lookupByDispatchKey: "unsupported", nativeRecords: [] },
          reason: "no native identity was observed and this backend cannot reconcile by dispatch key",
        });
      }
      const records = await readNativeRecords(executionRef.native_ref);
      const found = Array.isArray(records) && records.length > 0;
      return bindAdapterResult({
        operation: "inspect",
        executionRef,
        status: found ? "unknown" : "unknown",
        dispatchAttempted: false,
        observations: {
          nativeRecords: found ? records : [],
          dispatchEstablished: found,
          liveness: "unobservable",
        },
        reason: found
          ? "a native session record exists, so the dispatch happened; liveness is not exposed by this interface"
          : "no native session record was found; this does not prove the dispatch did not happen",
      });
    },

    /**
     * Continue an existing native session under a newly admitted Job.
     *
     * The new job's dispatch key is its own; the native reference is inherited.
     * Authority is not: the caller must already have revalidated the grant, and
     * this refuses a resume whose request reuses the prior job id, which is the
     * shape a replay takes.
     *
     * @param {import("./adapter.mjs").ExecutionRef} priorRef
     * @param {import("./adapter.mjs").JobRequest} request
     */
    async resume(priorRef, request, runOptions = {}) {
      const resumeRequest = makeResumeRequest(priorRef, request);
      const resumeSettings = resumeRequest.settings || { model: null, effort: null };
      const threadOptions = buildThreadOptions({
        workspaceRoot: resumeRequest.workspace.root,
        access: resumeRequest.workspace.access || "write",
        model: resumeSettings.model || runOptions.model || null,
        effort: resumeSettings.effort || runOptions.effort || null,
      });
      const codex = await newCodex();
      const thread = codex.resumeThread(priorRef.native_ref, threadOptions);
      const controller = runOptions.signal ? null : new AbortController();
      const signal = runOptions.signal || (controller && controller.signal);
      if (controller) inFlight.set(resumeRequest.job_id, controller);
      try {
        return await dispatch({
          thread,
          request: resumeRequest,
          onDispatchStart: runOptions.onDispatchStart,
          signal,
        });
      } finally {
        inFlight.delete(resumeRequest.job_id);
      }
    },

    /**
     * Ask for interruption and report exactly how far that got.
     *
     * Three distinct facts, never collapsed (Architecture §7): the request was
     * made; the local stream was aborted; the provider confirmed. The third is
     * always false here, because this interface returns no stop acknowledgement —
     * so an ERA run shows "Stop requested" and keeps the job's cost outstanding
     * rather than claiming a stop it cannot see.
     *
     * @param {import("./adapter.mjs").ExecutionRef} executionRef
     */
    async stop(executionRef) {
      const controller = inFlight.get(executionRef.dispatch_key);
      let locallyStopped = false;
      if (controller) {
        controller.abort();
        locallyStopped = true;
      }
      return bindAdapterResult({
        operation: "stop",
        executionRef,
        status: "unknown",
        dispatchAttempted: false,
        observations: {
          requested: true,
          locallyStopped,
          providerConfirmed: false,
          descendantsContained: "unknown",
          at: now(),
        },
        reason:
          "stop is requested-only on this interface; an aborted local stream does not establish that the provider stopped or that descendants exited",
      });
    },

    /**
     * Point the supervisor at the material to freeze.
     *
     * Deliberately returns no identity. The workspace root and the native record
     * pointers are references; anything the worker said about its own output rides
     * along in `workerClaims` and is refused as identity by candidate.mjs. The
     * caller hashes the bytes.
     *
     * @param {import("./adapter.mjs").ExecutionRef} executionRef
     * @param {{workspaceRoot:string, workerClaims?:Record<string, unknown>,
     *   nativeRecordRefs?:string[]}} input
     */
    async exportCandidate(executionRef, { workspaceRoot, workerClaims = {}, nativeRecordRefs = [] } = {}) {
      if (!isNonEmptyString(workspaceRoot)) {
        throw new ContractError("codex adapter: exportCandidate needs the confined workspace root");
      }
      const identityClaim = rejectWorkerIdentity(workerClaims);
      return bindAdapterResult({
        operation: "exportCandidate",
        executionRef,
        status: "finished",
        dispatchAttempted: false,
        observations: {
          materialRoot: workspaceRoot,
          nativeRecordRefs: [...nativeRecordRefs],
          workerClaims: { ...workerClaims },
          identityClaim,
        },
        reason: "material reference only; candidate identity is assigned by trusted snapshotting",
      });
    },
  };
}

/**
 * The executionRef a supervisor persists before it calls anything.
 *
 * Exported from here so the one place that knows this backend's id is this file.
 *
 * @param {string} job_id
 */
export function newCodexExecutionRef(job_id) {
  return makeExecutionRef({ backend_id: BACKEND_ID, dispatch_key: job_id });
}

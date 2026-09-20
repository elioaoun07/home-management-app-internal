// scripts/delivery-v2/adapters/claude.mjs
// PM Delivery V2 — the second executor adapter, behind the same canonical boundary.
//
// Context & Agent Model §2 named Codex exec/SDK as the *first* candidate and said
// "an equivalent backend may be added later after the required fixtures pass".
// The owner has since asked for both executors to remain selectable, so this file
// exists — under the clause that follows in the same paragraph, and which is the
// only reason this addition is not a weakening: "an unavailable provider does not
// authorize weaker containment or an unknown billing basis". Nothing here lowers
// a gate. This backend's controls start `unknown` exactly like Codex's did, its
// profile is qualified by its own observations and by no one else's, and
// `admitProfile()` refuses it today for the same reason it refuses Codex.
//
// Relationship to the V1 driver
// -----------------------------
// scripts/delivery/drivers/claude.mjs is a *turn* driver (startSession → runTurn →
// usage) with phase machinery above it. Its seam is not reused, for the same
// reason the Codex adapter does not reuse V1's: the V2 boundary needs a
// supervisor-minted dispatch key that exists before the provider is contacted.
//
// Its *pure guards* are reused verbatim, because they are the part worth keeping:
// `buildCanUseTool` (secret paths, allowed roots, git-mutating commands, live-DB
// escapes), `assertNeverBypass`, and the raw-transcript path resolver. Rewriting
// those would be duplicating a reviewed security surface for no gain — what the
// architecture constraints forbid duplicating is *orchestration*, and none of it
// is imported here.
//
// Three capabilities this backend has that Codex does not
// ------------------------------------------------------
// Each is expressed through a field the canonical contract already carries, so
// none of them becomes Claude-specific supervisor behaviour:
//
//   1. `sessionId` is caller-minted. The SDK accepts a UUID we choose, so the
//      native reference can be derived from the dispatch key *before* the call.
//      `lifecycle.inspectByDispatchKey` is therefore "derived" rather than
//      "unsupported", and a lost launch acknowledgement is reconcilable against a
//      local session record instead of resting unknown forever.
//   2. `SDKResultMessage.total_cost_usd` is a provider-reported monetary amount,
//      so `usage.costUsd` is a number rather than null. That flows into the
//      existing accounting unchanged — and it is what lets a finished job's
//      reservation actually close.
//   3. `Options.sandbox.failIfUnavailable` turns an unsupported platform into a
//      loud error result instead of a silent unsandboxed run.
//
// And one it lacks in the same way Codex does: there is no whole-job monetary
// ceiling to set. `maxTurns` bounds internal turns, not spend. Reading a cost is
// not bounding it, and the two are not allowed to be confused.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import {
  bindAdapterResult,
  finalizeProfile,
  makeControl,
  makeExecutionRef,
  makeResumeRequest,
  withNativeRef,
} from "./adapter.mjs";
import { ContractError, deepFreeze } from "../contracts.mjs";
import { COUNTER_SEMANTICS } from "../usage-normalization.mjs";
import { subscriptionRecord } from "../subscription-window.mjs";
import { rejectWorkerIdentity } from "../candidate.mjs";
import {
  assertNeverBypass,
  buildCanUseTool,
  resolveRawTranscriptPath,
} from "../../delivery/drivers/claude.mjs";

export const BACKEND_ID = "claude-agent-sdk";
const SDK_MODULE_SPECIFIER = "@anthropic-ai/claude-agent-sdk";

/**
 * What the pinned SDK's public surface actually offers, as reviewed in
 * node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts at version 0.3.207.
 *
 * A static record of an interface, not a claim about this machine —
 * tests/delivery-v2/backend-profile.test.ts re-reads the .d.ts to check it has
 * not drifted. Keeping it as data is what lets describeProfile() report
 * "unsupported" as a finding with a citation rather than as an opinion.
 */
export const CLAUDE_SDK_SURFACE = deepFreeze({
  package: SDK_MODULE_SPECIFIER,
  reviewed_version: "0.3.207",
  options: [
    "cwd",
    "canUseTool",
    "permissionMode",
    "tools",
    "disallowedTools",
    "strictMcpConfig",
    "skills",
    "settingSources",
    "additionalDirectories",
    "abortController",
    "sessionId",
    "resume",
    "forkSession",
    "maxTurns",
    "sandbox",
    "model",
    "effort",
    "hooks",
    "maxBudgetUsd",
  ],
  resultFields: ["subtype", "is_error", "num_turns", "total_cost_usd", "usage", "session_id", "modelUsage"],
  usageFields: ["input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens"],
  effortLevels: ["low", "medium", "high", "xhigh", "max"],
  // The findings. Each is the presence or absence of something, recorded
  // explicitly because an unwritten one is invisible until someone promises it.
  monetaryUsageField: "total_cost_usd",
  monetaryCeilingOption: null,
  // `maxBudgetUsd` stops a query after its estimate is exceeded. That is a visible
  // threshold, not a whole-job bound: the turn that crosses it has already spent.
  monetaryThresholdOption: "maxBudgetUsd",
  callerMintedSessionId: true,
  lookupByCallerKey: true,
  stopAcknowledgement: false,
  sandboxOption: "sandbox",
  sandboxPlatformNote:
    "the reviewed documentation supports the Bash sandbox on macOS/Linux/WSL2, not native Windows; failIfUnavailable=true turns that into an error result rather than an unsandboxed run",
});

/**
 * Built-in tools a build job can legitimately need.
 *
 * Carried over from the V1 driver's DLV-33 finding: without an explicit allowlist
 * the CLI advertises every built-in it ships and pays their definition tokens on
 * every model call. It is a cost control and a surface control at the same time —
 * a tool that is not advertised cannot be called.
 */
export const BUILD_MODE_TOOLS = Object.freeze([
  "Read",
  "Grep",
  "Glob",
  "Edit",
  "Write",
  "Bash",
  "NotebookEdit",
  "TodoWrite",
]);

/** Read-only jobs (a separate review dispatch) get three tools and nothing else. */
export const REVIEW_MODE_TOOLS = Object.freeze(["Read", "Grep", "Glob"]);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/**
 * Derive this dispatch's native session id from its dispatch key.
 *
 * The SDK requires a UUID and lets the caller supply it, which is the whole
 * reason this backend can answer a question Codex cannot: after a crash, the
 * native reference for a job is recomputable from the job id alone, so a lost
 * launch acknowledgement can be checked against a local session record rather
 * than resting unknown forever.
 *
 * Deterministic and content-derived, so recomputing it is not a second identity.
 * Shaped as a v4 UUID (version and variant nibbles forced) because that is what
 * the SDK validates, not because any randomness is claimed.
 *
 * @param {string} dispatch_key
 */
export function deriveNativeSessionId(dispatch_key) {
  if (!isNonEmptyString(dispatch_key)) throw new ContractError("claude adapter: a dispatch key is required");
  const hex = createHash("sha256").update("delivery-v2/claude/session/" + dispatch_key).digest("hex");
  const nibbles = hex.slice(0, 32).split("");
  nibbles[12] = "4";
  nibbles[16] = ((parseInt(nibbles[16], 16) & 0x3) | 0x8).toString(16);
  const uuid = nibbles.join("");
  return (
    uuid.slice(0, 8) +
    "-" +
    uuid.slice(8, 12) +
    "-" +
    uuid.slice(12, 16) +
    "-" +
    uuid.slice(16, 20) +
    "-" +
    uuid.slice(20, 32)
  );
}

/**
 * Build the exact SDK Options for one confined job.
 *
 * Every field is set explicitly, including the ones whose default would already
 * be right. A default is a property of the version installed today; a written
 * field is a property of this launch, and the profile records what was written.
 *
 * The five hardening options are carried over from the V1 driver, where each was
 * a finding rather than a preference:
 *   - `canUseTool`       the harness-level allowlist: secret paths, allowed roots,
 *                        git-mutating commands, live-database escapes.
 *   - `strictMcpConfig`  without it the CLI attaches project/user/plugin/cloud MCP
 *                        servers; `tools` does not filter those.
 *   - `settingSources: []` stops filesystem settings and CLAUDE.md discovery —
 *                        which on this repo would also fire interactive-session
 *                        hooks inside a delivery job.
 *   - `skills: []`       skills stay readable on disk; their descriptions leave
 *                        the system prompt.
 *   - `sandbox`          requested, with `failIfUnavailable: true` so an
 *                        unsupported platform produces an error result rather
 *                        than a quiet unsandboxed run. This is the one option
 *                        that must never be softened to make a launch succeed.
 *
 * `bypassPermissions` has no code path: `assertNeverBypass` is the V1 guard and
 * this function never emits the mode in the first place.
 *
 * `effort` is forwarded as `Options.effort`; `thresholdUsd` as `maxBudgetUsd`, a
 * stop threshold rather than a bound; `observe` receives each tool-use hook input,
 * which is where the SDK reports the effort actually applied.
 *
 * @param {{workspaceRoot:string, mode?:"build"|"review", model?:(string|null),
 *   maxTurns?:(number|null), forbiddenPaths?:string[], additionalDirectories?:string[],
 *   effort?:(string|null), thresholdUsd?:(number|null), observe?:((input:any)=>void)|null}} input
 */
export function buildSessionOptions({
  workspaceRoot,
  mode = "build",
  model = null,
  maxTurns = null,
  forbiddenPaths = [],
  additionalDirectories = [],
  effort = null,
  thresholdUsd = null,
  observe = null,
}) {
  if (!isNonEmptyString(workspaceRoot)) throw new ContractError("claude adapter: a job needs a workspace root");
  if (mode !== "build" && mode !== "review") throw new ContractError("claude adapter: unknown mode " + mode);

  const options = {
    cwd: workspaceRoot,
    canUseTool: buildCanUseTool({ cwd: workspaceRoot, sessionDir: null, forbiddenPaths }),
    permissionMode: mode === "build" ? "acceptEdits" : "default",
    tools: mode === "build" ? [...BUILD_MODE_TOOLS] : [...REVIEW_MODE_TOOLS],
    disallowedTools: mode === "build" ? ["mcp__*"] : ["Write", "Edit", "Bash", "NotebookEdit", "mcp__*"],
    strictMcpConfig: true,
    skills: [],
    settingSources: [],
    additionalDirectories: [...additionalDirectories],
    sandbox: { enabled: true, failIfUnavailable: true },
  };
  if (model) options.model = model;
  if (effort) options.effort = effort;
  if (typeof maxTurns === "number" && maxTurns > 0) options.maxTurns = maxTurns;
  if (typeof thresholdUsd === "number" && Number.isFinite(thresholdUsd) && thresholdUsd > 0) options.maxBudgetUsd = thresholdUsd;
  if (typeof observe === "function") {
    options.hooks = {
      PreToolUse: [
        {
          hooks: [
            async (input) => {
              observe(input);
              return { continue: true };
            },
          ],
        },
      ],
    };
  }
  return deepFreeze(assertNeverBypass(options));
}

/** Record what a hook input reports about the turn's applied effort. */
export function observeHookInput(state, input) {
  const level = input && input.effort && typeof input.effort.level === "string" ? input.effort.level : null;
  if (!level) return;
  // Subagent turns report their own effort; the run's setting is the main thread's.
  if (input.agent_id) return;
  state.effective.effort = level;
  if (!state.effective.source.includes("hook.effort")) state.effective.source.push("hook.effort");
}

const ACTIVITY_LIMIT = 200;

function pushActivity(state, entry, now) {
  state.activity.push({ at: now(), ...entry, summary: entry.summary == null ? null : String(entry.summary).slice(0, 240) });
  if (state.activity.length > ACTIVITY_LIMIT) state.activity.shift();
}

function effectiveView(state) {
  return {
    model: state.effective.model,
    effort: state.effective.effort,
    models: [...state.effective.models],
    source: state.effective.source.length ? state.effective.source.join(",") : "not reported",
  };
}

/**
 * Attach this dispatch's session identity.
 *
 * A first dispatch establishes the session under the id we derived; a resume
 * continues it. `forkSession` is never set — a fork would create a second native
 * identity behind one dispatch key, which is the overlap the boundary exists to
 * notice.
 *
 * @param {object} options
 * @param {{native_ref:string}} ref
 * @param {boolean} resuming
 */
export function withSessionIdentity(options, ref, resuming) {
  if (!ref || !isNonEmptyString(ref.native_ref)) {
    throw new ContractError("claude adapter: a native session id is required before dispatch");
  }
  return resuming ? { ...options, resume: ref.native_ref } : { ...options, sessionId: ref.native_ref };
}

/**
 * Normalize an SDKResultMessage into the shape the store records.
 *
 * `costUsd` is a real number here, and its basis says where it came from. That is
 * a different provenance from a reconciled bill (Context §7 keeps the four
 * apart), so the basis names the field rather than implying settlement.
 *
 * `cache_creation_input_tokens` is kept rather than dropped — V1's DLV-37 found
 * that bucket was the majority of real session cost and was recorded nowhere.
 */
/**
 * What a Claude result message's usage counts: that turn, and nothing before it.
 *
 * The agent SDK emits one `result` message per turn carrying that turn's usage,
 * and a resumed session does not restate earlier turns. So these readings are
 * summed as they arrive and no baseline is subtracted.
 */
export const CLAUDE_COUNTER_SEMANTICS = COUNTER_SEMANTICS.PER_TURN;

export function normalizeClaudeUsage(resultMessage) {
  const message = resultMessage && typeof resultMessage === "object" ? resultMessage : {};
  const usage = message.usage && typeof message.usage === "object" ? message.usage : {};
  const cost = message.total_cost_usd;
  const readable = typeof cost === "number" && Number.isFinite(cost);
  const included = message.era_billing_basis === "included-subscription";
  return deepFreeze({
    unit: included ? "tokens" : "usd",
    input: Number(usage.input_tokens || 0),
    cachedInput: Number(usage.cache_read_input_tokens || 0),
    cacheCreation: Number(usage.cache_creation_input_tokens || 0),
    output: Number(usage.output_tokens || 0),
    reasoningOutput: 0,
    costUsd: included ? null : readable ? cost : null,
    ...(included ? { apiEquivalentUsd: readable ? cost : null } : {}),
    // Per-turn, and stated rather than assumed: the Codex counter is cumulative
    // for its thread, and nothing here may inherit that rule by proximity.
    counterSemantics: CLAUDE_COUNTER_SEMANTICS,
    basis: included ? "included subscription usage; total_cost_usd is an API-equivalent estimate, not additional billed spending" : readable
      ? "provider-reported total_cost_usd for this turn; not a reconciled bill"
      : "the result message carried no total_cost_usd; the amount is unknown, not zero",
  });
}

/**
 * Add a later cumulative reading to an earlier one without double counting.
 *
 * Same rule as the Codex adapter, and for the same reason: readings are keyed by
 * turn ordinal within a dispatch and merged by *replacement*, so a caller that
 * inspects twice cannot count a turn twice. A counter that decreases between
 * readings is a reset, not a refund, so the earlier value is retained.
 */
export function mergeUsageReadings(readings) {
  const byTurn = new Map();
  const resets = [];
  for (const reading of readings || []) {
    const key = reading.turn == null ? byTurn.size : reading.turn;
    const existing = byTurn.get(key);
    if (existing) {
    const shrank = ["input", "cachedInput", "cacheCreation", "output", "reasoningOutput"].some(
        (field) => Number(reading.usage[field] || 0) < Number(existing.usage[field] || 0),
      );
      if (shrank) {
        resets.push({ turn: key, reason: "counter decreased between readings; a reset is not a refund" });
        continue;
      }
    }
    byTurn.set(key, reading);
  }
  const total = { input: 0, cachedInput: 0, cacheCreation: 0, output: 0, reasoningOutput: 0 };
  let costUsd = null;
  for (const reading of byTurn.values()) {
    for (const field of Object.keys(total)) total[field] += Number(reading.usage[field] || 0);
    if (reading.usage.costUsd != null) costUsd = Number(costUsd || 0) + Number(reading.usage.costUsd);
  }
  return deepFreeze({
    unit: byTurn.size > 0 && [...byTurn.values()].every(reading => reading.usage.unit === "tokens") ? "tokens" : "usd",
    ...total,
    costUsd,
    readings: byTurn.size,
    resets: Object.freeze(resets),
    counterSemantics: CLAUDE_COUNTER_SEMANTICS,
    basis:
      costUsd == null
        ? "sum of distinct per-turn provider counters; no monetary amount was reported"
        : "sum of distinct per-turn provider-reported total_cost_usd values; not a reconciled bill",
  });
}

/**
 * Turn an installed-environment observation record into the controls half of a
 * profile.
 *
 * Called with `null` — the state of every host nobody has probed — every control
 * comes back `unknown` and unverified, and finalizeProfile refuses to qualify the
 * profile. The Context §2 documentation finding that this SDK's Bash sandbox does
 * not cover native Windows is carried as a *note*, not as a state: a dated
 * documentation claim is a hypothesis to verify, and recording it as an
 * observation is exactly the mistake the qualification rules exist to prevent.
 *
 * The one control answerable from the interface alone is `resource.wholeJobBound`.
 * The SDK reports `total_cost_usd` and offers no option that caps spend, so no
 * whole-job monetary bound exists to enforce on any host at this version. A
 * verified *unsupported* finding, citing the type surface — which is why a strict
 * monetary promise is refused rather than deferred, even though, unlike Codex,
 * this backend can at least tell you afterwards what it cost.
 *
 * @param {(object|null)} observations a record produced by probes/claude-qualification.mjs
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

  const unprobed = "no containment probe has been run against this backend on this host";
  const harnessOnly =
    unprobed +
    "; the only declared control is the harness-level canUseTool allowlist, which screens tool calls and not what a permitted tool's subprocess then does";

  return [
    control("filesystem.scratchWrite", unprobed),
    control("filesystem.outsideScratchWrite", harnessOnly),
    control("filesystem.hostSecretRead", harnessOnly),
    control("filesystem.linkEscape", harnessOnly),
    control(
      "network.egress",
      unprobed + "; the reviewed documentation places the Bash sandbox on macOS/Linux/WSL2, not native Windows",
    ),
    control(
      "process.descendantsAfterStop",
      unprobed + "; abortController stops the query, and descendant survival is unobserved",
    ),
    control("store.workerAccess", harnessOnly),
    makeControl({
      id: "resource.wholeJobBound",
      state: "unsupported",
      declared: "none",
      verified: true,
      evidence_ref: "sdk-surface:" + SDK_MODULE_SPECIFIER + "@" + CLAUDE_SDK_SURFACE.reviewed_version + "#Options",
      note:
        "SDKResultMessage reports total_cost_usd, so a spend can be READ; Options.maxBudgetUsd stops a query after that estimate is exceeded, which is a threshold and not a whole-job bound. Reading or stopping on a cost is not bounding it.",
    }),
  ];
}

/**
 * Lifecycle capabilities, stated as what they let the supervisor do.
 *
 * `inspectByDispatchKey: "derived"` is the consequential one and the one place
 * this backend beats the other. The native session id is a pure function of the
 * dispatch key, so a launch whose acknowledgement is lost before any message
 * arrived can still be checked against the local session record. That is a
 * reconciliation the Codex profile cannot perform, and it is expressed in a field
 * the canonical contract already carries — no supervisor branch is added for it.
 *
 * `stop` is still "requested-only": aborting the local query establishes that we
 * asked, not that the provider stopped or that descendants exited.
 */
export function buildLifecycle() {
  return deepFreeze({
    inspectByDispatchKey: "derived",
    inspectByDispatchKeyReason:
      "the SDK accepts a caller-minted sessionId, so the native reference is recomputable from the dispatch key and a lost launch acknowledgement can be checked against the local session record",
    inspectByNativeRef: "local-records-only",
    inspectByNativeRefReason:
      "the session transcript on disk establishes that a dispatch happened; liveness is not exposed by this interface",
    stop: "requested-only",
    stopReason:
      "abortController aborts the local query; no provider stop acknowledgement is returned and descendant exit is not reported",
    resumeCreatesNewJob: true,
    nativeSessionPersistence: "local session transcript under the user's Claude projects directory",
  });
}

/**
 * Build the profile report for this backend.
 *
 * @param {{observations?:(object|null), runtime?:Record<string, unknown>,
 *   qualification_ref?:(string|null), observed_at?:(string|null)}} [input]
 */
export function describeProfile({
  observations = null,
  runtime = {},
  qualification_ref = null,
  observed_at = null,
} = {}) {
  return finalizeProfile({
    backend_id: BACKEND_ID,
    runtime: {
      sdk: SDK_MODULE_SPECIFIER,
      sdk_version_reviewed: CLAUDE_SDK_SURFACE.reviewed_version,
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
    resources: {
      unit: "usd",
      nativeUnit: "usd",
      costReadingAvailable: true,
      costReadingBasis: "SDKResultMessage.total_cost_usd (provider-reported, not a reconciled bill)",
    },
    qualification_ref,
    observed_at,
    notes: [
      "Added as a second selectable executor at the owner's request. Context & Agent Model §2's clause holds: an available alternative does not authorize weaker containment or an unknown billing basis.",
      "Launch options are declared per job; a declared option is not an observed control.",
      "This backend can report what a job cost. It cannot cap what a job costs.",
    ],
  });
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

async function loadSdk() {
  return import(SDK_MODULE_SPECIFIER);
}

/**
 * Create the Claude adapter.
 *
 * Every external dependency is injected: the SDK module, the clock, and the
 * reader that looks for local session records. That is not test decoration — the
 * supervisor has to be able to prove `dispatch_started_at` was committed before
 * the external call, and that is only observable if the call and the clock are
 * both things a fixture can hold.
 *
 * @param {{importSdk?:Function, now?:Function, readNativeRecords?:Function,
 *   sessionHomeDir?:(string|null)}} [options]
 */
export function createClaudeAdapter(options = {}) {
  const importSdk = options.importSdk || loadSdk;
  const now = options.now || (() => new Date().toISOString());

  /**
   * Default reconciliation source: the transcript Claude Code writes for the
   * session under the user's own projects directory. Read-only, free, and present
   * whether or not this process saw the launch acknowledgement.
   */
  const readNativeRecords =
    options.readNativeRecords ||
    ((native_ref, { workspaceRoot } = {}) => {
      if (!isNonEmptyString(workspaceRoot)) return [];
      const pointer = resolveRawTranscriptPath(
        workspaceRoot,
        native_ref,
        options.sessionHomeDir ? { homeDir: options.sessionHomeDir } : {},
      );
      return existsSync(pointer) ? [{ kind: "session-transcript", path: pointer }] : [];
    });

  /** Live abort controllers, keyed by dispatch key, so stop() has something to pull. */
  const inFlight = new Map();

  /**
   * Drain one query, keeping raw observations ahead of interpretation.
   *
   * Order matters and is why the parsing is not inline in a `for await` body.
   * Context §3: "Retain raw status and usage before parsing an optional structured
   * engineering response." A stream that dies after the result message has still
   * spent what it spent, and a malformed final message cannot erase it.
   */
  async function drain(stream, state) {
    for await (const message of stream) {
      state.messageCount += 1;
      if (!message || typeof message !== "object") continue;
      if (message.type === "system" && message.subtype === "init") {
        state.sessionEstablished = true;
        if (typeof message.model === "string" && message.model) {
          state.effective.model = message.model;
          if (!state.effective.source.includes("init.model")) state.effective.source.push("init.model");
        }
      }
      // Hook observations relayed from a worker process outside this one.
      if (message.type === "era_observation") {
        observeHookInput(state, message);
        continue;
      }
      // Plan-window observations bracketing the job: recorded beside the usage
      // counters, never added to them.
      if (message.type === "era_subscription" && message.observation) {
        state.subscription[message.phase === "before" ? "before" : "after"] = message.observation;
        continue;
      }
      if (message.type === "assistant" && message.message && Array.isArray(message.message.content)) {
        const parent = message.parent_tool_use_id ?? null;
        // Only identities the executor recorded: a parent tool-use id is a real
        // child, and its absence is the main thread. No team is inferred.
        const agent = parent
          ? { role: "subagent", id: String(parent), executor: BACKEND_ID, model: null }
          : { role: "main", id: null, executor: BACKEND_ID, model: state.effective.model };
        for (const block of message.message.content) {
          if (block && block.type === "text" && block.text) {
            if (!parent) state.finalText = block.text;
            pushActivity(state, { kind: "message", agent, summary: block.text }, now);
          }
          if (block && block.type === "tool_use") {
            pushActivity(state, { kind: "tool", agent, summary: String(block.name || "tool") }, now);
          }
        }
      }
      if (message.type === "result") {
        state.usageReadings.push({ turn: state.turn, usage: normalizeClaudeUsage(message) });
        state.turn += 1;
        state.terminal = "finished";
        state.failure = message.is_error ? String(message.subtype || "error result") : null;
        if (typeof message.result === "string" && message.result) state.finalText = message.result;
        if (message.modelUsage && typeof message.modelUsage === "object") {
          state.effective.models = Object.keys(message.modelUsage);
        }
      }
    }
  }

  /**
   * Run one dispatch.
   *
   * `onDispatchStart` is invoked immediately before the external call and after
   * nothing else — no logging, no option building, no await. The supervisor uses
   * it to commit `dispatch_started_at`, and the guarantee it needs is that a crash
   * anywhere after this point may have reached the provider.
   */
  async function dispatch({ request, resuming, onDispatchStart, runOptions }) {
    const native_ref = request.executionRef.native_ref || deriveNativeSessionId(request.job_id);
    // Bound before the call, not after. This is the whole point of a caller-minted
    // session id: even a dispatch that appears never to have left the process has
    // a native reference recorded against it, so reconciliation has something to
    // look for.
    const ref = withNativeRef(request.executionRef, native_ref);

    const state = {
      ref,
      messageCount: 0,
      usageReadings: [],
      subscription: { before: null, after: null },
      turn: 0,
      terminal: null,
      failure: null,
      finalText: "",
      sessionEstablished: false,
      effective: { model: null, effort: null, models: [], source: [] },
      activity: [],
    };
    const settings = request.settings || { model: null, effort: null };
    const readOnly = Boolean(request.workspace && request.workspace.access === "read-only");

    const sdk = await importSdk();
    if (!sdk || typeof sdk.query !== "function") {
      throw new ContractError("claude adapter: SDK did not export query");
    }

    const controller = new AbortController();
    if (runOptions.signal) {
      if (runOptions.signal.aborted) controller.abort();
      else runOptions.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    inFlight.set(request.job_id, controller);

    const sessionOptions = withSessionIdentity(
      {
        ...buildSessionOptions({
          workspaceRoot: request.workspace.root,
          // A read-only job gets the three read tools; the environment's read-only
          // mount is what actually denies a write.
          mode: request.purpose === "review" || readOnly ? "review" : "build",
          model: settings.model || runOptions.model || null,
          effort: settings.effort || runOptions.effort || null,
          maxTurns: request.native_limits && request.native_limits.maxTurns ? request.native_limits.maxTurns : null,
          thresholdUsd: request.native_limits && request.native_limits.thresholdUsd ? Number(request.native_limits.thresholdUsd) : null,
          forbiddenPaths: runOptions.forbiddenPaths || [],
          observe: (input) => observeHookInput(state, input),
        }),
        abortController: controller,
      },
      { native_ref },
      resuming,
    );

    const operation = resuming ? "resume" : "start";

    if (typeof onDispatchStart === "function") onDispatchStart({ at: now(), job_id: request.job_id });

    try {
      await drain(sdk.query({ prompt: request.instruction, options: sessionOptions }), state);
    } catch (error) {
      // A throw here proves nothing about whether the provider was reached. The
      // status stays `unknown` unless the stream got far enough to say otherwise,
      // and any usage already observed is kept.
      return bindAdapterResult({
        operation,
        executionRef: state.ref,
        status: state.terminal === "finished" ? "finished" : "unknown",
        dispatchAttempted: true,
        observations: {
          error: String((error && error.message) || error),
          usage: mergeUsageReadings(state.usageReadings),
          usageReadings: state.usageReadings,
          subscription: subscriptionRecord(state.subscription),
          nativeMessageCount: state.messageCount,
          finalText: state.finalText,
          reachedProvider: state.sessionEstablished,
          requested: { model: settings.model, effort: settings.effort },
          effective: effectiveView(state),
          activity: state.activity,
        },
        reason: state.sessionEstablished
          ? "the query failed after the native session was established"
          : "the query failed before the session was established; the dispatch outcome is unknown, and the derived session id is the reconciliation handle",
      });
    } finally {
      inFlight.delete(request.job_id);
    }

    return bindAdapterResult({
      operation,
      executionRef: state.ref,
      status: state.terminal || "unknown",
      dispatchAttempted: true,
      observations: {
        usage: mergeUsageReadings(state.usageReadings),
        usageReadings: state.usageReadings,
        subscription: subscriptionRecord(state.subscription),
        nativeMessageCount: state.messageCount,
        finalText: state.finalText,
        failure: state.failure,
        nativeOutcome: state.terminal === "finished" ? (state.failure ? "failed" : "succeeded") : null,
        requested: { model: settings.model, effort: settings.effort },
        effective: effectiveView(state),
        activity: state.activity,
      },
      reason: state.terminal ? null : "the query ended without a result message",
    });
  }

  return {
    backend_id: BACKEND_ID,

    describeProfile,

    /**
     * Begin one authorized native job in its confined workspace.
     *
     * @param {import("./adapter.mjs").JobRequest} request
     * @param {{onDispatchStart?:Function, signal?:AbortSignal, model?:string,
     *   forbiddenPaths?:string[]}} [runOptions]
     */
    async start(request, runOptions = {}) {
      if (request.executionRef.backend_id !== BACKEND_ID) {
        throw new ContractError("claude adapter: request is addressed to " + request.executionRef.backend_id);
      }
      if (request.executionRef.dispatch_key !== request.job_id) {
        throw new ContractError("claude adapter: dispatch_key must equal job_id");
      }
      return dispatch({ request, resuming: false, onDispatchStart: runOptions.onDispatchStart, runOptions });
    },

    /**
     * Read-only reconciliation. Never dispatches, never costs anything.
     *
     * Unlike the other backend, a missing `native_ref` is not the end of the
     * story: the reference is derivable from the dispatch key, so a launch whose
     * acknowledgement was lost can still be looked for. What a found record
     * establishes is that a dispatch happened — not that it is running.
     *
     * @param {import("./adapter.mjs").ExecutionRef} executionRef
     * @param {{workspaceRoot?:string}} [context]
     */
    async inspect(executionRef, context = {}) {
      const derived = executionRef.native_ref || deriveNativeSessionId(executionRef.dispatch_key);
      const ref = executionRef.native_ref ? executionRef : withNativeRef(executionRef, derived);
      const records = await readNativeRecords(derived, context);
      const found = Array.isArray(records) && records.length > 0;
      return bindAdapterResult({
        operation: "inspect",
        executionRef: ref,
        status: "unknown",
        dispatchAttempted: false,
        observations: {
          lookupByDispatchKey: "derived",
          derivedNativeRef: derived,
          nativeRecords: found ? records : [],
          dispatchEstablished: found,
          liveness: "unobservable",
        },
        reason: found
          ? "a local session record exists for the derived session id, so the dispatch happened; liveness is not exposed by this interface"
          : "no local session record was found for the derived session id; on a host whose records were pruned or relocated this does not prove the dispatch did not happen",
      });
    },

    /**
     * Continue an existing native session under a newly admitted Job.
     *
     * The new job's dispatch key is its own; the native reference is inherited.
     * Authority is not: the caller must already have revalidated the grant, and
     * `makeResumeRequest` refuses a resume that reuses the prior job id, which is
     * the shape a replay takes.
     *
     * @param {import("./adapter.mjs").ExecutionRef} priorRef
     * @param {import("./adapter.mjs").JobRequest} request
     */
    async resume(priorRef, request, runOptions = {}) {
      const resumeRequest = makeResumeRequest(priorRef, request);
      return dispatch({
        request: resumeRequest,
        resuming: true,
        onDispatchStart: runOptions.onDispatchStart,
        runOptions,
      });
    },

    /**
     * Ask for interruption and report exactly how far that got.
     *
     * Three distinct facts, never collapsed (Architecture §7): the request was
     * made; the local query was aborted; the provider confirmed. The third is
     * always false here — this interface returns no stop acknowledgement — so an
     * ERA run shows "Stop requested" and keeps the job's cost outstanding rather
     * than claiming a stop it cannot see.
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
          "stop is requested-only on this interface; an aborted local query does not establish that the provider stopped or that descendants exited",
      });
    },

    /**
     * Point the supervisor at the material to freeze.
     *
     * Deliberately returns no identity. The workspace root and the session record
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
        throw new ContractError("claude adapter: exportCandidate needs the confined workspace root");
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
export function newClaudeExecutionRef(job_id) {
  return makeExecutionRef({ backend_id: BACKEND_ID, dispatch_key: job_id });
}

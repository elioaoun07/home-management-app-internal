// scripts/delivery-v2/adapters/registry.mjs
// PM Delivery V2 — the one place that knows which executors exist.
//
// The supervisor is provider-neutral by construction: `admitJob` takes a
// `backend_id`, `store.jobs` has a `backend_id` column, and `dispatchJob` takes
// an adapter object. Nothing in it names a provider. What was missing was the
// step *before* that — something that turns an owner's choice into an adapter
// without any caller having to import a specific backend's module.
//
// That is all this file is. It is deliberately not a plugin system:
//
//   - The set of executors is a closed, frozen list. A backend nobody has written
//     a qualification story for cannot be added by dropping a file in a
//     directory, and there is no path where an unknown id resolves to *something*.
//   - Resolution never falls back. `resolveExecutorChoice("gpt")` returns null and
//     `createExecutor(null)` refuses; it does not quietly hand back the other
//     backend. A silent provider switch is the specific failure this file exists
//     to make impossible — the owner asked for it in exactly those words, and it
//     is also what makes a persisted selection meaningful after a restart.
//   - Adapter modules are imported lazily, so merely knowing that Claude exists
//     does not load its SDK, and pm-server's boot stays free of provider I/O.
//
// Qualification is per executor and is not derived here
// ----------------------------------------------------
// `describeExecutor` asks the adapter, and the adapter answers from *its own*
// observations. Two backends on the same host can and do land in different
// states, and one passing a control says nothing about the other. There is no
// shared "containment is fine on this machine" fact anywhere in this file, and
// there must never be one.

import { ContractError, deepFreeze } from "../contracts.mjs";
import { admitProfile, assertAdapterShape } from "./adapter.mjs";

/** Why an executor could not be resolved or used. Fixtures match on codes. */
export const EXECUTOR_REFUSALS = Object.freeze({
  UNKNOWN: "unknown-executor",
  NONE_SELECTED: "no-executor-selected",
  UNAVAILABLE: "executor-unavailable",
  NOT_PERMITTED: "executor-not-permitted-by-policy",
  MISMATCH: "executor-profile-mismatch",
});

/**
 * The closed set of executors this installation can run.
 *
 * `id` is the short name an owner picks and a URL carries; `backend_id` is the
 * canonical identity that goes into the Grant, the Job row and the executionRef.
 * They are different on purpose: the short name is a label and may be renamed,
 * the backend id is part of persisted records and may not.
 */
export const EXECUTORS = deepFreeze([
  {
    id: "codex",
    backend_id: "codex-exec-sdk",
    label: "Codex",
    sdk: "@openai/codex-sdk",
    module: "./codex.mjs",
    factory: "createCodexAdapter",
    profileDeclaration: "profiles/fast-local.json",
    qualificationProbe: "scripts/delivery-v2/probes/codex-qualification.mjs",
    summary:
      "OpenAI Codex exec/SDK under its own Windows sandbox. Confines writes and network; its read boundary is observed to fail. No monetary reading at this SDK version.",
  },
  {
    id: "claude",
    backend_id: "claude-agent-sdk",
    label: "Claude",
    sdk: "@anthropic-ai/claude-agent-sdk",
    module: "./claude.mjs",
    factory: "createClaudeAdapter",
    profileDeclaration: "profiles/claude-local.json",
    qualificationProbe: "scripts/delivery-v2/probes/claude-qualification.mjs",
    summary:
      "Anthropic Claude Agent SDK behind the harness-level canUseTool allowlist. Reports a provider cost per turn and reconciles a lost launch by a caller-minted session id; OS-level containment is unobserved on this host.",
  },
]);

/** Canonical backend ids, in declaration order. */
export const BACKEND_IDS = deepFreeze(EXECUTORS.map((entry) => entry.backend_id));

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/**
 * Turn whatever the caller has — a short id, a canonical backend id, a stored
 * selection record — into one executor entry, or null.
 *
 * Null is a real answer and the caller must handle it. There is deliberately no
 * `?? EXECUTORS[0]` anywhere: defaulting here is how an installation ends up
 * paying a provider the owner did not choose.
 *
 * @param {unknown} value
 * @returns {(typeof EXECUTORS)[number] | null}
 */
export function resolveExecutorChoice(value) {
  if (!isNonEmptyString(value)) return null;
  const wanted = String(value).trim().toLowerCase();
  return (
    EXECUTORS.find((entry) => entry.id === wanted || entry.backend_id.toLowerCase() === wanted) || null
  );
}

/**
 * The owner-facing catalogue.
 *
 * Returned as data rather than rendered anywhere, so the dashboard, a CLI and a
 * fixture all read the same list. `available` says whether this checkout can
 * actually import the SDK — a fact worth showing next to the choice, because
 * "Claude is selectable" and "Claude can run here" are different claims and the
 * owner is entitled to see both.
 *
 * @param {{isInstalled?:(entry:object)=>boolean}} [options]
 */
export function listExecutors({ isInstalled = null } = {}) {
  return deepFreeze(
    EXECUTORS.map((entry) =>
      Object.freeze({
        id: entry.id,
        backend_id: entry.backend_id,
        label: entry.label,
        sdk: entry.sdk,
        summary: entry.summary,
        profileDeclaration: entry.profileDeclaration,
        qualificationProbe: entry.qualificationProbe,
        available: isInstalled ? Boolean(isInstalled(entry)) : null,
      }),
    ),
  );
}

/**
 * Build the adapter for one executor.
 *
 * Refuses rather than falls back, in every failure mode: an unknown id, a missing
 * selection, an SDK that will not import. The refusal carries the reason so the
 * caller can put it in front of the owner instead of quietly running the other
 * provider — which is the whole contract of this function.
 *
 * The dynamic import is what keeps this lazy. Importing this module costs
 * nothing; asking it for an adapter is what loads a backend.
 *
 * @param {unknown} choice short id, backend id, or null
 * @param {Record<string, unknown>} [options] passed straight to the adapter factory
 * @returns {Promise<{ok:boolean, adapter:(object|null), executor:(object|null),
 *   refusal:({code:string, detail:unknown}|null)}>}
 */
export async function createExecutor(choice, options = {}) {
  if (choice == null || choice === "") {
    return deepFreeze({
      ok: false,
      adapter: null,
      executor: null,
      refusal: {
        code: EXECUTOR_REFUSALS.NONE_SELECTED,
        detail: "no executor is selected for this installation; choose Claude or Codex before dispatching",
      },
    });
  }
  const executor = resolveExecutorChoice(choice);
  if (!executor) {
    return deepFreeze({
      ok: false,
      adapter: null,
      executor: null,
      refusal: {
        code: EXECUTOR_REFUSALS.UNKNOWN,
        detail: String(choice) + " is not a known executor; known: " + EXECUTORS.map((e) => e.id).join(", "),
      },
    });
  }
  try {
    const backendModule = await import(executor.module);
    const factory = backendModule[executor.factory];
    if (typeof factory !== "function") {
      throw new ContractError(executor.module + " does not export " + executor.factory);
    }
    const adapter = assertAdapterShape(factory(options));
    if (adapter.backend_id !== executor.backend_id) {
      // A registry entry and an adapter disagreeing about identity would persist
      // the wrong backend_id on a job row, and reconciliation reads that column.
      throw new ContractError(
        "adapter reports backend_id " + adapter.backend_id + " but the registry entry is " + executor.backend_id,
      );
    }
    return deepFreeze({ ok: true, adapter, executor, refusal: null });
  } catch (error) {
    return deepFreeze({
      ok: false,
      adapter: null,
      executor,
      refusal: {
        code: EXECUTOR_REFUSALS.UNAVAILABLE,
        detail:
          executor.label +
          " could not be loaded (" +
          String((error && error.message) || error) +
          "); it is not substituted by another executor",
      },
    });
  }
}

/**
 * Ask one executor to describe itself, without instantiating an adapter.
 *
 * `describeProfile` is a module-level export on every adapter precisely so a
 * profile can be read without constructing anything or touching an SDK. That
 * matters for the dashboard, which wants to show both executors' qualification
 * state on a page that must not launch anything.
 *
 * @param {unknown} choice
 * @param {{observations?:(object|null), runtime?:object, qualification_ref?:(string|null),
 *   observed_at?:(string|null)}} [input]
 */
export async function describeExecutor(choice, input = {}) {
  const executor = resolveExecutorChoice(choice);
  if (!executor) {
    return deepFreeze({
      ok: false,
      profile: null,
      executor: null,
      refusal: { code: EXECUTOR_REFUSALS.UNKNOWN, detail: String(choice) },
    });
  }
  try {
    const backendModule = await import(executor.module);
    if (typeof backendModule.describeProfile !== "function") {
      throw new ContractError(executor.module + " does not export describeProfile");
    }
    return deepFreeze({ ok: true, profile: backendModule.describeProfile(input), executor, refusal: null });
  } catch (error) {
    return deepFreeze({
      ok: false,
      profile: null,
      executor,
      refusal: {
        code: EXECUTOR_REFUSALS.UNAVAILABLE,
        detail: String((error && error.message) || error),
      },
    });
  }
}

/**
 * Admit one executor's profile for a paid dispatch.
 *
 * A thin pass-through to `admitProfile`, and it stays thin on purpose: the
 * admission rules live in the canonical contract, not per backend, and this
 * function exists only so callers do not have to remember to carry `backend_id`
 * alongside the admission. It is that pairing `admitJob` checks — a profile
 * admitted for one backend cannot authorize a dispatch to the other.
 *
 * @param {ReturnType<import("./adapter.mjs").finalizeProfile>} profile
 * @param {{strictBoundRequired?:boolean, requireConfinement?:boolean}} [need]
 */
export function admitExecutorProfile(profile, need = {}) {
  const admission = admitProfile(profile, need);
  return deepFreeze({ ...admission, backend_id: profile.backend_id });
}

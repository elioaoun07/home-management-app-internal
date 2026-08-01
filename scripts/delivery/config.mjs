// scripts/delivery/config.mjs
// `.delivery/config.json` loader + defaults + validation.
// See ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md (DW-1, retired prefix) and
// AgenticIdeas.MD's "no hardcoded price table" guidance — model catalogs and
// prices live only in this owner-edited file, never in source. The file is
// optional: when absent, `loadConfig` returns built-in defaults that keep
// today's behavior (no model/pricing catalog, today's per-phase effort
// routing). Neither pm-server nor the runner ever write this file — it is
// hand-maintained, matching the single-writer discipline documented in
// Delivery/Delivery — Master Book.md.

import { join } from "node:path";
import { atomicWriteJsonSync, readJsonIfExists } from "./fsx.mjs";

export class ConfigError extends Error {}

export const SCHEMA_VERSION = 1;

/** @typedef {{inPerMTok:number, cachedReadPerMTok:number, cacheWritePerMTok:number, outPerMTok:number}} ModelPricing */
/** @typedef {{id:string, label?:string, contextWindow?:number, pricing?:ModelPricing}} ModelEntry */
/** @typedef {{defaultModel:(string|null), efforts:string[], models:ModelEntry[]}} ProviderConfig */
/**
 * The resolved delivery config — owner `.delivery/config.json` deep-merged over
 * `DEFAULT_CONFIG`, so it always has the full default shape. Derived from the
 * defaults object rather than restated by hand, which keeps it correct as
 * sections are added (`loadConfig` previously returned a bare `object`, so every
 * consumer that read `.providers` / `.budgets` off it type-errored).
 * @typedef {typeof DEFAULT_CONFIG} DeliveryConfig
 */

export const DEFAULT_CONFIG = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  pricingVersion: null,
  providers: Object.freeze({
    claude: Object.freeze({
      defaultModel: null,
      efforts: Object.freeze(["low", "medium", "high", "xhigh", "max"]),
      models: Object.freeze([]),
    }),
    codex: Object.freeze({
      defaultModel: null,
      efforts: Object.freeze(["minimal", "low", "medium", "high", "xhigh"]),
      models: Object.freeze([]),
    }),
  }),
  effortMap: Object.freeze({
    claudeToCodex: Object.freeze({ low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "xhigh" }),
    codexToClaude: Object.freeze({ minimal: "low", low: "low", medium: "medium", high: "high", xhigh: "xhigh" }),
  }),
  // Matches today's DEFAULT_AGENT_CONFIG.effort in packet.mjs — this is the
  // config-owned equivalent, kept in sync deliberately (see DW-2).
  routing: Object.freeze({
    discovery: Object.freeze({ effort: "medium" }),
    plan: Object.freeze({ effort: "high" }),
    building: Object.freeze({ effort: "high" }),
    review: Object.freeze({ effort: "medium" }),
  }),
  context: Object.freeze({
    rotateAtTokens: 150000,
    hardCeilingPct: 0.85,
    recentTailTurns: 3,
    digestMode: "mechanical",
    forkAfterPhaseRetries: 2,
    // DLV-8: per-lane, per-phase budgets for the *mandated reading list* the
    // runner hands a turn (campaign docs + skills + the doctrine pointer).
    // `null` on any phase means "no budget" and keeps today's behaviour, which
    // is why STANDARD/DEEP are null throughout: a lane that exists to be
    // thorough should not be silently thinned. FAST is budgeted because that is
    // what FAST is for — and the numbers come from the measurement in DLV-45,
    // where DISCOVERY's mandated reading alone was ~33,151 tokens before the
    // agent could look at the one line it was asked to change.
    laneBudgets: Object.freeze({
      // DLV-73: INSTANT is tighter than FAST on the same principle. FAST's numbers
      // came from DLV-45, where DISCOVERY's mandated reading alone was ~33,151
      // tokens before the agent could look at the one line it was asked to change.
      // INSTANT arrives with that line already located, so it needs less still.
      instant: Object.freeze({ discovery: 6_000, plan: 6_000, building: 8_000, review: 4_000 }),
      fast: Object.freeze({ discovery: 12_000, plan: 8_000, building: 12_000, review: 8_000 }),
      standard: Object.freeze({ discovery: null, plan: null, building: null, review: null }),
      deep: Object.freeze({ discovery: null, plan: null, building: null, review: null }),
    }),
    // Bound on replayed tool output the runner itself injects (today: the prior
    // validation excerpt on a fix-loop BUILDING turn). Unbounded, a 48-error
    // typecheck dump is re-sent on every internal turn that follows it.
    maxReplayedOutputChars: 8000,
  }),
  transcript: Object.freeze({
    maxRecordBytes: 65536,
    warnSessionMB: 200,
  }),
  errors: Object.freeze({
    maxAutoRetries: 2,
    extraQuotaPatterns: Object.freeze([]),
  }),
  // D10/DLV-11: risk-based validation ladder — which validation commands
  // (VALIDATION_COMMANDS in run-session.mjs) actually run for a given lane,
  // and whether the "test" rung runs the full suite or a targeted subset
  // (`vitest related <changed files>`, via --passWithNoTests so a docs-only
  // change with zero related tests still passes rather than reads as a
  // failure). A rung not in a lane's `rungs` list is never silently absent —
  // `runValidationCommands` records it as an explicit `skipped: true` result,
  // and `renderValidationReportMd` labels it SKIPPED, distinct from PASS/FAIL,
  // so an agent's own free-text build-log narrative can never contradict the
  // runner's own record the way it did in the whdv postmortem ("lint
  // (skipped)" under a "✅ COMPLETED" claim, with no governed trace of why).
  // STANDARD/DEEP keep today's unconditional full ladder; FAST is the only
  // lane that actually trades rigor for speed, and only for lint + full-suite
  // test — typecheck always runs in every lane, it is cheap and correctness-
  // critical enough that skipping it is never worth the saved time.
  validation: Object.freeze({
    laneLadder: Object.freeze({
      // DLV-73: INSTANT keeps FAST's ladder exactly. Validation costs no model
      // tokens — it spawns `pnpm typecheck` / a targeted `vitest related` — so
      // thinning it would buy nothing and give up the only automated correctness
      // check the lane has left once REVIEWING is discharged deterministically.
      instant: Object.freeze({ rungs: Object.freeze(["typecheck", "test"]), targetedTest: true }),
      fast: Object.freeze({ rungs: Object.freeze(["typecheck", "test"]), targetedTest: true }),
      standard: Object.freeze({ rungs: Object.freeze(["typecheck", "lint", "test"]), targetedTest: false }),
      deep: Object.freeze({ rungs: Object.freeze(["typecheck", "lint", "test"]), targetedTest: false }),
    }),
  }),
  // DLV-7: the scope contract. `thresholds` turn the spec's own *measured*
  // scope estimate into a size class the runner computes (never one the agent
  // asserts about itself), so a packet whose owner-declared effort is S can be
  // caught the moment DISCOVERY measures an L-sized change — the tripwire BUD-11
  // never had, where an S "verify" item became a 25-file / 72-occurrence program
  // at SPEC time with nothing objecting.
  //
  // Read as upper bounds, inclusive: a change is S while it stays within S's
  // limits on EVERY axis, M while within M's, otherwise L. Sized off the two
  // real sessions on record — BUD-14 (1 file, 1 occurrence, 1 module) is
  // unambiguously S; BUD-11's measured 25 files / 72 occurrences is
  // unambiguously L.
  scope: Object.freeze({
    thresholds: Object.freeze({
      S: Object.freeze({ files: 2, occurrences: 5, modules: 1 }),
      M: Object.freeze({ files: 8, occurrences: 25, modules: 3 }),
    }),
    // Advisory by default, exactly like maxPlanSteps: a mismatch renders a
    // decomposition proposal at the SPEC gate where the owner can act on it for
    // free, but never hard-blocks — a legitimately large item wrongly filed as S
    // should cost one acknowledgment, not a stranded session.
    requireAcknowledgment: true,
  }),
  // DLV-62: the pipeline's *shape*, as distinct from its cost dials.
  //
  // FAST changes five dials — model, per-phase effort, budget cap, context
  // reading list, validation ladder — and changes nothing about the shape: a
  // one-line change carries the same three always-on capabilities and the same
  // three approval gates a DEEP multi-file refactor does. For BUD-14 the
  // pipeline *was* the cost: $0.5302 across four turns produced a spec and a
  // rejected plan and zero lines of code.
  //
  // The owner's decision (2026-07-30) was options (a)+(b): keep DLV-59's triage
  // gate refusing trivial items entry, and on FAST merge DISCOVERY and PLAN
  // into ONE turn when the item names a single file. Option (c) — collapsing
  // the SPEC and PLAN approvals into one — was NOT authorized, because it is
  // the one option the standing "3 gates always" rule forbids without amending
  // that rule in writing.
  //
  // So: **all three gates still fire, in every lane, always.** This halves the
  // *traversals* (two full-context turns become one), never the oversight. The
  // single-file condition is the safety rail: a change confined to one file the
  // item itself names is one whose spec and plan cannot meaningfully diverge.
  //
  // DLV-73 adds the INSTANT lane, which takes the same argument one step further.
  // FAST still runs five phase traversals for a one-line edit; INSTANT runs two,
  // and discharges REVIEWING and UAT_PREP from the diff instead of from a model
  // turn. The owner's decision (2026-08-01) authorized two scoped amendments,
  // both recorded in the Delivery Master Book rather than assumed here:
  //   (a) the merged spec+plan artifact may be approved by one owner action that
  //       writes BOTH gate decisions — three gates are still recorded, but there
  //       are two review moments rather than three, because the second gate's
  //       artifact *is* the first gate's artifact;
  //   (b) `code-review` and `uat-generation` stay locked always-on rows, but on
  //       INSTANT they are discharged by a deterministic assertion against the
  //       declared edit, which escalates back to the real model turns the moment
  //       the diff is anything other than what the approved plan described.
  pipeline: Object.freeze({
    mergeDiscoveryPlanOnFastSingleFile: true,
    mergeDiscoveryPlanAlwaysOnInstant: true,
    // The ceiling the deterministic review asserts against. A diff larger than
    // this is, by definition, not the "one-line edit" INSTANT was authorized for,
    // so it escalates to the full REVIEWING + UAT_PREP turns rather than being
    // waved through. Sized to leave room for an import line and a formatting
    // reflow around a single-value change, and nothing more.
    instantMaxDiffLines: 20,
  }),
  budgets: Object.freeze({
    // maxInternalTurns (D9/DLV-6) caps the SDK's own `Options.maxTurns` — the
    // number of internal assistant<->tool round-trips *one* `query()` call may
    // take before the SDK ends it itself. Without a cap this is unbounded, which
    // is how a single BUILDING runner-turn silently became ~40 model calls
    // (Cost Anatomy §5). Advisory defaults, tunable per lane in this file —
    // FAST is deliberately tight (a trivial change should not need 20+ internal
    // round-trips), DEEP deliberately loose (a real multi-file build needs room
    // to edit/test/re-edit without hitting the ceiling mid-fix).
    // DLV-45: FAST was 8, and that number was set against a DISCOVERY prompt
    // whose own mandated reading list (4 campaign docs + every attached skill +
    // CLAUDE.md) already cost ~8 tool calls before any real work — so the lane
    // could not finish its first phase. Measured on the s-20260729-121840-pdhx
    // forensics: the phase needed 13 tool calls, of which 7 were ceremony now
    // dropped for this lane (see run-session.mjs's phaseContextPolicy), leaving
    // ~6 for the actual work. 12 keeps FAST meaningfully tighter than STANDARD's
    // 20 while giving the worst phase ~2x headroom instead of a guaranteed
    // ceiling hit — and a ceiling hit is now a clean owner decision rather than
    // a crash loop (DLV-44), so this is a cost/latency knob again, not a
    // correctness cliff.
    laneDefaults: Object.freeze({
      // DLV-73: INSTANT forecasts two turns (~$0.07 each at economy against a
      // pre-located 120-line read window), so $0.25 leaves headroom for one fix
      // loop and parks before a third. 8 internal turns is FAST's 12 minus the
      // ceremony INSTANT no longer performs — the file is already located, so the
      // turn opens with a bounded Read rather than a search. Both numbers are
      // launch-time estimates: once three INSTANT sessions complete,
      // `estPhaseUsage` switches to their measured medians and these should be
      // re-tuned against what actually happened rather than against this comment.
      instant: Object.freeze({ maxUsd: 0.25, maxTokens: 250_000, warnPct: 0.8, maxInternalTurns: 8 }),
      fast: Object.freeze({ maxUsd: 0.5, maxTokens: 500_000, warnPct: 0.8, maxInternalTurns: 12 }),
      standard: Object.freeze({ maxUsd: 2, maxTokens: 2_000_000, warnPct: 0.8, maxInternalTurns: 20 }),
      deep: Object.freeze({ maxUsd: 5, maxTokens: 5_000_000, warnPct: 0.8, maxInternalTurns: 40 }),
    }),
    warnSessionUsd: 10,
    maxTurnBudgetUsd: null,
    // Token budgets are primary — Claude Code subscription sessions have no
    // real per-token USD meter, so `maxSessionUsd` only bites when the owner
    // has populated real pricing in the model catalog (see DW-2 gap).
    // Defaults sized off the BUD-11 forensics: that session's actual spend
    // was ~3M processed tokens (1,434 input + 2,991,876 cached + 43,447
    // output) for a task that should have needed a small fraction of that.
    warnSessionTokens: 1_500_000,
    maxSessionTokens: 4_000_000,
    maxSessionUsd: null,
    // DISCOVERY is the one phase with no existing turn-count backstop
    // (BUILDING/REVIEWING already cap via maxFixLoops; PLAN/UAT are
    // single-shot) — repeated question-raised round-trips could otherwise
    // re-enter it indefinitely.
    maxTurnsPerPhase: Object.freeze({ discovery: 6 }),
    // A plan that decomposes a small task into many trivial steps multiplies
    // full-context turn establishes for no benefit (BUD-11: 10 build steps
    // for what amounted to one test file). Advisory only — see PLAN_READY
    // handling in run-session.mjs.
    maxPlanSteps: 5,
    // Default per-command hard bound for the validation baseline (SELECTED)
    // and the post-build validation run (VALIDATING) before a command is
    // killed and recorded `timedOut`. This is only the FALLBACK — commands
    // with a known-long real cost carry their own `timeoutMs` in
    // VALIDATION_COMMANDS (run-session.mjs): lint 900s (~11 min measured on
    // this repo), test 600s. 240s here effectively bounds typecheck.
    // Validation runs async so the heartbeat is unaffected regardless.
    validationTimeoutMs: 240_000,
  }),
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** Recursive merge; plain objects merge key-by-key, everything else (incl. arrays) is replaced wholesale by `override`. */
function mergeDeep(base, override) {
  if (override === undefined) return base;
  if (!isPlainObject(override) || !isPlainObject(base)) return override;
  const out = { ...base };
  for (const key of Object.keys(override)) {
    out[key] = mergeDeep(base[key], override[key]);
  }
  return out;
}

const ROOT_KEYS = new Set(["schemaVersion", "pricingVersion", "providers", "effortMap", "routing", "context", "transcript", "errors", "budgets", "validation", "scope", "pipeline"]);
const PIPELINE_KEYS = new Set([
  "mergeDiscoveryPlanOnFastSingleFile",
  "mergeDiscoveryPlanAlwaysOnInstant",
  "instantMaxDiffLines",
]);
const CONTEXT_KEYS = new Set([
  "rotateAtTokens",
  "hardCeilingPct",
  "recentTailTurns",
  "digestMode",
  "forkAfterPhaseRetries",
  "laneBudgets",
  "maxReplayedOutputChars",
]);
const CONTEXT_PHASE_KEYS = new Set(["discovery", "plan", "building", "review"]);
const SCOPE_KEYS = new Set(["thresholds", "requireAcknowledgment"]);
const SCOPE_CLASS_KEYS = new Set(["S", "M"]);
const SCOPE_AXIS_KEYS = new Set(["files", "occurrences", "modules"]);
// Mirrors run-session.mjs's VALIDATION_COMMANDS keys. Duplicated rather than
// imported — config.mjs must stay import-free of run-session.mjs, which
// already imports config.mjs (would-be circular), and this vocabulary is
// small and stable enough that duplication is cheaper than a shared module.
const VALIDATION_RUNG_KEYS = new Set(["typecheck", "lint", "test"]);
const VALIDATION_LANES = new Set(["instant", "fast", "standard", "deep"]);
const VALIDATION_LANE_KEYS = new Set(["rungs", "targetedTest"]);
const PROVIDER_KEYS = new Set(["defaultModel", "efforts", "models"]);
const MODEL_KEYS = new Set(["id", "label", "tier", "contextWindow", "pricing"]);
const PRICING_KEYS = new Set(["inPerMTok", "cachedReadPerMTok", "cacheWritePerMTok", "outPerMTok"]);
const BUDGET_KEYS = new Set([
  "laneDefaults",
  "warnSessionUsd",
  "maxTurnBudgetUsd",
  "warnSessionTokens",
  "maxSessionTokens",
  "maxSessionUsd",
  "maxTurnsPerPhase",
  "maxPlanSteps",
  "validationTimeoutMs",
]);
const BUDGET_LANES = new Set(["instant", "fast", "standard", "deep"]);
const BUDGET_ENVELOPE_KEYS = new Set(["maxUsd", "maxTokens", "warnPct", "maxInternalTurns"]);

function validationError(path, message) {
  return new ConfigError(`invalid .delivery/config.json at ${path}: ${message}`);
}

function assertPlainObject(value, path) {
  if (!isPlainObject(value)) throw validationError(path, "must be an object");
}

function assertKnownKeys(value, keys, path) {
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) throw validationError(`${path}.${key}`, "is not a supported setting");
  }
}

function assertOptionalString(value, path, { nullable = false } = {}) {
  if (value !== undefined && typeof value !== "string" && !(nullable && value === null)) {
    throw validationError(path, nullable ? "must be a string or null" : "must be a string");
  }
}

function assertOptionalNumber(value, path, { nullable = false, integer = false } = {}) {
  if (value === undefined || (nullable && value === null)) return;
  if (typeof value !== "number" || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw validationError(path, nullable ? "must be a finite number or null" : "must be a finite number");
  }
}

/** Validate the owner-editable partial config before it is merged with defaults. */
export function validateConfig(raw) {
  assertPlainObject(raw, "$");
  assertKnownKeys(raw, ROOT_KEYS, "$");
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== SCHEMA_VERSION) {
    throw new ConfigError(`unsupported .delivery/config.json schemaVersion ${raw.schemaVersion} (expected ${SCHEMA_VERSION})`);
  }
  assertOptionalString(raw.pricingVersion, "$.pricingVersion", { nullable: true });

  if (raw.providers !== undefined) {
    assertPlainObject(raw.providers, "$.providers");
    for (const [provider, config] of Object.entries(raw.providers)) {
      if (!(provider in DEFAULT_CONFIG.providers)) throw validationError(`$.providers.${provider}`, "is not a supported provider");
      assertPlainObject(config, `$.providers.${provider}`);
      assertKnownKeys(config, PROVIDER_KEYS, `$.providers.${provider}`);
      assertOptionalString(config.defaultModel, `$.providers.${provider}.defaultModel`, { nullable: true });
      if (config.efforts !== undefined && (!Array.isArray(config.efforts) || config.efforts.some((v) => typeof v !== "string" || !v))) {
        throw validationError(`$.providers.${provider}.efforts`, "must be an array of non-empty strings");
      }
      if (config.models !== undefined) {
        if (!Array.isArray(config.models)) throw validationError(`$.providers.${provider}.models`, "must be an array");
        for (const [index, model] of config.models.entries()) {
          const path = `$.providers.${provider}.models[${index}]`;
          assertPlainObject(model, path); assertKnownKeys(model, MODEL_KEYS, path);
          if (typeof model.id !== "string" || !model.id) throw validationError(`${path}.id`, "is required and must be a non-empty string");
          assertOptionalString(model.label, `${path}.label`); assertOptionalString(model.tier, `${path}.tier`);
          assertOptionalNumber(model.contextWindow, `${path}.contextWindow`, { integer: true });
          if (model.pricing !== undefined) {
            assertPlainObject(model.pricing, `${path}.pricing`); assertKnownKeys(model.pricing, PRICING_KEYS, `${path}.pricing`);
            for (const key of PRICING_KEYS) assertOptionalNumber(model.pricing[key], `${path}.pricing.${key}`);
          }
        }
      }
    }
  }
  for (const section of ["effortMap", "routing", "context", "transcript", "budgets", "validation", "scope", "pipeline"]) {
    if (raw[section] !== undefined) assertPlainObject(raw[section], `$.${section}`);
  }
  if (raw.pipeline !== undefined) {
    assertKnownKeys(raw.pipeline, PIPELINE_KEYS, "$.pipeline");
    for (const key of ["mergeDiscoveryPlanOnFastSingleFile", "mergeDiscoveryPlanAlwaysOnInstant"]) {
      if (raw.pipeline[key] !== undefined && typeof raw.pipeline[key] !== "boolean") {
        throw validationError(`$.pipeline.${key}`, "must be a boolean");
      }
    }
    assertOptionalNumber(raw.pipeline.instantMaxDiffLines, "$.pipeline.instantMaxDiffLines", { integer: true });
    if (raw.pipeline.instantMaxDiffLines !== undefined && raw.pipeline.instantMaxDiffLines <= 0) {
      throw validationError("$.pipeline.instantMaxDiffLines", "must be positive");
    }
  }
  if (raw.context !== undefined) {
    assertKnownKeys(raw.context, CONTEXT_KEYS, "$.context");
    assertOptionalNumber(raw.context.maxReplayedOutputChars, "$.context.maxReplayedOutputChars", { integer: true });
    if (raw.context.laneBudgets !== undefined) {
      assertPlainObject(raw.context.laneBudgets, "$.context.laneBudgets");
      assertKnownKeys(raw.context.laneBudgets, BUDGET_LANES, "$.context.laneBudgets");
      for (const [lane, phases] of Object.entries(raw.context.laneBudgets)) {
        const path = `$.context.laneBudgets.${lane}`;
        assertPlainObject(phases, path);
        assertKnownKeys(phases, CONTEXT_PHASE_KEYS, path);
        for (const phase of CONTEXT_PHASE_KEYS) {
          assertOptionalNumber(phases[phase], `${path}.${phase}`, { nullable: true, integer: true });
          if (phases[phase] != null && phases[phase] <= 0) throw validationError(`${path}.${phase}`, "must be positive or null");
        }
      }
    }
  }
  if (raw.scope !== undefined) {
    assertKnownKeys(raw.scope, SCOPE_KEYS, "$.scope");
    if (raw.scope.requireAcknowledgment !== undefined && typeof raw.scope.requireAcknowledgment !== "boolean") {
      throw validationError("$.scope.requireAcknowledgment", "must be a boolean");
    }
    if (raw.scope.thresholds !== undefined) {
      assertPlainObject(raw.scope.thresholds, "$.scope.thresholds");
      assertKnownKeys(raw.scope.thresholds, SCOPE_CLASS_KEYS, "$.scope.thresholds");
      for (const [sizeClass, limits] of Object.entries(raw.scope.thresholds)) {
        const path = `$.scope.thresholds.${sizeClass}`;
        assertPlainObject(limits, path);
        assertKnownKeys(limits, SCOPE_AXIS_KEYS, path);
        for (const axis of SCOPE_AXIS_KEYS) {
          assertOptionalNumber(limits[axis], `${path}.${axis}`, { integer: true });
          if (limits[axis] != null && limits[axis] <= 0) throw validationError(`${path}.${axis}`, "must be positive");
        }
      }
    }
  }
  if (raw.validation !== undefined) {
    assertKnownKeys(raw.validation, new Set(["laneLadder"]), "$.validation");
    if (raw.validation.laneLadder !== undefined) {
      assertPlainObject(raw.validation.laneLadder, "$.validation.laneLadder");
      assertKnownKeys(raw.validation.laneLadder, VALIDATION_LANES, "$.validation.laneLadder");
      for (const [lane, ladder] of Object.entries(raw.validation.laneLadder)) {
        const path = `$.validation.laneLadder.${lane}`;
        assertPlainObject(ladder, path);
        assertKnownKeys(ladder, VALIDATION_LANE_KEYS, path);
        if (ladder.rungs !== undefined) {
          if (!Array.isArray(ladder.rungs) || ladder.rungs.length === 0) {
            throw validationError(`${path}.rungs`, "must be a non-empty array");
          }
          for (const [index, rung] of ladder.rungs.entries()) {
            if (!VALIDATION_RUNG_KEYS.has(rung)) {
              throw validationError(`${path}.rungs[${index}]`, `must be one of ${[...VALIDATION_RUNG_KEYS].join(", ")}`);
            }
          }
        }
        if (ladder.targetedTest !== undefined && typeof ladder.targetedTest !== "boolean") {
          throw validationError(`${path}.targetedTest`, "must be a boolean");
        }
      }
    }
  }
  if (raw.budgets !== undefined) {
    assertKnownKeys(raw.budgets, BUDGET_KEYS, "$.budgets");
    if (raw.budgets.laneDefaults !== undefined) {
      assertPlainObject(raw.budgets.laneDefaults, "$.budgets.laneDefaults");
      assertKnownKeys(raw.budgets.laneDefaults, BUDGET_LANES, "$.budgets.laneDefaults");
      for (const [lane, envelope] of Object.entries(raw.budgets.laneDefaults)) {
        const path = `$.budgets.laneDefaults.${lane}`;
        assertPlainObject(envelope, path);
        assertKnownKeys(envelope, BUDGET_ENVELOPE_KEYS, path);
        assertOptionalNumber(envelope.maxUsd, `${path}.maxUsd`, { nullable: true });
        assertOptionalNumber(envelope.maxTokens, `${path}.maxTokens`, { nullable: true, integer: true });
        assertOptionalNumber(envelope.warnPct, `${path}.warnPct`);
        assertOptionalNumber(envelope.maxInternalTurns, `${path}.maxInternalTurns`, { nullable: true, integer: true });
        if (envelope.maxUsd != null && envelope.maxUsd <= 0) throw validationError(`${path}.maxUsd`, "must be positive");
        if (envelope.maxTokens != null && envelope.maxTokens <= 0) throw validationError(`${path}.maxTokens`, "must be positive");
        if (envelope.warnPct != null && (envelope.warnPct <= 0 || envelope.warnPct >= 1)) {
          throw validationError(`${path}.warnPct`, "must be greater than 0 and less than 1");
        }
        if (envelope.maxInternalTurns != null && envelope.maxInternalTurns <= 0) {
          throw validationError(`${path}.maxInternalTurns`, "must be positive");
        }
      }
    }
  }
  if (raw.errors !== undefined) {
    assertPlainObject(raw.errors, "$.errors");
    assertKnownKeys(raw.errors, new Set(["maxAutoRetries", "extraQuotaPatterns"]), "$.errors");
    assertOptionalNumber(raw.errors.maxAutoRetries, "$.errors.maxAutoRetries", { integer: true });
    if (raw.errors.maxAutoRetries !== undefined && raw.errors.maxAutoRetries < 0) throw validationError("$.errors.maxAutoRetries", "must be zero or greater");
    if (raw.errors.extraQuotaPatterns !== undefined) {
      if (!Array.isArray(raw.errors.extraQuotaPatterns) || raw.errors.extraQuotaPatterns.some((value) => typeof value !== "string" || !value)) throw validationError("$.errors.extraQuotaPatterns", "must be an array of non-empty regular-expression strings");
      for (const [index, source] of raw.errors.extraQuotaPatterns.entries()) {
        try { new RegExp(source, "i"); } catch { throw validationError(`$.errors.extraQuotaPatterns[${index}]`, "must be a valid regular expression"); }
      }
    }
  }
  return raw;
}

const configStatuses = new WeakMap();

function withConfigStatus(config, status) {
  configStatuses.set(config, Object.freeze(status));
  return config;
}

/** Read the process-local health metadata carried by loadConfig's return value. */
export function getConfigStatus(config) {
  return (config && configStatuses.get(config)) || { healthy: true, source: "defaults", message: null };
}

/**
 * Load `.delivery/config.json` from under `rootDir`, deep-merged over
 * `DEFAULT_CONFIG` (owner values win; missing sections/keys fall back to
 * defaults). Returns `DEFAULT_CONFIG` unchanged when the file is absent.
 * @param {string} rootDir
 * @param {{configPath?:string, fs?:object}} [options]
 * @returns {DeliveryConfig}
 */
export function loadConfig(rootDir, options = {}) {
  const path = options.configPath || join(rootDir, ".delivery", "config.json");
  const snapshotPath = options.snapshotPath || join(rootDir, ".delivery", "config.last-known-good.json");
  const persistSnapshot = options.persistSnapshot !== undefined ? options.persistSnapshot : !options.fs;
  let raw;
  try {
    raw = readJsonIfExists(path, options);
    if (raw == null) return withConfigStatus(DEFAULT_CONFIG, { healthy: true, source: "defaults", message: null });
    validateConfig(raw);
    if (persistSnapshot) atomicWriteJsonSync(snapshotPath, raw, options);
    return withConfigStatus(mergeDeep(DEFAULT_CONFIG, raw), { healthy: true, source: "config", message: null });
  } catch (err) {
    const message = String((err && err.message) || err);
    try {
      const snapshot = readJsonIfExists(snapshotPath, options);
      if (snapshot != null) {
        validateConfig(snapshot);
        return withConfigStatus(mergeDeep(DEFAULT_CONFIG, snapshot), { healthy: false, source: "last-known-good", message });
      }
    } catch {
      // A damaged snapshot is not a reason to crash the runner; defaults remain safe.
    }
    return withConfigStatus(DEFAULT_CONFIG, { healthy: false, source: "defaults", message });
  }
}

// ---- lookup helpers ----

/** @returns {ProviderConfig} */
export function getProviderConfig(config, provider) {
  const p = config && config.providers && config.providers[provider];
  if (!p) throw new ConfigError(`unknown provider "${provider}"`);
  return p;
}

export function isKnownModel(config, provider, modelId) {
  return getProviderConfig(config, provider).models.some((m) => m.id === modelId);
}

export function isKnownEffort(config, provider, effort) {
  return getProviderConfig(config, provider).efforts.includes(effort);
}

/** @returns {ModelEntry|null} */
export function getModelInfo(config, provider, modelId) {
  return getProviderConfig(config, provider).models.find((m) => m.id === modelId) || null;
}

/** @returns {ModelPricing|null} */
export function getModelPricing(config, provider, modelId) {
  const model = getModelInfo(config, provider, modelId);
  return (model && model.pricing) || null;
}

export function getDefaultModel(config, provider) {
  return getProviderConfig(config, provider).defaultModel || null;
}

/** Default effort for a phase from `config.routing`, or `null` if unset. */
export function getRoutingEffort(config, phase) {
  const routing = (config && config.routing) || {};
  return (routing[phase] && routing[phase].effort) || null;
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Translate an effort level from one provider's enum to another's via
 * `config.effortMap.<from>To<To>`. Same provider → identity. Unmapped effort
 * → passed through unchanged (better an odd value surfaces than a silent
 * drop; the launch/config-change validators catch truly invalid values).
 */
export function translateEffort(config, fromProvider, toProvider, effort) {
  if (fromProvider === toProvider) return effort;
  const mapKey = `${fromProvider}To${capitalize(toProvider)}`;
  const map = (config && config.effortMap && config.effortMap[mapKey]) || {};
  return map[effort] || effort;
}

/**
 * Shape the `GET /api/delivery/capabilities` payload: per-provider driver
 * manifest (pure data from each driver, keyed by provider) merged with the
 * owner's model/pricing catalog, plus the shared routing/context/budget
 * config. `driverManifests` is `{claude: manifest(), codex: manifest()}`.
 */
export function buildCapabilitiesPayload(config, driverManifests = {}) {
  const providers = {};
  for (const provider of Object.keys((config && config.providers) || {})) {
    const cfg = config.providers[provider];
    providers[provider] = {
      manifest: driverManifests[provider] || null,
      models: cfg.models || [],
      defaultModel: cfg.defaultModel || null,
      efforts: cfg.efforts || [],
    };
  }
  return {
    providers,
    config: {
      routing: config.routing,
      context: config.context,
      errors: config.errors,
      budgets: config.budgets,
      pricingVersion: config.pricingVersion || null,
      status: getConfigStatus(config),
    },
  };
}

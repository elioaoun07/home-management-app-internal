// scripts/delivery/recommendation.mjs
// Model/effort recommendation engine (Slice D). Pure functions only — the
// caller (server route, mid-session advisory trigger) decides what to do
// with the result. Never applied automatically: launch always requires the
// owner's explicit selection (the recommendation only pre-fills it), and
// mid-session it is surfaced as an advisory question, never a silent
// override (see run-session.mjs's `recommendation.updated` event).
//
// Complexity scoring is deliberately narrow — it only uses signals that
// actually exist on a packet-shaped item today (checklist effort S/M/L,
// severity, the classifier's `money-domain` capability, and a static
// junction-campaign list). The plan's "db-migration"/"security" risk flags
// have no corresponding classifier capability yet (see classify.mjs) and are
// intentionally not scored until one exists — scoring a flag that can never
// fire would be dead code.

import { estimateCostUsd } from "./usage.mjs";
import { getModelInfo, getModelPricing, getProviderConfig } from "./config.mjs";

export const TIERS = Object.freeze(["economy", "standard", "premium"]);
export const DELIVERY_LANES = Object.freeze(["INSTANT", "FAST", "STANDARD", "DEEP"]);

const EFFORT_SCORE_BY_LETTER = Object.freeze({ S: 0, M: 1, L: 2 });
const LANE_BY_TIER = Object.freeze({
  economy: "FAST",
  standard: "STANDARD",
  premium: "DEEP",
});
const TIER_RANK = Object.freeze({ economy: 0, standard: 1, premium: 2 });
const BROAD_SCOPE_GLOB_THRESHOLD = 4;

// Campaigns that bridge multiple standalone modules (CLAUDE.md's Junction
// Modules table) — cross-module cascades tend to need more plan/build care.
const JUNCTION_CAMPAIGNS = Object.freeze(["Hub & ERA", "Notifications & Alerts", "Trips"]);

// DLV-57: economy's `plan` was `medium`, and on a one-line string replacement
// that PLAN turn cost **$0.1857** — more than the DISCOVERY turn that had to
// actually locate the code, and more than the whole session's $0.175 forecast.
// The economy tier exists for work the classifier scored at complexity 0; a
// phase that only has to say "edit this line" does not need medium reasoning.
// `building` stays `medium`: it is the phase that writes the code, and buying
// reasoning there is the difference between a correct edit and a plausible one.
// STANDARD/DEEP keep medium/high — they exist precisely for when you want it.
const EFFORT_BY_TIER = Object.freeze({
  economy: Object.freeze({ discovery: "low", plan: "low", building: "medium", review: "low" }),
  standard: Object.freeze({ discovery: "medium", plan: "high", building: "medium", review: "medium" }),
  premium: Object.freeze({ discovery: "high", plan: "high", building: "high", review: "medium" }),
});

// Static per-tier usage-shape fallback, used until >=3 same-tier completed
// sessions exist to derive a real median from. Shaped off the BUD-11
// forensics (cached-context-establish reads dominate total volume) — these
// are estimates, not measurements, and are always labeled "est." in the UI.
const STATIC_USAGE_BY_TIER = Object.freeze({
  economy: Object.freeze({ input: 20_000, cachedRead: 350_000, cacheCreation: 10_000, output: 20_000 }),
  standard: Object.freeze({ input: 40_000, cachedRead: 800_000, cacheCreation: 20_000, output: 40_000 }),
  premium: Object.freeze({ input: 80_000, cachedRead: 1_600_000, cacheCreation: 40_000, output: 80_000 }),
});

// ---- DLV-56: per-phase-traversal forecasting ----
//
// The problem with `STATIC_USAGE_BY_TIER` is not that its numbers were wrong.
// It is that it models the wrong *unit*: one shape per **session**, when real
// spend is incurred per **phase traversal**. A session that runs DISCOVERY,
// PLAN, then five BUILDING steps costs roughly seven traversals, and no amount
// of better per-session priors can express that — which is why DLV-38's forecast
// said $0.175 for a session that had spent $0.5317 before writing a line.
//
// The per-phase numbers below are anchored on real measurements from this
// campaign's own sessions, all economy tier:
//   - DISCOVERY post-DLV-45: 149,760 processed tokens for $0.1048
//   - PLAN at `medium`:      $0.1857 (DLV-57 moved economy's plan to `low`)
//   - s-20260730-104900-9mfu: 4 turns / $0.5302 total
// Standard and premium are scaled from economy rather than measured — no
// completed session on either tier exists yet, and inventing precision we do
// not have would be worse than a stated multiplier. Once three same-tier
// sessions complete, `estPhaseUsage` uses their real medians instead.
const STATIC_PHASE_USAGE_ECONOMY = Object.freeze({
  discovery: Object.freeze({ input: 100, cachedRead: 105_000, cacheCreation: 42_000, output: 2_000 }),
  plan: Object.freeze({ input: 100, cachedRead: 90_000, cacheCreation: 35_000, output: 2_500 }),
  building: Object.freeze({ input: 100, cachedRead: 110_000, cacheCreation: 45_000, output: 4_000 }),
  reviewing: Object.freeze({ input: 100, cachedRead: 80_000, cacheCreation: 30_000, output: 2_000 }),
  uat: Object.freeze({ input: 100, cachedRead: 80_000, cacheCreation: 30_000, output: 3_000 }),
});
const PHASE_TIER_MULTIPLIER = Object.freeze({ economy: 1, standard: 1.6, premium: 2.5 });

/** Phases that produce a turn, in traversal order. */
export const FORECAST_PHASES = Object.freeze(["discovery", "plan", "building", "reviewing", "uat"]);

/** Expected BUILDING traversals — one per plan step, and plan size tracks item effort. */
const BUILDING_STEPS_BY_EFFORT = Object.freeze({ S: 1, M: 3, L: 5 });

function scaleUsage(usage, factor) {
  return {
    input: Math.round((usage.input || 0) * factor),
    cachedRead: Math.round((usage.cachedRead || 0) * factor),
    cacheCreation: Math.round((usage.cacheCreation || 0) * factor),
    output: Math.round((usage.output || 0) * factor),
  };
}

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Per-phase usage prior: the median across >=3 same-tier completed sessions'
 * own `usage.perPhase[phase]`, or the static shape above. Same threshold and
 * same reasoning as `estUsageForTier` — two samples is an anecdote.
 * @param {string} tier
 * @param {string} phase
 * @param {{tier:string, perPhase?:object}[]} [history]
 */
export function estPhaseUsage(tier, phase, history = []) {
  const samples = (history || [])
    .filter((h) => h && h.tier === tier && h.perPhase && h.perPhase[phase])
    .map((h) => h.perPhase[phase]);
  if (samples.length >= 3) {
    return {
      input: medianOf(samples.map((s) => s.input || 0)),
      cachedRead: medianOf(samples.map((s) => s.cachedRead || 0)),
      cacheCreation: medianOf(samples.map((s) => s.cacheCreation || 0)),
      output: medianOf(samples.map((s) => s.output || 0)),
    };
  }
  const base = STATIC_PHASE_USAGE_ECONOMY[phase] || STATIC_PHASE_USAGE_ECONOMY.discovery;
  return scaleUsage(base, PHASE_TIER_MULTIPLIER[tier] ?? 1);
}

/**
 * Whether `estPhaseUsage` will actually use medians for this phase — the same
 * predicate, so the reported provenance can never disagree with what was used.
 *
 * Worth its own function rather than an inline count: an earlier version
 * counted sessions with *any* `perPhase` object, which reported
 * "measured-median" for a fleet whose `perPhase` was `{}` — a forecast labelled
 * as measured while being entirely static is worse than an honest estimate,
 * because it invites the owner to trust it.
 */
function phaseHasMeasuredPrior(tier, phase, history = []) {
  return (history || []).filter((h) => h && h.tier === tier && h.perPhase && h.perPhase[phase]).length >= 3;
}

/**
 * DLV-56 — forecast the session as a sum over phase traversals, and return the
 * breakdown, not just the total. The breakdown is the point: a total the owner
 * cannot interrogate is a number they cannot set a cap against, and the whole
 * reason to forecast at the Flight-Check is to choose an envelope.
 *
 * Fix loops are deliberately excluded from the base figure and reported
 * separately as `perFixLoop`: their number is genuinely unknowable at launch,
 * and folding a guess into the headline would make the forecast wrong in the
 * one direction that matters (too low) while looking more precise.
 *
 * @param {{tier:string, itemEffort?:(string|null), maxPlanSteps?:(number|null),
 *   history?:object[], pricing?:(object|null), lane?:(string|null), merged?:boolean}} args
 */
export function forecastByPhase({
  tier,
  itemEffort = null,
  maxPlanSteps = null,
  history = [],
  pricing = null,
  lane = null,
  merged = false,
}) {
  const letter = String(itemEffort || "").trim().toUpperCase();
  let buildingSteps = BUILDING_STEPS_BY_EFFORT[letter] ?? 2;
  if (maxPlanSteps && buildingSteps > maxPlanSteps) buildingSteps = maxPlanSteps;

  // DLV-73 — the forecast has to model the *pipeline shape*, not just its price.
  // Two lanes now traverse fewer phases than the five-phase default:
  //   - a merged DISCOVERY+PLAN turn (DLV-62 on FAST, always on INSTANT) runs
  //     `plan` zero times — the plan comes out of the discovery turn;
  //   - INSTANT additionally spends no model turn on REVIEWING or UAT_PREP,
  //     which the runner discharges deterministically from the declared edit.
  // Charging for phases that cannot run is how DLV-38's forecast came out at
  // $0.175 for a session that spent $0.53, only in the opposite direction: it
  // would make INSTANT look 2.5x more expensive than it is and push the owner
  // back toward doing the edit by hand.
  const instant = lane === "INSTANT";
  const traversalsByPhase = {
    discovery: 1,
    plan: instant || merged ? 0 : 1,
    building: instant ? 1 : buildingSteps,
    reviewing: instant ? 0 : 1,
    uat: instant ? 0 : 1,
  };
  const phases = FORECAST_PHASES.map((phase) => {
    const perTraversal = estPhaseUsage(tier, phase, history);
    const traversals = traversalsByPhase[phase];
    const usage = scaleUsage(perTraversal, traversals);
    return {
      phase,
      traversals,
      usage,
      tokens: totalUsageTokens(usage),
      costUsd: pricing ? estimateCostUsd(usage, pricing) : null,
      priorSource: phaseHasMeasuredPrior(tier, phase, history) ? "measured-median" : "static-estimate",
    };
  });
  const measuredPhases = phases.filter((p) => p.priorSource === "measured-median").length;

  const estTokens = phases.reduce((sum, p) => sum + p.tokens, 0);
  const estCostUsd = pricing ? phases.reduce((sum, p) => sum + (p.costUsd || 0), 0) : null;

  // One fix loop = one more BUILDING traversal (VALIDATING costs no model call).
  const fixLoopUsage = estPhaseUsage(tier, "building", history);
  return {
    phases,
    estTokens,
    estCostUsd,
    assumptions: {
      buildingSteps: traversalsByPhase.building,
      buildingStepsBasis: instant
        ? "INSTANT: one build step, and no model turn for PLAN, REVIEWING or UAT_PREP"
        : letter
          ? `${letter}-effort item (${BUILDING_STEPS_BY_EFFORT[letter] ?? 2} plan steps assumed)${maxPlanSteps && BUILDING_STEPS_BY_EFFORT[letter] > maxPlanSteps ? `, capped at the ${maxPlanSteps}-step budget` : ""}${merged ? ", with DISCOVERY and PLAN merged into one turn" : ""}`
          : `no effort recorded on the item — 2 plan steps assumed${merged ? ", with DISCOVERY and PLAN merged into one turn" : ""}`,
      excludesFixLoops: true,
      perFixLoop: { tokens: totalUsageTokens(fixLoopUsage), costUsd: pricing ? estimateCostUsd(fixLoopUsage, pricing) : null },
      // Reported from what each phase actually used, never from a proxy for it.
      priorSource:
        measuredPhases === phases.length ? "measured-median" : measuredPhases === 0 ? "static-estimate" : "mixed",
      measuredPhases,
    },
  };
}

function totalUsageTokens(usage) {
  const u = usage || {};
  return (u.input || 0) + (u.cachedRead || 0) + (u.cacheCreation || 0) + (u.output || 0);
}

/**
 * Complexity score (0+) and the human-readable contributing factors.
 * `scopeHints.scopeSource` is what distinguishes item-derived scope from
 * campaign-table boilerplate (DLV-42) — it was accepted by the implementation
 * but missing from this signature, so no caller could pass it type-safely.
 * @param {{item:{effort?:(string|null), sev?:(string|null), campaign?:(string|null)},
 *   capabilities?:{name:string}[],
 *   scopeHints?:{globs?:string[], keywords?:string[], modules?:string[], scopeSource?:string}}} args
 * @returns {{score:number, rationale:string[]}}
 */
export function scoreComplexity({ item = {}, capabilities = [], scopeHints = {} }) {
  let score = 0;
  const rationale = [];

  const effortLetter = String(item.effort || "").trim().toUpperCase();
  const effortPoints = EFFORT_SCORE_BY_LETTER[effortLetter];
  if (typeof effortPoints === "number") {
    score += effortPoints;
    rationale.push(`${effortLetter}-effort item (+${effortPoints})`);
  }

  if (item.sev === "blocker") {
    score += 1;
    rationale.push("blocker severity (+1)");
  }

  const capNames = new Set((capabilities || []).map((c) => c.name));
  if (capNames.has("money-domain")) {
    score += 1;
    rationale.push("money-domain capability flagged (+1)");
  }

  if (item.campaign && JUNCTION_CAMPAIGNS.includes(item.campaign)) {
    score += 1;
    rationale.push(`junction-module campaign "${item.campaign}" (+1)`);
  }

  // DLV-42: only *item-derived* scope counts toward complexity. When scope
  // hints fall back to the campaign glob table (`computeScopeHints`), the count
  // describes the campaign's size, not the work's — Budget's 6-entry constant
  // handed +2 to every Budget item ever launched, including a one-token chip
  // edit that then scored 3 and drew a DEEP recommendation. A constant cannot
  // be evidence about a specific item.
  const globCount = Array.isArray(scopeHints.globs) ? scopeHints.globs.length : 0;
  const scopeIsItemDerived = scopeHints.scopeSource === "item-paths";
  if (scopeIsItemDerived && globCount >= BROAD_SCOPE_GLOB_THRESHOLD) {
    score += 2;
    rationale.push(`broad launch scope (${globCount} paths named in item, +2)`);
  }

  return { score, rationale };
}

/** Score 0-1 -> economy, 2 -> standard, >=3 -> premium. */
export function tierForScore(score) {
  if (score >= 3) return "premium";
  if (score === 2) return "standard";
  return "economy";
}

/** Per-phase effort map for a tier — a fresh object each call (safe to spread/mutate). */
export function effortForTier(tier) {
  const map = EFFORT_BY_TIER[tier] || EFFORT_BY_TIER.economy;
  return { ...map };
}

/** Recommended informational lane for the launch Flight-Check (DLV-6 applies policy bundles later). */
export function laneForTier(tier) {
  return LANE_BY_TIER[tier] || LANE_BY_TIER.standard;
}

// DLV-73: lane and tier were bijective until INSTANT, and `laneForTier` /
// `tierForLane` were literal inverses of one table. They cannot be any more:
// INSTANT and FAST are both `economy` (INSTANT reuses that tier wholesale — see
// EFFORT_BY_TIER's DLV-57 note, whose reasoning about a `plan` phase that only
// has to say "edit this line" describes INSTANT exactly), while `economy` still
// recommends FAST by default. The two directions are now separate questions:
// "what does this lane cost" (TIER_BY_LANE) and "what lane should we suggest"
// (laneForRecommendation), and only the second one knows about triviality.
const TIER_BY_LANE = Object.freeze({ INSTANT: "economy", FAST: "economy", STANDARD: "standard", DEEP: "premium" });

/** Reverse of `laneForTier` — the tier a given (owner-selected) lane implies. */
export function tierForLane(lane) {
  return TIER_BY_LANE[lane] || TIER_BY_LANE.STANDARD;
}

/**
 * The lane the Flight-Check should pre-select.
 *
 * Complexity scoring alone can never suggest INSTANT: it maps a score to a tier,
 * and INSTANT shares `economy` with FAST. What separates them is the triage
 * predicate (`isTrivialLaunchCandidate`) — the same signal that used to *refuse*
 * these items outright. Before DLV-73 a trivial item's only paths were "make the
 * edit by hand" or type `LAUNCH ANYWAY` and pay FAST's full pipeline; INSTANT is
 * the third answer, so the triage signal now routes instead of blocking.
 *
 * @param {{tier:string, trivial?:boolean, located?:boolean}} args
 *   `located` — whether a single file is actually known (item-named or located).
 *   INSTANT's whole shape assumes one known file; without one there is nothing
 *   to merge DISCOVERY and PLAN around, so it is not offered.
 */
export function laneForRecommendation({ tier, trivial = false, located = false }) {
  if (trivial && located && tier === "economy") return "INSTANT";
  return laneForTier(tier);
}

/**
 * Resolve a delivery lane into a concrete, packet-recordable policy bundle
 * (D9/DLV-6) — before this, the lane travelled launch form -> packet ->
 * disk and the runner never read it (`grep -i lane run-session.mjs` was 0
 * matches); FAST/STANDARD/DEEP differed only in a cosmetic mismatch warning.
 * Effort-per-phase and the budget envelope (incl. `maxInternalTurns`, mapped
 * by the runner onto the SDK's own `Options.maxTurns` so one runner turn can
 * no longer silently become ~40 model calls) now derive from the lane the
 * owner actually picked. Pure and deterministic: same lane + config always
 * yields the same policy, so it is safe to snapshot into the packet and
 * re-derive identically later for audit.
 * Also resolves the lane's validation ladder (D10/DLV-11) — which of
 * typecheck/lint/test actually run for this lane, and whether "test" runs
 * targeted (`vitest related <changed files>`) instead of the full suite.
 * Missing/unset config falls back to the full ladder (today's unconditional
 * behavior) — an owner who hasn't opted into a lighter FAST ladder never
 * gets one by accident.
 * @param {string} lane - one of DELIVERY_LANES
 * @param {object} config - loadConfig() result
 * @returns {{lane:string, tier:string,
 *   effortByPhase:{discovery:string, plan:string, building:string, review:string},
 *   budget:({maxUsd:(number|null), maxTokens:(number|null), warnPct:(number|null)}|null),
 *   maxInternalTurns:(number|null),
 *   validationLadder:{rungs:string[], targetedTest:boolean}}}
 */
/**
 * DLV-62: is this launch eligible for the merged DISCOVERY+PLAN turn?
 *
 * Three conditions, all necessary:
 *  - the lane is FAST (the only lane whose purpose is trivial work),
 *  - the owner has not switched the behaviour off in config, and
 *  - the item names **exactly one file** — knowable since DLV-42, which made
 *    `scopeHints` derive from the paths the item's own text names rather than
 *    from a campaign glob table.
 *
 * The single-file rule is the safety rail, not a convenience: a change confined
 * to one named file is one whose spec and plan cannot meaningfully diverge, so
 * producing them in a single turn loses nothing. The moment scope is broader
 * than that, the separate PLAN turn is doing real work and stays.
 *
 * @param {{lane:string, scopeHints?:object, config?:object}} args
 * @returns {{merged:boolean, reason:string}}
 */
export function resolveMergedDiscoveryPlan({ lane, scopeHints = {}, config = null }) {
  // DLV-73: on INSTANT the merge is unconditional, because the lane's launch
  // precondition already *is* DLV-62's safety rail — INSTANT is only offered
  // when exactly one file is known (named by the item or located deterministically
  // at Flight-Check), so re-deriving single-file-ness here would just restate it.
  if (lane === "INSTANT") {
    const enabledInstant = !(config && config.pipeline && config.pipeline.mergeDiscoveryPlanAlwaysOnInstant === false);
    if (!enabledInstant) return { merged: false, reason: "disabled in .delivery/config.json" };
    return { merged: true, reason: "INSTANT always produces the spec and plan in one turn" };
  }
  const enabled = !(config && config.pipeline && config.pipeline.mergeDiscoveryPlanOnFastSingleFile === false);
  if (!enabled) return { merged: false, reason: "disabled in .delivery/config.json" };
  if (lane !== "FAST") return { merged: false, reason: `lane is ${lane}, not FAST` };
  // DLV-73 widens this from "item-paths" to any provably-single-file source. The
  // rail was never about *who* named the file — it is that spec and plan cannot
  // meaningfully diverge inside one known file. A deterministic locator hit is
  // evidence of the same fact, and `isConfidentLocation` already refuses to set
  // `scopeSource: "locator"` on an ambiguous result.
  if (scopeHints.scopeSource !== "item-paths" && scopeHints.scopeSource !== "locator") {
    return { merged: false, reason: "no explicit or located file path, so scope is not known to be single-file" };
  }
  const globs = scopeHints.globs || [];
  if (globs.length !== 1) return { merged: false, reason: `scope names ${globs.length} paths, not exactly one` };
  const how = scopeHints.scopeSource === "locator" ? "the locator resolved" : "the item names";
  return { merged: true, reason: `FAST lane and ${how} exactly one file (${globs[0]})` };
}

export function resolveLanePolicy(lane, config) {
  const tier = tierForLane(lane);
  const laneKey = String(lane || "").toLowerCase();
  const envelope = (config && config.budgets && config.budgets.laneDefaults && config.budgets.laneDefaults[laneKey]) || null;
  const ladder = (config && config.validation && config.validation.laneLadder && config.validation.laneLadder[laneKey]) || null;
  return {
    lane,
    tier,
    effortByPhase: effortForTier(tier),
    budget: envelope ? { maxUsd: envelope.maxUsd, maxTokens: envelope.maxTokens, warnPct: envelope.warnPct } : null,
    maxInternalTurns: envelope && envelope.maxInternalTurns != null ? envelope.maxInternalTurns : null,
    validationLadder: {
      rungs: ladder && Array.isArray(ladder.rungs) && ladder.rungs.length ? [...ladder.rungs] : ["typecheck", "lint", "test"],
      targetedTest: !!(ladder && ladder.targetedTest),
    },
  };
}

/**
 * Explain owner-selected model/lane mismatches without silently overriding them.
 * The returned warnings are persisted in the launch snapshot.
 */
export function assessRecommendationMismatch({
  recommendation,
  selectedModel,
  selectedModelTier,
  selectedLane,
}) {
  if (!recommendation) return [];
  const warnings = [];
  // DLV-73: prefer the lane the recommendation actually resolved. Re-deriving it
  // from the tier alone would report "INSTANT differs from the recommended FAST"
  // on a session the recommender itself had just recommended INSTANT for —
  // economy maps to FAST by default, and only the recommender knows about triage.
  const recommendedLane = recommendation.lane || laneForTier(recommendation.tier);
  if (
    selectedModelTier &&
    TIER_RANK[selectedModelTier] != null &&
    TIER_RANK[recommendation.tier] != null &&
    TIER_RANK[selectedModelTier] < TIER_RANK[recommendation.tier]
  ) {
    warnings.push({
      code: "model-below-recommended-tier",
      message: `${selectedModel || "Selected model"} is ${selectedModelTier} tier, below the ${recommendation.tier} tier recommended for this scope.`,
    });
  } else if (selectedModel && selectedModel !== recommendation.model) {
    warnings.push({
      code: "model-differs-from-recommendation",
      message: `${selectedModel} differs from the recommended model ${recommendation.model}.`,
    });
  }
  if (selectedLane && selectedLane !== recommendedLane) {
    warnings.push({
      code: "lane-differs-from-recommendation",
      message: `${selectedLane} differs from the recommended ${recommendedLane} lane.`,
    });
  }
  return warnings;
}

/**
 * DLV-9 — the fit guard, re-run *after* DISCOVERY against measured scope.
 *
 * `recommendAgentConfig` runs once, at launch, from unmeasured signals: the
 * item's own effort letter, its severity, and whatever paths its text happened
 * to name. That is the best available guess before anyone has looked at the
 * code — and it is exactly the guess BUD-11 got wrong, accepting Haiku/low for
 * what DISCOVERY then measured as a 25-file, 72-occurrence refactor. The
 * measurement existed; nothing ever compared it back to the model choice.
 *
 * This re-scores the same item with the *measured* size class standing in for
 * the declared effort, and reports only the direction that costs something: a
 * measured scope needing a richer tier than the one actually running. Never
 * applied automatically — the owner switches model mid-session via the existing
 * `set-config` control, or acknowledges and continues. Both are audited.
 *
 * @param {{item:object, capabilities?:object[], scopeHints?:object, provider:string,
 *   config:object, measuredSizeClass:(string|null), currentModel:(string|null)}} args
 * @returns {{mismatch:boolean, recommendedTier:(string|null), recommendedModel:(string|null),
 *   currentTier:(string|null), measuredSizeClass:(string|null), message:(string|null)}}
 */
export function reassessFitAfterDiscovery({
  item,
  capabilities = [],
  scopeHints = {},
  provider,
  config,
  measuredSizeClass,
  currentModel,
}) {
  const none = {
    mismatch: false,
    recommendedTier: null,
    recommendedModel: null,
    currentTier: null,
    measuredSizeClass: measuredSizeClass || null,
    message: null,
  };
  if (!measuredSizeClass || EFFORT_SCORE_BY_LETTER[measuredSizeClass] === undefined) return none;

  // The measured size class replaces the declared effort — everything else
  // (severity, money-domain, junction campaign, item-derived scope breadth)
  // is unchanged, so the delta this reports is attributable to scope alone.
  const { score } = scoreComplexity({ item: { ...(item || {}), effort: measuredSizeClass }, capabilities, scopeHints });
  const recommendedTier = tierForScore(score);
  const recommendedModel = pickModelForTier(config, provider, recommendedTier);

  const currentInfo = currentModel ? getModelInfo(config, provider, currentModel) : null;
  const currentTier = (currentInfo && currentInfo.tier) || null;
  // An uncatalogued model has no tier to compare against. Saying nothing is
  // right here: a warning derived from an unknown baseline would be noise, and
  // the owner already sees the measured scope on the same gate panel.
  if (!currentTier || TIER_RANK[currentTier] == null || TIER_RANK[recommendedTier] == null) {
    return { ...none, recommendedTier, recommendedModel, currentTier };
  }
  if (TIER_RANK[recommendedTier] <= TIER_RANK[currentTier]) {
    return { ...none, recommendedTier, recommendedModel, currentTier };
  }
  return {
    mismatch: true,
    recommendedTier,
    recommendedModel,
    currentTier,
    measuredSizeClass,
    message:
      `DISCOVERY measured ${measuredSizeClass}-sized scope, which scores as ${recommendedTier} tier — ` +
      `this session is running ${currentModel} (${currentTier} tier). ` +
      (recommendedModel
        ? `Switch to ${recommendedModel} from the session controls, or approve to continue on the current model.`
        : "Consider switching model from the session controls, or approve to continue on the current one."),
  };
}

function pickModelForTier(config, provider, tier) {
  let providerCfg;
  try {
    providerCfg = getProviderConfig(config, provider);
  } catch {
    return null;
  }
  const match = (providerCfg.models || []).find((m) => m.tier === tier);
  return match ? match.id : null;
}

/**
 * Median per-bucket usage across completed sessions of the same tier, or the
 * static fallback shape when fewer than 3 same-tier samples exist.
 * @param {string} tier
 * @param {{tier:string, usage:{input?:number,cachedRead?:number,cacheCreation?:number,output?:number}}[]} history
 */
function estUsageForTier(tier, history = []) {
  const samples = (history || []).filter((h) => h && h.tier === tier && h.usage);
  if (samples.length >= 3) {
    const median = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    return {
      input: median(samples.map((s) => s.usage.input || 0)),
      cachedRead: median(samples.map((s) => s.usage.cachedRead || 0)),
      cacheCreation: median(samples.map((s) => s.usage.cacheCreation || 0)),
      output: median(samples.map((s) => s.usage.output || 0)),
    };
  }
  return { ...STATIC_USAGE_BY_TIER[tier] };
}

/**
 * Recommend a model + per-phase effort for a work item, given the owner's
 * catalog. Returns `null` when the provider's catalog has no models tagged
 * with the chosen tier (empty/unpopulated `.delivery/config.json`) — the
 * caller should hide the recommendation UI rather than show a broken card.
 * @param {object} args
 * @param {object} args.item - packet-shaped item ({effort, sev, campaign})
 * @param {{name:string}[]} [args.capabilities] - classify.mjs output
 * @param {{globs?:string[], keywords?:string[], modules?:string[], scopeSource?:string}} [args.scopeHints]
 * @param {"claude"|"codex"} args.provider
 * @param {object} args.config - loadConfig() result
 * @param {{tier:string, usage:object, perPhase?:object}[]} [args.history] - past completed sessions' totals, same-tier only used
 * @returns {{model:string, effortByPhase:object, tier:string, rationale:string[],
 *   estTokens:number, estCostUsd:(number|null), phaseForecast:object,
 *   legacySessionEstimate:{estTokens:number, estCostUsd:(number|null)}}|null}
 */
export function recommendAgentConfig({
  item,
  capabilities = [],
  scopeHints = {},
  provider,
  config,
  history = [],
  trivial = false,
  located = false,
}) {
  const { score, rationale } = scoreComplexity({ item, capabilities, scopeHints });
  const tier = tierForScore(score);
  const model = pickModelForTier(config, provider, tier);
  if (!model) return null;

  const lane = laneForRecommendation({ tier, trivial, located });
  const merged = resolveMergedDiscoveryPlan({ lane, scopeHints, config }).merged;
  const pricing = getModelPricing(config, provider, model);

  // DLV-56: the headline forecast is now the per-phase sum. The old per-session
  // shape is kept alongside it as `legacySessionEstimate` rather than deleted —
  // every session already on disk was launched against it, so the forecast-vs-
  // actual comparisons in `computeForecastActual` would otherwise be comparing
  // two different units and silently reporting nonsense for the whole existing
  // fleet.
  const phaseForecast = forecastByPhase({
    tier,
    itemEffort: item && item.effort,
    maxPlanSteps: (config && config.budgets && config.budgets.maxPlanSteps) || null,
    history,
    pricing,
    lane,
    merged,
  });
  const legacyUsage = estUsageForTier(tier, history);

  return {
    model,
    effortByPhase: effortForTier(tier),
    tier,
    lane,
    rationale,
    estTokens: phaseForecast.estTokens,
    estCostUsd: phaseForecast.estCostUsd,
    phaseForecast,
    legacySessionEstimate: {
      estTokens: totalUsageTokens(legacyUsage),
      estCostUsd: pricing ? estimateCostUsd(legacyUsage, pricing) : null,
    },
  };
}

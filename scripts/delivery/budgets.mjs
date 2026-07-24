// scripts/delivery/budgets.mjs
// Session-level token/cost budget checks — the backstop layer. The P0 fixes
// in this pass (per-phase driver mode, path-guard normalization, quota
// classification, validation baselining) address BUD-11's actual root
// causes; this module is what stops the *next* runaway session even if a
// future bug slips past all of those — a hard cap on total processed tokens
// would have stopped BUD-11's 3M-cached-token spend long before the
// subscription's 5-hour allowance did, regardless of what caused it.
//
// Pure functions only; run-session.mjs decides what to do with the verdict
// (emit an event, skip the turn and block, etc). Token/cost figures here are
// always the running SESSION TOTAL processed so far (input + cachedInput +
// output, and the reported/estimated cost) — not a single turn's usage.

/**
 * @typedef {{input?:number, cachedInput?:number, output?:number, costUsd?:(number|null)}} UsageTotals
 * @typedef {{maxUsd:(number|null), maxTokens:(number|null), warnPct:number,
 *   perPhase?:Object<string,{maxUsd?:(number|null),maxTokens?:(number|null)}>,
 *   authorization?:"capped"|"no-cap", authorizedAt?:string}} BudgetEnvelope
 * @typedef {{warnSessionTokens?:number, maxSessionTokens?:number, warnSessionUsd?:number,
 *   maxSessionUsd?:number, maxTurnsPerPhase?:Object<string,number>, maxPlanSteps?:number}} BudgetsConfig
 */

export class BudgetError extends Error {}
export const DEFAULT_WARN_PCT = 0.8;
const PHASES = new Set(["selected", "discovery", "plan", "building", "validating", "reviewing", "uat"]);

function optionalPositive(value, path, { integer = false } = {}) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || (integer && !Number.isInteger(parsed))) {
    throw new BudgetError(`${path} must be a positive${integer ? " integer" : ""} number`);
  }
  return parsed;
}

function warnFraction(value) {
  const parsed = value == null || value === "" ? DEFAULT_WARN_PCT : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
    throw new BudgetError("budget.warnPct must be greater than 0 and less than 1");
  }
  return parsed;
}

function normalizePerPhase(perPhase) {
  if (perPhase == null) return {};
  if (typeof perPhase !== "object" || Array.isArray(perPhase)) {
    throw new BudgetError("budget.perPhase must be an object");
  }
  const normalized = {};
  for (const [phaseRaw, caps] of Object.entries(perPhase)) {
    const phase = phaseRaw.toLowerCase();
    if (!PHASES.has(phase)) throw new BudgetError(`budget.perPhase.${phaseRaw} is not a supported phase`);
    if (!caps || typeof caps !== "object" || Array.isArray(caps)) {
      throw new BudgetError(`budget.perPhase.${phaseRaw} must be an object`);
    }
    const maxUsd = optionalPositive(caps.maxUsd, `budget.perPhase.${phaseRaw}.maxUsd`);
    const maxTokens = optionalPositive(caps.maxTokens, `budget.perPhase.${phaseRaw}.maxTokens`, { integer: true });
    if (maxUsd == null && maxTokens == null) {
      throw new BudgetError(`budget.perPhase.${phaseRaw} must set maxUsd and/or maxTokens`);
    }
    normalized[phase] = { maxUsd, maxTokens };
  }
  return normalized;
}

/**
 * Validate owner launch input and shape the immutable packet envelope.
 * An uncapped session is deliberately noisy: the exact typed confirmation is
 * required and is recorded in the packet as `authorization:"no-cap"`.
 * @returns {BudgetEnvelope}
 */
export function createBudgetEnvelope(input, { authorizedAt = new Date().toISOString() } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BudgetError("budget is required");
  }
  const maxUsd = optionalPositive(input.maxUsd, "budget.maxUsd");
  const maxTokens = optionalPositive(input.maxTokens, "budget.maxTokens", { integer: true });
  const warnPct = warnFraction(input.warnPct);
  const perPhase = normalizePerPhase(input.perPhase);
  const capped = maxUsd != null || maxTokens != null || Object.keys(perPhase).length > 0;
  if (!capped && input.noCapConfirm !== "NO CAP") {
    throw new BudgetError('set maxUsd/maxTokens or type "NO CAP" to authorize an uncapped session');
  }
  return {
    maxUsd,
    maxTokens,
    warnPct,
    perPhase,
    authorization: capped ? "capped" : "no-cap",
    authorizedAt,
  };
}

/** Convert the pre-DLV-1 global backstop keys for already-existing packets. */
/** @returns {BudgetEnvelope & {legacy:boolean,warnUsd:(number|null),warnTokens:(number|null)}} */
export function legacyBudgetEnvelope(config = {}) {
  return {
    maxUsd: typeof config.maxSessionUsd === "number" ? config.maxSessionUsd : null,
    maxTokens: typeof config.maxSessionTokens === "number" ? config.maxSessionTokens : null,
    warnPct: DEFAULT_WARN_PCT,
    perPhase: {},
    authorization: "capped",
    authorizedAt: null,
    legacy: true,
    warnUsd: typeof config.warnSessionUsd === "number" ? config.warnSessionUsd : null,
    warnTokens: typeof config.warnSessionTokens === "number" ? config.warnSessionTokens : null,
  };
}

/** Sum the three token fields of a usage-totals object into one "processed tokens" figure. */
export function totalProcessedTokens(usage) {
  const u = usage || {};
  return (u.input || 0) + (u.cachedInput || 0) + (u.output || 0);
}

/**
 * @param {UsageTotals} usageTotals - the session's running total so far (state.usage.total)
 * @param {BudgetEnvelope|BudgetsConfig} [budgets]
 * @returns {{status:"ok"|"warn"|"exceeded", totalTokens:number, costUsd:(number|null), reason:(string|null)}}
 */
export function checkSessionBudget(usageTotals, budgets = {}, { phase = null, phaseUsage = null } = {}) {
  const totalTokens = totalProcessedTokens(usageTotals);
  const costUsd = typeof (usageTotals && usageTotals.costUsd) === "number" ? usageTotals.costUsd : null;
  const maxTokens = budgets.maxTokens ?? budgets.maxSessionTokens;
  const maxUsd = budgets.maxUsd ?? budgets.maxSessionUsd;
  const warnPct = typeof budgets.warnPct === "number" ? budgets.warnPct : null;
  const warnTokens = budgets.warnTokens ?? budgets.warnSessionTokens ?? (maxTokens != null && warnPct != null ? maxTokens * warnPct : null);
  const warnUsd = budgets.warnUsd ?? budgets.warnSessionUsd ?? (maxUsd != null && warnPct != null ? maxUsd * warnPct : null);

  if (typeof maxTokens === "number" && totalTokens >= maxTokens) {
    return {
      status: "exceeded",
      totalTokens,
      costUsd,
      dimension: "session-tokens",
      reason: `Session token budget exhausted: ${totalTokens} processed tokens (input+cached+output) reached the authorized cap of ${maxTokens}.`,
    };
  }
  if (typeof maxUsd === "number" && typeof costUsd === "number" && costUsd >= maxUsd) {
    return {
      status: "exceeded",
      totalTokens,
      costUsd,
      dimension: "session-usd",
      reason: `Session cost budget exhausted: est. $${costUsd.toFixed(2)} reached the authorized cap of $${maxUsd.toFixed(2)}.`,
    };
  }

  const phaseKey = typeof phase === "string" ? phase.toLowerCase() : null;
  const phaseCaps = phaseKey && budgets.perPhase ? budgets.perPhase[phaseKey] : null;
  const phaseTokens = totalProcessedTokens(phaseUsage);
  const phaseCostUsd = typeof (phaseUsage && phaseUsage.costUsd) === "number" ? phaseUsage.costUsd : null;
  if (phaseCaps && typeof phaseCaps.maxTokens === "number" && phaseTokens >= phaseCaps.maxTokens) {
    return {
      status: "exceeded",
      totalTokens,
      costUsd,
      dimension: `${phaseKey}-tokens`,
      reason: `${phaseKey.toUpperCase()} token budget exhausted: ${phaseTokens} processed tokens reached the authorized phase cap of ${phaseCaps.maxTokens}.`,
    };
  }
  if (phaseCaps && typeof phaseCaps.maxUsd === "number" && typeof phaseCostUsd === "number" && phaseCostUsd >= phaseCaps.maxUsd) {
    return {
      status: "exceeded",
      totalTokens,
      costUsd,
      dimension: `${phaseKey}-usd`,
      reason: `${phaseKey.toUpperCase()} cost budget exhausted: est. $${phaseCostUsd.toFixed(2)} reached the authorized phase cap of $${phaseCaps.maxUsd.toFixed(2)}.`,
    };
  }

  const overWarnTokens = typeof warnTokens === "number" && totalTokens >= warnTokens;
  const overWarnUsd = typeof warnUsd === "number" && typeof costUsd === "number" && costUsd >= warnUsd;
  if (overWarnTokens || overWarnUsd) {
    return {
      status: "warn",
      totalTokens,
      costUsd,
      dimension: overWarnTokens ? "session-tokens" : "session-usd",
      reason: null,
    };
  }
  return { status: "ok", totalTokens, costUsd, dimension: null, reason: null };
}

/**
 * Apply a live owner raise without mutating the packet's launch authorization.
 * Existing finite caps may only increase; an omitted field remains unchanged.
 * @returns {BudgetEnvelope}
 */
export function raiseBudgetEnvelope(current, raise) {
  if (!current) throw new BudgetError("the session has no budget envelope to raise");
  if (!raise || typeof raise !== "object" || Array.isArray(raise)) throw new BudgetError("budget raise payload is required");
  if (typeof raise.reason !== "string" || !raise.reason.trim()) throw new BudgetError("budget raise reason is required");
  const requestedUsd = raise.maxUsd == null || raise.maxUsd === "" ? current.maxUsd : optionalPositive(raise.maxUsd, "budget.maxUsd");
  const requestedTokens =
    raise.maxTokens == null || raise.maxTokens === ""
      ? current.maxTokens
      : optionalPositive(raise.maxTokens, "budget.maxTokens", { integer: true });
  if (current.maxUsd == null && raise.maxUsd != null) throw new BudgetError("an uncapped USD envelope cannot be raised");
  if (current.maxTokens == null && raise.maxTokens != null) throw new BudgetError("an uncapped token envelope cannot be raised");
  if (current.maxUsd != null && requestedUsd < current.maxUsd) throw new BudgetError("budget.maxUsd may only increase");
  if (current.maxTokens != null && requestedTokens < current.maxTokens) throw new BudgetError("budget.maxTokens may only increase");
  if (requestedUsd === current.maxUsd && requestedTokens === current.maxTokens) {
    throw new BudgetError("budget raise must increase maxUsd and/or maxTokens");
  }
  return { ...current, maxUsd: requestedUsd, maxTokens: requestedTokens };
}

/**
 * DISCOVERY is the one phase whose turn count isn't already bounded by an
 * existing mechanism (BUILDING/REVIEWING have their fix-loop caps; PLAN and
 * UAT are single-shot) — a chain of question-raised round-trips could
 * otherwise re-enter it indefinitely. `count` is the number of DISCOVERY
 * turns already spent this session (tracked in `state.discoveryTurnCount`).
 * @param {number} count
 * @param {BudgetsConfig} [budgets]
 */
export function isDiscoveryTurnLimitReached(count, budgets = {}) {
  const limit = budgets.maxTurnsPerPhase && budgets.maxTurnsPerPhase.discovery;
  if (typeof limit !== "number") return false;
  return (count || 0) >= limit;
}

/**
 * @param {number} stepCount
 * @param {BudgetsConfig} [budgets]
 */
export function isPlanStepCountOverCap(stepCount, budgets = {}) {
  const limit = budgets.maxPlanSteps;
  if (typeof limit !== "number") return false;
  return (stepCount || 0) > limit;
}

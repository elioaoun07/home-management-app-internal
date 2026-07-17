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
 * @typedef {{warnSessionTokens?:number, maxSessionTokens?:number, warnSessionUsd?:number,
 *   maxSessionUsd?:number, maxTurnsPerPhase?:Object<string,number>, maxPlanSteps?:number}} BudgetsConfig
 */

/** Sum the three token fields of a usage-totals object into one "processed tokens" figure. */
export function totalProcessedTokens(usage) {
  const u = usage || {};
  return (u.input || 0) + (u.cachedInput || 0) + (u.output || 0);
}

/**
 * @param {UsageTotals} usageTotals - the session's running total so far (state.usage.total)
 * @param {BudgetsConfig} [budgets]
 * @returns {{status:"ok"|"warn"|"exceeded", totalTokens:number, costUsd:(number|null), reason:(string|null)}}
 */
export function checkSessionBudget(usageTotals, budgets = {}) {
  const totalTokens = totalProcessedTokens(usageTotals);
  const costUsd = typeof (usageTotals && usageTotals.costUsd) === "number" ? usageTotals.costUsd : null;

  if (typeof budgets.maxSessionTokens === "number" && totalTokens >= budgets.maxSessionTokens) {
    return {
      status: "exceeded",
      totalTokens,
      costUsd,
      reason: `Session token budget exceeded: ${totalTokens} processed tokens (input+cached+output) reached the configured cap of ${budgets.maxSessionTokens}.`,
    };
  }
  if (typeof budgets.maxSessionUsd === "number" && typeof costUsd === "number" && costUsd >= budgets.maxSessionUsd) {
    return {
      status: "exceeded",
      totalTokens,
      costUsd,
      reason: `Session cost budget exceeded: est. $${costUsd.toFixed(2)} reached the configured cap of $${budgets.maxSessionUsd.toFixed(2)}.`,
    };
  }

  const overWarnTokens = typeof budgets.warnSessionTokens === "number" && totalTokens >= budgets.warnSessionTokens;
  const overWarnUsd =
    typeof budgets.warnSessionUsd === "number" && typeof costUsd === "number" && costUsd >= budgets.warnSessionUsd;
  if (overWarnTokens || overWarnUsd) {
    return { status: "warn", totalTokens, costUsd, reason: null };
  }
  return { status: "ok", totalTokens, costUsd, reason: null };
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

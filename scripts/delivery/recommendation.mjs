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
import { getModelPricing, getProviderConfig } from "./config.mjs";

export const TIERS = Object.freeze(["economy", "standard", "premium"]);

const EFFORT_SCORE_BY_LETTER = Object.freeze({ S: 0, M: 1, L: 2 });

// Campaigns that bridge multiple standalone modules (CLAUDE.md's Junction
// Modules table) — cross-module cascades tend to need more plan/build care.
const JUNCTION_CAMPAIGNS = Object.freeze(["Hub & ERA", "Notifications & Alerts", "Trips"]);

const EFFORT_BY_TIER = Object.freeze({
  economy: Object.freeze({ discovery: "low", plan: "medium", building: "medium", review: "low" }),
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

function totalUsageTokens(usage) {
  const u = usage || {};
  return (u.input || 0) + (u.cachedRead || 0) + (u.cacheCreation || 0) + (u.output || 0);
}

/**
 * Complexity score (0+) and the human-readable contributing factors.
 * @param {{item:{effort?:(string|null), sev?:(string|null), campaign?:(string|null)}, capabilities?:{name:string}[]}} args
 * @returns {{score:number, rationale:string[]}}
 */
export function scoreComplexity({ item = {}, capabilities = [] }) {
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
 * @param {"claude"|"codex"} args.provider
 * @param {object} args.config - loadConfig() result
 * @param {{tier:string, usage:object}[]} [args.history] - past completed sessions' totals, same-tier only used
 * @returns {{model:string, effortByPhase:object, tier:string, rationale:string[], estTokens:number, estCostUsd:(number|null)}|null}
 */
export function recommendAgentConfig({ item, capabilities = [], provider, config, history = [] }) {
  const { score, rationale } = scoreComplexity({ item, capabilities });
  const tier = tierForScore(score);
  const model = pickModelForTier(config, provider, tier);
  if (!model) return null;

  const usage = estUsageForTier(tier, history);
  const pricing = getModelPricing(config, provider, model);
  const estCostUsd = pricing ? estimateCostUsd(usage, pricing) : null;

  return {
    model,
    effortByPhase: effortForTier(tier),
    tier,
    rationale,
    estTokens: totalUsageTokens(usage),
    estCostUsd,
  };
}

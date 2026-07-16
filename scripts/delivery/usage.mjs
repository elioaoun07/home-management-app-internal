// scripts/delivery/usage.mjs
// v2 usage normalization + cost estimation + multi-level aggregation.
// See ERA Notes/10 - Project Management/Delivery Workspace/ (DW-1) and
// Agentic Delivery Workspace/4 - Agent Drivers & Security.md §1 for the v1
// baseline this extends.
//
// events.mjs's `normalizeUsage`/`reduceUsage` (the v1 {input, cachedInput,
// output, costUsd} shape) are left untouched for back-compat with existing
// state.json readers. This module adds the v2 shape — cache-creation tokens
// (Claude) and reasoning tokens (Codex), both currently dropped by v1 — plus
// pricing-based cost estimation and per-turn-entry aggregation at any group
// level (phase/agent/model/provider/session). Pure functions only; callers
// (run-session.mjs, server-routes.mjs) own all file I/O.

export class UsageError extends Error {}

/** @typedef {{input:number, cachedRead:number, cacheCreation:number, output:number, reasoningOutput:number}} UsageTokensV2 */
/** @typedef {UsageTokensV2 & {costUsd:(number|null), costEstUsd:(number|null)}} UsageTotalsV2 */
/** @typedef {{inPerMTok:number, cachedReadPerMTok:number, cacheWritePerMTok:number, outPerMTok:number}} ModelPricing */

function emptyTokensV2() {
  return { input: 0, cachedRead: 0, cacheCreation: 0, output: 0, reasoningOutput: 0 };
}

/** @returns {UsageTotalsV2} */
export function emptyUsageV2() {
  return { ...emptyTokensV2(), costUsd: null, costEstUsd: null };
}

/**
 * Normalize a provider-native usage object into the v2 token shape.
 * Claude: `{input_tokens, cache_read_input_tokens, cache_creation_input_tokens, output_tokens, total_cost_usd?}`
 *   — no separate reasoning-token meter; `reasoningOutput` is always 0.
 * Codex: `{input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens, cost_usd?}`
 *   — no cache-write concept; `cacheCreation` is always 0. Codex never reports cost.
 * @param {object|null} raw
 * @param {"codex"|"claude"} provider
 * @returns {UsageTokensV2 & {costUsd:(number|null)}}
 */
export function normalizeUsageV2(raw, provider) {
  if (!raw) return { ...emptyTokensV2(), costUsd: null };
  if (provider === "codex") {
    return {
      input: raw.input_tokens || 0,
      cachedRead: raw.cached_input_tokens || 0,
      cacheCreation: 0,
      output: raw.output_tokens || 0,
      reasoningOutput: raw.reasoning_output_tokens || 0,
      costUsd: typeof raw.cost_usd === "number" ? raw.cost_usd : null,
    };
  }
  if (provider === "claude") {
    return {
      input: raw.input_tokens || 0,
      cachedRead: raw.cache_read_input_tokens || 0,
      cacheCreation: raw.cache_creation_input_tokens || 0,
      output: raw.output_tokens || 0,
      reasoningOutput: 0,
      costUsd: typeof raw.total_cost_usd === "number" ? raw.total_cost_usd : null,
    };
  }
  throw new UsageError(`unknown provider for usage normalization: ${provider}`);
}

/**
 * Estimate cost in USD from v2 token counts + a model's pricing config.
 * Returns `null` when no pricing is supplied (never fabricates a number).
 * @param {Partial<UsageTokensV2>|null|undefined} usage - missing/absent buckets count as 0
 * @param {ModelPricing|null|undefined} pricing
 * @returns {number|null}
 */
export function estimateCostUsd(usage, pricing) {
  if (!pricing) return null;
  const u = usage || emptyTokensV2();
  const inCost = ((u.input || 0) * (pricing.inPerMTok || 0)) / 1e6;
  const cachedReadCost = ((u.cachedRead || 0) * (pricing.cachedReadPerMTok || 0)) / 1e6;
  const cacheWriteCost = ((u.cacheCreation || 0) * (pricing.cacheWritePerMTok || 0)) / 1e6;
  const outCost = ((u.output || 0) * (pricing.outPerMTok || 0)) / 1e6;
  return inCost + cachedReadCost + cacheWriteCost + outCost;
}

/**
 * Context occupancy for one turn: how much of the model's context window the
 * turn's last request consumed. `windowTokens` is `null` when unknown
 * (Codex has no runtime-reported window; config supplies an estimate).
 * @param {Partial<UsageTokensV2>|null|undefined} usage - missing/absent buckets count as 0
 * @param {number|null} [windowTokens]
 * @returns {{occupancyTokens:number, windowTokens:(number|null), pctUsed:(number|null)}}
 */
export function computeOccupancy(usage, windowTokens = null) {
  const u = usage || emptyTokensV2();
  const occupancyTokens = (u.input || 0) + (u.cachedRead || 0) + (u.cacheCreation || 0);
  const pctUsed = typeof windowTokens === "number" && windowTokens > 0 ? occupancyTokens / windowTokens : null;
  return { occupancyTokens, windowTokens: windowTokens ?? null, pctUsed };
}

function accumulateV2(target, usage, costUsd, costEstUsd) {
  const u = usage || emptyTokensV2();
  target.input += u.input || 0;
  target.cachedRead += u.cachedRead || 0;
  target.cacheCreation += u.cacheCreation || 0;
  target.output += u.output || 0;
  target.reasoningOutput += u.reasoningOutput || 0;
  if (typeof costUsd === "number") target.costUsd = (target.costUsd || 0) + costUsd;
  if (typeof costEstUsd === "number") target.costEstUsd = (target.costEstUsd || 0) + costEstUsd;
}

/**
 * Reduce `turns.ndjson` entries (transcript.mjs `buildTurnEntry` shape —
 * `{usage, costUsd, costEstUsd, phase, agent, model, provider, ...}`) into
 * grouped + total v2 usage totals. `groupBy(turn)` picks the group key;
 * entries whose key is null/undefined are grouped under `"unknown"`.
 * @param {object[]} turnEntries
 * @param {(turn:*)=>*} groupBy - receives each turn entry untyped (shapes vary
 *   by caller); should return a string|null|undefined group key
 * @returns {{groups:Object<string,UsageTotalsV2>, total:UsageTotalsV2}}
 */
export function reduceTurnUsage(turnEntries, groupBy) {
  if (typeof groupBy !== "function") throw new UsageError("reduceTurnUsage requires a groupBy function");
  /** @type {Object<string,UsageTotalsV2>} */
  const groups = {};
  const total = emptyUsageV2();
  for (const turn of turnEntries || []) {
    const key = groupBy(turn);
    const groupKey = key == null ? "unknown" : String(key);
    if (!groups[groupKey]) groups[groupKey] = emptyUsageV2();
    accumulateV2(groups[groupKey], turn && turn.usage, turn && turn.costUsd, turn && turn.costEstUsd);
    accumulateV2(total, turn && turn.usage, turn && turn.costUsd, turn && turn.costEstUsd);
  }
  return { groups, total };
}

/** Convenience: group by `turn.phase`. */
export function reduceUsageByPhase(turnEntries) {
  return reduceTurnUsage(turnEntries, (t) => t.phase);
}

/** Convenience: group by `turn.agent`. */
export function reduceUsageByAgent(turnEntries) {
  return reduceTurnUsage(turnEntries, (t) => t.agent);
}

/** Convenience: group by `turn.model`. */
export function reduceUsageByModel(turnEntries) {
  return reduceTurnUsage(turnEntries, (t) => t.model);
}

/** Convenience: group by `turn.provider`. */
export function reduceUsageByProvider(turnEntries) {
  return reduceTurnUsage(turnEntries, (t) => t.provider);
}

/** Session-wide total only (no grouping) — the `state.json.usage.total` v2 equivalent. */
export function reduceUsageTotal(turnEntries) {
  return reduceTurnUsage(turnEntries, () => "session").total;
}

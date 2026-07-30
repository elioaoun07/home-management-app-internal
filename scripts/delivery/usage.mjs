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
/**
 * DLV-61 cache-write TTL breakdown. Deliberately *not* folded into
 * `UsageTokensV2`: that type is the budget input, and every accumulator in this
 * file reads its keys by name. See `extractCacheCreationTtl`.
 * @typedef {{ephemeral1h:number, ephemeral5m:number}} CacheCreationTtl
 */
/** @typedef {UsageTokensV2 & {costUsd:(number|null), cacheCreationTtl?:(CacheCreationTtl|null)}} NormalizedUsageV2 */

function emptyTokensV2() {
  return { input: 0, cachedRead: 0, cacheCreation: 0, output: 0, reasoningOutput: 0 };
}

/** @returns {UsageTotalsV2} */
export function emptyUsageV2() {
  return { ...emptyTokensV2(), costUsd: null, costEstUsd: null };
}

/**
 * DLV-61 — the cache-write TTL split, recorded rather than re-derived by hand.
 *
 * Cache **writes** are the dominant cost term and nothing surfaced them:
 * on s-20260730-104900-9mfu they were 231,567 tokens = $0.4631 = **87.4%** of a
 * $0.5302 session, against reads of $0.0240 (4.5%). Whether that is priced
 * correctly turns entirely on the TTL — a 1-hour write costs 2x input, a
 * 5-minute write 1.25x — and the runner recorded only the undifferentiated
 * `cache_creation_input_tokens` total, so `cacheWritePerMTok: 2` could not be
 * checked against reality without hand-parsing the raw SDK jsonl.
 *
 * Measured there, deduplicated by `message.id` (DLV-47): `ephemeral_1h`
 * 231,567 / `ephemeral_5m` **0** — 100% 1-hour, so the 2x rate is right and
 * the spend is real, not an accounting artifact. This closes the diagnostic
 * DLV-37 deferred ("every observed session is 100% 1h, so it has no accounting
 * consequence yet, only audit value") — the audit value became the point the
 * moment cache writes turned out to be 87% of the bill.
 *
 * Deliberately **not** part of `UsageTokensV2`: this is a diagnostic, not a
 * budget input. `accumulateV2`/`toUsageTotalsV2` read named keys only and
 * never spread, so the extra key rides along to `turns.ndjson` via
 * `buildTurnEntry` and is inert everywhere a cap is computed — which is what
 * keeps it away from the NaN class of bug DLV-43 hit in this same file.
 *
 * @param {object|null|undefined} raw - provider-native Claude usage object
 * @returns {{ephemeral1h:number, ephemeral5m:number}|null} null when the
 *   provider did not report a breakdown — never a fabricated `{0, 0}`, which
 *   would be indistinguishable from "reported, and genuinely zero".
 */
export function extractCacheCreationTtl(raw) {
  const split = raw && raw.cache_creation;
  if (!split || typeof split !== "object") return null;
  const ephemeral1h = split.ephemeral_1h_input_tokens;
  const ephemeral5m = split.ephemeral_5m_input_tokens;
  if (!Number.isFinite(ephemeral1h) && !Number.isFinite(ephemeral5m)) return null;
  return {
    ephemeral1h: Number.isFinite(ephemeral1h) ? ephemeral1h : 0,
    ephemeral5m: Number.isFinite(ephemeral5m) ? ephemeral5m : 0,
  };
}

/**
 * Normalize a provider-native usage object into the v2 token shape.
 * Claude: `{input_tokens, cache_read_input_tokens, cache_creation_input_tokens, output_tokens, total_cost_usd?}`
 *   — no separate reasoning-token meter; `reasoningOutput` is always 0.
 * Codex: `{input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens, cost_usd?}`
 *   — no cache-write concept; `cacheCreation` is always 0. Codex never reports cost.
 * @param {object|null} raw
 * @param {"codex"|"claude"} provider
 * @returns {NormalizedUsageV2}
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
      cacheCreationTtl: extractCacheCreationTtl(raw),
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
 * Pure (non-mutating) running-total accumulator for callers that keep
 * immutable state (run-session.mjs's `state.usage`). Same math as the
 * private `accumulateV2` above, wrapped to return a new object.
 * @param {UsageTotalsV2|null|undefined} prevTotals
 * @param {Partial<UsageTokensV2>|null|undefined} usage
 * @param {number|null} [costUsd]
 * @param {number|null} [costEstUsd]
 * @returns {UsageTotalsV2}
 */
export function addUsageV2(prevTotals, usage, costUsd = null, costEstUsd = null) {
  const target = toUsageTotalsV2(prevTotals);
  accumulateV2(target, usage, costUsd, costEstUsd);
  return target;
}

/**
 * Coerce a running total of *either* shape into the v2 shape.
 *
 * DLV-37 made `state.usage` v2-shaped, but a session created before it (or any
 * fixture/state still carrying the legacy `{input, cachedInput, output,
 * costUsd}` totals) has no `cachedRead`/`cacheCreation`/`reasoningOutput`
 * keys at all — so the previous `{...prevTotals}` spread left them `undefined`
 * and the very next `+=` turned the running total into **NaN**, silently
 * poisoning every budget comparison downstream (`NaN > cap` is false, so a cap
 * would never trip again for the rest of that session). Legacy `cachedInput`
 * carries forward as `cachedRead`, which is what it always meant.
 * @param {object|null|undefined} totals
 * @returns {UsageTotalsV2}
 */
export function toUsageTotalsV2(totals) {
  const t = totals || {};
  const base = emptyUsageV2();
  return {
    input: Number.isFinite(t.input) ? t.input : 0,
    cachedRead: Number.isFinite(t.cachedRead) ? t.cachedRead : Number.isFinite(t.cachedInput) ? t.cachedInput : 0,
    cacheCreation: Number.isFinite(t.cacheCreation) ? t.cacheCreation : 0,
    output: Number.isFinite(t.output) ? t.output : 0,
    reasoningOutput: Number.isFinite(t.reasoningOutput) ? t.reasoningOutput : 0,
    costUsd: typeof t.costUsd === "number" ? t.costUsd : base.costUsd,
    costEstUsd: typeof t.costEstUsd === "number" ? t.costEstUsd : base.costEstUsd,
  };
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

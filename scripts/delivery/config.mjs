// scripts/delivery/config.mjs
// `.delivery/config.json` loader + defaults + validation.
// See ERA Notes/10 - Project Management/Delivery Workspace/ (DW-1) and
// AgenticIdeas.MD's "no hardcoded price table" guidance — model catalogs and
// prices live only in this owner-edited file, never in source. The file is
// optional: when absent, `loadConfig` returns built-in defaults that keep
// today's behavior (no model/pricing catalog, today's per-phase effort
// routing). Neither pm-server nor the runner ever write this file — it is
// hand-maintained, matching the single-writer discipline documented in
// Agentic Delivery Workspace/2 - Architecture & Process Model.md §4.

import { join } from "node:path";
import { readJsonIfExists } from "./fsx.mjs";

export class ConfigError extends Error {}

export const SCHEMA_VERSION = 1;

/** @typedef {{inPerMTok:number, cachedReadPerMTok:number, cacheWritePerMTok:number, outPerMTok:number}} ModelPricing */
/** @typedef {{id:string, label?:string, contextWindow?:number, pricing?:ModelPricing}} ModelEntry */
/** @typedef {{defaultModel:(string|null), efforts:string[], models:ModelEntry[]}} ProviderConfig */

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
  }),
  transcript: Object.freeze({
    maxRecordBytes: 65536,
    warnSessionMB: 200,
  }),
  budgets: Object.freeze({
    warnSessionUsd: 10,
    maxTurnBudgetUsd: null,
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

/**
 * Load `.delivery/config.json` from under `rootDir`, deep-merged over
 * `DEFAULT_CONFIG` (owner values win; missing sections/keys fall back to
 * defaults). Returns `DEFAULT_CONFIG` unchanged when the file is absent.
 * @param {string} rootDir
 * @param {{configPath?:string, fs?:object}} [options]
 * @returns {object}
 */
export function loadConfig(rootDir, options = {}) {
  const path = options.configPath || join(rootDir, ".delivery", "config.json");
  const raw = readJsonIfExists(path, options);
  if (raw == null) return DEFAULT_CONFIG;
  if (raw.schemaVersion != null && raw.schemaVersion !== SCHEMA_VERSION) {
    throw new ConfigError(
      `unsupported .delivery/config.json schemaVersion ${raw.schemaVersion} (expected ${SCHEMA_VERSION})`,
    );
  }
  return mergeDeep(DEFAULT_CONFIG, raw);
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
      budgets: config.budgets,
      pricingVersion: config.pricingVersion || null,
    },
  };
}

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
import { atomicWriteJsonSync, readJsonIfExists } from "./fsx.mjs";

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
  errors: Object.freeze({
    maxAutoRetries: 2,
    extraQuotaPatterns: Object.freeze([]),
  }),
  budgets: Object.freeze({
    laneDefaults: Object.freeze({
      fast: Object.freeze({ maxUsd: 0.5, maxTokens: 500_000, warnPct: 0.8 }),
      standard: Object.freeze({ maxUsd: 2, maxTokens: 2_000_000, warnPct: 0.8 }),
      deep: Object.freeze({ maxUsd: 5, maxTokens: 5_000_000, warnPct: 0.8 }),
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

const ROOT_KEYS = new Set(["schemaVersion", "pricingVersion", "providers", "effortMap", "routing", "context", "transcript", "errors", "budgets"]);
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
const BUDGET_LANES = new Set(["fast", "standard", "deep"]);
const BUDGET_ENVELOPE_KEYS = new Set(["maxUsd", "maxTokens", "warnPct"]);

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
  for (const section of ["effortMap", "routing", "context", "transcript", "budgets"]) {
    if (raw[section] !== undefined) assertPlainObject(raw[section], `$.${section}`);
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
        if (envelope.maxUsd != null && envelope.maxUsd <= 0) throw validationError(`${path}.maxUsd`, "must be positive");
        if (envelope.maxTokens != null && envelope.maxTokens <= 0) throw validationError(`${path}.maxTokens`, "must be positive");
        if (envelope.warnPct != null && (envelope.warnPct <= 0 || envelope.warnPct >= 1)) {
          throw validationError(`${path}.warnPct`, "must be greater than 0 and less than 1");
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
 * @returns {object}
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

// scripts/delivery/classify.mjs
// Deterministic capability classifier over packet text + spec-declared affected
// paths (keywords, globs, campaign) → capability keys defined in agent-registry.mjs.
// The classifier owns the *rules*; the registry owns the *definitions*.
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/3 - State Machine, Packet & Classifier.md §5.
//
// Zero-dependency: only imports agent-registry.mjs (itself zero-dependency).

import { getAgent, isEnabledForPhase1 } from "./agent-registry.mjs";

export class ClassifyError extends Error {}

/** Mandatory rows — the server/UI must reject any attempt to drop these (doc 3 §5). */
export const ALWAYS_ON_CAPABILITIES = Object.freeze([
  "automated-testing",
  "code-review",
  "uat-generation",
]);

/** Every capability key this classifier can ever emit — checked against the registry at startup. */
export const CLASSIFIER_CAPABILITY_KEYS = Object.freeze([
  "automated-testing",
  "code-review",
  "uat-generation",
  "product-ba-refinement",
  "backend-impl",
  "frontend-impl",
  "money-domain",
]);

const FRONTEND_GLOB_ROOTS = Object.freeze(["src/app", "src/components", "src/features"]);
const API_GLOB_ROOT = "src/app/api";
const API_KEYWORD_RE = /api|route|endpoint|cron/i;
const MONEY_KEYWORD_RE = /balance|amount|transaction|transfer|debt|allocat/i;
const VAGUE_WORD_CEILING = 8;

function wordCount(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function globRoot(glob) {
  return String(glob || "").replace(/\/?\*+$/, "");
}

/** True when `glob`'s literal root sits at/under `rootPrefix`, or vice versa. */
function isUnderRoot(glob, rootPrefix) {
  const g = globRoot(glob);
  const r = globRoot(rootPrefix);
  if (!g || !r) return false;
  return g === r || g.startsWith(r + "/") || r.startsWith(g + "/");
}

function isApiGlob(glob) {
  return isUnderRoot(glob, API_GLOB_ROOT);
}

function isFrontendGlob(glob) {
  return FRONTEND_GLOB_ROOTS.some((root) => isUnderRoot(glob, root)) && !isApiGlob(glob);
}

/**
 * Verify every key this classifier can emit exists in the registry and is
 * enabled for the current phase (Phase 1). Called once at module load and
 * exported for an explicit unit test.
 */
export function assertClassifierKeysInRegistry() {
  for (const key of CLASSIFIER_CAPABILITY_KEYS) {
    const agent = getAgent(key);
    if (!agent) {
      throw new ClassifyError(`classifier capability key not present in registry: ${key}`);
    }
    if (!isEnabledForPhase1(key)) {
      throw new ClassifyError(`classifier capability key not enabled for phase1: ${key}`);
    }
  }
  return true;
}

// Fail fast if the rule table and the registry ever drift apart.
assertClassifierKeysInRegistry();

/**
 * Classify a packet-shaped object (`{item, scopeHints}`) into capability entries
 * matching the packet.json `capabilities[]` shape (doc 3 §1).
 * @param {object} packet - `{item:{text,campaign}, scopeHints:{keywords[],globs[]}}`
 * @returns {{name:string, reason:string, source:"rule", blocking:boolean}[]}
 */
export function classify(packet) {
  const item = (packet && packet.item) || {};
  const scopeHints = (packet && packet.scopeHints) || {};
  const text = item.text || "";
  const keywords = Array.isArray(scopeHints.keywords) ? scopeHints.keywords : [];
  const globs = Array.isArray(scopeHints.globs) ? scopeHints.globs : [];
  const haystack = [text, ...keywords].join(" ");

  const capabilities = [];
  const seen = new Set();

  function add(name, reason) {
    if (seen.has(name)) return;
    const agent = getAgent(name);
    if (!agent) {
      throw new ClassifyError(`classifier rule references unknown capability: ${name}`);
    }
    if (agent.status !== "enabled") {
      // The classifier must never select a planned (S5/S6) agent (doc 3 §5).
      throw new ClassifyError(`classifier cannot select non-enabled capability: ${name}`);
    }
    seen.add(name);
    capabilities.push({ name, reason, source: "rule", blocking: agent.blocking === "blocking" });
  }

  // Mandatory, always-on, locked rows.
  add("automated-testing", "always-on");
  add("code-review", "always-on");
  add("uat-generation", "always-on");

  // Optional rows — deterministic rule table.
  if (text.trim() && wordCount(text) < VAGUE_WORD_CEILING) {
    add("product-ba-refinement", "vague item (< 8 words)");
  }

  const underApiGlob = globs.some(isApiGlob);
  const apiKeywordHit = API_KEYWORD_RE.test(haystack);
  if (underApiGlob || apiKeywordHit) {
    add("backend-impl", underApiGlob ? "api glob" : "api keyword");
  }

  if (globs.some(isFrontendGlob)) {
    add("frontend-impl", "frontend glob");
  }

  if (item.campaign === "Budget" && MONEY_KEYWORD_RE.test(haystack)) {
    add("money-domain", "campaign=Budget + money keyword");
  }

  return capabilities;
}

/**
 * Remove owner-dropped optional capabilities from a classified set, rejecting
 * any attempt to drop a locked always-on row (doc 2 §5, doc 3 §5).
 * @param {{name:string}[]} capabilities
 * @param {string[]} dropNames
 */
export function applyCapabilityDrops(capabilities, dropNames = []) {
  for (const name of dropNames) {
    if (ALWAYS_ON_CAPABILITIES.includes(name)) {
      throw new ClassifyError(`cannot drop locked capability: ${name}`);
    }
  }
  return capabilities.filter((c) => !dropNames.includes(c.name));
}

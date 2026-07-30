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
const VAGUE_WORD_CEILING = 8;

// DLV-42 — money-domain used to be a bare substring regex over the item's own
// prose (`/balance|amount|transaction|transfer|debt|allocat/i`), which cannot
// tell "this edits money logic" from "this word appears in the description".
// BUD-14 ("Mobile expense form quick-**amount** chip: replace the $25 preset
// with $20") false-positived on `amount`, gained a *blocking* money-domain
// capability, and thereby defeated the DLV-39 triage gate that exists
// specifically to refuse items this trivial. The replacement needs two real
// signals instead of one weak one:
//
//  1. a money-logic **location** actually in scope, or
//  2. a money **operation** named in the text.
//
// A UI noun that merely contains a money word satisfies neither. This
// deliberately narrows the flag; the owner still sees every risk flag on the
// Flight-Check panel and can add `money-domain` back at launch, and the SPEC
// gate can add it once real affected paths are known.

// Locations where money is computed, posted, or persisted (CLAUDE.md's Finance
// domain + balance-utils). Matched against scope globs, not prose.
const MONEY_PATH_ROOTS = Object.freeze([
  "src/features/accounts",
  "src/features/transactions",
  "src/features/balance",
  "src/features/budget",
  "src/features/debts",
  "src/features/recurring",
  "src/features/transfers",
  "src/features/drafts",
  "src/features/analytics",
  "src/features/statement-import",
  "src/features/future-purchases",
  "src/lib/balance-utils",
  "src/app/api/accounts",
  "src/app/api/transactions",
  "src/app/api/transfers",
  "src/app/api/recurring",
  "src/app/api/debts",
]);

// Money *operations* — verbs and compound nouns that describe changing or
// deriving money state, rather than any word that happens to be money-adjacent.
// Note the absence of a bare `amount`: "quick-amount chip", "amount field",
// "amount label" are presentation, and that single word was the entire cause of
// the false positive this rule replaces.
const MONEY_OPERATION_RE = new RegExp(
  [
    "\\bbalances?\\b",
    "\\btransactions?\\b",
    "\\btransfers?\\b",
    "\\bdebts?\\b",
    "\\ballocat\\w*",
    "\\brecurring\\s+payment",
    "\\bsplit\\s+bill",
    "\\brefund\\w*",
    "\\bpost(?:s|ing|ed)?\\s+(?:to|a|the)\\b",
    "\\brounding\\b",
    "\\bcurrency\\b",
    "\\bexchange\\s+rate",
    "\\bledger\\b",
    "\\benvelope\\w*",
    "\\breconcil\\w*",
    "\\bdouble[-\\s]?count\\w*",
    "\\b(?:total|sum|subtotal)\\s+(?:is|are|was|were|calculat\\w*|wrong|incorrect|off)\\b",
    "\\bamount\\s+(?:is|are|was|were|calculat\\w*|stored|saved|persist\\w*|wrong|incorrect|posted)\\b",
  ].join("|"),
  "i",
);

function isMoneyGlob(glob) {
  return MONEY_PATH_ROOTS.some((root) => isUnderRoot(glob, root));
}

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

  // DLV-42: two real signals, not one weak substring match — see MONEY_PATH_ROOTS.
  // `text` only (not `haystack`): scope-hint keywords are a mechanical split of
  // the item's own words, so folding them in would just re-admit the prose match
  // this rule exists to eliminate.
  if (item.campaign === "Budget") {
    const moneyGlob = globs.find(isMoneyGlob);
    if (moneyGlob) {
      add("money-domain", `money-logic path in scope (${moneyGlob})`);
    } else if (MONEY_OPERATION_RE.test(text)) {
      add("money-domain", "money operation named in item");
    }
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

/**
 * Capabilities whose presence must veto a triage refusal, because each means the
 * pipeline's oversight is genuinely worth its floor:
 *   - `money-domain` — registry `blocking`; money correctness is never trivial.
 *   - `product-ba-refinement` — registry `advisory`, but it fires precisely
 *     because the item is too vague to act on, and a vague item needs
 *     DISCOVERY's clarifying pass rather than a "just edit it yourself".
 * `frontend-impl` / `backend-impl` are deliberately absent: the registry
 * declares neither as blocking or advisory, because they are **routing**
 * signals, not risk signals — their reasons are literally `"frontend glob"` /
 * `"api glob"`, derived from where a file lives and never from what the change
 * does, and their job is to attach the right skill.
 */
const TRIAGE_VETO_CAPABILITIES = Object.freeze(new Set(["money-domain", "product-ba-refinement"]));

/**
 * Triage signal (D11/DLV-39) — is this item too trivial to be worth the
 * pipeline's own floor?
 *
 * **DLV-59 rewrite.** The original rule was `S-effort && riskFlags.length === 0`,
 * chosen because — in DLV-39's own words — "real changed files don't exist yet at
 * launch time, so 'single-file' isn't directly knowable pre-launch". Two things
 * made that rule fail in practice and then made it unnecessary:
 *
 *  1. It could never fire for a UI item. Every S-effort UI tweak in this repo
 *     carries `frontend-impl`, so `length === 0` was false for essentially the
 *     whole population the gate was written for. BUD-14 — a one-character preset
 *     change — launched, and spent **$0.5317 without writing a line of code**.
 *  2. Its stated blocker no longer holds. Since DLV-42, scope hints are built
 *     from the file paths the item's own text names (`scopeSource:
 *     "item-paths"`), so "this item touches exactly one file" **is** directly
 *     knowable at launch — a far stronger and more honest triviality signal than
 *     counting capability flags.
 *
 * So: S-effort, exactly one file named by the item itself, and no capability
 * that vetoes (above). Absence of named paths is treated as "not knowably
 * trivial" and never refused — silence is not evidence.
 *
 * Refusal is not a block: `TRIAGE_OVERRIDE_ACK` ("LAUNCH ANYWAY") remains, and
 * is recorded in the packet.
 * @param {({effort?:string}|null|undefined)} item
 * @param {{name:string}[]} riskFlags - launchPreview.riskFlags (optional capabilities)
 * @param {{globs?:string[], keywords?:string[], modules?:string[], scopeSource?:string}} [scopeHints]
 *   - the full `computeScopeHints` shape; omit for pre-DLV-42 callers
 */
export function isTrivialLaunchCandidate(item, riskFlags = [], scopeHints = null) {
  if (!item || item.effort !== "S") return false;
  const flags = riskFlags || [];
  // A veto beats every positive signal below.
  if (flags.some((f) => TRIAGE_VETO_CAPABILITIES.has(f && f.name))) return false;
  // Two independent, individually-conservative signals; either is sufficient.
  //  (a) the original rule — nothing optional was flagged at all. Still the only
  //      thing available for a prose-only item that names no path, and it is
  //      what catches items in campaigns with no glob table (the DLV-28 profile).
  //  (b) DLV-59 — the item's own text names exactly one file. Positive evidence
  //      of single-file-ness, which (a) can never supply for a UI item because
  //      `frontend-impl` is always present there.
  // Neither is a superset of the other, so this is a union rather than a
  // replacement: narrowing to (b) alone silently stopped refusing the very
  // profile the gate was first written against.
  if (flags.length === 0) return true;
  return !!scopeHints && scopeHints.scopeSource === "item-paths" && (scopeHints.globs || []).length === 1;
}

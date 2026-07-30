// scripts/delivery/scope.mjs
// DLV-7: the scope contract — measured scope estimate, runner-computed size
// class, effort mismatch verdict, and the post-PLAN scope lock.
//
// Zero-dependency and pure, for the same reason `classify.mjs` is: the launch
// UI (a browser bundle) and the runner (node) must reach the *same* verdict
// from the same inputs, so neither can be the one that owns the rule.
//
// Why the runner computes `sizeClass` rather than reading the agent's own:
// BUD-11's spec turn declared an S item and then measured 25 files and 72
// occurrences in its own artifacts without ever revisiting the label. A model
// grading its own homework is not a tripwire. The agent supplies the three
// counts it can actually measure; the size class is derived here, from
// owner-set thresholds.

/** Size classes, smallest first. Also the effort vocabulary `parseTaskMeta` extracts from a checklist line. */
export const SIZE_CLASSES = Object.freeze(["S", "M", "L"]);

const AXES = Object.freeze(["files", "occurrences", "modules"]);

/** Fallback thresholds, mirroring `DEFAULT_CONFIG.scope.thresholds` for callers with no config in hand. */
export const DEFAULT_THRESHOLDS = Object.freeze({
  S: Object.freeze({ files: 2, occurrences: 5, modules: 1 }),
  M: Object.freeze({ files: 8, occurrences: 25, modules: 3 }),
});

/**
 * Coerce an item's `effort` (`"S"`, `"m"`, `"L "`, or something unparseable)
 * into a size class. Returns null rather than guessing — an item with no effort
 * recorded has no contract to violate, and inventing one would manufacture
 * mismatches out of missing data.
 * @param {unknown} effort
 * @returns {("S"|"M"|"L"|null)}
 */
export function normalizeSizeClass(effort) {
  if (typeof effort !== "string") return null;
  const value = effort.trim().toUpperCase();
  return SIZE_CLASSES.includes(value) ? /** @type {"S"|"M"|"L"} */ (value) : null;
}

function axisValue(estimate, axis) {
  const raw = estimate ? estimate[axis] : null;
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : null;
}

/**
 * True when every axis the estimate reports stays within `limits`. An axis the
 * estimate omits cannot disqualify the class — a missing measurement is not
 * evidence of largeness.
 */
function withinLimits(estimate, limits) {
  if (!limits) return false;
  return AXES.every((axis) => {
    const value = axisValue(estimate, axis);
    const limit = limits[axis];
    if (value == null || limit == null) return true;
    return value <= limit;
  });
}

/**
 * Derive the size class of a measured scope estimate.
 * @param {{files?:(number|null), occurrences?:(number|null), modules?:(number|null),
 *   note?:(string|null)}|null} estimate
 * @param {{S?:object, M?:object}} [thresholds]
 * @returns {("S"|"M"|"L"|null)} null only when the estimate reports no usable axis at all.
 */
export function classifyScopeSize(estimate, thresholds = DEFAULT_THRESHOLDS) {
  if (!estimate || typeof estimate !== "object") return null;
  const measured = AXES.some((axis) => axisValue(estimate, axis) != null);
  if (!measured) return null;
  if (withinLimits(estimate, thresholds.S)) return "S";
  if (withinLimits(estimate, thresholds.M)) return "M";
  return "L";
}

/**
 * Validate the shape of an agent-reported scope estimate. Returns a normalized
 * estimate (integers only) or null — deliberately lenient about *absence* and
 * strict about *garbage*, so a spec that simply predates this field degrades to
 * "not reported" while one that reports `files: "lots"` does not silently
 * become `files: 0`.
 * @param {unknown} raw
 * @returns {{files:(number|null), occurrences:(number|null), modules:(number|null), note:(string|null)}|null}
 */
export function normalizeScopeEstimate(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const estimate = /** @type {Record<string, unknown>} */ (raw);
  const out = { files: null, occurrences: null, modules: null, note: null };
  let sawAny = false;
  for (const axis of AXES) {
    const value = estimate[axis];
    if (value === undefined || value === null) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    out[axis] = Math.floor(value);
    sawAny = true;
  }
  if (typeof estimate.note === "string" && estimate.note.trim()) out.note = estimate.note.trim();
  return sawAny ? out : null;
}

/**
 * The SPEC-gate verdict: what the item claimed, what DISCOVERY measured, and
 * whether the two disagree in the direction that costs money (measured bigger
 * than declared).
 *
 * A measured scope *smaller* than the declared effort is recorded but never
 * flagged — an L item that turns out to be S is a pleasant surprise, and
 * treating it as a violation would train the owner to wave the gate through.
 *
 * @param {{estimate:object|null, itemEffort:unknown, thresholds?:object, lane?:string|null}} args
 * @returns {{estimate:object|null, sizeClass:(string|null), itemSizeClass:(string|null),
 *   mismatch:boolean, direction:("over"|"under"|"match"|"unknown"), reason:string}}
 */
export function buildScopeVerdict({ estimate, itemEffort, thresholds = DEFAULT_THRESHOLDS, lane = null }) {
  const normalized = normalizeScopeEstimate(estimate);
  const sizeClass = classifyScopeSize(normalized, thresholds);
  const itemSizeClass = normalizeSizeClass(itemEffort);

  if (!normalized || !sizeClass) {
    return {
      estimate: normalized,
      sizeClass: null,
      itemSizeClass,
      mismatch: false,
      direction: "unknown",
      reason: "DISCOVERY reported no measurable scope estimate — scope was not checked against the item's effort.",
    };
  }
  if (!itemSizeClass) {
    return {
      estimate: normalized,
      sizeClass,
      itemSizeClass: null,
      mismatch: false,
      direction: "unknown",
      reason: `Measured ${sizeClass}-sized scope. The work item records no effort class, so there is nothing to compare it against.`,
    };
  }

  const measuredRank = SIZE_CLASSES.indexOf(sizeClass);
  const declaredRank = SIZE_CLASSES.indexOf(itemSizeClass);
  if (measuredRank > declaredRank) {
    const detail = [
      normalized.files != null ? `${normalized.files} file(s)` : null,
      normalized.occurrences != null ? `${normalized.occurrences} occurrence(s)` : null,
      normalized.modules != null ? `${normalized.modules} module(s)` : null,
    ].filter(Boolean).join(", ");
    return {
      estimate: normalized,
      sizeClass,
      itemSizeClass,
      mismatch: true,
      direction: "over",
      reason:
        `The work item is filed as ${itemSizeClass}-effort, but DISCOVERY measured ${sizeClass}-sized scope (${detail})` +
        `${lane ? ` on the ${String(lane).toUpperCase()} lane` : ""}. ` +
        "Approve the decomposition below to narrow this session to one slice, or acknowledge the mismatch to build the whole thing as specified.",
    };
  }
  return {
    estimate: normalized,
    sizeClass,
    itemSizeClass,
    mismatch: false,
    direction: measuredRank === declaredRank ? "match" : "under",
    reason:
      measuredRank === declaredRank
        ? `Measured ${sizeClass}-sized scope, matching the item's ${itemSizeClass} effort.`
        : `Measured ${sizeClass}-sized scope, smaller than the item's declared ${itemSizeClass} effort.`,
  };
}

/**
 * Normalize an agent-proposed decomposition into 2–4 slices. Anything outside
 * that range, or missing a title, is rejected wholesale rather than partially
 * repaired — a half-parsed decomposition presented as an owner choice is worse
 * than none, because the owner cannot see what was dropped.
 * @param {unknown} raw
 * @returns {Array<{title:string, rationale:(string|null), acceptanceCriteriaIds:string[]}>|null}
 */
export function normalizeDecomposition(raw) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 4) return null;
  const slices = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    if (!title) return null;
    const ids = Array.isArray(entry.acceptanceCriteriaIds)
      ? entry.acceptanceCriteriaIds.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim())
      : [];
    slices.push({
      title,
      rationale: typeof entry.rationale === "string" && entry.rationale.trim() ? entry.rationale.trim() : null,
      acceptanceCriteriaIds: ids,
    });
  }
  return slices;
}

// ---- post-PLAN scope lock ----

/**
 * Freeze what the approved plan committed to: the AC ids in play and the union
 * of every step's declared paths. This is the reference the BUILDING phase is
 * checked against, so expansion becomes an owner decision instead of a silent
 * descope-or-sprawl (BUD-11 did both — it grew to 25 files, then quietly
 * shipped 5 hooks' worth and called it complete).
 * @param {{plan:object, spec:object|null}} args
 */
export function buildScopeLock({ plan, spec }) {
  const paths = new Set();
  for (const step of (plan && plan.steps) || []) {
    for (const p of (step && step.paths) || []) {
      if (typeof p === "string" && p.trim()) paths.add(p.trim().replace(/\\/g, "/"));
    }
  }
  const acceptanceCriteriaIds = ((spec && spec.acceptanceCriteria) || [])
    .map((ac) => (ac && typeof ac.id === "string" ? ac.id : null))
    .filter(Boolean);
  return {
    lockedAt: new Date().toISOString(),
    paths: [...paths],
    acceptanceCriteriaIds,
    stepIds: ((plan && plan.steps) || []).map((s) => (s && s.id) || null).filter(Boolean),
  };
}

/** Glob→RegExp with the same semantics as the runner's forbidden-path matcher (`*` within a segment, `**` across). */
function globToRegExp(glob) {
  const marker = "\u0000";
  const withMarker = String(glob).split("**").join(marker);
  const escaped = withMarker.replace(/[.+^${}()|[\]\\]/g, "\\$&").split("*").join("[^/]*");
  const expanded = escaped.split(marker).join(".*");
  return new RegExp(`^${expanded}$`);
}

/**
 * Which of `changedPaths` fall outside the locked scope. A locked entry may be
 * a literal path, a directory prefix, or a glob — plans in this repo write all
 * three (`src/lib/x.ts`, `src/features/items/`, `src/app/api/**`).
 * @param {string[]} changedPaths
 * @param {{paths?:string[]}|null} lock
 * @returns {string[]}
 */
export function pathsOutsideScope(changedPaths, lock) {
  const locked = (lock && lock.paths) || [];
  if (!locked.length) return [];
  const matchers = locked.map((entry) => {
    const normalized = entry.replace(/\\/g, "/");
    if (normalized.includes("*")) return (p) => globToRegExp(normalized).test(p);
    if (normalized.endsWith("/")) return (p) => p.startsWith(normalized);
    return (p) => p === normalized || p.startsWith(`${normalized}/`);
  });
  return (changedPaths || [])
    .map((p) => String(p || "").replace(/\\/g, "/"))
    .filter((p) => p && !matchers.some((match) => match(p)));
}

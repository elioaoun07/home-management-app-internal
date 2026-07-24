// scripts/delivery/validation-baseline.mjs
// Pure baseline, delta, and change-ownership semantics. The runner supplies
// command output and git snapshots; this module never spawns processes.

export const DIRTY_TREE_ACK = "DIRTY TREE";
export const RED_BASELINE_ACK = "RED BASELINE";

function normalizePath(path) {
  return String(path == null ? "" : path)
    .trim()
    .replace(/\\/g, "/");
}

function normalizeSignature(text) {
  return String(text == null ? "" : text)
    .trim()
    .replace(/\s+/g, " ");
}

function addFailure(records, file, signature) {
  const normalizedFile = normalizePath(file);
  if (!normalizedFile) return;
  records.push({ file: normalizedFile, signature: normalizeSignature(signature) });
}

/**
 * Extract comparable diagnostics. Locations are intentionally excluded from
 * signatures: moving a pre-existing error does not create a new failure.
 * @param {string} excerpt
 * @returns {{file:string, signature:string}[]}
 */
export function extractValidationFailures(excerpt) {
  const text = String(excerpt == null ? "" : excerpt);
  const records = [];

  const tscRe = /^([^\s(][^\n():]*\.(?:ts|tsx|mts|cts))\(\d+,\d+\):\s*(error\s+TS\d+:\s*.*)$/gm;
  for (const match of text.matchAll(tscRe)) addFailure(records, match[1], match[2]);

  const vitestRe = /^\s*(?:FAIL|[^\s]+)\s+([^\s].*?\.(?:ts|tsx|js|jsx|mjs|cjs))\b(.*)$/gm;
  for (const match of text.matchAll(vitestRe)) addFailure(records, match[1], match[2] || "test failure");

  const lines = text.split(/\r?\n/);
  let eslintFile = null;
  for (const line of lines) {
    const fileMatch = line.match(/^([^\s].*?\.(?:ts|tsx|js|jsx|mjs|cjs))\s*$/);
    if (fileMatch) {
      eslintFile = fileMatch[1];
      continue;
    }
    const diagnostic = eslintFile && line.match(/^\s+\d+:\d+\s+(error|warning)\s+(.*)$/);
    if (diagnostic) {
      addFailure(records, eslintFile, `${diagnostic[1]} ${diagnostic[2]}`);
      continue;
    }
    if (line.trim()) eslintFile = null;
  }

  return records;
}

/**
 * Extract source paths from a validation excerpt, de-duplicated in encounter
 * order.
 * @param {string} excerpt
 * @returns {string[]}
 */
export function extractFailingFiles(excerpt) {
  const found = [];
  const seen = new Set();
  for (const failure of extractValidationFailures(excerpt)) {
    if (!seen.has(failure.file)) {
      seen.add(failure.file);
      found.push(failure.file);
    }
  }
  return found;
}

/** Best-effort diagnostic count used by the delta gate. */
export function countValidationFailures(result) {
  if (!result || result.ok) return 0;
  if (Number.isInteger(result.failureCount) && result.failureCount >= 0) return result.failureCount;
  const records = extractValidationFailures(result.excerpt);
  if (records.length) return records.length;
  const summary = String(result.excerpt || "").match(/\b(\d+)\s+(?:errors?|failed|failures?|problems?)\b/i);
  return summary ? Number(summary[1]) : null;
}

function multiset(records) {
  const counts = new Map();
  for (const record of records) {
    const key = `${record.file}\0${record.signature}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function newFailuresAgainstBaseline(current, baseline) {
  const remaining = multiset(baseline);
  const added = [];
  for (const record of current) {
    const key = `${record.file}\0${record.signature}`;
    const count = remaining.get(key) || 0;
    if (count > 0) remaining.set(key, count - 1);
    else added.push(record);
  }
  return added;
}

/**
 * Build the ownership vocabulary consumed by DLV-12's finish manifest.
 * A file dirty before launch is never session-owned; if a build turn also
 * touches it, ownership becomes shared.
 */
export function classifyChangeOwnership(preExistingFiles = [], sessionTouchedFiles = []) {
  const preExisting = new Set(preExistingFiles.map(normalizePath).filter(Boolean));
  const touched = new Set(sessionTouchedFiles.map(normalizePath).filter(Boolean));
  const all = [...new Set([...preExisting, ...touched])].sort();
  return all.map((path) => ({
    path,
    ownership: preExisting.has(path) ? (touched.has(path) ? "shared" : "not-session-owned") : "session-owned",
  }));
}

/**
 * Classify a validation run against its launch baseline.
 *
 * A failing command passes on delta only when it has the same-or-fewer
 * failures and introduces no new diagnostic in a session-touched file.
 * Unknown output fails conservatively unless it is identical to the baseline
 * or both runs timed out.
 *
 * @param {{ok:boolean, results:Object<string,{ok:boolean, excerpt:string}>}} validation
 * @param {{ok:boolean, results:Object<string,{ok:boolean, excerpt:string}>}|null} [baseline]
 * @param {{touchedFiles?:string[]}} [options]
 */
export function classifyValidationFailure(validation, baseline = null, options = {}) {
  const preExistingCommands = [];
  const attributableCommands = [];
  const commandDeltas = {};
  const touched = new Set((options.touchedFiles || []).map(normalizePath).filter(Boolean));

  for (const [key, result] of Object.entries((validation && validation.results) || {})) {
    if (!result || result.ok) continue;
    const baselineResult = baseline && baseline.results ? baseline.results[key] : null;
    if (!baselineResult || baselineResult.ok) {
      attributableCommands.push(key);
      commandDeltas[key] = { status: "regressed", reason: "command passed or was absent in baseline" };
      continue;
    }
    if (result.timedOut && baselineResult.timedOut) {
      preExistingCommands.push(key);
      commandDeltas[key] = { status: "baseline-equivalent", reason: "same timeout" };
      continue;
    }

    const currentFailures = extractValidationFailures(result.excerpt);
    const baselineFailures = extractValidationFailures(baselineResult.excerpt);
    const currentCount = countValidationFailures(result);
    const baselineCount = countValidationFailures(baselineResult);
    const newFailures = newFailuresAgainstBaseline(currentFailures, baselineFailures);
    const newTouchedFailures = newFailures.filter((failure) => touched.has(failure.file));
    const exactFallback =
      currentCount == null &&
      baselineCount == null &&
      normalizeSignature(result.excerpt) === normalizeSignature(baselineResult.excerpt);
    const sameOrFewer = exactFallback || (currentCount != null && baselineCount != null && currentCount <= baselineCount);
    const passes = sameOrFewer && newTouchedFailures.length === 0;

    commandDeltas[key] = {
      status: passes ? "baseline-equivalent" : "regressed",
      baselineFailures: baselineCount,
      currentFailures: currentCount,
      newTouchedFailures,
    };
    if (passes) preExistingCommands.push(key);
    else attributableCommands.push(key);
  }

  return {
    attributable: attributableCommands.length > 0,
    passesDelta: attributableCommands.length === 0,
    preExistingCommands,
    attributableCommands,
    commandDeltas,
  };
}

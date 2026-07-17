// scripts/delivery/validation-baseline.mjs
// Distinguishes a validation failure this session actually caused from one
// that was already broken before the session started.
//
// Root cause (BUD-11 session forensics, s-20260715-214421-hvfk): the
// workspace was dirty at session start (`dirtyAtStart: true`) with an
// unrelated pre-existing typecheck error in `tests/pm-ui/lint-rules.test.ts`.
// `handleValidating` runs `pnpm typecheck/lint/test` repo-wide with no
// baseline to compare against, so every validation cycle failed on that same
// pre-existing error — and the fix loop spent all 3 attempts (each a full
// guarded turn) asking a (readonly, per root cause #1) agent to fix a file it
// never touched and didn't break, before exhausting and blocking. None of
// that turn spend was ever attributable to the session's own work.
//
// Pure string/data functions only — the runner (run-session.mjs) supplies the
// actual `runValidationCommands` output; this module never spawns anything.

/**
 * Extract plausible source-file paths from a validation command's tail-
 * truncated stdout/stderr excerpt. Best-effort across the three tools this
 * runner shells out to — not a full parser, just enough to tell "same file
 * failing as before" from "a new file started failing":
 *  - tsc:     "path/to/file.ts(10,5): error TS2353: ..."
 *  - vitest:  " FAIL  path/to/file.test.ts" / "✗ path/to/file.test.ts"
 *  - eslint:  a bare file path alone on its own line (stylish formatter)
 * @param {string} excerpt
 * @returns {string[]} de-duplicated, order-preserving
 */
export function extractFailingFiles(excerpt) {
  const text = String(excerpt == null ? "" : excerpt);
  const found = [];
  const seen = new Set();
  const add = (path) => {
    const p = path.trim().replace(/\\/g, "/");
    if (p && !seen.has(p)) {
      seen.add(p);
      found.push(p);
    }
  };

  const tscRe = /^([^\s(][^\n():]*\.(?:ts|tsx|mts|cts))\(\d+,\d+\):\s*error/gm;
  for (const m of text.matchAll(tscRe)) add(m[1]);

  const vitestRe = /^\s*(?:FAIL|✗|×)\s+([^\s].*?\.(?:ts|tsx|js|jsx|mjs|cjs))\b/gm;
  for (const m of text.matchAll(vitestRe)) add(m[1]);

  // eslint "stylish": a bare relative/absolute path alone on its own line,
  // immediately followed by one or more indented "line:col  error/warning" rows.
  const eslintRe = /^([^\s].*?\.(?:ts|tsx|js|jsx|mjs|cjs))\s*$\n(?:\s+\d+:\d+\s+(?:error|warning)\b)/gm;
  for (const m of text.matchAll(eslintRe)) add(m[1]);

  return found;
}

/**
 * Classify a failed validation run against an optional baseline (captured
 * once at session start when the workspace was already dirty — see
 * `handleSelected`). A command's failure is treated as pre-existing only when
 * every file it names as failing was *also* failing, by name, in the
 * baseline run of the same command — i.e. this session provably changed
 * nothing about that failure. Anything we can't positively match against the
 * baseline (no baseline, unparseable excerpt, a file that wasn't failing
 * before) is treated as attributable — fail toward spending a fix turn, not
 * toward silently skipping one.
 * @param {{ok:boolean, results:Object<string,{ok:boolean, excerpt:string}>}} validation
 * @param {{ok:boolean, results:Object<string,{ok:boolean, excerpt:string}>}|null} [baseline]
 * @returns {{attributable:boolean, preExistingCommands:string[], attributableCommands:string[]}}
 */
export function classifyValidationFailure(validation, baseline = null) {
  const preExistingCommands = [];
  const attributableCommands = [];
  for (const [key, result] of Object.entries((validation && validation.results) || {})) {
    if (!result || result.ok) continue;
    const baselineResult = baseline && baseline.results ? baseline.results[key] : null;
    if (!baselineResult || baselineResult.ok) {
      attributableCommands.push(key);
      continue;
    }
    const currentFiles = extractFailingFiles(result.excerpt);
    const baselineFiles = new Set(extractFailingFiles(baselineResult.excerpt));
    const allPreExisting = currentFiles.length > 0 && currentFiles.every((f) => baselineFiles.has(f));
    if (allPreExisting) preExistingCommands.push(key);
    else attributableCommands.push(key);
  }
  return {
    attributable: attributableCommands.length > 0,
    preExistingCommands,
    attributableCommands,
  };
}

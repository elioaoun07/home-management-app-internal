// scripts/delivery/locate.mjs
// DLV-73 — zero-token code locator, run at Flight-Check *before* a session exists.
//
// The problem it solves: the INSTANT lane's whole premise is two model turns, and
// a turn spent finding the file is a turn that should not have been paid for. Today
// the only locating machinery is DLV-42's `explicitPathsInText` — which works
// beautifully when the checklist line names its target:
//
//   "… replace the $25 preset with $20 → `src/components/expense/MobileExpenseForm.tsx:1144`"
//
// and does nothing at all when it doesn't. The owner does not always have the path
// to hand, and "I don't know where it lives" is not a reason to buy a DISCOVERY turn
// at ~$0.10 to run three greps.
//
// So this module reproduces those three greps deterministically, for free, and does
// it early enough that an ambiguous result becomes a *pre-launch picker* rather than
// a mid-session question. That ordering is the real saving: a question raised inside
// DISCOVERY parks at NEEDS_DECISION and re-enters the phase on answer — a second full
// turn. A question asked at Flight-Check costs nothing and is answered before the
// session is spawned.
//
// **What `confidence` means.** It describes the *file*, not the line. Deciding
// "MobileExpenseForm.tsx" from prose is a solvable retrieval problem; deciding which
// of its four `25`s is the preset is not, and pretending otherwise would hand the
// read-window an authoritative-looking wrong offset. `line` is a best-effort anchor
// for a 120-line window (see prompts.mjs's READ_WINDOW_BEFORE) and the agent's own
// Grep pins the exact site inside it. Naming a file for free and letting a bounded
// window absorb the residual uncertainty is the whole trade.
//
// Rejected alternatives (Delivery Master Book, INSTANT amendment):
//   - a locator subagent — costs the turn this exists to remove;
//   - graphify's AST symbol index — ~10s and zero tokens, but `graphify-out/graph.json`
//     is a build artifact that goes stale silently (built 2026-07-11; 119 `src/` files
//     changed before this was written), and a stale line number poisons the read window
//     in the one direction that is expensive and invisible.
// ripgrep is always correct because it reads the working tree.
//
// Zero-dependency beyond node builtins, and every side effect is injectable so the
// unit tests never touch the real repo or spawn a process.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export class LocateError extends Error {}

/** Where the Feature Map router lives, relative to the repo root. */
export const FEATURE_MAP_REL = "ERA Notes/01 - Architecture/Feature Map";

/**
 * DLV-42's path matcher, relocated here so the locator owns the whole
 * item-text→path story. `server-routes.mjs` re-exports it, keeping its existing
 * public surface intact.
 */
const EXPLICIT_PATH_RE = /(?:^|[\s`(<→])((?:src|scripts|migrations|tests|public)\/[\w./-]*[\w-]\.\w{1,5})(?::\d+)?/g;

/**
 * Repo-relative source paths the item text names outright, de-duplicated in
 * first-appearance order. Empty when the item only describes its target in prose.
 * @param {string} text
 * @returns {string[]}
 */
export function explicitPathsInText(text) {
  const out = [];
  for (const match of String(text || "").matchAll(EXPLICIT_PATH_RE)) {
    const path = match[1];
    if (!out.includes(path)) out.push(path);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Literal extraction
// ---------------------------------------------------------------------------

// Words that appear in nearly every checklist line and would match half the repo.
// Deliberately short: this is a stop-list for *literals to grep*, not a semantic
// filter — anything genuinely non-distinctive is caught downstream by
// MAX_HITS_PER_LITERAL instead, which measures distinctiveness rather than guessing it.
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "when", "then", "than",
  "add", "fix", "use", "set", "make", "show", "hide", "move", "keep", "not", "but",
  "replace", "update", "change", "remove", "rename", "should", "must", "page", "form",
  "button", "screen", "mobile", "desktop", "view", "click", "tap", "test", "todo",
]);

/**
 * Tokens worth grepping for, most-distinctive first.
 *
 * The ranking matters more than the extraction: a quoted string or a `$25` is
 * evidence about *this* change, while a bare `20` is a coin flip, and searching
 * them in that order means the good signal lands before the noise budget runs out.
 *
 * @param {string} text
 * @returns {{value:string, kind:string, weight:number}[]}
 */
export function extractLiterals(text) {
  const src = String(text || "");
  const out = [];
  const seen = new Set();
  const push = (value, kind, weight) => {
    const v = String(value || "").trim();
    if (!v || v.length < 2) return;
    if (seen.has(v)) return;
    seen.add(v);
    out.push({ value: v, kind, weight });
  };

  // Quoted strings — the strongest signal available: someone typed the exact
  // source text they meant.
  for (const m of src.matchAll(/["'`]([^"'`\n]{2,60})["'`]/g)) push(m[1], "quoted", 5);
  // Currency-tagged numbers: "$25" is about money in the UI, "25" might be a
  // tailwind class. Both are searched, but not as equals.
  for (const m of src.matchAll(/\$\s?(\d+(?:\.\d+)?)/g)) push(m[1], "amount", 4);
  // camelCase / PascalCase identifiers — real symbol names.
  for (const m of src.matchAll(/\b([a-z]+[A-Z]\w*|[A-Z][a-z]+[A-Z]\w*)\b/g)) push(m[1], "identifier", 4);
  // kebab / snake compounds, e.g. "quick-amount", "month_start".
  for (const m of src.matchAll(/\b([a-z]{2,}[-_][a-z][\w-]*)\b/g)) push(m[1], "compound", 3);
  // Bare numbers, last and cheapest.
  for (const m of src.matchAll(/(?<![\w.$])(\d{1,6})(?![\w.])/g)) push(m[1], "number", 1);
  // Distinctive bare words, as a floor for prose-only items that contain none
  // of the above.
  for (const m of src.matchAll(/\b([a-z]{4,})\b/gi)) {
    const w = m[1].toLowerCase();
    if (!STOP_WORDS.has(w)) push(w, "word", 1);
  }

  return out.sort((a, b) => b.weight - a.weight);
}

// ---------------------------------------------------------------------------
// Feature Map parsing
// ---------------------------------------------------------------------------

/**
 * Parse `_index.md`'s "Quick lookup by user intent" table into phrase→module
 * pairs. The table's rows are pipe-separated *without* leading/trailing pipes
 * (see the file), and the right cell is always a markdown link to the module doc.
 *
 * Phrases are usually double-quoted and slash-separated ("the expense form" /
 * "logging a spend"), but not always — the healthcare row is bare prose. Both
 * shapes are handled rather than requiring the vault to be reformatted: this is
 * a reader of an owner-maintained doc, and a parser that silently drops a row
 * whose punctuation drifted is worse than one that over-collects.
 *
 * @param {string} indexText
 * @returns {{phrases:string[], modulePath:string}[]}
 */
export function parseFeatureMapIndex(indexText) {
  const entries = [];
  for (const rawLine of String(indexText || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.includes("|")) continue;
    const linkMatch = line.match(/\[[^\]]+\]\(([^)]+\.md)\)/);
    if (!linkMatch) continue;
    const modulePath = linkMatch[1].replace(/^\.\//, "");
    // Only the intent table's first cell; the module tables further down have
    // three cells and their link is last, so taking cell[0] works for both.
    const left = line.split("|")[0].trim();
    if (!left || left === "---") continue;

    const phrases = [];
    for (const m of left.matchAll(/"([^"]+)"/g)) phrases.push(m[1].toLowerCase());
    if (phrases.length === 0) {
      // Unquoted row: split on the same "/" separator the quoted rows use.
      for (const part of left.split("/")) {
        const p = part.trim().toLowerCase();
        if (p && p.length > 2) phrases.push(p);
      }
    }
    if (phrases.length) entries.push({ phrases, modulePath });
  }
  return entries;
}

/**
 * Repo-relative source paths a module doc names, from anywhere in it.
 *
 * Deliberately not restricted to the "Files at a glance" section: the "Common
 * edit scenarios" section is frequently *more* precise ("Change the expense form
 * layout on mobile" → `MobileExpenseForm.tsx`), and a directory-shaped entry
 * (`src/app/qr/expense/`) is a perfectly good rg root. Over-collecting here is
 * cheap — these are only candidate roots for a grep that has to run anyway.
 *
 * @param {string} moduleText
 * @returns {string[]}
 */
export function parseModuleFilePaths(moduleText) {
  const out = [];
  for (const m of String(moduleText || "").matchAll(/`((?:src|scripts|migrations|public)\/[\w./[\]-]+)`/g)) {
    const path = m[1];
    if (!out.includes(path)) out.push(path);
  }
  return out;
}

/** Filler words inside Feature Map phrases — they carry no routing signal. */
const PHRASE_STOP = new Set([
  "the", "a", "an", "my", "our", "what", "should", "i", "to", "with", "from",
  "on", "in", "of", "and", "or", "is", "it", "that", "this", "we", "re",
]);

function contentTokens(phrase) {
  return String(phrase || "")
    .toLowerCase()
    .replace(/[^\w\s/-]/g, " ")
    .split(/[\s/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !PHRASE_STOP.has(t));
}

/**
 * Rank Feature Map modules against the item text by phrase overlap.
 *
 * Matching is on *content tokens*, not the raw phrase substring. The substring
 * version looked simpler and silently failed the exact case this module exists
 * for: the Feature Map says `"the expense form"`, the checklist says "Mobile
 * expense form quick-amount chip", and a substring test finds no match because
 * of the word "the". Token overlap is the difference between routing BUD-14 and
 * returning `confidence: "none"` on it.
 *
 * Scoring is length- and arity-weighted on purpose: matching all of "the expense
 * form" is real evidence, matching "items" is nearly none, and an unweighted
 * count lets a dozen one-word coincidences outvote one exact phrase hit.
 *
 * @param {string} itemText
 * @param {{phrases:string[], modulePath:string}[]} entries
 * @returns {{modulePath:string, score:number, matched:string[]}[]}
 */
export function rankModules(itemText, entries) {
  const hayTokens = new Set(contentTokens(itemText));
  const scored = [];
  for (const entry of entries || []) {
    let score = 0;
    const matched = [];
    for (const phrase of entry.phrases) {
      const tokens = contentTokens(phrase);
      if (tokens.length === 0) continue;
      const present = tokens.filter((t) => hayTokens.has(t));
      if (present.length === 0) continue;
      // All tokens present is a real phrase match. A majority is partial credit —
      // enough to keep a module in the candidate set, not enough to win on its own.
      const complete = present.length === tokens.length;
      // Partial credit needs either two corroborating tokens, or one long enough
      // to be distinctive on its own. The stricter "majority of tokens" rule that
      // stood here rejected every two-token phrase that matched only half — so
      // `"the expense form"` → [expense, form] scored nothing against "Add Expense
      // button label", and the item routed nowhere. `expense` alone is plenty of
      // signal; `form` alone is not, and the length floor is what separates them.
      if (!complete && present.length < 2 && present[0].length < 6) continue;
      const weight = present.reduce((sum, t) => sum + Math.min(t.length, 12) / 10, 0);
      score += (complete ? 2 : 1) * (present.length + weight);
      matched.push(phrase);
    }
    if (score > 0) scored.push({ modulePath: entry.modulePath, score, matched });
  }
  return scored.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

/** Per-literal hit ceiling. Above this the literal is noise, not evidence. */
const MAX_HITS_PER_LITERAL = 30;
/** How many literals are worth scanning for. */
const MAX_LITERALS_SEARCHED = 8;
/** Files reported back to the Flight-Check. */
const MAX_REPORTED_HITS = 5;
/** Hard ceiling on files walked, so a mis-parsed root can't scan the repo. */
const MAX_FILES_SCANNED = 500;
/** Per-file size ceiling — a 2 MB generated bundle is never the answer. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const SCANNABLE_EXT = /\.(?:tsx?|jsx?|mjs|cjs|css|scss|sql|json|md)$/i;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage", ".delivery", "graphify-out"]);

/**
 * Expand repo-relative roots (files or directories) into a bounded file list.
 *
 * Originally this shelled out to ripgrep. It doesn't any more: `execFileSync("rg")`
 * throws ENOENT under Node on this machine even though `rg` resolves fine from the
 * shell, and more importantly a launch-blocking dependency on an external binary
 * being on PATH is a bad trade for a scan this small. The candidate set here is a
 * module's own file list (~30 files) or one campaign directory — reading it in
 *-process is a few tens of milliseconds, is identical on every platform, and is
 * testable with an injected fs instead of a fake subprocess.
 *
 * @param {string[]} roots
 * @param {{repoRoot:string, readdir?:Function, stat?:Function, exists?:Function}} opts
 * @returns {string[]} repo-relative file paths, POSIX-separated
 */
export function collectFiles(roots, { repoRoot, readdir = readdirSync, stat = statSync, exists = existsSync } = {}) {
  const out = [];
  const seen = new Set();
  const pushFile = (rel) => {
    const posix = rel.replace(/\\/g, "/");
    if (seen.has(posix) || out.length >= MAX_FILES_SCANNED) return;
    if (!SCANNABLE_EXT.test(posix)) return;
    seen.add(posix);
    out.push(posix);
  };

  const walk = (rel, depth) => {
    if (out.length >= MAX_FILES_SCANNED || depth > 6) return;
    let entries;
    try {
      entries = readdir(join(repoRoot, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= MAX_FILES_SCANNED) return;
      const name = entry.name;
      const childRel = `${rel}/${name}`;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
        walk(childRel, depth + 1);
      } else if (entry.isFile()) {
        pushFile(childRel);
      }
    }
  };

  for (const root of roots || []) {
    const rel = String(root || "").replace(/\\/g, "/").replace(/\/+$/, "");
    if (!rel) continue;
    const abs = join(repoRoot, rel);
    if (!exists(abs)) continue;
    let isDir = false;
    try {
      isDir = stat(abs).isDirectory();
    } catch {
      continue;
    }
    if (isDir) walk(rel, 0);
    else pushFile(rel);
  }
  return out;
}

/**
 * Scan a file list for every literal at once, reading each file exactly once.
 *
 * The one-pass shape is deliberate: the obvious loop (for each literal, grep the
 * tree) re-reads the same 30 files eight times for no gain, and the whole point of
 * this module is that locating should be too cheap to think about.
 *
 * @param {{value:string, kind:string, weight:number}[]} literals
 * @param {string[]} files - repo-relative
 * @param {{repoRoot:string, readFile?:(path:string, encoding:string)=>string}} opts
 * @returns {Map<string, {path:string, line:number, snippet:string}[]>} keyed by literal value
 */
/** Numeric kinds are the only ones where a bare substring match is meaningless. */
const NUMERIC_KINDS = new Set(["amount", "number"]);

/**
 * A boundary test for numeric literals, or null for everything else.
 *
 * `extractLiterals` already says a bare number is the weakest signal it emits,
 * but weighting it low is not the same as matching it correctly: the scan looked
 * for the digits as a plain substring, so searching BUD-14's `$25` also matched
 * `text-white/25`, `bg-emerald-500/25` and `p256dh`. Those are not weak evidence,
 * they are not evidence — and enough of them lifted an unrelated file close
 * enough to the real one to drop the whole verdict from `likely` to `ambiguous`,
 * which is the difference between the INSTANT lane locating a file for free and
 * falling back to a model turn.
 *
 * A number counts only where it stands alone: not inside a longer identifier or
 * number, and not after `/` or `.`, which in this codebase means a Tailwind
 * opacity suffix or a version fragment rather than a value anyone typed.
 */
function numericBoundary(lit) {
  if (!NUMERIC_KINDS.has(lit.kind) || !/^\d+$/.test(lit.value)) return null;
  return new RegExp(`(?<![\\w./])${lit.value}(?!\\w)`);
}

export function scanLiterals(literals, files, opts = {}) {
  // Destructured in the body, not the signature: a `= readFileSync` default in
  // the parameter list makes TypeScript infer the full overloaded `readFileSync`
  // type for `readFile` and ignore the looser JSDoc above, so every test that
  // injects a plain `(path) => string` reader fails `tsc --noEmit`. Three did.
  const { repoRoot, readFile = readFileSync } = opts;
  /** @type {Map<string, {path:string, line:number, snippet:string}[]>} */
  const byLiteral = new Map();
  for (const lit of literals) byLiteral.set(lit.value, []);
  // Case-insensitive for prose words, exact for anything the owner quoted or
  // that looks like source text — "Amount" and "amount" are the same word, but
  // a quoted string is quoted precisely because its exact form matters.
  const prepared = literals.map((lit) => ({
    ...lit,
    needle: lit.kind === "quoted" ? lit.value : lit.value.toLowerCase(),
    fold: lit.kind !== "quoted",
    boundary: numericBoundary(lit),
  }));

  for (const rel of files) {
    let text;
    try {
      const info = statSync(join(repoRoot, rel));
      if (info.size > MAX_FILE_BYTES) continue;
      text = readFile(join(repoRoot, rel), "utf8");
    } catch {
      continue;
    }
    // Cheap whole-file reject before paying for the line split.
    const foldedText = text.toLowerCase();
    const live = prepared.filter((lit) => (lit.fold ? foldedText : text).includes(lit.needle));
    if (live.length === 0) continue;

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const folded = line.toLowerCase();
      for (const lit of live) {
        const bucket = byLiteral.get(lit.value);
        if (bucket.length >= MAX_HITS_PER_LITERAL) continue;
        // `includes` stays the cheap first gate; the boundary test only runs on
        // lines that already contain the digits.
        if (!(lit.fold ? folded : line).includes(lit.needle)) continue;
        if (lit.boundary && !lit.boundary.test(line)) continue;
        bucket.push({ path: rel, line: i + 1, snippet: line.trim().slice(0, 200) });
      }
    }
  }
  return byLiteral;
}

// ---------------------------------------------------------------------------
// The locator
// ---------------------------------------------------------------------------

/**
 * Resolve an item to file(s) + an anchor line, spending no model tokens.
 *
 * Resolution order, strongest evidence first:
 *   1. the item names paths outright (DLV-42) → `exact`, no grep at all;
 *   2. Feature Map phrase match narrows to a module's own file list, then
 *      ripgrep pins lines inside it;
 *   3. the campaign glob table (`campaignGlobs`) as the last resort, which is
 *      the same prior `computeScopeHints` has always fallen back to.
 *
 * Returns `confidence: "none"` rather than a guess when nothing corroborates —
 * silence is not evidence, and INSTANT is simply not offered in that case.
 *
 * @param {{item:{text?:string, lineText?:string, campaign?:string},
 *   repoRoot:string, campaignGlobs?:string[],
 *   readFile?:Function, exists?:Function}} args
 * @returns {{hits:{path:string, line:number|null, snippet:string, score:number, why:string}[],
 *   confidence:"exact"|"likely"|"ambiguous"|"none",
 *   source:"item-paths"|"feature-map+scan"|"campaign+scan"|null,
 *   modules:string[], literals:string[]}}
 */
export function locate({
  item = {},
  repoRoot,
  campaignGlobs = [],
  readFile = readFileSync,
  exists = existsSync,
} = {}) {
  if (!repoRoot) throw new LocateError("repoRoot is required");
  const text = `${item.text || ""}\n${item.lineText || ""}`;
  const empty = { hits: [], confidence: "none", source: null, modules: [], literals: [] };

  // (1) The item already answered the question.
  const explicit = explicitPathsInText(text);
  if (explicit.length > 0) {
    const pointers = new Map();
    for (const m of text.matchAll(/([A-Za-z0-9_@./-]*[A-Za-z0-9_-]\.[A-Za-z0-9]+):(\d+)/g)) {
      pointers.set(m[1], Number(m[2]));
    }
    return {
      hits: explicit.map((path) => ({
        path,
        line: pointers.get(path) ?? null,
        snippet: "",
        score: 100,
        why: "named by the work item",
      })),
      confidence: "exact",
      source: "item-paths",
      modules: [],
      literals: [],
    };
  }

  // (2) Feature Map narrowing.
  const modules = [];
  let roots = [];
  const indexPath = join(repoRoot, FEATURE_MAP_REL, "_index.md");
  if (exists(indexPath)) {
    const entries = parseFeatureMapIndex(readFile(indexPath, "utf8"));
    for (const ranked of rankModules(text, entries).slice(0, 3)) {
      const modFile = join(repoRoot, FEATURE_MAP_REL, ranked.modulePath);
      if (!exists(modFile)) continue;
      modules.push(ranked.modulePath);
      for (const p of parseModuleFilePaths(readFile(modFile, "utf8"))) {
        if (!roots.includes(p)) roots.push(p);
      }
    }
  }
  let source = roots.length > 0 ? "feature-map+scan" : null;

  // (3) Campaign globs as the fallback root set. rg takes directories, not
  // globs, so `src/features/accounts/**` is reduced to its literal root.
  if (roots.length === 0 && campaignGlobs.length > 0) {
    roots = campaignGlobs.map((g) => String(g).replace(/\/?\*+.*$/, "")).filter(Boolean);
    source = roots.length > 0 ? "campaign+scan" : null;
  }
  if (roots.length === 0) return empty;

  // The Feature Map is hand-maintained and names files that have since moved;
  // one stale bullet must not cost the whole scan.
  const files = collectFiles(roots, { repoRoot, exists });
  if (files.length === 0) return { ...empty, modules };

  const literals = extractLiterals(text).slice(0, MAX_LITERALS_SEARCHED);
  const scanned = scanLiterals(literals, files, { repoRoot, readFile });

  // A literal matching everywhere tells us nothing about *where*, so the ceiling
  // drops it. But when it drops *everything* — "overdue" appears 40 times across
  // the items module and nothing else survives — returning "none" throws away the
  // only evidence there is. The fallback keeps the three rarest literals and caps
  // the result at `ambiguous`, so it reaches the Flight-Check picker rather than
  // pre-filling a scope from noise.
  let surviving = literals.filter((lit) => {
    const n = (scanned.get(lit.value) || []).length;
    return n > 0 && n < MAX_HITS_PER_LITERAL;
  });
  let noisyFallback = false;
  if (surviving.length === 0) {
    surviving = literals
      .filter((lit) => (scanned.get(lit.value) || []).length > 0)
      .sort((a, b) => (scanned.get(a.value).length - scanned.get(b.value).length) || b.weight - a.weight)
      .slice(0, 3);
    noisyFallback = surviving.length > 0;
  }
  if (surviving.length === 0) return { ...empty, modules };

  /** @type {Map<string, {score:number, kinds:Set<string>, literals:Set<string>, lines:Map<number,{score:number, snippet:string, hits:number}>}>} */
  const byFile = new Map();
  const usedLiterals = [];

  for (const literal of surviving) {
    const hits = scanned.get(literal.value) || [];
    usedLiterals.push(literal.value);
    // Rarer literal ⇒ more informative hit.
    const rarity = 1 + Math.max(0, (MAX_HITS_PER_LITERAL - hits.length) / MAX_HITS_PER_LITERAL);
    const gain = literal.weight * rarity;
    for (const hit of hits) {
      let file = byFile.get(hit.path);
      if (!file) {
        file = { score: 0, kinds: new Set(), literals: new Set(), lines: new Map() };
        byFile.set(hit.path, file);
      }
      file.score += gain;
      file.kinds.add(literal.kind);
      file.literals.add(literal.value);
      let line = file.lines.get(hit.line);
      if (!line) {
        line = { score: 0, snippet: hit.snippet, hits: 0 };
        file.lines.set(hit.line, line);
      }
      line.score += gain;
      line.hits += 1;
    }
  }

  if (byFile.size === 0) return { ...empty, modules, literals: usedLiterals };

  const ranked = [...byFile.entries()]
    .map(([path, file]) => {
      // Co-occurrence is the strongest signal this module produces: several
      // independent literals from one sentence landing in the same file is far
      // better evidence than any one of them alone.
      const score = file.score + 2 * (file.literals.size - 1);
      // The anchor is the line where the most of those literals meet — not the
      // last hit seen, which is how BUD-14 first anchored on a Framer Motion
      // `damping: 25` at line 3073 instead of the `QUICK_AMOUNTS` array at 1144
      // that matched "25" *and* "quick" *and* "amount" together.
      let best = { line: null, snippet: "", score: -1, hits: 0 };
      for (const [lineNo, line] of file.lines) {
        if (line.hits > best.hits || (line.hits === best.hits && line.score > best.score)) {
          best = { line: lineNo, snippet: line.snippet, score: line.score, hits: line.hits };
        }
      }
      return {
        path,
        line: best.line,
        snippet: best.snippet,
        score: Math.round(score * 10) / 10,
        why:
          `matched ${[...file.literals].map((l) => `"${l}"`).join(" + ")} ` +
          `in ${source === "feature-map+scan" ? "a Feature Map candidate" : "the campaign scope"}`,
      };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  // A clear winner is one that is both strong on its own and clearly ahead of
  // the runner-up. Requiring both matters: "only one file matched at all" is
  // weak evidence when the single literal was weak, and "top score is double the
  // next" is meaningless when every score is noise.
  const top = ranked[0];
  const runnerUp = ranked[1];
  const decisive = !runnerUp || top.score >= runnerUp.score * 1.8;
  const strong = top.score >= 5;
  // `noisyFallback` means every literal was too common to be evidence and we are
  // reporting the least-bad ones. That can still be useful to a human choosing
  // from a list; it is never good enough to pre-fill a scope lock.
  const confidence = decisive && strong && !noisyFallback ? "likely" : "ambiguous";

  return {
    hits: ranked.slice(0, MAX_REPORTED_HITS),
    confidence,
    source,
    modules,
    literals: usedLiterals,
  };
}

/**
 * Whether a locator result is trustworthy enough to (a) stand in for an explicit
 * path when deciding single-file-ness, and (b) offer the INSTANT lane.
 *
 * `ambiguous` deliberately does not qualify: it is exactly the case the
 * Flight-Check picker exists for, and letting it through would put a guess into
 * the scope lock — the one place a wrong file is expensive rather than merely
 * unhelpful.
 *
 * `likely` qualifies even when lower-scoring runner-up files were also reported:
 * "likely" already *means* the top hit beat the field decisively, and the
 * remaining rows exist so the Flight-Check can show its work, not because they
 * are live candidates. Callers take `hits[0]`.
 * @param {{confidence?:string, hits?:object[]}|null} result
 */
export function isConfidentLocation(result) {
  if (!result) return false;
  if (result.confidence !== "exact" && result.confidence !== "likely") return false;
  return (result.hits || []).length > 0;
}

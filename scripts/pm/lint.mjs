// scripts/pm/lint.mjs
// Grammar guard for the living campaign checklists (`<Campaign>/4 - Checklist.md`).
// Enforces the item conventions in ERA Notes/10 - Project Management/_Conventions.md so
// the `pnpm pm` board stays a coherent, consolidated view. Zero dependencies.
//
// Pure core: lintChecklist(raw, opts) -> [{ line, rule, level, message }]  (testable)
// CLI: `node scripts/pm/lint.mjs` — lints the seven mapped checklists, exit 1 on any error.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanLines } from "./shared/md-scan.mjs";
import { parseFrontmatter } from "./shared/frontmatter.mjs";

// Campaign folder -> required ID prefix. Only these files are linted; FABLED*/archived are excluded by construction.
export const CAMPAIGNS = Object.freeze({
  "Budget": "BUD",
  "Schedule": "SCH",
  "Kitchen": "KIT",
  "Trips": "TRIP",
  "Hub & ERA": "HUB",
  "Notifications & Alerts": "NOTIF",
  "PM Dashboard Refactor": "R",
  "Delivery Workspace": "DW",
  "Delivery 10x": "DLV",
  "Outfits": "OUT",
  "Healthcare": "HLTH",
});

const LANES = ["Now", "Next", "Later"];
const DOD = "Definition of Done";
const ID_RE = /^\*\*([A-Za-z]{1,5}-?\d+[a-z]?(?:\.\d+[a-z]?)?)\*\*\s/;
const META_RE = /_\(\s*(blocker|friction|annoyance|parked)\s*-\s*([SML])\s*\)_\s*$/;
const CODE_TOKEN_RE = /`([^`\n]+)`/g;
const MD_LINK_RE = /\[[^\]]+\]\((<[^>]+>|[^)]+)\)/g;

/**
 * Lint one checklist file. Filesystem checks (E5) are delegated to injected resolvers
 * so the core stays pure/testable:
 *   resolveMd(href)  -> true|false|null   (null = not a checkable .md link)
 *   resolveCode(tok) -> true|false|null   (null = not a checkable repo path)
 * @param {string} raw
 * @param {{ campaign?: string, resolveMd?: (href: string) => boolean|null, resolveCode?: (tok: string) => boolean|null }} [opts]
 */
export function lintChecklist(raw, { campaign, resolveMd = () => null, resolveCode = () => null } = {}) {
  const out = [];
  const prefix = CAMPAIGNS[campaign];
  const add = (line, level, rule, message) => out.push({ line, level, rule, message });

  // E1 — frontmatter
  const meta = parseFrontmatter(raw).meta;
  if (String(meta.status || "").toLowerCase() !== "active") add(0, "error", "E1", `frontmatter status must be "active" (got "${meta.status || ""}")`);
  if (!meta.updated) add(0, "error", "E1", "frontmatter is missing an `updated:` date");

  const scan = scanLines(raw);
  const seenLanes = [];
  const laneOrder = [];
  const ids = new Map(); // id -> line
  const laneOpenCount = new Map(); // lane -> open-item count
  let lane = null; // current lane name or null

  for (const ln of scan.lines) {
    if (ln.type === "in-fence" || ln.type === "fence-delim" || ln.type === "fm") continue;

    // link resolution (E5) on any line
    for (const m of ln.raw.matchAll(MD_LINK_RE)) {
      const r = resolveMd(m[1]);
      if (r === false) add(ln.line + 1, "error", "E5", `broken doc link: ${m[1]}`);
    }
    for (const m of ln.raw.matchAll(CODE_TOKEN_RE)) {
      const r = resolveCode(m[1]);
      if (r === false) add(ln.line + 1, "error", "E5", `missing code path: \`${m[1]}\``);
    }

    if (ln.type === "heading") {
      if (ln.level === 2) {
        const text = ln.text.trim();
        laneOrder.push(text);
        if (LANES.includes(text)) { seenLanes.push(text); lane = text; laneOpenCount.set(text, laneOpenCount.get(text) || 0); }
        else if (text === DOD) { lane = DOD; }
        else { lane = null; }
      } else {
        lane = null; // any deeper heading ends lane context (matches the board's scanner)
      }
      continue;
    }

    if (ln.type !== "checkbox") continue;

    const lineNo = ln.line + 1;
    if (lane === null) { add(lineNo, "error", "E2", "checkbox is not under a Now / Next / Later / Definition of Done lane"); continue; }
    if (ln.indent > 0) { add(lineNo, "error", "E3", "nested checkbox in a lane — use a plain `-` bullet for sub-points"); }

    const idMatch = ln.rest.match(ID_RE);
    const id = idMatch ? idMatch[1] : null;

    if (lane === DOD) {
      // DoD items are prefix-exempt (D1, D2, …) but still checked for duplicates.
      if (id) {
        if (ids.has(id)) add(lineNo, "error", "E4", `duplicate ID ${id} (also line ${ids.get(id)})`);
        else ids.set(id, lineNo);
      }
      continue;
    }

    // Now / Next / Later — full grammar
    if (ln.state === "open") laneOpenCount.set(lane, (laneOpenCount.get(lane) || 0) + 1);
    else add(lineNo, "warn", "W1", `completed item still in a lane — sweep it to 1 - Feature State and delete the line`);

    if (!id) { add(lineNo, "error", "E3", "item is missing a **PREFIX-n** ID chip"); }
    else {
      if (prefix === "R") { if (!/^R\d/.test(id)) add(lineNo, "error", "E4", `ID ${id} should start with "R"`); }
      else if (!id.startsWith(`${prefix}-`)) add(lineNo, "error", "E4", `ID ${id} should start with "${prefix}-"`);
      if (ids.has(id)) add(lineNo, "error", "E4", `duplicate ID ${id} (also line ${ids.get(id)})`);
      else ids.set(id, lineNo);
    }

    if (!META_RE.test(ln.rest)) {
      add(lineNo, "error", "E3", "item must end with `_(severity - effort)_` — severity ∈ {blocker,friction,annoyance,parked}, effort ∈ {S,M,L}");
    }
  }

  // E2 — lane presence + order
  for (const want of LANES) if (!seenLanes.includes(want)) add(0, "error", "E2", `missing "## ${want}" lane`);
  const dupLanes = seenLanes.filter((l, i) => seenLanes.indexOf(l) !== i);
  for (const d of new Set(dupLanes)) add(0, "error", "E2", `"## ${d}" lane appears more than once`);
  const canonicalOrder = laneOrder.filter((l) => LANES.includes(l));
  if (canonicalOrder.join(",") !== LANES.slice(0, canonicalOrder.length).join(",") && seenLanes.length === LANES.length) {
    add(0, "error", "E2", `lanes must be in order Now → Next → Later (found ${canonicalOrder.join(" → ")})`);
  }

  // W2 — empty lane
  for (const l of seenLanes) if ((laneOpenCount.get(l) || 0) === 0) add(0, "warn", "W2", `"## ${l}" lane has no open items`);

  return out;
}

// ---------------- CLI ----------------

function resolveMdFs(href, absDir) {
  let c = decodeURIComponent(String(href).replace(/^<|>$/g, "")).replace(/\\/g, "/");
  if (!c || /^(https?:|mailto:|vscode:|#)/i.test(c)) return null;
  const hash = c.indexOf("#");
  if (hash >= 0) c = c.slice(0, hash);
  if (!c || !/\.md$/i.test(c)) return null; // only .md links are checkable here
  return existsSync(resolve(absDir, c));
}

function resolveCodeFs(tok, root) {
  let c = tok.trim();
  const lm = c.match(/(?::\d+(-\d+)?|#L\d+)$/);
  if (lm) c = c.slice(0, c.length - lm[0].length);
  if (!/^(src|scripts|tests|migrations|public|docs)\//.test(c)) return null; // only repo-root code paths
  return existsSync(join(root, c));
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const ROOT = join(here, "..", "..");
  const PM_DIR = join(ROOT, "ERA Notes", "10 - Project Management");
  let errors = 0;
  let warnings = 0;

  for (const [folder, prefix] of Object.entries(CAMPAIGNS)) {
    const abs = join(PM_DIR, folder, "4 - Checklist.md");
    if (!existsSync(abs)) { console.log(`· ${folder}: no 4 - Checklist.md (skipped)`); continue; }
    const raw = readFileSync(abs, "utf8");
    const absDir = dirname(abs);
    const findings = lintChecklist(raw, {
      campaign: folder,
      resolveMd: (href) => resolveMdFs(href, absDir),
      resolveCode: (tok) => resolveCodeFs(tok, ROOT),
    });
    const errs = findings.filter((f) => f.level === "error");
    const warns = findings.filter((f) => f.level === "warn");
    errors += errs.length;
    warnings += warns.length;
    const rel = `${folder}/4 - Checklist.md`;
    if (!findings.length) { console.log(`✓ ${rel} (${prefix})`); continue; }
    console.log(`${errs.length ? "✗" : "!"} ${rel} (${prefix}) — ${errs.length} error(s), ${warns.length} warning(s)`);
    for (const f of findings) console.log(`    ${rel}:${f.line} [${f.rule}] ${f.message}`);
  }

  console.log(`\n${errors} error(s), ${warnings} warning(s).`);
  process.exit(errors ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}` || fileURLToPath(import.meta.url) === resolve(process.argv[1] || "")) {
  main();
}

// scripts/pm/archive.mjs
// Checklist archiving: the "sweep" of _Conventions §2 turned into code.
//
//   ship    — a `[x]` item leaves `4 - Checklist.md` and becomes a dated stamp in
//             its campaign's Master Book › Shipped Log (`- ✅ YYYY-MM-DD — **ID** …`).
//   discard — an item leaves the checklist and becomes a dated stamp in
//             `_Archive/Cancelled Log.md` (`- ❌ YYYY-MM-DD — **ID** … _(cancelled)_`).
//             `_Archive/` is skipped by scan.mjs, so cancelled work is in git and
//             readable but invisible to the board, the burndown and the linter.
//
// Both are reversible: every op returns an `undo` array of {path, raw} snapshots
// the caller writes back verbatim (the server exposes this as the `restore` op;
// the CLI persists it to `.pm/last-sweep.json` for `--undo`).
//
// Zero dependencies — Node built-ins only. The pure helpers at the top take and
// return strings so they stay unit-testable without touching the filesystem.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { scanLines } from "./shared/md-scan.mjs";
import { parseTaskMeta } from "./shared/tasks.mjs";

export const CANCELLED_LOG = "_Archive/Cancelled Log.md";
export const CHECKLIST_NAME = "4 - Checklist.md";
export const STATE_DIR = ".pm"; // dot-prefixed: skipped by scan.mjs's SKIP_DIR

// `_(severity - effort)_` — queue triage metadata, meaningless once the item has
// left the queue, so it is stripped from the stamp (matching the hand-written
// Shipped Log lines that predate this file).
const META_RE = /\s*_\(\s*[\w -]+?\s*-\s*(?:[XSML]|\d+h?)\s*\)_\s*$/i;
const STAMP_DATE_RE = /^\s*[-*]\s*(?:✅|❌)\s*(\d{4}-\d{2}-\d{2})/u;
// Definition-of-Done items are acceptance criteria, not queue work: ticking one
// records a fact about the campaign, so it must never be swept away (§2).
const NO_SWEEP_SECTION = /definition of done/i;

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Strip the `- [x] ` marker from a checklist line, leaving the item body. */
export function itemBody(line) {
  const m = String(line).match(/^\s*(?:[-*]|\d+\.)\s+\[[ xX]\]\s?(.*)$/);
  return (m ? m[1] : String(line)).trim();
}

/** `- ✅ 2026-08-01 — **BUD-14** Outcome` (_Conventions §3). */
export function shippedStamp(body, date) {
  return "- ✅ " + date + " — " + String(body).replace(META_RE, "").trim();
}

/** `- ❌ 2026-08-01 — **BUD-9** Outcome _(cancelled: reason)_`. */
export function cancelledStamp(body, date, reason) {
  const why = String(reason || "").trim();
  return (
    "- ❌ " + date + " — " + String(body).replace(META_RE, "").trim() +
    " _(cancelled" + (why ? ": " + why : "") + ")_"
  );
}

/** Locate a section by heading regex. Returns {start, end, level} or null. */
function findSection(lines, headingRe) {
  for (let i = 0; i < lines.length; i++) {
    const hm = lines[i].match(/^(#{1,6})\s+/);
    if (!hm || !headingRe.test(lines[i])) continue;
    const level = hm[1].length;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const hm2 = lines[j].match(/^(#{1,6})\s+/);
      if (hm2 && hm2[1].length <= level) { end = j; break; }
    }
    return { start: i, end, level };
  }
  return null;
}

/**
 * Insert `stamp` into the `headingRe` section, keeping the section's existing
 * ascending-by-date order (the Shipped Log reads as a timeline, and git-derived
 * dates arrive out of order during a sweep). Creates the section at EOF if
 * missing. Returns the new raw text.
 */
export function insertDatedStamp(raw, headingRe, stamp, date, headingText) {
  const lines = String(raw).split("\n");
  const section = findSection(lines, headingRe);
  if (!section) {
    const head = String(raw).replace(/\s*$/, "");
    return head + "\n\n## " + (headingText || "Shipped Log") + "\n\n" + stamp + "\n";
  }
  // Last dated stamp at or before `date` wins the slot after it; if every
  // existing stamp is newer (or there are none), go to the top of the section.
  let insertAt = -1;
  for (let i = section.start + 1; i < section.end; i++) {
    const m = lines[i].match(STAMP_DATE_RE);
    if (m && m[1] <= date) insertAt = i + 1;
  }
  if (insertAt === -1) {
    insertAt = section.start + 1;
    while (insertAt < section.end && /^\s*$/.test(lines[insertAt])) insertAt++;
    // A leading blockquote/legend paragraph belongs above the first stamp.
    while (insertAt < section.end && /^\s*>/.test(lines[insertAt])) {
      insertAt++;
      while (insertAt < section.end && /^\s*$/.test(lines[insertAt])) insertAt++;
    }
  }
  lines.splice(insertAt, 0, stamp);
  return lines.join("\n");
}

/** Delete the 0-based `lineIdx`, collapsing the blank-line pair it may leave. */
export function removeLine(raw, lineIdx) {
  const lines = String(raw).split("\n");
  if (lineIdx < 0 || lineIdx >= lines.length) return String(raw);
  lines.splice(lineIdx, 1);
  if (lineIdx > 0 && lineIdx < lines.length
    && /^\s*$/.test(lines[lineIdx - 1]) && /^\s*$/.test(lines[lineIdx])) {
    lines.splice(lineIdx, 1);
  }
  return lines.join("\n");
}

/** Ensure `## <campaign>` exists in the Cancelled Log and return the new raw. */
export function ensureCampaignSection(raw, campaign) {
  const lines = String(raw).split("\n");
  return findSection(lines, new RegExp("^##\\s+" + escapeRe(campaign) + "\\s*$", "i"))
    ? String(raw)
    : String(raw).replace(/\s*$/, "") + "\n\n## " + campaign + "\n";
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const CANCELLED_LOG_STUB =
  "---\ncreated: " + todayIso() + "\nupdated: " + todayIso() +
  "\ntype: log\nstatus: superseded\nowner: Elio\ntags:\n  - pm/archive\n---\n\n" +
  "# Cancelled Log\n\n" +
  "> Items discarded from a campaign checklist. Written by the PM dashboard's\n" +
  "> Discard action and `pnpm pm:archive`. Lives under `_Archive/`, so no PM tool\n" +
  "> (board, burndown, bridge, linter) reads it — it exists so a killed idea is\n" +
  "> recoverable rather than only findable in git history.\n";

// ---------------------------------------------------------------- filesystem

/** Campaign folders that carry a working checklist. */
export function campaignDirs(pmDir) {
  return readdirSync(pmDir)
    .filter((name) => !/^[._]/.test(name))
    .filter((name) => {
      try { return statSync(join(pmDir, name)).isDirectory(); } catch { return false; }
    })
    .filter((name) => existsSync(join(pmDir, name, CHECKLIST_NAME)))
    .sort();
}

/** The campaign's Master Book, or null if it has none. */
export function masterBookRel(pmDir, campaign) {
  const exact = campaign + " — Master Book.md";
  if (existsSync(join(pmDir, campaign, exact))) return campaign + "/" + exact;
  const found = readdirSync(join(pmDir, campaign)).find((n) => /Master Book\.md$/i.test(n));
  return found ? campaign + "/" + found : null;
}

/**
 * When did this line become `[x]`? Walks the checklist's recent history and
 * binary-searches for the earliest commit whose blob already carries the ticked
 * line, so a monthly sweep doesn't stamp four weeks of work with one date.
 * Falls back to today whenever git can't answer (uncommitted tick, no repo,
 * rewritten history, blob budget exhausted) — never throws.
 */
export function tickDate(repoRoot, fileRepoRel, tickedLine, cache = new Map()) {
  const fallback = todayIso();
  try {
    const key = fileRepoRel;
    let history = cache.get(key);
    if (!history) {
      const out = execFileSync("git",
        ["log", "-n", "60", "--format=%H %ad", "--date=short", "--", fileRepoRel],
        { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      // git logs newest-first; the search wants oldest-first.
      history = { commits: out.trim().split("\n").filter(Boolean).map((l) => {
        const sp = l.indexOf(" ");
        return { sha: l.slice(0, sp), date: l.slice(sp + 1).trim() };
      }).reverse(), blobs: new Map(), budget: 25 };
      cache.set(key, history);
    }
    const { commits, blobs } = history;
    if (!commits.length) return fallback;
    const needle = String(tickedLine).trim();
    const hasTick = (index) => {
      const { sha } = commits[index];
      if (!blobs.has(sha)) {
        if (history.budget <= 0) throw new Error("blob budget exhausted");
        history.budget -= 1;
        let blob = "";
        try {
          blob = execFileSync("git", ["show", sha + ":" + fileRepoRel],
            { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        } catch { blob = ""; } // file didn't exist at that commit
        blobs.set(sha, blob);
      }
      return blobs.get(sha).split("\n").some((l) => l.trim() === needle);
    };
    // Not in the newest commit => the tick is uncommitted => it happened today.
    if (!hasTick(commits.length - 1)) return fallback;
    let lo = 0, hi = commits.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (hasTick(mid)) hi = mid; else lo = mid + 1;
    }
    return commits[lo].date;
  } catch {
    return fallback;
  }
}

function readIfExists(abs) {
  return existsSync(abs) ? readFileSync(abs, "utf8") : null;
}

function writeAll(writes) {
  for (const { abs, raw } of writes) {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, raw, "utf8");
  }
}

/**
 * Archive ONE checklist item by its checkbox ordinal.
 * @param {{pmDir:string, repoRoot:string, pmRelFromRoot:string, file:string, cbidx:number, mode:string, reason?:string, date?:string}} args
 *        mode: "ship" | "discard"
 * @returns {{ok:true, stamp:string, target:string, date:string, campaign:string, undo:Array<{path:string,raw:string|null}>, idChip:string|null}}
 * @throws  Error with `.status` on any precondition failure.
 */
export function archiveItem(args) {
  const { pmDir, repoRoot, pmRelFromRoot, file, cbidx, mode, reason } = args;
  const fail = (status, msg) => Object.assign(new Error(msg), { status });

  const checklistAbs = join(pmDir, file);
  const raw = readIfExists(checklistAbs);
  if (raw == null) throw fail(404, "checklist not found");
  if (!new RegExp("(?:^|/)" + escapeRe(CHECKLIST_NAME) + "$", "i").test(file)) {
    throw fail(400, "only 4 - Checklist.md items can be archived");
  }
  const rows = scanLines(raw).lines.filter((l) => l.type === "checkbox");
  const target = rows[cbidx];
  if (!target) throw fail(409, "out-of-range");
  if (mode === "ship" && target.state !== "done") throw fail(409, "not-done");

  const campaign = file.split("/")[0];
  const body = itemBody(target.raw);
  const date = args.date
    || (mode === "ship"
      ? tickDate(repoRoot, join(pmRelFromRoot, file).replace(/\\/g, "/"), target.raw)
      : todayIso());

  const undo = [{ path: file, raw }];
  const writes = [{ abs: checklistAbs, raw: removeLine(raw, target.line) }];
  let stampTarget;
  let stamp;

  if (mode === "ship") {
    const bookRel = masterBookRel(pmDir, campaign);
    if (!bookRel) throw fail(400, "campaign has no Master Book to ship into");
    const bookAbs = join(pmDir, bookRel);
    const bookRaw = readIfExists(bookAbs);
    if (bookRaw == null) throw fail(404, "Master Book not found");
    stamp = shippedStamp(body, date);
    undo.push({ path: bookRel, raw: bookRaw });
    writes.push({ abs: bookAbs, raw: insertDatedStamp(bookRaw, /^##\s+Shipped Log\s*$/i, stamp, date, "Shipped Log") });
    stampTarget = bookRel;
  } else {
    const logAbs = join(pmDir, CANCELLED_LOG);
    const existing = readIfExists(logAbs);
    stamp = cancelledStamp(body, date, reason);
    undo.push({ path: CANCELLED_LOG, raw: existing }); // raw:null => undo deletes it
    const withSection = ensureCampaignSection(existing ?? CANCELLED_LOG_STUB, campaign);
    writes.push({
      abs: logAbs,
      raw: insertDatedStamp(withSection, new RegExp("^##\\s+" + escapeRe(campaign) + "\\s*$", "i"), stamp, date, campaign),
    });
    stampTarget = CANCELLED_LOG;
  }

  writeAll(writes);
  return { ok: true, stamp, target: stampTarget, date, campaign, undo,
    idChip: parseTaskMeta(body).idChip };
}

/**
 * Sweep every ticked item out of every campaign checklist. One pass per
 * campaign so a failure in one leaves the others intact (and reported).
 * @returns {{swept:Array<{campaign:string,date:string,stamp:string,idChip:string|null,target:string}>, errors:Array<{campaign:string,error:string}>, undo:Array<{path:string,raw:string|null}>}}
 */
export function sweepAll({ pmDir, repoRoot, pmRelFromRoot, dryRun = false }) {
  const swept = [];
  const errors = [];
  const undo = [];
  const gitCache = new Map();

  for (const campaign of campaignDirs(pmDir)) {
    const file = campaign + "/" + CHECKLIST_NAME;
    const checklistAbs = join(pmDir, file);
    try {
      const raw = readFileSync(checklistAbs, "utf8");
      let section = "";
      const done = scanLines(raw).lines.filter((line) => {
        if (line.type === "heading") { section = line.text; return false; }
        return line.type === "checkbox" && line.state === "done" && !NO_SWEEP_SECTION.test(section);
      });
      if (!done.length) continue;

      const bookRel = masterBookRel(pmDir, campaign);
      if (!bookRel) { errors.push({ campaign, error: "no Master Book" }); continue; }
      const bookAbs = join(pmDir, bookRel);
      const bookRaw = readFileSync(bookAbs, "utf8");

      let nextBook = bookRaw;
      let nextChecklist = raw;
      const stamps = [];
      for (const line of done) {
        const body = itemBody(line.raw);
        const date = tickDate(repoRoot, join(pmRelFromRoot, file).replace(/\\/g, "/"), line.raw, gitCache);
        const stamp = shippedStamp(body, date);
        nextBook = insertDatedStamp(nextBook, /^##\s+Shipped Log\s*$/i, stamp, date, "Shipped Log");
        stamps.push({ campaign, file, book: bookRel, date, stamp, idChip: parseTaskMeta(body).idChip, text: parseTaskMeta(body).text });
      }
      // Highest line first, so earlier removals can't shift later indices.
      for (const line of [...done].sort((a, b) => b.line - a.line)) {
        nextChecklist = removeLine(nextChecklist, line.line);
      }

      if (!dryRun) {
        undo.push({ path: file, raw }, { path: bookRel, raw: bookRaw });
        writeAll([{ abs: checklistAbs, raw: nextChecklist }, { abs: bookAbs, raw: nextBook }]);
      }
      swept.push(...stamps);
    } catch (error) {
      errors.push({ campaign, error: String(error.message || error) });
    }
  }
  return { swept, errors, undo };
}

// -------------------------------------------------------- monthly automation

function statePath(pmDir, name) {
  return join(pmDir, STATE_DIR, name);
}

export function readSweepStamp(pmDir) {
  try { return JSON.parse(readFileSync(statePath(pmDir, "archive-stamp.json"), "utf8")); }
  catch { return null; }
}

export function writeSweepState(pmDir, { period, report }) {
  mkdirSync(join(pmDir, STATE_DIR), { recursive: true });
  writeFileSync(statePath(pmDir, "archive-stamp.json"),
    JSON.stringify({ period, ranAt: new Date().toISOString(), count: report?.swept.length ?? 0 }, null, 2), "utf8");
  if (report?.undo?.length) {
    writeFileSync(statePath(pmDir, "last-sweep.json"),
      JSON.stringify({ ranAt: new Date().toISOString(), undo: report.undo }, null, 2), "utf8");
  }
}

/**
 * Run the sweep at most once per calendar month. Called on `pnpm pm` boot.
 * Returns the report, or null when this month's sweep already happened.
 */
export function monthlySweep(ctx) {
  const period = todayIso().slice(0, 7);
  if (readSweepStamp(ctx.pmDir)?.period === period) return null;
  const report = sweepAll(ctx);
  writeSweepState(ctx.pmDir, { period, report });
  return report;
}

/**
 * Write back the {path, raw} snapshots produced by any of the ops above.
 * A `raw: null` snapshot means "this file did not exist before" — the first
 * Discard creates the Cancelled Log, and undoing it removes the file again.
 */
export function restoreSnapshots(pmDir, snapshots) {
  for (const { path, raw } of snapshots || []) {
    const abs = join(pmDir, path);
    if (raw == null) { rmSync(abs, { force: true }); continue; }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, raw, "utf8");
  }
  return { ok: true, restored: (snapshots || []).length };
}

/** Undo the last CLI/auto sweep from `.pm/last-sweep.json`. */
export function undoLastSweep(pmDir) {
  let saved;
  try { saved = JSON.parse(readFileSync(statePath(pmDir, "last-sweep.json"), "utf8")); }
  catch { return { ok: false, error: "no sweep to undo" }; }
  restoreSnapshots(pmDir, saved.undo);
  writeFileSync(statePath(pmDir, "last-sweep.json"), JSON.stringify({ ranAt: saved.ranAt, undo: [] }, null, 2), "utf8");
  return { ok: true, ranAt: saved.ranAt, restored: saved.undo.length };
}

// ------------------------------------------------------------------ CLI

const isCli = process.argv[1] && /archive\.mjs$/.test(process.argv[1].replace(/\\/g, "/"));
if (isCli) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const pmRelFromRoot = join("ERA Notes", "10 - Project Management");
  const pmDir = join(repoRoot, pmRelFromRoot);
  const ctx = { pmDir, repoRoot, pmRelFromRoot: pmRelFromRoot.replace(/\\/g, "/") };
  const argv = process.argv.slice(2);

  if (argv.includes("--undo")) {
    const result = undoLastSweep(pmDir);
    console.log(result.ok ? `Restored ${result.restored} file(s) from the sweep of ${result.ranAt}.` : result.error);
    process.exit(result.ok ? 0 : 1);
  }

  const dryRun = argv.includes("--dry-run");
  const report = sweepAll({ ...ctx, dryRun });
  if (!report.swept.length) console.log("Nothing to sweep — no ticked items in any checklist.");
  for (const entry of report.swept) {
    console.log(`${dryRun ? "[dry-run] " : ""}${entry.campaign.padEnd(22)} ${entry.stamp}`);
  }
  for (const error of report.errors) console.error(`  ! ${error.campaign}: ${error.error}`);
  if (report.swept.length) {
    console.log(`\n${dryRun ? "Would sweep" : "Swept"} ${report.swept.length} item(s) into their Master Books.`);
    if (!dryRun) {
      writeSweepState(pmDir, { period: todayIso().slice(0, 7), report });
      console.log("Undo with: pnpm pm:archive --undo");
    }
  }
  console.log("PM dir: " + relative(repoRoot, pmDir));
}

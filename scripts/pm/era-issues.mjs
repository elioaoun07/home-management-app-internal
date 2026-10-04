// scripts/pm/era-issues.mjs
// R72 / HUB-85 — turns ERA chat "Report"s into Hub & ERA defects.
//
// The app files a report as a system `era_messages` row (intent_kind
// "issue_report", payload `issue` — see src/lib/era/issueReport.ts). This
// module imports each one exactly once into the PM corpus as a canonical
// Hub & ERA item under `## Now`, grouped under **ERA reports**:
//   • checklist line  `- [ ] **HUB-n** ERA handles "…" — [criteria](…) _(friction - S)_`
//     (a "wrong" report is a hotfix: `blocker`)
//   • a Pain Inventory line, and a `### HUB-n` section with `**Kind:** bug`,
//     the `**Source:** ERA report <id>` marker, acceptance, the transcript and
//     the ERA actions logged around it.
// The Sprints view lists open Now items carrying that marker as Hotfixes /
// Defects, whatever week they were filed in (sprintModel.ts#eraHotfixes).
//
// Read-only toward the database: idempotence comes from the corpus (the
// Source marker survives in the book) plus a local journal under the
// gitignored `.pm/` folder, so a discarded item is never re-imported.
// Reports younger than IMPORT_GRACE_MS are left alone — that is the app's
// Undo window, with margin.
//
// Pure core: planEraIssueImport (tests/pm-era-issues.test.ts).
// Wiring: applyEraIssueImport (bridge + CLI), fetchEraIssueReports.
// CLI: `pnpm pm:era-issues` previews; `pnpm pm:era-issues --apply` writes.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ERA_ISSUE_KIND = "issue_report";
export const ERA_CAMPAIGN = "Hub & ERA";
export const ERA_PREFIX = "HUB";
export const SOURCE_MARKER = "**Source:** ERA report";
export const GROUP_LABEL = "**ERA reports**";
export const IMPORT_GRACE_MS = 2 * 60 * 1000;
export const JOURNAL_REL = join(".pm", "era-issues.jsonl");
const CHECKLIST_FILE = "4 - Checklist.md";
const BOOK_FILE = `${ERA_CAMPAIGN} — Master Book.md`;
const TRANSCRIPT_MAX = 16;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** One line of untrusted text, safe inside Markdown: no structure, no links, bounded. */
export function mdInline(text, max = 280) {
  const flat = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const clipped = flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
  return clipped.replace(/[\\`*_[\]<>#|~]/g, (c) => (c === "`" ? "'" : `\\${c}`));
}

/** Highest `<prefix>-n` used anywhere in `texts` — never reuse an ID. */
export function highestWorkNumber(texts, prefix = ERA_PREFIX) {
  const re = new RegExp(`\\b${prefix}-(\\d+)`, "g");
  let max = 0;
  for (const text of texts) for (const m of String(text).matchAll(re)) max = Math.max(max, Number(m[1]));
  return max;
}

/** Report ids already recorded by a Source marker. */
export function importedReportIds(texts) {
  const re = new RegExp(`\\*\\*Source:\\*\\* ERA report (${UUID})`, "g");
  const ids = new Set();
  for (const text of texts) for (const m of String(text).matchAll(re)) ids.add(m[1]);
  return ids;
}

function shortRequest(issue) {
  return mdInline(issue.request || issue.reply || "a conversation", 70).replace(/"/g, "'");
}

/** Outcome-style title: what "fixed" looks like. */
export function issueTitle(issue) {
  return issue.kind === "wrong"
    ? `ERA gets "${shortRequest(issue)}" right`
    : `ERA handles "${shortRequest(issue)}"`;
}

function stamp(iso, timezone) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return { date: "", time: "" };
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(d);
  return { date, time };
}

function insertAfterHeading(raw, heading, block) {
  const lines = raw.split("\n");
  const at = lines.findIndex((line) => line.trim() === heading);
  if (at < 0) throw new Error(`missing heading "${heading}"`);
  let insert = at + 1;
  while (insert < lines.length && lines[insert].trim() === "") insert += 1;
  lines.splice(insert, 0, ...block, "");
  return lines.join("\n");
}

/** Append `block` at the end of the `## Now` lane, under the ERA reports group. */
function appendToNow(raw, block) {
  const lines = raw.split("\n");
  const start = lines.findIndex((line) => line.trim() === "## Now");
  if (start < 0) throw new Error('missing "## Now" lane');
  let end = lines.findIndex((line, i) => i > start && /^#{1,2}\s/.test(line));
  if (end < 0) end = lines.length;
  let insert = end;
  while (insert > start + 1 && lines[insert - 1].trim() === "") insert -= 1;
  const hasGroup = lines.slice(start, end).some((line) => line.trim() === GROUP_LABEL);
  const add = hasGroup ? block : ["", GROUP_LABEL, "", ...block];
  lines.splice(insert, 0, ...add);
  return lines.join("\n");
}

function bumpUpdated(raw, date) {
  return raw.replace(/^(updated:\s*)\d{4}-\d{2}-\d{2}\s*$/m, `$1${date}`);
}

function renderSection(report, workId, ctx) {
  const issue = report.issue;
  const { date, time } = stamp(issue.reportedAt || report.created_at, ctx.timezone);
  const who = ctx.ownerUserId && report.user_id === ctx.ownerUserId ? "owner" : "partner";
  const lines = [
    `### ${workId}`,
    "",
    `**Outcome:** ${issueTitle(issue)}.`,
    "",
    "**Kind:** bug",
    `${SOURCE_MARKER} ${report.id} · ${issue.kind === "wrong" ? "wrong" : "missed"} · ${who} · ${date} ${time} (${ctx.timezone})`,
    "",
    "- **Acceptance:** This request ends in the right outcome — done with Undo, one confirm card, one question with chips, a prefilled form, or an honest limit with a door — never a wrong action or a dead end. An ERA Gym case replays the transcript below.",
  ];
  if (issue.note) lines.push(`- **Comment:** ${ctx.text(issue.note, 400)}`);
  lines.push(
    "- **Reading guide:** start at `src/features/era/useEraTurn.ts` (one turn), then the router in `src/features/era/intents/` and the capability's resolver; add the sentence to `tests/era-gym/`.",
    "",
    "**Transcript**",
    "",
  );
  const turns = (issue.transcript || []).slice(-TRANSCRIPT_MAX);
  if (turns.length === 0) lines.push("- (empty)");
  for (const t of turns) {
    const at = stamp(t.at, ctx.timezone).time;
    const meta = [t.intent, t.outcome].filter(Boolean).join(" · ");
    const reported = t.id && t.id === issue.messageId ? " ← reported" : "";
    lines.push(`- ${t.role === "user" ? "You" : "ERA"} · ${at} — ${ctx.text(t.text, 400)}${meta ? ` _(${mdInline(meta, 80)})_` : ""}${reported}`);
  }
  const actions = issue.actions || [];
  if (actions.length) {
    lines.push("", "**ERA actions**", "");
    for (const a of actions) {
      lines.push(`- ${mdInline(a.action, 20)} ${mdInline(a.entityType, 20)} — ${ctx.text(a.title, 160)} · ${stamp(a.at, ctx.timezone).time}`);
    }
  }
  return { lines, date };
}

/**
 * Pure: the corpus after importing `reports`. Each report row is
 * `{ id, user_id, created_at, issue }` where `issue` is the app's snapshot.
 * `isSecret(text)` withholds any text that would disclose a credential.
 *
 * @param {{
 *   reports: Array<{ id: string, user_id?: string | null, created_at: string, issue: any }>,
 *   checklistRaw: string,
 *   bookRaw: string,
 *   corpusTexts?: string[],
 *   journalIds?: string[],
 *   ownerUserId?: string | null,
 *   timezone?: string,
 *   now?: number,
 *   isSecret?: (text: string) => boolean,
 * }} input
 */
export function planEraIssueImport({
  reports,
  checklistRaw,
  bookRaw,
  corpusTexts = [],
  journalIds = [],
  ownerUserId = null,
  timezone = "Asia/Beirut",
  now = Date.now(),
  isSecret = () => false,
}) {
  const seen = new Set([...importedReportIds([checklistRaw, bookRaw, ...corpusTexts]), ...journalIds]);
  let next = highestWorkNumber([checklistRaw, bookRaw, ...corpusTexts]) + 1;
  const ctx = {
    ownerUserId,
    timezone,
    text: (value, max) => (isSecret(String(value ?? "")) ? "[withheld]" : mdInline(value, max)),
  };

  let checklist = checklistRaw.replace(/\r\n/g, "\n");
  let book = bookRaw.replace(/\r\n/g, "\n");
  const imported = [];
  let today = "";

  const ready = [...reports]
    .filter((r) => r && typeof r.id === "string" && r.issue && typeof r.issue === "object")
    .filter((r) => !seen.has(r.id))
    .filter((r) => now - Date.parse(r.created_at) >= IMPORT_GRACE_MS)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  for (const report of ready) {
    const workId = `${ERA_PREFIX}-${next}`;
    next += 1;
    const wrong = report.issue.kind === "wrong";
    const severity = wrong ? "blocker" : "friction";
    const title = issueTitle(report.issue);
    const anchor = workId.toLowerCase();
    const { lines, date } = renderSection(report, workId, ctx);
    today = date || today;

    checklist = appendToNow(checklist, [
      `- [ ] **${workId}** ${title} — [criteria](<${BOOK_FILE}#${anchor}>) _(${severity} - S)_`,
    ]);
    book = insertAfterHeading(book, "## Acceptance Criteria Index", lines);
    book = insertAfterHeading(book, "## Pain Inventory", [
      `${wrong ? "🔴" : "🟠"} **${workId}** ${wrong ? "ERA did the wrong thing with" : "ERA missed"} "${shortRequest(report.issue)}" (ERA report, ${date}). See [acceptance](<#${anchor}>).`,
    ]);
    imported.push({ reportId: report.id, workId, title, severity });
    seen.add(report.id);
  }

  if (imported.length && today) {
    checklist = bumpUpdated(checklist, today);
    book = bumpUpdated(book, today);
  }
  return { checklistRaw: checklist, bookRaw: book, imported };
}

// ---------------------------------------------------------------------------
// Wiring (bridge + CLI)
// ---------------------------------------------------------------------------

/** Report rows from the last `days` days (read-only; service-role client). */
export async function fetchEraIssueReports(supabase, { days = 60, limit = 200 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("era_messages")
    .select("id, user_id, conversation_id, created_at, intent_payload")
    .eq("role", "system")
    .eq("intent_kind", ERA_ISSUE_KIND)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    issue: row.intent_payload && typeof row.intent_payload === "object" ? row.intent_payload.issue : null,
  }));
}

export function readImportJournal(PM_DIR) {
  const file = join(PM_DIR, JOURNAL_REL);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const entry = JSON.parse(line);
        return typeof entry.reportId === "string" ? [entry.reportId] : [];
      } catch {
        return [];
      }
    });
}

function appendImportJournal(PM_DIR, entries) {
  const file = join(PM_DIR, JOURNAL_REL);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, entries.map((e) => JSON.stringify(e) + "\n").join(""), "utf8");
}

function corpusTexts(PM_DIR) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith(".md")) out.push(readFileSync(abs, "utf8"));
    }
  };
  walk(PM_DIR);
  return out;
}

/**
 * Import `reports` into the Hub & ERA files. `write(abs, rel, next, label)`
 * performs each file write (the bridge passes its undo-journaled writer).
 *
 * @param {{
 *   PM_DIR: string,
 *   reports: Array<{ id: string, user_id?: string | null, created_at: string, issue: any }>,
 *   ownerUserId?: string | null,
 *   write: (abs: string, rel: string, next: string, label: string) => unknown,
 *   isSecret?: (text: string) => boolean,
 *   now?: number,
 *   dryRun?: boolean,
 * }} input
 */
export function applyEraIssueImport({ PM_DIR, reports, ownerUserId = null, write, isSecret, now = Date.now(), dryRun = false }) {
  const checklistAbs = join(PM_DIR, ERA_CAMPAIGN, CHECKLIST_FILE);
  const bookAbs = join(PM_DIR, ERA_CAMPAIGN, BOOK_FILE);
  const checklistRaw = readFileSync(checklistAbs, "utf8");
  const bookRaw = readFileSync(bookAbs, "utf8");
  const plan = planEraIssueImport({
    reports,
    checklistRaw,
    bookRaw,
    corpusTexts: corpusTexts(PM_DIR),
    journalIds: readImportJournal(PM_DIR),
    ownerUserId,
    now,
    isSecret,
  });
  if (dryRun || plan.imported.length === 0) return plan;
  const label = `ERA reports: ${plan.imported.map((i) => i.workId).join(", ")}`;
  const crlf = (raw) => raw.includes("\r\n");
  const keepEol = (original, next) => (crlf(original) ? next.replace(/\n/g, "\r\n") : next);
  write(checklistAbs, `${ERA_CAMPAIGN}/${CHECKLIST_FILE}`, keepEol(checklistRaw, plan.checklistRaw), label);
  write(bookAbs, `${ERA_CAMPAIGN}/${BOOK_FILE}`, keepEol(bookRaw, plan.bookRaw), label);
  appendImportJournal(
    PM_DIR,
    plan.imported.map((i) => ({ reportId: i.reportId, workId: i.workId, at: new Date(now).toISOString() })),
  );
  return plan;
}

/**
 * Fetch + import in one call, for the local PM server (at startup and from the
 * Sprints "Refresh" button) and the CLI. Reads the DB only; returns a summary
 * the UI can show. `env` must carry the Supabase URL and service-role key.
 */
export async function syncEraIssues({ PM_DIR, env = process.env, dryRun = false, write = (abs, _rel, next) => writeFileSync(abs, next, "utf8") }) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { ok: false, error: "Supabase URL and service-role key are not set in .env", imported: [], seen: 0, waiting: 0 };
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const { findSecrets } = await import("./relay.mjs");
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const reports = await fetchEraIssueReports(supabase);
    const now = Date.now();
    const plan = applyEraIssueImport({
      PM_DIR,
      reports,
      ownerUserId: env.PM_OWNER_USER_ID || null,
      isSecret: (text) => findSecrets(text, env, [key]).length > 0,
      dryRun,
      write,
      now,
    });
    const waiting = reports.filter((r) => now - Date.parse(r.created_at) < IMPORT_GRACE_MS).length;
    return { ok: true, imported: plan.imported, seen: reports.length, waiting };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), imported: [], seen: 0, waiting: 0 };
  }
}

// ---------------------------------------------------------------------------
// CLI — preview by default; --apply writes.
// ---------------------------------------------------------------------------

async function main() {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const PM_DIR = join(ROOT, "ERA Notes", "10 - Project Management");
  const { config } = await import("dotenv");
  config({ path: join(ROOT, ".env") });
  const apply = process.argv.includes("--apply");
  const result = await syncEraIssues({ PM_DIR, dryRun: !apply });
  if (!result.ok) {
    console.error("era-issues:", result.error);
    process.exit(1);
  }
  if (result.imported.length === 0) {
    console.log(`era-issues: nothing new (${result.seen} report(s) seen${result.waiting ? `, ${result.waiting} still in the Undo window` : ""}).`);
    return;
  }
  for (const item of result.imported) console.log(`${apply ? "imported" : "would import"} ${item.workId} (${item.severity}) — ${item.title}`);
  if (!apply) console.log("Preview only. Re-run with --apply to write the Hub & ERA files.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("era-issues:", err.message);
    process.exit(1);
  });
}

// scripts/pm/uat-feedback.mjs
// R77 — turns submitted UAT "Needs changes" feedback into normal campaign work
// on the next `pnpm pm` startup (and `pnpm pm:uat-feedback --apply`).
//
// Source of truth: `.delivery/v2/uat/feedback.ndjson` (written by the owner's
// wizard, see scripts/delivery-v2/uat.mjs). Output: one unchecked item in the
// owning campaign's `4 - Checklist.md`, a `### <ID>` section in its Master Book
// carrying `**Source:** UAT feedback <thread>`, and — for a bug — a Pain
// Inventory line. It never starts an agent job, applies code, or marks anything
// fixed.
//
// The two files cannot be written atomically, so every item is journalled first:
//   .pm/uat-import.jsonl   intent → committed (or blocked / withdrawn-after-import)
// A crash after either write, or after both but before `committed`, is recovered
// on the next pass by finishing the SAME ID — the intent reserves it — and a
// marker found in the corpus is itself proof of import, so a lost journal also
// converges. Each file is checked against the hash the plan read it with
// immediately before it is replaced; a changed file keeps the feedback pending.
// Another importer is excluded by a lock file. Reads the local UAT store only: no
// database, provider or Git write.
import { createHash } from "node:crypto";
import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CAMPAIGNS } from "./lint.mjs";
import { mdInline } from "./era-issues.mjs";
import { slugify } from "./shared/links.mjs";
import { FEEDBACK_UNDO_MS, feedbackThreads, importJournalPath, readUat } from "../delivery-v2/uat.mjs";

export const SOURCE_MARKER = "**Source:** UAT feedback";
const CHECKLIST_FILE = "4 - Checklist.md";
const bookFile = (campaign) => `${campaign} — Master Book.md`;
const TZ = "Asia/Beirut";
const SEVERITY_EMOJI = { blocker: "🔴", friction: "🟠", annoyance: "🟡", parked: "⚪" };
const sha = (text) => createHash("sha256").update(text).digest("hex");
const lf = (raw) => raw.replace(/\r\n/gu, "\n");
const keepEol = (original, next) => (original.includes("\r\n") ? next.replace(/\n/gu, "\r\n") : next);
const escapeRe = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export function readJournal(root) {
  const file = importJournalPath(root);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((line) => {
    try {
      const row = JSON.parse(line);
      return row && typeof row.thread_id === "string" ? [row] : [];
    } catch {
      return [];
    }
  });
}

function appendJournal(root, row) {
  const file = importJournalPath(root);
  mkdirSync(dirname(file), { recursive: true });
  const torn = existsSync(file) && statSync(file).size > 0 && !readFileSync(file, "utf8").endsWith("\n");
  appendFileSync(file, (torn ? "\n" : "") + JSON.stringify(row) + "\n", "utf8");
}

/** Per thread: the highest committed revision, any open intent, and the last blocked row. */
function journalState(rows) {
  const threads = new Map();
  for (const row of rows) {
    const entry = threads.get(row.thread_id) || { committed: null, intent: null, blocked: null, withdrawnAfter: false };
    if (row.state === "intent") entry.intent = row;
    else if (row.state === "committed") {
      if (!entry.committed || row.revision >= entry.committed.revision) entry.committed = row;
      if (entry.intent && entry.intent.revision <= row.revision) entry.intent = null;
      entry.blocked = null;
    } else if (row.state === "blocked") entry.blocked = row;
    else if (row.state === "withdrawn-after-import") entry.withdrawnAfter = true;
    threads.set(row.thread_id, entry);
  }
  return threads;
}

/** One importer at a time; a lock left by a dead process (over a minute old) is taken over. */
function withLock(root, fn) {
  const lock = join(root, ".pm", "uat-import.lock");
  mkdirSync(dirname(lock), { recursive: true });
  let fd = null;
  try {
    fd = openSync(lock, "wx");
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    try {
      if (Date.now() - statSync(lock).mtimeMs > 60_000) {
        unlinkSync(lock);
        fd = openSync(lock, "wx");
      }
    } catch { /* another process won the race */ }
  }
  if (fd == null) return { locked: true };
  try {
    return fn();
  } finally {
    closeSync(fd);
    try { unlinkSync(lock); } catch { /* gone */ }
  }
}

// ---------------------------------------------------------------------------
// Corpus helpers
// ---------------------------------------------------------------------------

function corpusTexts(pmDir) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith(".md")) out.push(readFileSync(abs, "utf8"));
    }
  };
  walk(pmDir);
  return out;
}

/** Highest number used for `prefix` anywhere, archive included (R-numbers have no hyphen). */
export function highestNumber(texts, prefix) {
  const re = prefix === "R" ? /\bR(\d+)\b/gu : new RegExp(`\\b${prefix}-(\\d+)`, "gu");
  let max = 0;
  for (const text of texts) for (const match of String(text).matchAll(re)) max = Math.max(max, Number(match[1]));
  return max;
}

/** `thread → work ID` for every UAT marker already in the corpus. */
export function importedMarkers(texts) {
  const found = new Map();
  for (const text of texts) {
    let heading = null;
    for (const line of String(text).split(/\r?\n/u)) {
      const h = /^###\s+(\S+)\s*$/u.exec(line);
      if (h) heading = h[1];
      const m = /\*\*Source:\*\* UAT feedback (fb-[0-9a-f]+)/u.exec(line);
      if (m && heading && !found.has(m[1])) found.set(m[1], heading);
    }
  }
  return found;
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

/** Add `line` after the lane's last checkbox row, or at the top of an empty lane. */
function appendToLane(raw, lane, line) {
  const lines = raw.split("\n");
  const start = lines.findIndex((entry) => entry.trim() === `## ${lane}`);
  if (start < 0) throw new Error(`missing "## ${lane}" lane`);
  let end = lines.findIndex((entry, i) => i > start && /^#{1,2}\s/u.test(entry));
  if (end < 0) end = lines.length;
  let insert = start + 1;
  for (let i = start + 1; i < end; i += 1) if (/^- \[[ xX]\] /u.test(lines[i])) insert = i + 1;
  if (insert === start + 1) {
    while (insert < end && lines[insert].trim() === "") insert += 1;
    lines.splice(insert, 0, line, "");
  } else lines.splice(insert, 0, line);
  return lines.join("\n");
}

function appendToSection(raw, workId, line) {
  const lines = raw.split("\n");
  const start = lines.findIndex((entry) => entry.trim() === `### ${workId}`);
  if (start < 0) throw new Error(`missing section ${workId}`);
  let end = lines.findIndex((entry, i) => i > start && /^#{1,3}\s/u.test(entry));
  if (end < 0) end = lines.length;
  let insert = end;
  while (insert > start + 1 && lines[insert - 1].trim() === "") insert -= 1;
  lines.splice(insert, 0, line);
  return lines.join("\n");
}

const bumpUpdated = (raw, date) => raw.replace(/^(updated:\s*)\d{4}-\d{2}-\d{2}\s*$/mu, `$1${date}`);

function stamp(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return { date: "", time: "" };
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
  return { date, time };
}

const hasChecklistRow = (check, workId) => new RegExp(`(?:^|\\n)- \\[[ xX]\\] \\*\\*${escapeRe(workId)}\\*\\*`, "u").test(check);
const hasSection = (body, workId) => new RegExp(`(?:^|\\n)### ${escapeRe(workId)}[ \\t]*(?:\\n|$)`, "u").test(body);

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** A scope-changing request is a feature; a failure with no scenario is only an investigation. */
const kindOf = (thread) => (thread.classification === "change" ? "feature" : thread.scenario_id ? "bug" : "investigation");
const rating = (kind) => ({ severity: "friction", effort: kind === "bug" ? "S" : "M" });

function itemTitle(thread, ctx) {
  const subject = thread.subject || {};
  const where = thread.scenario_title || subject.title || subject.work_id || "UAT";
  return ctx.text(`${where}: ${thread.observation}`, 110).replace(/\.+$/u, "");
}

function describe(thread, ctx) {
  const t = ctx.text;
  const subject = thread.subject || {};
  const when = stamp(thread.observed_at || thread.received_at);
  const lines = [`- **Observed:** ${t(thread.observation, 1000)}`];
  if (thread.scenario_id) {
    const step = thread.step ? ` step ${thread.step}${thread.step_action ? ` — ${t(thread.step_action, 300)}` : ""}` : "";
    lines.push(`- **Scenario:** ${t(thread.scenario_title || thread.scenario_id, 160)} (${t(thread.scenario_id, 64)})${step}`);
  }
  if (thread.expected) lines.push(`- **Expected:** ${t(thread.expected, 600)}`);
  if (thread.actual) lines.push(`- **Actual:** ${t(thread.actual, 600)}`);
  const build = [thread.build, thread.device].filter(Boolean).map((value) => t(value, 120)).join(" · ");
  lines.push(`- **Build / device:** ${build || "not recorded"} · ${when.date} ${when.time} (${TZ})`);
  const identity = thread.binding?.candidate_id ? ` · candidate \`${t(thread.binding.candidate_id, 60)}\`` : thread.binding?.source_revision ? ` · source \`${t(thread.binding.source_revision, 40)}\`` : "";
  lines.push(`- **Delivery:** ${subject.work_id ? t(subject.work_id, 40) : "unlinked"}${subject.run_id ? ` · run \`${t(subject.run_id, 40)}\`` : ""} · handover \`${thread.handover_id}\` revision ${thread.handover_revision}${identity}`);
  if (thread.details) lines.push(`- **Details:** ${t(thread.details, 1500)}`);
  for (const link of thread.evidence || []) lines.push(`- **Evidence:** ${t(link, 300)}`);
  if (thread.disposition?.kind === "follow-up") lines.push(`- **Owner disposition:** separate follow-up — ${t(thread.disposition.reason, 300)}`);
  return lines;
}

function renderSection(thread, workId, ctx) {
  const kind = kindOf(thread);
  const title = itemTitle(thread, ctx);
  const when = stamp(thread.received_at);
  const subject = thread.subject || {};
  const original = subject.work_id ? `[${mdInline(subject.work_id, 40)}](#${String(subject.work_id).toLowerCase()})` : "its delivery";
  const retest = thread.scenario_id
    ? `the failed scenario${thread.step ? ` from step ${thread.step}` : ""} and its adjacent regression cases`
    : "the reported behavior and its adjacent cases";
  const lines = [
    `### ${workId}`,
    "",
    `**Outcome:** ${title}.`,
    `**Kind:** ${kind}`,
    "**Execution:** delivery",
    `${SOURCE_MARKER} ${thread.thread_id} · ${thread.classification} · ${when.date} ${when.time} (${TZ})`,
    "",
    `- **Acceptance:** The failure below no longer occurs. A fresh candidate-bound handover repeats ${retest}, then the owner signs off the new version.`,
    `- **Original:** ${original}`,
    ...describe(thread, ctx),
  ];
  return { lines, kind, title };
}

function renderAmendment(thread, ctx) {
  const when = stamp(thread.received_at);
  const extra = [thread.actual && ` Actual: ${ctx.text(thread.actual, 300)}`, thread.expected && ` Expected: ${ctx.text(thread.expected, 300)}`].filter(Boolean).join("");
  return `- **Update (rev ${thread.revisions}, ${when.date}) · ${thread.thread_id}:** ${ctx.text(thread.observation, 600)}${extra}`;
}

// ---------------------------------------------------------------------------
// Pure planning
// ---------------------------------------------------------------------------

/**
 * Decide what each thread needs this pass. Pure over its inputs.
 *
 * @returns {Array<{ thread: any, action: "create"|"amend"|"recover"|"record-withdrawal"|"wait"|"skip"|"blocked", reason?: string, workId?: string, campaign?: string, revision?: number }>}
 */
export function planThreads({ rows, journal, markers, texts, now, folders = Object.keys(CAMPAIGNS) }) {
  const state = journalState(journal);
  // Every ID the journal ever reserved counts as used, even if its files were never written.
  const reserved = journal.map((row) => row.workId).filter(Boolean);
  const issued = new Map();
  const idOf = (prefix, number) => (prefix === "R" ? `R${number}` : `${prefix}-${number}`);
  /** Heading slugs already taken: `SCH-3.1` and a new `SCH-31` would share the anchor `#sch-31`. */
  const takenSlugs = (prefix) => {
    const re = prefix === "R" ? /\bR\d+\b/gu : new RegExp(`\\b${prefix}-\\d+(?:\\.\\d+)?[a-z]?`, "giu");
    const slugs = new Set();
    for (const text of [...texts, ...reserved]) for (const match of String(text).matchAll(re)) slugs.add(slugify(match[0]));
    return slugs;
  };
  const nextNumber = (prefix) => {
    const state = issued.get(prefix) ?? { number: highestNumber([...texts, ...reserved], prefix), slugs: takenSlugs(prefix) };
    do state.number += 1;
    while (state.slugs.has(slugify(idOf(prefix, state.number))));
    state.slugs.add(slugify(idOf(prefix, state.number)));
    issued.set(prefix, state);
    return state.number;
  };
  const settled = (thread) => Date.parse(now) - Date.parse(thread.received_at) >= FEEDBACK_UNDO_MS;
  const plan = [];
  const threads = feedbackThreads(rows).sort((a, b) => Date.parse(a.first_received_at) - Date.parse(b.first_received_at));
  for (const thread of threads) {
    const entry = state.get(thread.thread_id) || { committed: null, intent: null, blocked: null, withdrawnAfter: false };
    const imported = entry.committed?.workId || markers.get(thread.thread_id) || null;
    const push = (action, extra = {}) => plan.push({ thread, action, ...extra });
    if (thread.classification === "comment") {
      push("skip", { reason: "comment" });
    } else if (imported) {
      const campaign = entry.committed?.campaign || thread.subject?.campaign || null;
      if (thread.state === "withdrawn") {
        // Undo after import never deletes what may already be edited or dispatched: it is recorded for the owner.
        if (entry.withdrawnAfter) push("skip", { reason: "withdrawn-recorded" });
        else push("record-withdrawal", { workId: imported, campaign });
      } else if (entry.committed && thread.revisions > entry.committed.revision) {
        if (settled(thread)) push("amend", { workId: imported, campaign, revision: thread.revisions });
        else push("wait", { reason: "undo-window" });
      } else if (!entry.committed) {
        // The marker is in the corpus but the journal never said so: converge on the corpus.
        push("recover", { workId: imported, campaign, revision: 1 });
      } else push("skip", { reason: "imported" });
    } else if (entry.intent) {
      push(entry.intent.action === "amend" ? "amend" : "recover", { workId: entry.intent.workId, campaign: entry.intent.campaign, revision: entry.intent.revision });
    } else if (thread.state === "withdrawn") {
      push("skip", { reason: "withdrawn" });
    } else if (thread.state === "dispositioned" && thread.disposition?.kind !== "follow-up") {
      push("skip", { reason: "resolved" });
    } else if (!settled(thread)) {
      push("wait", { reason: "undo-window" });
    } else {
      const campaign = thread.subject?.campaign || null;
      if (!campaign || !folders.includes(campaign)) {
        push("blocked", { reason: campaign ? `unknown campaign "${campaign}"` : "no owning campaign for this delivery" });
      } else {
        const prefix = CAMPAIGNS[campaign];
        push("create", { campaign, workId: idOf(prefix, nextNumber(prefix)), revision: thread.revisions });
      }
    }
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

const readFile = (abs) => {
  const raw = readFileSync(abs, "utf8");
  return { raw, hash: sha(raw) };
};

/** Replace a file only if it still holds the bytes the plan was computed from. */
function writeGuarded(abs, expectedHash, next, original) {
  if (readFile(abs).hash !== expectedHash) return false;
  const temp = `${abs}.${process.pid}.uat.tmp`;
  writeFileSync(temp, keepEol(original, next), "utf8");
  renameSync(temp, abs);
  return true;
}

/**
 * Do the writes for one planned item. Each file is handled on its own evidence —
 * whatever already holds this ID or marker is left alone — so a recovery
 * finishes only what is missing and a repeat writes nothing.
 */
function perform({ item, pmDir, ctx, now }) {
  const { thread, workId, action } = item;
  const campaign = item.campaign || thread.subject?.campaign;
  if (!campaign || !(campaign in CAMPAIGNS)) return { ok: false, cause: "no owning campaign for this delivery" };
  const dir = join(pmDir, campaign);
  const checklistAbs = join(dir, CHECKLIST_FILE);
  const bookAbs = join(dir, bookFile(campaign));
  if (!existsSync(checklistAbs) || !existsSync(bookAbs)) return { ok: false, cause: `${campaign} files are missing` };
  const checklist = readFile(checklistAbs);
  const book = readFile(bookAbs);
  const check = lf(checklist.raw);
  const body = lf(book.raw);
  const kind = kindOf(thread);
  const { severity, effort } = rating(kind);
  const date = stamp(now).date;

  if (action === "amend") {
    if (!hasSection(body, workId)) return { ok: false, cause: `${workId} is no longer in the ${campaign} book` };
    if (new RegExp(`Update \\(rev ${thread.revisions}[^\\n]*${escapeRe(thread.thread_id)}`, "u").test(body)) return { ok: true, wrote: [], kind };
    const nextBook = bumpUpdated(appendToSection(body, workId, renderAmendment(thread, ctx)), date);
    if (!writeGuarded(bookAbs, book.hash, nextBook, book.raw)) return { ok: false, cause: "the book changed while importing" };
    return { ok: true, wrote: [bookFile(campaign)], kind };
  }

  const section = renderSection(thread, workId, ctx);
  const wrote = [];
  if (!hasChecklistRow(check, workId)) {
    const lane = thread.urgency === "now" ? "Now" : "Next";
    const line = `- [ ] **${workId}** ${section.title} — [criteria](<${bookFile(campaign)}#${workId.toLowerCase()}>) _(${severity} - ${effort})_`;
    const nextCheck = bumpUpdated(appendToLane(check, lane, line), date);
    if (!writeGuarded(checklistAbs, checklist.hash, nextCheck, checklist.raw)) return { ok: false, cause: "the checklist changed while importing" };
    wrote.push(CHECKLIST_FILE);
  }
  if (!(hasSection(body, workId) && body.includes(`${SOURCE_MARKER} ${thread.thread_id}`))) {
    let nextBook = insertAfterHeading(body, "## Acceptance Criteria Index", section.lines);
    if (kind === "bug") {
      nextBook = insertAfterHeading(nextBook, "## Pain Inventory", [
        `${SEVERITY_EMOJI[severity]} **${workId}** ${section.title} (UAT feedback, ${stamp(thread.received_at).date}). See [acceptance](<#${workId.toLowerCase()}>).`,
      ]);
    }
    nextBook = bumpUpdated(nextBook, date);
    if (!writeGuarded(bookAbs, book.hash, nextBook, book.raw)) return { ok: false, cause: "the book changed while importing" };
    wrote.push(bookFile(campaign));
  }
  return { ok: true, wrote, kind, title: section.title, severity, effort };
}

/**
 * Reconcile every eligible thread. Returns a summary the server and CLI show.
 *
 * @param {{ root: string, pmDir: string, now?: string, dryRun?: boolean, isSecret?: (text: string) => boolean }} input
 */
export function applyUatFeedbackImport({ root, pmDir, now = new Date().toISOString(), dryRun = false, isSecret = () => false }) {
  const ctx = { text: (value, max = 400) => (isSecret(String(value ?? "")) ? "[withheld]" : mdInline(value, max)) };
  const summary = { ok: true, imported: [], amended: [], blocked: [], waiting: 0, skipped: 0 };
  const pending = (entry) => ["create", "amend", "recover"].includes(entry.action);
  const record = (entry, result = {}) => {
    const row = { thread_id: entry.thread.thread_id, workId: entry.workId, campaign: entry.campaign || entry.thread.subject?.campaign, ...result };
    (entry.action === "amend" ? summary.amended : summary.imported).push(row);
  };
  const survey = () => {
    const texts = corpusTexts(pmDir);
    return planThreads({ rows: readUat({ root }).feedback, journal: readJournal(root), markers: importedMarkers(texts), texts, now });
  };
  const note = (plan) => {
    summary.waiting = plan.filter((entry) => entry.action === "wait").length;
    summary.skipped = plan.filter((entry) => entry.action === "skip").length;
    const journal = journalState(readJournal(root));
    for (const entry of plan.filter((candidate) => candidate.action === "blocked")) {
      if (!summary.blocked.some((blocked) => blocked.thread_id === entry.thread.thread_id)) summary.blocked.push({ thread_id: entry.thread.thread_id, cause: entry.reason });
      if (!dryRun && journal.get(entry.thread.thread_id)?.blocked?.cause !== entry.reason) {
        appendJournal(root, { state: "blocked", thread_id: entry.thread.thread_id, revision: entry.thread.revisions, cause: entry.reason, at: now });
      }
    }
  };
  const locked = withLock(root, () => {
    if (dryRun) {
      const plan = survey();
      note(plan);
      for (const entry of plan.filter(pending)) record(entry, { dry: true });
      return null;
    }
    const failed = new Set();
    for (let pass = 0; pass < 200; pass += 1) {
      const plan = survey();
      note(plan);
      // One write per pass: the next ID and the file witnesses are always read fresh.
      const item = plan.find((entry) => pending(entry) && !failed.has(entry.thread.thread_id))
        || plan.find((entry) => entry.action === "record-withdrawal");
      if (!item) break;
      if (item.action === "record-withdrawal") {
        appendJournal(root, { state: "withdrawn-after-import", thread_id: item.thread.thread_id, workId: item.workId, at: now });
        continue;
      }
      // A recovery resumes the intent already on record; it does not write a second one.
      const open = journalState(readJournal(root)).get(item.thread.thread_id)?.intent;
      if (!(open && open.revision === item.revision && open.workId === item.workId)) {
        appendJournal(root, { state: "intent", thread_id: item.thread.thread_id, revision: item.revision, workId: item.workId, campaign: item.campaign, action: item.action === "amend" ? "amend" : "create", at: now });
      }
      let result;
      try {
        result = perform({ item, pmDir, ctx, now });
      } catch (error) {
        result = { ok: false, cause: error instanceof Error ? error.message : String(error) };
      }
      if (!result.ok) {
        // The intent stays, so a later pass finishes the same ID. Show the cause; try the others.
        appendJournal(root, { state: "blocked", thread_id: item.thread.thread_id, revision: item.revision, cause: result.cause, at: now });
        summary.blocked.push({ thread_id: item.thread.thread_id, cause: result.cause });
        failed.add(item.thread.thread_id);
        continue;
      }
      appendJournal(root, { state: "committed", thread_id: item.thread.thread_id, revision: item.revision, workId: item.workId, campaign: item.campaign || item.thread.subject?.campaign, at: now });
      record(item, { kind: result.kind, title: result.title, severity: result.severity });
    }
    return null;
  });
  if (locked?.locked) return { ...summary, ok: false, error: "another PM process is importing UAT feedback" };
  return summary;
}

/** Wiring for `pnpm pm` startup and the CLI: withholds credential-shaped text. */
export async function syncUatFeedback({ root, pmDir, env = process.env, dryRun = false, now = new Date().toISOString() }) {
  try {
    const { findSecrets } = await import("./relay.mjs");
    const key = env.NEXT_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    return applyUatFeedbackImport({ root, pmDir, now, dryRun, isSecret: (text) => findSecrets(text, env, key ? [key] : []).length > 0 });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), imported: [], amended: [], blocked: [], waiting: 0, skipped: 0 };
  }
}

// ---------------------------------------------------------------------------
// CLI — preview by default; --apply writes.
// ---------------------------------------------------------------------------

async function main() {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const pmDir = join(ROOT, "ERA Notes", "10 - Project Management");
  const { config } = await import("dotenv");
  config({ path: join(ROOT, ".env") });
  const apply = process.argv.includes("--apply");
  const result = await syncUatFeedback({ root: ROOT, pmDir, dryRun: !apply });
  if (!result.ok) {
    console.error("uat-feedback:", result.error);
    process.exit(1);
  }
  for (const item of result.imported) console.log(`${apply ? "imported" : "would import"} ${item.workId} (${item.campaign}) from ${item.thread_id}`);
  for (const item of result.amended) console.log(`${apply ? "updated" : "would update"} ${item.workId} from ${item.thread_id}`);
  for (const item of result.blocked) console.log(`blocked ${item.thread_id}: ${item.cause}`);
  if (!result.imported.length && !result.amended.length && !result.blocked.length) {
    console.log(`uat-feedback: nothing new${result.waiting ? ` (${result.waiting} still in the Undo window)` : ""}.`);
  }
  if (!apply && (result.imported.length || result.amended.length)) console.log("Preview only. Re-run with --apply to write the campaign files.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("uat-feedback:", error.message);
    process.exit(1);
  });
}

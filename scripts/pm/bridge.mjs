// scripts/pm/bridge.mjs
// Laptop-side relay bridge for the mobile PM Command Center (/pm/live).
//
// Publishes distilled snapshots (checklist tasks, campaign rollups, completion
// history, delivery session state, a fleet rollup, and a liveness heartbeat) to
// Supabase `pm_live` — six row kinds, all `jsonb` payloads on the existing
// (id, kind, payload) shape, so adding one never needs a migration — and drains
// phone-issued commands from `pm_commands`, executing each one via the SAME
// in-process functions the desktop dashboard uses (`routeDelivery()` /
// `mutations.mjs`) so every server-side guard (flight-check, budget envelope,
// dirty-tree/red-baseline acks, drift checks, build lock, ...) applies for
// free — this file adds zero new delivery business logic.
//
// Outbound-only by construction: this module never opens a listening socket
// and never widens pm-server's 127.0.0.1 binding (scripts/pm/net.mjs is
// untouched). See migrations/2026-07-25_pm-mobile-relay.sql and the mobile
// command-tiers amendment (2026-07-25) in
// "ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md"
// §Vision & Decisions, for why this threads rather than reopens the rejected
// "remote decision controls" idea: gate approval (spec/plan/uat/blocked) is
// never reachable from this module.
//
// Started from pm-server.mjs only when PM_BRIDGE=1 is set (env) and
// --no-bridge was not passed. Requires PM_OWNER_USER_ID plus the existing
// NEXT_PUBLIC_SUPABASE_URL / NEXT_SUPABASE_SERVICE_ROLE_KEY from .env.
//
// Split into four pure, Supabase-free cores (`createTasksSnapshotBuilder`,
// `createRollupsSnapshotBuilder`, `createHistorySnapshotBuilder`,
// `createCommandExecutor`) plus the Supabase-wiring `createBridge`, so the
// allowlist/guardrail logic and every payload shape are unit-testable without a
// network — see tests/pm-bridge.test.ts, and the same pure-core convention as
// scripts/pm/lint.mjs's lintChecklist / CLI split.

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { CAMPAIGNS, lintChecklist, masterBookName } from "./lint.mjs";
import { fileTasks, severityItems, sumSeverity } from "./shared/tasks.mjs";
import { parseFrontmatter } from "./shared/frontmatter.mjs";
import { scanLines } from "./shared/md-scan.mjs";
import { cleanInlineText } from "./shared/text.mjs";
import { appendUnderHeading } from "./mutations.mjs";
import { DEFAULT_CONFIG } from "../delivery/config.mjs";
import { textHash } from "../delivery/packet.mjs";
import { routeDelivery } from "../delivery/server-routes.mjs";
import { isRunnerAlive } from "../delivery/run-session.mjs";

const HEARTBEAT_INTERVAL_MS = 10_000;
const RUNNER_DEAD_DEBOUNCE_MS = 60_000;
const POLL_FALLBACK_MS = 5_000;
const EVENTS_TAIL_LINES = 40;
// Session detail budget. Everything below is derived from files that already
// exist on disk; the caps exist because a realtime row has to stay small enough
// to arrive, and a long session's transcript does not.
const TURNS_TAIL = 40;
const TURNS_WITH_EXCERPT = 12;
const EXCERPT_CHARS = 280;
const QA_CAP = 30;
const QA_TEXT_CHARS = 400;
const ARTIFACT_EXCERPTS = [
  { key: "spec", label: "Spec", path: ["artifacts", "spec.md"], chars: 1200 },
  { key: "plan", label: "Plan", path: ["artifacts", "plan.md"], chars: 1200 },
  { key: "summary", label: "Finish summary", path: ["artifacts", "finish", "summary.md"], chars: 2000 },
  { key: "remaining", label: "Remaining work", path: ["artifacts", "finish", "remaining-work.json"], chars: 800 },
  { key: "recovery", label: "Recovery", path: ["artifacts", "finish", "recovery.md"], chars: 800 },
];
const SESSION_SNAPSHOT_MAX_BYTES = 200_000;
const INBOX_FILE = "0 - Inbox.md";
const CHECKLIST_FILE = "4 - Checklist.md";
// Pre-consolidation state file. Campaigns now keep everything in their Master Book;
// this is only still read for a campaign whose book has not been written yet.
const LEGACY_FEATURE_STATE_FILE = "1 - Feature State.md";
const LANES = ["Now", "Next", "Later"];
const SEVERITIES = ["blocker", "friction", "annoyance", "parked"];
// A finished session's `session:<id>` row is only useful while it is still on
// screen in the phone's "Recent" strip. Nothing else ever deletes these, so
// without a prune the table grows without bound (one row per session, forever).
const SESSION_ROW_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TERMINAL_SESSION_STATES = new Set(["SHIPPED", "CANCELLED"]);

/**
 * Absolute path to a campaign's consolidated Master Book — the home of its
 * Shipped Log (✅ stamps) and Pain Inventory (emoji bullets). Falls back to the
 * legacy `1 - Feature State.md` for any campaign not yet consolidated.
 * Returns null when neither exists.
 */
function campaignBookPath(PM_DIR, campaign) {
  const book = join(PM_DIR, campaign, masterBookName(campaign));
  if (existsSync(book)) return book;
  const legacy = join(PM_DIR, campaign, LEGACY_FEATURE_STATE_FILE);
  return existsSync(legacy) ? legacy : null;
}

// The only command types the phone may ever issue. This is a second line of
// defence — the DB CHECK constraint on pm_commands.type is the first — but
// THIS list, and the gate/type refusals inside each exec* function below, are
// authoritative. Deliberately absent: set-budget, set-config, rotate, fork,
// and any decision on the blocked gate. Those stay laptop-only
// (Delivery Master Book, mobile command tiers amendment).
//
// DLV-73 adds `approve` and `accept`, scoped to INSTANT sessions only. The
// owner authorized that on 2026-08-01 and the reasoning is specific to the
// lane rather than general: an INSTANT session is, by its launch precondition,
// a single located file and a diff bounded at `instantMaxDiffLines` — a change
// small enough to actually read on a phone screen, which is the thing the
// laptop-only rule was protecting. It does not generalize: `execApprove` and
// `execAccept` re-verify the lane server-side, so a FAST/STANDARD/DEEP session
// is refused even if a stale phone bundle offers the button.
export const ALLOWED_TYPES = new Set([
  "capture",
  "undo",
  "preflight",
  "launch",
  "pause",
  "abort-turn",
  "resume",
  "cancel",
  "answer",
  "ask",
  "approve",
  "accept",
]);

// Types that were once issuable and are now permanently refused, with the
// reason surfaced to the phone instead of the generic "not permitted" line.
// `tick` is here rather than simply deleted because /pm/live is an installed
// PWA: a phone running a cached older bundle can still POST one, and the
// server — not the client bundle — is what has to make it impossible.
// Removed 2026-07-25 after a single tap on a checklist row silently marked a
// PM item done with no confirmation and no way back (DLV-23).
const REFUSED_TYPES = new Map([
  ["tick", "checklist ticks are laptop-only — tap an item on the phone to deliver it instead"],
]);

function nowIso() {
  return new Date().toISOString();
}

function readJsonl(absPath, limit) {
  if (!existsSync(absPath)) return [];
  const raw = readFileSync(absPath, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const tail = limit ? lines.slice(-limit) : lines;
  return tail
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ============================================================================
// Pure core 1: checklist task snapshot (no Supabase, no delivery ctx)
// ============================================================================

/** @param {{PM_DIR:string}} deps */
export function createTasksSnapshotBuilder({ PM_DIR }) {
  function readCampaignFile(campaign) {
    const rel = join(campaign, "4 - Checklist.md");
    const abs = join(PM_DIR, rel);
    if (!existsSync(abs)) return null;
    return { rel: rel.replace(/\\/g, "/"), raw: readFileSync(abs, "utf8") };
  }

  function tasksForFile(file, raw, module) {
    const lines = raw.split("\n");
    return fileTasks(raw)
      .filter((t) => t.section === "Now" || t.section === "Next" || t.section === "Later")
      .map((t) => {
        const lineText = lines[t.line] || "";
        return {
          idChip: t.idChip,
          text: t.text,
          severity: t.severity,
          effort: t.effort,
          state: t.state,
          section: t.section,
          sectionRank: t.sectionRank,
          cbidx: t.cbidx,
          file,
          module,
          textHash: textHash(lineText),
          // Raw line text (not just its hash) — startSession()'s buildItemIdentity
          // drift guard needs the actual text to re-hash against the live file;
          // this is what /pm/live's launch flow forwards as `expectText`.
          lineText,
        };
      });
  }

  /** Parsed tasks only — no doc bodies, no embedded source. ~40-80 KB vs the 7 MB static snapshot. */
  function buildTasksSnapshot() {
    const tasks = [];
    for (const campaign of Object.keys(CAMPAIGNS)) {
      const f = readCampaignFile(campaign);
      if (!f) continue;
      tasks.push(...tasksForFile(f.rel, f.raw, campaign));
    }
    const inboxAbs = join(PM_DIR, INBOX_FILE);
    if (existsSync(inboxAbs)) {
      const raw = readFileSync(inboxAbs, "utf8");
      tasks.push(...tasksForFile(INBOX_FILE, raw, "Inbox"));
    }
    return { generatedAt: nowIso(), tasks };
  }

  return { buildTasksSnapshot };
}

// ============================================================================
// Pure core 2: campaign rollups (no Supabase, no delivery ctx)
// ============================================================================

function emptyCounts(keys) {
  return keys.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
}

/**
 * Per-campaign aggregates for the /pm/live Overview and Campaigns views.
 *
 * Distributions (byLane / bySeverity / byEffort) count OPEN items only — a
 * done item still sitting in a lane is a lint W1 anomaly awaiting a sweep to
 * the campaign's Master Book Shipped Log, not part of the working queue. `total`/`done` are
 * reported alongside so the anomaly is still visible.
 *
 * @param {{PM_DIR:string}} deps
 */
export function createRollupsSnapshotBuilder({ PM_DIR }) {
  function readIfExists(...segments) {
    const abs = join(PM_DIR, ...segments);
    if (!existsSync(abs)) return null;
    return { abs, raw: readFileSync(abs, "utf8") };
  }

  function checklistRollup(raw) {
    const tasks = fileTasks(raw).filter((t) => LANES.includes(t.section));
    const open = tasks.filter((t) => t.state !== "done");
    const byEffort = emptyCounts(["S", "M", "L", "other"]);
    for (const t of open) {
      const key = t.effort && ["S", "M", "L"].includes(t.effort) ? t.effort : "other";
      byEffort[key] += 1;
    }
    const bySeverity = emptyCounts([...SEVERITIES, "none"]);
    for (const t of open) bySeverity[t.severity || "none"] += 1;
    const byLane = emptyCounts(LANES);
    for (const t of open) byLane[t.section] += 1;
    return { total: tasks.length, done: tasks.length - open.length, open: open.length, byLane, bySeverity, byEffort };
  }

  /**
   * Grammar health only — the E5 link/path resolvers are deliberately left
   * unset, so no filesystem walk happens per publish. E1-E4 + W1/W2 are what a
   * dashboard tile can act on; broken-link auditing stays a `pnpm pm:lint` job.
   */
  function lintRollup(raw, campaign) {
    const findings = lintChecklist(raw, { campaign });
    return {
      errors: findings.filter((f) => f.level === "error").length,
      // "warn", not "warning" — matches the level the CLI filters on (lint.mjs).
      warnings: findings.filter((f) => f.level === "warn").length,
    };
  }

  function buildRollupsSnapshot() {
    const campaigns = [];
    for (const [campaign, prefix] of Object.entries(CAMPAIGNS)) {
      const checklist = readIfExists(campaign, CHECKLIST_FILE);
      if (!checklist) continue;
      const bookAbs = campaignBookPath(PM_DIR, campaign);
      const featureState = bookAbs ? { abs: bookAbs, raw: readFileSync(bookAbs, "utf8") } : null;
      let mtimeMs = 0;
      try {
        mtimeMs = statSync(checklist.abs).mtimeMs;
      } catch {
        // a file racing a laptop-side write just reports 0 until the next publish
      }
      campaigns.push({
        campaign,
        prefix,
        checklist: checklistRollup(checklist.raw),
        pain: featureState ? sumSeverity(severityItems(featureState.raw)) : emptyCounts(SEVERITIES),
        updated: parseFrontmatter(checklist.raw).meta.updated || null,
        mtimeMs,
        lint: lintRollup(checklist.raw, campaign),
      });
    }

    const totals = campaigns.reduce(
      (acc, c) => ({
        campaigns: acc.campaigns + 1,
        total: acc.total + c.checklist.total,
        done: acc.done + c.checklist.done,
        open: acc.open + c.checklist.open,
        blockers: acc.blockers + c.checklist.bySeverity.blocker,
        painBlockers: acc.painBlockers + c.pain.blocker,
        lintErrors: acc.lintErrors + c.lint.errors,
        lintWarnings: acc.lintWarnings + c.lint.warnings,
      }),
      { campaigns: 0, total: 0, done: 0, open: 0, blockers: 0, painBlockers: 0, lintErrors: 0, lintWarnings: 0 },
    );

    return { generatedAt: nowIso(), campaigns, totals };
  }

  return { buildRollupsSnapshot };
}

// ============================================================================
// Pure core 3: completion history (no Supabase, no delivery ctx)
// ============================================================================

const STAMP_RE = /✅\s*(\d{4}-\d{2}-\d{2})/u;
const BOLD_ID_RE = /\*\*([A-Z]{1,5}-?\d+[a-z]?(?:\.\d+[a-z]?)?)[:.\s*]/;
const CELL_ID_RE = /^\s*\|\s*\*{0,2}([A-Z]{1,5}-?\d+[a-z]?(?:\.\d+[a-z]?)?)\*{0,2}\s*\|/;

/**
 * Completion history parsed from each campaign's Master Book Shipped Log
 * done-stamps. Two shapes are in use across the vault and both are supported:
 *
 *   prose:  ✅ 2026-07-16 — **DW-1: Flight recorder foundation.** …
 *   table:  | HLTH-1 | Module scaffold … | ✅ 2026-07-17 | evidence |
 *
 * This is the only source of "when did work land" anywhere in the PM corpus —
 * checklist items carry no date — so it is what the burndown/velocity widgets
 * read. Coverage is uneven by campaign (some sweep diligently, some don't), so
 * the series is honest-but-sparse rather than complete.
 *
 * @param {{PM_DIR:string}} deps
 */
export function createHistorySnapshotBuilder({ PM_DIR }) {
  function completionsForCampaign(campaign, raw) {
    const out = [];
    for (const line of scanLines(raw).lines) {
      if (line.type === "in-fence") continue;
      const stamp = line.raw.match(STAMP_RE);
      if (!stamp) continue;
      const cell = line.raw.match(CELL_ID_RE);
      const bold = line.raw.match(BOLD_ID_RE);
      const idChip = (cell && cell[1]) || (bold && bold[1]) || null;
      // Prose lines carry their title after the stamp; table rows carry it in
      // the second cell. Fall back to the whole line so nothing is dateless.
      const text = cell
        ? cleanInlineText((line.raw.split("|")[2] || "").trim())
        : cleanInlineText(line.raw.slice((stamp.index || 0) + stamp[0].length).replace(/^\s*[—–-]\s*/u, ""));
      out.push({ date: stamp[1], campaign, idChip: idChip ? idChip.toUpperCase() : null, text });
    }
    return out;
  }

  function buildHistorySnapshot() {
    const completions = [];
    for (const campaign of Object.keys(CAMPAIGNS)) {
      const abs = campaignBookPath(PM_DIR, campaign);
      if (!abs) continue;
      completions.push(...completionsForCampaign(campaign, readFileSync(abs, "utf8")));
    }
    completions.sort((a, b) => a.date.localeCompare(b.date));

    const dayMap = new Map();
    for (const c of completions) {
      const day = dayMap.get(c.date) || { date: c.date, count: 0, byCampaign: {} };
      day.count += 1;
      day.byCampaign[c.campaign] = (day.byCampaign[c.campaign] || 0) + 1;
      dayMap.set(c.date, day);
    }

    return {
      generatedAt: nowIso(),
      completions,
      completedByDay: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  return { buildHistorySnapshot };
}

/** Delivery spend bucketed by calendar day, derived from the fleet session list. */
export function spendByDay(sessions) {
  const dayMap = new Map();
  for (const s of sessions || []) {
    if (!s.updatedAt) continue;
    const date = String(s.updatedAt).slice(0, 10);
    const day = dayMap.get(date) || { date, costUsd: 0, sessions: 0 };
    day.costUsd += (s.usageTotal && s.usageTotal.costUsd) || 0;
    day.sessions += 1;
    dayMap.set(date, day);
  }
  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// Pure core 4: session detail (Supabase-free — reads a session dir from disk)
// ============================================================================

function trunc(value, limit) {
  const text = String(value == null ? "" : value);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function readTextIfExists(abs, limit) {
  if (!existsSync(abs)) return null;
  try {
    const raw = readFileSync(abs, "utf8");
    return { bytes: Buffer.byteLength(raw), excerpt: trunc(raw.trim(), limit), truncated: raw.trim().length > limit };
  } catch {
    return null;
  }
}

/** The Q&A ledger, split the way the owner reads it: what needs an answer, then what got one. */
function readQa(dir) {
  const abs = join(dir, "memory", "ledger.json");
  if (!existsSync(abs)) return null;
  let ledger;
  try { ledger = JSON.parse(readFileSync(abs, "utf8")); } catch { return null; }
  const all = Array.isArray(ledger.questions) ? ledger.questions : [];
  const shape = (question) => ({
    id: question.id,
    text: trunc(question.text, QA_TEXT_CHARS),
    kind: question.kind || null,
    status: question.status || null,
    source: question.source || null,
    phase: question.phase || null,
    askedAt: question.askedAt || null,
    answer: question.answer ? { text: trunc(question.answer.text, QA_TEXT_CHARS), at: question.answer.at || null } : null,
  });
  // Blocking questions first: those are the ones the session is stopped on.
  const open = all.filter((q) => q.status === "open").sort((a, b) => (a.kind === "blocking" ? 0 : 1) - (b.kind === "blocking" ? 0 : 1));
  const answered = all.filter((q) => q.status === "answered").slice(-Math.max(0, QA_CAP - open.length));
  return {
    open: open.slice(0, QA_CAP).map(shape),
    answered: answered.map(shape),
    dismissedCount: all.filter((q) => q.status === "dismissed").length,
    total: all.length,
  };
}

/** The last assistant sentence of a turn — enough to tell what happened without shipping the transcript. */
function turnExcerpt(dir, turnId) {
  const abs = join(dir, "transcript", `t-${turnId}.ndjson`);
  const records = readJsonl(abs);
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record.kind === "assistant.text" && record.text) return { excerpt: trunc(record.text.trim(), EXCERPT_CHARS), excerptKind: "text" };
    if (record.kind === "assistant.reasoning" && record.reasoning) return { excerpt: trunc(String(record.reasoning).trim(), EXCERPT_CHARS), excerptKind: "reasoning" };
  }
  return { excerpt: null, excerptKind: null };
}

function readTurns(dir) {
  const all = readJsonl(join(dir, "transcript", "turns.ndjson"));
  const tail = all.slice(-TURNS_TAIL);
  const excerptFrom = Math.max(0, tail.length - TURNS_WITH_EXCERPT);
  return {
    all,
    tail: tail.map((turn, index) => ({
      turnId: turn.turnId,
      phase: turn.phase || null,
      role: turn.role || null,
      provider: turn.provider || null,
      model: turn.model || null,
      effort: turn.effort || null,
      startedAt: turn.startedAt || null,
      durationMs: turn.durationMs ?? null,
      costUsd: turn.costUsd ?? (turn.usage && turn.usage.costUsd) ?? null,
      result: turn.result || null,
      records: turn.records ?? null,
      ...(index >= excerptFrom ? turnExcerpt(dir, turn.turnId) : { excerpt: null, excerptKind: null }),
    })),
    truncated: all.length > tail.length,
  };
}

/** Where the money went, by phase and by model — derived from every turn, not just the tail. */
function costDetailFrom(turns) {
  const add = (map, key, turn) => {
    const row = map.get(key) || { key, costUsd: 0, turns: 0 };
    row.costUsd += Number(turn.costUsd ?? (turn.usage && turn.usage.costUsd) ?? 0) || 0;
    row.turns += 1;
    map.set(key, row);
  };
  const byPhase = new Map();
  const byModel = new Map();
  for (const turn of turns) {
    add(byPhase, turn.phase || "unknown", turn);
    add(byModel, [turn.provider, turn.model].filter(Boolean).join(" · ") || "unknown", turn);
  }
  const last = turns[turns.length - 1];
  return {
    byPhase: [...byPhase.values()].sort((a, b) => b.costUsd - a.costUsd),
    byModel: [...byModel.values()].sort((a, b) => b.costUsd - a.costUsd),
    perTurn: turns.slice(-TURNS_TAIL).map((turn) => ({ turnId: turn.turnId, phase: turn.phase || null, costUsd: Number(turn.costUsd ?? 0) || 0 })),
    context: last && last.context ? { occupancyTokens: last.context.occupancyTokens ?? null, windowTokens: last.context.windowTokens ?? null, pctUsed: last.context.pctUsed ?? null } : null,
  };
}

/**
 * Everything the phone needs to *read* a session — the Q&A ledger, a compact
 * conversation tail, artifact excerpts and the cost breakdown. All of it already
 * exists under `.delivery/sessions/<id>/`; none of it was ever relayed.
 *
 * Pure and Supabase-free so the shapes and the size ladder are testable without
 * a network. New fields ride the existing `(id, kind, payload jsonb)` row — no
 * migration, by design.
 *
 * @param {string} sessionDir absolute path to the session directory
 */
export function buildSessionExtras(sessionDir) {
  if (!sessionDir || !existsSync(sessionDir)) return {};
  const turns = readTurns(sessionDir);
  const artifacts = ARTIFACT_EXCERPTS.map((spec) => {
    const found = readTextIfExists(join(sessionDir, ...spec.path), spec.chars);
    return { key: spec.key, label: spec.label, exists: Boolean(found), bytes: found ? found.bytes : 0, excerpt: found ? found.excerpt : null, truncated: found ? found.truncated : false };
  }).filter((artifact) => artifact.exists);

  return {
    qa: readQa(sessionDir),
    turnsTail: turns.tail,
    turnsTotal: turns.all.length,
    artifacts,
    costDetail: turns.all.length ? costDetailFrom(turns.all) : null,
  };
}

/**
 * Shrink a session row until it fits the realtime payload budget, dropping the
 * cheapest information first and *saying so* — a silently truncated detail view
 * is worse than a short one, because the owner cannot tell which they are
 * looking at. Returns the snapshot (mutated) either way.
 */
export function capSessionSnapshot(snapshot, maxBytes = SESSION_SNAPSHOT_MAX_BYTES) {
  const size = () => Buffer.byteLength(JSON.stringify(snapshot));
  if (size() <= maxBytes) return snapshot;
  const dropped = [];

  if (snapshot.turnsTail?.some((turn) => turn.excerpt)) {
    snapshot.turnsTail = snapshot.turnsTail.map((turn) => ({ ...turn, excerpt: null, excerptKind: null }));
    dropped.push("turn excerpts");
    if (size() <= maxBytes) return Object.assign(snapshot, { truncated: dropped });
  }
  if ((snapshot.turnsTail?.length ?? 0) > 15) {
    snapshot.turnsTail = snapshot.turnsTail.slice(-15);
    dropped.push("older turns");
    if (size() <= maxBytes) return Object.assign(snapshot, { truncated: dropped });
  }
  if (snapshot.qa?.answered?.length) {
    snapshot.qa = { ...snapshot.qa, answered: [] };
    dropped.push("answered questions");
    if (size() <= maxBytes) return Object.assign(snapshot, { truncated: dropped });
  }
  if ((snapshot.eventsTail?.length ?? 0) > 20) {
    snapshot.eventsTail = snapshot.eventsTail.slice(-20);
    dropped.push("older events");
    if (size() <= maxBytes) return Object.assign(snapshot, { truncated: dropped });
  }
  if (snapshot.artifacts?.length) {
    snapshot.artifacts = snapshot.artifacts.map((artifact) => ({ ...artifact, excerpt: null, truncated: true }));
    dropped.push("artifact excerpts");
  }
  return Object.assign(snapshot, { truncated: dropped });
}

// ============================================================================
// Pure core 5: command execution (Supabase-free — takes a plain {type,payload})
// ============================================================================

/** @param {{PM_DIR:string, deliveryCtx:object}} deps */
export function createCommandExecutor({ PM_DIR, deliveryCtx }) {
  // ---- undo journal ------------------------------------------------------
  // EVERY file write this bridge performs keeps a full pre-image first, so any
  // phone-issued mutation is reversible from the phone itself. Backups live
  // under .delivery/ (gitignored) — putting them anywhere tracked would dirty
  // the working tree and block the very launches this surface exists for.
  const UNDO_DIR = join(deliveryCtx.ROOT, ".delivery", "pm-undo");
  const JOURNAL = join(UNDO_DIR, "journal.ndjson");

  function appendJournal(entry) {
    mkdirSync(UNDO_DIR, { recursive: true });
    appendFileSync(JOURNAL, JSON.stringify(entry) + "\n", "utf8");
  }

  /** Write `nextRaw` to `abs`, keeping a restorable pre-image. */
  function writeWithUndo(abs, relFile, nextRaw, label) {
    const before = readFileSync(abs, "utf8");
    const id = `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    mkdirSync(UNDO_DIR, { recursive: true });
    writeFileSync(join(UNDO_DIR, `${id}.bak`), before, "utf8");
    writeFileSync(abs, nextRaw, "utf8");
    // pm-server's own fs.watch picks this up like any laptop edit and
    // re-publishes tasks, so a desktop-open dashboard sees it in realtime too.
    appendJournal({ kind: "write", id, ts: nowIso(), label, file: relFile, abs, afterHash: textHash(nextRaw) });
    return id;
  }

  /** Newest journaled write that has not been undone, or null. Append-only: an undo is a record, never an edit. */
  function lastUndoable() {
    const entries = readJsonl(JOURNAL);
    const undone = new Set(entries.filter((e) => e.kind === "undo").map((e) => e.undoes));
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].kind === "write" && !undone.has(entries[i].id)) return entries[i];
    }
    return null;
  }

  function execUndo(payload) {
    const entry = lastUndoable();
    if (!entry) return { ok: false, error: "nothing to undo" };
    if (payload && payload.id && payload.id !== entry.id) {
      return { ok: false, error: "only the most recent write can be undone" };
    }
    const bak = join(UNDO_DIR, `${entry.id}.bak`);
    if (!existsSync(entry.abs) || !existsSync(bak)) return { ok: false, error: "the backup or its file is gone" };
    // Refuse rather than clobber: if the laptop edited the file after this
    // write, restoring the pre-image would silently discard that edit.
    if (textHash(readFileSync(entry.abs, "utf8")) !== entry.afterHash) {
      return { ok: false, error: "the file changed on the laptop since that write — undo would clobber it" };
    }
    writeFileSync(entry.abs, readFileSync(bak, "utf8"), "utf8");
    appendJournal({ kind: "undo", undoes: entry.id, ts: nowIso() });
    return { ok: true, undone: entry.label, file: entry.file };
  }

  // ---- writes ------------------------------------------------------------

  function execCapture(payload) {
    const { text } = payload || {};
    if (typeof text !== "string" || !text.trim()) return { ok: false, error: "text is required" };
    const abs = join(PM_DIR, INBOX_FILE);
    if (!existsSync(abs)) return { ok: false, error: "inbox file not found" };
    const raw = readFileSync(abs, "utf8");
    const line = `- [ ] ${text.trim()}`;
    writeWithUndo(abs, INBOX_FILE, appendUnderHeading(raw, /^#{1,6}\s+New/i, line), `inbox capture: ${text.trim().slice(0, 60)}`);
    return { ok: true };
  }

  async function execPreflight(payload) {
    const { file, cbidx, agent } = payload || {};
    try {
      const preflightResult = await routeDelivery({ method: "POST", path: "/api/delivery/preflight", query: new URLSearchParams(), body: {} }, deliveryCtx);
      let recommendation = null;
      if (typeof file === "string" && typeof cbidx === "number") {
        const q = new URLSearchParams({ file, cbidx: String(cbidx), provider: agent || "claude" });
        const recResult = await routeDelivery({ method: "GET", path: "/api/delivery/recommendation", query: q, body: {} }, deliveryCtx);
        recommendation = recResult.json;
      }
      return { ok: true, preflight: preflightResult.json, recommendation };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function execLaunch(payload) {
    if (!payload || !payload.budget) return { ok: false, error: "an envelope is required to launch from mobile" };
    // Deliberately no dirtyAck/redBaselineAck are ever forwarded from mobile —
    // startSession() will refuse (400, with the reason) on a dirty tree or a
    // red baseline, exactly the conditions behind both BUD-11 postmortems.
    // That refusal is the desired behavior, not an error to work around here.
    try {
      const result = await routeDelivery({ method: "POST", path: "/api/delivery/start", query: new URLSearchParams(), body: payload }, deliveryCtx);
      return { ok: true, ...result.json };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function execControl(sessionId, type, controlPayload) {
    if (!sessionId) return { ok: false, error: "sessionId is required" };
    try {
      const result = await routeDelivery(
        { method: "POST", path: "/api/delivery/control", query: new URLSearchParams(), body: { id: sessionId, type, payload: controlPayload } },
        deliveryCtx,
      );
      return { ok: true, ...result.json };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function execResume(sessionId) {
    if (!sessionId) return { ok: false, error: "sessionId is required" };
    const dir = join(deliveryCtx.SESSIONS_DIR, sessionId);
    const alive = isRunnerAlive(dir).alive;
    // A live-but-paused runner resumes via the control channel; a dead runner
    // needs a fresh process spawned via /resume. Same distinction the desktop
    // UI makes (SessionDetail.jsx).
    return alive ? execControl(sessionId, "resume-run", {}) : execViaResumeEndpoint(sessionId);
  }

  async function execViaResumeEndpoint(sessionId) {
    try {
      const result = await routeDelivery({ method: "POST", path: "/api/delivery/resume", query: new URLSearchParams(), body: { id: sessionId } }, deliveryCtx);
      return { ok: true, ...result.json };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function execCancel(sessionId) {
    if (!sessionId) return { ok: false, error: "sessionId is required" };
    try {
      const result = await routeDelivery(
        { method: "POST", path: "/api/delivery/decision", query: new URLSearchParams(), body: { id: sessionId, decision: "cancel" } },
        deliveryCtx,
      );
      return { ok: true, ...result.json };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Reply to an agent's question. Only permitted when the session is
   * CURRENTLY awaiting the "question" gate — every other gate (spec, plan,
   * uat, blocked) is refused here, not just hidden in the mobile UI. This is
   * the one place a phone-issued command can look like a "decision"; it is
   * not gate approval (it doesn't authorize a spec/plan/UAT), it just answers
   * a clarifying question so the agent isn't stuck while the owner is away.
   */
  /**
   * Two kinds of answer, one command type.
   *
   * With a `questionId` this is a *ledger* answer — an advisory question the
   * agent logged and carried on past. It is non-blocking by construction, so it
   * needs no gate and is safe from the phone at any time; it routes through the
   * same `answer` control the desktop Q&A card uses.
   *
   * Without one it is a *gate* answer: the session is stopped waiting for it,
   * so the gate is re-verified server-side before the reply is sent — the UI
   * hiding the box is not a guarantee.
   */
  async function execAnswer(sessionId, text, questionId, acceptProposal = false) {
    if (!sessionId) return { ok: false, error: "sessionId is required" };
    if (typeof text !== "string" || !text.trim()) return { ok: false, error: "text is required" };
    if (typeof questionId === "string" && questionId.trim()) {
      // An advisory answer never carries an approval — it does not unblock a gate.
      return execControl(sessionId, "answer", { questionId: questionId.trim(), text });
    }
    let session;
    try {
      const result = await routeDelivery(
        { method: "GET", path: "/api/delivery/session", query: new URLSearchParams({ id: sessionId }), body: {} },
        deliveryCtx,
      );
      session = result.json;
    } catch (err) {
      return { ok: false, error: err.message };
    }
    const gate = session.state.awaiting && session.state.awaiting.gate;
    if (gate !== "question") return { ok: false, error: "approve on the laptop — mobile may only answer an open question gate" };
    // DLV-73: "answer + approve" is only offered when the runner itself marked
    // the gate `proposalReady`, which it does only on INSTANT. Silently dropping
    // the flag rather than erroring keeps a stale phone bundle working — the
    // answer still lands, the phase just re-runs as it always did.
    const withProposal = acceptProposal && session.state.awaiting.proposalReady === true;
    try {
      const result = await routeDelivery(
        {
          method: "POST",
          path: "/api/delivery/decision",
          query: new URLSearchParams(),
          body: { id: sessionId, gate: "question", decision: "answer", answer: text, ...(withProposal ? { acceptProposal: true } : {}) },
        },
        deliveryCtx,
      );
      return { ok: true, ...result.json };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * DLV-73 — read a session and confirm it is an INSTANT one parked at `gate`.
   *
   * Every phone-issued gate decision goes through here rather than trusting the
   * command's own claims, on exactly the principle `execAnswer` already applies
   * to the question gate: the UI hiding a button is not a guarantee, because the
   * phone is an installed PWA that can be running a cached older bundle. The
   * lane check is what keeps this affordance scoped to the one lane it was
   * authorized for.
   */
  async function requireInstantGate(sessionId, gate) {
    if (!sessionId) return { ok: false, error: "sessionId is required" };
    let session;
    try {
      const result = await routeDelivery(
        { method: "GET", path: "/api/delivery/session", query: new URLSearchParams({ id: sessionId }), body: {} },
        deliveryCtx,
      );
      session = result.json;
    } catch (err) {
      return { ok: false, error: err.message };
    }
    const lane = (session.packet && session.packet.lanePolicy && session.packet.lanePolicy.lane) || null;
    if (lane !== "INSTANT") {
      return { ok: false, error: `approve on the laptop — mobile gate approval is INSTANT-only, and this session is ${lane || "unknown"}` };
    }
    const current = session.state.awaiting && session.state.awaiting.gate;
    if (current !== gate) {
      return { ok: false, error: `session is awaiting "${current || "nothing"}", not "${gate}"` };
    }
    return { ok: true, session };
  }

  /**
   * Approve an INSTANT spec gate from the phone. Always sends `alsoApprovePlan`:
   * on INSTANT the spec and plan are one artifact produced by one turn, so
   * offering the phone a spec-only approval would just park it at a second gate
   * showing the same thing it has already approved. The server still records two
   * decisions and still refuses the collapse for a risk-flagged plan.
   */
  async function execApprove(sessionId) {
    const check = await requireInstantGate(sessionId, "spec");
    if (!check.ok) return check;
    try {
      const result = await routeDelivery(
        {
          method: "POST",
          path: "/api/delivery/decision",
          query: new URLSearchParams(),
          body: { id: sessionId, gate: "spec", decision: "approve", alsoApprovePlan: true },
        },
        deliveryCtx,
      );
      return { ok: true, ...result.json };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /** Accept an INSTANT UAT gate from the phone. `tickCheckbox` stays true — accepting IS the PM trace. */
  async function execAccept(sessionId) {
    const check = await requireInstantGate(sessionId, "uat");
    if (!check.ok) return check;
    try {
      const result = await routeDelivery(
        {
          method: "POST",
          path: "/api/delivery/decision",
          query: new URLSearchParams(),
          body: { id: sessionId, gate: "uat", decision: "accept", tickCheckbox: true },
        },
        deliveryCtx,
      );
      return { ok: true, ...result.json };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /** Free-form owner message to the agent (the "composer") — always allowed on a non-terminal session; it is guidance, not an authority grant. */
  async function execAsk(sessionId, text) {
    if (!sessionId) return { ok: false, error: "sessionId is required" };
    if (typeof text !== "string" || !text.trim()) return { ok: false, error: "text is required" };
    try {
      const result = await routeDelivery(
        { method: "POST", path: "/api/delivery/message", query: new URLSearchParams(), body: { id: sessionId, text } },
        deliveryCtx,
      );
      return { ok: true, ...result.json };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function executeCommand(cmd) {
    if (REFUSED_TYPES.has(cmd.type)) {
      return { ok: false, error: REFUSED_TYPES.get(cmd.type) };
    }
    if (!ALLOWED_TYPES.has(cmd.type)) {
      return { ok: false, error: `command type not permitted from mobile: ${cmd.type}` };
    }
    const p = cmd.payload || {};
    switch (cmd.type) {
      case "capture":
        return execCapture(p);
      case "undo":
        return execUndo(p);
      case "preflight":
        return execPreflight(p);
      case "launch":
        return execLaunch(p);
      case "pause":
        return execControl(p.sessionId, "pause", { abortInFlight: false });
      case "abort-turn":
        return execControl(p.sessionId, "pause", { abortInFlight: true });
      case "resume":
        return execResume(p.sessionId);
      case "cancel":
        return execCancel(p.sessionId);
      case "answer":
        return execAnswer(p.sessionId, p.text, p.questionId, p.acceptProposal === true);
      case "ask":
        return execAsk(p.sessionId, p.text);
      // DLV-73 — INSTANT-only; both re-verify the lane server-side.
      case "approve":
        return execApprove(p.sessionId);
      case "accept":
        return execAccept(p.sessionId);
      default:
        return { ok: false, error: "unhandled command type" };
    }
  }

  return { executeCommand, lastUndoable };
}

// ============================================================================
// Supabase wiring — publisher + drainer + push + lifecycle
// ============================================================================

/**
 * @param {{PM_DIR:string, deliveryCtx:object}} deps
 */
export function createBridge({ PM_DIR, deliveryCtx }) {
  const ownerId = process.env.PM_OWNER_USER_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!ownerId || !supabaseUrl || !serviceKey) {
    console.log(
      "[pm-bridge] disabled — missing PM_OWNER_USER_ID / NEXT_PUBLIC_SUPABASE_URL / NEXT_SUPABASE_SERVICE_ROLE_KEY",
    );
    return { start() {}, publishTasks() {}, publishSession() {}, publishFleet() {}, stop() {} };
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { buildTasksSnapshot } = createTasksSnapshotBuilder({ PM_DIR });
  const { buildRollupsSnapshot } = createRollupsSnapshotBuilder({ PM_DIR });
  const { buildHistorySnapshot } = createHistorySnapshotBuilder({ PM_DIR });
  const { executeCommand, lastUndoable } = createCommandExecutor({ PM_DIR, deliveryCtx });
  const revCounters = new Map();
  let lastRunnerDeadPush = 0;
  let pollTimer = null;
  let heartbeatTimer = null;
  let channel = null;

  function nextRev(id) {
    const rev = (revCounters.get(id) || 0) + 1;
    revCounters.set(id, rev);
    return rev;
  }

  async function publishRow(id, kind, payload) {
    const { error } = await supabase.from("pm_live").upsert({
      id,
      user_id: ownerId,
      kind,
      payload,
      rev: nextRev(id),
      updated_at: nowIso(),
    });
    if (error) console.error(`[pm-bridge] publish ${id} failed:`, error.message);
  }

  // The three PM-document publishers always move together: all three read the
  // same campaign folders, and pm-server's single debounced fs.watch is what
  // triggers them, so splitting them would just mean three watchers.
  async function publishTasks() {
    await Promise.all([
      publishRow("tasks", "tasks", buildTasksSnapshot()),
      publishRow("rollups", "rollups", buildRollupsSnapshot()),
      publishRow("history", "history", buildHistorySnapshot()),
    ]);
  }

  // ---- publisher: delivery session + fleet -------------------------------

  async function buildSessionSnapshot(sessionId) {
    let session;
    try {
      const result = await routeDelivery(
        { method: "GET", path: "/api/delivery/session", query: new URLSearchParams({ id: sessionId }), body: {} },
        deliveryCtx,
      );
      session = result && result.json;
    } catch {
      return null; // session dir may have just been created / mid-write; try again on the next dirty tick
    }
    if (!session) return null;
    const { packet, state, runner } = session;
    const sessionDir = join(deliveryCtx.SESSIONS_DIR, sessionId);
    return capSessionSnapshot({
      sessionId,
      state: state.state,
      awaiting: state.awaiting,
      agent: packet.agent,
      item: { text: packet.item.text, id: packet.item.id, campaign: packet.item.campaign },
      lane: packet.lane || null,
      usageTotal: (state.usage && state.usage.total) || null,
      budgetCurrent: (state.budget && state.budget.current) || packet.budget || null,
      build: state.build || null,
      lastError: state.lastError || null,
      updatedAt: state.updatedAt,
      runner: { alive: runner.alive, heartbeatAt: runner.heartbeatAt || null },
      eventsTail: readJsonl(join(sessionDir, "events.ndjson"), EVENTS_TAIL_LINES),
      ...buildSessionExtras(sessionDir),
    });
  }

  async function publishSession(sessionId) {
    const snapshot = await buildSessionSnapshot(sessionId);
    if (snapshot) await publishRow(`session:${sessionId}`, "session", snapshot);
    await maybePushForSession(snapshot);
  }

  async function publishFleet() {
    let list;
    try {
      const result = await routeDelivery(
        { method: "GET", path: "/api/delivery/sessions", query: new URLSearchParams(), body: {} },
        deliveryCtx,
      );
      list = result && result.json;
    } catch {
      return;
    }
    if (!list) return;
    const totalSpend = list.sessions.reduce((sum, s) => sum + ((s.usageTotal && s.usageTotal.costUsd) || 0), 0);
    const byState = list.sessions.reduce((acc, s) => {
      acc[s.state] = (acc[s.state] || 0) + 1;
      return acc;
    }, {});
    await publishRow("fleet", "fleet", {
      sessions: list.sessions,
      buildLockActive: list.buildLockActive,
      totalSpendUsd: totalSpend,
      byState,
      spendByDay: spendByDay(list.sessions),
      // Shipped so the phone's launch sheet prefills real envelope defaults
      // instead of a hand-copied constant that silently drifts from config.
      laneDefaults: DEFAULT_CONFIG.budgets.laneDefaults,
      generatedAt: nowIso(),
    });
    await pruneStaleSessionRows(list.sessions);
  }

  /**
   * Drop `session:<id>` rows for sessions that finished more than a week ago.
   * Only terminal sessions are ever pruned, and only when the fleet list still
   * agrees they are terminal — an in-flight session is never touched.
   */
  async function pruneStaleSessionRows(sessions) {
    const cutoff = Date.now() - SESSION_ROW_TTL_MS;
    const expired = (sessions || [])
      .filter((s) => TERMINAL_SESSION_STATES.has(s.state) && s.updatedAt && new Date(s.updatedAt).getTime() < cutoff)
      .map((s) => `session:${s.sessionId}`);
    if (!expired.length) return;
    const { error } = await supabase.from("pm_live").delete().eq("user_id", ownerId).in("id", expired);
    if (error) console.error("[pm-bridge] prune failed:", error.message);
  }

  // ---- push notification hook (Phase 3 consumer) -------------------------

  // A gate notification is about ONE session; landing on the fleet list makes
  // the owner find it again by hand. `?view=delivery&session=<id>` is read by
  // the phone app's view state and opens that session's detail directly.
  const sessionUrl = (sessionId) => `/pm/live?view=delivery&session=${encodeURIComponent(sessionId)}`;

  async function sendPush(title, body, url, tag) {
    const notifyUrl = process.env.PM_NOTIFY_URL || `${process.env.NEXT_PUBLIC_SITE_URL || ""}`.replace(/\/$/, "") + "/api/pm/notify";
    const secret = process.env.CRON_SECRET;
    if (!secret || !notifyUrl) return;
    try {
      await fetch(notifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ title, body, url, tag }),
      });
    } catch (err) {
      console.error("[pm-bridge] push failed:", err.message);
    }
  }

  const pushedNotificationSeqs = new Set(); // dedupe notification.requested events across publishes
  const lastAwaitingGate = new Map(); // sessionId -> last-seen awaiting.gate, to push only on transition

  async function maybePushForSession(snapshot) {
    if (!snapshot) return;
    const { sessionId, awaiting, state, lastError, eventsTail } = snapshot;

    for (const evt of eventsTail) {
      if (evt.type !== "notification.requested") continue;
      const key = `${sessionId}:${evt.seq}`;
      if (pushedNotificationSeqs.has(key)) continue;
      pushedNotificationSeqs.add(key);
      const reason = (evt.data && evt.data.reason) || "notification";
      await sendPush(`Delivery: ${reason}`, snapshot.item.text || sessionId, sessionUrl(sessionId), `pm-${sessionId}`);
    }

    const prevGate = lastAwaitingGate.get(sessionId);
    const curGate = awaiting && awaiting.gate;
    if (curGate && curGate !== prevGate) {
      const costUsd = snapshot.usageTotal?.costUsd;
      const spend = typeof costUsd === "number" && Number.isFinite(costUsd) ? `$${costUsd.toFixed(2)} spent` : "Cost unavailable";
      await sendPush(`Delivery gate: ${curGate}`, `${spend} — ${snapshot.item.text || sessionId}`, sessionUrl(sessionId), `pm-${sessionId}`);
    }
    lastAwaitingGate.set(sessionId, curGate || null);

    if (lastError && lastError.message) {
      await sendPush("Delivery error", lastError.message, sessionUrl(sessionId), `pm-${sessionId}-error`);
    }

    if (!snapshot.runner.alive && (state === "BUILDING" || state === "VALIDATING" || state === "REVIEWING")) {
      const now = Date.now();
      if (now - lastRunnerDeadPush > RUNNER_DEAD_DEBOUNCE_MS) {
        lastRunnerDeadPush = now;
        await sendPush("Delivery runner stopped", snapshot.item.text || sessionId, sessionUrl(sessionId), `pm-${sessionId}-dead`);
      }
    }
  }

  // ---- drainer -------------------------------------------------------------

  let draining = false;
  async function drainOnce() {
    if (draining) return;
    draining = true;
    try {
      const { data: pending, error } = await supabase
        .from("pm_commands")
        .select("id, type, payload")
        .eq("user_id", ownerId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(10);
      if (error || !pending || !pending.length) return;
      for (const cmd of pending) {
        // Claim atomically: only proceed if this bridge won the race against
        // any other process (there should only ever be one, but this makes
        // it safe if pnpm pm is accidentally started twice).
        const { data: claimed } = await supabase
          .from("pm_commands")
          .update({ status: "claimed", claimed_at: nowIso() })
          .eq("id", cmd.id)
          .eq("status", "pending")
          .select("id");
        if (!claimed || !claimed.length) continue;

        let outcome;
        try {
          outcome = await executeCommand(cmd);
        } catch (err) {
          outcome = { ok: false, error: err.message };
        }
        await supabase
          .from("pm_commands")
          .update({
            status: outcome.ok ? "done" : "failed",
            result: outcome.ok ? outcome : null,
            error: outcome.ok ? null : outcome.error,
            completed_at: nowIso(),
          })
          .eq("id", cmd.id);

        // A capture/undo write lands on disk and pm-server's own fs.watch
        // re-publishes tasks; a delivery command changes state.json, which the
        // existing `.delivery/sessions` watcher already re-publishes via
        // publishSession(). Only the undo offer needs an explicit nudge — it
        // lives on the heartbeat, which is otherwise up to 10s stale.
        if (cmd.type === "capture" || cmd.type === "undo") await publishHeartbeat();
      }
    } catch (err) {
      console.error("[pm-bridge] drain error:", err.message);
    } finally {
      draining = false;
    }
  }

  // ---- lifecycle -------------------------------------------------------------

  // `undoable` rides on the heartbeat so the phone always knows whether an
  // Undo is currently offered, and for what, without polling a second row.
  function publishHeartbeat() {
    return publishRow("bridge", "bridge", { pid: process.pid, startedAt, seenAt: nowIso(), undoable: lastUndoable() });
  }

  function start() {
    heartbeatTimer = setInterval(publishHeartbeat, HEARTBEAT_INTERVAL_MS);
    publishHeartbeat();

    publishTasks();
    publishFleet();

    channel = supabase
      .channel(`pm-commands-${ownerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pm_commands", filter: `user_id=eq.${ownerId}` },
        () => drainOnce(),
      )
      .subscribe();

    // Realtime safety net — a missed event should never silently strand a
    // pending command (e.g. a Pause) with no fallback path.
    pollTimer = setInterval(drainOnce, POLL_FALLBACK_MS);
    drainOnce();

    console.log("[pm-bridge] started — publishing to Supabase, draining pm_commands");
  }

  function stop() {
    clearInterval(heartbeatTimer);
    clearInterval(pollTimer);
    if (channel) supabase.removeChannel(channel);
  }

  const startedAt = nowIso();

  return { start, stop, publishTasks, publishSession, publishFleet };
}

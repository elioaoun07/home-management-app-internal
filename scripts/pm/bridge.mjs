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
import { parseHistory } from "./shared/history.mjs";
import { appendUnderHeading } from "./mutations.mjs";
import { DEFAULT_CONFIG } from "../delivery/config.mjs";
import { textHash } from "../delivery/packet.mjs";
import { routeDelivery } from "../delivery/server-routes.mjs";
import { isRunnerAlive } from "../delivery/run-session.mjs";
import { readDispatchMode, routeDeliveryV2 } from "../delivery-v2/entry.mjs";
import { pairBridgeSession } from "../delivery-v2/local-auth.mjs";
import { RELAY_SCHEMA, ROW_KINDS, V2_COMMAND_TYPES, attentionItems, rowId } from "./relay-shared.mjs";
import {
  RELAY_DIR,
  acquireRelayLock,
  availabilitySummary,
  buildCorpusRows,
  capRunDetail,
  createAttentionLedger,
  createCommandJournal,
  executeV2Command,
  findSecrets,
  payloadDigest,
  readInstallation,
  reconcileClaimedCommand,
  releaseRelayLock,
} from "./relay.mjs";

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

/**
 * Completion history for the legacy phone view, from the same parser the shared
 * views use (`shared/history.mjs`, Command Center Phase 6): bullets in each
 * campaign's `## Shipped Log` only — never a session log, Pain Inventory line or
 * table cell elsewhere in the book.
 *
 * A completion here is a dated receipt, not a unique completed item: `identity`
 * says whether it names exactly one work ID (`idChip` is set only then), and a
 * record without a stated day is counted in `coverage` but placed on no day.
 *
 * @param {{PM_DIR:string}} deps
 */
export function createHistorySnapshotBuilder({ PM_DIR }) {
  function buildHistorySnapshot() {
    const records = [];
    for (const campaign of Object.keys(CAMPAIGNS)) {
      const abs = campaignBookPath(PM_DIR, campaign);
      if (!abs) continue;
      const file = `${campaign}/${abs.split(/[\\/]/).pop()}`;
      records.push(...parseHistory(readFileSync(abs, "utf8"), { campaign, file }).records);
    }
    const completions = records
      .filter((record) => record.datePrecision === "day")
      .map((record) => ({ date: record.date, campaign: record.campaign, idChip: record.workId, identity: record.identity, text: record.text }))
      .sort((a, b) => a.date.localeCompare(b.date));

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
      coverage: {
        records: records.length,
        placed: completions.length,
        exact: records.filter((record) => record.identity === "exact").length,
      },
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

const CAPABILITIES_INTERVAL_MS = 60_000;
const V2_POLL_MS = 5_000;
const DOC_UPSERT_BATCH = 5;
const V2_RUNS_PUBLISHED = 30;

/**
 * @param {{PM_DIR:string, deliveryCtx:any, deliveryV2Ctx?:any, buildData?:(() => any)|null,
 *   env?:Record<string, string|undefined>, createClientImpl?:any,
 *   pushImpl?:((push:{title:string, body:string, url:string, tag:string}) => any)|null}} deps
 */
export function createBridge({ PM_DIR, deliveryCtx, deliveryV2Ctx = null, buildData = null, env = process.env, createClientImpl = createClient, pushImpl = null }) {
  const ownerId = env.PM_OWNER_USER_ID;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.NEXT_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!ownerId || !supabaseUrl || !serviceKey) {
    console.log(
      "[pm-bridge] disabled — missing PM_OWNER_USER_ID / NEXT_PUBLIC_SUPABASE_URL / NEXT_SUPABASE_SERVICE_ROLE_KEY",
    );
    return { start() {}, publishTasks() {}, publishSession() {}, publishFleet() {}, publishV2() {}, stop() {} };
  }

  const ROOT = deliveryCtx.ROOT;
  const relayDir = join(ROOT, ...RELAY_DIR.split("/"));
  const supabase = createClientImpl(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { buildTasksSnapshot } = createTasksSnapshotBuilder({ PM_DIR });
  const { buildRollupsSnapshot } = createRollupsSnapshotBuilder({ PM_DIR });
  const { buildHistorySnapshot } = createHistorySnapshotBuilder({ PM_DIR });
  const { executeCommand, lastUndoable } = createCommandExecutor({ PM_DIR, deliveryCtx });
  const { installation_id } = readInstallation({ root: ROOT });
  const journal = createCommandJournal({ dir: relayDir });
  const attention = createAttentionLedger({ file: join(relayDir, "attention.json") });
  const revCounters = new Map();
  const publishedDigests = new Map();
  const publishedDocs = new Map();
  let lastRunnerDeadPush = 0;
  let pollTimer = null;
  let heartbeatTimer = null;
  let capabilitiesTimer = null;
  let v2Timer = null;
  let channel = null;
  let drainEnabled = false;
  let credential = null;
  let availability = null;
  const drain = { lastClaimAt: null, lastReceiptAt: null, lastCommandId: null };
  const startedAt = nowIso();

  function nextRev(id) {
    const rev = (revCounters.get(id) || 0) + 1;
    revCounters.set(id, rev);
    return rev;
  }

  /** Nothing carrying a host, provider or release secret value leaves the laptop. */
  function secretsIn(value) {
    return findSecrets(JSON.stringify(value ?? null), env, [serviceKey, credential].filter(Boolean));
  }

  async function publishRow(id, kind, payload) {
    const hits = secretsIn(payload);
    if (hits.length) {
      console.error(`[pm-bridge] withheld ${id}: it would disclose ${hits.join(", ")}`);
      return false;
    }
    const { error } = await supabase.from("pm_live").upsert({
      id,
      user_id: ownerId,
      kind,
      payload,
      rev: nextRev(id),
      updated_at: nowIso(),
    });
    if (error) console.error(`[pm-bridge] publish ${id} failed:`, error.message);
    return !error;
  }

  async function publishIfChanged(id, kind, payload) {
    const digest = payloadDigest(payload);
    if (publishedDigests.get(id) === digest) return true;
    const ok = await publishRow(id, kind, payload);
    if (ok) publishedDigests.set(id, digest);
    return ok;
  }

  // ---- publisher: the shared Command Center corpus --------------------------

  let corpusLoaded = false;
  async function loadPublishedDocs() {
    if (corpusLoaded) return;
    corpusLoaded = true;
    const { data, error } = await supabase
      .from("pm_live")
      .select("id, relPath:payload->>relPath, sha:payload->>sha")
      .eq("user_id", ownerId)
      .like("id", rowId(installation_id, ROW_KINDS.DOC, "") + "%");
    if (error || !data) return;
    for (const row of data) if (row.relPath && row.sha) publishedDocs.set(row.relPath, row.sha);
  }

  let corpusBusy = false;
  async function publishCorpus() {
    if (typeof buildData !== "function" || corpusBusy) return;
    corpusBusy = true;
    try {
      await loadPublishedDocs();
      const data = buildData();
      const withheld = [];
      const files = data.files.filter((file) => {
        if (!secretsIn(file.raw).length) return true;
        withheld.push(file.relPath);
        return false;
      });
      if (withheld.length) console.error("[pm-bridge] withheld documents containing a secret value:", withheld.join(", "));
      const rows = buildCorpusRows({ data: { ...data, files }, installation_id, previous: publishedDocs });
      for (let index = 0; index < rows.upserts.length; index += DOC_UPSERT_BATCH) {
        const batch = rows.upserts.slice(index, index + DOC_UPSERT_BATCH);
        const { error } = await supabase
          .from("pm_live")
          .upsert(batch.map((row) => ({ id: row.id, user_id: ownerId, kind: row.kind, payload: row.payload, rev: nextRev(row.id), updated_at: nowIso() })));
        // Without every document the manifest would describe files the phone cannot read.
        if (error) {
          console.error("[pm-bridge] corpus publish failed:", error.message);
          return;
        }
        for (const row of batch) publishedDocs.set(row.payload.relPath, row.payload.sha);
      }
      if (rows.deletes.length) {
        const { error } = await supabase.from("pm_live").delete().eq("user_id", ownerId).in("id", rows.deletes);
        if (!error) {
          const gone = new Set(rows.deletes);
          for (const relPath of [...publishedDocs.keys()]) if (gone.has(rowId(installation_id, ROW_KINDS.DOC, relPath))) publishedDocs.delete(relPath);
        }
      }
      await publishRow(rows.manifest.id, rows.manifest.kind, { ...rows.manifest.payload, withheld });
    } catch (err) {
      console.error("[pm-bridge] corpus publish error:", err.message);
    } finally {
      corpusBusy = false;
    }
  }

  // The three PM-document publishers always move together: all three read the
  // same campaign folders, and pm-server's single debounced fs.watch is what
  // triggers them, so splitting them would just mean three watchers.
  async function publishTasks() {
    await Promise.all([
      publishRow("tasks", "tasks", buildTasksSnapshot()),
      publishRow("rollups", "rollups", buildRollupsSnapshot()),
      publishRow("history", "history", buildHistorySnapshot()),
      publishCorpus(),
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
    // The shared views read V1 sessions in the local route's own shape.
    await publishIfChanged(rowId(installation_id, ROW_KINDS.V1RUNS), "cc-" + ROW_KINDS.V1RUNS, { schema: RELAY_SCHEMA, sessions: list.sessions });
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

  // ---- publisher: Delivery V2 runs, capabilities and attention -------------

  const v2Available = () => Boolean(deliveryV2Ctx && typeof deliveryV2Ctx.hasStore === "function" && deliveryV2Ctx.hasStore());

  let v2Busy = false;
  async function publishV2() {
    if (v2Busy) return;
    v2Busy = true;
    try {
      if (!v2Available()) {
        await publishIfChanged(rowId(installation_id, ROW_KINDS.V2RUNS), "cc-" + ROW_KINDS.V2RUNS, { schema: RELAY_SCHEMA, runs: [], queue: null });
        return;
      }
      const journey = deliveryV2Ctx.journey;
      const runs = journey.list();
      // The queue rides the runs row (Command Center Phase 5): no new row kind, no relay migration.
      const queue = typeof journey.queue === "function" ? journey.queue() : null;
      await publishIfChanged(rowId(installation_id, ROW_KINDS.V2RUNS), "cc-" + ROW_KINDS.V2RUNS, { schema: RELAY_SCHEMA, runs, queue });
      const entries = [];
      for (const summary of runs.slice(0, V2_RUNS_PUBLISHED)) {
        const detail = journey.detail(summary.run_id);
        entries.push({ summary, detail });
        if (detail && detail.ok) {
          await publishIfChanged(rowId(installation_id, ROW_KINDS.V2RUN, summary.run_id), "cc-" + ROW_KINDS.V2RUN, { schema: RELAY_SCHEMA, ...capRunDetail(detail) });
        }
      }
      const items = attentionItems(entries);
      await publishIfChanged(rowId(installation_id, ROW_KINDS.ATTENTION), "cc-" + ROW_KINDS.ATTENTION, { schema: RELAY_SCHEMA, items });
      if (attention.isNew()) {
        // First pass after enabling: remember what already exists, push only what is new from here.
        attention.markSent(items.map((item) => item.key));
        return;
      }
      const fresh = attention.unsent(items);
      for (const item of fresh) {
        await sendPush(item.label, item.title, "/pm/live#/delivery/run/" + encodeURIComponent(item.run_id), "pm-" + item.key);
      }
      if (fresh.length) attention.markSent(fresh.map((item) => item.key));
    } catch (err) {
      console.error("[pm-bridge] v2 publish error:", err.message);
    } finally {
      v2Busy = false;
    }
  }

  async function publishCapabilities() {
    const mode = readDispatchMode({ root: ROOT }).mode;
    let catalogue = null;
    let error = null;
    if (deliveryV2Ctx && typeof deliveryV2Ctx.describeExecutors === "function") {
      try {
        catalogue = await deliveryV2Ctx.describeExecutors();
      } catch (err) {
        error = String((err && err.message) || err);
      }
    }
    availability = availabilitySummary({ mode, catalogue, error });
    await publishIfChanged(rowId(installation_id, ROW_KINDS.CAPABILITIES), "cc-" + ROW_KINDS.CAPABILITIES, {
      schema: RELAY_SCHEMA,
      installation_id,
      mode,
      catalogue,
      availability,
      // What this relay can carry. PM checklist writes, V1 launch and V1 detail
      // stay at the desk; capture and every V2 command are relayed.
      relay: { planWrites: false, capture: true, v1Launch: false, v1Detail: false, v2: true, apply: true },
    });
  }

  // ---- push notification hook (Phase 3 consumer) -------------------------

  // A gate notification is about ONE session; landing on the fleet list makes
  // the owner find it again by hand. `?view=delivery&session=<id>` is read by
  // the phone app's view state and opens that session's detail directly.
  const sessionUrl = (sessionId) => `/pm/live?ui=legacy&view=delivery&session=${encodeURIComponent(sessionId)}`;

  async function sendPush(title, body, url, tag) {
    if (typeof pushImpl === "function") return pushImpl({ title, body, url, tag });
    const notifyUrl = env.PM_NOTIFY_URL || `${env.NEXT_PUBLIC_SITE_URL || ""}`.replace(/\/$/, "") + "/api/pm/notify";
    const secret = env.CRON_SECRET;
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

  function bridgeCredential() {
    if (!credential) {
      const paired = pairBridgeSession({ root: ROOT });
      if (!paired.ok || !paired.token) throw new Error("bridge credential unavailable");
      credential = paired.token;
    }
    return credential;
  }

  const statusFor = (outcome) => (outcome && outcome.outcome_unknown ? "unknown" : outcome && outcome.ok !== false ? "done" : "failed");

  /** Write the receipt and record that it was written. Returns false when the relay refused. */
  async function writeReceipt(id, outcome) {
    const status = statusFor(outcome);
    const safe = secretsIn(outcome).length ? { ok: outcome.ok !== false, outcome_unknown: Boolean(outcome.outcome_unknown), withheld: true } : outcome;
    const result = { ...safe, receipt: { installation_id, at: nowIso() } };
    const update = {
      status,
      result,
      error: status === "failed" ? String((outcome && outcome.error) || "refused") : status === "unknown" ? "outcome not established" : null,
      completed_at: nowIso(),
    };
    let { error } = await supabase.from("pm_commands").update(update).eq("id", id);
    if (error && status === "unknown") {
      // Before the owner runs the Phase 4 migration `unknown` is not an allowed
      // status: keep the row claimed and say so in its result.
      ({ error } = await supabase
        .from("pm_commands")
        .update({ status: "claimed", result: { ...result, outcome_unknown: true }, error: update.error })
        .eq("id", id));
    }
    if (error) {
      console.error(`[pm-bridge] receipt for ${id} failed:`, error.message);
      return false;
    }
    journal.record(id, "reported");
    drain.lastReceiptAt = nowIso();
    return true;
  }

  async function runClaimed(cmd) {
    journal.record(cmd.id, "started", { type: cmd.type });
    let outcome;
    try {
      outcome = V2_COMMAND_TYPES[cmd.type]
        ? deliveryV2Ctx
          ? await executeV2Command({ cmd, installation_id, route: (req) => routeDeliveryV2(req, deliveryV2Ctx), credential: bridgeCredential() })
          : { ok: false, error: "delivery-v2-unavailable" }
        : await executeCommand(cmd);
    } catch (err) {
      outcome = { ok: false, error: err.message };
    }
    journal.record(cmd.id, "effected", { outcome });
    await writeReceipt(cmd.id, outcome);
  }

  let draining = false;
  async function drainOnce() {
    if (draining || !drainEnabled) return;
    draining = true;
    try {
      const { data: pending, error } = await supabase
        .from("pm_commands")
        .select("id, type, payload, user_id, created_at")
        .eq("user_id", ownerId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(10);
      if (error || !pending || !pending.length) return;
      for (const cmd of pending) {
        // A V2 command names the installation it was sent to; another laptop's stays pending.
        if (V2_COMMAND_TYPES[cmd.type] && (!cmd.payload || cmd.payload.installation_id !== installation_id)) continue;
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
        drain.lastClaimAt = nowIso();
        drain.lastCommandId = cmd.id;
        const prior = journal.stateOf(cmd.id);
        if (prior && prior.phases.includes("effected")) {
          // The same command id came back (a re-sent or reset row): report what it did, never run it again.
          await writeReceipt(cmd.id, { ...(prior.outcome || { ok: false }), recovered: true });
          continue;
        }
        journal.record(cmd.id, "claimed", { type: cmd.type });

        await runClaimed(cmd);

        // A capture/undo write lands on disk and pm-server's own fs.watch
        // re-publishes tasks; a delivery command changes state.json, which the
        // existing `.delivery/sessions` watcher already re-publishes via
        // publishSession(). Only the undo offer needs an explicit nudge — it
        // lives on the heartbeat, which is otherwise up to 10s stale.
        if (cmd.type === "capture" || cmd.type === "undo") await publishHeartbeat();
        if (V2_COMMAND_TYPES[cmd.type]) await publishV2();
      }
    } catch (err) {
      console.error("[pm-bridge] drain error:", err.message);
    } finally {
      draining = false;
    }
  }

  /**
   * After a restart: every command this installation claimed and did not report is
   * settled from its journal — executed if it never started, reported if its
   * outcome was recorded, looked up by id if it was in flight. Never run twice.
   */
  async function reconcileClaimed() {
    const { data: claimed, error } = await supabase
      .from("pm_commands")
      .select("id, type, payload, user_id, result")
      .eq("user_id", ownerId)
      .eq("status", "claimed")
      .order("created_at", { ascending: true })
      .limit(50);
    if (error || !claimed) return;
    const journey = v2Available() ? deliveryV2Ctx.journey : null;
    for (const cmd of claimed) {
      if (cmd.result && cmd.result.outcome_unknown) continue;
      const decision = reconcileClaimedCommand(cmd, journal, journey);
      if (decision.action === "execute") await runClaimed(cmd);
      else if (decision.action === "report") await writeReceipt(cmd.id, { ...(decision.outcome || { ok: false }), recovered: true });
      else if (decision.action === "unknown") {
        journal.record(cmd.id, "effected", { outcome: decision.outcome });
        await writeReceipt(cmd.id, decision.outcome);
      }
    }
  }

  // ---- lifecycle -------------------------------------------------------------

  // `undoable` rides on the heartbeat so the phone always knows whether an
  // Undo is currently offered, and for what, without polling a second row.
  function publishHeartbeat() {
    return Promise.all([
      publishRow("bridge", "bridge", { pid: process.pid, startedAt, seenAt: nowIso(), undoable: lastUndoable() }),
      publishRow(rowId(installation_id, ROW_KINDS.HEARTBEAT), "cc-" + ROW_KINDS.HEARTBEAT, {
        schema: RELAY_SCHEMA,
        installation_id,
        pid: process.pid,
        startedAt,
        seenAt: nowIso(),
        drain: { enabled: drainEnabled, ...drain },
        availability,
      }),
    ]);
  }

  function start() {
    const lock = acquireRelayLock({ dir: relayDir, installation_id });
    if (!lock.acquired) {
      console.log(`[pm-bridge] disabled — another bridge (pid ${lock.holder}) already drains this checkout`);
      return;
    }
    drainEnabled = true;
    heartbeatTimer = setInterval(publishHeartbeat, HEARTBEAT_INTERVAL_MS);
    publishHeartbeat();

    publishTasks();
    publishFleet();
    publishCapabilities().then(publishHeartbeat);
    capabilitiesTimer = setInterval(publishCapabilities, CAPABILITIES_INTERVAL_MS);
    publishV2();
    v2Timer = setInterval(publishV2, V2_POLL_MS);

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
    reconcileClaimed()
      .catch((err) => console.error("[pm-bridge] reconcile error:", err.message))
      .finally(() => drainOnce());

    console.log(`[pm-bridge] started — installation ${installation_id}, publishing to Supabase, draining pm_commands`);
  }

  function stop() {
    clearInterval(heartbeatTimer);
    clearInterval(pollTimer);
    clearInterval(capabilitiesTimer);
    clearInterval(v2Timer);
    if (channel) supabase.removeChannel(channel);
    if (drainEnabled) releaseRelayLock({ dir: relayDir });
    drainEnabled = false;
  }

  /** For fixtures: enable draining without timers or realtime. */
  function enableDrainForTest() {
    drainEnabled = true;
  }

  return {
    start,
    stop,
    publishTasks,
    publishSession,
    publishFleet,
    publishV2,
    publishCorpus,
    publishCapabilities,
    publishHeartbeat,
    drainOnce,
    reconcileClaimed,
    enableDrainForTest,
    installation_id,
  };
}

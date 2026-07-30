// scripts/delivery/server-routes.mjs
// All `/api/delivery/*` route handlers (doc 2 §5) plus the global build lock,
// decision/message file writers, runner spawn/resume, and the Accept-writeback
// (checkbox tick) that only pm-server is allowed to perform. Consumed by
// scripts/pm-server.mjs, which inserts a single call to `routeDelivery()`
// before its existing MUTATIONS lookup.
//
// Single-writer discipline (doc 2 §4): this module (running inside pm-server)
// writes packet.json (once, at start), state.json (once, at start only — the
// runner owns every write after that), decisions/*.json, messages/*.json,
// writeback.done, and PM markdown. It never writes events.ndjson except in the
// one documented exception (cancelling a session whose runner has died).

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { resolveInside, toggleCheckbox } from "../pm/mutations.mjs";
import { applyCapabilityDrops, classify, isTrivialLaunchCandidate, ALWAYS_ON_CAPABILITIES } from "./classify.mjs";
import { atomicWriteJsonSync, readJsonIfExists, readTextIfExists } from "./fsx.mjs";
import { gitRevParseHead, gitStatusPorcelain } from "./gitread.mjs";
import { buildItemIdentity, buildPacket, makeSessionId } from "./packet.mjs";
import { TYPED_APPROVAL_RISK_FLAGS, isTerminal, next as smNext } from "./state-machine.mjs";
import { replayAfter } from "./events.mjs";
import {
  emitEvent,
  fingerprintDirtyPaths,
  getStartupCrashBackoff,
  isRunnerAlive,
  parsePorcelainPaths,
  runValidationCommands,
} from "./run-session.mjs";
import { createDriver } from "./drivers/driver.mjs";
import "./drivers/fake.mjs"; // self-registers; SDK import remains lazy
import "./drivers/codex.mjs"; // self-registers; SDK import remains lazy
import "./drivers/claude.mjs"; // self-registers; SDK import remains lazy
import {
  buildCapabilitiesPayload,
  getDefaultModel,
  getModelInfo,
  isKnownEffort,
  isKnownModel,
  loadConfig,
} from "./config.mjs";
import {
  DELIVERY_LANES,
  assessRecommendationMismatch,
  laneForTier,
  recommendAgentConfig,
  resolveLanePolicy,
  resolveMergedDiscoveryPlan,
} from "./recommendation.mjs";
import { buildControl, controlFileName } from "./controls.mjs";
import { createBudgetEnvelope, raiseBudgetEnvelope, totalProcessedTokens } from "./budgets.mjs";
import { emptyLedger, splitOpenQuestions } from "./memory.mjs";
import { findMatches, parseTurnRecords, parseTurns } from "./transcript.mjs";
import { buildContextPackage, estimateTokens } from "./context-assembly.mjs";
import { applyContextBudget } from "./context-budget.mjs";
import { DIRTY_TREE_ACK, RED_BASELINE_ACK, SCOPE_MISMATCH_ACK, TRIAGE_OVERRIDE_ACK } from "./validation-baseline.mjs";
import { emptyUsageV2 } from "./usage.mjs";

export class DeliveryRouteError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function fail(status, msg) {
  return new DeliveryRouteError(status, msg);
}

const BUILD_LOCK_STATES = new Set(["BUILDING", "VALIDATING", "REVIEWING", "UAT_READY", "ACCEPTED"]);
const ARTIFACT_EXT_LANG = { md: "md", json: "json", ndjson: "json", txt: "text", patch: "text", log: "text" };
const ARTIFACT_MAX_BYTES = 1_000_000;
const MESSAGE_MAX_CHARS = 8000;

// Small heuristic module -> glob table (doc's Module Model, CLAUDE.md), used
// only to seed the classifier's scopeHints at launch time — the SPEC gate
// lets the owner edit the resulting capability set once real affected paths
// are known (doc 3 §5).
const CAMPAIGN_MODULE_GLOBS = {
  Budget: [
    "src/features/accounts/**",
    "src/features/transactions/**",
    "src/features/categories/**",
    "src/features/recurring/**",
    "src/features/balance/**",
    "src/features/budget/**",
  ],
  Schedule: ["src/features/items/**"],
  Kitchen: ["src/features/recipes/**", "src/features/catalogue/**", "src/features/inventory/**"],
  Trips: ["src/app/trips/**", "src/features/trips/**"],
  "Hub & ERA": ["src/app/chat/**", "src/features/hub/**", "src/lib/ai/**"],
  "Notifications & Alerts": ["src/app/api/notifications/**", "src/app/api/cron/**"],
};

const SKILL_PATH_FOR_CAPABILITY = {
  "backend-impl": ".claude/skills/api-route/SKILL.md",
  "frontend-impl": ".claude/skills/ui-guardrails/SKILL.md",
  "money-domain": ".claude/skills/money-rules/SKILL.md",
  "code-review": ".claude/skills/finish-task/SKILL.md",
};

// DLV-42: this repo's checklist grammar routinely names the exact target —
// "… replace the $25 preset with $20 → `src/components/expense/MobileExpenseForm.tsx:1144`".
// Matches repo-relative source paths, with an optional `:line` suffix and
// optional surrounding backticks.
const EXPLICIT_PATH_RE = /(?:^|[\s`(<→])((?:src|scripts|migrations|tests|public)\/[\w./-]*[\w-]\.\w{1,5})(?::\d+)?/g;

/**
 * Repo-relative source paths the item text names outright, de-duplicated in
 * first-appearance order. Empty when the item only describes its target in prose.
 */
export function explicitPathsInText(text) {
  const out = [];
  for (const match of String(text || "").matchAll(EXPLICIT_PATH_RE)) {
    const path = match[1];
    if (!out.includes(path)) out.push(path);
  }
  return out;
}

/**
 * DLV-42 — scope hints used to *discard* the item's own file pointer and
 * substitute every glob of its campaign. For BUD-14 that turned a one-line,
 * one-file edit in `src/components/expense/` into six `src/features/**` globs,
 * with three compounding consequences:
 *
 *   1. `scoreComplexity`'s "broad launch scope (>=4 globs, +2)" fired — as it
 *      would for *every* Budget item, since the count came from a constant
 *      table rather than from the item. Combined with the money false positive
 *      that pushed a trivial `annoyance - S` chip edit to score 3, i.e. a
 *      **DEEP** lane recommendation for changing "25" to "20".
 *   2. `frontend-impl` was attributed to `src/features/budget/**`, a directory
 *      the change never touches.
 *   3. DISCOVERY was pointed at six irrelevant feature directories.
 *
 * When the item names real paths, those are the scope. The campaign table stays
 * as the fallback for items that only describe their target in prose — it is a
 * reasonable prior when nothing better exists, and a bad one when something
 * better was sitting in the item text all along.
 */
function computeScopeHints(item) {
  const text = item.text || "";
  const keywords = text
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^\w-]/g, ""))
    .filter((w) => w.length > 3);
  const explicitPaths = explicitPathsInText(text);
  const globs = explicitPaths.length > 0 ? [...explicitPaths] : [...(CAMPAIGN_MODULE_GLOBS[item.campaign] || [])];
  // An explicit path list is already precise; widening it with the API glob on
  // a keyword match would re-introduce exactly the imprecision above.
  if (explicitPaths.length === 0 && /\bapi\b|route|endpoint|cron/i.test(text)) globs.push("src/app/api/**");
  return { keywords, globs, modules: item.campaign ? [item.campaign] : [], ...(explicitPaths.length > 0 ? { scopeSource: "item-paths" } : {}) };
}

function buildSkillRefs(capabilities) {
  const out = [];
  for (const c of capabilities) {
    const path = SKILL_PATH_FOR_CAPABILITY[c.name];
    if (path) out.push({ capability: c.name, path });
  }
  return out;
}

function findCampaignFiles(campaign, PM_DIR, PM_REL) {
  if (!campaign) return [];
  const campaignDir = join(PM_DIR, campaign);
  if (!existsSync(campaignDir)) return [];
  return readdirSync(campaignDir)
    .filter((n) => /^[1-4]\s*-/.test(n) && /\.md$/i.test(n))
    .sort()
    .map((n) => `${PM_REL}/${campaign}/${n}`.replace(/\\/g, "/"));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findPreLaunchAcceptanceCriteria(item, PM_DIR) {
  if (!item.id || !item.campaign) return [];
  const actionPlanPath = join(PM_DIR, item.campaign, "3 - Action Plan.md");
  if (!existsSync(actionPlanPath)) return [];
  const raw = readFileSync(actionPlanPath, "utf8");
  const heading = new RegExp(`^###\\s+${escapeRegExp(item.id)}(?:\\s|Â·|·|$).*?$`, "m");
  const match = heading.exec(raw);
  if (!match) return [];
  const tail = raw.slice(match.index + match[0].length);
  const nextHeading = tail.search(/^###\s+/m);
  const section = nextHeading === -1 ? tail : tail.slice(0, nextHeading);
  const criteria = [];
  for (const line of section.split("\n")) {
    const acceptance = line.match(/^\s*-\s+\*\*Acceptance:\*\*\s*(.+?)\s*$/i);
    if (acceptance) criteria.push({ id: `PRE${criteria.length + 1}`, text: acceptance[1].trim() });
  }
  return criteria;
}

function contextEntry(ctx, { kind, path, phases, text }) {
  let content = text;
  if (content == null && path) {
    try {
      content = readFileSync(resolveInside(ctx.ROOT, path), "utf8");
    } catch {
      content = "";
    }
  }
  return {
    kind,
    path: path || null,
    phases,
    delivery: kind === "item" ? "embedded-in-packet" : "read-by-path",
    estimatedTokens: estimateTokens(content),
  };
}

/**
 * DLV-8: the Flight-Check's context preview, now budget-aware.
 *
 * `lane` matters here because the lane decides both the editorial narrowing
 * (FAST reads no campaign docs — DLV-45) and the token budget, so a preview
 * computed without it was describing a session nobody was about to launch.
 * `perPhase` shows what each phase would actually be handed, including anything
 * the budget would drop, so the owner sees the real reading list at the one
 * moment they can still change lane for free.
 */
function buildLaunchContextManifest(ctx, { item, campaignFiles, skills, lane = null, riskFlagSkills = null }) {
  const laneKey = String(lane || "").toLowerCase();
  const isFast = laneKey === "fast";
  const laneSkills = isFast && riskFlagSkills ? riskFlagSkills : skills;
  const laneCampaignFiles = isFast ? [] : campaignFiles;

  const entries = [
    contextEntry(ctx, {
      kind: "item",
      path: item.pmFile,
      phases: ["DISCOVERY", "PLAN", "BUILDING", "REVIEWING", "UAT"],
      text: JSON.stringify(item),
    }),
    ...laneCampaignFiles.map((path) => contextEntry(ctx, { kind: "campaign", path, phases: ["DISCOVERY"] })),
    ...laneSkills.map(({ path }) => contextEntry(ctx, { kind: "skill", path, phases: ["DISCOVERY", "PLAN"] })),
  ];

  const laneBudgets = (ctx.deliveryConfig && ctx.deliveryConfig.context && ctx.deliveryConfig.context.laneBudgets) || {};
  const phaseBudgets = laneBudgets[laneKey] || {};
  const budgetable = entries.filter((e) => e.kind !== "item");
  const perPhase = {};
  for (const phase of ["discovery", "plan", "building", "review"]) {
    const budgetTokens = typeof phaseBudgets[phase] === "number" ? phaseBudgets[phase] : null;
    const { kept, dropped } = applyContextBudget({
      sources: budgetable.map((e) => ({ kind: e.kind, path: e.path, tokensEst: e.estimatedTokens })),
      budgetTokens,
    });
    perPhase[phase] = {
      budgetTokens,
      loadedTokensEst: kept.reduce((sum, s) => sum + s.tokensEst, 0),
      loaded: kept.map((s) => s.path),
      dropped: dropped.map((s) => ({ path: s.path, kind: s.kind, tokensEst: s.tokensEst, reason: s.reason })),
    };
  }

  return {
    entries,
    lane,
    perPhase,
    estimatedTokens: entries.reduce((sum, entry) => sum + entry.estimatedTokens, 0),
    estimateMethod: "rough chars/4 if every read-by-path input is loaded",
    // The packet is referenced by path, never embedded (DLV-8's first half), so
    // it is deliberately absent from the totals above.
    note: "Per-phase figures apply this lane's narrowing and token budget. The packet itself is referenced by path, not embedded, so it is not counted here.",
  };
}

function buildLaunchPreview(ctx, {
  item,
  scopeHints,
  capabilities,
  skills,
  campaignFiles,
  recommendation,
  // DLV-8: the lane the owner has actually selected in the Flight-Check, so the
  // context preview describes the session about to be launched rather than a
  // hypothetical unnarrowed one. Falls back to the recommended lane when the
  // preview is being fetched before a lane is chosen.
  lane = null,
}) {
  const acceptanceCriteria = findPreLaunchAcceptanceCriteria(item, ctx.PM_DIR);
  const recommendedLane = laneForTier(recommendation?.tier);
  // On FAST the runner keeps only skills a *risk flag* implicates (DLV-45), so
  // the preview must apply the same rule or it would promise reading the
  // session will never do.
  const riskFlagSkills = skills.filter((s) => !ALWAYS_ON_CAPABILITIES.includes(s.capability));
  return {
    item: {
      id: item.id,
      text: item.text,
      pmFile: item.pmFile,
      cbidx: item.cbidx,
      effort: item.effort,
      severity: item.sev,
    },
    acceptanceCriteria,
    acceptanceCriteriaStatus: acceptanceCriteria.length
      ? "campaign-action-plan"
      : "authored-at-spec",
    recommendedLane,
    scopeHints,
    capabilities,
    riskFlags: capabilities
      .filter((capability) => !ALWAYS_ON_CAPABILITIES.includes(capability.name))
      .map(({ name, reason, blocking }) => ({ name, reason, blocking })),
    skills,
    contextManifest: buildLaunchContextManifest(ctx, {
      item,
      campaignFiles,
      skills,
      lane: lane || recommendedLane,
      riskFlagSkills,
    }),
  };
}

// ---- session directory scanning ----

function sessionsDirOf(ctx) {
  return ctx.SESSIONS_DIR;
}

function listSessionIds(ctx) {
  const dir = sessionsDirOf(ctx);
  return existsSync(dir) ? readdirSync(dir) : [];
}

function readSession(ctx, id) {
  const dir = join(sessionsDirOf(ctx), id);
  if (!existsSync(dir)) return null;
  const packet = readJsonIfExists(join(dir, "packet.json"));
  const state = readJsonIfExists(join(dir, "state.json"));
  if (!packet || !state) return null;
  return { dir, packet, state };
}

// Sessions that reached ACCEPTED/SHIPPED ran a real end-to-end build, so their
// recorded usage reflects a genuine per-tier cost. A session killed early by a
// quota/budget/git-guard stop (CANCELLED, BLOCKED, still in flight) would skew
// the median down toward "how much a session costs before it dies," not "how
// much a session costs to actually finish" — the number the forecast needs.
const HISTORY_ELIGIBLE_STATES = new Set(["ACCEPTED", "SHIPPED"]);

/**
 * Completed sessions' `{tier, usage}` samples for `recommendAgentConfig`'s
 * history-informed forecast (D8) — previously always called with no `history`
 * argument, so `estUsageForTier`'s median-of-past-sessions path was dead code
 * regardless of how many sessions had actually completed.
 */
function loadRecommendationHistory(ctx) {
  const history = [];
  for (const id of listSessionIds(ctx)) {
    const s = readSession(ctx, id);
    if (!s) continue;
    if (!HISTORY_ELIGIBLE_STATES.has(s.state.state)) continue;
    const tier = s.packet && s.packet.flightCheck && s.packet.flightCheck.recommendation && s.packet.flightCheck.recommendation.tier;
    const usage = s.state && s.state.usage && s.state.usage.total;
    if (!tier || !usage) continue;
    // DLV-56: `perPhase` is what the per-phase-traversal forecast learns from.
    // It has been recorded on every session since DLV-37 — it simply was never
    // read, because the forecast was modelling whole sessions.
    history.push({ tier, usage, perPhase: (s.state.usage && s.state.usage.perPhase) || null });
  }
  return history;
}

/**
 * Forecast-vs-actual (D8) — derived on read from data already recorded
 * (the packet's `recommendation` snapshot taken at launch, and `state.usage.total`
 * accumulated since), not a new persisted field. `null` until the session has
 * both a recommendation snapshot and at least one turn's usage.
 */
function computeForecastActual(packet, state) {
  const rec = packet && packet.flightCheck && packet.flightCheck.recommendation;
  const usage = state && state.usage && state.usage.total;
  if (!rec || !usage) return null;
  const actualTokens = totalProcessedTokens(usage);
  if (!actualTokens) return null;
  const actualCostUsd = usage.costUsd != null ? usage.costUsd : usage.costEstUsd != null ? usage.costEstUsd : null;
  return {
    tier: rec.tier,
    estTokens: rec.estTokens != null ? rec.estTokens : null,
    estCostUsd: rec.estCostUsd != null ? rec.estCostUsd : null,
    actualTokens,
    actualCostUsd,
    tokenRatio: rec.estTokens ? actualTokens / rec.estTokens : null,
  };
}

/**
 * @param {object} ctx
 * @param {(string|null)} [exceptSessionId] - DLV-13: the predecessor a salvage
 *   relaunch is replacing. It holds the build lock precisely because it stopped
 *   past the plan gate — which is the whole reason it needs salvaging — so
 *   counting it would make every stopped session permanently unsalvageable.
 *   Safe because the successor is about to supersede it and its runner is
 *   already verified dead by the caller.
 */
function isBuildLockActive(ctx, exceptSessionId = null) {
  for (const id of listSessionIds(ctx)) {
    if (exceptSessionId && id === exceptSessionId) continue;
    const s = readSession(ctx, id);
    if (!s) continue;
    if (BUILD_LOCK_STATES.has(s.state.state)) return true;
    if (
      (s.state.state === "BLOCKED" || s.state.state === "NEEDS_DECISION") &&
      s.state.awaiting &&
      BUILD_LOCK_STATES.has(s.state.awaiting.returnTo)
    ) {
      return true;
    }
  }
  return false;
}

function findActiveSessionForItem(ctx, item) {
  for (const id of listSessionIds(ctx)) {
    const s = readSession(ctx, id);
    if (!s) continue;
    if (isTerminal(s.state.state)) continue;
    if (s.packet.item.pmFile === item.pmFile && s.packet.item.cbidx === item.cbidx) {
      return { sessionId: id, state: s.state.state };
    }
  }
  return null;
}

// ---- runner process management ----

/** Real implementation — spawns `node run-session.mjs --session <id> [--resume]` detached. */
function defaultSpawnRunner(ctx, sessionId, { resume = false } = {}) {
  const sessionDir = join(sessionsDirOf(ctx), sessionId);
  const backoff = getStartupCrashBackoff(sessionDir);
  if (backoff) throw fail(429, `runner restart backoff is active until ${backoff.retryAfter}`);
  const logFd = openSync(join(sessionDir, "runner.log"), "a");
  const scriptPath = join(ctx.ROOT, "scripts", "delivery", "run-session.mjs");
  const args = [scriptPath, "--session", sessionId];
  if (resume) args.push("--resume");
  const child = spawn(process.execPath, args, {
    cwd: ctx.ROOT,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
}
function spawnRunner(ctx, sessionId, opts) {
  return ctx.spawnRunner(ctx, sessionId, opts || {});
}

// ---- GET handlers ----

/**
 * DLV-19 — fleet metrics, computed from the session directories at request
 * time. No new store and no new persisted field: every input already exists on
 * disk, it has simply never been added up.
 *
 * The intent of this panel is to be an honest mirror, so it deliberately reports
 * the numbers that look bad: how many sessions ended in something other than
 * SHIPPED, what the cost per shipped item actually is (including everything
 * spent on the ones that shipped nothing), and how often a human had to
 * intervene. A dashboard that only showed successes would have shown nothing at
 * all for this campaign's first eight sessions.
 */
function computeFleetMetrics(rows) {
  const outcomes = {};
  let totalCostUsd = 0;
  let costKnown = false;
  let shippedCostUsd = 0;
  let shippedCount = 0;
  let interventions = 0;
  let interventionSessions = 0;
  let firstPassValidation = 0;
  let validationSessions = 0;
  const scopeAccuracy = [];

  for (const row of rows) {
    outcomes[row.state] = (outcomes[row.state] || 0) + 1;
    const cost = row.usageTotal && (row.usageTotal.costUsd != null ? row.usageTotal.costUsd : row.usageTotal.costEstUsd);
    if (typeof cost === "number" && Number.isFinite(cost)) {
      totalCostUsd += cost;
      costKnown = true;
      if (row.state === "SHIPPED") shippedCostUsd += cost;
    }
    if (row.state === "SHIPPED") shippedCount += 1;
    if (row.decisionCount != null) {
      interventions += row.decisionCount;
      interventionSessions += 1;
    }
    if (row.firstValidationPassed != null) {
      validationSessions += 1;
      if (row.firstValidationPassed) firstPassValidation += 1;
    }
    if (row.scopeAccuracy != null) scopeAccuracy.push(row.scopeAccuracy);
  }

  return {
    total: rows.length,
    outcomes,
    // Total spend divided by SHIPPED sessions — not "average cost of a shipped
    // session". The difference is the whole point: work that never shipped was
    // still paid for, and hiding it in a per-session average would flatter the
    // pipeline exactly where it has been weakest.
    costPerShippedItem: shippedCount && costKnown ? totalCostUsd / shippedCount : null,
    totalCostUsd: costKnown ? totalCostUsd : null,
    shippedCostUsd: costKnown ? shippedCostUsd : null,
    shippedCount,
    interventionsPerSession: interventionSessions ? interventions / interventionSessions : null,
    firstPassValidationRate: validationSessions ? firstPassValidation / validationSessions : null,
    scopeEstimateAccuracy: scopeAccuracy.length
      ? scopeAccuracy.reduce((sum, v) => sum + v, 0) / scopeAccuracy.length
      : null,
    costBasis: costKnown ? "recorded" : "unavailable",
  };
}

/** Per-session metric inputs, read from artifacts the runner already writes. */
function sessionMetricInputs(s) {
  const decisionsDir = join(s.dir, "decisions");
  const decisionCount = existsSync(decisionsDir) ? readdirSync(decisionsDir).filter((n) => n.endsWith(".json")).length : null;

  // "First-pass validation" = the session reached VALIDATING and passed without
  // ever entering a fix loop. `fixLoop` is the runner's own counter.
  const validation = readJsonIfExists(join(s.dir, "artifacts", "validation.json"));
  const firstValidationPassed = validation ? !!validation.passes && !(s.state.fixLoop > 0) : null;

  // Scope accuracy: what DISCOVERY measured vs what the session actually
  // changed. Ratio of 1 is a perfect estimate; >1 means it under-estimated.
  const scope = readJsonIfExists(join(s.dir, "artifacts", "scope.json"));
  const estimatedFiles = scope && scope.estimate && scope.estimate.files;
  const actualFiles = ((s.state.workspace && s.state.workspace.changedFiles) || []).length;
  const scopeAccuracy = estimatedFiles && actualFiles ? actualFiles / estimatedFiles : null;

  return { decisionCount, firstValidationPassed, scopeAccuracy };
}

function listSessions(ctx) {
  const sessions = listSessionIds(ctx)
    .map((id) => {
      const s = readSession(ctx, id);
      if (!s) return null;
      const liveness = isRunnerAlive(s.dir);
      return {
        sessionId: id,
        state: s.state.state,
        awaiting: s.state.awaiting,
        agent: s.packet.agent,
        item: {
          text: s.packet.item.text,
          id: s.packet.item.id,
          campaign: s.packet.item.campaign,
          pmFile: s.packet.item.pmFile,
          cbidx: s.packet.item.cbidx,
        },
        updatedAt: s.state.updatedAt,
        usageTotal: (s.state.usage && s.state.usage.total) || null,
        runnerAlive: liveness.alive,
        supersededBy: s.state.supersededBy || null,
        ...sessionMetricInputs(s),
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return { sessions, buildLockActive: isBuildLockActive(ctx), metrics: computeFleetMetrics(sessions) };
}

function listArtifactsRecursive(dir, prefix = "") {
  if (!existsSync(dir)) return [];
  let out = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (st.isDirectory()) out = out.concat(listArtifactsRecursive(abs, rel));
    else out.push({ path: rel.replace(/\\/g, "/"), size: st.size, mtimeMs: st.mtimeMs });
  }
  return out;
}

function getSession(ctx, id) {
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  const artifacts = listArtifactsRecursive(join(s.dir, "artifacts"));
  const runner = isRunnerAlive(s.dir);
  // runner.log carries the runner process's stderr + crash stacks — surface
  // its tail so a dead runner's cause is readable in the UI, not only on disk.
  const log = readTextIfExists(join(s.dir, "runner.log"));
  return {
    packet: s.packet,
    state: s.state,
    artifacts,
    runner: { ...runner, logTail: log ? log.slice(-4000) : null },
    forecastActual: computeForecastActual(s.packet, s.state),
  };
}

function getEvents(ctx, id, afterSeq) {
  const dir = join(sessionsDirOf(ctx), id);
  if (!existsSync(dir)) throw fail(404, "unknown session");
  const text = readTextIfExists(join(dir, "events.ndjson")) || "";
  const events = replayAfter(text, afterSeq).slice(0, 500);
  const lastSeq = events.length ? events[events.length - 1].seq : afterSeq;
  return { events, lastSeq };
}

function getArtifact(ctx, id, relPath) {
  const dir = join(sessionsDirOf(ctx), id);
  if (!existsSync(dir)) throw fail(404, "unknown session");
  if (!relPath) throw fail(400, "path is required");
  const artifactsDir = join(dir, "artifacts");
  let abs;
  try {
    abs = resolveInside(artifactsDir, relPath);
  } catch {
    throw fail(400, "path escapes the artifacts directory");
  }
  const ext = (relPath.split(".").pop() || "").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(ARTIFACT_EXT_LANG, ext)) throw fail(400, "extension not allowed");
  if (!existsSync(abs)) throw fail(404, "not found");
  const st = statSync(abs);
  if (!st.isFile()) throw fail(404, "not found");
  if (st.size > ARTIFACT_MAX_BYTES) throw fail(413, "artifact too large");
  const content = readFileSync(abs, "utf8");
  return { name: relPath, content, lang: ARTIFACT_EXT_LANG[ext] };
}

// ---- GET /api/delivery/memory + /api/delivery/questions (DW-5) ----

function loadLedgerForSession(s) {
  return readJsonIfExists(join(s.dir, "memory", "ledger.json")) || emptyLedger();
}

function getMemory(ctx, id) {
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  return { ledger: loadLedgerForSession(s) };
}

function getQuestions(ctx, id) {
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  const ledger = loadLedgerForSession(s);
  const { blocking, advisory } = splitOpenQuestions(ledger);
  const answered = (ledger.questions || []).filter((q) => q.status === "answered");
  const dismissed = (ledger.questions || []).filter((q) => q.status === "dismissed" || q.status === "superseded");
  return { blocking, advisory, answered, dismissed, total: (ledger.questions || []).length };
}

// ---- GET /api/delivery/turns, /transcript, /prompt, /transcript/search (DW-3) ----

const TURN_ID_RE = /^\d{4,}$/;
const SEARCH_MATCH_CAP = 200;
const TRANSCRIPT_RECORDS_CAP = 500;

function getTurns(ctx, id, afterTurn) {
  const dir = join(sessionsDirOf(ctx), id);
  if (!existsSync(dir)) throw fail(404, "unknown session");
  const text = readTextIfExists(join(dir, "transcript", "turns.ndjson")) || "";
  const all = parseTurns(text).filter((t) => parseInt(t.turnId, 10) > afterTurn);
  const turns = all.slice(0, 200);
  const lastTurn = turns.length ? parseInt(turns[turns.length - 1].turnId, 10) : afterTurn;
  return { turns, lastTurn };
}

function getTranscript(ctx, id, turnId, afterSeq, limit) {
  const dir = join(sessionsDirOf(ctx), id);
  if (!existsSync(dir)) throw fail(404, "unknown session");
  if (!turnId || !TURN_ID_RE.test(turnId)) throw fail(400, "turn is required and must be a numeric turn id");
  const shardPath = join(dir, "transcript", `t-${turnId}.ndjson`);
  const all = parseTurnRecords(readTextIfExists(shardPath) || "");
  const cap = Math.min(limit && limit > 0 ? limit : 200, TRANSCRIPT_RECORDS_CAP);
  const records = all.filter((r) => r.seq > (afterSeq || 0)).slice(0, cap);
  const lastSeq = records.length ? records[records.length - 1].seq : afterSeq || 0;
  return { turnId, records, lastSeq };
}

function getPrompt(ctx, id, turnId) {
  const dir = join(sessionsDirOf(ctx), id);
  if (!existsSync(dir)) throw fail(404, "unknown session");
  if (!turnId || !TURN_ID_RE.test(turnId)) throw fail(400, "turn is required and must be a numeric turn id");
  const promptPath = join(dir, "transcript", "prompts", `${turnId}.md`);
  if (!existsSync(promptPath)) throw fail(404, "prompt not found for this turn");
  return { turnId, content: readFileSync(promptPath, "utf8") };
}

/**
 * Literal, case-insensitive search across every turn shard (streaming: one
 * shard file at a time, capped result count) — the multi-shard orchestration
 * transcript.mjs's own header says belongs here, using its pure `findMatches`
 * per record. Optional `phase`/`kinds` filters narrow before matching.
 */
function searchTranscript(ctx, id, { q: query, kinds, phase, limit }) {
  const dir = join(sessionsDirOf(ctx), id);
  if (!existsSync(dir)) throw fail(404, "unknown session");
  if (typeof query !== "string" || !query.trim()) throw fail(400, "q is required");
  const transcriptDir = join(dir, "transcript");
  if (!existsSync(transcriptDir)) return { matches: [], truncated: false };

  const turnPhaseById = new Map(parseTurns(readTextIfExists(join(transcriptDir, "turns.ndjson")) || "").map((t) => [t.turnId, t.phase]));
  const kindFilter = kinds ? new Set(kinds.split(",").filter(Boolean)) : null;
  const cap = Math.min(limit && limit > 0 ? limit : 100, SEARCH_MATCH_CAP);

  const shardFiles = readdirSync(transcriptDir).filter((n) => /^t-\d{4,}\.ndjson$/.test(n)).sort();
  const matches = [];
  let truncated = false;
  for (const file of shardFiles) {
    if (truncated) break;
    const turnId = file.slice(2, -".ndjson".length);
    if (phase && turnPhaseById.get(turnId) !== phase) continue;
    const records = parseTurnRecords(readTextIfExists(join(transcriptDir, file)) || "");
    for (const record of records) {
      if (kindFilter && !kindFilter.has(record.kind)) continue;
      const text = typeof record.text === "string" ? record.text : typeof record.output === "string" ? record.output : "";
      if (!text) continue;
      for (const m of findMatches(text, query)) {
        if (matches.length >= cap) {
          truncated = true;
          break;
        }
        matches.push({ turnId, seq: record.seq, kind: record.kind, phase: turnPhaseById.get(turnId) || null, snippet: m.snippet });
      }
      if (truncated) break;
    }
  }
  return { matches, truncated };
}

// ---- GET /api/delivery/context, /context/preview, /context/snapshot (DW-7) ----

function readNumberedJson(dir, ext = ".json") {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => new RegExp(`^\\d+${ext.replace(".", "\\.")}$`).test(n))
    .sort()
    .map((n) => readJsonIfExists(join(dir, n)))
    .filter(Boolean);
}

/** Health heuristics: unresolved blocking questions, git-guard violations, and rotation churn. */
function computeContextHealth(ledger, sessionState) {
  const reasons = [];
  const openBlocking = ((ledger && ledger.questions) || []).filter((q) => q.kind === "blocking" && q.status === "open");
  if (openBlocking.length) reasons.push(`${openBlocking.length} unresolved blocking question(s)`);
  const rotations = (sessionState.context && sessionState.context.rotations) || 0;
  if (rotations >= 3) reasons.push(`context has rotated ${rotations} times — consider whether the phase is stuck`);
  if (sessionState.lastError) reasons.push(`last error: ${sessionState.lastError.message || sessionState.lastError.phase}`);
  return { score: reasons.length ? "warning" : "healthy", reasons };
}

function getContext(ctx, id) {
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  const ledger = loadLedgerForSession(s);
  const snapshots = readNumberedJson(join(s.dir, "context", "snapshots")).map((snap) => ({
    seq: snap.seq, at: snap.at, reason: snap.reason, tokensEstTotal: snap.tokensEstTotal, provider: snap.provider, model: snap.model,
  }));
  const compactions = readNumberedJson(join(s.dir, "context", "compactions")).map((c) => ({
    seq: c.seq, at: c.at, scope: c.scope, mode: c.mode, summaryMd: c.summaryMd,
  }));
  const pins = (s.state.context && s.state.context.pins) || [];
  const rotations = (s.state.context && s.state.context.rotations) || 0;
  return { snapshots, compactions, pins, rotations, health: computeContextHealth(ledger, s.state) };
}

function getContextSnapshot(ctx, id, seq) {
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  if (!Number.isFinite(seq) || seq < 1) throw fail(400, "seq must be a positive number");
  const path = join(s.dir, "context", "snapshots", `${String(seq).padStart(4, "0")}.json`);
  const snapshot = readJsonIfExists(path);
  if (!snapshot) throw fail(404, "snapshot not found");
  return snapshot;
}

/** Pure, read-only preview of the context package the next turn would receive right now — no side effects. */
function getContextPreview(ctx, id) {
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  const ledger = loadLedgerForSession(s);
  const artifactPaths = listArtifactsRecursive(join(s.dir, "artifacts")).map((a) => `artifacts/${a.path}`);
  const pins = (s.state.context && s.state.context.pins) || [];
  const pkg = buildContextPackage({
    packet: s.packet,
    ledger,
    artifactPaths,
    pins,
    nextAction: `Continue phase ${s.state.state}.`,
  });
  return pkg;
}

// ---- GET /api/delivery/capabilities (DW-2) ----

function getCapabilities(ctx) {
  const manifests = {
    claude: createDriver("claude").manifest(),
    codex: createDriver("codex").manifest(),
  };
  return buildCapabilitiesPayload(ctx.deliveryConfig, manifests);
}

// ---- GET /api/delivery/recommendation (Slice D) ----

/**
 * Read-only preview of `recommendAgentConfig` for a not-yet-launched item —
 * same item-identity + classify path as `startSession`, minus every
 * session-creating side effect. Returns `{recommendation: null}` (not an
 * error) whenever the provider's catalog has no models for the matched tier,
 * so the wizard can just hide the card.
 */
// DLV-8: `lane` is optional and lets the Flight-Check re-fetch the context
// preview as the owner changes lane, so the reading list on screen always
// matches the lane about to be launched. Omitted → the recommended lane.
function getRecommendation(ctx, { file, cbidx, provider, lane = null }) {
  if (typeof file !== "string" || !file) throw fail(400, "file is required");
  if (cbidx == null || cbidx === "") throw fail(400, "cbidx is required");
  const cbidxNum = Number(cbidx);
  if (!Number.isFinite(cbidxNum)) throw fail(400, "cbidx is required");
  const agent = provider === "codex" ? "codex" : "claude";

  let abs;
  try {
    abs = resolveInside(ctx.PM_DIR, file);
  } catch {
    throw fail(400, "path escapes the PM directory");
  }
  if (!existsSync(abs)) throw fail(404, "file not found");
  const raw = readFileSync(abs, "utf8");
  const idResult = buildItemIdentity(raw, cbidxNum, file);
  if (!idResult.ok) throw fail(409, idResult.reason);
  const item = idResult.item;

  const scopeHints = computeScopeHints(item);
  const capabilities = classify({ item, scopeHints });
  const skills = buildSkillRefs(capabilities);
  const campaignFiles = findCampaignFiles(item.campaign, ctx.PM_DIR, ctx.PM_REL);
  const recommendation = recommendAgentConfig({
    item,
    capabilities,
    scopeHints,
    provider: agent,
    config: ctx.deliveryConfig,
    history: loadRecommendationHistory(ctx),
  });
  return {
    recommendation,
    preview: buildLaunchPreview(ctx, {
      item,
      scopeHints,
      capabilities,
      skills,
      campaignFiles,
      recommendation,
      lane: DELIVERY_LANES.includes(lane) ? lane : null,
    }),
  };
}

/**
 * Validate `model`/`effort` against the owner's `.delivery/config.json` catalog
 * (DW-2). Model is only checked when the provider's catalog is non-empty —
 * an owner who hasn't populated `.delivery/config.json` yet keeps today's
 * "any string, or null" behavior. Effort is always checked (config.mjs ships
 * built-in per-provider effort enums even with no config file present).
 */
function validateAgentConfig(ctx, agent, { model, effort }) {
  const config = ctx.deliveryConfig;
  const providerCfg = config && config.providers && config.providers[agent];
  if (model != null && providerCfg && providerCfg.models && providerCfg.models.length && !isKnownModel(config, agent, model)) {
    throw fail(400, `unknown model "${model}" for provider "${agent}"`);
  }
  if (effort && typeof effort === "object") {
    for (const [phase, value] of Object.entries(effort)) {
      if (value != null && !isKnownEffort(config, agent, value)) {
        throw fail(400, `unknown effort "${value}" for provider "${agent}" (phase "${phase}")`);
      }
    }
  }
}

const PREFLIGHT_MAX_AGE_MS = 15 * 60 * 1000;

function workspaceFingerprint(ctx, statusPorcelain, baseHead) {
  const fingerprints = fingerprintDirtyPaths(ctx.ROOT, statusPorcelain);
  return sha1(JSON.stringify({ baseHead, statusPorcelain, fingerprints }));
}

async function captureWorkspacePreflight(ctx, seed = {}) {
  const statusPorcelain =
    seed.statusPorcelain != null ? seed.statusPorcelain : ctx.gitStatusPorcelain({ cwd: ctx.ROOT });
  const baseHead = seed.baseHead != null ? seed.baseHead : ctx.gitRevParseHead({ cwd: ctx.ROOT });
  const validation = await ctx.runValidation({
    cwd: ctx.ROOT,
    timeoutMs:
      ctx.deliveryConfig &&
      ctx.deliveryConfig.budgets &&
      ctx.deliveryConfig.budgets.validationTimeoutMs,
  });
  const capturedAt = new Date().toISOString();
  const record = {
    schemaVersion: 1,
    capturedAt,
    baseHead,
    workspaceFingerprint: workspaceFingerprint(ctx, statusPorcelain, baseHead),
    baselineStatusHash: sha1(statusPorcelain),
    dirtyAtStart: statusPorcelain.trim().length > 0,
    changedFiles: parsePorcelainPaths(statusPorcelain),
    baselineValidation: validation,
    baselineValidationHash: sha1(JSON.stringify(validation)),
  };
  const preflightId = `p-${sha1(JSON.stringify(record)).slice(0, 20)}`;
  const dir = join(ctx.ROOT, ".delivery", "preflights");
  mkdirSync(dir, { recursive: true });
  atomicWriteJsonSync(join(dir, `${preflightId}.json`), { ...record, preflightId });
  return { ...record, preflightId };
}

function readWorkspacePreflight(ctx, preflightId) {
  if (!/^p-[a-f0-9]{20}$/.test(String(preflightId || ""))) {
    throw fail(400, "invalid preflightId");
  }
  const record = readJsonIfExists(join(ctx.ROOT, ".delivery", "preflights", `${preflightId}.json`));
  if (!record) throw fail(409, "workspace preflight not found; refresh the flight-check");
  if (Date.now() - new Date(record.capturedAt).getTime() > PREFLIGHT_MAX_AGE_MS) {
    throw fail(409, "workspace preflight expired; refresh the flight-check");
  }
  return record;
}

function assertWorkspacePreflightCurrent(ctx, preflight, statusPorcelain, baseHead) {
  const current = workspaceFingerprint(ctx, statusPorcelain, baseHead);
  if (current !== preflight.workspaceFingerprint) {
    throw fail(409, "workspace changed after preflight; refresh the flight-check");
  }
}

async function getWorkspacePreflight(ctx) {
  return captureWorkspacePreflight(ctx);
}

// ---- POST /api/delivery/start ----

/**
 * DLV-13 — salvage a stopped session into a right-sized successor.
 *
 * Today a BLOCKED or paused session offers exactly two things: retry it as-is,
 * or abandon it. BUD-11's two dead sessions were unsalvageable by any route
 * except a human reading transcripts and re-typing the remainder by hand — and
 * the remainder was real work: a partial migration and 67 unconverted
 * occurrences, all of it already analysed and paid for.
 *
 * This reads the predecessor's own `finish/remaining-work.json` (DLV-12) and
 * returns a pre-filled launch payload. It deliberately does NOT launch: the
 * successor goes through the ordinary Flight-Check with a *fresh* budget, lane
 * and model, because the reason a session needed salvaging is usually that one
 * of those three was wrong, and silently inheriting them would reproduce it.
 */
function getSalvage(ctx, id) {
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  // A session with a live runner is not finished, and salvaging it would mean
  // two lineages advancing the same work item's git state at once.
  if (isRunnerAlive(s.dir).alive) {
    throw fail(409, "this session's runner is still alive — pause or cancel it before salvaging");
  }
  const remaining = readJsonIfExists(join(s.dir, "artifacts", "finish", "remaining-work.json"));
  if (!remaining) {
    throw fail(409, "this session has no finish package to salvage from (it exited before one was written)");
  }
  const manifest = readJsonIfExists(join(s.dir, "artifacts", "finish", "manifest.json"));
  const nothingLeft = !(remaining.acceptanceCriteria || []).length && !(remaining.planSteps || []).length;
  return {
    predecessor: {
      sessionId: s.packet.sessionId,
      state: s.state.state,
      reason: (s.state.awaiting && s.state.awaiting.reason) || null,
      lastError: s.state.lastError || null,
      usage: (s.state.usage && s.state.usage.total) || null,
      changedFiles: (manifest && manifest.files) || [],
      supersededBy: (s.state.supersededBy || null),
    },
    item: {
      pmFile: s.packet.item.pmFile,
      cbidx: s.packet.item.cbidx,
      lineText: s.packet.item.lineText,
      id: s.packet.item.id,
      text: s.packet.item.text,
      effort: s.packet.item.effort,
    },
    remainingWork: remaining,
    // The predecessor's own lane/model, shown so the owner can see what was
    // tried — never pre-selected. Choosing again is the point.
    previousSelection: {
      lane: (s.packet.lanePolicy && s.packet.lanePolicy.lane) || null,
      model: (s.packet.agentConfig && s.packet.agentConfig.model) || null,
      budget: s.packet.budget || null,
    },
    salvageable: !nothingLeft,
    ...(nothingLeft ? { note: "The finish package records nothing remaining — there may be nothing to salvage." } : {}),
  };
}

/** Mark a predecessor superseded once its successor is on disk. Never touches a live session. */
function markSuperseded(ctx, predecessorId, successorId) {
  const p = readSession(ctx, predecessorId);
  if (!p) return;
  if (isRunnerAlive(p.dir).alive) return;
  const at = new Date().toISOString();
  atomicWriteJsonSync(join(p.dir, "state.json"), {
    ...p.state,
    supersededBy: { sessionId: successorId, at },
    // The phase state is left exactly as it was — superseding is a note about
    // lineage, not a state transition, and rewriting a terminal state here
    // would corrupt the one record of how the session actually ended.
    awaiting: p.state.awaiting ? { ...p.state.awaiting, reason: "superseded" } : { gate: "none", reason: "superseded" },
    updatedAt: at,
  });
  emitEvent(p.dir, { type: "session.superseded", phase: p.state.state, data: { successorId } });
}

async function startSession(ctx, body) {
  const {
    file,
    cbidx,
    expectText,
    agent,
    model,
    effort,
    preflightId,
    dirtyAck,
    redBaselineAck,
    triageAck,
    options,
    budget: budgetInput,
    flightCheck: flightCheckInput,
    // DLV-13: salvage relaunch — narrows this session to the predecessor's
    // remaining work and links the two.
    continuationOf,
  } = body || {};
  if (agent !== "codex" && agent !== "claude") throw fail(400, 'agent must be "codex" or "claude"');
  if (typeof file !== "string" || !file) throw fail(400, "file is required");
  if (typeof cbidx !== "number") throw fail(400, "cbidx is required");
  if (!flightCheckInput || flightCheckInput.reviewed !== true) {
    throw fail(400, "Flight-Check review is required before launch");
  }
  if (!DELIVERY_LANES.includes(flightCheckInput.lane)) {
    throw fail(400, `Flight-Check lane must be one of ${DELIVERY_LANES.join(", ")}`);
  }
  const lanePolicy = resolveLanePolicy(flightCheckInput.lane, ctx.deliveryConfig);
  // D9/DLV-6: the lane always supplies the effort default now, per phase —
  // before this, an omitted `effort` fell straight through to the SDK's own
  // default with zero lane influence (`grep -i lane run-session.mjs` was 0
  // matches). A per-phase owner override in the request always wins for that
  // phase; any phase the owner didn't touch still gets the lane's default
  // rather than silently falling back to the old static packet.mjs default.
  const resolvedEffort = { ...lanePolicy.effortByPhase, ...(effort && typeof effort === "object" ? effort : {}) };
  validateAgentConfig(ctx, agent, { model, effort: resolvedEffort });

  let abs;
  try {
    abs = resolveInside(ctx.PM_DIR, file);
  } catch {
    throw fail(400, "path escapes the PM directory");
  }
  if (!existsSync(abs)) throw fail(404, "file not found");
  const raw = readFileSync(abs, "utf8");
  const st = statSync(abs);
  const idResult = buildItemIdentity(raw, cbidx, file, { expectText, sourceMtimeMs: st.mtimeMs });
  if (!idResult.ok) throw fail(409, idResult.reason);
  const item = idResult.item;
  if (!item.campaign) throw fail(400, "item is not inside a campaign folder");

  // DLV-13: resolve the predecessor first — its remaining work narrows this
  // session's acceptance criteria, and its very existence is what makes the
  // "item already has a session" check below survivable for a relaunch.
  let continuation = null;
  if (continuationOf) {
    if (typeof continuationOf !== "string") throw fail(400, "continuationOf must be a session id");
    const prior = readSession(ctx, continuationOf);
    if (!prior) throw fail(404, `unknown predecessor session: ${continuationOf}`);
    if (isRunnerAlive(prior.dir).alive) {
      throw fail(409, "the predecessor session's runner is still alive — pause or cancel it before salvaging");
    }
    if (prior.packet.item.pmFile !== file || prior.packet.item.cbidx !== cbidx) {
      throw fail(400, "continuationOf refers to a session for a different work item");
    }
    const remaining = readJsonIfExists(join(prior.dir, "artifacts", "finish", "remaining-work.json"));
    if (!remaining) throw fail(409, "the predecessor session has no finish package to salvage from");
    continuation = { predecessorSessionId: continuationOf, remainingWork: remaining, salvagedAt: new Date().toISOString() };
  }

  const active = findActiveSessionForItem(ctx, item);
  // A salvage relaunch legitimately targets an item that already has a
  // (stopped) session; only a genuinely *other* live session should block it.
  if (active && (!continuation || active.sessionId !== continuationOf)) {
    throw fail(409, `item already has an active delivery session: ${active.sessionId}`);
  }

  if (isBuildLockActive(ctx, continuation ? continuationOf : null)) {
    throw fail(429, "a delivery session is already past the plan gate");
  }

  const statusPorcelain = ctx.gitStatusPorcelain({ cwd: ctx.ROOT });
  const baseHead = ctx.gitRevParseHead({ cwd: ctx.ROOT });
  const preflight = preflightId
    ? readWorkspacePreflight(ctx, preflightId)
    : await captureWorkspacePreflight(ctx, { statusPorcelain, baseHead });
  assertWorkspacePreflightCurrent(ctx, preflight, statusPorcelain, baseHead);
  if (preflight.dirtyAtStart && dirtyAck !== DIRTY_TREE_ACK) {
    throw fail(400, `working tree is dirty; type ${DIRTY_TREE_ACK} to acknowledge pre-existing edits`);
  }
  if (!preflight.baselineValidation.ok && redBaselineAck !== RED_BASELINE_ACK) {
    throw fail(400, `baseline validation is red; type ${RED_BASELINE_ACK} to authorize delta-based validation`);
  }

  const scopeHints = computeScopeHints(item);
  // DLV-62: recorded onto the resolved lane policy so the runner reads one
  // packet field rather than re-deriving the rule, and so the audit trail shows
  // whether a given session ran merged and exactly why.
  const merge = resolveMergedDiscoveryPlan({ lane: flightCheckInput.lane, scopeHints, config: ctx.deliveryConfig });
  lanePolicy.mergedDiscoveryPlan = merge.merged;
  lanePolicy.mergedDiscoveryPlanReason = merge.reason;
  const classifiedCapabilities = classify({ item, scopeHints });
  let capabilities = classifiedCapabilities;
  const drops = (options && options.capabilitiesDrop) || [];
  if (drops.length) {
    for (const name of drops) {
      if (ALWAYS_ON_CAPABILITIES.includes(name)) throw fail(400, `cannot drop locked capability: ${name}`);
    }
    try {
      capabilities = applyCapabilityDrops(capabilities, drops);
    } catch (err) {
      throw fail(400, err.message);
    }
  }
  const skills = buildSkillRefs(capabilities);
  const campaignFiles = findCampaignFiles(item.campaign, ctx.PM_DIR, ctx.PM_REL);

  const resolvedModel = model != null && model !== "" ? model : getDefaultModel(ctx.deliveryConfig, agent);
  const recommendation = recommendAgentConfig({
    item,
    capabilities: classifiedCapabilities,
    scopeHints,
    provider: agent,
    config: ctx.deliveryConfig,
    history: loadRecommendationHistory(ctx),
  });
  const launchPreview = buildLaunchPreview(ctx, {
    item,
    scopeHints,
    capabilities: classifiedCapabilities,
    skills,
    campaignFiles,
    recommendation,
    lane: flightCheckInput.lane,
  });
  // D11/DLV-39: hard triage gate. Refuses entry for an item this trivial
  // rather than reducing oversight once a session is running (gates are
  // never touched). A typed override behaves exactly like DIRTY_TREE_ACK/
  // RED_BASELINE_ACK: refuse silently doing nothing, refuse silently
  // proceeding, require the owner to type an explicit phrase either way.
  // DLV-59: scopeHints are passed so the gate can use "the item names exactly
  // one file" — knowable since DLV-42 — instead of counting capability flags,
  // which could never reach zero for a UI item.
  // A salvage relaunch is never triage-refused: the predecessor's finish
  // package is direct evidence that this item was NOT too trivial to need the
  // pipeline — it already consumed one and did not finish.
  const isTrivialLaunch = !continuation && isTrivialLaunchCandidate(item, launchPreview.riskFlags, scopeHints);
  if (isTrivialLaunch && triageAck !== TRIAGE_OVERRIDE_ACK) {
    const est = recommendation
      ? ` The pipeline forecast for this item: ~$${(recommendation.estCostUsd ?? 0).toFixed(2)} / ~${recommendation.estTokens.toLocaleString()} tokens.`
      : "";
    const onlyPath = scopeHints.scopeSource === "item-paths" ? (scopeHints.globs || [])[0] : null;
    const why = onlyPath ? `names exactly one file (${onlyPath})` : "has no risk flags at all";
    throw fail(
      400,
      `This item is S-effort and ${why}, with no money or vagueness flags -- ` +
        `too small to be worth the pipeline's own overhead; a change this size cannot fail in an interesting way.${est} ` +
        `For reference, the last such item measured (BUD-14) spent $0.53 across DISCOVERY and PLAN and never reached ` +
        `BUILDING, against roughly a cent to make the edit by hand. ` +
        `Make the edit directly, or type "${TRIAGE_OVERRIDE_ACK}" to launch anyway.`,
    );
  }
  const selectedModelTier = resolvedModel
    ? getModelInfo(ctx.deliveryConfig, agent, resolvedModel)?.tier || null
    : null;
  const mismatchWarnings = assessRecommendationMismatch({
    recommendation,
    selectedModel: resolvedModel,
    selectedModelTier,
    selectedLane: flightCheckInput.lane,
  });
  let budget;
  try {
    budget = createBudgetEnvelope(budgetInput);
  } catch (err) {
    throw fail(400, err.message);
  }

  const sessionId = makeSessionId();
  const sessionDir = join(sessionsDirOf(ctx), sessionId);
  const acknowledgedAt = new Date().toISOString();
  const workspace = {
    baseHead,
    preflightId: preflight.preflightId,
    baselineCapturedAt: preflight.capturedAt,
    dirtyAtStart: preflight.dirtyAtStart,
    baselineStatusHash: preflight.baselineStatusHash,
    baselineWorkspaceHash: preflight.workspaceFingerprint,
    baselineValidationHash: preflight.baselineValidationHash,
    baselineValidation: preflight.baselineValidation,
    preExistingChanges: preflight.changedFiles.map((path) => ({
      path,
      ownership: "not-session-owned",
    })),
    changedFiles: [],
    changeOwnership: preflight.changedFiles.map((path) => ({
      path,
      ownership: "not-session-owned",
    })),
    acknowledgments: {
      dirtyTree: preflight.dirtyAtStart
        ? { phrase: DIRTY_TREE_ACK, acknowledgedAt }
        : null,
      redBaseline: !preflight.baselineValidation.ok
        ? { phrase: RED_BASELINE_ACK, acknowledgedAt }
        : null,
      triage: isTrivialLaunch
        ? { phrase: TRIAGE_OVERRIDE_ACK, acknowledgedAt }
        : null,
    },
  };
  const flightCheck = {
    schemaVersion: 1,
    reviewedAt: acknowledgedAt,
    ...launchPreview,
    lane: {
      selected: flightCheckInput.lane,
      recommended: launchPreview.recommendedLane,
    },
    selection: {
      agent,
      model: resolvedModel,
      modelTier: selectedModelTier,
      // The owner's explicit override only (empty when the lane default was
      // used unmodified) -- `lanePolicy.effortByPhase` below is what actually
      // ran when this is empty, kept separate so the audit trail can tell
      // "owner chose this" from "the lane defaulted to this" at a glance.
      effortOverrides: effort || {},
      capabilityDrops: drops,
    },
    recommendation,
    mismatchWarnings,
    budget,
    baseline: {
      preflightId: preflight.preflightId,
      capturedAt: preflight.capturedAt,
      dirtyAtStart: preflight.dirtyAtStart,
      changedFiles: preflight.changedFiles,
      validationOk: preflight.baselineValidation.ok,
      failedCommands: Object.entries(preflight.baselineValidation.results || {})
        .filter(([, result]) => !result.ok)
        .map(([command]) => command),
      acknowledgments: workspace.acknowledgments,
    },
  };
  // DLV-13: a continuation starts from what is actually left, not from the
  // whole item again. Falling back to the full list when the predecessor
  // recorded no remaining ACs is deliberate — "nothing remaining" is a reason
  // to question the salvage, not a reason to launch a session with an empty
  // acceptance contract that can never fail.
  const remainingAcs = continuation ? continuation.remainingWork.acceptanceCriteria || [] : [];
  const packet = buildPacket({
    sessionId,
    agent,
    agentConfig: { model: resolvedModel, effort: resolvedEffort },
    item,
    context: { campaignFiles, relatedNotes: [] },
    scopeHints,
    capabilities,
    constraints: {},
    skills,
    acceptanceCriteria: remainingAcs.length
      ? remainingAcs.map((ac) => ({ id: ac.id, text: ac.text }))
      : launchPreview.acceptanceCriteria,
    workspace,
    budget,
    flightCheck,
    lanePolicy,
    continuation,
  });

  mkdirSync(sessionDir, { recursive: true });
  atomicWriteJsonSync(join(sessionDir, "packet.json"), packet);
  if (continuation) {
    // Carry the durable ledger across, same artifact-first reasoning as the
    // fork path: the successor inherits what was *learned* (objective,
    // requirements, answered questions) without inheriting a transcript.
    const priorLedger = readJsonIfExists(join(sessionsDirOf(ctx), continuationOf, "memory", "ledger.json"));
    if (priorLedger && priorLedger.rev > 0) {
      atomicWriteJsonSync(join(sessionDir, "memory", "ledger.json"), priorLedger);
    }
  }
  const now = new Date().toISOString();
  const state = {
    schemaVersion: 1,
    sessionId,
    state: "SELECTED",
    awaiting: null,
    phaseHistory: [{ state: "SELECTED", enteredAt: now, exitedAt: null }],
    agent,
    driver: { ref: null, specialists: {} },
    workspace: packet.workspace,
    build: null,
    fixLoop: 0,
    usage: { perPhase: {}, total: emptyUsageV2() },
    budget: { current: budget, warned: [], exhaustedAt: null },
    decisionsProcessed: 0,
    messagesProcessed: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
  atomicWriteJsonSync(join(sessionDir, "state.json"), state);
  // Marked only after the successor is fully on disk: if anything above threw,
  // the predecessor must stay exactly as it was rather than be labelled
  // superseded by a session that does not exist.
  if (continuation) markSuperseded(ctx, continuationOf, sessionId);
  spawnRunner(ctx, sessionId);
  return { sessionId, ...(continuation ? { continuationOf } : {}) };
}

function sha1(text) {
  return createHash("sha1").update(String(text)).digest("hex");
}

// ---- POST /api/delivery/decision ----

function nextSeqInDir(dir) {
  if (!existsSync(dir)) return 1;
  const nums = readdirSync(dir)
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

const VALID_DECISIONS_FOR_GATE = {
  spec: new Set(["approve", "reject"]),
  plan: new Set(["approve", "reject"]),
  uat: new Set(["accept", "reject"]),
  question: new Set(["answer"]),
  blocked: new Set(["retry"]),
  shipped: new Set(["shipped"]),
};

async function postDecision(ctx, body) {
  const { id, gate, decision, note, confirmText, tickCheckbox, answer, capabilitiesDrop, scopeSlice, scopeAck } = body || {};
  if (typeof id !== "string" || !id) throw fail(400, "id is required");
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  if (isTerminal(s.state.state)) throw fail(409, "session is terminal");

  if (decision !== "cancel") {
    const expectedGate = s.state.awaiting && s.state.awaiting.gate;
    if (!expectedGate || gate !== expectedGate) {
      throw fail(409, `gate mismatch: session is awaiting "${expectedGate || "nothing"}"`);
    }
    const allowed = VALID_DECISIONS_FOR_GATE[gate];
    if (!allowed || !allowed.has(decision)) throw fail(400, `decision "${decision}" is not valid for gate "${gate}"`);
    if (gate === "blocked" && decision === "retry" && (typeof note !== "string" || !note.trim())) {
      throw fail(400, "a reason note is required before retrying a blocked session");
    }
    if (gate === "question" && s.state.awaiting && s.state.awaiting.reason === "retry-exhausted" && (typeof answer !== "string" || !answer.trim())) {
      throw fail(400, "a next-step decision is required after automatic retries are exhausted");
    }
    // DLV-7: the scope tripwire is enforced here, at the same layer as the
    // dirty-tree / red-baseline / triage acknowledgments, and for the same
    // reason: a runner that refuses an already-written decision parks the
    // session at a gate with nothing left to answer it (the DLV-53 shape).
    // The owner has exactly two ways past a mismatch, and both are recorded.
    if (gate === "spec" && decision === "approve") {
      const scope = (s.state.awaiting && s.state.awaiting.scope) || null;
      if (scope && scope.mismatch) {
        const slices = scope.decomposition || [];
        const sliceOk = Number.isInteger(scopeSlice) && scopeSlice >= 1 && scopeSlice <= slices.length;
        // A slice number that was *sent but wrong* is answered precisely, and
        // before the general "you must choose" message — otherwise a typo'd
        // slice reads as if no choice had been made at all.
        if (Number.isInteger(scopeSlice) && !sliceOk) {
          throw fail(
            400,
            slices.length
              ? `scopeSlice must be between 1 and ${slices.length}`
              : "this spec gate reports no decomposition to slice",
          );
        }
        if (!sliceOk && scopeAck !== SCOPE_MISMATCH_ACK) {
          const options = slices.length
            ? `Pick a decomposition slice (scopeSlice: 1-${slices.length}), or type "${SCOPE_MISMATCH_ACK}" to build the full measured scope.`
            : `Type "${SCOPE_MISMATCH_ACK}" to build the full measured scope.`;
          throw fail(400, `${scope.reason} ${options}`);
        }
      } else if (Number.isInteger(scopeSlice)) {
        throw fail(400, "scopeSlice is only valid when the spec gate reports a scope mismatch");
      }
    }
    if (gate === "plan" && decision === "approve") {
      const planPath = join(s.dir, "artifacts", "plan.json");
      const plan = readJsonIfExists(planPath);
      const riskFlags = (plan && plan.riskFlags) || [];
      const requiresTyped = riskFlags.some((f) => TYPED_APPROVAL_RISK_FLAGS.includes(f));
      if (requiresTyped && confirmText !== "APPROVE") {
        throw fail(400, 'typed confirmText "APPROVE" is required for a risk-flagged plan');
      }
    }
    if (capabilitiesDrop && capabilitiesDrop.length) {
      for (const name of capabilitiesDrop) {
        if (ALWAYS_ON_CAPABILITIES.includes(name)) throw fail(400, `cannot drop locked capability: ${name}`);
      }
    }
  }
  // Cancel decisions apply regardless of the currently-awaited gate — no gate
  // validation needed for them.

  const decisionsDir = join(s.dir, "decisions");
  mkdirSync(decisionsDir, { recursive: true });
  const seq = nextSeqInDir(decisionsDir);
  const record = {
    seq,
    gate: gate || null,
    decision,
    note: note || null,
    confirmText: confirmText || null,
    tickCheckbox: tickCheckbox !== false,
    answer: answer || null,
    capabilitiesDrop: capabilitiesDrop || null,
    // DLV-7 — how the owner answered a scope mismatch, on the decision record
    // itself so the audit trail shows the choice next to the approval it gated.
    scopeSlice: Number.isInteger(scopeSlice) ? scopeSlice : null,
    scopeAck: scopeAck === SCOPE_MISMATCH_ACK ? SCOPE_MISMATCH_ACK : null,
    at: new Date().toISOString(),
  };
  const name = `${String(seq).padStart(4, "0")}-${gate || "cancel"}.json`;
  atomicWriteJsonSync(join(decisionsDir, name), record);

  if (decision === "cancel" && !isRunnerAlive(s.dir).alive) {
    // No runner is alive to consume this decision file — pm-server marks the
    // session CANCELLED directly (doc 2 §5), the one documented exception to
    // "state.json / events.ndjson: runner only".
    const result = smNext(s.state.state, "decision.cancel");
    const cancelled = {
      ...s.state,
      state: result.to,
      awaiting: null,
      decisionsProcessed: seq,
      updatedAt: new Date().toISOString(),
    };
    atomicWriteJsonSync(join(s.dir, "state.json"), cancelled);
    emitEvent(s.dir, {
      type: "decision.consumed",
      phase: s.state.state,
      data: { decision: "cancel", note: "runner was not alive; pm-server cancelled directly" },
    });
  }
  return { ok: true, seq };
}

// ---- POST /api/delivery/message ----

function postMessage(ctx, body) {
  const { id, text } = body || {};
  if (typeof id !== "string" || !id) throw fail(400, "id is required");
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  if (isTerminal(s.state.state)) throw fail(409, "session is terminal");
  if (typeof text !== "string" || !text.trim()) throw fail(400, "text is required");
  if (text.length > MESSAGE_MAX_CHARS) throw fail(400, "text exceeds the 8 KB cap");

  const messagesDir = join(s.dir, "messages");
  mkdirSync(messagesDir, { recursive: true });
  const seq = nextSeqInDir(messagesDir);
  const record = { seq, text, at: new Date().toISOString() };
  atomicWriteJsonSync(join(messagesDir, `${String(seq).padStart(4, "0")}.json`), record);
  return { ok: true, seq };
}

// ---- POST /api/delivery/control (DW-4) ----

function postControl(ctx, body) {
  const { id, type, payload } = body || {};
  if (typeof id !== "string" || !id) throw fail(400, "id is required");
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  if (isTerminal(s.state.state)) throw fail(409, "session is terminal");

  const controlsDir = join(s.dir, "controls");
  mkdirSync(controlsDir, { recursive: true });
  const seq = nextSeqInDir(controlsDir);
  let control;
  try {
    control = buildControl({ seq, type, payload });
  } catch (err) {
    throw fail(400, err.message);
  }
  if (type === "set-config") {
    const targetProvider = (payload && payload.provider) || s.packet.agent;
    validateAgentConfig(ctx, targetProvider, { model: payload && payload.model, effort: payload && payload.effortByPhase });
  }
  if (type === "set-budget") {
    let current = (s.state.budget && s.state.budget.current) || s.packet.budget;
    try {
      for (const name of readdirSync(controlsDir).sort()) {
        const queued = readJsonIfExists(join(controlsDir, name));
        if (
          queued &&
          queued.type === "set-budget" &&
          queued.seq > (s.state.controlsProcessed || 0)
        ) {
          current = raiseBudgetEnvelope(current, queued.payload);
        }
      }
      raiseBudgetEnvelope(current, payload);
    } catch (err) {
      throw fail(400, err.message);
    }
  }
  atomicWriteJsonSync(join(controlsDir, controlFileName(control)), control);
  return { ok: true, seq };
}

// ---- POST /api/delivery/resume ----

function postResume(ctx, body) {
  const { id } = body || {};
  if (typeof id !== "string" || !id) throw fail(400, "id is required");
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  if (isRunnerAlive(s.dir).alive) throw fail(409, "runner heartbeat is fresh");
  const backoff = getStartupCrashBackoff(s.dir);
  if (backoff) throw fail(429, `runner restart backoff is active until ${backoff.retryAfter}`);
  if (isTerminal(s.state.state)) throw fail(409, "session is terminal");
  spawnRunner(ctx, id, { resume: true });
  return { ok: true };
}

// ---- Accept-writeback (exactly-once; pm-server only, doc 3 §2) ----

/**
 * Scan every session for `state === "ACCEPTED"` with no `writeback.done`
 * marker yet, re-verify the source line via textHash, tick the checkbox
 * (unless the owner unchecked "tick source checkbox" at Accept time), and
 * write the marker. Deliberately does not set the caller's `suppressUntil` —
 * the tick should trigger the normal PM `data: reload` (doc 2 §6).
 */
/**
 * DLV-14 — the PM trace as a state-machine exit effect rather than an agent step.
 *
 * The trace used to be something the agent was asked to do, which meant it was
 * something the agent could skip — and did: BUD-11 burned two full sessions and
 * left **zero** PM trace behind, so as far as the command centre was concerned
 * the work had never been attempted. A fix with no PM trace is invisible to
 * future planning (Hard Rule #25), and "invisible" here cost the owner a repeat
 * of the same launch.
 *
 * ACCEPTED keeps the existing checkbox tick. Every other resting state gets a
 * dated progress bullet appended to the campaign's `1 - Feature State.md`, so
 * the honest outcome ("this was attempted, it blocked here, the finish package
 * is at X") lands in the same file the owner plans from.
 *
 * Three deliberate properties:
 *  - **Append-only.** It adds a bullet under its own heading and never edits a
 *    line it did not write. Nothing the owner has authored can be clobbered.
 *  - **Drift-guarded.** The item's checklist line is re-hashed before writing;
 *    if the line has changed since launch, the trace records that instead of
 *    pretending it still matches.
 *  - **Idempotent.** A marker file per session, plus a session-id check in the
 *    file itself, so a re-run or a restart cannot double-append.
 */
const DELIVERY_LOG_HEADING = "## Delivery session log";

/** Terminal/paused states that deserve a progress bullet (ACCEPTED is handled by the tick path). */
const TRACEABLE_EXIT_STATES = Object.freeze({
  SHIPPED: "shipped",
  CANCELLED: "cancelled",
  FAILED: "failed",
  BLOCKED: "blocked",
  NEEDS_DECISION: "paused — needs a decision",
});

function renderTraceBullet(session, outcome, driftReason) {
  const item = session.packet.item || {};
  const date = new Date().toISOString().slice(0, 10);
  const finish = existsSync(join(session.dir, "artifacts", "finish", "summary.md"))
    ? ` · finish package: \`.delivery/sessions/${session.packet.sessionId}/artifacts/finish/summary.md\``
    : "";
  const changed = ((session.state.workspace && session.state.workspace.changedFiles) || []).length;
  const acceptance = (session.state.acceptance || []).length
    ? ` · ACs ${session.state.acceptance.filter((r) => r.status === "met" || r.status === "waived").length}/${session.state.acceptance.length} satisfied`
    : "";
  const drift = driftReason ? ` · ⚠ checklist line has changed since launch (${driftReason}) — verify this still refers to the same item` : "";
  return (
    `- ${date} — **${item.id || "(no id)"}** delivery session \`${session.packet.sessionId}\` ended **${outcome}** ` +
    `at ${session.state.state}. ${changed} file(s) changed${acceptance}.${finish}${drift}`
  );
}

/** Append `bullet` under the delivery-log heading, creating the heading if absent. */
function appendUnderHeading(raw, bullet) {
  const lines = raw.split("\n");
  const headingIndex = lines.findIndex((l) => l.trim() === DELIVERY_LOG_HEADING);
  if (headingIndex === -1) {
    const trimmed = raw.replace(/\s+$/, "");
    return `${trimmed}\n\n${DELIVERY_LOG_HEADING}\n\n> Appended automatically by the delivery runner on every session exit (DLV-14). Append-only — nothing above is ever edited.\n\n${bullet}\n`;
  }
  // Insert at the end of that section (just before the next heading, or EOF),
  // so entries read chronologically.
  let end = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  let insertAt = end;
  while (insertAt > headingIndex + 1 && lines[insertAt - 1].trim() === "") insertAt -= 1;
  return [...lines.slice(0, insertAt), bullet, ...lines.slice(insertAt)].join("\n");
}

function writePmTrace(ctx, session) {
  const outcome = TRACEABLE_EXIT_STATES[session.state.state];
  if (!outcome) return null;
  const campaign = session.packet.item && session.packet.item.campaign;
  if (!campaign) return { skipped: "no campaign recorded on the packet" };

  const relPath = `${campaign}/1 - Feature State.md`;
  let abs;
  try {
    abs = resolveInside(ctx.PM_DIR, relPath);
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
  if (!existsSync(abs)) return { skipped: `${relPath} does not exist` };

  // Drift guard: re-derive the checklist line's identity and note (never
  // refuse on) a mismatch. A drifted line still deserves a trace — the whole
  // point is that the attempt becomes visible — it just deserves a caveat.
  let driftReason = null;
  try {
    const checklistAbs = resolveInside(ctx.PM_DIR, session.packet.item.pmFile);
    const checklistRaw = readFileSync(checklistAbs, "utf8");
    const idCheck = buildItemIdentity(checklistRaw, session.packet.item.cbidx, session.packet.item.pmFile, {
      expectText: session.packet.item.lineText,
    });
    if (!idCheck.ok) driftReason = idCheck.reason;
  } catch {
    driftReason = "checklist file unreadable";
  }

  const raw = readFileSync(abs, "utf8");
  // Second idempotency guard, independent of the marker file: if this session
  // id is already named in the document, a previous run got there first.
  if (raw.includes(session.packet.sessionId)) return { alreadyPresent: true, file: relPath };

  writeFileSync(abs, appendUnderHeading(raw, renderTraceBullet(session, outcome, driftReason)), "utf8");
  return { appended: true, file: relPath, outcome, driftReason };
}

export function performPendingWritebacks(ctx) {
  // DLV-14: every resting state gets a trace, not only ACCEPTED. Its own marker
  // file, so it is independent of the checkbox tick's lifecycle — a SHIPPED
  // session performs both, in order, and neither can re-run.
  for (const id of listSessionIds(ctx)) {
    const s = readSession(ctx, id);
    if (!s || !TRACEABLE_EXIT_STATES[s.state.state]) continue;
    const traceMarker = join(s.dir, "pm-trace.done");
    if (existsSync(traceMarker)) continue;
    let result;
    try {
      result = writePmTrace(ctx, s) || { skipped: "state not traceable" };
    } catch (err) {
      result = { error: String((err && err.message) || err) };
    }
    atomicWriteJsonSync(traceMarker, { at: new Date().toISOString(), ...result });
  }

  for (const id of listSessionIds(ctx)) {
    const s = readSession(ctx, id);
    if (!s || s.state.state !== "ACCEPTED") continue;
    const marker = join(s.dir, "writeback.done");
    if (existsSync(marker)) continue;

    const tickCheckbox = s.state.writebackRequested ? s.state.writebackRequested.tickCheckbox !== false : true;
    const result = { tickedCheckbox: false };
    if (tickCheckbox) {
      try {
        const abs = resolveInside(ctx.PM_DIR, s.packet.item.pmFile);
        const raw = readFileSync(abs, "utf8");
        const idCheck = buildItemIdentity(raw, s.packet.item.cbidx, s.packet.item.pmFile, {
          expectText: s.packet.item.lineText,
        });
        if (!idCheck.ok) {
          result.driftReason = idCheck.reason;
        } else {
          const r = toggleCheckbox(raw, s.packet.item.cbidx);
          if (r.ok) {
            writeFileSync(abs, r.raw, "utf8");
            result.tickedCheckbox = true;
          } else {
            result.driftReason = r.reason;
          }
        }
      } catch (err) {
        result.error = String((err && err.message) || err);
      }
    }
    atomicWriteJsonSync(marker, { at: new Date().toISOString(), ...result });
  }
}

// ---- dispatcher ----

function ok(json) {
  return { status: 200, json };
}

/**
 * Route one delivery HTTP request. Returns `{status, json}` when handled, or
 * `null` when the path/method isn't a delivery route (pm-server continues its
 * own dispatch). Throws `DeliveryRouteError` (has `.status`) on failure —
 * pm-server's existing top-level catch already formats `{error}` from any
 * thrown error's `.status`/`.message`, so no special handling is needed there.
 * @param {{method:string, path:string, query:URLSearchParams, body:object}} req
 * @param {{ROOT:string, PM_DIR:string, PM_REL:string, SESSIONS_DIR:string}} ctx
 */
export async function routeDelivery({ method, path, query, body }, ctx) {
  if (method === "GET" && path === "/api/delivery/sessions") return ok(listSessions(ctx));
  if (method === "GET" && path === "/api/delivery/session") return ok(getSession(ctx, query.get("id") || ""));
  if (method === "GET" && path === "/api/delivery/events") {
    const after = parseInt(query.get("after") || "0", 10);
    return ok(getEvents(ctx, query.get("id") || "", Number.isFinite(after) ? after : 0));
  }
  if (method === "GET" && path === "/api/delivery/artifact") {
    return ok(getArtifact(ctx, query.get("id") || "", query.get("path") || ""));
  }
  if (method === "GET" && path === "/api/delivery/capabilities") return ok(getCapabilities(ctx));
  if (method === "POST" && path === "/api/delivery/preflight") return ok(await getWorkspacePreflight(ctx));
  if (method === "GET" && path === "/api/delivery/recommendation") {
    return ok(
      getRecommendation(ctx, {
        file: query.get("file") || "",
        cbidx: query.get("cbidx"),
        provider: query.get("provider") || "claude",
        lane: query.get("lane") || null,
      }),
    );
  }
  if (method === "GET" && path === "/api/delivery/salvage") return ok(getSalvage(ctx, query.get("id") || ""));
  if (method === "GET" && path === "/api/delivery/memory") return ok(getMemory(ctx, query.get("id") || ""));
  if (method === "GET" && path === "/api/delivery/questions") return ok(getQuestions(ctx, query.get("id") || ""));
  if (method === "GET" && path === "/api/delivery/turns") {
    const after = parseInt(query.get("after") || "0", 10);
    return ok(getTurns(ctx, query.get("id") || "", Number.isFinite(after) ? after : 0));
  }
  if (method === "GET" && path === "/api/delivery/transcript") {
    const after = parseInt(query.get("after") || "0", 10);
    const limit = parseInt(query.get("limit") || "0", 10);
    return ok(getTranscript(ctx, query.get("id") || "", query.get("turn") || "", Number.isFinite(after) ? after : 0, limit));
  }
  if (method === "GET" && path === "/api/delivery/prompt") {
    return ok(getPrompt(ctx, query.get("id") || "", query.get("turn") || ""));
  }
  if (method === "GET" && path === "/api/delivery/transcript/search") {
    const limit = parseInt(query.get("limit") || "0", 10);
    return ok(
      searchTranscript(ctx, query.get("id") || "", {
        q: query.get("q") || "",
        kinds: query.get("kinds") || "",
        phase: query.get("phase") || "",
        limit,
      }),
    );
  }
  if (method === "GET" && path === "/api/delivery/context") return ok(getContext(ctx, query.get("id") || ""));
  if (method === "GET" && path === "/api/delivery/context/preview") return ok(getContextPreview(ctx, query.get("id") || ""));
  if (method === "GET" && path === "/api/delivery/context/snapshot") {
    const seq = parseInt(query.get("seq") || "", 10);
    return ok(getContextSnapshot(ctx, query.get("id") || "", seq));
  }
  if (method === "POST" && path === "/api/delivery/start") return ok(await startSession(ctx, body));
  if (method === "POST" && path === "/api/delivery/decision") return ok(await postDecision(ctx, body));
  if (method === "POST" && path === "/api/delivery/message") return ok(postMessage(ctx, body));
  if (method === "POST" && path === "/api/delivery/control") return ok(postControl(ctx, body));
  if (method === "POST" && path === "/api/delivery/resume") return ok(postResume(ctx, body));
  return null;
}

/**
 * Build the per-server context object `routeDelivery`/`performPendingWritebacks`
 * expect. Call once at pm-server startup.
 * @param {{ROOT:string, PM_DIR:string, PM_REL:string, spawnRunner?:Function,
 *   gitStatusPorcelain?:Function, gitRevParseHead?:Function, runValidation?:Function,
 *   deliveryConfig?:object}} fields
 */
export function createDeliveryContext({
  ROOT,
  PM_DIR,
  PM_REL,
  spawnRunner: spawnRunnerOverride,
  gitStatusPorcelain: gitStatusPorcelainOverride,
  gitRevParseHead: gitRevParseHeadOverride,
  runValidation: runValidationOverride,
  deliveryConfig: deliveryConfigOverride,
}) {
  return {
    ROOT,
    PM_DIR,
    PM_REL,
    SESSIONS_DIR: join(ROOT, ".delivery", "sessions"),
    gitStatusPorcelain: gitStatusPorcelainOverride || gitStatusPorcelain,
    gitRevParseHead: gitRevParseHeadOverride || gitRevParseHead,
    runValidation: runValidationOverride || runValidationCommands,
    // Injectable so tests can verify a launch/resume was requested without
    // actually spawning a detached background process against a temp dir
    // that's about to be deleted.
    spawnRunner: spawnRunnerOverride || defaultSpawnRunner,
    // DW-2: owner-edited model/pricing catalog, loaded once at context
    // creation (pm-server long-lived process — a hand-edited config only
    // needs a server restart to take effect, matching other settings files).
    deliveryConfig: deliveryConfigOverride || loadConfig(ROOT),
  };
}

// Re-exported so pm-server's second fs.watch callback can extract a
// sessionId from a changed relative path without duplicating the convention.
export function sessionIdFromWatchPath(relPath) {
  if (!relPath) return null;
  const first = String(relPath).split(/[\\/]/)[0];
  return first || null;
}

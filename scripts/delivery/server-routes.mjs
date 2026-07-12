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
import { applyCapabilityDrops, classify, ALWAYS_ON_CAPABILITIES } from "./classify.mjs";
import { atomicWriteJsonSync, readJsonIfExists, readTextIfExists } from "./fsx.mjs";
import { gitRevParseHead, gitStatusPorcelain } from "./gitread.mjs";
import { buildItemIdentity, buildPacket, makeSessionId } from "./packet.mjs";
import { TYPED_APPROVAL_RISK_FLAGS, isTerminal, next as smNext } from "./state-machine.mjs";
import { replayAfter } from "./events.mjs";
import { emitEvent, isRunnerAlive } from "./run-session.mjs";

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

function computeScopeHints(item) {
  const text = item.text || "";
  const keywords = text
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^\w-]/g, ""))
    .filter((w) => w.length > 3);
  const globs = [...(CAMPAIGN_MODULE_GLOBS[item.campaign] || [])];
  if (/\bapi\b|route|endpoint|cron/i.test(text)) globs.push("src/app/api/**");
  return { keywords, globs, modules: item.campaign ? [item.campaign] : [] };
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

function isBuildLockActive(ctx) {
  for (const id of listSessionIds(ctx)) {
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
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return { sessions, buildLockActive: isBuildLockActive(ctx) };
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
  return { packet: s.packet, state: s.state, artifacts, runner };
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

// ---- POST /api/delivery/start ----

async function startSession(ctx, body) {
  const { file, cbidx, expectText, agent, dirtyAck, options } = body || {};
  if (agent !== "codex" && agent !== "claude") throw fail(400, 'agent must be "codex" or "claude"');
  if (typeof file !== "string" || !file) throw fail(400, "file is required");
  if (typeof cbidx !== "number") throw fail(400, "cbidx is required");

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

  const active = findActiveSessionForItem(ctx, item);
  if (active) throw fail(409, `item already has an active delivery session: ${active.sessionId}`);

  if (isBuildLockActive(ctx)) throw fail(429, "a delivery session is already past the plan gate");

  const statusPorcelain = gitStatusPorcelain({ cwd: ctx.ROOT });
  const dirtyAtStart = statusPorcelain.trim().length > 0;
  if (dirtyAtStart && !dirtyAck) throw fail(400, "working tree is dirty; confirm dirtyAck to proceed");
  const baseHead = gitRevParseHead({ cwd: ctx.ROOT });

  const scopeHints = computeScopeHints(item);
  let capabilities = classify({ item, scopeHints });
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

  const sessionId = makeSessionId();
  const sessionDir = join(sessionsDirOf(ctx), sessionId);
  const packet = buildPacket({
    sessionId,
    agent,
    item,
    context: { campaignFiles, relatedNotes: [] },
    scopeHints,
    capabilities,
    constraints: {},
    skills,
    acceptanceCriteria: [],
    workspace: { baseHead, dirtyAtStart, baselineStatusHash: sha1(statusPorcelain), changedFiles: [] },
  });

  mkdirSync(sessionDir, { recursive: true });
  atomicWriteJsonSync(join(sessionDir, "packet.json"), packet);
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
    usage: { perPhase: {}, total: { input: 0, cachedInput: 0, output: 0, costUsd: null } },
    decisionsProcessed: 0,
    messagesProcessed: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
  atomicWriteJsonSync(join(sessionDir, "state.json"), state);
  spawnRunner(ctx, sessionId);
  return { sessionId };
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
  const { id, gate, decision, note, confirmText, tickCheckbox, answer, capabilitiesDrop } = body || {};
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

// ---- POST /api/delivery/resume ----

function postResume(ctx, body) {
  const { id } = body || {};
  if (typeof id !== "string" || !id) throw fail(400, "id is required");
  const s = readSession(ctx, id);
  if (!s) throw fail(404, "unknown session");
  if (isRunnerAlive(s.dir).alive) throw fail(409, "runner heartbeat is fresh");
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
export function performPendingWritebacks(ctx) {
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
  if (method === "POST" && path === "/api/delivery/start") return ok(await startSession(ctx, body));
  if (method === "POST" && path === "/api/delivery/decision") return ok(await postDecision(ctx, body));
  if (method === "POST" && path === "/api/delivery/message") return ok(postMessage(ctx, body));
  if (method === "POST" && path === "/api/delivery/resume") return ok(postResume(ctx, body));
  return null;
}

/**
 * Build the per-server context object `routeDelivery`/`performPendingWritebacks`
 * expect. Call once at pm-server startup.
 */
export function createDeliveryContext({ ROOT, PM_DIR, PM_REL, spawnRunner: spawnRunnerOverride }) {
  return {
    ROOT,
    PM_DIR,
    PM_REL,
    SESSIONS_DIR: join(ROOT, ".delivery", "sessions"),
    // Injectable so tests can verify a launch/resume was requested without
    // actually spawning a detached background process against a temp dir
    // that's about to be deleted.
    spawnRunner: spawnRunnerOverride || defaultSpawnRunner,
  };
}

// Re-exported so pm-server's second fs.watch callback can extract a
// sessionId from a changed relative path without duplicating the convention.
export function sessionIdFromWatchPath(relPath) {
  if (!relPath) return null;
  const first = String(relPath).split(/[\\/]/)[0];
  return first || null;
}

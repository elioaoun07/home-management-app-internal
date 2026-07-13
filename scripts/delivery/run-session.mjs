// scripts/delivery/run-session.mjs
// The detached delivery runner — one process per session (doc 2 §2).
// Owns the state machine loop: baseline confirmation, agent turns (via the
// provider-neutral driver), validation, self-review, UAT assembly, heartbeat,
// and boundary-time decision/message intake. Never touches git except through
// gitread.mjs's read-only allowlist; never writes PM markdown (that's
// pm-server's job, incl. the Accept checkbox writeback).
//
// CLI usage:  node scripts/delivery/run-session.mjs --session <id> [--resume]
// In-process usage (tests): import { advanceSession, runLoop } and inject a
// driver + sessionDir + repoRoot directly — no child process required.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createDriver } from "./drivers/driver.mjs";
import "./drivers/fake.mjs"; // self-registers "fake"
import "./drivers/codex.mjs"; // self-registers; SDK import remains lazy
import "./drivers/claude.mjs"; // self-registers; SDK import remains lazy
import { TRUNCATE_LIMITS, appendEvent, formatEvent, reduceUsage, truncateField } from "./events.mjs";
import { atomicWriteJsonSync, readJsonIfExists, readTextIfExists, appendNdjsonLine } from "./fsx.mjs";
import { gitDiff, gitForEachRef, gitRevParseHead, gitStatusPorcelain } from "./gitread.mjs";
import { applyCapabilityDrops } from "./classify.mjs";
import {
  GATES,
  StateMachineError,
  isTerminal,
  next as smNext,
} from "./state-machine.mjs";
import {
  buildBuildingPrompt,
  buildDiscoveryPrompt,
  buildPlanPrompt,
  buildSelfReviewPrompt,
  buildUatPrompt,
} from "./prompts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, "..", "..");

export class RunnerError extends Error {}

// ---- small fs/session-dir helpers ----

function sessionPaths(sessionDir) {
  return {
    dir: sessionDir,
    packet: join(sessionDir, "packet.json"),
    state: join(sessionDir, "state.json"),
    events: join(sessionDir, "events.ndjson"),
    runner: join(sessionDir, "runner.json"),
    decisions: join(sessionDir, "decisions"),
    messages: join(sessionDir, "messages"),
    artifacts: join(sessionDir, "artifacts"),
    uat: join(sessionDir, "artifacts", "uat"),
  };
}

export function loadPacket(sessionDir) {
  const packet = readJsonIfExists(sessionPaths(sessionDir).packet);
  if (!packet) throw new RunnerError(`packet.json missing in ${sessionDir}`);
  return packet;
}

export function loadState(sessionDir) {
  const state = readJsonIfExists(sessionPaths(sessionDir).state);
  if (!state) throw new RunnerError(`state.json missing in ${sessionDir}`);
  return state;
}

export function persistState(sessionDir, state, { now = () => new Date() } = {}) {
  const out = { ...state, updatedAt: now().toISOString() };
  atomicWriteJsonSync(sessionPaths(sessionDir).state, out);
  return out;
}

export function emitEvent(sessionDir, partial) {
  const p = sessionPaths(sessionDir);
  const current = readTextIfExists(p.events) || "";
  const { event } = appendEvent(current, partial);
  appendNdjsonLine(p.events, formatEvent(event));
  return event;
}

function listSeqFiles(dirPath) {
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath)
    .filter((n) => /^\d+.*\.json$/.test(n))
    .sort();
}

/** Unread decision files (seq > state.decisionsProcessed), in seq order. */
export function pendingDecisions(sessionDir, decisionsProcessed) {
  const p = sessionPaths(sessionDir);
  return listSeqFiles(p.decisions)
    .map((name) => readJsonIfExists(join(p.decisions, name)))
    .filter((d) => d && typeof d.seq === "number" && d.seq > (decisionsProcessed || 0))
    .sort((a, b) => a.seq - b.seq);
}

/** Unread owner messages (seq > state.messagesProcessed), in seq order. */
export function pendingMessages(sessionDir, messagesProcessed) {
  const p = sessionPaths(sessionDir);
  return listSeqFiles(p.messages)
    .map((name) => readJsonIfExists(join(p.messages, name)))
    .filter((m) => m && typeof m.seq === "number" && m.seq > (messagesProcessed || 0))
    .sort((a, b) => a.seq - b.seq);
}

/** Drain pending owner messages for the next prompt; returns {texts, lastSeq}. */
function drainMessages(sessionDir, state) {
  const pending = pendingMessages(sessionDir, state.messagesProcessed || 0);
  if (!pending.length) return { texts: [], lastSeq: state.messagesProcessed || 0 };
  for (const m of pending) {
    emitEvent(sessionDir, { type: "owner.message.consumed", data: { seq: m.seq, text: m.text } });
  }
  return { texts: pending.map((m) => m.text), lastSeq: pending[pending.length - 1].seq };
}

function artifactPath(sessionDir, ...parts) {
  return join(sessionPaths(sessionDir).artifacts, ...parts);
}

// fsx.mjs only exposes JSON + ndjson atomic writers; markdown artifacts reuse
// the same tmp+rename primitive via a tiny local wrapper over node:fs.
function atomicWriteTextSync(targetPath, text) {
  mkdirSync(dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.tmp`;
  writeFileSync(tmp, text);
  let attempt = 0;
  for (;;) {
    try {
      renameSync(tmp, targetPath);
      return;
    } catch (err) {
      if (err && err.code === "EPERM" && attempt < 3) {
        attempt++;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
        continue;
      }
      throw err;
    }
  }
}

function writeArtifactText(sessionDir, relName, text) {
  atomicWriteTextSync(artifactPath(sessionDir, relName), text);
}

function writeArtifactJson(sessionDir, relName, value) {
  atomicWriteJsonSync(artifactPath(sessionDir, relName), value);
}

// ---- usage accounting ----

function accumulateUsage(state, phase, usage) {
  const records = [{ phase, usage }];
  const delta = reduceUsage(records);
  const perPhase = { ...(state.usage && state.usage.perPhase) };
  const prevPhase = perPhase[phase] || { input: 0, cachedInput: 0, output: 0, costUsd: null };
  const addPhase = delta.perPhase[phase];
  perPhase[phase] = {
    input: prevPhase.input + addPhase.input,
    cachedInput: prevPhase.cachedInput + addPhase.cachedInput,
    output: prevPhase.output + addPhase.output,
    costUsd:
      addPhase.costUsd == null && prevPhase.costUsd == null
        ? null
        : (prevPhase.costUsd || 0) + (addPhase.costUsd || 0),
  };
  const prevTotal = (state.usage && state.usage.total) || { input: 0, cachedInput: 0, output: 0, costUsd: null };
  const total = {
    input: prevTotal.input + delta.total.input,
    cachedInput: prevTotal.cachedInput + delta.total.cachedInput,
    output: prevTotal.output + delta.total.output,
    costUsd:
      delta.total.costUsd == null && prevTotal.costUsd == null
        ? null
        : (prevTotal.costUsd || 0) + (delta.total.costUsd || 0),
  };
  return { perPhase, total };
}

// ---- structured analysis outputs (S3) ----

const STRING_ARRAY_SCHEMA = Object.freeze({ type: "array", items: { type: "string" } });

export const SPEC_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "problem",
    "currentBehavior",
    "proposedBehavior",
    "acceptanceCriteria",
    "affectedPaths",
    "riskFlags",
    "openQuestions",
  ],
  properties: {
    problem: { type: "string" },
    currentBehavior: { type: "string" },
    proposedBehavior: { type: "string" },
    acceptanceCriteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text"],
        properties: { id: { type: "string" }, text: { type: "string" } },
      },
    },
    affectedPaths: STRING_ARRAY_SCHEMA,
    riskFlags: STRING_ARRAY_SCHEMA,
    openQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text"],
        properties: { text: { type: "string" } },
      },
    },
  },
});

export const PLAN_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["steps", "testPlan", "riskFlags", "rollbackSketch", "noNewDeps"],
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "description", "paths", "validationHint"],
        properties: {
          id: { type: "string" },
          description: { type: "string" },
          paths: STRING_ARRAY_SCHEMA,
          validationHint: { type: "string" },
        },
      },
    },
    testPlan: { type: "string" },
    riskFlags: STRING_ARRAY_SCHEMA,
    rollbackSketch: { type: "string" },
    noNewDeps: { type: "boolean" },
  },
});

function requireString(value, field, label) {
  if (typeof value !== "string") throw new RunnerError(`${label} output field "${field}" must be a string`);
}

function requireStringArray(value, field, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new RunnerError(`${label} output field "${field}" must be an array of strings`);
  }
}

function parseJsonObject(text, label) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (err) {
    throw new RunnerError(`${label} output was not valid JSON: ${err.message}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RunnerError(`${label} output must be a JSON object`);
  }
  return value;
}

export function parseSpecOutput(text) {
  const spec = parseJsonObject(text, "DISCOVERY");
  for (const field of ["problem", "currentBehavior", "proposedBehavior"]) requireString(spec[field], field, "DISCOVERY");
  for (const field of ["affectedPaths", "riskFlags"]) requireStringArray(spec[field], field, "DISCOVERY");
  if (
    !Array.isArray(spec.acceptanceCriteria) ||
    spec.acceptanceCriteria.some((entry) => !entry || typeof entry.id !== "string" || typeof entry.text !== "string")
  ) {
    throw new RunnerError('DISCOVERY output field "acceptanceCriteria" must contain {id,text} objects');
  }
  if (
    !Array.isArray(spec.openQuestions) ||
    spec.openQuestions.some((entry) => !entry || typeof entry.text !== "string")
  ) {
    throw new RunnerError('DISCOVERY output field "openQuestions" must contain {text} objects');
  }
  return spec;
}

export function parsePlanOutput(text) {
  const plan = parseJsonObject(text, "PLAN");
  for (const field of ["testPlan", "rollbackSketch"]) requireString(plan[field], field, "PLAN");
  requireStringArray(plan.riskFlags, "riskFlags", "PLAN");
  if (typeof plan.noNewDeps !== "boolean") throw new RunnerError('PLAN output field "noNewDeps" must be boolean');
  if (
    !Array.isArray(plan.steps) ||
    plan.steps.some(
      (step) =>
        !step ||
        typeof step.id !== "string" ||
        typeof step.description !== "string" ||
        !Array.isArray(step.paths) ||
        step.paths.some((path) => typeof path !== "string") ||
        typeof step.validationHint !== "string",
    )
  ) {
    throw new RunnerError('PLAN output field "steps" must contain {id,description,paths[],validationHint} objects');
  }
  return plan;
}

// ---- git guards (doc 4 §3) ----

function normalizeStatusPath(rawPath) {
  let value = String(rawPath || "").trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      value = JSON.parse(value);
    } catch {
      // Keep Git's rendered path if it is not JSON-compatible C quoting.
    }
  }
  return value.replace(/\\/g, "/");
}

/** Parse repo-relative paths from `git status --porcelain` without mutating Git. */
export function parsePorcelainPaths(statusText) {
  const paths = [];
  for (const record of String(statusText || "").split(/\r?\n|\0/g)) {
    if (!record || record.length < 4) continue;
    const rendered = record.slice(3);
    const parts = rendered.includes(" -> ") ? rendered.split(" -> ") : [rendered];
    for (const part of parts) {
      const normalized = normalizeStatusPath(part);
      if (normalized) paths.push(normalized);
    }
  }
  return [...new Set(paths)].sort();
}

function fingerprintDirtyPaths(repoRoot, statusText) {
  const out = {};
  const root = resolve(repoRoot);
  for (const rel of parsePorcelainPaths(statusText)) {
    if (rel === ".delivery" || rel.startsWith(".delivery/")) continue;
    const abs = resolve(root, ...rel.split("/"));
    const back = relative(root, abs);
    if (!back || back.startsWith(`..${sep}`) || back === "..") continue;
    try {
      const stat = lstatSync(abs);
      out[rel] = stat.isFile()
        ? createHash("sha256").update(readFileSync(abs)).digest("hex")
        : `${stat.mode}:${stat.size}:${stat.mtimeMs}`;
    } catch {
      out[rel] = "<missing>";
    }
  }
  return out;
}

/** Stronger snapshot: refs + index + tracked diff + dirty-file fingerprints. */
export function snapshotGit(repoRoot) {
  const status = gitStatusPorcelain({ cwd: repoRoot });
  return {
    status,
    head: gitRevParseHead({ cwd: repoRoot }),
    refs: gitForEachRef({ cwd: repoRoot }),
    indexDiff: gitDiff(["--cached", "--binary", "--no-ext-diff"], { cwd: repoRoot }),
    trackedDiff: gitDiff(["--binary", "--no-ext-diff"], { cwd: repoRoot }),
    fingerprints: fingerprintDirtyPaths(repoRoot, status),
  };
}

function globToRegExp(glob) {
  const marker = "\0";
  const withMarker = String(glob).replace(/\\/g, "/").split("**").join(marker);
  const escaped = withMarker.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withStars = escaped.split("*").join("[^/]*");
  return new RegExp(`^${withStars.split(marker).join(".*")}$`);
}

function changedPathsBetween(before, after) {
  const beforePaths = new Set(parsePorcelainPaths(before.status));
  const afterPaths = new Set(parsePorcelainPaths(after.status));
  const all = new Set([...beforePaths, ...afterPaths]);
  return [...all].filter((path) => {
    const beforePresent = beforePaths.has(path);
    const afterPresent = afterPaths.has(path);
    if (beforePresent !== afterPresent) return true;
    return (before.fingerprints && before.fingerprints[path]) !== (after.fingerprints && after.fingerprints[path]);
  });
}

/**
 * Compare a pre-turn git snapshot to the current state.
 * `mode: "readonly"` requires status to be byte-identical (analysis turns must
 * not edit the tree); `mode: "build"` allows tree edits but forbids any HEAD
 * or ref change (no commits/branches/checkouts, ever).
 */
/**
 * @param {object} before
 * @param {string} repoRoot
 * @param {"readonly"|"build"} mode
 * @param {{takeSnapshot?:Function, forbiddenPaths?:string[]}} [options]
 */
export function checkGitGuard(
  before,
  repoRoot,
  mode,
  { takeSnapshot = snapshotGit, forbiddenPaths = [] } = {},
) {
  const after = takeSnapshot(repoRoot);
  const violations = [];
  if (after.head !== before.head) violations.push("HEAD changed");
  if (after.refs !== before.refs) violations.push("refs changed");
  if ((after.indexDiff || "") !== (before.indexDiff || "")) violations.push("Git index changed");
  if (
    mode === "readonly" &&
    (after.status !== before.status ||
      (after.trackedDiff || "") !== (before.trackedDiff || "") ||
      JSON.stringify(after.fingerprints || {}) !== JSON.stringify(before.fingerprints || {}))
  ) {
    violations.push("working tree changed during a read-only phase");
  }
  if (mode === "build" && forbiddenPaths.length) {
    const matchers = forbiddenPaths.map(globToRegExp);
    const forbidden = changedPathsBetween(before, after).filter((path) => matchers.some((re) => re.test(path)));
    if (forbidden.length) violations.push(`forbidden paths changed: ${forbidden.join(", ")}`);
  }
  return { ok: violations.length === 0, violations, after };
}

// ---- driver turn wrapper: retry-once, then BLOCKED (doc 5 §7) ----

async function runGuardedTurn({
  sessionDir,
  driver,
  handle,
  prompt,
  phase,
  agent,
  outputSchema,
  repoRoot,
  guardMode,
  retryDelayMs = 30000,
  sleep = defaultSleep,
  takeSnapshot = snapshotGit,
  forbiddenPaths = [],
  effort,
}) {
  const before = takeSnapshot(repoRoot);
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await Promise.resolve(
        driver.runTurn(handle, prompt, {
          outputSchema,
          effort,
          onEvent: (e) => {
            const data = { ...((e && e.data) || {}) };
            if (typeof data.command === "string") data.command = truncateField(data.command, TRUNCATE_LIMITS.command);
            if (typeof data.message === "string") data.message = truncateField(data.message, TRUNCATE_LIMITS.message);
            emitEvent(sessionDir, {
              type: e && e.type ? e.type : "agent.event",
              phase,
              agent,
              data,
            });
          },
        }),
      );
      const guard = checkGitGuard(before, repoRoot, guardMode, { takeSnapshot, forbiddenPaths });
      if (!guard.ok) {
        emitEvent(sessionDir, {
          type: "git.guard.violation",
          phase,
          agent,
          data: { violations: guard.violations },
        });
        return { ok: false, gitViolation: true, violations: guard.violations };
      }
      return { ok: true, finalText: result.finalText, usage: result.usage };
    } catch (err) {
      lastErr = err;
      emitEvent(sessionDir, {
        type: "agent.turn.failed",
        phase,
        agent,
        data: { attempt, message: String((err && err.message) || err) },
      });
      const guard = checkGitGuard(before, repoRoot, guardMode, { takeSnapshot, forbiddenPaths });
      if (!guard.ok) {
        emitEvent(sessionDir, {
          type: "git.guard.violation",
          phase,
          agent,
          data: { violations: guard.violations },
        });
        return { ok: false, gitViolation: true, violations: guard.violations, error: err };
      }
      if (attempt === 0) {
        sleep(retryDelayMs);
        continue;
      }
    }
  }
  return { ok: false, gitViolation: false, error: lastErr };
}

function defaultSleep(ms) {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ---- driver session handle (persisted ref, resumable) ----

function phaseEffort(packet, phase) {
  return packet.agentConfig && packet.agentConfig.effort
    ? packet.agentConfig.effort[phase] || null
    : null;
}

async function getHandle({ driver, state, packet, repoRoot, mode, phase }) {
  const ref = state.driver && state.driver.ref;
  if (ref) {
    return Promise.resolve(driver.resume(ref));
  }
  const handle = await Promise.resolve(
    driver.startSession({
      cwd: repoRoot,
      mode,
      model: packet.agentConfig && packet.agentConfig.model,
      effort: phaseEffort(packet, phase),
    }),
  );
  return handle;
}

async function getGuardedHandle({
  sessionDir,
  driver,
  state,
  packet,
  repoRoot,
  mode,
  phase,
  agent,
  takeSnapshot,
  forbiddenPaths,
}) {
  const before = takeSnapshot(repoRoot);
  try {
    const handle = await getHandle({ driver, state, packet, repoRoot, mode, phase });
    const guard = checkGitGuard(before, repoRoot, mode, { takeSnapshot, forbiddenPaths });
    if (!guard.ok) {
      emitEvent(sessionDir, {
        type: "git.guard.violation",
        phase: phase.toUpperCase(),
        agent,
        data: { stage: "session-setup", violations: guard.violations },
      });
      return { ok: false, gitViolation: true, violations: guard.violations };
    }
    return { ok: true, handle };
  } catch (error) {
    const guard = checkGitGuard(before, repoRoot, mode, { takeSnapshot, forbiddenPaths });
    if (!guard.ok) {
      emitEvent(sessionDir, {
        type: "git.guard.violation",
        phase: phase.toUpperCase(),
        agent,
        data: { stage: "session-setup", violations: guard.violations },
      });
      return { ok: false, gitViolation: true, violations: guard.violations, error };
    }
    return { ok: false, gitViolation: false, error };
  }
}

function withDriverRef(state, handle) {
  return { ...state, driver: { ...(state.driver || {}), ref: handle.ref } };
}

function persistNewDriverRef(sessionDir, priorState, nextState) {
  if (priorState.driver && priorState.driver.ref) return nextState;
  return persistState(sessionDir, nextState);
}

// ---- validation (runner-native, doc 3 §4 row 5) ----

const VALIDATION_COMMANDS = [
  { key: "typecheck", cmd: "pnpm", args: ["typecheck"] },
  { key: "lint", cmd: "pnpm", args: ["lint"] },
  { key: "test", cmd: "pnpm", args: ["test"] },
];
const EXCERPT_LINES = 200;

function tailLines(text, n) {
  const lines = String(text || "").split("\n");
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}

/**
 * Default real validation runner: spawns pnpm typecheck/lint/test at repoRoot.
 * @param {{cwd: string, spawn?: (cmd: string, args: string[], opts: object) => {status: number|null, stdout?: string, stderr?: string}}} options
 * @returns {{ok: boolean, results: Object<string, {ok: boolean, ms: number, excerpt: string}>}}
 */
export function runValidationCommands({ cwd, spawn = spawnSync } = {}) {
  /** @type {Object<string, {ok: boolean, ms: number, excerpt: string}>} */
  const results = {};
  let ok = true;
  for (const { key, cmd, args } of VALIDATION_COMMANDS) {
    const started = Date.now();
    const r = spawn(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
    const ms = Date.now() - started;
    const passed = r.status === 0;
    if (!passed) ok = false;
    results[key] = {
      ok: passed,
      ms,
      excerpt: tailLines(`${r.stdout || ""}\n${r.stderr || ""}`, EXCERPT_LINES),
    };
    if (!passed) break; // don't burn time on later commands once one has failed
  }
  return { ok, results };
}

// ---- capability skill paths ----

function skillPaths(packet) {
  return (packet.skills || []).map((s) => s.path);
}

// ---- artifact templates ----

function renderSpecMd(spec) {
  const lines = [
    "# Spec",
    "",
    "## Problem",
    spec.problem || "(none provided)",
    "",
    "## Current behavior",
    spec.currentBehavior || "(none provided)",
    "",
    "## Proposed behavior",
    spec.proposedBehavior || "(none provided)",
    "",
    "## Acceptance criteria",
    ...(spec.acceptanceCriteria || []).map((ac) => `- **${ac.id}**: ${ac.text}`),
    "",
    "## Affected paths",
    ...(spec.affectedPaths || []).map((p) => `- ${p}`),
    "",
    "## Risk flags",
    (spec.riskFlags || []).length ? (spec.riskFlags || []).map((f) => `- ${f}`).join("\n") : "(none)",
    "",
    "## Open questions",
    (spec.openQuestions || []).length
      ? (spec.openQuestions || []).map((q) => `- ${q.text}`).join("\n")
      : "(none)",
    "",
  ];
  return lines.join("\n");
}

function renderPlanMd(plan) {
  const lines = [
    "# Plan",
    "",
    "## Steps",
    ...(plan.steps || []).map(
      (s) => `${s.id}. ${s.description} (paths: ${(s.paths || []).join(", ") || "—"}; validate: ${s.validationHint || "—"})`,
    ),
    "",
    "## Test plan",
    plan.testPlan || "(none provided)",
    "",
    "## Risk flags",
    (plan.riskFlags || []).length ? (plan.riskFlags || []).map((f) => `- ${f}`).join("\n") : "(none)",
    "",
    "## Rollback sketch",
    plan.rollbackSketch || "(none provided)",
    "",
    "## Dependencies",
    plan.noNewDeps ? "No new dependencies added." : "⚠ plan requests new dependencies — requires owner decision.",
    "",
  ];
  return lines.join("\n");
}

function renderReviewMd(review) {
  const lines = [
    `VERDICT: ${review.verdict}`,
    "",
    "| Area | Note |",
    "|---|---|",
    ...(review.findings || []).map((f) => `| ${f.area || "-"} | ${f.note || "-"} |`),
    "",
  ];
  return lines.join("\n");
}

function renderValidationReportMd(validation) {
  const lines = [
    "# Validation report",
    "",
    ...VALIDATION_COMMANDS.map(({ key }) => {
      const r = validation.results[key];
      if (!r) return `## ${key}\n(skipped)`;
      return `## ${key}\n${r.ok ? "PASS" : "FAIL"} (${r.ms} ms)\n\n${BT3}\n${r.excerpt}\n${BT3}`;
    }),
    "",
  ];
  return lines.join("\n");
}
const BT3 = "```";

function appendBuildLog(sessionDir, stepId, description, text) {
  const p = artifactPath(sessionDir, "build-log.md");
  const existing = readTextIfExists(p) || "# Build log\n";
  const entry = `\n## Step ${stepId}${description ? `: ${description}` : ""}\n${text || "(no summary)"}\n`;
  atomicWriteTextSync(p, existing + entry);
}

function renderChangesMd(changedFiles) {
  if (!changedFiles || !changedFiles.length) return "# Changed files\n\n(no working-tree changes recorded)\n";
  return `# Changed files\n\n${changedFiles.map((f) => `- ${f}`).join("\n")}\n`;
}

function renderRollbackMd(changedFiles) {
  const lines = [
    "# Rollback (display-only — the owner runs these manually; the tool never executes them)",
    "",
  ];
  if (!changedFiles || !changedFiles.length) {
    lines.push("No working-tree changes were recorded for this session.");
  } else {
    lines.push("```");
    for (const f of changedFiles) lines.push(`git checkout -- "${f}"`);
    lines.push("```");
  }
  return lines.join("\n") + "\n";
}

function renderUatSummaryMd(uat, packet) {
  const lines = [
    `# UAT summary — ${packet.item.text}`,
    "",
    uat.summary || "(no summary provided)",
    "",
    "## Acceptance criteria",
    "",
    "| AC | Status | Evidence |",
    "|---|---|---|",
    ...(uat.acceptanceCriteria || []).map((a) => `| ${a.id} | ${a.status} | ${a.evidence || "-"} |`),
    "",
    "## Deviations & known limitations",
    (uat.deviations || []).length ? (uat.deviations || []).map((d) => `- ${d}`).join("\n") : "(none)",
    "",
  ];
  return lines.join("\n");
}

function renderManualTestScriptMd(uat) {
  const lines = [
    "# Manual test script",
    "",
    "Run against your own running `pnpm dev` app — direct edits are already live.",
    "",
    ...(uat.manualSteps || []).map(
      // Deliberately not markdown checkbox syntax ("- [ ]") — the dashboard's
      // renderer treats that as an interactive PM checklist item and would
      // try to PATCH a nonexistent source file when clicked.
      (s, i) => `${i + 1}. **Action:** ${s.action}\n   **Expected:** ${s.expected}\n   **Pass?** ☐`,
    ),
    "",
  ];
  return lines.join("\n");
}

function renderNotesMd(uat, packet) {
  return [
    "# Notes",
    "",
    `HR25 PM trace: satisfied by the Accept checkbox tick against ${packet.item.pmFile} (cbidx ${packet.item.cbidx}).`,
    "",
    "## Follow-ups",
    (uat.followUps || []).length ? (uat.followUps || []).map((f) => `- ${f}`).join("\n") : "(none)",
    "",
  ].join("\n");
}

// ---- phase handlers: each performs ONE advanceSession unit of work ----

async function handleSelected({ sessionDir, state }) {
  const result = smNext(state.state, "baseline.captured");
  const newState = { ...state, state: result.to, awaiting: null };
  emitEvent(sessionDir, { type: "phase.transition", phase: "SELECTED", data: { to: result.to } });
  return newState;
}

async function handleDiscovery({ sessionDir, state, packet, driver, repoRoot, config }) {
  const forbiddenPaths = (packet.constraints && packet.constraints.forbiddenPaths) || [];
  const setup = await getGuardedHandle({
    sessionDir,
    driver,
    state,
    packet,
    repoRoot,
    mode: "readonly",
    phase: "discovery",
    agent: "orchestrator",
    takeSnapshot: config.takeSnapshot,
    forbiddenPaths,
  });
  if (!setup.ok) return blockFrom(sessionDir, state, "DISCOVERY", setup);
  const handle = setup.handle;
  let working = persistNewDriverRef(sessionDir, state, withDriverRef(state, handle));
  const { texts: drainedMessages, lastSeq } = drainMessages(sessionDir, working);
  const pendingGuidance = working.pendingGuidance || [];
  const ownerMessages = [...pendingGuidance, ...drainedMessages];
  working = { ...working, pendingGuidance: [] };
  const campaignFilePaths = (packet.context && packet.context.campaignFiles) || [];
  const prompt = buildDiscoveryPrompt({
    packet,
    campaignFilePaths,
    skillPaths: skillPaths(packet),
    ownerMessages,
  });
  const turn = await runGuardedTurn({
    sessionDir,
    driver,
    handle,
    prompt,
    phase: "DISCOVERY",
    agent: "orchestrator",
    outputSchema: SPEC_OUTPUT_SCHEMA,
    repoRoot,
    guardMode: "readonly",
    takeSnapshot: config.takeSnapshot,
    forbiddenPaths,
    effort: phaseEffort(packet, "discovery"),
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
  });
  working = { ...working, messagesProcessed: lastSeq };
  if (!turn.ok) return blockFrom(sessionDir, working, "DISCOVERY", turn);

  working = { ...working, usage: accumulateUsage(working, "discovery", turn.usage) };
  let spec;
  try {
    spec = parseSpecOutput(turn.finalText);
  } catch (error) {
    return blockFrom(sessionDir, working, "DISCOVERY", { error });
  }
  writeArtifactJson(sessionDir, "spec.json", spec);
  writeArtifactText(sessionDir, "spec.md", renderSpecMd(spec));

  if ((spec.openQuestions || []).length) {
    const result = smNext(working.state, "question.raised");
    emitEvent(sessionDir, { type: "question.raised", phase: "DISCOVERY", data: { questions: spec.openQuestions } });
    return {
      ...working,
      state: result.to,
      awaiting: { gate: "question", returnTo: "DISCOVERY", questions: spec.openQuestions },
    };
  }
  const result = smNext(working.state, "spec.written");
  emitEvent(sessionDir, { type: "phase.transition", phase: "DISCOVERY", data: { to: result.to } });
  return { ...working, state: result.to, awaiting: { gate: GATES[result.to] || "spec" } };
}

function blockFrom(sessionDir, state, fromPhase, turn) {
  const result = smNext(fromPhase, "error.fatal");
  emitEvent(sessionDir, {
    type: "error.fatal",
    phase: fromPhase,
    data: { gitViolation: !!turn.gitViolation, violations: turn.violations || [], message: String((turn.error && turn.error.message) || turn.error || "") },
  });
  return {
    ...state,
    state: result.to,
    awaiting: { gate: "blocked", returnTo: fromPhase },
    lastError: {
      phase: fromPhase,
      gitViolation: !!turn.gitViolation,
      violations: turn.violations || [],
      message: String((turn.error && turn.error.message) || turn.error || ""),
    },
  };
}

async function consumeSpecDecision({ sessionDir, state, packet, driver, repoRoot, decision, config }) {
  if (decision.decision === "reject") {
    const result = smNext(state.state, "decision.reject");
    emitEvent(sessionDir, { type: "decision.consumed", phase: "SPEC_READY", data: { decision: "reject", note: decision.note } });
    return {
      newState: {
        ...state,
        state: result.to,
        awaiting: null,
        pendingGuidance: [...(state.pendingGuidance || []), decision.note].filter(Boolean),
      },
      newPacket: packet,
    };
  }
  // decision.approve — atomic: confirm capabilities, enrich packet, run PLAN turn, land in PLAN_READY.
  let newPacket = packet;
  if (decision.capabilitiesDrop && decision.capabilitiesDrop.length) {
    newPacket = { ...packet, capabilities: applyCapabilityDrops(packet.capabilities, decision.capabilitiesDrop) };
  }
  const spec = readJsonIfExists(artifactPath(sessionDir, "spec.json")) || {};
  newPacket = { ...newPacket, acceptanceCriteria: spec.acceptanceCriteria || newPacket.acceptanceCriteria || [] };
  atomicWriteJsonSync(sessionPaths(sessionDir).packet, newPacket);

  const forbiddenPaths = (newPacket.constraints && newPacket.constraints.forbiddenPaths) || [];
  const setup = await getGuardedHandle({
    sessionDir,
    driver,
    state,
    packet: newPacket,
    repoRoot,
    mode: "readonly",
    phase: "plan",
    agent: "orchestrator",
    takeSnapshot: config.takeSnapshot,
    forbiddenPaths,
  });
  if (!setup.ok) {
    return { newState: blockFrom(sessionDir, state, "SPEC_READY", setup), newPacket };
  }
  const handle = setup.handle;
  let working = persistNewDriverRef(sessionDir, state, withDriverRef(state, handle));
  const { texts: ownerMessages, lastSeq } = drainMessages(sessionDir, working);
  const prompt = buildPlanPrompt({
    packet: newPacket,
    approvalNote: decision.note || "",
    skillPaths: skillPaths(newPacket),
    ownerMessages,
  });
  const turn = await runGuardedTurn({
    sessionDir,
    driver,
    handle,
    prompt,
    phase: "PLAN",
    agent: "orchestrator",
    outputSchema: PLAN_OUTPUT_SCHEMA,
    repoRoot,
    guardMode: "readonly",
    takeSnapshot: config.takeSnapshot,
    forbiddenPaths,
    effort: phaseEffort(newPacket, "plan"),
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
  });
  working = { ...working, messagesProcessed: lastSeq };
  emitEvent(sessionDir, { type: "decision.consumed", phase: "SPEC_READY", data: { decision: "approve" } });
  if (!turn.ok) return { newState: blockFrom(sessionDir, working, "SPEC_READY", turn), newPacket };

  working = { ...working, usage: accumulateUsage(working, "plan", turn.usage) };
  let plan;
  try {
    plan = parsePlanOutput(turn.finalText);
  } catch (error) {
    return { newState: blockFrom(sessionDir, working, "SPEC_READY", { error }), newPacket };
  }
  writeArtifactJson(sessionDir, "plan.json", plan);
  writeArtifactText(sessionDir, "plan.md", renderPlanMd(plan));

  const result = smNext(working.state, "decision.approve");
  emitEvent(sessionDir, { type: "phase.transition", phase: "SPEC_READY", data: { to: result.to } });
  return {
    newState: { ...working, state: result.to, awaiting: { gate: GATES[result.to] || "plan" } },
    newPacket,
  };
}

function consumePlanDecision({ sessionDir, state, decision }) {
  if (decision.decision === "reject") {
    const result = smNext(state.state, "decision.reject");
    emitEvent(sessionDir, { type: "decision.consumed", phase: "PLAN_READY", data: { decision: "reject", note: decision.note } });
    return {
      ...state,
      state: result.to,
      awaiting: null,
      pendingGuidance: [...(state.pendingGuidance || []), decision.note].filter(Boolean),
    };
  }
  const result = smNext(state.state, "decision.approve", {
    riskFlags: (readJsonIfExists(artifactPath(sessionDir, "plan.json")) || {}).riskFlags || [],
    confirmText: decision.confirmText,
  });
  const plan = readJsonIfExists(artifactPath(sessionDir, "plan.json")) || { steps: [] };
  emitEvent(sessionDir, { type: "decision.consumed", phase: "PLAN_READY", data: { decision: "approve" } });
  return {
    ...state,
    state: result.to,
    awaiting: null,
    build: { mode: "plan", stepIndex: 0, totalSteps: (plan.steps || []).length },
  };
}

async function handleBuilding({ sessionDir, state, packet, driver, repoRoot, config }) {
  const build = state.build || { mode: "fix", stepIndex: 0, totalSteps: 1 };
  const handle = await getHandle({ driver, state, packet, repoRoot, mode: "build", phase: "building" });
  let working = withDriverRef(state, handle);
  const { texts: ownerMessages, lastSeq } = drainMessages(sessionDir, working);

  let stepId;
  let description = "";
  if (build.mode === "plan") {
    const plan = readJsonIfExists(artifactPath(sessionDir, "plan.json")) || { steps: [] };
    const step = plan.steps[build.stepIndex] || { id: `step-${build.stepIndex + 1}` };
    stepId = step.id;
    description = step.description || "";
  } else {
    stepId = `fix-${working.fixLoop || 0}`;
  }

  const priorValidationExcerpt =
    build.mode === "fix"
      ? excerptFromValidation(readJsonIfExists(artifactPath(sessionDir, "validation.json")))
      : "";
  const prompt = buildBuildingPrompt({
    packet,
    stepId,
    priorValidationExcerpt,
    ownerMessages,
  });
  const turn = await runGuardedTurn({
    sessionDir,
    driver,
    handle,
    prompt,
    phase: "BUILDING",
    agent: "orchestrator",
    outputSchema: false,
    repoRoot,
    guardMode: "build",
    takeSnapshot: config.takeSnapshot,
    forbiddenPaths: (packet.constraints && packet.constraints.forbiddenPaths) || [],
    effort: phaseEffort(packet, "building"),
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
  });
  working = { ...working, messagesProcessed: lastSeq };
  if (!turn.ok) return blockFrom(sessionDir, working, "BUILDING", turn);

  appendBuildLog(sessionDir, stepId, description, turn.finalText);
  working = { ...working, usage: accumulateUsage(working, "building", turn.usage) };

  const isLastStep = build.mode === "fix" || build.stepIndex + 1 >= build.totalSteps;
  if (!isLastStep) {
    const result = smNext(working.state, "build.step.done");
    emitEvent(sessionDir, { type: "build.step.done", phase: "BUILDING", data: { stepId } });
    return { ...working, state: result.to, build: { ...build, stepIndex: build.stepIndex + 1 } };
  }
  const result = smNext(working.state, "build.complete");
  emitEvent(sessionDir, { type: "phase.transition", phase: "BUILDING", data: { to: result.to } });
  return { ...working, state: result.to, awaiting: null, build: null };
}

function excerptFromValidation(validation) {
  if (!validation) return "";
  const failing = Object.entries(validation.results || {}).find(([, r]) => !r.ok);
  return failing ? `${failing[0]}:\n${failing[1].excerpt}` : "";
}

function handleValidating({ sessionDir, state, packet, config }) {
  const runValidation = config.runValidation || runValidationCommands;
  const validation = runValidation({ cwd: config.repoRoot });
  writeArtifactJson(sessionDir, "validation.json", validation);
  writeArtifactText(sessionDir, "validation-report.md", renderValidationReportMd(validation));
  emitEvent(sessionDir, { type: "validation.result", phase: "VALIDATING", data: { ok: validation.ok } });

  if (validation.ok) {
    const result = smNext(state.state, "validation.pass");
    return { ...state, state: result.to, awaiting: null };
  }
  const result = smNext(state.state, "validation.fail", {
    loopCount: state.fixLoop || 0,
    maxFixLoops: (packet.constraints && packet.constraints.maxFixLoops) || 3,
  });
  if (result.to === "BLOCKED") {
    emitEvent(sessionDir, { type: "error.fatal", phase: "VALIDATING", data: { reason: "fix loop exhausted" } });
    return {
      ...state,
      state: result.to,
      awaiting: { gate: "blocked", returnTo: "BUILDING" },
      lastError: { phase: "VALIDATING", message: "fix loop exhausted" },
    };
  }
  return {
    ...state,
    state: result.to,
    awaiting: null,
    fixLoop: (state.fixLoop || 0) + 1,
    build: { mode: "fix", stepIndex: 0, totalSteps: 1 },
  };
}

async function handleReviewing({ sessionDir, state, packet, driver, repoRoot, config }) {
  const handle = await getHandle({ driver, state, packet, repoRoot, mode: "readonly", phase: "review" });
  let working = withDriverRef(state, handle);
  const { texts: ownerMessages, lastSeq } = drainMessages(sessionDir, working);
  const prompt = buildSelfReviewPrompt({ packet, ownerMessages });
  const turn = await runGuardedTurn({
    sessionDir,
    driver,
    handle,
    prompt,
    phase: "REVIEWING",
    agent: "orchestrator",
    outputSchema: true,
    repoRoot,
    guardMode: "readonly",
    takeSnapshot: config.takeSnapshot,
    forbiddenPaths: (packet.constraints && packet.constraints.forbiddenPaths) || [],
    effort: phaseEffort(packet, "review"),
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
  });
  working = { ...working, messagesProcessed: lastSeq };
  if (!turn.ok) return blockFrom(sessionDir, working, "REVIEWING", turn);

  const review = JSON.parse(turn.finalText);
  writeArtifactJson(sessionDir, "review-self.json", review);
  writeArtifactText(sessionDir, "review-self.md", renderReviewMd(review));
  working = { ...working, usage: accumulateUsage(working, "reviewing", turn.usage) };

  if (review.verdict === "BLOCK") {
    const result = smNext(working.state, "reviews.blocking", {
      loopCount: working.fixLoop || 0,
      maxFixLoops: (packet.constraints && packet.constraints.maxFixLoops) || 3,
    });
    if (result.to === "BLOCKED") {
      emitEvent(sessionDir, { type: "error.fatal", phase: "REVIEWING", data: { reason: "review fix loop exhausted" } });
      return {
        ...working,
        state: result.to,
        awaiting: { gate: "blocked", returnTo: "BUILDING" },
        lastError: { phase: "REVIEWING", message: "review fix loop exhausted" },
      };
    }
    return {
      ...working,
      state: result.to,
      awaiting: null,
      fixLoop: (working.fixLoop || 0) + 1,
      build: { mode: "fix", stepIndex: 0, totalSteps: 1 },
    };
  }

  // PASS / PASS_WITH_NOTES — atomically assemble the UAT package (doc 3 §2: no
  // intermediate state exists between REVIEWING and UAT_READY).
  const uatHandle = await getHandle({ driver, state: working, packet, repoRoot, mode: "readonly", phase: "review" });
  working = withDriverRef(working, uatHandle);
  const priorArtifactPaths = ["artifacts/spec.md", "artifacts/plan.md", "artifacts/validation-report.md", "artifacts/review-self.md"];
  const uatPrompt = buildUatPrompt({ packet, priorArtifactPaths, ownerMessages: [] });
  const uatTurn = await runGuardedTurn({
    sessionDir,
    driver,
    handle: uatHandle,
    prompt: uatPrompt,
    phase: "UAT_PREP",
    agent: "orchestrator",
    outputSchema: true,
    repoRoot,
    guardMode: "readonly",
    takeSnapshot: config.takeSnapshot,
    forbiddenPaths: (packet.constraints && packet.constraints.forbiddenPaths) || [],
    effort: phaseEffort(packet, "review"),
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
  });
  if (!uatTurn.ok) return blockFrom(sessionDir, working, "REVIEWING", uatTurn);

  const uat = JSON.parse(uatTurn.finalText);
  assembleUatPackage(sessionDir, uat, packet, working);
  working = { ...working, usage: accumulateUsage(working, "uat", uatTurn.usage) };

  const result = smNext(working.state, "reviews.pass");
  emitEvent(sessionDir, { type: "phase.transition", phase: "REVIEWING", data: { to: result.to } });
  return { ...working, state: result.to, awaiting: { gate: GATES[result.to] || "uat" } };
}

function assembleUatPackage(sessionDir, uat, packet, state) {
  writeArtifactJson(sessionDir, join("uat", "summary.json"), uat);
  writeArtifactText(sessionDir, join("uat", "summary.md"), renderUatSummaryMd(uat, packet));
  writeArtifactText(sessionDir, join("uat", "manual-test-script.md"), renderManualTestScriptMd(uat));
  writeArtifactText(sessionDir, join("uat", "changes.md"), renderChangesMd((state.workspace && state.workspace.changedFiles) || []));
  writeArtifactText(sessionDir, join("uat", "rollback.md"), renderRollbackMd((state.workspace && state.workspace.changedFiles) || []));
  writeArtifactText(sessionDir, join("uat", "notes.md"), renderNotesMd(uat, packet));
  const validationReport = readTextIfExists(artifactPath(sessionDir, "validation-report.md"));
  if (validationReport) writeArtifactText(sessionDir, join("uat", "validation-report.md"), validationReport);
  const reviewMd = readTextIfExists(artifactPath(sessionDir, "review-self.md"));
  if (reviewMd) writeArtifactText(sessionDir, join("uat", "reviews", "review-self.md"), reviewMd);
}

function consumeUatDecision({ sessionDir, state, decision }) {
  if (decision.decision === "accept") {
    const result = smNext(state.state, "decision.accept");
    emitEvent(sessionDir, { type: "decision.consumed", phase: "UAT_READY", data: { decision: "accept" } });
    return {
      ...state,
      state: result.to,
      awaiting: { gate: "shipped" },
      writebackRequested: {
        tickCheckbox: decision.tickCheckbox !== false,
        at: new Date().toISOString(),
      },
    };
  }
  const result = smNext(state.state, "decision.reject");
  emitEvent(sessionDir, { type: "decision.consumed", phase: "UAT_READY", data: { decision: "reject", note: decision.note } });
  return {
    ...state,
    state: result.to,
    awaiting: null,
    fixLoop: (state.fixLoop || 0) + 1,
    build: { mode: "fix", stepIndex: 0, totalSteps: 1 },
  };
}

function consumeAcceptedDecision({ sessionDir, state, decision, repoRoot, readHead }) {
  const result = smNext(state.state, "decision.shipped");
  const shippedHead = readHead(repoRoot);
  emitEvent(sessionDir, { type: "decision.consumed", phase: "ACCEPTED", data: { decision: "shipped", head: shippedHead } });
  void decision;
  return { ...state, state: result.to, awaiting: null, shippedHead };
}

function consumeQuestionDecision({ sessionDir, state, decision }) {
  const returnTo = (state.awaiting && state.awaiting.returnTo) || "DISCOVERY";
  const result = smNext(state.state, "decision.answer", { returnTo });
  emitEvent(sessionDir, { type: "decision.consumed", phase: "NEEDS_DECISION", data: { answer: decision.answer } });
  const answerNote = decision.answer ? `Owner's answer to the open question: ${decision.answer}` : null;
  return {
    ...state,
    state: result.to,
    awaiting: null,
    pendingGuidance: [...(state.pendingGuidance || []), answerNote].filter(Boolean),
  };
}

function consumeBlockedDecision({ sessionDir, state }) {
  const returnTo = (state.awaiting && state.awaiting.returnTo) || "DISCOVERY";
  const result = smNext(state.state, "decision.retry", { returnTo });
  emitEvent(sessionDir, { type: "decision.consumed", phase: "BLOCKED", data: { retryTo: returnTo } });
  // Gate states are re-armed with their awaiting gate restored (the owner
  // approves again to retry); runner-executable states are left with
  // awaiting:null so the next poll tick re-enters the phase automatically.
  const awaiting = GATES[returnTo] ? { gate: GATES[returnTo] } : null;
  const base = { ...state, state: result.to, awaiting, fixLoop: 0, lastError: null };
  if (returnTo === "BUILDING") return { ...base, build: { mode: "fix", stepIndex: 0, totalSteps: 1 } };
  return base;
}

function consumeCancel({ sessionDir, state }) {
  const result = smNext(state.state, "decision.cancel");
  emitEvent(sessionDir, { type: "decision.consumed", phase: state.state, data: { decision: "cancel" } });
  return { ...state, state: result.to, awaiting: null };
}

// ---- the single-unit-of-work step (exported for tests) ----

/**
 * Perform exactly one unit of runner work for the session in `sessionDir` and
 * persist the result. Returns `{didWork: boolean, state}`.
 * @param {{sessionDir:string, driver:object, repoRoot:string, runValidation?:Function,
 *   retryDelayMs?:number, sleep?:Function, takeSnapshot?:Function, readHead?:Function}} options
 */
export async function advanceSession(options) {
  const { sessionDir, driver, repoRoot } = options;
  const config = {
    repoRoot,
    runValidation: options.runValidation,
    retryDelayMs: options.retryDelayMs != null ? options.retryDelayMs : 30000,
    sleep: options.sleep || defaultSleep,
    takeSnapshot: options.takeSnapshot || snapshotGit,
    readHead: options.readHead || ((root) => gitRevParseHead({ cwd: root })),
  };
  const state = loadState(sessionDir);
  const packet = loadPacket(sessionDir);

  if (isTerminal(state.state)) return { didWork: false, state };

  // Gate / paused states: only advance on a fresh decision.
  const GATE_OF_STATE = {
    SPEC_READY: "spec",
    PLAN_READY: "plan",
    UAT_READY: "uat",
    NEEDS_DECISION: "question",
    BLOCKED: "blocked",
    ACCEPTED: "shipped",
  };
  if (Object.prototype.hasOwnProperty.call(GATE_OF_STATE, state.state)) {
    const expectedGate = GATE_OF_STATE[state.state];
    const pending = pendingDecisions(sessionDir, state.decisionsProcessed || 0);
    // Cancel takes priority over whatever gate is awaited; anything else whose
    // `gate` doesn't match what's currently awaited is stale (doc 5 §7) —
    // skip it (advancing the seq cursor so it is never reprocessed) and keep
    // looking for one that does apply.
    let decision = null;
    let skippedThrough = state.decisionsProcessed || 0;
    for (const d of pending) {
      if (d.decision === "cancel") {
        decision = d;
        break;
      }
      if (d.gate && d.gate !== expectedGate) {
        emitEvent(sessionDir, { type: "decision.stale", phase: state.state, data: { gate: d.gate, expectedGate, seq: d.seq } });
        skippedThrough = d.seq;
        continue;
      }
      decision = d;
      break;
    }
    if (!decision) {
      if (skippedThrough > (state.decisionsProcessed || 0)) {
        const persisted = persistState(sessionDir, { ...state, decisionsProcessed: skippedThrough });
        return { didWork: true, state: persisted };
      }
      return { didWork: false, state };
    }

    let newState;
    try {
      if (decision.decision === "cancel") {
        newState = consumeCancel({ sessionDir, state });
      } else if (state.state === "SPEC_READY") {
        const r = await consumeSpecDecision({ sessionDir, state, packet, driver, repoRoot, decision, config });
        newState = r.newState;
      } else if (state.state === "PLAN_READY") {
        newState = consumePlanDecision({ sessionDir, state, decision });
      } else if (state.state === "UAT_READY") {
        newState = consumeUatDecision({ sessionDir, state, decision });
      } else if (state.state === "ACCEPTED") {
        newState = consumeAcceptedDecision({ sessionDir, state, decision, repoRoot, readHead: config.readHead });
      } else if (state.state === "NEEDS_DECISION") {
        newState = consumeQuestionDecision({ sessionDir, state, decision });
      } else {
        newState = consumeBlockedDecision({ sessionDir, state, decision });
      }
    } catch (err) {
      if (err instanceof StateMachineError) {
        // Illegal for the current state (e.g. approve without typed APPROVE
        // when server-side validation was somehow bypassed) — log, skip past
        // it, and keep the session parked at the same gate.
        emitEvent(sessionDir, { type: "decision.rejected", phase: state.state, data: { reason: err.message } });
        const persisted = persistState(sessionDir, { ...state, decisionsProcessed: decision.seq });
        return { didWork: true, state: persisted };
      }
      throw err;
    }
    newState = { ...newState, decisionsProcessed: decision.seq };
    const persisted = persistState(sessionDir, newState);
    return { didWork: true, state: persisted };
  }

  let newState;
  if (state.state === "SELECTED") {
    newState = await handleSelected({ sessionDir, state });
  } else if (state.state === "DISCOVERY") {
    newState = await handleDiscovery({ sessionDir, state, packet, driver, repoRoot, config });
  } else if (state.state === "BUILDING") {
    newState = await handleBuilding({ sessionDir, state, packet, driver, repoRoot, config });
  } else if (state.state === "VALIDATING") {
    newState = handleValidating({ sessionDir, state, packet, config });
  } else if (state.state === "REVIEWING") {
    newState = await handleReviewing({ sessionDir, state, packet, driver, repoRoot, config });
  } else {
    throw new RunnerError(`advanceSession: no handler for state "${state.state}"`);
  }
  const persisted = persistState(sessionDir, newState);
  return { didWork: true, state: persisted };
}

// ---- heartbeat + liveness ----

export function writeHeartbeat(sessionDir, { now = () => new Date(), pid = process.pid } = {}) {
  const p = sessionPaths(sessionDir);
  const existing = readJsonIfExists(p.runner);
  atomicWriteJsonSync(p.runner, {
    pid,
    startedAt: (existing && existing.startedAt) || now().toISOString(),
    heartbeatAt: now().toISOString(),
    node: process.version,
  });
}

const HEARTBEAT_STALE_MS = 15000;

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Runner liveness for the dashboard (doc 5 §7): stale heartbeat + pid probe. */
export function isRunnerAlive(
  sessionDir,
  { now = () => new Date(), staleMs = HEARTBEAT_STALE_MS, pidAlive = isPidAlive } = {},
) {
  const runnerJson = readJsonIfExists(sessionPaths(sessionDir).runner);
  if (!runnerJson) return { alive: false, heartbeatAt: null };
  const age = now().getTime() - new Date(runnerJson.heartbeatAt).getTime();
  if (age > staleMs) return { alive: false, heartbeatAt: runnerJson.heartbeatAt };
  if (!pidAlive(runnerJson.pid)) return { alive: false, heartbeatAt: runnerJson.heartbeatAt };
  return { alive: true, heartbeatAt: runnerJson.heartbeatAt };
}

// ---- long-running loop (CLI) ----

function sleepAsync(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run the session to completion (or until `shouldStop()` returns true).
 * @param {{sessionDir:string, repoRoot:string, driverKind?:string, driverOptions?:object,
 *   runValidation?:Function, pollIntervalMs?:number, heartbeatIntervalMs?:number,
 *   shouldStop?:Function, retryDelayMs?:number, sleep?:Function, takeSnapshot?:Function}} options
 */
export async function runLoop(options) {
  const {
    sessionDir,
    repoRoot,
    driverKind = "fake",
    driverOptions = {},
    runValidation,
    pollIntervalMs = 2000,
    heartbeatIntervalMs = 5000,
    shouldStop = () => false,
    retryDelayMs = 30000,
    sleep,
    takeSnapshot,
  } = options;

  const driver = createDriver(driverKind, driverOptions);
  writeHeartbeat(sessionDir);
  emitEvent(sessionDir, { type: options.resumed ? "runner.resumed" : "runner.started", data: { pid: process.pid } });
  let lastHeartbeat = Date.now();

  for (;;) {
    const state = loadState(sessionDir);
    if (isTerminal(state.state)) {
      writeHeartbeat(sessionDir);
      return state;
    }
    const { didWork } = await advanceSession({
      sessionDir,
      driver,
      repoRoot,
      runValidation,
      retryDelayMs,
      sleep,
      takeSnapshot,
    });
    if (Date.now() - lastHeartbeat >= heartbeatIntervalMs) {
      writeHeartbeat(sessionDir);
      lastHeartbeat = Date.now();
    }
    if (!didWork) {
      if (shouldStop()) return loadState(sessionDir);
      await sleepAsync(pollIntervalMs);
    }
  }
}

// ---- default canned fake-driver script (interactive dashboard demo only) ----

/**
 * A deterministic, self-consistent fake script so a session launched from the
 * real dashboard (not a test) can be driven end-to-end without any real
 * provider SDK. NOT used by tests, which supply their own scripts. The plan
 * step count here (2) matches the number of BUILDING turns this script
 * provides — see the module comment on driver/turn-index alignment.
 */
export function defaultFakeScript(packet) {
  const discovery = {
    finalText: JSON.stringify({
      problem: `Investigate: ${packet.item.text}`,
      currentBehavior: "See affected paths for current implementation.",
      proposedBehavior: "Implement the requested change per the work item text.",
      acceptanceCriteria: [{ id: "AC1", text: `"${packet.item.text}" behaves as described` }],
      affectedPaths: (packet.scopeHints && packet.scopeHints.globs) || [],
      riskFlags: [],
      openQuestions: [],
    }),
    usage: { input: 800, cachedInput: 0, output: 400, costUsd: null },
  };
  const plan = {
    finalText: JSON.stringify({
      steps: [
        { id: "S1", description: "Implement the change", paths: [], validationHint: "pnpm typecheck" },
        { id: "S2", description: "Add/adjust tests", paths: [], validationHint: "pnpm test" },
      ],
      testPlan: "Add a targeted unit test covering the acceptance criteria.",
      riskFlags: [],
      rollbackSketch: "git checkout -- <changed files>",
      noNewDeps: true,
    }),
    usage: { input: 600, cachedInput: 0, output: 500, costUsd: null },
  };
  const step1 = { finalText: "Implemented the core change per the plan.", usage: { input: 400, cachedInput: 0, output: 300, costUsd: null } };
  const step2 = { finalText: "Added a targeted unit test.", usage: { input: 400, cachedInput: 0, output: 300, costUsd: null } };
  const review = {
    finalText: JSON.stringify({ verdict: "PASS", findings: [] }),
    usage: { input: 500, cachedInput: 0, output: 200, costUsd: null },
  };
  const uat = {
    finalText: JSON.stringify({
      summary: `Delivered: ${packet.item.text}`,
      acceptanceCriteria: [{ id: "AC1", status: "met", evidence: "validation + self-review passed" }],
      manualSteps: [{ action: "Exercise the changed behavior in the running dev app", expected: "Matches the proposed behavior" }],
      deviations: [],
      followUps: [],
    }),
    usage: { input: 500, cachedInput: 0, output: 400, costUsd: null },
  };
  return { turns: [discovery, plan, step1, step2, review, uat] };
}

// ---- CLI entry point ----

function parseArgv(argv) {
  const out = { resume: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--session") out.session = argv[++i];
    else if (argv[i] === "--resume") out.resume = true;
  }
  return out;
}

async function main() {
  const args = parseArgv(process.argv.slice(2));
  if (!args.session) {
    process.stderr.write("usage: node run-session.mjs --session <id> [--resume]\n");
    process.exit(2);
  }
  const sessionDir = join(REPO_ROOT, ".delivery", "sessions", args.session);
  const packet = loadPacket(sessionDir);
  await runLoop({
    sessionDir,
    repoRoot: REPO_ROOT,
    driverKind: packet.agent,
    driverOptions: {
      sessionDir,
      forbiddenPaths: (packet.constraints && packet.constraints.forbiddenPaths) || [],
    },
    resumed: args.resume,
  });
}

const isMain = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] || "").href;
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((err) => {
    try {
      const sessionDir = join(REPO_ROOT, ".delivery", "sessions", parseArgv(process.argv.slice(2)).session || "");
      appendNdjsonLine(join(sessionDir, "runner.log"), String((err && err.stack) || err));
    } catch {
      /* best-effort logging only */
    }
    process.stderr.write(`${String((err && err.stack) || err)}\n`);
    process.exitCode = 1;
  });
}

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
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createDriver } from "./drivers/driver.mjs";
import "./drivers/fake.mjs"; // self-registers "fake"
import { TRUNCATE_LIMITS, appendEvent, formatEvent, reduceUsage, truncateField } from "./events.mjs";
import { atomicWriteJsonSync, readJsonIfExists, readTextIfExists, appendNdjsonLine } from "./fsx.mjs";
import { gitForEachRef, gitRevParseHead, gitStatusPorcelain } from "./gitread.mjs";
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

// ---- git guards (doc 4 §3) ----

function snapshotGit(repoRoot) {
  return {
    status: gitStatusPorcelain({ cwd: repoRoot }),
    head: gitRevParseHead({ cwd: repoRoot }),
    refs: gitForEachRef({ cwd: repoRoot }),
  };
}

/**
 * Compare a pre-turn git snapshot to the current state.
 * `mode: "readonly"` requires status to be byte-identical (analysis turns must
 * not edit the tree); `mode: "build"` allows tree edits but forbids any HEAD
 * or ref change (no commits/branches/checkouts, ever).
 */
function checkGitGuard(before, repoRoot, mode) {
  const after = snapshotGit(repoRoot);
  const violations = [];
  if (after.head !== before.head) violations.push("HEAD changed");
  if (after.refs !== before.refs) violations.push("refs changed");
  if (mode === "readonly" && after.status !== before.status) {
    violations.push("working tree changed during a read-only phase");
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
}) {
  const before = snapshotGit(repoRoot);
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await Promise.resolve(
        driver.runTurn(handle, prompt, {
          outputSchema,
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
      const guard = checkGitGuard(before, repoRoot, guardMode);
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

async function getHandle({ driver, state, repoRoot, mode }) {
  const ref = state.driver && state.driver.ref;
  if (ref) {
    return Promise.resolve(driver.resume(ref));
  }
  const handle = await Promise.resolve(driver.startSession({ cwd: repoRoot, mode }));
  return handle;
}

function withDriverRef(state, handle) {
  return { ...state, driver: { ...(state.driver || {}), ref: handle.ref } };
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
  const handle = await getHandle({ sessionDir, driver, state, repoRoot, mode: "readonly" });
  let working = withDriverRef(state, handle);
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
    outputSchema: true,
    repoRoot,
    guardMode: "readonly",
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
  });
  working = { ...working, messagesProcessed: lastSeq };
  if (!turn.ok) return blockFrom(sessionDir, working, "DISCOVERY", turn);

  const spec = JSON.parse(turn.finalText);
  writeArtifactJson(sessionDir, "spec.json", spec);
  writeArtifactText(sessionDir, "spec.md", renderSpecMd(spec));
  working = { ...working, usage: accumulateUsage(working, "discovery", turn.usage) };

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

  const handle = await getHandle({ sessionDir, driver, state, repoRoot, mode: "readonly" });
  let working = withDriverRef(state, handle);
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
    outputSchema: true,
    repoRoot,
    guardMode: "readonly",
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
  });
  working = { ...working, messagesProcessed: lastSeq };
  emitEvent(sessionDir, { type: "decision.consumed", phase: "SPEC_READY", data: { decision: "approve" } });
  if (!turn.ok) return { newState: blockFrom(sessionDir, working, "SPEC_READY", turn), newPacket };

  const plan = JSON.parse(turn.finalText);
  writeArtifactJson(sessionDir, "plan.json", plan);
  writeArtifactText(sessionDir, "plan.md", renderPlanMd(plan));
  working = { ...working, usage: accumulateUsage(working, "plan", turn.usage) };

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
  const handle = await getHandle({ sessionDir, driver, state, repoRoot, mode: "build" });
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
  const handle = await getHandle({ sessionDir, driver, state, repoRoot, mode: "readonly" });
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
  const uatHandle = await getHandle({ sessionDir, driver, state: working, repoRoot, mode: "readonly" });
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

function consumeAcceptedDecision({ sessionDir, state, decision, repoRoot }) {
  const result = smNext(state.state, "decision.shipped");
  const shippedHead = gitRevParseHead({ cwd: repoRoot });
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
 *   retryDelayMs?:number, sleep?:Function}} options
 */
export async function advanceSession(options) {
  const { sessionDir, driver, repoRoot } = options;
  const config = {
    repoRoot,
    runValidation: options.runValidation,
    retryDelayMs: options.retryDelayMs != null ? options.retryDelayMs : 30000,
    sleep: options.sleep || defaultSleep,
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
        newState = consumeAcceptedDecision({ sessionDir, state, decision, repoRoot });
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
 *   shouldStop?:Function, retryDelayMs?:number, sleep?:Function}} options
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
    const { didWork } = await advanceSession({ sessionDir, driver, repoRoot, runValidation, retryDelayMs, sleep });
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
    console.error("usage: node run-session.mjs --session <id> [--resume]");
    process.exit(2);
  }
  const sessionDir = join(REPO_ROOT, ".delivery", "sessions", args.session);
  const packet = loadPacket(sessionDir);
  await runLoop({
    sessionDir,
    repoRoot: REPO_ROOT,
    driverKind: "fake",
    driverOptions: { script: defaultFakeScript(packet), sessionId: args.session },
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
    console.error(err);
    process.exitCode = 1;
  });
}

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

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DriverAbortedError, createDriver as createDriverDefault, readObservedUsage } from "./drivers/driver.mjs";
import "./drivers/fake.mjs"; // self-registers "fake"
import "./drivers/codex.mjs"; // self-registers; SDK import remains lazy
import "./drivers/claude.mjs"; // self-registers; SDK import remains lazy
// D12/DLV-17: pure, SDK-free (the driver's dynamic-import discipline for the
// real SDK is unaffected -- this only touches the local ~/.claude/projects/
// filesystem convention, never the SDK itself).
import { computeRawTranscriptPointer } from "./drivers/claude.mjs";
import { EventsError, TRUNCATE_LIMITS, formatEvent, nextSeq, parseEvents, truncateField } from "./events.mjs";
import { atomicWriteJsonSync, readJsonIfExists, readTextIfExists, appendNdjsonLine } from "./fsx.mjs";
import { gitDiff, gitForEachRef, gitRevParseHead, gitStatusPorcelain } from "./gitread.mjs";
import { applyCapabilityDrops } from "./classify.mjs";
import {
  ACTIVE_STATES,
  GATES,
  StateMachineError,
  isTerminal,
  next as smNext,
} from "./state-machine.mjs";
import {
  BLOCKING_QUESTION_MARKER,
  buildBuildingPrompt,
  buildDiscoveryPrompt,
  buildHandoffVerificationPrompt,
  buildPlanPrompt,
  buildSelfReviewPrompt,
  buildUatPrompt,
} from "./prompts.mjs";
import {
  DEFAULT_MAX_RECORD_BYTES,
  buildCrashSealEntry,
  buildRecord,
  buildTurnEntry,
  findMissingTurnIds,
  findOrphanedTurnIds,
  formatRecord,
  formatTurnEntry,
  formatTurnId,
  parseTurnRecords,
  parseTurns,
  roleForPhase,
  turnPromptFileName,
  turnShardFileName,
} from "./transcript.mjs";
import { addUsageV2, computeOccupancy, emptyUsageV2, estimateCostUsd } from "./usage.mjs";
import { classifyTurnError } from "./quota.mjs";
import {
  classifyChangeOwnership,
  classifyValidationFailure,
  countValidationFailures,
} from "./validation-baseline.mjs";
import {
  checkSessionBudget,
  isDiscoveryTurnLimitReached,
  isPlanStepCountOverCap,
  legacyBudgetEnvelope,
  raiseBudgetEnvelope,
} from "./budgets.mjs";
import { getConfigStatus, getDefaultModel, getModelInfo, getModelPricing, loadConfig, translateEffort } from "./config.mjs";
import { isProviderSwitch } from "./controls.mjs";
import {
  applyAnswer,
  applyConfigChange,
  applyDecision,
  applyPlan,
  applyQuestionRaised,
  applySpec,
  emptyLedger,
} from "./memory.mjs";
import { buildContextPackage, buildMechanicalDigest, estimateTokens } from "./context-assembly.mjs";
import { decideContextStrategy } from "./context-policy.mjs";
import {
  buildScopeLock,
  buildScopeVerdict,
  normalizeDecomposition,
  normalizeScopeEstimate,
  pathsOutsideScope,
} from "./scope.mjs";
import { reassessFitAfterDiscovery } from "./recommendation.mjs";
import { buildFinishPackage } from "./finish-package.mjs";
import { applyContextBudget, boundReplayedOutput, buildContextManifest, tokensForBytes } from "./context-budget.mjs";
import {
  initAcceptance,
  isAcceptanceComplete,
  reconcileAcceptance,
  renderAcceptanceMd,
  summarizeAcceptance,
  unsatisfiedAcceptance,
  waiveAcceptance,
} from "./acceptance.mjs";

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
    crashMarker: join(sessionDir, "runner-crash.json"),
    decisions: join(sessionDir, "decisions"),
    messages: join(sessionDir, "messages"),
    artifacts: join(sessionDir, "artifacts"),
    uat: join(sessionDir, "artifacts", "uat"),
    controls: join(sessionDir, "controls"),
    memoryLedger: join(sessionDir, "memory", "ledger.json"),
    memoryHistory: join(sessionDir, "memory", "history"),
    contextSnapshots: join(sessionDir, "context", "snapshots"),
    contextCompactions: join(sessionDir, "context", "compactions"),
    handoffs: join(sessionDir, "handoffs"),
    transcript: join(sessionDir, "transcript"),
    transcriptPrompts: join(sessionDir, "transcript", "prompts"),
    turns: join(sessionDir, "transcript", "turns.ndjson"),
  };
}

const STARTUP_CRASH_WINDOW_MS = 60_000;
const STARTUP_CRASH_LIMIT = 3;
const STARTUP_CRASH_BACKOFF_MS = 60_000;

/**
 * Record a runner failure that happened before the loop could contain it.
 * Identical rapid failures are counted in an atomic marker so independent
 * detached processes cannot endlessly re-crash a session.
 */
export function recordStartupCrash(sessionDir, err, { now = () => new Date() } = {}) {
  const p = sessionPaths(sessionDir);
  const at = now().toISOString();
  const message = String((err && err.message) || err);
  const fingerprint = createHash("sha256").update(message).digest("hex");
  const previous = readJsonIfExists(p.crashMarker) || {};
  const cutoff = now().getTime() - STARTUP_CRASH_WINDOW_MS;
  const timestamps = previous.fingerprint === fingerprint
    ? (previous.timestamps || []).filter((ts) => new Date(ts).getTime() >= cutoff)
    : [];
  timestamps.push(at);
  const tripped = timestamps.length >= STARTUP_CRASH_LIMIT;
  const marker = {
    fingerprint,
    timestamps,
    lastMessage: truncateField(message, TRUNCATE_LIMITS.message),
    retryAfter: tripped ? new Date(now().getTime() + STARTUP_CRASH_BACKOFF_MS).toISOString() : null,
  };
  atomicWriteJsonSync(p.crashMarker, marker);
  if (!tripped) return { tripped: false, marker };

  try {
    const state = loadState(sessionDir);
    if (ACTIVE_STATES.includes(state.state)) {
      const result = smNext(state.state, "error.fatal");
      persistState(sessionDir, {
        ...state,
        state: result.to,
        awaiting: { gate: "blocked", reason: "runner-crash", returnTo: state.state },
        lastError: {
          phase: state.state,
          errorKind: "runner-crash",
          message: `Runner startup crashed ${timestamps.length} times with the same error. Automatic restarts are paused until ${marker.retryAfter}. ${message}`,
        },
      });
      emitEvent(sessionDir, { type: "runner.crash-loop", phase: state.state, data: { count: timestamps.length, retryAfter: marker.retryAfter } });
    }
  } catch {
    // The marker is still useful even when the packet/state itself is damaged.
  }
  return { tripped: true, marker };
}

export function getStartupCrashBackoff(sessionDir, { now = () => new Date() } = {}) {
  const marker = readJsonIfExists(sessionPaths(sessionDir).crashMarker);
  if (!marker || !marker.retryAfter || new Date(marker.retryAfter).getTime() <= now().getTime()) return null;
  return marker;
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

// In-memory last-used-seq cache, keyed by sessionDir. `emitEvent` used to
// reparse the entire events.ndjson on every append (O(n²) over a session's
// lifetime) purely to compute the next seq number. Since this process is the
// sole writer of events.ndjson for a given session (single-writer discipline,
// doc 2 §4), the cache only ever needs to be seeded once per process — a
// crashed/resumed runner is a fresh process anyway, so the first call after
// `--resume` correctly reseeds from disk.
const eventSeqCache = new Map();

function nextEventSeq(sessionDir, eventsPath) {
  if (!eventSeqCache.has(sessionDir)) {
    const current = readTextIfExists(eventsPath) || "";
    eventSeqCache.set(sessionDir, nextSeq(parseEvents(current)) - 1);
  }
  const seq = eventSeqCache.get(sessionDir) + 1;
  eventSeqCache.set(sessionDir, seq);
  return seq;
}

export function emitEvent(sessionDir, partial) {
  const p = sessionPaths(sessionDir);
  if (!partial || !partial.type) {
    throw new EventsError("event.type is required");
  }
  const event = {
    ts: partial.ts || new Date().toISOString(),
    seq: nextEventSeq(sessionDir, p.events),
    type: partial.type,
    phase: partial.phase != null ? partial.phase : null,
    agent: partial.agent != null ? partial.agent : null,
    data: partial.data != null ? partial.data : {},
  };
  appendNdjsonLine(p.events, formatEvent(event));
  return event;
}

function listSeqFiles(dirPath) {
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath)
    .filter((n) => /^\d+.*\.json$/.test(n))
    .sort();
}

/** Next 1-based seq for a numbered-file directory (context/snapshots, context/compactions). */
function nextFileSeq(dirPath) {
  const names = listSeqFiles(dirPath);
  if (!names.length) return 1;
  const nums = names.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
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

/** Unread owner controls (seq > state.controlsProcessed), in seq order (DW-4). */
export function pendingControls(sessionDir, controlsProcessed) {
  const p = sessionPaths(sessionDir);
  return listSeqFiles(p.controls)
    .map((name) => readJsonIfExists(join(p.controls, name)))
    .filter((c) => c && typeof c.seq === "number" && c.seq > (controlsProcessed || 0))
    .sort((a, b) => a.seq - b.seq);
}

/** `state.execution` seeded from the packet — created lazily the first time a control needs it. */
function defaultExecution(packet) {
  return {
    provider: packet.agent,
    model: (packet.agentConfig && packet.agentConfig.model) || null,
    effortByPhase: { ...((packet.agentConfig && packet.agentConfig.effort) || {}) },
    paused: false,
    pauseRequestedAt: null,
    pendingConfig: null,
    configChangedSinceLastTurn: false,
  };
}

/**
 * Apply one control's effect to `state.execution`. `set-config` with a
 * provider change is a handoff (DW-8) — this DW-4 baseline only handles the
 * same-provider case (model/effort override); a provider-switch control is
 * parked in `execution.pendingConfig` until DW-8 lands, so the intent isn't
 * silently dropped even though nothing yet acts on it.
 */
function applyControl(state, packet, control) {
  const execution = state.execution || defaultExecution(packet);
  if (control.type === "pause") {
    return { ...state, execution: { ...execution, paused: true, pauseRequestedAt: control.at } };
  }
  if (control.type === "resume-run") {
    return { ...state, execution: { ...execution, paused: false, pauseRequestedAt: null } };
  }
  if (control.type === "set-config") {
    if (isProviderSwitch(control, execution.provider)) {
      return { ...state, execution: { ...execution, pendingConfig: control.payload } };
    }
    const payload = control.payload || {};
    const nextExecution = { ...execution, configChangedSinceLastTurn: true };
    if (payload.model !== undefined) nextExecution.model = payload.model;
    if (payload.effortByPhase) nextExecution.effortByPhase = { ...execution.effortByPhase, ...payload.effortByPhase };
    return { ...state, execution: nextExecution };
  }
  if (control.type === "set-budget") {
    const current = (state.budget && state.budget.current) || packet.budget;
    const raised = raiseBudgetEnvelope(current, control.payload);
    const phase = String(state.state || "").toLowerCase();
    const verdict = checkSessionBudget((state.usage && state.usage.total) || {}, raised, {
      phase,
      phaseUsage: state.usage && state.usage.perPhase && state.usage.perPhase[phase],
    });
    const canResume = verdict.status !== "exceeded";
    return {
      ...state,
      budget: {
        ...(state.budget || {}),
        current: raised,
        warned: [],
        exhaustedAt: canResume ? null : (state.budget && state.budget.exhaustedAt) || null,
      },
      execution: { ...execution, paused: canResume ? false : execution.paused },
      // DLV-29: restore whatever gate the budget pause interrupted (if any)
      // instead of dropping it — see the comment at the budget-exhausted
      // `awaiting` assignment above.
      awaiting:
        canResume && state.awaiting && state.awaiting.reason === "budget-exhausted"
          ? state.awaiting.priorAwaiting || null
          : state.awaiting,
    };
  }
  // rotate/fork/pin/unpin/answer/ask: schema-validated by controls.mjs already;
  // runner-side consumption ships in DW-5 (answer/ask), DW-7 (rotate/pin/unpin),
  // DW-9 (fork). Advancing the cursor here without a state effect means they
  // won't be silently reprocessed once their consumers land.
  return { ...state, execution };
}

/**
 * Drain every pending control in one pass, applying each to `state.execution`
 * in order and emitting a curated event per control. Mirrors the
 * decisions/messages numbered-file pattern: nothing here touches the
 * filesystem beyond `emitEvent` — the caller persists the returned state.
 */
// ---- memory ledger (DW-5): durable requirements/decisions/Q&A, versioned ----

function loadLedger(sessionDir) {
  return readJsonIfExists(sessionPaths(sessionDir).memoryLedger) || emptyLedger();
}

/** Atomic write + version the prior ledger to memory/history/ledger-VVVV.json first. */
function writeLedger(sessionDir, nextLedger) {
  const p = sessionPaths(sessionDir);
  const prior = readJsonIfExists(p.memoryLedger);
  if (prior) {
    atomicWriteJsonSync(join(p.memoryHistory, `ledger-${String(prior.rev).padStart(4, "0")}.json`), prior);
  }
  atomicWriteJsonSync(p.memoryLedger, nextLedger);
}

/** Load, apply a pure memory.mjs updater, and persist (versioning the prior rev). Returns the new ledger. */
function updateLedger(sessionDir, updater) {
  const next = updater(loadLedger(sessionDir));
  writeLedger(sessionDir, next);
  return next;
}

async function drainControls(sessionDir, state, packet, runCtx) {
  const pending = pendingControls(sessionDir, state.controlsProcessed || 0);
  if (!pending.length) return { didWork: false, state };
  let working = state;
  for (const control of pending) {
    const before = working.execution || defaultExecution(packet);
    working = applyControl(working, packet, control);
    working = { ...working, controlsProcessed: control.seq };
    if (control.type === "pause") {
      emitEvent(sessionDir, { type: "execution.paused", data: { at: control.at, abortInFlight: !!control.payload.abortInFlight } });
    } else if (control.type === "resume-run") {
      emitEvent(sessionDir, { type: "execution.resumed", data: {} });
    } else if (control.type === "set-config") {
      if (isProviderSwitch(control, before.provider)) {
        emitEvent(sessionDir, { type: "handoff.started", data: { from: before.provider, to: control.payload.provider } });
        working = await performHandoff(sessionDir, working, packet, control.payload, runCtx);
      } else {
        updateLedger(sessionDir, (ledger) =>
          applyConfigChange(ledger, {
            from: { model: before.model, effortByPhase: before.effortByPhase },
            to: { model: working.execution.model, effortByPhase: working.execution.effortByPhase },
            via: `controls:${control.seq}`,
          }),
        );
        emitEvent(sessionDir, {
          type: "config.changed",
          data: {
            from: { model: before.model, effortByPhase: before.effortByPhase },
            to: { model: working.execution.model, effortByPhase: working.execution.effortByPhase },
          },
        });
      }
    } else if (control.type === "set-budget") {
      emitEvent(sessionDir, {
        type: "budget.raised",
        phase: working.state,
        data: {
          controlSeq: control.seq,
          to: working.budget.current,
          reason: control.payload.reason,
        },
      });
    } else if (control.type === "answer") {
      try {
        updateLedger(sessionDir, (ledger) =>
          applyAnswer(ledger, { questionId: control.payload.questionId, text: control.payload.text, via: `controls:${control.seq}` }),
        );
        emitEvent(sessionDir, { type: "question.answered", data: { questionId: control.payload.questionId } });
      } catch (err) {
        emitEvent(sessionDir, { type: "control.rejected", data: { type: "answer", reason: String((err && err.message) || err) } });
      }
    } else if (control.type === "ask") {
      const id = `q-owner-${control.seq}`;
      updateLedger(sessionDir, (ledger) =>
        applyQuestionRaised(ledger, { id, source: "owner", text: control.payload.text, kind: "advisory" }),
      );
      emitEvent(sessionDir, { type: "question.raised", data: { id, text: control.payload.text, kind: "advisory", source: "owner" } });
    } else if (control.type === "rotate") {
      working = performRotation(sessionDir, working, packet, "rotate");
    } else if (control.type === "pin") {
      const p = sessionPaths(sessionDir);
      const shardPath = join(p.transcript, turnShardFileName(control.payload.turnId));
      const records = parseTurnRecords(readTextIfExists(shardPath) || "");
      const text = records
        .filter((r) => r.seq >= control.payload.seqFrom && r.seq <= control.payload.seqTo)
        .map((r) => r.text || r.output || "")
        .filter(Boolean)
        .join("\n");
      const pins = [
        ...((working.context && working.context.pins) || []),
        { turnId: control.payload.turnId, seqFrom: control.payload.seqFrom, seqTo: control.payload.seqTo, note: control.payload.note || null, text },
      ];
      working = { ...working, context: { ...(working.context || {}), pins } };
      emitEvent(sessionDir, { type: "context.pinned", data: { turnId: control.payload.turnId, seqFrom: control.payload.seqFrom, seqTo: control.payload.seqTo } });
    } else if (control.type === "unpin") {
      const pins = ((working.context && working.context.pins) || []).filter((pin) => pin.turnId !== control.payload.turnId);
      working = { ...working, context: { ...(working.context || {}), pins } };
      emitEvent(sessionDir, { type: "context.unpinned", data: { turnId: control.payload.turnId } });
    } else if (control.type === "fork") {
      working = performFork(sessionDir, working, packet, control.payload);
    }
  }
  return { didWork: true, state: working };
}

/**
 * Rotation (DW-7): mechanical digest of the current phase's turns + a
 * context-package snapshot, then archive the driver ref so the next
 * `getHandle` call starts a fresh provider session. Shared by the owner
 * `rotate` control and (future) automatic threshold-based rotation.
 */
function performRotation(sessionDir, state, packet, reason) {
  const p = sessionPaths(sessionDir);
  const allTurns = parseTurns(readTextIfExists(p.turns) || "");
  // `state.state` is frequently a gate ("SPEC_READY") one step past the
  // phase whose turns we're digesting ("DISCOVERY") — digest the phase the
  // most recent turn actually ran in, not the current state-machine state.
  const digestPhase = allTurns.length ? allTurns[allTurns.length - 1].phase : state.state;
  const currentPhaseTurns = allTurns.filter((t) => t.phase === digestPhase);
  const digestMd = buildMechanicalDigest({ phase: digestPhase, turns: currentPhaseTurns });

  const compactionSeq = nextFileSeq(p.contextCompactions);
  const compaction = {
    v: 1,
    seq: compactionSeq,
    at: new Date().toISOString(),
    scope: { phase: digestPhase },
    covers: { turns: currentPhaseTurns.map((t) => t.turnId), eventSeq: [] },
    mode: "mechanical",
    summaryMd: digestMd,
    evidence: currentPhaseTurns.map((t) => ({ claim: `turn ${t.turnId} ${t.result}`, turnId: t.turnId, seq: null })),
  };
  atomicWriteJsonSync(join(p.contextCompactions, `${String(compactionSeq).padStart(4, "0")}.json`), compaction);

  const ledger = loadLedger(sessionDir);
  const pkg = buildContextPackage({
    packet,
    ledger,
    digests: [{ summaryMd: digestMd }],
    pins: (state.context && state.context.pins) || [],
    nextAction: `Continue phase ${state.state}.`,
  });
  const snapshotSeq = nextFileSeq(p.contextSnapshots);
  const snapshot = {
    v: 1,
    seq: snapshotSeq,
    at: new Date().toISOString(),
    reason,
    layers: pkg.layers.map((l) => ({ name: l.name, source: l.source, tokensEst: l.tokensEst })),
    renderedMd: pkg.renderedMd,
    tokensEstTotal: pkg.tokenEstimate,
    pins: (state.context && state.context.pins) || [],
    forStrategy: "rotate-fresh",
    provider: (state.execution && state.execution.provider) || packet.agent,
    model: (state.execution && state.execution.model) || null,
  };
  atomicWriteJsonSync(join(p.contextSnapshots, `${String(snapshotSeq).padStart(4, "0")}.json`), snapshot);

  const priorRef = state.driver && state.driver.ref;
  const priorRefs = (state.driver && state.driver.priorRefs) || [];
  const nextState = {
    ...state,
    driver: {
      ...(state.driver || {}),
      ref: null,
      priorRefs: priorRef ? [...priorRefs, { ref: priorRef, retiredAt: new Date().toISOString(), reason }] : priorRefs,
    },
    context: {
      ...(state.context || {}),
      rotations: ((state.context && state.context.rotations) || 0) + 1,
      lastSnapshotSeq: snapshotSeq,
      lastCompactionSeq: compactionSeq,
    },
  };
  emitEvent(sessionDir, {
    type: "context.rotated",
    data: { reason, compactionSeq, snapshotSeq, tokensEstAfterRotation: pkg.tokenEstimate },
  });
  return nextState;
}

/**
 * DLV-30: evaluate `decideContextStrategy` at this phase's turn boundary and
 * rotate if it says to — the piece that was missing since `context-policy.mjs`
 * shipped: the module was imported by nothing but its own unit test, so
 * `config.context.rotateAtTokens` was dead code and one SDK session spanned
 * every phase of a delivery run, paying an ever-growing prefix on every turn
 * (Cost Anatomy §5: "the REVIEWING turn alone read 870,008 cached tokens").
 *
 * Called once per phase-producing handler, before that handler's own
 * `getHandle`/`getGuardedHandle` call, so a rotation's `ref: null` is already
 * in the state that call sees (mirrors how the owner `rotate` control already
 * works — `performRotation` archives the ref, `getHandle` starts fresh next
 * time, `D2`'s `driver.reset()` fix lets the same driver instance survive it).
 *
 * `isPhaseBoundary` is true only on the FIRST turn of a phase — `phase` here
 * uses the same canonical keys as `accumulateUsage`'s (discovery/plan/
 * building/reviewing/uat), so a BUILDING step 2+ or a fix-loop re-entry that
 * lands back in the *same* phase is correctly NOT a boundary (rotating away
 * mid-plan-execution or mid-fix would lose the context the agent needs to
 * finish what it's doing). Every evaluation — including "no rotation needed"
 * — is emitted as `context.strategy`, so the decision is auditable even when
 * it's a no-op.
 *
 * `forkAfterPhaseRetries`'s `suggested: true` verdict is deliberately NOT
 * auto-acted on here — see the comment at its use below.
 */
function maybeRotateAtPhaseBoundary({ sessionDir, state, packet, deliveryConfig, phase }) {
  const hasRef = !!(state.driver && state.driver.ref);
  const contextConfig = (deliveryConfig && deliveryConfig.context) || {};
  const lastPhase = state.context && state.context.lastTurnPhase;
  const isPhaseBoundary = hasRef && lastPhase != null && lastPhase !== phase;
  const decision = decideContextStrategy({
    hasEstablishedRef: hasRef,
    isPhaseBoundary,
    occupancyTokens: (state.context && state.context.lastOccupancyTokens) || 0,
    windowTokens: (state.context && state.context.lastWindowTokens) || null,
    rotateAtTokens: typeof contextConfig.rotateAtTokens === "number" ? contextConfig.rotateAtTokens : null,
    hardCeilingPct: typeof contextConfig.hardCeilingPct === "number" ? contextConfig.hardCeilingPct : null,
    sameStateReentryCount: state.fixLoop || 0,
    forkAfterPhaseRetries: typeof contextConfig.forkAfterPhaseRetries === "number" ? contextConfig.forkAfterPhaseRetries : null,
  });
  emitEvent(sessionDir, {
    type: "context.strategy",
    phase: phase.toUpperCase(),
    data: { strategy: decision.strategy, reasons: decision.reasons, suggested: !!decision.suggested, isPhaseBoundary },
  });
  if (decision.strategy !== "rotate-fresh" || !hasRef) return state;
  // The fork-after-retries branch is advisory ("suggested"), not a command —
  // auto-rotating out from under a session that's stuck for a reason
  // rotation won't fix (e.g. a genuinely hard bug, not a poisoned context)
  // would silently discard the very history an owner needs to diagnose it.
  // Leave it to a future owner-facing surface (DLV-9-adjacent), not this fix.
  if (decision.suggested) return state;
  return performRotation(sessionDir, state, packet, "auto-phase-boundary");
}

/** Update `state.context`'s rotation-decision inputs after a turn is sealed — see `maybeRotateAtPhaseBoundary`. */
function withContextOccupancy(state, phase, usageV2, windowTokens) {
  const occupancy = computeOccupancy(usageV2, windowTokens);
  return {
    ...state,
    context: {
      ...(state.context || {}),
      lastTurnPhase: phase,
      lastOccupancyTokens: occupancy.occupancyTokens,
      lastWindowTokens: windowTokens,
    },
  };
}

/**
 * Provider handoff (DW-8): rotate (digest + snapshot + archive the old ref,
 * reusing `performRotation`), start a fresh session on the new provider, and
 * run a schema-validated verification turn before letting the phase
 * continue. A malformed response or any reported gap becomes a blocking
 * question rather than silently continuing — see doc/plan "handoff
 * verification" flow. Effort is translated via `config.effortMap` when the
 * owner didn't specify explicit per-phase overrides.
 */
async function performHandoff(sessionDir, state, packet, payload, ctx) {
  const { repoRoot, deliveryConfig, retryDelayMs, sleep, takeSnapshot, abortPollMs, createDriver = createDriverDefault, providerDriverCache = null } = ctx;
  const fromProvider = (state.execution && state.execution.provider) || packet.agent;
  const toProvider = payload.provider;

  let working = performRotation(sessionDir, state, packet, "handoff");

  const toModel = payload.model !== undefined ? payload.model : getDefaultModel(deliveryConfig, toProvider);
  const fromEffortByPhase = (working.execution && working.execution.effortByPhase) || {};
  const toEffortByPhase =
    payload.effortByPhase ||
    Object.fromEntries(
      Object.entries(fromEffortByPhase).map(([phase, effort]) => [phase, translateEffort(deliveryConfig, fromProvider, toProvider, effort)]),
    );

  let newDriver;
  let handle;
  try {
    // DLV-34: the instance built here is the one that owns the ref this handoff
    // is about to write into `state.driver.ref`, so it must (a) be built with
    // the same guard options every other provider driver gets — it was created
    // bare, silently dropping `forbiddenPaths` and the `sessionDir` the claude
    // driver needs for raw-transcript linkage — and (b) be published into the
    // runner's per-provider cache, so the *next* tick resumes the new ref on
    // this same instance instead of on the outgoing provider's driver.
    newDriver = createDriver(toProvider, providerDriverOptions(packet, sessionDir));
    handle = await Promise.resolve(newDriver.startSession({ cwd: repoRoot, mode: "readonly", model: toModel, effort: "low" }));
  } catch (err) {
    emitEvent(sessionDir, { type: "handoff.failed", data: { from: fromProvider, to: toProvider, message: String((err && err.message) || err) } });
    return blockFrom(sessionDir, working, working.state, { error: err });
  }

  const ledger = loadLedger(sessionDir);
  const pkg = buildContextPackage({
    packet,
    ledger,
    pins: (working.context && working.context.pins) || [],
    nextAction: `Continue phase ${working.state}.`,
  });
  const prompt = buildHandoffVerificationPrompt({ packet, contextPackageMd: pkg.renderedMd, fromProvider, toProvider });
  const turnId = formatTurnId((working.turnCounter || 0) + 1);

  const turn = await runGuardedTurn({
    sessionDir,
    driver: newDriver,
    handle,
    prompt,
    phase: "HANDOFF",
    agent: "orchestrator",
    outputSchema: HANDOFF_VERIFICATION_SCHEMA,
    repoRoot,
    guardMode: "readonly",
    takeSnapshot,
    forbiddenPaths: (packet.constraints && packet.constraints.forbiddenPaths) || [],
    effort: "low",
    retryDelayMs,
    sleep,
    abortPollMs,
    controlsProcessed: working.controlsProcessed || 0,
    turnId,
    provider: toProvider,
    model: toModel,
    strategy: "handoff",
    ...errorRetryOptions(deliveryConfig),
  });
  working = { ...working, turnCounter: (working.turnCounter || 0) + 1 };

  if (!turn.ok) {
    emitEvent(sessionDir, { type: "handoff.failed", data: { from: fromProvider, to: toProvider } });
    return blockFrom(sessionDir, working, working.state, turn);
  }

  let verification = null;
  try {
    verification = JSON.parse(turn.finalText);
  } catch {
    verification = null;
  }
  const gaps = (verification && verification.gaps) || [];
  const hasCriticalGaps = !verification || gaps.length > 0;

  const handoffSeq = nextFileSeq(sessionPaths(sessionDir).handoffs);
  const handoffRecord = {
    v: 1,
    seq: handoffSeq,
    at: new Date().toISOString(),
    from: { provider: fromProvider, model: (state.execution && state.execution.model) || null, ref: (state.driver && state.driver.ref) || null },
    to: { provider: toProvider, model: toModel },
    snapshotRef: `context/snapshots/${String(working.context.lastSnapshotSeq).padStart(4, "0")}.json`,
    verification: {
      ok: !hasCriticalGaps,
      understandingSummary: (verification && verification.understandingSummary) || null,
      gaps,
      usage: turn.usageV2 || null,
    },
    outcome: hasCriticalGaps ? "paused" : "continued",
  };
  atomicWriteJsonSync(join(sessionPaths(sessionDir).handoffs, `${String(handoffSeq).padStart(4, "0")}.json`), handoffRecord);

  // DLV-34: the provider switch is now real, so the instance that owns
  // `handle.ref` becomes the runner's driver for `toProvider`. Published only
  // on this path — a handoff that failed before here leaves `execution.provider`
  // untouched, so caching its half-built driver would be caching a provider the
  // session never actually moved to.
  if (providerDriverCache) providerDriverCache.set(toProvider, newDriver);

  working = {
    ...working,
    driver: { ...working.driver, ref: handle.ref },
    execution: { ...working.execution, provider: toProvider, model: toModel, effortByPhase: toEffortByPhase, pendingConfig: null },
  };

  if (hasCriticalGaps) {
    emitEvent(sessionDir, { type: "handoff.gaps", data: { gaps, seq: handoffSeq } });
    if (!ACTIVE_STATES.includes(working.state)) {
      // Session is already gated/blocked — the gaps are visible in the
      // handoff record and timeline; don't force a second, conflicting gate.
      return working;
    }
    const result = smNext(working.state, "question.raised");
    return {
      ...working,
      state: result.to,
      awaiting: {
        gate: "question",
        returnTo: working.state,
        questions: [{
          id: `q-handoff-${handoffSeq}`,
          text: gaps.length
            ? `Provider handoff to ${toProvider} found gaps: ${gaps.join("; ")}. Continue anyway?`
            : `Provider handoff to ${toProvider} produced a malformed verification response. Continue anyway?`,
        }],
      },
    };
  }

  emitEvent(sessionDir, { type: "handoff.completed", data: { from: fromProvider, to: toProvider, seq: handoffSeq } });
  return working;
}

/**
 * Fork (DW-9): branch a new, independent session from the current checkpoint
 * — a sibling directory under `.delivery/sessions/`, not a mutation of this
 * one. Copies the durable record (packet identity + ledger + artifacts) and
 * starts the child at the same state/awaiting the parent is at now; the
 * child's own transcript/events start empty (artifact-first: the ledger +
 * artifact paths are what it needs, not a pasted history). The parent is
 * paused so both lineages never advance the same work item's git state at
 * once. Starting the child's runner is the existing `/api/delivery/resume`
 * path (its `runner.json` doesn't exist yet, so it reads as "stale" and
 * offers Resume) — forking never spawns a process itself.
 */
function performFork(sessionDir, state, packet, payload) {
  const parentSessionId = packet.sessionId;
  const forkIndex = ((state.forks && state.forks.length) || 0) + 1;
  const forkSessionId = `${parentSessionId}-f${forkIndex}`;
  const forkDir = join(dirname(sessionDir), forkSessionId);
  const now = new Date().toISOString();

  mkdirSync(forkDir, { recursive: true });

  const forkPacket = {
    ...packet,
    sessionId: forkSessionId,
    parentSession: parentSessionId,
    forkedFrom: { sessionId: parentSessionId, atTurnId: payload.atTurnId || null, at: now },
  };
  atomicWriteJsonSync(join(forkDir, "packet.json"), forkPacket);

  const parentArtifacts = sessionPaths(sessionDir).artifacts;
  if (existsSync(parentArtifacts)) {
    cpSync(parentArtifacts, join(forkDir, "artifacts"), { recursive: true });
  }

  const ledger = loadLedger(sessionDir);
  if (ledger.rev > 0) {
    atomicWriteJsonSync(join(forkDir, "memory", "ledger.json"), ledger);
  }

  const forkState = {
    schemaVersion: 2,
    sessionId: forkSessionId,
    state: state.state,
    awaiting: state.awaiting,
    phaseHistory: [{ state: state.state, enteredAt: now, exitedAt: null }],
    agent: (state.execution && state.execution.provider) || packet.agent,
    driver: { ref: null, specialists: {}, priorRefs: [] },
    workspace: state.workspace,
    build: state.build,
    fixLoop: state.fixLoop || 0,
    usage: { perPhase: {}, total: emptyUsageV2() },
    turnCounter: 0,
    decisionsProcessed: 0,
    messagesProcessed: 0,
    controlsProcessed: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    parentSession: parentSessionId,
    execution: state.execution ? { ...state.execution, paused: false, pauseRequestedAt: null, pendingConfig: null } : undefined,
    context: { pins: (state.context && state.context.pins) || [], rotations: 0 },
  };
  atomicWriteJsonSync(join(forkDir, "state.json"), forkState);
  emitEvent(forkDir, { type: "fork.created", phase: state.state, data: { parentSession: parentSessionId } });

  emitEvent(sessionDir, { type: "fork.completed", data: { forkSessionId } });
  return {
    ...state,
    execution: { ...(state.execution || defaultExecution(packet)), paused: true, pauseRequestedAt: now },
    forks: [...(state.forks || []), forkSessionId],
  };
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

function effectiveBudgetEnvelope(packet, state, deliveryConfig) {
  if (state.budget && state.budget.current) return state.budget.current;
  if (packet.budget) return packet.budget;
  return legacyBudgetEnvelope((deliveryConfig && deliveryConfig.budgets) || {});
}

/**
 * DLV-12: write `artifacts/finish/` for this exit. Invoked from EVERY path that
 * lands the session in a terminal, blocked, or paused state — that exhaustiveness
 * is the point, because the exits nobody instrumented are exactly the ones that
 * left BUD-11's true result buried in a build log.
 *
 * Never throws: a finish package that fails to write must not turn a graceful
 * pause into a crash. The exit itself is what matters; this is its record.
 */
function writeFinishPackage(sessionDir, state, packet, reason) {
  try {
    const pkg = buildFinishPackage({
      state,
      packet,
      reason,
      spec: readJsonIfExists(artifactPath(sessionDir, "spec.json")),
      plan: readJsonIfExists(artifactPath(sessionDir, "plan.json")),
      validation: readJsonIfExists(artifactPath(sessionDir, "validation.json")),
      review: readJsonIfExists(artifactPath(sessionDir, "review-self.json")),
    });
    for (const file of pkg.files) {
      if (file.json !== undefined) writeArtifactJson(sessionDir, join("finish", file.name), file.json);
      else writeArtifactText(sessionDir, join("finish", file.name), file.text);
    }
    // Deliberately NOT a `notification.requested`. Every exit that reaches
    // here already emits its own notification for the state change that caused
    // it (budget.exhausted, the retry/max-turns escalation, and so on), and a
    // second "your finish package is ready" for the same event is exactly the
    // duplicate DLV-16's contract rules out ("exactly one notification per
    // state change"). Those notifications carry the finish-package pointer
    // instead. Owner-initiated terminal exits (Accept, Cancel) notify nobody
    // by design — the owner just performed the action.
    emitEvent(sessionDir, { type: "finish.package.written", phase: state.state, data: pkg.summary });
    return pkg.summary;
  } catch (err) {
    try {
      emitEvent(sessionDir, {
        type: "finish.package.failed",
        phase: state.state,
        data: { message: truncateField(String((err && err.message) || err), TRUNCATE_LIMITS.message) },
      });
    } catch {
      /* best-effort only */
    }
    return null;
  }
}

function writeBudgetFinishPackage(sessionDir, state, envelope, verdict, at) {
  const snapshot = {
    schemaVersion: 1,
    reason: "budget-exhausted",
    at,
    phase: state.state,
    envelope,
    usage: state.usage || { perPhase: {}, total: {} },
    verdict,
    changedFiles: (state.workspace && state.workspace.changedFiles) || [],
    nextAction: "Raise the authorized cap with a reason, or cancel the session.",
  };
  writeArtifactJson(sessionDir, join("finish", "budget.json"), snapshot);
  writeArtifactText(
    sessionDir,
    join("finish", "summary.md"),
    [
      "# Session paused â€” budget exhausted",
      "",
      verdict.reason,
      "",
      `- Phase: ${state.state}`,
      `- Processed tokens: ${verdict.totalTokens}`,
      `- Recorded cost: ${verdict.costUsd == null ? "unavailable" : `$${verdict.costUsd.toFixed(4)}`}`,
      `- Changed files recorded: ${snapshot.changedFiles.length}`,
      "",
      "The completed turn and all artifacts remain on disk. Raise the packet-authorized envelope with an audited reason to resume, or cancel the session.",
      "",
    ].join("\n"),
  );
}

/**
 * Enforce the packet-authorized envelope at a turn boundary. Returns null
 * when work may proceed, otherwise a state that must be persisted and yielded
 * before another unit of work can start.
 */
function enforceBudgetBoundary(sessionDir, state, packet, deliveryConfig) {
  const envelope = effectiveBudgetEnvelope(packet, state, deliveryConfig);
  const phase = String(state.state || "").toLowerCase();
  const verdict = checkSessionBudget((state.usage && state.usage.total) || {}, envelope, {
    phase,
    phaseUsage: state.usage && state.usage.perPhase && state.usage.perPhase[phase],
  });
  const budgetState = state.budget || { current: envelope, warned: [], exhaustedAt: null };
  if (verdict.status === "warn") {
    const warned = new Set(budgetState.warned || []);
    if (warned.has(verdict.dimension)) return null;
    warned.add(verdict.dimension);
    emitEvent(sessionDir, {
      type: "budget.warning",
      phase: state.state,
      data: { dimension: verdict.dimension, totalTokens: verdict.totalTokens, costUsd: verdict.costUsd, envelope },
    });
    emitEvent(sessionDir, {
      type: "notification.requested",
      phase: state.state,
      data: { reason: "budget-warning", dimension: verdict.dimension, totalTokens: verdict.totalTokens, costUsd: verdict.costUsd },
    });
    return { ...state, budget: { ...budgetState, current: envelope, warned: [...warned] } };
  }
  if (verdict.status !== "exceeded") return null;
  if (budgetState.exhaustedAt && state.awaiting && state.awaiting.reason === "budget-exhausted") return state;

  const at = new Date().toISOString();
  writeBudgetFinishPackage(sessionDir, state, envelope, verdict, at);
  // DLV-12: the budget pause predates the finish package and had its own
  // one-file summary (`finish/budget.json`, above). It now also gets the full
  // package — the ownership manifest and remaining-work file are exactly what
  // an owner needs at a cap-hit, which is the one pause where "what did I get
  // for my money, and what is left" is the entire question.
  writeFinishPackage(sessionDir, state, packet, "budget-exhausted");
  emitEvent(sessionDir, {
    type: "budget.exhausted",
    phase: state.state,
    data: { dimension: verdict.dimension, totalTokens: verdict.totalTokens, costUsd: verdict.costUsd, reason: verdict.reason },
  });
  emitEvent(sessionDir, {
    type: "notification.requested",
    phase: state.state,
    data: { reason: "budget-exhausted", returnTo: state.state, finishPackage: "artifacts/finish/budget.json" },
  });
  return {
    ...state,
    // DLV-29: a budget check can land on the same tick as entering a manual
    // gate phase (SPEC_READY/PLAN_READY/UAT_READY/NEEDS_DECISION/...), which
    // had already set `awaiting` to that gate. Overwriting it outright here
    // permanently lost the gate — the `set-budget` resume path only knew how
    // to clear a budget-reason `awaiting`, not restore what it replaced, so
    // the session became unresponsive to every UI action and API call after
    // an owner-authorized raise. Carry the prior `awaiting` through so resume
    // can hand it back verbatim (including gate-specific payloads like
    // NEEDS_DECISION's `questions`).
    awaiting: { gate: "budget", returnTo: state.state, reason: "budget-exhausted", priorAwaiting: state.awaiting || null },
    execution: { ...(state.execution || defaultExecution(packet)), paused: true, pauseRequestedAt: at },
    budget: { ...budgetState, current: envelope, exhaustedAt: at },
  };
}

// ---- usage accounting ----

// DLV-37: state.usage now carries the v2 token shape end-to-end
// ({input, cachedRead, cacheCreation, output, reasoningOutput, costUsd,
// costEstUsd}), so `cacheCreation` — previously the majority of real
// session cost (Cost Anatomy §3) — is finally part of the running total
// that budgets.mjs enforces against, not just the per-turn transcript
// display. `usageV2`/`costUsd` here are `turn.usageV2` / `turn.usage.costUsd`
// from runTurnAndSeal's return (the latter already resolves to
// reported-cost-or-estimate — "budgetCostUsd" — so this needs no separate
// cost computation). Math reused verbatim from usage.mjs's accumulator.
function accumulateUsage(state, phase, usageV2, costUsd) {
  const prevPhase = (state.usage && state.usage.perPhase && state.usage.perPhase[phase]) || emptyUsageV2();
  const perPhase = { ...(state.usage && state.usage.perPhase), [phase]: addUsageV2(prevPhase, usageV2, costUsd) };
  const prevTotal = (state.usage && state.usage.total) || emptyUsageV2();
  const total = addUsageV2(prevTotal, usageV2, costUsd);
  return { perPhase, total };
}

// DLV-43: `blockFrom` knows the *state* a failed turn was blocked from
// ("SPEC_READY" is where the PLAN turn runs), while `accumulateUsage`'s
// perPhase keys are the phase names the success paths use. This maps one onto
// the other so a failed turn's spend lands in the same bucket a successful one
// would have, instead of inventing a parallel set of keys nothing else reads.
const USAGE_PHASE_KEY_BY_STATE = Object.freeze({
  DISCOVERY: "discovery",
  SPEC_READY: "plan",
  PLAN_READY: "building",
  BUILDING: "building",
  VALIDATING: "building",
  REVIEWING: "reviewing",
  UAT_READY: "uat",
});

function canonicalPhaseKey(fromPhase) {
  return USAGE_PHASE_KEY_BY_STATE[String(fromPhase || "").toUpperCase()] || String(fromPhase || "unknown").toLowerCase();
}

// ---- full-fidelity transcript capture (DW-1) ----
// Full raw-record shards + the turns.ndjson index (transcript.mjs's pure
// schema); this process is the sole writer, same discipline as events.ndjson.
// Absent for pre-DW-1 sessions (no `transcript/` dir) — every reader here
// degrades gracefully rather than assuming the directory exists.

/** v1 `{input, cachedInput, output}` -> v2 token shape, for drivers that only report v1 usage. */
function fallbackUsageV2FromV1(usageV1) {
  const u = usageV1 || {};
  return {
    input: u.input || 0,
    cachedRead: u.cachedInput || 0,
    cacheCreation: 0,
    output: u.output || 0,
    reasoningOutput: 0,
  };
}

function listPromptTurnIds(sessionDir) {
  const dir = sessionPaths(sessionDir).transcriptPrompts;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^\d{4,}\.md$/.test(name))
    .map((name) => name.replace(/\.md$/, ""));
}

function listClosedTurnIds(sessionDir) {
  const text = readTextIfExists(sessionPaths(sessionDir).turns);
  if (!text) return [];
  return parseTurns(text).map((t) => t.turnId);
}

/**
 * D12/DLV-17 transcript integrity — run once a session reaches a terminal
 * state (SHIPPED/CANCELLED), comparing `state.turnCounter` (every turn id
 * ever allocated) against what actually exists on disk. Always emits an
 * event, including the "zero gaps" case (auditable proof the check ran, not
 * only a report when something's wrong — same philosophy as D5's
 * `context.strategy` events). Never throws: a missing `transcript/` dir
 * (a session that died before DISCOVERY ever wrote one) is zero turns, zero
 * gaps, not an error.
 */
/**
 * D12/DLV-17 raw SDK linkage — run once a session reaches a terminal state,
 * same boundary as the transcript gap check. Claude-only: Codex has no
 * `~/.claude/projects/` equivalent, and a session that never established a
 * driver ref (died before its first turn) has no SDK session id to resolve.
 * Persists the pointer onto `state.driver.rawTranscript` (the runner's own
 * write, same single-writer discipline as every other state.json field) so
 * it survives past this tick for the session-detail view to surface, without
 * ever copying the file itself.
 */
function withRawTranscriptLinkage(state, packet, repoRoot) {
  if (packet.agent !== "claude") return state;
  const sessionId = state.driver && state.driver.ref && state.driver.ref.id;
  if (!sessionId) return state;
  const pointer = computeRawTranscriptPointer(repoRoot, sessionId);
  return { ...state, driver: { ...state.driver, rawTranscript: pointer } };
}

function runTranscriptGapCheck(sessionDir, state) {
  const closedTurnIds = listClosedTurnIds(sessionDir);
  const promptTurnIds = listPromptTurnIds(sessionDir);
  const missingTurnIds = findMissingTurnIds(state.turnCounter || 0, closedTurnIds, promptTurnIds);
  emitEvent(sessionDir, {
    type: "transcript.gap.checked",
    phase: state.state,
    data: { turnCounter: state.turnCounter || 0, missingTurnIds, gapCount: missingTurnIds.length },
  });
}

/**
 * Reconcile orphaned turns on `--resume`: a turn whose prompt file was
 * written but that never got a closing turns.ndjson entry means the runner
 * crashed mid-turn. Seal it as `result:"crashed"` so it stops looking
 * "in flight" forever. No-op for sessions with no `transcript/` dir yet.
 */
export function reconcileCrashedTurns(sessionDir, { now = () => new Date() } = {}) {
  const p = sessionPaths(sessionDir);
  if (!existsSync(p.transcript)) return [];
  const orphans = findOrphanedTurnIds(listClosedTurnIds(sessionDir), listPromptTurnIds(sessionDir));
  for (const turnId of orphans) {
    const entry = buildCrashSealEntry({
      turnId,
      phase: null,
      agent: null,
      provider: null,
      model: null,
      effort: null,
      promptFile: `transcript/prompts/${turnPromptFileName(turnId)}`,
      recordsFile: existsSync(join(p.transcript, turnShardFileName(turnId))) ? `transcript/${turnShardFileName(turnId)}` : null,
      sealedAt: now().toISOString(),
    });
    appendNdjsonLine(p.turns, formatTurnEntry(entry));
  }
  return orphans;
}

// ---- structured analysis outputs (S3) ----

const STRING_ARRAY_SCHEMA = Object.freeze({ type: "array", items: { type: "string" } });

export const SPEC_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  // DLV-7: `scopeEstimate` is required *of the generation* — the provider's
  // structured-output enforcement is what guarantees a real session always
  // measures its scope. `parseSpecOutput` deliberately does NOT require it (see
  // there): 35 spec fixtures across 13 test files predate the field, and the
  // DLV-32 precedent is that breaking every existing fixture to add a field is
  // the wrong trade when the schema already binds real turns.
  required: [
    "problem",
    "currentBehavior",
    "proposedBehavior",
    "acceptanceCriteria",
    "affectedPaths",
    "riskFlags",
    "openQuestions",
    "scopeEstimate",
  ],
  properties: {
    problem: { type: "string" },
    currentBehavior: { type: "string" },
    proposedBehavior: { type: "string" },
    scopeEstimate: {
      type: "object",
      additionalProperties: false,
      required: ["files", "occurrences", "modules"],
      properties: {
        files: { type: "integer" },
        occurrences: { type: "integer" },
        modules: { type: "integer" },
        note: { type: "string" },
      },
    },
    // Only expected when the measured scope exceeds the item's declared
    // effort; 2-4 slices, each self-contained enough to ship on its own.
    decomposition: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title"],
        properties: {
          title: { type: "string" },
          rationale: { type: "string" },
          acceptanceCriteriaIds: STRING_ARRAY_SCHEMA,
        },
      },
    },
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

// DLV-32: `openQuestions` — the agent could previously stop and ask only
// during DISCOVERY; PLAN could only guess or produce a plan around a genuine
// blocking ambiguity. Same shape and required-ness as SPEC_OUTPUT_SCHEMA's.
export const PLAN_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  // openQuestions is intentionally NOT required, unlike SPEC_OUTPUT_SCHEMA's —
  // making it required would fail validation for every plan turn (fixture
  // or real) that predates this field. parsePlanOutput defaults it to [].
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

/** DW-8: the new provider's restated understanding after a handoff — see prompts.mjs buildHandoffVerificationPrompt. */
/**
 * DLV-62: the merged DISCOVERY+PLAN payload for a FAST, single-file item.
 *
 * Deliberately built by *composing* the two existing schemas rather than
 * restating their fields: a merged turn that could drift from the unmerged
 * contract would be a second, subtly different definition of a spec — and the
 * spec is what the SPEC gate approves. Both artifacts come out identical to
 * what the two-turn path produces, which is what lets the gates be unchanged.
 */
export const MERGED_SPEC_PLAN_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [...SPEC_OUTPUT_SCHEMA.required, "plan"],
  properties: {
    ...SPEC_OUTPUT_SCHEMA.properties,
    plan: PLAN_OUTPUT_SCHEMA,
  },
});

export const HANDOFF_VERIFICATION_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["understandingSummary", "currentPhase", "nextAction", "gaps"],
  properties: {
    understandingSummary: { type: "string" },
    currentPhase: { type: "string" },
    nextAction: { type: "string" },
    gaps: STRING_ARRAY_SCHEMA,
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
  // DLV-7: absent is tolerated (legacy/fixture specs, and any turn that predates
  // the schema field) and lands as `scopeEstimate: null` — recorded as "not
  // reported" at the gate rather than silently inferred as zero. Present but
  // malformed is a hard error: a scope contract computed from `files: "lots"`
  // would be worse than none, because it would look measured.
  if (spec.scopeEstimate !== undefined && spec.scopeEstimate !== null) {
    if (normalizeScopeEstimate(spec.scopeEstimate) == null) {
      throw new RunnerError(
        'DISCOVERY output field "scopeEstimate" must be an object with non-negative integer files/occurrences/modules',
      );
    }
  }
  if (spec.decomposition !== undefined && spec.decomposition !== null) {
    if (normalizeDecomposition(spec.decomposition) == null) {
      throw new RunnerError(
        'DISCOVERY output field "decomposition" must be 2-4 entries, each with a non-empty title',
      );
    }
  }
  return spec;
}

export function parsePlanOutput(text) {
  let plan = parseJsonObject(text, "PLAN");
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
  if (plan.openQuestions === undefined) {
    plan = { ...plan, openQuestions: [] };
  } else if (
    !Array.isArray(plan.openQuestions) ||
    plan.openQuestions.some((entry) => !entry || typeof entry.text !== "string")
  ) {
    throw new RunnerError('PLAN output field "openQuestions" must contain {text} objects');
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

export function fingerprintDirtyPaths(repoRoot, statusText) {
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

// ---- mid-turn abort (DW-10) ----

/**
 * Poll `controls/` for a NEW `pause {abortInFlight:true}` control while a
 * turn is in flight and, if one shows up, abort `controller`. `advanceSession`
 * only drains controls between ticks (a turn is a single await within one
 * tick), so this is the only way an owner's abort request can reach a turn
 * that's already running — genuinely concurrent with the turn's own I/O via
 * the event loop, not a second pass over the same synchronous call.
 * Returns a `stop()` to clear the poller once the turn settles.
 */
function watchForAbort(sessionDir, controlsProcessedAtStart, controller, pollMs) {
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped || controller.signal.aborted) return;
    const pending = pendingControls(sessionDir, controlsProcessedAtStart);
    const shouldAbort = pending.some((c) => c.type === "pause" && c.payload && c.payload.abortInFlight === true);
    if (shouldAbort) controller.abort();
  }, pollMs);
  if (typeof timer.unref === "function") timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
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
  // D9/DLV-6: the lane's resolved maxInternalTurns (or null for an uncapped
  // turn, matching pre-D9 behavior) -- see packetMaxInternalTurns and the
  // driver's own doc comment for how this maps onto the SDK's Options.maxTurns.
  maxTurns = null,
  // DW-1: full-fidelity transcript capture + v2 usage/cost. All optional and
  // additive — omitting `turnId` skips transcript writing entirely, so
  // pre-DW-1 callers (and every existing test that doesn't pass it) see
  // byte-identical behavior on the fields they already depend on.
  turnId,
  provider,
  model,
  strategy = "resume-native",
  maxRecordBytes = DEFAULT_MAX_RECORD_BYTES,
  pricing = null,
  pricingVersion = null,
  windowTokens = null,
  // DW-10: mid-turn abort — `controlsProcessed` is the cursor as of the start
  // of this turn (controls written after it are new, i.e. an owner action
  // taken while this turn is running); `abortPollMs` paces the concurrent
  // poll (small in tests so an abort control is picked up quickly).
  controlsProcessed = 0,
  abortPollMs = 300,
  maxAutoRetries = 2,
  extraQuotaPatterns = [],
}) {
  // Same containment as getGuardedHandle: a snapshot failure must fail the
  // turn (→ BLOCKED with the git error visible), never crash the runner.
  let before;
  try {
    before = takeSnapshot(repoRoot);
  } catch {
    await sleepAsync(1000);
    try {
      before = takeSnapshot(repoRoot);
    } catch (error) {
      return { ok: false, gitViolation: false, error, turnId };
    }
  }
  const startedAt = new Date();
  const promptFile = turnId ? `transcript/prompts/${turnPromptFileName(turnId)}` : null;
  const recordsFile = turnId ? `transcript/${turnShardFileName(turnId)}` : null;
  let recordSeq = 0;
  // D12/DLV-40: role attribution. Raw records used to carry `provider` only
  // -- nothing distinguished a DISCOVERY record from a REVIEWING one at the
  // record level (only the turn entry had `phase`, and even that had no role
  // label). `roleForPhase` is the single source of truth this and the UI's
  // ROLE_COLORS map both read from.
  const role = roleForPhase(phase);

  if (turnId) {
    atomicWriteTextSync(join(sessionDir, promptFile), prompt);
    recordSeq += 1;
    appendNdjsonLine(
      join(sessionDir, recordsFile),
      formatRecord(buildRecord({ turnId, seq: recordSeq, kind: "prompt", provider: provider || null, role, promptFile })),
    );
  }

  const onRaw = turnId
    ? (partial) => {
        try {
          recordSeq += 1;
          const record = buildRecord({ turnId, seq: recordSeq, provider: provider || null, role, maxRecordBytes, ...partial });
          appendNdjsonLine(join(sessionDir, recordsFile), formatRecord(record));
        } catch {
          // A malformed raw partial from a driver must never break the turn —
          // the curated events.ndjson path stays authoritative for control flow.
        }
      }
    : undefined;

  function sealTurn(result, usageV2, { workspaceDelta = null, costUsd = null } = {}) {
    if (!turnId) return;
    const entry = buildTurnEntry({
      turnId,
      phase,
      role,
      agent,
      provider: provider || null,
      model: model || null,
      effort: effort || null,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      promptFile,
      recordsFile,
      records: recordSeq,
      usage: usageV2,
      costUsd,
      costEstUsd: estimateCostUsd(usageV2, pricing),
      pricingVersion,
      context: computeOccupancy(usageV2, windowTokens),
      result,
      strategy,
      workspaceDelta,
    });
    appendNdjsonLine(sessionPaths(sessionDir).turns, formatTurnEntry(entry));
  }

  // DW-10: one AbortController per turn (including retries — controls aren't
  // drained mid-turn, so the same `controlsProcessed` cursor is still valid
  // across attempts), watched concurrently with the driver call.
  const controller = new AbortController();
  const stopWatch = turnId ? watchForAbort(sessionDir, controlsProcessed, controller, abortPollMs) : null;

  try {
    let lastErr = null;
    let autoRetries = 0;
    let retrySignature = null;
    // DLV-43: spend accumulated by attempts that FAILED. Every retry is its
    // own real provider call, so this sums across attempts rather than
    // reporting only the last one — the session that exposed this bug burned
    // three DISCOVERY attempts and recorded zero for all of them.
    let failedUsageV2 = null;
    let failedCostUsd = null;
    /** Fold one dead attempt's observed usage into the running failed-turn total. */
    function bankFailedAttempt(err) {
      const observed = readObservedUsage(err);
      if (!observed) return;
      const attemptUsageV2 = observed.usageV2 || fallbackUsageV2FromV1(observed.usage);
      const attemptCostUsd =
        typeof (observed.usage && observed.usage.costUsd) === "number"
          ? observed.usage.costUsd
          : typeof attemptUsageV2.costUsd === "number"
            ? attemptUsageV2.costUsd
            : estimateCostUsd(attemptUsageV2, pricing);
      failedUsageV2 = addUsageV2(failedUsageV2 || emptyUsageV2(), attemptUsageV2, attemptCostUsd);
      if (typeof attemptCostUsd === "number") failedCostUsd = (failedCostUsd || 0) + attemptCostUsd;
    }
    /** The `{usageV2, usage}` fields a failed-turn return carries, or `{}` when nothing was spent. */
    function failedUsageFields() {
      if (!failedUsageV2) return {};
      return { usageV2: failedUsageV2, usage: { costUsd: failedCostUsd } };
    }
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await Promise.resolve(
          driver.runTurn(handle, prompt, {
            outputSchema,
            effort,
            maxTurns,
            onRaw,
            signal: controller.signal,
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
        const usageV2 = result.usageV2 || fallbackUsageV2FromV1(result.usage);
        const reportedCostUsd =
          typeof (result.usage && result.usage.costUsd) === "number"
            ? result.usage.costUsd
            : typeof usageV2.costUsd === "number"
              ? usageV2.costUsd
              : null;
        const estimatedCostUsd = estimateCostUsd(usageV2, pricing);
        const budgetCostUsd = reportedCostUsd ?? estimatedCostUsd;
        const guard = checkGitGuard(before, repoRoot, guardMode, { takeSnapshot, forbiddenPaths });
        const changedPaths = changedPathsBetween(before, guard.after);
        if (!guard.ok) {
          emitEvent(sessionDir, {
            type: "git.guard.violation",
            phase,
            agent,
            data: { violations: guard.violations },
          });
          sealTurn("guard-violation", usageV2, { workspaceDelta: { changedPaths }, costUsd: reportedCostUsd });
          return { ok: false, gitViolation: true, violations: guard.violations, changedPaths, turnId, usageV2 };
        }
        sealTurn("ok", usageV2, { workspaceDelta: { changedPaths }, costUsd: reportedCostUsd });
        return {
          ok: true,
          finalText: result.finalText,
          usage: { ...(result.usage || {}), costUsd: budgetCostUsd },
          changedPaths,
          turnId,
          usageV2,
        };
      } catch (err) {
        if (err instanceof DriverAbortedError) {
          // Owner-initiated: the in-flight response is lost outright (never
          // retried) — but the git-guard + changed-file delta always run so
          // the owner can see exactly what an aborted BUILD turn touched
          // before the workspace is (deliberately) left un-rolled-back.
          const guard = checkGitGuard(before, repoRoot, guardMode, { takeSnapshot, forbiddenPaths });
          const changedPaths = changedPathsBetween(before, guard.after);
          emitEvent(sessionDir, {
            type: "turn.aborted",
            phase,
            agent,
            data: { turnId, changedPaths, gitViolation: !guard.ok, violations: guard.violations },
          });
          sealTurn("aborted", fallbackUsageV2FromV1(null), { workspaceDelta: { changedPaths } });
          return { ok: false, aborted: true, gitViolation: !guard.ok, violations: guard.violations, turnId, changedPaths };
        }
        lastErr = err;
        bankFailedAttempt(err);
        const classification = classifyTurnError(err, { extraQuotaPatterns });
        const message = String((err && err.message) || err);
        emitEvent(sessionDir, {
          type: "agent.turn.failed",
          phase,
          agent,
          data: {
            attempt,
            message,
            errorKind: classification.kind,
            ...(classification.resetsAt ? { resetsAt: classification.resetsAt } : {}),
          },
        });
        const guard = checkGitGuard(before, repoRoot, guardMode, { takeSnapshot, forbiddenPaths });
        const changedPaths = changedPathsBetween(before, guard.after);
        if (!guard.ok) {
          emitEvent(sessionDir, {
            type: "git.guard.violation",
            phase,
            agent,
            data: { violations: guard.violations },
          });
          sealTurn("guard-violation", failedUsageV2 || fallbackUsageV2FromV1(null), {
            workspaceDelta: { changedPaths },
            costUsd: failedCostUsd,
          });
          return { ok: false, gitViolation: true, violations: guard.violations, changedPaths, error: err, turnId, ...failedUsageFields() };
        }
        // A quota/rate-limit error is never worth retrying — the provider
        // allowance is exhausted, not the individual request, so a second
        // attempt (or a later owner-triggered runner restart hitting the
        // same code path) fails the same way. Go straight to BLOCKED
        // instead of spending a second failed session-establish (BUD-11:
        // this loop spun up 5 fresh sessions in 2 minutes against an
        // already-exhausted subscription allowance).
        if (!classification.retryable) {
          sealTurn("failed", failedUsageV2 || fallbackUsageV2FromV1(null), {
            workspaceDelta: { changedPaths },
            costUsd: failedCostUsd,
          });
          return {
            ok: false,
            gitViolation: false,
            error: lastErr,
            changedPaths,
            turnId,
            errorKind: classification.kind,
            resetsAt: classification.resetsAt,
            ...failedUsageFields(),
          };
        }
        const signature = `${classification.kind}:${message}`;
        autoRetries = signature === retrySignature ? autoRetries + 1 : 0;
        retrySignature = signature;
        if (autoRetries < maxAutoRetries && attempt < maxAutoRetries) {
          emitEvent(sessionDir, {
            type: "retry.automatic",
            phase,
            agent,
            data: { attempt: autoRetries + 1, maxAutoRetries, reason: `retryable ${classification.kind} error: ${message}` },
          });
          sleep(retryDelayMs);
          continue;
        }
        sealTurn("failed", failedUsageV2 || fallbackUsageV2FromV1(null), {
          workspaceDelta: { changedPaths },
          costUsd: failedCostUsd,
        });
        return {
          ok: false,
          gitViolation: false,
          error: lastErr,
          changedPaths,
          turnId,
          errorKind: "retry-exhausted",
          retryCount: autoRetries,
          ...failedUsageFields(),
        };
      }
    }
  } finally {
    if (stopWatch) stopWatch();
  }
}

function defaultSleep(ms) {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ---- driver session handle (persisted ref, resumable) ----

/**
 * Effort for one phase — `state.execution.effortByPhase` (DW-4: same-provider
 * config-change controls write here) takes precedence when present, else the
 * packet's launch-time default. `state` is optional so pre-DW-4 call sites
 * (none remain, but the fallback keeps this safe for direct unit tests).
 */
function phaseEffort(state, packet, phase) {
  const execution = state && state.execution;
  if (execution && execution.effortByPhase && execution.effortByPhase[phase]) {
    return execution.effortByPhase[phase];
  }
  return packet.agentConfig && packet.agentConfig.effort ? packet.agentConfig.effort[phase] || null : null;
}

/**
 * D9/DLV-6: the lane's resolved `maxInternalTurns`, mapped by the driver onto
 * the SDK's own `Options.maxTurns` — caps how many internal assistant<->tool
 * round-trips *one* runner turn's `query()` call may take before the SDK ends
 * it itself. Without this, one runner turn was observed becoming ~40 model
 * calls (Cost Anatomy §5). `null` for pre-D9 packets (no `lanePolicy`
 * recorded) or an unset lane default — the driver simply omits the option in
 * that case, matching today's uncapped behavior exactly.
 */
function packetMaxInternalTurns(packet) {
  return (packet.lanePolicy && packet.lanePolicy.maxInternalTurns) || null;
}

/**
 * The DW-1 transcript-capture parameters shared by every `runGuardedTurn`
 * call site: next turn id (from `state.turnCounter`), provider/model (DW-4:
 * `state.execution.model` when present, else the packet's launch-time
 * default), a strategy label (a real driver ref already existing means this
 * turn resumes it, possibly with overrides when a config change is pending —
 * the richer strategies like rotate-fresh/handoff/fork are DW-7/DW-8), and
 * pricing from the owner's `.delivery/config.json` (best-effort; `null` when
 * the model isn't cataloged).
 */
function turnContext({ state, packet, deliveryConfig }) {
  const turnId = formatTurnId((state.turnCounter || 0) + 1);
  const execution = state.execution || null;
  const provider = (execution && execution.provider) || packet.agent;
  const model = execution ? execution.model || null : (packet.agentConfig && packet.agentConfig.model) || null;
  const hadRefBeforeThisTurn = !!(state.driver && state.driver.ref);
  const strategy = !hadRefBeforeThisTurn ? "start" : execution && execution.configChangedSinceLastTurn ? "resume-with-overrides" : "resume-native";
  const maxRecordBytes =
    (deliveryConfig && deliveryConfig.transcript && deliveryConfig.transcript.maxRecordBytes) || DEFAULT_MAX_RECORD_BYTES;
  const pricing = deliveryConfig && model ? getModelPricing(deliveryConfig, provider, model) : null;
  const pricingVersion = (deliveryConfig && deliveryConfig.pricingVersion) || null;
  // DLV-30: previously always hardcoded null in sealTurn's computeOccupancy
  // call, which permanently disabled decideContextStrategy's mid-phase
  // hard-ceiling branch (it requires a known window size). The model catalog
  // already carries this (config.mjs ModelEntry.contextWindow) — just wasn't
  // looked up.
  const windowTokens =
    (deliveryConfig && model && getModelInfo(deliveryConfig, provider, model) && getModelInfo(deliveryConfig, provider, model).contextWindow) ||
    null;
  return {
    turnId,
    provider,
    model,
    strategy,
    maxRecordBytes,
    pricing,
    pricingVersion,
    windowTokens,
    // DW-10: the control-file cursor as of *before* this turn starts — see
    // `watchForAbort`.
    controlsProcessed: state.controlsProcessed || 0,
  };
}

function errorRetryOptions(deliveryConfig) {
  const errors = (deliveryConfig && deliveryConfig.errors) || {};
  return {
    maxAutoRetries: errors.maxAutoRetries != null ? errors.maxAutoRetries : 2,
    extraQuotaPatterns: errors.extraQuotaPatterns || [],
  };
}

/** Clear the one-shot "next turn should note a config override" flag after a turn consumes it. */
function clearConfigOverrideFlag(execution) {
  if (!execution || !execution.configChangedSinceLastTurn) return execution;
  return { ...execution, configChangedSinceLastTurn: false };
}

async function getHandle({ driver, state, packet, repoRoot, mode, phase }) {
  const ref = state.driver && state.driver.ref;
  if (ref) {
    // The ref's SDK conversation may have been established under a
    // different phase mode (e.g. readonly during DISCOVERY); pass this
    // call's actual mode as an override so BUILDING always resumes with
    // write access instead of silently inheriting the frozen ref.mode.
    return Promise.resolve(driver.resume(ref, { mode }));
  }
  const execution = state.execution || null;
  // DLV-31: a rotation or quota-paused retry nulls `state.driver.ref` to
  // force a fresh session, but the runner's single long-lived driver
  // instance (one per process — see runLoop) still remembers it was already
  // started, so `startSession` would throw "session already started" here
  // forever after. `reset()` is idempotent — harmless on a driver that was
  // never started (the normal first-tick case).
  if (typeof driver.reset === "function") driver.reset();
  const handle = await Promise.resolve(
    driver.startSession({
      cwd: repoRoot,
      mode,
      model: execution ? execution.model : packet.agentConfig && packet.agentConfig.model,
      effort: phaseEffort(state, packet, phase),
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
  // The pre-turn snapshot itself can fail (a transient git error — e.g. the
  // validation timeout's `taskkill /T` racing a freshly spawned git.exe, or a
  // concurrent git process). An uncaught throw here killed the whole runner
  // with the session left silently "running" (s-20260722-221533-wous) — so
  // retry once, then fail like any other setup error: the caller blocks the
  // session with the git error visible at the gate instead of crashing.
  let before;
  try {
    before = takeSnapshot(repoRoot);
  } catch {
    await sleepAsync(1000);
    try {
      before = takeSnapshot(repoRoot);
    } catch (error) {
      return { ok: false, gitViolation: false, error };
    }
  }
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

/**
 * Real provider kinds. Anything else (`fake`, a test stub) is a stand-in for
 * whatever the packet names and must never be swapped for an SDK-backed driver
 * — that would turn an offline test into a live provider call.
 */
const PROVIDER_DRIVER_KINDS = Object.freeze(new Set(["claude", "codex"]));

/** Driver-factory options every provider driver needs to enforce its own git/tool guard. */
function providerDriverOptions(packet, sessionDir) {
  return {
    sessionDir,
    forbiddenPaths: (packet && packet.constraints && packet.constraints.forbiddenPaths) || [],
  };
}

/**
 * DLV-34: pick the driver instance that actually owns `state.driver.ref`.
 *
 * `runLoop` creates exactly one driver, from `packet.agent`, and hands it to
 * every `advanceSession` tick. A handoff (DW-8) switches
 * `state.execution.provider` and writes the **new** provider's ref into
 * `state.driver.ref` — but nothing ever replaced that one long-lived instance,
 * so the very next phase turn called `claudeDriver.resume(codexRef)`: the old
 * provider's SDK, resuming a session id it never created. `performHandoff`
 * built the right instance locally and then threw it away, returning only its
 * ref, which is exactly why the verification turn always looked fine and the
 * *following* turn was the one that broke.
 *
 * Resolution is by driver kind rather than by a flag on state, so it is correct
 * no matter how the provider changed (handoff control, a resumed session whose
 * `execution.provider` was already switched in a previous process, a future
 * path that sets it some other way).
 *
 * @param {{driver:object, state:object, packet:object, sessionDir:string,
 *   createDriver?:Function, cache?:(Map|null)}} args
 */
export function resolveProviderDriver({ driver, state, packet, sessionDir, createDriver = createDriverDefault, cache = null }) {
  const wanted = (state && state.execution && state.execution.provider) || (packet && packet.agent) || null;
  if (!wanted || !driver) return driver;
  const have = driver.kind || null;
  if (have === wanted) return driver;
  if (!PROVIDER_DRIVER_KINDS.has(have)) return driver;
  if (cache && cache.has(wanted)) return cache.get(wanted);
  const created = createDriver(wanted, providerDriverOptions(packet, sessionDir));
  if (cache) cache.set(wanted, created);
  return created;
}

function withDriverRef(state, handle) {
  return { ...state, driver: { ...(state.driver || {}), ref: handle.ref } };
}

function persistNewDriverRef(sessionDir, priorState, nextState) {
  if (priorState.driver && priorState.driver.ref) return nextState;
  return persistState(sessionDir, nextState);
}

// ---- validation (runner-native, doc 3 §4 row 5) ----

// Per-command `timeoutMs` overrides the caller/config default — this repo's
// full `pnpm lint` really takes ~11 min and the whole vitest suite several,
// so the 240s default (fine for typecheck) would guarantee a `timedOut`
// failure on every single validation run for those two.
const VALIDATION_COMMANDS = [
  { key: "typecheck", cmd: "pnpm", args: ["typecheck"] },
  { key: "lint", cmd: "pnpm", args: ["lint"], timeoutMs: 900_000 },
  { key: "test", cmd: "pnpm", args: ["test"], timeoutMs: 600_000 },
];
const EXCERPT_LINES = 200;
// Per-command safety bound. Validation used to run via `spawnSync`, which
// blocks the entire Node event loop for the full duration of `pnpm
// typecheck`+`pnpm lint`+`pnpm test` — on a large repo that is minutes (this
// repo's `pnpm lint` alone was measured at ~11 min). A blocked event loop
// freezes the runner heartbeat, so the dashboard reports the session "stale",
// the owner clicks Resume, a second runner spawns and runs the same suite
// again — the exact death spiral that made a launched session look silently
// stuck. Validation now runs as a real async child process (heartbeat keeps
// beating) and any single command that exceeds this bound is killed and
// recorded `timedOut` rather than stalling the phase forever.
const VALIDATION_TIMEOUT_MS = 240_000;

function tailLines(text, n) {
  const lines = String(text || "").split("\n");
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}

/**
 * Kill a child process AND its descendants. A plain `child.kill()` only signals
 * the immediate child, which on Windows is the `cmd.exe`/`pnpm` shell wrapper —
 * the real worker (`tsc`/`eslint`/`vitest`) is a grandchild that keeps running
 * and holds the stdio pipes open, so `close` never fires and the timeout does
 * not actually stop the work (measured: a 3 s timeout still took ~11.7 s to
 * return because tsc ran to completion). `taskkill /T` (Windows) or a
 * process-group SIGKILL (POSIX, requires the `detached` spawn below) tears down
 * the whole tree.
 */
function killProcessTree(child) {
  if (!child || child.pid == null) return;
  if (process.platform === "win32") {
    try {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      /* best-effort */
    }
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL"); // negative pid = process group (detached leader)
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already exited */
    }
  }
}

/**
 * Run one validation command as an async child process, capturing stdout/stderr
 * and enforcing a hard timeout (the whole process tree is killed on expiry).
 * Never rejects — a spawn error or timeout resolves to a non-zero/`timedOut`
 * result so the caller records it like any other failing command.
 * @returns {Promise<{status:number|null, stdout:string, stderr:string, ms:number, timedOut:boolean}>}
 */
function runValidationCommand(cmd, args, { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        shell: process.platform === "win32",
        // POSIX: own process group so killProcessTree can SIGKILL the group.
        // Windows: taskkill /T handles the tree, and detached would pop a console.
        detached: process.platform !== "win32",
      });
    } catch (err) {
      resolve({ status: null, stdout: "", stderr: String((err && err.message) || err), ms: Date.now() - started, timedOut: false });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();
    if (child.stdout) child.stdout.on("data", (d) => { stdout += d.toString(); });
    if (child.stderr) child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ status: null, stdout, stderr: `${stderr}${(err && err.message) || err}`, ms: Date.now() - started, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ status: code, stdout, stderr, ms: Date.now() - started, timedOut });
    });
  });
}

/** D10/DLV-11: `vitest related <files>` instead of the full `pnpm test` suite. */
function targetedTestCommand(targetedFiles) {
  return { cmd: "pnpm", args: ["exec", "vitest", "related", ...targetedFiles, "--passWithNoTests"] };
}

/**
 * Default real validation runner: runs pnpm typecheck/lint/test at repoRoot as
 * async child processes (never blocks the event loop) with a per-command
 * timeout. `run` is a test seam (inject a fake async command runner).
 *
 * D10/DLV-11: every one of `VALIDATION_COMMANDS` always appears in `results`,
 * never silently absent — a rung outside the lane's `rungs` list is recorded
 * as `{skipped:true, reason:"not in this lane's validation ladder"}` before
 * any command runs, and a rung the fail-fast short-circuit never reached is
 * recorded as `{skipped:true, reason:"not run — an earlier command failed"}`.
 * This is the fix for the whdv postmortem's "lint (skipped)" / "test
 * (skipped)" appearing only as the *agent's own* unverified prose under a
 * "✅ COMPLETED" build-log claim — the runner's own validation-report.md is
 * now the one place a skip can never go unrecorded.
 * @param {{cwd: string, timeoutMs?: number, run?: Function, onEvent?: Function,
 *   rungs?: (string[]|null), targetedFiles?: (string[]|null)}} options
 * @returns {Promise<{ok: boolean, results: Object<string, {ok: boolean, skipped?: boolean,
 *   reason?: string, ms?: number, timedOut?: boolean, excerpt?: string, targeted?: boolean}>}>}
 */
export async function runValidationCommands({
  cwd,
  timeoutMs = VALIDATION_TIMEOUT_MS,
  run = runValidationCommand,
  onEvent = null,
  rungs = null,
  targetedFiles = null,
} = {}) {
  const results = {};
  let ok = true;
  let fastFailed = false;
  const hasTargets = Array.isArray(targetedFiles) && targetedFiles.length > 0;
  for (const spec of VALIDATION_COMMANDS) {
    const { key, cmd, args, timeoutMs: perCommandTimeoutMs } = spec;
    if (rungs && !rungs.includes(key)) {
      const reason = "not in this lane's validation ladder";
      results[key] = { ok: true, skipped: true, reason };
      if (onEvent) onEvent({ type: "validation.command.skipped", data: { command: key, reason } });
      continue;
    }
    if (fastFailed) {
      const reason = "not run — an earlier validation command failed";
      results[key] = { ok: true, skipped: true, reason };
      if (onEvent) onEvent({ type: "validation.command.skipped", data: { command: key, reason } });
      continue;
    }
    const effectiveTimeoutMs = perCommandTimeoutMs != null ? perCommandTimeoutMs : timeoutMs;
    const targeted = key === "test" && hasTargets;
    const { cmd: runCmd, args: runArgs } = targeted ? targetedTestCommand(targetedFiles) : { cmd, args };
    // Progress events so a multi-minute suite reads as "lint running" on the
    // dashboard timeline instead of a session that looks silently stuck.
    if (onEvent) onEvent({ type: "validation.command.started", data: { command: key, timeoutMs: effectiveTimeoutMs, targeted } });
    const r = await run(runCmd, runArgs, { cwd, timeoutMs: effectiveTimeoutMs });
    const passed = r.status === 0 && !r.timedOut;
    if (!passed) ok = false;
    const excerpt = tailLines(
      `${r.stdout || ""}\n${r.stderr || ""}${r.timedOut ? `\n[validation "${key}" exceeded ${effectiveTimeoutMs}ms and was terminated]` : ""}`,
      EXCERPT_LINES,
    );
    results[key] = {
      ok: passed,
      ms: r.ms,
      timedOut: !!r.timedOut,
      excerpt,
      failureCount: passed ? 0 : countValidationFailures({ ok: false, excerpt }),
      ...(targeted ? { targeted: true } : {}),
    };
    if (onEvent) onEvent({ type: "validation.command.finished", data: { command: key, ok: passed, ms: r.ms, timedOut: !!r.timedOut } });
    if (!passed) fastFailed = true; // don't burn time on later commands once one has failed
  }
  return { ok, results };
}

// ---- capability skill paths ----

function skillPaths(packet) {
  return (packet.skills || []).map((s) => s.path);
}

/**
 * DLV-45 — FAST's context ceremony, and why it had to shrink.
 *
 * FAST was a lane in name only where *context* was concerned: every lane sent
 * DISCOVERY the same mandated reading list — all four campaign docs
 * ("read by path"), every skill the classifier attached ("do not skip"), and
 * CLAUDE.md ("Do not skip it because it wasn't force-loaded"). On BUD-14 that
 * was ~8 tool calls and ~55K tokens of doctrine before the agent was allowed to
 * look at the one line it had been asked to change — against FAST's own
 * `maxInternalTurns: 8`. The phase could not physically finish: the real
 * session was cut off at internal turn 9, in the exact turn where it had
 * already found `QUICK_AMOUNTS` at line 1144. FAST wasn't expensive *and*
 * broken by coincidence; it was broken *because* it was expensive.
 *
 * So on FAST the reading list is scoped to what a small, already-located change
 * actually needs:
 *   - campaign strategy docs: dropped. A one-file change does not need the
 *     campaign's Feature State / Vision / Action Plan / Checklist; the item
 *     itself (with its file:line pointer) is in the packet header already.
 *   - skills: only those attached by a *risk flag* (an optional capability).
 *     The always-on `code-review` row's `finish-task` skill is dropped here
 *     because REVIEWING reads it by its own path anyway (`dodSkillPath`), so
 *     nothing is lost — it was simply being read twice, a phase early.
 *   - CLAUDE.md: dropped in DISCOVERY/PLAN, which produce prose, and **kept in
 *     BUILDING**, which writes code. House rules bind where edits happen; a
 *     read-only scoping pass does not need the full rule set re-read, and any
 *     UI/money hard rules that do matter arrive via the retained risk-flag
 *     skills.
 * STANDARD and DEEP are untouched — a lane that trades context for speed is
 * exactly what FAST is for, and the other two exist for when you don't want it.
 */
const ALWAYS_ON_SKILL_CAPABILITIES = Object.freeze(new Set(["automated-testing", "code-review", "uat-generation"]));

function packetLane(packet) {
  return (packet.lanePolicy && packet.lanePolicy.lane) || null;
}

function isFastLane(packet) {
  return packetLane(packet) === "FAST";
}

/** DLV-62: did this launch resolve to the merged DISCOVERY+PLAN shape? */
function isMergedDiscoveryPlan(packet) {
  return !!(packet.lanePolicy && packet.lanePolicy.mergedDiscoveryPlan);
}

/** Skills attached by a risk flag (optional capability), not by an always-on row. */
function riskFlagSkillPaths(packet) {
  return (packet.skills || [])
    .filter((s) => !ALWAYS_ON_SKILL_CAPABILITIES.has(s.capability))
    .map((s) => s.path);
}

/** Size a read-by-path source without reading it — a stat, never a load. */
function sourceTokensEst(repoRoot, relPath) {
  try {
    const stat = lstatSync(join(repoRoot, relPath));
    return tokensForBytes(stat.size);
  } catch {
    // A path that cannot be sized (missing, or outside the repo) is treated as
    // free rather than as infinite: refusing to load a file because we failed
    // to stat it would be a worse failure than loading it unbudgeted.
    return 0;
  }
}

/** The configured token budget for this lane/phase, or null when unbudgeted. */
function contextBudgetFor(packet, phase, deliveryConfig) {
  const lane = String(packetLane(packet) || "").toLowerCase();
  const budgets = (deliveryConfig && deliveryConfig.context && deliveryConfig.context.laneBudgets) || null;
  const laneBudgets = budgets && budgets[lane];
  if (!laneBudgets) return null;
  const value = laneBudgets[phase];
  return typeof value === "number" && value > 0 ? value : null;
}

/**
 * The mandated reading list for one phase: narrowed by lane (DLV-45), then
 * budgeted by token cost with the drops recorded (DLV-8).
 *
 * The two are deliberately separate steps. The lane rule is editorial — "a FAST
 * session has no business reading campaign strategy docs" — and applies however
 * small those docs happen to be. The budget is arithmetic, and catches the case
 * the editorial rule cannot see: a STANDARD session whose skills and campaign
 * docs have quietly grown past what a phase can afford.
 *
 * @param {object} packet
 * @param {string} phase - discovery | plan | building | review
 * @param {{repoRoot?:string, deliveryConfig?:object}} [opts]
 */
function phaseContextPolicy(packet, phase, { repoRoot = null, deliveryConfig = null } = {}) {
  const fast = isFastLane(packet);
  const campaignFilePaths = fast ? [] : (packet.context && packet.context.campaignFiles) || [];
  const skills = fast ? riskFlagSkillPaths(packet) : skillPaths(packet);
  const includeDoctrine = fast ? phase === "building" : true;

  const budgetTokens = contextBudgetFor(packet, phase, deliveryConfig);
  if (!budgetTokens || !repoRoot) {
    return { campaignFilePaths, skillPaths: skills, includeDoctrine, drops: [], budgetTokens: budgetTokens || null };
  }

  const sources = [
    ...skills.map((path) => ({ kind: "skill", path, tokensEst: sourceTokensEst(repoRoot, path) })),
    ...campaignFilePaths.map((path) => ({ kind: "campaign", path, tokensEst: sourceTokensEst(repoRoot, path) })),
  ];
  const { kept, dropped } = applyContextBudget({ sources, budgetTokens });
  const keptPaths = new Set(kept.map((s) => s.path));
  return {
    campaignFilePaths: campaignFilePaths.filter((p) => keptPaths.has(p)),
    skillPaths: skills.filter((p) => keptPaths.has(p)),
    includeDoctrine,
    drops: dropped,
    budgetTokens,
  };
}

/**
 * DLV-8: persist what this turn was actually told to read, next to the prompt
 * it was told it in. Written per turn under `transcript/context/` so a turn's
 * context can be audited against its own usage record rather than re-derived
 * from config months later.
 */
function recordContextManifest(sessionDir, packet, phase, policy, turnId, promptText) {
  const manifest = buildContextManifest({
    turnId,
    phase,
    lane: packetLane(packet),
    packetPath: `.delivery/sessions/${packet.sessionId}/packet.json`,
    kept: [
      ...policy.skillPaths.map((path) => ({ kind: "skill", path, tokensEst: 0 })),
      ...policy.campaignFilePaths.map((path) => ({ kind: "campaign", path, tokensEst: 0 })),
      ...(policy.includeDoctrine ? [{ kind: "doctrine", path: "CLAUDE.md", tokensEst: 0 }] : []),
    ],
    dropped: policy.drops || [],
    budgetTokens: policy.budgetTokens || null,
    promptTokensEst: estimateTokens(promptText || ""),
  });
  try {
    atomicWriteJsonSync(join(sessionPaths(sessionDir).transcript, "context", `${turnId || "unknown"}.json`), manifest);
  } catch {
    /* the manifest is a record, never a precondition for running the turn */
  }
  if ((policy.drops || []).length) {
    emitEvent(sessionDir, {
      type: "context.dropped",
      phase: phase.toUpperCase(),
      data: { budgetTokens: policy.budgetTokens, dropped: policy.drops.map((d) => ({ kind: d.kind, path: d.path, tokensEst: d.tokensEst })) },
    });
  }
  return manifest;
}

// ---- artifact templates ----

/** DLV-7: the measured scope block, rendered only when DISCOVERY reported one. */
function renderScopeSection(spec) {
  const estimate = normalizeScopeEstimate(spec.scopeEstimate);
  if (!estimate) return [];
  const decomposition = normalizeDecomposition(spec.decomposition);
  return [
    "## Measured scope",
    `- Files: ${estimate.files == null ? "(not reported)" : estimate.files}`,
    `- Occurrences: ${estimate.occurrences == null ? "(not reported)" : estimate.occurrences}`,
    `- Modules: ${estimate.modules == null ? "(not reported)" : estimate.modules}`,
    ...(estimate.note ? [`- Note: ${estimate.note}`] : []),
    "",
    ...(decomposition
      ? [
          "## Proposed decomposition",
          ...decomposition.flatMap((slice, i) => [
            `${i + 1}. **${slice.title}**${slice.rationale ? ` — ${slice.rationale}` : ""}`,
            ...(slice.acceptanceCriteriaIds.length ? [`   - covers: ${slice.acceptanceCriteriaIds.join(", ")}`] : []),
          ]),
          "",
        ]
      : []),
  ];
}

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
    ...renderScopeSection(spec),
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

function renderValidationReportMd(validation, delta = null) {
  const lines = [
    "# Validation report",
    "",
    `Overall: ${validation.ok || (delta && delta.passesDelta) ? "PASS" : "FAIL"}${
      !validation.ok && delta && delta.passesDelta ? " (delta vs acknowledged baseline)" : ""
    }`,
    "",
    ...VALIDATION_COMMANDS.map(({ key }) => {
      const r = validation.results[key];
      // D10/DLV-11: a rung with no result at all (legacy validation.json
      // predating the always-record-every-rung fix) is rendered exactly like
      // a governed skip, never as if it simply didn't exist.
      if (!r || r.skipped) {
        return `## ${key}\nSKIPPED${r && r.reason ? ` — ${r.reason}` : ""}`;
      }
      const commandDelta = delta && delta.commandDeltas && delta.commandDeltas[key];
      const label = r.ok
        ? r.targeted
          ? "PASS (targeted)"
          : "PASS"
        : commandDelta && commandDelta.status === "baseline-equivalent"
          ? "PASS ON DELTA"
          : "FAIL";
      return `## ${key}\n${label} (${r.ms} ms)\n\n${BT3}\n${r.excerpt}\n${BT3}`;
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

/**
 * When the workspace is already dirty at session start (uncommitted changes
 * this session didn't make — e.g. other in-progress work), capture one
 * validation run before DISCOVERY begins so VALIDATING can later tell a
 * failure this session caused apart from one that was already broken (see
 * validation-baseline.mjs). Skipped on a clean tree — there's nothing to
 * baseline against, and every failure is attributable by construction.
 */
async function handleSelected({ sessionDir, state, config }) {
  let working = state;
  const dirtyAtStart = !!(state.workspace && state.workspace.dirtyAtStart);
  if (dirtyAtStart && !(state.workspace && state.workspace.baselineValidation)) {
    const runValidation = (config && config.runValidation) || runValidationCommands;
    const timeoutMs = config.deliveryConfig && config.deliveryConfig.budgets && config.deliveryConfig.budgets.validationTimeoutMs;
    // Surfaced so the timeline explains the (possibly multi-minute) wait — the
    // tree was dirty at launch, so the baseline validation runs before DISCOVERY.
    emitEvent(sessionDir, { type: "validation.baseline.started", phase: "SELECTED", data: {} });
    const baseline = await runValidation({
      cwd: config.repoRoot,
      timeoutMs,
      onEvent: (e) => emitEvent(sessionDir, { ...e, phase: "SELECTED" }),
    });
    writeArtifactJson(sessionDir, "validation-baseline.json", baseline);
    emitEvent(sessionDir, { type: "validation.baseline.captured", phase: "SELECTED", data: { ok: baseline.ok } });
    working = { ...state, workspace: { ...state.workspace, baselineValidation: baseline } };
  }
  const result = smNext(working.state, "baseline.captured");
  const newState = { ...working, state: result.to, awaiting: null };
  emitEvent(sessionDir, { type: "phase.transition", phase: "SELECTED", data: { to: result.to } });
  return newState;
}

async function handleDiscovery({ sessionDir, state, packet, driver, repoRoot, config }) {
  state = maybeRotateAtPhaseBoundary({ sessionDir, state, packet, deliveryConfig: config.deliveryConfig, phase: "discovery" });
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

  // DISCOVERY is the one phase with no existing turn-count backstop
  // (BUILDING/REVIEWING already cap via maxFixLoops) — a chain of
  // question-raised round-trips could otherwise re-enter it indefinitely.
  const discoveryTurnCount = state.discoveryTurnCount || 0;
  if (isDiscoveryTurnLimitReached(discoveryTurnCount, (config.deliveryConfig && config.deliveryConfig.budgets) || {})) {
    return blockFrom(sessionDir, state, "DISCOVERY", {
      error: new Error(
        `DISCOVERY has run ${discoveryTurnCount} turns without reaching a written spec — this usually means questions keep getting raised faster than they converge. Raise budgets.maxTurnsPerPhase.discovery in .delivery/config.json if this is genuinely expected, or add owner guidance to steer it, then Retry.`,
      ),
      errorKind: "phase-turn-limit",
    });
  }

  const handle = setup.handle;
  let working = persistNewDriverRef(sessionDir, state, withDriverRef(state, handle));
  const { texts: drainedMessages, lastSeq } = drainMessages(sessionDir, working);
  const pendingGuidance = working.pendingGuidance || [];
  const ownerMessages = [...pendingGuidance, ...drainedMessages];
  working = { ...working, pendingGuidance: [] };
  // DLV-45 lane narrowing + DLV-8 token budget — see phaseContextPolicy.
  const discoveryContext = phaseContextPolicy(packet, "discovery", { repoRoot, deliveryConfig: config.deliveryConfig });
  // DLV-62: on FAST with a single named file, this turn also produces the plan.
  const merged = isMergedDiscoveryPlan(packet);
  const maxPlanSteps = (config.deliveryConfig && config.deliveryConfig.budgets && config.deliveryConfig.budgets.maxPlanSteps) || null;
  const prompt = buildDiscoveryPrompt({
    packet,
    campaignFilePaths: discoveryContext.campaignFilePaths,
    skillPaths: discoveryContext.skillPaths,
    includeDoctrine: discoveryContext.includeDoctrine,
    ownerMessages,
    includePlan: merged,
    maxPlanSteps: merged ? maxPlanSteps : null,
  });
  recordContextManifest(sessionDir, packet, "discovery", discoveryContext, formatTurnId((working.turnCounter || 0) + 1), prompt);
  // Strategy reflects whether a driver ref existed BEFORE this handler ran —
  // `working` already carries the ref getGuardedHandle just established/
  // resumed this call, so it would always read "resume-native".
  const tc = turnContext({ state, packet, deliveryConfig: config.deliveryConfig });
  const turn = await runGuardedTurn({
    sessionDir,
    driver,
    handle,
    prompt,
    phase: "DISCOVERY",
    agent: "orchestrator",
    outputSchema: merged ? MERGED_SPEC_PLAN_SCHEMA : SPEC_OUTPUT_SCHEMA,
    repoRoot,
    guardMode: "readonly",
    takeSnapshot: config.takeSnapshot,
    forbiddenPaths,
    effort: phaseEffort(state, packet, "discovery"),
    maxTurns: packetMaxInternalTurns(packet),
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
    abortPollMs: config.abortPollMs,
    ...errorRetryOptions(config.deliveryConfig),
    ...tc,
  });
  working = {
    ...working,
    messagesProcessed: lastSeq,
    turnCounter: (working.turnCounter || 0) + 1,
    discoveryTurnCount: discoveryTurnCount + 1,
    execution: clearConfigOverrideFlag(working.execution),
  };
  if (!turn.ok) return blockFrom(sessionDir, working, "DISCOVERY", turn);

  working = { ...working, usage: accumulateUsage(working, "discovery", turn.usageV2, turn.usage.costUsd) };
  working = withContextOccupancy(working, "discovery", turn.usageV2, tc.windowTokens);
  let spec;
  let mergedPlan = null;
  try {
    spec = parseSpecOutput(turn.finalText);
    if (merged) {
      // Validated through `parsePlanOutput`, the same function the two-turn
      // path uses — a merged plan that skipped that check would be a second,
      // weaker contract for the artifact the PLAN gate approves.
      const raw = JSON.parse(turn.finalText);
      if (!raw.plan) throw new RunnerError("merged DISCOVERY+PLAN output is missing the required `plan` object");
      mergedPlan = parsePlanOutput(JSON.stringify(raw.plan));
    }
  } catch (error) {
    return blockFrom(sessionDir, working, "DISCOVERY", { error });
  }
  writeArtifactJson(sessionDir, "spec.json", spec);
  writeArtifactText(sessionDir, "spec.md", renderSpecMd(spec));

  // DW-5: seed the durable ledger's objective/requirements from the spec,
  // and raise a ledger-tracked blocking question per openQuestions entry —
  // the ids returned here are threaded into `awaiting.questions` so the
  // owner's eventual gate answer can be matched back to these records.
  const specLedger = applySpec(loadLedger(sessionDir), spec, {
    itemText: packet.item.text,
    turnId: turn.turnId,
  });
  writeLedger(sessionDir, specLedger.ledger);

  if ((spec.openQuestions || []).length) {
    const result = smNext(working.state, "question.raised");
    const questions = spec.openQuestions.map((q, i) => ({ text: q.text, id: specLedger.questionIds[i] }));
    emitEvent(sessionDir, { type: "question.raised", phase: "DISCOVERY", data: { questions } });
    return {
      ...working,
      state: result.to,
      awaiting: { gate: "question", returnTo: "DISCOVERY", questions },
    };
  }
  // DLV-7: the scope tripwire. Computed here — at the one moment the session
  // has a *measured* scope and has not yet spent a build turn on it — and
  // stamped onto `awaiting` so it is on the panel the owner is already looking
  // at. BUD-11's spec measured 72 occurrences across 25 files on an item filed
  // as S and nothing anywhere objected.
  const scopeVerdict = buildScopeVerdict({
    estimate: spec.scopeEstimate,
    itemEffort: packet.item && packet.item.effort,
    thresholds: (config.deliveryConfig && config.deliveryConfig.scope && config.deliveryConfig.scope.thresholds) || undefined,
    lane: packetLane(packet),
  });
  const decomposition = scopeVerdict.mismatch ? normalizeDecomposition(spec.decomposition) : null;

  // DLV-9: the same measurement, applied to the *other* launch-time guess —
  // the model. Both guards read the one number DISCOVERY just produced, so they
  // are computed together and land on the same gate.
  const fit = reassessFitAfterDiscovery({
    item: packet.item,
    capabilities: packet.capabilities,
    scopeHints: packet.scopeHints,
    provider: (working.execution && working.execution.provider) || packet.agent,
    config: config.deliveryConfig,
    measuredSizeClass: scopeVerdict.sizeClass,
    currentModel: (working.execution && working.execution.model) || (packet.agentConfig && packet.agentConfig.model) || null,
  });
  if (fit.mismatch) {
    emitEvent(sessionDir, {
      type: "recommendation.updated",
      phase: "DISCOVERY",
      data: {
        measuredSizeClass: fit.measuredSizeClass,
        currentTier: fit.currentTier,
        recommendedTier: fit.recommendedTier,
        recommendedModel: fit.recommendedModel,
      },
    });
  }

  const scope = {
    ...scopeVerdict,
    decomposition,
    fit,
    source: "discovery",
    turnId: turn.turnId || null,
    acknowledged: false,
    acknowledgedAt: null,
    selectedSlice: null,
  };
  writeArtifactJson(sessionDir, "scope.json", scope);
  emitEvent(sessionDir, {
    type: scopeVerdict.mismatch ? "scope.mismatch" : "scope.measured",
    phase: "DISCOVERY",
    data: {
      sizeClass: scopeVerdict.sizeClass,
      itemSizeClass: scopeVerdict.itemSizeClass,
      estimate: scopeVerdict.estimate,
      decompositionSlices: decomposition ? decomposition.length : 0,
    },
  });

  // DLV-62: the plan is persisted only once the spec is actually going to the
  // gate. A discovery turn that ends in open questions will be re-run, and a
  // plan written from a superseded spec is worse than no plan at all.
  if (mergedPlan) {
    writeArtifactJson(sessionDir, "plan.json", mergedPlan);
    writeArtifactText(sessionDir, "plan.md", renderPlanMd(mergedPlan));
    const planLedger = applyPlan(loadLedger(sessionDir), mergedPlan, { turnId: turn.turnId });
    writeLedger(sessionDir, planLedger.ledger);
    emitEvent(sessionDir, {
      type: "plan.merged",
      phase: "DISCOVERY",
      data: { steps: (mergedPlan.steps || []).length, reason: (packet.lanePolicy && packet.lanePolicy.mergedDiscoveryPlanReason) || null },
    });
  }

  const result = smNext(working.state, "spec.written");
  emitEvent(sessionDir, { type: "phase.transition", phase: "DISCOVERY", data: { to: result.to } });
  return {
    ...working,
    scope,
    // Consumed by `consumeSpecDecision` to skip the separate PLAN turn exactly
    // once. Cleared on a plan rejection so "revise the plan" runs a real PLAN
    // turn rather than re-approving the same merged plan forever (DLV-53).
    ...(mergedPlan ? { mergedPlanPending: true } : {}),
    state: result.to,
    awaiting: {
      gate: GATES[result.to] || "spec",
      // Attached only when DISCOVERY actually measured something. `scopeEstimate`
      // is required by SPEC_OUTPUT_SCHEMA, so every real turn reports it — but a
      // spec that predates the field (or any fixture) would otherwise put a
      // wholly uninformative "not reported" block on the gate, and `state.scope`
      // + `artifacts/scope.json` already record the absence for the audit trail.
      ...(scope.sizeClass || scope.mismatch ? { scope } : {}),
      ...(scopeVerdict.mismatch || fit.mismatch
        ? { warnings: [scopeVerdict.mismatch ? scopeVerdict.reason : null, fit.message].filter(Boolean) }
        : {}),
    },
  };
}

/**
 * DW-10: an owner-aborted turn's response is lost outright — say so plainly
 * (not a generic "error") and, when the aborted turn touched files (a
 * BUILDING abort), name them: the workspace is never rolled back, so this is
 * the owner's only signal of what to check before retrying the phase.
 */
function describeBlockedTurn(turn) {
  if (turn.aborted) {
    const changed = turn.changedPaths || [];
    const delta = changed.length
      ? ` The workspace was not rolled back — ${changed.length} file(s) changed before the abort: ${changed.join(", ")}. Review the diff (or run validation) before retrying.`
      : " No workspace changes were made before the abort.";
    return `Turn aborted by owner.${delta}`;
  }
  return String((turn.error && turn.error.message) || turn.error || "");
}

// Maps a machine-readable `turn.errorKind` to the `awaiting.reason` the gate
// UI/decision handling uses to distinguish "never worth an immediate Retry"
// blocks (quota exhaustion, a budget cap, a runaway-phase turn limit) from an
// ordinary blocked turn. Unlisted/absent kinds omit `reason` entirely, so
// existing callers that assert the plain `{gate, returnTo}` shape (from
// before any of these kinds existed) are unaffected.
const BLOCK_REASON_BY_ERROR_KIND = Object.freeze({
  quota: "quota-paused",
  auth: "quota-paused",
  "budget-exceeded": "budget-exceeded",
  "phase-turn-limit": "phase-turn-limit",
  "pre-existing-failure": "pre-existing-failure",
});

// DLV-44: error kinds that must reach the owner as a *decision* rather than
// dead-end in BLOCKED, because the fix is an owner choice the runner cannot
// make for itself. `retry-exhausted` was the only member; `max-turns` joins it
// because hitting the lane's internal-turn ceiling is a sizing verdict (raise
// the cap, or narrow the mandated reading), not a fault to wait out.
const ESCALATING_ERROR_KINDS = Object.freeze(new Set(["retry-exhausted", "max-turns"]));

const ESCALATION_QUESTION_BY_ERROR_KIND = Object.freeze({
  "retry-exhausted": "Automatic retries are exhausted. Provide the next-step decision before this phase can continue.",
  "max-turns":
    "This phase hit the lane's internal-turn ceiling (maxInternalTurns) before it finished. Retrying as-is will hit the same ceiling. " +
    "Either raise the lane's maxInternalTurns in .delivery/config.json, or reply with guidance that narrows what this phase must read/do, then Retry.",
});

function blockFrom(sessionDir, state, fromPhase, turn) {
  const errorKind = turn.errorKind || null;
  const escalated = ESCALATING_ERROR_KINDS.has(errorKind);
  const result = smNext(fromPhase, escalated ? "question.raised" : "error.fatal");
  const message = describeBlockedTurn(turn);
  const resetsAt = turn.resetsAt || null;
  const reason = errorKind ? BLOCK_REASON_BY_ERROR_KIND[errorKind] || null : null;
  // DLV-43: the single choke point every phase handler funnels a failed turn
  // through, and therefore the one place that has to bank what that failed
  // turn spent. Doing it here rather than in each handler's `if (!turn.ok)`
  // line is what makes the accounting exhaustive by construction — the whole
  // bug was that spend was recorded only on the success path.
  const base = turn.usageV2
    ? {
        ...state,
        usage: accumulateUsage(state, canonicalPhaseKey(fromPhase), turn.usageV2, turn.usage ? turn.usage.costUsd : null),
      }
    : state;
  emitEvent(sessionDir, {
    type: "error.fatal",
    phase: fromPhase,
    data: {
      gitViolation: !!turn.gitViolation,
      violations: turn.violations || [],
      message,
      aborted: !!turn.aborted,
      ...(errorKind ? { errorKind } : {}),
      ...(resetsAt ? { resetsAt } : {}),
    },
  });
  if (escalated) {
    emitEvent(sessionDir, {
      type: "notification.requested",
      phase: fromPhase,
      data: {
        reason: errorKind,
        returnTo: fromPhase,
        retryCount: turn.retryCount || 0,
        message,
        finishPackage: "artifacts/finish/summary.md",
      },
    });
    // DLV-12: an escalation is a paused exit — the owner is now the only thing
    // that can move it — so it gets the same finish package a terminal exit does.
    writeFinishPackage(sessionDir, { ...base, state: result.to }, loadPacket(sessionDir), "needs-decision");
    return {
      ...base,
      state: result.to,
      awaiting: {
        gate: "question",
        returnTo: fromPhase,
        reason: errorKind,
        questions: [
          {
            id: errorKind === "max-turns" ? "max-turns-escalation" : "retry-escalation",
            text: ESCALATION_QUESTION_BY_ERROR_KIND[errorKind] || ESCALATION_QUESTION_BY_ERROR_KIND["retry-exhausted"],
          },
        ],
      },
      lastError: { phase: fromPhase, gitViolation: !!turn.gitViolation, violations: turn.violations || [], message, aborted: !!turn.aborted, errorKind, resetsAt },
    };
  }
  const blocked = {
    ...base,
    state: result.to,
    awaiting: reason ? { gate: "blocked", returnTo: fromPhase, reason } : { gate: "blocked", returnTo: fromPhase },
    lastError: {
      phase: fromPhase,
      gitViolation: !!turn.gitViolation,
      violations: turn.violations || [],
      message,
      aborted: !!turn.aborted,
      errorKind,
      resetsAt,
    },
  };
  writeFinishPackage(sessionDir, blocked, loadPacket(sessionDir), reason === "budget-exceeded" ? "budget-exhausted" : "blocked");
  return blocked;
}

/** DLV-10: the matrix in both machine- and human-readable form, rewritten on every reconciliation. */
function writeAcceptanceArtifacts(sessionDir, matrix) {
  writeArtifactJson(sessionDir, "acceptance.json", matrix || []);
  writeArtifactText(sessionDir, "acceptance.md", renderAcceptanceMd(matrix || []));
}

/**
 * DLV-10: the facts the runner owns, against which an agent's AC claims are
 * checked. Deliberately assembled from artifacts the runner itself wrote
 * (`validation.json`) and state it itself tracked (`workspace.changedFiles`) —
 * never from anything the agent said in the same breath as the claim.
 */
function acceptanceFacts(sessionDir, state, repoRoot, turnId) {
  const validation = readJsonIfExists(artifactPath(sessionDir, "validation.json"));
  const results = (validation && validation.results) || {};
  const passingRungs = Object.entries(results)
    .filter(([, r]) => r && r.ok && !r.skipped)
    .map(([key]) => key);
  // `passes` (not `ok`) is the right gate: a red *baseline* that the delta
  // check cleared is a pass for this session's purposes (DLV-5), and treating
  // it as a failure would make every session on a red baseline unable to
  // evidence a single AC.
  const validationPassed = validation ? !!validation.passes : undefined;
  return {
    turnId: turnId || null,
    validationPassed,
    passingRungs,
    changedFiles: (state.workspace && state.workspace.changedFiles) || [],
    fileExists: (p) => {
      if (!p || p.includes("..")) return false;
      try {
        return existsSync(join(repoRoot, p)) || existsSync(join(sessionDir, p));
      } catch {
        return false;
      }
    },
  };
}

/**
 * Apply a turn's AC claims and persist the result. Returns the updated state.
 * Emits one event per downgrade, because a downgrade is the interesting thing:
 * it is the exact moment an agent's "✅ done" was checked and found wanting.
 */
function withReconciledAcceptance(sessionDir, state, claims, repoRoot, turnId, phase) {
  if (!state.acceptance || !state.acceptance.length) return state;
  const { matrix, downgraded } = reconcileAcceptance(
    state.acceptance,
    claims,
    acceptanceFacts(sessionDir, state, repoRoot, turnId),
  );
  writeAcceptanceArtifacts(sessionDir, matrix);
  for (const d of downgraded) {
    emitEvent(sessionDir, {
      type: "acceptance.claim.rejected",
      phase,
      data: { id: d.id, claimed: d.claimed, actual: d.actual, reason: d.reason },
    });
  }
  emitEvent(sessionDir, { type: "acceptance.updated", phase, data: summarizeAcceptance(matrix) });
  return { ...state, acceptance: matrix };
}

/**
 * DLV-7: apply the owner's answer to a scope mismatch when the spec gate is
 * approved. Returns the (possibly narrowed) AC list plus the updated scope
 * record. Never throws and never refuses — the *server* is the enforcement
 * point for "you must answer the mismatch before approving" (same shape as the
 * dirty-tree / red-baseline / triage acknowledgments), because a runner that
 * refuses an already-written decision strands the session at a gate with no way
 * forward, which is exactly the DLV-53 failure.
 */
function resolveScopeAtSpecGate({ sessionDir, state, spec, decision, acceptanceCriteria }) {
  let scope = state.scope || readJsonIfExists(artifactPath(sessionDir, "scope.json")) || null;
  if (!scope) return { acceptanceCriteria, scope };

  const at = new Date().toISOString();

  // DLV-9: approving the spec while a model-fit warning is showing IS the
  // acknowledgment — the warning is on that panel, and there is no other way
  // past it. Recorded rather than merely dismissed, so a session that overran
  // on an under-powered model can be traced to the moment it was allowed to.
  if (scope.fit && scope.fit.mismatch && !scope.fitAcknowledgedAt) {
    emitEvent(sessionDir, {
      type: "recommendation.acknowledged",
      phase: "SPEC_READY",
      data: { currentTier: scope.fit.currentTier, recommendedTier: scope.fit.recommendedTier },
    });
    scope = { ...scope, fitAcknowledgedAt: at };
    writeArtifactJson(sessionDir, "scope.json", scope);
  }

  if (!scope.mismatch) return { acceptanceCriteria, scope };
  const slices = scope.decomposition || [];
  const sliceIndex = Number.isInteger(decision.scopeSlice) ? decision.scopeSlice : null;
  const slice = sliceIndex != null && sliceIndex >= 1 && sliceIndex <= slices.length ? slices[sliceIndex - 1] : null;

  if (!slice) {
    // Proceed at full measured scope, on the record.
    emitEvent(sessionDir, {
      type: "scope.mismatch.acknowledged",
      phase: "SPEC_READY",
      data: { sizeClass: scope.sizeClass, itemSizeClass: scope.itemSizeClass, slice: null },
    });
    const resolved = { ...scope, acknowledged: true, acknowledgedAt: at, selectedSlice: null };
    writeArtifactJson(sessionDir, "scope.json", resolved);
    return { acceptanceCriteria, scope: resolved };
  }

  // Narrow this session to the chosen slice. Unmatched ids are dropped from the
  // narrowing rather than silently widening it back to everything — a slice
  // naming an AC that does not exist is a spec bug, and building the whole
  // thing "because the filter matched nothing" is the failure mode to avoid.
  const wanted = new Set(slice.acceptanceCriteriaIds || []);
  const narrowed = wanted.size ? acceptanceCriteria.filter((ac) => ac && wanted.has(ac.id)) : acceptanceCriteria;
  const deferred = slices.filter((_, i) => i !== sliceIndex - 1);

  writeArtifactJson(sessionDir, "decomposition-proposal.json", {
    v: 1,
    at,
    campaign: (state.workspace && state.workspace.campaign) || null,
    measured: { sizeClass: scope.sizeClass, itemSizeClass: scope.itemSizeClass, estimate: scope.estimate },
    selected: { index: sliceIndex, title: slice.title, acceptanceCriteriaIds: [...wanted] },
    // These are *candidates*, not filed items: the owner files them (or not)
    // from the Inbox. The runner never writes PM markdown — see DLV-14 for the
    // one governed writeback path that does.
    deferred: deferred.map((s) => ({ title: s.title, rationale: s.rationale, acceptanceCriteriaIds: s.acceptanceCriteriaIds })),
    fullAcceptanceCriteria: acceptanceCriteria,
  });
  emitEvent(sessionDir, {
    type: "scope.decomposed",
    phase: "SPEC_READY",
    data: { slice: sliceIndex, title: slice.title, keptAcs: narrowed.length, deferredSlices: deferred.length },
  });

  const resolved = {
    ...scope,
    acknowledged: true,
    acknowledgedAt: at,
    selectedSlice: { index: sliceIndex, title: slice.title },
  };
  writeArtifactJson(sessionDir, "scope.json", resolved);
  return { acceptanceCriteria: narrowed, scope: resolved };
}

async function consumeSpecDecision({ sessionDir, state, packet, driver, repoRoot, decision, config }) {
  if (decision.decision === "reject") {
    const result = smNext(state.state, "decision.reject");
    emitEvent(sessionDir, { type: "decision.consumed", phase: "SPEC_READY", data: { decision: "reject", note: decision.note } });
    updateLedger(sessionDir, (ledger) =>
      applyDecision(ledger, { id: `d-${decision.seq}`, gate: "spec", decision: "reject", note: decision.note, phase: "SPEC_READY" }),
    );
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
  let acceptanceCriteria = spec.acceptanceCriteria || newPacket.acceptanceCriteria || [];

  // DLV-7: resolve the scope contract at the moment of approval. Two owner
  // answers are possible and both are audited: take one decomposition slice
  // (this session narrows to it, the rest become proposed follow-up items), or
  // acknowledge the mismatch and build the whole measured scope as specified.
  const scopeResolution = resolveScopeAtSpecGate({ sessionDir, state, spec, decision, acceptanceCriteria });
  acceptanceCriteria = scopeResolution.acceptanceCriteria;
  state = { ...state, scope: scopeResolution.scope };

  newPacket = { ...newPacket, acceptanceCriteria };
  atomicWriteJsonSync(sessionPaths(sessionDir).packet, newPacket);

  // DLV-10: seed the AC coverage matrix here — the one moment the AC list is
  // final (the spec is approved, and DLV-7's narrowing has already applied).
  // Every AC starts `unmet`: nothing is presumed done, and the only way out of
  // `unmet` is evidence the runner itself can confirm.
  state = { ...state, acceptance: initAcceptance(acceptanceCriteria) };
  writeAcceptanceArtifacts(sessionDir, state.acceptance);

  // DLV-62: on a merged FAST session the plan already exists — it was produced
  // by the same turn as the spec — so approving the spec advances straight to
  // the PLAN gate instead of paying for a second full-context turn to
  // re-derive it. The gate itself is untouched: the owner still approves the
  // plan, and still approves the UAT package after that.
  if (state.mergedPlanPending) {
    const existingPlan = readJsonIfExists(artifactPath(sessionDir, "plan.json"));
    if (existingPlan) {
      emitEvent(sessionDir, { type: "decision.consumed", phase: "SPEC_READY", data: { decision: "approve", mergedPlan: true } });
      updateLedger(sessionDir, (ledger) =>
        applyDecision(ledger, { id: `d-${decision.seq}`, gate: "spec", decision: "approve", note: decision.note, phase: "SPEC_READY" }),
      );
      const stepCount = (existingPlan.steps || []).length;
      const overCap = isPlanStepCountOverCap(stepCount, (config.deliveryConfig && config.deliveryConfig.budgets) || {});
      if (overCap) {
        emitEvent(sessionDir, {
          type: "plan.step_count.warning",
          phase: "SPEC_READY",
          data: { stepCount, maxPlanSteps: config.deliveryConfig.budgets.maxPlanSteps },
        });
      }
      const approved = smNext(state.state, "decision.approve");
      emitEvent(sessionDir, { type: "phase.transition", phase: "SPEC_READY", data: { to: approved.to } });
      return {
        newState: {
          ...state,
          mergedPlanPending: false,
          state: approved.to,
          awaiting: {
            gate: GATES[approved.to] || "plan",
            ...(overCap
              ? {
                  warnings: [
                    `This plan has ${stepCount} steps against a budget of ${config.deliveryConfig.budgets.maxPlanSteps}. ` +
                      `Each step is a separate full-context agent turn, so this is the largest single driver of session cost.`,
                  ],
                }
              : {}),
          },
        },
        newPacket,
      };
    }
    // The flag said a merged plan existed and the artifact does not. Fall
    // through to a normal PLAN turn rather than trusting the flag — a missing
    // artifact is a reason to do the work, not to skip it.
    state = { ...state, mergedPlanPending: false };
  }

  state = maybeRotateAtPhaseBoundary({ sessionDir, state, packet: newPacket, deliveryConfig: config.deliveryConfig, phase: "plan" });
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
  const { texts: drainedMessages, lastSeq } = drainMessages(sessionDir, working);
  // DLV-32: PLAN can now raise its own question (returnTo:"SPEC_READY",
  // above) — the owner's answer must reach the RETRY of this exact turn
  // when SPEC_READY is re-approved, or answering it would be dropped the
  // same way BUILDING/REVIEWING's answers used to be.
  const ownerMessages = [...(working.pendingGuidance || []), ...drainedMessages];
  working = { ...working, pendingGuidance: [] };
  const planContext = phaseContextPolicy(newPacket, "plan", { repoRoot, deliveryConfig: config.deliveryConfig });
  const prompt = buildPlanPrompt({
    packet: newPacket,
    approvalNote: decision.note || "",
    skillPaths: planContext.skillPaths,
    includeDoctrine: planContext.includeDoctrine,
    // DLV-55: state the ceiling to the planner instead of only warning about it
    // after the plan is already written and the money already committed.
    maxPlanSteps: (config.deliveryConfig && config.deliveryConfig.budgets && config.deliveryConfig.budgets.maxPlanSteps) || null,
    ownerMessages,
  });
  recordContextManifest(sessionDir, newPacket, "plan", planContext, formatTurnId((working.turnCounter || 0) + 1), prompt);
  const tc = turnContext({ state, packet: newPacket, deliveryConfig: config.deliveryConfig });
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
    effort: phaseEffort(state, newPacket, "plan"),
    maxTurns: packetMaxInternalTurns(newPacket),
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
    abortPollMs: config.abortPollMs,
    ...errorRetryOptions(config.deliveryConfig),
    ...tc,
  });
  working = {
    ...working,
    messagesProcessed: lastSeq,
    turnCounter: (working.turnCounter || 0) + 1,
    execution: clearConfigOverrideFlag(working.execution),
  };
  emitEvent(sessionDir, { type: "decision.consumed", phase: "SPEC_READY", data: { decision: "approve" } });
  updateLedger(sessionDir, (ledger) =>
    applyDecision(ledger, { id: `d-${decision.seq}`, gate: "spec", decision: "approve", note: decision.note, phase: "SPEC_READY" }),
  );
  if (!turn.ok) return { newState: blockFrom(sessionDir, working, "SPEC_READY", turn), newPacket };

  working = { ...working, usage: accumulateUsage(working, "plan", turn.usageV2, turn.usage.costUsd) };
  working = withContextOccupancy(working, "plan", turn.usageV2, tc.windowTokens);
  let plan;
  try {
    plan = parsePlanOutput(turn.finalText);
  } catch (error) {
    return { newState: blockFrom(sessionDir, working, "SPEC_READY", { error }), newPacket };
  }
  writeArtifactJson(sessionDir, "plan.json", plan);
  writeArtifactText(sessionDir, "plan.md", renderPlanMd(plan));
  // DLV-32: applyPlan also raises a ledger-tracked question per
  // plan.openQuestions entry now — direct call (not updateLedger) so the
  // returned questionIds can be threaded into awaiting.questions below,
  // matching how DISCOVERY's applySpec call already works.
  const planLedger = applyPlan(loadLedger(sessionDir), plan, { turnId: turn.turnId });
  writeLedger(sessionDir, planLedger.ledger);

  if ((plan.openQuestions || []).length) {
    const result = smNext(working.state, "question.raised");
    const questions = plan.openQuestions.map((q, i) => ({ text: q.text, id: planLedger.questionIds[i] }));
    emitEvent(sessionDir, { type: "question.raised", phase: "SPEC_READY", data: { questions } });
    // returnTo: SPEC_READY, not "PLAN" — there is no bare PLAN state; the
    // plan turn runs inside consuming a SPEC_READY "approve" decision, so
    // resuming means landing back on that same gate (re-armed below by
    // consumeQuestionDecision's GATES lookup) for the owner to approve
    // again with the answer now available via pendingGuidance.
    return {
      newState: { ...working, state: result.to, awaiting: { gate: "question", returnTo: "SPEC_READY", questions } },
      newPacket,
    };
  }

  // Backstop for the step budget now stated in the PLAN prompt itself (DLV-55's
  // `renderPlanStepBudget`) — each step is a separate full-context BUILDING
  // turn, so an over-budget plan is the single biggest predictor of a session
  // overrunning its cap. Still not a hard block: the owner may legitimately
  // want a long plan, and blocking would strand the session. But it no longer
  // lives only in the event log — it rides on `awaiting` so it is unmissable at
  // the plan gate, which is the last moment it can be acted on for free.
  const stepCount = (plan.steps || []).length;
  const overStepCap = isPlanStepCountOverCap(stepCount, (config.deliveryConfig && config.deliveryConfig.budgets) || {});
  if (overStepCap) {
    emitEvent(sessionDir, {
      type: "plan.step_count.warning",
      phase: "SPEC_READY",
      data: { stepCount, maxPlanSteps: config.deliveryConfig.budgets.maxPlanSteps },
    });
  }

  const result = smNext(working.state, "decision.approve");
  emitEvent(sessionDir, { type: "phase.transition", phase: "SPEC_READY", data: { to: result.to } });
  return {
    newState: {
      ...working,
      state: result.to,
      awaiting: {
        gate: GATES[result.to] || "plan",
        // DLV-55: surfaced on the gate the owner is actually looking at, not
        // buried in events.ndjson.
        ...(overStepCap
          ? {
              warnings: [
                `This plan has ${stepCount} steps against a budget of ${config.deliveryConfig.budgets.maxPlanSteps}. ` +
                  `Each step is a separate full-context agent turn (~$0.10-0.19 measured), so this is the largest ` +
                  `single driver of session cost. Reject and ask for fewer steps if any of them only re-verify the ` +
                  `spec or describe manual checks.`,
              ],
            }
          : {}),
      },
    },
    newPacket,
  };
}

function consumePlanDecision({ sessionDir, state, decision }) {
  if (decision.decision === "reject") {
    const result = smNext(state.state, "decision.reject");
    emitEvent(sessionDir, { type: "decision.consumed", phase: "PLAN_READY", data: { decision: "reject", note: decision.note } });
    updateLedger(sessionDir, (ledger) =>
      applyDecision(ledger, { id: `d-${decision.seq}`, gate: "plan", decision: "reject", note: decision.note, phase: "PLAN_READY" }),
    );
    return {
      ...state,
      state: result.to,
      // DLV-53: a rejected plan now lands back on the SPEC gate (see
      // state-machine.mjs), so the gate has to be re-armed rather than cleared —
      // `awaiting: null` on a gate state leaves the session parked with nothing
      // asking the owner for anything. Approving here runs a fresh PLAN turn,
      // which is what "revise the plan" means; the rejection note rides along as
      // guidance so that turn actually sees why the last plan was refused.
      awaiting: GATES[result.to] ? { gate: GATES[result.to], reason: "plan-rejected" } : null,
      pendingGuidance: [...(state.pendingGuidance || []), decision.note].filter(Boolean),
    };
  }
  const result = smNext(state.state, "decision.approve", {
    riskFlags: (readJsonIfExists(artifactPath(sessionDir, "plan.json")) || {}).riskFlags || [],
    confirmText: decision.confirmText,
  });
  const plan = readJsonIfExists(artifactPath(sessionDir, "plan.json")) || { steps: [] };
  emitEvent(sessionDir, { type: "decision.consumed", phase: "PLAN_READY", data: { decision: "approve" } });
  updateLedger(sessionDir, (ledger) =>
    applyDecision(ledger, {
      id: `d-${decision.seq}`,
      gate: "plan",
      decision: "approve",
      note: decision.note,
      typed: !!decision.confirmText,
      phase: "PLAN_READY",
    }),
  );
  // DLV-7: scope lock. What the owner just approved — the AC list and the union
  // of every step's declared paths — is frozen here, and BUILDING is checked
  // against it. Without this, the plan is a document the build phase is free to
  // ignore in either direction: BUD-11 both sprawled past it (25 files) and
  // silently descoped inside it (5 hooks of the 72 occurrences), and neither
  // showed up until a human read the build log.
  const scopeLock = buildScopeLock({ plan, spec: readJsonIfExists(artifactPath(sessionDir, "spec.json")) });
  emitEvent(sessionDir, {
    type: "scope.locked",
    phase: "PLAN_READY",
    data: { paths: scopeLock.paths.length, acs: scopeLock.acceptanceCriteriaIds.length, steps: scopeLock.stepIds.length },
  });

  return {
    ...state,
    state: result.to,
    awaiting: null,
    scopeLock,
    build: { mode: "plan", stepIndex: 0, totalSteps: (plan.steps || []).length },
  };
}

async function handleBuilding({ sessionDir, state, packet, driver, repoRoot, config }) {
  state = maybeRotateAtPhaseBoundary({ sessionDir, state, packet, deliveryConfig: config.deliveryConfig, phase: "building" });
  const build = state.build || { mode: "fix", stepIndex: 0, totalSteps: 1 };
  const handle = await getHandle({ driver, state, packet, repoRoot, mode: "build", phase: "building" });
  let working = withDriverRef(state, handle);
  const { texts: drainedMessages, lastSeq } = drainMessages(sessionDir, working);
  // DLV-32: pendingGuidance used to be read only by handleDiscovery — an
  // answer to a question raised during BUILDING (or, since D6, a UAT
  // rejection note) was written but never reached the next BUILDING prompt.
  const ownerMessages = [...(working.pendingGuidance || []), ...drainedMessages];
  working = { ...working, pendingGuidance: [] };

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

  // DLV-8: the one piece of replayed tool output the runner itself injects. A
  // 48-error typecheck dump is not merely long — it is re-sent to the model on
  // every internal turn that follows it, so its cost is multiplied by the whole
  // fix turn. Bounded head-and-tail, with a pointer to the full report.
  const priorValidationExcerpt =
    build.mode === "fix"
      ? boundReplayedOutput(
          excerptFromValidation(readJsonIfExists(artifactPath(sessionDir, "validation.json"))),
          (config.deliveryConfig && config.deliveryConfig.context && config.deliveryConfig.context.maxReplayedOutputChars) || undefined,
        )
      : "";
  const buildingContext = phaseContextPolicy(packet, "building", { repoRoot, deliveryConfig: config.deliveryConfig });
  const prompt = buildBuildingPrompt({
    packet,
    stepId,
    priorValidationExcerpt,
    // Always true today (BUILDING writes code, so house rules bind here in
    // every lane) — passed explicitly so the one phase that must never lose
    // the doctrine pointer says so at the call site rather than by omission.
    includeDoctrine: buildingContext.includeDoctrine,
    ownerMessages,
  });
  recordContextManifest(sessionDir, packet, "building", buildingContext, formatTurnId((working.turnCounter || 0) + 1), prompt);
  const tc = turnContext({ state, packet, deliveryConfig: config.deliveryConfig });
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
    effort: phaseEffort(state, packet, "building"),
    maxTurns: packetMaxInternalTurns(packet),
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
    abortPollMs: config.abortPollMs,
    ...errorRetryOptions(config.deliveryConfig),
    ...tc,
  });
  working = {
    ...working,
    messagesProcessed: lastSeq,
    turnCounter: (working.turnCounter || 0) + 1,
    execution: clearConfigOverrideFlag(working.execution),
  };
  working = withRecordedWorkspaceChanges(working, turn.changedPaths || []);
  if (!turn.ok) return blockFrom(sessionDir, working, "BUILDING", turn);

  working = { ...working, usage: accumulateUsage(working, "building", turn.usageV2, turn.usage.costUsd) };
  working = withContextOccupancy(working, "building", turn.usageV2, tc.windowTokens);

  // DLV-7: scope expansion is an owner decision, not a build-time liberty.
  // Only ever evaluated against a lock that actually declared paths — a plan
  // whose steps named none has nothing to expand beyond, and inventing a
  // boundary from an empty list would block every such session.
  const escaped = pathsOutsideScope(turn.changedPaths || [], working.scopeLock);
  if (escaped.length) {
    const result = smNext(working.state, "question.raised");
    const id = `q-scope-${turn.turnId || "building"}`;
    const questionText =
      `This step wrote ${escaped.length} file(s) outside the scope the approved plan declared: ${escaped.join(", ")}. ` +
      `The plan locked: ${(working.scopeLock.paths || []).join(", ")}. ` +
      "Approve the expansion (answer to continue, the files stay as written), or cancel and re-plan with the real scope. " +
      "The workspace is NOT rolled back either way.";
    const ledger = applyQuestionRaised(loadLedger(sessionDir), {
      id,
      phase: "BUILDING",
      source: "runner",
      text: questionText,
      kind: "blocking",
      evidence: { turnId: turn.turnId, seq: null },
    });
    writeLedger(sessionDir, ledger);
    emitEvent(sessionDir, {
      type: "scope.expanded",
      phase: "BUILDING",
      data: { outside: escaped, locked: working.scopeLock.paths || [], stepId },
    });
    appendBuildLog(sessionDir, stepId, description, turn.finalText);
    return {
      ...working,
      state: result.to,
      // The step is NOT advanced: answering returns to this same step, which
      // has already written its files, so re-running it is idempotent-ish and
      // re-doing the work is the agent's own call from the build log.
      awaiting: { gate: "question", returnTo: "BUILDING", reason: "scope-expanded", questions: [{ text: questionText, id }] },
    };
  }

  // DLV-32: BUILDING has no structured output contract to add an
  // openQuestions field to (buildBuildingPrompt's doc comment on
  // BLOCKING_QUESTION_MARKER explains why) — a required-format sentinel
  // line is the lower-risk equivalent. `state.build` (stepIndex etc.) is
  // deliberately left untouched: returnTo:"BUILDING" resumes the SAME step
  // once answered, with the answer now available via pendingGuidance,
  // rather than skipping ahead as if the step had completed.
  const trimmedFinal = (turn.finalText || "").trim();
  if (trimmedFinal.startsWith(BLOCKING_QUESTION_MARKER)) {
    const questionText = trimmedFinal.slice(BLOCKING_QUESTION_MARKER.length).trim() || "(no question text provided)";
    const result = smNext(working.state, "question.raised");
    const id = `q-${turn.turnId || "building"}-0`;
    const ledger = applyQuestionRaised(loadLedger(sessionDir), {
      id,
      phase: "BUILDING",
      source: "agent",
      text: questionText,
      kind: "blocking",
      evidence: { turnId: turn.turnId, seq: null },
    });
    writeLedger(sessionDir, ledger);
    const questions = [{ text: questionText, id }];
    emitEvent(sessionDir, { type: "question.raised", phase: "BUILDING", data: { questions } });
    return { ...working, state: result.to, awaiting: { gate: "question", returnTo: "BUILDING", questions } };
  }

  appendBuildLog(sessionDir, stepId, description, turn.finalText);

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

function withRecordedWorkspaceChanges(state, changedPaths = []) {
  if (!changedPaths.length) return state;
  const existing = (state.workspace && state.workspace.changedFiles) || [];
  const changedFiles = [...new Set([...existing, ...changedPaths])].sort();
  const preExisting = ((state.workspace && state.workspace.preExistingChanges) || []).map((entry) =>
    typeof entry === "string" ? entry : entry.path,
  );
  return {
    ...state,
    workspace: {
      ...state.workspace,
      changedFiles,
      changeOwnership: classifyChangeOwnership(preExisting, changedFiles),
    },
  };
}

async function handleValidating({ sessionDir, state, packet, config }) {
  const runValidation = config.runValidation || runValidationCommands;
  const timeoutMs = config.deliveryConfig && config.deliveryConfig.budgets && config.deliveryConfig.budgets.validationTimeoutMs;
  // D10/DLV-11: the lane's resolved validation ladder governs which rungs run
  // and whether "test" runs targeted. Pre-D9 packets carry no `lanePolicy` at
  // all -- rungs stays null (runValidationCommands' own "run everything"
  // default), matching every session's behavior before this existed.
  const ladder = packet.lanePolicy && packet.lanePolicy.validationLadder;
  const changedFiles = (state.workspace && state.workspace.changedFiles) || [];
  const validation = await runValidation({
    cwd: config.repoRoot,
    timeoutMs,
    rungs: ladder ? ladder.rungs : null,
    targetedFiles: ladder && ladder.targetedTest && changedFiles.length ? changedFiles : null,
    onEvent: (e) => emitEvent(sessionDir, { ...e, phase: "VALIDATING" }),
  });
  const baseline = state.workspace && state.workspace.baselineValidation;
  const verdict = baseline
    ? classifyValidationFailure(validation, baseline, {
        touchedFiles: (state.workspace && state.workspace.changedFiles) || [],
      })
    : null;
  const passes = validation.ok || !!(verdict && verdict.passesDelta);
  writeArtifactJson(sessionDir, "validation.json", { ...validation, delta: verdict, passes });
  writeArtifactText(sessionDir, "validation-report.md", renderValidationReportMd(validation, verdict));
  emitEvent(sessionDir, {
    type: "validation.result",
    phase: "VALIDATING",
    data: { ok: validation.ok, passes, delta: verdict ? verdict.commandDeltas : null },
  });

  // DLV-10: VALIDATING is where claims are confirmed or reverted. Re-feeding
  // the *existing* rows as claims re-runs each one against the validation
  // result that just landed — so an AC marked `met` on the strength of a
  // passing test suite is demoted the moment that suite goes red, instead of
  // staying green because it was green once. This is the BUD-11 shape exactly:
  // "✅ COMPLETED" in the build log over a red typecheck.
  state = withReconciledAcceptance(
    sessionDir,
    state,
    (state.acceptance || []).map((row) => ({ id: row.id, status: row.status, evidence: row.evidence })),
    config.repoRoot,
    null,
    "VALIDATING",
  );

  if (passes) {
    if (!validation.ok) {
      emitEvent(sessionDir, {
        type: "validation.delta.pass",
        phase: "VALIDATING",
        data: { preExistingCommands: verdict.preExistingCommands },
      });
    }
    const result = smNext(state.state, "validation.pass");
    return { ...state, state: result.to, awaiting: null };
  }

  const result = smNext(state.state, "validation.fail", {
    loopCount: state.fixLoop || 0,
    maxFixLoops: (packet.constraints && packet.constraints.maxFixLoops) || 3,
  });
  if (result.to === "BLOCKED") {
    emitEvent(sessionDir, { type: "error.fatal", phase: "VALIDATING", data: { reason: "fix loop exhausted" } });
    const blocked = {
      ...state,
      state: result.to,
      awaiting: { gate: "blocked", returnTo: "BUILDING" },
      lastError: { phase: "VALIDATING", message: "fix loop exhausted" },
    };
    writeFinishPackage(sessionDir, blocked, packet, "fix-loop-exhausted");
    return blocked;
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
  state = maybeRotateAtPhaseBoundary({ sessionDir, state, packet, deliveryConfig: config.deliveryConfig, phase: "reviewing" });
  const handle = await getHandle({ driver, state, packet, repoRoot, mode: "readonly", phase: "review" });
  let working = withDriverRef(state, handle);
  const { texts: drainedMessages, lastSeq } = drainMessages(sessionDir, working);
  // DLV-32: see the matching comment in handleBuilding.
  const ownerMessages = [...(working.pendingGuidance || []), ...drainedMessages];
  working = { ...working, pendingGuidance: [] };
  const prompt = buildSelfReviewPrompt({ packet, ownerMessages });
  const tc = turnContext({ state, packet, deliveryConfig: config.deliveryConfig });
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
    effort: phaseEffort(state, packet, "review"),
    maxTurns: packetMaxInternalTurns(packet),
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
    abortPollMs: config.abortPollMs,
    ...errorRetryOptions(config.deliveryConfig),
    ...tc,
  });
  working = {
    ...working,
    messagesProcessed: lastSeq,
    turnCounter: (working.turnCounter || 0) + 1,
    execution: clearConfigOverrideFlag(working.execution),
  };
  if (!turn.ok) return blockFrom(sessionDir, working, "REVIEWING", turn);

  const review = JSON.parse(turn.finalText);
  writeArtifactJson(sessionDir, "review-self.json", review);
  writeArtifactText(sessionDir, "review-self.md", renderReviewMd(review));
  working = { ...working, usage: accumulateUsage(working, "reviewing", turn.usageV2, turn.usage.costUsd) };
  working = withContextOccupancy(working, "reviewing", turn.usageV2, tc.windowTokens);
  // DLV-10: the review turn may claim AC coverage (its output schema is
  // permissive, so this is a voluntary field the prompt asks for). Claims are
  // reconciled here on exactly the same terms as everywhere else.
  if ((review.acceptanceCriteria || []).length) {
    working = withReconciledAcceptance(sessionDir, working, review.acceptanceCriteria, repoRoot, turn.turnId, "REVIEWING");
  }

  // DLV-32: REVIEWING's output schema is permissive ({type:"object"}, no
  // required fields) — an openQuestions array is a voluntary extra field the
  // prompt now asks for, not a schema addition. REVIEWING is a
  // runner-dispatched state (in the phase-dispatch table below), not a
  // gate, so returnTo:"REVIEWING" needs no gate re-arming — same as
  // DISCOVERY's existing question flow.
  if ((review.openQuestions || []).length) {
    const result = smNext(working.state, "question.raised");
    let ledger = loadLedger(sessionDir);
    const questions = review.openQuestions.map((q, i) => {
      const id = `q-${turn.turnId || ledger.rev}-${i}`;
      ledger = applyQuestionRaised(ledger, {
        id,
        phase: "REVIEWING",
        source: "agent",
        text: q.text,
        kind: "blocking",
        evidence: { turnId: turn.turnId, seq: null },
      });
      return { text: q.text, id };
    });
    writeLedger(sessionDir, ledger);
    emitEvent(sessionDir, { type: "question.raised", phase: "REVIEWING", data: { questions } });
    return { ...working, state: result.to, awaiting: { gate: "question", returnTo: "REVIEWING", questions } };
  }

  if (review.verdict === "BLOCK") {
    const result = smNext(working.state, "reviews.blocking", {
      loopCount: working.fixLoop || 0,
      maxFixLoops: (packet.constraints && packet.constraints.maxFixLoops) || 3,
    });
    if (result.to === "BLOCKED") {
      emitEvent(sessionDir, { type: "error.fatal", phase: "REVIEWING", data: { reason: "review fix loop exhausted" } });
      const blocked = {
        ...working,
        state: result.to,
        awaiting: { gate: "blocked", returnTo: "BUILDING" },
        lastError: { phase: "REVIEWING", message: "review fix loop exhausted" },
      };
      writeFinishPackage(sessionDir, blocked, packet, "fix-loop-exhausted");
      return blocked;
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
  working = maybeRotateAtPhaseBoundary({ sessionDir, state: working, packet, deliveryConfig: config.deliveryConfig, phase: "uat" });
  const uatHandle = await getHandle({ driver, state: working, packet, repoRoot, mode: "readonly", phase: "review" });
  working = withDriverRef(working, uatHandle);
  // DLV-32: this second turn within the same handler call used to hardcode
  // ownerMessages:[] — any owner message or leftover guidance was silently
  // dropped rather than merely rare. Drain fresh (cursor already advanced by
  // the review turn above) and carry through any pendingGuidance, matching
  // every other turn-producing site.
  const { texts: uatDrainedMessages, lastSeq: uatLastSeq } = drainMessages(sessionDir, working);
  const uatOwnerMessages = [...(working.pendingGuidance || []), ...uatDrainedMessages];
  working = { ...working, pendingGuidance: [], messagesProcessed: uatLastSeq };
  // DLV-8: buildUatPrompt derives session-relative artifact paths from
  // `packet` itself when priorArtifactPaths is omitted — see prompts.mjs.
  const uatPrompt = buildUatPrompt({ packet, ownerMessages: uatOwnerMessages });
  const uatTc = turnContext({ state: working, packet, deliveryConfig: config.deliveryConfig });
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
    effort: phaseEffort(working, packet, "review"),
    maxTurns: packetMaxInternalTurns(packet),
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
    abortPollMs: config.abortPollMs,
    ...errorRetryOptions(config.deliveryConfig),
    ...uatTc,
  });
  working = { ...working, turnCounter: (working.turnCounter || 0) + 1, execution: clearConfigOverrideFlag(working.execution) };
  if (!uatTurn.ok) return blockFrom(sessionDir, working, "REVIEWING", uatTurn);

  const uat = JSON.parse(uatTurn.finalText);
  working = { ...working, usage: accumulateUsage(working, "uat", uatTurn.usageV2, uatTurn.usage.costUsd) };
  working = withContextOccupancy(working, "uat", uatTurn.usageV2, uatTc.windowTokens);

  // DLV-10: the UAT package's own per-AC claims are the last and most
  // consequential ones — they are what the owner reads when deciding to accept.
  working = withReconciledAcceptance(sessionDir, working, uat.acceptanceCriteria || [], repoRoot, uatTurn.turnId, "UAT_PREP");
  assembleUatPackage(sessionDir, uat, packet, working);

  // The UAT_READY precondition: every AC met or waived. This is additive — no
  // new state, just a check on an existing transition (doc 3 §2). An unmet AC
  // becomes an owner decision rather than a silent pass, which is precisely
  // what BUD-11 lacked: ACs 6/7/8 unmet, UAT assembled anyway, nothing said.
  const unsatisfied = unsatisfiedAcceptance(working.acceptance);
  if (unsatisfied.length) {
    const smResult = smNext(working.state, "question.raised");
    const id = `q-acceptance-${uatTurn.turnId || "uat"}`;
    const rows = (working.acceptance || []).filter((r) => unsatisfied.includes(r.id));
    const questionText =
      `${unsatisfied.length} acceptance criteria are not met and cannot be evidenced: ` +
      `${rows.map((r) => `${r.id} (${r.status})`).join(", ")}. ` +
      `See .delivery/sessions/${packet.sessionId}/artifacts/acceptance.md for the full matrix. ` +
      'Answer "waive" to waive them and proceed to UAT, or send the session back to BUILDING to finish them.';
    const ledger = applyQuestionRaised(loadLedger(sessionDir), {
      id,
      phase: "UAT_PREP",
      source: "runner",
      text: questionText,
      kind: "blocking",
      evidence: { turnId: uatTurn.turnId, seq: null },
    });
    writeLedger(sessionDir, ledger);
    emitEvent(sessionDir, {
      type: "acceptance.incomplete",
      phase: "REVIEWING",
      data: { unsatisfied, summary: summarizeAcceptance(working.acceptance) },
    });
    return {
      ...working,
      state: smResult.to,
      awaiting: {
        gate: "question",
        returnTo: "REVIEWING",
        reason: "acceptance-incomplete",
        unsatisfiedAcceptance: unsatisfied,
        questions: [{ text: questionText, id }],
      },
    };
  }

  const result = smNext(working.state, "reviews.pass");
  emitEvent(sessionDir, { type: "phase.transition", phase: "REVIEWING", data: { to: result.to } });
  return {
    ...working,
    state: result.to,
    awaiting: {
      gate: GATES[result.to] || "uat",
      // Attached only when a matrix exists (see the matching note on the spec
      // gate): a session whose spec declared no ACs has nothing to summarize.
      ...((working.acceptance || []).length ? { acceptance: summarizeAcceptance(working.acceptance) } : {}),
    },
  };
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
    updateLedger(sessionDir, (ledger) =>
      applyDecision(ledger, { id: `d-${decision.seq}`, gate: "uat", decision: "accept", note: decision.note, phase: "UAT_READY" }),
    );
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
  updateLedger(sessionDir, (ledger) =>
    applyDecision(ledger, { id: `d-${decision.seq}`, gate: "uat", decision: "reject", note: decision.note, phase: "UAT_READY" }),
  );
  return {
    ...state,
    state: result.to,
    awaiting: null,
    fixLoop: (state.fixLoop || 0) + 1,
    build: { mode: "fix", stepIndex: 0, totalSteps: 1 },
    // DLV-32: a UAT rejection note used to land only in the ledger — the
    // fix-loop BUILDING prompt that follows carried the prior validation
    // excerpt but never the owner's actual reason for rejecting. Same
    // pendingGuidance mechanism the spec/plan reject paths already use.
    pendingGuidance: [...(state.pendingGuidance || []), decision.note ? `Owner rejected UAT: ${decision.note}` : null].filter(Boolean),
  };
}

function consumeAcceptedDecision({ sessionDir, state, decision, packet, repoRoot, readHead }) {
  const result = smNext(state.state, "decision.shipped");
  const shippedHead = readHead(repoRoot);
  emitEvent(sessionDir, { type: "decision.consumed", phase: "ACCEPTED", data: { decision: "shipped", head: shippedHead } });
  void decision;
  let next = { ...state, state: result.to, awaiting: null, shippedHead };
  if (isTerminal(next.state)) {
    runTranscriptGapCheck(sessionDir, next);
    next = withRawTranscriptLinkage(next, packet, repoRoot);
    writeFinishPackage(sessionDir, next, packet, "shipped");
  }
  return next;
}

function consumeQuestionDecision({ sessionDir, state, decision }) {
  // DLV-10: waiving the acceptance gate resumes at UAT_READY, not at the
  // REVIEWING that raised it. The UAT package was already assembled before the
  // check ran, so returning to REVIEWING would re-run a review turn AND a UAT
  // turn — two full-context turns (~$0.10-0.19 each, measured) to re-produce
  // artifacts that already exist on disk — purely to get past a decision the
  // owner has just made. Any answer other than "waive" keeps the original
  // returnTo, which is the "go and finish them" branch.
  const wantsWaiver =
    !!state.awaiting &&
    state.awaiting.reason === "acceptance-incomplete" &&
    typeof decision.answer === "string" &&
    /^\s*waive\b/i.test(decision.answer);
  const returnTo = wantsWaiver ? "UAT_READY" : (state.awaiting && state.awaiting.returnTo) || "DISCOVERY";
  const result = smNext(state.state, "decision.answer", { returnTo });
  emitEvent(sessionDir, { type: "decision.consumed", phase: "NEEDS_DECISION", data: { answer: decision.answer } });
  const answerNote = decision.answer ? `Owner's answer to the open question: ${decision.answer}` : null;
  // DW-5: the same owner answer addresses every question raised in this
  // batch — record it against each ledger-tracked question id so it persists
  // as durable context (not just this one prompt's pendingGuidance).
  const questionIds = ((state.awaiting && state.awaiting.questions) || []).map((q) => q.id).filter(Boolean);
  if (decision.answer && questionIds.length) {
    let ledger = loadLedger(sessionDir);
    for (const questionId of questionIds) {
      try {
        ledger = applyAnswer(ledger, { questionId, text: decision.answer, via: "decision:question" });
      } catch {
        // already answered / unknown id — never block the state transition on a ledger inconsistency.
      }
    }
    writeLedger(sessionDir, ledger);
  }
  // DLV-32: PLAN can now raise a question too (returnTo: "SPEC_READY"), and
  // SPEC_READY is a GATE state, not a runner-dispatched one — landing there
  // with awaiting:null would strand the session with no visible gate panel,
  // the exact DLV-29 failure shape. Re-arm the gate exactly like
  // consumeBlockedDecision already does for its own returnTo; DISCOVERY
  // (the only other returnTo today) isn't in GATES, so this is a no-op for
  // every pre-existing question flow.
  const awaiting = GATES[returnTo] ? { gate: GATES[returnTo] } : null;

  // DLV-10: the audited waiver itself. Recorded against the owner
  // (`updatedBy: "owner"`), never against a turn, so the matrix always shows
  // who let an unmet criterion through.
  let acceptance = state.acceptance;
  if (wantsWaiver) {
    acceptance = waiveAcceptance(state.acceptance, state.awaiting.unsatisfiedAcceptance || null, {
      note: decision.answer,
    });
    writeAcceptanceArtifacts(sessionDir, acceptance);
    emitEvent(sessionDir, {
      type: "acceptance.waived",
      phase: "NEEDS_DECISION",
      data: { ids: state.awaiting.unsatisfiedAcceptance || [], summary: summarizeAcceptance(acceptance) },
    });
  }

  return {
    ...state,
    state: result.to,
    awaiting,
    ...(acceptance ? { acceptance } : {}),
    pendingGuidance: [...(state.pendingGuidance || []), answerNote].filter(Boolean),
  };
}

function consumeBlockedDecision({ sessionDir, state, decision }) {
  const returnTo = (state.awaiting && state.awaiting.returnTo) || "DISCOVERY";
  const result = smNext(state.state, "decision.retry", { returnTo });
  const quotaPaused = state.awaiting && state.awaiting.reason === "quota-paused";
  emitEvent(sessionDir, { type: "decision.consumed", phase: "BLOCKED", data: { retryTo: returnTo, note: decision.note, preflight: quotaPaused } });
  // Gate states are re-armed with their awaiting gate restored (the owner
  // approves again to retry); runner-executable states are left with
  // awaiting:null so the next poll tick re-enters the phase automatically.
  const awaiting = GATES[returnTo] ? { gate: GATES[returnTo] } : null;
  const base = {
    ...state,
    state: result.to,
    awaiting,
    fixLoop: 0,
    lastError: null,
    ...(quotaPaused ? { driver: { ...(state.driver || {}), ref: null } } : {}),
  };
  if (returnTo === "BUILDING") return { ...base, build: { mode: "fix", stepIndex: 0, totalSteps: 1 } };
  return base;
}

function consumeCancel({ sessionDir, state, packet, repoRoot }) {
  const result = smNext(state.state, "decision.cancel");
  emitEvent(sessionDir, { type: "decision.consumed", phase: state.state, data: { decision: "cancel" } });
  let next = { ...state, state: result.to, awaiting: null };
  if (isTerminal(next.state)) {
    runTranscriptGapCheck(sessionDir, next);
    next = withRawTranscriptLinkage(next, packet, repoRoot);
    writeFinishPackage(sessionDir, next, packet, "cancelled");
  }
  return next;
}

// ---- the single-unit-of-work step (exported for tests) ----

/**
 * Perform exactly one unit of runner work for the session in `sessionDir` and
 * persist the result. Returns `{didWork: boolean, state}`.
 * @param {{sessionDir:string, driver:object, repoRoot:string, runValidation?:Function,
 *   retryDelayMs?:number, sleep?:Function, takeSnapshot?:Function, readHead?:Function,
 *   deliveryConfig?:object, createDriver?:Function, abortPollMs?:number,
 *   providerDriverCache?:(Map|null)}} options
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
    // DW-1: owner-edited `.delivery/config.json` (model catalog, pricing,
    // transcript caps) — injectable for tests, else loaded fresh per call
    // (cheap: one small JSON read, no different from packet/state loads above).
    deliveryConfig: options.deliveryConfig || loadConfig(repoRoot),
    // DW-10: how often an in-flight turn re-checks controls/ for a new
    // abort request — small in tests so an abort lands promptly.
    abortPollMs: options.abortPollMs != null ? options.abortPollMs : 300,
  };
  let state = loadState(sessionDir);
  const packet = loadPacket(sessionDir);

  // DLV-34: every phase turn below must run on the driver that owns
  // `state.driver.ref`. After a handoff that is no longer the process-level
  // driver `runLoop` built from `packet.agent`.
  const activeDriver = resolveProviderDriver({
    driver,
    state,
    packet,
    sessionDir,
    createDriver: options.createDriver,
    cache: options.providerDriverCache || null,
  });

  // A malformed owner config must be visible in the session timeline as well
  // as the dashboard banner. Record each distinct failure once while safely
  // continuing with loadConfig's last-known-good/default fallback.
  const configStatus = getConfigStatus(config.deliveryConfig);
  if (!configStatus.healthy && state.configNotice !== configStatus.message) {
    emitEvent(sessionDir, { type: "config-invalid", phase: state.state, data: { source: configStatus.source, message: configStatus.message } });
    state = persistState(sessionDir, { ...state, configNotice: configStatus.message });
  }

  if (isTerminal(state.state)) return { didWork: false, state };

  // DW-4: drain owner controls (pause/resume-run/set-config/...) before any
  // other work this tick — mirrors the decisions/messages numbered-file
  // pattern (persist + return early so the runner loop re-polls promptly).
  // DW-8: a provider-switching set-config performs a full handoff here too
  // (digest + snapshot + new-provider verification turn), so this needs the
  // same run context (repoRoot/takeSnapshot/retry/sleep) as guarded turns.
  const drained = await drainControls(sessionDir, state, packet, {
    repoRoot,
    deliveryConfig: config.deliveryConfig,
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
    takeSnapshot: config.takeSnapshot,
    abortPollMs: config.abortPollMs,
    // DW-8 test seam: inject a driver factory for the *new* provider a
    // handoff switches to, without touching the global driver registry
    // (which would leak across tests in the same file/worker).
    createDriver: options.createDriver,
    providerDriverCache: options.providerDriverCache || null,
  });
  if (drained.didWork) {
    const persisted = persistState(sessionDir, drained.state);
    return { didWork: true, state: persisted };
  }

  // Cancel is legal from any non-terminal state (NON_TERMINAL_STATES in
  // state-machine.mjs), not just the six gate states handled below — and it
  // must apply even while paused. Before this check existed, a cancel written
  // while the session sat in a non-gate active state (DISCOVERY/BUILDING/...)
  // only took effect once the phase happened to reach a gate on its own; if
  // the session was paused at the time, that gate was never reached, so the
  // cancel silently sat unconsumed forever — the owner's "abort now" had no
  // effect. Checking here, before the pause short-circuit below, makes cancel
  // truly immediate regardless of phase or pause state.
  const pendingCancel = pendingDecisions(sessionDir, state.decisionsProcessed || 0).find((d) => d.decision === "cancel");
  if (pendingCancel) {
    const newState = { ...consumeCancel({ sessionDir, state, packet, repoRoot }), decisionsProcessed: pendingCancel.seq };
    const persisted = persistState(sessionDir, newState);
    return { didWork: true, state: persisted };
  }

  // DLV-1: a completed turn's usage is persisted before the next tick, so
  // this boundary is the single enforcement point. Controls drain first,
  // allowing an audited cap raise to resume a paused session without a
  // special runner path; cancel remains immediate even when the cap is hit.
  const budgetBoundaryState = enforceBudgetBoundary(sessionDir, state, packet, config.deliveryConfig);
  if (budgetBoundaryState) {
    if (budgetBoundaryState === state) return { didWork: false, state };
    const persisted = persistState(sessionDir, budgetBoundaryState);
    return { didWork: true, state: persisted };
  }

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
    // A pending "cancel" is already intercepted unconditionally above, before
    // this block runs — so every decision reaching this loop is a real gate
    // decision. Anything whose `gate` doesn't match what's currently awaited
    // is stale (doc 5 §7) — skip it (advancing the seq cursor so it is never
    // reprocessed) and keep looking for one that does apply.
    let decision = null;
    let skippedThrough = state.decisionsProcessed || 0;
    for (const d of pending) {
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
      if (state.state === "SPEC_READY") {
        const r = await consumeSpecDecision({ sessionDir, state, packet, driver: activeDriver, repoRoot, decision, config });
        newState = r.newState;
      } else if (state.state === "PLAN_READY") {
        newState = consumePlanDecision({ sessionDir, state, decision });
      } else if (state.state === "UAT_READY") {
        newState = consumeUatDecision({ sessionDir, state, decision });
      } else if (state.state === "ACCEPTED") {
        newState = consumeAcceptedDecision({ sessionDir, state, decision, packet, repoRoot, readHead: config.readHead });
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

  // DW-4: pause is an execution flag, not a state-machine state — gates
  // (handled above) are unaffected; only phase *work* is skipped. A running
  // turn always finishes (this check only ever runs between turns).
  if (state.execution && state.execution.paused) {
    return { didWork: false, state };
  }

  let newState;
  if (state.state === "SELECTED") {
    newState = await handleSelected({ sessionDir, state, config });
  } else if (state.state === "DISCOVERY") {
    newState = await handleDiscovery({ sessionDir, state, packet, driver: activeDriver, repoRoot, config });
  } else if (state.state === "BUILDING") {
    newState = await handleBuilding({ sessionDir, state, packet, driver: activeDriver, repoRoot, config });
  } else if (state.state === "VALIDATING") {
    newState = await handleValidating({ sessionDir, state, packet, config });
  } else if (state.state === "REVIEWING") {
    newState = await handleReviewing({ sessionDir, state, packet, driver: activeDriver, repoRoot, config });
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
 * Contain an unexpected `advanceSession` throw: record it (runner.log +
 * `runner.error` event) and, when the session is in an active phase, park it
 * BLOCKED via the universal `error.fatal` transition so the dashboard shows
 * the cause and offers Retry. Returns the persisted state, or null when the
 * session can't legally block from its current state (caller rethrows and the
 * process dies as before — but with the error now on the event record).
 */
function parkSessionOnCrash(sessionDir, staleState, err) {
  const message = String((err && err.message) || err);
  // The handler may have persisted newer state before throwing (driver refs,
  // message cursors) — re-read from disk so parking doesn't clobber it.
  let state = staleState;
  try {
    state = loadState(sessionDir);
  } catch {
    /* fall back to the loop's copy */
  }
  try {
    appendNdjsonLine(join(sessionDir, "runner.log"), String((err && err.stack) || err));
    emitEvent(sessionDir, {
      type: "runner.error",
      phase: state.state,
      data: { message: truncateField(message, TRUNCATE_LIMITS.message) },
    });
  } catch {
    /* best-effort recording — containment below still matters more */
  }
  if (!ACTIVE_STATES.includes(state.state)) return null;
  try {
    const result = smNext(state.state, "error.fatal");
    const parked = {
      ...state,
      state: result.to,
      awaiting: { gate: "blocked", returnTo: state.state },
      lastError: {
        phase: state.state,
        message: `The runner hit an unexpected error and parked the session: ${message}. Full stack in runner.log. Retry re-runs the ${state.state} phase.`,
        errorKind: "runner-crash",
      },
    };
    // DLV-12: the crash path is the one most likely to leave a half-written
    // workspace with no explanation, so it is the one that most needs the
    // ownership manifest and recovery guidance. `writeFinishPackage` swallows
    // its own errors, so it cannot turn a contained crash into an uncontained one.
    try {
      writeFinishPackage(sessionDir, parked, loadPacket(sessionDir), "runner-crash");
    } catch {
      /* the packet may itself be unreadable — parking still matters more */
    }
    return persistState(sessionDir, parked);
  } catch {
    return null;
  }
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

  const driver = createDriverDefault(driverKind, driverOptions);
  // DLV-34: one instance per provider, for this process's lifetime. Before a
  // handoff this holds only `driverKind`; after one it also holds the provider
  // the session moved to, so `advanceSession` keeps resuming each ref on the
  // driver that created it rather than rebuilding one per tick (which would
  // discard the SDK-side conversation identity `resume` depends on).
  const providerDriverCache = new Map();
  if (driver && driver.kind) providerDriverCache.set(driver.kind, driver);
  writeHeartbeat(sessionDir);
  if (options.resumed) {
    const sealed = reconcileCrashedTurns(sessionDir);
    for (const turnId of sealed) {
      emitEvent(sessionDir, { type: "turn.crashed.sealed", data: { turnId } });
    }
  }
  emitEvent(sessionDir, { type: options.resumed ? "runner.resumed" : "runner.started", data: { pid: process.pid } });

  // Independent heartbeat: a single advanceSession tick can legitimately take
  // minutes (the validation baseline runs a real test/lint suite). Writing the
  // heartbeat only *between* ticks left it stale for the whole duration, so the
  // dashboard falsely reported the runner dead and a Resume click spawned a
  // second runner. A timer-driven heartbeat keeps beating throughout any tick
  // now that validation is async (event loop is free), so `isRunnerAlive` sees
  // a fresh heartbeat and the resume guard correctly refuses a duplicate runner.
  const heartbeatTimer = setInterval(() => {
    try {
      writeHeartbeat(sessionDir);
    } catch {
      /* best-effort — a transient write failure must not kill the loop */
    }
  }, heartbeatIntervalMs);
  if (typeof heartbeatTimer.unref === "function") heartbeatTimer.unref();

  try {
    for (;;) {
      const state = loadState(sessionDir);
      if (isTerminal(state.state)) {
        writeHeartbeat(sessionDir);
        return state;
      }
      let didWork;
      try {
        ({ didWork } = await advanceSession({
          sessionDir,
          driver,
          repoRoot,
          runValidation,
          retryDelayMs,
          sleep,
          takeSnapshot,
          providerDriverCache,
        }));
      } catch (err) {
        // Last-resort containment: an unexpected throw from any phase handler
        // used to kill the runner process outright, leaving the session
        // frozen mid-phase with `lastError: null` and the only trace buried
        // in runner.log. Park the session BLOCKED instead (owner sees the
        // error at the gate and can Retry); only rethrow when the state
        // machine has no legal way to block from here.
        const parked = parkSessionOnCrash(sessionDir, state, err);
        if (!parked) throw err;
        didWork = true;
      }
      if (!didWork) {
        if (shouldStop()) return loadState(sessionDir);
        await sleepAsync(pollIntervalMs);
      }
    }
  } finally {
    clearInterval(heartbeatTimer);
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
      openQuestions: [],
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
      recordStartupCrash(sessionDir, err);
    } catch {
      /* best-effort logging only */
    }
    process.stderr.write(`${String((err && err.stack) || err)}\n`);
    process.exitCode = 1;
  });
}

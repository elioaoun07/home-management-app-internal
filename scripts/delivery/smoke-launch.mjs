// scripts/delivery/smoke-launch.mjs
//
// Owner-driven smoke-test harness for the delivery pipeline: launch one real
// checklist item, then inspect and gate it, without needing the `pnpm pm`
// dashboard open in a browser. Same code path the dashboard uses — it calls
// `routeDelivery` directly rather than reimplementing the launch contract, so a
// smoke test can never accidentally validate a path the real UI doesn't take.
//
// This exists because the BUD-14 FAST-lane smoke test (2026-07-29) had to be
// reproduced repeatedly while diagnosing DLV-42/43/44, and each reproduction
// otherwise meant re-driving the browser by hand.
//
// It deliberately does NOT approve gates. The three human gates are the owner's
// (see the campaign's owner non-negotiables); this harness can launch, report,
// and — only when the owner passes an explicit decision subcommand — relay the
// owner's own decision. It never authors one.
//
// Usage:
//   node scripts/delivery/smoke-launch.mjs preflight
//   node scripts/delivery/smoke-launch.mjs flightcheck --file "Budget/4 - Checklist.md" --cbidx 1
//   node scripts/delivery/smoke-launch.mjs launch --file "Budget/4 - Checklist.md" --cbidx 1 \
//        --lane FAST --model claude-haiku-4-5 --max-usd 0.5 --max-tokens 500000 [--dirty-ack] [--triage-ack] [--red-ack]
//   node scripts/delivery/smoke-launch.mjs status --id <sessionId>
//   node scripts/delivery/smoke-launch.mjs cost   --id <sessionId>
//   node scripts/delivery/smoke-launch.mjs decide --id <sessionId> --gate spec --decision approve [--note "..."]

import { join } from "node:path";
import { readFileSync, existsSync, readdirSync } from "node:fs";

import { createDeliveryContext, routeDelivery } from "./server-routes.mjs";
import { DIRTY_TREE_ACK, RED_BASELINE_ACK, TRIAGE_OVERRIDE_ACK } from "./validation-baseline.mjs";
import { estimateCostUsd } from "./usage.mjs";
import { getModelPricing } from "./config.mjs";

const ROOT = process.cwd();
const PM_REL = join("ERA Notes", "10 - Project Management");
const PM_DIR = join(ROOT, PM_REL);
const ctx = createDeliveryContext({ ROOT, PM_DIR, PM_REL });

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}
const has = (name) => process.argv.includes(`--${name}`);

async function call(method, path, { body = {}, query = {} } = {}) {
  const q = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
  const res = await routeDelivery({ method, path, query: q, body }, ctx);
  return res && res.json;
}

function print(label, value) {
  console.log(`\n=== ${label} ===`);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

/** Reconcile a session's own recorded usage against Claude Code's raw SDK transcript. */
function costReport(sessionId) {
  const dir = join(ROOT, ".delivery", "sessions", sessionId);
  const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  const packet = JSON.parse(readFileSync(join(dir, "packet.json"), "utf8"));
  const model = (packet.agentConfig && packet.agentConfig.model) || null;
  const pricing = model ? getModelPricing(ctx.deliveryConfig, packet.agent, model) : null;

  const recorded = (state.usage && state.usage.total) || {};
  const recordedProcessed =
    (recorded.input || 0) + (recorded.cachedRead || 0) + (recorded.cacheCreation || 0) + (recorded.output || 0);

  // The higher-fidelity record: Claude Code's own per-session jsonl.
  let raw = null;
  const pointer = state.driver && state.driver.rawTranscript;
  const rawPath = pointer && pointer.path;
  if (rawPath && existsSync(rawPath)) {
    const totals = { input: 0, cachedRead: 0, cacheCreation: 0, output: 0 };
    let records = 0;
    for (const line of readFileSync(rawPath, "utf8").trim().split("\n")) {
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      const u = (rec.message && rec.message.usage) || rec.usage;
      if (!u || (u.input_tokens == null && u.cache_read_input_tokens == null)) continue;
      records += 1;
      totals.input += u.input_tokens || 0;
      totals.cachedRead += u.cache_read_input_tokens || 0;
      totals.cacheCreation += u.cache_creation_input_tokens || 0;
      totals.output += u.output_tokens || 0;
    }
    const processed = totals.input + totals.cachedRead + totals.cacheCreation + totals.output;
    raw = { records, ...totals, processed, costUsd: estimateCostUsd(totals, pricing) };
  }

  const turnsPath = join(dir, "transcript", "turns.ndjson");
  const turns = existsSync(turnsPath)
    ? readFileSync(turnsPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];

  return {
    sessionId,
    state: state.state,
    lane: packet.lanePolicy && packet.lanePolicy.lane,
    model,
    awaiting: state.awaiting,
    lastError: state.lastError,
    budget: state.budget && state.budget.current,
    runnerTurns: turns.length,
    internalModelCalls: turns.reduce((n, t) => n + ((t.turnMeta && t.turnMeta.numTurns) || 0), 0),
    recorded: { ...recorded, processed: recordedProcessed },
    rawTranscript: raw,
    // The DLV-43 headline number: how much of real spend the system now sees.
    fidelity: raw && raw.processed ? `${((recordedProcessed / raw.processed) * 100).toFixed(1)}% of raw processed tokens recorded` : "raw transcript unavailable",
    perPhase: (state.usage && state.usage.perPhase) || {},
  };
}

const cmd = process.argv[2];

if (cmd === "preflight") {
  const pre = await call("POST", "/api/delivery/preflight");
  print("preflight", {
    preflightId: pre.preflightId,
    dirtyAtStart: pre.dirtyAtStart,
    changedFiles: (pre.changedFiles || []).length,
    baselineOk: pre.baselineValidation.ok,
    failedCommands: Object.entries(pre.baselineValidation.results || {})
      .filter(([, r]) => !r.ok)
      .map(([k]) => k),
  });
} else if (cmd === "flightcheck") {
  const rec = await call("GET", "/api/delivery/recommendation", {
    query: { file: arg("file"), cbidx: arg("cbidx"), provider: arg("agent", "claude") },
  });
  print("recommendation", rec);
} else if (cmd === "launch") {
  const pre = await call("POST", "/api/delivery/preflight");
  console.log(
    `preflight ${pre.preflightId} — dirty=${pre.dirtyAtStart} (${(pre.changedFiles || []).length} files), baseline ok=${pre.baselineValidation.ok}`,
  );
  const body = {
    file: arg("file"),
    cbidx: Number(arg("cbidx")),
    agent: arg("agent", "claude"),
    model: arg("model", "claude-haiku-4-5"),
    preflightId: pre.preflightId,
    flightCheck: { reviewed: true, lane: arg("lane", "FAST") },
    budget: {
      maxUsd: Number(arg("max-usd", "0.5")),
      maxTokens: Number(arg("max-tokens", "500000")),
      authorization: "capped",
    },
    ...(has("dirty-ack") ? { dirtyAck: DIRTY_TREE_ACK } : {}),
    ...(has("red-ack") ? { redBaselineAck: RED_BASELINE_ACK } : {}),
    ...(has("triage-ack") ? { triageAck: TRIAGE_OVERRIDE_ACK } : {}),
  };
  const out = await call("POST", "/api/delivery/start", { body });
  print("launched", out);
} else if (cmd === "status") {
  const id = arg("id");
  const s = await call("GET", "/api/delivery/session", { query: { id } });
  print("session", {
    state: s.state && s.state.state,
    awaiting: s.state && s.state.awaiting,
    lastError: s.state && s.state.lastError,
    usage: s.state && s.state.usage && s.state.usage.total,
  });
  const dir = join(ROOT, ".delivery", "sessions", id);
  const artifacts = join(dir, "artifacts");
  if (existsSync(artifacts)) print("artifacts", readdirSync(artifacts).join(", "));
} else if (cmd === "cost") {
  print("cost", costReport(arg("id")));
} else if (cmd === "decide") {
  // Relays the OWNER's decision. Never invoked without them supplying --decision.
  const out = await call("POST", "/api/delivery/decision", {
    body: { id: arg("id"), gate: arg("gate"), decision: arg("decision"), note: arg("note", "") || "", answer: arg("answer", "") || "" },
  });
  print("decision recorded", out);
} else {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(19, 27).join("\n"));
  process.exit(1);
}

// Owner test gate (2026-09-19). The owner runs typecheck/lint/tests on the laptop; the
// executor no longer runs them (interaction.mjs NO_TEST_RUNS). After any Apply that
// left files written, a new delivery stays locked until the owner records the result
// for that application: "passed" unlocks; "failed" unlocks only with an explicit
// proceed (the escalated approval), which is recorded with the next launch.
//
// Records live in `.delivery/v2/test-gate.json`, beside allowances.json.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const TEST_GATE_REL = ".delivery/v2/test-gate.json";
const HISTORY_LIMIT = 50;

/** Application states in which candidate bytes remain in the checkout. */
export const WRITTEN_STATES = Object.freeze(["applied", "checks-pending", "checks-failed", "checks-inconclusive", "partly-restored", "interrupted"]);

export const TEST_GATE_REFUSALS = Object.freeze({
  LOCKED: "tests-unconfirmed",
  INVALID: "test-result-invalid",
  STALE: "test-result-stale",
});

export function readTestGate({ root }) {
  const path = join(root, TEST_GATE_REL);
  if (!existsSync(path)) return { records: [] };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return { records: Array.isArray(raw.records) ? raw.records : [] };
  } catch {
    return { records: [] };
  }
}

function writeTestGate({ root, gate }) {
  const path = join(root, TEST_GATE_REL);
  mkdirSync(dirname(path), { recursive: true });
  const temp = path + "." + process.pid + ".tmp";
  writeFileSync(temp, JSON.stringify({ records: gate.records.slice(-HISTORY_LIMIT) }, null, 2) + "\n");
  renameSync(temp, path);
}

/**
 * The gate as it stands: the newest application whose files are still written, and
 * the owner's latest record for it. Pure over its inputs.
 */
export function gateState({ applications, records }) {
  const written = applications.filter((row) => WRITTEN_STATES.includes(String(row.state)));
  const latest = written.length ? written[written.length - 1] : null;
  if (!latest) return { locked: false, application: null, record: null };
  const application_id = String(latest.application_id);
  const mine = records.filter((record) => record.application_id === application_id);
  const record = mine.length ? mine[mine.length - 1] : null;
  const cleared = Boolean(record && (record.result === "passed" || (record.result === "failed" && record.proceed === true)));
  return {
    locked: !cleared,
    application: { application_id, run_id: String(latest.run_id), state: String(latest.state), at: String(latest.updated_at || latest.created_at) },
    record,
  };
}

/** Record one owner result. A repeated command_id is a no-op. */
export function recordTestResult({ root, applications, change, actor, now }) {
  const gate = readTestGate({ root });
  if (change.command_id && gate.records.some((record) => record.command_id === change.command_id)) {
    return { ok: true, repeated: true, state: gateState({ applications, records: gate.records }) };
  }
  const result = String(change.result || "");
  if (!["passed", "failed"].includes(result)) return { ok: false, refusals: [{ code: TEST_GATE_REFUSALS.INVALID, detail: "result must be passed or failed" }] };
  const current = gateState({ applications, records: gate.records });
  if (!current.application || current.application.application_id !== String(change.application_id || "")) {
    return { ok: false, refusals: [{ code: TEST_GATE_REFUSALS.STALE, detail: "no written application with that id is awaiting a result" }] };
  }
  const record = {
    application_id: current.application.application_id,
    run_id: current.application.run_id,
    result,
    proceed: result === "failed" ? change.proceed === true : false,
    note: change.note ? String(change.note).slice(0, 500) : null,
    at: now,
    actor: String(actor || "owner"),
    command_id: change.command_id ? String(change.command_id) : null,
  };
  gate.records.push(record);
  writeTestGate({ root, gate });
  return { ok: true, repeated: false, state: gateState({ applications, records: gate.records }) };
}

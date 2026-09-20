// Owner allowance settings (2026-09-19): the token limits the owner adjusts from the
// PM app's Settings panel — the shared (fleet) allowance and its window, the default
// per-task allowance, and per-run top-ups.
//
// Kept out of `execution-policy.json` on purpose: every run's grant is bound to the
// policy revision, so editing the policy while a run is in flight makes its next
// dispatch refuse with `policy-moved`. These settings overlay the policy's amounts at
// evaluation time instead; grants, approvals and policy digests are unchanged.
//
// Effect boundary: a change applies at the next admission/dispatch check. A native job
// that is already running is not interrupted (qualified in-job stopping is DLV-114).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const ALLOWANCES_REL = ".delivery/v2/allowances.json";
export const ALLOWANCES_SCHEMA = "delivery-v2/allowances@1";
export const ALLOWANCE_MAX = 50_000_000;
const HISTORY_LIMIT = 50;

export const ALLOWANCE_REFUSALS = Object.freeze({
  INVALID: "allowance-invalid",
  UNKNOWN_ACTION: "allowance-unknown-action",
  UNKNOWN_RUN: "allowance-unknown-run",
  UNREADABLE: "allowance-settings-unreadable",
});

const PERIODS = new Set(["day", "reset"]);

export function defaultAllowances() {
  return { schema: ALLOWANCES_SCHEMA, fleet: { limit: null, period: "reset" }, task: { limit: null }, reset_at: null, runs: {}, history: [] };
}

const isAmount = (value) => Number.isInteger(value) && value > 0 && value <= ALLOWANCE_MAX;
const limitOrNull = (value) => (value == null ? null : isAmount(Number(value)) ? Number(value) : undefined);

/** Validate a parsed file; unknown or malformed fields fall back to their defaults. */
export function normalizeAllowances(raw) {
  const base = defaultAllowances();
  if (!raw || typeof raw !== "object") return base;
  const fleetLimit = limitOrNull(raw.fleet && raw.fleet.limit);
  const taskLimit = limitOrNull(raw.task && raw.task.limit);
  const runs = {};
  for (const [run_id, entry] of Object.entries(raw.runs && typeof raw.runs === "object" ? raw.runs : {})) {
    const extra = Number(entry && entry.extra);
    if (Number.isInteger(extra) && extra > 0 && extra <= ALLOWANCE_MAX) runs[run_id] = { extra };
  }
  const resetAt = typeof raw.reset_at === "string" && !Number.isNaN(Date.parse(raw.reset_at)) ? raw.reset_at : null;
  return {
    schema: ALLOWANCES_SCHEMA,
    fleet: { limit: fleetLimit === undefined ? null : fleetLimit, period: PERIODS.has(raw.fleet && raw.fleet.period) ? raw.fleet.period : "reset" },
    task: { limit: taskLimit === undefined ? null : taskLimit },
    reset_at: resetAt,
    runs,
    history: Array.isArray(raw.history) ? raw.history.slice(-HISTORY_LIMIT) : [],
  };
}

/** `{ok, settings, error}` — a missing file is the defaults; a corrupt one is the defaults plus an error. */
export function readAllowances({ root }) {
  const path = join(root, ALLOWANCES_REL);
  if (!existsSync(path)) return { ok: true, settings: defaultAllowances(), error: null };
  try {
    return { ok: true, settings: normalizeAllowances(JSON.parse(readFileSync(path, "utf8"))), error: null };
  } catch (error) {
    return { ok: false, settings: defaultAllowances(), error: String((error && error.message) || error) };
  }
}

export function writeAllowances({ root, settings }) {
  const path = join(root, ALLOWANCES_REL);
  mkdirSync(dirname(path), { recursive: true });
  const temp = path + "." + process.pid + ".tmp";
  writeFileSync(temp, JSON.stringify(settings, null, 2) + "\n");
  renameSync(temp, path);
}

/** Local midnight of `nowIso`, as ISO. The laptop's zone is the owner's day. */
export function startOfLocalDay(nowIso) {
  const day = new Date(nowIso);
  day.setHours(0, 0, 0, 0);
  return day.toISOString();
}

/**
 * The shared allowance in force: its limit (settings override, else the policy's
 * `concurrency.fleetAllowance`) and the instant usage is counted from.
 *
 * @param {{settings:any, policyFleetAllowance?:(number|null), now:string}} input
 */
export function fleetWindow({ settings, policyFleetAllowance = null, now }) {
  const limit = settings.fleet.limit != null ? settings.fleet.limit : policyFleetAllowance == null ? null : Number(policyFleetAllowance);
  const source = settings.fleet.limit != null ? "settings" : policyFleetAllowance == null ? null : "policy";
  let since = settings.reset_at;
  if (settings.fleet.period === "day") {
    const midnight = startOfLocalDay(now);
    since = since && since > midnight ? since : midnight;
  }
  return { limit, source, period: settings.fleet.period, since: since || null };
}

/**
 * A run's allowance: the task default (settings, else the grant's) plus its top-up. Null stays "no ceiling".
 *
 * @param {{settings:any, grantAllowance:(number|null), run_id:string}} input
 */
export function runAllowance({ settings, grantAllowance, run_id }) {
  const base = settings.task.limit != null ? settings.task.limit : grantAllowance == null ? null : Number(grantAllowance);
  const extra = (settings.runs[String(run_id)] && settings.runs[String(run_id)].extra) || 0;
  return { base, extra, allowance: base == null ? null : base + extra };
}

/** The grant a check should evaluate: the stored one with the effective allowance. Never persist the result. */
export function effectiveGrant(grant, { settings, run_id }) {
  if (!grant || !grant.resource_policy) return grant;
  const { allowance } = runAllowance({ settings, grantAllowance: grant.resource_policy.allowance, run_id });
  if (allowance === grant.resource_policy.allowance) return grant;
  return { ...grant, resource_policy: { ...grant.resource_policy, allowance } };
}

/** The policy a check should evaluate: the loaded one with the effective shared allowance. */
export function effectivePolicy(policy, { settings, now }) {
  if (!policy || !policy.concurrency) return policy;
  const { limit } = fleetWindow({ settings, policyFleetAllowance: policy.concurrency.fleetAllowance, now });
  if (limit === policy.concurrency.fleetAllowance) return policy;
  return { ...policy, concurrency: { ...policy.concurrency, fleetAllowance: limit } };
}

const refuse = (code, detail) => ({ ok: false, refusals: [{ code, detail }] });

/**
 * Apply one owner change. Pure: returns the next settings. `usedFor(run_id)` gives a
 * run's settled usage (for `run-reset`); `knownRun(run_id)` guards run ids.
 * A repeated `command_id` is a no-op, so a retried "add 50k" never adds twice.
 */
export function applyAllowanceChange(current, change, { actor, now, usedFor = () => 0, knownRun = () => true }) {
  const settings = normalizeAllowances(current);
  const command_id = change && change.command_id ? String(change.command_id) : null;
  if (command_id && settings.history.some((entry) => entry.command_id === command_id)) return { ok: true, settings, repeated: true };
  const action = String((change && change.action) || "");
  const run_id = change && change.run_id != null ? String(change.run_id) : null;
  let detail;
  switch (action) {
    case "fleet": {
      const limit = limitOrNull(change.limit);
      if (limit === undefined) return refuse(ALLOWANCE_REFUSALS.INVALID, "limit must be a whole number from 1 to " + ALLOWANCE_MAX + ", or null");
      const period = change.period == null ? settings.fleet.period : String(change.period);
      if (!PERIODS.has(period)) return refuse(ALLOWANCE_REFUSALS.INVALID, "period must be day or reset");
      settings.fleet = { limit, period };
      detail = { limit, period };
      break;
    }
    case "fleet-reset":
      settings.reset_at = now;
      detail = { reset_at: now };
      break;
    case "task": {
      const limit = limitOrNull(change.limit);
      if (limit === undefined) return refuse(ALLOWANCE_REFUSALS.INVALID, "limit must be a whole number from 1 to " + ALLOWANCE_MAX + ", or null");
      settings.task = { limit };
      detail = { limit };
      break;
    }
    case "run-add": {
      if (!run_id || !knownRun(run_id)) return refuse(ALLOWANCE_REFUSALS.UNKNOWN_RUN, run_id);
      const amount = Number(change.amount);
      const extra = ((settings.runs[run_id] && settings.runs[run_id].extra) || 0) + amount;
      if (!isAmount(amount) || extra > ALLOWANCE_MAX) return refuse(ALLOWANCE_REFUSALS.INVALID, "amount must be a whole number from 1 to " + ALLOWANCE_MAX);
      settings.runs[run_id] = { extra };
      detail = { run_id, amount, extra };
      break;
    }
    case "run-reset": {
      if (!run_id || !knownRun(run_id)) return refuse(ALLOWANCE_REFUSALS.UNKNOWN_RUN, run_id);
      const used = Math.max(0, Math.round(Number(usedFor(run_id)) || 0));
      if (used > 0) settings.runs[run_id] = { extra: Math.min(used, ALLOWANCE_MAX) };
      else delete settings.runs[run_id];
      detail = { run_id, extra: used };
      break;
    }
    default:
      return refuse(ALLOWANCE_REFUSALS.UNKNOWN_ACTION, action || null);
  }
  settings.history = [...settings.history, { at: now, actor: String(actor || "owner"), action, detail, command_id }].slice(-HISTORY_LIMIT);
  return { ok: true, settings, repeated: false };
}

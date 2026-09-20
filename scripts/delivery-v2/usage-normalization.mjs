// scripts/delivery-v2/usage-normalization.mjs
// PM Delivery V2 — what a provider's token counter actually means.
//
// Why this module exists
// ----------------------
// A usage counter is not self-describing. Two providers can hand back the same
// four numbers and mean different things by them, and the difference decides
// whether a resumed job's reading is new spend or a restatement of spend already
// recorded against its parent.
//
// Codex (`@openai/codex` 0.144.1) reports a **thread-cumulative** counter:
//
//   1. `turn.completed.usage` is built by `usage_from_last_total()`, which reads
//      `ThreadTokenUsage.total` — not `.last`
//      (codex-rs/exec/src/event_processor_with_jsonl_output.rs:117-126, 520-521).
//   2. `ThreadTokenUsage.total` is `TokenUsageInfo.total_token_usage`
//      (codex-rs/app-server-protocol/src/protocol/v2/thread.rs:1381-1396).
//   3. `total_token_usage` accumulates every request of the thread:
//      `append_last_usage` does `total.add_assign(last)`
//      (codex-rs/protocol/src/protocol.rs:2066-2069).
//   4. On resume the session seeds that counter from the last `TokenCount` event
//      in the rollout, so it carries across `resumeThread`
//      (codex-rs/core/src/session/mod.rs:1368-1372, 1496-1501).
//
// The Claude agent SDK reports per-turn usage on each result message, which is
// already incremental. Nothing here applies a Codex rule to Claude: the semantics
// travel with the reading, declared by the adapter that produced it.
//
// What this module refuses to do
// ------------------------------
// Invent a complete total. When the baseline a delta needs is missing, when the
// counter went backwards, or when the semantics are undeclared, the reading is
// recorded with its raw value and a status that says the total is not trustworthy
// — never quietly summed into a number that reads like a measurement.

import { deepFreeze } from "./contracts.mjs";

/** How a provider's counter should be read. Declared by the adapter, not guessed. */
export const COUNTER_SEMANTICS = Object.freeze({
  /** The reading covers only the turn it arrived with. */
  PER_TURN: "per-turn",
  /** The reading is the running total of the whole provider thread. */
  THREAD_CUMULATIVE: "thread-cumulative",
  /** Nobody established what the counter counts. */
  UNKNOWN: "unknown",
});

/** Bumped when the derivation below changes, so stored rows say which rule made them. */
export const USAGE_NORMALIZATION_VERSION = "delivery-v2/usage-normalization@1";

/** What happened when a raw reading was turned into an incremental one. */
export const NORMALIZATION_STATUS = Object.freeze({
  /** Per-turn counter: the raw reading is already the increment. */
  DIRECT: "direct",
  /** Cumulative counter with a known baseline: increment = raw − baseline. */
  DELTA: "delta",
  /** Cumulative counter at the start of its thread: the baseline is a real zero. */
  THREAD_START: "thread-start",
  /** Cumulative counter whose baseline could not be found. Not a measurement. */
  BASELINE_MISSING: "baseline-missing",
  /** The counter went backwards. A reset is not a refund, and not a clean delta. */
  COUNTER_RESET: "counter-reset",
  /** The adapter declared no semantics. */
  UNSUPPORTED: "unsupported-semantics",
});

/** Statuses whose incremental value is a sound measurement of this job's spend. */
const COMPLETE_STATUSES = new Set([NORMALIZATION_STATUS.DIRECT, NORMALIZATION_STATUS.DELTA, NORMALIZATION_STATUS.THREAD_START]);

/** The counter fields every backend reports, in the shape the adapters emit. */
export const USAGE_FIELDS = Object.freeze(["input", "cachedInput", "cacheCreation", "output", "reasoningOutput"]);

const num = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Read the five counters out of anything reading-shaped, as plain numbers. */
export function usageFields(source) {
  const values = {};
  for (const field of USAGE_FIELDS) values[field] = num(source ? source[field] : 0);
  return values;
}

const BASIS = Object.freeze({
  [NORMALIZATION_STATUS.DIRECT]: "per-turn provider counter; the raw reading is the increment",
  [NORMALIZATION_STATUS.DELTA]: "thread-cumulative provider counter minus the previous reading on the same thread",
  [NORMALIZATION_STATUS.THREAD_START]: "thread-cumulative provider counter at the first reading of its thread",
  [NORMALIZATION_STATUS.BASELINE_MISSING]:
    "thread-cumulative provider counter with no previous reading to subtract; the raw value is kept and this job's share is unknown",
  [NORMALIZATION_STATUS.COUNTER_RESET]:
    "thread-cumulative provider counter that decreased; treated as a restarted counter, so usage before the reset is unaccounted",
  [NORMALIZATION_STATUS.UNSUPPORTED]: "the adapter declared no counter semantics; the raw value is kept and not interpreted",
});

/**
 * Turn one raw reading into an incremental one.
 *
 * @param {{semantics?:string, raw:(Record<string, any>|null), baseline?:(Record<string, any>|null), baselineRequired?:boolean}} input
 *   `baselineRequired` is true when this reading continues a provider thread that
 *   already produced readings — that is the only case where a missing baseline is
 *   a hole rather than a legitimate zero.
 */
export function normalizeUsageReading({ semantics = COUNTER_SEMANTICS.UNKNOWN, raw, baseline = null, baselineRequired = false }) {
  const rawValues = usageFields(raw);

  if (semantics === COUNTER_SEMANTICS.PER_TURN) return result(rawValues, rawValues, NORMALIZATION_STATUS.DIRECT, null);
  if (semantics !== COUNTER_SEMANTICS.THREAD_CUMULATIVE) return result(rawValues, rawValues, NORMALIZATION_STATUS.UNSUPPORTED, null);

  if (!baseline) {
    if (baselineRequired) return result(rawValues, rawValues, NORMALIZATION_STATUS.BASELINE_MISSING, null);
    return result(rawValues, rawValues, NORMALIZATION_STATUS.THREAD_START, null);
  }

  const baseValues = usageFields(baseline);
  // A decrease cannot be a delta: either the counter restarted or the semantics
  // are not what the adapter declared. Either way, subtracting would produce a
  // negative "usage" and hide the event.
  if (USAGE_FIELDS.some((field) => rawValues[field] < baseValues[field])) {
    return result(rawValues, rawValues, NORMALIZATION_STATUS.COUNTER_RESET, baseValues);
  }

  const delta = {};
  for (const field of USAGE_FIELDS) delta[field] = rawValues[field] - baseValues[field];
  return result(delta, rawValues, NORMALIZATION_STATUS.DELTA, baseValues);
}

function result(values, raw, status, baseline) {
  return deepFreeze({
    values,
    raw,
    status,
    complete: COMPLETE_STATUSES.has(status),
    baseline,
    basis: BASIS[status],
    version: USAGE_NORMALIZATION_VERSION,
  });
}

/**
 * Normalize every reading of one dispatch, chaining baselines within the job.
 *
 * Turns inside one job share the thread, so under a cumulative counter turn 2's
 * baseline is turn 1's *raw* value, not its increment. The job's entry baseline
 * comes from the parent job on the same thread.
 *
 * @param {{semantics?:string, readings?:{turn?:number, usage:Record<string, any>}[],
 *   baseline?:(Record<string, any>|null), baselineRequired?:boolean}} input
 */
export function normalizeJobReadings({ semantics = COUNTER_SEMANTICS.UNKNOWN, readings = [], baseline = null, baselineRequired = false }) {
  const ordered = [...readings].sort((a, b) => Number(a.turn ?? 0) - Number(b.turn ?? 0));
  const out = [];
  let previousRaw = baseline;
  let required = baselineRequired;
  for (const reading of ordered) {
    const normalized = normalizeUsageReading({ semantics, raw: reading.usage, baseline: previousRaw, baselineRequired: required });
    out.push({ turn: reading.turn ?? out.length, reading, normalized });
    if (semantics === COUNTER_SEMANTICS.THREAD_CUMULATIVE) {
      previousRaw = normalized.raw;
      // Every later turn in this job continues a thread that has now reported.
      required = true;
    }
  }
  return deepFreeze({ readings: out, incomplete: out.filter((entry) => !entry.normalized.complete).map((entry) => entry.normalized.status) });
}

/**
 * The cumulative reading a resumed job should subtract.
 *
 * Returns null — and says why — rather than guessing, because the wrong baseline
 * is worse than a flagged hole. The parent must be on the same backend *and* the
 * same provider thread: a job that fell back to a fresh thread spent everything
 * it reports.
 *
 * @param {{job:Record<string, any>, parent:(Record<string, any>|null), parentReadings?:Record<string, any>[]}} input
 */
export function threadBaselineFor({ job, parent, parentReadings = [] }) {
  const no = (reason) => deepFreeze({ baseline: null, required: false, reason, parent_job_id: parent ? String(parent.job_id) : null });
  if (!parent) return no("no parent job is recorded for this dispatch");
  if (String(parent.backend_id || "") !== String(job.backend_id || "")) return no("the parent job ran on a different backend");
  const thread = job.native_ref ? String(job.native_ref) : null;
  const parentThread = parent.native_ref ? String(parent.native_ref) : null;
  if (!thread || !parentThread) return no("no provider thread identity was observed on both jobs");
  if (thread !== parentThread) return no("a new provider thread was started, so nothing carried over");

  // Cumulative counters only grow, so the parent's last state is its largest
  // reading. Taking the max rather than the last row makes this independent of
  // row ordering and of a replayed reading arriving out of order.
  let baseline = null;
  for (const row of parentReadings) {
    const values = usageFields({
      input: row.input,
      cachedInput: row.cached_input ?? row.cachedInput,
      cacheCreation: row.cache_creation ?? row.cacheCreation,
      output: row.output,
      reasoningOutput: row.reasoning_output ?? row.reasoningOutput,
    });
    const raw = rawOf(row, values);
    if (!baseline || raw.input > baseline.input) baseline = raw;
  }
  // Same thread, nothing to subtract: this is a hole, not a fresh start. The
  // caller must flag the reading rather than treat the whole cumulative counter
  // as this job's spend.
  if (!baseline) {
    return deepFreeze({
      baseline: null,
      required: true,
      reason: "the parent job on this thread recorded no usage reading to subtract",
      parent_job_id: String(parent.job_id),
    });
  }
  return deepFreeze({ baseline, required: true, reason: null, parent_job_id: String(parent.job_id) });
}

/** A stored row's raw counters, falling back to its normalized ones for legacy rows. */
function rawOf(row, normalized) {
  const hasRaw = row.raw_input != null || row.raw_output != null;
  if (!hasRaw) return normalized;
  return usageFields({
    input: row.raw_input,
    cachedInput: row.raw_cached_input,
    cacheCreation: row.raw_cache_creation,
    output: row.raw_output,
    reasoningOutput: row.raw_reasoning_output,
  });
}

/**
 * Summarize how far a set of stored readings can be trusted.
 *
 * Used by the resource summary and the UI so a total is never shown without the
 * qualification it earned.
 *
 * @param {object[]} rows stored `usage_readings`
 */
/** @param {Record<string, any>[]} rows */
export function normalizationHealth(rows = []) {
  const statuses = new Map();
  let legacy = 0;
  for (const row of rows) {
    const parsed = parseNormalization(row);
    if (!parsed) {
      legacy += 1;
      continue;
    }
    statuses.set(parsed.status, (statuses.get(parsed.status) || 0) + 1);
  }
  const flagged = [...statuses.entries()].filter(([status]) => !COMPLETE_STATUSES.has(status));
  return deepFreeze({
    complete: flagged.length === 0 && legacy === 0,
    legacyRows: legacy,
    flagged: Object.freeze(flagged.map(([status, count]) => ({ status, count, basis: BASIS[status] || null }))),
  });
}

/** The normalization record stored with a reading, or null for a legacy row. */
export function parseNormalization(row) {
  if (!row || !row.normalization_json) return null;
  try {
    const parsed = JSON.parse(String(row.normalization_json));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

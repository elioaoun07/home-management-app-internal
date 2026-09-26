// scripts/delivery-v2/budget.mjs
// PM Delivery V2 — DLV-114: what a token limit is allowed to promise, and the
// in-stream counter that acts on it.
//
// Why this is its own module
// --------------------------
// Admission already refuses the *next* dispatch once reported use exceeds the
// allowance (jobs.mjs evaluateResources). That is a gate between jobs. DLV-107
// showed what it cannot do: one implementation job settled 220,586 normalized
// tokens against a 200,000 allowance and nothing interrupted it, because by the
// time the number existed the work was over.
//
// So this module answers two different questions, and keeps them apart because
// collapsing them is exactly how a promise gets manufactured:
//
//   1. `resolveEnforcement()` — *may* we claim to bound this job, given what the
//      selected executor's interface actually offers? A hard ceiling needs a
//      proved whole-job bound. A stop threshold needs readings that arrive while
//      the stream is still open. Neither is inferable from the other, and a
//      refusal is never silently downgraded to the weaker mode: "you asked for a
//      cap and got a threshold" is the failure this function exists to prevent.
//   2. `createBudgetMonitor()` — given that we may, has this job crossed? It is a
//      pure accumulator over readings the adapter hands it, keyed so a reading
//      seen twice counts once, and latched so one crossing asks for one stop.
//
// Pure: no fs, no clock, no store, no processes. The adapter calls `observe()`
// from inside its own stream loop; the supervisor decides what a `stop` verdict
// means durably. Neither of those belongs here.

import { deepFreeze } from "./contracts.mjs";
import { COUNTER_SEMANTICS } from "./usage-normalization.mjs";

/**
 * What a policy may ask for.
 *
 * - `advisory`   — count and warn. No claim that anything stops the job. This is
 *                  the honest default and the only mode that needs no capability.
 * - `threshold`  — stop is *requested* at the observed crossing. The turn that
 *                  crossed has already spent; overshoot is reported, never hidden.
 * - `hard-cap`   — the job cannot exceed the number. Nothing today can serve this.
 */
export const ENFORCEMENT_MODES = Object.freeze(["advisory", "threshold", "hard-cap"]);

/**
 * When a backend's usage counters become readable.
 *
 * `per-turn` means a reading arrives per turn while the stream is open, so a
 * crossing can be acted on before the next turn starts. `end-only` means the
 * first and last reading is the final one — a threshold over it would be a
 * label on a completed overrun. `unknown` is the state of a backend nobody
 * checked and qualifies for nothing.
 */
export const READING_CADENCES = Object.freeze(["per-turn", "end-only", "unknown"]);

export const BUDGET_REFUSALS = Object.freeze({
  HARD_CAP_UNAVAILABLE: "budget-hard-cap-unavailable",
  LIVE_READINGS_UNAVAILABLE: "budget-live-readings-unavailable",
  NO_LIMIT: "budget-no-limit",
  UNIT_NOT_COUNTABLE: "budget-unit-not-countable",
  UNKNOWN_MODE: "budget-unknown-mode",
});

/** The unit an in-job count is defined over. Only one is normalized today. */
export const COUNTABLE_UNIT = "tokens";

export const DEFAULT_WARN_PERCENT = 80;

const finite = (value) => value != null && Number.isFinite(Number(value));

/**
 * One reading's contribution, in the same terms as `jobs.mjs normalizedTokenTotal`.
 *
 * Input plus output. Cached input is a subset of input and reasoning a subset of
 * output, so adding either again would double-count — the correction that
 * turned this run's historic 482,416 into 284,243.
 */
export function normalizedReading(usage) {
  const value = usage && typeof usage === "object" ? usage : {};
  return Number(value.input || 0) + Number(value.output || 0);
}

/**
 * May this enforcement mode be promised for this executor and this limit?
 *
 * Returns the mode that is actually in force plus the refusals that stopped a
 * stronger one. A refusal is terminal for the requested mode: the caller refuses
 * the launch. It does not come back as `{ ok: true, mode: "advisory" }`, because
 * the owner asked for a ceiling and would have been handed a counter.
 *
 * `capability` is read from the adapter's own profile `resources` — interface
 * findings, not host observations, which is why this is answerable before any
 * qualification run.
 *
 * @param {{mode?:string, limit?:(number|null), unit?:string,
 *   capability?:{wholeJobBound?:string, strictBound?:boolean, inJobReadings?:string,
 *     inJobReadingsBasis?:(string|null)}}} input
 */
export function resolveEnforcement({ mode = "advisory", limit = null, unit = COUNTABLE_UNIT, capability = {} } = {}) {
  const refusals = [];
  const add = (code, detail) => refusals.push({ code, detail });
  const requested = String(mode || "advisory");
  if (!ENFORCEMENT_MODES.includes(requested)) {
    add(BUDGET_REFUSALS.UNKNOWN_MODE, requested);
    return deepFreeze({ ok: false, requested, mode: null, limit: null, refusals: Object.freeze(refusals), basis: null });
  }

  const cadence = READING_CADENCES.includes(String(capability.inJobReadings)) ? String(capability.inJobReadings) : "unknown";
  const bounded = capability.strictBound === true && String(capability.wholeJobBound) === "supported";

  if (requested === "advisory") {
    return deepFreeze({
      ok: true,
      requested,
      mode: "advisory",
      limit: finite(limit) ? Number(limit) : null,
      cadence,
      refusals: Object.freeze([]),
      basis:
        "advisory: usage is counted and the owner is warned; nothing here stops a running job, and admission remains the only gate between jobs",
    });
  }

  if (!finite(limit) || Number(limit) <= 0) {
    add(BUDGET_REFUSALS.NO_LIMIT, "a " + requested + " mode needs a positive numeric limit; there would be nothing to cross");
  }
  if (String(unit) !== COUNTABLE_UNIT) {
    add(
      BUDGET_REFUSALS.UNIT_NOT_COUNTABLE,
      "in-job counting is defined over " + COUNTABLE_UNIT + "; a limit in " + String(unit) + " cannot be accumulated from stream readings",
    );
  }

  if (requested === "hard-cap" && !bounded) {
    add(
      BUDGET_REFUSALS.HARD_CAP_UNAVAILABLE,
      "no whole-job bound is proved for this executor (resource.wholeJobBound is " +
        String(capability.wholeJobBound || "unobserved") +
        "), so a hard ceiling cannot be promised; reading or stopping on a count is not bounding it",
    );
  }
  if (requested === "threshold" && cadence !== "per-turn") {
    add(
      BUDGET_REFUSALS.LIVE_READINGS_UNAVAILABLE,
      "this executor reports usage " +
        cadence +
        (capability.inJobReadingsBasis ? " (" + capability.inJobReadingsBasis + ")" : "") +
        "; a stop threshold over readings that only arrive at the end would label a completed overrun as an enforced limit",
    );
  }

  if (refusals.length) {
    // Deliberately no fallback mode. The caller refuses the launch; it does not
    // quietly run the job under a weaker promise than the one that was asked for.
    return deepFreeze({ ok: false, requested, mode: null, limit: null, cadence, refusals: Object.freeze(refusals), basis: null });
  }

  return deepFreeze({
    ok: true,
    requested,
    mode: requested,
    limit: Number(limit),
    cadence,
    refusals: Object.freeze([]),
    basis:
      requested === "hard-cap"
        ? "hard-cap: the executor proves a whole-job bound, reserved in full before dispatch"
        : "threshold: a stop is requested at the first reading at or above the limit; the turn that crossed has already spent, so overshoot is reported",
  });
}

/**
 * Accumulate a job's readings against its limit.
 *
 * Three properties, each of which a test can drop on:
 *
 *   - **Keyed, and aware of what the counter counts.** Under a per-turn backend
 *     the readings are summed. Under a thread-cumulative one — Codex — each
 *     reading restates the whole thread, so summing them would count the first
 *     turn again on the second, which is precisely the double-count DLV-119
 *     corrected in the settled figures and which would make a threshold fire
 *     early. Cumulative readings are therefore taken at their maximum, minus the
 *     `threadBaseline` a resumed thread inherited from its parent job. A
 *     decreasing restatement is a reset, not a refund: the larger value stands
 *     and the event is recorded.
 *   - **Latched.** One crossing produces exactly one `stop: true` verdict and
 *     one `warn: true` verdict, whatever arrives afterwards. That is what keeps
 *     a late reading from asking for a second stop — or, downstream, a second
 *     dispatch.
 *   - **Banked-aware.** `banked` is what the run already settled before this
 *     job, so the limit is the run's, not the job's. Without it a run's second
 *     job starts from zero against a ceiling the first one nearly filled.
 *
 * @param {{mode?:string, limit?:(number|null), warnAtPercent?:number,
 *   banked?:number, unit?:string}} [input]
 */
export function createBudgetMonitor({
  mode = "advisory",
  limit = null,
  warnAtPercent = DEFAULT_WARN_PERCENT,
  banked = 0,
  threadBaseline = 0,
  unit = COUNTABLE_UNIT,
} = {}) {
  const ceiling = finite(limit) && Number(limit) > 0 ? Number(limit) : null;
  const warnAt = finite(warnAtPercent) && Number(warnAtPercent) > 0 ? Number(warnAtPercent) : DEFAULT_WARN_PERCENT;
  const base = finite(banked) ? Math.max(0, Number(banked)) : 0;
  const inherited = finite(threadBaseline) ? Math.max(0, Number(threadBaseline)) : 0;
  const seen = new Map();
  const resets = [];
  let summed = 0;
  let peak = 0;
  let cumulative = false;
  let warned = false;
  let stopRequested = false;

  // Under a cumulative counter the dispatch has spent (latest total − whatever
  // the thread had already spent before this job), never the sum of the
  // restatements.
  const observedNow = () => (cumulative ? Math.max(0, peak - inherited) : summed);
  const used = () => base + observedNow();
  const percent = () => (ceiling == null ? null : (used() / ceiling) * 100);
  const level = () => {
    if (ceiling == null) return "unmeasured";
    if (used() >= ceiling) return "exceeded";
    return percent() >= warnAt ? "warn" : "ok";
  };

  function verdict(extra) {
    return deepFreeze({
      mode,
      unit,
      limit: ceiling,
      used: used(),
      observed: observedNow(),
      banked: base,
      percent: percent(),
      level: level(),
      warn: false,
      stop: false,
      duplicate: false,
      ...extra,
    });
  }

  return {
    /**
     * Fold one reading in and say what, if anything, the caller must now do.
     *
     * @param {{key:(string|number), usage:object}} reading
     */
    observe(reading) {
      const key = String((reading && reading.key) != null ? reading.key : seen.size);
      const usage = (reading && reading.usage) || {};
      const amount = normalizedReading(usage);
      // Declared by the adapter with the reading, never assumed by proximity.
      if (String(usage.counterSemantics || "") === COUNTER_SEMANTICS.THREAD_CUMULATIVE) cumulative = true;
      const prior = seen.get(key);
      if (prior != null) {
        if (amount > prior) {
          // The same turn restated upwards: count the difference, not the whole
          // reading. A restatement downwards is a reset and keeps the larger value.
          summed += amount - prior;
          peak = Math.max(peak, amount);
          seen.set(key, amount);
        } else if (amount < prior) {
          resets.push({ key, from: prior, to: amount, reason: "a counter decreased between readings; a reset is not a refund" });
        }
        return verdict({ duplicate: true });
      }
      if (cumulative && amount < peak) {
        resets.push({ key, from: peak, to: amount, reason: "a cumulative counter decreased between readings; a reset is not a refund" });
      }
      seen.set(key, amount);
      summed += amount;
      peak = Math.max(peak, amount);

      const crossed = ceiling != null && used() >= ceiling;
      const shouldWarn = ceiling != null && !warned && (crossed || percent() >= warnAt);
      if (shouldWarn) warned = true;
      const shouldStop = crossed && mode === "threshold" && !stopRequested;
      if (shouldStop) stopRequested = true;
      return verdict({ warn: shouldWarn, stop: shouldStop, key });
    },

    /** Everything worth persisting about this job's budget, including the honest parts. */
    record(extra = {}) {
      const over = ceiling != null && used() > ceiling ? used() - ceiling : 0;
      return deepFreeze({
        mode,
        unit,
        limit: ceiling,
        warnAtPercent: warnAt,
        banked: base,
        threadBaseline: inherited,
        counterSemantics: cumulative ? COUNTER_SEMANTICS.THREAD_CUMULATIVE : COUNTER_SEMANTICS.PER_TURN,
        observed: observedNow(),
        used: used(),
        percent: percent(),
        level: level(),
        readings: seen.size,
        resets: Object.freeze([...resets]),
        warned,
        stopRequested,
        overshoot: over,
        // Never "the cap held". A threshold stop is a request made after a
        // crossing that had already been paid for.
        basis:
          mode === "threshold"
            ? stopRequested
              ? "a stop was requested at the first reading at or above the limit; the crossing turn's " +
                String(over) +
                " " +
                unit +
                " of overshoot was already spent, and provider termination is observed separately"
              : "counted per turn against the limit; no reading reached it"
            : "counted for display only; this mode stops nothing",
        ...extra,
      });
    },

    state: () => ({ used: used(), observed: observedNow(), limit: ceiling, percent: percent(), level: level(), warned, stopRequested }),
  };
}

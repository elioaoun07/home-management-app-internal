// scripts/delivery-v2/subscription-window.mjs
// PM Delivery V2 — what a subscription plan window can and cannot tell you.
//
// The worker already reads the provider's usage endpoint before every job, to
// refuse a dispatch that would spend paid credits. Until now it kept only the
// booleans and threw the percentages away, so "did that 589k-token run actually
// drain the plan?" had no answer and could not be reconstructed
// (Investigation §5.6, F9).
//
// This module normalizes that response into a *shared-window observation*:
//
//   - a percentage of a window that resets on the provider's own schedule;
//   - shared with every other thing the owner runs on that account;
//   - observed at one instant, not metered per job.
//
// Two observations bracketing a job are therefore evidence, not arithmetic. The
// difference between them is an observed shared-window change, not per-job
// consumption; it is only computed when both readings identify the same valid
// window, and this module cannot know what else used the account in between. Everything here is named so that a
// reader cannot mistake it for a per-job meter.
//
// Nothing in a window observation is a credential: percentages, window lengths,
// reset instants and a plan tier. The raw token is never read here.

import { deepFreeze } from "./contracts.mjs";

/** The shape every window observation takes, whichever provider produced it. */
export const SUBSCRIPTION_OBSERVATION_VERSION = "delivery-v2/subscription-window@1";

/** Why an observation is missing. An absent reading is never rendered as 0%. */
export const OBSERVATION_STATUS = Object.freeze({
  OBSERVED: "observed",
  UNAVAILABLE: "unavailable",
  UNSUPPORTED: "unsupported-backend",
});

const finite = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/**
 * Normalize one provider usage payload into window observations.
 *
 * @param {string} backend_id
 * @param {(Record<string, any>|null|undefined)} usage the raw endpoint response (already fetched elsewhere)
 * @param {{at:string}} input observation instant
 */
export function subscriptionObservation(backend_id, usage, { at }) {
  const base = { version: SUBSCRIPTION_OBSERVATION_VERSION, backend_id, observed_at: at };
  if (!usage || typeof usage !== "object") {
    return deepFreeze({ ...base, status: OBSERVATION_STATUS.UNAVAILABLE, windows: [], error: "no usage payload was returned", plan: null });
  }

  if (backend_id === "codex-exec-sdk") {
    const limit = usage.rate_limit || {};
    const windows = [
      window("primary", limit.primary_window),
      window("secondary", limit.secondary_window),
    ].filter(Boolean);
    return deepFreeze({
      ...base,
      status: windows.length ? OBSERVATION_STATUS.OBSERVED : OBSERVATION_STATUS.UNAVAILABLE,
      windows: Object.freeze(windows),
      plan: usage.plan_type ? String(usage.plan_type) : null,
      error: windows.length ? null : "the usage response carried no readable rate-limit window",
    });
  }

  if (backend_id === "claude-agent-sdk") {
    const windows = [
      window("five_hour", usage.five_hour),
      window("seven_day", usage.seven_day),
      window("seven_day_oauth_apps", usage.seven_day_oauth_apps),
    ].filter(Boolean);
    return deepFreeze({
      ...base,
      status: windows.length ? OBSERVATION_STATUS.OBSERVED : OBSERVATION_STATUS.UNAVAILABLE,
      windows: Object.freeze(windows),
      plan: usage.subscription_type ? String(usage.subscription_type) : null,
      error: windows.length ? null : "the usage response carried no readable utilization window",
    });
  }

  return deepFreeze({ ...base, status: OBSERVATION_STATUS.UNSUPPORTED, windows: [], plan: null, error: "no window shape is known for " + backend_id });
}

/**
 * One window's identity and fill.
 *
 * `resets_at` is part of the identity on purpose: two observations of "the 5-hour
 * window" are only comparable when they are the same instance of it. A window
 * that rolled over between the two readings makes the difference meaningless,
 * and `compareObservations` says so rather than reporting a negative delta as a
 * saving.
 */
function window(id, raw) {
  if (!raw || typeof raw !== "object") return null;
  const used = finite(raw.used_percent) ?? finite(raw.utilization);
  if (used == null) return null;
  const minutes = finite(raw.window_minutes);
  const hours = finite(raw.window_hours);
  return {
    id,
    used_percent: used,
    window_minutes: minutes ?? (hours == null ? null : hours * 60),
    resets_at: raw.resets_at == null ? null : String(raw.resets_at),
  };
}

/**
 * Bracket a job with two observations, without claiming the job caused the change.
 *
 * @param {{before?:(Record<string, any>|null), after?:(Record<string, any>|null)}} input
 */
export function compareObservations({ before = null, after = null }) {
  const deltas = [];
  const notes = [];
  if (!before || before.status !== OBSERVATION_STATUS.OBSERVED) notes.push("no usable observation before the job");
  if (!after || after.status !== OBSERVATION_STATUS.OBSERVED) notes.push("no usable observation after the job");

  if (before && after && before.status === OBSERVATION_STATUS.OBSERVED && after.status === OBSERVATION_STATUS.OBSERVED) {
    for (const post of after.windows) {
      const pre = before.windows.find((entry) => entry.id === post.id);
      if (!pre) {
        notes.push("window " + post.id + " was not observed before the job");
        continue;
      }
      if (!validIdentity(pre.resets_at) || !validIdentity(post.resets_at)) {
        notes.push("window " + post.id + " has no reset identity on one or both observations, so no difference can be read");
        continue;
      }
      if (pre.resets_at !== post.resets_at) {
        notes.push("window " + post.id + " reset between the two observations, so no difference can be read");
        continue;
      }
      if (post.used_percent < pre.used_percent) {
        notes.push("window " + post.id + " reading decreased within the same window, so no difference can be read");
        continue;
      }
      deltas.push({ id: post.id, before: pre.used_percent, after: post.used_percent, delta_percent: round(post.used_percent - pre.used_percent) });
    }
  }

  return deepFreeze({
    version: SUBSCRIPTION_OBSERVATION_VERSION,
    deltas: Object.freeze(deltas),
    notes: Object.freeze(notes),
    basis: "Observed shared-window change; not exact per-job consumption.",
  });
}

/** A reset instant is an identity only when it is a non-empty value. */
const validIdentity = (value) => typeof value === "string" && value.trim() !== "";

const round = (value) => Math.round(value * 100) / 100;

/**
 * The record stored on a job: both ends and their comparison, nothing derived
 * that pretends to be per-job consumption.
 */
/** @param {{before?:(Record<string, any>|null), after?:(Record<string, any>|null)}} input */
export function subscriptionRecord({ before = null, after = null }) {
  return deepFreeze({
    version: SUBSCRIPTION_OBSERVATION_VERSION,
    before,
    after,
    comparison: compareObservations({ before, after }),
  });
}

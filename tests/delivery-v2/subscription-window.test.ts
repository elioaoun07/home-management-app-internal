// PM Delivery V2 — subscription plan windows are observations, not a meter.
//
// Investigation F9: the worker read `used_percent` before every job and threw it
// away, so "did 589k counter-tokens actually drain the plan?" had no answer.
// These fixtures pin what the replacement may and may not claim.
import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

import {
  OBSERVATION_STATUS,
  compareObservations,
  subscriptionObservation,
  subscriptionRecord,
} from "../../scripts/delivery-v2/subscription-window.mjs";

// Shaped like the real ChatGPT usage response (see a Codex rollout's
// `rate_limits`), trimmed to the fields this module reads.
const codexUsage = (primary: number, secondary: number, resets = 1788210280): Loose => ({
  plan_type: "plus",
  credits: { has_credits: false, unlimited: false, balance: "0" },
  rate_limit: {
    allowed: true,
    limit_reached: false,
    primary_window: { used_percent: primary, window_minutes: 300, resets_at: resets },
    secondary_window: { used_percent: secondary, window_minutes: 10080, resets_at: resets + 500_000 },
  },
});

describe("subscriptionObservation", () => {
  it("keeps the percentage, the window identity and the reset instant", () => {
    const observed: Loose = subscriptionObservation("codex-exec-sdk", codexUsage(12, 3), { at: "2026-09-19T13:14:00Z" });
    expect(observed.status).toBe(OBSERVATION_STATUS.OBSERVED);
    expect(observed.windows).toHaveLength(2);
    expect(observed.windows[0]).toMatchObject({ id: "primary", used_percent: 12, window_minutes: 300 });
    expect(observed.windows[0].resets_at).toBe("1788210280");
    expect(observed.plan).toBe("plus");
    expect(observed.observed_at).toBe("2026-09-19T13:14:00Z");
  });

  it("records an unavailable reading as unavailable, never as zero", () => {
    const observed: Loose = subscriptionObservation("codex-exec-sdk", null, { at: "2026-09-19T13:14:00Z" });
    expect(observed.status).toBe(OBSERVATION_STATUS.UNAVAILABLE);
    expect(observed.windows).toEqual([]);
    expect(observed.error).toBeTruthy();
  });

  it("reads Claude's utilization windows too", () => {
    const observed: Loose = subscriptionObservation(
      "claude-agent-sdk",
      { subscription_type: "max", five_hour: { utilization: 41, resets_at: "2026-09-19T18:00:00Z" }, seven_day: { utilization: 9, resets_at: "2026-09-24T00:00:00Z" } },
      { at: "2026-09-19T13:14:00Z" },
    );
    expect(observed.windows.map((w: Loose) => w.id)).toEqual(["five_hour", "seven_day"]);
    expect(observed.windows[0].used_percent).toBe(41);
  });

  it("does not guess a window shape for an unknown backend", () => {
    expect(subscriptionObservation("something-else", codexUsage(1, 1), { at: "t" }).status).toBe(OBSERVATION_STATUS.UNSUPPORTED);
  });
});

describe("compareObservations", () => {
  it("reports a bracketed difference and says it is only an upper bound", () => {
    const record: Loose = subscriptionRecord({
      before: subscriptionObservation("codex-exec-sdk", codexUsage(12, 3), { at: "2026-09-19T13:14:00Z" }),
      after: subscriptionObservation("codex-exec-sdk", codexUsage(31, 4), { at: "2026-09-19T15:11:00Z" }),
    });
    expect(record.comparison.deltas).toEqual([
      { id: "primary", before: 12, after: 31, delta_percent: 19 },
      { id: "secondary", before: 3, after: 4, delta_percent: 1 },
    ]);
    expect(record.comparison.basis).toMatch(/upper bound/u);
    expect(record.comparison.basis).toMatch(/nothing else used the account/u);
  });

  it("refuses to subtract across a window that reset", () => {
    const comparison: Loose = compareObservations({
      before: subscriptionObservation("codex-exec-sdk", codexUsage(88, 20, 1_000), { at: "a" }),
      after: subscriptionObservation("codex-exec-sdk", codexUsage(4, 21, 2_000), { at: "b" }),
    });
    expect(comparison.deltas).toEqual([]);
    expect(comparison.notes.join(" ")).toMatch(/reset between the two observations/u);
  });

  it("says which end is missing rather than inventing a delta", () => {
    const comparison: Loose = compareObservations({ before: subscriptionObservation("codex-exec-sdk", codexUsage(5, 1), { at: "a" }), after: null });
    expect(comparison.deltas).toEqual([]);
    expect(comparison.notes).toContain("no usable observation after the job");
  });
});

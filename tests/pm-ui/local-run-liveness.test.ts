import { describe, expect, it } from "vitest";
import {
  clock,
  LIVENESS,
  liveness,
} from "../../scripts/pm/app/localRunLiveness";

const start = Date.parse("2026-11-15T10:00:00Z");
const base = {
  phase: "building",
  interrupted: false,
  activity: [
    { at: new Date(start).toISOString(), summary: "Native session started" },
  ],
  checks: [] as { finished_at?: string }[],
};
const stateAfter = (ms: number, phase = "building") =>
  liveness({ ...base, phase }, start + ms, { dataUpdatedAt: start + ms });

describe("Local liveness facts", () => {
  it("cools from live through thinking and quiet to the phase threshold", () => {
    expect(stateAfter(19_999).state).toBe("live");
    expect(stateAfter(20_000)).toMatchObject({
      state: "thinking",
      caption: "Building · 0:20",
    });
    expect(stateAfter(89_999).state).toBe("thinking");
    expect(stateAfter(90_000)).toMatchObject({
      state: "quiet",
      caption: "Quiet 1:30",
    });
    expect(stateAfter(240_000)).toMatchObject({
      state: "stale",
      caption: "No signal 4:00",
    });
    expect(stateAfter(299_999, "preparing").state).toBe("quiet");
    expect(stateAfter(LIVENESS.staleAfter.preparing, "preparing").state).toBe(
      "stale",
    );
    expect(stateAfter(599_999, "checking").state).toBe("quiet");
    expect(stateAfter(LIVENESS.staleAfter.checking, "checking").state).toBe(
      "stale",
    );
  });

  it("gives a failed or expired observation link precedence over interruption", () => {
    const run = { ...base, interrupted: true };
    expect(liveness(run, start + 12_001, { dataUpdatedAt: start }).state).toBe(
      "link-down",
    );
    expect(
      liveness(run, start, { dataUpdatedAt: start, isError: true }).state,
    ).toBe("link-down");
    expect(liveness(run, start, { dataUpdatedAt: start }).state).toBe(
      "signal-lost",
    );
  });

  it.each(["failed", "cancelled", "shipped", "reverted"])(
    "preserves %s with intentionally stopped or slower polling",
    (phase) => {
      expect(
        liveness({ ...base, phase }, start + 60_000, { dataUpdatedAt: start })
          .state,
      ).toBe(phase);
      expect(
        liveness({ ...base, phase }, start + 60_000, {
          dataUpdatedAt: start,
          isError: true,
        }).state,
      ).toBe("link-down");
    },
  );

  it("does not invent a baseline before the first preparing observation", () => {
    expect(
      liveness({ ...base, phase: "preparing", activity: [] }, start, {
        dataUpdatedAt: start,
      }),
    ).toMatchObject({
      state: "live",
      caption: "Preparing",
      lastSignalAt: null,
      sinceSignalMs: null,
    });
  });

  it("uses check completions and the newest timestamp regardless of retained row order", () => {
    const view = liveness(
      {
        ...base,
        activity: [
          { at: new Date(start + 10_000).toISOString(), summary: "x" },
          ...base.activity,
        ],
        checks: [{ finished_at: new Date(start + 20_000).toISOString() }],
      },
      start + 21_000,
    );
    expect(view).toMatchObject({
      state: "live",
      lastSignalAt: start + 20_000,
      sinceSignalMs: 1000,
    });
  });

  it("measures waiting from owner-UAT evidence, not the latest unrelated row", () => {
    const ready = {
      at: new Date(start).toISOString(),
      summary: "Ready for owner UAT",
    };
    const view = liveness(
      {
        ...base,
        phase: "uat-ready",
        activity: [
          ready,
          {
            at: new Date(start + 10_000).toISOString(),
            summary: "Owner opened diff review",
          },
        ],
      },
      start + 3 * 3_600_000,
    );
    expect(view).toMatchObject({
      state: "your-turn",
      caption: "Waiting 3h",
      waitingMs: 3 * 3_600_000,
    });
    expect(
      liveness({ ...base, phase: "uat-ready", activity: [] }, start).caption,
    ).toBe("Your turn");
    expect(
      liveness({ ...base, phase: "revert-push-pending" }, start).caption,
    ).toBe("Push pending");
  });

  it("formats elapsed time without negative or fractional counters", () => {
    expect(clock(-1)).toBe("0:00");
    expect(clock(70_999)).toBe("1:10");
    expect(clock(3_661_000)).toBe("1:01:01");
  });
});

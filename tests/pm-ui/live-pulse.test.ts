// Live proof of work: readable lines from recorded activity, and a trace whose
// spikes come only from recorded signal times.
import { describe, expect, it } from "vitest";

import { activityLine, tracePath } from "../../scripts/pm/app/LivePulse";

describe("live pulse", () => {
  it("turns recorded commands and messages into short lines", () => {
    expect(activityLine("command", "/bin/sh -lc \"sed -n '1,180p' src/components/dashboard/TransactionDetailModal.tsx\"")).toBe("Reading TransactionDetailModal.tsx");
    expect(activityLine("command", "/bin/sh -lc \"rg -n split src\"")).toBe("Searching the code");
    expect(activityLine("command", "node /deps/node_modules/vitest/vitest.mjs run")).toBe("Running checks");
    expect(activityLine("message", "I’ll inspect only the declared touchpoints. Then plan.")).toBe("I’ll inspect only the declared touchpoints.");
    expect(activityLine("message", null)).toBe("Thinking");
    expect(activityLine("message", '```json\n{ "outcome": "x" }')).toBe("Writing the summary");
  });

  it("draws a flat trace without signals and a spike per recent signal", () => {
    const now = Date.parse("2026-09-19T13:15:35.000Z");
    const flat = tracePath([], now);
    expect(new Set(flat.split(" ").map((point) => point.split(",")[1])).size).toBe(1);
    const spiked = tracePath([now - 1000, now - 400_000], now);
    const ys = spiked.split(" ").map((point) => Number(point.split(",")[1]));
    expect(Math.min(...ys)).toBeLessThan(ys[0]);
    // The 400 s old signal is outside the window: exactly one spike.
    expect(spiked.split(" ").length).toBe(flat.split(" ").length + 2);
  });
});

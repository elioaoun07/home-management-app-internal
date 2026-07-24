import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { atomicWriteJsonSync } from "../../scripts/delivery/fsx.mjs";
import { getStartupCrashBackoff, recordStartupCrash } from "../../scripts/delivery/run-session.mjs";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("runner startup crash protection", () => {
  it("parks a session and activates backoff after three identical rapid startup crashes", () => {
    const dir = mkdtempSync(join(tmpdir(), "delivery-runner-crash-")); dirs.push(dir);
    const now = new Date("2026-07-24T12:00:00.000Z");
    atomicWriteJsonSync(join(dir, "state.json"), {
      schemaVersion: 1, sessionId: "s-test", state: "BUILDING", awaiting: null,
      phaseHistory: [], usage: { perPhase: {}, total: {} }, createdAt: now.toISOString(), updatedAt: now.toISOString(),
    });
    const err = new Error("cannot load startup dependency");
    recordStartupCrash(dir, err, { now: () => now });
    recordStartupCrash(dir, err, { now: () => now });
    const result = recordStartupCrash(dir, err, { now: () => now });

    expect(result.tripped).toBe(true);
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    expect(state.state).toBe("BLOCKED");
    expect(state.awaiting).toMatchObject({ gate: "blocked", reason: "runner-crash", returnTo: "BUILDING" });
    expect(getStartupCrashBackoff(dir, { now: () => now })?.retryAfter).toBeTruthy();
  });
});

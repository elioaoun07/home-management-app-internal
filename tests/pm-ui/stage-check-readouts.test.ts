import { describe, expect, it } from "vitest";
import {
  hostCheckReadout,
  checkDuration,
  observedCheckTime,
} from "../../scripts/pm/app/stage/checkReadouts";
import type { LocalScene } from "../../scripts/pm/app/localRunScene";
const at = (seconds: number) =>
  Date.parse("2026-11-15T10:00:00Z") + seconds * 1000;
function scene(): LocalScene {
  return {
    at: at(30),
    phase: "checking",
    events: [],
    run: { checks: [], interrupted: false },
  } as unknown as LocalScene;
}
const event = (
  summary: string,
  seconds: number,
  kind = "event",
  detail: string | null = null,
) =>
  ({
    id: summary,
    at: new Date(at(seconds)).toISOString(),
    summary,
    kind,
    detail,
  }) as LocalScene["events"][number];
const check = (
  overrides: Partial<LocalScene["run"]["checks"][number]> = {},
) => ({
  name: "typecheck",
  exit: 0,
  stdout: "",
  stderr: "",
  error: null,
  ...overrides,
});
describe("host stopwatch evidence", () => {
  it("never infers a check start from the phase or generic host milestone", () => {
    const s = scene();
    s.events = [
      event("Host checks started", 1),
      event("typecheck: 0", 8, "check", "typecheck"),
    ];
    s.run.checks = [check({ finished_at: new Date(at(8)).toISOString() })];
    const value = hostCheckReadout(s, "typecheck");
    expect(value.start).toBeNull();
    expect(value.exit).toBe(0);
    expect(checkDuration(value, at(30))).toBeNull();
  });
  it("uses actual host timestamps and never turns an invalid interval into zero", () => {
    const s = scene();
    s.run.checks = [
      check({
        started_at: new Date(at(2)).toISOString(),
        finished_at: new Date(at(8)).toISOString(),
      }),
    ];
    expect(checkDuration(hostCheckReadout(s, "typecheck"), at(30))).toBe(6000);
    s.run.checks[0].finished_at = new Date(at(1)).toISOString();
    expect(checkDuration(hostCheckReadout(s, "typecheck"), at(30))).toBeNull();
  });
  it("accepts only the exact supervisor started row, not messages or commands", () => {
    const s = scene();
    s.events = [
      event("lint started", 3, "message"),
      event("test started", 4, "command"),
      event("typecheck started", 5),
    ];
    expect(hostCheckReadout(s, "lint").start).toBeNull();
    expect(hostCheckReadout(s, "test").start).toBeNull();
    const value = hostCheckReadout(s, "typecheck");
    expect(value.running).toBe(true);
    expect(checkDuration(value, at(10))).toBe(5000);
  });
  it("rejects a native tool request that uses a host-start phrase", () => {
    const s = scene(),
      request = event("typecheck started", 5);
    request.label = "Tool requested";
    s.events = [request];
    expect(hostCheckReadout(s, "typecheck").start).toBeNull();
    expect(hostCheckReadout(s, "typecheck").running).toBe(false);
  });
  it("reads result exit and finish from recorded host rows while hiding future start timestamps", () => {
    const s = scene();
    s.events = [
      event("pm:lint started", 6),
      event("pm:lint: 2", 10, "check", "pm:lint"),
    ];
    const value = hostCheckReadout(s, "pm:lint");
    expect(value.exit).toBe(2);
    expect(checkDuration(value, s.at)).toBe(4000);
    s.run.checks = [check({ started_at: new Date(at(50)).toISOString() })];
    expect(hostCheckReadout(s, "typecheck").start).toBeNull();
  });
  it("freezes signal lost at the last actual signal, link down at last observation, and replay at its playhead", () => {
    const s = scene();
    s.events = [event("typecheck started", 5), event("Observation", 9)];
    s.run.interrupted = true;
    expect(observedCheckTime(s, "signal-lost", at(100), false)).toBe(at(9));
    s.run.interrupted = false;
    expect(observedCheckTime(s, "link-down", at(100), false)).toBe(s.at);
    expect(observedCheckTime(s, "live", at(100), false)).toBe(at(100));
    expect(observedCheckTime(s, "signal-lost", at(12), true)).toBe(at(9));
  });
});

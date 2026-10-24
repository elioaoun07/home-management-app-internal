import { afterEach, describe, expect, it, vi } from "vitest";
import { readinessCanLaunch, readinessCanStart, readinessIssues, readinessRows } from "../../scripts/pm/app/readinessModel";
import { createLocalTransport } from "../../scripts/pm/app/localTransport";
import { evaluateReadiness, LAUNCH_GATES, readinessFact } from "../../scripts/delivery-v2/readiness.mjs";
import type { V2Readiness, V2ReadinessSelection } from "../../scripts/pm/app/types";

afterEach(() => vi.unstubAllGlobals());
const selection: V2ReadinessSelection = { file: "Delivery/4 - Checklist.md", id: "DLV-137", executor: "codex", model: "gpt-6.1-sol", effort: "medium", workProfile: "focused" };
const satisfied = () => Object.fromEntries(LAUNCH_GATES.map(gate => [gate, readinessFact("satisfied", gate)]));
function response(): V2Readiness {
  return { ...evaluateReadiness({ selection, facts: satisfied() }), expiresAt: new Date(Date.now() + 30_000).toISOString() } as V2Readiness;
}
// Passive gates current, live evidence expired: what Start sees a minute after Check readiness.
function staleLive(extra: Record<string, ReturnType<typeof readinessFact>> = {}, collection?: V2Readiness["collection"]): V2Readiness {
  const facts = { ...satisfied(), runtime: readinessFact("blocked", "runtime-stale"), authentication: readinessFact("unavailable", "authentication-runtime-unavailable"),
    environment: readinessFact("blocked", "environment-stale"), modelAvailability: readinessFact("unknown", "native-model-unprobed"),
    qualification: readinessFact("unavailable", "qualification-binding-unavailable"), ...extra };
  return { ...evaluateReadiness({ selection, facts }), expiresAt: null, collection } as V2Readiness;
}
describe("readiness projection", () => {
  it("refuses stale, incomplete, changed-selection or different-phase projections", () => {
    const ready = response();expect(readinessCanStart(ready, selection)).toBe(true);
    expect(readinessCanStart({ ...ready, expiresAt: new Date(0).toISOString() }, selection)).toBe(false);
    expect(readinessCanStart({ ...ready, facts: {} }, selection)).toBe(false);
    expect(readinessCanStart({ ...ready, phase: "coordination" }, selection)).toBe(false);
    expect(readinessCanStart(ready, { ...selection, model: "other" })).toBe(false);
    expect(readinessCanStart(null, selection)).toBe(false);
  });
  it("lets Start collect expired live evidence, but never past a passive blocker or another selection", () => {
    const stale = staleLive();
    expect(readinessCanStart(stale, selection)).toBe(false);expect(readinessCanLaunch(stale, selection)).toBe(true);
    expect(readinessRows(stale).filter(row => row.state === "start").map(row => row.gate)).toEqual(["runtime", "authentication", "modelAvailability", "environment", "qualification"]);
    expect(readinessIssues(stale)).toEqual([]);
    const held = staleLive({ coordination: readinessFact("blocked", "coordination-current") });
    expect(readinessCanLaunch(held, selection)).toBe(false);
    expect(readinessCanLaunch(stale, { ...selection, effort: "high" })).toBe(false);
    expect(readinessCanLaunch(null, selection)).toBe(false);
  });
  it("names the owner's fix: the failed live stage first, then each passive blocker once", () => {
    const stages = [{ name: "docker", outcome: "blocked", code: "docker-unavailable", durationMs: 40 }];
    const docker = staleLive({ runtime: readinessFact("blocked", "runtime-observed"), environment: readinessFact("blocked", "environment-observed", "Docker is not running"),
      modelAvailability: readinessFact("unknown", "native-model-observed") }, { stages });
    expect(readinessRows(docker).find(row => row.gate === "environment")?.state).toBe("fix");
    expect(readinessIssues(docker)).toEqual(["Start Docker Desktop"]);
    const signIn = staleLive({ runtime: readinessFact("satisfied", "runtime-observed"), authentication: readinessFact("blocked", "subscription-observed", "sign-in expired (run codex once)") },
      { stages: [{ name: "environment", outcome: "satisfied", code: null, durationMs: 1 }, { name: "credential-sync", outcome: "blocked", code: "credential-sync-unavailable", durationMs: 1 }] });
    expect(readinessIssues(signIn)).toEqual(["sign-in expired (run codex once)"]);
    const passive = staleLive({ policy: readinessFact("blocked", "grant-expired", "2026-10-20T19:15:55.000Z"), environment: readinessFact("blocked", "environment-manifest-mismatch") });
    expect(readinessIssues(passive)).toEqual(["Authorization expired — check readiness", "package.json or lockfile changed"]);
    const compiler = staleLive({ checks: readinessFact("blocked", "checks-not-prepared", "generated compiler input changed") });
    expect(readinessIssues(compiler)).toEqual(["Refresh build setup"]);
    expect(compiler.facts.checks.detail).toBe("generated compiler input changed");
    // An old failed collection does not outlive its expired observations.
    expect(readinessIssues(staleLive({}, { stages }))).toEqual([]);
  });
  it("uses one read-only GET with exact selection; no pairing, mutation or credential request", async () => {
    const payload = response(), fetcher = vi.fn(async (_path: RequestInfo | URL, _options?: RequestInit) => new Response(JSON.stringify(payload), { status: 200 }));vi.stubGlobal("fetch", fetcher);
    const result = await createLocalTransport().v2Readiness!(selection);
    expect(result).toEqual(payload);expect(fetcher).toHaveBeenCalledTimes(1);
    const [path, options] = fetcher.mock.calls[0];
    const url = new URL(String(path), "http://localhost");expect(url.pathname).toBe("/api/delivery/v2/readiness");
    expect(Object.fromEntries(url.searchParams)).toEqual(selection);expect(options?.method).toBeUndefined();expect(options?.body).toBeUndefined();
  });
});

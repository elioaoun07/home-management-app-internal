import { afterEach, describe, expect, it, vi } from "vitest";
import { readinessCanStart, readinessLabels } from "../../scripts/pm/app/readinessModel";
import { createLocalTransport } from "../../scripts/pm/app/localTransport";
import { evaluateReadiness, LAUNCH_GATES, readinessFact } from "../../scripts/delivery-v2/readiness.mjs";
import type { V2Readiness, V2ReadinessSelection } from "../../scripts/pm/app/types";

afterEach(() => vi.unstubAllGlobals());
const selection: V2ReadinessSelection = { file: "Delivery/4 - Checklist.md", id: "DLV-137", executor: "codex", model: "gpt-6.1-sol", effort: "medium", workProfile: "focused" };
function response(): V2Readiness {
  return { ...evaluateReadiness({ selection, facts: Object.fromEntries(LAUNCH_GATES.map(gate => [gate, readinessFact("satisfied", gate)])) }), expiresAt: new Date(Date.now() + 30_000).toISOString() } as V2Readiness;
}
describe("readiness projection", () => {
  it("keeps every server blocker, including unavailable dependencies, without choosing a workaround", () => {
    const result = { ...evaluateReadiness({ selection }), expiresAt: null } as V2Readiness;
    expect(readinessLabels(result).map(row => row.code)).toEqual(result.blockers.map(row => row.code));
    expect(readinessCanStart(result, selection)).toBe(false);expect(readinessCanStart(null, selection)).toBe(false);
  });
  it("refuses stale, incomplete, changed-selection or different-phase projections", () => {
    const ready = response();expect(readinessCanStart(ready, selection)).toBe(true);
    expect(readinessCanStart({ ...ready, expiresAt: new Date(0).toISOString() }, selection)).toBe(false);
    expect(readinessCanStart({ ...ready, facts: {} }, selection)).toBe(false);
    expect(readinessCanStart({ ...ready, phase: "coordination" }, selection)).toBe(false);
    expect(readinessCanStart(ready, { ...selection, model: "other" })).toBe(false);
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

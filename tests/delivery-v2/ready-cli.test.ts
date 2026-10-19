import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runReadyCli } from "../../scripts/delivery-v2/ready-cli.mjs";
import { evaluateReadiness, readinessFact, LAUNCH_GATES } from "../../scripts/delivery-v2/readiness.mjs";
import { createDeliveryV2Context } from "../../scripts/delivery-v2/service.mjs";
import { routeDeliveryV2 } from "../../scripts/delivery-v2/entry.mjs";
import { seedRoot, writePolicy, bookPathIn, SELECT } from "./fixtures/v2-harness";

const roots: string[] = [];
const temp = () => { const root = mkdtempSync(join(tmpdir(), "era-ready-cli-")); roots.push(root); return root; };
afterEach(() => { vi.useRealTimers(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const selection = { file: SELECT.file, id: SELECT.expectId, executor: "claude", model: "claude-test", effort: "low", workProfile: "focused" };
const origin = "http://127.0.0.1:4317";
const at = Date.parse("2026-10-18T12:00:00.000Z");
const args = ["--file", selection.file, "--id", selection.id, "--executor", selection.executor, "--model", selection.model, "--effort", selection.effort, "--service", origin];
function current() {
  return { ...evaluateReadiness({ selection, facts: Object.fromEntries(LAUNCH_GATES.map(gate => [gate, readinessFact("satisfied", gate + "-current")])) }),
    contextFingerprint: "sha256:" + "a".repeat(64), expiresAt: new Date(at + 30_000).toISOString() };
}
async function cli(fetcher: typeof fetch, root = temp(), supplied = args) {
  let text = "";
  const code = await runReadyCli(supplied, { root, fetcher, now: () => at, write: value => { text += value; } });
  return { code, result: JSON.parse(text) };
}
function snapshot(root: string) {
  const files: Record<string, string> = {};
  function walk(path: string, prefix = "") {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) walk(join(path, entry.name), name + "/");
      else files[name] = createHash("sha256").update(readFileSync(join(path, entry.name))).digest("hex");
    }
  }
  walk(root);
  return files;
}

describe("passive service-backed readiness CLI", () => {
  it("reads the service-owned WAL view through the existing public route without probes or file changes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(at);
    const root = temp(); seedRoot(root);
    writeFileSync(bookPathIn(root), readFileSync(bookPathIn(root), "utf8").replace("### BUD-14", '### BUD-14\n\n**Touches:** `src/amount.ts`'));
    writePolicy(root, { scratchScope: { kind: "snapshot", include: ["src/amount.ts", "src/config.ts", "tests/amount.check.mjs"] } });
    const runtimeFactory = vi.fn(() => { throw new Error("runtime forbidden"); });
    const context = createDeliveryV2Context({ ROOT: root, runtimeFactory });
    context.store.listRuns();
    expect(existsSync(join(root, ".delivery/v2/supervisor.sqlite-wal"))).toBe(true);
    const before = snapshot(root);
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      const response = await routeDeliveryV2({ method: init?.method || "GET", path: url.pathname, query: url.searchParams, headers: init?.headers }, context);
      return Response.json(response?.json, { status: response?.status });
    });
    try {
      const expected = await context.readiness(selection);
      const actual = await cli(fetcher, root);
      expect(actual).toEqual({ code: 1, result: expected });
      expect(actual.result.facts.coordination.state).toBe("satisfied");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(runtimeFactory).not.toHaveBeenCalled();
      expect(existsSync(join(root, ".delivery/v2/local-auth.json"))).toBe(false);
      expect(snapshot(root)).toEqual(before);
    } finally { context.close(); }
  });

  it("preserves a current positive projection using one credential-free GET", async () => {
    const result = current();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(result));
    expect(await cli(fetcher)).toEqual({ code: 0, result });
    const [input, init] = fetcher.mock.calls[0];
    expect(new URL(String(input)).pathname).toBe("/api/delivery/v2/readiness");
    expect(Object.fromEntries(new URL(String(input)).searchParams)).toEqual(selection);
    expect(init).toMatchObject({ method: "GET", headers: { Accept: "application/json" }, credentials: "omit", redirect: "error", cache: "no-store" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("normalizes work identity exactly as the shared inspector does", async () => {
    const supplied = args.map(value => value === selection.id ? value.toLowerCase() : value);
    expect((await cli(async () => Response.json(current()), temp(), supplied)).code).toBe(0);
  });

  it.each(["runtime-unprobed", "runtime-stale", "authentication-runtime-unavailable"])("preserves the service blocker %s without refreshing", async code => {
    const positive = current();
    const result = { ...evaluateReadiness({ selection, facts: { ...positive.facts, runtime: readinessFact("unknown", code) } }), contextFingerprint: positive.contextFingerprint, expiresAt: null };
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(result));
    expect(await cli(fetcher)).toEqual({ code: 1, result });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([null, "invalid", new Date(at).toISOString(), new Date(at - 1).toISOString(), new Date(at + 30_001).toISOString()])("refuses an expired, missing or inflated positive projection deadline (%s)", async expiresAt => {
    const result = { ...current(), expiresAt };
    expect(await cli(async () => Response.json(result))).toEqual({ code: 2, result: { error: "inspection-unavailable", detail: "service-readiness-stale" } });
  });

  it("refuses a valid projection for a different selection", async () => {
    const positive = current();
    const result = { ...positive, ...evaluateReadiness({ selection: { ...selection, effort: "high" }, facts: positive.facts }) };
    expect((await cli(async () => Response.json(result))).result.detail).toBe("service-selection-mismatch");
  });

  it("refuses a changed or malformed context/facts projection", async () => {
    const positive = current();
    for (const result of [
      { ...positive, contextFingerprint: null },
      { ...positive, schema: "unknown" },
      { ...positive, facts: { ...positive.facts, runtime: readinessFact("unknown", "runtime-stale") } },
      { ...positive, fingerprint: "sha256:" + "b".repeat(64) },
    ]) expect((await cli(async () => Response.json(result))).result.detail).toBe("service-readiness-invalid");
  });

  it.each(["https://example.com", "http://owner:secret@localhost:4317", "http://localhost:4317/other", "http://localhost:4317/?token=secret"])("refuses an unsafe service origin without sending a request (%s)", async service => {
    const fetcher = vi.fn<typeof fetch>();
    expect((await cli(fetcher, temp(), [...args.slice(0, -1), service])).result.detail).toBe("service-origin-invalid");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not fall back or retry an unavailable, redirected, refused or malformed service", async () => {
    for (const fetcher of [
      vi.fn<typeof fetch>(async () => { throw new Error("connection refused or redirect"); }),
      vi.fn<typeof fetch>(async () => Response.json({ error: "local-session-required" }, { status: 401 })),
      vi.fn<typeof fetch>(async () => new Response("not json")),
    ]) {
      const root = temp();
      const result = await cli(fetcher, root);
      expect(result.code).toBe(2);
      expect(result.result.error).toBe("inspection-unavailable");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(readdirSync(root)).toEqual([]);
    }
  });
});

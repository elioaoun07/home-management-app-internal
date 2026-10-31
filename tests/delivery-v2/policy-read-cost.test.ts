import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadExecutionPolicy } from "../../scripts/delivery-v2/policy.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { seedRoot, writePolicy, makeHarness, journeyFor, plannedRun } from "./fixtures/v2-harness";

// The bridge reads every run every 5 s on the server's only thread. A source-tree
// walk per policy load there held /api/health past the browser's 3 s probe, and
// the Command Center showed "Offline" while the server was running.
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "era-policy-read-"));
  roots.push(root);
  seedRoot(root);
  writePolicy(root, { scratchScope: { kind: "snapshot", include: ["src"] } });
  return root;
}

describe("policy loads on read paths", () => {
  it("leaves directory scopes unexpanded unless the caller freezes inputs", () => {
    const root = fixture();
    expect(loadExecutionPolicy({ root }).policy!.scratchScope.include).toEqual(["src"]);
    expect(loadExecutionPolicy({ root, materialize: true }).policy!.scratchScope.include).toEqual(["src/amount.ts", "src/config.ts"]);
  });

  it("freezes the expanded scope at Start, and run reads never walk the tree", async () => {
    const root = fixture();
    const store = openStore({ path: join(root, ".delivery/v2/supervisor.sqlite") });
    const loadPolicy = vi.fn((input: { root: string; materialize?: boolean }) => loadExecutionPolicy(input));
    const journey = journeyFor({ root, data: join(root, ".test"), store, harness: makeHarness(root), overrides: { loadPolicy } });
    try {
      const { run_id } = await plannedRun(journey, "plan-once");
      expect(loadPolicy.mock.calls.some(([input]) => input.materialize === true)).toBe(true);
      const run = store.getRun(run_id)!;
      expect(store.getContract(String(run.contract_id), Number(run.contract_revision))!.scratchScope.include).toEqual(["src/amount.ts", "src/config.ts"]);

      loadPolicy.mockClear();
      journey.list();
      journey.detail(run_id);
      journey.queue();
      expect(loadPolicy).toHaveBeenCalled();
      expect(loadPolicy.mock.calls.filter(([input]) => input.materialize)).toEqual([]);
    } finally {
      await journey.settle?.();
      store.close();
    }
  });
});

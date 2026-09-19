// Command Center Phase 5 — the coordination rules (DLV-106), pure.
//
// Declared and observed scope in, one of three verdicts out, each with reasons:
// Can run together, Must follow, Needs scope check. Missing scope is unknown, never
// independence; same-module items are judged by what they touch, not by module.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  COORDINATION_REFUSALS,
  DEFAULT_CONCURRENCY,
  REASONS,
  VERDICTS,
  WRITER_CEILING,
  capacityReasons,
  classify,
  consumedPaths,
  coordinate,
  coordinationRules,
  dependencyState,
  filesUnder,
  importTargets,
  isQueueable,
  itemFacts,
  makeFootprint,
  readBacklog,
  relate,
  scopeGrowth,
} from "../../scripts/delivery-v2/coordination.mjs";
import { declaredTouches, dependencyIds } from "../../scripts/pm/shared/declarations.mjs";
import { policyTemplate, validateExecutionPolicy } from "../../scripts/delivery-v2/policy.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

const rules = coordinationRules(DEFAULT_CONCURRENCY);
const item = (alias: string, facts: Loose = {}) => ({
  key: alias.toUpperCase(),
  alias,
  dependencyIds: facts.dependencyIds || [],
  footprint: makeFootprint({ declared: facts.declared ?? null, plan: facts.plan || [], observed: facts.observed || [] }),
  consumes: facts.consumes || [],
  checkResources: facts.checkResources || [],
});
const codes = (result: Loose) => result.reasons.map((reason: Loose) => reason.code);

const temps: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "era-v2-coordination-"));
  temps.push(dir);
  return dir;
};
const put = (root: string, path: string, text: string) => {
  mkdirSync(join(root, ...path.split("/").slice(0, -1)), { recursive: true });
  writeFileSync(join(root, ...path.split("/")), text, "utf8");
};

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("declared facts", () => {
  it("reads Touches as scope, keeps an absent declaration unknown and drops unsafe paths", () => {
    expect(declaredTouches("- **Touches:** `src/a.ts`, src/lib/, ../escape, /abs/path, C:/x")).toEqual(["src/a.ts", "src/lib"]);
    expect(declaredTouches("- **Acceptance:** something")).toBeNull();
    expect(declaredTouches("- **Touches:** none")).toEqual([]);
  });

  it("reads prerequisites from Depends on and a HELD title, never from an outgoing blocks line", () => {
    expect(dependencyIds("- **Depends on:** BUD-14, SCH-4.3b\n- **Dependencies:** blocks KIT-2", "Item")).toEqual(["BUD-14", "SCH-4.3B"]);
    expect(dependencyIds("", "Run safely — HELD — DLV-105, R61")).toEqual(["DLV-105", "R61"]);
  });

  it("builds item facts from the Master Book section and the checklist title", () => {
    const book = "### BUD-15\n\n- **Touches:** `src/label.ts`\n- **Depends on:** BUD-14\n\n**Provenance:** **Touches:** src/ignored.ts\n";
    const facts = itemFacts({ alias: "BUD-15", title: "Label — HELD — owner", bookRaw: book });
    expect(facts).toMatchObject({ key: "BUD-15", held: true, dependencyIds: ["BUD-14"], declared: ["src/label.ts"] });
  });
});

describe("pairwise verdicts", () => {
  it("lets two items in the same module run together when their files are disjoint", () => {
    const pair = relate(item("BUD-14", { declared: ["src/features/budget/amount.ts"] }), item("BUD-15", { declared: ["src/features/budget/label.ts"] }), rules);
    expect(pair.verdict).toBe(VERDICTS.TOGETHER);
    expect(pair.label).toBe("Can run together");
    expect(pair.reasons).toEqual([]);
  });

  it("makes overlapping paths follow, including a declared directory and a case-only difference", () => {
    expect(relate(item("A", { declared: ["src/features/budget"] }), item("B", { plan: ["src/features/budget/label.ts"] }), rules)).toMatchObject({
      verdict: VERDICTS.FOLLOW,
      reasons: [{ code: REASONS.PATH, with: "B", paths: ["src/features/budget/label.ts"] }],
    });
    expect(relate(item("A", { observed: ["src/Amount.ts"] }), item("B", { declared: ["src/amount.ts"] }), rules).verdict).toBe(VERDICTS.FOLLOW);
  });

  it("makes a shared utility and its importer follow with a shared-contract reason", () => {
    const utility = item("BUD-16", { declared: ["src/lib/money.ts"] });
    const consumer = item("BUD-17", { declared: ["src/features/budget/total.ts"], consumes: ["src/lib/money.ts"] });
    const pair = relate(consumer, utility, rules);
    expect(pair.verdict).toBe(VERDICTS.FOLLOW);
    expect(pair.reasons).toEqual([{ code: REASONS.CONTRACT, with: "BUD-16", paths: ["src/lib/money.ts"] }]);
    // Importing a module nobody changes is not a conflict.
    expect(relate(item("X", { declared: ["src/a.ts"], consumes: ["src/lib/date.ts"] }), utility, rules).verdict).toBe(VERDICTS.TOGETHER);
  });

  it("serializes dependency manifests, schema and generated outputs by class", () => {
    expect(codes(relate(item("A", { declared: ["package.json"] }), item("B", { declared: ["pnpm-lock.yaml"] }), rules))).toEqual([REASONS.LOCKFILE]);
    expect(codes(relate(item("A", { declared: ["migrations/2026-09-12_a.sql"] }), item("B", { declared: ["migrations/2026-09-12_b.sql"] }), rules))).toEqual([REASONS.SCHEMA]);
    expect(codes(relate(item("A", { observed: ["public/atlas/atlas.json", "src/a.tsx"] }), item("B", { observed: ["public/atlas/atlas.json", "src/b.tsx"] }), rules))).toEqual([REASONS.PATH]);
    const custom = coordinationRules({ ...DEFAULT_CONCURRENCY, generated: ["docs/generated.json"] });
    expect(classify(["docs/generated.json"], custom).generated).toEqual(["docs/generated.json"]);
  });

  it("treats missing scope as unknown, never as independence", () => {
    const pair = relate(item("BUD-20"), item("BUD-14", { declared: ["src/amount.ts"] }), rules);
    expect(pair.verdict).toBe(VERDICTS.SCOPE);
    expect(pair.label).toBe("Needs scope check");
    expect(pair.reasons).toEqual([{ code: REASONS.SCOPE_UNKNOWN, with: "BUD-14", unknown: ["BUD-20"] }]);
  });

  it("orders the same item, a prerequisite and a shared check resource", () => {
    expect(codes(relate(item("BUD-14", { declared: [] }), item("bud-14", { declared: [] }), rules))).toContain(REASONS.SAME_ITEM);
    expect(relate(item("BUD-21", { declared: ["src/x.ts"], dependencyIds: ["BUD-14"] }), item("BUD-14", { declared: ["src/y.ts"] }), rules).reasons).toEqual([
      { code: REASONS.DEPENDENCY_OPEN, with: "BUD-14", first: "BUD-14" },
    ]);
    expect(codes(relate(item("A", { declared: ["src/a.ts"], checkResources: ["db:test"] }), item("B", { declared: ["src/b.ts"], checkResources: ["db:test"] }), rules))).toEqual([
      REASONS.CHECK_RESOURCE,
    ]);
  });

  it("names scope a writer discovered beyond what was declared and approved", () => {
    expect(scopeGrowth(makeFootprint({ declared: ["src/amount.ts"], plan: ["src/lib"], observed: ["src/amount.ts", "src/lib/x.ts", "src/label.ts"] }))).toEqual(["src/label.ts"]);
  });
});

describe("imports", () => {
  it("resolves alias and relative imports to repo files and ignores packages", () => {
    const exists = (path: string) => ["src/lib/money.ts", "src/lib/date/index.ts"].includes(path);
    const text = 'import { a } from "@/lib/money";\nimport b from "../../lib/date";\nimport React from "react";\nconst c = require("./local");';
    expect(importTargets({ path: "src/features/budget/total.ts", text, exists })).toEqual(["src/features/budget/local", "src/lib/date/index.ts", "src/lib/money.ts"]);
  });

  it("walks a declared directory for the modules its code imports", () => {
    const root = temp();
    put(root, "src/lib/money.ts", "export const money = 1;\n");
    put(root, "src/features/budget/total.ts", 'import { money } from "@/lib/money";\n');
    put(root, "src/features/budget/readme.md", 'from "@/lib/ignored"\n');
    const consumed = consumedPaths({ paths: ["src/features/budget"], readers: [filesUnder(root)] });
    expect(consumed.paths).toEqual(["src/lib/money.ts"]);
    expect(consumed.capped).toBe(false);
  });
});

describe("prerequisites from the canonical backlog", () => {
  it("reads open, completed, shipped and cancelled work, and nothing else counts as satisfied", () => {
    const root = temp();
    const pm = "PM";
    put(root, pm + "/Budget/4 - Checklist.md", "# Budget\n\n## Now\n\n- [ ] **BUD-14** open _(friction - S)_\n- [x] **BUD-13** ticked _(friction - S)_\n");
    put(root, pm + "/Budget/Budget — Master Book.md", "## Shipped Log\n\n- ✅ 2026-09-01 — **BUD-9** shipped (evidence)\n\n## Pain Inventory\n\n- ✅ 2026-09-01 — **BUD-99** not a receipt\n");
    put(root, pm + "/_Archive/Cancelled Log.md", "## Budget\n\n- ❌ 2026-09-02 — **BUD-8** cancelled\n");
    const backlog = readBacklog({ root, pmRel: pm });
    expect(["BUD-14", "BUD-13", "BUD-9", "BUD-8", "BUD-99", "BUD-1"].map((id) => dependencyState(id, backlog))).toEqual([
      "open",
      "completed",
      "completed",
      "cancelled",
      "unresolved",
      "unresolved",
    ]);
    const follow = coordinate({ self: { ...item("BUD-21", { declared: [] }), held: false, dependencyIds: ["BUD-14"] }, backlog, pairwise: false, capacity: false });
    expect(follow.verdict).toBe(VERDICTS.FOLLOW);
    const scope = coordinate({ self: { ...item("BUD-22", { declared: [] }), held: false, dependencyIds: ["BUD-8"] }, backlog, pairwise: false, capacity: false });
    expect(scope).toMatchObject({ verdict: VERDICTS.SCOPE, refusals: [{ code: COORDINATION_REFUSALS.SCOPE }] });
  });
});

describe("fleet limits", () => {
  const fleet = (overrides: Loose = {}) => ({
    writers: ["r1", "r2"],
    running: [{}, {}],
    resources: { unit: "usd", settled: 0, reserved: 0, unknown: [], openReservationsWithoutAmount: 0 },
    ...overrides,
  });

  it("holds writer slots against everyone but the run itself, and job slots for every possibly running job", () => {
    expect(capacityReasons({ fleet: fleet(), concurrency: DEFAULT_CONCURRENCY, access: "write", run_id: "r3" })).toEqual([
      { code: REASONS.WRITERS, with: null, used: 2, max: 2 },
    ]);
    expect(capacityReasons({ fleet: fleet(), concurrency: DEFAULT_CONCURRENCY, access: "write", run_id: "r1" })).toEqual([]);
    expect(capacityReasons({ fleet: fleet({ running: [{}, {}, {}] }), concurrency: DEFAULT_CONCURRENCY, access: "read-only" })).toEqual([
      { code: REASONS.JOBS, with: null, used: 3, max: 3 },
    ]);
  });

  it("refuses an unknown amount under an owner's fleet allowance and a total above it", () => {
    const concurrency = { ...DEFAULT_CONCURRENCY, fleetAllowance: 5 };
    const unknown = capacityReasons({ fleet: fleet({ writers: [], running: [] }), concurrency, access: "write", reservation: { unit: "usd", amount: null } });
    expect(unknown[0].code).toBe(REASONS.FLEET);
    const open = capacityReasons({
      fleet: fleet({ writers: [], running: [], resources: { unit: "usd", settled: 0, reserved: 0, unknown: [], openReservationsWithoutAmount: 1 } }),
      concurrency,
      access: "write",
      reservation: { unit: "usd", amount: 1 },
    });
    expect(JSON.stringify(open)).toMatch(/unknown-open-reservation/u);
    const over = capacityReasons({
      fleet: fleet({ writers: [], running: [], resources: { unit: "usd", settled: 3, reserved: 2, unknown: [], openReservationsWithoutAmount: 0 } }),
      concurrency,
      access: "write",
      reservation: { unit: "usd", amount: 1 },
    });
    expect(JSON.stringify(over)).toMatch(/fleet-allowance-exceeded/u);
  });

  it("queues only what waiting can clear; source that moved under a plan needs a new run", () => {
    const self = item("BUD-14", { declared: ["src/amount.ts"] });
    const waiting = coordinate({ self, fleet: fleet(), concurrency: DEFAULT_CONCURRENCY, access: "write", run_id: "r3", item: false, pairwise: false });
    expect(waiting.verdict).toBe(VERDICTS.TOGETHER);
    expect(isQueueable(waiting.refusals)).toBe(true);
    const moved = coordinate({ self, drift: ["src/amount.ts", "src/other.ts"], item: false, capacity: false });
    expect(moved.refusals).toEqual([{ code: COORDINATION_REFUSALS.SOURCE_MOVED, detail: [{ code: REASONS.SOURCE_MOVED, with: null, paths: ["src/amount.ts"] }] }]);
    expect(isQueueable(moved.refusals)).toBe(false);
  });
});

describe("policy concurrency section", () => {
  const base = () => ({ ...(policyTemplate({ executor: "claude", authorized_by: "owner" }) as Loose) });

  it("defaults to two writers and three jobs, and keeps the ceiling in code", () => {
    const valid = validateExecutionPolicy(base()) as Loose;
    expect(valid.ok).toBe(true);
    expect(valid.policy.concurrency).toMatchObject({ maxWriters: 2, maxJobs: 3, fleetAllowance: null });
    expect(WRITER_CEILING).toBe(2);
    const raised = validateExecutionPolicy({ ...base(), concurrency: { maxWriters: 3 } }) as Loose;
    expect(raised.ok).toBe(false);
    expect(raised.refusals[0].code).toBe("policy-weakens-a-structural-gate");
  });

  it("refuses a job cap below the writer cap and check resources for an unknown check", () => {
    expect((validateExecutionPolicy({ ...base(), concurrency: { maxWriters: 2, maxJobs: 1 } }) as Loose).ok).toBe(false);
    expect((validateExecutionPolicy({ ...base(), concurrency: { checkResources: { missing: ["db:test"] } } }) as Loose).ok).toBe(false);
    const one = validateExecutionPolicy({ ...base(), concurrency: { maxWriters: 1, sharedPaths: ["src/shared"] } }) as Loose;
    expect(one.policy.concurrency).toMatchObject({ maxWriters: 1, maxJobs: 3, sharedPaths: ["src/shared"] });
  });
});

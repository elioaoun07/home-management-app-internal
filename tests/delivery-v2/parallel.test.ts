// Command Center Phase 5 — dependable parallel items (DLV-106), through the real journey.
//
// Scripted Claude executions through the real adapter, a fake worker runtime with one
// scratch per run, and synthetic PM documents and source files. What these fixtures
// establish is the supervisor's side: two disjoint writers from one module run at
// once and a third waits; a shared contract, a dependency manifest, an undeclared
// scope and a prerequisite wait with their reasons; a writer that grows into another
// reservation pauses with its candidate kept; unknown jobs and unobserved stops keep
// their slots; a dead supervisor's claim is recovered without a second writer; and
// each application is serialized, rechecked on the source the previous one produced,
// and never overwrites another change or an owner's edit. Nothing reaches a provider,
// a container, Git or a database.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createJourney } from "../../scripts/delivery-v2/journey.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { policyTemplate } from "../../scripts/delivery-v2/policy.mjs";
import { provisionScratch } from "../../scripts/delivery-v2/scratch.mjs";
import { importTrustedCandidate } from "../../scripts/delivery-v2/checks.mjs";
import { fleetOf } from "../../scripts/delivery-v2/coordination.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
type Deferred = { promise: Promise<void>; resolve: () => void };

const PM_REL = join("ERA Notes", "10 - Project Management");
const FILE = "Budget/4 - Checklist.md";
const SETTINGS = { executor: "claude", model: "claude-test", effort: "low" };

// Items in checklist order, with what each declares and what its build writes.
const ITEMS: { id: string; title: string; touches?: string; depends?: string; build?: [string, string] }[] = [
  { id: "BUD-14", title: "Amount emits 20", touches: "src/amount.ts", build: ["src/amount.ts", "export const amount = 20;\n"] },
  { id: "BUD-15", title: "Label reads Twenty", touches: "src/label.ts", build: ["src/label.ts", 'export const label = "Twenty";\n'] },
  { id: "BUD-16", title: "Money rounds", touches: "src/lib/money.ts", build: ["src/lib/money.ts", "export const money = (value: number) => Math.round(value);\n"] },
  { id: "BUD-17", title: "Total uses money", touches: "src/total.ts", build: ["src/total.ts", 'import { money } from "@/lib/money";\nexport const total = money(20.4);\n'] },
  { id: "BUD-18", title: "Add a dependency", touches: "package.json", build: ["package.json", '{ "name": "fixture", "dependencies": { "left-pad": "1.0.0" } }\n'] },
  { id: "BUD-19", title: "Refresh the lockfile", touches: "pnpm-lock.yaml", build: ["pnpm-lock.yaml", "lockfileVersion: '9.1'\n"] },
  { id: "BUD-20", title: "Undeclared change", build: ["src/twenty.ts", "export const twenty = 20;\n"] },
  { id: "BUD-21", title: "After the amount", touches: "src/after.ts", depends: "BUD-14", build: ["src/after.ts", "export const after = 20;\n"] },
  { id: "BUD-22", title: "Held change — HELD — DEC-99", touches: "src/held.ts" },
  { id: "BUD-23", title: "After a cancelled item", touches: "src/cancelled.ts", depends: "BUD-8" },
];
const rowOf = (entry: (typeof ITEMS)[number]) => `- [ ] **${entry.id}** ${entry.title} _(friction - S)_`;
const HOST_FILES: Record<string, string> = {
  "src/amount.ts": "export const amount = 25;\n",
  "src/label.ts": 'export const label = "Twenty-five";\n',
  "src/lib/money.ts": "export const money = (value: number) => value;\n",
  "src/total.ts": 'import { money } from "@/lib/money";\nexport const total = money(25);\n',
  "src/after.ts": "export const after = 25;\n",
  "src/held.ts": "export const held = 25;\n",
  "src/cancelled.ts": "export const cancelled = 25;\n",
  "package.json": '{ "name": "fixture" }\n',
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  "tests/check.mjs": "// synthetic check\n",
};

let ROOT: string;
let DATA: string;
let store: ReturnType<typeof openStore>;
let seq = 0;
const cmd = () => "cmd-" + ++seq;

const pmPath = (...parts: string[]) => join(ROOT, PM_REL, ...parts);
const read = (path: string) => readFileSync(join(ROOT, ...path.split("/")), "utf8");
const write = (root: string, path: string, text: string) => {
  const target = join(root, ...path.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text, "utf8");
};
const select = (id: string) => {
  const index = ITEMS.findIndex((entry) => entry.id === id);
  return { file: FILE, cbidx: index, expectLine: rowOf(ITEMS[index]), expectId: id };
};

function seed() {
  const checklist = ["# Budget — Checklist", "", "## Now", "", ...ITEMS.map(rowOf), ""].join("\n");
  const sections = ITEMS.flatMap((entry) => [
    "### " + entry.id,
    "",
    "- **Acceptance:** " + entry.title + ".",
    ...(entry.touches ? ["- **Touches:** `" + entry.touches + "`"] : []),
    ...(entry.depends ? ["- **Depends on:** " + entry.depends] : []),
    "",
  ]);
  const book = ["# Budget — Master Book", "", "## Acceptance Criteria Index", "", ...sections, "## Delivery session log", "", "*(Delivery runner appends dated progress bullets here automatically.)*", ""].join("\n");
  write(join(ROOT, PM_REL), "Budget/4 - Checklist.md", checklist);
  write(join(ROOT, PM_REL), "Budget/Budget — Master Book.md", book);
  write(join(ROOT, PM_REL), "_Archive/Cancelled Log.md", "# Cancelled\n\n## Budget\n\n- ❌ 2026-09-01 — **BUD-8** dropped\n");
  for (const [path, text] of Object.entries(HOST_FILES)) write(ROOT, path, text);
  mkdirSync(join(ROOT, ".delivery", "v2"), { recursive: true });
}

function writePolicy(concurrency: Loose = {}) {
  const base = policyTemplate({ executor: "claude", authorized_by: "owner" }) as Loose;
  const policy = {
    ...base,
    executors: { ...base.executors, permitted: ["claude"], catalog: { revision: 1, models: { claude: [{ id: "claude-test", efforts: ["low"] }] }, profiles: {} } },
    scratchScope: { kind: "snapshot", include: Object.keys(HOST_FILES) },
    publicationScope: { allowedPaths: ["src", "package.json", "pnpm-lock.yaml"], changeConstraints: {} },
    criteria: [
      {
        criterion_id: "suite",
        proposition: "the synthetic suite passes",
        scope: { path: "src" },
        observer: { kind: "command", expected: { spec_id: "suite" } },
        oracle_ref: "tests/check.mjs",
        freshness_inputs: ["candidate"],
        required_for: "candidate",
      },
    ],
    checks: { specs: { suite: { kind: "command", argv: ["node", "tests/check.mjs"] } }, inputs: ["tests/check.mjs"] },
    concurrency: { maxWriters: 2, maxJobs: 4, ...concurrency },
  };
  writeFileSync(join(ROOT, ".delivery", "v2", "execution-policy.json"), JSON.stringify(policy), "utf8");
}

const deferred = (): Deferred => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
};

async function waitFor(check: () => boolean, ms = 5000) {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error("condition not reached");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Scripted executions keyed by item, and a worker runtime with one scratch per run. */
function makeHarness() {
  const h = {
    workspaces: new Map<string, string>(),
    calls: [] as Loose[],
    checks: [] as Loose[],
    builds: new Map<string, (dir: string) => void>(),
    holds: new Map<string, Deferred>(),
    started: new Map<string, Deferred>(),
    active: 0,
    maxActive: 0,
    die: new Set<string>(),
    subagent: new Set<string>(),
    blockProvision: null as Deferred | null,
    stopObservable: true,
    costUsd: 0.01 as number | null,
    runtime: {} as Loose,
  };
  const startedFor = (key: string) => {
    if (!h.started.has(key)) h.started.set(key, deferred());
    return h.started.get(key)!;
  };
  const aliasOf = (job: Loose) => String(store.getWorkRef(String(store.getRun(String(job.run_id))!.work_id))!.alias);

  const sdk = (job: Loose, dir: string) => ({
    query: ({ options }: { prompt: string; options: Loose }) =>
      (async function* () {
        const alias = aliasOf(job);
        const writes = String(job.access) === "write";
        h.calls.push({ alias, job_id: String(job.job_id), access: String(job.access) });
        yield { type: "system", subtype: "init", model: options.model ?? "claude-default", session_id: options.resume || options.sessionId };
        if (options.hooks) await options.hooks.PreToolUse[0].hooks[0]({ tool_name: "Read", effort: { level: options.effort ?? "high" } });
        let text = "done";
        const entry = ITEMS.find((item) => item.id === alias)!;
        const key = alias + (writes ? ":write" : ":read");
        const gate = h.holds.get(key);
        if (!writes) {
          startedFor(key).resolve();
          if (gate) await gate.promise;
          const plan = { outcome: entry.title, scope: entry.touches ? [entry.touches] : [], steps: ["change it"], risks: [], unknowns: [], checks: [], questions: [] };
          text = "```json\n" + JSON.stringify(plan) + "\n```";
        } else {
          h.active += 1;
          h.maxActive = Math.max(h.maxActive, h.active);
          startedFor(key).resolve();
          try {
            if (h.die.has(alias)) throw new Error("worker process died");
            if (gate) await gate.promise;
            if (h.subagent.has(alias)) yield { type: "assistant", parent_tool_use_id: "toolu-" + alias, message: { content: [{ type: "text", text: "subagent read the file" }] } };
            const build = h.builds.get(alias);
            if (build) build(dir);
            else if (entry.build) write(dir, entry.build[0], entry.build[1]);
          } finally {
            h.active -= 1;
          }
        }
        yield { type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "text", text }] } };
        yield { type: "result", subtype: "success", is_error: false, result: text, total_cost_usd: h.costUsd, usage: { input_tokens: 10, output_tokens: 2 }, modelUsage: {} };
      })(),
  });

  h.runtime = {
    kind: "fake-worker",
    boundary: { image: "fake-worker", digest: "sha256:fake-boundary" },
    workspaceFor: ({ access }: Loose) => ({ root: "/work", backing: "fake-volume", access }),
    binding: async (backend_id: string) => ({ backend_id, sdk_version: "fixture", boundary_digest: "sha256:fake", battery_digest: "sha256:battery" }),
    provision: async ({ run_id, job, include }: Loose) => {
      if (String(job.access) === "write" && h.blockProvision) {
        const gate = h.blockProvision;
        h.blockProvision = null;
        await gate.promise;
      }
      let base_manifest = null;
      if (!h.workspaces.has(run_id)) {
        const dir = mkdtempSync(join(tmpdir(), "era-v2-parallel-ws-"));
        base_manifest = provisionScratch({ scratchRoot: dir, hostRoot: ROOT, include }).supplied;
        h.workspaces.set(run_id, dir);
      }
      const dir = h.workspaces.get(run_id)!;
      return { workspace: { root: "/work", access: job.access }, base_manifest, refusals: [], importSdk: async () => sdk(job, dir) };
    },
    stop: async () => ({ stopObserved: h.stopObservable, detail: h.stopObservable ? "removed" : "still present" }),
    release: async () => undefined,
    recover: async () => null,
    exportCandidate: async ({ run_id, job_id, generation, generationsRoot, base_manifest }: Loose) =>
      importTrustedCandidate({ sourceRoot: h.workspaces.get(run_id)!, generationsRoot, generation, job_id, base_manifest }).candidate,
    // The checker reads only the generation it is handed. The combination of the new
    // amount with a legacy label fails, whichever candidate brought either half.
    checkExecutor:
      ({ candidate }: Loose) =>
      () => {
        h.checks.push({ generation: String(candidate.generation), root: String(candidate.root) });
        const file = (path: string) => {
          try {
            return readFileSync(join(candidate.root, ...path.split("/")), "utf8");
          } catch {
            return "";
          }
        };
        const broken = file("src/amount.ts").includes("= 20;") && file("src/label.ts").includes("LEGACY");
        return broken
          ? { exitCode: 1, stdout: "Tests  1 failed | 0 passed (1)", stderr: "", spawnError: null }
          : { exitCode: 0, stdout: "Tests  1 passed (1)", stderr: "", spawnError: null };
      },
  };
  return { h, startedFor };
}

const describeAdmitted = async (backend_id: string) => ({
  ok: true,
  refusal: null,
  profile: {
    profile_id: "p-" + backend_id,
    backend_id,
    qualified: true,
    qualification_ref: "qr-fixture",
    unverifiedControls: [],
    controls: ["filesystem.outsideScratchWrite", "filesystem.hostSecretRead", "store.workerAccess"].map((id) => ({ id, verified: true, state: "supported" })),
    resources: { strictBound: false, strictBoundRefusalReason: "fixture" },
  },
});

const journeyWith = (h: Loose, overrides: Loose = {}) =>
  createJourney({
    root: ROOT,
    pmRel: PM_REL,
    store: () => store,
    runtime: h.runtime,
    describe: describeAdmitted,
    generationsRoot: join(DATA, "generations"),
    applicationsRoot: join(DATA, "applications"),
    stagingRoot: join(DATA, "staging"),
    ...overrides,
  }) as unknown as Loose;

async function planned(journey: Loose, id: string) {
  const delivered = await journey.deliver({ ...select(id), ...SETTINGS, command_id: cmd(), actor: "owner" });
  expect(delivered.ok).toBe(true);
  await journey.idle();
  const run_id = String(delivered.run_id);
  const plans = journey.detail(run_id).plans;
  return { run_id, plan: plans[plans.length - 1] };
}

const approve = (journey: Loose, run: { run_id: string; plan: Loose }, command_id = cmd()) =>
  journey.decide({ run_id: run.run_id, plan_id: run.plan.plan_id, plan_revision: run.plan.revision, decision: "approve", command_id, actor: "owner" });

const applyRun = (journey: Loose, run_id: string) => {
  const view = journey.detail(run_id);
  return journey.apply({ run_id, candidate_id: view.candidate.candidate_id, result_ref: view.result.result_id + "@" + view.result.result_version, command_id: cmd(), actor: "owner" });
};

const writeCalls = (h: Loose, alias: string) => h.calls.filter((call: Loose) => call.alias === alias && call.access === "write");

beforeEach(() => {
  seq = 0;
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-parallel-root-"));
  DATA = mkdtempSync(join(tmpdir(), "era-v2-parallel-data-"));
  seed();
  writePolicy();
  store = openStore({ path: join(ROOT, ".delivery", "v2", "supervisor.sqlite") });
});

afterEach(() => {
  try {
    store.close();
  } catch {
    /* closed by a test */
  }
  rmSync(ROOT, { recursive: true, force: true });
  rmSync(DATA, { recursive: true, force: true });
});

describe("independent items run together", () => {
  it("runs two disjoint items from the same module at once and holds a third writer for a slot", async () => {
    const { h, startedFor } = makeHarness();
    const journey = journeyWith(h);
    const amount = await planned(journey, "BUD-14");
    const label = await planned(journey, "BUD-15");
    const money = await planned(journey, "BUD-16");
    const holdAmount = deferred();
    const holdLabel = deferred();
    h.holds.set("BUD-14:write", holdAmount);
    h.holds.set("BUD-15:write", holdLabel);

    expect((await approve(journey, amount)).continuation).toMatchObject({ ok: true });
    expect((await approve(journey, label)).continuation).toMatchObject({ ok: true });
    await startedFor("BUD-14:write").promise;
    await startedFor("BUD-15:write").promise;
    expect(h.active).toBe(2);

    let queue = journey.queue();
    expect(queue.writers).toEqual({ used: 2, max: 2 });
    expect(
      queue.running
        .filter((row: Loose) => row.writer)
        .map((row: Loose) => [row.alias, row.executor, row.model])
        .sort(),
    ).toEqual([
      ["BUD-14", "claude", "claude-test"],
      ["BUD-15", "claude", "claude-test"],
    ]);
    const pair = queue.pairs.find((entry: Loose) => [entry.a, entry.b].sort().join() === "BUD-14,BUD-15");
    expect(pair).toMatchObject({ verdict: "together", label: "Can run together", reasons: [] });

    const third = await approve(journey, money);
    expect(third.continuation).toMatchObject({ ok: false, queued: true });
    const waiting = journey.detail(money.run_id);
    expect(waiting.ownerAction).toEqual({ kind: "waiting", label: "Waiting" });
    expect(waiting.coordination).toMatchObject({ state: "queued", verdict: "together" });
    expect(waiting.coordination.reasons).toEqual([{ code: "writer-slots-full", with: null, used: 2, max: 2 }]);
    queue = journey.queue();
    expect(queue.waiting.map((row: Loose) => [row.alias, row.executor])).toEqual([["BUD-16", "claude"]]);
    expect(writeCalls(h, "BUD-16")).toHaveLength(0);

    holdAmount.resolve();
    holdLabel.resolve();
    await journey.idle();
    expect(h.maxActive).toBe(2);
    for (const run of [amount, label, money]) expect(journey.detail(run.run_id).run.closed_outcome).toBe("verified_candidate");
    expect(writeCalls(h, "BUD-16")).toHaveLength(1);
    expect(journey.detail(money.run_id).events.map((entry: Loose) => entry.kind)).toContain("coordination.admitted");
  });

  it("gives the last writer slot to exactly one of two approvals racing for it", async () => {
    writePolicy({ maxWriters: 1 });
    const { h } = makeHarness();
    const journey = journeyWith(h);
    const amount = await planned(journey, "BUD-14");
    const label = await planned(journey, "BUD-15");
    const holdAmount = deferred();
    const holdLabel = deferred();
    h.holds.set("BUD-14:write", holdAmount);
    h.holds.set("BUD-15:write", holdLabel);

    const outcomes = await Promise.all([approve(journey, amount), approve(journey, label)]);
    expect(outcomes.filter((entry: Loose) => entry.continuation.ok)).toHaveLength(1);
    expect(outcomes.filter((entry: Loose) => entry.continuation.queued)).toHaveLength(1);
    expect(store.listAllJobs().filter((job: Loose) => job.access === "write")).toHaveLength(1);

    holdAmount.resolve();
    holdLabel.resolve();
    await journey.idle();
    expect(h.maxActive).toBe(1);
    expect(journey.detail(amount.run_id).run.closed_outcome).toBe("verified_candidate");
    expect(journey.detail(label.run_id).run.closed_outcome).toBe("verified_candidate");
  });
});

describe("dependent items wait with a reason", () => {
  it("holds a consumer of a shared contract until that change is applied, then applies it on the combined source", async () => {
    const { h, startedFor } = makeHarness();
    const journey = journeyWith(h);
    const utility = await planned(journey, "BUD-16");
    const consumer = await planned(journey, "BUD-17");
    const holdUtility = deferred();
    h.holds.set("BUD-16:write", holdUtility);

    await approve(journey, utility);
    await startedFor("BUD-16:write").promise;
    expect((await approve(journey, consumer)).continuation).toMatchObject({ queued: true });
    let view = journey.detail(consumer.run_id);
    expect(view.coordination).toMatchObject({ state: "queued", verdict: "follow", label: "Must follow" });
    expect(view.coordination.reasons).toEqual([{ code: "shared-contract", with: "BUD-16", paths: ["src/lib/money.ts"] }]);
    expect(journey.detail(utility.run_id).coordination.holding).toEqual(["BUD-17"]);

    holdUtility.resolve();
    await journey.idle();
    // A verified but unapplied candidate still holds its paths.
    expect(journey.detail(utility.run_id).run.closed_outcome).toBe("verified_candidate");
    expect(journey.detail(consumer.run_id).coordination.state).toBe("queued");
    expect(writeCalls(h, "BUD-17")).toHaveLength(0);

    expect((await applyRun(journey, utility.run_id)).state).toBe("applied");
    await journey.idle();
    view = journey.detail(consumer.run_id);
    expect(view.run.closed_outcome).toBe("verified_candidate");
    expect(view.coordination.sourceChanged).toMatchObject({ by: "BUD-16", paths: ["src/lib/money.ts"] });

    const applied = await applyRun(journey, consumer.run_id);
    expect(applied.state).toBe("applied");
    const application = journey.detail(consumer.run_id).applications[0];
    expect(application.unrelatedDrift).toEqual(["src/lib/money.ts"]);
    expect(application.reassessment).toMatchObject({ state: "passed", generation: "P1" });
    expect(read("src/total.ts")).toContain("money(20.4)");
    expect(read("src/lib/money.ts")).toContain("Math.round");
  });

  it("keeps two dependency-manifest changes apart, and an owner release lets the second start", async () => {
    const { h, startedFor } = makeHarness();
    const journey = journeyWith(h);
    const manifest = await planned(journey, "BUD-18");
    const lockfile = await planned(journey, "BUD-19");
    const holdManifest = deferred();
    h.holds.set("BUD-18:write", holdManifest);

    await approve(journey, manifest);
    await startedFor("BUD-18:write").promise;
    await approve(journey, lockfile);
    expect(journey.detail(lockfile.run_id).coordination.reasons).toEqual([{ code: "lockfile", with: "BUD-18", paths: ["package.json", "pnpm-lock.yaml"] }]);

    holdManifest.resolve();
    await journey.idle();
    expect(journey.detail(lockfile.run_id).coordination.state).toBe("queued");
    const released = await journey.control({ run_id: manifest.run_id, action: "release", command_id: cmd(), actor: "owner" });
    expect(released).toMatchObject({ ok: true, released: true });
    await journey.idle();
    expect(journey.detail(lockfile.run_id).run.closed_outcome).toBe("verified_candidate");
    expect(journey.detail(manifest.run_id).coordination.released).toBe(true);
  });

  it("orders prerequisites, refuses held work and an unresolved dependency, and launches once the prerequisite completes", async () => {
    const { h } = makeHarness();
    const journey = journeyWith(h);
    const early = journey.assess({ file: FILE, id: "BUD-21" });
    expect(early).toMatchObject({ ok: true, verdict: "follow", label: "Must follow", startable: false });
    expect(early.reasons).toEqual([{ code: "dependency-open", with: "BUD-14" }]);

    const refused = await journey.deliver({ ...select("BUD-21"), ...SETTINGS, command_id: cmd(), actor: "owner" });
    expect(refused.ok).toBe(false);
    expect(refused.refusals[0]).toMatchObject({ code: "must-follow", detail: [{ code: "dependency-open", with: "BUD-14" }] });
    const held = await journey.deliver({ ...select("BUD-22"), ...SETTINGS, command_id: cmd(), actor: "owner" });
    expect(held.refusals[0]).toMatchObject({ code: "must-follow", detail: [{ code: "held", with: null }] });
    const cancelled = await journey.deliver({ ...select("BUD-23"), ...SETTINGS, command_id: cmd(), actor: "owner" });
    expect(cancelled.refusals[0]).toMatchObject({ code: "needs-scope-check", detail: [{ code: "dependency-cancelled", with: "BUD-8" }] });
    expect(store.listRuns()).toHaveLength(0);
    expect(h.calls).toHaveLength(0);

    // The owner completes BUD-14 through the CLI.
    const checklist = pmPath("Budget", "4 - Checklist.md");
    writeFileSync(checklist, readFileSync(checklist, "utf8").replace("- [ ] **BUD-14**", "- [x] **BUD-14**"), "utf8");
    expect(journey.assess({ file: FILE, id: "BUD-21" })).toMatchObject({ verdict: "together", startable: true, reasons: [] });
    const started = await journey.deliver({ ...select("BUD-21"), ...SETTINGS, command_id: cmd(), actor: "owner" });
    expect(started.ok).toBe(true);
    await journey.idle();
  });

  it("does not let undeclared scope write beside a reservation; the owner's release lets it run", async () => {
    const { h } = makeHarness();
    const journey = journeyWith(h);
    const known = await planned(journey, "BUD-14");
    const unknown = await planned(journey, "BUD-20");
    expect(journey.detail(unknown.run_id).plans[0].body.scope).toEqual([]);
    await approve(journey, known);
    await journey.idle();

    expect((await approve(journey, unknown)).continuation).toMatchObject({ queued: true });
    const view = journey.detail(unknown.run_id);
    expect(view.coordination).toMatchObject({ verdict: "scope", label: "Needs scope check" });
    expect(view.coordination.reasons).toEqual([{ code: "scope-unknown", with: "BUD-14", unknown: ["BUD-20"] }]);
    expect(journey.assess({ file: FILE, id: "BUD-15" })).toMatchObject({ verdict: "together", startable: true });
    expect(journey.assess({ file: FILE, id: "BUD-20" })).toMatchObject({ verdict: "follow", startable: false });

    await journey.control({ run_id: known.run_id, action: "release", command_id: cmd(), actor: "owner" });
    await journey.idle();
    expect(journey.detail(unknown.run_id).run.closed_outcome).toBe("verified_candidate");
  });
});

describe("discovered overlap, fleet limits and recovery", () => {
  it("pauses a writer that grows into another reservation, keeps its candidate unchecked, and never overwrites the other change", async () => {
    const { h, startedFor } = makeHarness();
    const journey = journeyWith(h);
    h.builds.set("BUD-14", (dir) => {
      write(dir, "src/amount.ts", "export const amount = 20;\n");
      write(dir, "src/label.ts", 'export const label = "grown";\n');
    });
    const other = await planned(journey, "BUD-15");
    const grower = await planned(journey, "BUD-14");
    const holdOther = deferred();
    h.holds.set("BUD-15:write", holdOther);

    await approve(journey, other);
    await startedFor("BUD-15:write").promise;
    expect((await approve(journey, grower)).continuation).toMatchObject({ ok: true });
    await waitFor(() => journey.detail(grower.run_id).coordination.state === "scope-conflict");

    const paused = journey.detail(grower.run_id);
    expect(paused.coordination).toMatchObject({ verdict: "follow", grew: ["src/label.ts"] });
    expect(paused.coordination.reasons).toEqual([{ code: "path-overlap", with: "BUD-15", paths: ["src/label.ts"] }]);
    expect(paused.candidate.changed.map((entry: Loose) => entry.path)).toEqual(["src/amount.ts", "src/label.ts"]);
    expect(h.checks.filter((entry: Loose) => entry.root.includes(grower.run_id))).toHaveLength(0);
    const early = await journey.apply({ run_id: grower.run_id, candidate_id: paused.candidate.candidate_id, result_ref: "none@1", command_id: cmd(), actor: "owner" });
    expect(early.refusals[0].code).toBe("no-verified-candidate-to-apply");

    holdOther.resolve();
    await journey.idle();
    expect(journey.detail(grower.run_id).coordination.state).toBe("scope-conflict");
    expect((await applyRun(journey, other.run_id)).state).toBe("applied");
    await journey.idle();

    const resumed = journey.detail(grower.run_id);
    expect(resumed.run.closed_outcome).toBe("verified_candidate");
    const refused = await applyRun(journey, grower.run_id);
    expect(refused.refusals[0].code).toBe("application-conflict");
    expect(read("src/label.ts")).toBe('export const label = "Twenty";\n');
    expect(read("src/amount.ts")).toBe(HOST_FILES["src/amount.ts"]);
  });

  it("counts a running investigation against the job cap and queues a launch until the slot frees", async () => {
    writePolicy({ maxWriters: 1, maxJobs: 1 });
    const { h, startedFor } = makeHarness();
    const journey = journeyWith(h);
    const holdInvestigation = deferred();
    h.holds.set("BUD-14:read", holdInvestigation);
    expect((await journey.deliver({ ...select("BUD-14"), ...SETTINGS, command_id: cmd(), actor: "owner" })).ok).toBe(true);
    await startedFor("BUD-14:read").promise;

    const queued = await journey.deliver({ ...select("BUD-15"), ...SETTINGS, command_id: cmd(), actor: "owner" });
    expect(queued).toMatchObject({ ok: true, queued: true, job_id: null });
    expect(journey.detail(queued.run_id).coordination.reasons).toEqual([{ code: "job-slots-full", with: null, used: 1, max: 1 }]);
    expect(store.listJobs(queued.run_id)).toHaveLength(0);

    holdInvestigation.resolve();
    await journey.idle();
    expect(journey.detail(queued.run_id).plans).toHaveLength(1);
  });

  it("cancels a waiting run without dispatch, drops its queue position, and repeated commands change nothing (DLV-122)", async () => {
    writePolicy({ maxWriters: 1, maxJobs: 1 });
    const { h, startedFor } = makeHarness();
    const journey = journeyWith(h);
    const holdInvestigation = deferred();
    h.holds.set("BUD-14:read", holdInvestigation);
    expect((await journey.deliver({ ...select("BUD-14"), ...SETTINGS, command_id: cmd(), actor: "owner" })).ok).toBe(true);
    await startedFor("BUD-14:read").promise;
    const waiting = await journey.deliver({ ...select("BUD-15"), ...SETTINGS, command_id: cmd(), actor: "owner" });
    expect(waiting).toMatchObject({ queued: true, job_id: null });
    const run_id = String(waiting.run_id);

    const stopCommand = cmd();
    const first = await journey.control({ run_id, action: "stop", command_id: stopCommand, actor: "owner" });
    expect(first).toMatchObject({ ok: true, closed: true });
    expect(store.listJobs(run_id)).toHaveLength(0);
    expect(store.getRun(run_id)).toMatchObject({ lifecycle: "CLOSED", closed_outcome: "cancelled" });
    expect(journey.detail(run_id).coordination.state).toBeFalsy();

    // Same command id replayed, then a fresh command: neither reopens nor dispatches.
    expect(await journey.control({ run_id, action: "stop", command_id: stopCommand, actor: "owner" })).toMatchObject({ ok: true });
    expect((await journey.control({ run_id, action: "stop", command_id: cmd(), actor: "owner" })).refusals[0].code).toBe("run-closed");

    // Freeing the slot must not admit the cancelled run.
    holdInvestigation.resolve();
    await journey.idle();
    expect(store.listJobs(run_id)).toHaveLength(0);
    expect(store.getRun(run_id)).toMatchObject({ lifecycle: "CLOSED", closed_outcome: "cancelled" });
    expect(h.calls.filter((entry: Loose) => entry.alias === "BUD-15")).toHaveLength(0);
  });

  it("keeps a writer slot for an unknown job and for a stop not yet observed; an observed stop frees it", async () => {
    writePolicy({ maxWriters: 1, maxJobs: 3 });
    const { h } = makeHarness();
    const journey = journeyWith(h);
    const lost = await planned(journey, "BUD-14");
    const next = await planned(journey, "BUD-15");
    h.die.add("BUD-14");
    await approve(journey, lost);
    await journey.idle();
    expect(journey.detail(lost.run_id).jobs.find((job: Loose) => job.access === "write").status).toBe("unknown");

    expect((await approve(journey, next)).continuation).toMatchObject({ queued: true });
    expect(journey.detail(next.run_id).coordination.reasons).toEqual([{ code: "writer-slots-full", with: null, used: 1, max: 1 }]);
    expect(journey.queue().unknown.jobs).toHaveLength(1);

    h.stopObservable = false;
    await journey.control({ run_id: lost.run_id, action: "stop", command_id: cmd(), actor: "owner" });
    await journey.idle();
    expect(journey.detail(next.run_id).coordination.state).toBe("queued");
    expect(journey.queue().writers.used).toBe(1);

    h.stopObservable = true;
    await journey.control({ run_id: lost.run_id, action: "stop", command_id: cmd(), actor: "owner" });
    await journey.idle();
    expect(journey.detail(lost.run_id).run.closed_outcome).toBe("cancelled");
    expect(journey.detail(next.run_id).run.closed_outcome).toBe("verified_candidate");
    expect(writeCalls(h, "BUD-14")).toHaveLength(1);
  });

  it("queues fleet work whose cost is unknown under an owner's fleet allowance", async () => {
    writePolicy({ fleetAllowance: 5 });
    const { h } = makeHarness();
    const journey = journeyWith(h);
    const outcome = await journey.deliver({ ...select("BUD-14"), ...SETTINGS, command_id: cmd(), actor: "owner" });
    expect(outcome).toMatchObject({ ok: true, queued: true });
    const reasons = journey.detail(outcome.run_id).coordination.reasons;
    expect(reasons[0].code).toBe("fleet-resources");
    expect(JSON.stringify(reasons)).toMatch(/unknown-next-reservation/u);
    await journey.idle();
    expect(h.calls).toHaveLength(0);
  });

  it("holds a run under an owner allowance setting and re-admits it when the owner lifts it", async () => {
    const { h } = makeHarness();
    const journey = journeyWith(h);
    // Owner limit from the Settings panel; the policy itself claims no fleet allowance.
    expect(journey.changeAllowance({ action: "fleet", limit: 5, period: "reset", command_id: "a-1", actor: "owner" })).toMatchObject({ ok: true });
    const outcome = await journey.deliver({ ...select("BUD-14"), ...SETTINGS, command_id: cmd(), actor: "owner" });
    expect(outcome).toMatchObject({ ok: true, queued: true });
    expect(journey.detail(outcome.run_id).coordination.reasons[0].code).toBe("fleet-resources");
    const view = journey.allowances();
    expect(view.fleet).toMatchObject({ limit: 5, source: "settings", policyLimit: null });
    expect(view.runs.map((run: Loose) => run.run_id)).toContain(outcome.run_id);
    await journey.idle();
    expect(h.calls).toHaveLength(0);

    // A retried command is a no-op; lifting the limit re-evaluates the queue without a new command.
    expect(journey.changeAllowance({ action: "fleet", limit: 5, period: "reset", command_id: "a-1", actor: "owner" })).toMatchObject({ ok: true, repeated: true });
    expect(journey.changeAllowance({ action: "fleet", limit: null, command_id: "a-2", actor: "owner" })).toMatchObject({ ok: true, repeated: false });
    await journey.idle();
    expect(journey.detail(outcome.run_id).coordination.state).not.toBe("queued");
    expect(h.calls.length).toBeGreaterThan(0);
    expect(journey.allowances().history.map((entry: Loose) => entry.command_id)).toEqual(["a-2", "a-1"]);
  });

  it("recovers a dead supervisor's claim without a second writer, and a replayed approval admits nothing", async () => {
    const { h } = makeHarness();
    const first = journeyWith(h);
    const run = await planned(first, "BUD-14");
    const gate = deferred();
    h.blockProvision = gate;
    const approval = cmd();
    expect((await approve(first, run, approval)).continuation).toMatchObject({ ok: true });
    await waitFor(() => h.blockProvision === null);
    const job = store.listJobs(run.run_id).find((entry: Loose) => entry.access === "write")!;
    // The first supervisor took the claim, then died before its dispatch marker.
    expect(store.claimDispatch(String(job.job_id), first.claimant).acquired).toBe(true);
    expect(first.queue().writers.used).toBe(1);
    const replay = await approve(first, run, approval);
    expect(replay.duplicate).toBe(true);
    expect(store.listJobs(run.run_id).filter((entry: Loose) => entry.access === "write")).toHaveLength(1);

    const second = journeyWith(h);
    const recovered = await second.reconcile();
    expect(recovered.released).toEqual([String(job.job_id)]);
    await second.idle();
    expect(second.detail(run.run_id).run.closed_outcome).toBe("verified_candidate");

    // The first supervisor wakes: the marker is set, so it sends nothing.
    gate.resolve();
    await first.idle();
    expect(writeCalls(h, "BUD-14")).toHaveLength(1);
    expect(store.listJobs(run.run_id).filter((entry: Loose) => entry.access === "write")).toHaveLength(1);
  });

  it("accounts native subagents inside their job without giving them a writer slot", async () => {
    const { h, startedFor } = makeHarness();
    const journey = journeyWith(h);
    h.subagent.add("BUD-14");
    const run = await planned(journey, "BUD-14");
    const holdWrite = deferred();
    h.holds.set("BUD-14:write", holdWrite);
    h.costUsd = null;
    await approve(journey, run);
    await startedFor("BUD-14:write").promise;
    expect(journey.queue().writers.used).toBe(1);

    holdWrite.resolve();
    await journey.idle();
    const queue = journey.queue();
    expect(queue.nativeAgents).toBe(1);
    expect(queue.writers.used).toBe(0);
    expect(fleetOf({ store, unit: "usd" }).resources.unknown.some((entry: Loose) => /native subagent/u.test(entry.reason))).toBe(true);
  });
});

describe("serialized application", () => {
  it("rechecks the second candidate on the source the first application produced, and applies neither a failing combination nor over it", async () => {
    const { h } = makeHarness();
    const journey = journeyWith(h);
    h.builds.set("BUD-15", (dir) => write(dir, "src/label.ts", 'export const label = "LEGACY";\n'));
    const amount = await planned(journey, "BUD-14");
    const label = await planned(journey, "BUD-15");
    await approve(journey, amount);
    await approve(journey, label);
    await journey.idle();
    expect(journey.detail(amount.run_id).run.closed_outcome).toBe("verified_candidate");
    expect(journey.detail(label.run_id).run.closed_outcome).toBe("verified_candidate");

    const before = h.checks.length;
    expect((await applyRun(journey, amount.run_id)).state).toBe("applied");
    // No drift for the first: its integrated check only, no preview.
    expect(h.checks.slice(before).map((entry: Loose) => entry.generation)).toEqual(["A1"]);
    expect(journey.detail(label.run_id).coordination.sourceChanged).toMatchObject({ by: "BUD-14", paths: ["src/amount.ts"] });

    const refused = await applyRun(journey, label.run_id);
    expect(refused).toMatchObject({ ok: false, state: "reassessment-failed" });
    expect(refused.refusals[0].code).toBe("checks-fail-on-current-source");
    expect(read("src/label.ts")).toBe(HOST_FILES["src/label.ts"]);
    expect(read("src/amount.ts")).toBe("export const amount = 20;\n");
    const view = journey.detail(label.run_id);
    expect(view.applications[0]).toMatchObject({ state: "reassessment-failed", reassessment: { state: "failed", generation: "P1" } });
    expect(view.ownerAction.label).toBe("Apply");
  });

  it("applies a compatible second candidate after its recheck, and neither application overwrites an owner's CLI edit", async () => {
    const { h } = makeHarness();
    const journey = journeyWith(h);
    const amount = await planned(journey, "BUD-14");
    const label = await planned(journey, "BUD-15");
    await approve(journey, amount);
    await approve(journey, label);
    await journey.idle();

    // The owner edits the label while both candidates wait.
    writeFileSync(join(ROOT, "src", "label.ts"), 'export const label = "owner";\n', "utf8");
    const conflict = await applyRun(journey, label.run_id);
    expect(conflict.refusals[0].code).toBe("application-conflict");
    expect(read("src/label.ts")).toBe('export const label = "owner";\n');

    const applied = await applyRun(journey, amount.run_id);
    expect(applied.state).toBe("applied");
    expect(journey.detail(amount.run_id).applications[0].reassessment).toMatchObject({ state: "passed" });
    expect(read("src/amount.ts")).toBe("export const amount = 20;\n");
    expect(read("src/label.ts")).toBe('export const label = "owner";\n');
  });

  it("leaves V1's shared-checkout build lock in force", () => {
    const source = readFileSync(join(process.cwd(), "scripts", "delivery", "server-routes.mjs"), "utf8");
    expect(source).toMatch(/function isBuildLockActive\(ctx/u);
    expect(source).toMatch(/if \(isBuildLockActive\(ctx, continuation \? continuationOf : null\)\)/u);
  });
});

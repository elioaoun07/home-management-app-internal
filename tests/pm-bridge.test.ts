// tests/pm-bridge.test.ts
// Unit tests for the pure cores of scripts/pm/bridge.mjs — the allowlist, the
// mobile launch guardrails (envelope required, dirty-tree/red-baseline
// refusal), the permanent `tick` refusal and the undo journal behind it, and
// the checklist snapshot size budget.
// Every command routes through the SAME routeDelivery() the desktop UI uses
// (see tests/delivery/server-routes.test.ts for that layer's own coverage);
// these tests verify the bridge's allowlist and refusals sit correctly in
// front of it, not that routeDelivery itself works.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  ALLOWED_TYPES,
  buildSessionExtras,
  capSessionSnapshot,
  createCommandExecutor,
  createHistorySnapshotBuilder,
  createRollupsSnapshotBuilder,
  createTasksSnapshotBuilder,
  spendByDay,
} from "../scripts/pm/bridge.mjs";
import { atomicWriteJsonSync } from "../scripts/delivery/fsx.mjs";
import { textHash } from "../scripts/delivery/packet.mjs";
import { createDeliveryContext } from "../scripts/delivery/server-routes.mjs";

const cleanupDirs: string[] = [];
afterEach(() => {
  while (cleanupDirs.length) {
    const dir = cleanupDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const CHECKLIST_LINE = "- [ ] **N1** Fix rounding drift in allocation splits _(blocker - M)_";
const CHECKLIST_RAW = ["# Checklist", "", "## Now", "", CHECKLIST_LINE, "- [x] Already done item", ""].join("\n");

function setup({ baselineValidation = { ok: true, results: {} } }: { baselineValidation?: object } = {}) {
  const root = mkdtempSync(join(tmpdir(), "pm-bridge-"));
  cleanupDirs.push(root);

  const pmRel = join("ERA Notes", "10 - Project Management");
  const pmDir = join(root, pmRel);
  mkdirSync(join(pmDir, "Budget"), { recursive: true });
  writeFileSync(join(pmDir, "Budget", "4 - Checklist.md"), CHECKLIST_RAW);
  writeFileSync(join(pmDir, "Budget", "1 - Feature State.md"), "# Feature State\n");
  writeFileSync(
    join(pmDir, "Budget", "3 - Action Plan.md"),
    "# Action Plan\n\n### N1 · Rounding drift\n\n- **Acceptance:** allocation splits remain exact after validation.\n",
  );
  writeFileSync(join(root, "README.md"), "test repo\n");
  writeFileSync(join(root, ".gitignore"), "/.delivery/\n");

  const deliveryCtx = createDeliveryContext({
    ROOT: root,
    PM_DIR: pmDir,
    PM_REL: pmRel,
    gitStatusPorcelain: () => "",
    gitRevParseHead: () => "fixture-head",
    runValidation: async () => baselineValidation,
    spawnRunner: () => {}, // no real runner process in tests — isRunnerAlive() always reports dead
  });

  const { executeCommand } = createCommandExecutor({ PM_DIR: pmDir, deliveryCtx });
  return { root, pmDir, deliveryCtx, executeCommand };
}

function launchPayload(overrides: Record<string, unknown> = {}) {
  return {
    file: "Budget/4 - Checklist.md",
    cbidx: 0,
    expectText: CHECKLIST_LINE,
    agent: "claude",
    budget: { maxUsd: 2 },
    flightCheck: { reviewed: true, lane: "STANDARD" },
    ...overrides,
  };
}

/** Write a session directly to disk in a given state/gate, bypassing startSession — mirrors the pattern in tests/delivery/server-routes.test.ts. */
function seedSession(deliveryCtx: ReturnType<typeof createDeliveryContext>, sessionId: string, state: string, awaiting: object | null) {
  const dir = join(deliveryCtx.SESSIONS_DIR, sessionId);
  mkdirSync(dir, { recursive: true });
  atomicWriteJsonSync(join(dir, "packet.json"), {
    schemaVersion: 1,
    sessionId,
    agent: "claude",
    item: { pmFile: "Budget/4 - Checklist.md", cbidx: 0, text: "Fix rounding drift", id: "N1", campaign: "Budget" },
    workspace: {},
  });
  atomicWriteJsonSync(join(dir, "state.json"), {
    schemaVersion: 1,
    sessionId,
    state,
    awaiting,
    updatedAt: new Date().toISOString(),
  });
  return dir;
}

describe("bridge allowlist", () => {
  it("never exposes set-budget, set-config, rotate, or fork to mobile", () => {
    for (const type of ["set-budget", "set-config", "rotate", "fork"]) {
      expect(ALLOWED_TYPES.has(type)).toBe(false);
    }
  });

  it("rejects an unlisted command type before touching any delivery route", async () => {
    const { executeCommand } = setup();
    const outcome = await executeCommand({ type: "set-budget", payload: { sessionId: "whatever", maxUsd: 999 } });
    expect(outcome).toEqual({ ok: false, error: "command type not permitted from mobile: set-budget" });
  });
});

describe("answer — only the question gate is reachable from mobile", () => {
  it("refuses when the session awaits spec/plan/uat/blocked instead of a question", async () => {
    const { deliveryCtx, executeCommand } = setup();
    for (const gate of ["spec", "plan", "uat", "blocked"]) {
      const sessionId = `s-gate-${gate}`;
      seedSession(deliveryCtx, sessionId, "BUILDING", { gate });
      const outcome = await executeCommand({ type: "answer", payload: { sessionId, text: "go ahead" } });
      expect(outcome.ok).toBe(false);
      expect(outcome.error).toMatch(/approve on the laptop/i);
    }
  });

  it("routes a questionId to the ledger control instead of the gate, so an advisory question is answerable at any time", async () => {
    const { deliveryCtx, executeCommand } = setup();
    const sessionId = "s-ledger";
    // No question gate at all: the session is mid-build. A ledger answer is
    // non-blocking by construction, so it must not be refused for that.
    seedSession(deliveryCtx, sessionId, "BUILDING", null);
    const outcome = await executeCommand({ type: "answer", payload: { sessionId, questionId: "q-0001-0", text: "it applies to everyone" } });
    expect(outcome.ok).toBe(true);
    const controls = readdirSync(join(deliveryCtx.SESSIONS_DIR, sessionId, "controls"));
    expect(controls).toHaveLength(1);
    const control = JSON.parse(readFileSync(join(deliveryCtx.SESSIONS_DIR, sessionId, "controls", controls[0]), "utf8"));
    expect(control.type).toBe("answer");
    expect(control.payload).toMatchObject({ questionId: "q-0001-0", text: "it applies to everyone" });
  });

  it("answers when the session is awaiting a question gate", async () => {
    const { deliveryCtx, executeCommand } = setup();
    const sessionId = "s-question";
    seedSession(deliveryCtx, sessionId, "BUILDING", { gate: "question" });
    const outcome = await executeCommand({ type: "answer", payload: { sessionId, text: "yes, rollover carries negative balances" } });
    expect(outcome.ok).toBe(true);
  });
});

describe("cancel — reachable regardless of gate", () => {
  it("cancels a session with no live runner directly to CANCELLED", async () => {
    const { deliveryCtx, executeCommand } = setup();
    const sessionId = "s-cancel-me";
    seedSession(deliveryCtx, sessionId, "PLAN_READY", { gate: "plan" });
    const outcome = await executeCommand({ type: "cancel", payload: { sessionId } });
    expect(outcome.ok).toBe(true);
    const state = JSON.parse(readFileSync(join(deliveryCtx.SESSIONS_DIR, sessionId, "state.json"), "utf8"));
    expect(state.state).toBe("CANCELLED");
  });
});

describe("launch guardrails", () => {
  it("refuses without a budget envelope, before ever calling startSession", async () => {
    const { executeCommand } = setup();
    const outcome = await executeCommand({ type: "launch", payload: launchPayload({ budget: undefined }) });
    expect(outcome).toEqual({ ok: false, error: "an envelope is required to launch from mobile" });
  });

  it("refuses on a dirty working tree — mobile never forwards a DIRTY TREE ack", async () => {
    const { deliveryCtx, executeCommand } = setup();
    deliveryCtx.gitStatusPorcelain = () => "?? untracked.txt\n";
    const outcome = await executeCommand({ type: "launch", payload: launchPayload() });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/dirty/i);
  });

  it("refuses on a red baseline — mobile never forwards a RED BASELINE ack", async () => {
    const { executeCommand } = setup({
      baselineValidation: { ok: false, results: { typecheck: { ok: false, excerpt: "pre-existing failure" } } },
    });
    const outcome = await executeCommand({ type: "launch", payload: launchPayload() });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/RED BASELINE/);
  });

  it("launches through the identical routeDelivery path the desktop UI uses when the tree is clean and an envelope is set", async () => {
    const { deliveryCtx, executeCommand } = setup();
    const outcome = await executeCommand({ type: "launch", payload: launchPayload() });
    expect(outcome.ok).toBe(true);
    // executeCommand()'s direct return is {ok:true, ...startSession's json} — no
    // nesting. (The client-side hook sees it nested under pm_commands.result
    // because the bridge's drainOnce() stores `result: outcome` in that column.)
    const sessionId = outcome.sessionId as string;
    expect(sessionId).toMatch(/^s-/);
    const packet = JSON.parse(readFileSync(join(deliveryCtx.SESSIONS_DIR, sessionId, "packet.json"), "utf8"));
    expect(packet.budget).toMatchObject({ maxUsd: 2, authorization: "capped" });
    expect(packet.flightCheck.lane.selected).toBe("STANDARD");
  });
});

describe("the phone can never mark a checklist item done", () => {
  it("refuses `tick` with an explanation, not a generic rejection — an installed PWA may still be issuing it from a cached bundle", async () => {
    const { executeCommand } = setup();
    const outcome = await executeCommand({
      type: "tick",
      payload: { file: "Budget/4 - Checklist.md", cbidx: 0, expectTextHash: textHash(CHECKLIST_LINE), expectState: "open" },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/laptop-only/i);
    expect(ALLOWED_TYPES.has("tick")).toBe(false);
  });

  it("leaves the checklist file byte-identical after a refused tick", async () => {
    const { pmDir, executeCommand } = setup();
    const before = readFileSync(join(pmDir, "Budget", "4 - Checklist.md"), "utf8");
    await executeCommand({ type: "tick", payload: { file: "Budget/4 - Checklist.md", cbidx: 0 } });
    expect(readFileSync(join(pmDir, "Budget", "4 - Checklist.md"), "utf8")).toBe(before);
  });
});

describe("undo — every bridge write is reversible from the phone", () => {
  const INBOX = ["# Inbox", "", "## New", "", "- [ ] an existing idea", ""].join("\n");

  function setupWithInbox() {
    const ctx = setup();
    writeFileSync(join(ctx.pmDir, "0 - Inbox.md"), INBOX);
    return ctx;
  }

  it("reports nothing to undo on a fresh bridge", async () => {
    const { executeCommand } = setupWithInbox();
    expect(await executeCommand({ type: "undo", payload: {} })).toEqual({ ok: false, error: "nothing to undo" });
  });

  it("reverts a capture to its exact pre-image", async () => {
    const { pmDir, executeCommand } = setupWithInbox();
    await executeCommand({ type: "capture", payload: { text: "buy a new router" } });
    const inboxPath = join(pmDir, "0 - Inbox.md");
    expect(readFileSync(inboxPath, "utf8")).toContain("buy a new router");

    const outcome = await executeCommand({ type: "undo", payload: {} });
    expect(outcome.ok).toBe(true);
    expect(readFileSync(inboxPath, "utf8")).toBe(INBOX);
  });

  it("undoes one write at a time, newest first, and stops when the journal is exhausted", async () => {
    const { pmDir, executeCommand } = setupWithInbox();
    await executeCommand({ type: "capture", payload: { text: "first" } });
    await executeCommand({ type: "capture", payload: { text: "second" } });

    await executeCommand({ type: "undo", payload: {} });
    const afterOne = readFileSync(join(pmDir, "0 - Inbox.md"), "utf8");
    expect(afterOne).toContain("first");
    expect(afterOne).not.toContain("second");

    await executeCommand({ type: "undo", payload: {} });
    expect(readFileSync(join(pmDir, "0 - Inbox.md"), "utf8")).toBe(INBOX);
    expect(await executeCommand({ type: "undo", payload: {} })).toEqual({ ok: false, error: "nothing to undo" });
  });

  it("refuses rather than clobbering a laptop edit made after the write", async () => {
    const { pmDir, executeCommand } = setupWithInbox();
    await executeCommand({ type: "capture", payload: { text: "from the phone" } });
    const inboxPath = join(pmDir, "0 - Inbox.md");
    writeFileSync(inboxPath, readFileSync(inboxPath, "utf8") + "- [ ] typed on the laptop\n");

    const outcome = await executeCommand({ type: "undo", payload: {} });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/changed on the laptop/i);
    expect(readFileSync(inboxPath, "utf8")).toContain("typed on the laptop");
  });
});

describe("checklist snapshot payload budget", () => {
  it("stays under 250 KB even with a large, multi-campaign board", () => {
    const root = mkdtempSync(join(tmpdir(), "pm-bridge-snapshot-"));
    cleanupDirs.push(root);
    const pmDir = join(root, "ERA Notes", "10 - Project Management");

    const campaigns = ["Budget", "Schedule", "Kitchen", "Trips", "Hub & ERA", "Notifications & Alerts", "Outfits", "Healthcare"];
    for (const campaign of campaigns) {
      const dir = join(pmDir, campaign);
      mkdirSync(dir, { recursive: true });
      const lines = ["# Checklist", "", "## Now", ""];
      for (let i = 0; i < 60; i++) {
        lines.push(`- [ ] **X${i}** A representative checklist line describing outcome number ${i} in enough words to be realistic _(friction - M)_`);
      }
      writeFileSync(join(dir, "4 - Checklist.md"), lines.join("\n"));
    }

    const { buildTasksSnapshot } = createTasksSnapshotBuilder({ PM_DIR: pmDir });
    const snapshot = buildTasksSnapshot();
    expect(snapshot.tasks.length).toBe(campaigns.length * 60);
    const bytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");
    expect(bytes).toBeLessThan(250_000);
  });
});

// ---------------------------------------------------------------------------
// Rollups + history — the payloads behind the Overview / Campaigns widgets.
// Both are pure PM_DIR readers, so a tmp vault fixture is the whole setup.
// ---------------------------------------------------------------------------

/** Build a tmp PM dir containing only the named campaign files. */
function seedPmDir(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "pm-bridge-rollups-"));
  cleanupDirs.push(root);
  const pmDir = join(root, "ERA Notes", "10 - Project Management");
  for (const [rel, raw] of Object.entries(files)) {
    const abs = join(pmDir, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, raw);
  }
  return pmDir;
}

const VALID_CHECKLIST = [
  "---",
  "status: active",
  "updated: 2026-07-25",
  "---",
  "",
  "## Now",
  "",
  "- [ ] **BUD-1** Fix the rounding drift _(blocker - S)_",
  "- [ ] **BUD-2** Reconcile transfer direction _(friction - M)_",
  "- [x] **BUD-3** Already shipped but not yet swept _(annoyance - L)_",
  "",
  "## Next",
  "",
  "- [ ] **BUD-4** Split the balance hook _(parked - L)_",
  "",
  "## Later",
  "",
  "- [ ] **BUD-5** Rewrite the analytics pipeline _(annoyance - M)_",
  "",
].join("\n");

describe("campaign rollups snapshot", () => {
  it("counts lanes, severities and efforts across OPEN items only", () => {
    const pmDir = seedPmDir({ "Budget/4 - Checklist.md": VALID_CHECKLIST });
    const { buildRollupsSnapshot } = createRollupsSnapshotBuilder({ PM_DIR: pmDir });
    const { campaigns, totals } = buildRollupsSnapshot();

    expect(campaigns).toHaveLength(1);
    const budget = campaigns[0];
    expect(budget.campaign).toBe("Budget");
    expect(budget.prefix).toBe("BUD");
    expect(budget.updated).toBe("2026-07-25");

    // 5 items in lanes, 1 of them done -> 4 open. Distributions cover the 4 open.
    expect(budget.checklist.total).toBe(5);
    expect(budget.checklist.done).toBe(1);
    expect(budget.checklist.open).toBe(4);
    expect(budget.checklist.byLane).toEqual({ Now: 2, Next: 1, Later: 1 });
    expect(budget.checklist.bySeverity).toEqual({ blocker: 1, friction: 1, annoyance: 1, parked: 1, none: 0 });
    expect(budget.checklist.byEffort).toEqual({ S: 1, M: 2, L: 1, other: 0 });
    expect(totals).toMatchObject({ campaigns: 1, total: 5, done: 1, open: 4, blockers: 1 });
  });

  it("reads pain bullets from Feature State and reports lint health", () => {
    const pmDir = seedPmDir({
      "Budget/4 - Checklist.md": VALID_CHECKLIST,
      "Budget/1 - Feature State.md": ["# Feature State", "", "🔴 Balances drift after a transfer edit", "🟠 Category picker is slow", "🟠 Draft loses focus", ""].join("\n"),
    });
    const { campaigns } = createRollupsSnapshotBuilder({ PM_DIR: pmDir }).buildRollupsSnapshot();
    expect(campaigns[0].pain).toEqual({ blocker: 1, friction: 2, annoyance: 0, parked: 0 });
    // A well-formed checklist lints clean; the done-item-still-in-a-lane is W1.
    expect(campaigns[0].lint.errors).toBe(0);
    expect(campaigns[0].lint.warnings).toBeGreaterThan(0);
  });

  it("surfaces grammar errors as a per-campaign lint count", () => {
    const pmDir = seedPmDir({
      "Budget/4 - Checklist.md": ["## Now", "", "- [ ] no id chip and no meta suffix", ""].join("\n"),
    });
    const { campaigns, totals } = createRollupsSnapshotBuilder({ PM_DIR: pmDir }).buildRollupsSnapshot();
    expect(campaigns[0].lint.errors).toBeGreaterThan(0);
    expect(totals.lintErrors).toBeGreaterThan(0);
  });

  it("skips campaigns with no checklist and never throws on a missing Feature State", () => {
    const pmDir = seedPmDir({ "Kitchen/1 - Feature State.md": "🔴 orphan pain bullet\n" });
    const snapshot = createRollupsSnapshotBuilder({ PM_DIR: pmDir }).buildRollupsSnapshot();
    expect(snapshot.campaigns).toEqual([]);
    expect(snapshot.totals).toMatchObject({ campaigns: 0, open: 0, blockers: 0 });
  });
});

describe("completion history snapshot", () => {
  it("parses prose done-stamps, table done-stamps, and aggregates by day", () => {
    const pmDir = seedPmDir({
      "Delivery/4 - Checklist.md": VALID_CHECKLIST,
      "Delivery/Delivery — Master Book.md": [
        "# Delivery — Master Book",
        "",
        "## Shipped Log",
        "",
        "✅ 2026-07-16 — **DLV-1: Flight recorder foundation.** Full-fidelity transcript capture.",
        "✅ 2026-07-17 — **DLV-11: BUD-11 root-cause fixes.** Fixed at the source.",
        "",
      ].join("\n"),
      "Healthcare/4 - Checklist.md": VALID_CHECKLIST,
      "Healthcare/Healthcare — Master Book.md": [
        "# Feature State",
        "",
        "| ID | Outcome | Status | Evidence |",
        "| --- | --- | --- | --- |",
        "| HLTH-1 | Module scaffold | ✅ 2026-07-17 | check-feature-index green |",
        "",
      ].join("\n"),
    });

    const { completions, completedByDay } = createHistorySnapshotBuilder({ PM_DIR: pmDir }).buildHistorySnapshot();

    expect(completions).toHaveLength(3);
    expect(completions[0]).toMatchObject({ date: "2026-07-16", campaign: "Delivery", idChip: "DLV-1" });
    expect(completions[0].text).toContain("Flight recorder foundation");

    const table = completions.find((c) => c.idChip === "HLTH-1");
    expect(table).toMatchObject({ date: "2026-07-17", campaign: "Healthcare" });
    expect(table?.text).toBe("Module scaffold");

    expect(completedByDay).toEqual([
      { date: "2026-07-16", count: 1, byCampaign: { Delivery: 1 } },
      { date: "2026-07-17", count: 2, byCampaign: { Delivery: 1, Healthcare: 1 } },
    ]);
  });

  it("ignores stamps inside fenced code and campaigns with no Feature State", () => {
    const pmDir = seedPmDir({
      "Budget/1 - Feature State.md": ["# Feature State", "", "```md", "✅ 2026-01-01 — **BUD-99** an example in a docs fence", "```", "", "✅ 2026-07-20 — **BUD-1** the real one", ""].join("\n"),
    });
    const { completions } = createHistorySnapshotBuilder({ PM_DIR: pmDir }).buildHistorySnapshot();
    expect(completions).toHaveLength(1);
    expect(completions[0].idChip).toBe("BUD-1");
  });
});

describe("spendByDay", () => {
  it("buckets session cost by calendar day and tolerates missing usage", () => {
    expect(
      spendByDay([
        { sessionId: "a", updatedAt: "2026-07-24T10:00:00.000Z", usageTotal: { costUsd: 1.5 } },
        { sessionId: "b", updatedAt: "2026-07-24T22:00:00.000Z", usageTotal: { costUsd: 0.25 } },
        { sessionId: "c", updatedAt: "2026-07-25T08:00:00.000Z", usageTotal: null },
        { sessionId: "d", updatedAt: null, usageTotal: { costUsd: 99 } },
      ]),
    ).toEqual([
      { date: "2026-07-24", costUsd: 1.75, sessions: 2 },
      { date: "2026-07-25", costUsd: 0, sessions: 1 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Session detail (DLV-64): everything the phone needs to *read* a session.
// ---------------------------------------------------------------------------

function seedSessionDir(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "pm-bridge-session-"));
  cleanupDirs.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

const turn = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, turnId: "0001", phase: "DISCOVERY", role: "Discovery", provider: "claude", model: "claude-haiku-4-5",
    effort: "low", startedAt: "2026-07-30T07:49:14.116Z", durationMs: 28510, costUsd: 0.1,
    context: { occupancyTokens: 147952, windowTokens: 200000, pctUsed: 0.74 }, result: "ok", records: 21, ...over });

describe("buildSessionExtras", () => {
  it("returns an empty object for a directory that does not exist", () => {
    expect(buildSessionExtras(join(tmpdir(), "definitely-not-a-session"))).toEqual({});
  });

  it("splits the ledger into open-first and answered, and counts dismissals", () => {
    const dir = seedSessionDir({
      "memory/ledger.json": JSON.stringify({
        questions: [
          { id: "q1", text: "advisory one", kind: "advisory", status: "open" },
          { id: "q2", text: "blocking one", kind: "blocking", status: "open" },
          { id: "q3", text: "asked", kind: "blocking", status: "answered", answer: { text: "answered", at: "2026-07-30T08:00:00Z" } },
          { id: "q4", text: "gone", status: "dismissed" },
        ],
      }),
    });
    const { qa } = buildSessionExtras(dir);
    expect(qa?.open.map((q: { id: string }) => q.id)).toEqual(["q2", "q1"]); // blocking first — that's what stopped the session
    expect(qa?.answered.map((q: { id: string }) => q.id)).toEqual(["q3"]);
    expect(qa?.answered[0].answer?.text).toBe("answered");
    expect(qa?.dismissedCount).toBe(1);
    expect(qa?.total).toBe(4);
  });

  it("truncates long question text rather than shipping a wall of it", () => {
    const dir = seedSessionDir({
      "memory/ledger.json": JSON.stringify({ questions: [{ id: "q1", text: "x".repeat(900), kind: "blocking", status: "open" }] }),
    });
    const text = buildSessionExtras(dir).qa!.open[0].text;
    expect(text.length).toBeLessThan(450);
    expect(text.endsWith("…")).toBe(true);
  });

  it("attaches an excerpt only to the most recent turns", () => {
    const turns = Array.from({ length: 20 }, (_, i) => turn({ turnId: String(i + 1).padStart(4, "0") })).join("\n");
    const shards: Record<string, string> = { "transcript/turns.ndjson": turns };
    for (let i = 1; i <= 20; i += 1) {
      const id = String(i).padStart(4, "0");
      shards[`transcript/t-${id}.ndjson`] = JSON.stringify({ kind: "assistant.text", text: `result of turn ${i}` });
    }
    const extras = buildSessionExtras(seedSessionDir(shards));
    expect(extras.turnsTotal).toBe(20);
    const tail = extras.turnsTail!;
    expect(tail).toHaveLength(20);
    expect(tail.filter((t) => t.excerpt)).toHaveLength(12);
    expect(tail.at(-1)!.excerpt).toContain("result of turn 20");
  });

  it("falls back to reasoning when a turn produced no assistant text", () => {
    const dir = seedSessionDir({
      "transcript/turns.ndjson": turn(),
      "transcript/t-0001.ndjson": JSON.stringify({ kind: "assistant.reasoning", reasoning: "thinking about it" }),
    });
    expect(buildSessionExtras(dir).turnsTail![0]).toMatchObject({ excerptKind: "reasoning" });
  });

  it("sums cost by phase and by model across every turn, not just the tail", () => {
    const dir = seedSessionDir({
      "transcript/turns.ndjson": [
        turn({ turnId: "0001", phase: "DISCOVERY", costUsd: 0.3 }),
        turn({ turnId: "0002", phase: "PLAN", costUsd: 0.2, model: "claude-sonnet-5" }),
        turn({ turnId: "0003", phase: "DISCOVERY", costUsd: 0.1 }),
      ].join("\n"),
    });
    const { costDetail } = buildSessionExtras(dir);
    expect(costDetail!.byPhase).toEqual([
      { key: "DISCOVERY", costUsd: 0.4, turns: 2 },
      { key: "PLAN", costUsd: 0.2, turns: 1 },
    ]);
    expect(costDetail!.byModel[0].key).toContain("haiku");
    expect(costDetail!.context).toMatchObject({ windowTokens: 200000 });
  });

  it("lists only the artifacts that exist, with excerpts", () => {
    const dir = seedSessionDir({ "artifacts/spec.md": "# Spec\n\nfive acceptance criteria" });
    const artifacts = buildSessionExtras(dir).artifacts!;
    expect(artifacts.map((a) => a.key)).toEqual(["spec"]);
    expect(artifacts[0].excerpt).toContain("acceptance criteria");
    expect(artifacts[0].truncated).toBe(false);
  });
});

describe("capSessionSnapshot", () => {
  const bigSnapshot = () => ({
    sessionId: "s-1",
    eventsTail: Array.from({ length: 40 }, (_, i) => ({ seq: i, type: "event.type.that.is.long" })),
    turnsTail: Array.from({ length: 40 }, (_, i) => ({ turnId: String(i), excerpt: "x".repeat(280), excerptKind: "text" })),
    qa: { open: [{ id: "q1", text: "open" }], answered: Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, text: "y".repeat(400) })), dismissedCount: 0, total: 21 },
    artifacts: [{ key: "spec", label: "Spec", exists: true, bytes: 10, excerpt: "z".repeat(1200), truncated: false }],
  });

  it("leaves a snapshot under budget completely alone", () => {
    const snapshot = { sessionId: "s-1", turnsTail: [] };
    expect(capSessionSnapshot(snapshot, 200_000)).toBe(snapshot);
    expect(snapshot).not.toHaveProperty("truncated");
  });

  it("drops excerpts before turns, and answered questions before events", () => {
    const capped = capSessionSnapshot(bigSnapshot(), 12_000);
    expect(capped.truncated?.[0]).toBe("turn excerpts");
    expect(capped.turnsTail!.every((t: { excerpt: string | null }) => t.excerpt === null)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(capped))).toBeLessThanOrEqual(12_000);
  });

  it("keeps open questions even at the smallest budget — they are the point of the view", () => {
    const capped = capSessionSnapshot(bigSnapshot(), 500);
    expect(capped.qa!.open).toHaveLength(1);
    expect(capped.qa!.answered).toEqual([]);
    expect(capped.truncated).toContain("artifact excerpts");
  });
});

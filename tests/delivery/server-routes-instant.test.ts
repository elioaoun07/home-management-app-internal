// DLV-73 route tests: the INSTANT lane's launch and gate surfaces.
//
// Two things are being protected here. First, that the triage gate now *routes*
// a trivial item to INSTANT instead of refusing it — the whole point of the lane.
// Second, that the one-click spec+plan approval cannot escape the narrow case it
// was authorized for: it is an INSTANT affordance for a merged artifact, and a
// risk-flagged plan still needs its own typed confirmation.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { atomicWriteJsonSync } from "../../scripts/delivery/fsx.mjs";
import { DeliveryRouteError, createDeliveryContext, routeDelivery } from "../../scripts/delivery/server-routes.mjs";

const cleanupDirs: string[] = [];
afterEach(() => {
  while (cleanupDirs.length) {
    const dir = cleanupDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const TARGET = "src/components/expense/MobileExpenseForm.tsx";
// The BUD-14 shape, verbatim: S-effort, names exactly one file, no money or
// vagueness flags. This is the item the triage gate was written to refuse.
const TRIVIAL_LINE = `- [ ] **N1** Mobile expense form quick-amount chip: replace the $25 preset with $20 → \`${TARGET}:1144\` _(annoyance - S)_`;
// Prose only: nothing names a file, so INSTANT has nothing to merge around.
const VAGUE_LINE = "- [ ] **N2** Fix rounding drift in allocation splits across the balance engine _(blocker - M)_";
const CHECKLIST_RAW = ["# Checklist", "", "## Now", "", TRIVIAL_LINE, VAGUE_LINE, ""].join("\n");

// `recommendAgentConfig` returns null when the provider has no model for the
// matched tier, so a lane assertion needs a populated catalog to mean anything.
const CATALOG = {
  providers: {
    claude: {
      defaultModel: "claude-sonnet-5",
      efforts: ["low", "medium", "high", "xhigh", "max"],
      models: [
        { id: "claude-haiku-4-5", tier: "economy", pricing: { inPerMTok: 1, outPerMTok: 5, cachedReadPerMTok: 0.1, cacheWritePerMTok: 1.25 } },
        { id: "claude-sonnet-5", tier: "standard", pricing: { inPerMTok: 3, outPerMTok: 15, cachedReadPerMTok: 0.3, cacheWritePerMTok: 3.75 } },
        { id: "claude-opus-4-8", tier: "premium", pricing: { inPerMTok: 5, outPerMTok: 25, cachedReadPerMTok: 0.5, cacheWritePerMTok: 6.25 } },
      ],
    },
  },
};

function setup() {
  const root = mkdtempSync(join(tmpdir(), "delivery-instant-routes-"));
  cleanupDirs.push(root);
  mkdirSync(join(root, ".delivery"), { recursive: true });
  writeFileSync(join(root, ".delivery", "config.json"), JSON.stringify(CATALOG));
  const pmRel = join("ERA Notes", "10 - Project Management");
  const pmDir = join(root, pmRel);
  mkdirSync(join(pmDir, "Budget"), { recursive: true });
  writeFileSync(join(pmDir, "Budget", "4 - Checklist.md"), CHECKLIST_RAW);
  writeFileSync(join(root, "README.md"), "test repo\n");
  writeFileSync(join(root, ".gitignore"), "/.delivery/\n");
  mkdirSync(join(root, "src", "components", "expense"), { recursive: true });
  writeFileSync(join(root, TARGET), 'const QUICK_AMOUNTS = ["5", "10", "25", "50", "100"];\n');

  const ctx = createDeliveryContext({
    ROOT: root,
    PM_DIR: pmDir,
    PM_REL: pmRel,
    gitStatusPorcelain: () => "",
    gitRevParseHead: () => "fixture-head",
    runValidation: async () => ({ ok: true, results: {} }),
    spawnRunner: () => {},
  });
  return { root, ctx };
}

function q(params: Record<string, string> = {}) {
  return new URLSearchParams(params);
}

function startBody(overrides: Record<string, unknown> = {}) {
  return {
    file: "Budget/4 - Checklist.md",
    cbidx: 0,
    expectText: TRIVIAL_LINE,
    agent: "claude",
    budget: { maxUsd: 0.25, maxTokens: 250_000, warnPct: 0.8 },
    flightCheck: { reviewed: true, lane: "INSTANT" },
    ...overrides,
  };
}

async function expectRouteError(promise: Promise<unknown>, status: number, messageMatch?: RegExp) {
  try {
    await promise;
    throw new Error("expected routeDelivery to throw a DeliveryRouteError");
  } catch (err) {
    expect(err).toBeInstanceOf(DeliveryRouteError);
    expect((err as InstanceType<typeof DeliveryRouteError>).status).toBe(status);
    if (messageMatch) expect((err as Error).message).toMatch(messageMatch);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function start(ctx: any, overrides: Record<string, unknown> = {}) {
  const result = await routeDelivery(
    { method: "POST", path: "/api/delivery/start", query: q(), body: startBody(overrides) },
    ctx,
  );
  return (result as { json: { sessionId: string } }).json.sessionId;
}

// ============================================================

describe("DLV-73: the triage gate routes instead of refusing", () => {
  it("recommends INSTANT for the BUD-14 shape", async () => {
    const { ctx } = setup();
    const result = (await routeDelivery(
      {
        method: "GET",
        path: "/api/delivery/recommendation",
        query: q({ file: "Budget/4 - Checklist.md", cbidx: "0", provider: "claude" }),
        body: {},
      },
      ctx,
    )) as { json: { recommendation: { lane: string; tier: string }; preview: { recommendedLane: string } } };

    expect(result.json.recommendation.lane).toBe("INSTANT");
    // INSTANT reuses the economy tier — it is chosen by the triage signal, not by
    // a tier of its own, which is why lane and tier had to be decoupled.
    expect(result.json.recommendation.tier).toBe("economy");
    expect(result.json.preview.recommendedLane).toBe("INSTANT");
  });

  it("launches a trivial item on INSTANT with no acknowledgment at all", async () => {
    const { ctx, root } = setup();
    const sessionId = await start(ctx);
    const packet = JSON.parse(readFileSync(join(root, ".delivery", "sessions", sessionId, "packet.json"), "utf8"));
    expect(packet.lanePolicy.lane).toBe("INSTANT");
    expect(packet.lanePolicy.tier).toBe("economy");
    expect(packet.lanePolicy.maxInternalTurns).toBe(8);
    // INSTANT always merges, so the plan gate never costs a second turn.
    expect(packet.lanePolicy.mergedDiscoveryPlan).toBe(true);
  });

  it("still refuses the same item on FAST, and now points at INSTANT", async () => {
    const { ctx } = setup();
    await expectRouteError(
      start(ctx, { flightCheck: { reviewed: true, lane: "FAST" } }),
      400,
      /INSTANT lane/,
    );
  });

  it("honours LAUNCH ANYWAY for an owner who really wants FAST", async () => {
    const { ctx, root } = setup();
    const sessionId = await start(ctx, {
      flightCheck: { reviewed: true, lane: "FAST" },
      triageAck: "LAUNCH ANYWAY",
    });
    const packet = JSON.parse(readFileSync(join(root, ".delivery", "sessions", sessionId, "packet.json"), "utf8"));
    expect(packet.lanePolicy.lane).toBe("FAST");
  });

  it("refuses INSTANT when no single target file is known", async () => {
    const { ctx } = setup();
    // The vague item names no path, and this fixture has no Feature Map for the
    // locator to work from — so nothing resolves and the lane has no anchor.
    await expectRouteError(
      start(ctx, { cbidx: 1, expectText: VAGUE_LINE, flightCheck: { reviewed: true, lane: "INSTANT" } }),
      400,
      /INSTANT needs exactly one known target file/,
    );
  });
});

// ============================================================

/** Park a freshly-started session at a gate, as the runner would. */
function parkAtGate(root: string, sessionId: string, gate: string, extra: Record<string, unknown> = {}) {
  const dir = join(root, ".delivery", "sessions", sessionId);
  const statePath = join(dir, "state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  atomicWriteJsonSync(statePath, {
    ...state,
    state: gate === "spec" ? "SPEC_READY" : gate === "question" ? "NEEDS_DECISION" : "PLAN_READY",
    awaiting: { gate, ...extra },
  });
  return dir;
}

function writePlanArtifact(dir: string, riskFlags: string[] = []) {
  mkdirSync(join(dir, "artifacts"), { recursive: true });
  atomicWriteJsonSync(join(dir, "artifacts", "plan.json"), {
    steps: [{ id: "S1", description: "edit", paths: [TARGET], validationHint: "test" }],
    testPlan: "t", riskFlags, rollbackSketch: "r", noNewDeps: true, openQuestions: [],
  });
}

function decisionGates(dir: string) {
  return readdirSync(join(dir, "decisions")).sort().map((f) => {
    const record = JSON.parse(readFileSync(join(dir, "decisions", f), "utf8"));
    return { gate: record.gate, decision: record.decision, via: record.viaAlsoApprovePlan || false };
  });
}

describe("DLV-73: one click, two recorded decisions", () => {
  it("writes BOTH the spec and plan approvals from a single request", async () => {
    const { ctx, root } = setup();
    const sessionId = await start(ctx);
    const dir = parkAtGate(root, sessionId, "spec");
    writePlanArtifact(dir);

    await routeDelivery(
      {
        method: "POST", path: "/api/delivery/decision", query: q(),
        body: { id: sessionId, gate: "spec", decision: "approve", alsoApprovePlan: true },
      },
      ctx,
    );

    // Three gates are still recorded across the session; this request produced
    // two of them, in the order the state machine consumes them.
    expect(decisionGates(dir)).toEqual([
      { gate: "spec", decision: "approve", via: false },
      { gate: "plan", decision: "approve", via: true },
    ]);
  });

  it("refuses on a lane other than INSTANT", async () => {
    const { ctx, root } = setup();
    const sessionId = await start(ctx, {
      flightCheck: { reviewed: true, lane: "FAST" },
      triageAck: "LAUNCH ANYWAY",
    });
    const dir = parkAtGate(root, sessionId, "spec");
    writePlanArtifact(dir);
    await expectRouteError(
      routeDelivery(
        {
          method: "POST", path: "/api/delivery/decision", query: q(),
          body: { id: sessionId, gate: "spec", decision: "approve", alsoApprovePlan: true },
        },
        ctx,
      ),
      400,
      /INSTANT-lane affordance/,
    );
  });

  it("refuses to collapse the gate for a risk-flagged plan without its typed approval", async () => {
    const { ctx, root } = setup();
    const sessionId = await start(ctx);
    const dir = parkAtGate(root, sessionId, "spec");
    writePlanArtifact(dir, ["db-migration"]);
    await expectRouteError(
      routeDelivery(
        {
          method: "POST", path: "/api/delivery/decision", query: q(),
          body: { id: sessionId, gate: "spec", decision: "approve", alsoApprovePlan: true },
        },
        ctx,
      ),
      400,
      /risk-flagged/,
    );
  });

  it("allows it for a risk-flagged plan when the owner does type APPROVE", async () => {
    const { ctx, root } = setup();
    const sessionId = await start(ctx);
    const dir = parkAtGate(root, sessionId, "spec");
    writePlanArtifact(dir, ["security"]);
    await routeDelivery(
      {
        method: "POST", path: "/api/delivery/decision", query: q(),
        body: { id: sessionId, gate: "spec", decision: "approve", alsoApprovePlan: true, confirmText: "APPROVE" },
      },
      ctx,
    );
    expect(decisionGates(dir).map((d) => d.gate)).toEqual(["spec", "plan"]);
  });

  it("refuses when no plan artifact exists yet", async () => {
    const { ctx, root } = setup();
    const sessionId = await start(ctx);
    parkAtGate(root, sessionId, "spec");
    await expectRouteError(
      routeDelivery(
        {
          method: "POST", path: "/api/delivery/decision", query: q(),
          body: { id: sessionId, gate: "spec", decision: "approve", alsoApprovePlan: true },
        },
        ctx,
      ),
      409,
      /no plan artifact/,
    );
  });

  it("refuses on any gate other than spec-approve", async () => {
    const { ctx, root } = setup();
    const sessionId = await start(ctx);
    const dir = parkAtGate(root, sessionId, "plan");
    writePlanArtifact(dir);
    await expectRouteError(
      routeDelivery(
        {
          method: "POST", path: "/api/delivery/decision", query: q(),
          body: { id: sessionId, gate: "plan", decision: "approve", alsoApprovePlan: true },
        },
        ctx,
      ),
      400,
      /only valid when approving the spec gate/,
    );
  });
});

describe("DLV-73: answer + approve", () => {
  it("records acceptProposal on a question gate that advertised a proposal", async () => {
    const { ctx, root } = setup();
    const sessionId = await start(ctx);
    const dir = parkAtGate(root, sessionId, "question", {
      returnTo: "DISCOVERY",
      proposalReady: true,
      questions: [{ id: "q-1", text: "keep the 100 preset?" }],
    });
    await routeDelivery(
      {
        method: "POST", path: "/api/delivery/decision", query: q(),
        body: { id: sessionId, gate: "question", decision: "answer", answer: "yes", acceptProposal: true },
      },
      ctx,
    );
    const record = JSON.parse(readFileSync(join(dir, "decisions", readdirSync(join(dir, "decisions"))[0]), "utf8"));
    expect(record.acceptProposal).toBe(true);
    expect(record.answer).toBe("yes");
  });

  it("refuses when the gate has no complete proposal to approve", async () => {
    const { ctx, root } = setup();
    const sessionId = await start(ctx);
    parkAtGate(root, sessionId, "question", {
      returnTo: "DISCOVERY",
      questions: [{ id: "q-1", text: "which file?" }],
    });
    await expectRouteError(
      routeDelivery(
        {
          method: "POST", path: "/api/delivery/decision", query: q(),
          body: { id: sessionId, gate: "question", decision: "answer", answer: "that one", acceptProposal: true },
        },
        ctx,
      ),
      400,
      /no complete proposal/,
    );
  });

  it("still requires an actual answer — approving is not answering", async () => {
    const { ctx, root } = setup();
    const sessionId = await start(ctx);
    parkAtGate(root, sessionId, "question", {
      returnTo: "DISCOVERY",
      proposalReady: true,
      questions: [{ id: "q-1", text: "keep the 100 preset?" }],
    });
    await expectRouteError(
      routeDelivery(
        {
          method: "POST", path: "/api/delivery/decision", query: q(),
          body: { id: sessionId, gate: "question", decision: "answer", acceptProposal: true },
        },
        ctx,
      ),
      400,
      /an answer is required/,
    );
  });
});

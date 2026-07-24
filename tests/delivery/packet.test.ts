import { describe, expect, it } from "vitest";
import { scanCheckboxes } from "../../scripts/pm/mutations.mjs";
import {
  DEFAULT_CONSTRAINTS,
  PacketError,
  SCHEMA_VERSION,
  buildItemIdentity,
  buildPacket,
  campaignFromPmFile,
  makeSessionId,
  parseTaskMeta,
  sectionRank,
  textHash,
} from "../../scripts/delivery/packet.mjs";

const PM_FILE = "Budget/4 - Checklist.md";
const RAW = [
  "# Now",
  "",
  "- [ ] **N4** Fix rounding drift in allocation splits _(blocker - M)_",
  "- [x] Done item",
  "",
  "# Next",
  "",
  "- [ ] Some other item",
].join("\n");

describe("parseTaskMeta", () => {
  it("extracts id, severity, effort and cleaned text", () => {
    const meta = parseTaskMeta("**N4** Fix rounding drift in allocation splits _(blocker - M)_");
    expect(meta).toEqual({
      id: "N4",
      sev: "blocker",
      effort: "M",
      text: "Fix rounding drift in allocation splits",
    });
  });

  it("returns nulls when there is no id/severity tag", () => {
    expect(parseTaskMeta("Just a plain item")).toEqual({
      id: null,
      sev: null,
      effort: null,
      text: "Just a plain item",
    });
  });

  it("ignores a parenthetical that isn't a known severity", () => {
    const meta = parseTaskMeta("Something _(not a severity)_");
    expect(meta.sev).toBeNull();
    expect(meta.effort).toBeNull();
  });

  it("extracts canonical prefixed / hyphenated / lettered IDs (lockstep with the dashboard parser)", () => {
    expect(parseTaskMeta("**BUD-3** Merchant map _(annoyance - S)_").id).toBe("BUD-3");
    expect(parseTaskMeta("**SCH-1c.1** Gemini capture _(friction - M)_").id).toBe("SCH-1c.1");
    expect(parseTaskMeta("**NOTIF-6.6** Verify sync _(friction - M)_").id).toBe("NOTIF-6.6");
    expect(parseTaskMeta("**SCH-4.3b** Unify _(friction - L)_").id).toBe("SCH-4.3b");
    expect(parseTaskMeta("**R8.2** Real-device check _(friction - S)_").id).toBe("R8.2");
  });
});

describe("sectionRank", () => {
  it("ranks Now/Next/Later/DoD and defaults to 3", () => {
    expect(sectionRank("Now")).toBe(0);
    expect(sectionRank("Next")).toBe(1);
    expect(sectionRank("Later")).toBe(2);
    expect(sectionRank("Definition of Done")).toBe(4);
    expect(sectionRank("Some Other Heading")).toBe(3);
  });
});

describe("campaignFromPmFile", () => {
  it("returns the first path segment as the campaign", () => {
    expect(campaignFromPmFile("Budget/4 - Checklist.md")).toBe("Budget");
    expect(campaignFromPmFile("Hub & ERA/2 - Vision & Roadmap.md")).toBe("Hub & ERA");
  });

  it("returns null for a top-level file with no folder", () => {
    expect(campaignFromPmFile("_index.md")).toBeNull();
  });
});

describe("textHash", () => {
  it("is deterministic and trims before hashing", () => {
    expect(textHash("- [ ] foo")).toBe(textHash("- [ ] foo"));
    expect(textHash("  - [ ] foo  ")).toBe(textHash("- [ ] foo"));
  });

  it("differs for different input", () => {
    expect(textHash("- [ ] foo")).not.toBe(textHash("- [ ] bar"));
  });
});

describe("buildItemIdentity: ordinal cross-check against scanCheckboxes", () => {
  const boxes = scanCheckboxes(RAW);

  it("scanCheckboxes finds exactly the three real checkboxes in document order", () => {
    expect(boxes.map((b) => b.state)).toEqual(["open", "done", "open"]);
  });

  it("cbidx 0 resolves to the N4 item under the Now heading", () => {
    const r = buildItemIdentity(RAW, 0, PM_FILE);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.item.id).toBe("N4");
    expect(r.item.sev).toBe("blocker");
    expect(r.item.effort).toBe("M");
    expect(r.item.text).toBe("Fix rounding drift in allocation splits");
    expect(r.item.heading).toBe("Now");
    expect(r.item.sectionRank).toBe(0);
    expect(r.item.campaign).toBe("Budget");
    expect(r.item.cbidx).toBe(0);
    expect(r.item.lineText).toBe(RAW.split("\n")[boxes[0].line]);
    expect(r.item.textHash).toBe(textHash(r.item.lineText));
  });

  it("cbidx 1 resolves to the done item, heading unchanged (still Now)", () => {
    const r = buildItemIdentity(RAW, 1, PM_FILE);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.item.heading).toBe("Now");
    expect(r.item.text).toBe("Done item");
    expect(r.item.id).toBeNull();
  });

  it("cbidx 2 resolves under the Next heading", () => {
    const r = buildItemIdentity(RAW, 2, PM_FILE);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.item.heading).toBe("Next");
    expect(r.item.sectionRank).toBe(1);
    expect(r.item.text).toBe("Some other item");
  });

  it("every checkbox ordinal from scanCheckboxes resolves without error", () => {
    boxes.forEach((box, idx) => {
      const r = buildItemIdentity(RAW, idx, PM_FILE);
      expect(r.ok).toBe(true);
    });
  });

  it("rejects an out-of-range cbidx exactly like toggleCheckbox does", () => {
    expect(buildItemIdentity(RAW, 99, PM_FILE)).toEqual({ ok: false, reason: "out-of-range" });
    expect(buildItemIdentity(RAW, -1, PM_FILE)).toEqual({ ok: false, reason: "out-of-range" });
  });
});

describe("buildItemIdentity: textHash drift guard", () => {
  it("succeeds when expectText matches the current line", () => {
    const current = RAW.split("\n")[2];
    const r = buildItemIdentity(RAW, 0, PM_FILE, { expectText: current });
    expect(r.ok).toBe(true);
  });

  it("reports drift when expectText no longer matches (file changed underneath)", () => {
    const r = buildItemIdentity(RAW, 0, PM_FILE, {
      expectText: "- [ ] **N4** a totally different line now",
    });
    expect(r).toEqual({ ok: false, reason: "drift" });
  });
});

describe("makeSessionId", () => {
  it("matches the s-yyyymmdd-hhmmss-rand4 shape", () => {
    const id = makeSessionId(new Date(2026, 6, 11, 14, 32, 10), () => 0.42);
    expect(id).toMatch(/^s-\d{8}-\d{6}-[0-9a-z]{4}$/);
  });

  it("is deterministic given the same now/rand inputs", () => {
    const now = new Date(2026, 0, 1, 0, 0, 0);
    expect(makeSessionId(now, () => 0.5)).toBe(makeSessionId(now, () => 0.5));
  });

  it("varies with rand", () => {
    const now = new Date(2026, 0, 1, 0, 0, 0);
    expect(makeSessionId(now, () => 0.1)).not.toBe(makeSessionId(now, () => 0.9));
  });
});

type BuildPacketArgs = Parameters<typeof buildPacket>[0];

// These calls deliberately omit/violate required fields to exercise buildPacket's
// runtime validation — casting past the compile-time contract is the point.
function invalidPacketArgs(partial: object): BuildPacketArgs {
  return partial as unknown as BuildPacketArgs;
}

describe("buildPacket", () => {
  const baseItem = { pmFile: PM_FILE, cbidx: 0, text: "x" };
  const baseWorkspace = { baseHead: "abc123", dirtyAtStart: false, baselineStatusHash: "sha1" };

  it("requires sessionId, a valid agent, item, and workspace", () => {
    expect(() =>
      buildPacket(invalidPacketArgs({ agent: "codex", item: baseItem, workspace: baseWorkspace })),
    ).toThrow(PacketError);
    expect(() =>
      buildPacket(
        invalidPacketArgs({
          sessionId: "s-1",
          agent: "not-a-provider",
          item: baseItem,
          workspace: baseWorkspace,
        }),
      ),
    ).toThrow(PacketError);
    expect(() =>
      buildPacket(invalidPacketArgs({ sessionId: "s-1", agent: "codex", workspace: baseWorkspace })),
    ).toThrow(PacketError);
    expect(() =>
      buildPacket(invalidPacketArgs({ sessionId: "s-1", agent: "codex", item: baseItem })),
    ).toThrow(PacketError);
  });

  it("assembles schemaVersion 1 with merged default constraints", () => {
    const packet = buildPacket({
      sessionId: "s-20260711-143210-k7x2",
      agent: "codex",
      item: baseItem,
      workspace: baseWorkspace,
    });
    expect(packet.schemaVersion).toBe(SCHEMA_VERSION);
    expect(packet.constraints).toEqual(DEFAULT_CONSTRAINTS);
    expect(packet.agentConfig).toEqual({
      model: null,
      effort: { discovery: "medium", plan: "high", building: "high", review: "medium" },
    });
    expect(packet.capabilities).toEqual([]);
    expect(packet.skills).toEqual([]);
    expect(packet.acceptanceCriteria).toEqual([]);
  });

  it("merges model and per-phase effort overrides into the agent config", () => {
    const packet = buildPacket({
      sessionId: "s-1",
      agent: "claude",
      agentConfig: { model: "claude-sonnet", effort: { discovery: "low", plan: "xhigh" } },
      item: baseItem,
      workspace: baseWorkspace,
    });
    expect(packet.agentConfig).toEqual({
      model: "claude-sonnet",
      effort: { discovery: "low", plan: "xhigh", building: "high", review: "medium" },
    });
  });

  it("persists the immutable owner-authorized budget envelope", () => {
    const budget = {
      maxUsd: 2,
      maxTokens: 2_000_000,
      warnPct: 0.8,
      perPhase: {},
      authorization: "capped" as const,
      authorizedAt: "2026-07-24T00:00:00.000Z",
    };
    const packet = buildPacket({
      sessionId: "s-1",
      agent: "claude",
      item: baseItem,
      workspace: baseWorkspace,
      budget,
    });
    expect(packet.budget).toEqual(budget);
  });

  it("persists the auditable pre-launch Flight-Check snapshot", () => {
    const flightCheck = {
      schemaVersion: 1,
      reviewedAt: "2026-07-24T10:00:00.000Z",
      lane: { selected: "STANDARD", recommended: "STANDARD" },
      mismatchWarnings: [],
    };
    const packet = buildPacket({
      sessionId: "s-1",
      agent: "claude",
      item: baseItem,
      workspace: baseWorkspace,
      flightCheck,
    });
    expect(packet.flightCheck).toEqual(flightCheck);
  });

  it("lets caller-supplied constraints override defaults without dropping the rest", () => {
    const packet = buildPacket({
      sessionId: "s-1",
      agent: "claude",
      item: baseItem,
      workspace: baseWorkspace,
      constraints: { maxFixLoops: 1 },
    });
    expect(packet.constraints.maxFixLoops).toBe(1);
    expect(packet.constraints.gitPolicy).toBe("read-only");
  });
});

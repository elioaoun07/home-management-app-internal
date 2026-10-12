import { describe, expect, it } from "vitest";
import { eraArtifact } from "@/lib/era/artifacts";
import {
  assembleAdaptiveContext,
  boundAdaptiveContext,
  contextReceipt,
  mergeAskHistory,
  successfulCapabilities,
  ADAPTIVE_CONTEXT_MAX_CHARS,
  type ContextMessage,
  type ContextRule,
  type HistoryEntry,
} from "./eraAdaptiveContext";

const owner = "person-a";
const now = new Date("2026-10-10T12:00:00Z");
const artifact = eraArtifact(
  "reminder",
  "created",
  "00000000-0000-4000-8000-000000000001",
  "Dentist",
);
function msg(
  id: string,
  role: string,
  content: string,
  payload: Record<string, unknown> = {},
  conversation = "previous",
): ContextMessage {
  return {
    id,
    user_id: owner,
    conversation_id: conversation,
    role,
    content,
    created_at: "2026-10-09T12:00:00Z",
    intent_payload: payload,
  };
}
const done = () => ({
  outcome: {
    status: "done",
    capability: "reminder.create",
    entityIds: [artifact.id],
  },
  artifacts: [artifact],
});
function assemble(messages: ContextMessage[] = [], rules: ContextRule[] = []) {
  return assembleAdaptiveContext({
    owner,
    now,
    message: "What about the dentist?",
    conversationId: "current",
    messages,
    rules,
    accounts: [{ id: "cash", name: "Drawer", user_id: owner }],
    activity: [],
    coverage: { conversations: "sampled" },
  });
}
function rule(overrides: Partial<ContextRule> = {}): ContextRule {
  return {
    id: "choice",
    user_id: owner,
    kind: "alias",
    capability: "transfer.create",
    phrase: "the box",
    conditions: {},
    value: { id: "cash" },
    depends_on: ["cash"],
    ...overrides,
  };
}

describe("adaptive evidence admission", () => {
  it("an initial confirmation card does not discard the later acknowledged receipt for that turn", () => {
    const c = assemble([
      msg("a", "user", "Dentist Friday"),
      msg("b", "assistant", "Confirm?", {
        outcome: { status: "awaiting_confirm", capability: "reminder.create" },
      }),
      msg("c", "assistant", "Added Dentist", done()),
    ]);
    expect(c.episodes).toHaveLength(1);
    expect(c.episodes[0]).toMatchObject({
      evidence: "acknowledged_action",
      result: "Added Dentist",
      capabilities: ["reminder.create"],
    });
  });
  it("retrieves relevant older experience and recent user statements without learning a phrase rule", () => {
    const c = assemble([
      msg("a", "user", "I prefer dentist appointments in the afternoon"),
      msg("b", "assistant", "Understood", { aiKind: "prose" }),
      msg("c", "user", "Remind me about the dentist on Friday"),
      msg("d", "assistant", "Added Dentist", done()),
    ]);
    expect(c.episodes.map((e) => e.request)).toEqual([
      "I prefer dentist appointments in the afternoon",
      "Remind me about the dentist on Friday",
    ]);
    expect(c.episodes[0]).toMatchObject({
      evidence: "user_statement",
      result: null,
      capabilities: [],
    });
    expect(c.episodes[1]).toMatchObject({
      evidence: "acknowledged_action",
      result: "Added Dentist",
      capabilities: ["reminder.create"],
    });
  });
  it.each([
    "failed",
    "uncertain",
    "needs_input",
    "awaiting_confirm",
    "partial",
    "drafted",
    "handed_off",
  ])("%s does not become successful experience", (status) => {
    expect(
      assemble([
        msg("a", "user", "Dentist Friday"),
        msg("b", "assistant", "Done", {
          ...done(),
          outcome: { status, capability: "reminder.create" },
        }),
      ]).episodes,
    ).toEqual([]);
  });
  it("missing artifacts and model claims never prove writes", () => {
    expect(
      successfulCapabilities(
        msg("b", "assistant", "Done", {
          outcome: { status: "done", capability: "reminder.create" },
        }),
      ),
    ).toEqual([]);
    expect(
      successfulCapabilities(
        msg("b", "assistant", "Done", {
          outcome: { status: "answered", capability: "reminder.create" },
        }),
      ),
    ).toEqual([]);
    expect(
      successfulCapabilities(
        msg("b", "assistant", "Done", { aiKind: "prose" }),
      ),
    ).toEqual([]);
  });
  it("plan receipts require every declared step, and every write artifact", () => {
    const step = {
      id: "create",
      capabilityId: "reminder.create",
      status: "done",
      metadata: { itemId: artifact.id },
    };
    const p = {
      outcome: { status: "done", capability: "agent.plan" },
      plan: { steps: [{ id: "create", capabilityId: "reminder.create" }] },
      agentRun: { status: "done", steps: [step] },
    };
    expect(successfulCapabilities(msg("b", "assistant", "Added", p))).toEqual(
      [],
    );
    expect(
      successfulCapabilities(
        msg("b", "assistant", "Added", {
          ...p,
          agentRun: {
            status: "done",
            steps: [{ ...step, artifacts: [artifact] }],
          },
        }),
      ),
    ).toEqual(["reminder.create"]);
    expect(
      successfulCapabilities(
        msg("b", "assistant", "Added", {
          ...p,
          agentRun: { status: "done", steps: [] },
        }),
      ),
    ).toEqual([]);
    expect(
      successfulCapabilities(
        msg("b", "assistant", "Added", {
          ...p,
          agentRun: {
            status: "done",
            steps: [{ ...step, id: "invented", artifacts: [artifact] }],
          },
        }),
      ),
    ).toEqual([]);
  });
  it.each(["a", "b", null])(
    "a reported wrong user/reply/conversation (%s) is excluded",
    (messageId) => {
      const report = {
        ...msg("z", "system", "Reported", {
          issue: { kind: "wrong", messageId },
        }),
        intent_kind: "issue_report",
      };
      const c = assemble([
        msg("a", "user", "Dentist Friday"),
        msg("b", "assistant", "Added", done()),
        report,
      ]);
      expect(c.episodes).toEqual([]);
      expect(c.gaps).toContainEqual({
        kind: "reported",
        subject: "wrong",
        observations: 1,
      });
    },
  );
  it("private contexts exclude a partner, the active chat, future dates and expired history", () => {
    const c = assemble([
      { ...msg("p", "user", "PARTNER_SECRET"), user_id: "person-b" },
      msg("a", "user", "CURRENT_SECRET", {}, "current"),
      {
        ...msg("old", "user", "OLD_SECRET"),
        created_at: "2026-08-01T00:00:00Z",
      },
      {
        ...msg("future", "user", "FUTURE_SECRET"),
        created_at: "2026-10-11T00:00:00Z",
      },
      msg("okay", "user", "Dentist preference"),
    ]);
    expect(c.episodes.map((e) => e.source)).toEqual(["okay"]);
  });
  it("follows conversation boundaries when conversations interleave", () => {
    const c = assemble([
      msg("a", "user", "Dentist", {}, "one"),
      msg("b", "user", "Gym", {}, "two"),
      msg("c", "assistant", "Added Dentist", done(), "one"),
      msg(
        "d",
        "assistant",
        "Failed Gym",
        { outcome: { status: "failed" } },
        "two",
      ),
    ]);
    expect(c.episodes).toHaveLength(1);
    expect(c.episodes[0].request).toBe("Dentist");
  });
  it("lexical evidence ranking finds an older specific topic among unrelated activity", () => {
    const messages = [
      msg("dentist", "user", "Dentist appointments after 4pm"),
      ...Array.from({ length: 30 }, (_, i) =>
        msg(`u${i}`, "user", `Shopping groceries ${i}`),
      ),
    ];
    const c = assemble(messages);
    expect(c.episodes.some((e) => e.source === "dentist")).toBe(true);
    expect(c.episodes.length).toBeLessThanOrEqual(6);
  });
  it("retains conflicting statements with dates rather than fabricating a permanent preference", () => {
    const c = assemble([
      msg("a", "user", "Dentist in the morning"),
      {
        ...msg("b", "user", "Dentist in the afternoon now"),
        created_at: "2026-10-10T10:00:00Z",
      },
    ]);
    expect(c.episodes.map((e) => e.request)).toEqual([
      "Dentist in the morning",
      "Dentist in the afternoon now",
    ]);
    expect(c.choices).toEqual([]);
  });
  it("rebinds explicit aliases to current OWN accounts; stale, revoked and partner rules are inert", () => {
    const c = assemble(
      [],
      [
        rule(),
        rule({ id: "revoked", revoked_at: now.toISOString() }),
        rule({ id: "partner", user_id: "person-b" }),
        rule({ id: "deleted", depends_on: ["missing"] }),
        rule({
          id: "group",
          value: { groupId: "old-group", name: "Store" },
          depends_on: [],
        }),
      ],
    );
    expect(c.choices).toHaveLength(1);
    expect(c.choices[0]).toMatchObject({
      kind: "explicit",
      value: { id: "Drawer" },
    });
    expect(JSON.stringify(c)).not.toContain('"cash"');
  });
  it("unconfirmed legacy chip examples are not habits; linked successful examples stay tentative", () => {
    const c = assemble(
      [msg("a", "user", "Dentist"), msg("b", "assistant", "Added", done())],
      [
        rule({ kind: "example" }),
        rule({
          id: "verified",
          kind: "example",
          capability: "reminder.create",
          source_message_id: "a",
        }),
      ],
    );
    expect(c.choices).toHaveLength(1);
    expect(c.choices[0]).toMatchObject({
      source: "verified",
      kind: "observed",
      observations: 1,
    });
  });
  it("usage includes only visible records owned and acted on by the speaker, with no titles or IDs", () => {
    const c = assembleAdaptiveContext({
      owner,
      now,
      message: "Help me",
      messages: [],
      rules: [],
      accounts: [],
      coverage: {},
      activity: [
        {
          actor_id: owner,
          owner_id: owner,
          available: true,
          module: "kitchen",
        },
        {
          actor_id: "person-b",
          owner_id: owner,
          available: true,
          module: "healthcare",
        },
        {
          actor_id: owner,
          owner_id: "person-b",
          available: true,
          module: "healthcare",
        },
        {
          actor_id: owner,
          owner_id: owner,
          available: false,
          module: "healthcare",
        },
      ],
    });
    expect(c.usage).toEqual([{ module: "kitchen", events: 1 }]);
  });
  it("tracks misses as gaps without converting failed replies into training examples", () => {
    const c = assemble([
      msg("a", "user", "Book my flight"),
      msg("b", "assistant", "Can't", {
        missKind: "capability-gap",
        outcome: { status: "failed" },
      }),
    ]);
    expect(c.episodes).toEqual([]);
    expect(c.gaps).toEqual([
      { kind: "capability-gap", subject: "unresolved", observations: 1 },
    ]);
  });
  it("bounds context and records sources without copying private text", () => {
    const c = assemble([msg("a", "user", "PRIVATE PREFERENCE")]);
    const receipt = contextReceipt(c);
    expect(receipt.episodeSources).toEqual(["a"]);
    expect(JSON.stringify(receipt)).not.toContain("PRIVATE PREFERENCE");
    const large = {
      ...c,
      episodes: Array.from({ length: 30 }, () => ({
        ...c.episodes[0],
        request: "x".repeat(1000),
      })),
    };
    expect(
      JSON.stringify(boundAdaptiveContext(large)).length,
    ).toBeLessThanOrEqual(ADAPTIVE_CONTEXT_MAX_CHARS);
  });
});

describe("follow-up history continuity", () => {
  const u = (content: string): HistoryEntry => ({ role: "user", content });
  const a = (content: string): HistoryEntry => ({ role: "assistant", content });
  it("removes the current optimistic question once and merges only the new tail", () => {
    const saved = [u("Orange chicken Friday"), a("Which meal?"), u("Dinner")];
    expect(
      mergeAskHistory(
        saved,
        [
          a("Which meal?"),
          u("Dinner"),
          a("Planned"),
          u("and its ingredients?"),
        ],
        "and its ingredients?",
      ),
    ).toEqual([...saved, a("Planned")]);
  });
  it("handles the current question persisted before the older optimistic tail arrives", () => {
    expect(
      mergeAskHistory(
        [u("Plan chicken"), a("Friday?"), u("yes")],
        [u("Plan chicken"), a("Friday?")],
        "yes",
      ),
    ).toEqual([u("Plan chicken"), a("Friday?")]);
  });
  it("does not erase repeated identical requests separated by assistant replies", () => {
    const rows = [u("Add milk"), a("Added"), u("Add milk"), a("Added")];
    expect(mergeAskHistory(rows, rows.slice(-2), "Again")).toEqual(rows);
  });
  it("keeps more than eight messages, with a fixed character and turn budget", () => {
    const rows = Array.from({ length: 40 }, (_, i) => u(`Turn ${i}`));
    expect(mergeAskHistory(rows, [], "New")).toHaveLength(24);
    expect(
      mergeAskHistory(
        Array.from({ length: 40 }, () => u("x".repeat(4000))),
        [],
        "New",
      ).reduce((n, m) => n + m.content.length, 0),
    ).toBeLessThanOrEqual(12_000);
  });
});

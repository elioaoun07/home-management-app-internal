import { describe, expect, it } from "vitest";
import {
  AI_ANSWER_KIND,
  ISSUE_REPORT_KIND,
  buildThread,
  conversationTitle,
  dayLabel,
  defaultReportKind,
  historyGroup,
  isQuiet,
  pickActiveConversation,
  reportOfferId,
  type ThreadMessage,
} from "./thread";

const NOW = new Date(2026, 9, 3, 18, 0, 0).getTime(); // Sat Oct 3 2026, 18:00 local
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();

let seq = 0;
function msg(
  role: ThreadMessage["role"],
  minutesAgo: number,
  extra: Partial<ThreadMessage> = {},
): ThreadMessage {
  seq += 1;
  return {
    id: `m${seq}`,
    role,
    content: `${role} ${seq}`,
    intent_kind: null,
    intent_face: null,
    intent_payload: null,
    created_at: at(minutesAgo),
    ...extra,
  };
}

describe("buildThread", () => {
  it("starts with a time break and groups consecutive ERA replies", () => {
    const items = buildThread(
      [msg("user", 10), msg("assistant", 10), msg("assistant", 9), msg("user", 8), msg("assistant", 8)],
      NOW,
    );
    expect(items.map((i) => i.type)).toEqual(["break", "user", "assistant", "assistant", "user", "assistant"]);
    const firsts = items.flatMap((i) => (i.type === "assistant" ? [i.first] : []));
    expect(firsts).toEqual([true, false, true]);
  });

  it("adds a break after a 30 minute gap and restarts the ERA group", () => {
    const items = buildThread([msg("assistant", 90), msg("assistant", 40)], NOW);
    expect(items.map((i) => i.type)).toEqual(["break", "assistant", "break", "assistant"]);
    expect(items.filter((i) => i.type === "assistant").every((i) => i.type === "assistant" && i.first)).toBe(true);
  });

  it("hides bookkeeping system rows but keeps a filed report", () => {
    const items = buildThread(
      [
        msg("user", 5),
        msg("system", 4, { intent_kind: "handoff_consumed" }),
        msg("system", 3, { intent_kind: ISSUE_REPORT_KIND }),
      ],
      NOW,
    );
    expect(items.map((i) => i.type)).toEqual(["break", "user", "report"]);
  });

  it("labels breaks by day", () => {
    expect(dayLabel(NOW - 60_000, NOW)).toBe("Today");
    expect(dayLabel(NOW - 24 * 3_600_000, NOW)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 8, 1, 12).getTime(), NOW)).toBe("Sep 1");
  });
});

describe("reportOfferId", () => {
  it("offers Report on a router miss", () => {
    const reply = msg("assistant", 1, { intent_kind: "unknown" });
    expect(reportOfferId([msg("user", 1, { intent_kind: "unknown" }), reply])).toBe(reply.id);
  });

  it("offers Report when Ask AI only answered in prose to a missed request", () => {
    const reply = msg("assistant", 1, { intent_kind: AI_ANSWER_KIND, intent_payload: { aiKind: "prose" } });
    expect(
      reportOfferId([msg("user", 1, { intent_kind: "clarify" }), reply]),
    ).toBe(reply.id);
  });

  it("does not offer when Ask AI proposed an action", () => {
    const reply = msg("assistant", 1, { intent_kind: AI_ANSWER_KIND, intent_payload: { aiKind: "propose_action" } });
    expect(reportOfferId([msg("user", 1, { intent_kind: "unknown" }), reply])).toBeNull();
  });

  it("offers Report on a failed or uncertain outcome", () => {
    const failed = msg("assistant", 1, { intent_kind: "draftReminder", intent_payload: { outcome: { status: "failed" } } });
    expect(reportOfferId([msg("user", 1), failed])).toBe(failed.id);
    const uncertain = msg("assistant", 1, { intent_kind: "transfer", intent_payload: { outcome: { status: "uncertain" } } });
    expect(reportOfferId([msg("user", 1), uncertain])).toBe(uncertain.id);
  });

  it("never offers on a refused negation or a successful turn", () => {
    const negated = msg("assistant", 1, { intent_kind: "clarify", intent_payload: { reason: "speechAct", act: "negated" } });
    expect(reportOfferId([msg("user", 1), negated])).toBeNull();
    const done = msg("assistant", 1, { intent_kind: "draftReminder", intent_payload: { outcome: { status: "done" } } });
    expect(reportOfferId([msg("user", 1), done])).toBeNull();
  });

  it("stops offering once the reply was reported", () => {
    const reply = msg("assistant", 2, { intent_kind: "unknown" });
    expect(
      reportOfferId([msg("user", 2), reply, msg("system", 1, { intent_kind: ISSUE_REPORT_KIND })]),
    ).toBeNull();
  });
});

describe("defaultReportKind", () => {
  it("preselects Missed for a miss and Wrong for an action that ran", () => {
    const miss = msg("assistant", 2, { intent_kind: "unknown" });
    const done = msg("assistant", 1, { intent_kind: "reminderReschedule", intent_payload: { outcome: { status: "done" } } });
    const thread = [msg("user", 2), miss, msg("user", 1), done];
    expect(defaultReportKind(thread, miss.id)).toBe("missed");
    expect(defaultReportKind(thread, done.id)).toBe("wrong");
    expect(defaultReportKind(thread, null)).toBe("wrong");
  });
});

describe("isQuiet", () => {
  it("is quiet only after 30 minutes of silence", () => {
    expect(isQuiet([msg("user", 29)], NOW)).toBe(false);
    expect(isQuiet([msg("user", 31)], NOW)).toBe(true);
    expect(isQuiet([], NOW)).toBe(false);
  });
});

describe("pickActiveConversation", () => {
  const recent = { id: "a", updated_at: at(60) };
  const older = { id: "b", updated_at: at(120) };
  const stale = { id: "c", updated_at: at(7 * 60) };

  it("automatic mode takes the most recent conversation inside 6 hours", () => {
    expect(pickActiveConversation([recent, older], undefined, NOW)?.id).toBe("a");
    expect(pickActiveConversation([stale], undefined, NOW)).toBeNull();
  });

  it("a fresh chat has no active conversation", () => {
    expect(pickActiveConversation([recent], null, NOW)).toBeNull();
  });

  it("an explicit choice wins over recency but still expires", () => {
    expect(pickActiveConversation([recent, older], "b", NOW)?.id).toBe("b");
    expect(pickActiveConversation([recent, stale], "c", NOW)).toBeNull();
    expect(pickActiveConversation([recent], "missing", NOW)).toBeNull();
  });
});

describe("conversationTitle", () => {
  it("is deterministic, tidy and bounded", () => {
    expect(conversationTitle("  add a recurring reminder on   saturday at 6 PM. ")).toBe(
      "Add a recurring reminder on saturday at 6 PM",
    );
    const long = conversationTitle("remind me to call the dentist about the appointment we moved last week");
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(49);
    expect(conversationTitle("remind me to call the dentist about the appointment we moved last week")).toBe(long);
    expect(conversationTitle("")).toBe("Untitled chat");
    expect(conversationTitle(null)).toBe("Untitled chat");
  });
});

describe("historyGroup", () => {
  it("groups by recency", () => {
    expect(historyGroup(NOW - 3_600_000, NOW)).toBe("Today");
    expect(historyGroup(NOW - 24 * 3_600_000, NOW)).toBe("Yesterday");
    expect(historyGroup(NOW - 3 * 24 * 3_600_000, NOW)).toBe("This week");
    expect(historyGroup(NOW - 10 * 24 * 3_600_000, NOW)).toBe("Earlier");
  });
});

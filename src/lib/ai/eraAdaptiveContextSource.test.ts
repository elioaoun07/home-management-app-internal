import { beforeEach, describe, expect, it, vi } from "vitest";
import type { supabaseServer } from "@/lib/supabase/server";
import { fetchAdaptiveContext } from "./eraAdaptiveContextSource";

const owner = "00000000-0000-4000-8000-000000000001";
const partner = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-10-10T12:00:00Z");
const calls: Array<{
  source: string;
  filters: Array<[string, unknown, unknown?]>;
}> = [];
const failures = new Set<string>();
const rows = new Map<string, unknown>();

function query(source: string) {
  const call = { source, filters: [] as Array<[string, unknown, unknown?]> };
  calls.push(call);
  const builder = {
    select: (_columns: string) => builder,
    eq: (field: string, value: unknown) => {
      call.filters.push(["eq", field, value]);
      return builder;
    },
    neq: (field: string, value: unknown) => {
      call.filters.push(["neq", field, value]);
      return builder;
    },
    is: (field: string, value: unknown) => {
      call.filters.push(["is", field, value]);
      return builder;
    },
    gte: (field: string, value: unknown) => {
      call.filters.push(["gte", field, value]);
      return builder;
    },
    lte: (field: string, value: unknown) => {
      call.filters.push(["lte", field, value]);
      return builder;
    },
    order: (field: string) => {
      call.filters.push(["order", field]);
      return builder;
    },
    limit: (n: number) => {
      call.filters.push(["limit", n]);
      return builder;
    },
    abortSignal: (signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return builder;
    },
    maybeSingle: () => builder,
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => {
      if (failures.has(source))
        return Promise.reject(new Error("PRIVATE_DB_DETAIL")).then(
          resolve,
          reject,
        );
      const current = call.filters.some(
        (f) => f[0] === "eq" && f[1] === "conversation_id",
      );
      return Promise.resolve({
        data: rows.get(current ? "current" : source) ?? [],
        error: null,
      }).then(resolve, reject);
    },
  };
  return builder;
}
const rpc = vi.fn((name: string, args: unknown) => {
  calls.push({ source: name, filters: [["rpc", args]] });
  return query(name);
});
const supabase = { from: query, rpc } as unknown as Awaited<
  ReturnType<typeof supabaseServer>
>;
beforeEach(() => {
  calls.length = 0;
  failures.clear();
  rows.clear();
  rpc.mockClear();
});

describe("personal context retrieval boundary", () => {
  it("queries messages and nonarchived parents by the authenticated speaker", async () => {
    await fetchAdaptiveContext(supabase, {
      owner,
      message: "What should I do?",
      conversationId: "chat",
      now,
    });
    const reads = calls.filter((c) => c.source === "era_messages");
    expect(reads).toHaveLength(2);
    for (const read of reads) {
      expect(read.filters).toContainEqual(["eq", "user_id", owner]);
      expect(read.filters).toContainEqual([
        "eq",
        "era_conversations.user_id",
        owner,
      ]);
      expect(read.filters).toContainEqual([
        "eq",
        "era_conversations.is_archived",
        false,
      ]);
    }
    expect(reads[0].filters).toContainEqual(["neq", "conversation_id", "chat"]);
    expect(reads[0].filters).toContainEqual(["limit", 400]);
    expect(reads[1].filters).toContainEqual(["limit", 32]);
    expect(
      calls.find((c) => c.source === "era_lexicon")?.filters,
    ).toContainEqual(["is", "revoked_at", null]);
    expect(calls.find((c) => c.source === "accounts")?.filters).toContainEqual([
      "eq",
      "user_id",
      owner,
    ]);
    expect(rpc).toHaveBeenCalledWith(
      "get_household_activity",
      expect.objectContaining({ p_actor: "me", p_limit: 100 }),
    );
    expect(
      calls.some((c) =>
        /household_memories|profiles|era_runs|hub_messages/.test(c.source),
      ),
    ).toBe(false);
  });
  it("does not use a partner's stale cached tail after an account switch", async () => {
    const result = await fetchAdaptiveContext(supabase, {
      owner,
      message: "Next?",
      historyOwnerId: partner,
      history: [{ role: "user", content: "PARTNER_SECRET" }],
      now,
    });
    expect(result.history).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("PARTNER_SECRET");
  });
  it("merges an owner-bound optimistic tail and saved history without system rows", async () => {
    const m = (id: string, role: string, content: string) => ({
      id,
      user_id: owner,
      conversation_id: "chat",
      role,
      content,
      created_at: now.toISOString(),
    });
    rows.set("current", [
      m("new", "user", "Next?"),
      m("system", "system", "REPORT_SECRET"),
      m("assistant", "assistant", "Planned chicken Friday"),
      m("user", "user", "Chicken Friday"),
    ]);
    const result = await fetchAdaptiveContext(supabase, {
      owner,
      message: "Next?",
      conversationId: "chat",
      historyOwnerId: owner,
      history: [
        { role: "assistant", content: "Planned chicken Friday" },
        { role: "user", content: "Next?" },
      ],
      now,
    });
    expect(result.history).toEqual([
      { role: "user", content: "Chicken Friday" },
      { role: "assistant", content: "Planned chicken Friday" },
    ]);
  });
  it("missing tables, RPC errors and timeouts are unavailable, not empty successful reads", async () => {
    for (const source of [
      "era_messages",
      "era_lexicon",
      "accounts",
      "user_preferences",
      "get_household_activity",
    ])
      failures.add(source);
    const result = await fetchAdaptiveContext(supabase, {
      owner,
      message: "Help",
      conversationId: "chat",
      historyOwnerId: owner,
      history: [{ role: "user", content: "CURRENT OWN MESSAGE" }],
      now,
    });
    expect(result.context.coverage).toEqual({
      conversations: "unavailable",
      currentConversation: "unavailable",
      choices: "unavailable",
      settings: "unavailable",
      activity: "unavailable",
      sharedMemories: "unavailable",
    });
    expect(result.history).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_DB_DETAIL");
  });
  it("refuses a mismatched activity viewer", async () => {
    rows.set("get_household_activity", {
      viewer_id: partner,
      events: [
        {
          actor_id: owner,
          owner_id: owner,
          available: true,
          module: "healthcare",
          title: "PRIVATE_DIAGNOSIS",
        },
      ],
    });
    const result = await fetchAdaptiveContext(supabase, {
      owner,
      message: "Help",
      now,
    });
    expect(result.context.usage).toEqual([]);
    expect(result.context.coverage.activity).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_DIAGNOSIS");
  });
});

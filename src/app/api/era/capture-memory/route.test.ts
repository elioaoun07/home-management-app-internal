import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

type Result = { data: unknown; error: { message: string } | null };
const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  results: {} as Record<string, Result>,
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
}));

/** A PostgREST-shaped chain: every filter returns itself; awaiting resolves the table's result. */
function query(table: string) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "or", "gte", "order", "limit"])
    chain[method] = (...args: unknown[]) => {
      mock.calls.push({ table, method, args });
      return chain;
    };
  chain.maybeSingle = async () => mock.results[table];
  chain.then = (resolve: (r: Result) => unknown) => resolve(mock.results[table]);
  return chain;
}

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: mock.getUser },
    from: (table: string) => query(table),
  })),
}));

const calledWith = (table: string, method: string) =>
  mock.calls.filter((c) => c.table === table && c.method === method).map((c) => c.args);

beforeEach(() => {
  vi.clearAllMocks();
  mock.calls.length = 0;
  mock.getUser.mockResolvedValue({ data: { user: { id: "me" } } });
  mock.results = {
    transactions: {
      data: [
        { description: "I paid $4 for coffee", amount: 4, account_id: "cash", category_id: "food", subcategory_id: "cafe", date: "2026-10-11", category: { name: "Food" }, subcategory: [{ name: "Café" }] },
        { description: "Coffee", amount: 3.5, account_id: "cash", category_id: "food", subcategory_id: "cafe", date: "2026-10-01", category: { name: "Food" }, subcategory: null },
      ],
      error: null,
    },
    items: {
      data: [{ title: "Call mom", type: "reminder", created_at: "2026-10-10T08:00:00Z" }],
      error: null,
    },
    household_links: { data: { id: "home" }, error: null },
    hub_chat_threads: { data: [{ id: "list" }], error: null },
    hub_messages: {
      data: [{ content: "Milk", thread_id: "list", shopping_group_id: "dairy", archived_at: null, checked_at: null, created_at: "2026-10-09T08:00:00Z" }],
      error: null,
    },
  };
});

describe("ERA capture memory", () => {
  it("requires a session before reading anything", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET()).status).toBe(401);
    expect(mock.calls).toHaveLength(0);
  });

  it("folds own history into recall entries, scoped to the session user", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      expenses: [
        {
          text: "Coffee",
          count: 2,
          last: "2026-10-11",
          amount: 4,
          accountId: "cash",
          categoryId: "food",
          categoryName: "Food",
          subcategoryId: "cafe",
          subcategoryName: "Café",
        },
      ],
      titles: [{ text: "Call mom", count: 1, last: "2026-10-10T08:00:00Z", type: "reminder" }],
      shopping: [{ text: "Milk", count: 1, last: "2026-10-09T08:00:00Z", threadId: "list", groupId: "dairy", open: true }],
    });
    expect(calledWith("transactions", "eq")).toEqual(
      expect.arrayContaining([["user_id", "me"], ["is_imported", false]]),
    );
    expect(calledWith("transactions", "or")).toEqual([
      ["is_draft.eq.false,category_id.not.is.null"],
    ]);
    expect(calledWith("items", "eq")).toEqual([["user_id", "me"]]);
    expect(calledWith("hub_messages", "in")).toEqual([["thread_id", ["list"]]]);
  });

  it("skips shopping when the person has no household", async () => {
    mock.results.household_links = { data: null, error: null };
    const body = await (await GET()).json();
    expect(body.shopping).toEqual([]);
    expect(calledWith("hub_messages", "in")).toEqual([]);
  });

  it("reports a failed read instead of an empty memory", async () => {
    mock.results.items = { data: null, error: { message: "boom" } };
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "boom" });
  });
});

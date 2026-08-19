import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";

type Row = Record<string, unknown>;

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  account: null as Row | null,
  candidates: [] as Row[],
  candidateQueryFilters: [] as Array<{ column: string; value: unknown }>,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({})),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: mockState.user } }),
    },
    from: (table: string) => createQuery(table),
  })),
}));

function createQuery(table: string) {
  const query = {
    select() {
      return query;
    },
    eq(column: string, value: unknown) {
      if (table === "transactions") {
        mockState.candidateQueryFilters.push({ column, value });
      }
      return query;
    },
    is(column: string, value: unknown) {
      if (table === "transactions") {
        mockState.candidateQueryFilters.push({ column, value });
      }
      return query;
    },
    gte(column: string, value: unknown) {
      if (table === "transactions") {
        mockState.candidateQueryFilters.push({ column, value });
      }
      return query;
    },
    lte(column: string, value: unknown) {
      if (table === "transactions") {
        mockState.candidateQueryFilters.push({ column, value });
      }
      return query;
    },
    async maybeSingle() {
      if (table === "accounts") {
        return { data: mockState.account, error: null };
      }
      return { data: null, error: null };
    },
    then(resolve: (value: { data?: unknown; error?: unknown }) => void) {
      if (table === "transactions") {
        resolve({ data: mockState.candidates, error: null });
        return;
      }
      resolve({ data: [], error: null });
    },
  };
  return query;
}

function request(body: Row) {
  return new Request("http://localhost/api/statement-import/reconcile", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  mockState.user = { id: "user-1" };
  mockState.account = { id: ACCOUNT_ID, currency: "EUR" };
  mockState.candidates = [];
  mockState.candidateQueryFilters = [];
});

const baseBody = {
  account_id: ACCOUNT_ID,
  statement_id: "statement-fingerprint-abc",
  rows: [
    {
      id: "row-1",
      date: "2026-08-12",
      description: "POS PURCHASE ROADSTER BEIRUT LB 3043",
      amount: 80,
      type: "debit" as const,
      statement_hash: "hash-1",
    },
  ],
};

describe("POST /api/statement-import/reconcile", () => {
  it("classifies a row against a transaction logged before the posting date", async () => {
    mockState.candidates = [
      {
        id: "tx-1",
        date: "2026-08-10",
        amount: 80,
        description: "Roadster",
        is_draft: false,
        is_debt_return: false,
        statement_hash: null,
        category_id: "cat-1",
        subcategory_id: null,
        inserted_at: "2026-08-10T18:00:00.000Z",
      },
    ];

    const response = await POST(request(baseBody));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.results).toEqual([
      expect.objectContaining({
        row_id: "row-1",
        status: "matched",
        transaction_id: "tx-1",
        date_diff: 2,
      }),
    ]);
    expect(body.summary.matched).toBe(1);
    expect(body.account_currency).toBe("EUR");
  });

  it("queries candidates over the full posting-lag window for the caller's account only", async () => {
    await POST(request(baseBody));

    expect(mockState.candidateQueryFilters).toEqual(
      expect.arrayContaining([
        { column: "user_id", value: "user-1" },
        { column: "account_id", value: ACCOUNT_ID },
        { column: "deleted_at", value: null },
        { column: "date", value: "2026-08-05" }, // posting − 7
        { column: "date", value: "2026-08-13" }, // posting + 1
      ]),
    );
  });

  it("refuses an account the caller does not own", async () => {
    mockState.account = null;

    const response = await POST(request(baseBody));

    expect(response.status).toBe(403);
    expect(mockState.candidateQueryFilters).toEqual([]);
  });

  it("requires a session", async () => {
    mockState.user = null;
    const response = await POST(request(baseBody));
    expect(response.status).toBe(401);
  });

  it("rejects malformed rows with 400", async () => {
    const response = await POST(
      request({
        ...baseBody,
        rows: [{ ...baseBody.rows[0], amount: -5 }],
      }),
    );
    expect(response.status).toBe(400);
  });
});

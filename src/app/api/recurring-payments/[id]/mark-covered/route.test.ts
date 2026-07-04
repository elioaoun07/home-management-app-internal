import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

type Row = Record<string, unknown>;

const mockState = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  recurringPayment: null as Row | null,
  transaction: null as Row | null,
  householdLink: null as Row | null,
  recurringUpdates: [] as Row[],
  updateError: null as Row | null,
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
  const state = {
    operation: "select",
    payload: undefined as unknown,
  };

  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    or() {
      return query;
    },
    update(payload: Row) {
      state.operation = "update";
      state.payload = payload;
      if (table === "recurring_payments") {
        mockState.recurringUpdates.push(payload);
      }
      return query;
    },
    async single() {
      if (table === "recurring_payments") {
        return mockState.recurringPayment
          ? { data: mockState.recurringPayment, error: null }
          : { data: null, error: { message: "not found" } };
      }
      if (table === "transactions") {
        return mockState.transaction
          ? { data: mockState.transaction, error: null }
          : { data: null, error: { message: "not found" } };
      }
      return { data: null, error: null };
    },
    async maybeSingle() {
      if (table === "household_links") {
        return { data: mockState.householdLink, error: null };
      }
      return { data: null, error: null };
    },
    then(
      resolve: (value: { data?: unknown; error?: unknown }) => void,
      _reject: (reason?: unknown) => void,
    ) {
      if (state.operation === "update") {
        resolve({ data: null, error: mockState.updateError });
        return;
      }
      resolve({ data: null, error: null });
    },
  };

  return query;
}

function request(body: Row) {
  return new Request(
    "http://localhost/api/recurring-payments/payment-1/mark-covered",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

const params = { params: Promise.resolve({ id: "payment-1" }) };

beforeEach(() => {
  mockState.user = { id: "user-1" };
  mockState.recurringPayment = {
    id: "payment-1",
    user_id: "user-1",
    account_id: "wallet",
    name: "Internet",
    amount: 35,
    recurrence_type: "monthly",
    recurrence_day: 15,
    next_due_date: "2026-07-15",
    is_private: false,
  };
  mockState.transaction = {
    id: "tx-1",
    user_id: "user-1",
    date: "2026-07-02",
    is_draft: false,
    deleted_at: null,
    amount: 35,
    description: "Internet",
    account_id: "wallet",
    category_id: "bills",
    subcategory_id: null,
  };
  mockState.householdLink = null;
  mockState.recurringUpdates = [];
  mockState.updateError = null;
});

describe("POST /api/recurring-payments/[id]/mark-covered", () => {
  it("lets the owner mark a recurring payment covered by an existing transaction", async () => {
    const response = await POST(request({ transaction_id: "tx-1" }), params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      last_processed_date: "2026-07-02",
      next_due_date: "2026-08-15",
      transaction: { id: "tx-1" },
    });
    expect(mockState.recurringUpdates).toEqual([
      {
        last_processed_date: "2026-07-02",
        next_due_date: "2026-08-15",
      },
    ]);
  });

  it("lets an active household partner mark a non-private payment covered", async () => {
    mockState.recurringPayment = {
      ...mockState.recurringPayment,
      user_id: "partner-1",
    };
    mockState.householdLink = { id: "link-1" };

    const response = await POST(request({ transaction_id: "tx-1" }), params);

    expect(response.status).toBe(200);
    expect(mockState.recurringUpdates[0]).toMatchObject({
      last_processed_date: "2026-07-02",
    });
  });

  it("blocks partner coverage for private recurring payments", async () => {
    mockState.recurringPayment = {
      ...mockState.recurringPayment,
      user_id: "partner-1",
      is_private: true,
    };
    mockState.householdLink = { id: "link-1" };

    const response = await POST(request({ transaction_id: "tx-1" }), params);

    await expect(response.json()).resolves.toEqual({ error: "Not authorized" });
    expect(response.status).toBe(403);
    expect(mockState.recurringUpdates).toEqual([]);
  });

  it("rejects draft transactions", async () => {
    mockState.transaction = { ...mockState.transaction, is_draft: true };

    const response = await POST(request({ transaction_id: "tx-1" }), params);

    expect(response.status).toBe(400);
    expect(mockState.recurringUpdates).toEqual([]);
  });

  it("rejects deleted transactions", async () => {
    mockState.transaction = {
      ...mockState.transaction,
      deleted_at: "2026-07-03T10:00:00.000Z",
    };

    const response = await POST(request({ transaction_id: "tx-1" }), params);

    expect(response.status).toBe(400);
    expect(mockState.recurringUpdates).toEqual([]);
  });
});

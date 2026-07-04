import { beforeEach, describe, expect, it, vi } from "vitest";
import { adjustAccountBalance } from "@/lib/balance";
import { POST } from "./route";

type Row = Record<string, unknown>;

const mockState = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  recurringPayment: null as Row | null,
  account: { type: "expense" } as Row | null,
  householdLink: null as Row | null,
  insertedTransactions: [] as Row[],
  recurringUpdates: [] as Row[],
  transactionInsertError: null as Row | null,
  recurringUpdateError: null as Row | null,
}));

vi.mock("@/lib/balance", () => ({
  adjustAccountBalance: vi.fn(async () => ({
    previousBalance: 100,
    newBalance: 55,
  })),
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
    table,
    operation: "select",
    payload: undefined as unknown,
    filters: [] as unknown[],
  };

  const query = {
    select() {
      return query;
    },
    eq(column: string, value: unknown) {
      state.filters.push(["eq", column, value]);
      return query;
    },
    or(value: string) {
      state.filters.push(["or", value]);
      return query;
    },
    insert(payload: Row) {
      state.operation = "insert";
      state.payload = payload;
      if (table === "transactions") {
        mockState.insertedTransactions.push(payload);
      }
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
        return mockState.transactionInsertError
          ? { data: null, error: mockState.transactionInsertError }
          : {
              data: { id: "transaction-1", ...(state.payload as Row) },
              error: null,
            };
      }

      return { data: null, error: null };
    },
    async maybeSingle() {
      if (table === "accounts") {
        return { data: mockState.account, error: null };
      }
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
        resolve({ data: null, error: mockState.recurringUpdateError });
        return;
      }
      resolve({ data: null, error: null });
    },
  };

  return query;
}

function request(body: Row) {
  return new Request("http://localhost/api/recurring-payments/payment-1", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: "payment-1" }) };

beforeEach(() => {
  mockState.user = { id: "user-1" };
  mockState.recurringPayment = {
    id: "payment-1",
    user_id: "user-1",
    account_id: "wallet",
    category_id: "category-1",
    subcategory_id: "subcategory-1",
    name: "Internet",
    amount: 45,
    description: "Fiber bill",
    lbp_change_received: 1000,
    recurrence_type: "monthly",
    recurrence_day: 31,
    next_due_date: "2026-01-31",
    is_private: false,
  };
  mockState.account = { type: "expense" };
  mockState.householdLink = null;
  mockState.insertedTransactions = [];
  mockState.recurringUpdates = [];
  mockState.transactionInsertError = null;
  mockState.recurringUpdateError = null;
  vi.mocked(adjustAccountBalance).mockClear();
});

describe("POST /api/recurring-payments/[id]", () => {
  it("creates the confirmed transaction, adjusts balance, and advances next_due_date", async () => {
    const response = await POST(
      request({
        amount: 50,
        description: "Paid manually",
        date: "2026-01-31",
        account_id: "cash",
        category_id: "category-2",
        subcategory_id: null,
        lbp_change_received: 2000,
      }),
      params,
    );

    await expect(response.json()).resolves.toMatchObject({
      transaction: { id: "transaction-1", amount: 50 },
      next_due_date: "2026-02-28",
    });
    expect(response.status).toBe(200);
    expect(mockState.insertedTransactions).toEqual([
      {
        user_id: "user-1",
        account_id: "cash",
        category_id: "category-2",
        subcategory_id: null,
        amount: 50,
        description: "Paid manually",
        date: "2026-01-31",
        lbp_change_received: 2000,
      },
    ]);
    expect(adjustAccountBalance).toHaveBeenCalledWith(
      "cash",
      -50,
      "transaction",
      {
        userId: "user-1",
        transactionId: "transaction-1",
        reason: "Recurring payment: Internet",
        effectiveDate: "2026-01-31",
      },
    );
    expect(mockState.recurringUpdates).toEqual([
      {
        next_due_date: "2026-02-28",
        last_processed_date: "2026-01-31",
      },
    ]);
  });

  it("lets an active household partner confirm a non-private payment under their own user id", async () => {
    mockState.recurringPayment = {
      ...mockState.recurringPayment,
      user_id: "partner-1",
      next_due_date: "2026-07-03",
      recurrence_type: "weekly",
      recurrence_day: 5,
    };
    mockState.householdLink = { id: "link-1" };

    const response = await POST(request({}), params);

    expect(response.status).toBe(200);
    expect(mockState.insertedTransactions[0]).toMatchObject({
      user_id: "user-1",
      account_id: "wallet",
      amount: 45,
      description: "Fiber bill",
      date: "2026-07-03",
    });
    expect(mockState.recurringUpdates[0]).toMatchObject({
      next_due_date: "2026-07-10",
      last_processed_date: "2026-07-03",
    });
  });

  it("advances stale recurring payments past the paid date", async () => {
    mockState.recurringPayment = {
      ...mockState.recurringPayment,
      next_due_date: "2026-05-01",
      recurrence_type: "monthly",
      recurrence_day: 1,
    };

    const response = await POST(request({ date: "2026-07-20" }), params);

    expect(response.status).toBe(200);
    expect(mockState.recurringUpdates[0]).toMatchObject({
      next_due_date: "2026-08-01",
      last_processed_date: "2026-07-20",
    });
  });

  it("blocks partner confirmation for private recurring payments", async () => {
    mockState.recurringPayment = {
      ...mockState.recurringPayment,
      user_id: "partner-1",
      is_private: true,
    };

    const response = await POST(request({}), params);

    await expect(response.json()).resolves.toEqual({ error: "Not authorized" });
    expect(response.status).toBe(403);
    expect(mockState.insertedTransactions).toEqual([]);
    expect(adjustAccountBalance).not.toHaveBeenCalled();
  });
});

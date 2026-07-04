import { beforeEach, describe, expect, it, vi } from "vitest";
import { adjustAccountBalance, computeAccountBalance } from "./balance";

type TableData = Record<string, unknown>;

const mockDb = vi.hoisted(() => ({
  balanceRow: null as TableData | null,
  lastAnchor: null as TableData | null,
  transactions: [] as TableData[],
  transferOut: [] as TableData[],
  transferIn: [] as TableData[],
  splitTransactions: [] as TableData[],
  insertedRows: [] as Array<{ table: string; payload: unknown }>,
  updatedRows: [] as Array<{
    table: string;
    payload: unknown;
    filters: unknown[];
  }>,
  failBalanceUpdate: false,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => createQuery(table),
  }),
}));

function createQuery(table: string) {
  const state = {
    table,
    filters: [] as unknown[],
    selected: "",
    operation: "select",
    payload: undefined as unknown,
  };

  const query = {
    select(columns?: string) {
      state.selected = columns ?? "";
      return query;
    },
    eq(column: string, value: unknown) {
      state.filters.push(["eq", column, value]);
      return query;
    },
    is(column: string, value: unknown) {
      state.filters.push(["is", column, value]);
      return query;
    },
    gt(column: string, value: unknown) {
      state.filters.push(["gt", column, value]);
      return query;
    },
    not(column: string, operator: string, value: unknown) {
      state.filters.push(["not", column, operator, value]);
      return query;
    },
    in(column: string, value: unknown) {
      state.filters.push(["in", column, value]);
      return query;
    },
    order() {
      return query;
    },
    limit() {
      return query;
    },
    insert(payload: unknown) {
      state.operation = "insert";
      state.payload = payload;
      mockDb.insertedRows.push({ table, payload });
      return query;
    },
    update(payload: unknown) {
      state.operation = "update";
      state.payload = payload;
      mockDb.updatedRows.push({ table, payload, filters: state.filters });
      return query;
    },
    async maybeSingle() {
      return resolveMaybeSingle(state);
    },
    then(
      resolve: (value: { data?: TableData[] | null; error?: unknown }) => void,
    ) {
      resolve(resolveList(state));
    },
  };

  return query;
}

function resolveMaybeSingle(state: {
  table: string;
  selected: string;
  operation: string;
}) {
  if (state.table === "account_balances" && state.operation === "select") {
    return Promise.resolve({ data: mockDb.balanceRow, error: null });
  }
  if (
    state.table === "account_balance_history" &&
    state.selected === "new_balance"
  ) {
    return Promise.resolve({ data: mockDb.lastAnchor, error: null });
  }

  return Promise.resolve({ data: null, error: null });
}

function resolveList(state: {
  table: string;
  filters: unknown[];
  operation: string;
}) {
  if (state.operation === "update") {
    return {
      data: null,
      error:
        state.table === "account_balances" && mockDb.failBalanceUpdate
          ? { message: "update failed" }
          : null,
    };
  }

  if (state.table === "transactions") {
    if (hasFilter(state.filters, "eq", "account_id")) {
      return { data: mockDb.transactions, error: null };
    }
    if (hasFilter(state.filters, "eq", "collaborator_account_id")) {
      return { data: mockDb.splitTransactions, error: null };
    }
  }

  if (state.table === "transfers") {
    if (hasFilter(state.filters, "eq", "from_account_id")) {
      return { data: mockDb.transferOut, error: null };
    }
    if (hasFilter(state.filters, "eq", "to_account_id")) {
      return { data: mockDb.transferIn, error: null };
    }
  }

  return { data: [], error: null };
}

function hasFilter(filters: unknown[], kind: string, column: string) {
  return filters.some(
    (filter) =>
      Array.isArray(filter) && filter[0] === kind && filter[1] === column,
  );
}

beforeEach(() => {
  mockDb.balanceRow = null;
  mockDb.lastAnchor = null;
  mockDb.transactions = [];
  mockDb.transferOut = [];
  mockDb.transferIn = [];
  mockDb.splitTransactions = [];
  mockDb.insertedRows = [];
  mockDb.updatedRows = [];
  mockDb.failBalanceUpdate = false;
});

describe("computeAccountBalance", () => {
  it("combines the manual anchor with transaction, transfer, and split impacts", async () => {
    mockDb.balanceRow = {
      balance: 999,
      balance_set_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-10T00:00:00.000Z",
      created_at: "2026-05-01T00:00:00.000Z",
    };
    mockDb.lastAnchor = { new_balance: 450 };
    mockDb.transactions = [
      { amount: 100, is_debt_return: false },
      { amount: 30, is_debt_return: true },
    ];
    mockDb.transferOut = [
      { amount: 40, returned_amount: 0, transfer_type: "self" },
    ];
    mockDb.transferIn = [
      { amount: 200, returned_amount: 50, transfer_type: "household" },
    ];
    mockDb.splitTransactions = [{ collaborator_amount: 25 }];

    const result = await computeAccountBalance("account-1", "expense");

    expect(result).toEqual({
      computedBalance: 465,
      anchorBalance: 450,
      balanceSetAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
      createdAt: "2026-05-01T00:00:00.000Z",
    });
  });

  it("uses the manual anchor for positive-balance account types", async () => {
    mockDb.balanceRow = { balance: 1000, balance_set_at: null };
    mockDb.lastAnchor = { new_balance: 1000 };
    mockDb.transactions = [
      { amount: 250, is_debt_return: false },
      { amount: 40, is_debt_return: true },
    ];

    await expect(
      computeAccountBalance("income-1", "income"),
    ).resolves.toMatchObject({
      computedBalance: 1290,
      anchorBalance: 1000,
    });

    await expect(
      computeAccountBalance("saving-1", "saving"),
    ).resolves.toMatchObject({
      computedBalance: 1290,
      anchorBalance: 1000,
    });
  });

  it("does not treat an unchecked stored balance as the recompute anchor", async () => {
    mockDb.balanceRow = { balance: 30800, balance_set_at: null };
    mockDb.transactions = [{ amount: 125, is_debt_return: false }];
    mockDb.transferIn = [{ amount: 500, returned_amount: 0, transfer_type: "self" }];

    await expect(
      computeAccountBalance("drawer-account", "expense"),
    ).resolves.toMatchObject({
      computedBalance: 375,
      anchorBalance: 0,
    });
  });

  it("returns an empty zero balance shape when no balance row exists", async () => {
    await expect(computeAccountBalance("missing", "expense")).resolves.toEqual({
      computedBalance: 0,
      anchorBalance: 0,
      balanceSetAt: null,
      updatedAt: null,
      createdAt: null,
    });
  });
});

describe("adjustAccountBalance", () => {
  it("updates stored balance and writes audit history with the supplied effective date", async () => {
    mockDb.balanceRow = { balance: 125 };

    await expect(
      adjustAccountBalance("account-1", -35, "transaction", {
        userId: "user-1",
        transactionId: "transaction-1",
        reason: "Recurring payment: Internet",
        effectiveDate: "2026-07-03",
      }),
    ).resolves.toEqual({ previousBalance: 125, newBalance: 90 });

    expect(mockDb.updatedRows).toContainEqual(
      expect.objectContaining({
        table: "account_balances",
        payload: expect.objectContaining({ balance: 90 }),
      }),
    );
    expect(mockDb.insertedRows).toContainEqual({
      table: "account_balance_history",
      payload: expect.objectContaining({
        account_id: "account-1",
        user_id: "user-1",
        previous_balance: 125,
        new_balance: 90,
        change_amount: -35,
        change_type: "transaction",
        transaction_id: "transaction-1",
        reason: "Recurring payment: Internet",
        effective_date: "2026-07-03",
      }),
    });
  });

  it("returns the previous balance when the atomic balance update fails", async () => {
    mockDb.balanceRow = { balance: 125 };
    mockDb.failBalanceUpdate = true;

    await expect(
      adjustAccountBalance("account-1", -35, "transaction", {
        userId: "user-1",
      }),
    ).resolves.toEqual({ previousBalance: 125, newBalance: 125 });
  });
});

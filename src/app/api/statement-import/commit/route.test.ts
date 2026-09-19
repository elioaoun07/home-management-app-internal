import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";

type Row = Record<string, unknown>;

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const FOREIGN_ACCOUNT = "99999999-9999-4999-8999-999999999999";
const CAT_FOOD = "22222222-2222-4222-8222-222222222222";
const SUB_FOOD = "33333333-3333-4333-8333-333333333333";
const TX_MATCHED = "44444444-4444-4444-8444-444444444444";
const TX_DRAFT = "55555555-5555-4555-8555-555555555555";
const IMPORT_ID = "66666666-6666-4666-8666-666666666666";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  accounts: [] as Row[],
  categories: [] as Row[],
  /** id → row returned by the single-row reads (stamp / confirm targets) */
  transactionsById: new Map<string, Row | null>(),
  batchInsertError: null as { code?: string; message?: string } | null,
  perRowInsertErrors: new Map<string, { code?: string; message?: string }>(),
  inserted: [] as Row[],
  updates: [] as Array<{ id: string; payload: Row; guards: Row }>,
  /** Simulates the guard failing (another run already claimed the row). */
  updateReturnsNothing: new Set<string>(),
  balanceCalls: [] as Array<{ accountId: string; delta: number; changeType: string }>,
  mappingUpserts: [] as Row[],
  /** Rows written to statement_import_entries — the revert ledger. */
  ledger: [] as Row[],
  /** Patches applied to the statement_imports record. */
  importUpdates: [] as Row[],
  /** Simulates the ledger table being missing (migration not run yet). */
  ledgerError: null as { message?: string } | null,
  /** Simulates statement_imports being unwritable. */
  importRecordError: null as { message?: string } | null,
  /** Partner accounts they made public — writable, but not the caller's rows. */
  sharedAccounts: [] as Row[],
}));

vi.mock("@/lib/accountAccess", () => ({
  listWritableAccounts: vi.fn(async () => [
    ...mockState.accounts,
    ...mockState.sharedAccounts,
  ]),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockState.user } }) },
    from: (table: string) => createQuery(table),
  })),
}));

vi.mock("@/lib/balance", () => ({
  adjustAccountBalance: vi.fn(
    async (accountId: string, delta: number, changeType: string) => {
      mockState.balanceCalls.push({ accountId, delta, changeType });
    },
  ),
}));

function createQuery(table: string) {
  const state = {
    operation: "select" as "select" | "insert" | "update" | "upsert",
    payload: undefined as Row | Row[] | undefined,
    guards: {} as Row,
  };

  const query = {
    select() {
      return query;
    },
    eq(column: string, value: unknown) {
      state.guards[column] = value;
      return query;
    },
    is(column: string, value: unknown) {
      state.guards[column] = value;
      return query;
    },
    in(_column: string, _values: unknown[]) {
      return query;
    },
    insert(payload: Row | Row[]) {
      state.operation = "insert";
      state.payload = payload;
      return query;
    },
    update(payload: Row) {
      state.operation = "update";
      state.payload = payload;
      return query;
    },
    upsert(payload: Row | Row[]) {
      state.operation = "upsert";
      state.payload = payload;
      if (table === "merchant_mappings") mockState.mappingUpserts.push(payload as Row);
      if (table === "statement_import_entries") {
        mockState.ledger.push(...(Array.isArray(payload) ? payload : [payload]));
      }
      return query;
    },
    async single() {
      return resolveWrite();
    },
    async maybeSingle() {
      if (state.operation === "select") {
        if (table === "accounts") {
          const id = state.guards.id as string;
          return { data: mockState.accounts.find((a) => a.id === id) ?? null, error: null };
        }
        if (table === "transactions") {
          const id = state.guards.id as string;
          const row = mockState.transactionsById.get(id) ?? null;
          // The confirm path filters on is_draft = true.
          if (row && state.guards.is_draft === true && !row.is_draft) {
            return { data: null, error: null };
          }
          return { data: row, error: null };
        }
        return { data: null, error: null };
      }
      return resolveWrite();
    },
    then(resolve: (value: { data?: unknown; error?: unknown }) => void) {
      if (state.operation === "select") {
        if (table === "accounts") {
          resolve({ data: mockState.accounts, error: null });
          return;
        }
        if (table === "user_categories") {
          resolve({ data: mockState.categories, error: null });
          return;
        }
        resolve({ data: [], error: null });
        return;
      }
      resolve(resolveWriteSync());
    },
  };

  function resolveWriteSync() {
    if (state.operation === "insert" && table === "transactions") {
      const rows = Array.isArray(state.payload) ? state.payload : [state.payload!];
      if (Array.isArray(state.payload) && mockState.batchInsertError) {
        return { data: null, error: mockState.batchInsertError };
      }
      const single = !Array.isArray(state.payload) ? rows[0] : null;
      if (single) {
        const err = mockState.perRowInsertErrors.get(
          String(single.statement_hash),
        );
        if (err) return { data: null, error: err };
      }
      const stored = rows.map((r, i) => ({
        id: `new-tx-${mockState.inserted.length + i + 1}`,
        ...r,
      }));
      mockState.inserted.push(...stored);
      return { data: Array.isArray(state.payload) ? stored : stored[0], error: null };
    }

    if (state.operation === "insert" && table === "statement_imports") {
      if (mockState.importRecordError) {
        return { data: null, error: mockState.importRecordError };
      }
      return { data: { id: IMPORT_ID }, error: null };
    }

    if (state.operation === "upsert" && table === "statement_import_entries") {
      if (mockState.ledgerError) return { data: null, error: mockState.ledgerError };
      return { data: null, error: null };
    }

    if (state.operation === "update" && table === "statement_imports") {
      mockState.importUpdates.push(state.payload as Row);
      return { data: null, error: null };
    }

    if (state.operation === "update" && table === "transactions") {
      const id = String(state.guards.id);
      mockState.updates.push({ id, payload: state.payload as Row, guards: { ...state.guards } });
      if (mockState.updateReturnsNothing.has(id)) return { data: null, error: null };
      return { data: { id }, error: null };
    }

    return { data: null, error: null };
  }

  async function resolveWrite() {
    return resolveWriteSync();
  }

  return query;
}

function request(body: Row) {
  return new Request("http://localhost/api/statement-import/commit", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  mockState.user = { id: "user-1" };
  mockState.accounts = [{ id: ACCOUNT_ID, type: "expense" }];
  mockState.sharedAccounts = [];
  mockState.categories = [
    { id: CAT_FOOD, account_id: ACCOUNT_ID, parent_id: null },
    { id: SUB_FOOD, account_id: ACCOUNT_ID, parent_id: CAT_FOOD },
  ];
  mockState.transactionsById = new Map<string, Row | null>([
    [
      TX_MATCHED,
      {
        id: TX_MATCHED,
        amount: 80,
        account_id: ACCOUNT_ID,
        is_debt_return: false,
        statement_hash: null,
        is_draft: false,
      },
    ],
    [
      TX_DRAFT,
      {
        id: TX_DRAFT,
        amount: 12.75,
        account_id: ACCOUNT_ID,
        category_id: CAT_FOOD,
        subcategory_id: null,
        is_debt_return: false,
        is_draft: true,
      },
    ],
  ]);
  mockState.batchInsertError = null;
  mockState.perRowInsertErrors = new Map();
  mockState.inserted = [];
  mockState.updates = [];
  mockState.updateReturnsNothing = new Set();
  mockState.balanceCalls = [];
  mockState.mappingUpserts = [];
  mockState.ledger = [];
  mockState.importUpdates = [];
  mockState.ledgerError = null;
  mockState.importRecordError = null;
});

const worked = {
  statement_id: "statement-fingerprint-abc",
  file_name: "july-eur.pdf",
  account_id: ACCOUNT_ID,
  actions: [
    {
      kind: "create" as const,
      row_id: "r-spinneys",
      date: "2026-08-12",
      description: "POS PURCHASE SPINNEYS",
      amount: 45.5,
      direction: "debit" as const,
      account_id: ACCOUNT_ID,
      category_id: CAT_FOOD,
      subcategory_id: SUB_FOOD,
      statement_hash: "hash-spinneys",
      learn_mapping: { pattern: "spinneys", name: "Spinneys" },
    },
    {
      kind: "stamp" as const,
      row_id: "r-roadster",
      transaction_id: TX_MATCHED,
      statement_hash: "hash-roadster",
    },
    {
      kind: "create" as const,
      row_id: "r-refund",
      date: "2026-08-13",
      description: "REVERSE TRANSACTION",
      amount: 20,
      direction: "credit" as const,
      account_id: ACCOUNT_ID,
      category_id: null,
      subcategory_id: null,
      statement_hash: "hash-refund",
    },
    {
      kind: "confirm_draft" as const,
      row_id: "r-taxi",
      transaction_id: TX_DRAFT,
      statement_hash: "hash-taxi",
    },
  ],
};

describe("POST /api/statement-import/commit", () => {
  // Money-rules worked example — expense account at $1,000 which ALREADY
  // includes the −$80 Roadster tap the user logged on 08-10:
  //   create  45.50 debit  → −45.50
  //   stamp   80.00 match  →   0     (already in the balance)
  //   create  20.00 credit → +20.00  (refund adds money back)
  //   confirm 12.75 draft  → −12.75  (drafts were never counted)
  //   net −38.25 → 1000 → 961.75
  it("applies each action's balance effect exactly once", async () => {
    const response = await POST(request(worked));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      created: 2,
      stamped: 1,
      drafts_confirmed: 1,
      skipped: 0,
      errors: 0,
    });

    expect(mockState.balanceCalls).toEqual([
      { accountId: ACCOUNT_ID, delta: -38.25, changeType: "statement_import" },
    ]);
  });

  it("stamps the matched transaction without touching its amount or date", async () => {
    await POST(request(worked));

    const stamp = mockState.updates.find((u) => u.id === TX_MATCHED)!;
    expect(stamp.payload).toEqual({ statement_hash: "hash-roadster" });
    // Idempotency guard: only claims a row that has no hash yet.
    expect(stamp.guards).toMatchObject({ statement_hash: null, user_id: "user-1" });
  });

  it("stores an imported refund as a positive is_debt_return row", async () => {
    await POST(request(worked));

    const refund = mockState.inserted.find(
      (r) => r.statement_hash === "hash-refund",
    )!;
    expect(refund).toMatchObject({
      amount: 20,
      is_debt_return: true,
      is_imported: true,
      is_draft: false,
    });
  });

  it("is balance-neutral when the same commit is retried", async () => {
    // Re-running: creates hit the unique index, the stamp target already has a
    // hash, and the draft is no longer a draft.
    mockState.batchInsertError = { code: "23505", message: "duplicate key" };
    mockState.perRowInsertErrors = new Map([
      ["hash-spinneys", { code: "23505", message: "duplicate key" }],
      ["hash-refund", { code: "23505", message: "duplicate key" }],
    ]);
    mockState.transactionsById.set(TX_MATCHED, {
      id: TX_MATCHED,
      amount: 80,
      account_id: ACCOUNT_ID,
      is_debt_return: false,
      statement_hash: "hash-roadster", // claimed by the first run
      is_draft: false,
    });
    mockState.transactionsById.set(TX_DRAFT, {
      id: TX_DRAFT,
      amount: 12.75,
      account_id: ACCOUNT_ID,
      is_debt_return: false,
      is_draft: false, // confirmed by the first run
    });

    const response = await POST(request(worked));
    const body = await response.json();

    expect(body).toMatchObject({ created: 0, stamped: 0, drafts_confirmed: 0, skipped: 4 });
    expect(mockState.balanceCalls).toEqual([]);
  });

  it("accepting the bank's amount reverses the old amount and applies the new one", async () => {
    const response = await POST(
      request({
        ...worked,
        actions: [
          {
            kind: "stamp",
            row_id: "r-roadster",
            transaction_id: TX_MATCHED,
            statement_hash: "hash-roadster",
            accept_amount: 83.6, // tip added after the tap
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    // expense account: reverse +80, apply −83.60 → −3.60
    expect(mockState.balanceCalls[0].delta).toBeCloseTo(-3.6, 10);
    const stamp = mockState.updates.find((u) => u.id === TX_MATCHED)!;
    expect(stamp.payload).toMatchObject({ amount: 83.6 });
  });

  it("treats a stamp whose guard matched nothing as a skip, not a write", async () => {
    mockState.updateReturnsNothing.add(TX_MATCHED);

    const response = await POST(
      request({
        ...worked,
        actions: [
          {
            kind: "stamp",
            row_id: "r-roadster",
            transaction_id: TX_MATCHED,
            statement_hash: "hash-roadster",
            accept_amount: 83.6,
          },
        ],
      }),
    );

    const body = await response.json();
    expect(body).toMatchObject({ stamped: 0, skipped: 1 });
    expect(mockState.balanceCalls).toEqual([]);
  });

  it("refuses a commit touching an account the caller does not own", async () => {
    const response = await POST(
      request({
        ...worked,
        actions: [{ ...worked.actions[0], account_id: FOREIGN_ACCOUNT }],
      }),
    );

    expect(response.status).toBe(403);
    expect(mockState.inserted).toEqual([]);
    expect(mockState.balanceCalls).toEqual([]);
  });

  it("writes into a partner's public account as the importer's own row", async () => {
    const SHARED_ID = "77777777-7777-4777-8777-777777777777";
    const SHARED_CAT = "88888888-8888-4888-8888-888888888888";
    mockState.sharedAccounts = [{ id: SHARED_ID, user_id: "partner-1", type: "expense" }];
    // The shared account's categories belong to its owner, not the importer.
    mockState.categories = [{ id: SHARED_CAT, account_id: SHARED_ID, parent_id: null }];

    const response = await POST(
      request({
        ...worked,
        account_id: SHARED_ID,
        actions: [
          {
            ...worked.actions[0],
            account_id: SHARED_ID,
            category_id: SHARED_CAT,
            subcategory_id: null,
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(mockState.inserted).toEqual([
      expect.objectContaining({ account_id: SHARED_ID, user_id: "user-1", category_id: SHARED_CAT }),
    ]);
    expect(mockState.balanceCalls).toEqual([
      { accountId: SHARED_ID, delta: -45.5, changeType: "statement_import" },
    ]);
  });

  it("rejects a category from another account per-row without failing the batch", async () => {
    mockState.categories = [
      { id: CAT_FOOD, account_id: FOREIGN_ACCOUNT, parent_id: null },
    ];

    const response = await POST(
      request({
        ...worked,
        actions: [
          { ...worked.actions[0], subcategory_id: null },
          worked.actions[2],
        ],
      }),
    );

    const body = await response.json();
    expect(body.created).toBe(1); // the refund still lands
    expect(body.errors).toBe(1);
    expect(body.results).toEqual(
      expect.arrayContaining([
        {
          row_id: "r-spinneys",
          status: "error",
          error: "Category belongs to a different account",
        },
      ]),
    );
    expect(mockState.balanceCalls).toEqual([
      { accountId: ACCOUNT_ID, delta: 20, changeType: "statement_import" },
    ]);
  });

  it("learns a merchant mapping only for rows that were actually created", async () => {
    await POST(request(worked));

    expect(mockState.mappingUpserts).toEqual([
      expect.objectContaining({
        merchant_pattern: "SPINNEYS",
        merchant_name: "Spinneys",
        category_id: CAT_FOOD,
      }),
    ]);
  });

  it("requires a session", async () => {
    mockState.user = null;
    const response = await POST(request(worked));
    expect(response.status).toBe(401);
  });

  // ── Reversibility ────────────────────────────────────────────────────────

  it("records one revert-ledger entry per transaction it touched", async () => {
    await POST(request(worked));

    expect(mockState.ledger).toHaveLength(4);
    const byRow = new Map(mockState.ledger.map((e) => [e.row_id, e]));

    // A created row: nothing to restore, everything to remove.
    expect(byRow.get("r-spinneys")).toMatchObject({
      import_id: IMPORT_ID,
      action: "create",
      account_id: ACCOUNT_ID,
      statement_hash: "hash-spinneys",
      applied_delta: -45.5,
      previous: {},
      applied: { amount: 45.5, is_debt_return: false },
    });

    // A stamp: balance-neutral, and the prior unhashed state is what a revert
    // walks back to.
    expect(byRow.get("r-roadster")).toMatchObject({
      action: "stamp",
      transaction_id: TX_MATCHED,
      applied_delta: 0,
      previous: { amount: 80, statement_hash: null },
      applied: { amount: 80, statement_hash: "hash-roadster" },
    });

    // A confirmed draft: the whole pre-confirmation state is captured.
    expect(byRow.get("r-taxi")).toMatchObject({
      action: "confirm_draft",
      transaction_id: TX_DRAFT,
      applied_delta: -12.75,
      previous: { amount: 12.75, is_draft: true, statement_hash: null },
      applied: { amount: 12.75, is_draft: false, statement_hash: "hash-taxi" },
    });
  });

  it("closes the import record with the counts the history list reads", async () => {
    await POST(request(worked));

    const closed = mockState.importUpdates.at(-1)!;
    expect(closed).toMatchObject({
      status: "completed",
      created_count: 2,
      stamped_count: 1,
      drafts_confirmed_count: 1,
      skipped_count: 0,
      error_count: 0,
      transactions_count: 4,
      balance_deltas: { [ACCOUNT_ID]: -38.25 },
    });
  });

  it("snapshots the merchant mapping it overwrites, so a revert can restore it", async () => {
    await POST(request(worked));

    const closed = mockState.importUpdates.at(-1)!;
    expect(closed.learned_mappings).toEqual([
      {
        pattern: "SPINNEYS",
        applied: expect.objectContaining({ category_id: CAT_FOOD }),
        // Nothing was there before → the revert deletes rather than restores.
        previous: null,
      },
    ]);
  });

  it("writes nothing at all when the import record cannot be opened", async () => {
    // e.g. the rollback migration has not been run yet. An unrevertible bulk
    // write is worse than a failed one.
    mockState.importRecordError = { message: 'relation "statement_imports" ...' };

    const response = await POST(request(worked));

    expect(response.status).toBe(503);
    expect(mockState.inserted).toHaveLength(0);
    expect(mockState.updates).toHaveLength(0);
    expect(mockState.balanceCalls).toHaveLength(0);
  });

  it("does not move money when the ledger cannot be written", async () => {
    mockState.ledgerError = { message: 'relation "statement_import_entries" ...' };

    const response = await POST(request(worked));

    expect(response.status).toBe(503);
    // Rows were inserted before the ledger failed, but no balance moved and the
    // import is marked failed rather than left looking complete.
    expect(mockState.balanceCalls).toHaveLength(0);
    expect(mockState.importUpdates.at(-1)).toMatchObject({ status: "failed" });
  });
});

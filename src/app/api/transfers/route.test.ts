// BUD-87 regression (2026-10-28): one transfer was inserted twice 8.46 s apart —
// the client's 8 s timeout fired, the form was resubmitted, the server had no
// way to tell. Then deleting the duplicate reversed balance legs that had not
// all landed, and the net balance change was zero.
//
// WORKED EXAMPLE (self transfer 20 USD, Wallet 100 → Savings 50)
//   POST id=X            → one row; legs −20 / +20      → Wallet 80, Savings 70
//   POST id=X (retry)    → same row back; no legs       → Wallet 80, Savings 70
//   DELETE X             → reversal +20 / −20           → Wallet 100, Savings 50
//   DELETE X (retry)     → no-op                        → Wallet 100, Savings 50
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { DELETE, PATCH } from "./[id]/route";

type Row = Record<string, unknown>;

const db = vi.hoisted(() => ({
  transfers: new Map<string, Record<string, unknown>>(),
  clock: 0,
}));

const adjust = vi.hoisted(() => vi.fn(async () => ({ newBalance: 0, previousBalance: 0 })));

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/balance", () => ({ adjustAccountBalance: adjust }));
vi.mock("@/lib/accountAccess", () => ({
  getAccessibleAccount: vi.fn(async (_s: unknown, userId: string, id: string) => ({
    id,
    name: id,
    type: "expense",
    user_id: userId,
    currency: "USD",
    canWrite: true,
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => transfersQuery(),
  })),
}));

/** Just enough of PostgREST over an in-memory `transfers` table. */
function transfersQuery() {
  const state = {
    op: "select" as "select" | "insert" | "update",
    payload: {} as Row,
    filters: [] as Array<[string, string, unknown]>,
  };
  const matches = (row: Row) =>
    state.filters.every(([kind, column, value]) =>
      kind === "eq" ? row[column] === value : (row[column] ?? null) === value,
    );
  const run = (): { data: Row[] | null; error: Row | null } => {
    if (state.op === "insert") {
      const id = (state.payload.id as string | undefined) ?? crypto.randomUUID();
      if (db.transfers.has(id)) {
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      const stamp = `t${++db.clock}`;
      const row = { ...state.payload, id, deleted_at: null, created_at: stamp, updated_at: stamp };
      db.transfers.set(id, row);
      return { data: [{ ...row }], error: null };
    }
    const hits = [...db.transfers.values()].filter(matches);
    if (state.op === "update") hits.forEach((row) => Object.assign(row, state.payload));
    return { data: hits.map((row) => ({ ...row })), error: null };
  };
  const query = {
    select: () => query,
    insert(payload: Row) {
      state.op = "insert";
      state.payload = payload;
      return query;
    },
    update(payload: Row) {
      state.op = "update";
      state.payload = payload;
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
    async single() {
      const { data, error } = run();
      if (error) return { data: null, error };
      return data?.[0] ? { data: data[0], error: null } : { data: null, error: { code: "PGRST116" } };
    },
    async maybeSingle() {
      const { data, error } = run();
      return { data: data?.[0] ?? null, error };
    },
    then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
      return Promise.resolve(run()).then(resolve, reject);
    },
  };
  return query;
}

const ID = "7d1c6a52-6b0e-4a43-9a51-0d1d7a1e3c11";
const WALLET = "11111111-1111-4111-8111-111111111111";
const SAVINGS = "22222222-2222-4222-8222-222222222222";
const create = { id: ID, from_account_id: WALLET, to_account_id: SAVINGS, amount: 20, date: "2026-10-28" };

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/transfers", { method: "POST", body: JSON.stringify(body) }));
const del = (id: string) =>
  DELETE(new NextRequest(`http://localhost/api/transfers/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
const patch = (id: string, body: unknown) =>
  PATCH(new NextRequest(`http://localhost/api/transfers/${id}`, { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });

/** [accountId, delta, changeType] for every leg that moved money. */
const moved = () =>
  (adjust.mock.calls as unknown as Array<[string, number, string]>)
    .filter(([, delta]) => delta !== 0)
    .map(([account, delta, type]) => [account, delta, type]);

beforeEach(() => {
  db.transfers.clear();
  db.clock = 0;
  adjust.mockClear();
});

describe("POST /api/transfers — client id makes a retry safe", () => {
  it("answers a same-id retry with the committed row and moves no more money", async () => {
    const first = await post(create);
    expect(first.status).toBe(200);
    expect(moved()).toEqual([
      [WALLET, -20, "transfer_out"],
      [SAVINGS, 20, "transfer_in"],
    ]);

    const retry = await post(create);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ id: ID, amount: 20 });
    expect(db.transfers.size).toBe(1);
    expect(moved()).toHaveLength(2);
  });

  it("refuses the same id with a different payload", async () => {
    await post(create);
    const res = await post({ ...create, amount: 25 });
    expect(res.status).toBe(409);
    expect(moved()).toHaveLength(2);
  });

  it("refuses to resurrect a transfer the user already undid", async () => {
    await post(create);
    await del(ID);
    const res = await post(create);
    expect(res.status).toBe(409);
    expect(db.transfers.size).toBe(1);
  });

  it("still creates without an id (legacy callers)", async () => {
    const { id: _ignored, ...legacy } = create;
    void _ignored;
    expect((await post(legacy)).status).toBe(200);
    expect((await post(legacy)).status).toBe(200);
    expect(db.transfers.size).toBe(2);
  });
});

describe("DELETE /api/transfers/[id] — reverses exactly once", () => {
  it("a second delete is a no-op, not a second reversal", async () => {
    await post(create);
    adjust.mockClear();

    expect((await del(ID)).status).toBe(200);
    const again = await del(ID);
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ alreadyDeleted: true });

    expect(moved()).toEqual([
      [WALLET, 20, "transfer_deleted"],
      [SAVINGS, -20, "transfer_deleted"],
    ]);
  });
});

describe("PATCH /api/transfers/[id] — absolute values, so a replay moves nothing", () => {
  it("applies 20 → 30 once even when the request is sent twice", async () => {
    await post(create);
    adjust.mockClear();

    expect((await patch(ID, { amount: 30 })).status).toBe(200);
    expect((await patch(ID, { amount: 30 })).status).toBe(200);

    expect(moved()).toEqual([
      [WALLET, -10, "transfer_updated"],
      [SAVINGS, 10, "transfer_updated"],
    ]);
  });

  it("rejects an invalid body before touching anything", async () => {
    await post(create);
    adjust.mockClear();

    expect((await patch(ID, { amount: -5 })).status).toBe(400);
    expect(adjust).not.toHaveBeenCalled();
  });
});

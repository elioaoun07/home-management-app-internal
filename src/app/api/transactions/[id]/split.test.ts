import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { adjustAccountBalance } from "@/lib/balance";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  user: { id: "owner" } as { id: string } | null,
  transaction: null as Row | null,
  partner: "11111111-1111-4111-8111-111111111111" as string | null,
  race: false,
  notificationError: false,
  existingNotification: true,
  operations: [] as { table: string; admin: boolean; payload: Row; filters: Row }[],
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/balance", () => ({ adjustAccountBalance: vi.fn() }));
vi.mock("@/lib/accountAccess", () => ({
  getAccessibleAccount: vi.fn(),
  getActiveHouseholdPartnerId: vi.fn(async () => state.partner),
}));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn(async () => ({
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from: (table: string) => query(table, false),
})) }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: vi.fn(() => ({
  from: (table: string) => query(table, true),
})) }));

function query(table: string, admin: boolean) {
  let payload: Row | undefined;
  const filters: Row = {};
  const result = () => {
    if (payload) {
      state.operations.push({ table, admin, payload, filters });
      if (table === "notifications") return { data: null, error: state.notificationError ? { message: "offline" } : null };
      if (state.race) return { data: null, error: null };
      state.transaction = { ...state.transaction, ...payload };
      return { data: state.transaction, error: null };
    }
    return { data: table === "notifications" ? (state.existingNotification ? { id: "notification" } : null) :
      state.transaction?.user_id === filters.user_id ? state.transaction : null, error: null };
  };
  const chain = {
    select: () => chain,
    eq: (key: string, value: unknown) => { filters[key] = value; return chain; },
    is: (key: string, value: unknown) => { filters[key] = value; return chain; },
    order: () => chain,
    limit: () => chain,
    update: (value: Row) => { payload = value; return chain; },
    insert: (value: Row) => { payload = value; return chain; },
    maybeSingle: async () => result(),
    then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return chain;
}

async function patch(body: Row) {
  return PATCH(new NextRequest("http://localhost/api/transactions/tx", {
    method: "PATCH", body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: "tx" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "owner" };
  state.partner = "11111111-1111-4111-8111-111111111111";
  state.transaction = { id: "tx", user_id: "owner", amount: 30, account_id: "wallet", split_requested: true,
    split_completed_at: null, collaborator_id: state.partner, collaborator_amount: 10 };
  state.race = false;
  state.notificationError = false;
  state.existingNotification = true;
  state.operations = [];
});

describe("transaction Split toggle", () => {
  it("clears only split fields, scopes dismissal to the former collaborator, and moves no money", async () => {
    expect((await patch({ split_requested: false })).status).toBe(200);
    expect(state.operations[0]).toMatchObject({ table: "transactions", admin: false,
      payload: { split_requested: false, collaborator_id: null, collaborator_amount: null,
        collaborator_description: null, collaborator_account_id: null },
      filters: { id: "tx", user_id: "owner", split_completed_at: null, split_requested: true } });
    expect(Object.keys(state.operations[0].payload)).toHaveLength(5);
    expect(state.operations[1]).toMatchObject({ admin: true, table: "notifications", filters: {
      transaction_id: "tx", user_id: state.partner, notification_type: "transaction_pending",
    }, payload: { is_dismissed: true, action_taken: true } });
    expect(state.transaction?.amount).toBe(30);
    expect(adjustAccountBalance).not.toHaveBeenCalled();
  });

  it("removes and re-adds the same partner for Undo without moving money", async () => {
    await patch({ split_requested: false });
    expect((await patch({ split_requested: true, collaborator_id: state.partner })).status).toBe(200);
    expect(state.transaction).toMatchObject({ split_requested: true, collaborator_id: state.partner, amount: 30 });
    expect(state.operations.at(-1)?.payload).toMatchObject({ is_dismissed: false, action_taken: false });
    expect(adjustAccountBalance).not.toHaveBeenCalled();
  });

  it("creates a review notification when splitting a plain transaction", async () => {
    state.transaction!.split_requested = false;
    state.transaction!.collaborator_id = null;
    state.existingNotification = false;
    expect((await patch({ split_requested: true })).status).toBe(200);
    expect(state.operations.at(-1)?.payload).toMatchObject({ user_id: state.partner, transaction_id: "tx",
      action_type: "log_transaction", action_data: { transaction_id: "tx", owner_amount: 30 } });
  });

  it("rejects completed splits and concurrent completion", async () => {
    state.transaction!.split_completed_at = "2026-10-31T10:00:00Z";
    expect((await patch({ split_requested: false })).status).toBe(409);
    expect(state.operations).toHaveLength(0);
    state.transaction!.split_completed_at = null;
    state.race = true;
    expect((await patch({ split_requested: false })).status).toBe(409);
    expect(state.operations).toHaveLength(1);
    expect(adjustAccountBalance).not.toHaveBeenCalled();
  });

  it("refuses unauthenticated, nonowner and missing transactions", async () => {
    state.user = null;
    expect((await patch({ split_requested: false })).status).toBe(401);
    state.user = { id: "partner" };
    expect((await patch({ split_requested: false })).status).toBe(404);
    state.user = { id: "owner" };
    state.transaction = null;
    expect((await patch({ split_requested: false })).status).toBe(404);
    expect(state.operations).toHaveLength(0);
  });

  it("validates the toggle and blocks mixed money edits and a different Undo recipient", async () => {
    expect((await patch({ split_requested: "false" })).status).toBe(400);
    expect((await patch({ split_requested: false, amount: 100 })).status).toBe(400);
    expect((await patch({ split_requested: true, collaborator_id: "22222222-2222-4222-8222-222222222222" })).status).toBe(409);
    state.partner = null;
    expect((await patch({ split_requested: true })).status).toBe(409);
    expect(state.operations).toHaveLength(0);
  });

  it("reports a notification failure truthfully after the metadata saved", async () => {
    state.notificationError = true;
    const response = await patch({ split_requested: false });
    expect(response.status).toBe(502);
    expect((await response.json()).transaction.split_requested).toBe(false);
    expect(adjustAccountBalance).not.toHaveBeenCalled();
    state.notificationError = false;
    expect((await patch({ split_requested: false, collaborator_id: state.partner })).status).toBe(200);
    expect(state.operations.at(-1)?.filters).toMatchObject({ user_id: state.partner, transaction_id: "tx" });
  });

  it("allows a legacy null split flag and guards that state at the update", async () => {
    state.transaction!.split_requested = null;
    state.transaction!.collaborator_id = null;
    expect((await patch({ split_requested: true })).status).toBe(200);
    expect(state.operations[0].filters.split_requested).toBeNull();
  });
});

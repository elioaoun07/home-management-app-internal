// Restore must be the exact inverse of the DELETE that trashed the row — the
// ERA Artifacts Redo/Undo rides on it.
//
// WORKED EXAMPLE (same-currency transfer 50 USD, Drawer → Wallet)
//   getTransferDeltas(50) = { fromDelta: -50, toDelta: +50 }
//   Live transfer:   Drawer 100, Wallet 70
//   DELETE:          applies -fromDelta (+50) to Drawer, -toDelta (-50) to Wallet
//                    → Drawer 150, Wallet 20 (as if the transfer never happened)
//   Restore (this):  applies fromDelta (-50) to Drawer, toDelta (+50) to Wallet
//                    → Drawer 100, Wallet 70 — back where the live transfer left them
//   Before this fix restore only cleared deleted_at: Drawer 150, Wallet 20 forever.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  trashed: null as Row | null,
  toAmount: null as number | null,
  updateRows: [{ id: "x" }] as Row[],
  adjustments: [] as { accountId: string; delta: number; type: string }[],
  alertUpdates: [] as Row[],
  itemRow: { status: "pending", archived_at: null } as Row | null,
}));

vi.mock("@/lib/balance", () => ({
  adjustAccountBalance: vi.fn(async (accountId: string, delta: number, type: string) => {
    state.adjustments.push({ accountId, delta, type });
    return { newBalance: 0, previousBalance: 0 };
  }),
}));
vi.mock("@/lib/gcal/sync", () => ({ syncItemToGoogleCalendar: vi.fn(async () => {}) }));
vi.mock("@/lib/recycleBin/scope", () => ({
  resolveScope: vi.fn(async () => ({ userIds: ["user-1"], householdId: null })),
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}) }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => createQuery(table),
  })),
}));

function createQuery(table: string) {
  let op: "select" | "update" = "select";
  let columns = "";
  const q = {
    select(cols?: string) {
      if (op === "select") columns = cols ?? "";
      return q;
    },
    update(payload: Row) {
      op = "update";
      if (table === "item_alerts") state.alertUpdates.push(payload);
      return q;
    },
    eq: () => q,
    in: () => q,
    not: () => q,
    is: () => q,
    maybeSingle: async () => {
      if (table === "items") return { data: state.itemRow, error: null };
      if (columns === "to_amount") return { data: { to_amount: state.toAmount }, error: null };
      return { data: state.trashed, error: null };
    },
    then(resolve: (v: { data: unknown; error: null }) => void) {
      resolve({ data: op === "update" && table !== "item_alerts" ? state.updateRows : null, error: null });
    },
  };
  return q;
}

const request = (module: string) =>
  new Request("http://localhost/api/recycle-bin/restore", {
    method: "POST",
    body: JSON.stringify({ module, id: "row-1" }),
  }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  state.user = { id: "user-1" };
  state.trashed = null;
  state.toAmount = null;
  state.updateRows = [{ id: "x" }];
  state.adjustments = [];
  state.alertUpdates = [];
  state.itemRow = { status: "pending", archived_at: null };
});

const transferRow = (over: Row = {}): Row => ({
  id: "row-1",
  user_id: "user-1",
  from_account_id: "drawer",
  to_account_id: "wallet",
  amount: 50,
  returned_amount: 0,
  transfer_type: "self",
  deleted_at: "2026-10-10T00:00:00Z",
  ...over,
});

describe("POST /api/recycle-bin/restore — transfers", () => {
  it("re-applies exactly what DELETE reversed (self transfer)", async () => {
    state.trashed = transferRow();
    const res = await POST(request("transfers"));
    expect(res.status).toBe(200);
    expect(state.adjustments).toEqual([
      { accountId: "drawer", delta: -50, type: "transfer_out" },
      { accountId: "wallet", delta: 50, type: "transfer_in" },
    ]);
  });

  it("carries to_amount for a cross-currency transfer (never a symmetric delta)", async () => {
    state.trashed = transferRow({ amount: 100 });
    state.toAmount = 8_900_000;
    await POST(request("transfers"));
    expect(state.adjustments).toEqual([
      { accountId: "drawer", delta: -100, type: "transfer_out" },
      { accountId: "wallet", delta: 8_900_000, type: "transfer_in" },
    ]);
  });

  it("household transfers net out the returned amount, like create and delete do", async () => {
    state.trashed = transferRow({ amount: 100, returned_amount: 30, transfer_type: "household" });
    await POST(request("transfers"));
    expect(state.adjustments.map((a) => a.delta)).toEqual([-70, 70]);
  });

  it("moves no money when another call already restored the row", async () => {
    state.trashed = transferRow();
    state.updateRows = [];
    const res = await POST(request("transfers"));
    expect(res.status).toBe(404);
    expect(state.adjustments).toEqual([]);
  });

  it("404s a row that is not in the bin without touching balances", async () => {
    state.trashed = null;
    const res = await POST(request("transfers"));
    expect(res.status).toBe(404);
    expect(state.adjustments).toEqual([]);
  });
});

describe("POST /api/recycle-bin/restore — items", () => {
  it("re-arms the alerts DELETE switched off", async () => {
    state.trashed = { id: "row-1", user_id: "user-1", deleted_at: "x" };
    await POST(request("items"));
    expect(state.alertUpdates).toEqual([{ active: true }]);
  });

  it("leaves alerts off for a completed item", async () => {
    state.trashed = { id: "row-1", user_id: "user-1", deleted_at: "x" };
    state.itemRow = { status: "completed", archived_at: null };
    await POST(request("items"));
    expect(state.alertUpdates).toEqual([]);
  });
});

describe("POST /api/recycle-bin/restore — drafts", () => {
  it("never touches balances (a draft was never counted)", async () => {
    state.trashed = { id: "row-1", user_id: "user-1", amount: 12, account_id: "wallet", is_draft: true, deleted_at: "x" };
    const res = await POST(request("drafts"));
    expect(res.status).toBe(200);
    expect(state.adjustments).toEqual([]);
  });
});

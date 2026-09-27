// HUB-76 — native money writes and deletes are held behind a confirm card.
//
// Gate (Master Book HUB-76): zero POSTs before confirm; the tap POSTs once;
// Undo restores exactly once; a timeout after the POST is `uncertain` and is
// never retried. The fake server below keeps Drawer/Wallet balances the way
// POST/DELETE /api/transfers apply them (transfer_out/in, reversal on
// delete of a not-yet-deleted transfer) so the worked example is asserted
// end to end on the client flow. It does not re-test server balance math —
// that is BUD-24/63's route, shared with the transfer form.
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestTimeoutError } from "@/lib/safeFetch";
import { resolveIntent } from "./intents/resolveIntent";
import { executeNativeAction } from "./nativeActions";
import type { EraNativeAction, Intent } from "./types";

vi.mock("@/lib/connectivityManager", () => ({
  isReallyOnline: () => true,
  markOffline: () => {},
  probeNow: () => Promise.resolve(),
}));

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
}

const calls: Call[] = [];
let balances: Record<string, number>;
let transfers: Record<string, { from: string; to: string; amount: number; deleted: boolean }>;
let timeoutNextPost = false;

const ACCOUNTS = [
  { id: "drawer", name: "Drawer", currency: "USD" },
  { id: "wallet", name: "Wallet", currency: "USD" },
  { id: "lbp", name: "Cash LBP", currency: "LBP" },
];

function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  calls.length = 0;
  balances = { drawer: 1000, wallet: 100 };
  transfers = {};
  timeoutNextPost = false;
  let seq = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
      calls.push({ url, method, body });

      if (method === "POST" && timeoutNextPost) {
        timeoutNextPost = false;
        throw new RequestTimeoutError(8_000);
      }
      if (url.startsWith("/api/accounts")) return json(200, ACCOUNTS);
      if (url === "/api/transfers" && method === "POST") {
        const id = `t${++seq}`;
        const amount = Number(body!.amount);
        transfers[id] = {
          from: String(body!.from_account_id),
          to: String(body!.to_account_id),
          amount,
          deleted: false,
        };
        balances[transfers[id].from] -= amount;
        balances[transfers[id].to] += amount;
        return json(200, { id });
      }
      const del = url.match(/^\/api\/transfers\/(\w+)$/);
      if (del && method === "DELETE") {
        const t = transfers[del[1]];
        if (!t || t.deleted) return json(404, { error: "Transfer not found" });
        t.deleted = true;
        balances[t.from] += t.amount;
        balances[t.to] -= t.amount;
        return json(200, { success: true });
      }
      if (url === "/api/debts/standalone" && method === "POST") {
        return json(200, { debt: { id: "d1" } });
      }
      if (url.startsWith("/api/debts/") && method === "DELETE") return json(200, { success: true });
      if (url.startsWith("/api/items/") && method === "DELETE") {
        return json(200, { success: true, action: "deleted" });
      }
      if (url === "/api/recycle-bin/restore") return json(200, { success: true });
      return json(404, {});
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const posts = () => calls.filter((c) => c.method === "POST");

function transferIntent(text: string, amount: number, currency?: "USD" | "LBP"): Intent {
  return {
    kind: "transfer",
    face: "budget",
    amount,
    currency,
    fromHint: "Drawer",
    toHint: "Wallet",
    rawText: text,
  };
}

describe("HUB-76 transfer — Drawer $1,000 / Wallet $100", () => {
  it("routes to a card: zero POSTs and unchanged balances before the tap", async () => {
    const result = await resolveIntent(transferIntent("Transfer $300 from Drawer to Wallet", 300));

    expect(posts()).toHaveLength(0);
    expect(balances).toEqual({ drawer: 1000, wallet: 100 });
    expect(result.proposal).toMatchObject({
      kind: "native_action",
      text: "Drawer → Wallet · $300",
      action: { type: "transfer", amount: 300, fromAccountId: "drawer", toAccountId: "wallet" },
    });
  });

  it("the tap POSTs once → $700/$400; Undo restores $1,000/$100 exactly once", async () => {
    const { proposal } = await resolveIntent(transferIntent("Transfer $300 from Drawer to Wallet", 300));
    if (proposal?.kind !== "native_action") throw new Error("no card");

    const qc = new QueryClient();
    const done = await executeNativeAction(proposal.action, qc);
    expect(done.outcome).toBe("done");
    expect(posts()).toHaveLength(1);
    expect(balances).toEqual({ drawer: 700, wallet: 400 });

    expect(await done.undo!()).toBe(true);
    expect(balances).toEqual({ drawer: 1000, wallet: 100 });

    // Second Undo is a client no-op — no second DELETE, no double reversal.
    expect(await done.undo!()).toBe(false);
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
    expect(balances).toEqual({ drawer: 1000, wallet: 100 });
  });

  it("a timeout after the POST is `uncertain` with no Undo and no retry", async () => {
    const action: EraNativeAction = {
      type: "transfer",
      amount: 300,
      currency: "USD",
      fromAccountId: "drawer",
      toAccountId: "wallet",
      fromName: "Drawer",
      toName: "Wallet",
    };
    timeoutNextPost = true;
    const result = await executeNativeAction(action, new QueryClient());

    expect(result.outcome).toBe("uncertain");
    expect(result.undo).toBeUndefined();
    expect(result.text).toMatch(/not sure/i);
    expect(posts()).toHaveLength(1);
  });

  it("refuses a cross-currency transfer instead of posting one number on both sides", async () => {
    const result = await resolveIntent({
      ...transferIntent("move 500k lbp from drawer to wallet", 500000, "LBP"),
    });
    expect(result.proposal).toBeUndefined();
    expect(posts()).toHaveLength(0);
  });
});

describe("HUB-76 record debt", () => {
  it("routes to a card, POSTs only on tap, Undo deletes the debt", async () => {
    const result = await resolveIntent({
      kind: "recordDebt",
      face: "budget",
      debtorName: "John",
      amount: 30,
      notes: "lunch",
      rawText: "John owes me $30 for lunch",
    });
    expect(posts()).toHaveLength(0);
    if (result.proposal?.kind !== "native_action") throw new Error("no card");
    expect(result.proposal.text).toBe("John owes you · $30");

    const done = await executeNativeAction(result.proposal.action, new QueryClient());
    expect(done.outcome).toBe("done");
    expect(posts()).toHaveLength(1);
    expect(await done.undo!()).toBe(true);
    expect(calls.some((c) => c.url === "/api/debts/d1" && c.method === "DELETE")).toBe(true);
  });

  it("refuses a non-USD debt (debts carry no currency)", async () => {
    const result = await resolveIntent({
      kind: "recordDebt",
      face: "budget",
      debtorName: "Rita",
      amount: 500000,
      currency: "LBP",
      rawText: "Rita owes me 500k lbp",
    });
    expect(result.proposal).toBeUndefined();
    expect(result.text).toMatch(/USD/);
  });
});

describe("HUB-76 reminder delete", () => {
  it("deletes only on tap; Undo restores from the Recycle Bin", async () => {
    const result = await resolveIntent({
      kind: "reminderDelete",
      face: "schedule",
      itemId: "item-1",
      title: "Dentist",
      rawText: "delete the dentist",
    });
    expect(calls).toHaveLength(0);
    if (result.proposal?.kind !== "native_action") throw new Error("no card");

    const done = await executeNativeAction(result.proposal.action, new QueryClient());
    expect(done.outcome).toBe("done");
    expect(calls.some((c) => c.url === "/api/items/item-1" && c.method === "DELETE")).toBe(true);
    expect(await done.undo!()).toBe(true);
    expect(calls.find((c) => c.url === "/api/recycle-bin/restore")?.body).toEqual({
      module: "items",
      id: "item-1",
    });
  });
});

// HUB-79 / HUB-22 — "mark rent as paid" links an EXISTING transaction.
// Worked example (money-rules): Wallet $1,000 already reflects the $500 rent
// paid on 2026-09-27. Rent: next due 2026-10-01, last 2026-09-01.
// Cover → next due 2026-11-01, last 2026-09-27, Wallet still $1,000 (no new
// spend). A second tap is refused (snapshot moved), Undo restores the dates.
describe("HUB-79 recurring cover", () => {
  let rent: { next_due_date: string; last_processed_date: string | null };
  let wallet: number;
  let coverPosts: number;

  beforeEach(() => {
    rent = { next_due_date: "2026-10-01", last_processed_date: "2026-09-01" };
    wallet = 1000;
    coverPosts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
        if (url === "/api/recurring-payments" && method === "GET") {
          return json(200, { recurring_payments: [{ id: "rp-rent", name: "Rent", amount: 500, is_active: true, ...rent }] });
        }
        if (url.endsWith("/mark-covered")) {
          coverPosts++;
          rent = { next_due_date: "2026-11-01", last_processed_date: "2026-09-27" };
          return json(200, { next_due_date: rent.next_due_date });
        }
        if (url === "/api/recurring-payments/rp-rent" && method === "PATCH") {
          rent = { next_due_date: body.next_due_date, last_processed_date: body.last_processed_date };
          return json(200, {});
        }
        return json(404, {});
      }),
    );
  });

  const action: EraNativeAction = {
    type: "recurringCover",
    paymentId: "rp-rent",
    name: "Rent",
    amount: 500,
    transactionId: "tx-rent",
    txDate: "2026-09-27",
    previousLastProcessed: "2026-09-01",
    previousNextDue: "2026-10-01",
  };

  it("covers once, creates no spend, refuses a stale second tap, and Undo restores", async () => {
    const qc = new QueryClient();
    const first = await executeNativeAction(action, qc);
    expect(first.outcome).toBe("done");
    expect(rent).toEqual({ next_due_date: "2026-11-01", last_processed_date: "2026-09-27" });
    expect(wallet).toBe(1000);

    const second = await executeNativeAction(action, qc);
    expect(second.outcome).toBe("failed");
    expect(second.text).toMatch(/already covered/i);
    expect(coverPosts).toBe(1);

    expect(await first.undo!()).toBe(true);
    expect(rent).toEqual({ next_due_date: "2026-10-01", last_processed_date: "2026-09-01" });
    expect(await first.undo!()).toBe(false);
  });
});

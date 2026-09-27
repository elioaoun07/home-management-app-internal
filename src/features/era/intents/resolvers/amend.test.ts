// HUB-84 — follow-ups edit the last result, whatever its type.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FocusEntity } from "../../focusMemory";
import { useEraStore } from "../../useEraStore";
import { rootIntentRouter } from "..";
import { isFollowUp, parseEdits } from "../followUp";
import { resolveAmend } from "./amend";

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
let failDraftPost = false;

beforeEach(() => {
  calls.length = 0;
  failDraftPost = false;
  useEraStore.getState().reset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      calls.push({ url, method, body });
      const ok = (b: unknown, status = 200) => ({ ok: status < 400, status, json: async () => b }) as Response;
      if (url.startsWith("/api/hub/threads")) return ok({ threads: [{ id: "t-shop", purpose: "shopping", is_private: false }] });
      if (url.startsWith("/api/hub/messages?thread_id=")) {
        return ok({
          messages: [
            { id: "m-salt", content: "Salt", created_at: "2026-09-27T10:05:00Z", shopping_group_id: null },
            { id: "m-chips", content: "Chips for Elio", created_at: "2026-09-27T09:00:00Z", shopping_group_id: "g-spin" },
            { id: "m-old", content: "Olive oil", created_at: "2026-09-26T09:00:00Z", checked_at: "2026-09-26T12:00:00Z" },
          ],
        });
      }
      if (url.startsWith("/api/hub/shopping-groups") && method === "GET") {
        return ok({ groups: [{ id: "g-spin", name: "Spinneys" }, { id: "g-ph1", name: "Pharmacy" }, { id: "g-ph2", name: "Pharmacy Hazmieh" }] });
      }
      if (url === "/api/drafts" && method === "POST") return failDraftPost ? ok({}, 500) : ok({ draft: { id: "draft-new" } });
      if (url.startsWith("/api/accounts")) {
        return ok([
          { id: "wallet", name: "Wallet", currency: "USD" },
          { id: "drawer", name: "Drawer", currency: "USD" },
          { id: "savings", name: "Savings", currency: "USD" },
        ]);
      }
      return ok({ success: true });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const salt: FocusEntity = {
  id: "m1",
  type: "shopping",
  title: "Salt",
  addedAt: Date.now(),
  meta: { messageIds: ["m1"], threadId: "t-shop", items: ["Salt"], groupId: null },
};

describe("follow-up detection and fields", () => {
  it.each([
    ["make it under Spinneys", { group: "Spinneys" }],
    ["put it in the Spinneys group", { group: "Spinneys" }],
    ["under spinneys", { group: "spinneys" }],
    ["make it 2", { quantity: "2", amount: 2 }],
    ["call it rock salt", { name: "rock salt" }],
    ["remove it", { remove: true }],
    ["no, 15", { amount: 15 }],
    ["it's actually 20$", { amount: 20, currency: "USD" }],
    ["to savings instead", { target: "savings" }],
  ])("%s", (text, expected) => {
    expect(isFollowUp(text)).toBe(true);
    expect(parseEdits(text)).toMatchObject(expected);
  });

  it.each(["add salt to my shopping list", "what's on today", "remind me to call mom", "spent 12$ on coffee"])(
    "not a follow-up: %s",
    (text) => expect(isFollowUp(text)).toBe(false),
  );
});

describe("routing is decided by the referent's type", () => {
  it("'make it under Spinneys' after a shopping add edits the item, not a reminder", () => {
    useEraStore.getState().pushFocusEntity(salt);
    expect(rootIntentRouter.parse("make it under Spinneys")).toMatchObject({ kind: "amendLast", focusType: "shopping", focusId: "m1" });
  });

  it("with nothing to edit it asks, never a reschedule question", () => {
    expect(rootIntentRouter.parse("make it under Spinneys")).toMatchObject({ kind: "amendLast", focusId: null });
  });

  it("the owner's export sentence adds Salt under Spinneys", () => {
    useEraStore.setState({ activeFaceKey: "budget" });
    expect(rootIntentRouter.parse("Add to my grocery list in hub chat under spinneys group Salt")).toMatchObject({
      kind: "addShopping",
      items: ["Salt"],
      groupHint: "spinneys",
    });
    expect(rootIntentRouter.parse("add salt under Spinneys")).toMatchObject({ kind: "addShopping", items: ["Salt"], groupHint: "Spinneys" });
  });

  it("a reminder referent keeps the reschedule path", () => {
    useEraStore.getState().pushFocusEntity({ id: "r1", type: "reminder", title: "Dentist", addedAt: Date.now() });
    expect(rootIntentRouter.parse("make it 5pm")).toMatchObject({ kind: "reminderReschedule", itemId: "r1" });
  });

  it("'don't …' never edits", () => {
    useEraStore.getState().pushFocusEntity(salt);
    // Either the gate or a plain miss — what matters is that no edit happens.
    expect(["clarify", "unknown"]).toContain(rootIntentRouter.parse("don't put it under Spinneys").kind);
  });
});

describe("shopping edit contract", () => {
  it("one match: moves into the group, Undo moves it back", async () => {
    const r = await resolveAmend(salt, "make it under Spinneys");
    expect(r.text).toBe("Salt · Spinneys");
    const move = calls.find((c) => c.method === "PATCH" && c.url === "/api/hub/shopping-groups");
    expect(move?.body).toEqual({ action: "move_items_bulk", message_ids: ["m1"], group_id: "g-spin" });
    expect(await r.undo!()).toBe(true);
    expect(calls.at(-1)?.body).toEqual({ action: "move_items_bulk", message_ids: ["m1"], group_id: null });
    expect(r.focus?.meta).toMatchObject({ groupId: "g-spin" });
  });

  it("no match: a create-group card, nothing written yet", async () => {
    const r = await resolveAmend(salt, "put it in the Carrefour group");
    expect(r.proposal).toMatchObject({ kind: "native_action", action: { type: "shoppingGroupCreate", name: "Carrefour", messageIds: ["m1"] } });
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  });

  it("several matches: asks which, with chips", async () => {
    const r = await resolveAmend(salt, "under pharmacy");
    // "Pharmacy" is an exact match, so it wins over "Pharmacy Hazmieh".
    expect(r.text).toBe("Salt · Pharmacy");
    const r2 = await resolveAmend(salt, "under pharm");
    expect(r2.pending).toMatchObject({ kind: "slot", capability: "shopping.group" });
  });

  it("quantity and rename, each with Undo", async () => {
    const q = await resolveAmend(salt, "make it 2");
    expect(q.text).toBe("Salt · 2");
    expect(calls.find((c) => c.body?.action === "set_quantity")?.body).toMatchObject({ message_id: "m1", quantity: "2" });
    const n = await resolveAmend(salt, "call it rock salt");
    expect(n.text).toBe("Salt → rock salt");
    expect(await n.undo!()).toBe(true);
    expect(calls.at(-1)?.body).toMatchObject({ action: "update_content", content: "Salt" });
  });

  it("remove goes to a confirm card (no demonstrated restore)", async () => {
    const r = await resolveAmend(salt, "remove it");
    expect(r.proposal).toMatchObject({ action: { type: "shoppingRemove", messageIds: ["m1"] } });
  });
});

describe("draft edit contract", () => {
  const draft: FocusEntity = {
    id: "draft-old",
    type: "draft",
    title: "Coffee",
    addedAt: Date.now(),
    meta: { draftId: "draft-old", accountId: "wallet", amount: 12, currency: "USD", description: "spent 12$ on coffee" },
  };

  it("replaces the draft: create first, then delete — Undo swaps back", async () => {
    const r = await resolveAmend(draft, "no, 15");
    expect(r.text).toBe("Draft · $15");
    const post = calls.findIndex((c) => c.url === "/api/drafts" && c.method === "POST");
    const del = calls.findIndex((c) => c.url === "/api/drafts/draft-old" && c.method === "DELETE");
    expect(post).toBeGreaterThanOrEqual(0);
    expect(del).toBeGreaterThan(post);
    expect(calls[post].body).toMatchObject({ account_id: "wallet", amount: 15 });
    expect(r.focus?.id).toBe("draft-new");
    expect(await r.undo!()).toBe(true);
  });

  it("if creating the corrected draft fails, the original is never deleted", async () => {
    failDraftPost = true;
    const r = await resolveAmend(draft, "no, 15");
    expect(r.ok).toBe(false);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("refuses a different currency", async () => {
    const r = await resolveAmend(draft, "no, 15 euros");
    expect(r.ok).toBe(false);
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  });
});

describe("transfer card edit contract", () => {
  it("'make it 200' rebuilds the Confirm card; nothing is posted", async () => {
    useEraStore.setState({
      activeProposal: {
        kind: "native_action",
        text: "Drawer → Wallet · $300",
        sourceText: "Transfer $300 from Drawer to Wallet",
        action: { type: "transfer", amount: 300, currency: "USD", fromAccountId: "drawer", toAccountId: "wallet", fromName: "Drawer", toName: "Wallet" },
      },
    });
    const card: FocusEntity = {
      id: "transfer-card",
      type: "transfer_card",
      title: "Drawer → Wallet · $300",
      addedAt: Date.now(),
      meta: { type: "transfer", amount: 300, currency: "USD", fromAccountId: "drawer", toAccountId: "wallet", fromName: "Drawer", toName: "Wallet" },
    };
    const r = await resolveAmend(card, "make it 200");
    expect(r.proposal).toMatchObject({ action: { amount: 200, fromName: "Drawer", toName: "Wallet" } });
    const r2 = await resolveAmend(card, "to savings instead");
    expect(r2.proposal).toMatchObject({ action: { amount: 300, toName: "Savings" } });
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });
});

describe("HUB-84 — the owner's second screenshot", () => {
  it("'Change what?' waits for the answer and offers open items; 'Salt' completes the edit", async () => {
    const intent = rootIntentRouter.parse("make it under Spinneys group");
    expect(intent).toMatchObject({ kind: "amendLast", focusId: null });
    const ask = await resolveAmend(null, "make it under Spinneys group");
    expect(ask.text).toBe("Change what?");
    expect(ask.pending).toMatchObject({ kind: "slot", capability: "amend.target" });
    const labels = (ask.pending as { options: Array<{ label: string }> }).options.map((o) => o.label);
    expect(labels).toEqual(["Salt", "Chips for Elio"]); // checked items are not offered

    const { resolvePendingSlot } = await import("./slots");
    const done = await resolvePendingSlot(ask.pending as never, "Salt");
    expect(done).toMatchObject({ text: "Salt · Spinneys" });
    expect(calls.find((c) => c.body?.action === "move_items_bulk")?.body).toMatchObject({ message_ids: ["m-salt"], group_id: "g-spin" });
  });

  it("'Move salt under spinneys group' names the item and moves it", async () => {
    const intent = rootIntentRouter.parse("Move salt under spinneys group");
    expect(intent).toMatchObject({ kind: "amendLast", targetHint: "salt" });
    const { resolveAmendByName } = await import("./amend");
    const r = await resolveAmendByName("salt", "Move salt under spinneys group");
    expect(r.text).toBe("Salt · Spinneys");
  });

  it("'move the dentist to Friday' is still a reschedule, not a list edit", () => {
    expect(rootIntentRouter.parse("move the dentist to Friday").kind).toBe("reminderReschedule");
  });

  it("an item that isn't on the list says so", async () => {
    const { resolveAmendByName } = await import("./amend");
    expect((await resolveAmendByName("pepper", "move pepper under spinneys")).text).toBe('No "pepper" on the list.');
  });

  it("'it' is rebuilt from the conversation after a reload", async () => {
    const { focusFromMessages } = await import("../../focusRehydrate");
    const now = Date.parse("2026-09-27T10:10:00Z");
    const focus = focusFromMessages(
      [
        { role: "assistant", created_at: "2026-09-27T10:05:00Z", intent_payload: { messageIds: ["m-salt"], threadId: "t-shop", items: ["Salt"], groupId: null } },
        { role: "assistant", created_at: "2026-09-27T08:00:00Z", intent_payload: { messageIds: ["m-x"], threadId: "t-shop", items: ["Old"] } },
      ],
      now,
    );
    expect(focus).toHaveLength(1); // the 08:00 one is outside the 30-minute window
    expect(focus[0]).toMatchObject({ id: "m-salt", type: "shopping", title: "Salt" });
  });
});

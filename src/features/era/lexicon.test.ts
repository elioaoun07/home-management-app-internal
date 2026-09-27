// HUB-80 gate — sequence: first try → choice → repeat → Always → paraphrase
// → explicit override → forget. Zero repeated questions after Always, zero
// partner-default misuse, and a deleted account makes its rule inert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rootIntentRouter } from "./intents";
import { resolveIntent } from "./intents/resolveIntent";
import { resolvePendingSlot } from "./intents/resolvers/slots";
import { findDefault, type LexiconRule } from "./lexicon";
import type { EraPendingSlot, Intent } from "./types";
import { saveLexiconRule } from "./useEraLexicon";
import { useEraStore } from "./useEraStore";

vi.mock("@/lib/connectivityManager", () => ({
  isReallyOnline: () => true,
  markOffline: () => {},
  probeNow: () => Promise.resolve(),
}));

const ACCOUNTS = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Wallet", currency: "USD" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Drawer", currency: "USD" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Savings", currency: "USD" },
];
const [WALLET, DRAWER, SAVINGS] = ACCOUNTS.map((a) => a.id);
let seq = 0;
let accounts = ACCOUNTS;

beforeEach(() => {
  useEraStore.getState().reset();
  useEraStore.setState({ activeFaceKey: "budget" });
  accounts = ACCOUNTS;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const ok = (body: unknown, status = 200) =>
        ({ ok: true, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response;
      if (url.startsWith("/api/accounts")) return ok(accounts);
      if (url === "/api/era/lexicon" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return ok({ rule: { id: `rule-${++seq}`, use_count: 0, ...body } }, 201);
      }
      if (url.startsWith("/api/era/lexicon?id=")) return ok({ ok: true });
      return ok({});
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

async function say(text: string) {
  const intent = rootIntentRouter.parse(text) as Intent;
  return resolveIntent(intent);
}

async function answer(pending: unknown, label: string) {
  const r = await resolvePendingSlot(pending as EraPendingSlot, label, label);
  if ("unmatched" in r) throw new Error("unmatched");
  await new Promise((resolve) => setTimeout(resolve, 0)); // let the example save
  return r;
}

describe("HUB-80 lexicon sequence", () => {
  it("first try → Always → paraphrase → override → forget", async () => {
    // 1. First try asks.
    const t1 = await say("I took 300$ from Drawer");
    expect(t1.pending).toMatchObject({ kind: "slot", slot: "to" });
    const c1 = await answer(t1.pending, "Wallet");
    expect(c1.proposal).toMatchObject({ action: { fromName: "Drawer", toName: "Wallet" } });
    expect((c1.proposal as { offerAlways?: unknown }).offerAlways).toBeUndefined(); // one example ≠ a default

    // 2. Same choice again → the card offers Always.
    const t2 = await say("I took 50 from drawer");
    const c2 = await answer(t2.pending, "Wallet");
    const offer = (c2.proposal as { offerAlways?: Record<string, unknown> }).offerAlways;
    expect(offer).toMatchObject({ capability: "transfer.create", slot: "to", conditions: { from: DRAWER }, value: { accountId: WALLET } });

    // 3. Always.
    await saveLexiconRule({ kind: "default", ...(offer as object) } as never);

    // 4. Paraphrase: no question, straight to the Confirm card (tier unchanged).
    const t3 = await say("took 20 out of drawer");
    expect(t3.pending ?? null).toBeNull();
    expect(t3.proposal).toMatchObject({ kind: "native_action", action: { fromName: "Drawer", toName: "Wallet", amount: 20 } });

    // 5. Explicit override wins over the default.
    const t4 = await say("transfer 20 from drawer to savings");
    expect(t4.proposal).toMatchObject({ action: { toName: "Savings" } });

    // 6. Forget → the question comes back.
    await say("I took 10 from drawer"); // applies the default → lastAppliedRuleId set
    const f = await say("forget that");
    expect(f.text).toBe("Forgotten.");
    const t5 = await say("I took 10 from drawer");
    expect(t5.pending).toMatchObject({ kind: "slot", slot: "to" });
  });
});

describe("HUB-80 scope and invalidation", () => {
  const rule: LexiconRule = {
    id: "r1",
    kind: "default",
    capability: "transfer.create",
    slot: "to",
    conditions: { from: DRAWER },
    value: { accountId: WALLET, name: "Wallet" },
    depends_on: [DRAWER, WALLET],
  };

  it("never applies to someone whose accounts it doesn't reference (partner)", () => {
    const partnerAccounts = new Set(["44444444-4444-4444-8444-444444444444"]);
    expect(findDefault([rule], "transfer.create", "to", { from: DRAWER }, partnerAccounts)).toBeNull();
  });

  it("goes inert when a referenced account is gone", () => {
    expect(findDefault([rule], "transfer.create", "to", { from: DRAWER }, new Set([DRAWER, SAVINGS]))).toBeNull();
    expect(findDefault([rule], "transfer.create", "to", { from: DRAWER }, new Set([DRAWER, WALLET]))?.id).toBe("r1");
  });

  it("a deleted destination account falls back to asking", async () => {
    useEraStore.getState().setLexicon([rule]);
    accounts = ACCOUNTS.filter((a) => a.id !== WALLET);
    const t = await say("I took 5 from drawer");
    expect(t.pending).toMatchObject({ kind: "slot" });
  });
});

describe("HUB-80 alias", () => {
  it("'the box means Drawer' then 'took 30 from the box' binds to Drawer", async () => {
    const a = await say("the box means Drawer");
    expect(a.text).toBe("the box = Drawer");
    const t = await say("I took 30 from the box");
    expect(t.pending).toMatchObject({ kind: "slot", args: { fromName: "Drawer" } });
  });
});

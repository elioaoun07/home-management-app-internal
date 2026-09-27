// HUB-78 — turn state (chips), by-name reminder lookup, shopping split.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EraPendingSlot } from "../../types";
import { rankCandidates, type ReminderCandidate } from "./reminderLookup";
import { splitShoppingItems } from "./shopping";
import { matchOption, proceedWithReminder, resolvePendingSlot } from "./slots";
import { transferSlot } from "./slotBuilders";
import { prepareTransfer } from "./budget";

vi.mock("@/lib/connectivityManager", () => ({
  isReallyOnline: () => true,
  markOffline: () => {},
  probeNow: () => Promise.resolve(),
}));

const ACCOUNTS = [
  { id: "wallet", name: "Wallet", currency: "USD" },
  { id: "drawer", name: "Drawer", currency: "USD" },
  { id: "savings", name: "Savings", currency: "USD" },
  { id: "lbp", name: "Cash LBP", currency: "LBP" },
];
const posts: string[] = [];

beforeEach(() => {
  posts.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // Money/entity writes only — the lexicon example (HUB-80) is evidence, not an effect.
      if ((init?.method ?? "GET") !== "GET" && !String(input).startsWith("/api/era/lexicon")) posts.push(String(input));
      return { ok: true, status: 200, json: async () => ACCOUNTS } as Response;
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("one-sided transfer → destination chips", () => {
  it("I took 300$ from Drawer asks for the destination, same currency only, plus Other", async () => {
    const r = await prepareTransfer(300, "USD", "Drawer", undefined, "I took 300$ from Drawer");
    expect(posts).toHaveLength(0);
    expect(r.proposal).toBeUndefined();
    expect(r.pending).toMatchObject({ kind: "slot", capability: "transfer.create", slot: "to" });
    const labels = (r.pending as EraPendingSlot).options.map((o) => o.label);
    expect(labels).toEqual(["Wallet", "Savings", "Other"]);
    const other = (r.pending as EraPendingSlot).options.at(-1)!;
    expect(other.value).toBe("nav:/expense?transfer=refill-wallet&amount=300&from=Drawer");
  });

  it("a chip answer becomes the confirm card — still zero POSTs", async () => {
    const r = await prepareTransfer(300, "USD", "Drawer", undefined, "I took 300$ from Drawer");
    const answered = await resolvePendingSlot(r.pending as EraPendingSlot, "Wallet", "Wallet");
    expect(posts).toHaveLength(0);
    expect(answered).toMatchObject({
      pending: null,
      proposal: { kind: "native_action", action: { type: "transfer", fromName: "Drawer", toName: "Wallet", amount: 300 } },
    });
  });

  it("typed text that is not an option is a new request (unmatched)", async () => {
    const r = await prepareTransfer(300, "USD", "Drawer", undefined, "x");
    expect(await resolvePendingSlot(r.pending as EraPendingSlot, "what's on today")).toEqual({ unmatched: true });
  });

  it("the Other chip never answers the question", async () => {
    const pending = transferSlot({ amount: 5, fromName: "Drawer", candidates: [], rawText: "", question: "q" }).pending as EraPendingSlot;
    expect(await resolvePendingSlot(pending, "Other")).toEqual({ unmatched: true });
  });
});

describe("matchOption", () => {
  const opts = [
    { label: "Wallet", value: "w" },
    { label: "Savings", value: "s" },
  ];
  it("exact, partial and ambiguous", () => {
    expect(matchOption(opts, "wallet")?.value).toBe("w");
    expect(matchOption(opts, "the savings one")?.value).toBe("s");
    expect(matchOption([...opts, { label: "Savings LBP", value: "l" }], "savings")?.value).toBe("s");
    expect(matchOption(opts, "banana")).toBeNull();
  });
});

describe("reminder by name", () => {
  const items: ReminderCandidate[] = [
    { id: "1", title: "Dentist", recurring: false, mine: true, dueAt: null },
    { id: "2", title: "Water the plants", recurring: false, mine: true, dueAt: null },
    { id: "3", title: "Water the garden", recurring: false, mine: true, dueAt: null },
    { id: "4", title: "Gym class", recurring: true, mine: true, dueAt: null },
  ];
  it("ranks exact over partial and returns ties together", () => {
    expect(rankCandidates(items, "the dentist").map((c) => c.id)).toEqual(["1"]);
    expect(rankCandidates(items, "water").map((c) => c.id)).toEqual(["2", "3"]);
    expect(rankCandidates(items, "gym")).toHaveLength(1);
    expect(rankCandidates(items, "")).toEqual([]);
  });

  it("a recurring reminder asks this one / series and never writes first", async () => {
    const r = await proceedWithReminder("reschedule", items[3], "Tuesday", "move gym class to Tuesday");
    expect(posts).toHaveLength(0);
    expect(r.pending).toMatchObject({ capability: "reminder.scope", options: [{ value: "one" }, { value: "series" }] });
  });

  it("both scope answers are Confirm cards", async () => {
    const r = await proceedWithReminder("reschedule", items[3], "Tuesday", "move gym class to Tuesday");
    const one = await resolvePendingSlot(r.pending as EraPendingSlot, "This one", "one");
    const series = await resolvePendingSlot(r.pending as EraPendingSlot, "Series", "series");
    expect(one).toMatchObject({ proposal: { action: { type: "reminderOccurrence", itemId: "4" } } });
    expect(series).toMatchObject({ proposal: { action: { type: "reminderSeries", itemId: "4" } } });
    expect(posts).toHaveLength(0);
  });

  it("delete goes to a confirm card", async () => {
    const r = await proceedWithReminder("delete", items[0], undefined, "delete the dentist");
    expect(r.proposal).toMatchObject({ kind: "native_action", action: { type: "capability", capabilityId: "reminder.delete" } });
  });
});

describe("splitShoppingItems", () => {
  it.each([
    ["milk and eggs", ["Milk", "Eggs"]],
    ["milk, eggs, and some bread", ["Milk", "Eggs", "Bread"]],
    ["in hub chat under spinneys group Salt", ["Salt"]],
    ["olive oil", ["Olive oil"]],
  ])("%s", (raw, expected) => {
    expect(splitShoppingItems(raw)).toEqual(expected);
  });
});

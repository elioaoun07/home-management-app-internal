// ERA Artifact contract — every write adapter ("ERA using the app's
// functionality") returns at least one artifact whose deep link resolves.
// One row per write path. /era-wire adds a row for every new wiring; a
// write that forgets its artifact never reaches /era → Artifacts, so it
// fails here instead of on the owner's phone (HUB-89 follow-up).
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type EraArtifact, eraArtifactHref } from "@/lib/era/artifacts";
import { resolveMemorySave } from "./intents/resolvers/brain";
import { executeRecordDebt, executeTransfer, resolveConfirmDraft, resolveDraftTransaction } from "./intents/resolvers/budget";
import { executeCoverRecurring } from "./intents/resolvers/budgetFamilies";
import { resolveAssignMeal } from "./intents/resolvers/chef";
import { resolveAddContact } from "./intents/resolvers/contacts";
import { answerEventLocation, answerPlaceSave, resolveDraftEvent } from "./intents/resolvers/events";
import { resolveAddPlace } from "./intents/resolvers/places";
import {
  postponeNextOccurrence,
  resolveDraftReminder,
  resolveReminderComplete,
  resolveReminderDelete,
  resolveReminderReschedule,
  skipNextOccurrence,
} from "./intents/resolvers/schedule";
import { resolveAddShopping } from "./intents/resolvers/shopping";
import { executeNativeAction } from "./nativeActions";
import { recordEraArtifacts } from "./recordArtifacts";
import type { EraBudgetSubmitResult } from "./useEraBudgetSubmit";

vi.mock("@/lib/connectivityManager", () => ({
  isReallyOnline: () => true,
  markOffline: () => {},
  probeNow: () => Promise.resolve(),
}));

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ID = {
  module: u(1),
  contact: u(2),
  thread: u(3),
  memory: u(4),
  recipe: u(5),
  meal: u(6),
  draft: u(7),
  account: u(8),
  item: u(9),
  transfer: u(10),
  debt: u(11),
  payment: u(12),
  group: u(13),
  placesModule: u(14),
};

vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data:
            table === "reminder_details"
              ? { due_at: "2026-10-05T09:00:00Z" }
              : { id: ID.item, reminder_details: [{ due_at: "2026-10-05T09:00:00Z" }], item_recurrence_rules: [] },
        }),
      };
      return chain;
    },
  }),
}));
vi.mock("@/features/items/useItems", () => ({
  fetchItems: async () => [{ id: u(9), title: "Gym", recurrence_rule: { rrule: "FREQ=DAILY" } }],
}));
vi.mock("@/features/items/useItemActions", async (orig) => ({
  ...(await orig<typeof import("@/features/items/useItemActions")>()),
  fetchAllOccurrenceActions: async () => [],
}));
vi.mock("@/lib/utils/dayOccurrences", async (orig) => ({
  ...(await orig<typeof import("@/lib/utils/dayOccurrences")>()),
  expandOccurrencesInRange: () => [{ occurrenceDate: new Date("2026-10-05T09:00:00"), isCompleted: false }],
}));

interface Call {
  url: string;
  method: string;
  body: unknown;
}
const calls: Call[] = [];
let seq = 100;

function json(body: unknown, status = 200): Response {
  return { ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

/** The app's routes, faked by URL + method — the shapes the real routes return. */
function route(url: string, method: string, body: unknown): Response {
  if (url === "/api/catalogue/modules" && method === "POST") return json({ id: ID.placesModule }, 201);
  if (url === "/api/catalogue/modules") return json([{ id: ID.module, type: "contacts" }]);
  if (url.startsWith("/api/catalogue/items?module_id=")) return json([]);
  if (url === `/api/items/${ID.item}` && method === "PATCH") return json({ item: { id: ID.item } });
  if (url === "/api/catalogue/items" && method === "POST") return json({ id: ID.contact }, 201);
  if (url.startsWith("/api/hub/threads")) return json({ threads: [{ id: ID.thread, purpose: "shopping", is_private: false }] });
  if (url === "/api/hub/messages" && method === "POST") return json({ message: { id: u(++seq) } });
  if (url === "/api/hub/shopping-groups" && method === "POST")
    return json({ group: { id: ID.group, name: (body as { name: string }).name } });
  if (url === "/api/memories" && method === "POST") return json({ id: ID.memory });
  if (url.startsWith("/api/recipes?search=")) return json([{ id: ID.recipe, name: "Tacos" }]);
  if (url === "/api/meal-plans" && method === "POST") return json({ id: ID.meal });
  if (url === "/api/drafts" && method === "GET")
    return json({
      drafts: [
        {
          id: ID.draft,
          amount: 12,
          category_id: null,
          subcategory_id: null,
          description: "coffee",
          date: "2026-10-04",
          account_id: ID.account,
          category: { name: "Coffee" },
        },
      ],
    });
  if (url === `/api/drafts/${ID.draft}` && method === "PATCH") return json({ transaction: { id: ID.draft, amount: 12 } });
  if (url === "/api/items" && method === "POST") return json({ item: { id: ID.item } });
  if (url === "/api/transfers" && method === "POST") return json({ id: ID.transfer });
  if (url === "/api/debts/standalone" && method === "POST") return json({ debt: { id: ID.debt } });
  if (url === "/api/recurring-payments" && method === "GET")
    return json({ recurring_payments: [{ id: ID.payment, name: "Netflix", next_due_date: "2026-10-01" }] });
  if (url.endsWith("/mark-covered")) return json({ next_due_date: "2026-11-01" });
  return json({});
}

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method, body });
      if (url === "/api/health") return json({ ok: true });
      return route(url, method, body);
    }),
  );
});

const qc = () => new QueryClient();
const submitDraft = async (): Promise<EraBudgetSubmitResult> =>
  ({
    ok: true,
    draftId: ID.draft,
    accountId: ID.account,
    currency: "USD",
    parsed: { amount: 12, categoryName: "Coffee" },
  }) as unknown as EraBudgetSubmitResult;

type Row = [name: string, run: () => Promise<{ artifacts?: EraArtifact[] }>, entity: string, action: string, id?: string];

const WRITES: Row[] = [
  ["contact.create", () => resolveAddContact("Laura"), "contact", "created", ID.contact],
  ["place.create", () => resolveAddPlace("Kobeize"), "place", "created", ID.contact],
  [
    "event.create",
    () => resolveDraftEvent({ title: "Dinner", rawText: "add an event dinner tomorrow at 8pm" }),
    "event",
    "created",
    ID.item,
  ],
  [
    "event.location",
    () =>
      answerEventLocation(
        {
          kind: "slot",
          capability: "event.location",
          slot: "place",
          question: "Where?",
          options: [],
          args: { eventId: ID.item, title: "Dinner", startAt: "2026-10-05T17:00:00Z", endAt: "2026-10-05T18:00:00Z", allDay: false, date: "2026-10-05" },
          rawText: "add an event dinner tomorrow at 8pm",
          createdAt: 0,
        },
        "Starbucks Hamra",
      ) as Promise<{ artifacts?: EraArtifact[] }>,
    "event",
    "updated",
    ID.item,
  ],
  [
    "place.save",
    () =>
      answerPlaceSave(
        { kind: "slot", capability: "place.save", slot: "save", question: "Save?", options: [], args: { name: "Kobeize" }, rawText: "", createdAt: 0 },
        "Save",
        "save",
      ) as Promise<{ artifacts?: EraArtifact[] }>,
    "place",
    "created",
    ID.contact,
  ],
  ["shopping.add", () => resolveAddShopping(["Milk"]), "shopping_item", "created"],
  ["memory.save", () => resolveMemorySave("wifi", "1234"), "memory", "created", ID.memory],
  ["meal.assign", () => resolveAssignMeal("tacos", "tomorrow", "dinner"), "meal_plan", "created", ID.meal],
  ["draft.confirm", () => resolveConfirmDraft(undefined), "transaction", "updated", ID.draft],
  ["transaction.draft", () => resolveDraftTransaction("coffee 12", submitDraft), "draft", "created", ID.draft],
  ["reminder.create", () => resolveDraftReminder("call mom tomorrow at 5pm", "Call mom"), "reminder", "created", ID.item],
  ["reminder.reschedule", () => resolveReminderReschedule(ID.item, "Gym", "tomorrow at 6pm"), "reminder", "updated", ID.item],
  ["reminder.complete", () => resolveReminderComplete(ID.item, "Gym"), "reminder", "updated", ID.item],
  ["reminder.delete", () => resolveReminderDelete(ID.item, "Gym"), "reminder", "deleted", ID.item],
  ["reminder.skip", () => skipNextOccurrence(ID.item, "Gym"), "reminder", "updated", ID.item],
  ["reminder.postpone", () => postponeNextOccurrence(ID.item, "Gym", "tomorrow at 8pm"), "reminder", "updated", ID.item],
  [
    "transfer.create",
    () =>
      executeTransfer({
        type: "transfer",
        amount: 50,
        currency: "USD",
        fromAccountId: ID.account,
        toAccountId: u(99),
        fromName: "Drawer",
        toName: "Wallet",
      }),
    "transfer",
    "created",
    ID.transfer,
  ],
  [
    "debt.record",
    () => executeRecordDebt({ type: "recordDebt", debtorName: "Rita", amount: 20, notes: null }),
    "debt",
    "created",
    ID.debt,
  ],
  [
    "recurring.cover",
    () =>
      executeCoverRecurring({
        type: "recurringCover",
        paymentId: ID.payment,
        name: "Netflix",
        amount: 10,
        transactionId: u(98),
        txDate: "2026-10-01",
        previousLastProcessed: null,
        previousNextDue: "2026-10-01",
      }),
    "recurring_payment",
    "updated",
    ID.payment,
  ],
  [
    "shopping.group",
    () =>
      executeNativeAction(
        { type: "shoppingGroupCreate", threadId: ID.thread, name: "Spinneys", messageIds: [u(97)], previousGroupId: null },
        qc(),
      ),
    "shopping_group",
    "created",
    ID.group,
  ],
  [
    "shopping.remove",
    () => executeNativeAction({ type: "shoppingRemove", messageIds: [u(96)], label: "Salt" }, qc()),
    "shopping_item",
    "deleted",
    u(96),
  ],
  [
    "reminder.delete (card)",
    () =>
      executeNativeAction({ type: "capability", capabilityId: "reminder.delete", slots: { itemId: ID.item, title: "Gym" } }, qc()),
    "reminder",
    "deleted",
    ID.item,
  ],
];

describe("every ERA write returns an artifact", () => {
  it.each(WRITES)("%s", async (_name, run, entity, action, id) => {
    const r = await run();
    expect(r.artifacts?.length, "write returned no artifacts").toBeGreaterThan(0);
    const a = r.artifacts![0];
    expect(a.entity).toBe(entity);
    expect(a.action).toBe(action);
    if (id) expect(a.id).toBe(id);
    const href = eraArtifactHref(a);
    expect(href.startsWith("/")).toBe(true);
    expect(href).not.toContain(a.title); // links come from entity + id, never captured text
  });
});

describe("recordEraArtifacts", () => {
  it("posts every artifact once, nothing when empty", async () => {
    recordEraArtifacts([]);
    recordEraArtifacts(undefined);
    expect(calls.filter((c) => c.url === "/api/era/actions")).toHaveLength(0);
    const r = await resolveAddContact("Laura");
    recordEraArtifacts(r.artifacts);
    await vi.waitFor(() => expect(calls.filter((c) => c.url === "/api/era/actions")).toHaveLength(1));
    const post = calls.find((c) => c.url === "/api/era/actions")!;
    expect(post.method).toBe("POST");
    expect(post.body).toEqual({ artifacts: r.artifacts });
  });
});

describe("routeWrite (era-wire adapter template)", () => {
  it("Undo calls the route's own inverse once per tap", async () => {
    const r = await resolveAddContact("Laura");
    expect(r.text).toBe("Added · Laura");
    expect(await r.undo!()).toBe(true);
    expect(calls.at(-1)).toMatchObject({ url: `/api/catalogue/items/${ID.contact}`, method: "DELETE" });
  });
});

// Behavior lock for ERA's intent → side-effect → reply path (Phase 2).
//
// resolveIntent is the single owner of "what an intent actually does". These
// tests pin the three intents wired in Phase 2:
//
//   draftReminder    → POST /api/items, real reminder, clean title, honest due_at
//   showAnalytics    → GET  /api/analytics, spoken summary of the current month
//   draftTransaction → the injected budget submitter, reply derived from ITS result
//
// Everything is exercised through `resolveIntent` rather than the resolvers
// directly, because the routing itself is part of what regressed before: an
// intent that reaches the dispatcher and falls through to `formatReply` looks
// like it worked ("Saving that reminder…") while writing nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localToISO } from "@/lib/utils/date";
import type { EraBudgetSubmitResult } from "../useEraBudgetSubmit";
import type { Intent } from "../types";
import { resolveIntent } from "./resolveIntent";
import { resolvePendingReminderAnswer } from "./resolvers/schedule";
import { scheduleRouter } from "./schedule";

// safeFetch pre-flights every request through the connectivity manager, whose
// module-level state is seeded from `navigator.onLine` at import time — which
// under vitest's node environment is `undefined`, i.e. permanently "offline".
// Connectivity is not what these tests are about, so pin it online.
vi.mock("@/lib/connectivityManager", () => ({
  isReallyOnline: () => true,
  markOffline: () => {},
}));

// resolveMonthSpend/resolveShowAnalytics need the current user's id to scope
// household transactions (HUB-14) — real client creation throws in this
// environment (no Supabase env vars), which the resolver already treats as
// "degrade gracefully", so most existing tests below never touch this mock.
// Tests that specifically exercise the scoped/custom-month path set it.
const mockGetUser = vi.hoisted(() => vi.fn());
// resolveScheduleForDay reuses fetchItems (get_schedule_bundle RPC) and
// fetchAllOccurrenceActions (item_occurrence_actions table) — only the
// todaySchedule tests below drive these; every other describe block only
// ever touches `.auth.getUser`.
const mockRpc = vi.hoisted(() => vi.fn());
const mockOccurrenceActionsSelect = vi.hoisted(() => vi.fn());
// Stage 1 resolvers (reschedule/complete) look up a single row by table name
// — `.from(table).select().eq().maybeSingle()`. Keyed by table so a test can
// seed `reminder_details` and `items` independently.
const mockMaybeSingleByTable = vi.hoisted(() => vi.fn<(table: string) => unknown>());
vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: (table: string) => ({
      select: () => ({
        order: () => mockOccurrenceActionsSelect(),
        eq: () => ({ maybeSingle: () => mockMaybeSingleByTable(table) }),
      }),
    }),
  }),
}));

// ---------------------------------------------------------------------------
// fetch harness — safeFetch calls global fetch after a connectivity pre-check
// ---------------------------------------------------------------------------

interface RecordedCall {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
}

const calls: RecordedCall[] = [];

function mockFetch(
  handler: (url: string) => { status?: number; json: unknown },
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? "GET",
        body:
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : null,
      });
      const { status = 200, json } = handler(url);
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => json,
        text: async () => JSON.stringify(json),
      } as Response;
    }),
  );
}

/** The POST the resolver made to a given route, or undefined. */
function postTo(path: string): RecordedCall | undefined {
  return calls.find((c) => c.url.includes(path) && c.method === "POST");
}

/** The call the resolver made to a given route with the given method. */
function callTo(path: string, method: string): RecordedCall | undefined {
  return calls.find((c) => c.url.includes(path) && c.method === method);
}

beforeEach(() => {
  calls.length = 0;
  // safeFetch narrates every request; keep the suite output readable.
  vi.spyOn(console, "log").mockImplementation(() => {});
  // Default: no user resolvable — resolveMonthSpend/resolveShowAnalytics's
  // custom-month enhancement degrades gracefully, matching the "real client
  // throws in this env" case tests don't opt into explicitly.
  mockGetUser.mockResolvedValue({ data: { user: null } });
  mockRpc.mockResolvedValue({ data: { items: [] }, error: null });
  mockOccurrenceActionsSelect.mockResolvedValue({ data: [], error: null });
  mockMaybeSingleByTable.mockResolvedValue({ data: null, error: null });
});

// ---------------------------------------------------------------------------
// variant harness
// ---------------------------------------------------------------------------

/**
 * ERA's replies are drawn at random from a pool of phrasings, so asserting on
 * one exact sentence would pass 1-in-N of the time. Instead we drive
 * `Math.random` across its whole range, collect every distinct sentence the
 * pool can produce, and assert the FACTS hold in all of them.
 *
 * That is a stronger test than pinning a single variant: it enforces the rule
 * the pools are written to (`src/lib/era/phrasing.ts` rule 1) — a variant may
 * rephrase freely but may never drop the payload. A future contributor adding
 * a breezier line that omits the due time fails here.
 */
async function everyVariant(
  produce: () => Promise<{ text: string }>,
  samples = 60,
): Promise<string[]> {
  const spy = vi.spyOn(Math, "random");
  try {
    const seen = new Set<string>();
    for (let i = 0; i < samples; i++) {
      spy.mockReturnValue(i / samples);
      seen.add((await produce()).text);
    }
    return [...seen];
  } finally {
    spy.mockRestore();
  }
}

/** Assert a substring appears in every phrasing the pool can emit. */
function allContain(variants: string[], needle: string): void {
  expect(variants.length).toBeGreaterThan(1); // the pool must actually vary
  const missing = variants.filter((v) => !v.includes(needle));
  expect(
    missing,
    `${missing.length}/${variants.length} phrasings dropped "${needle}"`,
  ).toEqual([]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// todaySchedule / resolveScheduleForDay (Stage 0 fix)
// ---------------------------------------------------------------------------

function scheduleIntent(dateISO?: string): Intent {
  return {
    kind: "todaySchedule",
    face: "schedule",
    rawText: "what's on my schedule",
    dateISO,
  };
}

/** yyyy-MM-dd `daysAhead` days from now, in local calendar terms. */
function localDateISO(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("resolveIntent — todaySchedule", () => {
  it("reports items for a NAMED day, not today — the exact bug this stage fixes", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const targetISO = localDateISO(3);
    mockRpc.mockResolvedValue({
      data: {
        items: [
          {
            id: "item-1",
            type: "reminder",
            title: "Water the plants",
            status: "pending",
            reminder_details: { due_at: localToISO(targetISO, "14:00") },
            alerts: [],
          },
        ],
      },
      error: null,
    });

    const variants = await everyVariant(() => resolveIntent(scheduleIntent(targetISO)));
    allContain(variants, "Water the plants");
  });

  it("does not leak items from a different day onto the requested day", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const targetISO = localDateISO(3);
    const otherDayISO = localDateISO(4);
    mockRpc.mockResolvedValue({
      data: {
        items: [
          {
            id: "item-1",
            type: "reminder",
            title: "Not this day's task",
            status: "pending",
            reminder_details: { due_at: localToISO(otherDayISO, "14:00") },
            alerts: [],
          },
        ],
      },
      error: null,
    });

    const result = await resolveIntent(scheduleIntent(targetISO));
    expect(result.text).not.toContain("Not this day's task");
  });

  it("degrades to an honest error when the current user can't be resolved", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await resolveIntent(scheduleIntent());
    expect(result.text).toContain("I couldn't pull up your schedule.");
  });
});

// ---------------------------------------------------------------------------
// Stage 1 focus-memory follow-ups: reschedule / complete / delete
// ---------------------------------------------------------------------------

function rescheduleIntent(
  itemId: string | null,
  title: string | null,
  whenText: string,
): Intent {
  return {
    kind: "reminderReschedule",
    face: "schedule",
    itemId,
    title,
    whenText,
    rawText: `change it to ${whenText}`,
  };
}

function completeIntent(itemId: string | null, title: string | null): Intent {
  return {
    kind: "reminderComplete",
    face: "schedule",
    itemId,
    title,
    rawText: "mark it done",
  };
}

function deleteIntent(itemId: string | null, title: string | null): Intent {
  return {
    kind: "reminderDelete",
    face: "schedule",
    itemId,
    title,
    rawText: "delete that",
  };
}

describe("resolveIntent — reminderReschedule", () => {
  it("a bare time keeps the reminder's existing date and only shifts the time", async () => {
    mockFetch(() => ({ json: { item: { id: "item-1" } } }));
    const existingISO = localToISO(localDateISO(1), "09:00");
    mockMaybeSingleByTable.mockImplementation(async (table: string) =>
      table === "reminder_details"
        ? { data: { due_at: existingISO }, error: null }
        : { data: null, error: null },
    );

    const result = await resolveIntent(
      rescheduleIntent("item-1", "Water the plants", "11"),
    );

    const patch = callTo("/api/items/item-1", "PATCH");
    expect(patch?.body?.due_at).toBe(localToISO(localDateISO(1), "11:00"));
    expect(result.text).toContain("Water the plants");
  });

  it("an explicit date+time replaces both, ignoring the reminder's old date", async () => {
    mockFetch(() => ({ json: { item: { id: "item-1" } } }));
    mockMaybeSingleByTable.mockImplementation(async (table: string) =>
      table === "reminder_details"
        ? { data: { due_at: localToISO(localDateISO(1), "09:00") }, error: null }
        : { data: null, error: null },
    );

    await resolveIntent(rescheduleIntent("item-1", "Water the plants", "tomorrow at 5"));

    const patch = callTo("/api/items/item-1", "PATCH");
    expect(patch?.body?.due_at).toBe(localToISO(localDateISO(1), "17:00"));
  });

  it("asks instead of guessing when focus memory has no candidate (itemId null)", async () => {
    const variants = await everyVariant(() =>
      resolveIntent(rescheduleIntent(null, null, "11")),
    );
    allContain(variants, "reschedule");
    expect(callTo("/api/items/", "PATCH")).toBeUndefined();
  });

  it("surfaces the failure instead of claiming success when the API rejects it", async () => {
    mockFetch(() => ({ status: 500, json: {} }));
    mockMaybeSingleByTable.mockResolvedValue({ data: null, error: null });
    const result = await resolveIntent(
      rescheduleIntent("item-1", "Water the plants", "tomorrow at 5"),
    );
    expect(result.text).toContain("couldn't");
  });
});

describe("resolveIntent — reminderComplete", () => {
  it("completes a non-recurring reminder using ITS OWN due date as the occurrence", async () => {
    mockFetch(() => ({ json: { success: true } }));
    const dueAt = localToISO(localDateISO(1), "09:00");
    mockMaybeSingleByTable.mockImplementation(async (table: string) =>
      table === "items"
        ? {
            data: { id: "item-1", reminder_details: { due_at: dueAt }, item_recurrence_rules: [] },
            error: null,
          }
        : { data: null, error: null },
    );

    const result = await resolveIntent(completeIntent("item-1", "Water the plants"));

    const post = postTo("/api/items/item-1/complete");
    expect(post?.body).toMatchObject({
      occurrence_date: localDateISO(1),
      is_recurring: false,
    });
    expect(result.text).toContain("Water the plants");
  });

  it("points a RECURRING reminder at the app instead of guessing which occurrence", async () => {
    mockMaybeSingleByTable.mockImplementation(async (table: string) =>
      table === "items"
        ? {
            data: {
              id: "item-1",
              reminder_details: { due_at: localToISO(localDateISO(1), "09:00") },
              item_recurrence_rules: [{ id: "rule-1" }],
            },
            error: null,
          }
        : { data: null, error: null },
    );

    const result = await resolveIntent(completeIntent("item-1", "Take out trash"));

    expect(postTo("/api/items/item-1/complete")).toBeUndefined();
    expect(result.text).toContain("Take out trash");
    expect(result.text.toLowerCase()).toContain("reminders");
  });

  it("asks instead of guessing when focus memory has no candidate (itemId null)", async () => {
    const variants = await everyVariant(() =>
      resolveIntent(completeIntent(null, null)),
    );
    allContain(variants, "complete");
  });
});

describe("resolveIntent — reminderDelete", () => {
  it("soft-deletes via the same DELETE route the app's own delete button uses", async () => {
    mockFetch(() => ({ json: { success: true, action: "deleted" } }));
    const result = await resolveIntent(deleteIntent("item-1", "Water the plants"));

    expect(callTo("/api/items/item-1", "DELETE")).toBeDefined();
    expect(result.text).toContain("Water the plants");
    expect(result.metadata).toMatchObject({ deletedItemId: "item-1" });
  });

  it("asks instead of guessing when focus memory has no candidate (itemId null)", async () => {
    const variants = await everyVariant(() => resolveIntent(deleteIntent(null, null)));
    allContain(variants, "delete");
    expect(callTo("/api/items/", "DELETE")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// draftReminder
// ---------------------------------------------------------------------------

/** Build the intent the way the real router does, so the title is the real one. */
function reminderIntent(text: string): Intent {
  const intent = scheduleRouter.parse(text, { activeFaceKey: "schedule" });
  if (!intent || intent.kind !== "draftReminder") {
    throw new Error(`"${text}" did not route to draftReminder`);
  }
  return intent;
}

describe("resolveIntent — draftReminder", () => {
  beforeEach(() => {
    mockFetch(() => ({ json: { item: { id: "item-1" } } }));
  });

  it("creates a reminder titled with the CLEAN title, not the raw sentence", async () => {
    const result = await resolveIntent(
      reminderIntent("remind me to call the bank tomorrow at 5pm"),
    );

    const post = postTo("/api/items");
    expect(post).toBeDefined();
    expect(post!.body).toMatchObject({ type: "reminder", title: "Call the bank" });
    expect(post!.body!.title).not.toContain("remind me");
    expect(result.metadata).toMatchObject({ itemId: "item-1" });
  });

  // Slice 3: time is a required slot. Before this, a dateless reminder wrote
  // anyway with due_at omitted — technically honest, but the owner's own
  // complaint was ERA "logged the reminder without mentioning the time" and
  // moved on. Now it asks, and writes nothing until the question is answered.
  it("asks for a time instead of writing when no date was expressed (Slice 3)", async () => {
    const result = await resolveIntent(
      reminderIntent("remind me to call the bank"),
    );

    expect(postTo("/api/items")).toBeUndefined();
    expect(result.pending).toMatchObject({
      kind: "draftReminder",
      title: "Call the bank",
    });
    expect(result.text.toLowerCase()).toContain("call the bank");
  });

  it("sends due_at as a UTC instant matching the parsed local wall clock", async () => {
    // Freeze time so "tomorrow" is deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0)); // 2026-08-22 10:00 local

    await resolveIntent(
      reminderIntent("remind me to call the bank tomorrow at 5pm"),
    );

    const dueAt = postTo("/api/items")!.body!.due_at as string;
    expect(dueAt).toBeTypeOf("string");

    // The instant must render back as 2026-08-23 17:00 in local time — which
    // is the whole point of localToISO. Comparing to a hard-coded Z string
    // would only pass in one timezone.
    const due = new Date(dueAt);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(7); // August
    expect(due.getDate()).toBe(23);
    expect(due.getHours()).toBe(17);
    expect(due.getMinutes()).toBe(0);
  });

  it("defaults to noon when a date was parsed but no time — same as the reminder form", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0));

    await resolveIntent(reminderIntent("remind me to call the bank tomorrow"));

    const due = new Date(postTo("/api/items")!.body!.due_at as string);
    expect(due.getDate()).toBe(23);
    expect(due.getHours()).toBe(12);
  });

  it("reports the failure instead of claiming success when the API rejects it", async () => {
    mockFetch((url) =>
      url.includes("/api/items")
        ? { status: 500, json: { error: "boom" } }
        : { json: {} },
    );

    const intent = reminderIntent("remind me to call the bank tomorrow at 5pm");
    const variants = await everyVariant(() => resolveIntent(intent));

    // The apology and the retry nudge vary; the diagnosis never does.
    allContain(variants, "I couldn't save that reminder.");
    expect((await resolveIntent(intent)).metadata).toBeUndefined();
  });

  // ── the phrasing contract ────────────────────────────────────────────────
  // These are the reason the pools exist: ERA must not read from a script, but
  // it also must not lose a fact while sounding casual.

  it("states the title AND the due time in every phrasing it can produce", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0));
    const intent = reminderIntent(
      "remind me to water the plant tomorrow at 11:00 a.m.",
    );

    const variants = await everyVariant(() => resolveIntent(intent));

    for (const v of variants) {
      expect(v.toLowerCase()).toContain("water the plant");
    }
    allContain(variants, "tomorrow at 11:00 AM");
  });

  it("every ask-for-time variant states the title and actually asks", async () => {
    const intent = reminderIntent("remind me to water the plants");

    const variants = await everyVariant(() => resolveIntent(intent));

    for (const v of variants) {
      expect(v.toLowerCase()).toContain("water the plants");
      expect(v).toMatch(/\?|when|time/i);
    }
  });

  it("varies its wording — the same request twice is not the same sentence", async () => {
    const intent = reminderIntent("remind me to call the bank tomorrow at 5pm");
    const variants = await everyVariant(() => resolveIntent(intent));

    // A pool worth having is a pool with real breadth.
    expect(variants.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// resolvePendingReminderAnswer — Slice 3 slot filling completion
// ---------------------------------------------------------------------------

describe("resolvePendingReminderAnswer", () => {
  beforeEach(() => {
    mockFetch(() => ({ json: { item: { id: "item-9" } } }));
  });

  const pending = {
    kind: "draftReminder" as const,
    title: "Call the bank",
    priority: "normal" as const,
    rawText: "remind me to call the bank",
    createdAt: Date.now(),
  };

  it("completes the reminder when the answer parses to a date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0));

    const result = await resolvePendingReminderAnswer(pending, "tomorrow at 4pm");

    const post = postTo("/api/items")!;
    expect(post.body).toMatchObject({ title: "Call the bank" });
    const due = new Date(post.body!.due_at as string);
    expect(due.getDate()).toBe(23);
    expect(due.getHours()).toBe(16);
    expect(result.pending).toBeNull();
    expect(result.text.toLowerCase()).toContain("call the bank");
  });

  it("flushes to a reviewable draft when the answer doesn't parse as a date, rather than losing the title", async () => {
    const result = await resolvePendingReminderAnswer(pending, "actually never mind the time");

    const post = postTo("/api/items")!;
    expect(post.body).toMatchObject({
      title: "Call the bank",
      status: "draft",
    });
    expect(post.body).not.toHaveProperty("due_at");
    expect(result.pending).toBeNull();
    expect(result.metadata).toMatchObject({ draft: true });
  });

  it("clears the pending question even when the API call fails", async () => {
    mockFetch(() => ({ status: 500, json: { error: "boom" } }));
    const result = await resolvePendingReminderAnswer(pending, "not a date");
    expect(result.pending).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// showAnalytics
// ---------------------------------------------------------------------------

const ANALYTICS_TWO_MONTHS = {
  months: [
    {
      month: "2026-07",
      income: 4000,
      expense: 2000,
      savingsRate: 50,
      transactionCount: 30,
      categoryBreakdown: [{ name: "Rent", amount: 1200 }],
    },
    {
      month: "2026-08",
      income: 4000,
      expense: 2600,
      savingsRate: 35,
      transactionCount: 41,
      categoryBreakdown: [
        { name: "Groceries", amount: 900 },
        { name: "Fuel", amount: 400 },
        { name: "Dining", amount: 300 },
        { name: "Misc", amount: 100 },
      ],
    },
  ],
};

const analyticsIntent: Intent = {
  kind: "showAnalytics",
  face: "budget",
  rawText: "show my analytics",
};

describe("resolveIntent — showAnalytics", () => {
  it("summarizes the CURRENT month (the last entry), not the first", async () => {
    mockFetch(() => ({ json: ANALYTICS_TWO_MONTHS }));

    const result = await resolveIntent(analyticsIntent);

    expect(result.metadata).toMatchObject({
      month: "2026-08",
      expense: 2600,
      transactionCount: 41,
    });
    expect(result.text).toContain("August");
    expect(result.text).toContain("41 transactions");
  });

  it("names at most the top three categories, largest first", async () => {
    mockFetch(() => ({ json: ANALYTICS_TWO_MONTHS }));

    const variants = await everyVariant(() => resolveIntent(analyticsIntent));

    for (const v of variants) {
      expect(v).toContain("Groceries");
      expect(v).toContain("Fuel");
      expect(v).toContain("Dining");
      expect(v).not.toContain("Misc");
    }
  });

  it("keeps every figure in every phrasing", async () => {
    mockFetch(() => ({ json: ANALYTICS_TWO_MONTHS }));

    const variants = await everyVariant(() => resolveIntent(analyticsIntent));

    allContain(variants, "August");
    allContain(variants, "$2,600"); // expense
    allContain(variants, "$4,000"); // income
    allContain(variants, "41 transactions");
    allContain(variants, "35%"); // savings rate
    allContain(variants, "30%"); // 2600 vs 2000 → +30% month over month
  });

  it("says there is nothing to show rather than inventing zeros", async () => {
    mockFetch(() => ({ json: { months: [] } }));

    const variants = await everyVariant(() => resolveIntent(analyticsIntent));

    for (const v of variants) {
      expect(v).toMatch(/nothing|no data|empty/i);
      // No variant may quote a number it doesn't have.
      expect(v).not.toMatch(/\$\d/);
    }
    expect((await resolveIntent(analyticsIntent)).metadata).toMatchObject({
      months: 0,
    });
  });

  it("degrades to an error reply when the API fails", async () => {
    mockFetch((url) =>
      url.includes("/api/analytics")
        ? { status: 500, json: { error: "nope" } }
        : { json: {} },
    );

    const variants = await everyVariant(() => resolveIntent(analyticsIntent));
    allContain(variants, "I couldn't pull your analytics.");
  });

  // HUB-13: /api/analytics buckets by calendar month; monthSpend uses the
  // custom billing month. On a household whose billing month doesn't start
  // on the 1st, the two used to disagree about "this month"'s total. Fixed
  // by re-sourcing expense/transactionCount/topCategories from the same
  // /api/transactions window monthSpend uses, whenever it's available.
  it("sources the headline expense from the custom billing month, not the calendar month (HUB-13)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-me" } } });
    const CUSTOM_MONTH_TRANSACTIONS = [
      { amount: 500, user_id: "u-me", category: { name: "Rent" } },
      { amount: 300, user_id: "u-me", category: { name: "Groceries" } },
    ]; // total 800 — deliberately different from ANALYTICS_TWO_MONTHS.expense (2600)
    mockFetch((url) =>
      url.includes("/api/transactions")
        ? { json: CUSTOM_MONTH_TRANSACTIONS }
        : { json: ANALYTICS_TWO_MONTHS },
    );

    const result = await resolveIntent(analyticsIntent);

    expect(result.metadata).toMatchObject({
      expense: 800,
      transactionCount: 2,
    });
    expect(result.text).toContain("$800");
    expect(result.text).not.toContain("$2,600");
    // income/savingsRate stay calendar-month-sourced — a narrower fix, not a
    // re-architecture (see the resolver's doc comment).
    expect(result.metadata).toMatchObject({ income: 4000, savingsRate: 35 });
  });
});

// ---------------------------------------------------------------------------
// monthSpend — scope filtering (HUB-14)
// ---------------------------------------------------------------------------
//
// The transactions endpoint has no server-side ownOnly/scope support — it
// always returns both household members' rows, tagged with user_id. Before
// this fix, "partner" scope used the unfiltered household total and the
// formatter still said "Your partner has spent $X", which was confidently
// wrong on any household with two spenders. These tests pin the actual
// filter, not just that a number gets returned.

const HOUSEHOLD_TRANSACTIONS = [
  { amount: 40, user_id: "u-me", category: { name: "Fuel" } },
  { amount: 60, user_id: "u-me", category: { name: "Groceries" } },
  { amount: 15, user_id: "u-partner", category: { name: "Dining" } },
];

function monthSpendIntent(
  scope: "self" | "partner" | "household",
): Intent {
  return {
    kind: "monthSpend",
    face: "budget",
    scope,
    rawText: `how much did ${scope === "self" ? "I" : scope === "partner" ? "my partner" : "we"} spend`,
  };
}

describe("resolveIntent — monthSpend scope filtering (HUB-14)", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-me" } } });
    mockFetch(() => ({ json: HOUSEHOLD_TRANSACTIONS }));
  });

  it("self scope totals only the current user's rows", async () => {
    const result = await resolveIntent(monthSpendIntent("self"));
    expect(result.metadata).toMatchObject({ total: 100, scope: "self" });
    expect(result.text).toContain("$100");
  });

  it("partner scope totals only the partner's rows — not the household total", async () => {
    const result = await resolveIntent(monthSpendIntent("partner"));
    expect(result.metadata).toMatchObject({ total: 15, scope: "partner" });
    expect(result.text).toContain("$15");
    expect(result.text).not.toContain("$115"); // the old, wrong household total
  });

  it("household scope totals everyone", async () => {
    const result = await resolveIntent(monthSpendIntent("household"));
    expect(result.metadata).toMatchObject({ total: 115, scope: "household" });
    expect(result.text).toContain("$115");
  });

  it("degrades to an honest error when the current user can't be resolved", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const variants = await everyVariant(() =>
      resolveIntent(monthSpendIntent("self")),
    );
    allContain(variants, "I couldn't pull your spending data.");
  });
});

// ---------------------------------------------------------------------------
// draftTransaction
// ---------------------------------------------------------------------------

const txIntent: Intent = {
  kind: "draftTransaction",
  face: "budget",
  amount: 25,
  description: "I paid $25 on fuel",
  rawText: "I paid $25 on fuel",
};

const OK_RESULT: EraBudgetSubmitResult = {
  ok: true,
  draftId: "draft-9",
  accountId: "acct-1",
  parsed: {
    description: "I paid $25 on fuel",
    amount: 25,
    categoryName: "Car",
    subcategoryName: "Fuel",
  },
};

describe("resolveIntent — draftTransaction", () => {
  it("runs the injected submitter with the raw sentence and reports the draft id", async () => {
    const submit = vi.fn(async () => OK_RESULT);

    const result = await resolveIntent(txIntent, { submitBudgetDraft: submit });

    expect(submit).toHaveBeenCalledExactlyOnceWith("I paid $25 on fuel");
    expect(result.metadata).toMatchObject({
      draftId: "draft-9",
      accountId: "acct-1",
      amount: 25,
    });
  });

  it("states the amount and the category in every phrasing", async () => {
    const submit = vi.fn(async () => OK_RESULT);

    const variants = await everyVariant(() =>
      resolveIntent(txIntent, { submitBudgetDraft: submit }),
    );

    allContain(variants, "$25");
    allContain(variants, "Car / Fuel");
    // Every variant must point at Drafts — the draft isn't a transaction yet,
    // and a variant that omits that reads as "logged and done".
    allContain(variants, "Drafts");
  });

  it("surfaces a failed draft instead of a success-shaped reply", async () => {
    const submit = vi.fn(
      async (): Promise<EraBudgetSubmitResult> => ({
        ok: false,
        reason: "no-amount",
        message: "no amount",
      }),
    );

    const variants = await everyVariant(() =>
      resolveIntent(txIntent, { submitBudgetDraft: submit }),
    );

    for (const v of variants) {
      // No failure phrasing may read like a save happened.
      expect(v).not.toMatch(/\b(drafted|saved|logged|done)\b/i);
      expect(v).not.toContain("Drafts");
    }

    const result = await resolveIntent(txIntent, { submitBudgetDraft: submit });
    expect(result.metadata).toMatchObject({ draftFailed: "no-amount" });
    // Crucially: no draftId, so CommandBar links no draft to the message.
    expect(result.metadata).not.toHaveProperty("draftId");
  });

  it("explains itself when no submitter is available rather than doing nothing", async () => {
    const variants = await everyVariant(() => resolveIntent(txIntent));

    for (const v of variants) {
      expect(v).toMatch(/account/i);
    }
    expect((await resolveIntent(txIntent)).metadata).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Chef — meal planning (Slice 5)
// ---------------------------------------------------------------------------

describe("resolveIntent — listRecipes", () => {
  it("lists recipe names from the library", async () => {
    mockFetch(() => ({
      json: [
        { id: "r1", name: "Chicken Parm" },
        { id: "r2", name: "Pasta Bake" },
      ],
    }));

    const result = await resolveIntent({
      kind: "listRecipes",
      face: "chef",
      rawText: "what recipes do I have",
    });

    expect(result.text).toContain("Chicken Parm");
    expect(result.text).toContain("Pasta Bake");
    expect(result.metadata).toMatchObject({ count: 2 });
  });

  it("says the library is empty rather than an empty list", async () => {
    mockFetch(() => ({ json: [] }));
    const result = await resolveIntent({
      kind: "listRecipes",
      face: "chef",
      rawText: "show my recipes",
    });
    expect(result.text.toLowerCase()).toMatch(/no recipes|empty/);
  });
});

describe("resolveIntent — assignMeal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0)); // Saturday 2026-08-22
  });

  it("resolves the dish against recipes, the day against parseSmartText, and posts the meal plan", async () => {
    mockFetch((url) =>
      url.includes("/api/recipes")
        ? { json: [{ id: "r1", name: "Chicken Parm" }] }
        : url.includes("/api/meal-plans")
          ? { json: { id: "mp-1", recipe_id: "r1" } }
          : { json: {} },
    );

    const result = await resolveIntent({
      kind: "assignMeal",
      face: "chef",
      dish: "chicken",
      dayHint: "thursday",
      mealType: "dinner",
      rawText: "assign chicken to thursday dinner",
    });

    const post = postTo("/api/meal-plans")!;
    expect(post.body).toMatchObject({ recipe_id: "r1", meal_type: "dinner" });
    // "thursday" from a Saturday anchor must land on the NEXT Thursday, not today.
    expect(post.body!.planned_date).toBe("2026-08-27");
    expect(result.text).toContain("Chicken Parm");
    expect(result.metadata).toMatchObject({ mealPlanId: "mp-1" });
  });

  it("reports no match rather than guessing when the dish isn't in the library", async () => {
    mockFetch((url) => (url.includes("/api/recipes") ? { json: [] } : { json: {} }));

    const result = await resolveIntent({
      kind: "assignMeal",
      face: "chef",
      dish: "unobtainium stew",
      dayHint: "thursday",
      mealType: undefined,
      rawText: "assign unobtainium stew to thursday",
    });

    expect(postTo("/api/meal-plans")).toBeUndefined();
    expect(result.text).toContain("unobtainium stew");
  });

  it("names the household requirement instead of surfacing a raw 400", async () => {
    mockFetch((url) =>
      url.includes("/api/recipes")
        ? { json: [{ id: "r1", name: "Chicken Parm" }] }
        : url.includes("/api/meal-plans")
          ? { status: 400, json: { error: "Meal plans require a household. Please set up household sharing first." } }
          : { json: {} },
    );

    const result = await resolveIntent({
      kind: "assignMeal",
      face: "chef",
      dish: "chicken",
      dayHint: "thursday",
      mealType: undefined,
      rawText: "assign chicken to thursday",
    });

    expect(result.text.toLowerCase()).toContain("household");
  });
});

describe("resolveIntent — mealPlanGaps", () => {
  it("names the days in the next 7 with no meal plan row", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0)); // Saturday 2026-08-22

    mockFetch(() => ({
      json: [
        { planned_date: "2026-08-22" }, // Saturday — covered
        { planned_date: "2026-08-24" }, // Monday — covered
      ],
    }));

    const result = await resolveIntent({
      kind: "mealPlanGaps",
      face: "chef",
      rawText: "what's unassigned this week",
    });

    // Covered days must NOT appear; the rest of the 7-day window should.
    expect(result.text).not.toContain("Saturday");
    expect(result.text).not.toContain("Monday");
    expect(result.text).toContain("Sunday");
    expect(result.text).toContain("Tuesday");
    expect(result.metadata).toMatchObject({
      emptyDays: expect.arrayContaining(["Sunday", "Tuesday"]),
    });
  });

  it("says the week is fully planned rather than an empty list", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0));

    // Local calendar date, not .toISOString() -- that converts to UTC and
    // drifts a day in any positive-UTC-offset test environment, which is
    // exactly the class of bug this resolver itself avoids (see formatDate).
    const localDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    mockFetch(() => ({
      json: Array.from({ length: 7 }, (_, i) => ({
        planned_date: localDate(new Date(2026, 7, 22 + i)),
      })),
    }));

    const result = await resolveIntent({
      kind: "mealPlanGaps",
      face: "chef",
      rawText: "any gaps this week",
    });

    expect(result.text.toLowerCase()).toMatch(/no gaps|fully planned/);
  });
});

// Stage 4 (HUB-30) — a `capabilityAction` intent is what BOTH a matched
// taught template (native, Layer 2) and a confirmed Ask AI propose_action
// (Stage 3) reduce to before resolveIntent runs. These tests exercise it
// directly rather than through the router, since the router's own matching
// is pinned separately (templates/matcher.test.ts).
describe("resolveIntent — capabilityAction", () => {
  it("validates slots against the target capability and executes the SAME resolver the native router uses", async () => {
    mockFetch(() => ({ json: { item: { id: "item-1" } } }));
    mockMaybeSingleByTable.mockImplementation(async (table: string) =>
      table === "reminder_details"
        ? { data: { due_at: localToISO(localDateISO(1), "09:00") }, error: null }
        : { data: null, error: null },
    );

    const result = await resolveIntent({
      kind: "capabilityAction",
      face: "schedule",
      capabilityId: "reminder.reschedule",
      slots: { itemId: "item-1", whenText: "11", title: "Water the plants" },
      rawText: "shift it to 11",
    });

    const patch = callTo("/api/items/item-1", "PATCH");
    expect(patch?.body?.due_at).toBe(localToISO(localDateISO(1), "11:00"));
    expect(result.text).toContain("Water the plants");
  });

  it("degrades to the unknown reply for a capability id that doesn't exist — never throws", async () => {
    const result = await resolveIntent({
      kind: "capabilityAction",
      face: "schedule",
      capabilityId: "reminder.teleport",
      slots: {},
      rawText: "beam it somewhere",
    });
    expect(result.text.length).toBeGreaterThan(0);
    expect(callTo("/api/items/", "PATCH")).toBeUndefined();
  });

  it("degrades to the unknown reply when slots fail the capability's own Zod schema — never executes", async () => {
    const result = await resolveIntent({
      kind: "capabilityAction",
      face: "schedule",
      capabilityId: "reminder.reschedule",
      slots: { whenText: "11" }, // missing required itemId
      rawText: "shift it to 11",
    });
    expect(result.text.length).toBeGreaterThan(0);
    expect(callTo("/api/items/", "PATCH")).toBeUndefined();
  });
});

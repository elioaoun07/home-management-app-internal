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
import type { EraBudgetSubmitResult } from "../useEraBudgetSubmit";
import type { Intent } from "../types";
import { resolveIntent } from "./resolveIntent";
import { scheduleRouter } from "./schedule";

// safeFetch pre-flights every request through the connectivity manager, whose
// module-level state is seeded from `navigator.onLine` at import time — which
// under vitest's node environment is `undefined`, i.e. permanently "offline".
// Connectivity is not what these tests are about, so pin it online.
vi.mock("@/lib/connectivityManager", () => ({
  isReallyOnline: () => true,
  markOffline: () => {},
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

beforeEach(() => {
  calls.length = 0;
  // safeFetch narrates every request; keep the suite output readable.
  vi.spyOn(console, "log").mockImplementation(() => {});
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
    const result = await resolveIntent(reminderIntent("remind me to call the bank"));

    const post = postTo("/api/items");
    expect(post).toBeDefined();
    expect(post!.body).toMatchObject({ type: "reminder", title: "Call the bank" });
    expect(post!.body!.title).not.toContain("remind me");
    expect(result.metadata).toMatchObject({ itemId: "item-1" });
  });

  it("omits due_at entirely when no date was expressed (confidence.date === 0)", async () => {
    await resolveIntent(reminderIntent("remind me to call the bank"));

    const post = postTo("/api/items")!;
    expect(post.body).not.toHaveProperty("due_at");
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

    const intent = reminderIntent("remind me to call the bank");
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

  it("never implies a nudge is coming when the reminder has no date", async () => {
    const intent = reminderIntent("remind me to water the plants");

    const variants = await everyVariant(() => resolveIntent(intent));

    for (const v of variants) {
      expect(v.toLowerCase()).toContain("water the plants");
      // Every undated variant must say so — "date", "time", "undated" or
      // "when". A variant that only says "Saved!" would strand the user
      // believing an alert exists.
      expect(v.toLowerCase()).toMatch(/\b(date|time|undated|when)\b/);
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

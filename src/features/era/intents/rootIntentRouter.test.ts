// Table-driven behavior lock for the ERA root intent router (HUB-1).
//
// The router is deliberately impure: rootIntentRouter.parse reads
// useEraStore.getState().activeFaceKey to decide which per-face router gets the
// first crack, then falls back across the other faces. Each row therefore pins
// `active` and we set the store before parsing so both the active-face path AND
// the cross-face fallback ordering are exercised deterministically (AC2).
//
// This suite asserts the FINAL post-HUB-1 behavior: common intents route to the
// right kind + slots, while weak / ambiguous / hostile inputs resolve to a
// clarify/unknown outcome that fires NO action (no draftTransaction, no
// confident face switch on a soft match) — AC1 + AC3.
import { beforeEach, describe, expect, it } from "vitest";
import type { FaceKey, Intent } from "../types";
import { useEraStore } from "../useEraStore";
import { rootIntentRouter } from "./index";

interface RouteCase {
  /** Human-readable label for the it.each row. */
  readonly name: string;
  /** Utterance fed to the router verbatim. */
  readonly text: string;
  /** activeFaceKey pinned in the store before parsing. */
  readonly active: FaceKey;
  /** Expected discriminant. */
  readonly kind: Intent["kind"];
  // Optional slot assertions — only checked when present.
  readonly reason?: "ambiguous" | "weak";
  readonly face?: FaceKey;
  readonly amount?: number;
  readonly scope?: "self" | "partner" | "household";
  readonly categoryHint?: RegExp;
  readonly dish?: string;
  /** Exact reminder title — the router stores the parsed CLEAN title. */
  readonly title?: string;
  readonly query?: RegExp;
  readonly label?: RegExp;
  /**
   * For `todaySchedule` rows that name a specific day (HUB Stage 0 fix):
   * asserts `intent.dateISO` resolves to this day-of-week (0=Sun..6=Sat)
   * rather than pinning an exact date, since "Saturday" resolves relative
   * to whatever day the suite runs on.
   */
  readonly dayOfWeek?: number;
}

const CASES: readonly RouteCase[] = [
  // ── Budget — active-face path ────────────────────────────────────────────
  {
    name: "real spend with currency drafts a transaction",
    text: "I paid $25 on fuel",
    active: "budget",
    kind: "draftTransaction",
    amount: 25,
  },
  {
    name: "monthly spend, self scope",
    text: "how much did I spend this month",
    active: "budget",
    kind: "monthSpend",
    scope: "self",
  },
  {
    name: "monthly spend, partner scope",
    text: "how much did my partner spend this month",
    active: "budget",
    kind: "monthSpend",
    scope: "partner",
  },
  {
    name: "monthly spend, household scope + category hint",
    text: "how much did we spend on groceries this month",
    active: "budget",
    kind: "monthSpend",
    scope: "household",
    categoryHint: /groceries/,
  },
  {
    name: "show my budget → analytics",
    text: "show my budget",
    active: "budget",
    kind: "showAnalytics",
  },
  // ── Budget — regression guards (AC3) ─────────────────────────────────────
  {
    name: "REGRESSION: 'spent 2 hours studying' never drafts money",
    text: "spent 2 hours studying",
    active: "budget",
    kind: "unknown",
  },
  {
    name: "REGRESSION: weak money word does not confidently act",
    text: "I need some money",
    active: "budget",
    kind: "clarify",
    reason: "weak",
  },
  {
    name: "REGRESSION: a weak local clarify does not block a strong cross-face reminder",
    text: "remind me to buy groceries",
    active: "budget",
    kind: "draftReminder",
    face: "schedule",
    title: "Buy groceries",
  },
  // ── Budget — cross-face fallback (active is NOT budget) ───────────────────
  {
    name: "cross-face: strong budget noun switches to budget",
    text: "show my account balance",
    active: "schedule",
    kind: "switchFace",
    face: "budget",
  },

  // ── Schedule — active-face path ──────────────────────────────────────────
  {
    name: "today's schedule query",
    text: "what do I have to do today",
    active: "schedule",
    kind: "todaySchedule",
  },
  {
    name: "this week's schedule query",
    text: "what's on my schedule this week",
    active: "schedule",
    kind: "todaySchedule",
  },
  {
    // Stage 0 fix: this used to always answer for TODAY regardless of the
    // day named in the utterance — the regex matched on "schedule" alone.
    name: "named-day schedule query resolves that day, not today",
    text: "what's on my schedule Saturday?",
    active: "schedule",
    kind: "todaySchedule",
    dayOfWeek: 6,
  },
  {
    name: "remind me → reminder draft strips the lead-in, keeping the clean title",
    text: "remind me to call the bank",
    active: "schedule",
    kind: "draftReminder",
    title: "Call the bank",
  },
  // ── Schedule — Stage 1 focus-memory follow-ups (pronoun-gated) ────────────
  {
    name: "change it to <time> → reschedule",
    text: "Change it to 11.",
    active: "schedule",
    kind: "reminderReschedule",
  },
  {
    name: "move that to <time> → reschedule",
    text: "Could you move that to tomorrow at 5?",
    active: "schedule",
    kind: "reminderReschedule",
  },
  {
    name: "mark it done → complete",
    text: "Mark it done.",
    active: "schedule",
    kind: "reminderComplete",
  },
  {
    name: "delete that one → delete",
    text: "Delete that one.",
    active: "schedule",
    kind: "reminderDelete",
  },
  {
    name: "appointment noun switches to schedule",
    text: "add a dentist appointment",
    active: "schedule",
    kind: "switchFace",
    face: "schedule",
  },
  // ── Schedule — cross-face fallback (active is budget) ─────────────────────
  {
    name: "cross-face: 'due today' routes to schedule from budget",
    text: "what do I have due today",
    active: "budget",
    kind: "todaySchedule",
  },
  // REGRESSION (found via real usage 2026-08-27): brainRouter's broad "what's
  // X" recall pattern used to ALSO match this exact phrase (as a memory
  // recall for the literal string "on my schedule this saturday"), so with a
  // non-schedule active face the root router saw two confident cross-face
  // hits and asked the user to clarify instead of answering. The existing
  // "named-day schedule query" row above only ever exercised this with
  // Schedule already active, which short-circuits before the cross-face
  // ambiguity check ever runs — this row is the one that actually catches
  // it. HUB-26's acceptance phrase must resolve uniquely through the FULL
  // root router, not just in scheduleRouter isolation.
  {
    name: "REGRESSION: 'what's on my schedule this Saturday' resolves uniquely to Schedule, not an ambiguous clarify",
    text: "what's on my schedule this Saturday",
    active: "budget",
    kind: "todaySchedule",
    dayOfWeek: 6,
  },
  // REGRESSION (same session): the bare word "schedule" matched nothing in
  // scheduleRouter (todaySchedule needs a question word too; the generic
  // switch list had every schedule-domain noun EXCEPT "schedule" itself),
  // so it fell all the way through to "unknown" instead of selecting the
  // Schedule face.
  {
    name: "REGRESSION: bare 'Schedule' selects the Schedule face",
    text: "Schedule",
    active: "budget",
    kind: "switchFace",
    face: "schedule",
  },

  // ── Chef — active-face path ──────────────────────────────────────────────
  {
    name: "cook X → recipe search",
    text: "I want to cook lasagna",
    active: "chef",
    kind: "recipeSearch",
    dish: "lasagna",
  },
  {
    name: "recipe for X → recipe search",
    text: "recipe for chicken soup",
    active: "chef",
    kind: "recipeSearch",
    dish: "chicken soup",
  },
  {
    name: "what's the recipe for X → recipe search",
    text: "what's the recipe for pancakes",
    active: "chef",
    kind: "recipeSearch",
    dish: "pancakes",
  },
  {
    name: "dinner noun switches to chef",
    text: "what should I make for dinner",
    active: "chef",
    kind: "switchFace",
    face: "chef",
  },
  // ── Chef — cross-face fallback (active is budget) ─────────────────────────
  {
    name: "cross-face: 'cook pasta tonight' routes to chef from budget",
    text: "I want to cook pasta tonight",
    active: "budget",
    kind: "recipeSearch",
    dish: "pasta",
  },

  // ── Brain — active-face path ─────────────────────────────────────────────
  {
    name: "remember X is Y → memory save",
    text: "remember that my locker code is 4821",
    active: "brain",
    kind: "memorySave",
    label: /locker/,
  },
  {
    name: "what's my X → memory recall",
    text: "what's my wifi password",
    active: "brain",
    kind: "memoryRecall",
    query: /wifi/,
  },
  {
    name: "inventory noun switches to brain",
    text: "check the inventory",
    active: "brain",
    kind: "switchFace",
    face: "brain",
  },
  // ── Brain — cross-face fallback (active is budget) ────────────────────────
  {
    name: "cross-face: 'do we have …' routes to brain recall from budget",
    text: "do we have any milk in stock",
    active: "budget",
    kind: "memoryRecall",
    query: /milk/,
  },

  // ── Greetings (any face) ─────────────────────────────────────────────────
  { name: "hello → greeting", text: "hello", active: "budget", kind: "greeting" },
  {
    name: "good evening → greeting",
    text: "good evening",
    active: "schedule",
    kind: "greeting",
  },
  {
    name: "what's up → greeting",
    text: "what's up",
    active: "chef",
    kind: "greeting",
  },

  // ── Explicit face-switch commands (win regardless of active face) ─────────
  {
    name: "open schedule → switchFace schedule",
    text: "open schedule",
    active: "budget",
    kind: "switchFace",
    face: "schedule",
  },
  {
    name: "switch to chef → switchFace chef",
    text: "switch to chef",
    active: "budget",
    kind: "switchFace",
    face: "chef",
  },
  {
    name: "go to brain → switchFace brain",
    text: "go to brain",
    active: "budget",
    kind: "switchFace",
    face: "brain",
  },
  {
    name: "open budget → switchFace budget (from another face)",
    text: "open budget",
    active: "schedule",
    kind: "switchFace",
    face: "budget",
  },

  // ── Confidence tiering: a strong slot-filled hit beats a generic keyword ──
  // echo from another face — NOT ambiguous. "dinner" trips chef's generic
  // switchFace sniff, but schedule's "remind me" pattern is a confident,
  // fully slot-filled draftReminder and should win outright.
  {
    name: "strong beats weak: reminder wins over chef's generic 'dinner' echo",
    text: "remind me to buy dinner ingredients",
    active: "budget",
    kind: "draftReminder",
    face: "schedule",
    title: "Buy dinner ingredients",
  },
  // ── Ambiguous → clarify (more than one non-active face matches) ───────────
  {
    name: "ambiguous: schedule + chef + brain all match → clarify",
    text: "save the dinner meeting note",
    active: "budget",
    kind: "clarify",
    reason: "ambiguous",
  },

  // ── Hostile / gibberish → unknown (no action) ────────────────────────────
  {
    name: "gibberish → unknown",
    text: "asdfghjkl qwerty",
    active: "budget",
    kind: "unknown",
  },
  {
    name: "hostile chatter → unknown",
    text: "you are completely useless",
    active: "budget",
    kind: "unknown",
  },
  {
    name: "empty string → unknown",
    text: "",
    active: "budget",
    kind: "unknown",
  },
  {
    name: "whitespace only → unknown",
    text: "   ",
    active: "schedule",
    kind: "unknown",
  },

  // ── Chef — meal planning (Slice 5) ───────────────────────────────────────
  {
    name: "list recipes",
    text: "what recipes do I have",
    active: "chef",
    kind: "listRecipes",
  },
  {
    name: "show my recipes",
    text: "show my recipes",
    active: "chef",
    kind: "listRecipes",
  },
  {
    name: "assign a meal to a day and meal type",
    text: "assign chicken to thursday dinner",
    active: "chef",
    kind: "assignMeal",
    dish: "chicken",
  },
  {
    name: "assign a meal, alternate phrasing",
    text: "put the chicken parm on thursday for dinner",
    active: "chef",
    kind: "assignMeal",
    dish: "chicken parm",
  },
  {
    name: "meal plan gaps",
    text: "what's unassigned this week for meals",
    active: "chef",
    kind: "mealPlanGaps",
  },
  {
    name: "meal plan gaps, alternate phrasing",
    text: "any gaps in the meal plan this week",
    active: "chef",
    kind: "mealPlanGaps",
  },

  // ── Budget — Slice 2 capabilities ────────────────────────────────────────
  {
    name: "transfer between own accounts",
    text: "transfer 50 from wallet to savings",
    active: "budget",
    kind: "transfer",
    amount: 50,
  },
  {
    name: "transfer with trailing dollar sign on the amount",
    text: "Transfer 2$ from my account to drawer",
    active: "budget",
    kind: "transfer",
    amount: 2,
  },
  {
    name: "record a debt",
    text: "John owes me $30 for lunch",
    active: "budget",
    kind: "recordDebt",
    amount: 30,
  },
  {
    name: "list pending drafts",
    text: "what drafts do I have",
    active: "budget",
    kind: "listDrafts",
  },
  {
    name: "confirm a draft by hint",
    text: "confirm the fuel draft",
    active: "budget",
    kind: "confirmDraft",
  },
];

describe("rootIntentRouter", () => {
  beforeEach(() => {
    useEraStore.getState().reset();
  });

  it("covers at least 30 utterances", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(30);
  });

  it.each(CASES)(
    "$name  [active=$active]",
    ({ text, active, kind, ...expected }) => {
      // Deterministically pin the impure activeFaceKey dependency (AC2).
      useEraStore.setState({ activeFaceKey: active });

      const intent = rootIntentRouter.parse(text);

      expect(intent.kind).toBe(kind);

      if (expected.reason !== undefined) {
        expect(intent).toMatchObject({ reason: expected.reason });
      }
      if (expected.face !== undefined) {
        expect(intent).toMatchObject({ face: expected.face });
      }
      if (expected.amount !== undefined) {
        expect(intent).toMatchObject({ amount: expected.amount });
      }
      if (expected.scope !== undefined) {
        expect(intent).toMatchObject({ scope: expected.scope });
      }
      if (expected.dish !== undefined) {
        expect(intent).toMatchObject({ dish: expected.dish });
      }
      if (expected.title !== undefined) {
        expect(intent).toMatchObject({ title: expected.title });
      }
      if (expected.categoryHint !== undefined) {
        expect(
          (intent as Extract<Intent, { kind: "monthSpend" }>).categoryHint ?? "",
        ).toMatch(expected.categoryHint);
      }
      if (expected.query !== undefined) {
        expect(
          (intent as Extract<Intent, { kind: "memoryRecall" }>).query,
        ).toMatch(expected.query);
      }
      if (expected.label !== undefined) {
        expect(
          (intent as Extract<Intent, { kind: "memorySave" }>).label,
        ).toMatch(expected.label);
      }
      if (expected.dayOfWeek !== undefined) {
        const dateISO = (intent as Extract<Intent, { kind: "todaySchedule" }>)
          .dateISO;
        expect(dateISO).toBeDefined();
        expect(new Date(`${dateISO}T12:00:00`).getDay()).toBe(
          expected.dayOfWeek,
        );
      }
    },
  );

  it("REGRESSION: 'spent 2 hours studying' produces no money draft", () => {
    useEraStore.setState({ activeFaceKey: "budget" });
    const intent = rootIntentRouter.parse("spent 2 hours studying");
    expect(intent.kind).not.toBe("draftTransaction");
    expect(intent).not.toHaveProperty("amount");
  });

  it("REGRESSION: a weak money word does not confidently switch faces", () => {
    useEraStore.setState({ activeFaceKey: "budget" });
    const intent = rootIntentRouter.parse("I need some money");
    expect(intent.kind).not.toBe("switchFace");
    expect(intent.kind).toBe("clarify");
  });

  // Stage 1 focus-memory follow-ups are pronoun-gated specifically so
  // "move"/"cancel" keep meaning what they already mean elsewhere.
  it("REGRESSION: 'move $100 to savings' (no pronoun) is not a reminder reschedule", () => {
    useEraStore.setState({ activeFaceKey: "budget" });
    const intent = rootIntentRouter.parse("move $100 to savings");
    expect(intent.kind).not.toBe("reminderReschedule");
  });

  it("REGRESSION: 'move dinner to Wednesday' (no pronoun) is not a reminder reschedule", () => {
    useEraStore.setState({ activeFaceKey: "chef" });
    const intent = rootIntentRouter.parse("move dinner to Wednesday");
    expect(intent.kind).not.toBe("reminderReschedule");
  });
});

describe("rootIntentRouter — Stage 1 focus-memory resolution", () => {
  beforeEach(() => {
    useEraStore.getState().reset();
    useEraStore.setState({ activeFaceKey: "schedule" });
  });

  it("resolves the pronoun to the most recently focused reminder", () => {
    useEraStore.getState().pushFocusEntity({
      id: "item-123",
      type: "reminder",
      title: "Water the plants",
      addedAt: Date.now(),
    });

    const intent = rootIntentRouter.parse("Change it to 11.");
    expect(intent).toMatchObject({
      kind: "reminderReschedule",
      itemId: "item-123",
      title: "Water the plants",
      whenText: "11",
    });
  });

  it("resolves itemId to null (not a guess) when nothing is in focus", () => {
    const intent = rootIntentRouter.parse("Delete that one.");
    expect(intent).toMatchObject({ kind: "reminderDelete", itemId: null });
  });
});

// Stage 4 (HUB-30) — Layer 2 taught-phrase matching. Only reached after
// every built-in router (Layer 1) has missed — these utterances are
// deliberately NOT phrasings any built-in router regex would catch.
describe("rootIntentRouter — Stage 4 taught-phrase matching (Layer 2)", () => {
  beforeEach(() => {
    useEraStore.getState().reset();
    useEraStore.setState({ activeFaceKey: "budget" }); // deliberately NOT schedule — a template match shouldn't need it
  });

  it("matches a taught phrase only after every built-in router has missed, and resolves its focus reference", () => {
    useEraStore.getState().pushFocusEntity({
      id: "item-123",
      type: "reminder",
      title: "Water the plants",
      addedAt: Date.now(),
    });
    useEraStore.getState().setTemplates([
      {
        id: "tpl-1",
        capabilityId: "reminder.reschedule",
        patternText: "nudge it to {whenText}",
        slotNames: ["whenText"],
        enabled: true,
      },
    ]);

    const intent = rootIntentRouter.parse("nudge it to 5pm");
    expect(intent).toMatchObject({
      kind: "capabilityAction",
      face: "schedule",
      capabilityId: "reminder.reschedule",
      slots: { itemId: "item-123", whenText: "5pm", title: "Water the plants" },
      sourceTemplateId: "tpl-1",
    });
  });

  it("falls through to unknown, not a dead end, when the entity reference can't be resolved", () => {
    useEraStore.getState().setTemplates([
      {
        id: "tpl-1",
        capabilityId: "reminder.reschedule",
        patternText: "nudge it to {whenText}",
        slotNames: ["whenText"],
        enabled: true,
      },
    ]);
    // No focus entity pushed — nothing to resolve "it" against.
    const intent = rootIntentRouter.parse("nudge it to 5pm");
    expect(intent.kind).toBe("unknown");
  });

  it("never matches a disabled template", () => {
    useEraStore.getState().pushFocusEntity({
      id: "item-123",
      type: "reminder",
      title: "Water the plants",
      addedAt: Date.now(),
    });
    useEraStore.getState().setTemplates([
      {
        id: "tpl-1",
        capabilityId: "reminder.reschedule",
        patternText: "nudge it to {whenText}",
        slotNames: ["whenText"],
        enabled: false,
      },
    ]);
    expect(rootIntentRouter.parse("nudge it to 5pm").kind).toBe("unknown");
  });

  it("a confident built-in match wins even when a template would also match", () => {
    useEraStore.getState().pushFocusEntity({
      id: "item-123",
      type: "reminder",
      title: "Water the plants",
      addedAt: Date.now(),
    });
    useEraStore.setState({ activeFaceKey: "schedule" });
    useEraStore.getState().setTemplates([
      {
        id: "tpl-1",
        capabilityId: "reminder.reschedule",
        patternText: "change it to {whenText}",
        slotNames: ["whenText"],
        enabled: true,
      },
    ]);
    // The built-in schedule router already handles this phrasing (Stage 1) —
    // Layer 2 must never get a chance to override a confident Layer 1 hit.
    const intent = rootIntentRouter.parse("change it to 5pm");
    expect(intent.kind).toBe("reminderReschedule");
  });

  // HUB-34 regression — a template that captured a NAMED reference must act
  // on the entity that name matches, not just whatever was touched most
  // recently. Before this fix, matchAgainstTemplates discarded the captured
  // reference entirely and always resolved "it" against focus memory.
  it("resolves a {target}-captured reference by name, not by recency", () => {
    useEraStore.getState().pushFocusEntity({
      id: "recent-id",
      type: "reminder",
      title: "Water the plants",
      addedAt: Date.now() - 100,
    });
    useEraStore.getState().pushFocusEntity({
      id: "dentist-id",
      type: "reminder",
      title: "Call the dentist",
      addedAt: Date.now() - 500, // older than the reminder above
    });
    useEraStore.getState().setTemplates([
      {
        id: "tpl-1",
        capabilityId: "reminder.reschedule",
        patternText: "shift {target} to {whenText}",
        slotNames: ["target", "whenText"],
        enabled: true,
      },
    ]);

    const intent = rootIntentRouter.parse("shift the dentist reminder to 5pm");
    expect(intent).toMatchObject({
      kind: "capabilityAction",
      capabilityId: "reminder.reschedule",
      slots: { itemId: "dentist-id", whenText: "5pm", title: "Call the dentist" },
      sourceTemplateId: "tpl-1",
    });
  });

  it("a legacy {title}-captured reference (taught before HUB-34) still resolves by name", () => {
    useEraStore.getState().pushFocusEntity({
      id: "recent-id",
      type: "reminder",
      title: "Water the plants",
      addedAt: Date.now() - 100,
    });
    useEraStore.getState().pushFocusEntity({
      id: "dentist-id",
      type: "reminder",
      title: "Call the dentist",
      addedAt: Date.now() - 500,
    });
    useEraStore.getState().setTemplates([
      {
        id: "tpl-1",
        capabilityId: "reminder.reschedule",
        patternText: "shift {title} to {whenText}",
        slotNames: ["title", "whenText"],
        enabled: true,
      },
    ]);

    const intent = rootIntentRouter.parse("shift the dentist reminder to 5pm");
    expect(intent).toMatchObject({
      kind: "capabilityAction",
      slots: { itemId: "dentist-id" },
    });
  });

  // A1 regression — a taught template must not be shadowed by the active
  // face's own weak "clarify" (previously Layer 2 ran only after that weak
  // fallback, so this template was unreachable whenever budget was active).
  it("a taught template wins over the active face's own weak clarify", () => {
    useEraStore.getState().setTemplates([
      {
        id: "tpl-1",
        capabilityId: "reminder.create",
        patternText: "grocery run",
        slotNames: [],
        enabled: true,
      },
    ]);
    // Budget's own weak-money-word clarify would otherwise fire on "grocery".
    const intent = rootIntentRouter.parse("grocery run");
    expect(intent).toMatchObject({
      kind: "capabilityAction",
      capabilityId: "reminder.create",
      sourceTemplateId: "tpl-1",
    });
  });
});

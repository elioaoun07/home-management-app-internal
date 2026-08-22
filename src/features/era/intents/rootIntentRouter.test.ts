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
    name: "remind me → reminder draft strips the lead-in, keeping the clean title",
    text: "remind me to call the bank",
    active: "schedule",
    kind: "draftReminder",
    title: "Call the bank",
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
});

// src/features/era/types.ts
// ERA Phase 0 — type contracts for the omnipotent assistant shell.
// These are deliberately small and stable; Phase 1+ adds animation metadata,
// Phase 2 swaps the stub IntentRouter for a Gemini-backed implementation.

import type { ERAModuleKey } from "@/components/shared/ERAMark";
import type { ItemPriority } from "@/types/items";

/**
 * The set of ERA "faces" available in Phase 0. Doctor / Hub / Focus are
 * intentionally deferred. Adding a face later means: add the key here, add a
 * row to FACES in faceRegistry.ts, and the registry-driven UI picks it up
 * automatically.
 */
export type FaceKey = "budget" | "schedule" | "chef" | "brain";

/**
 * Declarative description of a face. The shell is purely registry-driven:
 * iterating over FACES yields the chips, the rail, and the placeholder body
 * for each face. `eraModuleKey` connects to the existing ERAMark identity
 * system in src/components/shared/ERAMark.tsx — do not invent a parallel
 * icon system.
 */
export interface Face {
  /** Stable identifier; never user-facing. */
  key: FaceKey;
  /** User-facing short label, e.g. "Budget". */
  label: string;
  /** One-line description shown on the placeholder body and tooltips. */
  description: string;
  /** Maps to the existing ERAMark module identity (icon + hue/sat/lum). */
  eraModuleKey: ERAModuleKey;
  /** Optional deep-link route this face represents in Phase 2+. */
  route?: string;
}

/**
 * Discriminated union of intents the IntentRouter can produce. Phase 0
 * implements only `switchFace` and `unknown`; the others are reserved so
 * downstream consumers can pattern-match exhaustively today and gain real
 * behavior in later phases without a type churn.
 */
export type Intent =
  | { kind: "switchFace"; face: FaceKey; rawText: string }
  | {
      kind: "draftTransaction";
      face: "budget";
      amount?: number;
      description?: string;
      rawText: string;
    }
  | {
      kind: "draftReminder";
      face: "schedule";
      title?: string;
      rawText: string;
    }
  // Stage 1 — focus-memory follow-ups ("change it to 11", "delete that
  // one"). `itemId`/`title` are resolved by the router BEFORE the intent is
  // built (the router already reads `useEraStore` for `activeFaceKey`, so
  // reading `focusEntities` there too is the same established pattern —
  // see rootIntentRouter.test.ts's header comment). `null` means the pronoun
  // couldn't be resolved (no live focus entity) and the resolver must ask
  // rather than guess.
  | {
      kind: "reminderReschedule";
      face: "schedule";
      itemId: string | null;
      title: string | null;
      /** Trailing text naming the new day/time, e.g. "11" or "tomorrow at 5". */
      whenText: string;
      rawText: string;
    }
  | {
      kind: "reminderComplete";
      face: "schedule";
      itemId: string | null;
      title: string | null;
      rawText: string;
    }
  | {
      kind: "reminderDelete";
      face: "schedule";
      itemId: string | null;
      title: string | null;
      rawText: string;
    }
  | { kind: "showAnalytics"; face: "budget"; rawText: string }
  // Phase 0.5 — native chatbot intents
  | {
      kind: "todaySchedule";
      face: "schedule";
      rawText: string;
      /**
       * yyyy-MM-dd of the day being asked about. Absent = today (the
       * original behavior). Stage 0 fix: "what's on my schedule Saturday"
       * used to always answer for today because the router matched on
       * generic schedule nouns and ignored the day word entirely.
       */
      dateISO?: string;
    }
  | {
      kind: "monthSpend";
      face: "budget";
      scope: "self" | "partner" | "household";
      categoryHint?: string;
      rawText: string;
    }
  // Slice 2 — Budget capability set
  | {
      kind: "transfer";
      face: "budget";
      amount?: number;
      fromHint?: string;
      toHint?: string;
      rawText: string;
    }
  | {
      kind: "recordDebt";
      face: "budget";
      debtorName?: string;
      amount?: number;
      notes?: string;
      rawText: string;
    }
  | { kind: "listDrafts"; face: "budget"; rawText: string }
  | { kind: "confirmDraft"; face: "budget"; hint?: string; rawText: string }
  | { kind: "recipeSearch"; face: "chef"; dish: string; rawText: string }
  | { kind: "recipeOfferGenerate"; face: "chef"; dish: string; rawText: string }
  // Slice 5 — meal planning
  | { kind: "listRecipes"; face: "chef"; rawText: string }
  | {
      kind: "assignMeal";
      face: "chef";
      dish?: string;
      dayHint?: string;
      mealType?: "breakfast" | "lunch" | "dinner" | "snack";
      rawText: string;
    }
  | { kind: "mealPlanGaps"; face: "chef"; rawText: string }
  | {
      kind: "memorySave";
      face: "brain";
      label: string;
      value: string;
      rawText: string;
    }
  | { kind: "memoryRecall"; face: "brain"; query: string; rawText: string }
  | { kind: "greeting"; rawText: string }
  // Stage 4 (HUB-30) — a taught-phrase template (era_templates) matched the
  // utterance after every built-in router missed. `slots` are the captured
  // named slots plus, for capabilities with an `entityRefSlot`, the real id
  // already resolved from focus memory (see intents/index.ts's matcher) —
  // never a raw value a template captured itself. `resolveIntent` validates
  // `slots` against the target capability's own Zod schema before executing,
  // the same gate Ask AI proposals go through.
  | {
      kind: "capabilityAction";
      face: FaceKey;
      capabilityId: string;
      slots: Record<string, unknown>;
      rawText: string;
      /** The template that produced this match, so a successful run can bump its match_count. */
      sourceTemplateId?: string;
    }
  // Graceful fallback (HUB-1): a misrecognized intent asks the user to clarify
  // instead of firing a wrong action. `ambiguous` = more than one face matched
  // and we cannot know which was meant; `weak` = a single incidental keyword
  // match too soft to act on confidently. Deliberately carries no `face`, so
  // downstream consumers treat it like `unknown` (no face switch, no draft).
  | { kind: "clarify"; reason: "ambiguous" | "weak"; rawText: string }
  | { kind: "unknown"; rawText: string };

/**
 * A question ERA is waiting on an answer to (Slice 3). Deliberately narrow —
 * one shape, one missing slot — rather than a general multi-slot framework;
 * widen this only when a second required-slot case actually needs it.
 * Lives in-memory (`useEraStore`), not persisted: a page reload loses the
 * pending question, same as any other in-flight browser state.
 */
export interface EraPendingTurn {
  kind: "draftReminder";
  title: string;
  priority: ItemPriority;
  rawText: string;
  createdAt: number;
}

/**
 * A confirm card ERA is showing after "Ask AI" proposed an action (Slice 4).
 * Deliberately one shape — the only proposal kind currently built. Never
 * written until the user taps Confirm; see `useEraAskAI.confirmProposal`.
 */
export type EraActiveProposal =
  | {
      kind: "propose_nfc_reminder";
      text: string;
      reminderTitle: string;
      nfcTagId: string;
      nfcTagLabel: string;
      targetState: string;
    }
  // Stage 3 (HUB-29) — Ask AI mapped the request to a real capability in the
  // registry and its slots already validated server-side (see
  // src/lib/ai/eraAskProposal.ts). `slots` is the final, resolved object —
  // any entity reference has already been swapped for a real id from focus
  // memory, never a model-invented one. `sourceText` is the ORIGINAL
  // question the user asked Ask AI, kept so a successful confirm can learn a
  // phrasing template from it (Stage 4).
  | {
      kind: "propose_action";
      text: string;
      capabilityId: string;
      slots: Record<string, unknown>;
      sourceText: string;
    };

/**
 * IntentRouter contract. The Phase 0 stub matches a handful of keywords;
 * Phase 2 replaces the implementation (not the contract) with Gemini
 * structured output. Always synchronous in Phase 0 to keep the command bar
 * latency-free; the Phase 2 implementation will return Promise<Intent>, so
 * callers should be ready to await.
 */
export interface IntentRouter {
  parse(text: string): Intent;
}

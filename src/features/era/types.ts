// src/features/era/types.ts
// ERA Phase 0 — type contracts for the omnipotent assistant shell.
// These are deliberately small and stable; Phase 1+ adds animation metadata,
// Phase 2 swaps the stub IntentRouter for a Gemini-backed implementation.

import type { ERAModuleKey } from "@/components/shared/ERAMark";
import type { AmountCurrency } from "@/lib/nlp/amount";
import type { SpeechAct } from "./intents/speechAct";
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
      /** HUB-75 — currency named by an explicit marker; absent = unmarked. */
      currency?: AmountCurrency;
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
      /** HUB-78 — a named target not in focus ("the dentist"); the resolver looks it up. */
      targetHint?: string;
      /** Trailing text naming the new day/time, e.g. "11" or "tomorrow at 5". */
      whenText: string;
      rawText: string;
    }
  | {
      kind: "reminderComplete";
      face: "schedule";
      itemId: string | null;
      title: string | null;
      /** HUB-78 — a named target not in focus ("the dentist"); the resolver looks it up. */
      targetHint?: string;
      rawText: string;
    }
  | {
      kind: "reminderDelete";
      face: "schedule";
      itemId: string | null;
      title: string | null;
      /** HUB-78 — a named target not in focus ("the dentist"); the resolver looks it up. */
      targetHint?: string;
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
      /** HUB-79 — "how much did I pay today": a shorter window than the billing month. */
      period?: "today" | "yesterday" | "week";
      rawText: string;
    }
  // Slice 2 — Budget capability set
  | {
      kind: "transfer";
      face: "budget";
      amount?: number;
      currency?: AmountCurrency;
      fromHint?: string;
      toHint?: string;
      rawText: string;
    }
  | {
      kind: "recordDebt";
      face: "budget";
      debtorName?: string;
      amount?: number;
      currency?: AmountCurrency;
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
  //
  // HUB-76 — `speechAct` = the sentence would have been a write, but it is
  // negated / hypothetical / a question / conditional / reported speech, so
  // the router refuses to act on it (see intents/speechAct.ts). `act` says
  // which; a negation is answered deterministically and never escalated.
  | { kind: "clarify"; reason: "ambiguous" | "weak"; rawText: string }
  | {
      kind: "clarify";
      reason: "speechAct";
      act: Exclude<SpeechAct, "command">;
      /** The write the router would otherwise have produced. */
      blocked: Intent["kind"];
      rawText: string;
    }
  // HUB-78 — the turn answered an outstanding chip question (EraPendingSlot).
  | { kind: "slotAnswer"; face: FaceKey; capability: string; rawText: string }
  // HUB-79 — core coverage families.
  | { kind: "captureIncome"; face: "budget"; amount?: number; currency?: AmountCurrency; rawText: string }
  | { kind: "splitExpense"; face: "budget"; amount?: number; withName?: string; rawText: string }
  | { kind: "balanceRead"; face: "budget"; accountHint?: string; rawText: string }
  | { kind: "coverRecurring"; face: "budget"; nameHint: string; rawText: string }
  | { kind: "timeNow"; rawText: string }
  /** HUB-80 — "forget that": revoke the rule the last turn applied. Faceless. */
  | { kind: "forgetRule"; rawText: string }
  /** HUB-80 — "the box means Drawer": a personal alias for an account. */
  | { kind: "defineAlias"; face: "budget"; phrase: string; target: string; rawText: string }
  /** HUB-81 — estate reads. */
  | { kind: "activityRead"; face: "brain"; actor?: "me" | "partner"; window: "today" | "recent"; rawText: string }
  | { kind: "futurePurchasesRead"; face: "budget"; rawText: string }
  /** HUB-81 — open a module's page (reach level "navigation"). Faceless. */
  | { kind: "navigate"; to: string; label: string; module: string; rawText: string }
  /** HUB-79 — skip the next occurrence of a recurring reminder (an exception, never a rule edit). */
  | { kind: "reminderSkip"; face: "schedule"; itemId: string | null; title: string | null; targetHint?: string; rawText: string }
  // HUB-78 — marginal-cost capability: add items to the household shopping list.
  | { kind: "addShopping"; face: "chef"; items: string[]; groupHint?: string; rawText: string }
  /** HUB-84 — edit the last result (any type) through its edit contract. */
  | { kind: "amendLast"; face: FaceKey; focusId: string | null; focusType: string | null; targetHint?: string; rawText: string }
  | { kind: "unknown"; rawText: string };

/**
 * A question ERA is waiting on an answer to (Slice 3). Deliberately narrow —
 * one shape, one missing slot — rather than a general multi-slot framework;
 * widen this only when a second required-slot case actually needs it.
 * Lives in-memory (`useEraStore`), not persisted: a page reload loses the
 * pending question, same as any other in-flight browser state.
 */
export type EraPendingTurn = EraPendingReminder | EraPendingSlot;

export interface EraPendingReminder {
  kind: "draftReminder";
  title: string;
  priority: ItemPriority;
  rawText: string;
  createdAt: number;
}

/**
 * HUB-78 — plan §4 component 1 (turn state). ERA asked ONE question and
 * offered chips. A chip tap answers it structurally (never re-parsed); typed
 * text is matched against the options, and anything that is not an answer is
 * handled as a new request (the question is dropped, nothing is consumed).
 */
export interface EraPendingSlot {
  kind: "slot";
  capability: "transfer.create" | "reminder.pick" | "reminder.scope" | "recurring.link" | "shopping.group" | "amend.target";
  /** Arguments already resolved (ids, amounts, whenText, action). */
  args: Record<string, unknown>;
  /** The argument the chips fill. */
  slot: string;
  options: EraChipOption[];
  /** Short question line shown above the chips. */
  question: string;
  rawText: string;
  createdAt: number;
}

export interface EraChipOption {
  label: string;
  /** Structured value; `nav:/path` opens a page instead of answering. */
  value: string;
}

/** HUB-78 — plan §4 component 8. Exactly one per turn; learning reads only this. */
export type EraOutcomeStatus =
  | "answered"
  | "done"
  | "drafted"
  | "needs_input"
  | "awaiting_confirm"
  | "queued"
  | "uncertain"
  | "failed"
  | "partial"
  | "handed_off";

export interface EraOutcome {
  status: EraOutcomeStatus;
  capability: string | null;
  entityIds: string[];
  /** Present only where an inverse is demonstrated. */
  inverse: string | null;
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
    }
  // HUB-76 — a NATIVE router write held behind its effect tier (Plan §5):
  // money movement and deletes always confirm. Same card as an AI proposal,
  // but executed by the native resolvers, never learned as a template, and
  // never exposed to the Ask AI catalog (ERA_CAPABILITIES has no transfer).
  | {
      kind: "native_action";
      text: string;
      action: EraNativeAction;
      sourceText: string;
      /** HUB-80 — the same choice was made before: the card offers "Always". */
      offerAlways?: EraLexiconOffer;
    }
  // HUB-78 — ERA can't finish this; the precision form opens prefilled.
  | { kind: "handoff"; text: string; open: () => void };

export interface EraLexiconOffer {
  capability: string;
  slot: string;
  conditions: Record<string, unknown>;
  value: Record<string, unknown>;
  depends_on: string[];
}

export type EraTransferAction = Extract<EraNativeAction, { type: "transfer" }>;

export type EraNativeAction =
  | {
      type: "transfer";
      amount: number;
      currency: string;
      fromAccountId: string;
      toAccountId: string;
      fromName: string;
      toName: string;
    }
  | { type: "recordDebt"; debtorName: string; amount: number; notes: string | null }
  /** A destructive registry capability (reminder.delete) reached natively or via a taught template. */
  | { type: "capability"; capabilityId: string; slots: Record<string, unknown> }
  /** HUB-78 — move a recurring reminder's whole series (re-anchors due_at; rule untouched). */
  | { type: "reminderSeries"; itemId: string; title: string; whenText: string }
  /** HUB-78 — postpone ONE occurrence (an occurrence exception; the rule is untouched). */
  | { type: "reminderOccurrence"; itemId: string; title: string; whenText: string }
  /** HUB-84 — create a shopping group, then move the items into it. */
  | { type: "shoppingGroupCreate"; threadId: string; name: string; messageIds: string[]; previousGroupId: string | null }
  /** HUB-84 — remove shopping items (soft delete; no demonstrated restore → Confirm). */
  | { type: "shoppingRemove"; messageIds: string[]; label: string }
  /** HUB-79 — skip the next open occurrence (idempotent upsert; rule untouched). */
  | { type: "reminderSkip"; itemId: string; title: string }
  /**
   * HUB-79 / HUB-22 — link an EXISTING transaction as this period's payment
   * (mark-covered creates no spend). The snapshot is re-checked on tap.
   */
  | {
      type: "recurringCover";
      paymentId: string;
      name: string;
      amount: number;
      transactionId: string;
      txDate: string;
      previousLastProcessed: string | null;
      previousNextDue: string;
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

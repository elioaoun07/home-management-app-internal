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
  | { kind: "showAnalytics"; face: "budget"; rawText: string }
  // Phase 0.5 — native chatbot intents
  | { kind: "todaySchedule"; face: "schedule"; rawText: string }
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
export interface EraActiveProposal {
  kind: "propose_nfc_reminder";
  text: string;
  reminderTitle: string;
  nfcTagId: string;
  nfcTagLabel: string;
  targetState: string;
}

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

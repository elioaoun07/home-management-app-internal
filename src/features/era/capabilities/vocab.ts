// src/features/era/capabilities/vocab.ts
// ERA Stage 2/5 — per-entity vocabulary used to classify a router miss as a
// "language gap" (a real capability exists, the phrasing didn't match) vs a
// "capability gap" (nothing in the registry covers this at all). See
// missTracking.ts for the classifier that consumes this.
//
// Stage 5 (HUB-31) extends the SAME table at runtime with words learned from
// successfully-taught templates (era_templates) — never a new entity bucket,
// only new words for one that already exists, so a learned word can never
// make an unrelated domain look covered (the plan's "never globally
// ambiguous" rule).

import type { EraEntityType } from "./types";

/** Base, hand-written vocabulary — deliberately small; grows from real usage via `deriveLearnedVocab`, not speculative synonym lists. */
export const BASE_ENTITY_VOCAB: Record<EraEntityType, readonly string[]> = {
  reminder: [
    "remind",
    "reminder",
    "reminders",
    "remember",
    "task",
    "todo",
    "to-do",
    "alarm",
    "change",
    "move",
    "push",
    "reschedule",
    "shift",
    "delete",
    "remove",
    "cancel",
    "complete",
    "finish",
    "finished",
    "done",
  ],
  schedule: [
    "schedule",
    "calendar",
    "agenda",
    "today",
    "tomorrow",
    "upcoming",
    "appointment",
    "overdue",
    "due",
  ],
  // Stage D — vocab for the capabilities registered alongside reminder/schedule
  // (registry.ts). Without a bucket here, missTracking.ts can never classify
  // a miss against these entities as a "language gap" (a real capability
  // exists, phrasing just didn't parse) — it would always read as a
  // "capability gap" instead, which also means Stage C's auto-escalation
  // guard (only escalating language-gap misses) would never fire for them.
  transaction: [
    "spend",
    "spent",
    "spending",
    "transaction",
    "transactions",
    "expense",
    "expenses",
    "budget",
    "draft",
    "drafts",
    "cost",
    "paid",
    "pay",
    "bought",
    "purchase",
    "purchased",
  ],
  recipe: [
    "recipe",
    "recipes",
    "cook",
    "cooking",
    "dish",
    "ingredient",
    "ingredients",
    "kitchen",
    "chef",
  ],
  meal: ["meal", "meals", "dinner", "lunch", "breakfast", "snack", "plan", "planning", "assign"],
  memory: ["remember", "memory", "memories", "recall", "note", "save", "stored"],
};

/** Words too generic to ever count as a domain signal on their own. */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "it",
  "that",
  "this",
  "one",
  "on",
  "at",
  "in",
  "for",
  "of",
  "and",
  "or",
  "is",
  "was",
  "be",
  "my",
  "me",
  "i",
]);

/** Exported so Stage 5's template-derived vocabulary (templates/vocabGrowth.ts) tokenizes patterns the identical way. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Does `text` contain vocabulary belonging to `entity`? Checked against the
 * base table plus any `learned` words (Stage 5) for that same entity only.
 */
export function matchesEntityVocab(
  text: string,
  entity: EraEntityType,
  learned?: ReadonlySet<string>,
): boolean {
  const words = new Set(tokenize(text));
  for (const w of BASE_ENTITY_VOCAB[entity]) {
    if (words.has(w)) return true;
  }
  if (learned) {
    for (const w of learned) {
      if (words.has(w)) return true;
    }
  }
  return false;
}

/**
 * First entity whose vocabulary `text` matches, or `null` if none — the
 * deterministic (no-AI) signal HUB-28's miss classifier runs on. Order
 * follows the registry's own entity set; a genuine tie is rare enough (both
 * buckets share words like "schedule") that "first match wins" is fine —
 * this is a coarse classifier, not a router.
 */
export function classifyMissEntity(
  text: string,
  learnedVocab?: Partial<Record<EraEntityType, ReadonlySet<string>>>,
): EraEntityType | null {
  const entities: EraEntityType[] = [
    "reminder",
    "schedule",
    "transaction",
    "recipe",
    "meal",
    "memory",
  ];
  for (const entity of entities) {
    if (matchesEntityVocab(text, entity, learnedVocab?.[entity])) return entity;
  }
  return null;
}

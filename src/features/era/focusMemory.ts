// src/features/era/focusMemory.ts
// ERA Stage 1 — short-term conversational context ("focus memory").
//
// Lets a follow-up like "change it to 11" or "delete that one" resolve
// against whatever entity ERA most recently created/touched, instead of
// requiring the user to repeat the full title every turn. Pure, testable
// functions only — `useEraStore` holds the actual list and calls these.
//
// Resolution order (per the design doc): explicit entity/title → fuzzy
// title → recent entity of the required type → pronoun → ambiguity = ask.
// Stage 1's built-in router only ever supplies a pronoun (explicit-title
// resolution needs a real NLP match against arbitrary text, which is Ask
// AI / learned-template territory — Stage 3+), so `resolveFocusRef` below
// implements the pronoun + recency tiers; never guesses across >1 candidate.

export type FocusEntityType = "reminder";

export interface FocusEntity {
  id: string;
  type: FocusEntityType;
  title: string;
  addedAt: number;
}

/** Keep at most this many entities, newest first. */
export const FOCUS_MAX_ENTITIES = 10;

/** Entities older than this are no longer valid referents for "it"/"that". */
export const FOCUS_TTL_MS = 30 * 60 * 1000;

export function pruneExpired(
  entities: readonly FocusEntity[],
  now: number = Date.now(),
): FocusEntity[] {
  return entities.filter((e) => now - e.addedAt < FOCUS_TTL_MS);
}

/**
 * Push a newly-created/touched entity to the front. De-dupes by id (a
 * reschedule touching the same reminder twice moves it to the front rather
 * than creating a second row) and caps the list.
 */
export function pushEntity(
  entities: readonly FocusEntity[],
  entity: FocusEntity,
): FocusEntity[] {
  const deduped = entities.filter((e) => e.id !== entity.id);
  return [entity, ...deduped].slice(0, FOCUS_MAX_ENTITIES);
}

/** Standalone pronouns a follow-up uses to refer back to the last thing discussed. */
const PRONOUN_RE = /^(it|that|this|that one|this one)$/i;

export function isPronounRef(ref: string): boolean {
  return PRONOUN_RE.test(ref.trim());
}

/**
 * Resolve a pronoun ("it"/"that"/"this one") against the most recent live
 * entity of `type`. `null` means no candidate exists — never expired,
 * never wrong-typed — and the caller must ask rather than guess (the plan's
 * "never guess when multiple valid entities exist" rule; Stage 1 only ever
 * pushes one entity at a time, so "most recent of type" IS the unambiguous
 * answer whenever one exists at all).
 */
export function resolveFocusRef(
  ref: string,
  type: FocusEntityType,
  entities: readonly FocusEntity[],
  now: number = Date.now(),
): FocusEntity | null {
  if (!isPronounRef(ref)) return null;
  const live = pruneExpired(entities, now).filter((e) => e.type === type);
  return live[0] ?? null;
}

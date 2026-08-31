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
//
// HUB-34 (Stage 3+, finishing the deferral above) — `resolveEntityRef` adds
// the fuzzy-title tier: a taught template's captured `{target}`/`{title}`
// slot is a piece of the ORIGINAL utterance (e.g. "the dentist reminder"),
// not necessarily the entity's exact title. Fixes a real bug: the router
// previously discarded a captured reference entirely and always resolved
// "most recent of type", so a template naming one reminder could silently
// act on a completely different one. Token-overlap scoring, never a guess
// across a tie — same "never guess when ambiguous" rule this file already
// enforces for the pronoun tier.

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

/** Words too generic to anchor a title match on their own — stripped before scoring. */
const REF_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "my",
  "our",
  "this",
  "that",
  "it",
  "one",
  "reminder",
  "item",
  "task",
]);

function tokenizeRef(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !REF_STOPWORDS.has(w));
}

/** Fraction of `ref`'s meaningful tokens found in `title`'s. 0 when `ref` has none left after stopword stripping. */
function scoreTitleMatch(ref: string, title: string): number {
  const refTokens = tokenizeRef(ref);
  if (refTokens.length === 0) return 0;
  const titleTokens = new Set(tokenizeRef(title));
  let hit = 0;
  for (const t of refTokens) if (titleTokens.has(t)) hit++;
  return hit / refTokens.length;
}

/** At least half of `ref`'s meaningful words must appear in the title — a single stray shared word ("call") shouldn't be enough. */
const REF_MATCH_THRESHOLD = 0.5;

/**
 * Resolves an entity reference that ISN'T necessarily a bare pronoun — e.g.
 * "the dentist reminder", captured verbatim from the user's own phrasing by
 * a taught template (`templates/learn.ts`) or an Ask AI proposal. Falls back
 * to the pronoun tier first (unchanged behavior); otherwise fuzzy-matches
 * `ref` against live focus titles by token overlap. Exactly one candidate
 * clears the threshold with no tie → that entity; anything else (including
 * a tie) → `null`, so the caller asks/falls through rather than guessing —
 * the same rule `resolveFocusRef` already enforces for the pronoun case.
 */
export function resolveEntityRef(
  ref: string,
  type: FocusEntityType,
  entities: readonly FocusEntity[],
  now: number = Date.now(),
): FocusEntity | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  if (isPronounRef(trimmed)) return resolveFocusRef(trimmed, type, entities, now);

  const live = pruneExpired(entities, now).filter((e) => e.type === type);
  if (live.length === 0) return null;

  const scored = live
    .map((e) => ({ entity: e, score: scoreTitleMatch(trimmed, e.title) }))
    .filter((s) => s.score >= REF_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;
  const second = scored[1];
  if (second && second.score === best.score) return null; // tie — never guess

  return best.entity;
}

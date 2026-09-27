// src/features/era/lexicon.ts
// HUB-80 — household lexicon rules (plan §4 component 10). Pure functions so
// the Gym and unit tests exercise the same logic the app runs.
//
// Invariants:
// - Personal: rules are the speaker's own (owner-only RLS); nothing here
//   ever reads another person's rules.
// - Re-bound every turn: a rule only applies while every id it depends on is
//   still one of the speaker's current accounts (deleted account, lost
//   access or household unlink ⇒ inert, never a stale guess).
// - A correction/choice is an EXAMPLE, never permission for a default. Only
//   an explicit "Always" creates a default; "Forget" revokes it.
// - A default fills a slot; it never lowers the effect tier (a money default
//   still ends at a Confirm card).

export interface LexiconRule {
  id: string;
  kind: "alias" | "default" | "example";
  capability: string;
  phrase?: string | null;
  slot?: string | null;
  conditions: Record<string, unknown>;
  value: Record<string, unknown>;
  depends_on: string[];
  use_count?: number;
}

function sameConditions(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && String(a[k]) === String(b[k]));
}

function stillValid(rule: LexiconRule, liveIds: ReadonlySet<string>): boolean {
  return rule.depends_on.every((id) => liveIds.has(id));
}

/** The live default for this slot under these conditions, if still valid. */
export function findDefault(
  rules: LexiconRule[],
  capability: string,
  slot: string,
  conditions: Record<string, unknown>,
  liveIds: ReadonlySet<string>,
): LexiconRule | null {
  return (
    rules.find(
      (r) =>
        r.kind === "default" &&
        r.capability === capability &&
        r.slot === slot &&
        sameConditions(r.conditions, conditions) &&
        stillValid(r, liveIds),
    ) ?? null
  );
}

/** How many times this exact choice was made before (examples). */
export function countExamples(
  rules: LexiconRule[],
  capability: string,
  slot: string,
  conditions: Record<string, unknown>,
  value: Record<string, unknown>,
): number {
  return rules.filter(
    (r) =>
      r.kind === "example" &&
      r.capability === capability &&
      r.slot === slot &&
      sameConditions(r.conditions, conditions) &&
      sameConditions(r.value, value),
  ).length;
}

/** Alias → entity id ("the box" → Drawer's id), valid ids only. */
export function resolveAlias(rules: LexiconRule[], capability: string, phrase: string, liveIds: ReadonlySet<string>): string | null {
  const p = phrase.trim().toLowerCase();
  const hit = rules.find(
    (r) => r.kind === "alias" && (r.capability === capability || r.capability === "*") && r.phrase === p && stillValid(r, liveIds),
  );
  const id = hit?.value?.id;
  return typeof id === "string" ? id : null;
}

/** "Always" offer: shown once the same choice has been made at least once before, with no live default. */
export function shouldOfferAlways(
  rules: LexiconRule[],
  capability: string,
  slot: string,
  conditions: Record<string, unknown>,
  value: Record<string, unknown>,
  liveIds: ReadonlySet<string>,
): boolean {
  return (
    !findDefault(rules, capability, slot, conditions, liveIds) &&
    countExamples(rules, capability, slot, conditions, value) >= 1
  );
}

// src/features/era/templates/learn.ts
// ERA Stage 4 (HUB-30) — turns a successfully-executed Ask AI action into a
// taught-phrase template. Called ONLY after a `propose_action` proposal's
// capability.execute() actually succeeds (see useEraAskAI.confirmProposal) —
// a failed or dismissed proposal teaches nothing.
//
// Pure text templating, not AI generation: any slot VALUE that appears
// verbatim in the original utterance is replaced with `{slotName}`; values
// that don't appear verbatim (a resolved itemId, a paraphrased title) are
// left out of the template entirely — the matcher (matcher.ts) re-resolves
// those the same way at match time (e.g. itemId always comes from focus
// memory, never from captured text). See resolveIntent's `capabilityAction`
// case for why that's safe to do unconditionally.
//
// HUB-34 — for a capability with an `entityRefSlot` (it acts on ONE specific
// existing entity), the captured `title` substitution is renamed to
// `{target}`. It isn't the canonical title at match time, it's whatever the
// user's own phrasing said ("the dentist reminder") — `intents/index.ts`'s
// matcher re-resolves that by fuzzy focus-title match (`focusMemory.ts`'s
// `resolveEntityRef`), the same way it already re-resolves `itemId`. Naming
// it distinctly from a capability's own `title` slot keeps the two concepts
// apart: one is a matcher-level reference, the other a literal Zod slot.

import type { EraCapability } from "../capabilities/types";
import { tokenize } from "../capabilities/vocab";
import { normalizeUtterance } from "./normalize";

export interface LearnedTemplate {
  patternText: string;
  slotNames: string[];
}

/**
 * HUB-34 — the learning gate. `result.ok === false` means the resolver
 * behind the executed capability RETURNED a graceful error rather than
 * throwing (see resolveIntent.ts's `ResolveResult.ok` doc for why a thrown
 * exception alone isn't a reliable success signal here). Extracted as a
 * pure function — its only caller, `useEraAskAI.confirmProposal`, is a React
 * hook that's expensive to unit-test directly; this one line of policy
 * isn't.
 */
export function shouldLearnFrom(result: { ok?: boolean }): boolean {
  return result.ok !== false;
}

/** Below this many non-slot characters, a SLOTTED pattern is just a slot with no anchor — it would match almost anything, so don't teach it. */
const MIN_LITERAL_CHARS = 3;
/** B2 — a genuinely no-argument command ("what's on today") is still worth teaching as a fixed phrase; below these, it's too thin a fragment to trust as an anchor. */
const MIN_ZERO_SLOT_CHARS = 8;
const MIN_ZERO_SLOT_TOKENS = 2;

export function learnTemplateFromProposal(
  rawText: string,
  slots: Record<string, unknown>,
  capability?: Pick<EraCapability, "entityRefSlot">,
): LearnedTemplate | null {
  // B1 — template off the SAME normalized text the matcher will compare
  // against later, so a phrase taught from "please shift it to 5pm!" is
  // stored as "shift it to {whenText}", not literally requiring the
  // "please"/"!" on every future match.
  let pattern = normalizeUtterance(rawText);
  const slotNames: string[] = [];
  const hasEntityRef = Boolean(capability?.entityRefSlot);

  for (const [key, value] of Object.entries(slots)) {
    if (typeof value !== "string" || value.trim().length === 0) continue;
    const idx = pattern.toLowerCase().indexOf(value.toLowerCase());
    if (idx === -1) continue;
    const slotName = hasEntityRef && key === "title" ? "target" : key;
    pattern = `${pattern.slice(0, idx)}{${slotName}}${pattern.slice(idx + value.length)}`;
    slotNames.push(slotName);
  }

  if (slotNames.length === 0) {
    // B2 — no slot value from this execution appeared verbatim in the text
    // (either the capability genuinely takes none, e.g. `schedule.forDay`,
    // or every slot was resolved some other way, e.g. `reminder.complete`'s
    // itemId from focus memory). That's still a legitimate fixed phrase to
    // teach — `matchAgainstTemplates` (intents/index.ts) re-resolves any
    // entity reference from focus memory at match time regardless of slot
    // count, the same as it does for a slotted template. Guard only against
    // teaching a near-empty fragment that would fire on almost anything.
    const tokenCount = pattern.split(/\s+/).filter(Boolean).length;
    if (pattern.length < MIN_ZERO_SLOT_CHARS || tokenCount < MIN_ZERO_SLOT_TOKENS) return null;
    return { patternText: pattern, slotNames };
  }

  const literalChars = pattern.replace(/\{[a-zA-Z_]\w*\}/g, "").trim();
  if (literalChars.length < MIN_LITERAL_CHARS) return null;

  // B4 — a literal anchor made ENTIRELY of stopwords ("the", "to", "it") is
  // as useless as no anchor: `tokenize()` (capabilities/vocab.ts) already
  // strips stopwords and single-character words, so an empty result here
  // means nothing meaningful survived to anchor the match.
  if (tokenize(literalChars).length === 0) return null;

  return { patternText: pattern, slotNames };
}

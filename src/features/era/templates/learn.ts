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

export interface LearnedTemplate {
  patternText: string;
  slotNames: string[];
}

/** Below this many non-slot characters, the "pattern" is just a slot with no anchor — it would match almost anything, so don't teach it. */
const MIN_LITERAL_CHARS = 3;

export function learnTemplateFromProposal(
  rawText: string,
  slots: Record<string, unknown>,
): LearnedTemplate | null {
  let pattern = rawText.trim();
  const slotNames: string[] = [];

  for (const [key, value] of Object.entries(slots)) {
    if (typeof value !== "string" || value.trim().length === 0) continue;
    const idx = pattern.toLowerCase().indexOf(value.toLowerCase());
    if (idx === -1) continue;
    pattern = `${pattern.slice(0, idx)}{${key}}${pattern.slice(idx + value.length)}`;
    slotNames.push(key);
  }

  if (slotNames.length === 0) return null;

  const literalChars = pattern.replace(/\{[a-zA-Z_]\w*\}/g, "").trim();
  if (literalChars.length < MIN_LITERAL_CHARS) return null;

  return { patternText: pattern, slotNames };
}

// src/features/era/templates/normalize.ts
// Stage 4 follow-up (HUB-30, plan step B1) — shared normalization so a
// taught phrase survives everyday variance (trailing punctuation, a
// "please"/"can you" prefix, extra whitespace) without learn.ts and
// matcher.ts silently disagreeing about what "the same sentence" means.
// Applied at LEARN time (learn.ts, before templating a new pattern) and at
// MATCH time (matcher.ts, to both the incoming text and the stored
// pattern's literal segments) — never only one side, or the two drift.
//
// Deliberately does NOT lowercase: `matcher.ts` already compiles a
// case-insensitive regex (the `i` flag), so casing never affects whether
// something matches — but a matched `{slot}` is returned verbatim as a
// captured substring of the original text (see `matchTemplates`'s doc
// comment), and reminder/transaction titles built from that slot should
// keep the user's own capitalization, not get flattened to lowercase.

const LEADING_PREFIX_RE =
  /^(?:hey\s+era|era)[\s,]+|^(?:please|can\s+you|could\s+you|would\s+you)[\s,]+/i;
const TRAILING_PUNCT_RE = /[.?!]+$/;

/** Normalizes a plain utterance (no `{slot}` placeholders) — the text the user typed or spoke. */
export function normalizeUtterance(s: string): string {
  let text = s.trim().replace(/\s+/g, " ");
  text = text.replace(TRAILING_PUNCT_RE, "").trim();
  // A prefix can stack ("hey era, please shift it…") — strip up to twice.
  text = text.replace(LEADING_PREFIX_RE, "").replace(LEADING_PREFIX_RE, "").trim();
  return text;
}

const SLOT_TOKEN_RE = /\{[a-zA-Z_]\w*\}/g;

/**
 * Same normalization as `normalizeUtterance`, but applied to a stored
 * `pattern_text` — `{slotName}` placeholders are protected from the
 * casing/whitespace pass since a slot's exact spelling is a Zod schema key
 * downstream (see `capabilities/registry.ts`'s `slots` shape) and must
 * round-trip byte-for-byte, not just case-insensitively. Splits the pattern
 * into its literal/placeholder segments (same walk `matcher.ts`'s
 * `compilePattern` does), normalizes only the literal segments, and applies
 * the leading-prefix strip solely to the first segment and the
 * trailing-punctuation strip solely to the last — a slot can never sit where
 * a sentence-opening "please" or a closing "?" would.
 */
export function normalizePatternText(patternText: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  SLOT_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SLOT_TOKEN_RE.exec(patternText))) {
    parts.push(patternText.slice(lastIndex, m.index)); // literal
    parts.push(m[0]); // placeholder, verbatim
    lastIndex = SLOT_TOKEN_RE.lastIndex;
  }
  parts.push(patternText.slice(lastIndex)); // trailing literal

  // `parts` alternates literal/placeholder/literal/…/literal — only the
  // even indices are literal text.
  const lastLiteralIndex = parts.length - 1;
  for (let i = 0; i < parts.length; i += 2) {
    let seg = parts[i].replace(/\s+/g, " ");
    if (i === 0) seg = seg.replace(LEADING_PREFIX_RE, "").replace(LEADING_PREFIX_RE, "");
    if (i === lastLiteralIndex) seg = seg.replace(TRAILING_PUNCT_RE, "");
    parts[i] = seg;
  }

  return parts.join("").trim();
}

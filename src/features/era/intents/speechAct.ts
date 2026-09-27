// src/features/era/intents/speechAct.ts
// HUB-76 — speech-act gate. A deterministic grammar matches a SUBSTRING, so
// "Don't transfer $300 from Drawer to Wallet" and "What if I transfer $300…?"
// used to produce the same transfer intent as the plain command. This
// classifier runs on every write intent the router produces; anything other
// than a plain command never becomes a fast-path write (Plan §4 component 2).
//
// Two strengths:
// - `strict` (money writes): also blocks a mid-sentence condition
//   ("transfer 300 if the salary lands") and quoted speech.
// - default (schedule/memory/meal writes): only sentence-initial conditions,
//   so ordinary reminder wording like "remind me to check if the oven is
//   off" keeps working.

export type SpeechAct =
  | "command"
  | "negated"
  | "hypothetical"
  | "question"
  | "conditional"
  | "reported";

/**
 * "don't forget to …" is how people ASK for a reminder, not a negation, so
 * it is stripped before the negation test.
 */
const DONT_FORGET_RE = /\b(?:don'?t|do not|dont)\s+forget\b/gi;

const NEGATION_RE =
  /\b(?:don'?t|dont|do not|never|no need to|didn'?t|did not|won'?t|will not|shouldn'?t|should not|mustn'?t|must not|not going to|haven'?t|have not)\b/i;

const HYPOTHETICAL_RE =
  /\b(?:what if|suppose|supposing|imagine|hypothetically|what would happen|would it be|in theory)\b/i;

/** Polite requests are commands: "can you remind me…", "could you move…". */
const POLITE_RE = /^\s*(?:please\s+)?(?:can|could|would|will)\s+you\b|^\s*please\b/i;

/** Aux-initial question with a subject: "should I transfer…", "do I owe…". */
const AUX_QUESTION_RE =
  /^\s*(?:do|does|did|is|are|was|were|should|shall|would|could|can|will|have|has|am|may|might)\s+(?:i|we|you|he|she|they|it|my|our|the|there|this|that)\b/i;

const WH_QUESTION_RE = /^\s*(?:what|how|why|where|who|which|whose)\b/i;

const LEADING_CONDITION_RE = /^\s*(?:if|unless|in case|when|whenever|once|assuming)\b/i;
const ANY_CONDITION_RE = /\b(?:if|unless|in case|assuming)\b/i;

/** "Rita said she spent 20$", "my wife told me to…", "according to…". */
const REPORTED_RE =
  /^(?:\S+\s+){0,3}?(?:said|says|told me|tells me|mentioned|claims|claimed|asked me|wrote)\b|\baccording to\b/i;

const QUOTED_RE = /["“”«»][^"“”«»]{2,}["“”«»]/;

export function classifySpeechAct(
  text: string,
  opts: { strict?: boolean } = {},
): SpeechAct {
  const t = text.trim();
  const polite = POLITE_RE.test(t);

  if (NEGATION_RE.test(t.replace(DONT_FORGET_RE, ""))) return "negated";
  if (HYPOTHETICAL_RE.test(t)) return "hypothetical";
  if (REPORTED_RE.test(t) || (opts.strict && QUOTED_RE.test(t))) return "reported";
  if (LEADING_CONDITION_RE.test(t)) return "conditional";
  if (opts.strict && ANY_CONDITION_RE.test(t)) return "conditional";
  if (!polite && (AUX_QUESTION_RE.test(t) || WH_QUESTION_RE.test(t) || t.endsWith("?"))) {
    return "question";
  }
  return "command";
}

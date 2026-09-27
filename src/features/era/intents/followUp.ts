// src/features/era/intents/followUp.ts
// HUB-84 — follow-ups edit the last result, whatever its type.
//
// Two pure steps, shared by every capability:
//   1. `isFollowUp` — is this utterance an edit of "it" (the last result)?
//   2. `parseEdits` — which fields does it change? (group, quantity, name,
//      amount, destination, category, remove). The WORDS only say which
//      field; the referent's TYPE decides what the edit means (see
//      resolvers/amend.ts). A value is always resolved against real data
//      there: one match → apply, several → ask, none → offer to create.

import { extractAmount } from "@/lib/nlp/amount";

const PRONOUN = String.raw`(?:it|that|this(?:\s+one)?|them|those|these)`;

const FOLLOW_UP_RES: RegExp[] = [
  // "make it under Spinneys", "put them in the Spinneys group", "change it to 15"
  new RegExp(String.raw`^\s*(?:no[,.!]?\s+|actually[,.!]?\s+|sorry[,.!]?\s+)?(?:please\s+)?(?:make|change|put|move|set|switch|turn|place|file|add)\s+${PRONOUN}\b`, "i"),
  // "it's actually 15", "it was groceries"
  /^\s*(?:no[,.!]?\s+|actually[,.!]?\s+)?(?:it'?s|it\s+is|it\s+was|they'?re|they\s+are)\s+/i,
  // "under Spinneys", "in the Spinneys group"
  /^\s*(?:no[,.!]?\s+|actually[,.!]?\s+)?(?:under|into)\s+\S+/i,
  /^\s*(?:no[,.!]?\s+|actually[,.!]?\s+)?in\s+(?:the\s+)?[\w' -]{1,30}\s+group\b/i,
  // "call it rock salt", "rename it to …"
  new RegExp(String.raw`^\s*(?:call|rename|name)\s+${PRONOUN}\b`, "i"),
  // "remove it", "delete them"
  new RegExp(String.raw`^\s*(?:remove|delete|drop)\s+${PRONOUN}\s*[.!]*$`, "i"),
  // "no, 15", "no 15$", "actually 20", "15 not 12"
  /^\s*(?:no|nope|actually|sorry)[,.!]?\s+[$€£]?\d/i,
  /^\s*[$€£]?\d+(?:[.,]\d+)?\s*[$€£]?\s+not\s+[$€£]?\d/i,
  // "to savings instead", "no, savings"
  /\binstead\s*[.!]*$/i,
  /^\s*(?:no|nope)[,.!]?\s+(?:to\s+|from\s+)?(?:the\s+|my\s+)?[a-z][\w' -]{1,30}[.!]*$/i,
];

export function isFollowUp(text: string): boolean {
  return FOLLOW_UP_RES.some((re) => re.test(text));
}

export interface EditRequest {
  group?: string;
  quantity?: string;
  name?: string;
  remove?: boolean;
  amount?: number;
  currency?: string;
  /** A bare noun after "no," / "instead" — an account, group or category by type. */
  target?: string;
  category?: string;
}

const strip = (s: string) =>
  s
    .replace(/^\s*(?:the|my|our)\s+/i, "")
    .replace(/\s+(?:group|list|section|one|instead)\s*$/i, "")
    .replace(/[.!?]+$/, "")
    .trim();

/** Which fields the follow-up changes. Empty object = nothing understood. */
export function parseEdits(text: string): EditRequest {
  const t = text.trim();
  const out: EditRequest = {};

  if (new RegExp(String.raw`^\s*(?:remove|delete|drop)\s+${PRONOUN}\s*[.!]*$`, "i").test(t)) {
    return { remove: true };
  }

  const rename = t.match(new RegExp(String.raw`\b(?:call|rename|name)\s+${PRONOUN}\s+(?:to\s+)?["“]?(.+?)["”]?[.!]*$`, "i"));
  if (rename) return { name: strip(rename[1]) };

  const group =
    t.match(/\b(?:under|into)\s+(?:the\s+)?(.+?)(?:\s+(?:group|list|section))?[.!]*$/i) ??
    t.match(/\bin\s+(?:the\s+)?(.+?)\s+(?:group|list|section)\b/i) ??
    t.match(new RegExp(String.raw`\b(?:put|move|place|file|add)\s+${PRONOUN}\s+(?:in|to|on)\s+(?:the\s+)?(.+?)(?:\s+(?:group|list|section))?[.!]*$`, "i"));
  if (group) out.group = strip(group[1]);

  const qty =
    t.match(new RegExp(String.raw`\b(?:make|change|set)\s+${PRONOUN}\s+(?:to\s+)?(\d+\s*(?:x|kg|g|l|pcs|pieces|packs?|bottles?|boxes|cans?)?)\s*[.!]*$`, "i")) ??
    t.match(/\b(?:quantity|qty)\s+(?:to\s+)?(\d+\s*\w*)/i) ??
    t.match(/^\s*x\s?(\d+)\s*$/i);

  const money = extractAmount(t, { allowBare: true });
  const amountish =
    /^\s*(?:no|nope|actually|sorry)[,.!]?\s+[$€£]?\d/i.test(t) ||
    /^\s*[$€£]?\d+(?:[.,]\d+)?\s*[$€£]?\s+not\s+/i.test(t) ||
    /\b(?:it'?s|it\s+was|it\s+is)\s+(?:actually\s+)?[$€£]?\d/i.test(t) ||
    Boolean(money?.marked);
  if (money && amountish) {
    out.amount = money.value;
    if (money.currency) out.currency = money.currency;
  } else if (qty && !out.group) {
    out.quantity = qty[1].trim();
    // A bare "make it 200": a count for items, an amount for money — the
    // referent's type decides which one it uses.
    if (money && /^\d+(?:[.,]\d+)?$/.test(out.quantity)) out.amount = money.value;
  } else if (money && !out.group && /\b(?:make|change|set)\b/i.test(t)) {
    // "make it 200" — an amount for money types, a quantity for items.
    out.amount = money.value;
    out.quantity = String(money.value);
  }

  const cat = t.match(/\b(?:it\s+was|it'?s|category|categori[sz]e\s+(?:it\s+)?(?:as|under)?)\s+(?:a\s+|an\s+|for\s+)?([a-z][\w' -]{1,30}?)[.!]*$/i);
  if (cat && !/^\d/.test(cat[1]) && out.amount === undefined) out.category = strip(cat[1]);

  const target =
    t.match(/^\s*(?:no|nope)[,.!]?\s+(?:to\s+|from\s+)?(?:the\s+|my\s+)?([a-z][\w' -]{1,30}?)[.!]*$/i) ??
    t.match(/\b(?:to|from)\s+(?:the\s+|my\s+)?([a-z][\w' -]{1,30}?)\s+instead\b/i);
  if (target && !out.group && out.amount === undefined) out.target = strip(target[1]);

  return out;
}

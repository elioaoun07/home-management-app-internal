// Per-face intent router — Budget face
import type { FaceIntentRouter } from "./schedule";

/**
 * Digit-group token: plain "25"/"25.50" or thousands-grouped "2,000" /
 * "1,234,567.50". Shared by both the marked (currency-anywhere) and
 * positional (verb-implies-money) amount extractors below.
 */
const AMOUNT_TOKEN = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?`;

function parseAmountToken(raw: string): number | undefined {
  const trimmed = raw.trim();
  // Thousands-grouped, e.g. "2,000" or "1,234,567.50" — strip the group
  // commas, keep a trailing ".cents" if present.
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(trimmed)) {
    return Number(trimmed.replace(/,/g, ""));
  }
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** Tier 1 — an explicit currency marker anywhere in the sentence. */
const MARKED_AMOUNT_RE = new RegExp(
  `[$€£]\\s?(${AMOUNT_TOKEN})|(${AMOUNT_TOKEN})\\s?(?:\\$|€|£|usd|lbp|dollars?|bucks?|euros?)\\b`,
  "i",
);

/**
 * Tier 2 — no currency marker, so sentence POSITION must imply money.
 * "paid/spent/logged/…" are strong money verbs: the amount counts whether
 * it's the last token or immediately before for/on/at. "bought/buy" are
 * weaker — they're equally at home in front of a plain COUNT ("bought 2
 * shirts", "buy 3 coffees") — so for those two the amount must be the
 * SENTENCE-FINAL token (nothing after it but punctuation); a trailing noun
 * fails the match on purpose. That's the fix for "I bought 2 shirts"
 * quietly drafting a $2 expense.
 */
const STRONG_POSITIONAL_RE = new RegExp(
  `\\b(?:paid|pay|spent|spend|cost|costs|logged|log|recorded|record|charged)\\b(?:\\s+\\w+){0,2}?\\s+(${AMOUNT_TOKEN})\\s*(?:[.?!]|$|\\b(?:for|on|at)\\b)`,
  "i",
);
const WEAK_POSITIONAL_RE = new RegExp(
  `\\b(?:bought|buy)\\b(?:\\s+\\w+){0,2}?\\s+(${AMOUNT_TOKEN})\\s*[.?!]*$`,
  "i",
);

function extractAmount(text: string): number | undefined {
  const marked = text.match(MARKED_AMOUNT_RE);
  const rawMarked = marked?.[1] ?? marked?.[2];
  if (rawMarked) return parseAmountToken(rawMarked);

  const strong = text.match(STRONG_POSITIONAL_RE);
  if (strong) return parseAmountToken(strong[1]);

  const weak = text.match(WEAK_POSITIONAL_RE);
  if (weak) return parseAmountToken(weak[1]);

  return undefined;
}

/** Explicit currency / money markers — a strong signal the number is spend. */
const CURRENCY_RE = /\$|\busd\b|\blbp\b|\bdollars?\b|\bbucks?\b|€|\beuros?\b|£/i;

/**
 * A number immediately followed by a non-money unit (hours, minutes, km, kg…).
 * "spent 2 hours studying" trips this and must NOT become a transaction draft.
 */
const NON_MONEY_UNIT_RE =
  /\b\d+(?:[.,]\d+)?\s*(hours?|hrs?|hr|minutes?|mins?|min|seconds?|secs?|sec|days?|weeks?|months?|years?|km|kms|kilometers?|miles?|mi|kg|kgs?|grams?|liters?|litres?|ml|cups?|pieces?|times?|percent|%)\b/i;

/**
 * No income intent exists (types.ts) and no income write path either —
 * useEraBudgetSubmit always POSTs an EXPENSE draft. Drafting "I got paid
 * $2000" as a $2000 expense is money-wrong, so veto rather than mask: it
 * falls through to the strong "income" switchFace noun or a weak clarify,
 * never a wrong write.
 */
const INCOME_RE =
  /\b(?:got|get|getting|was|were|been|am|i'?m)\s+paid\b|\bpaid\s+me\b|\b(?:received|receive|earned|earn|refunded|reimbursed)\b|\b(?:salary|paycheck|payday|income|refund|reimbursement|bonus)\b/i;

export const budgetRouter: FaceIntentRouter = {
  parse(text, ctx) {
    const lo = text.toLowerCase();

    // "How much did I / my partner / we pay/spend this month"
    if (
      /\b(how much|what did|what have|total|summary|spending|breakdown)\b/.test(lo) &&
      /\b(pay|paid|spend|spent|cost|expense|spent on|paid on|this month|last month|month|period)\b/.test(lo)
    ) {
      const scope =
        /\b(partner|wife|husband|she|he|they)\b/.test(lo) ? "partner" :
        /\b(household|both|we|together|combined|family)\b/.test(lo) ? "household" :
        "self";

      const catMatch = lo.match(/\bon\s+(\w[\w\s]{1,30}?)(?:\s*\?|$)/);
      const categoryHint = catMatch?.[1]?.trim();

      return { kind: "monthSpend", face: "budget", scope, categoryHint, rawText: text };
    }

    // Transfer — "transfer 50 from wallet to savings", "move $200 from
    // checking to savings", "transfer 2$ from account to drawer", "transfer
    // $50 to savings from wallet". The currency marker can land before OR
    // after the digits, so it's optional on both sides — same shape as
    // extractAmount's amount token. Both from/to orderings are accepted;
    // "from" and "to" ownership never depends on which comes first.
    const transferFromTo = text.match(
      /\b(?:transfer|move|send)\s+\$?\s?(\d+(?:[.,]\d{1,2})?)\s?(?:\$|usd|lbp|dollars?)?\s+from\s+(.+?)\s+to\s+(.+?)(?:[.?!]|$)/i,
    );
    if (transferFromTo) {
      return {
        kind: "transfer",
        face: "budget",
        amount: Number(transferFromTo[1].replace(",", ".")),
        fromHint: transferFromTo[2].trim(),
        toHint: transferFromTo[3].trim(),
        rawText: text,
      };
    }
    const transferToFrom = text.match(
      /\b(?:transfer|move|send)\s+\$?\s?(\d+(?:[.,]\d{1,2})?)\s?(?:\$|usd|lbp|dollars?)?\s+to\s+(.+?)\s+from\s+(.+?)(?:[.?!]|$)/i,
    );
    if (transferToFrom) {
      return {
        kind: "transfer",
        face: "budget",
        amount: Number(transferToFrom[1].replace(",", ".")),
        fromHint: transferToFrom[3].trim(),
        toHint: transferToFrom[2].trim(),
        rawText: text,
      };
    }

    // Record a debt — "John owes me $30 for lunch", "record a debt: John
    // owes 30", "John owes me 30$ for lunch" (trailing currency marker).
    const debtMatch = text.match(
      /^(?:record\s+(?:a\s+)?debt[:\s]+)?(\w[\w\s]{1,40}?)\s+owes?(?:\s+me)?\s+\$?\s?(\d+(?:[.,]\d{1,2})?)\s?(?:\$|usd\b|lbp\b|dollars?\b)?(?:\s+for\s+(.+?))?[.?!]*$/i,
    );
    if (debtMatch) {
      return {
        kind: "recordDebt",
        face: "budget",
        debtorName: debtMatch[1].trim(),
        amount: Number(debtMatch[2].replace(",", ".")),
        notes: debtMatch[3]?.trim(),
        rawText: text,
      };
    }

    // Confirm a pending draft — "confirm my last draft", "confirm the fuel draft".
    const confirmDraftMatch = text.match(
      /\bconfirm\b\s*(?:my\s+|the\s+)?(.*?)\s*\bdraft\b/i,
    );
    if (confirmDraftMatch) {
      return {
        kind: "confirmDraft",
        face: "budget",
        hint: confirmDraftMatch[1]?.trim() || undefined,
        rawText: text,
      };
    }

    // List pending drafts — "what drafts do I have", "show my pending transactions".
    if (
      /\b(what|show|list|see|check)\b.{0,20}\bdrafts?\b/i.test(lo) ||
      /\bpending (drafts?|transactions?)\b/i.test(lo)
    ) {
      return { kind: "listDrafts", face: "budget", rawText: text };
    }

    // Transaction draft — "I paid $25 on fuel", "log $12 for coffee".
    // Require clear spend semantics: a spend verb PLUS a positionally- or
    // currency-implied amount (see extractAmount), never income (see
    // INCOME_RE), and never a non-money unit unless currency-marked. This
    // stops "spent 2 hours studying" AND "I bought 2 shirts" from drafting
    // a money transaction.
    const amount = extractAmount(text);
    const hasSpendVerb =
      /\b(?:paid|pay|spent|spend|bought|buy|cost|costs|logged|log|recorded|record|charged)\b/i.test(
        text,
      );
    if (
      amount !== undefined &&
      hasSpendVerb &&
      !INCOME_RE.test(text) &&
      (CURRENCY_RE.test(text) || !NON_MONEY_UNIT_RE.test(text))
    ) {
      return { kind: "draftTransaction", face: "budget", amount, description: text, rawText: text };
    }

    // Show analytics — "show my budget / analytics"
    if (/\b(analytics|show.*budget|my budget|budget.*show)\b/i.test(text)) {
      return { kind: "showAnalytics", face: "budget", rawText: text };
    }

    // Strong budget-domain nouns → a confident face switch is warranted.
    if (/\b(budget|expense|income|transaction|balance|account)\b/i.test(text)) {
      return { kind: "switchFace", face: "budget", rawText: text };
    }

    // Weak/incidental money words alone (money, cost, fuel, groceries, $, …) are
    // too soft to switch faces on confidently. When Budget is the active face we
    // ask the user to clarify rather than firing a wrong action; when Budget is
    // only a cross-face fallback we return null so the root router's ambiguity
    // logic — not this soft match — decides the outcome.
    if (/\b(money|cost|fuel|grocery|groceries|lbp|usd)\b|\$/i.test(text)) {
      return ctx?.activeFaceKey === "budget"
        ? { kind: "clarify", reason: "weak", rawText: text }
        : null;
    }

    return null;
  },
};

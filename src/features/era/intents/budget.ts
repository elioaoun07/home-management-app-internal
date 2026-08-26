// Per-face intent router — Budget face
import type { FaceKey, Intent } from "../types";
import type { FaceIntentRouter } from "./schedule";

/** Very rough amount extractor: $25, 25$, 25 usd, etc. */
function extractAmount(text: string): number | undefined {
  const m = text.match(/\$?\s?(\d+(?:[.,]\d{1,2})?)\s?(?:\$|usd|lbp|dollars?)?/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** Explicit currency / money markers — a strong signal the number is spend. */
const CURRENCY_RE = /\$|\busd\b|\blbp\b|\bdollars?\b|\bbucks?\b|€|\beuros?\b|£/i;

/**
 * A number immediately followed by a non-money unit (hours, minutes, km, kg…).
 * "spent 2 hours studying" trips this and must NOT become a transaction draft.
 */
const NON_MONEY_UNIT_RE =
  /\b\d+(?:[.,]\d+)?\s*(hours?|hrs?|hr|minutes?|mins?|min|seconds?|secs?|sec|days?|weeks?|months?|years?|km|kms|kilometers?|miles?|mi|kg|kgs?|grams?|liters?|litres?|ml|cups?|pieces?|times?|percent|%)\b/i;

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
    // checking to savings". Account names are resolved fuzzily against the
    // user's real accounts in the resolver — the router only extracts hints.
    const transferMatch = text.match(
      /\b(?:transfer|move|send)\s+\$?(\d+(?:[.,]\d{1,2})?)\s+(?:dollars?\s+)?from\s+(.+?)\s+to\s+(.+?)(?:[.?!]|$)/i,
    );
    if (transferMatch) {
      return {
        kind: "transfer",
        face: "budget",
        amount: Number(transferMatch[1].replace(",", ".")),
        fromHint: transferMatch[2].trim(),
        toHint: transferMatch[3].trim(),
        rawText: text,
      };
    }

    // Record a debt — "John owes me $30 for lunch", "record a debt: John owes 30".
    const debtMatch = text.match(
      /^(?:record\s+(?:a\s+)?debt[:\s]+)?(\w[\w\s]{1,40}?)\s+owes?(?:\s+me)?\s+\$?(\d+(?:[.,]\d{1,2})?)\b(?:\s+for\s+(.+?))?[.?!]*$/i,
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

    // Transaction draft — "I paid $25 on fuel".
    // Require clear spend semantics: a spend verb PLUS either an explicit
    // currency marker or a number that is NOT attached to a non-money unit.
    // This stops "spent 2 hours studying" from drafting a $2 transaction.
    const amount = extractAmount(text);
    const hasSpendVerb = /\b(paid|pay|spent|spend|bought|cost)\b/i.test(text);
    if (
      amount !== undefined &&
      hasSpendVerb &&
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

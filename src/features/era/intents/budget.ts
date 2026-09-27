// Per-face intent router — Budget face
import { extractAmount } from "@/lib/nlp/amount";
import type { FaceIntentRouter } from "./schedule";

// HUB-75 — amounts come from the ONE shared extractor (also used by Hub chat's
// messageTransactionParser), so `12$`, `300$` and `500k lbp` read the same
// everywhere. Tiers: currency marker anywhere → positional money verb. No bare
// fallback here: ERA needs a marker or a money verb before it drafts.

/**
 * Amount phrase inside the transfer/debt grammars: optional prefix symbol,
 * digits, optional `k`, optional suffix marker. The phrase is re-read by the
 * shared extractor, so the grammars never parse numbers themselves.
 */
const AMOUNT_PHRASE = String.raw`(?:[$€£]\s?)?\d[\d.,]*k?(?:\s?(?:\$|€|£|usd|lbp|dollars?))?`;

function phraseAmount(phrase: string) {
  return extractAmount(phrase, { allowBare: true });
}

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
      // HUB-79 (owner export: "how much did i pay today" got a month total).
      const period = /\btoday\b/.test(lo)
        ? "today"
        : /\byesterday\b/.test(lo)
          ? "yesterday"
          : /\bthis\s+week\b/.test(lo)
            ? "week"
            : undefined;

      return { kind: "monthSpend", face: "budget", scope, categoryHint, period, rawText: text };
    }

    // HUB-81 — "what am I saving for", "my future purchases".
    if (/\b(?:what\s+am\s+i\s+saving\s+for|future\s+purchases?|planned\s+purchases?|savings\s+goals?)\b/i.test(text)) {
      return { kind: "futurePurchasesRead", face: "budget", rawText: text };
    }

    // HUB-79 — balance read: "what's my balance", "balance of savings".
    const balanceMatch =
      text.match(/\b(?:what'?s|what\s+is|how\s+much\s+is|show|check)\s+(?:in\s+)?(?:my\s+|the\s+)?(?:(.+?)\s+)?balance\b/i) ??
      text.match(/\bbalance\s+(?:of|in|on)\s+(?:my\s+|the\s+)?(.+?)[?.!]*$/i) ??
      text.match(/\bhow\s+much\s+(?:do\s+i\s+have|is\s+left)\s+(?:in|on)\s+(?:my\s+|the\s+)?(.+?)[?.!]*$/i);
    if (balanceMatch) {
      const hint = balanceMatch[1]?.trim();
      return {
        kind: "balanceRead",
        face: "budget",
        accountHint: hint && !/^(?:my|the|account|current)$/i.test(hint) ? hint : undefined,
        rawText: text,
      };
    }

    // HUB-79 / HUB-6 — "split 60$ dinner with Racha" → the Split form, prefilled.
    const splitMatch = text.match(
      new RegExp(String.raw`\bsplit\s+(?:the\s+)?(?:(${AMOUNT_PHRASE})\s+)?(.*?)(?:\s+with\s+(.+?))?[.!?]*$`, "i"),
    );
    if (splitMatch && (splitMatch[1] || splitMatch[3])) {
      const parsed = splitMatch[1] ? phraseAmount(splitMatch[1]) : extractAmount(text, { allowBare: true });
      return { kind: "splitExpense", face: "budget", amount: parsed?.value, withName: splitMatch[3]?.trim(), rawText: text };
    }

    // HUB-79 / HUB-22 — "mark rent as paid", "I paid the rent" (no amount).
    const coverMatch =
      text.match(/\bmark\s+(?:the\s+|my\s+)?(.+?)\s+(?:as\s+)?(?:paid|covered)\b/i) ??
      (extractAmount(text) === undefined
        ? text.match(/^\s*(?:i\s+)?(?:paid|covered)\s+(?:the\s+|my\s+)(.+?)(?:\s+bill)?[.!]*$/i)
        : null);
    if (coverMatch) {
      return { kind: "coverRecurring", face: "budget", nameHint: coverMatch[1].trim(), rawText: text };
    }

    // HUB-79 — income with an amount opens the form on the default income
    // account (owner decision 2026-09-27); never drafted as a spend.
    if (INCOME_RE.test(text) && !/transfer/i.test(text)) {
      const inc = extractAmount(text, { allowBare: true });
      if (inc) {
        return { kind: "captureIncome", face: "budget", amount: inc.value, currency: inc.currency ?? undefined, rawText: text };
      }
    }

    // Transfer — "transfer 50 from wallet to savings", "move $200 from
    // checking to savings", "transfer 2$ from account to drawer", "transfer
    // $50 to savings from wallet", "move 500k lbp from drawer to wallet".
    // The amount phrase is read by the shared extractor (HUB-75). Both
    // from/to orderings are accepted; "from" and "to" ownership never
    // depends on which comes first.
    const transferFromTo = text.match(
      new RegExp(String.raw`\b(?:transfer|move|send)\s+(${AMOUNT_PHRASE})\s+from\s+(.+?)\s+to\s+(.+?)(?:[.?!]|$)`, "i"),
    );
    const transferToFrom = transferFromTo
      ? null
      : text.match(
          new RegExp(String.raw`\b(?:transfer|move|send)\s+(${AMOUNT_PHRASE})\s+to\s+(.+?)\s+from\s+(.+?)(?:[.?!]|$)`, "i"),
        );
    const transferMatch = transferFromTo ?? transferToFrom;
    if (transferMatch) {
      const parsed = phraseAmount(transferMatch[1]);
      const [fromHint, toHint] = transferFromTo
        ? [transferMatch[2], transferMatch[3]]
        : [transferMatch[3], transferMatch[2]];
      return {
        kind: "transfer",
        face: "budget",
        amount: parsed?.value,
        currency: parsed?.currency ?? undefined,
        fromHint: fromHint.trim(),
        toHint: toHint.trim(),
        rawText: text,
      };
    }

    // HUB-78 — one side named: "I took 300$ from Drawer", "withdrew 50 from
    // savings", "put 200 in savings", "move 100 to savings". The resolver
    // asks for the other account as chips. A list/shopping target is never
    // an account ("add 5 eggs to the shopping list").
    const fromOnly = text.match(
      new RegExp(String.raw`\b(?:took|take|withdrew|withdraw|pulled|moved?|transfer(?:red)?|sent|send)\s+(${AMOUNT_PHRASE})\s+(?:out\s+)?(?:of|from)\s+(?:the\s+|my\s+)?(.+?)(?:[.?!]|$)`, "i"),
    );
    const toOnly = fromOnly
      ? null
      : text.match(
          new RegExp(String.raw`\b(?:put|move|transfer|send|add|deposit)\s+(${AMOUNT_PHRASE})\s+(?:in|into|to)\s+(?:the\s+|my\s+)?(.+?)(?:[.?!]|$)`, "i"),
        );
    const oneSided = fromOnly ?? toOnly;
    if (oneSided && !/\b(?:list|shopping|groceries|grocery|cart)\b/i.test(oneSided[2])) {
      const parsed = phraseAmount(oneSided[1]);
      return {
        kind: "transfer",
        face: "budget",
        amount: parsed?.value,
        currency: parsed?.currency ?? undefined,
        fromHint: fromOnly ? oneSided[2].trim() : undefined,
        toHint: toOnly ? oneSided[2].trim() : undefined,
        rawText: text,
      };
    }

    // Record a debt — "John owes me $30 for lunch", "record a debt: John
    // owes 30", "John owes me 30$ for lunch" (trailing currency marker).
    const debtMatch = text.match(
      new RegExp(
        String.raw`^(?:record\s+(?:a\s+)?debt[:\s]+)?(\w[\w\s]{1,40}?)\s+owes?(?:\s+me)?\s+(${AMOUNT_PHRASE})(?:\s+for\s+(.+?))?[.?!]*$`,
        "i",
      ),
    );
    if (debtMatch) {
      const parsed = phraseAmount(debtMatch[2]);
      return {
        kind: "recordDebt",
        face: "budget",
        debtorName: debtMatch[1].trim(),
        amount: parsed?.value,
        currency: parsed?.currency ?? undefined,
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

    // Transaction draft — "I paid $25 on fuel", "log $12 for coffee",
    // "spent 12$ on coffee". Require clear spend semantics: a spend verb PLUS
    // a positionally- or currency-implied amount (see extractAmount), never
    // income (see INCOME_RE), and never a non-money unit unless
    // currency-marked. This stops "spent 2 hours studying" AND "I bought 2
    // shirts" from drafting a money transaction.
    //
    // HUB-75 — a verbless capture ("coffee 4$", "500k lbp groceries") drafts
    // too, but only while Budget is the active face, only with an explicit
    // currency marker, and only in capture shape: short, no question mark, no
    // copula ("rent is 500$" is a statement about a price, not a spend).
    // A bare `k` amount ("taxi 250k") is money even with no marker.
    const bare = extractAmount(text, { allowBare: true });
    const found = extractAmount(text) ?? (bare?.kShorthand ? bare : undefined);
    const hasSpendVerb =
      /\b(?:paid|pay|spent|spend|bought|buy|cost|costs|logged|log|recorded|record|charged)\b/i.test(
        text,
      );
    const isVerblessCapture =
      (found?.marked === true || found?.kShorthand === true) &&
      ctx?.activeFaceKey === "budget" &&
      !text.includes("?") &&
      // Amount-first is the household's Hub style ("15$ pharmacy folic acid
      // vitamin d muscerol") and runs longer (HUB-79, owner export).
      text.trim().split(/\s+/).length <= (/^\s*[$€£]?\d+(?:[.,]\d+)?k?\s?(?:[$€£]|usd|lbp)?(?:\s|$)/i.test(text) ? 10 : 6) &&
      !/\b(?:is|are|was|were|be|will|would|should|could|if)\b/i.test(text) &&
      // HUB-77 Gym: no pronoun, direction or edit words either — "I took
      // 300$ from Drawer" (maybe a transfer) and "make it 20$ instead" (a
      // correction) are not captures.
      !/\b(?:i|we|you|he|she|they|it|my|from|to|into|took|take|withdrew|gave|got|make|instead|owe|owes|men|7aw+el)\b/i.test(text);
    // HUB-79 (owner export) — "Gaz yaris 38": a short Budget-face note that
    // ENDS in a bare number is the household's shorthand for a spend. The
    // submitter drafts it on the default account; the receipt offers Undo.
    const trailingBare =
      found === undefined &&
      ctx?.activeFaceKey === "budget" &&
      /^\s*[a-z\u0600-\u06ff][\w\u0600-\u06ff'-]*(?:\s+[a-z\u0600-\u06ff][\w\u0600-\u06ff'-]*){0,3}\s+(\d+(?:[.,]\d{1,2})?)\s*$/i.exec(text);
    if (
      trailingBare &&
      !INCOME_RE.test(text) &&
      !NON_MONEY_UNIT_RE.test(text) &&
      !/\b(?:i|we|you|he|she|they|it|my|at|on|in|room|page|number|floor|age|year|day)\b/i.test(text)
    ) {
      return {
        kind: "draftTransaction",
        face: "budget",
        amount: Number(trailingBare[1].replace(",", ".")),
        description: text,
        rawText: text,
      };
    }

    if (
      found !== undefined &&
      (hasSpendVerb || isVerblessCapture) &&
      !INCOME_RE.test(text) &&
      (found.marked || !NON_MONEY_UNIT_RE.test(text))
    ) {
      return {
        kind: "draftTransaction",
        face: "budget",
        amount: found.value,
        currency: found.currency ?? undefined,
        description: text,
        rawText: text,
      };
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

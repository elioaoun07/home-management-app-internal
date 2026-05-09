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

export const budgetRouter: FaceIntentRouter = {
  parse(text) {
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

    // Transaction draft — "I paid $25 on fuel"
    const amount = extractAmount(text);
    if (amount !== undefined && /\b(paid|pay|spent|spend|bought|cost)\b/i.test(text)) {
      return { kind: "draftTransaction", face: "budget", amount, description: text, rawText: text };
    }

    // Show analytics — "show my budget / analytics"
    if (/\b(analytics|show.*budget|my budget|budget.*show)\b/i.test(text)) {
      return { kind: "showAnalytics", face: "budget", rawText: text };
    }

    // Generic budget face switch
    if (
      /\b(budget|expense|income|transaction|balance|account|money|cost|fuel|grocery|groceries|lbp|\$|usd)\b/i.test(text)
    ) {
      return { kind: "switchFace", face: "budget", rawText: text };
    }

    return null;
  },
};

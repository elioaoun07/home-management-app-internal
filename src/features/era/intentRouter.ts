// src/features/era/intentRouter.ts
// Phase 0 stub IntentRouter — keyword matcher only.
//
// Intentionally tiny and synchronous. Phase 2 will replace this implementation
// with a Gemini-backed router (probably gemini-2.5-flash-lite for the classify
// hop, gemini-2.5-flash for structured JSON drafting). The IntentRouter
// interface stays stable across that transition so the command bar UI does
// not have to change.

import type { FaceKey, Intent, IntentRouter } from "./types";

/** Lowercased keyword groups → face. Order matters: first match wins. */
const FACE_KEYWORDS: Array<{ face: FaceKey; words: ReadonlyArray<string> }> = [
  {
    face: "budget",
    words: [
      "budget",
      "spent",
      "spend",
      "paid",
      "pay",
      "expense",
      "income",
      "transaction",
      "balance",
      "account",
      "$",
      "usd",
      "lbp",
      "money",
      "cost",
      "fuel",
      "grocery",
      "groceries",
    ],
  },
  {
    face: "schedule",
    words: [
      "remind",
      "reminder",
      "task",
      "todo",
      "to-do",
      "schedule",
      "tomorrow",
      "today",
      "deadline",
      "appointment",
      "event",
      "meeting",
      "calendar",
      "due",
    ],
  },
  {
    face: "chef",
    words: [
      "recipe",
      "cook",
      "meal",
      "dinner",
      "lunch",
      "breakfast",
      "ingredient",
      "shopping list",
      "groceries", // ambiguous with budget; budget keyword above wins by order
      "kitchen",
    ],
  },
  {
    face: "brain",
    words: [
      "catalogue",
      "catalog",
      "inventory",
      "remember",
      "memory",
      "note",
      "stock",
      "have we got",
      "do we have",
    ],
  },
];

/** True if `text` contains the word as a whole token (cheap heuristic). */
function containsWord(text: string, word: string): boolean {
  if (word.includes(" ")) return text.includes(word);
  // Match $ and other single-char markers as substrings.
  if (word.length <= 2) return text.includes(word);
  const re = new RegExp(`(^|[^a-z])${word}([^a-z]|$)`, "i");
  return re.test(text);
}

function detectFace(lowered: string): FaceKey | null {
  for (const group of FACE_KEYWORDS) {
    for (const w of group.words) {
      if (containsWord(lowered, w)) return group.face;
    }
  }
  return null;
}

/** Very rough amount extractor: $25, 25$, 25 usd, etc. */
function extractAmount(text: string): number | undefined {
  const m = text.match(
    /\$?\s?(\d+(?:[.,]\d{1,2})?)\s?(?:\$|usd|lbp|dollars?)?/i,
  );
  if (!m) return undefined;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export const stubIntentRouter: IntentRouter = {
  parse(text: string): Intent {
    const trimmed = text.trim();
    if (!trimmed) return { kind: "unknown", rawText: text };

    const lowered = trimmed.toLowerCase();
    const face = detectFace(lowered);

    if (face === "budget") {
      const amount = extractAmount(trimmed);
      // "i paid $25 car fuel" / "spent 12 on coffee" → draftTransaction
      if (
        amount !== undefined &&
        /\b(paid|pay|spent|spend|bought|cost)\b/i.test(trimmed)
      ) {
        return {
          kind: "draftTransaction",
          face: "budget",
          amount,
          description: trimmed,
          rawText: text,
        };
      }
      // "how much did i spend last month" / "show my budget" → analytics
      if (
        /\b(how much|show|last month|this month|analytics)\b/i.test(trimmed)
      ) {
        return { kind: "showAnalytics", face: "budget", rawText: text };
      }
      return { kind: "switchFace", face: "budget", rawText: text };
    }

    if (face === "schedule") {
      if (/\bremind\b|\bremember to\b/i.test(trimmed)) {
        return {
          kind: "draftReminder",
          face: "schedule",
          title: trimmed,
          rawText: text,
        };
      }
      return { kind: "switchFace", face: "schedule", rawText: text };
    }

    if (face === "chef" || face === "brain") {
      return { kind: "switchFace", face, rawText: text };
    }

    return { kind: "unknown", rawText: text };
  },
};

import { parseMessageForTransaction } from "@/lib/nlp/messageTransactionParser";

export type Intent =
  | { kind: "log_expense"; amount: number | null; category: string | null; categoryId: string | null; subcategoryId: string | null; date: string | null; confidence: number }
  | { kind: "set_reminder"; title: string; confidence: number }
  | { kind: "add_to_shopping"; items: string[]; confidence: number }
  | { kind: "query_balance"; confidence: number }
  | { kind: "query_items"; filter: "today" | "overdue" | "open"; confidence: number }
  | { kind: "cancel"; confidence: 1 }
  | { kind: "sleep"; confidence: 1 }
  | { kind: "unknown"; transcript: string; confidence: 0 };

interface Category {
  id: string;
  name: string;
  parent_id?: string | null;
  subcategories?: Array<{ id: string; name: string }>;
}

/** Keywords that immediately end the turn. */
const CANCEL_WORDS = /^(cancel|stop|never ?mind|abort|no)\b/i;
const SLEEP_WORDS = /\b(thanks? era|that'?s? all|goodbye era|bye era|go to sleep|stop listening)\b/i;

const EXPENSE_VERBS = /\b(spent|paid|bought|purchased|got|ordered|charged|spend|pay)\b/i;
const REMINDER_VERBS = /\b(remind|remember|don'?t forget|set (a |an )?reminder|alert me)\b/i;
const SHOPPING_VERBS = /\b(add|put|include|need)\b.*\b(to|on|in)\b.*(shopping|grocery|groceries|list|cart)\b/i;
const SHOPPING_DIRECT = /\b(shopping list|grocery list)\b.*\b(add|needs?)\b/i;
const BALANCE_QUERY = /\b(balance|how ?much|what('?s| is) my (balance|budget|spending|total|left)|how am i doing|remaining|spent (this )?month)\b/i;
const ITEMS_TODAY = /\b(what('?s| is) (on )?(today'?s |my )?(todo|list|schedule|reminder|task)|(what do I|what should I) (do today|have today))\b/i;
const ITEMS_OVERDUE = /\b(overdue|late|missed|past due)\b/i;
const ITEMS_OPEN = /\b(open (tasks?|reminders?|items?)|what'?s? (open|pending|left to do))\b/i;

/**
 * Classify a voice transcript into a typed Intent.
 * Categories are needed only for expense matching — pass an empty array if unavailable.
 */
export function classifyIntent(transcript: string, categories: Category[]): Intent {
  const t = transcript.trim();
  const lower = t.toLowerCase();

  // Control intents — highest priority
  if (CANCEL_WORDS.test(lower)) return { kind: "cancel", confidence: 1 };
  if (SLEEP_WORDS.test(lower)) return { kind: "sleep", confidence: 1 };

  // Query intents
  if (BALANCE_QUERY.test(lower)) return { kind: "query_balance", confidence: 0.92 };
  if (ITEMS_OVERDUE.test(lower)) return { kind: "query_items", filter: "overdue", confidence: 0.90 };
  if (ITEMS_TODAY.test(lower)) return { kind: "query_items", filter: "today", confidence: 0.88 };
  if (ITEMS_OPEN.test(lower)) return { kind: "query_items", filter: "open", confidence: 0.88 };

  // Shopping intent
  if (SHOPPING_VERBS.test(lower) || SHOPPING_DIRECT.test(lower)) {
    const items = extractShoppingItems(lower);
    if (items.length > 0) return { kind: "add_to_shopping", items, confidence: 0.88 };
  }

  // Reminder intent
  if (REMINDER_VERBS.test(lower)) {
    const title = extractReminderTitle(t);
    return { kind: "set_reminder", title, confidence: title.length > 3 ? 0.85 : 0.60 };
  }

  // Expense intent — use existing NLP parser (handles fuzzy category matching)
  if (EXPENSE_VERBS.test(lower) || /\$\d|\d+\s*(dollars?|usd|lbp|eur)/i.test(lower)) {
    const parsed = parseMessageForTransaction(t, categories);
    if (parsed.amount !== null && parsed.confidence >= 0.5) {
      return {
        kind: "log_expense",
        amount: parsed.amount,
        category: parsed.categoryName,
        categoryId: parsed.categoryId,
        subcategoryId: parsed.subcategoryId,
        date: parsed.date,
        confidence: parsed.confidence,
      };
    }
    // Amount detected but low confidence — still return expense with lower confidence
    if (parsed.amount !== null) {
      return {
        kind: "log_expense",
        amount: parsed.amount,
        category: parsed.categoryName,
        categoryId: parsed.categoryId,
        subcategoryId: parsed.subcategoryId,
        date: parsed.date,
        confidence: 0.45,
      };
    }
  }

  return { kind: "unknown", transcript: t, confidence: 0 };
}

function extractShoppingItems(text: string): string[] {
  // "add milk, eggs, and bread to the shopping list" → ["milk", "eggs", "bread"]
  const stripped = text
    .replace(/\b(add|put|include|need|to the|on the|in the|shopping list|grocery list|grocery|groceries|list|cart)\b/gi, " ")
    .replace(/\band\b/gi, ",")
    .trim();
  return stripped
    .split(/[,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !/^\d+$/.test(s));
}

function extractReminderTitle(text: string): string {
  return text
    .replace(/\b(remind me to|remind me|set a reminder to|set a reminder for|don't forget to|don't forget|remember to|alert me to)\b/gi, "")
    .replace(/\b(in|at|on|tomorrow|today|tonight|next)\b.*$/i, "")
    .trim()
    .replace(/^[,\s]+|[,\s]+$/g, "");
}

// Lightweight NLP helpers to parse a spoken expense sentence into
// amount, category and subcategory using fuzzy matching.
// No external deps to keep bundle small.

import type { UICategory } from "@/features/categories/useCategoriesQuery";

export type ParsedExpense = {
  description: string; // Always echo back the literal speech
  amount?: number; // Net amount after change/refund, if detected
  categoryId?: string;
  subcategoryId?: string;
  categoryName?: string; // Name for display
  subcategoryName?: string; // Name for display
  confidenceScore?: number; // 0-1 confidence in category match
  date?: string; // ISO date string (YYYY-MM-DD) if detected
  notes?: string[]; // optional reasons/debug
};

// Words to numbers map (0-90 plus some extras)
const NUM_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

const PAY_WORDS = ["pay", "paid", "spent", "buy", "bought"];
const CHANGE_WORDS = [
  "change",
  "refund",
  "cashback",
  "cash back",
  "got back",
  "returned",
  "gave me back",
];
const SEP_REGEX = /[\s,]+/g;

// Date parsing helpers
function parseRelativeDate(sentence: string): Date | null {
  const today = new Date();
  const normalized = normalize(sentence);

  // Yesterday
  if (/\byesterday\b/.test(normalized)) {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return date;
  }

  // Last [day of week] - finds the most recent occurrence
  const dayMatch = normalized.match(
    /\blast\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
  );
  if (dayMatch) {
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const targetDay = dayNames.indexOf(dayMatch[1]);
    const currentDay = today.getDay();
    let daysAgo = currentDay - targetDay;
    if (daysAgo <= 0) daysAgo += 7; // Go to previous week
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  // Last business day (Monday-Friday, excluding weekends)
  if (
    /\blast\s+business\s+day\b/.test(normalized) ||
    /\blast\s+working\s+day\b/.test(normalized)
  ) {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    // If it's a weekend, go back to Friday
    if (date.getDay() === 0)
      date.setDate(date.getDate() - 2); // Sunday -> Friday
    else if (date.getDay() === 6) date.setDate(date.getDate() - 1); // Saturday -> Friday
    return date;
  }

  // Last week
  if (/\blast\s+week\b/.test(normalized)) {
    const date = new Date(today);
    date.setDate(date.getDate() - 7);
    return date;
  }

  // Last month
  if (/\blast\s+month\b/.test(normalized)) {
    const date = new Date(today);
    date.setMonth(date.getMonth() - 1);
    return date;
  }

  // X days ago
  const daysAgoMatch = normalized.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\s+ago\b/
  );
  if (daysAgoMatch) {
    const daysWord = daysAgoMatch[1];
    const days = NUM_WORDS[daysWord] || parseInt(daysWord);
    if (!isNaN(days)) {
      const date = new Date(today);
      date.setDate(date.getDate() - days);
      return date;
    }
  }

  return null;
}

// Math expression parsing
function parseMathExpression(sentence: string): number | null {
  const normalized = normalize(sentence);

  // Pattern: "X minus Y" or "X - Y" - handle numbers with commas
  const minusMatch = normalized.match(
    /(\d+(?:[,\s]\d+)*(?:\.\d+)?)\s*(?:minus|-|and got back)\s*(\d+(?:[,\s]\d+)*(?:\.\d+)?)/
  );
  if (minusMatch) {
    const a = parseFloat(minusMatch[1].replace(/[,\s]/g, ""));
    const b = parseFloat(minusMatch[2].replace(/[,\s]/g, ""));
    return a - b;
  }

  // Pattern: "X plus Y" or "X + Y"
  const plusMatch = normalized.match(
    /(\d+(?:[,\s]\d+)*(?:\.\d+)?)\s*(?:plus|\+)\s*(\d+(?:[,\s]\d+)*(?:\.\d+)?)/
  );
  if (plusMatch) {
    const a = parseFloat(plusMatch[1].replace(/[,\s]/g, ""));
    const b = parseFloat(plusMatch[2].replace(/[,\s]/g, ""));
    return a + b;
  }

  // Pattern: "X times Y" or "X * Y"
  const timesMatch = normalized.match(
    /(\d+(?:[,\s]\d+)*(?:\.\d+)?)\s*(?:times|\*|x)\s*(\d+(?:[,\s]\d+)*(?:\.\d+)?)/
  );
  if (timesMatch) {
    const a = parseFloat(timesMatch[1].replace(/[,\s]/g, ""));
    const b = parseFloat(timesMatch[2].replace(/[,\s]/g, ""));
    return a * b;
  }

  // Pattern: "X divided by Y" or "X / Y"
  const divideMatch = normalized.match(
    /(\d+(?:[,\s]\d+)*(?:\.\d+)?)\s*(?:divided by|\/)\s*(\d+(?:[,\s]\d+)*(?:\.\d+)?)/
  );
  if (divideMatch) {
    const a = parseFloat(divideMatch[1].replace(/[,\s]/g, ""));
    const b = parseFloat(divideMatch[2].replace(/[,\s]/g, ""));
    return b !== 0 ? a / b : null;
  }

  return null;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[$€£]|dollars?|euros?|pounds?/g, "")
    .replace(/[^a-z0-9\s&,.-]/g, " ") // Keep commas and periods for numbers
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(SEP_REGEX).filter(Boolean);
}

// Simple plural/singular normalization: trim trailing 's' if present
function stem(word: string) {
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function scoreName(sentence: string, target: string): number {
  const s = normalize(sentence);
  const t = normalize(target);
  if (!t) return 0;
  if (s.includes(t)) return 1;
  // Try singular/plural variant
  const tv = stem(t);
  if (tv !== t && s.includes(tv)) return 0.95;

  // Token overlap ratio
  const sTokens = new Set(tokenize(s).map(stem));
  const tTokens = tokenize(t).map(stem);
  if (tTokens.length === 0) return 0;
  let hit = 0;
  for (const tok of tTokens) if (sTokens.has(tok)) hit++;
  return hit / tTokens.length;
}

function parseNumbers(sentence: string) {
  const tokens = tokenize(sentence);
  const numbers: { index: number; value: number }[] = [];

  // digit numbers - handle commas in thousands
  tokens.forEach((tok, i) => {
    const m = tok.match(/^[\d,]+(?:\.\d+)?$/);
    if (m) {
      const cleaned = m[0].replace(/,/g, "");
      numbers.push({ index: i, value: parseFloat(cleaned) });
    }
  });

  // word numbers (support simple combos: "fifty five", "one hundred", etc.)
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (w in NUM_WORDS) {
      let val = NUM_WORDS[w];
      let j = i + 1;
      // handle "hundred" as multiplier or additive tens/ones
      while (j < tokens.length) {
        const nxt = tokens[j];
        if (nxt === "and") {
          j++;
          continue;
        }
        if (!(nxt in NUM_WORDS)) break;
        const v = NUM_WORDS[nxt];
        if (val && v === 100) {
          val = val * 100;
        } else {
          val = val + v;
        }
        j++;
      }
      numbers.push({ index: i, value: val });
      i = j - 1;
    }
  }
  return numbers.sort((a, b) => a.index - b.index);
}

type FlatCategory = {
  id: string;
  name: string;
  parentId: string | null;
};

function flattenCategories(cats: UICategory[]): {
  categories: FlatCategory[]; // parentId null
  subcategories: FlatCategory[]; // parentId != null
  parentBySubId: Map<string, string>;
} {
  const categories: FlatCategory[] = [];
  const subcategories: FlatCategory[] = [];
  const parentBySubId = new Map<string, string>();

  for (const c of cats as any[]) {
    if ("parent_id" in c) {
      // DB-flat
      const parentId = (c as any).parent_id as string | null;
      if (parentId) {
        subcategories.push({ id: c.id, name: c.name, parentId });
      } else {
        categories.push({ id: c.id, name: c.name, parentId: null });
      }
    } else if ("subcategories" in c && Array.isArray(c.subcategories)) {
      categories.push({ id: c.id, name: c.name, parentId: null });
      for (const s of c.subcategories!) {
        subcategories.push({ id: s.id, name: s.name, parentId: c.id });
        parentBySubId.set(s.id, c.id);
      }
    } else {
      categories.push({ id: c.id, name: c.name, parentId: null });
    }
  }

  // Build parent map for DB-flat (if not provided)
  if (parentBySubId.size === 0 && subcategories.length > 0) {
    for (const s of subcategories) parentBySubId.set(s.id, s.parentId!);
  }

  return { categories, subcategories, parentBySubId };
}

function classifyAmounts(sentence: string): { pay?: number; change?: number } {
  const tokens = tokenize(sentence);
  const numbers = parseNumbers(sentence);
  if (numbers.length === 0) return {};

  const payIdx = tokens.findIndex((t) => PAY_WORDS.includes(t));
  let changeIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const chunk = tokens.slice(i, i + 2).join(" ");
    if (CHANGE_WORDS.some((w) => w === tokens[i] || w === chunk)) {
      changeIdx = i;
      break;
    }
  }

  const nearestNumberAfter = (idx: number) => {
    if (idx < 0) return undefined;
    const candidate = numbers.find((n) => n.index >= idx && n.index - idx <= 5);
    return candidate?.value;
  };

  const pay = nearestNumberAfter(payIdx) ?? numbers[0]?.value;
  let change = nearestNumberAfter(changeIdx);

  // If "got back" present but no number close-by and there are 2 numbers overall, assume the second is change
  const changePhrasePresent = changeIdx >= 0;
  if (changePhrasePresent && change == null && numbers.length >= 2) {
    change = numbers[1].value;
  }

  return { pay, change };
}

function chooseBest<T extends { id: string; name: string }>(
  sentence: string,
  candidates: T[],
  threshold = 0.8
): { id?: string; score?: number } {
  const scored = candidates
    .map((c) => ({ id: c.id, score: scoreName(sentence, c.name) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  if (!best || best.score < threshold) return {};
  // If ambiguous (scores within 0.05), skip auto-select
  if (second && best.score - second.score < 0.05) return {};
  return best;
}

export function parseSpeechExpense(
  sentence: string,
  categories: UICategory[]
): ParsedExpense {
  const notes: string[] = [];
  const {
    categories: cats,
    subcategories: subs,
    parentBySubId,
  } = flattenCategories(categories);

  // Try math expression first
  const mathResult = parseMathExpression(sentence);

  const { pay, change } = classifyAmounts(sentence);
  let amount: number | undefined = undefined;

  // Prioritize math expression result
  if (mathResult !== null && mathResult > 0) {
    amount = mathResult;
    notes.push(`calculated=${amount}`);
  } else if (typeof pay === "number") {
    amount = pay - (change ?? 0);
    if (amount < 0) amount = Math.abs(amount); // avoid negative due to parsing flip
  }
  if (amount != null) notes.push(`amount=${amount}`);

  // Parse relative date
  const parsedDate = parseRelativeDate(sentence);
  const date = parsedDate?.toISOString().split("T")[0];
  if (date) notes.push(`date=${date}`);

  // Prefer subcategory matches first (with improved threshold)
  const subBest = chooseBest(sentence, subs, 0.65); // Lower threshold for better matches
  let categoryId: string | undefined;
  let subcategoryId: string | undefined;
  let categoryName: string | undefined;
  let subcategoryName: string | undefined;
  let confidenceScore: number | undefined;

  if (subBest.id) {
    subcategoryId = subBest.id;
    categoryId = parentBySubId.get(subBest.id);
    const subcat = subs.find((s) => s.id === subBest.id);
    subcategoryName = subcat?.name;
    const cat = cats.find((c) => c.id === categoryId);
    categoryName = cat?.name;
    confidenceScore = subBest.score;
  } else {
    const catBest = chooseBest(sentence, cats, 0.7); // Lower threshold for better matches
    if (catBest.id) {
      categoryId = catBest.id;
      const cat = cats.find((c) => c.id === catBest.id);
      categoryName = cat?.name;
      confidenceScore = catBest.score;
    }
  }

  const description = sentence.trim();

  return {
    description,
    amount,
    categoryId,
    subcategoryId,
    categoryName,
    subcategoryName,
    confidenceScore,
    date,
    notes,
  };
}

// src/lib/nlp/messageTransactionParser.ts
// Parse chat messages to extract transaction information

export interface ParsedMessageTransaction {
  amount: number | null;
  categoryId: string | null;
  subcategoryId: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  description: string;
  date: string | null; // YYYY-MM-DD format or null for today
  confidence: number; // 0-1 score
}

interface CategoryMatch {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * Parse a chat message to extract transaction details
 * Example: "Don't forget to add 20$ as fuel today"
 * Returns: { amount: 20, category: "Transport", subcategory: "Fuel", description: "..." }
 */
export function parseMessageForTransaction(
  message: string,
  categories: Array<{
    id: string;
    name: string;
    parent_id?: string | null;
    subcategories?: Array<{ id: string; name: string }>;
  }>,
): ParsedMessageTransaction {
  const normalized = message.toLowerCase().trim();

  // Extract amount (supports $20, 20$, 20 dollars, 20usd, etc.)
  const amount = extractAmount(normalized);

  // Extract date (supports today, yesterday, last friday, etc.)
  const date = extractDate(normalized);

  // Flatten categories for matching
  const { parentCategories, subcategories, parentBySubId } =
    flattenCategories(categories);

  // Try to match categories/subcategories
  const categoryMatch = matchCategory(
    normalized,
    parentCategories,
    subcategories,
    parentBySubId,
  );

  return {
    amount,
    categoryId: categoryMatch.categoryId,
    subcategoryId: categoryMatch.subcategoryId,
    categoryName: categoryMatch.categoryName,
    subcategoryName: categoryMatch.subcategoryName,
    description: message, // Keep original message as description
    date,
    confidence: calculateConfidence(amount, categoryMatch),
  };
}

/**
 * Extract amount from message text
 */
function extractAmount(text: string): number | null {
  // Patterns: $20, 20$, 20 dollars, 20.50$, 20,50€, etc.
  const patterns = [
    /\$\s*(\d+(?:[.,]\d{1,2})?)/i, // $20 or $ 20
    /(\d+(?:[.,]\d{1,2})?)\s*\$/i, // 20$ or 20 $
    /(\d+(?:[.,]\d{1,2})?)\s*(?:dollar|dollars|usd|lbp|eur|euro)/i, // 20 dollars
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1].replace(",", ".");
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) {
        return num;
      }
    }
  }

  return null;
}

/**
 * Extract date from message text
 * Supports: today, yesterday, tomorrow, last/this monday-sunday
 */
function extractDate(text: string): string | null {
  const today = new Date();

  // Helper to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Helper to get date for a specific day of week
  const getDateForDay = (targetDay: number, isLast: boolean): Date => {
    const result = new Date(today);
    const currentDay = today.getDay();
    let diff = targetDay - currentDay;

    if (isLast) {
      // Last [day] means the most recent occurrence
      if (diff >= 0) {
        diff -= 7; // Go back to last week
      }
    } else {
      // This [day] means upcoming or today
      if (diff < 0) {
        diff += 7; // Go forward to next week
      }
    }

    result.setDate(today.getDate() + diff);
    return result;
  };

  // Check for "today"
  if (/\btoday\b/.test(text)) {
    return formatDate(today);
  }

  // Check for "yesterday"
  if (/\byesterday\b/.test(text)) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return formatDate(yesterday);
  }

  // Check for "tomorrow"
  if (/\btomorrow\b/.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return formatDate(tomorrow);
  }

  // Days of week mapping
  const daysMap: { [key: string]: number } = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    tues: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    thur: 4,
    thurs: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };

  // Check for "last [day]", "this [day]", or "next [day]"
  for (const [dayName, dayNum] of Object.entries(daysMap)) {
    const lastPattern = new RegExp(`\\blast\\s+${dayName}\\b`, "i");
    const thisPattern = new RegExp(`\\bthis\\s+${dayName}\\b`, "i");
    const nextPattern = new RegExp(`\\bnext\\s+${dayName}\\b`, "i");

    if (lastPattern.test(text)) {
      return formatDate(getDateForDay(dayNum, true));
    }
    if (thisPattern.test(text)) {
      return formatDate(getDateForDay(dayNum, false));
    }
    if (nextPattern.test(text)) {
      // "next friday" = the upcoming occurrence in the next 7 days (if today is that day, go +7)
      const result = new Date(today);
      const currentDay = today.getDay();
      let diff = dayNum - currentDay;
      if (diff <= 0) diff += 7;
      result.setDate(today.getDate() + diff);
      return formatDate(result);
    }
  }

  // Also match bare day names: "pay john friday" → next occurrence of friday
  for (const [dayName, dayNum] of Object.entries(daysMap)) {
    const barePattern = new RegExp(`\\b${dayName}\\b`, "i");
    if (barePattern.test(text)) {
      // Treat bare day name as the upcoming occurrence
      const result = new Date(today);
      const currentDay = today.getDay();
      let diff = dayNum - currentDay;
      if (diff <= 0) diff += 7;
      result.setDate(today.getDate() + diff);
      return formatDate(result);
    }
  }

  // Month name mapping
  const monthsMap: { [key: string]: number } = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  };

  // Check for "on/by/due [Month] [Day]" or "[Month] [Day]" patterns
  const monthNames = Object.keys(monthsMap).join("|");
  const monthDayPattern = new RegExp(
    `(?:on|by|due|before)?\\s*(?:the\\s+)?(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?`,
    "i",
  );
  const monthDayMatch = text.match(monthDayPattern);
  if (monthDayMatch) {
    const monthNum = monthsMap[monthDayMatch[1].toLowerCase()];
    const dayNum = parseInt(monthDayMatch[2], 10);
    if (monthNum !== undefined && dayNum >= 1 && dayNum <= 31) {
      const result = new Date(today.getFullYear(), monthNum, dayNum);
      // If the date has passed this year, assume next year
      if (result < today) {
        result.setFullYear(result.getFullYear() + 1);
      }
      return formatDate(result);
    }
  }

  // Check for "[Day] [Month]" pattern (e.g. "15 feb", "3rd march")
  const dayMonthPattern = new RegExp(
    `(?:on|by|due|before)?\\s*(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})`,
    "i",
  );
  const dayMonthMatch = text.match(dayMonthPattern);
  if (dayMonthMatch) {
    const dayNum = parseInt(dayMonthMatch[1], 10);
    const monthNum = monthsMap[dayMonthMatch[2].toLowerCase()];
    if (monthNum !== undefined && dayNum >= 1 && dayNum <= 31) {
      const result = new Date(today.getFullYear(), monthNum, dayNum);
      if (result < today) {
        result.setFullYear(result.getFullYear() + 1);
      }
      return formatDate(result);
    }
  }

  // Check for numeric date patterns: MM/DD, M/D, DD/MM (interpret as M/D since locale ambiguous)
  const numericDatePattern =
    /(?:on|by|due|before)\s+(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i;
  const numericMatch = text.match(numericDatePattern);
  if (numericMatch) {
    const first = parseInt(numericMatch[1], 10);
    const second = parseInt(numericMatch[2], 10);
    let year = numericMatch[3]
      ? parseInt(numericMatch[3], 10)
      : today.getFullYear();
    if (year < 100) year += 2000;
    // Treat as M/D
    const result = new Date(year, first - 1, second);
    if (!numericMatch[3] && result < today) {
      result.setFullYear(result.getFullYear() + 1);
    }
    if (!isNaN(result.getTime())) {
      return formatDate(result);
    }
  }

  // Check for "in X days/weeks"
  const inDaysPattern = /\bin\s+(\d+)\s+days?\b/i;
  const inDaysMatch = text.match(inDaysPattern);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const result = new Date(today);
    result.setDate(today.getDate() + days);
    return formatDate(result);
  }

  const inWeeksPattern = /\bin\s+(\d+)\s+weeks?\b/i;
  const inWeeksMatch = text.match(inWeeksPattern);
  if (inWeeksMatch) {
    const weeks = parseInt(inWeeksMatch[1], 10);
    const result = new Date(today);
    result.setDate(today.getDate() + weeks * 7);
    return formatDate(result);
  }

  // No date found, return null (will default to today)
  return null;
}

/**
 * Flatten categories structure for easy matching
 */
function flattenCategories(
  categories: Array<{
    id: string;
    name: string;
    parent_id?: string | null;
    subcategories?: Array<{ id: string; name: string }>;
  }>,
): {
  parentCategories: CategoryMatch[];
  subcategories: CategoryMatch[];
  parentBySubId: Map<string, string>;
} {
  const parentCategories: CategoryMatch[] = [];
  const subcategories: CategoryMatch[] = [];
  const parentBySubId = new Map<string, string>();

  for (const cat of categories) {
    // Handle DB-flat structure (with parent_id)
    if ("parent_id" in cat) {
      if (cat.parent_id) {
        subcategories.push({
          id: cat.id,
          name: cat.name,
          parentId: cat.parent_id,
        });
        parentBySubId.set(cat.id, cat.parent_id);
      } else {
        parentCategories.push({
          id: cat.id,
          name: cat.name,
          parentId: null,
        });
      }
    }
    // Handle nested structure (with subcategories array)
    else if ("subcategories" in cat && Array.isArray(cat.subcategories)) {
      parentCategories.push({
        id: cat.id,
        name: cat.name,
        parentId: null,
      });
      for (const sub of cat.subcategories) {
        subcategories.push({
          id: sub.id,
          name: sub.name,
          parentId: cat.id,
        });
        parentBySubId.set(sub.id, cat.id);
      }
    }
  }

  return { parentCategories, subcategories, parentBySubId };
}

/**
 * Match category and subcategory from text
 * Prioritizes subcategory matches as they're more specific
 */
function matchCategory(
  text: string,
  parentCategories: CategoryMatch[],
  subcategories: CategoryMatch[],
  parentBySubId: Map<string, string>,
): {
  categoryId: string | null;
  subcategoryId: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  score: number;
} {
  // Try subcategory first (more specific)
  const subMatch = findBestMatch(text, subcategories);
  if (subMatch.match && subMatch.score > 0.7) {
    const parentId = parentBySubId.get(subMatch.match.id);
    const parent = parentCategories.find((p) => p.id === parentId);
    return {
      categoryId: parentId || null,
      subcategoryId: subMatch.match.id,
      categoryName: parent?.name || null,
      subcategoryName: subMatch.match.name,
      score: subMatch.score,
    };
  }

  // Try parent category
  const catMatch = findBestMatch(text, parentCategories);
  if (catMatch.match && catMatch.score > 0.6) {
    return {
      categoryId: catMatch.match.id,
      subcategoryId: null,
      categoryName: catMatch.match.name,
      subcategoryName: null,
      score: catMatch.score,
    };
  }

  return {
    categoryId: null,
    subcategoryId: null,
    categoryName: null,
    subcategoryName: null,
    score: 0,
  };
}

/**
 * Find best category match using fuzzy string matching
 */
function findBestMatch(
  text: string,
  categories: CategoryMatch[],
): { match: CategoryMatch | null; score: number } {
  let bestMatch: CategoryMatch | null = null;
  let bestScore = 0;

  for (const cat of categories) {
    const score = calculateMatchScore(text, cat.name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cat;
    }
  }

  return { match: bestMatch, score: bestScore };
}

/**
 * Calculate match score between text and category name
 * Returns 0-1 score
 */
function calculateMatchScore(text: string, categoryName: string): number {
  const normalizedCat = categoryName.toLowerCase();

  // Exact match
  if (text.includes(normalizedCat)) {
    return 1.0;
  }

  // Word boundary match (e.g., "fuel" in "as fuel today")
  const wordPattern = new RegExp(`\\b${normalizedCat}\\b`, "i");
  if (wordPattern.test(text)) {
    return 0.95;
  }

  // Partial match at start/end
  const words = text.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(normalizedCat.substring(0, 3))) {
      return 0.8;
    }
  }

  // Fuzzy match (contains all letters in order)
  if (containsInOrder(text, normalizedCat)) {
    return 0.7;
  }

  return 0;
}

/**
 * Check if text contains all characters of pattern in order
 */
function containsInOrder(text: string, pattern: string): boolean {
  let patternIndex = 0;
  for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
    if (text[i] === pattern[patternIndex]) {
      patternIndex++;
    }
  }
  return patternIndex === pattern.length;
}

/**
 * Calculate overall confidence score
 */
function calculateConfidence(
  amount: number | null,
  categoryMatch: { score: number },
): number {
  let confidence = 0;

  // Amount found (50% weight)
  if (amount !== null) {
    confidence += 0.5;
  }

  // Category match (50% weight)
  confidence += categoryMatch.score * 0.5;

  return Math.min(confidence, 1);
}

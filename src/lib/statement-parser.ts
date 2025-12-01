// src/lib/statement-parser.ts
// PDF Statement Parser - extracts transactions from bank statement PDFs

import { ParsedTransaction } from "@/types/statement";

/**
 * Parse raw text from a bank statement PDF
 * This is a template-based parser that you can customize for your bank's format
 *
 * Lebanese bank statements typically have formats like:
 * DATE | DESCRIPTION | DEBIT | CREDIT | BALANCE
 *
 * You'll need to adjust the regex patterns based on your actual statement format
 */
export function parseStatementText(
  text: string,
  existingMappings: Map<
    string,
    {
      category_id: string | null;
      subcategory_id: string | null;
      account_id: string | null;
      merchant_name: string;
    }
  >
): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Common date formats in Lebanese bank statements
  // Adjust these patterns based on your bank's format
  const datePatterns = [
    /^(\d{2}\/\d{2}\/\d{4})/, // DD/MM/YYYY
    /^(\d{2}-\d{2}-\d{4})/, // DD-MM-YYYY
    /^(\d{2}\.\d{2}\.\d{4})/, // DD.MM.YYYY
    /^(\d{4}-\d{2}-\d{2})/, // YYYY-MM-DD
  ];

  // Pattern to extract amount (handles Lebanese formatting with commas and dots)
  const amountPattern = /[\d,]+\.?\d*/g;

  let lineIndex = 0;

  for (const line of lines) {
    // Try to find a date at the start of the line
    let dateMatch: RegExpMatchArray | null = null;
    let dateFormat = "";

    for (const pattern of datePatterns) {
      dateMatch = line.match(pattern);
      if (dateMatch) {
        dateFormat = pattern.source;
        break;
      }
    }

    if (!dateMatch) continue;

    // Extract the rest of the line after the date
    const dateStr = dateMatch[1];
    const restOfLine = line.substring(dateMatch[0].length).trim();

    // Skip header lines or empty descriptions
    if (!restOfLine || restOfLine.toLowerCase().includes("description"))
      continue;

    // Try to extract amounts from the line
    // Bank statements usually have: DESCRIPTION | DEBIT | CREDIT | BALANCE
    // We need to identify which column has the transaction amount

    const amounts = restOfLine.match(amountPattern) || [];
    const numericAmounts = amounts
      .map((a) => parseFloat(a.replace(/,/g, "")))
      .filter((a) => !isNaN(a) && a > 0);

    if (numericAmounts.length === 0) continue;

    // Extract description (text before the first amount)
    const firstAmountIndex = restOfLine.search(amountPattern);
    const description =
      firstAmountIndex > 0
        ? restOfLine.substring(0, firstAmountIndex).trim()
        : restOfLine;

    // Clean up the description
    const cleanDescription = description.replace(/\s+/g, " ").trim();

    if (!cleanDescription) continue;

    // Determine if debit or credit based on position or keywords
    // This is bank-specific - adjust based on your statement format
    const isCredit =
      restOfLine.toLowerCase().includes("cr") ||
      (numericAmounts.length >= 2 && amounts[1] !== "");

    // Take the first non-balance amount (usually the transaction amount)
    const amount = numericAmounts[0];

    // Parse the date
    const parsedDate = parseDate(dateStr);
    if (!parsedDate) continue;

    // Check if we have a merchant mapping for this description
    const mappingKey = findMerchantMapping(cleanDescription, existingMappings);
    const mapping = mappingKey ? existingMappings.get(mappingKey) : null;

    const transaction: ParsedTransaction = {
      id: `temp-${Date.now()}-${lineIndex++}`,
      date: parsedDate,
      description: cleanDescription,
      amount: amount,
      type: isCredit ? "credit" : "debit",
      matched: !!mapping,
      selected: true,
      merchant_name:
        mapping?.merchant_name || extractMerchantName(cleanDescription),
      category_id: mapping?.category_id || null,
      subcategory_id: mapping?.subcategory_id || null,
      account_id: mapping?.account_id || null,
    };

    transactions.push(transaction);
  }

  return transactions;
}

/**
 * Parse date string to ISO format
 */
function parseDate(dateStr: string): string | null {
  // Try different formats
  const separators = ["/", "-", "."];

  for (const sep of separators) {
    const parts = dateStr.split(sep);
    if (parts.length === 3) {
      let day: number, month: number, year: number;

      if (parts[0].length === 4) {
        // YYYY-MM-DD format
        year = parseInt(parts[0]);
        month = parseInt(parts[1]);
        day = parseInt(parts[2]);
      } else {
        // DD/MM/YYYY format (common in Lebanon)
        day = parseInt(parts[0]);
        month = parseInt(parts[1]);
        year = parseInt(parts[2]);
      }

      if (year < 100) year += 2000;

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  return null;
}

/**
 * Find a matching merchant pattern in the description
 */
function findMerchantMapping(
  description: string,
  mappings: Map<
    string,
    {
      category_id: string | null;
      subcategory_id: string | null;
      account_id: string | null;
      merchant_name: string;
    }
  >
): string | null {
  const upperDesc = description.toUpperCase();

  for (const [pattern] of mappings) {
    if (upperDesc.includes(pattern.toUpperCase())) {
      return pattern;
    }
  }

  return null;
}

/**
 * Extract a clean merchant name from transaction description
 * Bank descriptions often contain extra info like card numbers, locations, etc.
 */
function extractMerchantName(description: string): string {
  // Common patterns to remove
  const patternsToRemove = [
    /\b\d{4}\*+\d{4}\b/g, // Card numbers like 1234****5678
    /\bPOS\b/gi,
    /\bPURCHASE\b/gi,
    /\bCARD\b/gi,
    /\bDEBIT\b/gi,
    /\bCREDIT\b/gi,
    /\bATM\b/gi,
    /\bTRANSFER\b/gi,
    /\b\d{2}:\d{2}:\d{2}\b/g, // Times
    /\s+/g, // Multiple spaces
  ];

  let cleaned = description;
  for (const pattern of patternsToRemove) {
    cleaned = cleaned.replace(pattern, " ");
  }

  return cleaned.trim().substring(0, 50);
}

/**
 * Known Lebanese merchants - pre-populated suggestions
 * These help with initial recognition before the user trains their own mappings
 */
export const KNOWN_MERCHANTS: Array<{
  pattern: string;
  name: string;
  suggestedCategory: string;
}> = [
  { pattern: "TOTERS", name: "Toters", suggestedCategory: "Food & Dining" },
  { pattern: "SPINNEYS", name: "Spinneys", suggestedCategory: "Groceries" },
  { pattern: "CARREFOUR", name: "Carrefour", suggestedCategory: "Groceries" },
  { pattern: "ALFA", name: "Alfa", suggestedCategory: "Phone" },
  { pattern: "TOUCH", name: "Touch", suggestedCategory: "Phone" },
  { pattern: "MTC", name: "Touch (MTC)", suggestedCategory: "Phone" },
  {
    pattern: "EDL",
    name: "Electricité du Liban",
    suggestedCategory: "Electricity",
  },
  { pattern: "OGERO", name: "Ogero", suggestedCategory: "Internet" },
  { pattern: "UBER", name: "Uber", suggestedCategory: "Taxi" },
  { pattern: "BOLT", name: "Bolt", suggestedCategory: "Taxi" },
  { pattern: "NETFLIX", name: "Netflix", suggestedCategory: "Entertainment" },
  { pattern: "SPOTIFY", name: "Spotify", suggestedCategory: "Music" },
  { pattern: "AMAZON", name: "Amazon", suggestedCategory: "Shopping" },
  { pattern: "ZARA", name: "Zara", suggestedCategory: "Clothes" },
  { pattern: "H&M", name: "H&M", suggestedCategory: "Clothes" },
  { pattern: "STARBUCKS", name: "Starbucks", suggestedCategory: "Coffee" },
  { pattern: "DUNKIN", name: "Dunkin", suggestedCategory: "Coffee" },
  {
    pattern: "ROADSTER",
    name: "Roadster Diner",
    suggestedCategory: "Restaurants",
  },
  { pattern: "CREPAWAY", name: "Crepaway", suggestedCategory: "Restaurants" },
  { pattern: "ABC", name: "ABC Mall", suggestedCategory: "Shopping" },
  {
    pattern: "CITY CENTRE",
    name: "City Centre",
    suggestedCategory: "Shopping",
  },
  { pattern: "LIBANPOST", name: "LibanPost", suggestedCategory: "Other" },
  { pattern: "PHARMACY", name: "Pharmacy", suggestedCategory: "Pharmacy" },
  { pattern: "PHARMACIE", name: "Pharmacy", suggestedCategory: "Pharmacy" },
];

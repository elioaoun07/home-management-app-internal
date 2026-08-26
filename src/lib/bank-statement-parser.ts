// src/lib/bank-statement-parser.ts
// Specialized parser for Lebanese bank statements (Fresh USD format)
// Designed for 0% error rate on the specific bank format
// NOTE: This module is server-only (used in API routes). The node:crypto import
// must not be bundled for the client.

import { createHash } from "node:crypto";
import { matchMerchantMapping } from "@/lib/merchantMatch";
import { extractStatementMemo } from "@/lib/statement-reconcile";
import { normalizeMerchant } from "@/lib/utils/anomalyDetection";
import type {
  ParsedTransaction,
  StatementParseDiagnostics,
  StatementSemanticKind,
} from "@/types/statement";

/**
 * Transaction type patterns from the bank statement
 */
type TransactionType =
  | "pos_purchase"
  | "online_purchase"
  | "bill_payment"
  | "transfer_in"
  | "transfer_out"
  | "cash_withdrawal"
  | "reversal"
  | "opening_balance"
  | "closing_balance"
  | "unknown";

interface RawTransaction {
  date: string;
  description: string;
  moneyOut: number | null;
  moneyIn: number | null;
  balance: number;
  type: TransactionType;
  merchantName: string;
  merchantPattern: string;
}

export interface PDFTextParseResult {
  transactions: RawTransaction[];
  diagnostics: StatementParseDiagnostics;
}

/**
 * Parse a date string in DD/MM/YYYY format to ISO format
 */
function parseDate(dateStr: string): string | null {
  // Handle DD/MM/YYYY format
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  // Validate date
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse a money string (handles commas in numbers)
 * Examples: "155.89", "1,100.00", "-"
 */
function parseMoney(value: string): number | null {
  if (!value || value.trim() === "" || value.trim() === "-") {
    return null;
  }
  // Remove commas and parse
  const cleaned = value.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Determine transaction type from description
 */
function getTransactionType(description: string): TransactionType {
  const desc = description.toLowerCase();

  if (desc.includes("opening balance")) return "opening_balance";
  if (desc.includes("closing balance")) return "closing_balance";
  if (desc.startsWith("reversal")) return "reversal";
  if (desc.startsWith("pos purchase")) return "pos_purchase";
  if (desc.startsWith("online purchase")) return "online_purchase";
  if (desc.startsWith("bill payment")) return "bill_payment";
  // "Audi ATM Cash withdrawal …" / "Voucher ATM Cash Withdrawal at … for
  // Voucher No … - Car Insurance" — always MONEY OUT, never spend/income on
  // its own; the review UI decides cash-to-wallet vs a categorised payment.
  if (desc.includes("withdrawal")) return "cash_withdrawal";
  if (desc.includes("transfer from")) return "transfer_in";
  if (desc.includes("transfer to")) return "transfer_out";

  // Own-account moves ("Own Account Exchange: USD to EUR at 0.852 - from
  // 501400630004"). The leg is named by the trailing account reference, not by
  // the "USD to EUR" part — "to EUR" is the currency, "- to 5014…" is the
  // destination account. Classifying these keeps the parser's answer aligned
  // with isTransferDescription() in statement-reconcile.ts, which is what
  // actually stops them being written as spend or income.
  if (isOwnAccountDescription(description)) {
    if (/-\s*from\s+\d/i.test(description)) return "transfer_in";
    if (/-\s*to\s+\d/i.test(description)) return "transfer_out";
    return "transfer_out";
  }

  return "unknown";
}

/**
 * Mirror of the own-account rule the matcher enforces. Kept as a narrow local
 * predicate rather than importing from statement-reconcile.ts, because that
 * module is bundled for the client and this one is server-only; the shared
 * contract is the test that pins both to the same strings.
 */
function isOwnAccountDescription(description: string): boolean {
  return (
    /\btransfer\s+(from|to)\s+own\b/i.test(description) ||
    /\bown\s+account\b/i.test(description) ||
    /\baccount\s+exchange\b/i.test(description) ||
    /\binternal\s+transfer\b/i.test(description) ||
    /\bbetween\s+(my|own)\s+accounts?\b/i.test(description)
  );
}

function getSemanticKind(raw: RawTransaction): StatementSemanticKind {
  const description = raw.description;
  const lower = description.toLowerCase();

  if (/\bexchange\b/i.test(description) && isOwnAccountDescription(description)) {
    return "exchange";
  }
  if (isOwnAccountDescription(description)) return "own_transfer";
  if (/\bwithdrawals?\b/i.test(description)) {
    return /\bvoucher\b/i.test(description)
      ? "voucher_withdrawal"
      : "atm_withdrawal";
  }
  if (/\btransfer\s+(?:from|to)\b/i.test(description)) {
    return "person_transfer";
  }
  if (
    /\bmonthly charges?\b/i.test(description) ||
    /\baccount service fees?\b/i.test(description) ||
    /\bfees?\s+on\s+fund\s+transfer\b/i.test(description) ||
    /\bbank\s+(?:service\s+)?fees?\b/i.test(description)
  ) {
    return "bank_fee";
  }
  if (raw.moneyIn !== null && /\bincoming payments?\b/i.test(lower)) {
    return "salary_income";
  }
  return "other";
}

/**
 * Extract merchant name and pattern from transaction description
 */
function extractMerchant(
  description: string,
  type: TransactionType
): { name: string; pattern: string } {
  let name = description;
  let pattern = description.toUpperCase();

  switch (type) {
    case "pos_purchase":
    case "online_purchase": {
      // Format: "POS Purchase MERCHANT_NAME LOCATION LB XXXX"
      // or: "Online Purchase MERCHANT_NAME LOCATION LB XXXX"
      const prefix =
        type === "pos_purchase" ? "POS Purchase " : "Online Purchase ";
      let merchant = description.substring(prefix.length);

      // Remove location suffix (e.g., "BEIRUT LB 0000", "MTAYLEB LB 7121", "SAN FRANCISCOUS 0000")
      // Pattern: usually ends with "XX XXXX" or "XXXX" (2-letter country code + 4 digits or just 4 digits)
      merchant = merchant.replace(/\s+(LB|US|GB|FR|DE|AE)\s*\d{4}$/i, "");
      merchant = merchant.replace(/\s+\d{4}$/, "");

      // Clean up location words at the end
      const locationPatterns = [
        /\s+BEIRUT$/i,
        /\s+MTAYLEB$/i,
        /\s+HAZMIEH$/i,
        /\s+DORA$/i,
        /\s+DBAYEH$/i,
        /\s+METN$/i,
        /\s+MATEN$/i,
        /\s+SAN FRANCISCO$/i,
        /\s+CORNET CHEHWAN?$/i,
        /\s+KORNT CHEHWN$/i,
      ];

      for (const loc of locationPatterns) {
        merchant = merchant.replace(loc, "");
      }

      merchant = merchant.trim();

      // Extract the main merchant name (first significant word or known pattern)
      name = cleanMerchantName(merchant);
      pattern = extractMerchantPattern(merchant);
      break;
    }

    case "bill_payment": {
      // Format: "Bill Payment, Invoice # XXXX - for PHONE to Provider"
      const match = description.match(/to\s+([\w\s]+)$/i);
      if (match) {
        name = match[1].trim();
        pattern = name.toUpperCase().replace(/\s+PREPAID$/i, "");
      }
      break;
    }

    case "transfer_in": {
      // Format: "Transfer from Own Account XXXXXX - description"
      const match = description.match(/-\s*(.+)$/);
      if (match) {
        name = "Transfer: " + match[1].trim();
        pattern = "TRANSFER_IN";
      } else {
        name = "Transfer In";
        pattern = "TRANSFER_IN";
      }
      break;
    }

    case "transfer_out": {
      // Format: "Transfer to NAME via Mobile - description"
      const match = description.match(/Transfer to\s+(.+?)\s+via/i);
      if (match) {
        name = "Transfer to " + match[1].trim();
        pattern = "TRANSFER_OUT";
      } else {
        name = "Transfer Out";
        pattern = "TRANSFER_OUT";
      }
      break;
    }

    case "cash_withdrawal": {
      // "Audi ATM Cash withdrawal 05606305 BANK AUDI HOLCOM-5 BEIRUT LB 7121"
      // "Voucher ATM Cash Withdrawal at BANK AUDI MANSOURIEH-6 … for Voucher
      //  No 6755430378 - Car Insurance" — the memo after the first " - " is
      //  what the owner actually spent the voucher on; a plain ATM line has
      //  none, so it falls back to a generic label.
      const memo = extractStatementMemo(description);
      name = memo || "ATM Cash Withdrawal";
      pattern = /\bvoucher\b/i.test(description)
        ? "VOUCHER_WITHDRAWAL"
        : "ATM_WITHDRAWAL";
      break;
    }

    default:
      // Keep original
      break;
  }

  return { name, pattern };
}

/**
 * Clean merchant name to be more readable (just title case)
 */
function cleanMerchantName(raw: string): string {
  // Simply title case the raw name - no hardcoded mappings
  // User-defined mappings are stored in the database and applied during import
  return raw
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Extract a searchable pattern from merchant name
 * Returns the first word as the primary pattern
 */
function extractMerchantPattern(raw: string): string {
  const upper = raw.toUpperCase();
  // Return first word as pattern - simple and predictable
  const firstWord = upper.split(/\s+/)[0];
  return firstWord || upper;
}

/**
 * Parse CSV content from bank statement
 */
export function parseCSV(csvContent: string): RawTransaction[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());
  const transactions: RawTransaction[] = [];

  // Skip header row
  const dataLines = lines.slice(1);

  for (const line of dataLines) {
    // Parse CSV line (handle quoted fields with commas)
    const fields = parseCSVLine(line);

    if (fields.length < 5) continue;

    const [dateStr, description, moneyOutStr, moneyInStr, balanceStr] = fields;

    const date = parseDate(dateStr.trim());
    if (!date) continue;

    const type = getTransactionType(description);

    // Skip opening/closing balance entries
    if (type === "opening_balance" || type === "closing_balance") continue;

    const moneyOut = parseMoney(moneyOutStr);
    const moneyIn = parseMoney(moneyInStr);
    const balance = parseMoney(balanceStr) || 0;

    // Skip if no actual money movement
    if (moneyOut === null && moneyIn === null) continue;

    const { name, pattern } = extractMerchant(description, type);

    transactions.push({
      date,
      description: description.trim(),
      moneyOut,
      moneyIn,
      balance,
      type,
      merchantName: name,
      merchantPattern: pattern,
    });
  }

  return transactions;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

// ── Money tokens ─────────────────────────────────────────────────────────────
//
// A statement amount has EXACTLY two decimals. The `(?!\d)` is the whole point
// and it is not optional: without it, `[\d,]+\.\d{2}` happily matches the first
// two decimals of a THREE-decimal number, and statements carry those — an FX
// rate. "Own Account Exchange: USD to EUR at 0.852 - to 501400630005 - 200.00 -
// 1,909.46" was split at `0.85`, so the rate became the row's amount, the
// description was truncated to "…USD to EUR at", and 137 exchange rows imported
// as $0.85 each. Any new amount pattern in this file must carry the guard.
//
// No `g` flag on the two used with `.test()` / `.search()` — a global regex
// carries `lastIndex` between calls and would skip every other line.
const MONEY_ANYWHERE = /[\d,]+\.\d{2}(?!\d)/;
/** MONEY_OUT MONEY_IN BALANCE at the end of a row, "-" for an empty column. */
const TRAILING_AMOUNTS =
  /([\d,]+\.\d{2}(?!\d)|-)\s+([\d,]+\.\d{2}(?!\d)|-)\s+([\d,]+\.\d{2}(?!\d))$/;
/** Every column value in the numbers tail, in order. */
const MONEY_OR_DASH = /([\d,]+\.\d{2}(?!\d)|-)/g;

/**
 * Parse PDF text content - extract transactions using pattern matching
 * This is optimized for the specific Lebanese bank statement format
 */
export function parsePDFTextWithDiagnostics(text: string): PDFTextParseResult {
  const transactions: RawTransaction[] = [];
  const diagnostics: StatementParseDiagnostics = {
    candidate_count: 0,
    parsed_count: 0,
    ignored_balance_count: 0,
    rejected_count: 0,
    rejected: [],
  };
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // The PDF format has DATE, TRANSACTIONS, MONEY OUT, MONEY IN, BALANCE columns
  // We need to identify transaction lines by date pattern

  const datePattern = /^(\d{1,2}\/\d{1,2}\/\d{4})/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const dateMatch = line.match(datePattern);

    if (dateMatch) {
      const dateStr = dateMatch[1];
      const date = parseDate(dateStr);

      if (date) {
        // Get the rest of the line after the date
        const content = line.substring(dateMatch[0].length).trim();

        // Sometimes the description spans multiple lines
        // Collect until we find the numbers
        let fullDescription = "";
        let numbersLine = "";

        // Check if this line contains the amounts (look for decimal numbers)
        const hasAmounts = MONEY_ANYWHERE.test(content);

        if (hasAmounts) {
          // Split description and amounts
          // The amounts are usually at the end: MONEY_OUT MONEY_IN BALANCE or - MONEY_IN BALANCE
          const match = content.match(TRAILING_AMOUNTS);

          if (match) {
            fullDescription = content
              .substring(0, content.length - match[0].length)
              .trim();
            numbersLine = match[0];
          } else {
            // Try simpler pattern - just find where numbers start
            const numStart = content.search(MONEY_ANYWHERE);
            if (numStart > 0) {
              fullDescription = content.substring(0, numStart).trim();
              numbersLine = content.substring(numStart).trim();
            } else {
              fullDescription = content;
            }
          }
        } else {
          // Description continues on next line(s)
          fullDescription = content;
          i++;

          while (i < lines.length && !datePattern.test(lines[i])) {
            const nextLine = lines[i].trim();

            // Check if this line has the amounts
            if (MONEY_ANYWHERE.test(nextLine)) {
              // This might be continuation + amounts or just amounts
              const match = nextLine.match(TRAILING_AMOUNTS);

              if (match) {
                const prefix = nextLine
                  .substring(0, nextLine.length - match[0].length)
                  .trim();
                if (prefix) {
                  fullDescription += " " + prefix;
                }
                numbersLine = match[0];
                break;
              } else {
                numbersLine = nextLine;
                break;
              }
            } else {
              // More description text
              fullDescription += " " + nextLine;
            }
            i++;
          }
        }

        // Parse the amounts
        const amounts = numbersLine.match(MONEY_OR_DASH) || [];
        let moneyOut: number | null = null;
        let moneyIn: number | null = null;
        let balance = 0;

        if (amounts.length >= 3) {
          moneyOut = parseMoney(amounts[0] || "-");
          moneyIn = parseMoney(amounts[1] || "-");
          balance = parseMoney(amounts[2] || "0") || 0;
        } else if (amounts.length === 2) {
          // Could be: [amount, balance] or [-, balance]
          const first = parseMoney(amounts[0] || "-");
          balance = parseMoney(amounts[1] || "0") || 0;
          if (first !== null) {
            // Determine if it's money in or out based on context
            if (
              fullDescription.toLowerCase().includes("transfer from") ||
              fullDescription.toLowerCase().includes("reversal") ||
              // An own-account leg names its direction with "- from 5014…";
              // without this it fell through to the moneyOut default and the
              // incoming leg was read as a payment.
              (isOwnAccountDescription(fullDescription) &&
                /-\s*from\s+\d/i.test(fullDescription))
            ) {
              moneyIn = first;
            } else {
              moneyOut = first;
            }
          }
        } else if (amounts.length === 1) {
          balance = parseMoney(amounts[0] || "0") || 0;
        }

        const type = getTransactionType(fullDescription);

        // Skip opening/closing balance
        if (type === "opening_balance" || type === "closing_balance") {
          diagnostics.ignored_balance_count++;
          i++;
          continue;
        }

        diagnostics.candidate_count++;

        // Skip if no money movement
        if (moneyOut === null && moneyIn === null) {
          diagnostics.rejected.push({
            date,
            block: [dateStr, fullDescription, numbersLine]
              .filter(Boolean)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim(),
            reason: "amounts_unreadable",
          });
          i++;
          continue;
        }

        const { name, pattern } = extractMerchant(fullDescription, type);

        transactions.push({
          date,
          description: fullDescription,
          moneyOut,
          moneyIn,
          balance,
          type,
          merchantName: name,
          merchantPattern: pattern,
        });
        diagnostics.parsed_count++;
      }
    }

    i++;
  }

  diagnostics.rejected_count = diagnostics.rejected.length;
  return { transactions, diagnostics };
}

export function parsePDFText(text: string): RawTransaction[] {
  return parsePDFTextWithDiagnostics(text).transactions;
}

/**
 * Convert raw transactions to ParsedTransaction format for the UI
 */
export function convertToUITransactions(
  rawTransactions: RawTransaction[],
  merchantMappings: Map<
    string,
    {
      category_id: string | null;
      subcategory_id: string | null;
      account_id: string | null;
      merchant_name: string;
    }
  >,
  accountId: string,
): ParsedTransaction[] {
  // Mappings as a list so the SHARED matcher can be used (exact wins, then
  // first substring hit) instead of a second, divergent implementation.
  const mappingList = [...merchantMappings.entries()].map(
    ([merchant_pattern, value]) => ({ merchant_pattern, ...value }),
  );

  // Count identical rows within this file so hash v2 can disambiguate them.
  const occurrenceCount = new Map<string, number>();

  return rawTransactions.map((raw, index) => {
    // The normalized merchant key groups rows in the review UI and is what gets
    // learned as a merchant mapping — "LE GRAY" and "LE MALL" stay distinct.
    const normalizedKey = normalizeMerchant(raw.description);
    const mapping = matchMerchantMapping(raw.merchantPattern, mappingList);

    // Determine if debit or credit
    const isCredit = raw.moneyIn !== null && raw.moneyIn > 0;
    const amount = isCredit ? raw.moneyIn! : raw.moneyOut || 0;

    // Handle reversals - they're credits but represent a refund
    const isReversal = raw.type === "reversal";

    const occurrenceKey = [
      raw.date,
      raw.description.trim().toLowerCase(),
      raw.moneyOut ?? "",
      raw.moneyIn ?? "",
    ].join("|");
    const occurrence = (occurrenceCount.get(occurrenceKey) ?? 0) + 1;
    occurrenceCount.set(occurrenceKey, occurrence);

    return {
      id: `txn-${Date.now()}-${index}`,
      date: raw.date,
      description: raw.description,
      amount: amount,
      type: isCredit ? "credit" : "debit",
      semantic_kind: getSemanticKind(raw),
      merchant_name: mapping?.merchant_name || raw.merchantName,
      normalized_key: normalizedKey,
      category_id: mapping?.category_id || null,
      subcategory_id: mapping?.subcategory_id || null,
      mapping_account_id: mapping?.account_id || null,
      // The statement belongs to ONE account, and that account is already
      // baked into the hash below. A merchant mapping must never redirect the
      // row somewhere else, or the fingerprint would describe a different
      // account than the transaction it guards.
      account_id: accountId,
      // `matched` means "a learned mapping supplied a category" — nothing else.
      matched: !!mapping?.category_id,
      selected: !isReversal, // Don't auto-select reversals
      statement_hash: generateStatementHash(
        accountId,
        raw.date,
        raw.description,
        raw.moneyOut,
        raw.moneyIn,
        occurrence,
      ),
    };
  });
}

/**
 * Generate a SHA-256 fingerprint of a statement row, used to make re-uploading
 * the same e-statement a no-op.
 *
 * v2 (2026-08-18) hashes "v2|account|date|description|moneyOut|moneyIn":
 *  - `balance` was DROPPED. It made the hash unstable: a bank re-issuing a
 *    statement with a recomputed running balance produced different hashes for
 *    the same purchases, so everything imported twice.
 *  - `account_id` was ADDED. The same CSV imported into two accounts is two
 *    distinct money events, not a duplicate.
 *  - `date` is KEPT so a monthly subscription of identical amount stays
 *    distinct month to month.
 *  - `occurrence` disambiguates two identical rows in ONE file (same day, same
 *    merchant, same amount) deterministically, so re-uploads still collide.
 *
 * Rows imported under the v1 formula keep their old hash; the reconciler's
 * probable-duplicate tier (amount + date window against hash-bearing rows)
 * catches those, so no backfill is needed.
 */
function generateStatementHash(
  accountId: string,
  date: string,
  description: string,
  moneyOut: number | null,
  moneyIn: number | null,
  occurrence: number,
): string {
  const raw = [
    "v2",
    accountId,
    date,
    description.trim().toLowerCase(),
    moneyOut !== null ? moneyOut.toFixed(2) : "",
    moneyIn !== null ? moneyIn.toFixed(2) : "",
  ].join("|");
  const preimage = occurrence > 1 ? `${raw}#${occurrence}` : raw;
  return createHash("sha256").update(preimage).digest("hex");
}

/**
 * Detect if content is CSV or needs PDF parsing
 */
export function detectFormat(content: string): "csv" | "pdf_text" {
  // CSV typically starts with header row containing column names
  const firstLine = content.split(/\r?\n/)[0]?.toLowerCase() || "";

  if (
    firstLine.includes("date") &&
    (firstLine.includes("transaction") || firstLine.includes("description")) &&
    (firstLine.includes("money") ||
      firstLine.includes("amount") ||
      firstLine.includes("balance"))
  ) {
    return "csv";
  }

  return "pdf_text";
}

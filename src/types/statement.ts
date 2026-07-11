// src/types/statement.ts
// Types for bank statement import feature

export interface MerchantMapping {
  id: string;
  user_id: string;
  merchant_pattern: string;
  merchant_name: string;
  category_id: string | null;
  subcategory_id: string | null;
  account_id: string | null;
  use_count: number;
  created_at: string;
  updated_at: string;
  // Enrichment added by GET /api/merchant-mappings: the mapped category /
  // subcategory identity, so clients can resolve a mapping against a DIFFERENT
  // user's or account's category list by slug/name when the raw ids don't
  // exist there (cross-user / cross-account matching).
  category_slug?: string | null;
  category_name?: string | null;
  subcategory_slug?: string | null;
  subcategory_name?: string | null;
}

// A split portion of a transaction
export interface TransactionSplit {
  id: string; // unique ID for the split
  amount: number;
  description?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
}

export interface ParsedTransaction {
  id: string; // temporary ID for UI
  date: string; // ISO date string
  description: string; // raw description from statement
  amount: number;
  type: "debit" | "credit";
  // These are populated from merchant mappings or left null for user to fill
  merchant_name?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  account_id?: string | null;
  // Status for UI
  matched: boolean; // true if found in merchant_mappings
  selected: boolean; // true if user wants to import this transaction
  // Split transaction support
  splits?: TransactionSplit[]; // if set, import as multiple transactions
  // SHA-256 fingerprint of the original statement row (date|description|moneyOut|moneyIn|balance).
  // Used to prevent duplicate imports when the same e-statement is uploaded twice.
  // Split sub-transactions use `${originalHash}:split:${index}` so each saved
  // row is unique while still sharing the original statement-line fingerprint.
  statement_hash?: string;
}

export interface StatementImport {
  id: string;
  user_id: string;
  file_name: string;
  imported_at: string;
  transactions_count: number;
  status: "pending" | "processing" | "completed" | "failed";
}

// Request/response types for API
export interface ParseStatementResponse {
  transactions: ParsedTransaction[];
  unmatchedCount: number;
  matchedCount: number;
}

export interface ImportTransactionsRequest {
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
    category_id: string | null;
    subcategory_id: string | null;
    account_id: string;
    // If provided, save as new merchant mapping
    save_merchant_mapping?: boolean;
    merchant_pattern?: string;
    merchant_name?: string;
    // Deduplication fingerprint of the original statement line.
    statement_hash?: string;
  }>;
  file_name: string;
}

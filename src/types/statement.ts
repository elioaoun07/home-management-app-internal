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
  }>;
  file_name: string;
}

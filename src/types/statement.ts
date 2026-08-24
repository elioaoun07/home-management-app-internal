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
  // normalizeMerchant(description) — stable merchant key used to group rows in
  // the review UI and as the pattern learned into merchant_mappings.
  normalized_key?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  // The account this statement belongs to. Always the account chosen before
  // upload — never a merchant mapping's account — because it is baked into
  // statement_hash below and must describe the same account the transaction
  // is written to.
  account_id?: string | null;
  // Status for UI
  matched: boolean; // true if found in merchant_mappings
  selected: boolean; // true if user wants to import this transaction
  // Split transaction support
  splits?: TransactionSplit[]; // if set, import as multiple transactions
  // SHA-256 fingerprint of the original statement row, hash v2:
  // "v2|account|date|description|moneyOut|moneyIn" (+ "#n" for identical rows
  // in one file). The ACCOUNT is part of the key, so the same CSV imported
  // into two accounts is two distinct money events, not a duplicate.
  // Used to prevent duplicate imports when the same e-statement is uploaded twice.
  // Split sub-transactions use `${originalHash}:split:${index}` so each saved
  // row is unique while still sharing the original statement-line fingerprint.
  statement_hash?: string;
}

// ── Reconciliation (POST /api/statement-import/reconcile) ──────────────────
// The classification of one statement row against already-logged transactions.
// Shapes live in src/lib/statement-reconcile.ts; re-exported here so client
// code gets them without importing the server-side matcher module.
export type {
  MatchCandidate,
  ReconcileSummary,
  RowClassification,
} from "@/lib/statement-reconcile";

export interface ReconcileResponse {
  account_currency: string;
  candidates_considered: number;
  /** Rows examined in the user's OTHER accounts (source of `other_account`). */
  cross_account_considered: number;
  /** account_id → name, for the accounts an `other_account` flag points at. */
  account_names: Record<string, string>;
  window: { from: string; to: string };
  results: Array<
    { row_id: string } & import("@/lib/statement-reconcile").RowClassification
  >;
  summary: import("@/lib/statement-reconcile").ReconcileSummary;
}

export type StatementImportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "reverted"
  | "partially_reverted";

export interface StatementImport {
  id: string;
  user_id: string;
  file_name: string;
  imported_at: string;
  transactions_count: number;
  status: StatementImportStatus;
  account_id: string | null;
  statement_id: string | null;
  created_count: number;
  stamped_count: number;
  drafts_confirmed_count: number;
  skipped_count: number;
  error_count: number;
  /** { account_id: signed delta } applied at commit — informational only; the
   *  revert recomputes from live rows rather than trusting these. */
  balance_deltas: Record<string, number>;
  learned_mappings: LearnedMappingRecord[];
  reverted_at: string | null;
  /** Joined by GET /api/statement-import/imports for display. */
  account_name?: string | null;
  account_currency?: string | null;
}

/** What the import taught the merchant map, and what stood there before. */
export interface LearnedMappingRecord {
  pattern: string;
  applied: {
    merchant_name: string;
    category_id: string | null;
    subcategory_id: string | null;
    account_id: string | null;
  };
  previous: {
    merchant_name: string;
    category_id: string | null;
    subcategory_id: string | null;
    account_id: string | null;
  } | null;
}

export type ImportEntryAction =
  | "create"
  | "stamp"
  | "confirm_draft"
  | "rekey";

/** Why a revert did not undo an entry. */
export type RevertNote =
  | "reverted"
  | "gone"
  | "drifted"
  | "already_undone";

/** One transaction the commit touched, with enough state to walk it back. */
export interface StatementImportEntry {
  id: string;
  import_id: string;
  row_id: string;
  action: ImportEntryAction;
  transaction_id: string | null;
  account_id: string;
  statement_hash: string;
  applied_delta: number;
  previous: Record<string, unknown>;
  applied: Record<string, unknown>;
  reverted_at: string | null;
  revert_note: RevertNote | null;
  created_at: string;
  /** Joined by the detail endpoint so the UI can show what the row is now. */
  current?: {
    description: string;
    date: string;
    amount: number;
    is_draft: boolean;
    deleted_at: string | null;
    statement_hash: string | null;
    /** True when the live row no longer matches what the import wrote. */
    drifted: boolean;
  } | null;
}

export interface StatementImportDetail extends StatementImport {
  entries: StatementImportEntry[];
}

export interface RevertImportResult {
  success: true;
  status: StatementImportStatus;
  /** Transactions the import had created, now soft-deleted (Recycle Bin). */
  deleted: number;
  /** Stamps undone — statement_hash cleared, accepted amounts rolled back. */
  unstamped: number;
  /** Confirmed drafts put back to draft with their original values. */
  redrafted: number;
  /** Fingerprint upgrades walked back to the hash the row carried before. */
  rekeyed: number;
  /** Entries that could not be undone, by reason. */
  skipped: { gone: number; drifted: number; already_undone: number };
  /** Rows edited after the import that were removed anyway (creates only). */
  removed_after_edit: number;
  mappings_restored: number;
  mappings_deleted: number;
  balance_deltas: Record<string, number>;
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

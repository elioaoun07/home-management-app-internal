// src/features/statement-import/hooks.ts
// React Query hooks for statement import feature

import { safeFetch } from "@/lib/safeFetch";
import { invalidateAccountData } from "@/lib/queryInvalidation";
import { qk } from "@/lib/queryKeys";
import type {
  ReconcileResponse,
  RevertImportResult,
  StatementImport,
  StatementImportDetail,
} from "@/types/statement";
import { ParsedTransaction } from "@/types/statement";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Query keys
export const statementKeys = {
  all: ["statement-import"] as const,
  // Shared with Transactions' manual-entry auto-suggest — see src/hooks/useMerchantMappings.ts
  merchantMappings: qk.merchantMappings,
  imports: () => [...statementKeys.all, "imports"] as const,
  import: (id: string) => [...statementKeys.all, "imports", id] as const,
};

// Fetch all merchant mappings — re-exported from the shared hook so existing
// statement-import imports keep working unchanged.
export { useMerchantMappings } from "@/hooks/useMerchantMappings";

// Save a merchant mapping
export function useSaveMerchantMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mapping: {
      merchant_pattern: string;
      merchant_name: string;
      category_id?: string | null;
      subcategory_id?: string | null;
      account_id?: string | null;
    }) => {
      const res = await safeFetch("/api/merchant-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapping),
      });
      if (!res.ok) throw new Error("Failed to save merchant mapping");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: statementKeys.merchantMappings(),
      });
    },
  });
}

// Delete a merchant mapping
export function useDeleteMerchantMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await safeFetch(`/api/merchant-mappings?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete merchant mapping");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: statementKeys.merchantMappings(),
      });
    },
  });
}

export interface ParseStatementResult {
  transactions: ParsedTransaction[];
  matchedCount: number;
  unmatchedCount: number;
  totalCount: number;
  statement_id: string;
  account_id: string;
  account_currency: string;
  statement_currency: string | null;
  currency_mismatch: boolean;
  rawTextPreview?: string;
}

// Parse a PDF statement. The target account is chosen first: it feeds the row
// fingerprint (hash v2) and the currency check.
export function useParseStatement() {
  return useMutation({
    mutationFn: async ({
      file,
      accountId,
    }: {
      file: File;
      accountId: string;
    }): Promise<ParseStatementResult> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("account_id", accountId);

      const res = await safeFetch("/api/statement-import/parse", {
        method: "POST",
        body: formData,
        timeoutMs: 120_000, // PDF parsing can be slow — 2 min timeout
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to parse statement");
      }

      return res.json();
    },
  });
}

// Match parsed rows against already-logged transactions.
export function useReconcileStatement() {
  return useMutation({
    mutationFn: async (data: {
      account_id: string;
      statement_id: string;
      rows: Array<{
        id: string;
        date: string;
        description: string;
        amount: number;
        type: "debit" | "credit";
        statement_hash: string;
      }>;
    }): Promise<ReconcileResponse> => {
      const res = await safeFetch("/api/statement-import/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        timeoutMs: 30_000, // Candidate scan over a multi-week window
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reconcile statement");
      }

      return res.json();
    },
  });
}

export type CommitAction =
  | {
      kind: "create";
      row_id: string;
      date: string;
      description: string;
      /** Raw statement line as the bank wrote it — the stable reporting axis. */
      bank_description?: string | null;
      amount: number;
      direction: "debit" | "credit";
      account_id: string;
      category_id: string | null;
      subcategory_id: string | null;
      statement_hash: string;
      learn_mapping?: { pattern: string; name: string };
    }
  | {
      kind: "stamp";
      row_id: string;
      transaction_id: string;
      statement_hash: string;
      bank_description?: string | null;
      accept_amount?: number;
    }
  | {
      kind: "confirm_draft";
      row_id: string;
      transaction_id: string;
      statement_hash: string;
      amount?: number;
      category_id?: string | null;
      subcategory_id?: string | null;
    }
  /**
   * Replace an OUTDATED fingerprint with the current formula's, on a row the
   * fuzzy tier recognised. Balance-neutral — it touches nothing but
   * `statement_hash`.
   *
   * This is how a fingerprint-formula change repairs itself: the v1 -> v2
   * change orphaned 152 rows because no backfill shipped with it, and they
   * survived only on the fuzzy tier, which is the weaker guarantee. Re-importing
   * a statement now upgrades every row it recognises.
   */
  | {
      kind: "rekey";
      row_id: string;
      transaction_id: string;
      statement_hash: string;
      /** Guard: only re-key while the row still carries this exact hash. */
      previous_hash: string;
      bank_description?: string | null;
    }
  /** Record a standing decision not to import this bank row, by fingerprint. */
  | {
      kind: "skip";
      row_id: string;
      statement_hash: string;
      description?: string | null;
      amount?: number;
      date?: string;
    }
  /** Withdraw a previously recorded skip. */
  | {
      kind: "unskip";
      row_id: string;
      statement_hash: string;
    }
  /**
   * Household money movement -> a `transfers` record, never a transaction.
   * No category: it nets to zero across the household.
   */
  | {
      kind: "create_transfer";
      row_id: string;
      statement_hash: string;
      date: string;
      amount: number;
      description: string;
      /** The owner's account the money left. */
      from_account_id: string;
      /** The partner's account it arrived in. */
      to_account_id: string;
    };

export interface CommitResult {
  success: true;
  /** The statement_imports record this commit opened — revert targets it. */
  import_id: string;
  created: number;
  stamped: number;
  drafts_confirmed: number;
  /** Outdated fingerprints upgraded to the current formula (balance-neutral). */
  rekeyed: number;
  /** Household transfers recorded (money moved, both accounts). */
  transfers_created: number;
  /** Standing skip decisions recorded / withdrawn. */
  skips_recorded: number;
  skips_removed: number;
  skipped: number;
  errors: number;
  mappings_saved: number;
  balance_deltas: Record<string, number>;
  results: Array<{
    row_id: string;
    status: "ok" | "skipped_duplicate" | "error";
    error?: string;
    transaction_id?: string;
  }>;
}

// Write the reviewed session: create missing rows, stamp matched ones,
// confirm matched drafts.
export function useCommitStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      statement_id: string;
      file_name: string;
      account_id: string;
      actions: CommitAction[];
    }): Promise<CommitResult> => {
      const res = await safeFetch("/api/statement-import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        timeoutMs: 60_000, // Bulk write — 1 min timeout
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to commit statement");
      }

      return res.json();
    },
    onSuccess: (_result, variables) => {
      invalidateAccountData(queryClient, variables.account_id);
      queryClient.invalidateQueries({ queryKey: qk.drafts() });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({
        queryKey: statementKeys.merchantMappings(),
      });
      queryClient.invalidateQueries({ queryKey: statementKeys.imports() });
    },
  });
}

// ── Import history & rollback ───────────────────────────────────────────────
//
// Every commit leaves a `statement_imports` record plus one ledger row per
// transaction it touched, so a bulk import is reversible as a unit instead of
// unpicked row by row. See src/lib/statement-revert.ts for the rules.

/** The user's statement imports, newest first. */
export function useStatementImports(limit = 20) {
  return useQuery<{ imports: StatementImport[] }>({
    queryKey: [...statementKeys.imports(), limit],
    queryFn: async () => {
      const res = await safeFetch(
        `/api/statement-import/imports?limit=${limit}`,
        { timeoutMs: 15_000 },
      );
      if (!res.ok) throw new Error("Failed to load import history");
      return res.json();
    },
    staleTime: 60_000,
  });
}

/** One import with its per-row ledger and the CURRENT state of each row. */
export function useStatementImportDetail(id: string | null) {
  return useQuery<StatementImportDetail & { revertable: boolean }>({
    queryKey: statementKeys.import(id ?? "none"),
    enabled: !!id,
    queryFn: async () => {
      const res = await safeFetch(`/api/statement-import/imports/${id}`, {
        timeoutMs: 20_000,
      });
      if (!res.ok) throw new Error("Failed to load this import");
      return res.json();
    },
    // Drift ("was this edited since?") is only meaningful when it's current.
    staleTime: 0,
  });
}

/** Walk a whole import backwards: rows, balances and merchant mappings. */
export function useRevertStatementImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      revert_mappings = true,
    }: {
      id: string;
      revert_mappings?: boolean;
      /** Only used for cache invalidation on success. */
      account_id?: string | null;
    }): Promise<RevertImportResult> => {
      const res = await safeFetch(
        `/api/statement-import/imports/${id}/revert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revert_mappings }),
          // Bulk reversal over up to 1,000 rows — same budget as the commit.
          timeoutMs: 60_000,
        },
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to revert this import");
      }
      return res.json();
    },
    onSuccess: (_result, variables) => {
      if (variables.account_id) {
        invalidateAccountData(queryClient, variables.account_id);
      }
      queryClient.invalidateQueries({ queryKey: qk.drafts() });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: statementKeys.imports() });
      queryClient.invalidateQueries({
        queryKey: statementKeys.import(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: statementKeys.merchantMappings(),
      });
      // The reverted rows land in the Recycle Bin.
      queryClient.invalidateQueries({ queryKey: ["recycle-bin"] });
    },
  });
}

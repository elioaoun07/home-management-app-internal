// src/features/statement-import/hooks.ts
// React Query hooks for statement import feature

import { safeFetch } from "@/lib/safeFetch";
import { invalidateAccountData } from "@/lib/queryInvalidation";
import { qk } from "@/lib/queryKeys";
import { ParsedTransaction } from "@/types/statement";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Query keys
export const statementKeys = {
  all: ["statement-import"] as const,
  // Shared with Transactions' manual-entry auto-suggest — see src/hooks/useMerchantMappings.ts
  merchantMappings: qk.merchantMappings,
  imports: () => [...statementKeys.all, "imports"] as const,
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

// Parse a PDF statement
export function useParseStatement() {
  return useMutation({
    mutationFn: async (
      file: File,
    ): Promise<{
      transactions: ParsedTransaction[];
      matchedCount: number;
      unmatchedCount: number;
      totalCount: number;
      rawTextPreview?: string;
    }> => {
      const formData = new FormData();
      formData.append("file", file);

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

// Import transactions
export function useImportTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
        category_id: string | null;
        subcategory_id: string | null;
        account_id: string;
        save_merchant_mapping?: boolean;
        merchant_pattern?: string;
        merchant_name?: string;
        matched?: boolean;
        statement_hash?: string;
      }>;
      file_name: string;
    }) => {
      const res = await safeFetch("/api/statement-import/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        timeoutMs: 60_000, // Bulk import can be slow — 1 min timeout
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to import transactions");
      }

      return res.json();
    },
    onSuccess: () => {
      invalidateAccountData(queryClient);
      queryClient.invalidateQueries({ queryKey: qk.drafts() });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({
        queryKey: statementKeys.merchantMappings(),
      });
    },
  });
}

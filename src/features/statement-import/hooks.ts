// src/features/statement-import/hooks.ts
// React Query hooks for statement import feature

import { MerchantMapping, ParsedTransaction } from "@/types/statement";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Query keys
export const statementKeys = {
  all: ["statement-import"] as const,
  merchantMappings: () => [...statementKeys.all, "merchant-mappings"] as const,
  imports: () => [...statementKeys.all, "imports"] as const,
};

// Fetch all merchant mappings
export function useMerchantMappings() {
  return useQuery({
    queryKey: statementKeys.merchantMappings(),
    queryFn: async (): Promise<MerchantMapping[]> => {
      const res = await fetch("/api/merchant-mappings");
      if (!res.ok) throw new Error("Failed to fetch merchant mappings");
      return res.json();
    },
  });
}

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
      const res = await fetch("/api/merchant-mappings", {
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
      const res = await fetch(`/api/merchant-mappings?id=${id}`, {
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
      file: File
    ): Promise<{
      transactions: ParsedTransaction[];
      matchedCount: number;
      unmatchedCount: number;
      totalCount: number;
      rawTextPreview?: string;
    }> => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/statement-import/parse", {
        method: "POST",
        body: formData,
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
      }>;
      file_name: string;
    }) => {
      const res = await fetch("/api/statement-import/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to import transactions");
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate transactions queries to refresh the dashboard
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({
        queryKey: statementKeys.merchantMappings(),
      });
    },
  });
}

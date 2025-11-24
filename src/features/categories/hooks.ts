// src/features/categories/hooks.ts
"use client";

import { qk } from "@/lib/queryKeys";
import type { Category } from "@/types/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Single source of truth for the categories query
export { useCategories } from "./useCategoriesQuery";

// Category management hooks (CRUD operations with reordering)
export {
  useBulkUpdateCategories,
  useCategoryManagement,
  useCreateCategory as useCreateCategoryManagement,
  useDeleteCategory as useDeleteCategoryManagement,
  useReorderCategories,
  useUpdateCategory as useUpdateCategoryManagement,
} from "./useCategoryManagement";

/**
 * Create category (root or sub).
 * Pass the accountId you're working in; parent_id is optional (null = root).
 */
export function useCreateCategory(accountId?: string) {
  const qc = useQueryClient();

  return useMutation<
    Category, // TData
    Error, // TError
    {
      name: string;
      parent_id?: string | null;
      icon?: string | null;
      color?: string | null;
      position?: number;
    }, // TVariables
    { prev?: Category[]; tempId?: string } // TContext  <-- so ctx.prev is typed
  >({
    mutationFn: async (input) => {
      if (!accountId) throw new Error("accountId is required");
      const res = await fetch("/api/user-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, account_id: accountId }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to create category");
      }
      return (await res.json()) as Category;
    },
    onMutate: async (input) => {
      if (!accountId) return { prev: undefined, tempId: undefined };
      await qc.cancelQueries({ queryKey: qk.categories(accountId) });
      const prev = qc.getQueryData<Category[]>(qk.categories(accountId));

      const tempId = `temp-${Date.now()}`;
      const optimistic: Category = {
        id: tempId,
        user_id: "",
        name: input.name.trim(),
        icon: input.icon ?? null,
        color: input.color ?? null,
        parent_id: input.parent_id ?? null,
        position: input.position ?? null,
        visible: true,
      };

      qc.setQueryData<Category[]>(qk.categories(accountId), (old = []) => [
        optimistic,
        ...old,
      ]);

      return { prev, tempId };
    },
    onError: (_err, _vars, ctx) => {
      if (!accountId) return;
      if (ctx?.prev) qc.setQueryData(qk.categories(accountId), ctx.prev);
    },
    onSuccess: (created, _vars, ctx) => {
      if (!accountId) return;
      qc.setQueryData<Category[]>(qk.categories(accountId), (old = []) => [
        created,
        ...old.filter((c) => c.id !== ctx?.tempId),
      ]);
    },
    onSettled: () => {
      if (!accountId) return;
      qc.invalidateQueries({
        queryKey: qk.categories(accountId),
        refetchType: "active",
      });
    },
  });
}

/** Rename (works for root or sub). */
export function useRenameCategory(accountId?: string) {
  const qc = useQueryClient();

  return useMutation<
    Category, // TData
    Error, // TError
    { id: string; name: string }, // TVariables
    { prev?: Category[] } // TContext
  >({
    mutationFn: async ({ id, name }) => {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as Category;
    },
    onMutate: async ({ id, name }) => {
      if (!accountId) return { prev: undefined };
      await qc.cancelQueries({ queryKey: qk.categories(accountId) });
      const prev = qc.getQueryData<Category[]>(qk.categories(accountId));
      qc.setQueryData<Category[]>(qk.categories(accountId), (old = []) =>
        old.map((c) => (c.id === id ? { ...c, name: name.trim() } : c))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (!accountId) return;
      if (ctx?.prev) qc.setQueryData(qk.categories(accountId), ctx.prev);
    },
    onSettled: () => {
      if (!accountId) return;
      qc.invalidateQueries({
        queryKey: qk.categories(accountId),
        refetchType: "active",
      });
    },
  });
}

/** Delete (soft-delete via API; subs are also hidden on server). */
export function useDeleteCategory(accountId?: string) {
  const qc = useQueryClient();

  return useMutation<
    string, // TData (returns deleted id)
    Error, // TError
    string, // TVariables (id)
    { prev?: Category[] } // TContext
  >({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      return id;
    },
    onMutate: async (id) => {
      if (!accountId) return { prev: undefined };
      await qc.cancelQueries({ queryKey: qk.categories(accountId) });
      const prev = qc.getQueryData<Category[]>(qk.categories(accountId));
      // remove the category and its direct subs locally
      qc.setQueryData<Category[]>(qk.categories(accountId), (old = []) =>
        old.filter((c) => c.id !== id && c.parent_id !== id)
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (!accountId) return;
      if (ctx?.prev) qc.setQueryData(qk.categories(accountId), ctx.prev);
    },
    onSettled: () => {
      if (!accountId) return;
      qc.invalidateQueries({
        queryKey: qk.categories(accountId),
        refetchType: "active",
      });
    },
  });
}

/** Reorder categories (roots and subs). */
export function useReorderCategories(accountId?: string) {
  const qc = useQueryClient();

  return useMutation<
    boolean, // TData
    Error, // TError
    Array<{ id: string; position: number }>, // TVariables
    { prev?: Category[] } // TContext
  >({
    mutationFn: async (updates) => {
      const res = await fetch("/api/user-categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    },
    onMutate: async (updates) => {
      if (!accountId) return { prev: undefined };
      await qc.cancelQueries({ queryKey: qk.categories(accountId) });
      const prev = qc.getQueryData<Category[]>(qk.categories(accountId));
      const map = new Map(updates.map((u) => [u.id, u.position]));
      qc.setQueryData<Category[]>(qk.categories(accountId), (old = []) =>
        old.map((c) => (map.has(c.id) ? { ...c, position: map.get(c.id)! } : c))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (!accountId) return;
      if (ctx?.prev) qc.setQueryData(qk.categories(accountId), ctx.prev);
    },
    onSettled: () => {
      if (!accountId) return;
      qc.invalidateQueries({
        queryKey: qk.categories(accountId),
        refetchType: "active",
      });
    },
  });
}

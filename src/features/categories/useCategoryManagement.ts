"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

type CategoryOperation =
  | "create"
  | "update"
  | "delete"
  | "reorder"
  | "bulk_update";

type CreateCategoryData = {
  name: string;
  icon?: string;
  color?: string;
  account_id: string;
  parent_id?: string | null;
  position?: number;
};

type UpdateCategoryData = {
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  visible?: boolean;
  position?: number;
};

type DeleteCategoryData = {
  id: string;
  hard_delete?: boolean;
};

type ReorderCategoriesData = {
  account_id: string;
  parent_id?: string | null;
  categories: Array<{ id: string; position: number }>;
};

type BulkUpdateData = {
  updates: Array<{
    id: string;
    name?: string;
    icon?: string;
    color?: string;
    position?: number;
    visible?: boolean;
  }>;
};

async function manageCategoryOperation(
  operation: CategoryOperation,
  data: any
) {
  const response = await fetch("/api/categories/manage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, data }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to ${operation} category`);
  }

  return response.json();
}

/**
 * Hook for creating a new category or subcategory
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryData) =>
      manageCategoryOperation("create", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

/**
 * Hook for updating a category (name, icon, color, visibility, position)
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCategoryData) =>
      manageCategoryOperation("update", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

/**
 * Hook for deleting a category (soft delete by default)
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DeleteCategoryData) =>
      manageCategoryOperation("delete", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

/**
 * Hook for reordering categories within an account
 */
export function useReorderCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ReorderCategoriesData) =>
      manageCategoryOperation("reorder", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

/**
 * Hook for bulk updating multiple categories at once
 */
export function useBulkUpdateCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkUpdateData) =>
      manageCategoryOperation("bulk_update", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

/**
 * Convenience hook that returns all category management operations
 */
export function useCategoryManagement() {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const reorder = useReorderCategories();
  const bulkUpdate = useBulkUpdateCategories();

  return {
    create,
    update,
    delete: remove,
    reorder,
    bulkUpdate,
    isLoading:
      create.isPending ||
      update.isPending ||
      remove.isPending ||
      reorder.isPending ||
      bulkUpdate.isPending,
  };
}

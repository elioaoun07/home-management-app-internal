// src/features/catalogue/hooks.ts
"use client";

import type {
  CatalogueCategory,
  CatalogueItem,
  CatalogueModule,
  CatalogueSubItem,
  CreateCategoryInput,
  CreateItemInput,
  CreateModuleInput,
  CreateSubItemInput,
  UpdateCategoryInput,
  UpdateItemInput,
  UpdateModuleInput,
  UpdateSubItemInput,
} from "@/types/catalogue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { catalogueKeys } from "./queryKeys";

// =============================================================================
// API FUNCTIONS
// =============================================================================

// Modules
async function fetchModules(): Promise<CatalogueModule[]> {
  const res = await fetch("/api/catalogue/modules");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function createModule(
  input: CreateModuleInput
): Promise<CatalogueModule> {
  const res = await fetch("/api/catalogue/modules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to create module");
  }
  return res.json();
}

async function updateModule(
  input: UpdateModuleInput
): Promise<CatalogueModule> {
  const { id, ...data } = input;
  const res = await fetch(`/api/catalogue/modules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to update module");
  }
  return res.json();
}

async function deleteModule(id: string): Promise<void> {
  const res = await fetch(`/api/catalogue/modules/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to delete module");
  }
}

// Categories
async function fetchCategories(
  moduleId?: string
): Promise<CatalogueCategory[]> {
  const url = moduleId
    ? `/api/catalogue/categories?module_id=${moduleId}`
    : "/api/catalogue/categories";
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function createCategory(
  input: CreateCategoryInput
): Promise<CatalogueCategory> {
  const res = await fetch("/api/catalogue/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to create category");
  }
  return res.json();
}

async function updateCategory(
  input: UpdateCategoryInput
): Promise<CatalogueCategory> {
  const { id, ...data } = input;
  const res = await fetch(`/api/catalogue/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to update category");
  }
  return res.json();
}

async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`/api/catalogue/categories/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to delete category");
  }
}

// Items
async function fetchItems(
  moduleId?: string,
  categoryId?: string
): Promise<CatalogueItem[]> {
  const params = new URLSearchParams();
  if (moduleId) params.set("module_id", moduleId);
  if (categoryId) params.set("category_id", categoryId);
  const url = `/api/catalogue/items${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchItem(id: string): Promise<CatalogueItem> {
  const res = await fetch(`/api/catalogue/items/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function createItem(input: CreateItemInput): Promise<CatalogueItem> {
  const res = await fetch("/api/catalogue/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to create item");
  }
  return res.json();
}

async function updateItem(input: UpdateItemInput): Promise<CatalogueItem> {
  const { id, ...data } = input;
  const res = await fetch(`/api/catalogue/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to update item");
  }
  return res.json();
}

async function deleteItem(id: string): Promise<CatalogueItem> {
  const res = await fetch(`/api/catalogue/items/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to delete item");
  }
  return res.json();
}

// Sub-items
async function fetchSubItems(itemId: string): Promise<CatalogueSubItem[]> {
  const res = await fetch(`/api/catalogue/sub-items?item_id=${itemId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function createSubItem(
  input: CreateSubItemInput
): Promise<CatalogueSubItem> {
  const res = await fetch("/api/catalogue/sub-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to create sub-item");
  }
  return res.json();
}

async function updateSubItem(
  input: UpdateSubItemInput
): Promise<CatalogueSubItem> {
  const { id, ...data } = input;
  const res = await fetch(`/api/catalogue/sub-items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to update sub-item");
  }
  return res.json();
}

async function deleteSubItem(id: string): Promise<void> {
  const res = await fetch(`/api/catalogue/sub-items/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to delete sub-item");
  }
}

// =============================================================================
// QUERY HOOKS
// =============================================================================

export function useCatalogueModules() {
  return useQuery({
    queryKey: catalogueKeys.modules(),
    queryFn: fetchModules,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useCatalogueCategories(moduleId?: string) {
  return useQuery({
    queryKey: moduleId
      ? catalogueKeys.categoriesByModule(moduleId)
      : catalogueKeys.categories(),
    queryFn: () => fetchCategories(moduleId),
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}

export function useCatalogueItems(moduleId?: string, categoryId?: string) {
  return useQuery({
    queryKey: categoryId
      ? catalogueKeys.itemsByCategory(categoryId)
      : moduleId
        ? catalogueKeys.itemsByModule(moduleId)
        : catalogueKeys.items(),
    queryFn: () => fetchItems(moduleId, categoryId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCatalogueItem(id: string) {
  return useQuery({
    queryKey: catalogueKeys.item(id),
    queryFn: () => fetchItem(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCatalogueSubItems(itemId: string) {
  return useQuery({
    queryKey: catalogueKeys.subItems(itemId),
    queryFn: () => fetchSubItems(itemId),
    enabled: !!itemId,
    staleTime: 1000 * 60 * 5,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

// --- Modules ---

export function useCreateModule() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createModule,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: catalogueKeys.modules() });
      toast.success(`"${created.name}" module created!`, {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await deleteModule(created.id);
              qc.invalidateQueries({ queryKey: catalogueKeys.modules() });
              toast.success("Creation undone");
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create module");
    },
  });
}

export function useUpdateModule() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: updateModule,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: catalogueKeys.modules() });
      const previous = qc.getQueryData<CatalogueModule[]>(
        catalogueKeys.modules()
      );

      if (previous) {
        qc.setQueryData<CatalogueModule[]>(
          catalogueKeys.modules(),
          previous.map((m) => (m.id === input.id ? { ...m, ...input } : m))
        );
      }

      return { previous };
    },
    onError: (err, _, context) => {
      if (context?.previous) {
        qc.setQueryData(catalogueKeys.modules(), context.previous);
      }
      toast.error(err.message || "Failed to update module");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: catalogueKeys.modules() });
    },
    onSuccess: (updated) => {
      toast.success(`"${updated.name}" updated`);
    },
  });
}

export function useDeleteModule() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteModule,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: catalogueKeys.modules() });
      const previous = qc.getQueryData<CatalogueModule[]>(
        catalogueKeys.modules()
      );
      const deleted = previous?.find((m) => m.id === id);

      if (previous) {
        qc.setQueryData<CatalogueModule[]>(
          catalogueKeys.modules(),
          previous.filter((m) => m.id !== id)
        );
      }

      return { previous, deleted };
    },
    onError: (err, _, context) => {
      if (context?.previous) {
        qc.setQueryData(catalogueKeys.modules(), context.previous);
      }
      toast.error(err.message || "Failed to delete module");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: catalogueKeys.modules() });
    },
    onSuccess: (_, __, context) => {
      if (context?.deleted) {
        toast.success(`"${context.deleted.name}" deleted`, {
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                const {
                  id,
                  user_id,
                  created_at,
                  updated_at,
                  category_count,
                  item_count,
                  ...rest
                } = context.deleted!;
                // Convert nulls to undefineds for CreateModuleInput
                const createData = {
                  ...rest,
                  description: rest.description ?? undefined,
                  gradient_from: rest.gradient_from ?? undefined,
                  gradient_to: rest.gradient_to ?? undefined,
                };
                await createModule(createData);
                qc.invalidateQueries({ queryKey: catalogueKeys.modules() });
                toast.success("Deletion undone");
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        });
      }
    },
  });
}

// --- Categories ---

export function useCreateCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createCategory,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: catalogueKeys.categories() });
      qc.invalidateQueries({ queryKey: catalogueKeys.modules() });
      toast.success(`"${created.name}" category created!`, {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await deleteCategory(created.id);
              qc.invalidateQueries({ queryKey: catalogueKeys.categories() });
              toast.success("Creation undone");
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create category");
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: updateCategory,
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: catalogueKeys.categories() });
      toast.success(`"${updated.name}" updated`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update category");
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteCategory,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: catalogueKeys.categories() });
      const previous = qc.getQueryData<CatalogueCategory[]>(
        catalogueKeys.categories()
      );
      const deleted = previous?.find((c) => c.id === id);

      if (previous) {
        qc.setQueryData<CatalogueCategory[]>(
          catalogueKeys.categories(),
          previous.filter((c) => c.id !== id)
        );
      }

      return { previous, deleted };
    },
    onError: (err, _, context) => {
      if (context?.previous) {
        qc.setQueryData(catalogueKeys.categories(), context.previous);
      }
      toast.error(err.message || "Failed to delete category");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: catalogueKeys.categories() });
      qc.invalidateQueries({ queryKey: catalogueKeys.modules() });
    },
    onSuccess: (_, __, context) => {
      if (context?.deleted) {
        toast.success(`"${context.deleted.name}" deleted`, {
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await createCategory({
                  module_id: context.deleted!.module_id,
                  name: context.deleted!.name,
                  description: context.deleted!.description || undefined,
                  parent_id: context.deleted!.parent_id || undefined,
                  icon: context.deleted!.icon || undefined,
                  color: context.deleted!.color || undefined,
                });
                qc.invalidateQueries({ queryKey: catalogueKeys.categories() });
                toast.success("Deletion undone");
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        });
      }
    },
  });
}

// --- Items ---

export function useCreateItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createItem,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: catalogueKeys.items() });
      qc.invalidateQueries({ queryKey: catalogueKeys.categories() });
      qc.invalidateQueries({ queryKey: catalogueKeys.modules() });
      toast.success(`"${created.name}" added!`, {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await deleteItem(created.id);
              qc.invalidateQueries({ queryKey: catalogueKeys.items() });
              toast.success("Creation undone");
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create item");
    },
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: updateItem,
    onMutate: async (input) => {
      const queryKey = catalogueKeys.items();
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<CatalogueItem[]>(queryKey);

      // Optimistic update across all item queries
      qc.setQueriesData<CatalogueItem[]>(
        { queryKey: catalogueKeys.items() },
        (old) =>
          old?.map((item) =>
            item.id === input.id ? { ...item, ...input } : item
          )
      );

      return { previous };
    },
    onError: (err, _, context) => {
      qc.invalidateQueries({ queryKey: catalogueKeys.items() });
      toast.error(err.message || "Failed to update item");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: catalogueKeys.items() });
    },
    onSuccess: (updated) => {
      toast.success(`"${updated.name}" updated`);
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteItem,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: catalogueKeys.items() });

      // Find the item in any cache
      let deleted: CatalogueItem | undefined;
      qc.getQueriesData<CatalogueItem[]>({
        queryKey: catalogueKeys.items(),
      }).forEach(([_, data]) => {
        const found = data?.find((item) => item.id === id);
        if (found) deleted = found;
      });

      // Optimistically remove from all caches
      qc.setQueriesData<CatalogueItem[]>(
        { queryKey: catalogueKeys.items() },
        (old) => old?.filter((item) => item.id !== id)
      );

      return { deleted };
    },
    onError: (err) => {
      qc.invalidateQueries({ queryKey: catalogueKeys.items() });
      toast.error(err.message || "Failed to delete item");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: catalogueKeys.items() });
      qc.invalidateQueries({ queryKey: catalogueKeys.categories() });
      qc.invalidateQueries({ queryKey: catalogueKeys.modules() });
    },
    onSuccess: (deletedFromServer, _, context) => {
      const item = context?.deleted || deletedFromServer;
      if (item) {
        toast.success(`"${item.name}" deleted`, {
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await createItem({
                  module_id: item.module_id,
                  category_id: item.category_id || undefined,
                  name: item.name,
                  description: item.description || undefined,
                  notes: item.notes || undefined,
                  status: item.status,
                  priority: item.priority,
                  icon: item.icon || undefined,
                  color: item.color || undefined,
                  tags: item.tags,
                  metadata_json: item.metadata_json,
                  progress_current: item.progress_current ?? undefined,
                  progress_target: item.progress_target ?? undefined,
                  progress_unit: item.progress_unit || undefined,
                  next_due_date: item.next_due_date || undefined,
                  frequency: item.frequency || undefined,
                });
                qc.invalidateQueries({ queryKey: catalogueKeys.items() });
                toast.success("Deletion undone");
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        });
      }
    },
  });
}

// --- Sub-items ---

export function useCreateSubItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createSubItem,
    onSuccess: (created) => {
      qc.invalidateQueries({
        queryKey: catalogueKeys.subItems(created.item_id),
      });
      qc.invalidateQueries({ queryKey: catalogueKeys.items() });
      toast.success(`Sub-item added`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create sub-item");
    },
  });
}

export function useUpdateSubItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: updateSubItem,
    onSuccess: (updated) => {
      qc.invalidateQueries({
        queryKey: catalogueKeys.subItems(updated.item_id),
      });
      qc.invalidateQueries({ queryKey: catalogueKeys.items() });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update sub-item");
    },
  });
}

export function useDeleteSubItem(itemId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteSubItem,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: catalogueKeys.subItems(itemId) });
      const previous = qc.getQueryData<CatalogueSubItem[]>(
        catalogueKeys.subItems(itemId)
      );
      const deleted = previous?.find((s) => s.id === id);

      if (previous) {
        qc.setQueryData<CatalogueSubItem[]>(
          catalogueKeys.subItems(itemId),
          previous.filter((s) => s.id !== id)
        );
      }

      return { previous, deleted };
    },
    onError: (err, _, context) => {
      if (context?.previous) {
        qc.setQueryData(catalogueKeys.subItems(itemId), context.previous);
      }
      toast.error(err.message || "Failed to delete sub-item");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: catalogueKeys.subItems(itemId) });
      qc.invalidateQueries({ queryKey: catalogueKeys.items() });
    },
    onSuccess: (_, __, context) => {
      if (context?.deleted) {
        toast.success("Sub-item deleted", {
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await createSubItem({
                  item_id: context.deleted!.item_id,
                  name: context.deleted!.name,
                  description: context.deleted!.description || undefined,
                  metadata_json: context.deleted!.metadata_json,
                });
                qc.invalidateQueries({
                  queryKey: catalogueKeys.subItems(itemId),
                });
                toast.success("Deletion undone");
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        });
      }
    },
  });
}

// =============================================================================
// HELPER HOOKS
// =============================================================================

export function useToggleItemPin() {
  const updateItem = useUpdateItem();

  return (item: CatalogueItem) => {
    updateItem.mutate({
      id: item.id,
      is_pinned: !item.is_pinned,
    });
  };
}

export function useToggleItemFavorite() {
  const updateItem = useUpdateItem();

  return (item: CatalogueItem) => {
    updateItem.mutate({
      id: item.id,
      is_favorite: !item.is_favorite,
    });
  };
}

export function useToggleSubItemComplete() {
  const updateSubItem = useUpdateSubItem();

  return (subItem: CatalogueSubItem) => {
    updateSubItem.mutate({
      id: subItem.id,
      is_completed: !subItem.is_completed,
    });
  };
}

// src/features/inventory/hooks.ts
"use client";

import type { CatalogueItem } from "@/types/catalogue";
import type {
  CreateInventoryItemInput,
  InventoryItemWithStock,
  InventoryRestockHistory,
  InventoryStock,
  LowStockItem,
  RestockItemInput,
  UpdateStockInput,
} from "@/types/inventory";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// =============================================================================
// QUERY KEYS
// =============================================================================

export const inventoryKeys = {
  all: ["inventory"] as const,
  stock: () => [...inventoryKeys.all, "stock"] as const,
  stockByItem: (itemId: string) => [...inventoryKeys.stock(), itemId] as const,
  items: () => [...inventoryKeys.all, "items"] as const,
  itemsWithStock: () => [...inventoryKeys.all, "items-with-stock"] as const,
  lowStock: (days?: number) =>
    [...inventoryKeys.all, "low-stock", days] as const,
  history: (itemId?: string) =>
    [...inventoryKeys.all, "history", itemId] as const,
  byBarcode: (barcode: string) =>
    [...inventoryKeys.all, "barcode", barcode] as const,
};

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchInventoryItemsWithStock(): Promise<
  InventoryItemWithStock[]
> {
  const res = await fetch("/api/inventory/items");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchStockByItem(
  itemId: string,
): Promise<InventoryStock | null> {
  const res = await fetch(`/api/inventory/stock/${itemId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(await res.text());
  }
  return res.json();
}

async function fetchLowStockItems(days: number = 7): Promise<LowStockItem[]> {
  const res = await fetch(`/api/inventory/low-stock?days=${days}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchItemByBarcode(
  barcode: string,
): Promise<CatalogueItem | null> {
  const res = await fetch(
    `/api/inventory/barcode/${encodeURIComponent(barcode)}`,
  );
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(await res.text());
  }
  return res.json();
}

async function fetchRestockHistory(
  itemId?: string,
): Promise<InventoryRestockHistory[]> {
  const url = itemId
    ? `/api/inventory/history?item_id=${itemId}`
    : "/api/inventory/history";
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function createInventoryItem(
  input: CreateInventoryItemInput,
): Promise<{ item: CatalogueItem; stock: InventoryStock }> {
  const res = await fetch("/api/inventory/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to create inventory item");
  }
  return res.json();
}

async function restockItem(input: RestockItemInput): Promise<InventoryStock> {
  const res = await fetch("/api/inventory/restock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to restock item");
  }
  return res.json();
}

async function updateStock(input: UpdateStockInput): Promise<InventoryStock> {
  const { stock_id, ...data } = input;
  const res = await fetch(`/api/inventory/stock/${stock_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to update stock");
  }
  return res.json();
}

async function addLowStockToShopping(
  itemIds: string[],
  threadId: string,
): Promise<{ added: number }> {
  const res = await fetch("/api/inventory/add-to-shopping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_ids: itemIds, thread_id: threadId }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to add items to shopping");
  }
  return res.json();
}

// =============================================================================
// QUERY HOOKS
// =============================================================================

export function useInventoryItems() {
  return useQuery({
    queryKey: inventoryKeys.itemsWithStock(),
    queryFn: fetchInventoryItemsWithStock,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useInventoryStock(itemId: string) {
  return useQuery({
    queryKey: inventoryKeys.stockByItem(itemId),
    queryFn: () => fetchStockByItem(itemId),
    enabled: !!itemId,
  });
}

export function useLowStockItems(days: number = 7) {
  return useQuery({
    queryKey: inventoryKeys.lowStock(days),
    queryFn: () => fetchLowStockItems(days),
    staleTime: 1000 * 60 * 5,
  });
}

export function useItemByBarcode(barcode: string) {
  return useQuery({
    queryKey: inventoryKeys.byBarcode(barcode),
    queryFn: () => fetchItemByBarcode(barcode),
    enabled: !!barcode,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useRestockHistory(itemId?: string) {
  return useQuery({
    queryKey: inventoryKeys.history(itemId),
    queryFn: () => fetchRestockHistory(itemId),
    staleTime: 1000 * 60 * 5,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInventoryItem,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ["catalogue"] });
      toast.success(`${data.item.name} added to inventory`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRestockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restockItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Item restocked successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAddToShopping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemIds,
      threadId,
    }: {
      itemIds: string[];
      threadId: string;
    }) => addLowStockToShopping(itemIds, threadId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ["hub"] });
      toast.success(`${data.added} items added to shopping list`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

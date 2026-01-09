// src/features/hub/itemLinksHooks.ts
// React Query hooks for shopping item multi-link feature

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

export interface ShoppingItemLink {
  id: string;
  message_id: string;
  user_id: string;
  url: string;
  store_name: string | null;
  product_title: string | null;
  price: number | null;
  currency: string;
  stock_status: "in_stock" | "out_of_stock" | "low_stock" | "unknown" | null;
  stock_quantity: number | null;
  image_url: string | null;
  extra_info: Record<string, unknown> | null;
  last_fetched_at: string | null;
  fetch_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddLinkInput {
  message_id: string;
  url: string;
  auto_fetch?: boolean;
}

// ============================================
// QUERY KEYS
// ============================================

export const itemLinksKeys = {
  all: ["item-links"] as const,
  byMessage: (messageId: string) => [...itemLinksKeys.all, messageId] as const,
};

// ============================================
// FETCH FUNCTIONS
// ============================================

async function fetchItemLinks(messageId: string): Promise<ShoppingItemLink[]> {
  const res = await fetch(`/api/hub/item-links?message_id=${messageId}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch links");
  }
  return res.json();
}

async function addItemLink(input: AddLinkInput): Promise<ShoppingItemLink> {
  const res = await fetch("/api/hub/item-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to add link");
  }
  return res.json();
}

async function refreshLink(linkId: string): Promise<ShoppingItemLink> {
  const res = await fetch("/api/hub/item-links", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link_id: linkId, action: "refresh" }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to refresh link");
  }
  return res.json();
}

async function deleteItemLink(linkId: string): Promise<void> {
  const res = await fetch(`/api/hub/item-links?link_id=${linkId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to delete link");
  }
}

// ============================================
// HOOKS
// ============================================

/**
 * Fetch all links for a shopping item
 */
export function useItemLinks(messageId: string | null) {
  return useQuery({
    queryKey: itemLinksKeys.byMessage(messageId || ""),
    queryFn: () => fetchItemLinks(messageId!),
    enabled: !!messageId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

/**
 * Add a new link to a shopping item
 */
export function useAddItemLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addItemLink,
    onSuccess: (newLink) => {
      // Invalidate the links query for this message
      queryClient.invalidateQueries({
        queryKey: itemLinksKeys.byMessage(newLink.message_id),
      });
      toast.success("Link added! Fetching product info...", {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await deleteItemLink(newLink.id);
              queryClient.invalidateQueries({
                queryKey: itemLinksKeys.byMessage(newLink.message_id),
              });
              toast.success("Link removed");
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Refresh product info for a link
 */
export function useRefreshLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshLink,
    onSuccess: (updatedLink) => {
      // Update the cache with fresh data
      queryClient.setQueryData<ShoppingItemLink[]>(
        itemLinksKeys.byMessage(updatedLink.message_id),
        (old) => {
          if (!old) return [updatedLink];
          return old.map((link) =>
            link.id === updatedLink.id ? updatedLink : link
          );
        }
      );
      toast.success("Product info refreshed!");
    },
    onError: (error: Error) => {
      toast.error(`Refresh failed: ${error.message}`);
    },
  });
}

/**
 * Delete a link from a shopping item
 */
export function useDeleteItemLink(messageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string) => {
      // Get the link data before deleting for undo
      const existingLinks = queryClient.getQueryData<ShoppingItemLink[]>(
        itemLinksKeys.byMessage(messageId)
      );
      const deletedLink = existingLinks?.find((l) => l.id === linkId);
      await deleteItemLink(linkId);
      return { linkId, deletedLink };
    },
    onSuccess: ({ deletedLink }) => {
      queryClient.invalidateQueries({
        queryKey: itemLinksKeys.byMessage(messageId),
      });
      toast.success("Link removed", {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              if (deletedLink) {
                await addItemLink({
                  message_id: deletedLink.message_id,
                  url: deletedLink.url,
                  auto_fetch: false,
                });
                queryClient.invalidateQueries({
                  queryKey: itemLinksKeys.byMessage(messageId),
                });
                toast.success("Link restored");
              }
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Refresh all links for a shopping item
 */
export function useRefreshAllLinks(messageId: string) {
  const { data: links } = useItemLinks(messageId);
  const refreshMutation = useRefreshLink();

  const refreshAll = async () => {
    if (!links || links.length === 0) return;

    toast.info(`Refreshing ${links.length} links...`);

    const results = await Promise.allSettled(
      links.map(
        (link, index) =>
          // Stagger requests
          new Promise<void>((resolve) => {
            setTimeout(async () => {
              try {
                await refreshMutation.mutateAsync(link.id);
              } catch {
                // Individual errors are handled by mutation
              }
              resolve();
            }, index * 1000);
          })
      )
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    toast.success(`Refreshed ${successful}/${links.length} links`);
  };

  return { refreshAll, isRefreshing: refreshMutation.isPending };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format price with currency
 */
export function formatPrice(
  price: number | null,
  currency: string = "USD"
): string {
  if (price === null) return "Price N/A";

  // Handle LBP specially (no decimals, large numbers)
  if (currency === "LBP") {
    return `${price.toLocaleString()} LBP`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`;
  }
}

/**
 * Get stock status display info
 */
export function getStockStatusInfo(status: ShoppingItemLink["stock_status"]): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case "in_stock":
      return {
        label: "In Stock",
        color: "text-green-400",
        bgColor: "bg-green-500/20",
      };
    case "out_of_stock":
      return {
        label: "Out of Stock",
        color: "text-red-400",
        bgColor: "bg-red-500/20",
      };
    case "low_stock":
      return {
        label: "Low Stock",
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/20",
      };
    default:
      return {
        label: "Unknown",
        color: "text-gray-400",
        bgColor: "bg-gray-500/20",
      };
  }
}

/**
 * Find the best deal from a list of links
 */
export function findBestDeal(
  links: ShoppingItemLink[]
): ShoppingItemLink | null {
  // Only consider in-stock items with prices
  const available = links.filter(
    (l) => l.price !== null && l.stock_status !== "out_of_stock"
  );

  if (available.length === 0) return null;

  return available.reduce((best, current) =>
    (current.price ?? Infinity) < (best.price ?? Infinity) ? current : best
  );
}

/**
 * Sort links by price (lowest first), then by stock status
 */
export function sortLinksByValue(
  links: ShoppingItemLink[]
): ShoppingItemLink[] {
  return [...links].sort((a, b) => {
    // Out of stock items go to the end
    if (a.stock_status === "out_of_stock" && b.stock_status !== "out_of_stock")
      return 1;
    if (b.stock_status === "out_of_stock" && a.stock_status !== "out_of_stock")
      return -1;

    // Sort by price (null prices go to end)
    const priceA = a.price ?? Infinity;
    const priceB = b.price ?? Infinity;

    return priceA - priceB;
  });
}

// ShoppingListView.tsx - Special view for shopping purpose threads
"use client";

import { HubChatThread, HubMessage } from "@/features/hub/hooks";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ExternalLink,
  Link as LinkIcon,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface ShoppingItem {
  id: string;
  content: string;
  quantity: string | null; // Quantity for the item (e.g., "2 bags", "1 lb")
  checked: boolean;
  checkedAt: string | null;
  checkedBy: string | null;
  createdAt: string;
  senderId: string;
  itemUrl: string | null; // URL for where to get the item
}

interface ShoppingListViewProps {
  messages: HubMessage[];
  currentUserId: string;
  threadId: string;
  thread?: HubChatThread | null;
  onAddItem: (content: string, quantity?: string) => void;
  onDeleteItem: (messageId: string) => void;
  isLoading?: boolean;
}

export function ShoppingListView({
  messages,
  currentUserId,
  threadId,
  thread,
  onAddItem,
  onDeleteItem,
  isLoading = false,
}: ShoppingListViewProps) {
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [pendingToggles, setPendingToggles] = useState<Map<string, number>>(
    new Map()
  );
  const [editingUrlFor, setEditingUrlFor] = useState<string | null>(null);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [editingQuantityFor, setEditingQuantityFor] = useState<string | null>(
    null
  );
  const [quantityInputValue, setQuantityInputValue] = useState("");

  const enableItemUrls = thread?.enable_item_urls ?? false;

  // Parse messages into shopping items
  // Now using checked_at from database instead of localStorage
  const items: ShoppingItem[] = messages
    .filter(
      (msg) =>
        msg.message_type === "text" &&
        msg.content &&
        !msg.deleted_at &&
        !msg.archived_at
    )
    .map((msg) => ({
      id: msg.id,
      content: msg.content || "",
      quantity: msg.item_quantity || null,
      checked: !!msg.checked_at,
      checkedAt: msg.checked_at || null,
      checkedBy: msg.checked_by || null,
      createdAt: msg.created_at,
      senderId: msg.sender_user_id,
      itemUrl: msg.item_url || null,
    }))
    .sort((a, b) => {
      // Unchecked items first, then by creation date
      if (a.checked !== b.checked) {
        return a.checked ? 1 : -1;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  // Separate checked and unchecked items
  const uncheckedItems = items.filter((item) => !item.checked);
  const checkedItemsList = items.filter((item) => item.checked);

  const handleAddItem = () => {
    if (!newItem.trim()) return;

    // Smart quantity parsing from input
    const input = newItem.trim();
    let content = input;
    let quantity: string | undefined = undefined;

    // Pattern 1: "2 bags pasta" or "2 bags of pasta"
    const quantityFirstPattern =
      /^([\d.]+\s*(?:bags?|bottles?|lbs?|kg|g|oz|pieces?|packs?|boxes?|cans?|jars?|units?|items?)(?:\s+of)?)\s+(.+)$/i;
    const match1 = input.match(quantityFirstPattern);

    if (match1) {
      quantity = match1[1].trim();
      content = match1[2].trim();
    } else {
      // Pattern 2: "pasta 2 bags" or "pasta - 2 bags"
      const quantityLastPattern =
        /^(.+?)\s*[-:]?\s+([\d.]+\s*(?:bags?|bottles?|lbs?|kg|g|oz|pieces?|packs?|boxes?|cans?|jars?|units?|items?))$/i;
      const match2 = input.match(quantityLastPattern);

      if (match2) {
        content = match2[1].trim();
        quantity = match2[2].trim();
      }
    }

    onAddItem(content, quantity);
    setNewItem("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddItem();
    }
  };

  // Handle paste event to detect and parse lists
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text");

    // Split by newlines and clean up
    const lines = pastedText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Debug logging
    console.log("📋 Paste detected:");
    console.log("Total lines:", lines.length);
    console.log("First 5 lines:", lines.slice(0, 5));

    // Detect if this looks like a list:
    // - Multiple lines (2 or more)
    // - OR has bullet points/numbers even if single line with bullets
    const hasMultipleLines = lines.length > 1;
    const hasListMarkers = lines.some(
      (line) =>
        /^[-•*●○■□▪▫★☆✓✗◆◇→⇒]/.test(line) || // Bullet points
        /^\d+[.)]/.test(line) || // Numbered lists like "1." or "1)"
        /^[a-zA-Z][.)]/.test(line) // Lettered lists like "a." or "a)"
    );

    const isList = hasMultipleLines || hasListMarkers;

    if (isList) {
      // Prevent default paste behavior
      e.preventDefault();

      let items: Array<{ content: string; quantity?: string }> = [];

      // Check for ChatGPT table format (alternating lines: ingredient, quantity, ingredient, quantity...)
      // More flexible header detection - check if first two lines are headers
      const headerPattern = /^(ingredient|quantity|item|name|amount)s?$/i;
      const firstLineIsHeader =
        lines.length > 0 && headerPattern.test(lines[0]);
      const secondLineIsHeader =
        lines.length > 1 && headerPattern.test(lines[1]);

      // Also check for single-line header case: "Ingredient	Quantity" (tab-separated headers)
      const firstLineHasBothHeaders =
        lines.length > 0 &&
        /ingredient/i.test(lines[0]) &&
        /quantity/i.test(lines[0]);

      const hasTableHeader =
        (firstLineIsHeader && secondLineIsHeader) || firstLineHasBothHeaders;

      console.log("🔍 Table header detected:", hasTableHeader);
      console.log("First line:", lines[0]);
      console.log("Second line:", lines[1]);
      console.log("First is header:", firstLineIsHeader);
      console.log("Second is header:", secondLineIsHeader);

      // MOBILE FORMAT: Alternating lines with headers
      if (firstLineIsHeader && secondLineIsHeader) {
        // Skip header rows and parse alternating pairs
        const dataLines = lines.slice(2);

        console.log("📱 Parsing MOBILE table format (alternating lines)");
        console.log("Data lines count:", dataLines.length);

        // Parse in pairs: [ingredient, quantity, ingredient, quantity, ...]
        for (let i = 0; i < dataLines.length; i += 2) {
          const ingredient = dataLines[i];
          const quantity = dataLines[i + 1]; // Next line is quantity

          if (ingredient) {
            console.log(
              `  ✓ Item ${i / 2 + 1}: "${ingredient}" → "${quantity || "no qty"}"`
            );
            items.push({
              content: ingredient.trim(),
              quantity: quantity ? quantity.trim() : undefined,
            });
          }
        }
      }
      // DESKTOP FORMAT: Tab-separated with optional header row
      else if (lines.some((line) => line.includes("\t"))) {
        console.log("💻 Parsing DESKTOP table format (tab-separated)");

        // Skip first line if it's a header
        const startIndex = firstLineHasBothHeaders ? 1 : 0;
        const dataLines = lines.slice(startIndex);

        items = dataLines
          .filter((line) => line.includes("\t"))
          .map((line) => {
            const parts = line.split("\t").map((p) => p.trim());
            return {
              content: parts[0],
              quantity: parts.length > 1 ? parts[1] : undefined,
            };
          })
          .filter((item) => item.content.length > 0);

        console.log(`  ✓ Parsed ${items.length} tab-separated items`);
      } else {
        // Original parsing logic for other formats
        items = lines
          .map((line) => {
            // Remove common list markers
            let cleaned = line
              .replace(/^[-•*●○■□▪▫★☆✓✗◆◇→⇒]\s*/, "") // Remove bullet points
              .replace(/^\d+[.)]\s*/, "") // Remove numbers like "1." or "1)"
              .replace(/^[a-zA-Z][.)]\s*/, "") // Remove letters like "a." or "a)"
              .trim();

            // Check for 2-column format (tab or pipe separated)
            // Format: "ingredient \t quantity" or "ingredient | quantity"
            let content = cleaned;
            let quantity: string | undefined = undefined;

            // Try tab separation first
            if (cleaned.includes("\t")) {
              const parts = cleaned.split("\t").map((p) => p.trim());
              if (parts.length >= 2) {
                content = parts[0];
                quantity = parts[1];
              }
            }
            // Try pipe separation
            else if (cleaned.includes("|")) {
              const parts = cleaned.split("|").map((p) => p.trim());
              if (parts.length >= 2) {
                content = parts[0];
                quantity = parts[1];
              }
            }

            return { content, quantity };
          })
          .filter((item) => item.content.length > 0);
      }

      // Add each item to the shopping list
      if (items.length > 0) {
        items.forEach(({ content, quantity }) => {
          onAddItem(content, quantity);
        });

        // Clear the input
        setNewItem("");

        // Show success message
        toast.success(
          `Added ${items.length} item${items.length > 1 ? "s" : ""} to list`
        );
      }
    }
    // If it's not a list (single line, no markers), let the default paste behavior happen
  };

  // Toggle check state via API with instant optimistic UI
  const toggleCheck = useCallback(
    async (itemId: string) => {
      const queryKey = ["hub", "messages", threadId];

      // Track pending toggle count for this item
      setPendingToggles((prev) => {
        const newMap = new Map(prev);
        newMap.set(itemId, (newMap.get(itemId) || 0) + 1);
        return newMap;
      });

      // Get current state from cache to determine toggle direction
      const currentData = queryClient.getQueryData<{ messages: HubMessage[] }>(
        queryKey
      );
      const currentMessage = currentData?.messages.find((m) => m.id === itemId);
      const shouldCheck = !currentMessage?.checked_at;

      // Optimistically update UI immediately - no delay
      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((msg) =>
            msg.id === itemId
              ? {
                  ...msg,
                  checked_at: shouldCheck ? new Date().toISOString() : null,
                  checked_by: shouldCheck ? currentUserId : null,
                }
              : msg
          ),
        };
      });

      try {
        // Fire and forget - don't await or refetch
        fetch("/api/hub/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "toggle_check",
            message_id: itemId,
          }),
        }).then((res) => {
          if (!res.ok) {
            console.error("Failed to toggle check");
            // Silently rollback on error
            queryClient.setQueryData<{ messages: HubMessage[] }>(
              queryKey,
              (old) => {
                if (!old) return old;
                return {
                  ...old,
                  messages: old.messages.map((msg) =>
                    msg.id === itemId
                      ? {
                          ...msg,
                          checked_at: shouldCheck
                            ? null
                            : new Date().toISOString(),
                          checked_by: shouldCheck ? null : currentUserId,
                        }
                      : msg
                  ),
                };
              }
            );
          }
        });
      } finally {
        // Clear pending toggle after a short delay
        setTimeout(() => {
          setPendingToggles((prev) => {
            const newMap = new Map(prev);
            const count = newMap.get(itemId) || 0;
            if (count <= 1) {
              newMap.delete(itemId);
            } else {
              newMap.set(itemId, count - 1);
            }
            return newMap;
          });
        }, 100);
      }
    },
    [queryClient, threadId, currentUserId]
  );

  // Set item quantity
  const setItemQuantity = useCallback(
    async (itemId: string, quantity: string | null) => {
      const queryKey = ["hub", "messages", threadId];

      // Optimistic update
      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((msg) =>
            msg.id === itemId ? { ...msg, item_quantity: quantity } : msg
          ),
        };
      });

      try {
        const res = await fetch("/api/hub/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_quantity",
            message_id: itemId,
            quantity: quantity,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to update quantity");
        }

        toast.success(quantity ? "Quantity updated" : "Quantity removed");
      } catch (error) {
        console.error("Error updating quantity:", error);
        toast.error("Failed to update quantity");
        // Rollback on error
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [queryClient, threadId]
  );

  // Set item URL
  const setItemUrl = useCallback(
    async (itemId: string, url: string | null) => {
      const queryKey = ["hub", "messages", threadId];

      try {
        // Optimistic update
        queryClient.setQueryData<{ messages: HubMessage[] }>(
          queryKey,
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.map((msg) =>
                msg.id === itemId ? { ...msg, item_url: url } : msg
              ),
            };
          }
        );

        const res = await fetch("/api/hub/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_item_url",
            message_id: itemId,
            item_url: url,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to set URL");
        }

        setEditingUrlFor(null);
        setUrlInputValue("");
        toast.success(url ? "Link added" : "Link removed");
      } catch (error) {
        console.error("Failed to set item URL:", error);
        toast.error("Failed to update link");
        // Rollback on error
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [queryClient, threadId]
  );

  const handleStartEditUrl = (itemId: string, currentUrl: string | null) => {
    setEditingUrlFor(itemId);
    setUrlInputValue(currentUrl || "");
  };

  const handleSaveUrl = (itemId: string) => {
    const trimmedUrl = urlInputValue.trim();
    setItemUrl(itemId, trimmedUrl || null);
  };

  const handleCancelEditUrl = () => {
    setEditingUrlFor(null);
    setUrlInputValue("");
  };

  // Clear all checked items (archive them)
  const handleClearChecked = useCallback(async () => {
    if (checkedItemsList.length === 0 || isClearing) return;

    setIsClearing(true);

    try {
      const res = await fetch("/api/hub/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_checked",
          thread_id: threadId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to clear items");
      }

      const data = await res.json();
      toast.success(`Cleared ${data.archivedCount} items`);

      // Refresh the messages
      queryClient.invalidateQueries({
        queryKey: ["hub", "messages", threadId],
      });
    } catch (error) {
      console.error("Failed to clear checked items:", error);
      toast.error("Failed to clear items");
    } finally {
      setIsClearing(false);
    }
  }, [checkedItemsList.length, isClearing, queryClient, threadId]);

  return (
    <div className="flex flex-col h-full">
      {/* Add Item Input - Fixed at top */}
      <div className="p-4 border-b border-white/5 bg-bg-card-custom/95 backdrop-blur-sm">
        <div className="flex gap-2">
          <textarea
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyPress}
            onPaste={handlePaste}
            placeholder="Add new item..."
            disabled={isLoading}
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 resize-none overflow-hidden"
            style={{
              minHeight: "42px",
              maxHeight: "120px",
            }}
            onInput={(e) => {
              // Auto-resize textarea
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "42px";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
            autoFocus
          />
          <button
            onClick={handleAddItem}
            disabled={!newItem.trim() || isLoading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Shopping List - Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Loading skeleton */}
        {isLoading ? (
          <div className="py-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="neo-card bg-bg-card-custom border border-white/5 rounded-xl p-3 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-white/10" />
                  <div className="flex-1">
                    <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-center text-xs text-white/30 mt-6">
              Loading your shopping list...
            </p>
          </div>
        ) : (
          <>
            {/* Unchecked Items */}
            <div className="py-4 space-y-2">
              {uncheckedItems.length === 0 && checkedItemsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <span className="text-5xl mb-3">🛒</span>
                  <p className="text-sm text-white/50">
                    Your shopping list is empty
                  </p>
                  <p className="text-xs text-white/30 mt-1">
                    Add items above to get started
                  </p>
                </div>
              ) : uncheckedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="text-4xl mb-2">✅</span>
                  <p className="text-sm text-white/50">All items checked!</p>
                  <p className="text-xs text-white/30 mt-1">
                    Tap "Clear completed" when done shopping
                  </p>
                </div>
              ) : (
                uncheckedItems.map((item) => (
                  <div
                    key={item.id}
                    className="group neo-card bg-bg-card-custom border border-white/5 rounded-xl overflow-hidden transition-all hover:border-white/10"
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleCheck(item.id)}
                        className="w-6 h-6 rounded-md border-2 border-white/30 hover:border-white/50 flex items-center justify-center transition-all flex-shrink-0"
                      >
                        {/* Empty checkbox */}
                      </button>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm">
                            {item.content}
                          </span>

                          {/* Quantity - editable */}
                          {editingQuantityFor === item.id ? (
                            <input
                              type="text"
                              value={quantityInputValue}
                              onChange={(e) =>
                                setQuantityInputValue(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const trimmedQuantity =
                                    quantityInputValue.trim();
                                  setItemQuantity(
                                    item.id,
                                    trimmedQuantity || null
                                  );
                                  setEditingQuantityFor(null);
                                  setQuantityInputValue("");
                                } else if (e.key === "Escape") {
                                  setEditingQuantityFor(null);
                                  setQuantityInputValue("");
                                }
                              }}
                              onBlur={() => {
                                const trimmedQuantity =
                                  quantityInputValue.trim();
                                setItemQuantity(
                                  item.id,
                                  trimmedQuantity || null
                                );
                                setEditingQuantityFor(null);
                                setQuantityInputValue("");
                              }}
                              placeholder="e.g., 2 bags"
                              className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-400/50 focus:outline-none focus:border-blue-400 w-24"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingQuantityFor(item.id);
                                setQuantityInputValue(item.quantity || "");
                              }}
                              className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-all"
                              title="Click to edit quantity"
                            >
                              {item.quantity || "+ qty"}
                            </button>
                          )}

                          {enableItemUrls &&
                            item.itemUrl &&
                            editingUrlFor !== item.id && (
                              <a
                                href={item.itemUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-all"
                                onClick={(e) => e.stopPropagation()}
                                title={item.itemUrl}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        {/* Link Button - Only show if enableItemUrls is true */}
                        {enableItemUrls && (
                          <button
                            onClick={() =>
                              handleStartEditUrl(item.id, item.itemUrl)
                            }
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              item.itemUrl
                                ? "text-blue-400 hover:bg-blue-500/20"
                                : "text-white/40 hover:bg-white/10 hover:text-white"
                            )}
                            title={item.itemUrl ? "Edit link" : "Add link"}
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Button */}
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* URL Edit Input */}
                    {editingUrlFor === item.id && (
                      <div className="px-3 pb-3 pt-0">
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={urlInputValue}
                            onChange={(e) => setUrlInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveUrl(item.id);
                              } else if (e.key === "Escape") {
                                handleCancelEditUrl();
                              }
                            }}
                            placeholder="https://..."
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveUrl(item.id)}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEditUrl}
                            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 text-sm"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Checked Items - Strikethrough at bottom */}
            {checkedItemsList.length > 0 && (
              <div className="py-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px w-8 bg-white/10" />
                    <span className="text-xs text-white/40">
                      Completed ({checkedItemsList.length})
                    </span>
                    <div className="h-px w-8 bg-white/10" />
                  </div>

                  {/* Clear Completed Button */}
                  <button
                    onClick={handleClearChecked}
                    disabled={isClearing}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isClearing
                        ? "bg-white/5 text-white/30 cursor-not-allowed"
                        : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    )}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {isClearing ? "Clearing..." : "Clear completed"}
                  </button>
                </div>

                <div className="space-y-2">
                  {checkedItemsList.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 opacity-60"
                    >
                      {/* Checked Checkbox */}
                      <button
                        onClick={() => toggleCheck(item.id)}
                        className="w-6 h-6 rounded-md bg-emerald-500 border-2 border-emerald-500 flex items-center justify-center transition-all flex-shrink-0"
                      >
                        <Check className="w-4 h-4 text-white" />
                      </button>

                      {/* Content - Strikethrough */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 text-sm line-through">
                            {item.content}
                          </span>

                          {/* Quantity - editable even when checked */}
                          {editingQuantityFor === item.id ? (
                            <input
                              type="text"
                              value={quantityInputValue}
                              onChange={(e) =>
                                setQuantityInputValue(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const trimmedQuantity =
                                    quantityInputValue.trim();
                                  setItemQuantity(
                                    item.id,
                                    trimmedQuantity || null
                                  );
                                  setEditingQuantityFor(null);
                                  setQuantityInputValue("");
                                } else if (e.key === "Escape") {
                                  setEditingQuantityFor(null);
                                  setQuantityInputValue("");
                                }
                              }}
                              onBlur={() => {
                                const trimmedQuantity =
                                  quantityInputValue.trim();
                                setItemQuantity(
                                  item.id,
                                  trimmedQuantity || null
                                );
                                setEditingQuantityFor(null);
                                setQuantityInputValue("");
                              }}
                              placeholder="e.g., 2 bags"
                              className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-400/50 focus:outline-none focus:border-blue-400 w-24"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : item.quantity ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingQuantityFor(item.id);
                                setQuantityInputValue(item.quantity || "");
                              }}
                              className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300/50 text-xs font-medium line-through hover:bg-blue-500/20 transition-all"
                              title="Click to edit quantity"
                            >
                              {item.quantity}
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingQuantityFor(item.id);
                                setQuantityInputValue("");
                              }}
                              className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300/40 text-xs font-medium hover:bg-blue-500/20 transition-all opacity-0 group-hover:opacity-100"
                              title="Click to add quantity"
                            >
                              + qty
                            </button>
                          )}
                          {enableItemUrls && item.itemUrl && (
                            <a
                              href={item.itemUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded hover:bg-blue-500/20 text-blue-400/60 hover:text-blue-400 transition-all"
                              onClick={(e) => e.stopPropagation()}
                              title={item.itemUrl}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

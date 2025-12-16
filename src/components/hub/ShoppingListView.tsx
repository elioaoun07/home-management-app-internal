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
  onAddItem: (content: string) => void;
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
    onAddItem(newItem.trim());
    setNewItem("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddItem();
    }
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
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Add item to shopping list..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
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

// ShoppingListView.tsx - Special view for shopping purpose threads
"use client";

import { HubMessage } from "@/features/hub/hooks";
import { cn } from "@/lib/utils";
import { Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ShoppingItem {
  id: string;
  content: string;
  checked: boolean;
  checkedAt: string | null;
  order: number;
  createdAt: string;
  senderId: string;
}

interface ShoppingListViewProps {
  messages: HubMessage[];
  currentUserId: string;
  onAddItem: (content: string) => void;
  onDeleteItem: (messageId: string) => void;
  isLoading?: boolean;
}

export function ShoppingListView({
  messages,
  currentUserId,
  onAddItem,
  onDeleteItem,
  isLoading = false,
}: ShoppingListViewProps) {
  const [newItem, setNewItem] = useState("");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // Load checked items from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("shopping-checked-items");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCheckedItems(new Set(parsed));
      } catch (e) {
        console.error("Failed to parse checked items", e);
      }
    }
  }, []);

  // Save checked items to localStorage
  useEffect(() => {
    localStorage.setItem(
      "shopping-checked-items",
      JSON.stringify(Array.from(checkedItems))
    );
  }, [checkedItems]);

  // Parse messages into shopping items (plain text)
  const items: ShoppingItem[] = messages
    .filter(
      (msg) => msg.message_type === "text" && msg.content && !msg.deleted_at
    )
    .map((msg) => ({
      id: msg.id,
      content: msg.content || "",
      checked: checkedItems.has(msg.id),
      checkedAt: checkedItems.has(msg.id) ? new Date().toISOString() : null,
      order: 0,
      createdAt: msg.created_at,
      senderId: msg.sender_user_id,
    }))
    .sort((a, b) => {
      // Sort by creation date (oldest first for unchecked, newest last for checked)
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

  const toggleCheck = (itemId: string) => {
    setCheckedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

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
            </div>
          ) : (
            uncheckedItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-xl neo-card bg-bg-card-custom border border-white/5 transition-all hover:border-white/10"
                )}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleCheck(item.id)}
                  className="w-6 h-6 rounded-md border-2 border-white/30 hover:border-white/50 flex items-center justify-center transition-all flex-shrink-0"
                >
                  {/* Empty checkbox */}
                </button>

                {/* Content */}
                <div className="flex-1 text-white text-sm">{item.content}</div>

                {/* Delete Button - Hidden until hover */}
                <button
                  onClick={() => onDeleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Checked Items - Strikethrough at bottom */}
        {checkedItemsList.length > 0 && (
          <div className="py-4 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-xs text-white/40">
                Completed ({checkedItemsList.length})
              </span>
              <div className="flex-1 h-px bg-white/5" />
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
                  <div className="flex-1 text-white/50 text-sm line-through">
                    {item.content}
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
      </div>
    </div>
  );
}

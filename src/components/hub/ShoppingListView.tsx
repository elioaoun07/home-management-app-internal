// ShoppingListView.tsx - Special view for shopping purpose threads
"use client";

import { HubChatThread, HubMessage } from "@/features/hub/hooks";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { cn } from "@/lib/utils";
import type { MealPlanWithRecipe } from "@/types/recipe";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  Layers,
  Link as LinkIcon,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  User,
  UserCheck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ProductComparisonSheet } from "./ProductComparisonSheet";

// Types
interface ShoppingGroup {
  id: string;
  thread_id: string;
  household_id: string;
  name: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

interface ShoppingItem {
  id: string;
  content: string;
  quantity: string | null;
  checked: boolean;
  checkedAt: string | null;
  checkedBy: string | null;
  createdAt: string;
  senderId: string;
  itemUrl: string | null;
  hasLinks: boolean;
  source: "user" | "inventory" | "system" | "ai";
  sourceItemId: string | null;
  mealPlanId: string | null;
  shoppingGroupId: string | null;
  assignedTo: string | null;
}

interface ItemGroup {
  key: string; // group id, meal plan id, or "ungrouped"
  type: "custom" | "meal-plan" | "ungrouped";
  name: string;
  groupId: string | null; // shopping_group_id for custom groups
  mealPlanId: string | null;
  plannedDate: string | null;
  items: ShoppingItem[];
  isCollapsed: boolean;
}

interface ShoppingListViewProps {
  messages: HubMessage[];
  currentUserId: string;
  threadId: string;
  thread?: HubChatThread | null;
  onAddItem: (
    content: string,
    quantity?: string,
    topicId?: string,
    shoppingGroupId?: string,
  ) => void;
  onDeleteItem: (messageId: string) => void;
  isLoading?: boolean;
}

// ── SwipeToAssign: horizontal swipe wrapper for shopping items ──
// Left swipe = assign to me, Right swipe = assign to partner
// Uses a two-stage threshold: dead zone (0-20px), preview zone (20-70px), confirm zone (70px+)
// Vertical motion > horizontal locks into scroll mode to prevent accidental triggers
interface SwipeToAssignProps {
  itemId: string;
  currentUserId: string;
  partnerId: string | null;
  partnerName: string;
  assignedTo: string | null;
  onAssign: (itemId: string, userId: string | null) => void;
  children: React.ReactNode;
}

function SwipeToAssign({
  itemId,
  currentUserId,
  partnerId,
  partnerName,
  assignedTo,
  onAssign,
  children,
}: SwipeToAssignProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    direction: "horizontal" | "vertical" | null;
    dragging: boolean;
  } | null>(null);

  const DEAD_ZONE = 20; // px before any visual feedback
  const CONFIRM_ZONE = 70; // px to confirm assignment
  const MAX_DRAG = 100; // px max visual translation

  // Use refs to always have latest values in touch handlers (avoids stale closures)
  const assignedToRef = useRef(assignedTo);
  assignedToRef.current = assignedTo;
  const onAssignRef = useRef(onAssign);
  onAssignRef.current = onAssign;
  const partnerIdRef = useRef(partnerId);
  partnerIdRef.current = partnerId;

  // Use native touch listeners so we can set { passive: false } for preventDefault
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        direction: null,
        dragging: false,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const state = touchStateRef.current;
      if (!state) return;
      const touch = e.touches[0];
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Lock direction on first significant movement
      if (!state.direction) {
        if (absDx < 8 && absDy < 8) return;
        state.direction = absDx > absDy ? "horizontal" : "vertical";
      }

      // Vertical scroll — do nothing
      if (state.direction === "vertical") return;

      // No partner → block swipe right
      if (!partnerId && dx > 0) return;

      // Prevent page scroll while swiping horizontally
      e.preventDefault();

      if (!state.dragging && absDx > DEAD_ZONE) {
        state.dragging = true;
        setIsDragging(true);
      }

      if (absDx <= DEAD_ZONE) {
        setOffsetX(0);
        return;
      }

      // Resistance past confirm zone gives piano-key snap feel
      const sign = dx > 0 ? 1 : -1;
      const activeDist = absDx - DEAD_ZONE;
      const confirmDist = CONFIRM_ZONE - DEAD_ZONE;
      let mapped: number;
      if (activeDist <= confirmDist) {
        mapped = activeDist;
      } else {
        mapped = confirmDist + (activeDist - confirmDist) * 0.3;
      }
      setOffsetX(sign * Math.min(mapped, MAX_DRAG));
    };

    const onTouchEnd = () => {
      const state = touchStateRef.current;
      if (!state) return;

      // Read current offset from the latest state
      setOffsetX((currentOffset) => {
        const absOff = Math.abs(currentOffset);
        const confirmDist = CONFIRM_ZONE - DEAD_ZONE;

        if (absOff >= confirmDist) {
          if (currentOffset < 0) {
            // Swiped LEFT → assign to me (or unassign if already mine)
            onAssign(
              itemId,
              assignedTo === currentUserId ? null : currentUserId,
            );
          } else if (currentOffset > 0 && partnerId) {
            // Swiped RIGHT → assign to partner (or unassign if already theirs)
            onAssign(itemId, assignedTo === partnerId ? null : partnerId);
          }
        }
        return 0; // Always reset
      });

      setIsDragging(false);
      touchStateRef.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [partnerId, assignedTo, currentUserId, itemId, onAssign]);

  const absOffset = Math.abs(offsetX);
  const confirmedThreshold = CONFIRM_ZONE - DEAD_ZONE;
  const isConfirmed = absOffset >= confirmedThreshold;
  const previewOpacity = isDragging
    ? Math.min(absOffset / confirmedThreshold, 1)
    : 0;

  // Determine what the swipe will do (assign or unassign)
  const swipeLeftAction =
    assignedTo === currentUserId ? "unassign" : "assign-me";
  const swipeRightAction =
    assignedTo === partnerId ? "unassign" : "assign-partner";
  const currentAction = offsetX < 0 ? swipeLeftAction : swipeRightAction;

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl">
      {/* Left reveal (assign to me) - shown when swiping left */}
      {isDragging && offsetX < 0 && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end px-4 rounded-xl transition-colors z-0",
            isConfirmed
              ? currentAction === "unassign"
                ? "bg-white/10"
                : "bg-blue-500/30"
              : "bg-blue-500/10",
          )}
          style={{ width: `${absOffset + 16}px`, opacity: previewOpacity }}
        >
          <div className="flex items-center gap-1.5">
            <User
              className={cn(
                "w-4 h-4",
                isConfirmed
                  ? currentAction === "unassign"
                    ? "text-white/60"
                    : "text-blue-300"
                  : "text-blue-400/60",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                isConfirmed
                  ? currentAction === "unassign"
                    ? "text-white/60"
                    : "text-blue-300"
                  : "text-blue-400/60",
              )}
            >
              {currentAction === "unassign" ? "Unassign" : "Me"}
            </span>
          </div>
        </div>
      )}

      {/* Right reveal (assign to partner) - shown when swiping right */}
      {isDragging && offsetX > 0 && partnerId && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start px-4 rounded-xl transition-colors z-0",
            isConfirmed
              ? currentAction === "unassign"
                ? "bg-white/10"
                : "bg-pink-500/30"
              : "bg-pink-500/10",
          )}
          style={{ width: `${absOffset + 16}px`, opacity: previewOpacity }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                isConfirmed
                  ? currentAction === "unassign"
                    ? "text-white/60"
                    : "text-pink-300"
                  : "text-pink-400/60",
              )}
            >
              {currentAction === "unassign" ? "Unassign" : partnerName}
            </span>
            <UserCheck
              className={cn(
                "w-4 h-4",
                isConfirmed
                  ? currentAction === "unassign"
                    ? "text-white/60"
                    : "text-pink-300"
                  : "text-pink-400/60",
              )}
            />
          </div>
        </div>
      )}

      {/* The actual item content - slides horizontally */}
      <div
        ref={contentRef}
        className="relative z-10"
        style={{
          transform: isDragging ? `translateX(${offsetX}px)` : "translateX(0)",
          transition: isDragging ? "none" : "transform 0.25s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
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
    new Map(),
  );
  const [editingUrlFor, setEditingUrlFor] = useState<string | null>(null);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [editingQuantityFor, setEditingQuantityFor] = useState<string | null>(
    null,
  );
  const [quantityInputValue, setQuantityInputValue] = useState("");

  // Multi-link comparison sheet state
  const [comparisonSheetOpen, setComparisonSheetOpen] = useState(false);
  const [selectedItemForComparison, setSelectedItemForComparison] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Group management state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [groupMenuOpen, setGroupMenuOpen] = useState<string | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);

  const enableItemUrls = thread?.enable_item_urls ?? false;

  // Household members for swipe-to-assign
  const { data: householdData } = useHouseholdMembers();
  const partnerId = useMemo(() => {
    if (!householdData?.members) return null;
    const partner = householdData.members.find((m) => !m.isCurrentUser);
    return partner?.id ?? null;
  }, [householdData]);
  const partnerName = useMemo(() => {
    if (!householdData?.members) return "Partner";
    const partner = householdData.members.find((m) => !m.isCurrentUser);
    return partner?.displayName ?? "Partner";
  }, [householdData]);

  // Fetch shopping groups for this thread
  const { data: shoppingGroupsData } = useQuery<{ groups: ShoppingGroup[] }>({
    queryKey: ["shopping-groups", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/hub/shopping-groups?thread_id=${threadId}`);
      if (!res.ok) return { groups: [] };
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const shoppingGroups = shoppingGroupsData?.groups || [];

  // Parse messages into shopping items
  const items: ShoppingItem[] = messages
    .filter(
      (msg) =>
        msg.message_type === "text" &&
        msg.content &&
        !msg.deleted_at &&
        !msg.archived_at,
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
      hasLinks: !!(msg as any).has_links,
      source: msg.source || "user",
      sourceItemId: msg.source_item_id || null,
      mealPlanId: msg.meal_plan_id || null,
      shoppingGroupId: msg.shopping_group_id || null,
      assignedTo: msg.assigned_to || null,
    }))
    .sort((a, b) => {
      if (a.checked !== b.checked) {
        return a.checked ? 1 : -1;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const uncheckedItems = items.filter((item) => !item.checked);
  const checkedItemsList = items.filter((item) => item.checked);

  // Get unique meal plan IDs from items
  const mealPlanIds = useMemo(() => {
    const ids = new Set<string>();
    items.forEach((item) => {
      if (item.mealPlanId && !item.shoppingGroupId) ids.add(item.mealPlanId);
    });
    return Array.from(ids);
  }, [items]);

  // Fetch meal plan details for grouping headers
  const { data: mealPlans = [] } = useQuery<MealPlanWithRecipe[]>({
    queryKey: ["meal-plans-for-shopping", mealPlanIds],
    queryFn: async () => {
      if (mealPlanIds.length === 0) return [];
      const params = new URLSearchParams();
      mealPlanIds.forEach((id) => params.append("ids", id));
      const res = await fetch(`/api/meal-plans?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: mealPlanIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const mealPlanMap = useMemo(() => {
    const map = new Map<string, MealPlanWithRecipe>();
    mealPlans.forEach((mp) => map.set(mp.id, mp));
    return map;
  }, [mealPlans]);

  // Group unchecked items: custom groups > meal plan groups > ungrouped
  const uncheckedGrouped = useMemo(() => {
    const groups: ItemGroup[] = [];
    const byCustomGroup = new Map<string, ShoppingItem[]>();
    const byMealPlan = new Map<string, ShoppingItem[]>();
    const ungrouped: ShoppingItem[] = [];

    uncheckedItems.forEach((item) => {
      if (item.shoppingGroupId) {
        if (!byCustomGroup.has(item.shoppingGroupId)) {
          byCustomGroup.set(item.shoppingGroupId, []);
        }
        byCustomGroup.get(item.shoppingGroupId)!.push(item);
      } else if (item.mealPlanId) {
        if (!byMealPlan.has(item.mealPlanId)) {
          byMealPlan.set(item.mealPlanId, []);
        }
        byMealPlan.get(item.mealPlanId)!.push(item);
      } else {
        ungrouped.push(item);
      }
    });

    // Custom groups first (in sort_order)
    shoppingGroups.forEach((sg) => {
      groups.push({
        key: sg.id,
        type: "custom",
        name: sg.name,
        groupId: sg.id,
        mealPlanId: null,
        plannedDate: null,
        items: byCustomGroup.get(sg.id) || [],
        isCollapsed: collapsedGroups.has(sg.id),
      });
    });

    // Then meal plan groups
    byMealPlan.forEach((groupItems, mealPlanId) => {
      const mp = mealPlanMap.get(mealPlanId);
      groups.push({
        key: `mp-${mealPlanId}`,
        type: "meal-plan",
        name: mp?.recipe?.name || "Unknown Recipe",
        groupId: null,
        mealPlanId,
        plannedDate: mp?.planned_date || null,
        items: groupItems,
        isCollapsed: collapsedGroups.has(`mp-${mealPlanId}`),
      });
    });

    // Ungrouped items last
    if (ungrouped.length > 0) {
      groups.push({
        key: "ungrouped",
        type: "ungrouped",
        name: "General",
        groupId: null,
        mealPlanId: null,
        plannedDate: null,
        items: ungrouped,
        isCollapsed: collapsedGroups.has("ungrouped"),
      });
    }

    return groups;
  }, [uncheckedItems, shoppingGroups, mealPlanMap, collapsedGroups]);

  // Close group menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        groupMenuRef.current &&
        !groupMenuRef.current.contains(e.target as Node)
      ) {
        setGroupMenuOpen(null);
      }
    };
    if (groupMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [groupMenuOpen]);

  // Toggle collapse for a group
  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  // Collapse all / Expand all
  const collapseAll = useCallback(() => {
    const allKeys = uncheckedGrouped.map((g) => g.key);
    setCollapsedGroups(new Set(allKeys));
  }, [uncheckedGrouped]);

  const expandAll = useCallback(() => {
    setCollapsedGroups(new Set());
  }, []);

  const allCollapsed =
    uncheckedGrouped.length > 0 &&
    uncheckedGrouped.every((g) => collapsedGroups.has(g.key));

  // Create a custom group
  const createGroup = useCallback(
    async (name: string) => {
      if (!name.trim()) return;

      try {
        const res = await fetch("/api/hub/shopping-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thread_id: threadId, name: name.trim() }),
        });

        if (!res.ok) throw new Error("Failed to create group");

        const data = await res.json();
        queryClient.invalidateQueries({
          queryKey: ["shopping-groups", threadId],
        });
        toast.success(`Group "${name.trim()}" created`, {
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              if (data?.group?.id) {
                await fetch("/api/hub/shopping-groups", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ group_id: data.group.id }),
                });
                queryClient.invalidateQueries({
                  queryKey: ["shopping-groups", threadId],
                });
              }
            },
          },
        });
      } catch {
        toast.error("Failed to create group");
      }
    },
    [threadId, queryClient],
  );

  // Rename a group
  const renameGroup = useCallback(
    async (groupId: string, newName: string) => {
      if (!newName.trim()) return;

      // Optimistic update
      queryClient.setQueryData<{ groups: ShoppingGroup[] }>(
        ["shopping-groups", threadId],
        (old) => {
          if (!old) return old;
          return {
            groups: old.groups.map((g) =>
              g.id === groupId ? { ...g, name: newName.trim() } : g,
            ),
          };
        },
      );

      try {
        const res = await fetch("/api/hub/shopping-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rename",
            group_id: groupId,
            name: newName.trim(),
          }),
        });

        if (!res.ok) throw new Error("Failed to rename group");
        toast.success("Group renamed");
      } catch {
        toast.error("Failed to rename group");
        queryClient.invalidateQueries({
          queryKey: ["shopping-groups", threadId],
        });
      }

      setEditingGroupId(null);
      setEditingGroupName("");
    },
    [threadId, queryClient],
  );

  // Delete a group (items become ungrouped)
  const deleteGroup = useCallback(
    async (groupId: string) => {
      const group = shoppingGroups.find((g) => g.id === groupId);
      const previousGroups = shoppingGroupsData;

      // Optimistic: remove group and ungroup items
      queryClient.setQueryData<{ groups: ShoppingGroup[] }>(
        ["shopping-groups", threadId],
        (old) => {
          if (!old) return old;
          return { groups: old.groups.filter((g) => g.id !== groupId) };
        },
      );
      queryClient.setQueryData<{ messages: HubMessage[] }>(
        ["hub", "messages", threadId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((msg) =>
              msg.shopping_group_id === groupId
                ? { ...msg, shopping_group_id: null }
                : msg,
            ),
          };
        },
      );

      try {
        const res = await fetch("/api/hub/shopping-groups", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_id: groupId }),
        });

        if (!res.ok) throw new Error("Failed to delete group");

        toast.success(`Group "${group?.name}" deleted`, {
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () => {
              // Rollback
              queryClient.setQueryData(
                ["shopping-groups", threadId],
                previousGroups,
              );
              queryClient.invalidateQueries({
                queryKey: ["shopping-groups", threadId],
              });
              queryClient.invalidateQueries({
                queryKey: ["hub", "messages", threadId],
              });
            },
          },
        });
      } catch {
        toast.error("Failed to delete group");
        queryClient.invalidateQueries({
          queryKey: ["shopping-groups", threadId],
        });
        queryClient.invalidateQueries({
          queryKey: ["hub", "messages", threadId],
        });
      }
    },
    [shoppingGroups, shoppingGroupsData, threadId, queryClient],
  );

  // Move an item to a different group
  const moveItemToGroup = useCallback(
    async (messageId: string, groupId: string | null) => {
      const queryKey = ["hub", "messages", threadId];

      // Optimistic update
      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((msg) =>
            msg.id === messageId ? { ...msg, shopping_group_id: groupId } : msg,
          ),
        };
      });

      setMovingItemId(null);

      try {
        const res = await fetch("/api/hub/shopping-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "move_item",
            message_id: messageId,
            group_id: groupId,
          }),
        });

        if (!res.ok) throw new Error("Failed to move item");

        const targetName = groupId
          ? shoppingGroups.find((g) => g.id === groupId)?.name || "group"
          : "General";
        toast.success(`Moved to ${targetName}`, {
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () => {
              queryClient.invalidateQueries({ queryKey });
            },
          },
        });
      } catch {
        toast.error("Failed to move item");
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [threadId, queryClient, shoppingGroups],
  );

  // Currently active group for adding items (null = ungrouped)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const handleAddItem = () => {
    if (!newItem.trim()) return;

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

    onAddItem(content, quantity, undefined, activeGroupId || undefined);
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

    // Paste detected

    // Detect if this looks like a list:
    // - Multiple lines (2 or more)
    // - OR has bullet points/numbers even if single line with bullets
    const hasMultipleLines = lines.length > 1;
    const hasListMarkers = lines.some(
      (line) =>
        /^[-•*●○■□▪▫★☆✓✗◆◇→⇒]/.test(line) || // Bullet points
        /^\d+[.)]/.test(line) || // Numbered lists like "1." or "1)"
        /^[a-zA-Z][.)]/.test(line), // Lettered lists like "a." or "a)"
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

      // Quantity pattern - matches things like "1 cup", "2 tablespoons", "¼ teaspoon", "1 large", etc.
      const quantityPattern =
        /^[\d¼½¾⅓⅔⅛⅜⅝⅞]+\s*(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|liter|liters|large|medium|small|pieces?|whole|cloves?|slices?|pinch|dash)?s?$/i;

      // Check if alternating lines follow ingredient/quantity pattern (even lines are quantities)
      const hasAlternatingPattern =
        lines.length >= 4 &&
        !quantityPattern.test(lines[0]) && // First line is NOT a quantity (ingredient)
        quantityPattern.test(lines[1]) && // Second line IS a quantity
        !quantityPattern.test(lines[2]) && // Third line is NOT a quantity (ingredient)
        quantityPattern.test(lines[3]); // Fourth line IS a quantity

      // Detection results computed

      // MOBILE FORMAT: Alternating lines with headers OR detected alternating pattern
      if ((firstLineIsHeader && secondLineIsHeader) || hasAlternatingPattern) {
        // Skip header rows if present
        const skipCount = firstLineIsHeader && secondLineIsHeader ? 2 : 0;
        const dataLines = lines.slice(skipCount);

        // Parsing mobile alternating-lines format

        // Parse in pairs: [ingredient, quantity, ingredient, quantity, ...]
        for (let i = 0; i < dataLines.length; i += 2) {
          const ingredient = dataLines[i];
          const quantity = dataLines[i + 1]; // Next line is quantity

          if (ingredient && !quantityPattern.test(ingredient)) {
            // item parsed
            items.push({
              content: ingredient.trim(),
              quantity: quantity ? quantity.trim() : undefined,
            });
          }
        }
      }
      // DESKTOP FORMAT: Tab-separated with optional header row
      else if (lines.some((line) => line.includes("\t"))) {
        // Parsing desktop tab-separated format

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

        // parsed tab-separated items
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
          onAddItem(content, quantity, undefined, activeGroupId || undefined);
        });

        // Clear the input
        setNewItem("");

        // Show success message
        toast.success(
          `Added ${items.length} item${items.length > 1 ? "s" : ""} to list`,
        );
      }
    }
    // If it's not a list (single line, no markers), let the default paste behavior happen
  };

  // Retry helper for failed operations
  const retryWithBackoff = useCallback(
    async (
      operation: () => Promise<Response>,
      maxRetries = 3,
      onError?: () => void,
    ): Promise<boolean> => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const res = await operation();
          if (res.ok) return true;

          // Don't retry on client errors (4xx) except 429 (rate limit)
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            onError?.();
            return false;
          }

          // Server error or rate limit - retry
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
            await new Promise((r) => setTimeout(r, delay));
          }
        } catch (error) {
          // Network error - retry
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }

      // All retries failed
      onError?.();
      return false;
    },
    [],
  );

  // Toggle check state via API with instant optimistic UI and retry logic
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
        queryKey,
      );
      const currentMessage = currentData?.messages.find((m) => m.id === itemId);
      const shouldCheck = !currentMessage?.checked_at;
      const previousCheckedAt = currentMessage?.checked_at;
      const previousCheckedBy = currentMessage?.checked_by;

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
              : msg,
          ),
        };
      });

      // Rollback function
      const rollback = () => {
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
                      checked_at: previousCheckedAt,
                      checked_by: previousCheckedBy,
                    }
                  : msg,
              ),
            };
          },
        );
        toast.error("Failed to update item. Please try again.", {
          duration: 2000,
        });
      };

      // Perform the API call with retry logic
      const success = await retryWithBackoff(
        () =>
          fetch("/api/hub/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "toggle_check",
              message_id: itemId,
            }),
          }),
        3,
        rollback,
      );

      // Clear pending toggle after completion
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

      return success;
    },
    [queryClient, threadId, currentUserId],
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
            msg.id === itemId ? { ...msg, item_quantity: quantity } : msg,
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
    [queryClient, threadId],
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
                msg.id === itemId ? { ...msg, item_url: url } : msg,
              ),
            };
          },
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
    [queryClient, threadId],
  );

  // Assign item to a household member via swipe
  const assignItem = useCallback(
    async (itemId: string, userId: string | null) => {
      const queryKey = ["hub", "messages", threadId];

      // Get previous state for undo
      const previousData = queryClient.getQueryData<{ messages: HubMessage[] }>(
        queryKey,
      );
      const previousMsg = previousData?.messages.find((m) => m.id === itemId);
      const previousAssignedTo = previousMsg?.assigned_to ?? null;

      // Skip if already assigned to same user
      if (previousAssignedTo === userId) return;

      // Optimistic update
      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((msg) =>
            msg.id === itemId ? { ...msg, assigned_to: userId } : msg,
          ),
        };
      });

      const assigneeName = userId === currentUserId ? "you" : partnerName;
      toast.success(userId ? `Assigned to ${assigneeName}` : "Unassigned", {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => assignItem(itemId, previousAssignedTo),
        },
      });

      try {
        const res = await fetch("/api/hub/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "assign_item",
            message_id: itemId,
            assigned_to: userId,
          }),
        });

        if (!res.ok) throw new Error("Failed to assign item");
      } catch (error) {
        console.error("Error assigning item:", error);
        toast.error("Failed to assign item");
        queryClient.setQueryData(queryKey, previousData);
      }
    },
    [queryClient, threadId, currentUserId, partnerName],
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

  // Open comparison sheet for an item
  const openComparisonSheet = (itemId: string, itemName: string) => {
    setSelectedItemForComparison({ id: itemId, name: itemName });
    setComparisonSheetOpen(true);
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

  // Helper to render a single shopping item with swipe-to-assign
  const renderShoppingItem = (item: ShoppingItem) => {
    const isAssignedToMe = item.assignedTo === currentUserId;
    const isAssignedToPartner = item.assignedTo === partnerId;

    // Border color based on assignment
    const assignmentBorderClass = isAssignedToMe
      ? "border-2 border-blue-400/60 ring-1 ring-blue-400/20"
      : isAssignedToPartner
        ? "border-2 border-pink-400/60 ring-1 ring-pink-400/20"
        : "";

    return (
      <SwipeToAssign
        key={item.id}
        itemId={item.id}
        currentUserId={currentUserId}
        partnerId={partnerId}
        partnerName={partnerName}
        assignedTo={item.assignedTo}
        onAssign={assignItem}
      >
        <div
          className={cn(
            "group relative neo-card bg-bg-card-custom rounded-xl overflow-hidden transition-all",
            movingItemId === item.id
              ? "border-2 border-purple-500/50 ring-1 ring-purple-500/20"
              : assignmentBorderClass
                ? assignmentBorderClass
                : item.source === "inventory"
                  ? "border-2 border-orange-500/40 ring-1 ring-orange-500/20"
                  : "border border-white/5 hover:border-white/10",
          )}
        >
          <div className="flex items-center gap-3 p-3">
            {item.source === "inventory" && (
              <div className="absolute top-0 right-0 px-1.5 py-0.5 bg-orange-500/20 rounded-bl-lg">
                <span className="text-[10px] text-orange-400 font-medium">
                  📦 Auto
                </span>
              </div>
            )}

            <button
              onClick={() => toggleCheck(item.id)}
              className={cn(
                "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0",
                isAssignedToMe
                  ? "border-blue-400/60 hover:border-blue-400"
                  : isAssignedToPartner
                    ? "border-pink-400/60 hover:border-pink-400"
                    : "border-white/30 hover:border-white/50",
              )}
            />

            {/* Assignment badge */}
            {item.assignedTo && (
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold",
                  isAssignedToMe
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-pink-500/20 text-pink-400",
                )}
                title={
                  isAssignedToMe
                    ? "Assigned to you"
                    : `Assigned to ${partnerName}`
                }
              >
                {isAssignedToMe ? (
                  <User className="w-3 h-3" />
                ) : (
                  <UserCheck className="w-3 h-3" />
                )}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm truncate">
                  {item.content}
                </span>

                {editingQuantityFor === item.id ? (
                  <input
                    type="text"
                    value={quantityInputValue}
                    onChange={(e) => setQuantityInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const trimmedQuantity = quantityInputValue.trim();
                        setItemQuantity(item.id, trimmedQuantity || null);
                        setEditingQuantityFor(null);
                        setQuantityInputValue("");
                      } else if (e.key === "Escape") {
                        setEditingQuantityFor(null);
                        setQuantityInputValue("");
                      }
                    }}
                    onBlur={() => {
                      const trimmedQuantity = quantityInputValue.trim();
                      setItemQuantity(item.id, trimmedQuantity || null);
                      setEditingQuantityFor(null);
                      setQuantityInputValue("");
                    }}
                    placeholder="e.g., 2 bags"
                    className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-400/50 focus:outline-none focus:border-blue-400 w-24 flex-shrink-0"
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
                    className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-all flex-shrink-0"
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

            <div className="flex items-center gap-1">
              {enableItemUrls && (
                <button
                  onClick={() => openComparisonSheet(item.id, item.content)}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    item.hasLinks
                      ? "text-purple-400 hover:bg-purple-500/20"
                      : "text-white/40 hover:bg-white/10 hover:text-white",
                  )}
                  title={item.hasLinks ? "Compare stores" : "Add store links"}
                >
                  <Layers className="w-4 h-4" />
                </button>
              )}

              {enableItemUrls && (
                <button
                  onClick={() => handleStartEditUrl(item.id, item.itemUrl)}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    item.itemUrl
                      ? "text-blue-400 hover:bg-blue-500/20"
                      : "text-white/40 hover:bg-white/10 hover:text-white",
                  )}
                  title={item.itemUrl ? "Edit quick link" : "Add quick link"}
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
              )}

              {/* Move to group button - only show when custom groups exist */}
              {shoppingGroups.length > 0 && (
                <button
                  onClick={() =>
                    setMovingItemId(movingItemId === item.id ? null : item.id)
                  }
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    movingItemId === item.id
                      ? "text-purple-400 bg-purple-500/20"
                      : "text-white/30 hover:bg-white/10 hover:text-white/60",
                  )}
                  title="Move to group"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => onDeleteItem(item.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Move to group selector */}
          {movingItemId === item.id && (
            <div className="px-3 pb-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => moveItemToGroup(item.id, null)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                  !item.shoppingGroupId
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10",
                )}
              >
                General
              </button>
              {shoppingGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => moveItemToGroup(item.id, g.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                    item.shoppingGroupId === g.id
                      ? "bg-purple-500/30 text-purple-300"
                      : "bg-white/5 text-white/60 hover:bg-purple-500/20 hover:text-purple-300",
                  )}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

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
      </SwipeToAssign>
    );
  };

  // Render a group header with inline actions
  const renderGroupHeader = (group: ItemGroup) => {
    const isEditing =
      group.groupId !== null && editingGroupId === group.groupId;

    return (
      <div className="flex items-center gap-1">
        {/* Collapse toggle + header */}
        <button
          onClick={() => toggleGroupCollapse(group.key)}
          className={cn(
            "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
            group.type === "custom"
              ? "bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20"
              : group.type === "meal-plan"
                ? "bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20"
                : "bg-white/5 hover:bg-white/10 border border-white/10",
          )}
        >
          {group.isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-white/50 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/50 flex-shrink-0" />
          )}
          {group.type === "meal-plan" ? (
            <UtensilsCrossed className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : group.type === "custom" ? (
            <FolderOpen className="w-4 h-4 text-purple-400 flex-shrink-0" />
          ) : (
            <List className="w-4 h-4 text-white/50 flex-shrink-0" />
          )}

          {isEditing ? (
            <input
              type="text"
              value={editingGroupName}
              onChange={(e) => setEditingGroupName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && group.groupId) {
                  renameGroup(group.groupId, editingGroupName);
                } else if (e.key === "Escape") {
                  setEditingGroupId(null);
                  setEditingGroupName("");
                }
              }}
              onBlur={() => {
                if (group.groupId && editingGroupName.trim()) {
                  renameGroup(group.groupId, editingGroupName);
                } else {
                  setEditingGroupId(null);
                  setEditingGroupName("");
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 px-1.5 py-0.5 text-sm font-medium bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:border-purple-400"
              autoFocus
            />
          ) : (
            <span
              className={cn(
                "text-sm font-medium flex-1 text-left truncate",
                group.type === "custom"
                  ? "text-purple-300"
                  : group.type === "meal-plan"
                    ? "text-emerald-300"
                    : "text-white/70",
              )}
            >
              {group.name}
            </span>
          )}

          {group.plannedDate && (
            <span className="text-xs text-white/40 flex-shrink-0">
              {new Date(group.plannedDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full flex-shrink-0">
            {group.items.length}
          </span>
        </button>

        {/* Group actions - only for custom groups */}
        {group.type === "custom" && group.groupId && !isEditing && (
          <div
            className="relative"
            ref={groupMenuOpen === group.groupId ? groupMenuRef : undefined}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setGroupMenuOpen(
                  groupMenuOpen === group.groupId ? null : group.groupId,
                );
              }}
              className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-all"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {groupMenuOpen === group.groupId && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                <button
                  onClick={() => {
                    setEditingGroupId(group.groupId);
                    setEditingGroupName(group.name);
                    setGroupMenuOpen(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Rename
                </button>
                <button
                  onClick={() => {
                    setGroupMenuOpen(null);
                    if (group.groupId) deleteGroup(group.groupId);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
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

        {/* Active group indicator + group selector */}
        {shoppingGroups.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              Add to:
            </span>
            <button
              onClick={() => setActiveGroupId(null)}
              className={cn(
                "px-2 py-0.5 rounded-md text-xs transition-all",
                activeGroupId === null
                  ? "bg-white/15 text-white font-medium"
                  : "bg-white/5 text-white/50 hover:bg-white/10",
              )}
            >
              General
            </button>
            {shoppingGroups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroupId(g.id)}
                className={cn(
                  "px-2 py-0.5 rounded-md text-xs transition-all",
                  activeGroupId === g.id
                    ? "bg-purple-500/30 text-purple-300 font-medium"
                    : "bg-white/5 text-white/50 hover:bg-purple-500/10",
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Shopping List - Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
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
            {/* Toolbar: Collapse All/Expand All + Add Group */}
            {(uncheckedGrouped.length > 1 ||
              shoppingGroups.length > 0 ||
              uncheckedItems.length > 0) && (
              <div className="flex items-center justify-between pt-3 pb-1">
                <div className="flex items-center gap-2">
                  {uncheckedGrouped.length > 1 && (
                    <button
                      onClick={allCollapsed ? expandAll : collapseAll}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
                    >
                      {allCollapsed ? (
                        <>
                          <ChevronsUpDown className="w-3.5 h-3.5" />
                          Expand all
                        </>
                      ) : (
                        <>
                          <ChevronsDownUp className="w-3.5 h-3.5" />
                          Collapse all
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Create group inline */}
                {isCreatingGroup ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          createGroup(newGroupName);
                          setNewGroupName("");
                          setIsCreatingGroup(false);
                        } else if (e.key === "Escape") {
                          setIsCreatingGroup(false);
                          setNewGroupName("");
                        }
                      }}
                      placeholder="Group name..."
                      className="px-2.5 py-1 text-xs rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 w-32"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        createGroup(newGroupName);
                        setNewGroupName("");
                        setIsCreatingGroup(false);
                      }}
                      disabled={!newGroupName.trim()}
                      className="p-1 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-30 transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setIsCreatingGroup(false);
                        setNewGroupName("");
                      }}
                      className="p-1 rounded-lg hover:bg-white/10 text-white/40 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCreatingGroup(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-purple-400 hover:bg-purple-500/10 transition-all"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    New group
                  </button>
                )}
              </div>
            )}

            {/* Unchecked Items - Grouped */}
            <div className="py-2 space-y-4">
              {uncheckedItems.length === 0 &&
              checkedItemsList.length === 0 &&
              shoppingGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <span className="text-5xl mb-3">🛒</span>
                  <p className="text-sm text-white/50">
                    Your shopping list is empty
                  </p>
                  <p className="text-xs text-white/30 mt-1">
                    Add items above to get started
                  </p>
                </div>
              ) : uncheckedItems.length === 0 && shoppingGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="w-14 h-14 text-emerald-400/40 mb-2" />
                  <p className="text-sm text-white/50">All items checked!</p>
                  <p className="text-xs text-white/30 mt-1">
                    Tap &quot;Clear completed&quot; when done shopping
                  </p>
                </div>
              ) : (
                uncheckedGrouped.map((group) => (
                  <div key={group.key} className="space-y-2">
                    {/* Only show group header if there are multiple groups or items in this group */}
                    {(uncheckedGrouped.length > 1 || group.type === "custom") &&
                      renderGroupHeader(group)}

                    {/* Group Items */}
                    {!group.isCollapsed && (
                      <div
                        className={cn(
                          "space-y-2",
                          (uncheckedGrouped.length > 1 ||
                            group.type === "custom") &&
                            "ml-2",
                        )}
                      >
                        {group.items.map((item) => renderShoppingItem(item))}
                        {group.type === "custom" &&
                          group.items.length === 0 && (
                            <p className="text-xs text-white/25 text-center py-3 italic">
                              No items in this group
                            </p>
                          )}
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
                        : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
                    )}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {isClearing ? "Clearing..." : "Clear completed"}
                  </button>
                </div>

                <div className="space-y-2">
                  {checkedItemsList.map((item) => {
                    const checkedAssignedToMe =
                      item.assignedTo === currentUserId;
                    const checkedAssignedToPartner =
                      item.assignedTo === partnerId;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "group flex items-center gap-3 p-3 rounded-xl bg-white/5 opacity-60",
                          checkedAssignedToMe
                            ? "border-2 border-blue-400/30"
                            : checkedAssignedToPartner
                              ? "border-2 border-pink-400/30"
                              : "border border-white/5",
                        )}
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
                                      trimmedQuantity || null,
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
                                    trimmedQuantity || null,
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
                                className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300/40 text-xs font-medium hover:bg-blue-500/20 transition-all"
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
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Product Comparison Sheet */}
      {selectedItemForComparison && (
        <ProductComparisonSheet
          isOpen={comparisonSheetOpen}
          onClose={() => {
            setComparisonSheetOpen(false);
            setSelectedItemForComparison(null);
          }}
          messageId={selectedItemForComparison.id}
          itemName={selectedItemForComparison.name}
        />
      )}
    </div>
  );
}

// ShoppingListView.tsx — Shopping purpose thread view with drag reorder, autocomplete,
// realtime sync, batch check, virtualizer, and smart categorisation.
"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { HubChatThread, HubMessage } from "@/features/hub/hooks";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { useOfflinePendingStore } from "@/lib/stores/offlinePendingStore";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { MealPlanWithRecipe } from "@/types/recipe";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Archive,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Layers,
  Link as LinkIcon,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Square,
  Trash2,
  User,
  UserCheck,
  Users2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ProductComparisonSheet } from "./ProductComparisonSheet";

// ─────────────────────────────────────────────────────
// Theme-based identity colors (Rule #17: me=my theme, partner=other theme)
// ─────────────────────────────────────────────────────
type IdentityColor = "blue" | "pink";
const IDENTITY_COLORS = {
  blue: {
    accent: "bg-blue-400",
    bg: "bg-blue-500/20",
    bgLight: "bg-blue-500/8",
    text: "text-blue-400",
    textLight: "text-blue-300",
  },
  pink: {
    accent: "bg-pink-400",
    bg: "bg-pink-500/20",
    bgLight: "bg-pink-500/8",
    text: "text-pink-400",
    textLight: "text-pink-300",
  },
} as const;

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

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
  sortOrder: number | null;
}

interface ItemGroup {
  key: string;
  type: "custom" | "meal-plan" | "ungrouped";
  name: string;
  groupId: string | null;
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
    sortOrder?: number,
  ) => void;
  onDeleteItem: (messageId: string) => void;
  isLoading?: boolean;
}

// Flat row types for the virtualizer
type VirtualRowDef =
  | { type: "toolbar" }
  | { type: "group-header"; group: ItemGroup; groupIndex: number }
  | { type: "item"; item: ShoppingItem; group: ItemGroup }
  | { type: "empty-group"; group: ItemGroup }
  | { type: "completed-header" }
  | { type: "completed-item"; item: ShoppingItem }
  | { type: "empty-state"; variant: "full" | "checked-only" };

// ─────────────────────────────────────────────────────
// Smart Categorisation Keywords (Point 6)
// ─────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Dairy: [
    "milk",
    "cream",
    "butter",
    "cheese",
    "yogurt",
    "yoghurt",
    "sour cream",
    "kefir",
    "cheddar",
    "mozzarella",
    "parmesan",
    "brie",
    "feta",
  ],
  Meat: [
    "chicken",
    "beef",
    "pork",
    "lamb",
    "turkey",
    "veal",
    "salmon",
    "tuna",
    "shrimp",
    "prawns",
    "steak",
    "mince",
    "minced",
    "sausage",
    "bacon",
    "ham",
    "fish",
    "tilapia",
    "cod",
    "haddock",
  ],
  Produce: [
    "apple",
    "banana",
    "orange",
    "lettuce",
    "tomato",
    "potato",
    "onion",
    "garlic",
    "carrot",
    "spinach",
    "broccoli",
    "cucumber",
    "avocado",
    "lemon",
    "lime",
    "pepper",
    "zucchini",
    "mushroom",
    "celery",
    "kale",
    "arugula",
    "cabbage",
    "cauliflower",
    "asparagus",
    "herbs",
  ],
  Bakery: [
    "bread",
    "baguette",
    "croissant",
    "muffin",
    "bagel",
    "pita",
    "tortilla",
    "wrap",
    "roll",
    "bun",
    "cake",
    "pastry",
    "loaf",
  ],
  Beverages: [
    "juice",
    "water",
    "soda",
    "coffee",
    "tea",
    "wine",
    "beer",
    "cola",
    "drink",
    "sparkling",
    "lemonade",
    "kombucha",
    "smoothie",
  ],
  "Canned Goods": [
    "canned",
    "chickpeas",
    "lentils",
    "beans",
    "corn",
    "sardines",
    "tomato paste",
    "coconut milk",
    "broth",
    "stock",
  ],
  Snacks: [
    "chips",
    "crackers",
    "nuts",
    "popcorn",
    "chocolate",
    "candy",
    "cookies",
    "biscuits",
    "granola",
    "pretzels",
    "trail mix",
  ],
  Frozen: ["frozen", "ice cream", "sorbet"],
  Condiments: [
    "ketchup",
    "mustard",
    "mayo",
    "mayonnaise",
    "sauce",
    "dressing",
    "vinegar",
    "soy sauce",
    "hot sauce",
    "olive oil",
    "oil",
  ],
  Grains: [
    "rice",
    "pasta",
    "flour",
    "cereal",
    "oats",
    "quinoa",
    "couscous",
    "noodles",
    "barley",
    "bulgur",
    "semolina",
  ],
};

function getSuggestedGroup(
  content: string,
  groups: ShoppingGroup[],
): { groupId: string; groupName: string } | null {
  const lower = content.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      const match = groups.find(
        (g) =>
          g.name.toLowerCase().includes(cat.toLowerCase()) ||
          cat.toLowerCase().includes(g.name.toLowerCase()),
      );
      if (match) return { groupId: match.id, groupName: match.name };
    }
  }
  return null;
}

// Extended quantity units for parsing (Point 5)
const UNIT_PATTERN =
  "bags?|bottles?|lbs?|pounds?|kg|grams?|g|oz|ounces?|ml|L|liters?|litres?|pieces?|pcs|pc|packs?|boxes?|cans?|jars?|units?|items?|rolls?|sheets?|pairs?|sets?|loaves?|slices?|cups?|tbsp|tsp|tablespoons?|teaspoons?|cloves?|stalks?|bunches?|heads?|sprigs?";

// ─────────────────────────────────────────────────────
// SwipeToAssign Component (horizontal swipe for assignment)
// ─────────────────────────────────────────────────────

interface SwipeToAssignProps {
  itemId: string;
  currentUserId: string;
  partnerId: string | null;
  partnerName: string;
  assignedTo: string | null;
  onAssign: (itemId: string, userId: string | null) => void;
  myColor: IdentityColor;
  partnerColor: IdentityColor;
  children: React.ReactNode;
}

const SwipeToAssign = ({
  itemId,
  currentUserId,
  partnerId,
  partnerName,
  assignedTo,
  onAssign,
  myColor,
  partnerColor,
  children,
}: SwipeToAssignProps) => {
  const myColors = IDENTITY_COLORS[myColor];
  const partnerColors = IDENTITY_COLORS[partnerColor];
  const outerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [currentAction, setCurrentAction] = useState<
    "assign-me" | "assign-partner" | "unassign" | null
  >(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isScrolling = useRef<boolean | null>(null);

  const DEAD_ZONE = 20;
  const CONFIRM_THRESHOLD = 70;

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      // Skip if touch starts on a drag handle (dnd-kit drag)
      if ((e.target as HTMLElement).closest("[data-drag-handle]")) return;
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isScrolling.current = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches.length) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;

      if (isScrolling.current === null) {
        isScrolling.current = Math.abs(dy) > Math.abs(dx);
      }
      if (isScrolling.current) return;

      if (Math.abs(dx) < DEAD_ZONE) return;

      e.preventDefault();
      setIsDragging(true);

      const resistance = Math.abs(dx) > CONFIRM_THRESHOLD ? 0.3 : 1;
      const clampedOffset = Math.max(-150, Math.min(150, dx * resistance));
      setOffsetX(clampedOffset);

      const confirmed = Math.abs(dx) >= CONFIRM_THRESHOLD;
      setIsConfirmed(confirmed);

      if (dx < 0) {
        // Left swipe → assign to me
        const action = assignedTo === currentUserId ? "unassign" : "assign-me";
        setCurrentAction(action);
      } else {
        // Right swipe → assign to partner
        if (!partnerId) return;
        const action = assignedTo === partnerId ? "unassign" : "assign-partner";
        setCurrentAction(action);
      }
    };

    const onTouchEnd = () => {
      if (!isDragging) {
        setOffsetX(0);
        setCurrentAction(null);
        setIsConfirmed(false);
        return;
      }

      if (isConfirmed && currentAction) {
        if (currentAction === "assign-me") onAssign(itemId, currentUserId);
        else if (currentAction === "assign-partner" && partnerId)
          onAssign(itemId, partnerId);
        else if (currentAction === "unassign") onAssign(itemId, null);
      }

      setOffsetX(0);
      setIsDragging(false);
      setCurrentAction(null);
      setIsConfirmed(false);
      isScrolling.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [
    itemId,
    currentUserId,
    partnerId,
    assignedTo,
    onAssign,
    isDragging,
    isConfirmed,
    currentAction,
  ]);

  const isActive = isDragging || offsetX !== 0;

  return (
    <div ref={outerRef} className="relative overflow-hidden rounded-xl">
      {/* Right reveal (left swipe → assign to me) */}
      {isActive && offsetX < 0 && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end pr-3 rounded-xl transition-colors z-0",
            isConfirmed
              ? currentAction === "unassign"
                ? "bg-red-500/20"
                : myColors.bg
              : myColors.bgLight,
          )}
          style={{ width: `${Math.abs(offsetX) + 16}px` }}
        >
          {isConfirmed && (
            <span className={cn("text-[10px] font-medium", currentAction === "unassign" ? "text-red-400" : myColors.text)}>
              {currentAction === "unassign" ? "✕" : "Me"}
            </span>
          )}
        </div>
      )}

      {/* Left reveal (right swipe → assign to partner) */}
      {isActive && offsetX > 0 && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start pl-3 rounded-xl transition-colors z-0",
            isConfirmed
              ? currentAction === "unassign"
                ? "bg-red-500/20"
                : partnerColors.bg
              : partnerColors.bgLight,
          )}
          style={{ width: `${Math.abs(offsetX) + 16}px` }}
        >
          {isConfirmed && (
            <span className={cn("text-[10px] font-medium", currentAction === "unassign" ? "text-red-400" : partnerColors.text)}>
              {currentAction === "unassign" ? "✕" : partnerName.split(" ")[0]}
            </span>
          )}
        </div>
      )}

      {/* Draggable content */}
      <div
        ref={contentRef}
        className="relative z-10"
        style={{
          transform: isDragging ? `translateX(${offsetX}px)` : "translateX(0)",
          transition: isDragging ? "none" : "transform 0.2s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────
// SortableItemWrapper — thin dnd-kit sortable wrapper for items
// ─────────────────────────────────────────────────────

function SortableItemWrapper({
  id,
  children,
}: {
  id: string;
  children: (props: {
    listeners: Record<string, unknown> | undefined;
    attributes: Record<string, unknown>;
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 20 : "auto",
        position: "relative",
      }}
    >
      {children({
        listeners: listeners as Record<string, unknown> | undefined,
        attributes: attributes as unknown as Record<string, unknown>,
        isDragging,
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// SortableGroupWrapper — thin dnd-kit sortable wrapper for groups
// ─────────────────────────────────────────────────────

function SortableGroupWrapper({
  id,
  children,
}: {
  id: string;
  children: (props: {
    listeners: Record<string, unknown> | undefined;
    attributes: Record<string, unknown>;
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { type: "group" } });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
    >
      {children({
        listeners: listeners as Record<string, unknown> | undefined,
        attributes: attributes as unknown as Record<string, unknown>,
        isDragging,
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Main ShoppingListView Component
// ─────────────────────────────────────────────────────

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
  const pendingCount = useOfflinePendingStore((s) => s.count);

  // ── Core state ──
  const [newItem, setNewItem] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [pendingToggles, setPendingToggles] = useState<Map<string, number>>(
    new Map(),
  );

  // ── URL / quantity editing ──
  const [editingUrlFor, setEditingUrlFor] = useState<string | null>(null);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [editingQuantityFor, setEditingQuantityFor] = useState<string | null>(
    null,
  );
  const [quantityInputValue, setQuantityInputValue] = useState("");

  // ── Comparison sheet ──
  const [comparisonSheetOpen, setComparisonSheetOpen] = useState(false);
  const [selectedItemForComparison, setSelectedItemForComparison] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // ── Group management ──
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

  // ── Active group for new items ──
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // ── Drag reorder state (Points 1 & 2) ──
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<"item" | "group" | null>(
    null,
  );
  // localItemOrders: groupKey → ordered item IDs (overrides DB order within session)
  const [localItemOrders, setLocalItemOrders] = useState<Map<string, string[]>>(
    new Map(),
  );
  // localGroupOrder: ordered group IDs (overrides DB order within session, null = server order)
  const [localGroupOrder, setLocalGroupOrder] = useState<string[] | null>(null);

  // ── Batch selection (Point 3) ──
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // ── Autocomplete (Point 4) ──
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Smart category suggestion (Point 6) ──
  const [categorySuggestion, setCategorySuggestion] = useState<{
    groupId: string;
    groupName: string;
  } | null>(null);

  // ── Partner presence + typing (Point 12) ──
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const partnerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<ReturnType<typeof supabaseBrowser>["channel"]> | null>(null);
  const typingBroadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Virtual list ref (Point 10) ──
  const listContainerRef = useRef<HTMLDivElement>(null);

  const enableItemUrls = thread?.enable_item_urls ?? false;

  // ── Theme-based identity colors ──
  // My theme determines my color; partner gets the other.
  // blue/frost/calm → me=blue, partner=pink. pink → me=pink, partner=blue.
  const { theme } = useTheme();
  const myColor: IdentityColor = theme === "pink" ? "pink" : "blue";
  const partnerColor: IdentityColor = myColor === "blue" ? "pink" : "blue";
  const myColors = IDENTITY_COLORS[myColor];
  const partnerColors = IDENTITY_COLORS[partnerColor];

  // ── Household members ──
  const { data: householdData } = useHouseholdMembers();
  const partnerId = useMemo(() => {
    if (!householdData?.members) return null;
    return householdData.members.find((m) => !m.isCurrentUser)?.id ?? null;
  }, [householdData]);
  const partnerName = useMemo(() => {
    if (!householdData?.members) return "Partner";
    return (
      householdData.members.find((m) => !m.isCurrentUser)?.displayName ??
      "Partner"
    );
  }, [householdData]);

  // ── Fetch shopping groups ──
  const { data: shoppingGroupsData } = useQuery<{ groups: ShoppingGroup[] }>({
    queryKey: ["shopping-groups", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/hub/shopping-groups?thread_id=${threadId}`);
      if (!res.ok) return { groups: [] };
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const rawShoppingGroups = shoppingGroupsData?.groups || [];

  // Apply local group order override
  const shoppingGroups = useMemo(() => {
    if (!localGroupOrder) return rawShoppingGroups;
    return [...rawShoppingGroups].sort(
      (a, b) =>
        (localGroupOrder.indexOf(a.id) ?? 9999) -
        (localGroupOrder.indexOf(b.id) ?? 9999),
    );
  }, [rawShoppingGroups, localGroupOrder]);

  // ── Autocomplete query (Point 4) ──
  const { data: autocompleteResults = [] } = useQuery<
    { id: string; name: string; unit?: string; price?: number }[]
  >({
    queryKey: ["catalogue-autocomplete", autocompleteQuery],
    queryFn: async () => {
      if (!autocompleteQuery.trim() || autocompleteQuery.length < 2) return [];
      const res = await fetch(
        `/api/catalogue/items?search=${encodeURIComponent(autocompleteQuery)}&limit=6`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data)
        ? data.map((d: Record<string, unknown>) => ({
            id: String(d.id ?? ""),
            name: String(d.name ?? ""),
            unit: d.unit ? String(d.unit) : undefined,
            price: typeof d.price === "number" ? d.price : undefined,
          }))
        : [];
    },
    enabled: autocompleteQuery.length >= 2,
    staleTime: 60 * 1000,
  });

  // Debounce autocomplete input (Point 4)
  useEffect(() => {
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (!newItem.trim() || newItem.length < 2) {
      setAutocompleteQuery("");
      setShowAutocomplete(false);
      return;
    }
    autocompleteTimer.current = setTimeout(() => {
      setAutocompleteQuery(newItem.trim());
      setShowAutocomplete(true);
    }, 300);
    return () => {
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    };
  }, [newItem]);

  // Hide autocomplete when results are empty
  useEffect(() => {
    if (autocompleteResults.length === 0) setShowAutocomplete(false);
    else if (autocompleteQuery.length >= 2) setShowAutocomplete(true);
  }, [autocompleteResults, autocompleteQuery]);

  // ── Presence tracking (partner online + typing indicator) ──
  // item-check-update and item-assign-update are handled by useRealtimeMessages in hooks.ts
  useEffect(() => {
    const channel = supabaseBrowser()
      .channel(`thread-presence-${threadId}`)
      .on("broadcast", { event: "typing-update" }, (payload) => {
        const { user_id } = payload.payload ?? {};
        if (!user_id || user_id === currentUserId) return;
        setPartnerTyping(true);
        if (partnerTypingTimer.current) clearTimeout(partnerTypingTimer.current);
        partnerTypingTimer.current = setTimeout(() => setPartnerTyping(false), 3000);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const others = Object.values(state)
          .flat()
          .filter((p: Record<string, unknown>) => p.user_id !== currentUserId);
        setPartnerOnline(others.length > 0);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      presenceChannelRef.current = null;
      if (partnerTypingTimer.current) clearTimeout(partnerTypingTimer.current);
      if (typingBroadcastTimer.current) clearTimeout(typingBroadcastTimer.current);
      supabaseBrowser().removeChannel(channel);
    };
  }, [threadId, currentUserId, queryClient]);

  // ── Parse messages into shopping items ──
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
      hasLinks: !!(msg as Record<string, unknown>).has_links,
      source: msg.source || "user",
      sourceItemId: msg.source_item_id || null,
      mealPlanId: msg.meal_plan_id || null,
      shoppingGroupId: msg.shopping_group_id || null,
      assignedTo: msg.assigned_to || null,
      sortOrder:
        ((msg as Record<string, unknown>).item_sort_order as number | null) ??
        null,
    }))
    .sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      // Point 1: use item_sort_order when available
      if (a.sortOrder !== null && b.sortOrder !== null)
        return a.sortOrder - b.sortOrder;
      if (a.sortOrder !== null) return -1;
      if (b.sortOrder !== null) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const uncheckedItems = items.filter((i) => !i.checked);
  const checkedItemsList = items.filter((i) => i.checked);

  // Meal plan IDs for grouping
  const mealPlanIds = useMemo(() => {
    const ids = new Set<string>();
    items.forEach((item) => {
      if (item.mealPlanId && !item.shoppingGroupId) ids.add(item.mealPlanId);
    });
    return Array.from(ids);
  }, [items]);

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

  // ── Group unchecked items ──
  const uncheckedGrouped = useMemo(() => {
    const groups: ItemGroup[] = [];
    const byCustomGroup = new Map<string, ShoppingItem[]>();
    const byMealPlan = new Map<string, ShoppingItem[]>();
    const ungrouped: ShoppingItem[] = [];

    uncheckedItems.forEach((item) => {
      if (item.shoppingGroupId) {
        if (!byCustomGroup.has(item.shoppingGroupId))
          byCustomGroup.set(item.shoppingGroupId, []);
        byCustomGroup.get(item.shoppingGroupId)!.push(item);
      } else if (item.mealPlanId) {
        if (!byMealPlan.has(item.mealPlanId))
          byMealPlan.set(item.mealPlanId, []);
        byMealPlan.get(item.mealPlanId)!.push(item);
      } else {
        ungrouped.push(item);
      }
    });

    shoppingGroups.forEach((sg) => {
      let groupItems = byCustomGroup.get(sg.id) || [];
      // Apply local item order override (Point 1)
      const localOrder = localItemOrders.get(sg.id);
      if (localOrder) {
        const orderMap = new Map(localOrder.map((id, idx) => [id, idx]));
        groupItems = [...groupItems].sort(
          (a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999),
        );
      }
      groups.push({
        key: sg.id,
        type: "custom",
        name: sg.name,
        groupId: sg.id,
        mealPlanId: null,
        plannedDate: null,
        items: groupItems,
        isCollapsed: collapsedGroups.has(sg.id),
      });
    });

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

    // Apply local order for ungrouped items
    const ungroupedKey = "ungrouped";
    let finalUngrouped = ungrouped;
    const localUngroupedOrder = localItemOrders.get(ungroupedKey);
    if (localUngroupedOrder) {
      const orderMap = new Map(localUngroupedOrder.map((id, idx) => [id, idx]));
      finalUngrouped = [...ungrouped].sort(
        (a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999),
      );
    }

    if (finalUngrouped.length > 0) {
      groups.push({
        key: ungroupedKey,
        type: "ungrouped",
        name: "General",
        groupId: null,
        mealPlanId: null,
        plannedDate: null,
        items: finalUngrouped,
        isCollapsed: collapsedGroups.has(ungroupedKey),
      });
    }

    return groups;
  }, [
    uncheckedItems,
    shoppingGroups,
    mealPlanMap,
    collapsedGroups,
    localItemOrders,
  ]);

  // ── Group menu outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        groupMenuRef.current &&
        !groupMenuRef.current.contains(e.target as Node)
      )
        setGroupMenuOpen(null);
    };
    if (groupMenuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [groupMenuOpen]);

  // ── Build flat virtual rows (Point 10) ──
  const virtualRows = useMemo((): VirtualRowDef[] => {
    const rows: VirtualRowDef[] = [];
    const showToolbar =
      uncheckedGrouped.length > 1 ||
      shoppingGroups.length > 0 ||
      uncheckedItems.length > 0;

    if (showToolbar) rows.push({ type: "toolbar" });

    if (
      uncheckedItems.length === 0 &&
      checkedItemsList.length === 0 &&
      shoppingGroups.length === 0
    ) {
      rows.push({ type: "empty-state", variant: "full" });
    } else if (uncheckedItems.length === 0 && shoppingGroups.length === 0) {
      rows.push({ type: "empty-state", variant: "checked-only" });
    } else {
      uncheckedGrouped.forEach((group, groupIndex) => {
        const showHeader =
          uncheckedGrouped.length > 1 || group.type === "custom";
        if (showHeader) rows.push({ type: "group-header", group, groupIndex });
        if (!group.isCollapsed) {
          if (group.items.length === 0 && group.type === "custom") {
            rows.push({ type: "empty-group", group });
          } else {
            group.items.forEach((item) =>
              rows.push({ type: "item", item, group }),
            );
          }
        }
      });
    }

    if (checkedItemsList.length > 0) {
      rows.push({ type: "completed-header" });
      checkedItemsList.forEach((item) =>
        rows.push({ type: "completed-item", item }),
      );
    }

    return rows;
  }, [uncheckedGrouped, checkedItemsList, shoppingGroups, uncheckedItems]);

  // ── Virtualizer (Point 10) ──
  // During active drag: overscan everything to ensure all items are rendered
  // (so dnd-kit collision detection can find off-screen items)
  const overscan = activeDragId ? virtualRows.length + 5 : 5;

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (!row) return 58;
      const sizes: Record<VirtualRowDef["type"], number> = {
        toolbar: 44,
        "group-header": 44,
        item: 58,
        "empty-group": 40,
        "completed-header": 60,
        "completed-item": 54,
        "empty-state": 180,
      };
      return sizes[row.type] ?? 58;
    },
    overscan,
  });

  // ── DnD sensors (Points 1 & 2) ──
  // PointerSensor: desktop drag (distance: 8px before activating)
  // TouchSensor: mobile (delay: 250ms — lets quick swipes go to SwipeToAssign)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // All group IDs for the groups SortableContext
  const groupSortableIds = useMemo(
    () => shoppingGroups.map((g) => g.id),
    [shoppingGroups],
  );

  // All unchecked item IDs per group for item SortableContexts
  const itemSortableIds = useMemo(() => {
    const map = new Map<string, string[]>();
    uncheckedGrouped.forEach((g) => {
      map.set(
        g.key,
        g.items.map((i) => i.id),
      );
    });
    return map;
  }, [uncheckedGrouped]);

  // ── Drag handlers (Points 1 & 2) ──
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      setActiveDragId(id);
      const isGroup = shoppingGroups.some((g) => g.id === id);
      setActiveDragType(isGroup ? "group" : "item");
    },
    [shoppingGroups],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      setActiveDragType(null);

      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);
      const isGroupDrag = shoppingGroups.some((g) => g.id === activeId);

      if (isGroupDrag) {
        // Reorder groups (Point 2)
        const currentOrder = localGroupOrder ?? shoppingGroups.map((g) => g.id);
        const oldIdx = currentOrder.indexOf(activeId);
        const newIdx = currentOrder.indexOf(overId);
        if (oldIdx === -1 || newIdx === -1) return;
        const newOrder = arrayMove(currentOrder, oldIdx, newIdx);
        setLocalGroupOrder(newOrder);

        // Persist via API
        const payload = newOrder.map((id, idx) => ({ id, sort_order: idx }));
        fetch("/api/hub/shopping-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reorder", groups: payload }),
        }).catch(() => {
          toast.error("Failed to save group order");
        });
      } else {
        // Reorder items within a group (Point 1)
        const group = uncheckedGrouped.find((g) =>
          g.items.some((i) => i.id === activeId),
        );
        if (!group) return;
        const overGroup = uncheckedGrouped.find((g) =>
          g.items.some((i) => i.id === overId),
        );
        if (!overGroup || group.key !== overGroup.key) return;

        const currentOrder =
          localItemOrders.get(group.key) ?? group.items.map((i) => i.id);
        const oldIdx = currentOrder.indexOf(activeId);
        const newIdx = currentOrder.indexOf(overId);
        if (oldIdx === -1 || newIdx === -1) return;
        const newOrder = arrayMove(currentOrder, oldIdx, newIdx);
        setLocalItemOrders((prev) => new Map(prev).set(group.key, newOrder));

        // Persist item_sort_order via API
        const payload = newOrder.map((id, idx) => ({
          id,
          item_sort_order: idx,
        }));
        fetch("/api/hub/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reorder_items", items: payload }),
        }).catch(() => {
          toast.error("Failed to save item order");
        });
      }
    },
    [shoppingGroups, localGroupOrder, uncheckedGrouped, localItemOrders],
  );

  // ── Collapse / Expand ──
  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedGroups(new Set(uncheckedGrouped.map((g) => g.key)));
  }, [uncheckedGrouped]);

  const expandAll = useCallback(() => setCollapsedGroups(new Set()), []);

  const allCollapsed =
    uncheckedGrouped.length > 0 &&
    uncheckedGrouped.every((g) => collapsedGroups.has(g.key));

  // ── Group CRUD ──
  const createGroup = useCallback(
    async (name: string) => {
      if (!name.trim()) return;
      try {
        const res = await fetch("/api/hub/shopping-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thread_id: threadId, name: name.trim() }),
        });
        if (!res.ok) throw new Error();
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

  const renameGroup = useCallback(
    async (groupId: string, newName: string) => {
      if (!newName.trim()) return;
      queryClient.setQueryData<{ groups: ShoppingGroup[] }>(
        ["shopping-groups", threadId],
        (old) =>
          old
            ? {
                groups: old.groups.map((g) =>
                  g.id === groupId ? { ...g, name: newName.trim() } : g,
                ),
              }
            : old,
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
        if (!res.ok) throw new Error();
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

  const deleteGroup = useCallback(
    async (groupId: string) => {
      const group = shoppingGroups.find((g) => g.id === groupId);
      const previousGroups = shoppingGroupsData;
      queryClient.setQueryData<{ groups: ShoppingGroup[] }>(
        ["shopping-groups", threadId],
        (old) =>
          old ? { groups: old.groups.filter((g) => g.id !== groupId) } : old,
      );
      queryClient.setQueryData<{ messages: HubMessage[] }>(
        ["hub", "messages", threadId],
        (old) =>
          old
            ? {
                ...old,
                messages: old.messages.map((msg) =>
                  msg.shopping_group_id === groupId
                    ? { ...msg, shopping_group_id: null }
                    : msg,
                ),
              }
            : old,
      );
      try {
        const res = await fetch("/api/hub/shopping-groups", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_id: groupId }),
        });
        if (!res.ok) throw new Error();
        toast.success(`Group "${group?.name}" deleted`, {
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () => {
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

  const moveItemToGroup = useCallback(
    async (messageId: string, groupId: string | null) => {
      const queryKey = ["hub", "messages", threadId];
      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) =>
        old
          ? {
              ...old,
              messages: old.messages.map((msg) =>
                msg.id === messageId
                  ? { ...msg, shopping_group_id: groupId }
                  : msg,
              ),
            }
          : old,
      );
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
        if (!res.ok) throw new Error();
        const targetName = groupId
          ? shoppingGroups.find((g) => g.id === groupId)?.name || "group"
          : "General";
        toast.success(`Moved to ${targetName}`, {
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () => queryClient.invalidateQueries({ queryKey }),
          },
        });
      } catch {
        toast.error("Failed to move item");
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [threadId, queryClient, shoppingGroups],
  );

  // ── Add item handler with extended quantity parsing + smart cat (Points 5 & 6) ──
  const handleAddItem = () => {
    if (!newItem.trim()) return;

    const input = newItem.trim();
    let content = input;
    let quantity: string | undefined;

    const unitRe = new RegExp(UNIT_PATTERN, "i");

    // Pattern: "2 bags pasta" / "2kg milk" / "500g flour"
    const qFirstRe = new RegExp(
      `^([\\d.]+\\s*(?:${UNIT_PATTERN})(?:\\s+of)?)\\s+(.+)$`,
      "i",
    );
    const m1 = input.match(qFirstRe);
    if (m1) {
      quantity = m1[1].trim();
      content = m1[2].trim();
    } else {
      // Pattern: "pasta 2 bags" / "milk 2kg"
      const qLastRe = new RegExp(
        `^(.+?)\\s*[-:]?\\s+([\\d.]+\\s*(?:${UNIT_PATTERN}))$`,
        "i",
      );
      const m2 = input.match(qLastRe);
      if (m2) {
        content = m2[1].trim();
        quantity = m2[2].trim();
      } else {
        // Pattern: "x2 milk" or "milk x2" or "2x milk"
        const xMultiplierRe = /^x?(\d+)x?\s+(.+)$/i;
        const m3 = input.match(xMultiplierRe);
        if (m3) {
          quantity = `x${m3[1]}`;
          content = m3[2].trim();
        } else {
          const xSuffixRe = /^(.+?)\s+x?(\d+)x?$/i;
          const m4 = input.match(xSuffixRe);
          if (m4 && !unitRe.test(m4[2])) {
            content = m4[1].trim();
            quantity = `x${m4[2]}`;
          }
        }
      }
    }

    // Point 6: Smart category suggestion
    if (shoppingGroups.length > 0 && !activeGroupId) {
      const suggestion = getSuggestedGroup(content, shoppingGroups);
      if (suggestion) {
        setCategorySuggestion(suggestion);
        // Auto-assign in 1.5s if user doesn't dismiss
        setTimeout(() => setCategorySuggestion(null), 4000);
      }
    }

    // Compute next sort order so the optimistic item stays stable in position
    const groupItems = uncheckedItems.filter(
      (i) => i.shoppingGroupId === (activeGroupId ?? null) && i.sortOrder !== null,
    );
    const maxOrder = groupItems.length > 0
      ? Math.max(...groupItems.map((i) => i.sortOrder!))
      : 0;
    const nextSortOrder = maxOrder + 1;

    // Optimistic add is handled by useSendMessage.onMutate — no duplicate needed here
    onAddItem(content, quantity, undefined, activeGroupId || undefined, nextSortOrder);
    setNewItem("");
    setShowAutocomplete(false);
    setCategorySuggestion(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddItem();
    }
  };

  // ── Paste handler (extended quantity pattern) ──
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text");
    const lines = pastedText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const hasMultipleLines = lines.length > 1;
    const hasListMarkers = lines.some(
      (l) =>
        /^[-•*●○■□▪▫★☆✓✗◆◇→⇒]/.test(l) ||
        /^\d+[.)]/.test(l) ||
        /^[a-zA-Z][.)]/.test(l),
    );

    if (!hasMultipleLines && !hasListMarkers) return;

    e.preventDefault();

    let parsedItems: Array<{ content: string; quantity?: string }> = [];

    const headerPattern = /^(ingredient|quantity|item|name|amount)s?$/i;
    const firstLineIsHeader = lines.length > 0 && headerPattern.test(lines[0]);
    const secondLineIsHeader = lines.length > 1 && headerPattern.test(lines[1]);
    const firstLineHasBothHeaders =
      lines.length > 0 &&
      /ingredient/i.test(lines[0]) &&
      /quantity/i.test(lines[0]);

    const qPattern = new RegExp(
      `^[\\d¼½¾⅓⅔⅛⅜⅝⅞x]+\\s*(${UNIT_PATTERN})?s?$`,
      "i",
    );

    const hasAlternatingPattern =
      lines.length >= 4 &&
      !qPattern.test(lines[0]) &&
      qPattern.test(lines[1]) &&
      !qPattern.test(lines[2]) &&
      qPattern.test(lines[3]);

    if ((firstLineIsHeader && secondLineIsHeader) || hasAlternatingPattern) {
      const skipCount = firstLineIsHeader && secondLineIsHeader ? 2 : 0;
      const dataLines = lines.slice(skipCount);
      for (let i = 0; i < dataLines.length; i += 2) {
        const ingredient = dataLines[i];
        const qty = dataLines[i + 1];
        if (ingredient && !qPattern.test(ingredient)) {
          parsedItems.push({
            content: ingredient.trim(),
            quantity: qty ? qty.trim() : undefined,
          });
        }
      }
    } else if (lines.some((l) => l.includes("\t"))) {
      const startIndex = firstLineHasBothHeaders ? 1 : 0;
      parsedItems = lines
        .slice(startIndex)
        .filter((l) => l.includes("\t"))
        .map((l) => {
          const parts = l.split("\t").map((p) => p.trim());
          return { content: parts[0], quantity: parts[1] };
        })
        .filter((i) => i.content.length > 0);
    } else {
      parsedItems = lines
        .map((l) => {
          let cleaned = l
            .replace(/^[-•*●○■□▪▫★☆✓✗◆◇→⇒]\s*/, "")
            .replace(/^\d+[.)]\s*/, "")
            .replace(/^[a-zA-Z][.)]\s*/, "")
            .trim();
          let content = cleaned;
          let quantity: string | undefined;
          if (cleaned.includes("\t")) {
            const parts = cleaned.split("\t").map((p) => p.trim());
            content = parts[0];
            quantity = parts[1];
          } else if (cleaned.includes("|")) {
            const parts = cleaned.split("|").map((p) => p.trim());
            content = parts[0];
            quantity = parts[1];
          }
          return { content, quantity };
        })
        .filter((i) => i.content.length > 0);
    }

    if (parsedItems.length > 0) {
      // Deduplicate against existing items (case-insensitive exact match)
      const existingContents = new Set(
        uncheckedItems.map((i) => i.content.toLowerCase().trim()),
      );
      const newItems = parsedItems.filter(
        ({ content }) => !existingContents.has(content.toLowerCase().trim()),
      );
      const skipped = parsedItems.length - newItems.length;

      // Compute sequential sort orders so pasted items stay in order
      const groupItems = uncheckedItems.filter(
        (i) => i.shoppingGroupId === (activeGroupId ?? null) && i.sortOrder !== null,
      );
      let baseOrder = groupItems.length > 0
        ? Math.max(...groupItems.map((i) => i.sortOrder!))
        : 0;

      newItems.forEach(({ content, quantity }) => {
        baseOrder += 1;
        onAddItem(content, quantity, undefined, activeGroupId || undefined, baseOrder);
      });

      setNewItem("");
      if (newItems.length > 0) {
        toast.success(
          `Added ${newItems.length} item${newItems.length > 1 ? "s" : ""}${skipped > 0 ? ` · ${skipped} duplicate${skipped > 1 ? "s" : ""} skipped` : ""}`,
        );
      } else {
        toast.info(`All ${skipped} item${skipped > 1 ? "s" : ""} already on the list`);
      }
    }
  };

  // ── Retry helper ──
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
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            onError?.();
            return false;
          }
          if (attempt < maxRetries)
            await new Promise((r) =>
              setTimeout(r, Math.min(1000 * 2 ** attempt, 5000)),
            );
        } catch {
          if (attempt < maxRetries)
            await new Promise((r) =>
              setTimeout(r, Math.min(1000 * 2 ** attempt, 5000)),
            );
        }
      }
      onError?.();
      return false;
    },
    [],
  );

  // ── Toggle check ──
  const toggleCheck = useCallback(
    async (itemId: string) => {
      const queryKey = ["hub", "messages", threadId];
      setPendingToggles((prev) => {
        const m = new Map(prev);
        m.set(itemId, (m.get(itemId) || 0) + 1);
        return m;
      });

      const currentData = queryClient.getQueryData<{ messages: HubMessage[] }>(
        queryKey,
      );
      const currentMsg = currentData?.messages.find((m) => m.id === itemId);
      const shouldCheck = !currentMsg?.checked_at;
      const prevAt = currentMsg?.checked_at;
      const prevBy = currentMsg?.checked_by;

      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) =>
        old
          ? {
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
            }
          : old,
      );

      const rollback = () => {
        queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) =>
          old
            ? {
                ...old,
                messages: old.messages.map((msg) =>
                  msg.id === itemId
                    ? { ...msg, checked_at: prevAt, checked_by: prevBy }
                    : msg,
                ),
              }
            : old,
        );
        toast.error("Failed to update item. Please try again.", {
          duration: 2000,
        });
      };

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

      setPendingToggles((prev) => {
        const m = new Map(prev);
        const count = m.get(itemId) || 0;
        count <= 1 ? m.delete(itemId) : m.set(itemId, count - 1);
        return m;
      });

      return success;
    },
    [queryClient, threadId, currentUserId, retryWithBackoff],
  );

  // ── Bulk check/uncheck (Point 3) ──
  const bulkCheck = useCallback(
    async (check: boolean) => {
      const ids = Array.from(selectedItems);
      if (ids.length === 0) return;

      const queryKey = ["hub", "messages", threadId];
      const now = new Date().toISOString();

      // Optimistic update
      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) =>
        old
          ? {
              ...old,
              messages: old.messages.map((msg) =>
                ids.includes(msg.id)
                  ? {
                      ...msg,
                      checked_at: check ? now : null,
                      checked_by: check ? currentUserId : null,
                    }
                  : msg,
              ),
            }
          : old,
      );
      setSelectedItems(new Set());
      setSelectionMode(false);

      try {
        const res = await fetch("/api/hub/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "bulk_check",
            message_ids: ids,
            checked: check,
          }),
        });
        if (!res.ok) throw new Error();
        toast.success(
          `${check ? "Checked" : "Unchecked"} ${ids.length} item${ids.length !== 1 ? "s" : ""}`,
          {
            duration: 4000,
            action: {
              label: "Undo",
              onClick: () => queryClient.invalidateQueries({ queryKey }),
            },
          },
        );
      } catch {
        toast.error("Failed to update items");
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [selectedItems, threadId, queryClient, currentUserId],
  );

  // ── Set item quantity ──
  const setItemQuantity = useCallback(
    async (itemId: string, quantity: string | null) => {
      const queryKey = ["hub", "messages", threadId];
      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) =>
        old
          ? {
              ...old,
              messages: old.messages.map((msg) =>
                msg.id === itemId ? { ...msg, item_quantity: quantity } : msg,
              ),
            }
          : old,
      );
      try {
        const res = await fetch("/api/hub/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_quantity",
            message_id: itemId,
            quantity,
          }),
        });
        if (!res.ok) throw new Error();
        toast.success(quantity ? "Quantity updated" : "Quantity removed");
      } catch {
        toast.error("Failed to update quantity");
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [queryClient, threadId],
  );

  // ── Set item URL ──
  const setItemUrl = useCallback(
    async (itemId: string, url: string | null) => {
      const queryKey = ["hub", "messages", threadId];
      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) =>
        old
          ? {
              ...old,
              messages: old.messages.map((msg) =>
                msg.id === itemId ? { ...msg, item_url: url } : msg,
              ),
            }
          : old,
      );
      try {
        const res = await fetch("/api/hub/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_item_url",
            message_id: itemId,
            item_url: url,
          }),
        });
        if (!res.ok) throw new Error();
        setEditingUrlFor(null);
        setUrlInputValue("");
        toast.success(url ? "Link added" : "Link removed");
      } catch {
        toast.error("Failed to update link");
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [queryClient, threadId],
  );

  // ── Assign item ──
  const assignItem = useCallback(
    async (itemId: string, userId: string | null) => {
      const queryKey = ["hub", "messages", threadId];
      const previousData = queryClient.getQueryData<{ messages: HubMessage[] }>(
        queryKey,
      );
      const prevMsg = previousData?.messages.find((m) => m.id === itemId);
      const prevAssigned = prevMsg?.assigned_to ?? null;
      if (prevAssigned === userId) return;

      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) =>
        old
          ? {
              ...old,
              messages: old.messages.map((msg) =>
                msg.id === itemId ? { ...msg, assigned_to: userId } : msg,
              ),
            }
          : old,
      );

      const name = userId === currentUserId ? "you" : partnerName;
      toast.success(userId ? `Assigned to ${name}` : "Unassigned", {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => assignItem(itemId, prevAssigned),
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
        if (!res.ok) throw new Error();
      } catch {
        toast.error("Failed to assign item");
        queryClient.setQueryData(queryKey, previousData);
      }
    },
    [queryClient, threadId, currentUserId, partnerName],
  );

  // ── URL edit helpers ──
  const handleStartEditUrl = (itemId: string, currentUrl: string | null) => {
    setEditingUrlFor(itemId);
    setUrlInputValue(currentUrl || "");
  };
  const handleSaveUrl = (itemId: string) => {
    setItemUrl(itemId, urlInputValue.trim() || null);
  };
  const handleCancelEditUrl = () => {
    setEditingUrlFor(null);
    setUrlInputValue("");
  };

  const openComparisonSheet = (id: string, name: string) => {
    setSelectedItemForComparison({ id, name });
    setComparisonSheetOpen(true);
  };

  // ── Clear checked items ──
  const handleClearChecked = useCallback(async () => {
    if (checkedItemsList.length === 0 || isClearing) return;
    setIsClearing(true);
    const queryKey = ["hub", "messages", threadId];
    const previousData = queryClient.getQueryData(queryKey);

    // Optimistic: remove all checked items from cache
    queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) =>
      old
        ? {
            ...old,
            messages: old.messages.filter((msg) => !msg.checked_at),
          }
        : old,
    );

    try {
      const res = await fetch("/api/hub/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_checked", thread_id: threadId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Cleared ${data.archivedCount} items`, {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => {
            queryClient.setQueryData(queryKey, previousData);
            queryClient.invalidateQueries({ queryKey });
          },
        },
      });
    } catch {
      toast.error("Failed to clear items");
      queryClient.setQueryData(queryKey, previousData);
    } finally {
      setIsClearing(false);
    }
  }, [checkedItemsList.length, isClearing, queryClient, threadId]);

  // ── Selection toggle ──
  const toggleSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  // ── Render a single shopping item ──
  const renderShoppingItem = (
    item: ShoppingItem,
    dragListeners?: Record<string, unknown>,
    dragAttributes?: Record<string, unknown>,
  ) => {
    const isSelected = selectedItems.has(item.id);
    const isAssignedToMe = item.assignedTo === currentUserId;
    const isAssignedToPartner = item.assignedTo === partnerId;

    return (
      <SwipeToAssign
        key={item.id}
        itemId={item.id}
        currentUserId={currentUserId}
        partnerId={partnerId}
        partnerName={partnerName}
        assignedTo={item.assignedTo}
        onAssign={assignItem}
        myColor={myColor}
        partnerColor={partnerColor}
      >
        <div
          className={cn(
            "group relative neo-card bg-bg-card-custom rounded-xl overflow-hidden transition-all",
            movingItemId === item.id
              ? "border-2 border-purple-500/50 ring-1 ring-purple-500/20"
              : isSelected
                ? "border-2 border-cyan-500/60 ring-1 ring-cyan-500/20"
                : item.source === "inventory"
                  ? "border-2 border-orange-500/40 ring-1 ring-orange-500/20"
                  : "border border-white/5 hover:border-white/10",
          )}
        >
          {/* Thin left accent bar for assignment (theme-based identity) */}
          {item.assignedTo && (
            <div
              className={cn(
                "absolute left-0 inset-y-0 w-[3px] rounded-l-xl",
                isAssignedToMe ? myColors.accent : partnerColors.accent,
              )}
            />
          )}
          <div className="flex items-center gap-2 p-3">
            {/* Drag handle (Point 1) */}
            {!selectionMode && dragListeners && (
              <button
                data-drag-handle
                className="p-0.5 cursor-grab active:cursor-grabbing text-white/20 hover:text-white/50 touch-none flex-shrink-0"
                {...(dragListeners as React.HTMLAttributes<HTMLButtonElement>)}
                {...(dragAttributes as React.HTMLAttributes<HTMLButtonElement>)}
                title="Drag to reorder"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Selection checkbox (Point 3) */}
            {selectionMode ? (
              <button
                onClick={() => toggleSelection(item.id)}
                className="w-6 h-6 flex items-center justify-center flex-shrink-0"
              >
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-cyan-400" />
                ) : (
                  <Square className="w-5 h-5 text-white/30" />
                )}
              </button>
            ) : (
              <button
                onClick={() => toggleCheck(item.id)}
                className="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 border-white/30 hover:border-white/50"
              />
            )}

            {item.source === "inventory" && (
              <div className="absolute top-0 right-0 px-1.5 py-0.5 bg-orange-500/20 rounded-bl-lg">
                <span className="text-[10px] text-orange-400 font-medium">
                  📦 Auto
                </span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <span className="text-white text-sm break-words flex-1 min-w-0 pt-0.5">
                  {item.content}
                </span>

                <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                  {editingQuantityFor === item.id ? (
                    <input
                      type="text"
                      value={quantityInputValue}
                      onChange={(e) => setQuantityInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setItemQuantity(
                            item.id,
                            quantityInputValue.trim() || null,
                          );
                          setEditingQuantityFor(null);
                          setQuantityInputValue("");
                        } else if (e.key === "Escape") {
                          setEditingQuantityFor(null);
                          setQuantityInputValue("");
                        }
                      }}
                      onBlur={() => {
                        setItemQuantity(
                          item.id,
                          quantityInputValue.trim() || null,
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
            </div>

            {!selectionMode && (
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
            )}
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

          {/* URL editor */}
          {editingUrlFor === item.id && (
            <div className="px-3 pb-3 pt-0">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInputValue}
                  onChange={(e) => setUrlInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveUrl(item.id);
                    else if (e.key === "Escape") handleCancelEditUrl();
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

  // ── Render group header with drag handle ──
  const renderGroupHeader = (
    group: ItemGroup,
    dragListeners?: Record<string, unknown>,
    dragAttributes?: Record<string, unknown>,
  ) => {
    const isEditing =
      group.groupId !== null && editingGroupId === group.groupId;

    return (
      <div className="flex items-center gap-1">
        {/* Group drag handle (Point 2) — only for custom groups */}
        {group.type === "custom" && dragListeners && (
          <button
            data-drag-handle
            className="p-1 cursor-grab active:cursor-grabbing text-white/20 hover:text-purple-400 touch-none flex-shrink-0"
            {...(dragListeners as React.HTMLAttributes<HTMLButtonElement>)}
            {...(dragAttributes as React.HTMLAttributes<HTMLButtonElement>)}
            title="Drag to reorder group"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}

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
                if (e.key === "Enter" && group.groupId)
                  renameGroup(group.groupId, editingGroupName);
                else if (e.key === "Escape") {
                  setEditingGroupId(null);
                  setEditingGroupName("");
                }
              }}
              onBlur={() => {
                if (group.groupId && editingGroupName.trim())
                  renameGroup(group.groupId, editingGroupName);
                else {
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

        {/* Group action menu */}
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

  // ── Render the active drag overlay item ──
  const renderDragOverlay = () => {
    if (!activeDragId) return null;

    if (activeDragType === "group") {
      const group = uncheckedGrouped.find((g) => g.groupId === activeDragId);
      if (!group) return null;
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/40 shadow-2xl cursor-grabbing opacity-95">
          <GripVertical className="w-4 h-4 text-purple-400" />
          <FolderOpen className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">
            {group.name}
          </span>
          <span className="text-xs text-white/40 ml-auto">
            {group.items.length}
          </span>
        </div>
      );
    }

    // Item drag overlay
    const allUnchecked = uncheckedGrouped.flatMap((g) => g.items);
    const item = allUnchecked.find((i) => i.id === activeDragId);
    if (!item) return null;
    return (
      <div className="rounded-xl border border-blue-500/40 bg-bg-card-custom shadow-2xl cursor-grabbing opacity-95">
        <div className="flex items-center gap-2 p-3">
          <GripVertical className="w-4 h-4 text-white/30" />
          <div className="w-6 h-6 rounded-md border-2 border-white/30 flex-shrink-0" />
          <span className="text-white text-sm">{item.content}</span>
          {item.quantity && (
            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs font-medium ml-auto">
              {item.quantity}
            </span>
          )}
        </div>
      </div>
    );
  };

  // ── Row renderer for virtualizer ──
  const renderVirtualRow = (
    row: VirtualRowDef,
    key: string | number,
  ): React.ReactNode => {
    switch (row.type) {
      case "toolbar": {
        return (
          <div
            key={key}
            className="flex items-center justify-between pt-3 pb-1"
          >
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
              {/* Selection mode toggle (Point 3) */}
              {uncheckedItems.length > 0 && (
                <button
                  onClick={() => {
                    setSelectionMode((v) => !v);
                    setSelectedItems(new Set());
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all",
                    selectionMode
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-white/40 hover:bg-white/5 hover:text-white/70",
                  )}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectionMode ? "Cancel" : "Select"}
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
        );
      }

      case "group-header": {
        const { group } = row;
        if (group.type === "custom" && group.groupId) {
          // Custom groups are sortable (Point 2)
          return (
            <div key={key} className="space-y-0 mt-2">
              <SortableGroupWrapper id={group.groupId}>
                {({ listeners, attributes }) =>
                  renderGroupHeader(group, listeners, attributes)
                }
              </SortableGroupWrapper>
            </div>
          );
        }
        return (
          <div key={key} className="space-y-0 mt-2">
            {renderGroupHeader(group)}
          </div>
        );
      }

      case "item": {
        const { item, group } = row;
        return (
          <div
            key={key}
            className={cn(
              "mt-1.5",
              uncheckedGrouped.length > 1 || group.type === "custom"
                ? "ml-2"
                : "",
            )}
          >
            <SortableItemWrapper id={item.id}>
              {({ listeners, attributes }) =>
                renderShoppingItem(item, listeners, attributes)
              }
            </SortableItemWrapper>
          </div>
        );
      }

      case "empty-group": {
        return (
          <div key={key} className="ml-2">
            <p className="text-xs text-white/25 text-center py-3 italic">
              No items in this group
            </p>
          </div>
        );
      }

      case "completed-header": {
        return (
          <div key={key} className="py-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-px w-8 bg-white/10" />
                <span className="text-xs text-white/40">
                  Completed ({checkedItemsList.length})
                </span>
                <div className="h-px w-8 bg-white/10" />
              </div>
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
          </div>
        );
      }

      case "completed-item": {
        const { item } = row;
        const isAssignedToMe = item.assignedTo === currentUserId;
        const isAssignedToPartner = item.assignedTo === partnerId;
        return (
          <div
            key={key}
            className={cn(
              "group flex items-center gap-3 p-3 rounded-xl bg-white/5 opacity-60 mb-1.5",
              isAssignedToMe
                ? "border-2 border-blue-400/30"
                : isAssignedToPartner
                  ? "border-2 border-pink-400/30"
                  : "border border-white/5",
            )}
          >
            <button
              onClick={() => toggleCheck(item.id)}
              className="w-6 h-6 rounded-md bg-emerald-500 border-2 border-emerald-500 flex items-center justify-center flex-shrink-0"
            >
              <Check className="w-4 h-4 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <span className="text-white/50 text-sm line-through break-words flex-1 min-w-0 pt-0.5">
                  {item.content}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                  {item.quantity && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300/50 text-xs font-medium line-through">
                      {item.quantity}
                    </span>
                  )}
                  {enableItemUrls && item.itemUrl && (
                    <a
                      href={item.itemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-blue-500/20 text-blue-400/60 hover:text-blue-400 transition-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => onDeleteItem(item.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-all flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      }

      case "empty-state": {
        if (row.variant === "full") {
          return (
            <div
              key={key}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <span className="text-5xl mb-3">🛒</span>
              <p className="text-sm text-white/50">
                Your shopping list is empty
              </p>
              <p className="text-xs text-white/30 mt-1">
                Add items above to get started
              </p>
            </div>
          );
        }
        return (
          <div
            key={key}
            className="flex flex-col items-center justify-center py-10 text-center"
          >
            <CheckCircle2 className="w-14 h-14 text-emerald-400/40 mb-2" />
            <p className="text-sm text-white/50">All items checked!</p>
            <p className="text-xs text-white/30 mt-1">
              Tap &quot;Clear completed&quot; when done shopping
            </p>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // All item IDs for SortableContext (needed even when virtualizer doesn't render them)
  const allUncheckedItemIds = useMemo(
    () => uncheckedGrouped.flatMap((g) => g.items.map((i) => i.id)),
    [uncheckedGrouped],
  );

  // ── Main render ──
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Input Section ── */}
      <div className="p-4 border-b border-white/5 bg-bg-card-custom/95 backdrop-blur-sm shrink-0">
        <div className="flex gap-2 relative">
          <textarea
            ref={inputRef}
            value={newItem}
            onChange={(e) => {
              setNewItem(e.target.value);
              // Debounce typing broadcast so we don't flood the channel
              if (typingBroadcastTimer.current) clearTimeout(typingBroadcastTimer.current);
              typingBroadcastTimer.current = setTimeout(() => {
                presenceChannelRef.current?.send({
                  type: "broadcast",
                  event: "typing-update",
                  payload: { user_id: currentUserId },
                });
              }, 300);
            }}
            onKeyDown={handleKeyPress}
            onPaste={handlePaste}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
            placeholder="Add new item..."
            disabled={isLoading}
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 resize-none overflow-hidden"
            style={{ minHeight: "42px", maxHeight: "120px" }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "42px";
              t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
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

          {/* Autocomplete dropdown (Point 4) */}
          {showAutocomplete && autocompleteResults.length > 0 && (
            <div className="absolute top-full left-0 right-12 mt-1 z-50 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {autocompleteResults.map((result) => (
                <button
                  key={result.id}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent blur on textarea
                    setNewItem(result.name);
                    setShowAutocomplete(false);
                    inputRef.current?.focus();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-all text-left"
                >
                  <span>{result.name}</span>
                  {result.unit && (
                    <span className="text-xs text-white/40 ml-2">
                      {result.unit}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Smart category suggestion (Point 6) */}
        {categorySuggestion && activeGroupId === null && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] text-white/40">Suggested:</span>
            <button
              onClick={() => {
                setActiveGroupId(categorySuggestion.groupId);
                setCategorySuggestion(null);
              }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-xs font-medium hover:bg-purple-500/30 transition-all"
            >
              <FolderOpen className="w-3 h-3" />→ {categorySuggestion.groupName}
            </button>
            <button
              onClick={() => setCategorySuggestion(null)}
              className="text-white/30 hover:text-white/60 text-xs"
            >
              skip
            </button>
          </div>
        )}

        {/* Group selector */}
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

        {/* Status indicators */}
        <div className="flex items-center gap-3 mt-2">
          {/* Partner online indicator (Point 12 — uses partner's identity color) */}
          {partnerTyping ? (
            <div className={cn("flex items-center gap-1.5 text-[10px]", partnerColors.text)}>
              <span className="flex gap-0.5">
                <span className={cn("w-1 h-1 rounded-full animate-bounce", partnerColors.accent)} style={{ animationDelay: "0ms" }} />
                <span className={cn("w-1 h-1 rounded-full animate-bounce", partnerColors.accent)} style={{ animationDelay: "150ms" }} />
                <span className={cn("w-1 h-1 rounded-full animate-bounce", partnerColors.accent)} style={{ animationDelay: "300ms" }} />
              </span>
              <span>{partnerName} is adding…</span>
            </div>
          ) : partnerOnline ? (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <Users2 className="w-3 h-3" />
              <span>{partnerName} is here</span>
            </div>
          ) : null}
          {/* Offline pending badge (Point 13) */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-amber-400/70">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
              <span>{pendingCount} pending sync</span>
            </div>
          )}
        </div>
      </div>

      {/* ── List Section (virtualizer + dnd) ── */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto px-4 pb-8">
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Groups SortableContext (Point 2) */}
            <SortableContext
              items={groupSortableIds}
              strategy={verticalListSortingStrategy}
            >
              {/* Items SortableContext — wraps all unchecked items (Point 1) */}
              <SortableContext
                items={allUncheckedItemIds}
                strategy={verticalListSortingStrategy}
              >
                {/* Virtualizer output */}
                <div
                  style={{
                    height: rowVirtualizer.getTotalSize(),
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const row = virtualRows[virtualItem.index];
                    return (
                      <div
                        key={virtualItem.key}
                        data-index={virtualItem.index}
                        ref={rowVirtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        {renderVirtualRow(row, String(virtualItem.key))}
                      </div>
                    );
                  })}
                </div>
              </SortableContext>
            </SortableContext>

            {/* Drag overlay (Point 1 & 2) */}
            <DragOverlay dropAnimation={null}>
              {renderDragOverlay()}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* ── Batch Selection Action Bar (Point 3) ── */}
      {selectionMode && selectedItems.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 flex items-center gap-2 p-3 rounded-2xl bg-gray-900/95 border border-white/10 backdrop-blur-sm shadow-2xl">
          <span className="text-xs text-white/60 flex-1">
            {selectedItems.size} selected
          </span>
          <button
            onClick={() => bulkCheck(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            Check
          </button>
          <button
            onClick={() => bulkCheck(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/15 text-xs font-medium transition-all"
          >
            <Square className="w-3.5 h-3.5" />
            Uncheck
          </button>
          <button
            onClick={() => {
              setSelectionMode(false);
              setSelectedItems(new Set());
            }}
            className="p-1.5 rounded-xl bg-white/5 text-white/40 hover:bg-white/10 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Product Comparison Sheet ── */}
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

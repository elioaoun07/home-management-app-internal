"use client";

import { useAppMode } from "@/contexts/AppModeContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  isOccurrenceCompleted,
  useAllOccurrenceActions,
} from "@/features/items/useItemActions";
import {
  useCompleteReminder,
  useCreateEvent,
  useCreateReminder,
  useCreateTask,
  useDeleteItem,
  useItems,
  useUpdateItem,
} from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type { ItemPriority, ItemStatus, ItemWithDetails } from "@/types/items";
import {
  endOfWeek,
  format,
  isBefore,
  isSameMonth,
  isToday,
  isTomorrow,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import EditItemDialog from "./EditItemDialog";
import ItemDetailModal from "./ItemDetailModal";
import SwipeableItemCard from "./SwipeableItemCard";

/**
 * ItemsDashboard - Shows reminders, events, and notes based on the selected sub-mode
 * Theme-aware with blue and pink themes
 */

type TimeRange = "today" | "week" | "month";
type ViewMode = "agenda" | "calendar" | "schedule";

// Icons
const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const NoteIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const FilterIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const HomeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

const BriefcaseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

// Category configuration for filtering
const CATEGORIES = [
  { id: "personal", name: "Personal", color: "#8B5CF6", icon: UserIcon },
  { id: "home", name: "Home", color: "#1E90FF", icon: HomeIcon },
  { id: "family", name: "Family", color: "#FFA500", icon: UsersIcon },
  { id: "community", name: "Community", color: "#22C55E", icon: HeartIcon },
  { id: "friends", name: "Friends", color: "#EC4899", icon: UsersIcon },
  { id: "work", name: "Work", color: "#FF3B30", icon: BriefcaseIcon },
] as const;

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const LocationIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// Priority badge colors
const priorityColors: Record<ItemPriority, { bg: string; text: string }> = {
  low: { bg: "bg-gray-500/20", text: "text-gray-400" },
  normal: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  high: { bg: "bg-orange-500/20", text: "text-orange-400" },
  urgent: { bg: "bg-red-500/20", text: "text-red-400" },
};

// Status colors
const statusColors: Record<ItemStatus, { bg: string; text: string }> = {
  pending: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  in_progress: { bg: "bg-amber-500/20", text: "text-amber-400" },
  completed: { bg: "bg-green-500/20", text: "text-green-400" },
  cancelled: { bg: "bg-gray-500/20", text: "text-gray-400" },
  archived: { bg: "bg-gray-500/20", text: "text-gray-400" },
};

// Helper to format relative date
function formatRelativeDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d");
}

// Helper to get date label
function getDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE, MMM d");
}

// Empty state component
function EmptyState() {
  const { theme } = useTheme();
  const { openCreateForm } = useAppMode();
  const isPink = theme === "pink";

  const Icon = CalendarIcon;
  const title = "No items yet";
  const desc = "Create your first item to get started";

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
          isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
        )}
      >
        <Icon
          className={cn("w-8 h-8", isPink ? "text-pink-400" : "text-cyan-400")}
        />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-white/60 mb-4">{desc}</p>
      <button
        type="button"
        onClick={() => openCreateForm("reminder")}
        className={cn(
          "px-4 py-2 rounded-lg font-medium transition-all",
          "neo-gradient text-white"
        )}
      >
        Create Item
      </button>
    </div>
  );
}

import { CalendarView } from "./CalendarView";
import { ScheduleView } from "./ScheduleView";

interface ItemsDashboardProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentUserId?: string;
}

export default function ItemsDashboard({
  viewMode,
  onViewModeChange,
  currentUserId,
}: ItemsDashboardProps) {
  const { theme } = useTheme();
  const { openCreateForm } = useAppMode();
  const isPink = theme === "pink";

  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    overdue: true,
    today: true,
    tomorrow: true,
    upcoming: true,
    completed: false,
  });
  const [selectedItem, setSelectedItem] = useState<ItemWithDetails | null>(
    null
  );
  const [editingItem, setEditingItem] = useState<ItemWithDetails | null>(null);

  // Category filter state - All selected by default EXCEPT work
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<
    string[]
  >(CATEGORIES.filter((cat) => cat.id !== "work").map((cat) => cat.id));

  // Fetch all items (reminders, events, and tasks)
  const { data: allItems = [], isLoading: allLoading } = useItems();

  // Fetch occurrence actions for filtering completed recurring items
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();

  // Mutations
  const completeReminder = useCompleteReminder();
  const deleteItem = useDeleteItem();
  const updateItem = useUpdateItem();
  const createReminder = useCreateReminder();
  const createEvent = useCreateEvent();
  const createTask = useCreateTask();

  // Store for undo operations
  const deletedItemRef = useRef<ItemWithDetails | null>(null);
  const previousItemStateRef = useRef<ItemWithDetails | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Toggle section expansion
  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Toggle category filter
  const toggleCategoryFilter = (categoryId: string) => {
    setSelectedCategoryFilters((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Solo select one category (double-click)
  const soloSelectCategory = (categoryId: string) => {
    setSelectedCategoryFilters([categoryId]);
  };

  // Select all categories except work
  const selectAllExceptWork = () => {
    setSelectedCategoryFilters(
      CATEGORIES.filter((cat) => cat.id !== "work").map((cat) => cat.id)
    );
  };

  // Filter items by time range and categories
  const filteredItems = useMemo(() => {
    const now = new Date();

    return allItems.filter((item) => {
      // Category filter - only show items that match selected categories
      if (selectedCategoryFilters.length > 0) {
        const itemCategories = item.categories || [];
        const hasMatchingCategory = selectedCategoryFilters.some((catId) =>
          itemCategories.includes(catId)
        );
        if (!hasMatchingCategory) return false;
      }

      const dateStr =
        item.type === "reminder" || item.type === "task"
          ? item.reminder_details?.due_at
          : item.type === "event"
            ? item.event_details?.start_at
            : null;

      if (!dateStr) return timeRange === "today"; // Show items without dates only in today view

      const date = parseISO(dateStr);

      switch (timeRange) {
        case "today":
          return isToday(date);
        case "week":
          return isWithinInterval(date, {
            start: startOfWeek(now, { weekStartsOn: 1 }), // Monday
            end: endOfWeek(now, { weekStartsOn: 1 }),
          });
        case "month":
          return isSameMonth(date, now);
        default:
          return false;
      }
    });
  }, [allItems, timeRange, selectedCategoryFilters]);

  // Group items by DATE instead of time of day for better organization
  const groupedByDate = useMemo(() => {
    const now = new Date();

    // Calculate start of current week (Monday at midnight)
    const weekStart = new Date(now);
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysFromMonday = (dayOfWeek + 6) % 7; // Convert to Monday-based (0 = Monday)
    weekStart.setDate(now.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);

    const overdue: ItemWithDetails[] = [];
    const today: ItemWithDetails[] = [];
    const tomorrow: ItemWithDetails[] = [];
    const upcoming: Map<string, ItemWithDetails[]> = new Map();
    const completed: ItemWithDetails[] = [];

    const sortByDateTime = (a: ItemWithDetails, b: ItemWithDetails) => {
      const dateA =
        a.type === "reminder" || a.type === "task"
          ? a.reminder_details?.due_at
          : a.event_details?.start_at;
      const dateB =
        b.type === "reminder" || b.type === "task"
          ? b.reminder_details?.due_at
          : b.event_details?.start_at;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return parseISO(dateA).getTime() - parseISO(dateB).getTime();
    };

    // Helper to get item's due/start date
    const getItemDate = (item: ItemWithDetails): Date | null => {
      const dateStr =
        item.type === "reminder" || item.type === "task"
          ? item.reminder_details?.due_at
          : item.type === "event"
            ? item.event_details?.start_at
            : null;
      return dateStr ? parseISO(dateStr) : null;
    };

    filteredItems.forEach((item) => {
      // Skip archived items entirely
      if (item.status === "archived" || item.archived_at) return;

      const itemDate = getItemDate(item);
      const isRecurring = !!item.recurrence_rule?.rrule;

      // Check if this item/occurrence is completed
      const isItemCompleted =
        item.status === "completed" ||
        (isRecurring &&
          itemDate &&
          isOccurrenceCompleted(item.id, itemDate, occurrenceActions));

      // If completed, check if due date was before this week → auto-archive (hide)
      if (isItemCompleted) {
        // Items with due date before this week are auto-archived (not shown)
        if (itemDate && itemDate < weekStart) {
          return; // Auto-archive: don't show
        }
        // This week's completed items go to completed section
        completed.push(item);
        return;
      }

      // Not completed - categorize by date
      if (!itemDate) {
        today.push(item); // Default to today for items without time
        return;
      }

      // Check if overdue (before today, not completed)
      if (isBefore(itemDate, now) && !isToday(itemDate)) {
        overdue.push(item);
        return;
      }

      if (isToday(itemDate)) {
        today.push(item);
      } else if (isTomorrow(itemDate)) {
        tomorrow.push(item);
      } else {
        // Group by date for upcoming items
        const dateKey = format(itemDate, "yyyy-MM-dd");
        if (!upcoming.has(dateKey)) {
          upcoming.set(dateKey, []);
        }
        upcoming.get(dateKey)!.push(item);
      }
    });

    // Sort within groups
    overdue.sort(sortByDateTime);
    today.sort(sortByDateTime);
    tomorrow.sort(sortByDateTime);
    completed.sort((a, b) => sortByDateTime(b, a)); // Most recent first

    // Sort upcoming dates and their items
    const sortedUpcoming: Array<{
      date: Date;
      label: string;
      items: ItemWithDetails[];
    }> = [];
    Array.from(upcoming.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([dateKey, items]) => {
        items.sort(sortByDateTime);
        const date = parseISO(dateKey);
        sortedUpcoming.push({
          date,
          label: getDateLabel(date),
          items,
        });
      });

    return { overdue, today, tomorrow, upcoming: sortedUpcoming, completed };
  }, [filteredItems, occurrenceActions]);

  // Calculate progress stats
  const progressStats = useMemo(() => {
    const total = filteredItems.length;
    const completedCount = filteredItems.filter(
      (i) => i.status === "completed"
    ).length;
    const pendingCount = total - completedCount;
    const percentage =
      total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return { total, completedCount, pendingCount, percentage };
  }, [filteredItems]);

  const handleComplete = async (id: string) => {
    const item = allItems.find((i) => i.id === id);
    if (!item) return;

    // Store previous state for undo
    previousItemStateRef.current = { ...item };

    try {
      await completeReminder.mutateAsync(id);

      toast.success("Marked as complete!", {
        action: {
          label: "Undo",
          onClick: async () => {
            if (previousItemStateRef.current) {
              try {
                // Restore to pending state
                await updateItem.mutateAsync({
                  id,
                  status: previousItemStateRef.current.status || "pending",
                });

                toast.success("Restored to pending");
              } catch (error) {
                toast.error("Failed to undo");
              }
            }
          },
        },
      });
    } catch (error) {
      toast.error("Failed to complete item");
    }
  };

  const handleDelete = async (id: string) => {
    const item = allItems.find((i) => i.id === id);
    if (!item) return;

    // Store deleted item for undo
    deletedItemRef.current = { ...item };

    try {
      await deleteItem.mutateAsync(id);

      toast.success("Item deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            if (deletedItemRef.current) {
              try {
                // Recreate the item based on its type
                const itemToRestore = deletedItemRef.current;

                if (itemToRestore.type === "reminder") {
                  await createReminder.mutateAsync({
                    type: "reminder",
                    title: itemToRestore.title,
                    description: itemToRestore.description,
                    priority: itemToRestore.priority,
                    status: itemToRestore.status,
                    is_public: itemToRestore.is_public,
                    responsible_user_id: itemToRestore.responsible_user_id,
                    due_at: itemToRestore.reminder_details?.due_at,
                    estimate_minutes:
                      itemToRestore.reminder_details?.estimate_minutes,
                    has_checklist:
                      itemToRestore.reminder_details?.has_checklist || false,
                  });
                } else if (itemToRestore.type === "event") {
                  await createEvent.mutateAsync({
                    type: "event",
                    title: itemToRestore.title,
                    description: itemToRestore.description,
                    priority: itemToRestore.priority,
                    status: itemToRestore.status,
                    is_public: itemToRestore.is_public,
                    responsible_user_id: itemToRestore.responsible_user_id,
                    start_at:
                      itemToRestore.event_details?.start_at ||
                      new Date().toISOString(),
                    end_at:
                      itemToRestore.event_details?.end_at ||
                      new Date().toISOString(),
                    all_day: itemToRestore.event_details?.all_day || false,
                    location_text: itemToRestore.event_details?.location_text,
                  });
                } else if (itemToRestore.type === "task") {
                  await createTask.mutateAsync({
                    type: "task",
                    title: itemToRestore.title,
                    description: itemToRestore.description,
                    priority: itemToRestore.priority,
                    is_public: itemToRestore.is_public,
                    responsible_user_id: itemToRestore.responsible_user_id,
                    due_at: itemToRestore.reminder_details?.due_at || undefined,
                    estimate_minutes:
                      itemToRestore.reminder_details?.estimate_minutes ||
                      undefined,
                  });
                }

                toast.success("Item restored");
                deletedItemRef.current = null;
              } catch (error) {
                toast.error("Failed to restore item");
              }
            }
          },
        },
      });
    } catch (error) {
      toast.error("Failed to delete item");
    }
  };

  const handleEdit = (item: ItemWithDetails) => {
    // Open the edit form for this item
    setEditingItem(item);
    setSelectedItem(null);
  };

  if (allLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-24 rounded-xl animate-pulse",
              isPink ? "bg-pink-500/10" : "bg-cyan-500/10"
            )}
          />
        ))}
      </div>
    );
  }

  if (allItems.length === 0) {
    return <EmptyState />;
  }

  // Minimal Collapsible Section Header Component
  const SectionHeader = ({
    sectionKey,
    label,
    count,
    emoji,
    isOverdue = false,
  }: {
    sectionKey: string;
    label: string;
    count: number;
    emoji?: string;
    isOverdue?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      className={cn(
        "w-full flex items-center gap-2 py-1.5 transition-colors",
        "hover:opacity-80"
      )}
    >
      <motion.div
        animate={{ rotate: expandedSections[sectionKey] ? 0 : -90 }}
        transition={{ duration: 0.15 }}
        className="w-4 h-4 flex items-center justify-center"
      >
        <ChevronDownIcon
          className={cn(
            "w-3.5 h-3.5",
            isOverdue ? "text-red-400" : "text-white/40"
          )}
        />
      </motion.div>
      {emoji && <span className="text-xs">{emoji}</span>}
      <span
        className={cn(
          "text-[11px] font-medium tracking-wide uppercase",
          isOverdue ? "text-red-400" : "text-white/50"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "ml-auto text-[10px] font-medium",
          isOverdue
            ? "text-red-400"
            : isPink
              ? "text-pink-400/60"
              : "text-cyan-400/60"
        )}
      >
        {count}
      </span>
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Minimal Sticky Header - Only show for Agenda view */}
      {viewMode === "agenda" && (
        <div className="sticky top-0 z-10 bg-bg-dark/95 backdrop-blur-xl border-b border-white/5 px-3 py-2">
          {/* Compact time range + filter + progress in one row */}
          <div className="flex items-center gap-2">
            {/* Time range pills - minimal style */}
            <div className="flex bg-white/5 rounded-lg p-0.5">
              {(["today", "week", "month"] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    "px-3 py-1 rounded-md text-[11px] font-medium transition-all",
                    timeRange === range
                      ? isPink
                        ? "bg-pink-500/30 text-pink-300"
                        : "bg-cyan-500/30 text-cyan-300"
                      : "text-white/40 hover:text-white/60"
                  )}
                >
                  {range === "today"
                    ? "Today"
                    : range === "week"
                      ? "Week"
                      : "Month"}
                </button>
              ))}
            </div>

            {/* Inline progress indicator */}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    progressStats.percentage === 100
                      ? "bg-green-400"
                      : isPink
                        ? "bg-pink-400"
                        : "bg-cyan-400"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressStats.percentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium tabular-nums",
                  progressStats.percentage === 100
                    ? "text-green-400"
                    : "text-white/40"
                )}
              >
                {progressStats.percentage}%
              </span>
            </div>

            {/* Filter button - minimal */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "relative p-1.5 rounded-md transition-all",
                isFilterOpen
                  ? isPink
                    ? "bg-pink-500/20 text-pink-400"
                    : "bg-cyan-500/20 text-cyan-400"
                  : "text-white/40 hover:text-white/60 hover:bg-white/5"
              )}
            >
              <FilterIcon className="w-3.5 h-3.5" />
              {selectedCategoryFilters.includes("work") && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </button>
          </div>

          {/* Collapsible Category Filter */}
          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="pt-2 pb-1">
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((category) => {
                      const isSelected = selectedCategoryFilters.includes(
                        category.id
                      );
                      const IconComponent = category.icon;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => toggleCategoryFilter(category.id)}
                          onDoubleClick={() => soloSelectCategory(category.id)}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                            isSelected ? "" : "bg-white/5 text-white/40"
                          )}
                          style={{
                            backgroundColor: isSelected
                              ? `${category.color}20`
                              : undefined,
                            color: isSelected ? category.color : undefined,
                          }}
                        >
                          <IconComponent className="w-3 h-3" />
                          {category.name}
                        </button>
                      );
                    })}
                    {/* Reset button inline */}
                    {selectedCategoryFilters.length !==
                      CATEGORIES.filter((cat) => cat.id !== "work").length && (
                      <button
                        type="button"
                        onClick={selectAllExceptWork}
                        className="px-2 py-1 rounded-md text-[10px] text-white/30 hover:text-white/50 transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === "agenda" ? (
          <div className="space-y-3 p-3 pb-32">
            {/* Overdue section */}
            {groupedByDate.overdue.length > 0 && (
              <section>
                <SectionHeader
                  sectionKey="overdue"
                  label="Overdue"
                  count={groupedByDate.overdue.length}
                  emoji="⚠️"
                  isOverdue
                />
                <AnimatePresence>
                  {expandedSections.overdue && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {groupedByDate.overdue.map((item) => (
                        <SwipeableItemCard
                          key={item.id}
                          item={item}
                          currentUserId={currentUserId}
                          onComplete={() => handleComplete(item.id)}
                          onEdit={handleEdit}
                          onDelete={(id) => handleDelete(id)}
                          onClick={setSelectedItem}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {/* Today section */}
            {groupedByDate.today.length > 0 && (
              <section>
                <SectionHeader
                  sectionKey="today"
                  label="Today"
                  count={groupedByDate.today.length}
                  emoji="📌"
                />
                <AnimatePresence>
                  {expandedSections.today && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {groupedByDate.today.map((item) => (
                        <SwipeableItemCard
                          key={item.id}
                          item={item}
                          currentUserId={currentUserId}
                          onComplete={() => handleComplete(item.id)}
                          onEdit={handleEdit}
                          onDelete={(id) => handleDelete(id)}
                          onClick={setSelectedItem}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {/* Tomorrow section */}
            {groupedByDate.tomorrow.length > 0 && (
              <section>
                <SectionHeader
                  sectionKey="tomorrow"
                  label="Tomorrow"
                  count={groupedByDate.tomorrow.length}
                  emoji="📅"
                />
                <AnimatePresence>
                  {expandedSections.tomorrow && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {groupedByDate.tomorrow.map((item) => (
                        <SwipeableItemCard
                          key={item.id}
                          item={item}
                          currentUserId={currentUserId}
                          onComplete={() => handleComplete(item.id)}
                          onEdit={handleEdit}
                          onDelete={(id) => handleDelete(id)}
                          onClick={setSelectedItem}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {/* Upcoming sections by date */}
            {groupedByDate.upcoming.length > 0 && (
              <>
                {groupedByDate.upcoming.map(({ date, label, items }) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  // Initialize if not exists
                  if (expandedSections[dateKey] === undefined) {
                    expandedSections[dateKey] = true;
                  }
                  return (
                    <section key={dateKey}>
                      <SectionHeader
                        sectionKey={dateKey}
                        label={label}
                        count={items.length}
                        emoji="🗓️"
                      />
                      <AnimatePresence>
                        {expandedSections[dateKey] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-2 overflow-hidden"
                          >
                            {items.map((item) => (
                              <SwipeableItemCard
                                key={item.id}
                                item={item}
                                currentUserId={currentUserId}
                                onComplete={() => handleComplete(item.id)}
                                onEdit={handleEdit}
                                onDelete={(id) => handleDelete(id)}
                                onClick={setSelectedItem}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </section>
                  );
                })}
              </>
            )}

            {/* Completed section */}
            {groupedByDate.completed.length > 0 && (
              <section>
                <SectionHeader
                  sectionKey="completed"
                  label="Completed"
                  count={groupedByDate.completed.length}
                  emoji="✅"
                />
                <AnimatePresence>
                  {expandedSections.completed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {groupedByDate.completed.slice(0, 10).map((item) => (
                        <SwipeableItemCard
                          key={item.id}
                          item={item}
                          currentUserId={currentUserId}
                          onEdit={handleEdit}
                          onDelete={(id) => handleDelete(id)}
                          onClick={setSelectedItem}
                        />
                      ))}
                      {groupedByDate.completed.length > 10 && (
                        <div className="text-center text-xs text-white/40 py-2">
                          +{groupedByDate.completed.length - 10} more completed
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {/* Empty state for filtered view */}
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-white/60">
                <p>No items for this time range</p>
              </div>
            )}
          </div>
        ) : viewMode === "schedule" ? (
          <ScheduleView items={allItems} />
        ) : (
          <CalendarView items={allItems} />
        )}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          currentUserId={currentUserId}
          onClose={() => setSelectedItem(null)}
          onEdit={() => {
            handleEdit(selectedItem);
          }}
          onComplete={() => {
            handleComplete(selectedItem.id);
            setSelectedItem(null);
          }}
          onDelete={() => {
            handleDelete(selectedItem.id);
            setSelectedItem(null);
          }}
        />
      )}

      {/* Edit Item Dialog */}
      <EditItemDialog
        item={editingItem}
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
      />
    </div>
  );
}

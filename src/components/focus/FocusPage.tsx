"use client";

/**
 * FocusPage - A clean, user-friendly view of today's tasks, reminders, and events
 * Features:
 * - Quick entry box that redirects to /expense (reminder) when typing
 * - Organized view by Today/Tomorrow/This Week
 * - Full item actions: complete, edit, postpone, delete
 * - Eye-catching UI with smooth animations
 */

import EditItemDialog from "@/components/items/EditItemDialog";
import ItemDetailModal from "@/components/items/ItemDetailModal";
import { MOBILE_CONTENT_BOTTOM_OFFSET } from "@/constants/layout";
import {
  isOccurrenceCompleted,
  useAllOccurrenceActions,
  useItemActionsWithToast,
} from "@/features/items/useItemActions";
import { useItems } from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import {
  addDays,
  endOfWeek,
  format,
  isBefore,
  isToday,
  isTomorrow,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ListTodo,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { RRule } from "rrule";

// ============================================
// TYPES
// ============================================
interface ExpandedOccurrence {
  item: ItemWithDetails;
  occurrenceDate: Date;
  isCompleted: boolean;
  isPostponed?: boolean;
  originalDate?: Date;
}

type TimeScope = "today" | "week";

// Categories for filtering
const CATEGORIES = [
  { id: "personal", label: "Personal", icon: "👤", color: "bg-purple-500" },
  { id: "home", label: "Home", icon: "🏠", color: "bg-blue-500" },
  { id: "family", label: "Family", icon: "👨‍👩‍👧", color: "bg-orange-500" },
  { id: "community", label: "Community", icon: "🏘️", color: "bg-green-500" },
  { id: "friends", label: "Friends", icon: "👫", color: "bg-pink-500" },
  { id: "work", label: "Work", icon: "💼", color: "bg-red-500" },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function getItemDate(item: ItemWithDetails): Date | null {
  const dateStr =
    item.type === "reminder" || item.type === "task"
      ? item.reminder_details?.due_at
      : item.type === "event"
        ? item.event_details?.start_at
        : null;
  return dateStr ? parseISO(dateStr) : null;
}

function buildFullRRuleString(
  startDate: Date,
  recurrenceRule: { rrule: string },
): string {
  const dtstart = `DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss")}`;
  const rrule = recurrenceRule.rrule.startsWith("RRULE:")
    ? recurrenceRule.rrule
    : `RRULE:${recurrenceRule.rrule}`;
  return `${dtstart}\n${rrule}`;
}

function expandRecurringItems(
  items: ItemWithDetails[],
  startDate: Date,
  endDate: Date,
  actions: any[],
): ExpandedOccurrence[] {
  const result: ExpandedOccurrence[] = [];

  for (const item of items) {
    const itemDate = getItemDate(item);
    if (!itemDate) continue;

    const isRecurring =
      item.recurrence_rule?.rrule && item.recurrence_rule.rrule.length > 0;

    if (isRecurring) {
      try {
        const fullRruleStr = buildFullRRuleString(
          itemDate,
          item.recurrence_rule!,
        );
        const rule = RRule.fromString(fullRruleStr);

        // Get exceptions for this item
        const exceptions = new Set(
          (item.recurrence_rule?.exceptions || []).map((e: any) =>
            format(parseISO(e.exception_date), "yyyy-MM-dd"),
          ),
        );

        // Generate occurrences
        const occurrences = rule.between(startDate, endDate, true);

        for (const occ of occurrences) {
          const occDateKey = format(occ, "yyyy-MM-dd");

          // Skip if this date is an exception
          if (exceptions.has(occDateKey)) continue;

          const completed = isOccurrenceCompleted(item.id, occ, actions);

          result.push({
            item,
            occurrenceDate: occ,
            isCompleted: completed,
          });
        }
      } catch (e) {
        // Fall back to single occurrence
        if (isWithinInterval(itemDate, { start: startDate, end: endDate })) {
          result.push({
            item,
            occurrenceDate: itemDate,
            isCompleted: item.status === "completed",
          });
        }
      }
    } else {
      // Non-recurring: single occurrence
      if (isWithinInterval(itemDate, { start: startDate, end: endDate })) {
        result.push({
          item,
          occurrenceDate: itemDate,
          isCompleted: item.status === "completed",
        });
      }
    }
  }

  // Sort by date/time
  result.sort(
    (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime(),
  );

  return result;
}

function getDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE, MMM d");
}

// ============================================
// ICONS
// ============================================
const typeIcons: Record<string, typeof Calendar> = {
  reminder: Bell,
  event: Calendar,
  task: ListTodo,
};

// ============================================
// TYPES
// ============================================
interface FocusPageProps {
  standalone?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function FocusPage({ standalone = false }: FocusPageProps) {
  const themeClasses = useThemeClasses();
  const router = useRouter();

  // State
  const [timeScope, setTimeScope] = useState<TimeScope>("today");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    overdue: true,
    today: true,
    tomorrow: true,
    upcoming: true,
    completed: false,
  });
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<
    string[]
  >(CATEGORIES.filter((cat) => cat.id !== "work").map((cat) => cat.id));
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemWithDetails | null>(
    null,
  );
  const [editingItem, setEditingItem] = useState<ItemWithDetails | null>(null);
  const [selectedOccurrenceDate, setSelectedOccurrenceDate] =
    useState<Date | null>(null);

  // Data fetching
  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();
  const itemActions = useItemActionsWithToast();

  // Filter active items (not archived)
  const activeItems = useMemo(() => {
    return allItems.filter(
      (item) =>
        item.status !== "archived" &&
        !item.archived_at &&
        item.status !== "cancelled",
    );
  }, [allItems]);

  // Calculate date ranges
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekStart = useMemo(
    () => startOfWeek(today, { weekStartsOn: 1 }),
    [today],
  );
  const weekEnd = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);

  // Get organized tasks
  const organizedTasks = useMemo(() => {
    const now = new Date();
    const todayEnd = addDays(today, 1);
    const scopeEnd = timeScope === "today" ? todayEnd : addDays(weekEnd, 1);

    // Get past 30 days for overdue
    const pastStart = addDays(today, -30);

    // Expand all items
    const allExpanded = expandRecurringItems(
      activeItems,
      pastStart,
      scopeEnd,
      occurrenceActions,
    );

    // Filter by categories
    const filtered = allExpanded.filter((occ) => {
      const itemCategories = occ.item.categories || [];
      if (selectedCategoryFilters.length === 0) return true;
      return selectedCategoryFilters.some((cat) =>
        itemCategories.includes(cat),
      );
    });

    // Organize into sections
    const overdue: ExpandedOccurrence[] = [];
    const todayTasks: ExpandedOccurrence[] = [];
    const tomorrowTasks: ExpandedOccurrence[] = [];
    const upcomingByDate: Map<string, ExpandedOccurrence[]> = new Map();
    const completed: ExpandedOccurrence[] = [];

    for (const occ of filtered) {
      if (occ.isCompleted) {
        // Only show completed from this week
        if (occ.occurrenceDate >= weekStart) {
          completed.push(occ);
        }
        continue;
      }

      // Check if overdue
      if (isBefore(occ.occurrenceDate, today)) {
        overdue.push(occ);
        continue;
      }

      // Categorize by date
      if (isToday(occ.occurrenceDate)) {
        todayTasks.push(occ);
      } else if (isTomorrow(occ.occurrenceDate)) {
        tomorrowTasks.push(occ);
      } else if (timeScope === "week") {
        const dateKey = format(occ.occurrenceDate, "yyyy-MM-dd");
        if (!upcomingByDate.has(dateKey)) {
          upcomingByDate.set(dateKey, []);
        }
        upcomingByDate.get(dateKey)!.push(occ);
      }
    }

    // Sort upcoming dates
    const upcoming: {
      date: Date;
      label: string;
      items: ExpandedOccurrence[];
    }[] = [];
    Array.from(upcomingByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([dateKey, items]) => {
        const date = parseISO(dateKey);
        upcoming.push({
          date,
          label: format(date, "EEEE, MMM d"),
          items,
        });
      });

    return {
      overdue,
      today: todayTasks,
      tomorrow: tomorrowTasks,
      upcoming,
      completed,
    };
  }, [
    activeItems,
    occurrenceActions,
    selectedCategoryFilters,
    today,
    weekStart,
    weekEnd,
    timeScope,
  ]);

  // Stats
  const stats = useMemo(() => {
    const total =
      organizedTasks.overdue.length +
      organizedTasks.today.length +
      organizedTasks.tomorrow.length +
      organizedTasks.upcoming.reduce((sum, g) => sum + g.items.length, 0);
    const completedCount = organizedTasks.completed.length;
    return { total, completedCount, pending: total };
  }, [organizedTasks]);

  // Handle quick entry focus - redirect to /expense with reminder tab
  const handleQuickEntryFocus = useCallback(() => {
    // Set FAB selection to reminder (updates the FAB indicator)
    localStorage.setItem("fab-last-selection", "reminder");
    window.dispatchEvent(new Event("fab-selection-changed"));
    // Set initial tab to reminder - ExpenseLayout will pick this up
    localStorage.setItem("initial-active-tab", "reminder");
    // Navigate to /expense (ExpenseLayout will set tab to reminder)
    router.push("/expense");
  }, [router]);

  // Toggle section
  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Handle item click
  const handleItemClick = useCallback(
    (item: ItemWithDetails, occurrenceDate: Date) => {
      setSelectedItem(item);
      setSelectedOccurrenceDate(occurrenceDate);
    },
    [],
  );

  // Handle complete
  const handleComplete = useCallback(
    async (item: ItemWithDetails, occurrenceDate: Date) => {
      await itemActions.handleComplete(item, occurrenceDate.toISOString());
    },
    [itemActions],
  );

  // Handle edit
  const handleEdit = useCallback((item: ItemWithDetails) => {
    setSelectedItem(null);
    setEditingItem(item);
  }, []);

  // Handle delete
  const handleDelete = useCallback(
    async (item: ItemWithDetails, occurrenceDate?: Date) => {
      const isRecurring = !!item.recurrence_rule?.rrule;
      if (isRecurring && occurrenceDate) {
        // For recurring items, cancel this occurrence
        await itemActions.handleCancel(item, occurrenceDate.toISOString());
      } else {
        // For non-recurring, delete the whole item
        await itemActions.handleDelete(item);
      }
      setSelectedItem(null);
    },
    [itemActions],
  );

  // Get priority color - uses theme's primary color for left border
  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "border-l-[var(--primary)]";
      case "high":
        return "border-l-[var(--primary)]/70";
      default:
        return "border-l-transparent";
    }
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    const Icon = typeIcons[type] || Bell;
    return Icon;
  };

  // Render item card
  const renderItemCard = (occ: ExpandedOccurrence, index: number) => {
    const { item, occurrenceDate, isCompleted } = occ;
    const TypeIcon = getTypeIcon(item.type);
    const isOverdue =
      isBefore(occurrenceDate, today) && !isToday(occurrenceDate);
    const hasTime =
      item.type === "event"
        ? item.event_details?.start_at
        : item.reminder_details?.due_at;
    const timeStr = hasTime ? format(occurrenceDate, "h:mm a") : null;

    return (
      <motion.div
        key={`${item.id}-${occurrenceDate.toISOString()}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ delay: index * 0.03 }}
        onClick={() => handleItemClick(item, occurrenceDate)}
        className={cn(
          "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all",
          "border-l-4 border bg-bg-card-custom",
          getPriorityBorder(item.priority),
          themeClasses.border,
          themeClasses.borderHover,
          isCompleted && "opacity-60",
        )}
      >
        {/* Complete checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleComplete(item, occurrenceDate);
          }}
          className={cn(
            "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
            isCompleted
              ? cn("bg-green-500 border-green-500")
              : cn(themeClasses.border, "hover:border-opacity-70"),
          )}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TypeIcon
              className={cn(
                "w-4 h-4 flex-shrink-0",
                isCompleted ? themeClasses.textFaint : themeClasses.text,
              )}
            />
            <span
              className={cn(
                "font-medium truncate",
                isCompleted
                  ? "line-through text-white/40"
                  : themeClasses.headerText,
              )}
            >
              {item.title}
            </span>
          </div>

          {/* Time and badges */}
          <div className="flex items-center gap-2 mt-1">
            {timeStr && (
              <span
                className={cn(
                  "text-xs flex items-center gap-1",
                  themeClasses.textMuted,
                )}
              >
                <Clock className="w-3 h-3" />
                {timeStr}
              </span>
            )}
            {isOverdue && !isCompleted && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  themeClasses.bgActive,
                  themeClasses.text,
                )}
              >
                Overdue
              </span>
            )}
            {item.categories?.map((cat) => {
              const category = CATEGORIES.find((c) => c.id === cat);
              if (!category) return null;
              return (
                <span
                  key={cat}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded bg-bg-card-custom",
                    themeClasses.textMuted,
                  )}
                >
                  {category.icon}
                </span>
              );
            })}
          </div>
        </div>

        {/* Quick action hint */}
        <ChevronRight
          className={cn(
            "w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity",
            themeClasses.textFaint,
          )}
        />
      </motion.div>
    );
  };

  // Render section
  const renderSection = (
    key: string,
    title: string,
    items: ExpandedOccurrence[],
    icon: typeof AlertCircle,
    accentColor?: string,
  ) => {
    if (items.length === 0) return null;
    const Icon = icon;
    const isExpanded = expandedSections[key];

    return (
      <div className="mb-4">
        {/* Section header */}
        <button
          type="button"
          onClick={() => toggleSection(key)}
          className={cn(
            "w-full flex items-center justify-between p-3 rounded-lg transition-all",
            "bg-bg-card-custom border",
            themeClasses.border,
            themeClasses.borderHover,
          )}
        >
          <div className="flex items-center gap-2">
            <Icon className={cn("w-5 h-5", accentColor || themeClasses.text)} />
            <span className={cn("font-semibold", themeClasses.headerText)}>
              {title}
            </span>
            <span
              className={cn(
                "text-sm px-2 py-0.5 rounded-full bg-bg-card-custom",
                themeClasses.textMuted,
              )}
            >
              {items.length}
            </span>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className={cn("w-5 h-5", themeClasses.textMuted)} />
          </motion.div>
        </button>

        {/* Section content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pt-2 pl-2">
                {items.map((occ, index) => renderItemCard(occ, index))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Get greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return { emoji: "🌙", text: "Night Owl Mode" };
    if (hour < 12) return { emoji: "☀️", text: "Good Morning" };
    if (hour < 17) return { emoji: "🌤️", text: "Good Afternoon" };
    if (hour < 21) return { emoji: "🌆", text: "Good Evening" };
    return { emoji: "🌙", text: "Winding Down" };
  };

  const greeting = getGreeting();

  const contentStyle: CSSProperties = {
    paddingBottom: standalone
      ? "20px"
      : `${MOBILE_CONTENT_BOTTOM_OFFSET + 20}px`,
  };

  return (
    <div className="min-h-screen bg-bg-dark">
      {/* Header */}
      <div
        className={cn(
          "sticky top-0 z-20 px-4 pt-4 pb-3 bg-gradient-to-b from-bg-card-custom to-bg-medium backdrop-blur-xl border-b shadow-2xl shadow-black/10",
          themeClasses.border,
        )}
      >
        {/* Greeting & Stats */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{greeting.emoji}</span>
              <h1 className={cn("text-xl font-bold", themeClasses.headerText)}>
                {greeting.text}
              </h1>
            </div>
            <p className={cn("text-sm mt-0.5", themeClasses.textMuted)}>
              {stats.pending} pending • {stats.completedCount} done
            </p>
          </div>

          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            className={cn(
              "p-2 rounded-lg transition-all",
              showCategoryFilter
                ? cn(themeClasses.bgActive, themeClasses.text)
                : cn(
                    "bg-bg-card-custom",
                    themeClasses.textMuted,
                    themeClasses.textHover,
                  ),
            )}
          >
            <Target className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Entry Box */}
        <div
          onClick={handleQuickEntryFocus}
          className={cn(
            "relative flex items-center gap-3 p-3 rounded-xl cursor-text transition-all",
            "bg-bg-card-custom border",
            themeClasses.border,
            themeClasses.borderHover,
          )}
        >
          <Plus className={cn("w-5 h-5", themeClasses.textFaint)} />
          <span className={cn("flex-1", themeClasses.textFaint)}>
            What do you need to remember?
          </span>
          <Sparkles className={cn("w-4 h-4", themeClasses.textMuted)} />
        </div>

        {/* Category Filter */}
        <AnimatePresence>
          {showCategoryFilter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 mt-3">
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategoryFilters.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryFilters((prev) =>
                          prev.includes(cat.id)
                            ? prev.filter((c) => c !== cat.id)
                            : [...prev, cat.id],
                        );
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all border",
                        isSelected
                          ? cn(
                              themeClasses.bgActive,
                              themeClasses.text,
                              themeClasses.borderActive,
                            )
                          : cn(
                              "bg-bg-card-custom",
                              themeClasses.textMuted,
                              themeClasses.border,
                            ),
                      )}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Time Scope Toggle */}
        <div className="flex mt-3 p-1 rounded-lg bg-bg-card-custom">
          <button
            type="button"
            onClick={() => setTimeScope("today")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all",
              timeScope === "today"
                ? cn(themeClasses.bgActive, themeClasses.text)
                : cn(themeClasses.textMuted, themeClasses.textHover),
            )}
          >
            <Sparkles className="w-4 h-4" />
            Today
          </button>
          <button
            type="button"
            onClick={() => setTimeScope("week")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all",
              timeScope === "week"
                ? cn(themeClasses.bgActive, themeClasses.text)
                : cn(themeClasses.textMuted, themeClasses.textHover),
            )}
          >
            <CalendarDays className="w-4 h-4" />
            This Week
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-2" style={contentStyle}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className={cn(
                "w-8 h-8 border-2 border-t-transparent rounded-full",
                themeClasses.borderActive,
              )}
            />
            <p className={cn("mt-3 text-sm", themeClasses.textMuted)}>
              Loading your focus...
            </p>
          </div>
        ) : stats.total === 0 && stats.completedCount === 0 ? (
          // Empty state
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div
              className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center mb-4",
                themeClasses.bgSurface,
              )}
            >
              <Check className={cn("w-10 h-10", themeClasses.text)} />
            </div>
            <h3
              className={cn(
                "text-lg font-semibold mb-2",
                themeClasses.headerText,
              )}
            >
              All Clear!
            </h3>
            <p className={cn("text-sm max-w-[200px]", themeClasses.textMuted)}>
              You have no tasks for{" "}
              {timeScope === "today" ? "today" : "this week"}. Tap above to add
              one!
            </p>
          </motion.div>
        ) : (
          <>
            {/* Overdue Section */}
            {renderSection(
              "overdue",
              "Overdue",
              organizedTasks.overdue,
              AlertCircle,
              "text-amber-400", // Amber for overdue items - stands out without being stressful
            )}

            {/* Today Section */}
            {renderSection("today", "Today", organizedTasks.today, Sparkles)}

            {/* Tomorrow Section */}
            {renderSection(
              "tomorrow",
              "Tomorrow",
              organizedTasks.tomorrow,
              CalendarDays,
            )}

            {/* Upcoming Sections (by date) */}
            {timeScope === "week" &&
              organizedTasks.upcoming.map((group) => (
                <div key={group.label} className="mb-4">
                  <button
                    type="button"
                    onClick={() => toggleSection(group.label)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg transition-all",
                      "bg-bg-card-custom border",
                      themeClasses.border,
                      themeClasses.borderHover,
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className={cn("w-5 h-5", themeClasses.text)} />
                      <span
                        className={cn("font-semibold", themeClasses.headerText)}
                      >
                        {group.label}
                      </span>
                      <span
                        className={cn(
                          "text-sm px-2 py-0.5 rounded-full bg-bg-card-custom",
                          themeClasses.textMuted,
                        )}
                      >
                        {group.items.length}
                      </span>
                    </div>
                    <motion.div
                      animate={{
                        rotate: expandedSections[group.label] ? 180 : 0,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown
                        className={cn("w-5 h-5", themeClasses.textMuted)}
                      />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {expandedSections[group.label] !== false && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2 pt-2 pl-2">
                          {group.items.map((occ, index) =>
                            renderItemCard(occ, index),
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

            {/* Completed Section */}
            {renderSection(
              "completed",
              "Completed",
              organizedTasks.completed,
              Check,
              "text-green-400",
            )}
          </>
        )}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={() => handleEdit(selectedItem)}
          onComplete={() => {
            handleComplete(selectedItem, selectedOccurrenceDate || new Date());
            setSelectedItem(null);
          }}
          onDelete={() => {
            handleDelete(selectedItem, selectedOccurrenceDate || undefined);
          }}
        />
      )}

      {/* Edit Dialog */}
      <EditItemDialog
        item={editingItem}
        open={!!editingItem}
        onOpenChange={(open: boolean) => !open && setEditingItem(null)}
      />
    </div>
  );
}

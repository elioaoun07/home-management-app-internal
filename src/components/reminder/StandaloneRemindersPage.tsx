/**
 * Standalone Reminders Page
 * A simplified view showing today's tasks and upcoming items
 * For use as a standalone PWA app without bottom navigation
 */
"use client";

import { useTheme } from "@/contexts/ThemeContext";
import {
  getPostponedOccurrencesForDate,
  isOccurrenceCompleted,
  useAllOccurrenceActions,
  useItemActionsWithToast,
  type ItemOccurrenceAction,
} from "@/features/items/useItemActions";
import { useItems } from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type { ItemType, ItemWithDetails } from "@/types/items";
import {
  addDays,
  format,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  ListTodo,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Target,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

// Type icons
const typeIcons: Record<ItemType, typeof Calendar> = {
  reminder: Bell,
  event: Calendar,
  task: ListTodo,
};

// Section types
type Section = "overdue" | "today" | "upcoming";

// ============================================
// HELPERS
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
  actions: ItemOccurrenceAction[],
): ExpandedOccurrence[] {
  const result: ExpandedOccurrence[] = [];

  for (const item of items) {
    const itemDate = getItemDate(item);
    if (!itemDate) continue;

    if (item.recurrence_rule?.rrule) {
      try {
        const rruleString = buildFullRRuleString(
          itemDate,
          item.recurrence_rule,
        );
        const rule = RRule.fromString(rruleString);
        const occurrences = rule.between(startDate, endDate, true);

        for (const occ of occurrences) {
          const isCompleted = isOccurrenceCompleted(item.id, occ, actions);
          result.push({
            item,
            occurrenceDate: occ,
            isCompleted,
          });
        }
      } catch (error) {
        console.error("Error parsing RRULE:", error);
      }
    } else if (isWithinInterval(itemDate, { start: startDate, end: endDate })) {
      const isCompleted =
        item.status === "completed" ||
        isOccurrenceCompleted(item.id, itemDate, actions);
      result.push({
        item,
        occurrenceDate: itemDate,
        isCompleted,
      });
    }
  }

  // Add postponed occurrences
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayPostponed = getPostponedOccurrencesForDate(
      items,
      currentDate,
      actions,
    );
    for (const p of dayPostponed) {
      const alreadyExists = result.some(
        (r) =>
          r.item.id === p.item.id &&
          isSameDay(r.occurrenceDate, p.occurrenceDate),
      );
      if (!alreadyExists) {
        result.push({
          item: p.item,
          occurrenceDate: p.occurrenceDate,
          isCompleted: false,
          isPostponed: true,
          originalDate: p.originalDate,
        });
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  return result.sort(
    (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime(),
  );
}

// ============================================
// SWIPEABLE ITEM (Right → Complete, Left → Options)
// ============================================
const DEAD_ZONE = 20;
const CONFIRM_ZONE = 70;
const MAX_DRAG = 100;

interface SwipeableItemProps {
  onComplete: () => void;
  onOptions: () => void;
  onClick: () => void;
  children: ReactNode;
}

function SwipeableItem({
  onComplete,
  onOptions,
  onClick,
  children,
}: SwipeableItemProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const offsetRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    direction: "horizontal" | "vertical" | null;
    dragging: boolean;
    didSwipe: boolean;
  } | null>(null);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onOptionsRef = useRef(onOptions);
  onOptionsRef.current = onOptions;

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
        didSwipe: false,
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

      if (!state.direction) {
        if (absDx < 8 && absDy < 8) return;
        state.direction = absDx > absDy ? "horizontal" : "vertical";
      }
      if (state.direction === "vertical") return;

      e.preventDefault();

      if (!state.dragging && absDx > DEAD_ZONE) {
        state.dragging = true;
        state.didSwipe = true;
        setIsDragging(true);
      }

      if (absDx <= DEAD_ZONE) {
        offsetRef.current = 0;
        setOffsetX(0);
        return;
      }

      const sign = dx > 0 ? 1 : -1;
      const activeDist = absDx - DEAD_ZONE;
      const confirmDist = CONFIRM_ZONE - DEAD_ZONE;
      const mapped =
        activeDist <= confirmDist
          ? activeDist
          : confirmDist + (activeDist - confirmDist) * 0.3;
      const val = sign * Math.min(mapped, MAX_DRAG);
      offsetRef.current = val;
      setOffsetX(val);
    };

    const onTouchEnd = () => {
      const state = touchStateRef.current;
      if (!state) return;
      const currentOffset = offsetRef.current;
      const absOff = Math.abs(currentOffset);
      const confirmDist = CONFIRM_ZONE - DEAD_ZONE;

      offsetRef.current = 0;
      setOffsetX(0);

      if (absOff >= confirmDist) {
        if (navigator.vibrate) navigator.vibrate(15);
        if (currentOffset > 0) {
          onCompleteRef.current();
        } else {
          onOptionsRef.current();
        }
      }

      setIsDragging(false);
      setTimeout(() => {
        if (touchStateRef.current) touchStateRef.current = null;
      }, 50);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const absOffset = Math.abs(offsetX);
  const confirmedThreshold = CONFIRM_ZONE - DEAD_ZONE;
  const isConfirmed = absOffset >= confirmedThreshold;
  const previewOpacity = isDragging
    ? Math.min(absOffset / confirmedThreshold, 1)
    : 0;

  const handleClick = () => {
    if (touchStateRef.current?.didSwipe) return;
    onClick();
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Right reveal — Complete */}
      {isDragging && offsetX > 0 && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start px-4 rounded-xl z-0",
            isConfirmed ? "bg-emerald-500/30" : "bg-emerald-500/10",
          )}
          style={{ width: `${absOffset + 16}px`, opacity: previewOpacity }}
        >
          <div className="flex items-center gap-1.5">
            <Check
              className={cn(
                "w-4 h-4",
                isConfirmed ? "text-emerald-300" : "text-emerald-400/60",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                isConfirmed ? "text-emerald-300" : "text-emerald-400/60",
              )}
            >
              Done
            </span>
          </div>
        </div>
      )}
      {/* Left reveal — Options */}
      {isDragging && offsetX < 0 && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end px-4 rounded-xl z-0",
            isConfirmed ? "bg-orange-500/30" : "bg-orange-500/10",
          )}
          style={{ width: `${absOffset + 16}px`, opacity: previewOpacity }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                isConfirmed ? "text-orange-300" : "text-orange-400/60",
              )}
            >
              Options
            </span>
            <MoreHorizontal
              className={cn(
                "w-4 h-4",
                isConfirmed ? "text-orange-300" : "text-orange-400/60",
              )}
            />
          </div>
        </div>
      )}
      {/* Content */}
      <div
        ref={contentRef}
        onClick={handleClick}
        className="relative z-10"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 0.25s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================
import type { UserFilter } from "@/components/activity/FilterBar";
import ItemActionsSheet from "@/components/items/ItemActionsSheet";
import ItemDetailModal from "@/components/items/ItemDetailModal";
import type { PostponeType } from "@/features/items/useItemActions";

type TypeFilter = "all" | "reminder" | "task" | "event";
type RecurringFilter = "all" | "recurring" | "one-time";

interface StandaloneRemindersPageProps {
  userFilter?: UserFilter;
  currentUserId?: string;
  typeFilter?: TypeFilter;
  recurringFilter?: RecurringFilter;
}

export default function StandaloneRemindersPage({
  userFilter = "all",
  currentUserId,
  typeFilter = "all",
  recurringFilter = "all",
}: StandaloneRemindersPageProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();
  const itemActions = useItemActionsWithToast();
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [actionsState, setActionsState] = useState<{
    item: ItemWithDetails;
    occurrenceDate: string;
  } | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemWithDetails | null>(
    null,
  );

  // Filter items by ownership
  const ownershipFiltered = useMemo(() => {
    if (!currentUserId || userFilter === "all") return allItems;
    return allItems.filter((item) => {
      const isOwnedByMe =
        item.user_id === currentUserId ||
        item.responsible_user_id === currentUserId;
      return userFilter === "mine" ? isOwnedByMe : !isOwnedByMe;
    });
  }, [allItems, currentUserId, userFilter]);

  // Filter active items + apply type/recurring filters
  const activeItems = useMemo(() => {
    return ownershipFiltered.filter((item) => {
      if (
        item.status === "archived" ||
        item.status === "cancelled" ||
        item.archived_at
      )
        return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (recurringFilter === "recurring" && !item.recurrence_rule?.rrule)
        return false;
      if (recurringFilter === "one-time" && item.recurrence_rule?.rrule)
        return false;
      return true;
    });
  }, [ownershipFiltered, typeFilter, recurringFilter]);

  // Process items into occurrences
  const { overdueItems, todayItems, upcomingItems, stats } = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const weekFromNow = addDays(today, 7);
    const pastStart = addDays(today, -30);

    // Expand all items for different date ranges
    const overdueOccs = expandRecurringItems(
      activeItems,
      pastStart,
      today,
      occurrenceActions,
    ).filter((occ) => isBefore(occ.occurrenceDate, today) && !occ.isCompleted);

    const todayOccs = expandRecurringItems(
      activeItems,
      today,
      tomorrow,
      occurrenceActions,
    );

    const upcomingOccs = expandRecurringItems(
      activeItems,
      tomorrow,
      weekFromNow,
      occurrenceActions,
    );

    return {
      overdueItems: overdueOccs,
      todayItems: todayOccs,
      upcomingItems: upcomingOccs,
      stats: {
        overdue: overdueOccs.length,
        today: todayOccs.length,
        todayCompleted: todayOccs.filter((t) => t.isCompleted).length,
        upcoming: upcomingOccs.length,
      },
    };
  }, [activeItems, occurrenceActions]);

  // Handle item completion toggle
  const handleToggleComplete = useCallback(
    (occ: ExpandedOccurrence) => {
      if (occ.isCompleted) {
        itemActions.handleUncomplete(
          occ.item,
          occ.occurrenceDate.toISOString(),
        );
      } else {
        itemActions.handleComplete(occ.item, occ.occurrenceDate.toISOString());
      }
    },
    [itemActions],
  );

  // Get item time string
  const getItemTime = (item: ItemWithDetails): string | null => {
    if (item.type === "reminder" || item.type === "task") {
      const dueAt = item.reminder_details?.due_at;
      if (dueAt) {
        const date = parseISO(dueAt);
        // Check if it has a time component (not midnight)
        if (date.getHours() !== 0 || date.getMinutes() !== 0) {
          return format(date, "h:mm a");
        }
      }
    } else if (item.type === "event") {
      const startAt = item.event_details?.start_at;
      if (startAt) {
        return format(parseISO(startAt), "h:mm a");
      }
    }
    return null;
  };

  // Open actions sheet for an occurrence
  const openActions = useCallback((occ: ExpandedOccurrence) => {
    setActionsState({
      item: occ.item,
      occurrenceDate: occ.occurrenceDate.toISOString(),
    });
  }, []);

  // Render a single item with swipe support
  const renderItem = (occ: ExpandedOccurrence, showDate = false) => {
    const Icon = typeIcons[occ.item.type];
    const timeStr = getItemTime(occ.item);
    const isRecurring = !!occ.item.recurrence_rule?.rrule;

    return (
      <SwipeableItem
        key={`${occ.item.id}-${occ.occurrenceDate.getTime()}`}
        onComplete={() => {
          if (!occ.isCompleted) {
            itemActions.handleComplete(
              occ.item,
              occ.occurrenceDate.toISOString(),
            );
          }
        }}
        onOptions={() => openActions(occ)}
        onClick={() => setSelectedItem(occ.item)}
      >
        <div
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl transition-all",
            "bg-white/5 hover:bg-white/10",
            occ.isCompleted && "opacity-50",
          )}
        >
          {/* Completion checkbox */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleComplete(occ);
            }}
            className={cn(
              "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0",
              occ.isCompleted
                ? isPink
                  ? "bg-pink-500 border-pink-500"
                  : "bg-cyan-500 border-cyan-500"
                : "border-white/30 hover:border-white/50",
            )}
          >
            {occ.isCompleted && <Check className="w-4 h-4 text-white" />}
          </button>

          {/* Icon */}
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              occ.item.type === "event" && "bg-pink-500/20 text-pink-400",
              occ.item.type === "reminder" && "bg-cyan-500/20 text-cyan-400",
              occ.item.type === "task" && "bg-purple-500/20 text-purple-400",
            )}
          >
            <Icon className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p
                className={cn(
                  "font-medium truncate",
                  occ.isCompleted ? "text-white/40 line-through" : "text-white",
                )}
              >
                {occ.item.title}
              </p>
              {isRecurring && (
                <RefreshCw className="w-3 h-3 text-white/30 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              {showDate && (
                <span>{format(occ.occurrenceDate, "EEE, MMM d")}</span>
              )}
              {timeStr && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeStr}
                </span>
              )}
              {occ.isPostponed && (
                <span className="text-amber-400">Postponed</span>
              )}
            </div>
          </div>

          {/* Actions button (fallback for non-swipe / desktop) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openActions(occ);
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <MoreHorizontal className="w-4 h-4 text-white/40" />
          </button>
        </div>
      </SwipeableItem>
    );
  };

  // Render a section header
  const renderSectionHeader = (
    title: string,
    count: number,
    section: Section,
    color: string,
  ) => (
    <button
      type="button"
      onClick={() =>
        setSelectedSection(selectedSection === section ? null : section)
      }
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-xl transition-all",
        "bg-white/5 hover:bg-white/10",
        selectedSection === section && "ring-1 ring-white/20",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            color,
          )}
        >
          {section === "overdue" && <AlertCircle className="w-4 h-4" />}
          {section === "today" && <Target className="w-4 h-4" />}
          {section === "upcoming" && <Calendar className="w-4 h-4" />}
        </div>
        <span className="font-medium text-white">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            section === "overdue" && count > 0
              ? "bg-red-500/20 text-red-400"
              : "bg-white/10 text-white/60",
          )}
        >
          {count}
        </span>
        <ChevronRight
          className={cn(
            "w-4 h-4 text-white/40 transition-transform",
            selectedSection === section && "rotate-90",
          )}
        />
      </div>
    </button>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-pulse text-white/40">Loading...</div>
      </div>
    );
  }

  // Get next incomplete task for focus card
  const nextTask = todayItems.find((t) => !t.isCompleted);

  return (
    <div className="min-h-full p-4 pb-8 space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <div className="text-2xl font-bold text-red-400">{stats.overdue}</div>
          <div className="text-xs text-white/40">Overdue</div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {stats.todayCompleted}/{stats.today}
          </div>
          <div className="text-xs text-white/40">Today</div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <div
            className={cn(
              "text-2xl font-bold",
              isPink ? "text-pink-400" : "text-cyan-400",
            )}
          >
            {stats.upcoming}
          </div>
          <div className="text-xs text-white/40">Upcoming</div>
        </div>
      </div>

      {/* Focus Card - Next Item */}
      {nextTask && (
        <div
          className={cn(
            "p-6 rounded-2xl text-center",
            isPink
              ? "bg-pink-500/10 border border-pink-500/20"
              : "bg-cyan-500/10 border border-cyan-500/20",
          )}
        >
          <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
            Up Next
          </p>
          <h2 className="text-xl font-bold text-white mb-1">
            {nextTask.item.title}
          </h2>
          {getItemTime(nextTask.item) && (
            <p className="text-white/60">{getItemTime(nextTask.item)}</p>
          )}
          <button
            type="button"
            onClick={() => handleToggleComplete(nextTask)}
            className={cn(
              "mt-4 px-6 py-2 rounded-xl font-medium transition-all",
              isPink
                ? "bg-pink-500 hover:bg-pink-600 text-white"
                : "bg-cyan-500 hover:bg-cyan-600 text-white",
            )}
          >
            Mark Complete
          </button>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {/* Overdue */}
        {stats.overdue > 0 && (
          <div className="space-y-2">
            {renderSectionHeader(
              "Overdue",
              stats.overdue,
              "overdue",
              "bg-red-500/20 text-red-400",
            )}
            {selectedSection === "overdue" && (
              <div className="space-y-2 pl-2">
                {overdueItems.map((occ) => renderItem(occ, true))}
              </div>
            )}
          </div>
        )}

        {/* Today */}
        <div className="space-y-2">
          {renderSectionHeader(
            "Today",
            stats.today,
            "today",
            "bg-amber-500/20 text-amber-400",
          )}
          {selectedSection === "today" && (
            <div className="space-y-2 pl-2">
              {todayItems.length > 0 ? (
                todayItems.map((occ) => renderItem(occ))
              ) : (
                <p className="text-white/40 text-sm p-3">
                  No tasks scheduled for today
                </p>
              )}
            </div>
          )}
        </div>

        {/* Upcoming */}
        <div className="space-y-2">
          {renderSectionHeader(
            "This Week",
            stats.upcoming,
            "upcoming",
            isPink
              ? "bg-pink-500/20 text-pink-400"
              : "bg-cyan-500/20 text-cyan-400",
          )}
          {selectedSection === "upcoming" && (
            <div className="space-y-2 pl-2">
              {upcomingItems.length > 0 ? (
                upcomingItems.map((occ) => renderItem(occ, true))
              ) : (
                <p className="text-white/40 text-sm p-3">
                  No upcoming tasks this week
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add New Reminder FAB */}
      <Link
        href="/expense"
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg",
          isPink
            ? "bg-pink-500 hover:bg-pink-600 shadow-pink-500/30"
            : "bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/30",
        )}
      >
        <Plus className="w-6 h-6 text-white" />
      </Link>

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={() => setSelectedItem(null)}
          onDelete={() => {
            itemActions.handleDelete(selectedItem);
            setSelectedItem(null);
          }}
          currentUserId={currentUserId}
        />
      )}

      {/* Item Actions Sheet (Complete, Postpone, Cancel, Delete) */}
      {actionsState && (
        <ItemActionsSheet
          item={actionsState.item}
          occurrenceDate={actionsState.occurrenceDate}
          isOpen={!!actionsState}
          onClose={() => setActionsState(null)}
          onComplete={(reason) => {
            itemActions.handleComplete(
              actionsState.item,
              actionsState.occurrenceDate,
              reason,
            );
            setActionsState(null);
          }}
          onPostpone={(type: PostponeType, reason?: string) => {
            itemActions.handlePostpone(
              actionsState.item,
              actionsState.occurrenceDate,
              type,
              reason,
            );
            setActionsState(null);
          }}
          onCancel={(reason) => {
            itemActions.handleCancel(
              actionsState.item,
              actionsState.occurrenceDate,
              reason,
            );
            setActionsState(null);
          }}
          onDelete={() => {
            itemActions.handleDelete(actionsState.item);
            setActionsState(null);
          }}
        />
      )}
    </div>
  );
}

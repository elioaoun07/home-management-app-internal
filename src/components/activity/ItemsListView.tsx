"use client";

import { useTheme } from "@/contexts/ThemeContext";
import {
  isOccurrenceCompleted,
  normalizeToLocalDateString,
  useAllOccurrenceActions,
  useItemActionsWithToast,
} from "@/features/items/useItemActions";
import { useItems } from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { ItemStatus, ItemType, ItemWithDetails } from "@/types/items";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ItemActionsSheet from "@/components/items/ItemActionsSheet";
import ItemDetailModal from "@/components/items/ItemDetailModal";

// ─────────────────────────────────────────────
// Inline Icons
// ─────────────────────────────────────────────
const BellIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const CheckSquareIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const CalendarIconSm = ({ className }: { className?: string }) => (
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

const RepeatIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const MoreHorizontalIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

const ChevronUpIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const EmptyCalIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
    <line x1="8" x2="16" y1="15" y2="15" />
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

const TagIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const WarningIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// ─────────────────────────────────────────────
// Swipe constants (same as SwipeableItem.tsx)
// ─────────────────────────────────────────────
const DEAD_ZONE = 20;
const CONFIRM_ZONE = 70;
const MAX_DRAG = 100;

// ─────────────────────────────────────────────
// SwipeableJournalItem
// RIGHT → Complete (green)  |  LEFT → Options (orange)
// ─────────────────────────────────────────────
interface SwipeableJournalItemProps {
  onComplete: () => void;
  onOptions: () => void;
  onClick: () => void;
  children: ReactNode;
}

function SwipeableJournalItem({
  onComplete,
  onOptions,
  onClick,
  children,
}: SwipeableJournalItemProps) {
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
            <CheckIcon
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
            <MoreHorizontalIcon
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

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function getItemPrimaryDateStr(item: ItemWithDetails): string | null {
  if (item.type === "event" && item.event_details) {
    return item.event_details.start_at || null;
  }
  return item.reminder_details?.due_at || null;
}

function getItemDayStr(item: ItemWithDetails): string | null {
  const dateStr = getItemPrimaryDateStr(item);
  if (!dateStr) return null;
  return normalizeToLocalDateString(new Date(dateStr));
}

type TimeGroup = "all-day" | "morning" | "afternoon" | "evening" | "no-time";

function getTimeGroup(item: ItemWithDetails): TimeGroup {
  if (item.type === "event" && item.event_details?.all_day) return "all-day";
  const dateStr = getItemPrimaryDateStr(item);
  if (!dateStr) return "no-time";
  const hour = new Date(dateStr).getHours();
  if (hour < 5) return "evening"; // late night → group with evening
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function sortByTime(items: ItemWithDetails[]): ItemWithDetails[] {
  return [...items].sort((a, b) => {
    const da = getItemPrimaryDateStr(a);
    const db = getItemPrimaryDateStr(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return new Date(da).getTime() - new Date(db).getTime();
  });
}

function getPriorityDotClass(priority: string): string {
  switch (priority) {
    case "urgent":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "normal":
      return "bg-white/25";
    default:
      return "bg-white/10";
  }
}

function formatRelativeTime(dateStr: string): {
  text: string;
  isOverdue: boolean;
} {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const isOverdue = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const mins = Math.floor(absMs / 60000);
  const hours = Math.floor(absMs / 3600000);
  const days = Math.floor(absMs / 86400000);

  let text: string;
  if (days >= 1) text = `${days}d`;
  else if (hours >= 1) text = `${hours}h`;
  else text = `${mins}m`;

  return { text: isOverdue ? `${text} ago` : `in ${text}`, isOverdue };
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
type TypeFilter = "all" | ItemType;
type GroupBy = "time" | "category";

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "reminder", label: "Reminders" },
  { key: "event", label: "Events" },
  { key: "task", label: "Tasks" },
];

const TIME_GROUP_META: {
  key: TimeGroup;
  label: string;
  emoji: string;
}[] = [
  { key: "all-day", label: "All Day", emoji: "☀️" },
  { key: "morning", label: "Morning", emoji: "🌅" },
  { key: "afternoon", label: "Afternoon", emoji: "🌤" },
  { key: "evening", label: "Evening", emoji: "🌙" },
  { key: "no-time", label: "No Time Set", emoji: "⏱" },
];

const OVERDUE_KEY = "__overdue__";

const CATEGORY_META: Record<string, { name: string; color: string }> = {
  personal: { name: "Personal", color: "#8B5CF6" },
  home: { name: "Home", color: "#1E90FF" },
  family: { name: "Family", color: "#FFA500" },
  community: { name: "Community", color: "#22C55E" },
  friends: { name: "Friends", color: "#EC4899" },
  work: { name: "Work", color: "#FF3B30" },
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
type UserFilter = "all" | "mine" | "partner";

interface ItemsListViewProps {
  startDate: string;
  endDate: string;
  currentUserId?: string;
  userFilter?: UserFilter;
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function ItemsListView({
  startDate,
  endDate,
  currentUserId,
  userFilter = "all",
}: ItemsListViewProps) {
  const themeClasses = useThemeClasses();
  const { theme: currentTheme } = useTheme();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [catSectionOpen, setCatSectionOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("time");
  const [selectedItem, setSelectedItem] = useState<ItemWithDetails | null>(
    null,
  );
  const [actionsState, setActionsState] = useState<{
    item: ItemWithDetails;
    occurrenceDate: string;
  } | null>(null);
  // Overdue section starts collapsed by default
  const [collapsed, setCollapsed] = useState<Set<string>>(
    new Set([OVERDUE_KEY]),
  );

  const { data: allItems = [], isLoading } = useItems({
    status: ["pending", "in_progress"] as ItemStatus[],
  });
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();
  const { handleComplete, handlePostpone, handleCancel, handleDelete } =
    useItemActionsWithToast();

  const isSingleDay = startDate === endDate;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(
    new Date(Date.now() + 86400000),
    "yyyy-MM-dd",
  );

  // Extract unique categories from all items
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    allItems.forEach((item) =>
      item.categories?.forEach((c) => c && cats.add(c)),
    );
    return Array.from(cats).sort();
  }, [allItems]);

  // Filter by type
  const typeFiltered = useMemo(() => {
    if (typeFilter === "all") return allItems;
    return allItems.filter((item) => item.type === typeFilter);
  }, [allItems, typeFilter]);

  // Filter by category (multiselect)
  const categoryFiltered = useMemo(() => {
    if (categoryFilters.length === 0) return typeFiltered;
    return typeFiltered.filter((item) =>
      item.categories?.some((c) => c && categoryFilters.includes(c)),
    );
  }, [typeFiltered, categoryFilters]);

  // Filter by user
  const userFiltered = useMemo(() => {
    if (userFilter === "all" || !currentUserId) return categoryFiltered;
    return categoryFiltered.filter((item) => {
      const isOwner = item.user_id === currentUserId;
      return userFilter === "mine" ? isOwner : !isOwner;
    });
  }, [categoryFiltered, userFilter, currentUserId]);

  // Overdue items: primary date before today (shown separately)
  const overdueFiltered = useMemo(() => {
    return userFiltered.filter((item) => {
      const dayStr = getItemDayStr(item);
      return dayStr !== null && dayStr < todayStr;
    });
  }, [userFiltered, todayStr]);

  // Date range items: within range AND not overdue
  const rangeFiltered = useMemo(() => {
    return userFiltered.filter((item) => {
      const dayStr = getItemDayStr(item);
      if (!dayStr) return false;
      if (dayStr < todayStr) return false; // handled in overdue section
      return dayStr >= startDate && dayStr <= endDate;
    });
  }, [userFiltered, startDate, endDate, todayStr]);

  // Group by time (existing logic)
  const timeGroups = useMemo(() => {
    if (groupBy !== "time") return null;
    if (isSingleDay) {
      const map: Record<TimeGroup, ItemWithDetails[]> = {
        "all-day": [],
        morning: [],
        afternoon: [],
        evening: [],
        "no-time": [],
      };
      rangeFiltered.forEach((item) => {
        map[getTimeGroup(item)].push(item);
      });
      (Object.keys(map) as TimeGroup[]).forEach((key) => {
        map[key] = sortByTime(map[key]);
      });
      return map as Record<string, ItemWithDetails[]>;
    } else {
      const days = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate),
      });
      const map: Record<string, ItemWithDetails[]> = {};
      days.forEach((day) => {
        map[format(day, "yyyy-MM-dd")] = [];
      });
      rangeFiltered.forEach((item) => {
        const dayStr = getItemDayStr(item);
        if (dayStr && map[dayStr] !== undefined) {
          map[dayStr].push(item);
        }
      });
      Object.keys(map).forEach((key) => {
        map[key] = sortByTime(map[key]);
      });
      return map;
    }
  }, [rangeFiltered, groupBy, isSingleDay, startDate, endDate]);

  // Group by category
  const categoryGroups = useMemo(() => {
    if (groupBy !== "category") return null;
    const map: Record<string, ItemWithDetails[]> = {};
    rangeFiltered.forEach((item) => {
      const key = item.categories?.find(Boolean) ?? "Uncategorized";
      (map[key] ??= []).push(item);
    });
    Object.keys(map).forEach((k) => {
      map[k] = sortByTime(map[k]);
    });
    return map;
  }, [rangeFiltered, groupBy]);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getOccurrenceDate = (item: ItemWithDetails): string =>
    getItemPrimaryDateStr(item) || item.created_at;

  // ── Item row renderer ──
  const renderItem = (item: ItemWithDetails) => {
    const primaryDateStr = getItemPrimaryDateStr(item);
    const isCompleted = primaryDateStr
      ? isOccurrenceCompleted(
          item.id,
          new Date(primaryDateStr),
          occurrenceActions,
        )
      : item.status === "completed";
    const isOwner = currentUserId ? item.user_id === currentUserId : true;

    let timeText = "No time";
    let isOverdue = false;
    if (item.type === "event" && item.event_details?.all_day) {
      timeText = "All day";
    } else if (primaryDateStr) {
      const rel = formatRelativeTime(primaryDateStr);
      timeText = rel.text;
      isOverdue = rel.isOverdue;
    }

    const subtaskCount = item.subtasks?.length ?? 0;
    const doneSubtasks = item.subtasks?.filter((st) => !!st.done_at).length ?? 0;
    const isRecurring = !!item.recurrence_rule?.rrule;

    const TypeIcon =
      item.type === "reminder"
        ? BellIcon
        : item.type === "event"
          ? CalendarIconSm
          : CheckSquareIcon;

    const borderColor = isOwner
      ? currentTheme === "pink"
        ? "#ec4899"
        : "#3b82f6"
      : currentTheme === "pink"
        ? "#3b82f6"
        : "#ec4899";

    return (
      <SwipeableJournalItem
        key={item.id}
        onComplete={() => isOwner && handleComplete(item, getOccurrenceDate(item))}
        onOptions={() => setActionsState({ item, occurrenceDate: getOccurrenceDate(item) })}
        onClick={() => setSelectedItem(item)}
      >
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-3 neo-card rounded-xl transition-opacity",
            isCompleted && "opacity-50",
          )}
          style={{ borderLeft: `4px solid ${borderColor}` }}
        >
          {/* Priority dot */}
          <div
            className={cn(
              "w-2 h-2 rounded-full flex-shrink-0",
              getPriorityDotClass(item.priority),
            )}
          />

          {/* Type icon */}
          <TypeIcon
            className={cn("w-4 h-4 flex-shrink-0", themeClasses.textActive)}
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "text-sm font-medium truncate",
                  themeClasses.text,
                  isCompleted && "line-through opacity-60",
                )}
              >
                {item.title}
              </span>
              {isRecurring && (
                <RepeatIcon className="w-3 h-3 text-white/30 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={cn(
                  "text-[11px]",
                  isOverdue ? "text-white/40" : "text-white/50",
                )}
              >
                {timeText}
              </span>
              {subtaskCount > 0 && (
                <span className="text-[11px] text-white/30">
                  {doneSubtasks}/{subtaskCount}
                </span>
              )}
            </div>
          </div>

          {/* Completed check */}
          {isCompleted && (
            <CheckIcon className="w-4 h-4 text-emerald-400/60 flex-shrink-0" />
          )}
        </div>
      </SwipeableJournalItem>
    );
  };

  // ── Controls bar ──
  const controlsBar = (
    <div className="mb-3 neo-card rounded-xl overflow-hidden">
      {/* Row 1: Type toggle + group-by */}
      <div className="flex items-center gap-2 px-2.5 py-2.5">
        {/* 3-option type toggle (clicking active → deselects = show all) */}
        <div className="flex gap-0.5 bg-white/5 rounded-xl p-0.5 flex-1">
          {(
            [
              { key: "reminder" as const, label: "Reminder", Icon: BellIcon },
              { key: "event" as const, label: "Event", Icon: CalendarIconSm },
              { key: "task" as const, label: "Task", Icon: CheckSquareIcon },
            ] as const
          ).map(({ key, label, Icon }) => {
            const isActive = typeFilter === key;
            return (
              <button
                key={key}
                onClick={() => setTypeFilter(isActive ? "all" : key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                  isActive
                    ? "bg-violet-500/25 text-violet-300 shadow-sm"
                    : `${themeClasses.text} hover:bg-white/5`,
                )}
              >
                <Icon className="w-3 h-3 flex-shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Group-by mini toggle */}
        <div className="flex gap-0.5 bg-white/5 rounded-lg p-0.5 flex-shrink-0">
          <button
            onClick={() => setGroupBy("time")}
            title="Group by time"
            className={cn(
              "p-1.5 rounded-md transition-all",
              groupBy === "time"
                ? "bg-violet-500/25 text-violet-300"
                : `${themeClasses.text} hover:bg-white/5`,
            )}
          >
            <ClockIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setGroupBy("category")}
            title="Group by category"
            className={cn(
              "p-1.5 rounded-md transition-all",
              groupBy === "category"
                ? "bg-violet-500/25 text-violet-300"
                : `${themeClasses.text} hover:bg-white/5`,
            )}
          >
            <TagIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: Category filter — collapsible */}
      {availableCategories.length > 0 && (
        <div className="border-t border-white/5">
          <button
            onClick={() => setCatSectionOpen((v) => !v)}
            className="flex items-center gap-2 w-full px-2.5 py-2"
          >
            <TagIcon className="w-3 h-3 text-white/25 flex-shrink-0" />
            <span
              className={cn(
                "text-[11px] font-medium flex-1 text-left",
                themeClasses.textMuted,
              )}
            >
              Categories
            </span>
            {categoryFilters.length > 0 && (
              <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full font-medium leading-none">
                {categoryFilters.length}
              </span>
            )}
            <ChevronUpIcon
              className={cn(
                "w-3 h-3 text-white/20 transition-transform",
                !catSectionOpen && "rotate-180",
              )}
            />
          </button>
          {catSectionOpen && (
            <div className="px-2.5 pb-2.5 flex flex-wrap gap-1.5">
              {availableCategories.map((catId) => {
                const meta = CATEGORY_META[catId] ?? {
                  name: catId,
                  color: "#94a3b8",
                };
                const isSelected = categoryFilters.includes(catId);
                return (
                  <button
                    key={catId}
                    onClick={() =>
                      setCategoryFilters((prev) =>
                        prev.includes(catId)
                          ? prev.filter((c) => c !== catId)
                          : [...prev, catId],
                      )
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                    style={
                      isSelected
                        ? {
                            backgroundColor: `${meta.color}20`,
                            color: meta.color,
                            border: `1px solid ${meta.color}45`,
                          }
                        : {
                            backgroundColor: "rgba(255,255,255,0.04)",
                            color: "rgba(255,255,255,0.35)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }
                    }
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: isSelected
                          ? meta.color
                          : "rgba(255,255,255,0.2)",
                      }}
                    />
                    {meta.name}
                  </button>
                );
              })}
              {categoryFilters.length > 0 && (
                <button
                  onClick={() => setCategoryFilters([])}
                  className="flex items-center px-2 py-1 rounded-full text-[10px] text-white/30 hover:text-white/50 transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[64px] neo-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Overdue section renderer ──
  const renderOverdueSection = () => {
    if (overdueFiltered.length === 0) return null;
    const isCollapsed = collapsed.has(OVERDUE_KEY);
    return (
      <div className="mb-4">
        <button
          onClick={() => toggleCollapse(OVERDUE_KEY)}
          className="flex items-center gap-2 mb-2 w-full text-left"
        >
          <WarningIcon className="w-3 h-3 text-amber-400/70 flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/70">
            Overdue
          </span>
          <span className="text-[10px] text-amber-400/40 ml-0.5">
            ({overdueFiltered.length})
          </span>
          <ChevronUpIcon
            className={cn(
              "w-3 h-3 text-amber-400/40 ml-auto transition-transform",
              isCollapsed && "rotate-180",
            )}
          />
        </button>
        {!isCollapsed && (
          <div className="flex flex-col gap-2 pl-2 border-l-2 border-amber-500/20">
            {overdueFiltered.map(renderItem)}
          </div>
        )}
      </div>
    );
  };

  // ── Group section renderer (shared) ──
  const renderSection = (
    key: string,
    label: string,
    emoji: string | undefined,
    items: ItemWithDetails[],
    isToday = false,
  ) => {
    if (items.length === 0) return null;
    const isCollapsed = collapsed.has(key);
    return (
      <div key={key}>
        <button
          onClick={() => toggleCollapse(key)}
          className="flex items-center gap-2 mb-2 w-full text-left"
        >
          {emoji && <span className="text-xs">{emoji}</span>}
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              isToday ? themeClasses.textActive : themeClasses.textMuted,
            )}
          >
            {label}
          </span>
          <span className="text-[10px] text-white/30 ml-0.5">
            ({items.length})
          </span>
          <ChevronUpIcon
            className={cn(
              "w-3 h-3 text-white/30 ml-auto transition-transform",
              isCollapsed && "rotate-180",
            )}
          />
        </button>
        {!isCollapsed && (
          <div className="flex flex-col gap-2">{items.map(renderItem)}</div>
        )}
      </div>
    );
  };

  // ── Empty (no range items AND no overdue) ──
  if (rangeFiltered.length === 0 && overdueFiltered.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {controlsBar}
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <EmptyCalIcon className="w-10 h-10 text-white/20" />
          <p className={cn("text-sm font-medium", themeClasses.text)}>
            Nothing scheduled
          </p>
          <p className="text-xs text-white/40">No items for this period</p>
        </div>
      </div>
    );
  }

  const modals = (
    <>
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={() => setSelectedItem(null)}
          onDelete={() => {
            handleDelete(selectedItem);
            setSelectedItem(null);
          }}
          currentUserId={currentUserId}
        />
      )}

      {actionsState && (
        <ItemActionsSheet
          item={actionsState.item}
          occurrenceDate={actionsState.occurrenceDate}
          isOpen={!!actionsState}
          onClose={() => setActionsState(null)}
          onComplete={(reason) => {
            handleComplete(
              actionsState.item,
              actionsState.occurrenceDate,
              reason,
            );
            setActionsState(null);
          }}
          onPostpone={(type, reason) => {
            handlePostpone(
              actionsState.item,
              actionsState.occurrenceDate,
              type,
              reason,
            );
            setActionsState(null);
          }}
          onCancel={(reason) => {
            handleCancel(
              actionsState.item,
              actionsState.occurrenceDate,
              reason,
            );
            setActionsState(null);
          }}
          onDelete={() => {
            handleDelete(actionsState.item);
            setActionsState(null);
          }}
        />
      )}
    </>
  );

  // ── Category grouping view ──
  if (groupBy === "category" && categoryGroups) {
    return (
      <>
        {controlsBar}
        {renderOverdueSection()}
        <div className="flex flex-col gap-4">
          {Object.entries(categoryGroups).map(([cat, items]) =>
            renderSection(cat, cat, "🏷", items),
          )}
        </div>
        {modals}
      </>
    );
  }

  // ── Single-day time view ──
  if (isSingleDay && timeGroups) {
    const dayGroups = timeGroups as Record<TimeGroup, ItemWithDetails[]>;
    return (
      <>
        {controlsBar}
        {renderOverdueSection()}
        <div className="flex flex-col gap-4">
          {TIME_GROUP_META.map(({ key, label, emoji }) =>
            renderSection(key, label, emoji, dayGroups[key] || []),
          )}
        </div>
        {modals}
      </>
    );
  }

  // ── Multi-day date view ──
  return (
    <>
      {controlsBar}
      {renderOverdueSection()}
      <div className="flex flex-col gap-4">
        {timeGroups &&
          Object.entries(timeGroups).map(([dayStr, items]) => {
            let dayLabel: string;
            if (dayStr === todayStr) dayLabel = "Today";
            else if (dayStr === tomorrowStr) dayLabel = "Tomorrow";
            else dayLabel = format(parseISO(dayStr), "EEE, MMM d");

            return renderSection(
              dayStr,
              dayLabel,
              undefined,
              items,
              dayStr === todayStr,
            );
          })}
      </div>
      {modals}
    </>
  );
}

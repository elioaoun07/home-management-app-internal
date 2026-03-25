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
  const [selectedItem, setSelectedItem] = useState<ItemWithDetails | null>(
    null,
  );
  const [actionsState, setActionsState] = useState<{
    item: ItemWithDetails;
    occurrenceDate: string;
  } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  // Filter by type
  const typeFiltered = useMemo(() => {
    if (typeFilter === "all") return allItems;
    return allItems.filter((item) => item.type === typeFilter);
  }, [allItems, typeFilter]);

  // Filter by date range
  const rangeFiltered = useMemo(() => {
    return typeFiltered.filter((item) => {
      const dayStr = getItemDayStr(item);
      if (!dayStr) return false;
      return dayStr >= startDate && dayStr <= endDate;
    });
  }, [typeFiltered, startDate, endDate]);

  // Filter by user
  const userFiltered = useMemo(() => {
    if (userFilter === "all" || !currentUserId) return rangeFiltered;
    return rangeFiltered.filter((item) => {
      const isOwner = item.user_id === currentUserId;
      return userFilter === "mine" ? isOwner : !isOwner;
    });
  }, [rangeFiltered, userFilter, currentUserId]);

  // Group
  const groups = useMemo(() => {
    if (isSingleDay) {
      const map: Record<TimeGroup, ItemWithDetails[]> = {
        "all-day": [],
        morning: [],
        afternoon: [],
        evening: [],
        "no-time": [],
      };
      userFiltered.forEach((item) => {
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
      userFiltered.forEach((item) => {
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
  }, [userFiltered, isSingleDay, startDate, endDate]);

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

  // ── Type filter pills ──
  const typeFilterRow = (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide mb-3">
      {TYPE_FILTERS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setTypeFilter(key)}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex-shrink-0 transition-all",
            typeFilter === key
              ? "neo-gradient text-white shadow-sm"
              : `neo-card ${themeClasses.text} hover:bg-white/5`,
          )}
        >
          {label}
        </button>
      ))}
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

  // ── Empty ──
  if (userFiltered.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {typeFilterRow}
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

  // ── Single-day view ──
  if (isSingleDay) {
    const dayGroups = groups as Record<TimeGroup, ItemWithDetails[]>;
    return (
      <>
        {typeFilterRow}
        <div className="flex flex-col gap-4">
          {TIME_GROUP_META.map(({ key, label, emoji }) =>
            renderSection(key, label, emoji, dayGroups[key] || []),
          )}
        </div>

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
  }

  // ── Multi-day view ──
  return (
    <>
      {typeFilterRow}
      <div className="flex flex-col gap-4">
        {Object.entries(groups).map(([dayStr, items]) => {
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
}

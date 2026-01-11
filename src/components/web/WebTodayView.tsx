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
  ListTodo,
  MessageSquare,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
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

// View modes for testing
type ViewMode =
  | "timeline"
  | "cards"
  | "editorial"
  | "minimal"
  | "grid"
  | "agenda"
  | "list"
  | "focus"
  | "kanban";

const viewModeLabels: Record<ViewMode, string> = {
  timeline: "Timeline",
  cards: "Cards",
  editorial: "Editorial",
  minimal: "Minimal",
  grid: "Grid",
  agenda: "Agenda",
  list: "List",
  focus: "Focus",
  kanban: "Kanban",
};

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
  recurrenceRule: { rrule: string }
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
  actions: ItemOccurrenceAction[]
): ExpandedOccurrence[] {
  const result: ExpandedOccurrence[] = [];

  for (const item of items) {
    const itemDate = getItemDate(item);
    if (!itemDate) continue;

    if (item.recurrence_rule?.rrule) {
      try {
        const rruleString = buildFullRRuleString(
          itemDate,
          item.recurrence_rule
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
      actions
    );
    for (const p of dayPostponed) {
      const alreadyExists = result.some(
        (r) =>
          r.item.id === p.item.id &&
          isSameDay(r.occurrenceDate, p.occurrenceDate)
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
    (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime()
  );
}

// ============================================
// MAIN TODAY VIEW - Multi-Mode Experience
// ============================================
export default function WebTodayView() {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const itemActions = useItemActionsWithToast();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [showOverdue, setShowOverdue] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);

  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();

  const today = startOfDay(new Date());
  const currentHour = new Date().getHours();

  // Filter active items
  const activeItems = useMemo(() => {
    return allItems.filter(
      (item) =>
        item.status !== "archived" &&
        item.status !== "cancelled" &&
        !item.archived_at
    );
  }, [allItems]);

  // Get today's tasks and overdue
  const { todayTasks, overdueTasks } = useMemo(() => {
    const todayEnd = addDays(today, 1);
    const todayOccs = expandRecurringItems(
      activeItems,
      today,
      todayEnd,
      occurrenceActions
    );

    const pastStart = addDays(today, -30);
    const allPastOccs = expandRecurringItems(
      activeItems,
      pastStart,
      today,
      occurrenceActions
    );
    const overdueOccs = allPastOccs.filter(
      (occ) => isBefore(occ.occurrenceDate, today) && !occ.isCompleted
    );

    return {
      todayTasks: todayOccs
        .filter((o) => !o.isCompleted)
        .sort(
          (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime()
        ),
      overdueTasks: overdueOccs,
    };
  }, [activeItems, occurrenceActions, today]);

  // Compute day boundaries
  const dayInfo = useMemo(() => {
    if (todayTasks.length === 0) return null;
    const firstTask = todayTasks[0];
    const lastTask = todayTasks[todayTasks.length - 1];
    return {
      startsAt: format(firstTask.occurrenceDate, "h:mm a"),
      endsAt: format(lastTask.occurrenceDate, "h:mm a"),
      totalItems: todayTasks.length,
    };
  }, [todayTasks]);

  // Generate narrative
  const narrative = useMemo(() => {
    if (todayTasks.length === 0) {
      return "You have no scheduled items for today. Your day is completely free.";
    }

    const parts: string[] = [];

    // Opening
    if (todayTasks.length === 1) {
      const task = todayTasks[0];
      parts.push(
        `You have one ${task.item.type} today: "${task.item.title}" at ${format(task.occurrenceDate, "h:mm a")}.`
      );
    } else {
      parts.push(`You have ${todayTasks.length} items scheduled today.`);
      parts.push(
        `Your day starts at ${dayInfo?.startsAt} and your last item is at ${dayInfo?.endsAt}.`
      );
    }

    // List each item with context
    if (todayTasks.length > 1) {
      parts.push("\n\nHere's your schedule:");
      todayTasks.forEach((task, idx) => {
        const time = format(task.occurrenceDate, "h:mm a");
        const desc = task.item.description ? ` — ${task.item.description}` : "";
        parts.push(`\n• ${time}: ${task.item.title}${desc}`);
      });
    }

    // Important reminders
    const thingsToTake = todayTasks.filter(
      (t) =>
        t.item.title.toLowerCase().includes("give") ||
        t.item.title.toLowerCase().includes("bring") ||
        t.item.title.toLowerCase().includes("take") ||
        t.item.title.toLowerCase().includes("deliver")
    );

    if (thingsToTake.length > 0) {
      parts.push("\n\n💡 Don't forget to prepare: ");
      thingsToTake.forEach((t) => {
        parts.push(`"${t.item.title}" (${format(t.occurrenceDate, "h:mm a")})`);
      });
    }

    return parts.join(" ");
  }, [todayTasks, dayInfo]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            isFrost ? "bg-indigo-400" : isPink ? "bg-pink-400" : "bg-cyan-400"
          )}
        />
      </div>
    );
  }

  const accentColor = isFrost ? "indigo" : isPink ? "pink" : "cyan";

  // ==========================================
  // VIEW 1: TIMELINE - Visual journey of your day
  // ==========================================
  const renderTimelineView = () => (
    <div className="px-3 py-3 space-y-0">
      {todayTasks.length === 0 ? (
        <div
          className={cn(
            "text-center py-8",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          <p>Nothing scheduled</p>
        </div>
      ) : (
        todayTasks.map((occ, idx) => {
          const { item, occurrenceDate } = occ;
          const Icon = typeIcons[item.type];
          const isLast = idx === todayTasks.length - 1;

          return (
            <div key={`${item.id}-${idx}`} className="flex gap-3">
              {/* Timeline spine */}
              <div className="flex flex-col items-center w-10 flex-shrink-0">
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums",
                    isFrost ? "text-slate-500" : "text-white/60"
                  )}
                >
                  {format(occurrenceDate, "h:mm")}
                </span>
                <span
                  className={cn(
                    "text-[9px] uppercase",
                    isFrost ? "text-slate-400" : "text-white/30"
                  )}
                >
                  {format(occurrenceDate, "a")}
                </span>
                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "w-px flex-1 my-1.5 min-h-[24px]",
                      isFrost ? "bg-slate-200" : "bg-white/10"
                    )}
                  />
                )}
              </div>

              {/* Content card */}
              <div className={cn("flex-1 pb-3", isLast && "pb-0")}>
                <div
                  className={cn(
                    "rounded-xl p-3",
                    isFrost
                      ? "bg-white shadow-sm border border-slate-100"
                      : "bg-white/[0.03] border border-white/[0.06]"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
                        item.type === "event" &&
                          (isFrost
                            ? "bg-pink-50 text-pink-500"
                            : "bg-pink-500/10 text-pink-400"),
                        item.type === "reminder" &&
                          (isFrost
                            ? "bg-cyan-50 text-cyan-500"
                            : "bg-cyan-500/10 text-cyan-400"),
                        item.type === "task" &&
                          (isFrost
                            ? "bg-purple-50 text-purple-500"
                            : "bg-purple-500/10 text-purple-400")
                      )}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className={cn(
                          "text-sm font-medium leading-tight",
                          isFrost ? "text-slate-800" : "text-white"
                        )}
                      >
                        {item.title}
                      </h3>
                      {item.description && (
                        <p
                          className={cn(
                            "text-xs mt-0.5 line-clamp-2",
                            isFrost ? "text-slate-500" : "text-white/50"
                          )}
                        >
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // ==========================================
  // VIEW 2: CARDS - Compact stacked cards
  // ==========================================
  const renderCardsView = () => (
    <div className="px-3 py-3 space-y-2">
      {todayTasks.length === 0 ? (
        <div
          className={cn(
            "text-center py-8",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          <p>Nothing scheduled</p>
        </div>
      ) : (
        todayTasks.map((occ, idx) => {
          const { item, occurrenceDate } = occ;
          const Icon = typeIcons[item.type];

          return (
            <div
              key={`${item.id}-${idx}`}
              className={cn(
                "rounded-xl p-3",
                isFrost
                  ? "bg-white shadow-sm border border-slate-100"
                  : "bg-white/[0.04] border border-white/[0.08]"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
                      item.type === "event" &&
                        (isFrost
                          ? "bg-pink-50 text-pink-500"
                          : "bg-pink-500/10 text-pink-400"),
                      item.type === "reminder" &&
                        (isFrost
                          ? "bg-cyan-50 text-cyan-500"
                          : "bg-cyan-500/10 text-cyan-400"),
                      item.type === "task" &&
                        (isFrost
                          ? "bg-purple-50 text-purple-500"
                          : "bg-purple-500/10 text-purple-400")
                    )}
                  >
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className={cn(
                        "text-sm font-medium truncate",
                        isFrost ? "text-slate-800" : "text-white"
                      )}
                    >
                      {item.title}
                    </h3>
                    {item.description && (
                      <p
                        className={cn(
                          "text-xs truncate",
                          isFrost ? "text-slate-500" : "text-white/50"
                        )}
                      >
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums flex-shrink-0",
                    isFrost ? "text-slate-500" : "text-white/60"
                  )}
                >
                  {format(occurrenceDate, "h:mm a")}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // ==========================================
  // VIEW 3: EDITORIAL - Newspaper style (compact)
  // ==========================================
  const renderEditorialView = () => (
    <div className="px-3 py-4">
      {/* Masthead */}
      <div
        className={cn(
          "text-center pb-3 mb-3 border-b",
          isFrost ? "border-slate-200" : "border-white/10"
        )}
      >
        <p
          className={cn(
            "text-[10px] uppercase tracking-[0.15em] mb-0.5",
            isFrost ? "text-slate-400" : "text-white/30"
          )}
        >
          {format(today, "EEEE")}
        </p>
        <h1
          className={cn(
            "text-xl font-serif font-bold",
            isFrost ? "text-slate-800" : "text-white"
          )}
        >
          {format(today, "MMMM d, yyyy")}
        </h1>
      </div>

      {todayTasks.length === 0 ? (
        <p
          className={cn(
            "text-center italic py-6 text-sm",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          No appointments for today
        </p>
      ) : (
        <div className="space-y-3">
          {/* Headline */}
          <div
            className={cn(
              "pb-3 border-b",
              isFrost ? "border-slate-100" : "border-white/5"
            )}
          >
            <p
              className={cn(
                "text-xs mb-0.5",
                isFrost ? "text-slate-500" : "text-white/50"
              )}
            >
              {format(todayTasks[0].occurrenceDate, "h:mm a")}
            </p>
            <h2
              className={cn(
                "text-lg font-serif font-bold leading-tight",
                isFrost ? "text-slate-800" : "text-white"
              )}
            >
              {todayTasks[0].item.title}
            </h2>
            {todayTasks[0].item.description && (
              <p
                className={cn(
                  "mt-1 text-sm leading-relaxed",
                  isFrost ? "text-slate-600" : "text-white/60"
                )}
              >
                {todayTasks[0].item.description}
              </p>
            )}
          </div>

          {/* Secondary items */}
          {todayTasks.length > 1 && (
            <div className="space-y-1.5">
              <p
                className={cn(
                  "text-[10px] uppercase tracking-wider",
                  isFrost ? "text-slate-400" : "text-white/30"
                )}
              >
                Also Today
              </p>
              {todayTasks.slice(1).map((occ, idx) => (
                <div
                  key={`${occ.item.id}-${idx}`}
                  className="flex gap-2 py-1.5"
                >
                  <span
                    className={cn(
                      "text-xs tabular-nums w-12 flex-shrink-0",
                      isFrost ? "text-slate-400" : "text-white/40"
                    )}
                  >
                    {format(occ.occurrenceDate, "h:mm a")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isFrost ? "text-slate-700" : "text-white/90"
                      )}
                    >
                      {occ.item.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ==========================================
  // VIEW 4: MINIMAL - Ultra clean list
  // ==========================================
  const renderMinimalView = () => (
    <div className="px-3 py-3">
      {todayTasks.length === 0 ? (
        <p
          className={cn(
            "text-center py-8",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          Nothing today
        </p>
      ) : (
        <div className="space-y-0">
          {todayTasks.map((occ, idx) => (
            <div
              key={`${occ.item.id}-${idx}`}
              className={cn(
                "flex items-baseline gap-3 py-2",
                idx > 0 && "border-t",
                isFrost ? "border-slate-100" : "border-white/[0.04]"
              )}
            >
              <span
                className={cn(
                  "text-xs tabular-nums w-14 flex-shrink-0",
                  isFrost ? "text-slate-400" : "text-white/40"
                )}
              >
                {format(occ.occurrenceDate, "h:mm a")}
              </span>
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "text-sm",
                    isFrost ? "text-slate-800" : "text-white"
                  )}
                >
                  {occ.item.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ==========================================
  // VIEW 5: GRID - 2-column card grid (full width usage)
  // ==========================================
  const renderGridView = () => (
    <div className="px-3 py-3">
      {todayTasks.length === 0 ? (
        <div
          className={cn(
            "text-center py-8",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          <p>Nothing scheduled</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {todayTasks.map((occ, idx) => {
            const { item, occurrenceDate } = occ;
            const Icon = typeIcons[item.type];

            return (
              <div
                key={`${item.id}-${idx}`}
                className={cn(
                  "rounded-xl p-3 flex flex-col",
                  isFrost
                    ? "bg-white shadow-sm border border-slate-100"
                    : "bg-white/[0.04] border border-white/[0.08]",
                  item.type === "event" &&
                    (isFrost
                      ? "border-l-2 border-l-pink-400"
                      : "border-l-2 border-l-pink-500"),
                  item.type === "reminder" &&
                    (isFrost
                      ? "border-l-2 border-l-cyan-400"
                      : "border-l-2 border-l-cyan-500"),
                  item.type === "task" &&
                    (isFrost
                      ? "border-l-2 border-l-purple-400"
                      : "border-l-2 border-l-purple-500")
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={cn(
                      "text-[10px] font-medium tabular-nums",
                      isFrost ? "text-slate-400" : "text-white/50"
                    )}
                  >
                    {format(occurrenceDate, "h:mm a")}
                  </span>
                  <Icon
                    className={cn(
                      "w-3 h-3",
                      item.type === "event" &&
                        (isFrost ? "text-pink-400" : "text-pink-400"),
                      item.type === "reminder" &&
                        (isFrost ? "text-cyan-400" : "text-cyan-400"),
                      item.type === "task" &&
                        (isFrost ? "text-purple-400" : "text-purple-400")
                    )}
                  />
                </div>
                <h3
                  className={cn(
                    "text-sm font-medium leading-tight flex-1",
                    isFrost ? "text-slate-800" : "text-white"
                  )}
                >
                  {item.title}
                </h3>
                {item.description && (
                  <p
                    className={cn(
                      "text-[11px] mt-1 line-clamp-2",
                      isFrost ? "text-slate-500" : "text-white/40"
                    )}
                  >
                    {item.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ==========================================
  // VIEW 6: AGENDA - Horizontal time blocks
  // ==========================================
  const renderAgendaView = () => {
    // Group by morning/afternoon/evening
    const morning = todayTasks.filter((t) => t.occurrenceDate.getHours() < 12);
    const afternoon = todayTasks.filter(
      (t) =>
        t.occurrenceDate.getHours() >= 12 && t.occurrenceDate.getHours() < 17
    );
    const evening = todayTasks.filter((t) => t.occurrenceDate.getHours() >= 17);

    const renderBlock = (label: string, items: ExpandedOccurrence[]) => {
      if (items.length === 0) return null;
      return (
        <div className="mb-3">
          <div
            className={cn(
              "text-[10px] uppercase tracking-wider mb-1.5 px-1",
              isFrost ? "text-slate-400" : "text-white/30"
            )}
          >
            {label}{" "}
            <span className={cn(isFrost ? "text-slate-300" : "text-white/20")}>
              ({items.length})
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {items.map((occ, idx) => {
              const { item, occurrenceDate } = occ;
              const Icon = typeIcons[item.type];
              return (
                <div
                  key={`${item.id}-${idx}`}
                  className={cn(
                    "flex-shrink-0 w-36 rounded-xl p-2.5",
                    isFrost
                      ? "bg-white shadow-sm border border-slate-100"
                      : "bg-white/[0.04] border border-white/[0.08]"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div
                      className={cn(
                        "w-5 h-5 rounded flex items-center justify-center",
                        item.type === "event" &&
                          (isFrost
                            ? "bg-pink-50 text-pink-500"
                            : "bg-pink-500/10 text-pink-400"),
                        item.type === "reminder" &&
                          (isFrost
                            ? "bg-cyan-50 text-cyan-500"
                            : "bg-cyan-500/10 text-cyan-400"),
                        item.type === "task" &&
                          (isFrost
                            ? "bg-purple-50 text-purple-500"
                            : "bg-purple-500/10 text-purple-400")
                      )}
                    >
                      <Icon className="w-2.5 h-2.5" />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] tabular-nums",
                        isFrost ? "text-slate-400" : "text-white/50"
                      )}
                    >
                      {format(occurrenceDate, "h:mm a")}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-xs font-medium leading-tight line-clamp-2",
                      isFrost ? "text-slate-800" : "text-white"
                    )}
                  >
                    {item.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="px-3 py-3">
        {todayTasks.length === 0 ? (
          <div
            className={cn(
              "text-center py-8",
              isFrost ? "text-slate-400" : "text-white/40"
            )}
          >
            <p>Nothing scheduled</p>
          </div>
        ) : (
          <>
            {renderBlock("Morning", morning)}
            {renderBlock("Afternoon", afternoon)}
            {renderBlock("Evening", evening)}
          </>
        )}
      </div>
    );
  };

  // ==========================================
  // VIEW 7: LIST - Detailed rows
  // ==========================================
  const renderListView = () => (
    <div className="px-0 py-2">
      {todayTasks.length === 0 ? (
        <p
          className={cn(
            "text-center py-8",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          Nothing scheduled
        </p>
      ) : (
        <div
          className={cn(
            "divide-y",
            isFrost ? "divide-slate-100" : "divide-white/[0.04]"
          )}
        >
          {todayTasks.map((occ, idx) => {
            const { item, occurrenceDate } = occ;
            const Icon = typeIcons[item.type];
            return (
              <div
                key={`${item.id}-${idx}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]",
                  isFrost ? "hover:bg-slate-50" : "hover:bg-white/[0.02]"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    item.type === "event" &&
                      (isFrost
                        ? "bg-pink-100/50 text-pink-600"
                        : "bg-pink-500/10 text-pink-400"),
                    item.type === "reminder" &&
                      (isFrost
                        ? "bg-cyan-100/50 text-cyan-600"
                        : "bg-cyan-500/10 text-cyan-400"),
                    item.type === "task" &&
                      (isFrost
                        ? "bg-purple-100/50 text-purple-600"
                        : "bg-purple-500/10 text-purple-400")
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3
                      className={cn(
                        "text-sm font-medium truncate",
                        isFrost ? "text-slate-900" : "text-white"
                      )}
                    >
                      {item.title}
                    </h3>
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded",
                        isFrost
                          ? "bg-slate-100 text-slate-500"
                          : "bg-white/10 text-white/50"
                      )}
                    >
                      {item.type}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-xs truncate",
                      isFrost ? "text-slate-500" : "text-white/50"
                    )}
                  >
                    {item.description || "No description"}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      isFrost ? "text-slate-700" : "text-white/80"
                    )}
                  >
                    {format(occurrenceDate, "h:mm a")}
                  </p>
                  <p
                    className={cn(
                      "text-[10px]",
                      isFrost ? "text-slate-400" : "text-white/30"
                    )}
                  >
                    {format(occurrenceDate, "MMM d")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ==========================================
  // VIEW 8: FOCUS - Spotlight on next task
  // ==========================================
  const renderFocusView = () => {
    // Determine the "active" task (next one based on current time)
    const now = new Date();
    // Assuming todayTasks are sorted by time already
    // Find first task that is active or in future
    // In a real app we might want to check if end time is passed, but here we just check start time vs now or just show first one
    const activeIndex =
      todayTasks.findIndex((t) => t.occurrenceDate > now) !== -1
        ? todayTasks.findIndex((t) => t.occurrenceDate > now)
        : todayTasks.length > 0
          ? todayTasks.length - 1
          : -1;

    // If all tasks passed today, show the last one, or a "done" state.
    // Let's just default to the first one if we can't decide, or the one closest to now.
    // Actually, simple logic: show the NEXT one.

    const nextTask =
      todayTasks.find((t) => t.occurrenceDate >= now) ||
      todayTasks[todayTasks.length - 1];

    // For the list below, show subsequent tasks
    const laterTasks = nextTask
      ? todayTasks.filter(
          (t) => t.occurrenceDate.getTime() > nextTask.occurrenceDate.getTime()
        )
      : [];

    if (!nextTask) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
          <div
            className={cn(
              "p-4 rounded-full mb-4",
              isFrost
                ? "bg-slate-100 text-slate-400"
                : "bg-white/5 text-white/20"
            )}
          >
            <Calendar className="w-8 h-8" />
          </div>
          <p className={cn(isFrost ? "text-slate-500" : "text-white/50")}>
            No upcoming tasks
          </p>
        </div>
      );
    }

    const Icon = typeIcons[nextTask.item.type];

    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex flex-col justify-center p-6 text-center">
          <div
            className={cn(
              "text-xs font-medium uppercase tracking-widest mb-4",
              isFrost ? "text-slate-400" : "text-white/40"
            )}
          >
            Up Next
          </div>
          <div
            className={cn(
              "w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg",
              nextTask.item.type === "event" &&
                (isFrost
                  ? "bg-pink-100 text-pink-500 shadow-pink-200"
                  : "bg-pink-500/20 text-pink-400 shadow-pink-900/20"),
              nextTask.item.type === "reminder" &&
                (isFrost
                  ? "bg-cyan-100 text-cyan-500 shadow-cyan-200"
                  : "bg-cyan-500/20 text-cyan-400 shadow-cyan-900/20"),
              nextTask.item.type === "task" &&
                (isFrost
                  ? "bg-purple-100 text-purple-500 shadow-purple-200"
                  : "bg-purple-500/20 text-purple-400 shadow-purple-900/20")
            )}
          >
            <Icon className="w-8 h-8" />
          </div>
          <h2
            className={cn(
              "text-2xl font-bold mb-2",
              isFrost ? "text-slate-800" : "text-white"
            )}
          >
            {nextTask.item.title}
          </h2>
          <p
            className={cn(
              "text-xl font-medium tabular-nums mb-4",
              isFrost ? "text-slate-500" : "text-white/60"
            )}
          >
            {format(nextTask.occurrenceDate, "h:mm a")}
          </p>
          {nextTask.item.description && (
            <p
              className={cn(
                "text-sm max-w-xs mx-auto",
                isFrost ? "text-slate-400" : "text-white/40"
              )}
            >
              {nextTask.item.description}
            </p>
          )}
        </div>

        {laterTasks.length > 0 && (
          <div
            className={cn(
              "flex-shrink-0 p-4 border-t",
              isFrost
                ? "bg-slate-50 border-slate-100"
                : "bg-black/20 border-white/5"
            )}
          >
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wider mb-3",
                isFrost ? "text-slate-400" : "text-white/30"
              )}
            >
              Later
            </p>
            <div className="space-y-2">
              {laterTasks.slice(0, 3).map((occ, idx) => (
                <div
                  key={`${occ.item.id}-${idx}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className={cn(isFrost ? "text-slate-600" : "text-white/70")}
                  >
                    {occ.item.title}
                  </span>
                  <span
                    className={cn(
                      isFrost ? "text-slate-400" : "text-white/30",
                      "text-xs tabular-nums"
                    )}
                  >
                    {format(occ.occurrenceDate, "h:mm a")}
                  </span>
                </div>
              ))}
              {laterTasks.length > 3 && (
                <p
                  className={cn(
                    "text-xs text-center pt-1",
                    isFrost ? "text-slate-400" : "text-white/30"
                  )}
                >
                  + {laterTasks.length - 3} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // VIEW 9: KANBAN - Columnar view
  // ==========================================
  const renderKanbanView = () => {
    // Group by morning/afternoon/evening
    const morning = todayTasks.filter((t) => t.occurrenceDate.getHours() < 12);
    const afternoon = todayTasks.filter(
      (t) =>
        t.occurrenceDate.getHours() >= 12 && t.occurrenceDate.getHours() < 17
    );
    const evening = todayTasks.filter((t) => t.occurrenceDate.getHours() >= 17);

    const renderColumn = (
      label: string,
      items: ExpandedOccurrence[],
      colorClass: string
    ) => (
      <div
        className={cn(
          "flex-shrink-0 w-64 flex flex-col rounded-xl h-full overflow-hidden border",
          isFrost
            ? "bg-slate-50 border-slate-200"
            : "bg-white/[0.02] border-white/[0.06]"
        )}
      >
        <div
          className={cn(
            "px-3 py-2 border-b flex items-center justify-between",
            isFrost ? "border-slate-200" : "border-white/[0.06]"
          )}
        >
          <span
            className={cn(
              "font-medium text-xs",
              isFrost ? "text-slate-600" : "text-white/70"
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full",
              isFrost
                ? "bg-slate-200 text-slate-600"
                : "bg-white/10 text-white/50"
            )}
          >
            {items.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {items.map((occ, idx) => {
            const { item, occurrenceDate } = occ;
            const Icon = typeIcons[item.type];
            return (
              <div
                key={`${item.id}-${idx}`}
                className={cn(
                  "p-2.5 rounded-lg border",
                  isFrost
                    ? "bg-white border-slate-200 shadow-sm"
                    : "bg-black/40 border-white/5"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded",
                      colorClass
                    )}
                  >
                    {format(occurrenceDate, "h:mm a")}
                  </span>
                  {occ.isCompleted && (
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  )}
                </div>
                <p
                  className={cn(
                    "text-sm font-medium leading-tight mb-1",
                    isFrost ? "text-slate-800" : "text-white"
                  )}
                >
                  {item.title}
                </p>
                {item.description && (
                  <p
                    className={cn(
                      "text-[10px] line-clamp-2",
                      isFrost ? "text-slate-400" : "text-white/40"
                    )}
                  >
                    {item.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="h-full overflow-x-auto p-3 flex gap-3 items-stretch">
        {renderColumn(
          "Morning",
          morning,
          isFrost
            ? "bg-amber-100 text-amber-700"
            : "bg-amber-500/20 text-amber-300"
        )}
        {renderColumn(
          "Afternoon",
          afternoon,
          isFrost ? "bg-sky-100 text-sky-700" : "bg-sky-500/20 text-sky-300"
        )}
        {renderColumn(
          "Evening",
          evening,
          isFrost
            ? "bg-indigo-100 text-indigo-700"
            : "bg-indigo-500/20 text-indigo-300"
        )}
      </div>
    );
  };

  // Render the active view
  const renderActiveView = () => {
    switch (viewMode) {
      case "timeline":
        return renderTimelineView();
      case "cards":
        return renderCardsView();
      case "editorial":
        return renderEditorialView();
      case "minimal":
        return renderMinimalView();
      case "grid":
        return renderGridView();
      case "agenda":
        return renderAgendaView();
      case "list":
        return renderListView();
      case "focus":
        return renderFocusView();
      case "kanban":
        return renderKanbanView();
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with view toggle and overdue badge */}
      <div
        className={cn(
          "flex-shrink-0 px-3 py-2 flex items-center justify-between gap-2",
          isFrost
            ? "bg-slate-50 border-b border-slate-100"
            : "bg-white/[0.02] border-b border-white/[0.04]"
        )}
      >
        {/* Day info */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium",
              isFrost ? "text-slate-700" : "text-white/80"
            )}
          >
            {format(today, "EEE, MMM d")}
          </p>
          {dayInfo && (
            <p
              className={cn(
                "text-[11px]",
                isFrost ? "text-slate-400" : "text-white/40"
              )}
            >
              {dayInfo.totalItems} {dayInfo.totalItems === 1 ? "item" : "items"}{" "}
              · {dayInfo.startsAt} – {dayInfo.endsAt}
            </p>
          )}
        </div>

        {/* Overdue badge */}
        {overdueTasks.length > 0 && (
          <button
            type="button"
            onClick={() => setShowOverdue(!showOverdue)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors",
              showOverdue
                ? isFrost
                  ? "bg-amber-100 text-amber-700"
                  : "bg-amber-500/20 text-amber-300"
                : isFrost
                  ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
                  : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
            )}
          >
            <AlertCircle className="w-3 h-3" />
            {overdueTasks.length}
          </button>
        )}

        {/* Narrative toggle */}
        <button
          type="button"
          onClick={() => setShowNarrative(!showNarrative)}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            showNarrative
              ? isFrost
                ? "bg-indigo-100 text-indigo-600"
                : "bg-cyan-500/20 text-cyan-400"
              : isFrost
                ? "text-slate-400 hover:bg-slate-100"
                : "text-white/40 hover:bg-white/[0.05]"
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* View mode toggle (TEMPORARY) */}
      <div
        className={cn(
          "flex-shrink-0 px-3 py-1.5 flex gap-1 overflow-x-auto",
          isFrost ? "bg-slate-50/50" : "bg-white/[0.01]"
        )}
      >
        {(Object.keys(viewModeLabels) as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={cn(
              "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
              viewMode === mode
                ? isFrost
                  ? "bg-indigo-500 text-white"
                  : isPink
                    ? "bg-pink-500 text-white"
                    : "bg-cyan-500 text-black"
                : isFrost
                  ? "text-slate-500 hover:bg-slate-100"
                  : "text-white/50 hover:bg-white/[0.05]"
            )}
          >
            {viewModeLabels[mode]}
          </button>
        ))}
      </div>

      {/* Overdue panel (expandable) */}
      {showOverdue && overdueTasks.length > 0 && (
        <div
          className={cn(
            "flex-shrink-0 mx-3 mt-2 rounded-lg overflow-hidden",
            isFrost
              ? "bg-amber-50 border border-amber-100"
              : "bg-amber-500/5 border border-amber-500/10"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between px-2.5 py-1.5",
              isFrost
                ? "border-b border-amber-100"
                : "border-b border-amber-500/10"
            )}
          >
            <span
              className={cn(
                "text-[11px] font-medium",
                isFrost ? "text-amber-700" : "text-amber-400"
              )}
            >
              Overdue Items
            </span>
            <button
              type="button"
              onClick={() => setShowOverdue(false)}
              className={cn(
                "p-0.5 rounded",
                isFrost
                  ? "hover:bg-amber-100 text-amber-500"
                  : "hover:bg-amber-500/10 text-amber-400"
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="max-h-24 overflow-y-auto px-2.5 py-1.5 space-y-0.5">
            {overdueTasks.map((occ, idx) => (
              <div
                key={`overdue-${occ.item.id}-${idx}`}
                className="flex items-center gap-2 text-xs py-0.5"
              >
                <span
                  className={cn(
                    "text-[10px] w-10 flex-shrink-0",
                    isFrost ? "text-amber-600" : "text-amber-400/70"
                  )}
                >
                  {format(occ.occurrenceDate, "MMM d")}
                </span>
                <span
                  className={cn(
                    "truncate",
                    isFrost ? "text-amber-800" : "text-amber-300"
                  )}
                >
                  {occ.item.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative panel (expandable) */}
      {showNarrative && (
        <div
          className={cn(
            "flex-shrink-0 mx-3 mt-2 rounded-lg p-3",
            isFrost
              ? "bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100"
              : isPink
                ? "bg-gradient-to-br from-pink-500/5 to-purple-500/5 border border-pink-500/10"
                : "bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/10"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-xs leading-relaxed whitespace-pre-wrap",
                isFrost ? "text-slate-600" : "text-white/70"
              )}
            >
              {narrative}
            </p>
            <button
              type="button"
              onClick={() => setShowNarrative(false)}
              className={cn(
                "p-0.5 rounded flex-shrink-0",
                isFrost
                  ? "hover:bg-indigo-100 text-indigo-400"
                  : "hover:bg-white/10 text-white/40"
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">{renderActiveView()}</div>
    </div>
  );
}

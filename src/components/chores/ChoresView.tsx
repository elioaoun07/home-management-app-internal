"use client";

import { ChoreCheckInPanel } from "@/components/chores/ChoreCheckInPanel";
import { ChoreRow } from "@/components/chores/ChoreRow";
import {
  ChoreSheet,
  type ChoreSheetPersonAction,
} from "@/components/chores/ChoreSheet";
import {
  ChoreTodoRow,
  type ChoreHousehold,
} from "@/components/chores/ChoreTodoRow";
import type { ChoreSwipeSide } from "@/components/chores/ChoreSwipe";
import {
  formatDayHeading,
  personTone,
  useChoreTone,
  type ChorePerson,
} from "@/components/chores/choreUi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { useCatalogueItems, useHomeRooms } from "@/features/catalogue";
import {
  moveDayOptions,
  type ChoreDayOption,
  type ChoreSlot,
  type ChoreTodo,
} from "@/features/chores/choreWeek";
import {
  useChoreAssign,
  useChoreResponsibility,
} from "@/features/chores/useChoreActions";
import { useChoreWeek } from "@/features/chores/useChores";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { cn } from "@/lib/utils";
import type { CatalogueItem, HomeRoom } from "@/types/catalogue";
import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";
import {
  BookOpen,
  CalendarCheck2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Plus,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type PersonFilter = "all" | "mine" | "partner";
const EMPTY_TEMPLATES: CatalogueItem[] = [];
const EMPTY_ROOMS: HomeRoom[] = [];
const WEEK_OPEN_KEY = "chores.weekOpen";
export const CHORE_LIBRARY_HREF = "/catalogue?section=chores";

function firstName(name: string | undefined): string {
  return (name ?? "").split(/[\s@]/)[0] || "?";
}

function weekLabel(weekStart: string, weekEnd: string): string {
  const start = parseISO(weekStart);
  const end = parseISO(weekEnd);
  return start.getMonth() === end.getMonth()
    ? `${format(start, "MMM d")} – ${format(end, "d")}`
    : `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

interface ChoresViewProps {
  /** yyyy-MM-dd inside the week to open on */
  initialDate?: string;
  variant?: "mobile" | "web";
}

export default function ChoresView({
  initialDate,
  variant = "mobile",
}: ChoresViewProps) {
  const tone = useChoreTone();
  const { theme } = useTheme();
  const [weekOf, setWeekOf] = useState<Date>(() =>
    initialDate ? parseISO(initialDate) : new Date(),
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(
    () =>
      initialDate ??
      (variant === "mobile" ? format(new Date(), "yyyy-MM-dd") : null),
  );
  const [filter, setFilter] = useState<PersonFilter>("all");
  const [openTodo, setOpenTodo] = useState<string | null>(null);
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [weekOpen, setWeekOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(WEEK_OPEN_KEY) === "0") setWeekOpen(false);
    } catch {
      // per-viewer convenience only
    }
  }, []);
  const [planOpen, setPlanOpen] = useState(false);
  // Day the plan dialog assigns to in one tap; null = pick a day per chore
  const [planTarget, setPlanTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const planButtonRef = useRef<HTMLButtonElement>(null);

  const catalogue = useCatalogueItems();
  const templates = catalogue.data ?? EMPTY_TEMPLATES;
  const rooms = useHomeRooms().data ?? EMPTY_ROOMS;
  const { data: household } = useHouseholdMembers();
  const chores = useChoreWeek(weekOf, templates, rooms);
  const { week, todayKey, isCurrentWeek } = chores;
  const assign = useChoreAssign(chores.schedules);
  const responsibility = useChoreResponsibility();
  const currentUserId = household?.currentUserId ?? null;
  const me = household?.members.find((m) => m.isCurrentUser);
  const partner = household?.members.find((m) => !m.isCurrentUser) ?? null;
  const myColor = theme === "pink" ? "pink" : "blue";
  const partnerColor = myColor === "pink" ? "blue" : "pink";

  const meP: ChoreHousehold | null = currentUserId
    ? { id: currentUserId, label: "Me", color: myColor }
    : null;
  const partnerP: ChoreHousehold | null = partner
    ? {
        id: partner.id,
        label: firstName(partner.displayName),
        color: partnerColor,
      }
    : null;
  const personFor = (userId: string | null | undefined): ChorePerson | null => {
    if (!userId) return null;
    if (userId === currentUserId)
      return { label: firstName(me?.displayName), color: myColor };
    if (partner && userId === partner.id)
      return { label: firstName(partner.displayName), color: partnerColor };
    return null;
  };
  const matches = (userId: string | null | undefined) => {
    if (filter === "all" || !currentUserId) return true;
    if (filter === "mine") return userId === currentUserId;
    return !!userId && userId !== currentUserId;
  };

  const visible = week.slots.filter((slot) =>
    matches(slot.item.responsible_user_id),
  );
  const openSlots = visible.filter((slot) => !slot.done);
  const doneSlots = visible.filter((slot) => slot.done);
  const completed = selectedDay
    ? doneSlots.filter((slot) => slot.date === selectedDay)
    : doneSlots;
  const todos = week.todos.filter((todo) => matches(todo.responsibleUserId));
  const searchTerm = search.trim().toLocaleLowerCase();
  const filteredTodos = todos.filter((todo) =>
    todo.title.toLocaleLowerCase().includes(searchTerm),
  );
  // To plan, grouped by room (todos are already sorted by room, then title)
  const todoGroups: { room: string | null; todos: ChoreTodo[] }[] = [];
  for (const todo of filteredTodos) {
    const last = todoGroups[todoGroups.length - 1];
    if (last && last.room === todo.room) last.todos.push(todo);
    else todoGroups.push({ room: todo.room, todos: [todo] });
  }
  const checkIn = chores.checkIn.filter((slot) =>
    matches(slot.item.responsible_user_id),
  );
  const allSlots = [...week.slots, ...chores.overdue, ...chores.checkIn];
  const sheetSlot = sheetKey
    ? (allSlots.find((slot) => slot.key === sheetKey) ?? null)
    : null;
  const moveDays = sheetSlot
    ? moveDayOptions(sheetSlot, week.days, chores.schedules, todayKey)
    : [];

  const personActionFor = (slot: ChoreSlot): ChoreSheetPersonAction | null => {
    if (!partner || !currentUserId) return null;
    return slot.item.responsible_user_id === currentUserId
      ? { label: `To ${firstName(partner.displayName)}`, userId: partner.id }
      : { label: "Take it", userId: currentUserId };
  };
  const pickDay = async (
    todo: ChoreTodo,
    option: ChoreDayOption,
    time: string | null,
    userId: string | undefined,
  ) => {
    if (todo.kind === "flexible" && todo.item && option.periodStart) {
      await assign.placeFlexible(
        todo.item,
        option.periodStart,
        option.date,
        time,
        userId,
      );
    } else if (todo.kind === "template" && todo.template) {
      await assign.placeTemplate(
        todo.template,
        option.date,
        time,
        userId,
        todo.roomId && todo.room ? { id: todo.roomId, name: todo.room } : undefined,
      );
    } else if (todo.kind === "undated" && todo.item) {
      await assign.placeUndated(todo.item, option.date, time, userId);
    }
    setOpenTodo(null);
  };
  const reassign = (slot: ChoreSlot, side: ChoreSwipeSide) => {
    const to = side === "me" ? meP : partnerP;
    if (!to || slot.item.responsible_user_id === to.id) return;
    responsibility.setResponsible(slot.item, to.id, to.label);
  };
  const changeWeek = (next: Date) => {
    if (selectedDay) {
      const dayOffset = differenceInCalendarDays(
        parseISO(selectedDay),
        parseISO(week.weekStart),
      );
      setSelectedDay(
        format(
          addDays(startOfWeek(next, { weekStartsOn: 1 }), dayOffset),
          "yyyy-MM-dd",
        ),
      );
    }
    setWeekOf(next);
    setOpenTodo(null);
  };
  const goToday = () => {
    setWeekOf(new Date());
    setSelectedDay(todayKey);
    setOpenTodo(null);
  };

  const iconButton = cn(
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors active:scale-95 motion-reduce:transform-none",
    tone.ghost,
    tone.focus,
  );
  const dateRange = weekLabel(week.weekStart, week.weekEnd);
  const dayViewSlots = selectedDay
    ? openSlots.filter((slot) => slot.date === selectedDay)
    : [];
  const renderSlot = (slot: ChoreSlot, showDay?: "weekday" | "date") => (
    <ChoreRow
      key={slot.key}
      slot={slot}
      person={personFor(slot.item.responsible_user_id)}
      showDay={showDay}
      me={slot.item.responsible_user_id === meP?.id ? null : meP}
      partner={slot.item.responsible_user_id === partnerP?.id ? null : partnerP}
      onReassign={(side) => reassign(slot, side)}
      onOpen={() => setSheetKey(slot.key)}
    />
  );

  const openPlan = (target: string | null) => {
    setPlanTarget(target && target >= todayKey ? target : todayKey);
    setOpenTodo(null);
    setPlanOpen(true);
  };
  const shiftPlanWeek = (delta: number) => {
    changeWeek(addWeeks(weekOf, delta));
    if (planTarget) {
      const next = format(addWeeks(parseISO(planTarget), delta), "yyyy-MM-dd");
      setPlanTarget(next >= todayKey ? next : null);
    }
  };
  const renderPlanning = (targetDate: string | null = null) => (
    <div className="space-y-3">
      {(todos.length > 4 || search) && (
        <label
          className={cn(
            "flex h-11 items-center gap-2 rounded-xl border px-3",
            tone.border,
            tone.tc.bgPage,
          )}
        >
          <Search className={cn("h-4 w-4 shrink-0", tone.subtle)} aria-hidden />
          <span className="sr-only">Search chores to assign</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a chore"
            className={cn(
              "h-full min-w-0 flex-1 rounded-lg bg-transparent text-sm",
              tone.main,
              tone.focus,
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                tone.soft,
                tone.focus,
              )}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      )}
      {catalogue.isError && (
        <div
          className={cn(
            "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
            tone.border,
          )}
        >
          <span className={cn("text-xs", tone.soft)}>Library unavailable</span>
          <button
            type="button"
            onClick={() => catalogue.refetch()}
            className={cn(
              "h-10 rounded-lg px-3 text-xs font-semibold",
              tone.ghost,
              tone.focus,
            )}
          >
            Retry
          </button>
        </div>
      )}
      {catalogue.isLoading && (
        <div
          role="status"
          className={cn("rounded-xl px-3 py-4 text-xs", tone.soft)}
        >
          Loading library…
        </div>
      )}
      {todoGroups.map(({ room, todos: roomTodos }) => (
        <div key={room ?? "none"} className="space-y-3">
          {todoGroups.length > 1 && (
            <h3
              className={cn(
                "px-1 pt-1 text-[11px] font-semibold uppercase tracking-wider",
                tone.subtle,
              )}
            >
              {room ?? "Other"}
            </h3>
          )}
          {roomTodos.map((todo) => (
            <ChoreTodoRow
              key={`${todo.key}:${week.weekStart}:${targetDate ?? ""}`}
              todo={todo}
              person={personFor(todo.responsibleUserId)}
              me={meP}
              partner={partnerP}
              open={openTodo === todo.key}
              pending={assign.isPending}
              targetDate={targetDate}
              onOpenChange={(open) => setOpenTodo(open ? todo.key : null)}
              onAssign={(option, time, userId) =>
                pickDay(todo, option, time, userId)
              }
            />
          ))}
        </div>
      ))}
      {filteredTodos.length === 0 &&
        !catalogue.isLoading &&
        !catalogue.isError && (
          <div className="flex flex-col items-center gap-2 py-7 text-center">
            <ClipboardList className={cn("h-6 w-6", tone.subtle)} aria-hidden />
            <p className={cn("text-sm font-medium", tone.soft)}>
              {searchTerm ? "No matches" : "Nothing to assign"}
            </p>
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className={cn(
                  "h-10 rounded-xl px-3 text-xs font-medium",
                  tone.ghost,
                  tone.focus,
                )}
              >
                Clear
              </button>
            ) : (
              <Link
                href={CHORE_LIBRARY_HREF}
                className={cn(
                  "flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-medium",
                  tone.ghost,
                  tone.focus,
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Library
              </Link>
            )}
          </div>
        )}
    </div>
  );
  const emptyAgenda = (label: string) => (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center sm:py-14">
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl border",
          tone.accentSurface,
          tone.accent,
        )}
      >
        <CalendarCheck2 className="h-6 w-6" aria-hidden />
      </span>
      <p className={cn("text-sm font-medium", tone.soft)}>{label}</p>
      {filter !== "all" ? (
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "h-11 rounded-xl px-4 text-xs font-semibold",
            tone.ghost,
            tone.focus,
          )}
        >
          Show all
        </button>
      ) : todos.length > 0 ? (
        <button
          type="button"
          onClick={() => openPlan(selectedDay)}
          className={cn(
            "flex h-11 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold lg:hidden",
            tone.selected,
            tone.focus,
          )}
        >
          <Plus className="h-4 w-4" />
          Assign
        </button>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        "mx-auto space-y-5",
        variant === "web"
          ? "max-w-7xl px-5 py-6 xl:px-8"
          : "max-w-7xl px-4 pb-28 pt-3",
      )}
    >
      {partnerP && (
        <div
          className={cn("flex border-b", tone.border)}
          role="group"
          aria-label="Person filter"
        >
          {(
            [
              { key: "mine", label: "Me", color: myColor },
              { key: "all", label: "Both", color: null },
              { key: "partner", label: partnerP.label, color: partnerColor },
            ] as const
          ).map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "-mb-px h-11 min-w-0 flex-1 truncate border-b-2 px-2 text-xs font-semibold transition-colors",
                tone.focus,
                filter !== key
                  ? cn("border-transparent", tone.subtle)
                  : color
                    ? personTone(color, tone.isFrost).tab
                    : cn("border-current", tone.accent),
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <section
        className={cn("rounded-3xl border p-3 sm:p-4", tone.panel)}
        aria-label="Chore week"
      >
        <div className={cn("flex items-center gap-2", weekOpen && "mb-4")}>
          <div className="min-w-0 flex-1 pl-1">
            <p
              className={cn(
                "text-sm font-semibold tracking-tight sm:text-lg",
                tone.main,
              )}
            >
              {dateRange}
            </p>
            <p className={cn("mt-0.5 text-[11px] tabular-nums", tone.subtle)}>
              {chores.isLoading
                ? "Loading…"
                : `${doneSlots.length}/${visible.length} done`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => changeWeek(addWeeks(weekOf, -1))}
            aria-label="Previous week"
            className={iconButton}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => changeWeek(addWeeks(weekOf, 1))}
            aria-label="Next week"
            className={iconButton}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Link
            href={CHORE_LIBRARY_HREF}
            aria-label="Chore library"
            title="Library"
            className={cn(iconButton, tone.accent)}
          >
            <BookOpen className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => {
              const next = !weekOpen;
              setWeekOpen(next);
              try {
                localStorage.setItem(WEEK_OPEN_KEY, next ? "1" : "0");
              } catch {
                // per-viewer convenience only
              }
            }}
            aria-expanded={weekOpen}
            aria-label={weekOpen ? "Hide days" : "Show days"}
            className={iconButton}
          >
            {weekOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        {weekOpen && (
          <div
            className="grid grid-cols-7 gap-1 sm:gap-2"
            role="group"
            aria-label="Choose a day"
          >
            {week.days.map((date) => {
              const day = parseISO(date);
              const isSelected = selectedDay === date;
              const isToday = date === todayKey;
              const remaining = openSlots.filter(
                (slot) => slot.date === date,
              ).length;
              const done = doneSlots.filter(
                (slot) => slot.date === date,
              ).length;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDay(date)}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${format(day, "EEEE, MMMM d")}, ${remaining} to do, ${done} done`}
                  className={cn(
                    "relative flex h-[88px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border transition-colors active:scale-[0.97] motion-reduce:transform-none sm:h-24",
                    tone.focus,
                    isSelected
                      ? tone.selected
                      : cn(tone.ghost, "border-transparent"),
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide",
                      isToday && tone.accent,
                    )}
                  >
                    {format(day, "EEE")}
                  </span>
                  <span className="text-xl font-semibold leading-6 tabular-nums">
                    {format(day, "d")}
                  </span>
                  <span
                    className={cn(
                      "flex h-4 items-center gap-1 text-[10px] font-medium tabular-nums",
                      isSelected ? tone.accent : tone.subtle,
                    )}
                  >
                    {remaining > 0 ? (
                      remaining
                    ) : done > 0 ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      "—"
                    )}
                    {remaining > 0 && done > 0 && (
                      <span
                        className={cn(
                          "h-1 w-1 rounded-full",
                          tone.tc.progressFill,
                        )}
                        aria-hidden
                      />
                    )}
                  </span>
                  {isToday && (
                    <span
                      className={cn(
                        "absolute top-2 right-2 h-1 w-1 rounded-full",
                        tone.tc.progressFill,
                      )}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-2xl border p-1",
            tone.border,
            tone.tc.surfaceBgMuted,
          )}
          role="group"
          aria-label="Agenda view"
        >
          <button
            type="button"
            onClick={goToday}
            aria-pressed={selectedDay === todayKey}
            className={cn(
              "h-10 rounded-xl px-3 text-xs font-semibold transition-colors",
              tone.focus,
              selectedDay === todayKey ? tone.selected : tone.soft,
            )}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            aria-pressed={selectedDay === null}
            className={cn(
              "h-10 rounded-xl px-3 text-xs font-semibold transition-colors",
              tone.focus,
              !selectedDay ? tone.selected : tone.soft,
            )}
          >
            Week
          </button>
        </div>
        <button
          ref={planButtonRef}
          type="button"
          onClick={() => openPlan(selectedDay)}
          disabled={chores.isLoading || chores.isError}
          className={cn(
            "ml-auto flex h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold disabled:opacity-50 lg:hidden",
            tone.accentSurface,
            tone.accent,
            tone.focus,
          )}
        >
          <Plus className="h-4 w-4" />
          Assign<span className="tabular-nums">{todos.length}</span>
        </button>
      </div>

      {chores.isError ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className={cn("text-sm", tone.soft)}>Couldn&apos;t load chores</p>
          <button
            type="button"
            onClick={chores.refetch}
            className={cn(
              "h-11 rounded-xl px-4 text-sm font-medium",
              tone.ghost,
              tone.focus,
            )}
          >
            Retry
          </button>
        </div>
      ) : chores.isLoading ? (
        <div
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_344px]"
          role="status"
          aria-label="Loading chores"
        >
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-20 animate-pulse rounded-2xl motion-reduce:animate-none",
                  tone.tc.surfaceBg,
                )}
              />
            ))}
          </div>
          <div
            className={cn(
              "hidden h-64 animate-pulse rounded-3xl motion-reduce:animate-none lg:block",
              tone.tc.surfaceBg,
            )}
          />
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_344px]">
          <section className="min-w-0 space-y-5" aria-label="Chore agenda">
            {selectedDay ? (
              <section
                className={cn("rounded-3xl border p-3 sm:p-4", tone.border)}
              >
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <div>
                    <h2
                      className={cn(
                        "text-base font-semibold",
                        selectedDay === todayKey ? tone.accent : tone.main,
                      )}
                    >
                      {formatDayHeading(selectedDay, todayKey)}
                    </h2>
                    <p className={cn("mt-0.5 text-xs", tone.subtle)}>
                      {format(parseISO(selectedDay), "MMMM d")}
                    </p>
                  </div>
                  {dayViewSlots.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
                          tone.ghost,
                        )}
                      >
                        {dayViewSlots.length}
                      </span>
                      {todos.length > 0 && selectedDay >= todayKey && (
                        <button
                          type="button"
                          onClick={() => openPlan(selectedDay)}
                          aria-label={`Assign to ${formatDayHeading(selectedDay, todayKey)}`}
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-xl border lg:hidden",
                            tone.accentSurface,
                            tone.accent,
                            tone.focus,
                          )}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {dayViewSlots.length > 0 ? (
                  <div className="space-y-2">
                    {dayViewSlots.map((slot) => renderSlot(slot))}
                  </div>
                ) : (
                  emptyAgenda(
                    completed.length > 0 ? "All done" : "Nothing scheduled",
                  )
                )}
              </section>
            ) : visible.length === 0 ? (
              <section className={cn("rounded-3xl border", tone.border)}>
                {emptyAgenda("Nothing scheduled this week")}
              </section>
            ) : (
              <div className="grid items-start gap-3 sm:grid-cols-2">
                {week.days.map((date) => {
                  const slots = openSlots.filter((slot) => slot.date === date);
                  const done = doneSlots.filter(
                    (slot) => slot.date === date,
                  ).length;
                  return (
                    <section
                      key={date}
                      className={cn(
                        "min-w-0 rounded-2xl border p-3",
                        date === todayKey ? tone.accentSurface : tone.border,
                      )}
                    >
                      <div
                        className={cn(
                          "flex min-h-7 items-center justify-between gap-2 px-1",
                          slots.length > 0 && "mb-3",
                        )}
                      >
                        <h2
                          className={cn(
                            "text-sm font-semibold",
                            date === todayKey ? tone.accent : tone.main,
                          )}
                        >
                          {formatDayHeading(date, todayKey)}
                        </h2>
                        <span
                          className={cn(
                            "flex shrink-0 items-center gap-1.5 text-xs tabular-nums",
                            tone.subtle,
                          )}
                        >
                          {slots.length > 0 ? (
                            slots.length
                          ) : done > 0 ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              All done
                            </>
                          ) : (
                            "No chores"
                          )}
                        </span>
                      </div>
                      {slots.length > 0 && (
                        <div className="space-y-2">
                          {slots.map((slot) => renderSlot(slot))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
            {completed.length > 0 && (
              <section className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowDone((value) => !value)}
                  aria-expanded={showDone}
                  className={cn(
                    "flex h-11 w-full items-center gap-2 rounded-xl px-3 text-xs font-semibold",
                    tone.ghost,
                    tone.focus,
                  )}
                >
                  <Check className="h-4 w-4" />
                  Completed
                  <span className="tabular-nums">{completed.length}</span>
                  <ChevronDown
                    className={cn(
                      "ml-auto h-4 w-4 transition-transform motion-reduce:transition-none",
                      showDone && "rotate-180",
                    )}
                  />
                </button>
                {showDone &&
                  completed.map((slot) =>
                    renderSlot(slot, selectedDay ? undefined : "weekday"),
                  )}
              </section>
            )}
            {isCurrentWeek && <ChoreCheckInPanel entries={checkIn} />}
          </section>
          <aside
            className={cn(
              "hidden min-w-0 space-y-4 rounded-3xl border p-3 lg:block",
              tone.panel,
            )}
            aria-label="Chores to plan"
          >
            <div className="flex items-center justify-between gap-2 px-1 pt-1">
              <h2
                className={cn(
                  "flex items-center gap-2 text-sm font-semibold",
                  tone.main,
                )}
              >
                <ClipboardList className={cn("h-4 w-4", tone.accent)} />
                To plan
              </h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs tabular-nums",
                  tone.ghost,
                )}
              >
                {todos.length}
              </span>
            </div>
            {renderPlanning(selectedDay)}
          </aside>
        </div>
      )}

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            planButtonRef.current?.focus();
          }}
          className={cn(
            "left-0 top-auto bottom-0 max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0 gap-4 overflow-y-auto rounded-b-none rounded-t-3xl border p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-5",
            tone.tc.bgPage,
            tone.border,
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className={cn("text-lg", tone.main)}>
              To plan{" "}
              <span
                className={cn(
                  "ml-1 text-sm font-normal tabular-nums",
                  tone.subtle,
                )}
              >
                {todos.length}
              </span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => setPlanOpen(false)}
              aria-label="Close assignment"
              className={iconButton}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftPlanWeek(-1)}
              aria-label="Previous week"
              className={cn(iconButton, "h-10 w-10")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <DialogDescription
              className={cn("text-sm font-medium tabular-nums", tone.main)}
            >
              {dateRange}
            </DialogDescription>
            <button
              type="button"
              onClick={() => shiftPlanWeek(1)}
              aria-label="Next week"
              className={cn(iconButton, "h-10 w-10")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {renderPlanning(planTarget)}
        </DialogContent>
      </Dialog>

      <ChoreSheet
        slot={sheetSlot}
        person={
          sheetSlot ? personFor(sheetSlot.item.responsible_user_id) : null
        }
        moveDays={moveDays}
        personAction={sheetSlot ? personActionFor(sheetSlot) : null}
        pending={assign.isPending || responsibility.isPending}
        onMove={(slot, date) => assign.moveFlexible(slot, date)}
        onUnassign={(slot) => assign.unassignFlexible(slot)}
        onUnassignOneOff={(slot) => assign.unassignOneOff(slot)}
        onSetResponsible={(slot, action) =>
          responsibility.setResponsible(
            slot.item,
            action.userId,
            personFor(action.userId)?.label ?? action.label,
          )
        }
        onClose={() => setSheetKey(null)}
      />
    </div>
  );
}

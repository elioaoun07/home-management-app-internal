"use client";

import { ChoreRoomTile } from "@/components/chores/ChoreRoomTile";
import { ChoreSwipe, type ChoreSwipeSide } from "@/components/chores/ChoreSwipe";
import type { ChoreHousehold } from "@/components/chores/ChoreTodoRow";
import {
  ChoreDayChips,
  PersonTag,
  personTone,
  useChoreTone,
  type ChorePerson,
} from "@/components/chores/choreUi";
import {
  getRoomStyle,
  NO_ROOM_STYLE,
  roomGradient,
} from "@/components/chores/roomStyle";
import type {
  ChoreDayOption,
  ChoreSlot,
  ChoreTodo,
} from "@/features/chores/choreWeek";
import { roomStats } from "@/features/chores/roomStats";
import { cn } from "@/lib/utils";
import type { HomeRoom } from "@/types/catalogue";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock3,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

// ── Staged placements ────────────────────────────────────────────────────────

/** A placement the user staged in the form; nothing is saved until Save. */
export interface ChoreDraft {
  key: string;
  todo: ChoreTodo;
  /** Monday of the week the form showed when it was staged */
  weekStart: string;
  date: string;
  /** null = all day */
  time: string | null;
  userId: string | null;
}

const draftKey = (weekStart: string, todoKey: string) =>
  `${weekStart}|${todoKey}`;

export function useChoreDrafts() {
  const [drafts, setDrafts] = useState<Record<string, ChoreDraft>>({});
  // Person picked (swipe / bulk) before the chore has a day
  const [owners, setOwners] = useState<Record<string, string>>({});

  const stage = useCallback(
    (
      todo: ChoreTodo,
      weekStart: string,
      date: string,
      time: string | null | undefined,
      userId: string | null,
    ) =>
      setDrafts((all) => {
        const key = draftKey(weekStart, todo.key);
        const prev = all[key];
        return {
          ...all,
          [key]: {
            key,
            todo,
            weekStart,
            date,
            time: time === undefined ? (prev?.time ?? null) : time,
            userId,
          },
        };
      }),
    [],
  );
  const unstage = useCallback(
    (weekStart: string, todoKey: string) =>
      setDrafts((all) => {
        const { [draftKey(weekStart, todoKey)]: _removed, ...rest } = all;
        void _removed;
        return rest;
      }),
    [],
  );
  const setOwner = useCallback((todoKey: string, userId: string) => {
    setOwners((all) => ({ ...all, [todoKey]: userId }));
    setDrafts((all) =>
      Object.fromEntries(
        Object.entries(all).map(([key, draft]) => [
          key,
          draft.todo.key === todoKey ? { ...draft, userId } : draft,
        ]),
      ),
    );
  }, []);
  const clear = useCallback(() => {
    setDrafts({});
    setOwners({});
  }, []);

  return {
    drafts,
    owners,
    list: Object.values(drafts),
    count: Object.keys(drafts).length,
    stage,
    unstage,
    setOwner,
    clear,
  };
}

export type ChoreDraftStore = ReturnType<typeof useChoreDrafts>;

// ── Rows ─────────────────────────────────────────────────────────────────────

const dayShort = (date: string) => format(parseISO(date), "EEE d");

interface DraftRowProps {
  todo: ChoreTodo;
  label: string;
  draft: ChoreDraft | undefined;
  person: ChorePerson | null;
  me: ChoreHousehold | null;
  partner: ChoreHousehold | null;
  /** Day the "+" on the agenda was tapped for, when this chore can take it */
  quickDay: ChoreDayOption | undefined;
  open: boolean;
  onToggle: () => void;
  onStage: (date: string, time: string | null | undefined) => void;
  onUnstage: () => void;
  onSwipe: (side: ChoreSwipeSide) => void;
}

function DraftRow({
  todo,
  label,
  draft,
  person,
  me,
  partner,
  quickDay,
  open,
  onToggle,
  onStage,
  onUnstage,
  onSwipe,
}: DraftRowProps) {
  const tone = useChoreTone();
  const meta = [
    todo.target > 1 ? `${todo.remaining} left` : null,
    todo.period === "biweekly" ? "2 wk" : todo.period === "monthly" ? "Month" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ChoreSwipe me={me} partner={partner} onSwipe={onSwipe}>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border transition-colors",
          tone.row,
          person && personTone(person.color, tone.isFrost).outline,
        )}
      >
        <div className="flex min-h-[60px] items-center gap-2 pl-3.5 pr-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className={cn(
              "min-h-12 min-w-0 flex-1 rounded-lg py-2 text-left",
              tone.focus,
            )}
          >
            <span
              className={cn(
                "block break-words text-sm font-semibold leading-5",
                tone.main,
              )}
            >
              {label}
            </span>
            {(meta || person) && (
              <span className="mt-1 flex flex-wrap items-center gap-2">
                {meta && (
                  <span className={cn("text-[11px]", tone.subtle)}>{meta}</span>
                )}
                <PersonTag person={person} />
              </span>
            )}
          </button>
          {draft ? (
            <button
              type="button"
              onClick={onUnstage}
              aria-label={`Unstage ${label}`}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold tabular-nums active:scale-95 motion-reduce:transform-none",
                tone.selected,
                tone.focus,
              )}
            >
              {dayShort(draft.date)}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ) : quickDay ? (
            <button
              type="button"
              onClick={() => onStage(quickDay.date, undefined)}
              aria-label={`Plan ${label} on ${dayShort(quickDay.date)}`}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-xs font-semibold tabular-nums active:scale-95 motion-reduce:transform-none",
                tone.accentSurface,
                tone.accent,
                tone.focus,
              )}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {dayShort(quickDay.date)}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? "Close days" : "Choose a day"}
            className={cn(
              "flex h-10 w-9 shrink-0 items-center justify-center rounded-xl active:scale-95 motion-reduce:transform-none",
              tone.ghost,
              tone.focus,
            )}
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        {open && (
          <div className={cn("space-y-2.5 border-t px-2.5 pb-3 pt-3", tone.border)}>
            <ChoreDayChips
              days={todo.days}
              selected={draft?.date}
              onPick={(option) => onStage(option.date, undefined)}
            />
            {draft && (
              <label
                className={cn(
                  "flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs",
                  tone.ghost,
                )}
              >
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="sr-only">Time</span>
                <input
                  type="time"
                  value={draft.time ?? ""}
                  onChange={(event) =>
                    onStage(draft.date, event.target.value || null)
                  }
                  className={cn(
                    "h-full min-w-0 flex-1 rounded-md bg-transparent tabular-nums",
                    tone.focus,
                  )}
                  style={{ colorScheme: tone.isFrost ? "light" : "dark" }}
                />
              </label>
            )}
          </div>
        )}
      </div>
    </ChoreSwipe>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

interface ChoreAssignPanelProps {
  todos: ChoreTodo[];
  /** Placed chores in the week (open + done) */
  slots: ChoreSlot[];
  rooms: HomeRoom[];
  /** Monday of the week shown */
  weekStart: string;
  weekDays: string[];
  me: ChoreHousehold | null;
  partner: ChoreHousehold | null;
  personFor: (userId: string | null | undefined) => ChorePerson | null;
  /** Agenda day the form was opened for: one tap plans a chore onto it */
  targetDate: string | null;
  store: ChoreDraftStore;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

type Tab = "rooms" | "chores";
type Focus = { roomId: string | null } | null;

export function ChoreAssignPanel({
  todos,
  slots,
  rooms,
  weekStart,
  weekDays,
  me,
  partner,
  personFor,
  targetDate,
  store,
  saving,
  onSave,
  onDiscard,
}: ChoreAssignPanelProps) {
  const tone = useChoreTone();
  const [tab, setTab] = useState<Tab>("rooms");
  const [focus, setFocus] = useState<Focus>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const draftFor = (todo: ChoreTodo) =>
    store.drafts[draftKey(weekStart, todo.key)];

  const staged = useMemo(() => {
    const map = new Map<string, number>();
    for (const draft of store.list) {
      if (draft.weekStart === weekStart) map.set(draft.todo.key, 1);
    }
    return map;
  }, [store.list, weekStart]);
  const stats = useMemo(
    () => roomStats(todos, slots, staged),
    [todos, slots, staged],
  );

  const ownerOf = (todo: ChoreTodo): string | null =>
    draftFor(todo)?.userId ??
    store.owners[todo.key] ??
    todo.responsibleUserId ??
    null;

  const stageTodo = (
    todo: ChoreTodo,
    date: string,
    time: string | null | undefined,
  ) => store.stage(todo, weekStart, date, time, ownerOf(todo));

  // ── Bulk ──
  const renderBulk = (scope: ChoreTodo[]) => {
    const days: ChoreDayOption[] = weekDays.map((date) => ({
      date,
      enabled: scope.some((todo) =>
        todo.days.some((d) => d.date === date && d.enabled),
      ),
      periodStart: null,
    }));
    const stagedDates = new Set(
      scope.map((todo) => draftFor(todo)?.date).filter(Boolean),
    );
    const allStaged = scope.every((todo) => !!draftFor(todo));
    const selected =
      allStaged && stagedDates.size === 1 ? [...stagedDates][0] : undefined;
    const applyDay = (date: string) => {
      for (const todo of scope) {
        if (todo.days.some((d) => d.date === date && d.enabled)) {
          stageTodo(todo, date, undefined);
        }
      }
    };
    const applyOwner = (userId: string) => {
      for (const todo of scope) store.setOwner(todo.key, userId);
    };
    return (
      <div
        className={cn("space-y-2.5 rounded-2xl border p-2.5", tone.border)}
        aria-label="Assign all"
      >
        <ChoreDayChips days={days} selected={selected} onPick={(o) => applyDay(o.date)} />
        {(me || partner) && (
          <div className="flex gap-2">
            {[me, partner].map(
              (person) =>
                person && (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => applyOwner(person.id)}
                    aria-pressed={scope.every((t) => ownerOf(t) === person.id)}
                    className={cn(
                      "h-10 flex-1 truncate rounded-xl border px-3 text-xs font-semibold",
                      tone.focus,
                      scope.every((t) => ownerOf(t) === person.id)
                        ? cn(personTone(person.color, tone.isFrost).outline, tone.selected)
                        : cn(tone.ghost, "border-transparent"),
                    )}
                  >
                    {person.label}
                  </button>
                ),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderRow = (todo: ChoreTodo, label: string) => {
    const draft = draftFor(todo);
    const quickDay = targetDate
      ? todo.days.find((d) => d.date === targetDate && d.enabled)
      : undefined;
    return (
      <DraftRow
        key={todo.key}
        todo={todo}
        label={label}
        draft={draft}
        person={personFor(ownerOf(todo))}
        me={me}
        partner={partner}
        quickDay={quickDay}
        open={openRow === todo.key}
        onToggle={() => setOpenRow(openRow === todo.key ? null : todo.key)}
        onStage={(date, time) => stageTodo(todo, date, time)}
        onUnstage={() => store.unstage(weekStart, todo.key)}
        onSwipe={(side) => {
          const to = side === "me" ? me : partner;
          if (to) store.setOwner(todo.key, to.id);
        }}
      />
    );
  };

  // ── Rooms tab ──
  const roomList = rooms.filter((room) => stats.has(room.id));
  const hasNoRoom = stats.has(null);
  const openRoom = (roomId: string | null) => {
    setFocus({ roomId });
    setOpenRow(null);
  };

  const renderFocus = (target: NonNullable<Focus>) => {
    const room = rooms.find((r) => r.id === target.roomId);
    const style = room ? getRoomStyle(room.name, room.id) : NO_ROOM_STYLE;
    const scope = todos.filter((t) => t.roomId === target.roomId);
    const stat = stats.get(target.roomId);
    return (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-2xl">
          <div
            className="absolute inset-0"
            style={{ backgroundImage: roomGradient(style), border: `1px solid ${style.accent}40` }}
          />
          <div className="relative flex items-center gap-3 p-3">
            <button
              type="button"
              onClick={() => setFocus(null)}
              aria-label="Back to rooms"
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                tone.ghost,
                tone.focus,
              )}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${style.accent}1f`, transform: "scale(0.9)" }}
            >
              <span style={{ transform: "scale(0.7)" }}>{style.icon(style.accent)}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-base font-semibold", tone.main)}>
                {room?.name ?? "Other"}
              </p>
              <p className={cn("text-xs tabular-nums", tone.subtle)}>
                {stat?.done ?? 0} · {stat?.assigned ?? 0} · {stat?.unassigned ?? 0}
              </p>
            </div>
          </div>
        </div>
        {scope.length > 0 ? (
          <>
            {scope.length > 1 && renderBulk(scope)}
            <div className="space-y-2">
              {scope.map((todo) => renderRow(todo, todo.title))}
            </div>
          </>
        ) : (
          <p className={cn("py-6 text-center text-sm", tone.subtle)}>—</p>
        )}
      </div>
    );
  };

  // ── Chores tab ──
  const groups = useMemo(() => {
    const map = new Map<string, ChoreTodo[]>();
    for (const todo of todos) {
      const list = map.get(todo.title);
      if (list) list.push(todo);
      else map.set(todo.title, [todo]);
    }
    return [...map.entries()];
  }, [todos]);

  const renderGroups = () => (
    <div className="space-y-2.5">
      {groups.map(([title, scope]) => {
        const open = group === title;
        const stagedCount = scope.filter((t) => draftFor(t)).length;
        return (
          <div key={title} className={cn("overflow-hidden rounded-2xl border", tone.row)}>
            <button
              type="button"
              onClick={() => setGroup(open ? null : title)}
              aria-expanded={open}
              className={cn(
                "flex min-h-14 w-full items-center gap-2 px-3.5 text-left",
                tone.focus,
              )}
            >
              <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", tone.main)}>
                {title}
              </span>
              <span className={cn("text-xs tabular-nums", stagedCount ? tone.accent : tone.subtle)}>
                {stagedCount}/{scope.length}
              </span>
              {open ? (
                <ChevronUp className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden />
              )}
            </button>
            {open && (
              <div className={cn("space-y-2 border-t p-2.5", tone.border)}>
                {scope.length > 1 && renderBulk(scope)}
                {scope.map((todo) => renderRow(todo, todo.room ?? todo.title))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {!focus && (
        <div
          className={cn(
            "flex gap-1 rounded-2xl border p-1",
            tone.border,
            tone.tc.surfaceBgMuted,
          )}
          role="group"
          aria-label="Group by"
        >
          {(
            [
              ["rooms", "Rooms"],
              ["chores", "Chores"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={cn(
                "h-10 flex-1 rounded-xl px-3 text-xs font-semibold transition-colors",
                tone.focus,
                tab === key ? tone.selected : tone.soft,
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {focus ? (
        renderFocus(focus)
      ) : tab === "rooms" ? (
        <div className="grid grid-cols-2 gap-3">
          {roomList.map((room) => (
            <ChoreRoomTile
              key={room.id}
              name={room.name}
              style={getRoomStyle(room.name, room.id)}
              stat={stats.get(room.id)}
              onOpen={() => openRoom(room.id)}
            />
          ))}
          {hasNoRoom && (
            <ChoreRoomTile
              name="Other"
              style={NO_ROOM_STYLE}
              stat={stats.get(null)}
              onOpen={() => openRoom(null)}
            />
          )}
        </div>
      ) : (
        renderGroups()
      )}

      {store.count > 0 && (
        <div
          className={cn(
            "sticky bottom-0 -mx-4 flex gap-2 border-t px-4 pb-1 pt-3 sm:-mx-5 sm:px-5",
            tone.border,
            tone.tc.bgPage,
          )}
        >
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className={cn(
              "h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-50",
              tone.ghost,
              tone.focus,
            )}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold disabled:opacity-50",
              tone.selected,
              tone.focus,
            )}
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <>
                Save<span className="tabular-nums">{store.count}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

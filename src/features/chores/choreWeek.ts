// Pure week model for the Chores page: which chore slots land in a Mon–Sun
// week, which are done, and what can still be assigned (with the weekday
// options for each). No React, no I/O — inputs come from the shared caches.
//
// Expansion is delegated, never re-implemented:
//   - flexible routines → organizeFlexibleRoutines output (useFlexibleRoutines)
//   - fixed recurring / dated one-offs → expandOccurrencesInRange (dayOccurrences)

import {
  getPeriodBoundaries,
  type FlexibleRoutineItem,
  type FlexibleRoutinesResult,
} from "@/features/items/useFlexibleRoutines";
import type { ItemOccurrenceAction } from "@/features/items/useItemActions";
import {
  expandOccurrencesInRange,
  getItemDate,
} from "@/lib/utils/dayOccurrences";
import { localToISO } from "@/lib/utils/date";
import type { CatalogueItem, HomeRoom } from "@/types/catalogue";
import type {
  FlexiblePeriod,
  FlexibleSchedule,
  ItemWithDetails,
} from "@/types/items";
import {
  addDays,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from "date-fns";

const FLEXIBLE_PERIODS: FlexiblePeriod[] = ["weekly", "biweekly", "monthly"];
const CLOSED_STATUSES = new Set(["cancelled", "archived", "dormant"]);

export type ChoreSlotKind = "flexible" | "dated" | "recurring";

export interface ChoreSlotFlexible {
  period: FlexiblePeriod;
  periodStart: string;
  periodEnd: string;
  occurrenceIndex: number;
}

export interface ChoreSlot {
  key: string;
  kind: ChoreSlotKind;
  item: ItemWithDetails;
  /** Local yyyy-MM-dd the slot lands on */
  date: string;
  /** Local HH:mm, null for a date-only flexible slot */
  time: string | null;
  /** Planned instant used as occurrence date / planned_for */
  plannedAt: string;
  done: boolean;
  completedAction?: ItemOccurrenceAction;
  /** Present for open flexible slots (move/unassign need the slot identity) */
  flexible?: ChoreSlotFlexible;
}

export type ChoreTodoKind = "flexible" | "template" | "undated";

export interface ChoreDayOption {
  date: string;
  enabled: boolean;
  /** Flexible/template period this day falls in */
  periodStart: string | null;
}

export interface ChoreTodo {
  key: string;
  kind: ChoreTodoKind;
  title: string;
  /** Room this to-do is for (a template applies to several: one to-do per room) */
  roomId: string | null;
  room: string | null;
  roomOrder: number;
  responsibleUserId: string | null;
  /** Slots left in the first assignable period */
  remaining: number;
  target: number;
  period: FlexiblePeriod | null;
  preferredTime: string | null;
  days: ChoreDayOption[];
  item?: FlexibleRoutineItem | ItemWithDetails;
  template?: CatalogueItem;
}

export interface ChoreWeekInput {
  /** Any date inside the week; normalized to Monday */
  weekOf: Date;
  now: Date;
  items: ItemWithDetails[];
  actions: ItemOccurrenceAction[];
  schedules: FlexibleSchedule[];
  /** Organizer results for the week's Monday and Sunday anchors */
  flexible: (FlexibleRoutinesResult | undefined)[];
  templates: CatalogueItem[];
  /** Rooms of the home; a template's `room_ids` resolve against these */
  rooms?: HomeRoom[];
}

export interface ChoreWeek {
  weekStart: string;
  weekEnd: string;
  days: string[];
  /** Open + done slots in the week, chronological */
  slots: ChoreSlot[];
  /** Open dated one-offs due before the week */
  overdue: ChoreSlot[];
  todos: ChoreTodo[];
}

/**
 * One-off slots a person placed from Chores and can take back: Catalogue
 * instances (cancelled again) and alert-free dated items (due date cleared).
 */
/**
 * One-off chores have no time column: an all-day placement stores the
 * Schedule "no time" noon convention plus `metadata_json.all_day`.
 */
export const ALL_DAY_TIME = "12:00";
export function isAllDayItem(item: ItemWithDetails): boolean {
  return item.metadata_json?.all_day === true;
}

export function canUnassignOneOff(slot: ChoreSlot): boolean {
  if (slot.kind !== "dated" || slot.done) return false;
  const item = slot.item;
  if (item.recurrence_rule?.rrule) return false;
  const fromTemplate = !!item.is_template_instance && !!sourceId(item);
  return fromTemplate || (item.alerts?.length ?? 0) === 0;
}

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function isoToDateKey(iso: string): string | null {
  try {
    return format(parseISO(iso), "yyyy-MM-dd");
  } catch {
    return null;
  }
}

export function getWeekBounds(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function isFlexiblePeriod(value: unknown): value is FlexiblePeriod {
  return (
    typeof value === "string" &&
    FLEXIBLE_PERIODS.includes(value as FlexiblePeriod)
  );
}

/**
 * Smallest occurrence_index not already used by ANY schedule row of the item
 * in the period (pending, completed, skipped or postponed). Upserts key on
 * item/period/index, so reusing a taken index would overwrite that slot.
 */
export function nextFreeOccurrenceIndex(
  schedules: FlexibleSchedule[],
  itemId: string,
  periodStart: string,
): number {
  const used = new Set(
    schedules
      .filter(
        (s) => s.item_id === itemId && s.period_start_date === periodStart,
      )
      .map((s) => s.occurrence_index ?? 0),
  );
  let index = 0;
  while (used.has(index)) index++;
  return index;
}

/** Planned instant for a flexible slot (date-only slots resolve to noon, as before). */
export function flexiblePlannedAt(date: string, time: string | null): string {
  return localToISO(date, time?.slice(0, 5) || "12:00");
}

function actionAccountingKey(action: ItemOccurrenceAction): string | null {
  const plannedFor = action.metadata_json?.planned_for;
  return isoToDateKey(
    typeof plannedFor === "string" ? plannedFor : action.occurrence_date,
  );
}

function sourceId(item: ItemWithDetails): string | null {
  return (
    (item as ItemWithDetails & { source_catalogue_item_id?: string | null })
      .source_catalogue_item_id ?? null
  );
}

function slotSort(a: ChoreSlot, b: ChoreSlot): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
    a.item.title.localeCompare(b.item.title)
  );
}

export function buildChoreWeek(input: ChoreWeekInput): ChoreWeek {
  const { start, end } = getWeekBounds(input.weekOf);
  const weekStart = toDateKey(start);
  const weekEnd = toDateKey(end);
  const days = Array.from({ length: 7 }, (_, i) =>
    toDateKey(addDays(start, i)),
  );
  const todayKey = toDateKey(input.now);
  const inWeek = (key: string | null): key is string =>
    !!key && key >= weekStart && key <= weekEnd;

  // item:date → actions resolving that date
  const resolutions = new Map<string, ItemOccurrenceAction[]>();
  for (const action of input.actions) {
    const key = actionAccountingKey(action);
    if (!key) continue;
    const mapKey = `${action.item_id}:${key}`;
    const list = resolutions.get(mapKey) ?? [];
    list.push(action);
    resolutions.set(mapKey, list);
  }
  const resolve = (itemId: string, date: string) => {
    const list = resolutions.get(`${itemId}:${date}`) ?? [];
    return {
      completed: list.find((a) => a.action_type === "completed"),
      handled: list.length > 0,
    };
  };

  const chores = input.items.filter(
    (item) => item.is_chore && !CLOSED_STATUSES.has(item.status ?? ""),
  );
  const flexibleChores = chores.filter((i) => i.recurrence_rule?.is_flexible);
  const fixedChores = chores.filter((i) => !i.recurrence_rule?.is_flexible);

  const slots: ChoreSlot[] = [];

  // ── Flexible: open slots from the organizer ────────────────────────────────
  const flexibleEntries = new Map<string, FlexibleRoutineItem>();
  const seenSchedules = new Set<string>();
  for (const result of input.flexible) {
    if (!result) continue;
    for (const entry of [
      ...result.scheduled,
      ...result.unscheduled,
      ...result.completed,
    ]) {
      if (!entry.is_chore) continue;
      const entryKey = `${entry.id}:${entry.periodStart}`;
      if (!flexibleEntries.has(entryKey)) flexibleEntries.set(entryKey, entry);
    }
    for (const entry of result.scheduled) {
      const schedule = entry.flexibleSchedule;
      if (!entry.is_chore || !schedule) continue;
      if (!inWeek(schedule.scheduled_for_date)) continue;
      if (seenSchedules.has(schedule.id)) continue;
      seenSchedules.add(schedule.id);
      const time = schedule.scheduled_for_time?.slice(0, 5) || null;
      slots.push({
        key: `flex:${schedule.id}`,
        kind: "flexible",
        item: entry,
        date: schedule.scheduled_for_date,
        time,
        plannedAt: flexiblePlannedAt(schedule.scheduled_for_date, time),
        done: false,
        flexible: {
          period: entry.recurrence_rule?.flexible_period ?? "weekly",
          periodStart: entry.periodStart,
          periodEnd: entry.periodEnd,
          occurrenceIndex: schedule.occurrence_index ?? 0,
        },
      });
    }
  }

  // ── Flexible: done = completions accounted to a day in the week ─────────────
  for (const item of flexibleChores) {
    for (const action of input.actions) {
      if (action.item_id !== item.id || action.action_type !== "completed") {
        continue;
      }
      const key = actionAccountingKey(action);
      if (!inWeek(key)) continue;
      const schedule = input.schedules.find(
        (s) => s.item_id === item.id && s.scheduled_for_date === key,
      );
      const time = schedule?.scheduled_for_time?.slice(0, 5) || null;
      slots.push({
        key: `flex-done:${action.id}`,
        kind: "flexible",
        item,
        date: key,
        time,
        plannedAt: flexiblePlannedAt(key, time),
        done: true,
        completedAction: action,
      });
    }
  }

  // ── Fixed recurring + dated one-offs: shared expander ───────────────────────
  const occurrences = expandOccurrencesInRange(
    fixedChores,
    start,
    end,
    input.actions,
  );
  const seenOccurrences = new Set<string>();
  for (const occurrence of occurrences) {
    const date = toDateKey(occurrence.occurrenceDate);
    const occKey = `${occurrence.item.id}:${date}`;
    if (seenOccurrences.has(occKey)) continue;
    seenOccurrences.add(occKey);
    const item = occurrence.item;
    const isRecurring = !!item.recurrence_rule?.rrule;
    const { completed, handled } = resolve(item.id, date);
    const done = !!completed || (!isRecurring && item.status === "completed");
    if (!done && handled && !occurrence.isPostponed) continue; // skipped / cancelled / moved away
    slots.push({
      key: `${isRecurring ? "rec" : "one"}:${occKey}`,
      kind: isRecurring ? "recurring" : "dated",
      item,
      date,
      time: isAllDayItem(item)
        ? null
        : format(occurrence.occurrenceDate, "HH:mm"),
      plannedAt: occurrence.occurrenceDate.toISOString(),
      done,
      completedAction: completed,
    });
  }

  // ── Overdue dated one-offs from before this week ────────────────────────────
  const overdue: ChoreSlot[] = [];
  for (const item of fixedChores) {
    if (item.recurrence_rule?.rrule || item.status === "completed") continue;
    const itemDate = getItemDate(item);
    if (!itemDate) continue;
    const date = toDateKey(itemDate);
    if (date >= weekStart) continue;
    if (resolve(item.id, date).handled) continue;
    overdue.push({
      key: `one:${item.id}:${date}`,
      kind: "dated",
      item,
      date,
      time: isAllDayItem(item) ? null : format(itemDate, "HH:mm"),
      plannedAt: itemDate.toISOString(),
      done: false,
    });
  }

  // ── Todos ──────────────────────────────────────────────────────────────────
  const todos: ChoreTodo[] = [];
  const roomsById = new Map((input.rooms ?? []).map((r) => [r.id, r] as const));
  const roomFields = (roomId: string | null) => {
    const room = roomId ? roomsById.get(roomId) : undefined;
    return {
      roomId: room?.id ?? null,
      room: room?.name ?? null,
      roomOrder: room?.position ?? Number.MAX_SAFE_INTEGER,
    };
  };
  /** Instances created from a template remember their room (metadata_json.room_id) */
  const instanceRoomId = (item: ItemWithDetails): string | null => {
    const id = item.metadata_json?.room_id;
    return typeof id === "string" ? id : null;
  };
  const dayIsOpen = (date: string) => date >= todayKey;

  // Flexible chores with slots left in a period touching this week
  for (const item of flexibleChores) {
    const period = item.recurrence_rule?.flexible_period ?? "weekly";
    let primary: FlexibleRoutineItem | undefined;
    const dayOptions = days.map((date): ChoreDayOption => {
      const bounds = getPeriodBoundaries(parseISO(date), period);
      const periodStart = toDateKey(bounds.start);
      const entry = flexibleEntries.get(`${item.id}:${periodStart}`);
      const remaining = entry?.remainingCount ?? 0;
      const taken = input.schedules.some(
        (s) =>
          s.item_id === item.id &&
          s.period_start_date === periodStart &&
          s.scheduled_for_date === date,
      );
      const enabled = dayIsOpen(date) && remaining > 0 && !taken;
      if (enabled && !primary && entry) primary = entry;
      return { date, enabled, periodStart };
    });
    if (!primary) continue;
    todos.push({
      key: `flex:${item.id}`,
      kind: "flexible",
      title: item.title,
      ...roomFields(instanceRoomId(item)),
      responsibleUserId: item.responsible_user_id ?? null,
      remaining: primary.remainingCount ?? 1,
      target: primary.targetOccurrences ?? 1,
      period,
      preferredTime: null,
      days: dayOptions,
      item: primary,
    });
  }

  // Flexible chore templates that have no routine item: each slot becomes a one-off
  const routineSources = new Set(
    input.items
      .filter(
        (i) =>
          i.recurrence_rule?.is_flexible &&
          !CLOSED_STATUSES.has(i.status ?? ""),
      )
      .map(sourceId)
      .filter((id): id is string => !!id),
  );
  for (const tpl of input.templates) {
    if (!tpl.is_chore || !tpl.is_flexible_routine) continue;
    if (!isFlexiblePeriod(tpl.recurrence_pattern)) continue;
    if (tpl.archived_at || tpl.status === "archived") continue;
    // One to-do per room the template is tagged with; untagged = one to-do.
    // A room-tagged template is never hidden by a routine item made elsewhere.
    const tplRoomIds = (tpl.room_ids ?? []).filter((id) => roomsById.has(id));
    if (routineSources.has(tpl.id) && tplRoomIds.length === 0) continue;
    const period = tpl.recurrence_pattern;
    const target = Math.max(1, tpl.flexible_occurrences ?? 1);
    for (const roomId of tplRoomIds.length ? tplRoomIds : [null]) {
      const instances = input.items.filter(
        (i) =>
          sourceId(i) === tpl.id &&
          (roomId === null || instanceRoomId(i) === roomId) &&
          !i.recurrence_rule?.is_flexible &&
          !CLOSED_STATUSES.has(i.status ?? ""),
      );
      let primaryRemaining = 0;
      const dayOptions = days.map((date): ChoreDayOption => {
        const bounds = getPeriodBoundaries(parseISO(date), period);
        const instanceDates = instances
          .map(getItemDate)
          .filter((d): d is Date => !!d && isWithinInterval(d, bounds))
          .map(toDateKey);
        const remaining = Math.max(0, target - instanceDates.length);
        const enabled =
          dayIsOpen(date) && remaining > 0 && !instanceDates.includes(date);
        if (enabled && primaryRemaining === 0) primaryRemaining = remaining;
        return { date, enabled, periodStart: toDateKey(bounds.start) };
      });
      if (primaryRemaining === 0) continue;
      todos.push({
        key: roomId ? `tpl:${tpl.id}:${roomId}` : `tpl:${tpl.id}`,
        kind: "template",
        title: tpl.name,
        ...roomFields(roomId),
        responsibleUserId: null,
        remaining: primaryRemaining,
        target,
        period,
        preferredTime: tpl.preferred_time?.slice(0, 5) || null,
        days: dayOptions,
        template: tpl,
      });
    }
  }

  // Undated one-offs: assigning sets their due date
  for (const item of fixedChores) {
    if (item.recurrence_rule?.rrule || getItemDate(item)) continue;
    if (item.status === "completed" || !item.reminder_details) continue;
    if (item.type !== "reminder" && item.type !== "task") continue;
    const dayOptions = days.map((date) => ({
      date,
      enabled: dayIsOpen(date),
      periodStart: null,
    }));
    if (!dayOptions.some((d) => d.enabled)) continue;
    todos.push({
      key: `undated:${item.id}`,
      kind: "undated",
      title: item.title,
      ...roomFields(instanceRoomId(item)),
      responsibleUserId: item.responsible_user_id ?? null,
      remaining: 1,
      target: 1,
      period: null,
      preferredTime: null,
      days: dayOptions,
      item,
    });
  }

  todos.sort(
    (a, b) => a.roomOrder - b.roomOrder || a.title.localeCompare(b.title),
  );

  return {
    weekStart,
    weekEnd,
    days,
    slots: slots.sort(slotSort),
    overdue: overdue.sort(slotSort),
    todos,
  };
}

/**
 * Days an open flexible slot can move to: inside its own period (period is part
 * of the slot identity), not in the past, and not a day the item already holds.
 */
export function moveDayOptions(
  slot: ChoreSlot,
  days: string[],
  schedules: FlexibleSchedule[],
  todayKey: string,
): ChoreDayOption[] {
  const flex = slot.flexible;
  return days.map((date) => {
    if (!flex) return { date, enabled: false, periodStart: null };
    const taken = schedules.some(
      (s) =>
        s.item_id === slot.item.id &&
        s.period_start_date === flex.periodStart &&
        s.scheduled_for_date === date,
    );
    const enabled =
      date >= todayKey &&
      date >= flex.periodStart &&
      date <= flex.periodEnd &&
      !taken;
    return { date, enabled, periodStart: flex.periodStart };
  });
}

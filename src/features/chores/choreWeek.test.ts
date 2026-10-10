// Chores week model: slot identity, period boundaries and the assignable-day
// rules behind the one-tap weekday picker. Pure — fixtures only, local time
// so results don't depend on the machine timezone.

import { organizeFlexibleRoutines } from "@/features/items/useFlexibleRoutines";
import type { ItemOccurrenceAction } from "@/features/items/useItemActions";
import { localToISO } from "@/lib/utils/date";
import type { CatalogueItem, HomeRoom } from "@/types/catalogue";
import type {
  FlexiblePeriod,
  FlexibleSchedule,
  ItemWithDetails,
} from "@/types/items";
import { describe, expect, it } from "vitest";
import {
  buildChoreWeek,
  canUnassignOneOff,
  moveDayOptions,
  nextFreeOccurrenceIndex,
  type ChoreWeekInput,
} from "./choreWeek";

const CREATED = localToISO("2026-01-01", "08:00");

function flexibleChore(
  id: string,
  period: FlexiblePeriod = "weekly",
  extra: Partial<ItemWithDetails> = {},
): ItemWithDetails {
  return {
    id,
    user_id: "me",
    type: "task",
    title: id,
    priority: "normal",
    status: "pending",
    created_at: CREATED,
    updated_at: CREATED,
    is_public: true,
    responsible_user_id: "me",
    is_chore: true,
    source_catalogue_item_id: `tpl-${id}`,
    reminder_details: { item_id: id, due_at: null, has_checklist: false },
    recurrence_rule: {
      id: `rule-${id}`,
      item_id: id,
      rrule: "",
      start_anchor: CREATED,
      is_flexible: true,
      flexible_period: period,
    },
    ...extra,
  } as unknown as ItemWithDetails;
}

function oneOff(id: string, dueAt: string | null): ItemWithDetails {
  return {
    id,
    user_id: "me",
    type: "reminder",
    title: id,
    priority: "normal",
    status: "pending",
    created_at: CREATED,
    updated_at: CREATED,
    is_public: true,
    responsible_user_id: "me",
    is_chore: true,
    reminder_details: { item_id: id, due_at: dueAt, has_checklist: false },
    recurrence_rule: null,
  } as unknown as ItemWithDetails;
}

function weeklyFixed(id: string, anchor: string): ItemWithDetails {
  return {
    ...oneOff(id, anchor),
    recurrence_rule: {
      id: `rule-${id}`,
      item_id: id,
      rrule: "FREQ=WEEKLY",
      start_anchor: anchor,
      exceptions: [],
    },
  } as unknown as ItemWithDetails;
}

function schedule(
  itemId: string,
  periodStart: string,
  date: string,
  index = 0,
): FlexibleSchedule {
  return {
    id: `${itemId}-${periodStart}-${index}`,
    item_id: itemId,
    period_start_date: periodStart,
    scheduled_for_date: date,
    scheduled_for_time: "09:00",
    occurrence_index: index,
    created_at: CREATED,
  } as unknown as FlexibleSchedule;
}

function action(
  itemId: string,
  type: ItemOccurrenceAction["action_type"],
  occurrenceDate: string,
  plannedFor?: string,
): ItemOccurrenceAction {
  return {
    id: `${itemId}-${type}-${occurrenceDate}`,
    item_id: itemId,
    occurrence_date: occurrenceDate,
    action_type: type,
    created_at: occurrenceDate,
    metadata_json: plannedFor ? { planned_for: plannedFor } : null,
  };
}

function template(
  id: string,
  extra: Partial<CatalogueItem> = {},
): CatalogueItem {
  return {
    id,
    name: id,
    is_chore: true,
    is_flexible_routine: true,
    recurrence_pattern: "weekly",
    flexible_occurrences: 1,
    archived_at: null,
    status: "active",
    preferred_time: null,
    ...extra,
  } as unknown as CatalogueItem;
}

/** Runs the shared organizer for both week anchors, like useChoreWeek does. */
function week(
  weekOf: Date,
  now: Date,
  items: ItemWithDetails[],
  schedules: FlexibleSchedule[] = [],
  actions: ItemOccurrenceAction[] = [],
  templates: CatalogueItem[] = [],
  targets: Record<string, number> = {},
  rooms: HomeRoom[] = [],
) {
  const flexible = items.filter(
    (i) => i.is_chore && i.recurrence_rule?.is_flexible,
  );
  const occurrenceMap = new Map(Object.entries(targets));
  const monday = new Date(weekOf);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const input: ChoreWeekInput = {
    weekOf,
    now,
    items,
    actions,
    schedules,
    templates,
    rooms,
    flexible: [monday, sunday].map((anchor) =>
      organizeFlexibleRoutines(
        flexible,
        schedules,
        actions,
        [],
        occurrenceMap,
        anchor,
      ),
    ),
  };
  return buildChoreWeek(input);
}

// Week of Mon 2026-10-05 … Sun 2026-10-11; "now" is Wednesday morning.
const WEEK = new Date(2026, 9, 5);
const WED = new Date(2026, 9, 7, 8, 0);

describe("buildChoreWeek — flexible chores", () => {
  it("shows a placed weekly slot and no longer offers it as unassigned", () => {
    const item = flexibleChore("laundry");
    const result = week(
      WEEK,
      WED,
      [item],
      [schedule("laundry", "2026-10-05", "2026-10-08")],
    );
    expect(result.slots.map((s) => [s.kind, s.date, s.done])).toEqual([
      ["flexible", "2026-10-08", false],
    ]);
    expect(result.slots[0].flexible?.occurrenceIndex).toBe(0);
    expect(result.todos).toEqual([]);
  });

  it("target 3 with Monday placed leaves 2, blocks past days and the taken day", () => {
    const item = flexibleChore("dishes");
    const result = week(
      WEEK,
      WED,
      [item],
      [schedule("dishes", "2026-10-05", "2026-10-07")],
      [],
      [],
      { "tpl-dishes": 3 },
    );
    const todo = result.todos.find((t) => t.key === "flex:dishes");
    expect(todo?.remaining).toBe(2);
    expect(todo?.target).toBe(3);
    const enabled = todo?.days.filter((d) => d.enabled).map((d) => d.date);
    // Mon/Tue are past, Wed already holds a slot of this chore
    expect(enabled).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
  });

  it("a monthly chore in a week that straddles months uses each day's own period", () => {
    // Mon 2026-09-28 … Sun 2026-10-04; September already has its one slot.
    const item = flexibleChore("fridge", "monthly");
    const result = week(
      new Date(2026, 8, 28),
      new Date(2026, 8, 28, 8, 0),
      [item],
      [schedule("fridge", "2026-09-01", "2026-09-10")],
    );
    const todo = result.todos.find((t) => t.key === "flex:fridge");
    expect(todo).toBeDefined();
    const byDate = Object.fromEntries(
      todo!.days.map((d) => [d.date, [d.enabled, d.periodStart]]),
    );
    expect(byDate["2026-09-29"]).toEqual([false, "2026-09-01"]);
    expect(byDate["2026-10-02"]).toEqual([true, "2026-10-01"]);
  });

  it("viewing another week of the same month keeps the monthly count", () => {
    const item = flexibleChore("windows", "monthly");
    const placed = [schedule("windows", "2026-10-01", "2026-10-02")];
    const result = week(new Date(2026, 9, 19), WED, [item], placed, [], [], {
      "tpl-windows": 2,
    });
    expect(result.todos.find((t) => t.key === "flex:windows")?.remaining).toBe(
      1,
    );
  });

  it("counts a completion as done on its planned day, not as another open slot", () => {
    const item = flexibleChore("floors");
    const planned = localToISO("2026-10-06", "09:00");
    const result = week(
      WEEK,
      WED,
      [item],
      [schedule("floors", "2026-10-05", "2026-10-06")],
      [
        action(
          "floors",
          "completed",
          localToISO("2026-10-07", "20:00"),
          planned,
        ),
      ],
    );
    expect(result.slots.map((s) => [s.date, s.done])).toEqual([
      ["2026-10-06", true],
    ]);
    expect(result.todos).toEqual([]);
  });

  it("does not list non-chore flexible routines", () => {
    const routine = flexibleChore("gym", "weekly", { is_chore: false });
    const result = week(WEEK, WED, [routine]);
    expect(result.slots).toEqual([]);
    expect(result.todos).toEqual([]);
  });
});

describe("buildChoreWeek — fixed and one-off chores", () => {
  it("expands a fixed weekly chore onto its weekday; skipped occurrences drop out", () => {
    const anchor = localToISO("2026-09-28", "18:00"); // a Monday
    const item = weeklyFixed("bins", anchor);
    const open = week(WEEK, WED, [item]);
    expect(open.slots.map((s) => [s.kind, s.date, s.time])).toEqual([
      ["recurring", "2026-10-05", "18:00"],
    ]);

    const skipped = week(
      WEEK,
      WED,
      [item],
      [],
      [action("bins", "skipped", localToISO("2026-10-05", "18:00"))],
    );
    expect(skipped.slots).toEqual([]);
  });

  it("keeps wall-clock time and day across the late-October DST change", () => {
    // Beirut leaves DST on Sun 2026-10-25; the series starts the Sunday before.
    const item = weeklyFixed("plants", localToISO("2026-10-18", "18:00"));
    const flex = flexibleChore("bath");
    const result = week(
      new Date(2026, 9, 19),
      new Date(2026, 9, 19, 8, 0),
      [item, flex],
      [
        {
          ...schedule("bath", "2026-10-19", "2026-10-25"),
          scheduled_for_time: null,
        },
      ],
    );
    expect(result.slots.map((s) => [s.item.id, s.date, s.time])).toEqual([
      ["plants", "2026-10-25", "18:00"],
      ["bath", "2026-10-25", null], // date-only sorts after timed slots
    ]);
    const bath = result.slots.find((s) => s.item.id === "bath")!;
    expect(new Date(bath.plannedAt).getDate()).toBe(25);
  });

  it("offers an undated one-off for any remaining day of the week", () => {
    const result = week(WEEK, WED, [oneOff("garage", null)]);
    const todo = result.todos.find((t) => t.key === "undated:garage");
    expect(todo?.kind).toBe("undated");
    expect(todo?.days.filter((d) => d.enabled)).toHaveLength(5);
  });

  it("shows an all-day one-off without a time", () => {
    const noon = localToISO("2026-10-08", "12:00");
    const allDay = {
      ...oneOff("windows", noon),
      metadata_json: { all_day: true },
    } as ItemWithDetails;
    const result = week(WEEK, WED, [allDay, oneOff("bins", noon)]);
    const time = (id: string) =>
      result.slots.find((s) => s.item.id === id)?.time;
    expect(time("windows")).toBeNull();
    expect(time("bins")).toBe("12:00");
  });

  it("keeps an overdue dated one-off from before the week reachable", () => {
    const due = localToISO("2026-09-20", "10:00");
    const result = week(WEEK, WED, [oneOff("oven", due)]);
    expect(result.overdue.map((s) => s.date)).toEqual(["2026-09-20"]);
  });
});

describe("buildChoreWeek — Catalogue templates without a routine", () => {
  it("counts existing one-off instances and blocks their day", () => {
    const tpl = template("towels", { flexible_occurrences: 2 });
    const instance = {
      ...oneOff("towels-1", localToISO("2026-10-08", "09:00")),
      source_catalogue_item_id: "towels",
    } as ItemWithDetails;
    const result = week(WEEK, WED, [instance], [], [], [tpl]);
    const todo = result.todos.find((t) => t.key === "tpl:towels");
    expect(todo?.remaining).toBe(1);
    expect(todo?.days.find((d) => d.date === "2026-10-08")?.enabled).toBe(
      false,
    );
  });

  it("is represented by its routine item when one exists", () => {
    const tpl = template("tpl-sheets");
    const routine = flexibleChore("sheets");
    const result = week(WEEK, WED, [routine], [], [], [tpl]);
    expect(result.todos.map((t) => t.key)).toEqual(["flex:sheets"]);
  });

  it("offers a room-tagged template once per room (room order, unknown rooms ignored) and counts instances per room", () => {
    const room = (id: string, position: number) =>
      ({ id, name: id, position }) as unknown as HomeRoom;
    const rooms = [room("Corridor", 0), room("Kitchen", 1)];
    const mop = template("mop", { name: "Mop", room_ids: ["Kitchen", "Corridor", "gone"] });
    const plain = template("zeta", { name: "Zeta" });
    const kitchenMop = {
      ...oneOff("mop-k", localToISO("2026-10-08", "09:00")),
      source_catalogue_item_id: "mop",
      metadata_json: { room_id: "Kitchen" },
    } as ItemWithDetails;

    const noRooms = week(WEEK, WED, [], [], [], [mop, plain]);
    expect(noRooms.todos.map((t) => t.key)).toEqual(["tpl:mop", "tpl:zeta"]);

    const result = week(WEEK, WED, [kitchenMop], [], [], [mop, plain], {}, rooms);
    expect(result.todos.map((t) => [t.key, t.room])).toEqual([
      ["tpl:mop:Corridor", "Corridor"],
      ["tpl:zeta", null],
    ]);
  });
});

describe("unassigning a one-off", () => {
  const dueAt = localToISO("2026-10-08", "09:00");

  it("allows a Catalogue instance and a plain alert-free dated item", () => {
    const instance = {
      ...oneOff("towels-1", dueAt),
      source_catalogue_item_id: "towels",
      is_template_instance: true,
      alerts: [{ id: "a" }],
    } as unknown as ItemWithDetails;
    const result = week(WEEK, WED, [instance, oneOff("shelf", dueAt)]);
    expect(result.slots.map((s) => canUnassignOneOff(s))).toEqual([true, true]);
  });

  it("refuses a dated item that has its own alerts, and recurring chores", () => {
    const alerted = {
      ...oneOff("oven", dueAt),
      alerts: [{ id: "a" }],
    } as unknown as ItemWithDetails;
    const fixed = weeklyFixed("bins", localToISO("2026-09-28", "18:00"));
    const result = week(WEEK, WED, [alerted, fixed]);
    expect(result.slots.map((s) => canUnassignOneOff(s))).toEqual([
      false,
      false,
    ]);
  });

  it("a cancelled instance frees its template slot again", () => {
    const tpl = template("towels");
    const cancelled = {
      ...oneOff("towels-1", dueAt),
      source_catalogue_item_id: "towels",
      status: "cancelled",
    } as unknown as ItemWithDetails;
    const result = week(WEEK, WED, [cancelled], [], [], [tpl]);
    expect(result.todos.find((t) => t.key === "tpl:towels")?.remaining).toBe(1);
  });
});

describe("slot identity helpers", () => {
  it("never reuses an index held by any row in the period", () => {
    const rows = [
      schedule("x", "2026-10-05", "2026-10-05", 0),
      schedule("x", "2026-10-05", "2026-10-06", 2),
      schedule("x", "2026-09-28", "2026-09-29", 1),
    ];
    expect(nextFreeOccurrenceIndex(rows, "x", "2026-10-05")).toBe(1);
    expect(nextFreeOccurrenceIndex(rows, "x", "2026-09-28")).toBe(0);
  });

  it("moves only within the slot's period, never onto a day it already holds", () => {
    const item = flexibleChore("mop");
    const rows = [
      schedule("mop", "2026-10-05", "2026-10-08", 0),
      schedule("mop", "2026-10-05", "2026-10-10", 1),
    ];
    const result = week(WEEK, WED, [item], rows, [], [], { "tpl-mop": 2 });
    const slot = result.slots.find((s) => s.date === "2026-10-08")!;
    const options = moveDayOptions(slot, result.days, rows, "2026-10-07");
    expect(options.filter((o) => o.enabled).map((o) => o.date)).toEqual([
      "2026-10-07",
      "2026-10-09",
      "2026-10-11",
    ]);
  });
});

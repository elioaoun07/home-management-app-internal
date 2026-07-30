import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ItemOccurrenceAction } from "@/features/items/useItemActions";
import { fetchFlexibleRoutines } from "@/features/items/useFlexibleRoutines";
import type { FlexibleSchedule, ItemWithDetails } from "@/types/items";
import { describe, expect, it } from "vitest";
import { expandOccurrencesForRange } from "./expandOccurrences";

const activationDay = "2026-05-25T09:00:00.000Z";
const scheduledDay = "2026-05-27";
const flexiblePlacementViews = [
  "src/components/web/WebCalendar.tsx",
  "src/components/web/WebWeekView.tsx",
  "src/components/web/WebTodayView.tsx",
  "src/components/web/WebTabletMissionControl.tsx",
  "src/components/web/WebEventsDashboard.tsx",
  "src/components/items/CalendarView.tsx",
];

function makeFlexibleItem(): ItemWithDetails {
  return {
    id: "item-flexible-workout",
    user_id: "user-1",
    type: "task",
    title: "Workout",
    priority: "normal",
    status: "pending",
    created_at: activationDay,
    updated_at: activationDay,
    is_public: false,
    responsible_user_id: "user-1",
    reminder_details: {
      item_id: "item-flexible-workout",
      due_at: activationDay,
      has_checklist: false,
    },
    recurrence_rule: {
      id: "rule-flexible-workout",
      item_id: "item-flexible-workout",
      rrule: "FREQ=DAILY;COUNT=7",
      start_anchor: activationDay,
      is_flexible: true,
      flexible_period: "weekly",
      exceptions: [],
    },
  };
}

function makeSchedule(): FlexibleSchedule {
  return {
    id: "schedule-flexible-workout",
    item_id: "item-flexible-workout",
    period_start_date: "2026-05-25",
    scheduled_for_date: scheduledDay,
    scheduled_for_time: "18:30",
    occurrence_index: 0,
    created_at: "2026-05-25T10:00:00.000Z",
    created_by: "user-1",
  };
}

describe("flexible routine placement", () => {
  it("skips flexible RRULE expansion and places the item from item_flexible_schedules", async () => {
    const item = makeFlexibleItem();
    const occurrenceActions: ItemOccurrenceAction[] = [];

    const activationDayOccurrences = expandOccurrencesForRange({
      items: [item],
      rangeStart: new Date("2026-05-25T00:00:00.000Z"),
      rangeEnd: new Date("2026-05-25T23:59:59.999Z"),
      occurrenceActions,
    });

    expect(activationDayOccurrences).toEqual([]);

    const flexibleRoutines = await fetchFlexibleRoutines(
      [item],
      [makeSchedule()],
      occurrenceActions,
      [],
      new Map(),
      new Date(2026, 4, 27, 12),
    );

    expect(flexibleRoutines.scheduled).toHaveLength(1);
    expect(
      flexibleRoutines.scheduled[0]?.flexibleSchedule?.scheduled_for_date,
    ).toBe(scheduledDay);
  });

  it("keeps documented schedule views on the flexible skip plus inject pattern", () => {
    for (const viewPath of flexiblePlacementViews) {
      const source = readFileSync(join(process.cwd(), viewPath), "utf8");

      // There are two legitimate ways to honour "skip flexible RRULE expansion",
      // and this guard used to recognise only one of them:
      //
      //  a. the view runs its own expansion loop, so it needs the inline
      //     `recurrence_rule?.is_flexible` continue (5 of the 6 views), or
      //  b. the view delegates to `expandOccurrencesInRange`, which already owns
      //     the skip (`is_flexible && !includeFlexible -> continue`) and takes the
      //     scheduled rows as a parameter — WebTodayView.
      //
      // Demanding the literal `is_flexible` string from every view failed (b)
      // even though (b) is the *better* pattern: the rule lives in one place
      // instead of being re-implemented per view. Asserting the behaviour rather
      // than one spelling of it keeps the guard honest — a view that does its own
      // expansion with no guard still fails, which is the drift that matters.
      const delegatesToHelper = source.includes("expandOccurrencesInRange");
      const hasInlineSkip = /recurrence_rule\??\.is_flexible/.test(source);
      expect(
        delegatesToHelper || hasInlineSkip,
        `${viewPath} must skip flexible RRULE expansion — either inline via ` +
          `recurrence_rule?.is_flexible, or by delegating to expandOccurrencesInRange`,
      ).toBe(true);

      expect(source, `${viewPath} must read flexible routines`).toContain(
        "useFlexibleRoutines",
      );
      // A delegating view passes the scheduled rows into the helper instead of
      // reading `scheduled_for_date` off them itself.
      if (!delegatesToHelper) {
        expect(source, `${viewPath} must inject scheduled flexible rows`).toContain(
          "scheduled_for_date",
        );
      }
    }
  });
});

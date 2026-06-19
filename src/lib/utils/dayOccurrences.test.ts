// Regression coverage for the "Skip duplicates a recurring occurrence" bug
// (ERA Notes/10 - Project Management/Schedule/4 - Recurrence & Occurrence
// Actions.md, §0/§1). getOccurrencesForDay is the engine /reminders and
// Today actually use, and is pure logic (no Supabase), so it's tested
// directly against item_occurrence_actions rows rather than through mocks.

import type { ItemOccurrenceAction } from "@/features/items/useItemActions";
import { isOccurrenceCompleted } from "@/features/items/useItemActions";
import type { ItemWithDetails } from "@/types/items";
import { describe, expect, it } from "vitest";
import { getOccurrencesForDay } from "./dayOccurrences";

// 2026-01-04 is a Sunday; weekly RRULE with no BYDAY repeats on the
// start_anchor's weekday.
const anchor = "2026-01-04T09:00:00.000Z";
const lastSunday = new Date("2026-01-04T09:00:00.000Z");
const thisSunday = new Date("2026-01-11T09:00:00.000Z");

function makeWeeklyReminder(): ItemWithDetails {
  return {
    id: "item-weekly-reminder",
    user_id: "user-1",
    type: "reminder",
    title: "Take out recycling",
    priority: "normal",
    status: "pending",
    created_at: anchor,
    updated_at: anchor,
    is_public: false,
    responsible_user_id: "user-1",
    reminder_details: {
      item_id: "item-weekly-reminder",
      due_at: anchor,
      has_checklist: false,
    },
    recurrence_rule: {
      id: "rule-weekly-reminder",
      item_id: "item-weekly-reminder",
      rrule: "FREQ=WEEKLY",
      start_anchor: anchor,
      exceptions: [],
    },
  };
}

function makeAction(
  overrides: Partial<ItemOccurrenceAction>,
): ItemOccurrenceAction {
  return {
    id: `action-${Math.random()}`,
    item_id: "item-weekly-reminder",
    occurrence_date: lastSunday.toISOString(),
    action_type: "completed",
    created_at: lastSunday.toISOString(),
    ...overrides,
  };
}

describe("getOccurrencesForDay — skip vs. complete vs. move", () => {
  it("skip marks the past occurrence handled and does NOT duplicate onto the next occurrence", () => {
    const item = makeWeeklyReminder();
    const actions: ItemOccurrenceAction[] = [
      makeAction({ action_type: "skipped" }),
    ];

    const onSkippedDay = getOccurrencesForDay([item], lastSunday, actions);
    expect(onSkippedDay).toHaveLength(1);
    expect(onSkippedDay[0].isCompleted).toBe(true);
    expect(onSkippedDay[0].isPostponed).toBeUndefined();

    // This is the exact repro from file 4 §0: skipping last Sunday must not
    // create a second copy on the next scheduled Sunday.
    const onNextOccurrence = getOccurrencesForDay([item], thisSunday, actions);
    expect(onNextOccurrence).toHaveLength(1);
    expect(onNextOccurrence[0].isCompleted).toBe(false);
    expect(onNextOccurrence[0].isPostponed).toBeUndefined();
  });

  it("complete marks only the completed occurrence's own date as handled", () => {
    const item = makeWeeklyReminder();
    const actions: ItemOccurrenceAction[] = [
      makeAction({ action_type: "completed" }),
    ];

    const onCompletedDay = getOccurrencesForDay([item], lastSunday, actions);
    expect(onCompletedDay).toHaveLength(1);
    expect(onCompletedDay[0].isCompleted).toBe(true);

    const onNextOccurrence = getOccurrencesForDay([item], thisSunday, actions);
    expect(onNextOccurrence).toHaveLength(1);
    expect(onNextOccurrence[0].isCompleted).toBe(false);
  });

  it("move to a date (postpone) hides the original date and shows once on the new date", () => {
    const item = makeWeeklyReminder();
    // A few days out (not the very next calendar day) so the assertion isn't
    // confounded by getOccurrencesForDay's day-boundary lookahead.
    const movedTo = new Date("2026-01-07T09:00:00.000Z"); // Wednesday, no natural occurrence
    const actions: ItemOccurrenceAction[] = [
      makeAction({
        action_type: "postponed",
        postponed_to: movedTo.toISOString(),
        postpone_type: "tomorrow",
      }),
    ];

    const onOriginalDate = getOccurrencesForDay([item], lastSunday, actions);
    expect(onOriginalDate).toHaveLength(1);
    expect(onOriginalDate[0].isCompleted).toBe(true);

    const onMovedDate = getOccurrencesForDay([item], movedTo, actions);
    expect(onMovedDate).toHaveLength(1);
    expect(onMovedDate[0].isPostponed).toBe(true);
    expect(onMovedDate[0].isCompleted).toBe(false);
  });

  it("does not duplicate when a postponed date collides with the series' own next occurrence", () => {
    const item = makeWeeklyReminder();
    // Postponing onto a date the weekly series already lands on is exactly
    // the historical "Skip -> next occurrence" trap; the engine must dedupe.
    const actions: ItemOccurrenceAction[] = [
      makeAction({
        action_type: "postponed",
        postponed_to: thisSunday.toISOString(),
        postpone_type: "custom",
      }),
    ];

    const onNextOccurrence = getOccurrencesForDay([item], thisSunday, actions);
    expect(onNextOccurrence).toHaveLength(1);
    expect(onNextOccurrence[0].isPostponed).toBeUndefined();
  });
});

describe("isOccurrenceCompleted — occurrence-action math", () => {
  const item = makeWeeklyReminder();

  it.each(["completed", "cancelled", "skipped", "postponed"] as const)(
    "treats %s as handled on its own occurrence date",
    (actionType) => {
      const actions: ItemOccurrenceAction[] = [
        makeAction({ action_type: actionType }),
      ];
      expect(isOccurrenceCompleted(item.id, lastSunday, actions)).toBe(true);
    },
  );

  it("does not mark an untouched date as handled", () => {
    const actions: ItemOccurrenceAction[] = [
      makeAction({ action_type: "completed" }),
    ];
    expect(isOccurrenceCompleted(item.id, thisSunday, actions)).toBe(false);
  });
});

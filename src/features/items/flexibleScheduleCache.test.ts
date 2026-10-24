import type { FlexibleSchedule } from "@/types/items";
import { describe, expect, it, vi } from "vitest";

// The real module opens a browser Supabase client; the cache helpers are pure
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({}) }));

import { removeScheduleRows, upsertScheduleRow } from "./useFlexibleRoutines";

const row = (item: string, period: string, index: number, date: string): FlexibleSchedule => ({
  id: `${item}-${period}-${index}`,
  item_id: item,
  period_start_date: period,
  occurrence_index: index,
  scheduled_for_date: date,
  scheduled_for_time: null,
  created_at: "2026-10-01T00:00:00.000Z",
});
const PERIOD = "2026-10-19";

describe("optimistic flexible schedule rows", () => {
  it("adds a slot that does not exist yet, keeping the others", () => {
    const rows = [row("iron", PERIOD, 0, "2026-10-20")];
    const next = upsertScheduleRow(rows, {
      itemId: "iron", periodStartDate: PERIOD, scheduledForDate: "2026-10-24", scheduledForTime: "10:00", occurrenceIndex: 1,
    });
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ item_id: "iron", occurrence_index: 1, scheduled_for_date: "2026-10-24", scheduled_for_time: "10:00" });
    expect(rows).toHaveLength(1);
  });

  it("moves an existing slot (same item / period / index) instead of adding one", () => {
    const rows = [row("iron", PERIOD, 0, "2026-10-20"), row("iron", PERIOD, 1, "2026-10-22")];
    const next = upsertScheduleRow(rows, {
      itemId: "iron", periodStartDate: PERIOD, scheduledForDate: "2026-10-25", occurrenceIndex: 1,
    });
    expect(next.map((r) => [r.occurrence_index, r.scheduled_for_date])).toEqual([[0, "2026-10-20"], [1, "2026-10-25"]]);
    expect(next[1].id).toBe("iron-" + PERIOD + "-1");
  });

  it("removes one slot, or the whole period when no index is given", () => {
    const rows = [
      row("iron", PERIOD, 0, "2026-10-20"),
      row("iron", PERIOD, 1, "2026-10-22"),
      row("iron", "2026-10-26", 0, "2026-10-27"),
      row("mop", PERIOD, 0, "2026-10-21"),
    ];
    expect(removeScheduleRows(rows, { itemId: "iron", periodStartDate: PERIOD, occurrenceIndex: 1 }).map((r) => r.id)).toEqual([
      `iron-${PERIOD}-0`, "iron-2026-10-26-0", `mop-${PERIOD}-0`,
    ]);
    expect(removeScheduleRows(rows, { itemId: "iron", periodStartDate: PERIOD }).map((r) => r.id)).toEqual([
      "iron-2026-10-26-0", `mop-${PERIOD}-0`,
    ]);
  });
});

// The optimistic row from a bulk create must do exactly what the saved row does on the
// Chores page: leave "To plan" and land on its day, before any request has returned.
import { optimisticItem } from "@/features/items/bulkItems";
import { organizeFlexibleRoutines } from "@/features/items/useFlexibleRoutines";
import { prepareItemCreate } from "@/lib/items/createContract";
import { buildTemplateInstanceInput } from "@/lib/schedule/catalogueInstance";
import { localToISO } from "@/lib/utils/date";
import type { CatalogueItem, HomeRoom } from "@/types/catalogue";
import type { ItemWithDetails } from "@/types/items";
import { describe, expect, it } from "vitest";
import { ALL_DAY_TIME, buildChoreWeek } from "./choreWeek";

const ME = "11111111-1111-4111-8111-111111111111";
const WEEK = new Date(2026, 9, 5);
const WED = new Date(2026, 9, 7, 8, 0);
const room = (id: string, position: number) => ({ id, name: id, position }) as unknown as HomeRoom;
const rooms = [room("Corridor", 0), room("Kitchen", 1)];
const mop = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Mop", is_chore: true, is_flexible_routine: true,
  recurrence_pattern: "weekly", flexible_occurrences: 1, archived_at: null, status: "active",
  item_type: "task", priority: "normal", is_public: true, room_ids: ["Corridor", "Kitchen"],
} as unknown as CatalogueItem;

function plan(items: ItemWithDetails[]) {
  const empty = organizeFlexibleRoutines([], [], [], [], new Map(), WEEK);
  return buildChoreWeek({ weekOf: WEEK, now: WED, items, actions: [], schedules: [], templates: [mop], rooms, flexible: [empty, empty] });
}

function placed(id: string, roomId: string, date: string, time: string | null) {
  const input = buildTemplateInstanceInput(mop, localToISO(date, time ?? ALL_DAY_TIME), ME, {
    allDay: time === null, room: { id: roomId, name: roomId },
  });
  return optimisticItem({ ...prepareItemCreate({ ...input, id }), id } as never, ME);
}
const id = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";

describe("optimistic chore placement", () => {
  it("offers one to-do per room before anything is placed", () => {
    expect(plan([]).todos.map((t) => t.key)).toEqual([`tpl:${mop.id}:Corridor`, `tpl:${mop.id}:Kitchen`]);
  });

  it("an all-day placement leaves To plan and lands on its day at once", () => {
    const week = plan([placed(id, "Kitchen", "2026-10-08", null)]);
    expect(week.todos.filter((t) => !t.extra).map((t) => t.key)).toEqual([`tpl:${mop.id}:Corridor`]);
    expect(week.slots).toHaveLength(1);
    expect(week.slots[0]).toMatchObject({ kind: "dated", date: "2026-10-08", time: null, done: false });
    expect(week.slots[0].item).toMatchObject({ title: "Mop · Kitchen", responsible_user_id: ME, is_chore: true });
  });

  it("a timed placement keeps its time", () => {
    const week = plan([placed(id, "Corridor", "2026-10-09", "17:30")]);
    expect(week.slots[0]).toMatchObject({ date: "2026-10-09", time: "17:30" });
  });

  it("placing every room empties To plan", () => {
    const week = plan([
      placed(id, "Kitchen", "2026-10-08", null),
      placed("aaaaaaaa-aaaa-4aaa-8aaa-000000000002", "Corridor", "2026-10-08", null),
    ]);
    // A met target leaves To plan; it stays offered only as an extra
    expect(week.todos.filter((t) => !t.extra)).toEqual([]);
    expect(week.slots).toHaveLength(2);
  });
});

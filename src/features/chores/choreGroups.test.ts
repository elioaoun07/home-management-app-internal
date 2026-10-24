import type { ItemWithDetails } from "@/types/items";
import { describe, expect, it } from "vitest";
import { groupSlotsByChore } from "./choreGroups";
import type { ChoreSlot } from "./choreWeek";

const slot = (
  id: string,
  date: string,
  title: string,
  source: string | null,
): ChoreSlot => ({
  key: `one:${id}:${date}`,
  kind: "dated",
  item: { id, title, source_catalogue_item_id: source } as ItemWithDetails,
  date,
  time: null,
  plannedAt: `${date}T09:00:00.000Z`,
  done: false,
});

describe("groupSlotsByChore", () => {
  it("collapses one chore across rooms on the same day", () => {
    const entries = groupSlotsByChore(
      [
        slot("a", "2026-10-20", "Sweep floor · Kitchen", "sweep"),
        slot("b", "2026-10-20", "Dishes", null),
        slot("c", "2026-10-20", "Sweep floor · Bedroom", "sweep"),
      ],
      (id) => (id === "sweep" ? "Sweep floor" : undefined),
    );
    expect(entries.map((e) => e.kind)).toEqual(["group", "slot"]);
    const group = entries[0].kind === "group" ? entries[0].group : null;
    expect(group?.title).toBe("Sweep floor");
    expect(group?.slots.map((s) => s.item.id)).toEqual(["a", "c"]);
  });

  it("keeps a lone room, and other days, as single rows", () => {
    const entries = groupSlotsByChore([
      slot("a", "2026-10-20", "Sweep floor · Kitchen", "sweep"),
      slot("b", "2026-10-21", "Sweep floor · Bedroom", "sweep"),
    ]);
    expect(entries.map((e) => e.kind)).toEqual(["slot", "slot"]);
  });

  it("falls back to the title without the room", () => {
    const entries = groupSlotsByChore([
      slot("a", "2026-10-20", "Mop · Kitchen", "mop"),
      slot("b", "2026-10-20", "Mop · Bath", "mop"),
    ]);
    expect(entries[0].kind === "group" && entries[0].group.title).toBe("Mop");
  });
});

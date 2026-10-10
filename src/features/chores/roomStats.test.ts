import { describe, expect, it } from "vitest";
import type { ChoreSlot, ChoreTodo } from "./choreWeek";
import { roomStats } from "./roomStats";

const todo = (key: string, roomId: string | null, remaining = 1) =>
  ({ key, roomId, room: roomId, remaining }) as unknown as ChoreTodo;
const slot = (roomId: string | null, done: boolean) =>
  ({ done, item: { metadata_json: roomId ? { room_id: roomId } : {} } }) as unknown as ChoreSlot;

describe("roomStats", () => {
  it("counts unassigned, assigned and done per room", () => {
    const stats = roomStats(
      [todo("a", "k", 2), todo("b", "k"), todo("c", "s")],
      [slot("k", false), slot("k", true), slot("k", true), slot(null, false)],
    );
    expect(stats.get("k")).toMatchObject({ unassigned: 3, assigned: 1, done: 2 });
    expect(stats.get("s")).toMatchObject({ unassigned: 1, assigned: 0, done: 0 });
    expect(stats.get(null)).toMatchObject({ assigned: 1 });
  });

  it("moves staged placements from unassigned to assigned, capped at what is left", () => {
    const stats = roomStats(
      [todo("a", "k", 2), todo("b", "k")],
      [],
      new Map([
        ["a", 1],
        ["b", 5],
      ]),
    );
    expect(stats.get("k")).toMatchObject({ unassigned: 1, assigned: 2 });
  });
});

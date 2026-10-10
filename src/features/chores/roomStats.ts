import type { ChoreSlot, ChoreTodo } from "./choreWeek";

export interface RoomStat {
  roomId: string | null;
  room: string | null;
  /** Still to place this period (staged placements already subtracted) */
  unassigned: number;
  /** Placed and open, plus placements staged in the Assign form */
  assigned: number;
  done: number;
}

/** Chores placed from a template remember their room (`metadata_json.room_id`). */
export function slotRoomId(slot: ChoreSlot): string | null {
  const id = slot.item.metadata_json?.room_id;
  return typeof id === "string" ? id : null;
}

/**
 * Per-room counts for the Assign form: how many chores are still unplaced,
 * placed (open) and done. `staged` maps a to-do key to how many placements the
 * user has staged for it but not saved yet.
 */
export function roomStats(
  todos: ChoreTodo[],
  slots: ChoreSlot[],
  staged: ReadonlyMap<string, number> = new Map(),
): Map<string | null, RoomStat> {
  const stats = new Map<string | null, RoomStat>();
  const stat = (roomId: string | null, room: string | null): RoomStat => {
    let entry = stats.get(roomId);
    if (!entry) {
      entry = { roomId, room, unassigned: 0, assigned: 0, done: 0 };
      stats.set(roomId, entry);
    }
    return entry;
  };
  for (const todo of todos) {
    const entry = stat(todo.roomId, todo.room);
    const stagedCount = Math.min(staged.get(todo.key) ?? 0, todo.remaining);
    entry.unassigned += todo.remaining - stagedCount;
    entry.assigned += stagedCount;
  }
  for (const slot of slots) {
    const roomId = slotRoomId(slot);
    // Rooms we have no to-do for yet still count their placed chores
    const entry = stat(roomId, todos.find((t) => t.roomId === roomId)?.room ?? null);
    if (slot.done) entry.done += 1;
    else entry.assigned += 1;
  }
  return stats;
}

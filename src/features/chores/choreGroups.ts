// Agenda grouping for the Chores page: the same chore placed in several rooms on
// one day ("Sweep floor · Kitchen", "· Bedroom", …) collapses into one group the
// person can complete in one tap. Pure — no React, no I/O.

import type { ChoreSlot } from "./choreWeek";

export interface ChoreGroup {
  key: string;
  /** Chore name without the room */
  title: string;
  slots: ChoreSlot[];
}

export type ChoreAgendaEntry =
  | { kind: "slot"; slot: ChoreSlot }
  | { kind: "group"; group: ChoreGroup };

/** "Sweep floor · Kitchen" → "Sweep floor" (instance titles are `<chore> · <room>`). */
function withoutRoom(title: string): string {
  const cut = title.lastIndexOf(" · ");
  return cut > 0 ? title.slice(0, cut) : title;
}

/**
 * Groups slots of the same Catalogue chore on the same day (two or more), in
 * the order of their first slot. Everything else stays a single slot.
 * `nameFor` resolves the template name; the instance title is the fallback.
 */
export function groupSlotsByChore(
  slots: ChoreSlot[],
  nameFor: (templateId: string) => string | undefined = () => undefined,
): ChoreAgendaEntry[] {
  const byKey = new Map<string, ChoreSlot[]>();
  const keyOf = (slot: ChoreSlot): string | null => {
    const source = slot.item.source_catalogue_item_id;
    return source ? `${slot.date}:${source}` : null;
  };
  for (const slot of slots) {
    const key = keyOf(slot);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(slot);
    byKey.set(key, list);
  }

  const entries: ChoreAgendaEntry[] = [];
  const emitted = new Set<string>();
  for (const slot of slots) {
    const key = keyOf(slot);
    const members = key ? byKey.get(key) : undefined;
    if (!key || !members || members.length < 2) {
      entries.push({ kind: "slot", slot });
      continue;
    }
    if (emitted.has(key)) continue;
    emitted.add(key);
    const source = slot.item.source_catalogue_item_id as string;
    entries.push({
      kind: "group",
      group: {
        key: `group:${key}`,
        title: nameFor(source) ?? withoutRoom(slot.item.title),
        slots: members,
      },
    });
  }
  return entries;
}

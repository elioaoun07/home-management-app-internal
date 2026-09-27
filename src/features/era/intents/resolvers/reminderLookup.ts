// src/features/era/intents/resolvers/reminderLookup.ts
// HUB-78 — "move the dentist to Friday" with nothing in focus: find the
// reminder BY NAME among the items the household bundle already returns
// (get_schedule_bundle — Hard Rule 21), never a second query path. Only the
// speaker's own reminders are acted on; a partner-only match is an honest
// limit (plan §5: partner assignee escalates, and ERA has no confirm path
// for another person's item yet).

import { fetchItems } from "@/features/items/useItems";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { ItemWithDetails } from "@/types/items";

export interface ReminderCandidate {
  id: string;
  title: string;
  recurring: boolean;
  mine: boolean;
  dueAt: string | null;
}

const FILLER_RE = /\b(?:the|my|our|a|an|reminder|reminders|task|appointment|one)\b/gi;

export function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(FILLER_RE, " ").replace(/[^a-z0-9؀-ۿ ]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Rank reminders against a spoken name. Exact normalized title first, then
 * titles that start with / contain the hint (or the reverse). Returns only
 * the best tier, so two equally good matches come back together and the
 * caller asks instead of guessing.
 */
export function rankCandidates(items: ReminderCandidate[], hint: string): ReminderCandidate[] {
  const h = normalizeTitle(hint);
  if (!h) return [];
  const tiers: ReminderCandidate[][] = [[], [], []];
  for (const it of items) {
    const t = normalizeTitle(it.title);
    if (!t) continue;
    if (t === h) tiers[0].push(it);
    else if (t.startsWith(h) || h.startsWith(t)) tiers[1].push(it);
    else if (t.includes(h) || h.includes(t)) tiers[2].push(it);
  }
  return tiers.find((tier) => tier.length > 0) ?? [];
}

function toCandidate(item: ItemWithDetails, userId: string | null): ReminderCandidate {
  return {
    id: item.id,
    title: item.title,
    recurring: Boolean(item.recurrence_rule?.rrule),
    mine: userId !== null && item.user_id === userId,
    dueAt: item.reminder_details?.due_at ?? null,
  };
}

/** Open reminders matching the name, best tier only. `null` = lookup failed. */
export async function findReminderCandidates(hint: string): Promise<ReminderCandidate[] | null> {
  try {
    const [items, user] = await Promise.all([
      fetchItems({ type: "reminder" }),
      supabaseBrowser().auth.getUser(),
    ]);
    const userId = user.data.user?.id ?? null;
    const open = items.filter(
      (i) => !["completed", "archived", "cancelled", "draft"].includes(String(i.status)),
    );
    return rankCandidates(open.map((i) => toCandidate(i, userId)), hint);
  } catch {
    return null;
  }
}

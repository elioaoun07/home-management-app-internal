// src/features/era/focusRehydrate.ts
// HUB-84 — "it" survives a reload. Focus memory lives in the page; the
// assistant rows in era_messages already carry each result's ids (the turn's
// metadata + outcome), so on load the recent editable results are rebuilt
// from them — within the same 30-minute window focus memory uses.

import { FOCUS_TTL_MS, type FocusEntity } from "./focusMemory";

interface MessageLike {
  role: string;
  intent_payload: Record<string, unknown> | null;
  created_at: string;
}

/** Oldest → newest, so the most recent result ends up first in focus. */
export function focusFromMessages(messages: readonly MessageLike[], now: number = Date.now()): FocusEntity[] {
  const out: FocusEntity[] = [];
  for (const m of messages) {
    if (m.role !== "assistant" || !m.intent_payload) continue;
    const at = Date.parse(m.created_at);
    if (!Number.isFinite(at) || now - at >= FOCUS_TTL_MS) continue;
    const p = m.intent_payload;

    if (Array.isArray(p.messageIds) && p.messageIds.length && typeof p.threadId === "string" && Array.isArray(p.items)) {
      out.unshift({
        id: String(p.messageIds[0]),
        type: "shopping",
        title: (p.items as string[]).join(", "),
        addedAt: at,
        meta: { messageIds: p.messageIds, threadId: p.threadId, items: p.items, groupId: p.groupId ?? null },
      });
      continue;
    }
    const h = p.handoff as Record<string, unknown> | undefined;
    if (typeof p.draftId === "string" && h?.kind === "spend") {
      out.unshift({
        id: p.draftId,
        type: "draft",
        title: typeof p.categoryName === "string" ? p.categoryName : "Draft",
        addedAt: at,
        meta: {
          draftId: p.draftId,
          accountId: h.accountId,
          amount: h.amount,
          currency: h.currency,
          categoryId: h.categoryId,
          subcategoryId: h.subcategoryId,
          description: h.description,
          date: h.date,
        },
      });
      continue;
    }
    if (typeof p.itemId === "string" && typeof p.title === "string" && !p.deletedItemId) {
      out.unshift({ id: p.itemId, type: "reminder", title: p.title, addedAt: at });
    }
  }
  // De-dupe by id, keeping the newest.
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

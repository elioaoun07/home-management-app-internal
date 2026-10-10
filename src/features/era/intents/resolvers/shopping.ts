// src/features/era/intents/resolvers/shopping.ts
// HUB-78 marginal-cost capability — "add milk and eggs to the shopping list".
// Source-owned adapter: posts to the household shopping thread through the
// same /api/hub/messages route Hub chat uses (one message per item, the
// shape ShoppingListView already renders). Explicit requests only — DEC-03
// governs automatic additions. Inverse: DELETE /api/hub/messages (soft).

import { eraArtifact, type EraArtifact } from "@/lib/era/artifacts";
import { safeFetch } from "@/lib/safeFetch";
import type { FocusEntity } from "../../focusMemory";
import type { EraActiveProposal, EraPendingTurn } from "../../types";

interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
  ok?: boolean;
  focus?: FocusEntity;
  pending?: EraPendingTurn | null;
  proposal?: EraActiveProposal;
  /** What this write left behind (src/lib/era/artifacts.ts). */
  artifacts?: EraArtifact[];
}

interface ThreadLite {
  id: string;
  purpose?: string | null;
  is_private?: boolean | null;
}

/** "milk, eggs and bread" → ["Milk", "Eggs", "Bread"]. */
export function splitShoppingItems(raw: string): string[] {
  return raw
    .replace(/\bin\s+(?:the\s+)?hub(?:\s+chat)?\b/gi, " ")
    .replace(/\bunder\s+\S+(?:\s+group)?\b/gi, " ")
    .split(/,|\band\b|&|\+/i)
    // HUB-97 — "…, eggs. To spinneys shopping list" leaves "eggs." behind.
    .map((s) => s.replace(/^\s*(?:some|a|an|the|more)\s+/i, "").replace(/^[\s.;:!?]+|[\s.;:!?]+$/g, ""))
    .filter((s) => s.length > 0 && s.length <= 60)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

export async function resolveAddShopping(items: string[], groupHint?: string): Promise<ResolveResult> {
  if (items.length === 0) return { text: "Add what?", ok: false };
  try {
    const list = await findShoppingThread();
    if (!list) return { text: "No shopping list yet.", ok: false };

    // HUB-84 — "add salt under Spinneys": resolve the group first. One match
    // → added straight into it; none or several → added to General, then the
    // edit contract offers to create / asks which (applyShoppingGroup).
    let groupId: string | null = null;
    let groupName: string | null = null;
    let unresolvedGroup: string | undefined;
    if (groupHint) {
      const groups = await listShoppingGroups(list.id);
      const matches = groups ? matchShoppingGroups(groups, groupHint) : [];
      if (matches.length === 1) {
        groupId = matches[0].id || null;
        groupName = matches[0].name;
      } else {
        unresolvedGroup = groupHint;
      }
    }

    const ids: string[] = [];
    for (const content of items) {
      const res = await safeFetch("/api/hub/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, thread_id: list.id, ...(groupId ? { shopping_group_id: groupId } : {}) }),
        timeoutMs: 8_000,
      });
      if (!res.ok) break;
      const data = (await res.json()) as { message?: { id?: string } };
      if (data.message?.id) ids.push(data.message.id);
    }
    if (ids.length === 0) return { text: "Couldn't add that.", ok: false };
    const partial = ids.length < items.length;
    const added = items.slice(0, ids.length);
    const focus: FocusEntity = {
      id: ids[0],
      type: "shopping",
      title: added.join(", "),
      addedAt: Date.now(),
      meta: { messageIds: ids, threadId: list.id, items: added, groupId },
    };
    const base: ResolveResult = {
      text: partial
        ? `Added ${ids.length} of ${items.length}.`
        : `Added · ${added.join(", ")}${groupName ? ` · ${groupName}` : ""}`,
      ok: !partial,
      metadata: { messageIds: ids, threadId: list.id, items: added, partial, groupId },
      artifacts: shoppingArtifacts(ids, added, "created", list.id),
      focus,
    };
    if (unresolvedGroup) {
      const follow = await applyShoppingGroupLazy(focus, unresolvedGroup);
      return { ...base, ...follow, text: `${base.text}\n${follow.text}`, metadata: base.metadata, focus: follow.focus ?? focus };
    }
    return base;
  } catch {
    return { text: "Couldn't add that.", ok: false };
  }
}

/** Lazy import breaks the amend ↔ shopping module cycle. */
async function applyShoppingGroupLazy(focus: FocusEntity, hint: string) {
  const { applyShoppingGroup } = await import("./amend");
  return applyShoppingGroup(focus, focus.meta as never, hint);
}

/** One artifact per list row — the shared shape every shopping write returns. */
export function shoppingArtifacts(
  messageIds: string[],
  names: string[],
  action: EraArtifact["action"],
  threadId?: string,
): EraArtifact[] {
  return messageIds.map((id, i) =>
    eraArtifact("shopping_item", action, id, names[i] ?? names[0] ?? "Item", threadId ? { thread: threadId } : undefined),
  );
}

export async function removeShoppingMessages(messageIds: string[]): Promise<boolean> {
  const res = await safeFetch("/api/hub/messages", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageIds }),
    timeoutMs: 8_000,
  });
  return res.ok;
}

// ───────────────────────────── HUB-84: groups + edits ─────────────────────────────
// Reuses the Hub routes the shopping list itself uses:
//   GET/POST  /api/hub/shopping-groups          (list / create a group)
//   PATCH     /api/hub/shopping-groups           move_items_bulk (group_id null = General)
//   PATCH     /api/hub/messages                  set_quantity / update_content (own items)

export interface ShoppingGroup {
  id: string;
  name: string;
}

export async function findShoppingThread(): Promise<ThreadLite | null> {
  const res = await safeFetch("/api/hub/threads", { timeoutMs: 8_000 });
  if (!res.ok) return null;
  const { threads } = (await res.json()) as { threads?: ThreadLite[] };
  return (
    (threads ?? []).find((t) => t.purpose === "shopping" && !t.is_private) ??
    (threads ?? []).find((t) => t.purpose === "shopping") ??
    null
  );
}

export async function listShoppingGroups(threadId: string): Promise<ShoppingGroup[] | null> {
  const res = await safeFetch(`/api/hub/shopping-groups?thread_id=${encodeURIComponent(threadId)}`, { timeoutMs: 8_000 });
  if (!res.ok) return null;
  const { groups } = (await res.json()) as { groups?: ShoppingGroup[] };
  return groups ?? [];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();

/** One exact match wins; otherwise a unique partial match; else every partial match. */
export function matchShoppingGroups(groups: ShoppingGroup[], hint: string): ShoppingGroup[] {
  const h = norm(hint);
  if (!h) return [];
  if (["general", "no group", "none", "ungrouped"].includes(h)) return [{ id: "", name: "General" }];
  const exact = groups.filter((g) => norm(g.name) === h);
  if (exact.length) return exact;
  return groups.filter((g) => {
    const n = norm(g.name);
    return n.includes(h) || h.includes(n);
  });
}

export async function moveShoppingItems(messageIds: string[], groupId: string | null): Promise<boolean> {
  const res = await safeFetch("/api/hub/shopping-groups", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "move_items_bulk", message_ids: messageIds, group_id: groupId }),
    timeoutMs: 8_000,
  });
  return res.ok;
}

export async function createShoppingGroup(threadId: string, name: string): Promise<ShoppingGroup | null> {
  const res = await safeFetch("/api/hub/shopping-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id: threadId, name }),
    timeoutMs: 8_000,
  });
  if (!res.ok) return null;
  const { group } = (await res.json()) as { group?: ShoppingGroup };
  return group ?? null;
}

export async function setShoppingQuantity(messageId: string, quantity: string | null): Promise<boolean> {
  const res = await safeFetch("/api/hub/messages", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set_quantity", message_id: messageId, quantity }),
    timeoutMs: 8_000,
  });
  return res.ok;
}

export async function renameShoppingItem(messageId: string, content: string): Promise<boolean> {
  const res = await safeFetch("/api/hub/messages", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update_content", message_id: messageId, content }),
    timeoutMs: 8_000,
  });
  return res.ok;
}

// ───────────────────────────── HUB-84: items by name ─────────────────────────────

export interface ShoppingItem {
  id: string;
  content: string;
  groupId: string | null;
  quantity: string | null;
  createdAt: string;
}

/** Open (unchecked, unarchived) items on the household list, newest first. */
export async function listOpenShoppingItems(): Promise<{ threadId: string; items: ShoppingItem[] } | null> {
  const list = await findShoppingThread();
  if (!list) return null;
  const res = await safeFetch(`/api/hub/messages?thread_id=${encodeURIComponent(list.id)}`, { timeoutMs: 10_000 });
  if (!res.ok) return null;
  const { messages } = (await res.json()) as {
    messages?: Array<{
      id: string;
      content: string | null;
      checked_at?: string | null;
      archived_at?: string | null;
      deleted_at?: string | null;
      parent_item_id?: string | null;
      shopping_group_id?: string | null;
      item_quantity?: string | null;
      created_at: string;
    }>;
  };
  const items = (messages ?? [])
    .filter((m) => m.content && !m.checked_at && !m.archived_at && !m.deleted_at && !m.parent_item_id)
    .map((m) => ({
      id: m.id,
      content: String(m.content),
      groupId: m.shopping_group_id ?? null,
      quantity: m.item_quantity ?? null,
      createdAt: m.created_at,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { threadId: list.id, items };
}

/** Best-tier name match: exact, then starts-with, then contains. Ties come back together. */
export function matchShoppingItems(items: ShoppingItem[], hint: string): ShoppingItem[] {
  const h = norm(hint).replace(/^(?:the|my|some)\s+/, "");
  if (!h) return [];
  const tiers: ShoppingItem[][] = [[], [], []];
  for (const it of items) {
    const n = norm(it.content);
    if (n === h) tiers[0].push(it);
    else if (n.startsWith(h) || h.startsWith(n)) tiers[1].push(it);
    else if (n.includes(h) || h.includes(n)) tiers[2].push(it);
  }
  return tiers.find((t) => t.length > 0) ?? [];
}

export function shoppingFocusFor(threadId: string, item: ShoppingItem): FocusEntity {
  return {
    id: item.id,
    type: "shopping",
    title: item.content,
    addedAt: Date.now(),
    meta: { messageIds: [item.id], threadId, items: [item.content], groupId: item.groupId, quantity: item.quantity },
  };
}

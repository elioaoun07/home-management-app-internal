// src/features/era/intents/resolvers/amend.ts
// HUB-84 — edit the last result through its type's edit contract. The same
// rules everywhere: resolve the value against real data (one match → apply,
// several → chips, none → offer to create behind a card); Undo only where the
// inverse is demonstrated; money keeps its tier (a transfer edit is a new
// Confirm card, a draft edit is Act + Undo like the draft itself).

import { eraArtifact, type EraArtifact } from "@/lib/era/artifacts";
import { safeFetch } from "@/lib/safeFetch";
import type { FocusEntity } from "../../focusMemory";
import type { EraActiveProposal, EraPendingTurn, EraTransferAction } from "../../types";
import { useEraStore } from "../../useEraStore";
import { saveLexiconRule } from "../../useEraLexicon";
import { moneyIn } from "../formatters/budget";
import { parseEdits, type EditRequest } from "../followUp";
import { prepareTransfer } from "./budget";
import {
  createShoppingGroup,
  listOpenShoppingItems,
  shoppingArtifacts,
  listShoppingGroups,
  matchShoppingItems,
  shoppingFocusFor,
  matchShoppingGroups,
  moveShoppingItems,
  renameShoppingItem,
  setShoppingQuantity,
} from "./shopping";
import { slot } from "./slotBuilders";

export interface AmendResult {
  text: string;
  ok?: boolean;
  metadata?: Record<string, unknown>;
  pending?: EraPendingTurn | null;
  proposal?: EraActiveProposal;
  /** The edited result, re-registered so a second follow-up still finds it. */
  focus?: FocusEntity;
  undo?: () => Promise<boolean>;
  /** What this write left behind (src/lib/era/artifacts.ts). */
  artifacts?: EraArtifact[];
}

const cantChange = (what = "that"): AmendResult => ({ text: `Can't change ${what} here.`, ok: false });

export async function resolveAmend(focus: FocusEntity | null, text: string): Promise<AmendResult> {
  if (!focus) return askWhichItem(text);
  const edits = parseEdits(text);
  switch (focus.type) {
    case "shopping":
      return amendShopping(focus, edits);
    case "draft":
      return amendDraft(focus, edits);
    case "transfer_card":
      return amendTransferCard(focus, edits);
    default:
      return cantChange(edits.group ? "a reminder's group" : "that");
  }
}

/**
 * Nothing to point "it" at (e.g. after a reload): ask ONCE, and WAIT for the
 * answer — offering the newest open list items as chips. A typed answer is
 * looked up by name (resolvePendingSlot → amend.target).
 */
async function askWhichItem(editText: string): Promise<AmendResult> {
  const open = await listOpenShoppingItems().catch(() => null);
  const recent = (open?.items ?? []).slice(0, 4);
  return slot(
    "amend.target",
    "item",
    "Change what?",
    recent.map((i) => ({ label: i.content, value: i.id })),
    { editText },
    editText,
  ) as AmendResult;
}

/** "move salt under Spinneys": find the item on the list by name, then edit it. */
export async function resolveAmendByName(targetHint: string, editText: string): Promise<AmendResult> {
  const open = await listOpenShoppingItems().catch(() => null);
  if (!open) return { text: "Couldn't read the list.", ok: false };
  const matches = matchShoppingItems(open.items, targetHint);
  if (matches.length === 0) return { text: `No "${targetHint}" on the list.`, ok: false };
  if (matches.length > 1) {
    return slot(
      "amend.target",
      "item",
      "Which one?",
      matches.slice(0, 4).map((i) => ({ label: i.content, value: i.id })),
      { editText },
      editText,
    ) as AmendResult;
  }
  return resolveAmend(shoppingFocusFor(open.threadId, matches[0]), editText);
}

/** The answer to "Change what?" / "Which one?": a chip id or a typed name. */
export async function answerAmendTarget(editText: string, answer: string, chipId?: string): Promise<AmendResult | null> {
  const open = await listOpenShoppingItems().catch(() => null);
  if (!open) return null;
  const item = chipId ? open.items.find((i) => i.id === chipId) : undefined;
  const byName = item ? [item] : matchShoppingItems(open.items, answer);
  if (byName.length !== 1) return null;
  return resolveAmend(shoppingFocusFor(open.threadId, byName[0]), editText);
}

// ───────────────────────────── shopping ─────────────────────────────

interface ShoppingMeta {
  messageIds: string[];
  threadId: string;
  items: string[];
  groupId: string | null;
  quantity?: string | null;
}

export async function applyShoppingGroup(
  focus: FocusEntity,
  meta: ShoppingMeta,
  groupHint: string,
): Promise<AmendResult> {
  const groups = await listShoppingGroups(meta.threadId);
  if (groups === null) return { text: "Couldn't read the groups.", ok: false };
  const matches = matchShoppingGroups(groups, groupHint);
  const label = meta.items.join(", ");
  if (matches.length === 0) {
    const name = groupHint.replace(/\b\w/g, (c) => c.toUpperCase());
    const cardText = `New group · ${name} · ${label}`;
    return {
      text: cardText,
      metadata: { proposed: "shoppingGroupCreate" },
      proposal: {
        kind: "native_action",
        text: cardText,
        sourceText: groupHint,
        action: { type: "shoppingGroupCreate", threadId: meta.threadId, name, messageIds: meta.messageIds, previousGroupId: meta.groupId },
      },
    };
  }
  if (matches.length > 1) {
    return slot(
      "shopping.group",
      "groupId",
      "Which group?",
      matches.slice(0, 4).map((g) => ({ label: g.name, value: g.id })),
      { ...meta },
      groupHint,
    ) as AmendResult;
  }
  return moveToGroup(focus, meta, matches[0].id || null, matches[0].name);
}

export async function moveToGroup(
  focus: FocusEntity,
  meta: ShoppingMeta,
  groupId: string | null,
  groupName: string,
): Promise<AmendResult> {
  const ok = await moveShoppingItems(meta.messageIds, groupId).catch(() => false);
  if (!ok) return { text: "Couldn't move it.", ok: false };
  const previous = meta.groupId;
  // Evidence only (HUB-80): a correction is an example, never a default.
  for (const item of meta.items) {
    void saveLexiconRule({
      kind: "example",
      capability: "shopping.add",
      slot: "group",
      phrase: item.toLowerCase(),
      conditions: { item: item.toLowerCase() },
      value: { groupId, name: groupName },
      depends_on: [],
    }).catch(() => null);
  }
  return {
    text: `${meta.items.join(", ")} · ${groupName}`,
    metadata: { messageIds: meta.messageIds, groupId, edited: "group" },
    artifacts: shoppingArtifacts(meta.messageIds, meta.items, "updated", meta.threadId),
    focus: { ...focus, addedAt: Date.now(), meta: { ...meta, groupId } },
    undo: () => moveShoppingItems(meta.messageIds, previous).catch(() => false),
  };
}

async function amendShopping(focus: FocusEntity, edits: EditRequest): Promise<AmendResult> {
  const meta = focus.meta as unknown as ShoppingMeta;
  if (!meta?.messageIds?.length) return cantChange();
  const label = meta.items.join(", ");

  if (edits.remove) {
    const cardText = `Remove · ${label}`;
    return {
      text: cardText,
      proposal: {
        kind: "native_action",
        text: cardText,
        sourceText: label,
        action: { type: "shoppingRemove", messageIds: meta.messageIds, label },
      },
    };
  }

  const groupHint = edits.group ?? edits.target;
  if (groupHint) return applyShoppingGroup(focus, meta, groupHint);

  if (edits.quantity || edits.name) {
    if (meta.messageIds.length > 1) return { text: "Which one?", ok: false };
    const id = meta.messageIds[0];
    if (edits.name) {
      const previous = meta.items[0];
      const ok = await renameShoppingItem(id, edits.name).catch(() => false);
      if (!ok) return { text: "Couldn't rename it.", ok: false };
      return {
        text: `${previous} → ${edits.name}`,
        metadata: { messageIds: [id], edited: "name" },
        artifacts: shoppingArtifacts([id], [edits.name], "updated", meta.threadId),
        focus: { ...focus, title: edits.name, addedAt: Date.now(), meta: { ...meta, items: [edits.name] } },
        undo: () => renameShoppingItem(id, previous).catch(() => false),
      };
    }
    const previousQty = meta.quantity ?? null;
    const ok = await setShoppingQuantity(id, edits.quantity!).catch(() => false);
    if (!ok) return { text: "Couldn't change it.", ok: false };
    return {
      text: `${label} · ${edits.quantity}`,
      metadata: { messageIds: [id], edited: "quantity" },
      artifacts: shoppingArtifacts([id], [`${label} · ${edits.quantity}`], "updated", meta.threadId),
      focus: { ...focus, addedAt: Date.now(), meta: { ...meta, quantity: edits.quantity } },
      undo: () => setShoppingQuantity(id, previousQty).catch(() => false),
    };
  }
  return { text: "Change what?", ok: false };
}

// ───────────────────────────── draft ─────────────────────────────

interface DraftMeta {
  draftId: string;
  accountId: string;
  amount: number;
  currency?: string;
  categoryId?: string;
  subcategoryId?: string;
  categoryName?: string;
  description?: string;
  date?: string;
}

/**
 * The drafts PATCH route CONFIRMS a draft (it posts to the balance), so an
 * edit replaces the draft instead: create the corrected one first, then
 * delete the old one — a failure never loses the capture. Drafts carry no
 * balance effect, so no money moves either way (money-rules).
 */
async function replaceDraft(meta: DraftMeta, next: DraftMeta): Promise<string | null> {
  const res = await safeFetch("/api/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: next.accountId,
      amount: next.amount,
      category_id: next.categoryId ?? null,
      subcategory_id: next.subcategoryId ?? null,
      description: next.description ?? null,
      voice_transcript: next.description ?? null,
      date: next.date ?? new Date().toISOString().split("T")[0],
    }),
    timeoutMs: 8_000,
  });
  if (!res.ok) return null;
  const { draft } = (await res.json()) as { draft: { id: string } };
  await safeFetch(`/api/drafts/${meta.draftId}`, { method: "DELETE", timeoutMs: 8_000 }).catch(() => null);
  return draft.id;
}

async function amendDraft(focus: FocusEntity, edits: EditRequest): Promise<AmendResult> {
  const meta = focus.meta as unknown as DraftMeta;
  if (!meta?.draftId) return cantChange();

  let next: DraftMeta | null = null;
  let label = "";
  if (edits.amount !== undefined) {
    if (edits.currency && meta.currency && edits.currency !== meta.currency) {
      return { text: `That draft is in ${meta.currency}.`, ok: false };
    }
    next = { ...meta, amount: edits.amount };
    label = `Draft · ${moneyIn(edits.amount, meta.currency)}`;
  } else if (edits.category ?? edits.target) {
    const hint = (edits.category ?? edits.target)!.toLowerCase();
    const res = await safeFetch(`/api/categories?accountId=${encodeURIComponent(meta.accountId)}`, { timeoutMs: 8_000 });
    const cats = res.ok ? ((await res.json()) as Array<{ id: string; name: string; parent_id?: string | null }>) : [];
    const matches = cats.filter((c) => c.name.toLowerCase() === hint);
    const loose = matches.length ? matches : cats.filter((c) => c.name.toLowerCase().includes(hint));
    if (loose.length !== 1) {
      return { text: loose.length ? `Which one — ${loose.slice(0, 4).map((c) => c.name).join(", ")}?` : `No category called "${hint}".`, ok: false };
    }
    const c = loose[0];
    next = c.parent_id
      ? { ...meta, categoryId: c.parent_id, subcategoryId: c.id, categoryName: c.name }
      : { ...meta, categoryId: c.id, subcategoryId: undefined, categoryName: c.name };
    label = `Draft · ${c.name}`;
  }
  if (!next) return { text: "Change what?", ok: false };

  const newId = await replaceDraft(meta, next).catch(() => null);
  if (!newId) return { text: "Couldn't change the draft.", ok: false };
  const edited: DraftMeta = { ...next, draftId: newId };
  return {
    text: label,
    metadata: { draftId: newId, amount: edited.amount, edited: edits.amount !== undefined ? "amount" : "category" },
    artifacts: [eraArtifact("draft", "updated", newId, label)],
    focus: { ...focus, id: newId, addedAt: Date.now(), meta: edited as unknown as Record<string, unknown> },
    undo: async () => Boolean(await replaceDraft(edited, meta).catch(() => null)),
  };
}

// ───────────────────────────── transfer card ─────────────────────────────

async function amendTransferCard(focus: FocusEntity, edits: EditRequest): Promise<AmendResult> {
  const card = useEraStore.getState().activeProposal;
  const meta = focus.meta as unknown as EraTransferAction;
  if (card?.kind !== "native_action" || card.action.type !== "transfer" || !meta) {
    return { text: "That card is gone. Say it again.", ok: false };
  }
  const amount = edits.amount ?? meta.amount;
  const to = edits.target ?? edits.group ?? meta.toName;
  if (edits.amount === undefined && !edits.target && !edits.group) return { text: "Change what?", ok: false };
  // A new Confirm card — nothing moves until the tap (plan §5).
  const r = await prepareTransfer(amount, edits.currency ?? meta.currency, meta.fromName, to, card.sourceText);
  return r as AmendResult;
}

export async function createGroupAndMove(
  threadId: string,
  name: string,
  messageIds: string[],
): Promise<{ ok: boolean; groupId?: string }> {
  const group = await createShoppingGroup(threadId, name).catch(() => null);
  if (!group) return { ok: false };
  const moved = await moveShoppingItems(messageIds, group.id).catch(() => false);
  return { ok: moved, groupId: group.id };
}

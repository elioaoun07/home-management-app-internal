// src/features/items/bulkComplete.ts
// Optimistic, retry-safe completion of many items / occurrences in one request
// (Chores → mark a chore done in every room at once). Same contract as
// bulkItems.ts: the rows show as done before the request leaves, a slow network
// retries the same idempotent request, and an unreachable one queues it as a
// single operation. Callers never see a transport error.

import { qk } from "@/lib/queryKeys";
import { addToQueue } from "@/lib/offlineQueue";
import type { ItemWithDetails } from "@/types/items";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { itemLists, nudgeQueue, sendWithRetry } from "./bulkItems";
import type { ItemOccurrenceAction } from "./useItemActions";
import { itemsKeys } from "./useItems";

const COMPLETE_URL = "/api/items/bulk/complete";
/** Mirrors BULK_COMPLETE_MAX on the server. */
const CHUNK = 50;
const OPTIMISTIC_PREFIX = "optimistic-complete:";

export interface CompleteTarget {
  item: ItemWithDetails;
  /** Instant recorded as the occurrence (chores: the actual completion time) */
  occurrenceDate: string;
  /** Planned slot the completion is accounted to */
  plannedFor?: string;
}

/** What the server needs to complete — and later reopen — one entry. */
export interface CompletionEntry {
  item_id: string;
  occurrence_date: string;
  is_recurring: boolean;
  planned_for?: string;
}

export interface BulkCompleteResult {
  /** Confirmed by the server */
  done: CompletionEntry[];
  /** Kept on this device; delivered when the network allows */
  queued: CompletionEntry[];
  /** Refused; already shown as open again */
  refused: CompletionEntry[];
}

interface Options {
  /** Injectable for tests */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Same rule as handleComplete: flexible routines complete per occurrence too. */
export function isRecurringItem(item: ItemWithDetails): boolean {
  return !!item.recurrence_rule?.rrule || !!item.recurrence_rule?.is_flexible;
}

function readResults(json: unknown): boolean[] | null {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return null;
  return results.map((r) => (r as { ok?: unknown })?.ok === true);
}

function sameInstant(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}

// ── Cache ────────────────────────────────────────────────────────────────────

function setItemStatus(
  queryClient: QueryClient,
  ids: Set<string>,
  status: "completed" | "pending",
) {
  if (ids.size === 0) return;
  const completedAt = status === "completed" ? new Date().toISOString() : null;
  for (const { key } of itemLists(queryClient)) {
    queryClient.setQueryData<ItemWithDetails[]>(key, (old) => {
      if (!old?.some((item) => ids.has(item.id))) return old;
      return old.map((item) =>
        ids.has(item.id)
          ? ({
              ...item,
              status,
              reminder_details: item.reminder_details
                ? { ...item.reminder_details, completed_at: completedAt }
                : item.reminder_details,
            } as ItemWithDetails)
          : item,
      );
    });
  }
}

function addOptimisticActions(
  queryClient: QueryClient,
  entries: CompletionEntry[],
) {
  const stamp = new Date().toISOString();
  const rows: ItemOccurrenceAction[] = entries.map((entry) => ({
    id: `${OPTIMISTIC_PREFIX}${entry.item_id}:${entry.occurrence_date}`,
    item_id: entry.item_id,
    occurrence_date: entry.occurrence_date,
    action_type: "completed",
    metadata_json: entry.planned_for ? { planned_for: entry.planned_for } : null,
    created_at: stamp,
  }));
  queryClient.setQueryData<ItemOccurrenceAction[]>(
    itemsKeys.allActions(),
    (old) => (old ? [...rows, ...old] : old),
  );
}

/** Drops the completed actions of these entries (optimistic or real). */
function removeActions(queryClient: QueryClient, entries: CompletionEntry[]) {
  if (entries.length === 0) return;
  queryClient.setQueryData<ItemOccurrenceAction[]>(
    itemsKeys.allActions(),
    (old) =>
      old?.filter(
        (action) =>
          action.action_type !== "completed" ||
          !entries.some(
            (entry) =>
              entry.item_id === action.item_id &&
              (!entry.is_recurring ||
                sameInstant(entry.occurrence_date, action.occurrence_date)),
          ),
      ),
  );
}

function markDone(queryClient: QueryClient, entries: CompletionEntry[]) {
  addOptimisticActions(queryClient, entries);
  setItemStatus(
    queryClient,
    new Set(entries.filter((e) => !e.is_recurring).map((e) => e.item_id)),
    "completed",
  );
}

function markOpen(queryClient: QueryClient, entries: CompletionEntry[]) {
  removeActions(queryClient, entries);
  setItemStatus(
    queryClient,
    new Set(entries.filter((e) => !e.is_recurring).map((e) => e.item_id)),
    "pending",
  );
}

function refresh(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: itemsKeys.all });
  void queryClient.invalidateQueries({ queryKey: qk.flexibleRoutines() });
}

async function queue(
  method: "POST" | "DELETE",
  entries: CompletionEntry[],
): Promise<boolean> {
  const n = entries.length;
  try {
    await addToQueue({
      feature: "item",
      // Not "update": the queue collapses updates to one endpoint into the last one
      operation: method === "POST" ? "complete" : "delete",
      endpoint: COMPLETE_URL,
      method,
      body: { entries },
      metadata: {
        label: `${method === "POST" ? "Complete" : "Reopen"} ${n} item${n === 1 ? "" : "s"}`,
      },
    });
    return true;
  } catch {
    return false;
  }
}

// ── Send ─────────────────────────────────────────────────────────────────────

async function send(
  queryClient: QueryClient,
  method: "POST" | "DELETE",
  entries: CompletionEntry[],
  sleep: (ms: number) => Promise<void>,
): Promise<BulkCompleteResult> {
  const result: BulkCompleteResult = { done: [], queued: [], refused: [] };
  let degraded = false;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const attempt = degraded
      ? ({ kind: "unreachable" } as const)
      : await sendWithRetry(method, { entries: chunk }, readResults, sleep, COMPLETE_URL);
    if (attempt.kind === "ok") {
      chunk.forEach((entry, position) =>
        (attempt.value[position] ? result.done : result.refused).push(entry),
      );
    } else if (attempt.kind === "refused") {
      result.refused.push(...chunk);
    } else {
      // Not confirmed either way: the request is idempotent, so the queue may replay it
      degraded = true;
      (await queue(method, chunk) ? result.queued : result.refused).push(...chunk);
    }
  }
  if (result.queued.length > 0) nudgeQueue();
  // A refetch would undo what is only queued, so wait for the queue's own refresh
  else refresh(queryClient);
  return result;
}

/** Complete many items / occurrences; they show as done at once. */
export async function completeItemsBulk(
  queryClient: QueryClient,
  targets: CompleteTarget[],
  { sleep = defaultSleep }: Options = {},
): Promise<BulkCompleteResult> {
  const entries: CompletionEntry[] = targets.map((t) => ({
    item_id: t.item.id,
    occurrence_date: t.occurrenceDate,
    is_recurring: isRecurringItem(t.item),
    ...(t.plannedFor ? { planned_for: t.plannedFor } : {}),
  }));
  if (entries.length === 0) return { done: [], queued: [], refused: [] };
  await queryClient.cancelQueries({ queryKey: itemsKeys.all });
  markDone(queryClient, entries);
  const result = await send(queryClient, "POST", entries, sleep);
  markOpen(queryClient, result.refused);
  return result;
}

/** Undo of completeItemsBulk; they show as open at once. */
export async function uncompleteItemsBulk(
  queryClient: QueryClient,
  entries: CompletionEntry[],
  { sleep = defaultSleep }: Options = {},
): Promise<{ ok: boolean }> {
  if (entries.length === 0) return { ok: true };
  const body = entries.map(({ item_id, occurrence_date, is_recurring }) => ({
    item_id,
    occurrence_date,
    is_recurring,
  }));
  await queryClient.cancelQueries({ queryKey: itemsKeys.all });
  markOpen(queryClient, entries);
  const result = await send(queryClient, "DELETE", body, sleep);
  if (result.refused.length > 0) {
    markDone(queryClient, entries.filter((e) => result.refused.some((r) => r.item_id === e.item_id)));
  }
  return { ok: result.refused.length === 0 };
}

export function useBulkComplete() {
  const queryClient = useQueryClient();
  const completeMany = useCallback(
    (targets: CompleteTarget[]) => completeItemsBulk(queryClient, targets),
    [queryClient],
  );
  const reopenMany = useCallback(
    (entries: CompletionEntry[]) => uncompleteItemsBulk(queryClient, entries),
    [queryClient],
  );
  return { completeMany, reopenMany };
}

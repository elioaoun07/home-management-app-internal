// src/features/items/bulkItems.ts
// Optimistic, retry-safe bulk create and delete for items (SCH-25).
//
// Why it exists: creating N items as N requests made the slowest one decide the
// outcome — a timeout probed /api/health on a saturated origin, flipped the whole
// app "offline", and a retry could duplicate what had already committed. Here the
// rows appear at once, the batch goes out as a few idempotent requests (every item
// carries its own id), and anything the network will not take now is queued as one
// operation and delivered later. Callers never see a transport error.

import { isReallyOnline } from "@/lib/connectivityManager";
import {
  BULK_ITEMS_MAX,
  bulkCreateReceiptSchema,
  prepareItemCreate,
  type CreateItemBody,
} from "@/lib/items/createContract";
import { addToQueue, removeQueuedItemCreates } from "@/lib/offlineQueue";
import { getSyncEngine } from "@/lib/offlineSyncEngine";
import { OfflineError, safeFetch } from "@/lib/safeFetch";
import type {
  CreateEventInput,
  CreateReminderInput,
  CreateTaskInput,
  ItemsFilter,
  ItemWithDetails,
} from "@/types/items";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { itemsKeys } from "./useItems";

const BULK_URL = "/api/items/bulk";
/** One request carries a whole chunk; the server also writes a Google backup after replying. */
const BULK_TIMEOUT_MS = 30_000;
/** Items per request. Small enough for the RPC's statement budget and the queue's 64 KB cap. */
export const BULK_CHUNK_ITEMS = 25;
export const BULK_CHUNK_BYTES = 40_000;
const BULK_DELETE_CHUNK = 100;
/** A retry reuses the same ids, so it can never duplicate what already committed. */
const RETRY_DELAYS_MS = [800, 2_500];
/** The server said no and rolled back; waiting cannot change that. */
const REFUSAL_STATUSES = new Set([400, 403, 409, 422, 501]);

export type BulkItemInput = CreateReminderInput | CreateTaskInput | CreateEventInput;
type PreparedBody = CreateItemBody & { id: string };

export interface BulkCreateResult {
  /** Confirmed by the server */
  saved: string[];
  /** Kept on this device; the sync engine delivers them when the network allows */
  queued: string[];
  /** Refused and already removed from the lists; `index` is the position in the input */
  rejected: { index: number; id: string }[];
}

export interface BulkOptions {
  /** Current user, for the optimistic rows' owner when no assignee is given */
  userId?: string | null;
  /** Injectable for tests */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Chunking ─────────────────────────────────────────────────────────────────

/** Split into requests of at most BULK_CHUNK_ITEMS items and BULK_CHUNK_BYTES of JSON. */
export function chunkBodies<T>(bodies: T[]): T[][] {
  const encoder = new TextEncoder();
  const chunks: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const body of bodies) {
    const size = encoder.encode(JSON.stringify(body)).length;
    if (
      current.length > 0 &&
      (current.length >= Math.min(BULK_CHUNK_ITEMS, BULK_ITEMS_MAX) ||
        bytes + size > BULK_CHUNK_BYTES)
    ) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(body);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// ── Optimistic rows ──────────────────────────────────────────────────────────

/** The row as the Schedule bundle would return it, built from the create request. */
export function optimisticItem(
  body: PreparedBody,
  userId: string | null,
  now: Date = new Date(),
): ItemWithDetails {
  const id = body.id;
  const stamp = now.toISOString();
  const isEvent = body.type === "event";
  const rule = body.recurrence_rule;
  return {
    id,
    user_id: userId ?? body.responsible_user_id ?? "",
    type: body.type,
    title: body.title.trim(),
    description: body.description ?? null,
    priority: body.priority,
    status: body.status ?? "pending",
    metadata_json: body.metadata_json ?? null,
    created_at: stamp,
    updated_at: stamp,
    archived_at: null,
    is_public: body.is_public,
    responsible_user_id: body.responsible_user_id ?? userId ?? "",
    notify_all_household: body.notify_all_household,
    categories: body.category_ids,
    location_context: body.location_context ?? null,
    location_text: body.location_text ?? null,
    source_catalogue_item_id: body.source_catalogue_item_id ?? null,
    is_template_instance: body.is_template_instance,
    is_chore: body.is_chore,
    reminder_details: isEvent
      ? null
      : {
          item_id: id,
          due_at: body.due_at ?? null,
          completed_at: null,
          estimate_minutes: body.estimate_minutes ?? null,
          has_checklist: body.has_checklist,
        },
    event_details: isEvent
      ? {
          item_id: id,
          start_at: body.start_at as string,
          end_at: body.end_at as string,
          all_day: body.all_day,
          location_text: body.location_text ?? null,
        }
      : null,
    subtasks: body.subtasks.map((subtask, index) => ({
      id: `${id}:subtask:${index}`,
      parent_item_id: id,
      title: subtask.title,
      order_index: subtask.order_index ?? index,
      done_at: null,
      created_at: stamp,
      updated_at: stamp,
    })),
    alerts: body.alerts.map((alert, index) => ({
      id: `${id}:alert:${index}`,
      item_id: id,
      kind: alert.kind,
      trigger_at: alert.trigger_at ?? null,
      offset_minutes: alert.offset_minutes ?? null,
      relative_to: alert.relative_to ?? null,
      custom_time: alert.custom_time ?? null,
      repeat_every_minutes: alert.repeat_every_minutes ?? null,
      max_repeats: alert.max_repeats ?? null,
      channel: alert.channel,
      active: true,
      created_at: stamp,
      updated_at: stamp,
    })),
    pauses: [],
    recurrence_rule: rule
      ? {
          id: `${id}:rule`,
          item_id: id,
          rrule: rule.rrule,
          start_anchor: rule.start_anchor,
          end_until: rule.end_until ?? null,
          count: rule.count ?? null,
          is_flexible: rule.is_flexible,
          flexible_period: rule.flexible_period ?? null,
          exceptions: [],
          created_at: stamp,
          updated_at: stamp,
        }
      : null,
  } as unknown as ItemWithDetails;
}

// ── Cache ────────────────────────────────────────────────────────────────────

function oneOf<T>(wanted: T | T[] | undefined, value: T | null | undefined): boolean {
  if (wanted === undefined) return true;
  return Array.isArray(wanted) ? wanted.includes(value as T) : wanted === value;
}

/** Mirrors the client-side filtering in `fetchItems`, so a row only joins lists it belongs in. */
export function listAccepts(filters: ItemsFilter, item: ItemWithDetails): boolean {
  if (filters.archived === true) return false;
  if (item.status === "draft" && !filters.includeDrafts) return false;
  if (!oneOf(filters.type, item.type)) return false;
  if (!oneOf(filters.status, item.status)) return false;
  if (!oneOf(filters.priority, item.priority)) return false;
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    const text = `${item.title ?? ""}\n${item.description ?? ""}`.toLowerCase();
    if (!text.includes(needle)) return false;
  }
  return true;
}

/** Every cached item array with the filter it was fetched under. */
export function itemLists(queryClient: QueryClient) {
  const lists: { key: readonly unknown[]; filters: ItemsFilter }[] = queryClient
    .getQueriesData<ItemWithDetails[]>({ queryKey: itemsKeys.lists() })
    .map(([key]) => ({ key, filters: (key[2] ?? {}) as ItemsFilter }));
  lists.push(
    { key: itemsKeys.reminders(), filters: { type: "reminder" } },
    { key: itemsKeys.tasks(), filters: { type: "task" } },
    { key: itemsKeys.events(), filters: { type: "event" } },
  );
  return lists;
}

export function addItemsToLists(queryClient: QueryClient, items: ItemWithDetails[]) {
  for (const { key, filters } of itemLists(queryClient)) {
    queryClient.setQueryData<ItemWithDetails[]>(key, (old) => {
      // Not loaded yet: its first fetch will include the rows
      if (!old) return old;
      const have = new Set(old.map((item) => item.id));
      const fresh = items.filter((item) => !have.has(item.id) && listAccepts(filters, item));
      return fresh.length > 0 ? [...fresh, ...old] : old;
    });
  }
}

export function removeItemsFromLists(queryClient: QueryClient, ids: string[]) {
  if (ids.length === 0) return;
  const gone = new Set(ids);
  for (const { key } of itemLists(queryClient)) {
    queryClient.setQueryData<ItemWithDetails[]>(key, (old) => {
      if (!old) return old;
      const kept = old.filter((item) => !gone.has(item.id));
      return kept.length === old.length ? old : kept;
    });
  }
}

/** Rows currently cached for these ids, so a failed delete can put them back. */
function cachedItems(queryClient: QueryClient, ids: string[]): ItemWithDetails[] {
  const wanted = new Set(ids);
  const found = new Map<string, ItemWithDetails>();
  for (const { key } of itemLists(queryClient)) {
    for (const item of queryClient.getQueryData<ItemWithDetails[]>(key) ?? []) {
      if (wanted.has(item.id)) found.set(item.id, item);
    }
  }
  return [...found.values()];
}

// ── Sending ──────────────────────────────────────────────────────────────────

export type Attempt<T> =
  | { kind: "ok"; value: T }
  | { kind: "refused" }
  | { kind: "unreachable" };

/**
 * Send one idempotent request, retrying what is merely slow. A timeout, a 5xx
 * and a lost response are all "unverified": the same ids go out again, which the
 * server answers with the rows it already has.
 */
export async function sendWithRetry<T>(
  method: "POST" | "DELETE",
  payload: unknown,
  read: (json: unknown) => T | null,
  sleep: (ms: number) => Promise<void>,
  url: string = BULK_URL,
): Promise<Attempt<T>> {
  for (let attempt = 0; ; attempt++) {
    if (!isReallyOnline()) return { kind: "unreachable" };
    try {
      const res = await safeFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeoutMs: BULK_TIMEOUT_MS,
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        const value = read(json);
        if (value !== null) return { kind: "ok", value };
      } else if (REFUSAL_STATUSES.has(res.status)) {
        return { kind: "refused" };
      }
    } catch (err) {
      if (err instanceof OfflineError) return { kind: "unreachable" };
      // Timeout or an unreadable response: unverified, so retry the same request
    }
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined) return { kind: "unreachable" };
    await sleep(delay);
  }
}

/** The queue replays when connectivity returns; if the network never dropped, nudge it. */
export function nudgeQueue() {
  if (typeof window === "undefined") return;
  for (const delay of [10_000, 45_000]) {
    setTimeout(() => {
      if (isReallyOnline()) void getSyncEngine()?.processQueue();
    }, delay);
  }
}

async function queueCreate(bodies: PreparedBody[]): Promise<boolean> {
  try {
    await addToQueue({
      feature: "item",
      operation: "create",
      endpoint: BULK_URL,
      method: "POST",
      body: { items: bodies },
      metadata: { label: `Add ${bodies.length} item${bodies.length === 1 ? "" : "s"}` },
    });
    return true;
  } catch {
    return false;
  }
}

// ── Create ───────────────────────────────────────────────────────────────────

/**
 * Create many items. The rows are in the lists before the first request leaves;
 * rows the server refuses are taken out again, everything else ends up saved or
 * queued — never lost, never duplicated.
 */
export async function createItemsBulk(
  queryClient: QueryClient,
  inputs: BulkItemInput[],
  { userId = null, sleep = defaultSleep }: BulkOptions = {},
): Promise<BulkCreateResult> {
  const result: BulkCreateResult = { saved: [], queued: [], rejected: [] };
  const prepared: { index: number; body: PreparedBody }[] = [];
  inputs.forEach((input, index) => {
    const id = newId();
    try {
      prepared.push({ index, body: { ...prepareItemCreate({ ...input, id }), id } });
    } catch {
      result.rejected.push({ index, id });
    }
  });
  if (prepared.length === 0) return result;

  await queryClient.cancelQueries({ queryKey: itemsKeys.all });
  addItemsToLists(queryClient, prepared.map(({ body }) => optimisticItem(body, userId)));

  let degraded = false;
  for (const chunk of chunkBodies(prepared)) {
    const bodies = chunk.map((entry) => entry.body);
    const attempt = degraded
      ? ({ kind: "unreachable" } as const)
      : await sendWithRetry(
          "POST",
          { items: bodies },
          (json) => {
            const receipt = bulkCreateReceiptSchema.safeParse(json);
            return receipt.success ? receipt.data : null;
          },
          sleep,
        );

    if (attempt.kind === "ok") {
      const failedAt = new Set(attempt.value.failed.map((entry) => entry.index));
      chunk.forEach((entry, position) => {
        if (failedAt.has(position)) result.rejected.push({ index: entry.index, id: entry.body.id });
        else result.saved.push(entry.body.id);
      });
    } else if (attempt.kind === "refused") {
      for (const entry of chunk) result.rejected.push({ index: entry.index, id: entry.body.id });
    } else {
      // Not confirmed either way: hand the whole chunk to the queue, which is safe to replay
      degraded = true;
      if (await queueCreate(bodies)) {
        for (const entry of chunk) result.queued.push(entry.body.id);
      } else {
        for (const entry of chunk) result.rejected.push({ index: entry.index, id: entry.body.id });
      }
    }
  }

  removeItemsFromLists(queryClient, result.rejected.map((entry) => entry.id));
  if (result.queued.length > 0) nudgeQueue();
  // A refetch would drop rows that are only queued, so wait for the queue's own refresh
  else if (result.saved.length > 0) void queryClient.invalidateQueries({ queryKey: itemsKeys.all });
  return result;
}

// ── Delete (Undo of a bulk create) ───────────────────────────────────────────

/**
 * Take many items back. They leave the lists at once; ids still waiting in the
 * offline queue are simply dropped from it, the rest go out as one request each
 * hundred. A refused delete puts the rows back.
 */
export async function deleteItemsBulk(
  queryClient: QueryClient,
  ids: string[],
  { sleep = defaultSleep }: BulkOptions = {},
): Promise<{ ok: boolean }> {
  if (ids.length === 0) return { ok: true };
  await queryClient.cancelQueries({ queryKey: itemsKeys.all });
  const snapshot = cachedItems(queryClient, ids);
  removeItemsFromLists(queryClient, ids);

  const stillQueued = new Set(await removeQueuedItemCreates(ids));
  const onServer = ids.filter((id) => !stillQueued.has(id));
  let ok = true;
  let queuedAny = false;

  for (let i = 0; i < onServer.length; i += BULK_DELETE_CHUNK) {
    const slice = onServer.slice(i, i + BULK_DELETE_CHUNK);
    const attempt = await sendWithRetry("DELETE", { ids: slice }, (json) => json ?? {}, sleep);
    if (attempt.kind === "refused") {
      ok = false;
    } else if (attempt.kind === "unreachable") {
      try {
        await addToQueue({
          feature: "item",
          operation: "delete",
          endpoint: BULK_URL,
          method: "DELETE",
          body: { ids: slice },
          metadata: { label: `Delete ${slice.length} item${slice.length === 1 ? "" : "s"}` },
        });
        queuedAny = true;
      } catch {
        ok = false;
      }
    }
  }

  if (!ok) addItemsToLists(queryClient, snapshot);
  if (queuedAny) nudgeQueue();
  else void queryClient.invalidateQueries({ queryKey: itemsKeys.all });
  return { ok };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBulkItems() {
  const queryClient = useQueryClient();
  const createMany = useCallback(
    (inputs: BulkItemInput[], options?: BulkOptions) =>
      createItemsBulk(queryClient, inputs, options),
    [queryClient],
  );
  const deleteMany = useCallback(
    (ids: string[]) => deleteItemsBulk(queryClient, ids),
    [queryClient],
  );
  return { createMany, deleteMany };
}

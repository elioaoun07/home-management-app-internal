// src/features/transfers/hooks.ts
"use client";

import { getTransferDeltas } from "@/lib/balance-utils";
import { invalidateAccountData } from "@/lib/queryInvalidation";
import { qk } from "@/lib/queryKeys";
import { OfflineError, safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type MutateOptions,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useCallback, useRef, type ReactNode } from "react";
import { toast } from "sonner";

export interface Transfer {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  from_account_name: string;
  to_account_name: string;
  from_account_type: "income" | "expense" | "saving";
  to_account_type: "income" | "expense" | "saving";
  from_account_user_id: string | null;
  to_account_user_id: string | null;
  from_account_currency?: string;
  to_account_currency?: string;
  amount: number;
  /** Destination-currency amount for cross-currency conversion transfers.
   *  null = legacy same-currency transfer (destination receives `amount`). */
  to_amount: number | null;
  /** to_amount / amount, stored for display. null when to_amount is null. */
  exchange_rate: number | null;
  description: string;
  date: string;
  transfer_type: "self" | "household";
  recipient_user_id: string | null;
  fee_amount: number;
  returned_amount: number;
  household_link_id: string | null;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  is_recipient: boolean;
}

export interface CreateTransferInput {
  /** Idempotency key; assigned by useCreateTransfer when omitted. */
  id?: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  description?: string;
  date?: string;
  transfer_type?: "self" | "household";
  recipient_user_id?: string;
  fee_amount?: number;
  returned_amount?: number;
  /** Cross-currency conversion transfers only (transfer_type "self"). */
  to_amount?: number;
}

export type CreateTransferVariables = CreateTransferInput & { id: string };

export interface UpdateTransferInput {
  id: string;
  amount?: number;
  description?: string;
  date?: string;
  fee_amount?: number;
  returned_amount?: number;
  to_amount?: number;
}

// Query keys
export const transferKeys = {
  all: ["transfers"] as const,
  list: (filters?: { start?: string; end?: string }) =>
    [...transferKeys.all, "list", filters] as const,
  detail: (id: string) => [...transferKeys.all, "detail", id] as const,
};

// --------------- localStorage transfer cache ---------------
const TR_CACHE_PREFIX = "tr-cache-";
const TR_CACHE_LATEST_KEY = "tr-cache-latest"; // Stable alias — written for every single-day fetch
const TR_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function getTrCacheKey(start?: string, end?: string) {
  return `${TR_CACHE_PREFIX}${start || "all"}_${end || "all"}`;
}

/** Remove oldest date-keyed cache entries when there are more than 7. */
function cleanupOldTrCaches() {
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith(TR_CACHE_PREFIX) && k !== TR_CACHE_LATEST_KEY,
    );
    if (keys.length <= 7) return;
    const entries = keys
      .map((k) => {
        try {
          return { key: k, ts: JSON.parse(localStorage.getItem(k)!).ts as number };
        } catch {
          return { key: k, ts: 0 };
        }
      })
      .sort((a, b) => b.ts - a.ts);
    entries.slice(7).forEach((e) => localStorage.removeItem(e.key));
  } catch {
    /* ignore */
  }
}

function readTrCache(
  start?: string,
  end?: string,
): { data: Transfer[]; ts: number } | undefined {
  try {
    // Try exact date-range match first
    const raw = localStorage.getItem(getTrCacheKey(start, end));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > TR_CACHE_MAX_AGE) {
        localStorage.removeItem(getTrCacheKey(start, end));
      } else {
        return parsed;
      }
    }
    // Fallback: for single-day "today" requests with no exact match,
    // return the latest alias so the user sees last-known data instantly
    // instead of a skeleton. ts=0 makes RQ treat it as infinitely stale →
    // triggers an immediate background refetch to get today's real data.
    const today = new Date().toISOString().split("T")[0];
    if (start === today && end === today) {
      const aliasRaw = localStorage.getItem(TR_CACHE_LATEST_KEY);
      if (aliasRaw) {
        const parsed = JSON.parse(aliasRaw);
        if (Date.now() - parsed.ts > TR_CACHE_MAX_AGE) return undefined;
        return { data: parsed.data, ts: 0 };
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function writeTrCache(
  start: string | undefined,
  end: string | undefined,
  data: Transfer[],
) {
  try {
    const trimmed = data.slice(0, 300);
    const payload = JSON.stringify({ data: trimmed, ts: Date.now() });
    localStorage.setItem(getTrCacheKey(start, end), payload);
    // Also write stable alias for single-day ranges so the next cold start
    // (new day) can show last-known data instantly while fresh data loads.
    if (start && end && start === end) {
      localStorage.setItem(TR_CACHE_LATEST_KEY, payload);
    }
    // Prevent localStorage bloat from accumulating old date-keyed entries
    cleanupOldTrCaches();
  } catch {
    /* quota exceeded — ignore */
  }
}

/**
 * Sync all in-memory transfer queries to localStorage so mutations
 * (create/update/delete) are reflected in the persistent cache immediately.
 * Call this in mutation onSettled callbacks.
 */
function syncTrCacheToLocalStorage(queryClient: QueryClient) {
  const allQueries = queryClient.getQueriesData<Transfer[]>({
    queryKey: transferKeys.all,
  });
  for (const [key, data] of allQueries) {
    if (data && Array.isArray(key) && key.length >= 3 && key[1] === "list") {
      const filters = key[2] as { start?: string; end?: string } | undefined;
      writeTrCache(filters?.start, filters?.end, data);
    }
  }
}

// Fetch transfers
async function fetchTransfers(
  start?: string,
  end?: string,
): Promise<Transfer[]> {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);

  const url = `/api/transfers${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url); // GET — regular fetch is fine

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return (await res.json()) as Transfer[];
}

// --------------- Writes: idempotent, retried, optimistic ---------------
//
// BUD-87 (2026-10-28): a create that outlived the 8 s safeFetch budget looked
// failed, the still-filled dialog was resubmitted, and the server inserted a
// second row. Every write is now safe to send twice — create carries a client
// id the server replays on, delete only reverses the request that flips
// `deleted_at`, update sends absolute values (a replay moves no money) — so a
// slow answer is retried with the identical request instead of surfacing as
// a failure.

/** ~6 PostgREST round-trips server-side; the household's mobile links need headroom. */
const WRITE_TIMEOUT_MS = 15_000;
/** A retry reuses the same request, so it can never duplicate what already committed. */
const RETRY_DELAYS_MS = [800, 2_500];

/** The server said no; nothing changed. */
export class TransferRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferRefusedError";
  }
}

/** No answer after the retries. `maybeSaved`: a request may have reached the server. */
export class TransferUnconfirmedError extends Error {
  constructor(
    what: string,
    public readonly maybeSaved: boolean,
  ) {
    super(
      maybeSaved
        ? `${what} not confirmed`
        : `Offline — ${what.toLowerCase()} not sent`,
    );
    this.name = "TransferUnconfirmedError";
  }
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function readError(body: unknown): string | null {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === "string" && error.trim() ? error : null;
}

/**
 * Send one idempotent transfer write. A timeout, a 5xx and an unreadable
 * answer are unverified, so the identical request goes out again (the server
 * answers a replay with what already committed); a 4xx is final.
 */
export async function sendTransferWrite<T>(
  url: string,
  init: { method: "POST" | "PATCH" | "DELETE"; body?: unknown },
  what: string,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<T> {
  let maybeSaved = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await safeFetch(url, {
        method: init.method,
        ...(init.body !== undefined && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(init.body),
        }),
        timeoutMs: WRITE_TIMEOUT_MS,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json !== null) return json as T;
      if (!res.ok && res.status < 500) {
        throw new TransferRefusedError(readError(json) ?? `${what} failed`);
      }
      maybeSaved = true;
    } catch (err) {
      if (err instanceof TransferRefusedError) throw err;
      // Known offline before sending: nothing left the device this time
      if (err instanceof OfflineError && /pre-flight/i.test(err.message)) {
        throw new TransferUnconfirmedError(what, maybeSaved);
      }
      maybeSaved = true;
    }
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined) throw new TransferUnconfirmedError(what, maybeSaved);
    await sleep(delay);
  }
}

function createTransfer(input: CreateTransferVariables): Promise<Transfer> {
  return sendTransferWrite<Transfer>(
    "/api/transfers",
    { method: "POST", body: input },
    "Transfer",
  );
}

function updateTransfer({ id, ...data }: UpdateTransferInput): Promise<Transfer> {
  return sendTransferWrite<Transfer>(
    `/api/transfers/${id}`,
    { method: "PATCH", body: data },
    "Update",
  );
}

function deleteTransfer(id: string): Promise<unknown> {
  return sendTransferWrite(`/api/transfers/${id}`, { method: "DELETE" }, "Delete");
}

// --------------- Optimistic cache ---------------

type CacheSnapshot = Array<readonly [QueryKey, unknown]>;
type ListFilters = { start?: string; end?: string } | undefined;
type TransferMoney = Pick<
  Transfer,
  "from_account_id" | "to_account_id" | "amount"
> & {
  returned_amount?: number | null;
  transfer_type?: "self" | "household";
  to_amount?: number | null;
};

function restoreCache(queryClient: QueryClient, snapshot: CacheSnapshot) {
  for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
}

/** The balance movement the server applies for a transfer; sign -1 is its reversal. */
export function transferMoves(transfer: TransferMoney, sign: 1 | -1 = 1) {
  const { fromDelta, toDelta } = getTransferDeltas(
    Number(transfer.amount),
    Number(transfer.returned_amount ?? 0),
    transfer.transfer_type ?? "self",
    transfer.to_amount != null ? Number(transfer.to_amount) : undefined,
  );
  return [
    { accountId: transfer.from_account_id, delta: sign * fromDelta },
    { accountId: transfer.to_account_id, delta: sign * toDelta },
  ];
}

/** Move the cached per-account balances the way the server is about to. */
export async function shiftCachedBalances(
  queryClient: QueryClient,
  moves: { accountId: string; delta: number }[],
): Promise<CacheSnapshot> {
  const snapshot: CacheSnapshot = [];
  for (const { accountId, delta } of moves) {
    if (!delta) continue;
    const key = ["account-balance", accountId] as const;
    await queryClient.cancelQueries({ queryKey: key });
    snapshot.push([key, queryClient.getQueryData(key)]);
    queryClient.setQueryData<{ balance?: unknown }>(key, (old) =>
      old && typeof old.balance === "number"
        ? { ...old, balance: old.balance + delta }
        : old,
    );
  }
  return snapshot;
}

function inRange(date: string, filters: ListFilters) {
  return (
    (!filters?.start || date >= filters.start) &&
    (!filters?.end || date <= filters.end)
  );
}

const byNewestDate = (a: Transfer, b: Transfer) => b.date.localeCompare(a.date);

/** Snapshot every cached transfer list, then rewrite each one. */
async function editTransferLists(
  queryClient: QueryClient,
  edit: (list: Transfer[], filters: ListFilters) => Transfer[],
): Promise<CacheSnapshot> {
  await queryClient.cancelQueries({ queryKey: transferKeys.all });
  const snapshot: CacheSnapshot = [];
  for (const [key, data] of queryClient.getQueriesData<Transfer[]>({
    queryKey: transferKeys.all,
  })) {
    if (!Array.isArray(data) || key[1] !== "list") continue;
    snapshot.push([key, data]);
    queryClient.setQueryData<Transfer[]>(key, edit(data, key[2] as ListFilters));
  }
  return snapshot;
}

function findCachedTransfer(
  queryClient: QueryClient,
  id: string,
): Transfer | undefined {
  for (const [, data] of queryClient.getQueriesData<Transfer[]>({
    queryKey: transferKeys.all,
  })) {
    const hit = Array.isArray(data) ? data.find((t) => t.id === id) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

interface CachedAccount {
  id: string;
  name?: string;
  type?: Transfer["from_account_type"];
  user_id?: string;
  currency?: string;
}

function findCachedAccount(
  queryClient: QueryClient,
  id: string,
): CachedAccount | undefined {
  for (const [, data] of queryClient.getQueriesData<CachedAccount[]>({
    queryKey: qk.accounts(),
  })) {
    const hit = Array.isArray(data) ? data.find((a) => a?.id === id) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

/** The row as GET /api/transfers will return it, built from the create request. */
export function optimisticTransfer(
  queryClient: QueryClient,
  input: CreateTransferVariables,
): Transfer {
  const from = findCachedAccount(queryClient, input.from_account_id);
  const to = findCachedAccount(queryClient, input.to_account_id);
  const stamp = new Date().toISOString();
  const household = input.transfer_type === "household";
  const toAmount = input.to_amount ?? null;
  return {
    id: input.id,
    user_id: from?.user_id ?? "",
    from_account_id: input.from_account_id,
    to_account_id: input.to_account_id,
    from_account_name: from?.name ?? "Unknown",
    to_account_name: to?.name ?? "Unknown",
    from_account_type: from?.type ?? "expense",
    to_account_type: to?.type ?? "expense",
    from_account_user_id: from?.user_id ?? null,
    to_account_user_id: to?.user_id ?? null,
    from_account_currency: from?.currency ?? "USD",
    to_account_currency: to?.currency ?? "USD",
    amount: input.amount,
    to_amount: toAmount,
    exchange_rate: toAmount != null ? toAmount / input.amount : null,
    description: input.description ?? "",
    date: input.date ?? stamp.split("T")[0],
    transfer_type: household ? "household" : "self",
    recipient_user_id: household ? (input.recipient_user_id ?? null) : null,
    // The route ignores fee/returned on self transfers
    fee_amount: household ? (input.fee_amount ?? 0) : 0,
    returned_amount: household ? (input.returned_amount ?? 0) : 0,
    household_link_id: null,
    created_at: stamp,
    updated_at: stamp,
    is_owner: true,
    is_recipient: false,
  };
}

/** What PATCH /api/transfers/[id] will store for to_amount (mirrors the route). */
export function nextToAmount(
  previous: Pick<Transfer, "to_amount" | "exchange_rate">,
  input: UpdateTransferInput,
): number | null {
  if (input.to_amount !== undefined) return input.to_amount;
  if (
    input.amount !== undefined &&
    previous.to_amount != null &&
    previous.exchange_rate != null
  ) {
    return Math.round(input.amount * Number(previous.exchange_rate) * 100) / 100;
  }
  return previous.to_amount;
}

async function applyCreate(
  queryClient: QueryClient,
  input: CreateTransferVariables,
): Promise<CacheSnapshot> {
  const row = optimisticTransfer(queryClient, input);
  const lists = await editTransferLists(queryClient, (list, filters) =>
    list.some((t) => t.id === row.id) || !inRange(row.date, filters)
      ? list
      : [row, ...list].sort(byNewestDate),
  );
  return [...lists, ...(await shiftCachedBalances(queryClient, transferMoves(row)))];
}

async function applyDelete(
  queryClient: QueryClient,
  id: string,
  known?: Transfer,
): Promise<{ snapshot: CacheSnapshot; removed?: Transfer }> {
  const removed = findCachedTransfer(queryClient, id) ?? known;
  const lists = await editTransferLists(queryClient, (list) =>
    list.filter((t) => t.id !== id),
  );
  const balances = removed
    ? await shiftCachedBalances(queryClient, transferMoves(removed, -1))
    : [];
  return { snapshot: [...lists, ...balances], removed };
}

async function applyUpdate(
  queryClient: QueryClient,
  input: UpdateTransferInput,
): Promise<{ snapshot: CacheSnapshot; previous?: Transfer }> {
  const previous = findCachedTransfer(queryClient, input.id);
  if (!previous) return { snapshot: [] };
  const changes = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
  const next: Transfer = {
    ...previous,
    ...changes,
    to_amount: nextToAmount(previous, input),
  };
  const lists = await editTransferLists(queryClient, (list) =>
    list.map((t) => (t.id === input.id ? next : t)),
  );
  const before = transferMoves(previous);
  const balances = await shiftCachedBalances(
    queryClient,
    transferMoves(next).map((move, i) => ({
      accountId: move.accountId,
      delta: move.delta - before[i].delta,
    })),
  );
  return { snapshot: [...lists, ...balances], previous };
}

/** Pull the server's truth for everything a transfer write touches. */
function refreshTransferData(queryClient: QueryClient, accountIds: string[]) {
  syncTrCacheToLocalStorage(queryClient);
  void queryClient.invalidateQueries({ queryKey: transferKeys.all });
  if (accountIds.length === 0) invalidateAccountData(queryClient);
  for (const id of accountIds) invalidateAccountData(queryClient, id);
}

function failureToast(error: unknown, fallback: string, retry: () => void) {
  toast.error(error instanceof Error ? error.message : fallback, {
    icon: ToastIcons.error,
    // Unconfirmed: the identical request is safe to send again
    ...(error instanceof TransferUnconfirmedError && {
      duration: 8000,
      action: { label: "Retry", onClick: retry },
    }),
  });
}

/** An Undo is itself an optimistic, retried write: apply now, put back if refused. */
async function runUndo(
  queryClient: QueryClient,
  accountIds: string[],
  apply: () => Promise<CacheSnapshot>,
  send: () => Promise<unknown>,
  done: { text: string; icon: ReactNode },
  failed: string,
) {
  const snapshot = await apply();
  try {
    await send();
    toast.success(done.text, { icon: done.icon });
  } catch {
    restoreCache(queryClient, snapshot);
    toast.error(failed, { icon: ToastIcons.error });
  } finally {
    refreshTransferData(queryClient, accountIds);
  }
}

/**
 * Hook to fetch transfers with persistent caching
 */
export function useTransfers(filters?: { start?: string; end?: string }) {
  return useQuery({
    queryKey: transferKeys.list(filters),
    queryFn: async () => {
      const data = await fetchTransfers(filters?.start, filters?.end);
      writeTrCache(filters?.start, filters?.end, data);
      return data;
    },
    initialData: () => {
      if (typeof window === "undefined") return undefined;
      return readTrCache(filters?.start, filters?.end)?.data;
    },
    initialDataUpdatedAt: () => {
      if (typeof window === "undefined") return undefined;
      return readTrCache(filters?.start, filters?.end)?.ts;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes — history rarely changes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
  });
}

const PAYLOAD_FIELDS = [
  "from_account_id",
  "to_account_id",
  "amount",
  "description",
  "date",
  "transfer_type",
  "recipient_user_id",
  "fee_amount",
  "returned_amount",
  "to_amount",
] as const;

const payloadKey = (input: CreateTransferInput) =>
  JSON.stringify(PAYLOAD_FIELDS.map((field) => input[field] ?? null));

interface WriteContext {
  snapshot: CacheSnapshot;
}

type CreateMutateOptions = MutateOptions<
  Transfer,
  Error,
  CreateTransferVariables,
  WriteContext
>;

/**
 * Hook to create a transfer with optimistic UI. Balances and the list move
 * before the request leaves. Re-submitting the same payload after an
 * unconfirmed attempt reuses that attempt's id, so it cannot duplicate.
 */
export function useCreateTransfer() {
  const queryClient = useQueryClient();
  const unconfirmed = useRef<{ key: string; id: string } | null>(null);

  const mutation = useMutation<
    Transfer,
    Error,
    CreateTransferVariables,
    WriteContext
  >({
    mutationFn: createTransfer,
    onMutate: async (input) => ({
      snapshot: await applyCreate(queryClient, input),
    }),
    onSuccess: (data) => {
      unconfirmed.current = null;
      // Same id on both sides: swap the optimistic row for the server's
      queryClient.setQueriesData<Transfer[]>(
        { queryKey: transferKeys.all },
        (old) =>
          Array.isArray(old)
            ? old.map((t) => (t.id === data.id ? { ...t, ...data } : t))
            : old,
      );

      const amount = Number(data.amount);
      toast.success("Transfer completed!", {
        icon: ToastIcons.create,
        description:
          data.to_amount != null
            ? `${amount.toFixed(2)} ${data.from_account_currency || "USD"} → ${Number(data.to_amount).toFixed(2)} ${data.to_account_currency || "USD"}`
            : `$${amount.toFixed(2)} transferred`,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () =>
            void runUndo(
              queryClient,
              [data.from_account_id, data.to_account_id],
              async () => (await applyDelete(queryClient, data.id, data)).snapshot,
              () => deleteTransfer(data.id),
              { text: "Transfer reversed", icon: ToastIcons.delete },
              "Failed to undo transfer",
            ),
        },
      });
    },
    onError: (error, input, context) => {
      restoreCache(queryClient, context?.snapshot ?? []);
      unconfirmed.current =
        error instanceof TransferUnconfirmedError
          ? { key: payloadKey(input), id: input.id }
          : null;
      failureToast(error, "Transfer failed", () => mutation.mutate(input));
    },
    onSettled: (_data, _error, input) =>
      refreshTransferData(queryClient, [
        input.from_account_id,
        input.to_account_id,
      ]),
  });

  const { mutate: rawMutate, mutateAsync: rawMutateAsync } = mutation;
  const withId = useCallback(
    (input: CreateTransferInput): CreateTransferVariables => {
      if (input.id) return { ...input, id: input.id };
      const last = unconfirmed.current;
      const id =
        last && last.key === payloadKey(input) ? last.id : crypto.randomUUID();
      return { ...input, id };
    },
    [],
  );
  const mutate = useCallback(
    (input: CreateTransferInput, options?: CreateMutateOptions) =>
      rawMutate(withId(input), options),
    [rawMutate, withId],
  );
  const mutateAsync = useCallback(
    (input: CreateTransferInput, options?: CreateMutateOptions) =>
      rawMutateAsync(withId(input), options),
    [rawMutateAsync, withId],
  );

  return { ...mutation, mutate, mutateAsync };
}

/**
 * Hook to update a transfer with optimistic UI (list row and both balances)
 */
export function useUpdateTransfer() {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    Transfer,
    Error,
    UpdateTransferInput,
    WriteContext & { previous?: Transfer }
  >({
    mutationFn: updateTransfer,
    onMutate: (input) => applyUpdate(queryClient, input),
    onSuccess: (_, input, context) => {
      const prev = context?.previous;
      toast.success("Transfer updated", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => {
            if (!prev) return;
            const revert: UpdateTransferInput = {
              id: input.id,
              amount: prev.amount,
              description: prev.description,
              date: prev.date,
              fee_amount: prev.fee_amount,
              returned_amount: prev.returned_amount,
              to_amount: prev.to_amount ?? undefined,
            };
            void runUndo(
              queryClient,
              [prev.from_account_id, prev.to_account_id],
              async () => (await applyUpdate(queryClient, revert)).snapshot,
              () => updateTransfer(revert),
              { text: "Transfer reverted", icon: ToastIcons.update },
              "Failed to undo transfer update",
            );
          },
        },
      });
    },
    onError: (error, input, context) => {
      restoreCache(queryClient, context?.snapshot ?? []);
      failureToast(error, "Failed to update transfer", () =>
        mutation.mutate(input),
      );
    },
    onSettled: (_data, _error, _input, context) =>
      refreshTransferData(
        queryClient,
        context?.previous
          ? [context.previous.from_account_id, context.previous.to_account_id]
          : [],
      ),
  });

  return mutation;
}

/**
 * Hook to delete a transfer with optimistic UI (list row and both balances)
 */
export function useDeleteTransfer() {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    unknown,
    Error,
    string,
    WriteContext & { removed?: Transfer }
  >({
    mutationFn: deleteTransfer,
    onMutate: (id) => applyDelete(queryClient, id),
    onSuccess: (_, __, context) => {
      const deleted = context?.removed;
      toast.success("Transfer deleted", {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => {
            if (!deleted) return;
            const restore: CreateTransferVariables = {
              id: crypto.randomUUID(),
              from_account_id: deleted.from_account_id,
              to_account_id: deleted.to_account_id,
              amount: deleted.amount,
              description: deleted.description,
              date: deleted.date,
              transfer_type: deleted.transfer_type,
              recipient_user_id: deleted.recipient_user_id ?? undefined,
              fee_amount: deleted.fee_amount,
              returned_amount: deleted.returned_amount,
              // Must carry to_amount forward — omitting it on a conversion
              // transfer would recreate it as a symmetric same-currency
              // transfer and silently corrupt the destination balance.
              to_amount: deleted.to_amount ?? undefined,
            };
            void runUndo(
              queryClient,
              [deleted.from_account_id, deleted.to_account_id],
              () => applyCreate(queryClient, restore),
              () => createTransfer(restore),
              { text: "Transfer restored", icon: ToastIcons.create },
              "Failed to undo transfer deletion",
            );
          },
        },
      });
    },
    onError: (error, id, context) => {
      restoreCache(queryClient, context?.snapshot ?? []);
      failureToast(error, "Failed to delete transfer", () => mutation.mutate(id));
    },
    onSettled: (_result, _error, _id, context) =>
      refreshTransferData(
        queryClient,
        context?.removed
          ? [context.removed.from_account_id, context.removed.to_account_id]
          : [],
      ),
  });

  return mutation;
}

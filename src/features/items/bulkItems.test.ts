import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemWithDetails } from "@/types/items";

const mock = vi.hoisted(() => ({
  online: vi.fn(() => true),
  safeFetch: vi.fn(),
  addToQueue: vi.fn(async () => "op-1"),
  removeQueuedItemCreates: vi.fn(async (_ids: string[]) => [] as string[]),
  processQueue: vi.fn(),
}));
vi.mock("@/lib/connectivityManager", () => ({ isReallyOnline: mock.online }));
vi.mock("@/lib/safeFetch", async (original) => ({
  ...(await original<typeof import("@/lib/safeFetch")>()),
  safeFetch: mock.safeFetch,
}));
vi.mock("@/lib/offlineQueue", () => ({
  addToQueue: mock.addToQueue,
  removeQueuedItemCreates: mock.removeQueuedItemCreates,
}));
vi.mock("@/lib/offlineSyncEngine", () => ({ getSyncEngine: () => ({ processQueue: mock.processQueue }) }));
// The real module opens a browser Supabase client; only the key factory is needed here
vi.mock("./useItems", () => {
  const all = ["items"] as const;
  const lists = () => [...all, "list"] as const;
  return {
    itemsKeys: {
      all, lists,
      list: (filters: object) => [...lists(), filters] as const,
      reminders: () => [...all, "reminders"] as const,
      tasks: () => [...all, "tasks"] as const,
      events: () => [...all, "events"] as const,
    },
  };
});

import { OfflineError, RequestTimeoutError } from "@/lib/safeFetch";
import {
  BULK_CHUNK_BYTES, BULK_CHUNK_ITEMS, chunkBodies, createItemsBulk, deleteItemsBulk,
  listAccepts, optimisticItem, type BulkItemInput,
} from "./bulkItems";
import { itemsKeys } from "./useItems";

const ME = "11111111-1111-4111-8111-111111111111";
const TEMPLATE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const noSleep = vi.fn(async () => {});
const chore = (n: number, extra: Record<string, unknown> = {}) =>
  ({
    type: "reminder", title: `Chore ${n}`, due_at: "2026-10-18T09:00:00.000Z", is_chore: true,
    is_template_instance: true, source_catalogue_item_id: TEMPLATE,
    alerts: [{ kind: "absolute", trigger_at: "2026-10-18T09:00:00.000Z", channel: "push" }],
    metadata_json: { room_id: "room-1" }, ...extra,
  }) as BulkItemInput;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
/** A server that creates whatever it is sent */
const accepts = (failed: { index: number; code: string }[] = []) => async (_url: string, init: RequestInit) => {
  const sent = (JSON.parse(String(init.body)).items ?? []) as { id: string }[];
  const kept = sent.filter((_, index) => !failed.some((f) => f.index === index));
  return json({ items: kept.map(({ id }) => ({ id })), failed, completion: { status: failed.length ? "partial" : "complete", created: kept.length, replayed: 0 } }, 201);
};
const sentIds = (call: number) =>
  (JSON.parse(String(mock.safeFetch.mock.calls[call][1].body)).items as { id: string }[]).map((i) => i.id);
const agenda = (qc: QueryClient) => qc.getQueryData<ItemWithDetails[]>(itemsKeys.list({})) ?? [];
const existing = { id: "existing", type: "reminder", title: "Old", status: "pending", priority: "normal" } as ItemWithDetails;
let qc: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  mock.online.mockReturnValue(true);
  mock.addToQueue.mockResolvedValue("op-1");
  mock.removeQueuedItemCreates.mockResolvedValue([]);
  qc = new QueryClient();
  qc.setQueryData(itemsKeys.list({}), [existing]);
  vi.spyOn(qc, "invalidateQueries");
});

describe("chunkBodies", () => {
  it("keeps 30 items to two requests", () => {
    const chunks = chunkBodies(Array.from({ length: 30 }, (_, n) => ({ n })));
    expect(chunks.map((c) => c.length)).toEqual([BULK_CHUNK_ITEMS, 5]);
  });
  it("splits by size so a queued chunk stays under the queue's payload cap", () => {
    const fat = Array.from({ length: 5 }, (_, n) => ({ n, pad: "x".repeat(BULK_CHUNK_BYTES / 2 - 100) }));
    expect(chunkBodies(fat).map((c) => c.length)).toEqual([2, 2, 1]);
  });
  it("never produces an empty chunk and keeps one oversized body", () => {
    expect(chunkBodies([])).toEqual([]);
    expect(chunkBodies([{ pad: "x".repeat(BULK_CHUNK_BYTES * 2) }])).toHaveLength(1);
  });
});

describe("optimistic rows", () => {
  it("looks like the bundle row the chores agenda reads", () => {
    const row = optimisticItem(
      { id: "x", type: "reminder", title: " Mop ", priority: "normal", is_public: true, notify_all_household: false, category_ids: [], is_template_instance: true, is_chore: true, source_catalogue_item_id: TEMPLATE, due_at: "2026-10-18T09:00:00.000Z", has_checklist: true, all_day: false, subtasks: [{ title: "Bucket", order_index: 0 }], alerts: [], prerequisites: [], metadata_json: { all_day: true, room_id: "r" } } as never,
      ME, new Date("2026-10-17T10:00:00Z"),
    );
    expect(row).toMatchObject({
      id: "x", title: "Mop", status: "pending", is_chore: true, user_id: ME, responsible_user_id: ME,
      source_catalogue_item_id: TEMPLATE, reminder_details: { due_at: "2026-10-18T09:00:00.000Z" },
      metadata_json: { room_id: "r" }, recurrence_rule: null,
    });
    expect(row.subtasks).toHaveLength(1);
  });
  it("joins only the lists it belongs in", () => {
    const row = { type: "reminder", status: "pending", priority: "normal", title: "Mop floor" } as ItemWithDetails;
    expect(listAccepts({}, row)).toBe(true);
    expect(listAccepts({ type: "task" }, row)).toBe(false);
    expect(listAccepts({ status: ["pending", "in_progress"] }, row)).toBe(true);
    expect(listAccepts({ archived: true }, row)).toBe(false);
    expect(listAccepts({ search: "floor" }, row)).toBe(true);
    expect(listAccepts({ search: "garden" }, row)).toBe(false);
    expect(listAccepts({}, { ...row, status: "draft" })).toBe(false);
    expect(listAccepts({ includeDrafts: true }, { ...row, status: "draft" })).toBe(true);
  });
});

describe("createItemsBulk", () => {
  it("shows every row at once, then needs two requests for 30 and refetches once", async () => {
    mock.safeFetch.mockImplementation(async (url: string, init: RequestInit) => {
      // Optimistic: the rows are already on the agenda when the first request leaves
      if (mock.safeFetch.mock.calls.length === 1) expect(agenda(qc)).toHaveLength(31);
      return accepts()(url, init);
    });
    const result = await createItemsBulk(qc, Array.from({ length: 30 }, (_, n) => chore(n)), { userId: ME, sleep: noSleep });
    expect(mock.safeFetch).toHaveBeenCalledTimes(2);
    expect(result.saved).toHaveLength(30);
    expect(result.queued).toEqual([]); expect(result.rejected).toEqual([]);
    expect(agenda(qc).map((i) => i.id)).toEqual(expect.arrayContaining(result.saved));
    expect(mock.safeFetch.mock.calls[0][1]).toMatchObject({ method: "POST", timeoutMs: 30_000 });
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("a timeout is retried with the same ids and never counted as offline or failed", async () => {
    mock.safeFetch
      .mockRejectedValueOnce(new RequestTimeoutError(30_000))
      .mockImplementation(accepts());
    const result = await createItemsBulk(qc, [chore(0), chore(1)], { sleep: noSleep });
    expect(mock.safeFetch).toHaveBeenCalledTimes(2);
    expect(sentIds(1)).toEqual(sentIds(0));
    expect(noSleep).toHaveBeenCalledWith(800);
    expect(result.saved).toEqual(sentIds(0));
    expect(mock.addToQueue).not.toHaveBeenCalled();
  });

  it("a 5xx or an unreadable reply is retried like a timeout", async () => {
    mock.safeFetch
      .mockResolvedValueOnce(json({ completion: { status: "unknown" } }, 500))
      .mockResolvedValueOnce(json({ nonsense: true }, 201))
      .mockImplementation(accepts());
    const result = await createItemsBulk(qc, [chore(0)], { sleep: noSleep });
    expect(mock.safeFetch).toHaveBeenCalledTimes(3);
    expect(result.saved).toHaveLength(1);
  });

  it("a server that stays slow is queued once, whole, and the rest of the batch follows without waiting", async () => {
    mock.safeFetch.mockRejectedValue(new RequestTimeoutError(30_000));
    const result = await createItemsBulk(qc, Array.from({ length: 30 }, (_, n) => chore(n)), { userId: ME, sleep: noSleep });
    expect(mock.safeFetch).toHaveBeenCalledTimes(3); // first chunk only: 1 try + 2 retries
    expect(mock.addToQueue).toHaveBeenCalledTimes(2);
    const first = mock.addToQueue.mock.calls[0] as unknown as [{ endpoint: string; method: string; body: { items: { id: string }[] } }];
    expect(first[0]).toMatchObject({ endpoint: "/api/items/bulk", method: "POST" });
    expect(first[0].body.items.map((i) => i.id)).toEqual(sentIds(0));
    expect(result.queued).toHaveLength(30); expect(result.saved).toEqual([]); expect(result.rejected).toEqual([]);
    expect(agenda(qc)).toHaveLength(31); // still on screen
    expect(qc.invalidateQueries).not.toHaveBeenCalled(); // a refetch would drop queued rows
  });

  it("goes straight to the queue when offline", async () => {
    mock.online.mockReturnValue(false);
    const result = await createItemsBulk(qc, [chore(0), chore(1)], { sleep: noSleep });
    expect(mock.safeFetch).not.toHaveBeenCalled();
    expect(result.queued).toHaveLength(2);
    expect(agenda(qc)).toHaveLength(3);
  });

  it("an OfflineError mid-flight is queued, not retried", async () => {
    mock.safeFetch.mockRejectedValue(new OfflineError());
    const result = await createItemsBulk(qc, [chore(0)], { sleep: noSleep });
    expect(mock.safeFetch).toHaveBeenCalledTimes(1);
    expect(result.queued).toHaveLength(1);
  });

  it.each([[400, "not_started"], [403, "rolled_back"], [501, "not_started"]])(
    "a %s refusal is final: rows come back out, nothing is retried or queued",
    async (status, completion) => {
      mock.safeFetch.mockResolvedValue(json({ error: "no", completion: { status: completion } }, status));
      const result = await createItemsBulk(qc, [chore(0), chore(1)], { sleep: noSleep });
      expect(mock.safeFetch).toHaveBeenCalledTimes(1);
      expect(mock.addToQueue).not.toHaveBeenCalled();
      expect(result.rejected.map((r) => r.index)).toEqual([0, 1]);
      expect(agenda(qc).map((i) => i.id)).toEqual(["existing"]);
    },
  );

  it("a per-item failure in a saved batch is reported at its input position and removed alone", async () => {
    mock.safeFetch.mockImplementation(accepts([{ index: 1, code: "42501" }]));
    const result = await createItemsBulk(qc, [chore(0), chore(1), chore(2)], { sleep: noSleep });
    expect(result.rejected).toEqual([{ index: 1, id: sentIds(0)[1] }]);
    expect(result.saved).toEqual([sentIds(0)[0], sentIds(0)[2]]);
    expect(agenda(qc).map((i) => i.id)).not.toContain(sentIds(0)[1]);
    expect(agenda(qc)).toHaveLength(3);
  });

  it("an invalid input is rejected on its own and the rest still go", async () => {
    mock.safeFetch.mockImplementation(accepts());
    const result = await createItemsBulk(qc, [chore(0), chore(1, { title: "   " }), chore(2)], { sleep: noSleep });
    expect(result.rejected.map((r) => r.index)).toEqual([1]);
    expect(result.saved).toHaveLength(2);
    expect(sentIds(0)).toHaveLength(2);
  });

  it("a queue that cannot take the chunk is a rejection, never a silent loss", async () => {
    mock.online.mockReturnValue(false);
    mock.addToQueue.mockRejectedValue(new Error("Too many pending changes."));
    const result = await createItemsBulk(qc, [chore(0)], { sleep: noSleep });
    expect(result.rejected).toHaveLength(1);
    expect(agenda(qc).map((i) => i.id)).toEqual(["existing"]);
  });

  it("ids are unique per item and stable across a retry", async () => {
    mock.safeFetch.mockRejectedValueOnce(new RequestTimeoutError(30_000)).mockImplementation(accepts());
    await createItemsBulk(qc, [chore(0), chore(1), chore(2)], { sleep: noSleep });
    expect(new Set(sentIds(0)).size).toBe(3);
    expect(sentIds(1)).toEqual(sentIds(0));
  });
});

describe("deleteItemsBulk", () => {
  const ids = ["a", "b", "c"];
  const seed = () => qc.setQueryData(itemsKeys.list({}), [existing, ...ids.map((id) => ({ ...existing, id }) as ItemWithDetails)]);

  it("takes the rows off the agenda at once and deletes them in one request", async () => {
    seed();
    mock.safeFetch.mockImplementation(async () => {
      expect(agenda(qc).map((i) => i.id)).toEqual(["existing"]);
      return json({ deleted: ids });
    });
    expect(await deleteItemsBulk(qc, ids, { sleep: noSleep })).toEqual({ ok: true });
    expect(mock.safeFetch).toHaveBeenCalledTimes(1);
    expect(mock.safeFetch.mock.calls[0][1]).toMatchObject({ method: "DELETE", body: JSON.stringify({ ids }) });
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("items still waiting in the offline queue are dropped from it and never sent", async () => {
    seed();
    mock.removeQueuedItemCreates.mockResolvedValue(["a", "b"]);
    mock.safeFetch.mockResolvedValue(json({ deleted: ["c"] }));
    await deleteItemsBulk(qc, ids, { sleep: noSleep });
    expect(JSON.parse(String(mock.safeFetch.mock.calls[0][1].body))).toEqual({ ids: ["c"] });
  });

  it("sends nothing when every item was still queued", async () => {
    seed();
    mock.removeQueuedItemCreates.mockResolvedValue(ids);
    expect(await deleteItemsBulk(qc, ids, { sleep: noSleep })).toEqual({ ok: true });
    expect(mock.safeFetch).not.toHaveBeenCalled();
  });

  it("offline, the delete waits in the queue and the rows stay gone", async () => {
    seed();
    mock.online.mockReturnValue(false);
    expect(await deleteItemsBulk(qc, ids, { sleep: noSleep })).toEqual({ ok: true });
    expect(mock.addToQueue).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "/api/items/bulk", method: "DELETE", body: { ids } }));
    expect(agenda(qc).map((i) => i.id)).toEqual(["existing"]);
  });

  it("a refused delete puts the rows back and says so", async () => {
    seed();
    mock.safeFetch.mockResolvedValue(json({ error: "no" }, 400));
    expect(await deleteItemsBulk(qc, ids, { sleep: noSleep })).toEqual({ ok: false });
    expect(agenda(qc).map((i) => i.id).sort()).toEqual(["a", "b", "c", "existing"]);
  });
});

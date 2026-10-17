import { beforeEach, expect, it, vi } from "vitest";
import { createSyncEngine } from "./offlineSyncEngine";
import { safeFetch } from "./safeFetch";
import type { OfflineOperation } from "./offlineQueue";

const mock = vi.hoisted(() => ({ ops: [] as OfflineOperation[], invalidate: vi.fn(), failure: vi.fn(), markOffline: vi.fn() }));
vi.mock("./safeFetch", () => ({ safeFetch: vi.fn() }));
vi.mock("./connectivityManager", () => ({ isReallyOnline: () => true, markOffline: mock.markOffline }));
vi.mock("./supabase/client", () => ({ supabaseBrowser: () => ({ auth: { getSession: async () => ({}) } }) }));
vi.mock("./offlineQueue", () => ({
  getAllPending: async () => mock.ops.map((o) => ({ ...o })), getQueueCount: async () => mock.ops.length,
  removeStaleOperations: async () => {}, cancelCreateDeletePair: async () => {},
  removeFromQueue: async (id: string) => { mock.ops = mock.ops.filter((o) => o.id !== id); },
  updateRetryCount: async (id: string, count: number) => { mock.ops.find((o) => o.id === id)!.retryCount = count; },
  updateQueuedOperation: async (id: string, updates: Partial<OfflineOperation>) => { Object.assign(mock.ops.find((o) => o.id === id)!, updates); return true; },
}));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-000000000000";
const B = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const op = (extra: Partial<OfflineOperation> = {}): OfflineOperation => ({
  id: "op", feature: "item", operation: "create", endpoint: "/api/items/bulk", method: "POST",
  body: { items: [{ id: A, type: "reminder", title: "Mop" }, { id: B, type: "reminder", title: "Dust" }] },
  createdAt: Date.now(), retryCount: 0, maxRetries: 5, metadata: { label: "Add 2 items" }, ...extra,
});
const engine = () => createSyncEngine({ invalidateQueries: mock.invalidate, onOperationFailure: mock.failure });
beforeEach(() => { vi.clearAllMocks(); mock.ops = [op()]; });

it("replays a queued bulk create without a review fence, on a chunk-sized timeout", async () => {
  vi.mocked(safeFetch).mockImplementation(async () => {
    expect(mock.ops[0].reviewRequired).toBeUndefined();
    return Response.json({ items: [{ id: A }, { id: B }], failed: [], completion: { status: "complete", created: 2, replayed: 0 } }, { status: 201 });
  });
  const result = await engine().processQueue();
  expect(result).toMatchObject({ succeeded: 1, failed: 0 });
  expect(mock.ops).toEqual([]);
  expect(vi.mocked(safeFetch).mock.calls[0][1]).toMatchObject({ method: "POST", timeoutMs: 30_000 });
  expect(mock.invalidate).toHaveBeenCalled();
  expect(mock.failure).not.toHaveBeenCalled();
});

it("a slow replay is retried later with the same ids, not paused for review", async () => {
  vi.mocked(safeFetch).mockRejectedValue(new Error("Request timed out after 30000ms"));
  const e = engine();
  await e.processQueue();
  expect(mock.ops).toHaveLength(1);
  expect(mock.ops[0]).toMatchObject({ retryCount: 1 });
  expect(mock.ops[0].reviewRequired).toBeUndefined();
  expect(mock.ops[0].body.items).toEqual(op().body.items);
  expect(mock.markOffline).not.toHaveBeenCalled();
});

it("a server error keeps the batch for the next pass", async () => {
  vi.mocked(safeFetch).mockResolvedValue(Response.json({ completion: { status: "unknown" } }, { status: 500 }));
  await engine().processQueue();
  expect(mock.ops[0].retryCount).toBe(1);
});

it("tells the owner once when the server refused some items of a replayed batch", async () => {
  vi.mocked(safeFetch).mockResolvedValue(
    Response.json({ items: [{ id: A }], failed: [{ index: 1, code: "42501" }], completion: { status: "partial", created: 1, replayed: 0 } }, { status: 201 }),
  );
  const result = await engine().processQueue();
  expect(result.failed).toBe(1);
  expect(mock.failure).toHaveBeenCalledWith(expect.objectContaining({ id: "op" }), "1 not saved", true);
  expect(mock.ops).toEqual([]);
});

it("a refused batch is dropped and the optimistic rows are refreshed away", async () => {
  vi.mocked(safeFetch).mockResolvedValue(Response.json({ error: "Items were not saved", completion: { status: "rolled_back" } }, { status: 403 }));
  const result = await engine().processQueue();
  expect(result.failed).toBe(1);
  expect(mock.ops).toEqual([]);
  expect(mock.failure).toHaveBeenCalledWith(expect.anything(), "Items were not saved", true);
  expect(mock.invalidate).toHaveBeenCalledWith(expect.arrayContaining([["items"]]));
});

it("gives up after the retry budget and refreshes the rows it showed", async () => {
  mock.ops = [op({ retryCount: 5 })];
  await engine().processQueue();
  expect(mock.ops).toEqual([]);
  expect(mock.invalidate).toHaveBeenCalledWith(expect.arrayContaining([["items"]]));
  expect(safeFetch).not.toHaveBeenCalled();
});

it("replays a queued bulk delete with its ids", async () => {
  mock.ops = [op({ operation: "delete", method: "DELETE", body: { ids: [A, B] }, metadata: { label: "Delete 2 items" } })];
  vi.mocked(safeFetch).mockResolvedValue(Response.json({ deleted: [A, B] }));
  const result = await engine().processQueue();
  expect(result.succeeded).toBe(1);
  expect(vi.mocked(safeFetch).mock.calls[0][1]).toMatchObject({ method: "DELETE", body: JSON.stringify({ ids: [A, B] }), timeoutMs: 30_000 });
});

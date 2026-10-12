import { beforeEach, expect, it, vi } from "vitest";
import { createSyncEngine } from "./offlineSyncEngine";
import { safeFetch } from "./safeFetch";
import type { OfflineOperation } from "./offlineQueue";
const mock = vi.hoisted(() => ({ ops: [] as OfflineOperation[], invalidate: vi.fn(), failure: vi.fn(), markOffline: vi.fn(), canFence: true }));
vi.mock("./safeFetch", () => ({ safeFetch: vi.fn() }));
vi.mock("./connectivityManager", () => ({ isReallyOnline: () => true, markOffline: mock.markOffline }));
vi.mock("./supabase/client", () => ({ supabaseBrowser: () => ({ auth: { getSession: async () => ({}) } }) }));
vi.mock("./offlineQueue", () => ({
  getAllPending: async () => mock.ops.map(o => ({ ...o })), getQueueCount: async () => mock.ops.length,
  removeStaleOperations: async () => {}, cancelCreateDeletePair: async () => {},
  removeFromQueue: async (id: string) => { mock.ops = mock.ops.filter(o => o.id !== id); },
  updateRetryCount: async (id: string, count: number) => { mock.ops.find(o => o.id === id)!.retryCount = count; },
  updateQueuedOperation: async (id: string, updates: Partial<OfflineOperation>) => { Object.assign(mock.ops.find(o => o.id === id)!, updates); return mock.canFence; },
}));
beforeEach(() => {
  vi.clearAllMocks(); mock.canFence = true; mock.ops = [{ id: "op", feature: "item", operation: "create", endpoint: "/api/items", method: "POST", body: { type: "reminder", title: "Bins" }, createdAt: Date.now(), retryCount: 0, maxRetries: 5, metadata: { label: "Bins" } }];
});
const engine = () => createSyncEngine({ invalidateQueries: mock.invalidate, onOperationFailure: mock.failure });
it("fences an item before dispatch and holds a lost response across repeated sync passes", async () => {
  vi.mocked(safeFetch).mockImplementation(async () => { expect(mock.ops[0].reviewRequired).toBe(true); throw new Error("Response lost after commit"); });
  const e = engine(); const first = await e.processQueue(); await e.processQueue();
  expect(first.failed).toBe(1); expect(mock.ops[0].reviewRequired).toBe(true); expect(mock.ops[0].body.title).toBe("Bins");
  expect(safeFetch).toHaveBeenCalledTimes(1); expect(mock.markOffline).not.toHaveBeenCalled();
});
it("retries only a source-acknowledged rollback; succeeds once with a complete receipt", async () => {
  vi.mocked(safeFetch).mockResolvedValueOnce(Response.json({ completion: { status: "rolled_back" } }, { status: 500 }))
    .mockResolvedValueOnce(Response.json({ item: { id: "11111111-1111-4111-8111-111111111111" }, completion: { status: "complete" } }));
  const e = engine(); await e.processQueue(); expect(mock.ops[0].reviewRequired).toBe(false);
  const result = await e.processQueue(); expect(result.succeeded).toBe(1); expect(mock.ops).toEqual([]);
});
it("does not accept an old parent-only 201 as complete or replay it", async () => {
  vi.mocked(safeFetch).mockResolvedValue(Response.json({ item: { id: "11111111-1111-4111-8111-111111111111" } }));
  const e = engine(); await e.processQueue(); await e.processQueue();
  expect(mock.ops[0].reviewRequired).toBe(true); expect(safeFetch).toHaveBeenCalledTimes(1);
});
it("never dispatches when durable local fencing fails", async () => {
  mock.canFence = false;
  await engine().processQueue();
  expect(safeFetch).not.toHaveBeenCalled();
  expect(mock.failure).toHaveBeenCalledWith(expect.anything(), "Not sent. Queue storage unavailable.", false);
});

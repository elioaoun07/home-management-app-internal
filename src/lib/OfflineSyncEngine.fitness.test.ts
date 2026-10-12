import { beforeEach, expect, it, vi } from "vitest";
import { createSyncEngine } from "./offlineSyncEngine";
import { safeFetch } from "./safeFetch";
import type { OfflineOperation } from "./offlineQueue";
const mock = vi.hoisted(() => ({ ops: [] as OfflineOperation[], invalidate: vi.fn(), failure: vi.fn() }));
vi.mock("./safeFetch", () => ({ safeFetch: vi.fn() }));
vi.mock("./connectivityManager", () => ({ isReallyOnline: () => true, markOffline: vi.fn() }));
vi.mock("./supabase/client", () => ({ supabaseBrowser: () => ({ auth: { getSession: async () => ({}) } }) }));
vi.mock("./offlineQueue", () => ({
  getAllPending: async () => mock.ops.map((o) => ({ ...o })), getQueueCount: async () => mock.ops.length,
  removeStaleOperations: async () => {}, cancelCreateDeletePair: async () => {},
  removeFromQueue: async (id: string) => { mock.ops = mock.ops.filter((o) => o.id !== id); },
  updateRetryCount: async (id: string, count: number) => { mock.ops.find((o) => o.id === id)!.retryCount = count; },
  updateQueuedOperation: async (id: string, updates: Partial<OfflineOperation>) => { Object.assign(mock.ops.find((o) => o.id === id)!, updates); return true; },
}));

const op = (id: string, body: Record<string, unknown>): OfflineOperation => ({
  id, feature: "fitness", operation: "update", endpoint: "/api/fitness/sessions", method: "POST", body,
  createdAt: Date.now(), retryCount: 0, maxRetries: 5, metadata: { label: "Bench press · set 2" },
});
beforeEach(() => {
  vi.clearAllMocks();
  mock.ops = [op("a", { op: "log-set", op_id: "11111111-1111-4111-8111-111111111111", reps: 10 }), op("b", { op: "finish", op_id: "22222222-2222-4222-8222-222222222222" })];
});
const engine = () => createSyncEngine({ invalidateQueries: mock.invalidate, onOperationFailure: mock.failure });

it("keeps a conflicting set for review instead of dropping it, and continues the queue", async () => {
  vi.mocked(safeFetch)
    .mockResolvedValueOnce(Response.json({ conflict: true, server: { reps: 12 } }, { status: 409 }))
    .mockResolvedValueOnce(Response.json({ session: { status: "completed" } }));
  const r = await engine().processQueue();
  expect(r.succeeded).toBe(1);
  expect(mock.ops).toHaveLength(1);
  expect(mock.ops[0]).toMatchObject({ id: "a", reviewRequired: true, body: { reps: 10 } });
  expect(mock.ops[0].metadata?.label).toContain("Conflict");
  // Held for review: the next pass never replays it blindly.
  await engine().processQueue();
  expect(safeFetch).toHaveBeenCalledTimes(2);
});

it("replays a lost acknowledgement safely (server receipt) and retries an expired session later", async () => {
  vi.mocked(safeFetch)
    .mockResolvedValueOnce(Response.json({ error: "Unauthorized" }, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ replayed: true }));
  await engine().processQueue();
  expect(mock.ops.map((o) => [o.id, o.reviewRequired ?? false, o.retryCount])).toEqual([["a", false, 1]]);
});

it("holds a repeatedly failing workout op instead of discarding it at max retries", async () => {
  mock.ops = [{ ...mock.ops[0], retryCount: 5 }];
  await engine().processQueue();
  expect(mock.ops[0].reviewRequired).toBe(true);
  expect(safeFetch).not.toHaveBeenCalled();
});

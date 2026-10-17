import { beforeEach, expect, it, vi } from "vitest";
import { addToQueue, clearQueue, getAllPending, removeQueuedItemCreates, updateQueuedOperation } from "./offlineQueue";

// No IndexedDB in node: the queue runs on its in-memory fallback, the same code path
vi.spyOn(console, "log").mockImplementation(() => {});

const bulk = (ids: string[]) =>
  addToQueue({
    feature: "item", operation: "create", endpoint: "/api/items/bulk", method: "POST",
    body: { items: ids.map((id) => ({ id, type: "reminder", title: id })) }, metadata: { label: `Add ${ids.length} items` },
  });
const queued = async () => (await getAllPending()).map((op) => ({ endpoint: op.endpoint, ids: (op.body.items as { id: string }[] | undefined)?.map((i) => i.id) }));

beforeEach(async () => { await clearQueue(); });

it("drops Undone items from queued bulk creates, removing a batch that empties", async () => {
  await bulk(["a", "b", "c"]);
  await bulk(["d", "e"]);
  await addToQueue({ feature: "item", operation: "create", endpoint: "/api/items", method: "POST", body: { id: "a", title: "single" } });
  const taken = await removeQueuedItemCreates(["a", "b", "d", "e", "zzz"]);
  expect(taken.sort()).toEqual(["a", "b", "d", "e"]);
  expect(await queued()).toEqual([
    { endpoint: "/api/items/bulk", ids: ["c"] },
    { endpoint: "/api/items", ids: undefined },
  ]);
  expect((await getAllPending())[0].metadata?.label).toBe("Add 1 item");
});

it("leaves a batch alone when none of its items are Undone", async () => {
  await bulk(["a", "b"]);
  expect(await removeQueuedItemCreates(["x"])).toEqual([]);
  expect(await queued()).toEqual([{ endpoint: "/api/items/bulk", ids: ["a", "b"] }]);
});

it("never edits a batch that may already have been sent", async () => {
  const id = await bulk(["a", "b"]);
  await updateQueuedOperation(id, { reviewRequired: true });
  expect(await removeQueuedItemCreates(["a"])).toEqual([]);
  expect(await queued()).toEqual([{ endpoint: "/api/items/bulk", ids: ["a", "b"] }]);
});

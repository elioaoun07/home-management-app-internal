import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mock = vi.hoisted(() => ({
  rpc: vi.fn(), auth: vi.fn(), from: vi.fn(), sync: vi.fn(), gcalDelete: vi.fn(), after: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser: mock.auth }, rpc: mock.rpc, from: mock.from }),
}));
vi.mock("@/lib/gcal/sync", () => ({
  syncItemToGoogleCalendar: mock.sync, deleteItemFromGoogleCalendar: mock.gcalDelete,
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: mock.after,
}));
import { DELETE, POST } from "./route";

const user = "11111111-1111-4111-8111-111111111111";
const ids = [0, 1, 2, 3].map((n) => `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${n}`);
const item = (n: number, extra: Record<string, unknown> = {}) => ({
  id: ids[n], type: "reminder", title: `Chore ${n}`, due_at: "2026-10-18T09:00:00Z", is_chore: true, ...extra,
});
const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/items/bulk", { method: "POST", body: JSON.stringify(body) }));
const del = (body: unknown) =>
  DELETE(new NextRequest("http://localhost/api/items/bulk", { method: "DELETE", body: JSON.stringify(body) }));
const receipt = (extra: Record<string, unknown> = {}) => ({
  items: [{ id: ids[0] }, { id: ids[1] }], failed: [],
  completion: { status: "complete", created: 2, replayed: 0 }, ...extra,
});
/** A PostgREST builder that can be chained and awaited */
const builder = (result: unknown) => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "in", "not", "delete"]) chain[m] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ data: { user: { id: user } } });
  mock.rpc.mockResolvedValue({ data: receipt(), error: null });
  mock.sync.mockResolvedValue(undefined);
  mock.gcalDelete.mockResolvedValue(undefined);
});

it("requires a session", async () => {
  mock.auth.mockResolvedValue({ data: { user: null } });
  expect((await post({ items: [item(0)] })).status).toBe(401);
  expect((await del({ ids: [ids[0]] })).status).toBe(401);
  expect(mock.rpc).not.toHaveBeenCalled();
});

it.each([
  [{ items: [] }],
  [{ items: [{ type: "reminder", title: "No id" }] }],
  [{ items: [item(0), item(0)] }],
  [{ items: [item(0, { type: "event" })] }],
  [{ items: [item(0, { alerts: [{ kind: "absolute" }] })] }],
  [{ items: Array.from({ length: 51 }, (_, n) => item(0, { id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, "0")}` })) }],
  [{ items: [item(0)], extra: true }],
])("validates the whole batch before any write: %j", async (body) => {
  const res = await post(body);
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ completion: { status: "not_started" } });
  expect(mock.rpc).not.toHaveBeenCalled();
});

it("refuses a custom alert time that the device did not resolve", async () => {
  const res = await post({ items: [item(0, { alerts: [{ kind: "relative", offset_minutes: 0, relative_to: "due", custom_time: "09:00" }] })] });
  expect(res.status).toBe(400); expect(mock.rpc).not.toHaveBeenCalled();
});

it("creates the batch in one transaction call, keeping the client ids", async () => {
  const res = await post({ items: [item(0), item(1)] });
  expect(res.status).toBe(201);
  expect(await res.json()).toMatchObject({ completion: { status: "complete", created: 2 }, failed: [] });
  expect(mock.rpc).toHaveBeenCalledTimes(1);
  expect(mock.rpc).toHaveBeenCalledWith("create_items_bulk", {
    p: [expect.objectContaining({ id: ids[0], status: "pending", alerts: [expect.objectContaining({ kind: "absolute" })] }), expect.objectContaining({ id: ids[1] })],
  });
});

it("backs up to Google after the reply, a few at a time, and never inside the receipt", async () => {
  await post({ items: [item(0), item(1)] });
  expect(mock.after).toHaveBeenCalledTimes(1);
  expect(mock.sync).not.toHaveBeenCalled();
  await mock.after.mock.calls[0][0]();
  expect(mock.sync.mock.calls.map((call) => call[1])).toEqual([ids[0], ids[1]]);
});

it("reports a partial batch with the failing positions and still backs up what committed", async () => {
  mock.rpc.mockResolvedValue({
    data: receipt({ items: [{ id: ids[1] }], failed: [{ index: 0, code: "42501" }], completion: { status: "partial", created: 1, replayed: 0 } }),
    error: null,
  });
  const res = await post({ items: [item(0), item(1)] });
  expect(res.status).toBe(201);
  expect(await res.json()).toMatchObject({ failed: [{ index: 0, code: "42501" }], completion: { status: "partial" } });
  await mock.after.mock.calls[0][0]();
  expect(mock.sync.mock.calls.map((call) => call[1])).toEqual([ids[1]]);
});

it("schedules no backup when nothing committed", async () => {
  mock.rpc.mockResolvedValue({ data: receipt({ items: [], failed: [{ index: 0, code: "42501" }], completion: { status: "partial", created: 0, replayed: 0 } }), error: null });
  await post({ items: [item(0)] });
  expect(mock.after).not.toHaveBeenCalled();
});

it.each([["PGRST202", 501, "not_started"], ["42501", 403, "rolled_back"], ["22023", 400, "rolled_back"], ["XX000", 500, "rolled_back"]])(
  "source rejection %s maps to %s and stays a rollback",
  async (code, status, completion) => {
    mock.rpc.mockResolvedValue({ data: null, error: { code } });
    const res = await post({ items: [item(0)] });
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ completion: { status: completion } });
    expect(mock.after).not.toHaveBeenCalled();
  },
);

it("a lost response or incomplete receipt stays unknown, so the client retries the same ids", async () => {
  mock.rpc.mockRejectedValueOnce(new Error("Response lost after commit"));
  const lost = await post({ items: [item(0)] });
  expect(lost.status).toBe(500); expect((await lost.json()).completion.status).toBe("unknown");
  mock.rpc.mockResolvedValueOnce({ data: { items: [{ id: ids[0] }] }, error: null });
  const partial = await post({ items: [item(0)] });
  expect(partial.status).toBe(502); expect((await partial.json()).completion.status).toBe("unknown");
  expect(mock.after).not.toHaveBeenCalled();
});

it("returned transport errors cannot prove a rollback", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { code: "", message: "TypeError: fetch failed" } });
  const res = await post({ items: [item(0)] });
  expect((await res.json()).completion.status).toBe("unknown");
});

it("bulk delete removes Google events first, then the rows, and reports what was deleted", async () => {
  const order: string[] = [];
  mock.gcalDelete.mockImplementation(async () => { order.push("google"); });
  const backed = builder({ data: [{ id: ids[0] }] });
  const removed = builder({ data: [{ id: ids[0] }, { id: ids[1] }], error: null });
  (removed.delete as ReturnType<typeof vi.fn>).mockImplementation(() => { order.push("rows"); return removed; });
  mock.from.mockReturnValueOnce(backed).mockReturnValueOnce(removed);
  const res = await del({ ids: [ids[0], ids[1]] });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ deleted: [ids[0], ids[1]] });
  expect(mock.gcalDelete.mock.calls.map((call) => call[1])).toEqual([ids[0]]);
  expect(order).toEqual(["google", "rows"]);
});

it("bulk delete validates its ids and reports a failed delete honestly", async () => {
  expect((await del({ ids: [] })).status).toBe(400);
  expect((await del({ ids: ["nope"] })).status).toBe(400);
  mock.from.mockReturnValueOnce(builder({ data: [] })).mockReturnValueOnce(builder({ data: null, error: { code: "XX000" } }));
  const res = await del({ ids: [ids[0]] });
  expect(res.status).toBe(500);
});

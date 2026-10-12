import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ auth: { getUser: mock.auth }, rpc: mock.rpc }) }));
vi.mock("@/lib/gcal/sync", () => ({ syncItemToGoogleCalendar: mock.sync }));
const id = "11111111-1111-4111-8111-111111111111";
const send = (body: unknown) => POST(new NextRequest("http://localhost/api/items", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => {
  vi.clearAllMocks(); mock.auth.mockResolvedValue({ data: { user: { id } } }); mock.sync.mockResolvedValue(undefined);
  mock.rpc.mockResolvedValue({ data: { item: { id }, completion: { status: "complete" } }, error: null });
});
it.each([
  { type: "event", title: "Dentist", start_at: "2026-10-12T12:00:00Z" },
  { type: "reminder", title: "Bins", due_at: "tomorrow" },
  { type: "task", title: "Bins", subtasks: [{ title: "" }] },
  { type: "reminder", title: "Bins", recurrence_rule: { rrule: "invented", start_anchor: "2026-10-12T12:00:00Z" } },
  { type: "reminder", title: "Bins", prerequisites: [{ condition_type: "nfc_state_change", condition_config: { tag_id: "foreign" } }] },
  { type: "task", title: "Bins", alerts: [{ kind: "absolute" }] },
  { type: "reminder", title: "Bins", due_at: "2026-10-12T12:00:00Z", recurrence_rule: { rrule: "FREQ=DAILY", start_anchor: "2026-10-12T12:00:00Z" }, alerts: [{ kind: "relative", offset_minutes: 1440, relative_to: "due", custom_time: "09:00" }] },
])("validates the entire request before the transaction: %j", async body => {
  const res = await send(body); expect(res.status).toBe(400); expect(mock.rpc).not.toHaveBeenCalled();
});
it("returns a complete source receipt and suppresses draft alerts", async () => {
  const res = await send({ type: "task", title: "Bins", status: "draft", due_at: "2026-10-12T12:00:00Z" });
  expect(res.status).toBe(201); expect((await res.json()).completion.status).toBe("complete");
  expect(mock.rpc).toHaveBeenCalledWith("create_item_complete", { p: expect.objectContaining({ status: "draft", alerts: [] }) });
});
it.each([["23505",409],["42501",403],["XX000",500]])("explicit source rejection %s is rollback, never a complete/partial parent", async (code,status) => {
  mock.rpc.mockResolvedValue({ data: null, error: { code } });
  const res = await send({ type: "reminder", title: "Bins" });
  expect(res.status).toBe(status); expect(await res.json()).toMatchObject({ completion: { status: "rolled_back" } }); expect(mock.sync).not.toHaveBeenCalled();
});
it("lost source response remains unknown, never retried or reported as failed rollback", async () => {
  mock.rpc.mockRejectedValue(new Error("Response lost after commit"));
  const res = await send({ type: "reminder", title: "Bins" });
  expect((await res.json()).completion.status).toBe("unknown"); expect(mock.rpc).toHaveBeenCalledTimes(1);
});
it("an incomplete source receipt remains unknown", async () => {
  mock.rpc.mockResolvedValue({ data: { item: { id } }, error: null });
  const res = await send({ type: "reminder", title: "Bins" }); expect(res.status).toBe(502);
});
it("returned transport errors cannot prove a rollback", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { code: "", message: "TypeError: fetch failed" } });
  const res = await send({ type: "reminder", title: "Bins" });
  expect((await res.json()).completion.status).toBe("unknown");
  expect(mock.rpc).toHaveBeenCalledTimes(1);
});

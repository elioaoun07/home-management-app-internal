import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "./route";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) }, rpc: mock.rpc,
}) }));
const itemId = "11111111-1111-4111-8111-111111111111";
const tagId = "22222222-2222-4222-8222-222222222222";
const params = { params: Promise.resolve({ id: itemId }) };
const add = (body: unknown) => POST(new NextRequest("http://localhost/api/items/" + itemId + "/prerequisites", { method: "POST", body: JSON.stringify(body) }), params);
const trigger = { condition_type: "nfc_state_change", condition_config: { tag_id: tagId, target_state: "arriving" } };
beforeEach(() => { mock.rpc.mockReset(); });
it("rejects a malformed trigger without any source write", async () => {
  expect((await add({ ...trigger, condition_config: { tag_id: "wrong" } })).status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("accepts only a receipt acknowledging both the trigger and resulting item state", async () => {
  mock.rpc.mockResolvedValue({ data: { id: tagId, completion: { status: "complete", itemId, itemStatus: "dormant" } }, error: null });
  expect((await add(trigger)).status).toBe(201);
  expect(mock.rpc).toHaveBeenCalledWith("add_item_prerequisite_complete", { p_item_id: itemId, p: { ...trigger, logic_group: 0 } });
  mock.rpc.mockResolvedValue({ data: { id: tagId }, error: null });
  expect((await add(trigger)).status).toBe(502);
});
it.each([["23505",409],["42501",403],["P0002",404]])("returned source rejection %s is an explicit rollback", async (code, status) => {
  mock.rpc.mockResolvedValue({ data: null, error: { code } });
  const res = await add(trigger); expect(res.status).toBe(status);
  expect((await res.json()).completion.status).toBe("rolled_back");
});
it("a lost removal acknowledgement stays unknown with no retry", async () => {
  mock.rpc.mockRejectedValue(new Error("Lost after commit"));
  const res = await DELETE(new NextRequest(`http://localhost/api/items/${itemId}/prerequisites?prerequisiteId=${tagId}`, { method: "DELETE" }), params);
  expect((await res.json()).completion.status).toBe("unknown");
  expect(mock.rpc).toHaveBeenCalledTimes(1);
});

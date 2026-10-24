import { expect, it } from "vitest";
import { retireCancelledLaunch, sendDurableIntent, storedIntent } from "../../scripts/pm/app/commandIntents";
import { RefusedCommand } from "../../scripts/pm/app/transport";

it("keeps one launch identity across lost responses, restart and reconnect", async () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const runs = new Map<string, { run_id: string }>();
  const ids: string[] = [];
  let lose = true;
  const send = async (_path: string, body: Record<string, unknown>) => {
    const id = String(body.command_id); ids.push(id);
    if (!runs.has(id)) runs.set(id, { run_id: "run-one" });
    if (lose) { lose = false; throw new Error("response lost after admission"); }
    return runs.get(id)!;
  };
  const request = { scope: "installation:owner", intent: "deliver:R44", path: "deliver", body: { expectId: "R44" }, storage, send };
  await expect(sendDurableIntent({ ...request, uuid: () => "original" })).rejects.toThrow("lost");
  expect(storedIntent(request.scope, request.intent, storage)).toEqual({ path: "deliver", body: { expectId: "R44" }, completed: false });
  expect(await sendDurableIntent({ ...request, uuid: () => "must-not-be-used" })).toEqual({ run_id: "run-one" });
  expect(await sendDurableIntent(request)).toEqual({ run_id: "run-one" });
  expect(ids).toEqual(["original", "original"]); expect(runs.size).toBe(1);
  expect(storedIntent(request.scope, request.intent, storage)?.completed).toBe(true);
  await expect(sendDurableIntent({ ...request, body: { expectId: "R45" } })).rejects.toThrow("Reconcile");
});

it("refuses to transmit when durable storage fails", async () => {
  let calls = 0;
  await expect(sendDurableIntent({ scope: "owner", intent: "launch", path: "deliver", body: {}, uuid: () => "id",
    storage: { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => {} },
    send: async () => { calls++; },
  })).rejects.toThrow("quota");
  expect(calls).toBe(0);
});

it("permits a corrected intent only after a confirmed refusal", async () => {
  const data = new Map<string, string>(), ids: string[] = [];
  const storage = { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const request = { scope: "owner", intent: "launch", path: "deliver", body: {}, storage };
  await expect(sendDurableIntent({ ...request, uuid: () => "refused", send: async (_path, body) => { ids.push(String(body.command_id)); throw new RefusedCommand("stale approval", 409); } })).rejects.toThrow("stale");
  await sendDurableIntent({ ...request, body: { revision: 2 }, uuid: () => "corrected", send: async (_path, body) => { ids.push(String(body.command_id)); return { run_id: "one" }; } });
  expect(ids).toEqual(["refused", "corrected"]);
});

function cancelledFixture() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const request = { scope: "installation:owner", intent: "deliver:R44", path: "deliver", body: { expectId: "R44" }, storage };
  return { data, storage, request };
}

it("archives a confirmed cancelled launch and mints one fresh identity on the next explicit Start", async () => {
  const { data, storage, request } = cancelledFixture();
  const ids: string[] = [];
  const send = async (_path: string, body: Record<string, unknown>) => { ids.push(String(body.command_id)); return { run_id: ids.length === 1 ? "old-run" : "new-run" }; };
  await sendDurableIntent({ ...request, send, uuid: () => "old-id" });
  const old = [...data.values()][0];
  await retireCancelledLaunch({ ...request, readRun: async id => ({ run: { run_id: id, lifecycle: "CLOSED", closed_outcome: "cancelled" } }) });
  expect(storedIntent(request.scope, request.intent, storage)).toBeNull();
  expect(data.get("pm-command-receipt:installation:owner:old-id")).toBe(old);
  expect(ids).toEqual(["old-id"]); // Releasing the slot never dispatches.
  await sendDurableIntent({ ...request, body: { expectId: "R44", revision: 2 }, send, uuid: () => "new-id" });
  await sendDurableIntent({ ...request, body: { expectId: "R44", revision: 2 }, send, uuid: () => "unused" });
  expect(ids).toEqual(["old-id", "new-id"]);
  expect(data.get("pm-command-receipt:installation:owner:old-id")).toBe(old);
});

it.each([
  { lifecycle: "WAITING", closed_outcome: "cancelled", run_id: "old-run" },
  { lifecycle: "CLOSED", closed_outcome: "completed", run_id: "old-run" },
  { lifecycle: "CLOSED", closed_outcome: "failed", run_id: "old-run" },
  { lifecycle: "CLOSED", closed_outcome: null, run_id: "old-run" },
  { lifecycle: "CLOSED", closed_outcome: "cancelled", run_id: "another-run" },
])("keeps the original identity unless its exact cancellation is confirmed: %j", async run => {
  const { data, request } = cancelledFixture();
  await sendDurableIntent({ ...request, uuid: () => "old-id", send: async () => ({ run_id: "old-run" }) });
  const before = [...data];
  await expect(retireCancelledLaunch({ ...request, readRun: async () => ({ run }) })).rejects.toThrow("Cancellation not confirmed");
  expect([...data]).toEqual(before);
});

it("retains unresolved and offline receipts and refuses failed archive storage", async () => {
  const { data, storage, request } = cancelledFixture();
  await expect(sendDurableIntent({ ...request, uuid: () => "old-id", send: async () => { throw new Error("lost reply"); } })).rejects.toThrow();
  const unknown = [...data];
  await expect(retireCancelledLaunch({ ...request, readRun: async () => { throw new Error("must not read"); } })).rejects.toThrow("Reconcile");
  expect([...data]).toEqual(unknown);
  await sendDurableIntent({ ...request, send: async () => ({ run_id: "old-run" }) });
  const completed = [...data];
  await expect(retireCancelledLaunch({ ...request, readRun: async () => { throw new Error("offline"); } })).rejects.toThrow("offline");
  await expect(retireCancelledLaunch({ ...request, storage: { ...storage, setItem: () => {} }, readRun: async id => ({ run: { run_id: id, lifecycle: "CLOSED", closed_outcome: "cancelled" } }) })).rejects.toThrow("storage");
  expect([...data]).toEqual(completed);
});

it("does not release an intent that changed during confirmation", async () => {
  const { data, storage, request } = cancelledFixture();
  await sendDurableIntent({ ...request, uuid: () => "old-id", send: async () => ({ run_id: "old-run" }) });
  await expect(retireCancelledLaunch({ ...request, readRun: async id => {
    storage.setItem([...data.keys()][0], "changed");
    return { run: { run_id: id, lifecycle: "CLOSED", closed_outcome: "cancelled" } };
  } })).rejects.toThrow("Command changed");
  expect(data.size).toBe(1);
});

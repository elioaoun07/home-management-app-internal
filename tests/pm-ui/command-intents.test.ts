import { expect, it } from "vitest";
import { sendDurableIntent, storedIntent } from "../../scripts/pm/app/commandIntents";
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

import { afterEach, expect, it, vi } from "vitest";
import { safeFetch } from "../../src/lib/safeFetch";
import { createLocalTransport } from "../../scripts/pm/app/localTransport";
import { PendingCommand, RefusedCommand } from "../../scripts/pm/app/transport";

vi.mock("../../src/lib/safeFetch", () => ({ safeFetch: vi.fn(), RequestTimeoutError: class extends Error {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function client(status: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/session") ? response({ paired: true, actor: "owner", scope: "repo", csrf: "csrf" }) : status()));
  return createLocalTransport();
}

it("reconciles a recorded launch after restart without a POST", async () => {
  const transport = client(async () => response({ recorded: true, outcome: { ok: true, run_id: "original" } }));
  expect(await transport.v2Command("deliver", { command_id: "original-command" })).toEqual({ ok: true, run_id: "original" });
  expect(safeFetch).not.toHaveBeenCalled();
});

it("never redispatches an uncertain command or failed reconciliation", async () => {
  const transport = client(async () => response({ recorded: false }));
  await expect(transport.v2Command("deliver", { command_id: "id" })).rejects.toBeInstanceOf(PendingCommand);
  const incomplete = client(async () => response({ recorded: true, outcome: null }));
  await expect(incomplete.v2Command("deliver", { command_id: "id" })).rejects.toBeInstanceOf(PendingCommand);
  const disconnected = client(async () => { throw new Error("offline"); });
  await expect(disconnected.v2Command("deliver", { command_id: "id" })).rejects.toThrow("offline");
  expect(safeFetch).not.toHaveBeenCalled();
});

it("keeps a lost POST response uncertain and reconciles before retry", async () => {
  let present = false;
  const transport = client(async () => present ? response({ recorded: true, outcome: { ok: true, run_id: "one" } }) : response({ error: "unknown-command" }, 404));
  vi.mocked(safeFetch).mockImplementationOnce(async () => { present = true; throw new Error("response lost"); });
  await expect(transport.v2Command("deliver", { command_id: "id" })).rejects.toBeInstanceOf(PendingCommand);
  expect(await transport.v2Command("deliver", { command_id: "id" })).toEqual({ ok: true, run_id: "one" });
  expect(safeFetch).toHaveBeenCalledTimes(1);
});

it("keeps exact refusal payloads from both Start and a later read-only receipt", async () => {
  const outcome = { ok: false, error: "delivery-not-ready", readiness: { blockers: [{ code: "native-probe-timeout" }] } };
  const transport = client(async () => response({ error: "unknown-command" }, 404));
  vi.mocked(safeFetch).mockResolvedValueOnce(response(outcome, 409));
  const failure = await transport.v2Command("deliver", { command_id: "id" }).catch(error => error);
  expect(failure).toBeInstanceOf(RefusedCommand);
  if (!(failure instanceof RefusedCommand)) throw failure;
  expect(failure.payload).toEqual(outcome);
  const reloaded = client(async () => response({ recorded: true, outcome }));
  await expect(reloaded.v2CommandStatus!("id")).rejects.toMatchObject({ payload: outcome });
  expect(safeFetch).toHaveBeenCalledTimes(1);
});

it("a read-only status check never POSTs even when the receipt is missing", async () => {
  const transport = client(async () => response({ error: "unknown-command" }, 404));
  await expect(transport.v2CommandStatus!("id")).rejects.toBeInstanceOf(PendingCommand);
  expect(safeFetch).not.toHaveBeenCalled();
});

it("surfaces a revoked browser session without marking the laptop offline or retrying writes", async () => {
  const transport = client(async () => response({ error: "local-session-required", detail: "this browser's session is not recognised" }, 401));
  const listener = vi.fn(); transport.subscribe(listener);
  await expect(transport.v2Runs()).rejects.toMatchObject({ status: 401, code: "local-session-required", message: "Pair this browser to view Delivery." });
  expect(listener).toHaveBeenCalledWith({ type: "session", session: { paired: false, actor: null, csrf: null } });
  expect(safeFetch).not.toHaveBeenCalled();
});

it("does not confuse a forbidden operation with lost browser pairing", async () => {
  const transport = client(async () => response({ error: "steward-operation-not-permitted", detail: "Not permitted" }, 403));
  const listener = vi.fn(); transport.subscribe(listener);
  await expect(transport.v2Runs()).rejects.toMatchObject({ status: 403, message: "Not permitted" });
  expect(listener).not.toHaveBeenCalled();
});

it("keeps an authentication refusal bound to the original command, without replay", async () => {
  const transport = client(async () => response({ error: "unknown-command" }, 404));
  const listener = vi.fn(); transport.subscribe(listener);
  vi.mocked(safeFetch).mockResolvedValueOnce(response({ error: "local-session-required", detail: "this browser's session is not recognised" }, 401));
  await expect(transport.v2Command("deliver", { command_id: "original-command" })).rejects.toMatchObject({ status: 401, payload: { error: "local-session-required" } });
  expect(safeFetch).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith({ type: "session", session: { paired: false, actor: null, csrf: null } });
});

it("a late failure from the old session cannot revoke a newly paired browser", async () => {
  let release!: (value: Response) => void;
  const pending = new Promise<Response>(resolve => { release = resolve; });
  const transport = client(() => pending);
  const listener = vi.fn(); transport.subscribe(listener);
  await transport.v2Session();
  const oldRead = transport.v2Runs();
  const paired = { paired: true, actor: "owner", csrf: "new-csrf" };
  vi.mocked(safeFetch).mockResolvedValueOnce(response(paired));
  await expect(transport.v2Pair("ONE-TIME-CODE")).resolves.toEqual(paired);
  release(response({ error: "local-session-required" }, 401));
  await expect(oldRead).rejects.toMatchObject({ status: 401 });
  expect(listener.mock.calls).toEqual([[{ type: "session", session: paired }]]);
  const fetch = vi.mocked(globalThis.fetch);
  fetch.mockResolvedValueOnce(response({ runs: [] }));
  await transport.v2Runs();
  expect(fetch).toHaveBeenLastCalledWith("/api/delivery/v2/runs", expect.objectContaining({ headers: expect.objectContaining({ "x-era-csrf": "new-csrf" }) }));
  expect(safeFetch).toHaveBeenCalledTimes(1); // Pair only; no Delivery command.
});

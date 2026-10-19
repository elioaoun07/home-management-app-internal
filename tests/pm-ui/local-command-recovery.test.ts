import { afterEach, expect, it, vi } from "vitest";
import { safeFetch } from "../../src/lib/safeFetch";
import { createLocalTransport } from "../../scripts/pm/app/localTransport";
import { PendingCommand } from "../../scripts/pm/app/transport";

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

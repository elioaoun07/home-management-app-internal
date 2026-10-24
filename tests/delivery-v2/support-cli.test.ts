// The owner CLI for the support ledger, driven through the real route handler.
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { routeDeliveryV2, setDispatchMode } from "../../scripts/delivery-v2/entry.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { issuePairingCode } from "../../scripts/delivery-v2/local-auth.mjs";
import { createStewardClient } from "../../scripts/delivery-v2/steward-tools.mjs";
import { parseArgs, runSupportCommand } from "../../scripts/delivery-v2/support-cli.mjs";
import type { Loose } from "./fixtures/v2-harness";

const ORIGIN = "http://127.0.0.1:4317";
const AT = "2026-10-24T16:00:00.000Z";
let root: string;
let store: ReturnType<typeof openStore>;

const fetchImpl = (async (url: string, init: Loose = {}) => {
  const target = new URL(url);
  const lower: Record<string, string> = {};
  for (const [key, value] of Object.entries(init.headers || {})) lower[key.toLowerCase()] = String(value);
  const routed = (await routeDeliveryV2(
    { method: init.method || "GET", path: target.pathname, query: target.searchParams, body: init.body ? JSON.parse(init.body) : {}, headers: lower },
    { root, store, allowedOrigins: [ORIGIN], now: () => AT },
  ))!;
  return new Response(JSON.stringify(routed.json), { status: routed.status, headers: { "Content-Type": "application/json", ...(routed.headers || {}) } });
}) as unknown as typeof fetch;

const clientOf = (kind: string, sessionFile: string) => createStewardClient({ root, baseUrl: ORIGIN, fetchImpl, now: () => AT, kind, sessionFile });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "era-support-cli-"));
  store = openStore({ path: join(root, ".delivery", "v2", "supervisor.sqlite"), now: () => AT });
  setDispatchMode({ root, mode: "v2", actor: "owner" });
});
afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

const owner = async () => {
  const client = clientOf("browser", "owner-session.json");
  expect((await runSupportCommand(["pair", issuePairingCode({ root }).code], client)).ok).toBe(true);
  return client;
};

describe("pnpm pm:support", () => {
  it("parses flags and positional arguments", () => {
    expect(parseArgs(["a", "--run", "r-1", "b", "--flag"])).toEqual({ flags: { run: "r-1", flag: "true" }, positional: ["a", "b"] });
  });

  it("authorizes, admits, settles and reports one support job, with unknown cost left unknown", async () => {
    const client = await owner();
    const id = randomUUID();
    const authorized = await runSupportCommand(
      ["authorize", "--run", "r-1", "--purpose", "repair checker setup", "--scope", "scripts/a.mjs,scripts/b.mjs", "--executor", "codex", "--tier", "CODEX_LOW", "--effort", "low", "--tokens", "50000"],
      client,
      { uuid: () => id },
    );
    expect(authorized).toMatchObject({ ok: true });
    expect(authorized.text).toContain("authorization_id=" + id);

    expect((await runSupportCommand(["admit", id, "j-1"], client)).ok).toBe(true);
    const second = await runSupportCommand(["admit", id, "j-2"], client);
    expect(second.ok).toBe(false);
    expect(second.text).toMatch(/support-usage-unknown/u);

    const settled = await runSupportCommand(["settle", id, "j-1", "--file", "settlement.json"], client, {
      readFile: () => JSON.stringify({ usage: { semantics: "per-turn", readings: [{ turn: 0, usage: { input: 4000, cachedInput: 3000, output: 300 } }] }, observed: { model: "gpt-6-luna", effort: "low" }, stop_reason: "completed" }),
    });
    expect(settled.text).toBe("Recorded job j-1: settled");

    const report = await runSupportCommand(["report", "--run", "r-1"], client);
    expect(report.text).toContain("Support 4300 tok · cost unknown · known 1/1");
    expect(report.text).toContain("Chat not measured");
    expect(report.text).toContain("j-1 settled 4300 tok cost unknown gpt-6-luna");
  });

  it("refuses a settlement that cannot be read, and a restricted Steward credential entirely", async () => {
    const client = await owner();
    expect((await runSupportCommand(["settle", "x", "y", "--file", "missing.json"], client, { readFile: () => { throw new Error("ENOENT"); } })).text).toMatch(/--file/u);

    const steward = clientOf("steward", "session.json");
    await steward.pair(issuePairingCode({ root }).code);
    const refused = await runSupportCommand(["authorize", "--run", "r-1", "--purpose", "p", "--scope", "a", "--executor", "codex", "--tier", "T", "--effort", "low", "--tokens", "10"], steward);
    expect(refused.ok).toBe(false);
    expect(refused.text).toContain("steward-operation-not-permitted");
    expect(store.listReceiptsByKind("support-authorization")).toHaveLength(0);
  });

  it("says how to pair when unpaired", async () => {
    const unpaired = clientOf("browser", "owner-session.json");
    expect((await runSupportCommand(["close", "x"], unpaired)).text).toMatch(/pm:pair/u);
  });
});

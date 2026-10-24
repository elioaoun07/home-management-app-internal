// ERA Steward's typed tool surface (sign-off plan, Phase 1): four operations over
// the existing authenticated transport, a server that refuses everything else for
// the Steward credential, and a tool server that cannot be asked for a model or a
// shell. Everything runs offline against the real route handler.
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { routeDeliveryV2, setDispatchMode } from "../../scripts/delivery-v2/entry.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { CSRF_HEADER, SESSION_COOKIE, issuePairingCode, pairSession, sessionView } from "../../scripts/delivery-v2/local-auth.mjs";
import { routePlanning } from "../../scripts/pm/planning.mjs";
import { STEWARD_OPERATIONS, classifyStewardOperation, stewardRoutePermitted } from "../../scripts/delivery-v2/steward-surface.mjs";
import { STEWARD_SCHEMAS, STEWARD_TOOL_DEFINITIONS, createStewardClient, handleStewardOperation } from "../../scripts/delivery-v2/steward-tools.mjs";
import { handleMcpMessage } from "../../scripts/delivery-v2/steward-mcp.mjs";
import { CHECKLIST, ROW, type Loose } from "./fixtures/v2-harness";

const ORIGIN = "http://127.0.0.1:4317";

let root: string;
let store: ReturnType<typeof openStore>;
let at: string;
let delivered: Loose[];
let failNext: { before?: number; after?: number; only?: string };
let fetchLog: { method: string; path: string }[];

const snapshot = () => ({ files: [{ relPath: "Budget/4 - Checklist.md", raw: CHECKLIST }] });
// Any journey method a route calls but this fixture does not model answers { ok: true }.
const fixtureJourney: Loose = new Proxy({
  deliver: async (request: Loose) => {
    delivered.push(request);
    return { ok: true, run_id: "r-fixture" };
  },
  detail: (run_id: string) =>
    run_id === "r-fixture"
      ? { ok: true, run: { run_id, lifecycle: "WAITING", closed_outcome: null, waiting_reason: "plan-review", updated_at: at }, ownerAction: { kind: "approve", label: "Review the plan" }, jobs: [], result: null }
      : { ok: false, refusal: { code: "unknown-run" } },
}, { get: (target: Loose, key: string) => (key in target ? target[key] : async () => ({ ok: true })) });
const context = (extra: Loose = {}) => ({ root, store, allowedOrigins: [ORIGIN], now: () => at, journey: fixtureJourney, ...extra });

/** `fetch` served by the real route handler, with controllable network failure. */
function routeFetch(extra: Loose = {}): typeof fetch {
  return (async (url: string, init: Loose = {}) => {
    const target = new URL(url);
    fetchLog.push({ method: init.method || "GET", path: target.pathname });
    const targeted = !failNext.only || target.pathname === failNext.only;
    if (failNext.before && targeted) {
      failNext.before -= 1;
      throw new TypeError("network down");
    }
    const lower: Record<string, string> = {};
    for (const [key, value] of Object.entries(init.headers || {})) lower[key.toLowerCase()] = String(value);
    let status = 200;
    let json: unknown;
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    if (target.pathname === "/api/data") json = snapshot();
    else {
      const routed = await routeDeliveryV2(
        { method: init.method || "GET", path: target.pathname, query: target.searchParams, body: init.body ? JSON.parse(init.body) : {}, headers: lower },
        context(extra),
      );
      status = routed!.status;
      json = routed!.json;
      headers = { ...headers, ...(routed!.headers || {}) };
    }
    if (failNext.after && targeted) {
      failNext.after -= 1;
      throw new TypeError("reply lost");
    }
    return new Response(JSON.stringify(json), { status, headers });
  }) as unknown as typeof fetch;
}

const newClient = (extra: Loose = {}, options: Loose = {}) =>
  createStewardClient({ root, baseUrl: ORIGIN, fetchImpl: routeFetch(extra), now: () => at, sleep: async () => undefined, ...options });
const pairedClient = async (extra: Loose = {}, options: Loose = {}) => {
  const client = newClient(extra, options);
  const outcome = await client.pair(issuePairingCode({ root }).code);
  expect(outcome.ok).toBe(true);
  return client;
};
const posts = (path: string) => fetchLog.filter((entry) => entry.method === "POST" && entry.path === path).length;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "era-steward-tools-"));
  at = "2026-10-24T10:00:00.000Z";
  delivered = [];
  failNext = {};
  fetchLog = [];
  store = openStore({ path: join(root, ".delivery", "v2", "supervisor.sqlite"), now: () => at });
  setDispatchMode({ root, mode: "v2", actor: "owner" });
});
afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

const ownerHeaders = () => {
  const paired = pairSession({ root, code: issuePairingCode({ root }).code });
  const cookie = SESSION_COOKIE + "=" + paired.token;
  return { origin: ORIGIN, cookie, [CSRF_HEADER]: String(sessionView({ root, headers: { cookie } }).csrf) };
};
const stewardHeaders = () => {
  const paired = pairSession({ root, code: issuePairingCode({ root }).code, kind: "steward" });
  const cookie = SESSION_COOKIE + "=" + paired.token;
  return { origin: ORIGIN, cookie, [CSRF_HEADER]: String(sessionView({ root, headers: { cookie } }).csrf) };
};

describe("the four operations and nothing else", () => {
  it("names exactly four operations, and classifies every other reach by what it asked for", () => {
    expect([...STEWARD_OPERATIONS]).toEqual(["start-delivery", "read-request", "read-run", "wait-for-changes"]);
    for (const name of STEWARD_OPERATIONS) expect(classifyStewardOperation(name)).toEqual({ ok: true });
    expect(classifyStewardOperation("codex")).toMatchObject({ ok: false, code: "generic-delegation-refused" });
    expect(classifyStewardOperation("delegate-agent")).toMatchObject({ code: "generic-delegation-refused" });
    expect(classifyStewardOperation("claude-task")).toMatchObject({ code: "generic-delegation-refused" });
    expect(classifyStewardOperation("bash")).toMatchObject({ code: "shell-execution-refused" });
    expect(classifyStewardOperation("docker")).toMatchObject({ code: "shell-execution-refused" });
    expect(classifyStewardOperation("apply")).toMatchObject({ code: "owner-action-refused" });
    expect(classifyStewardOperation("approve-plan")).toMatchObject({ code: "owner-action-refused" });
    expect(classifyStewardOperation("check-readiness")).toMatchObject({ code: "owner-action-refused" });
    expect(classifyStewardOperation("something-else")).toMatchObject({ code: "unknown-operation" });
  });

  it("keeps the advertised tool list, the input schemas and the route allowlist in step", () => {
    expect(STEWARD_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([...STEWARD_OPERATIONS]);
    expect(Object.keys(STEWARD_SCHEMAS)).toEqual([...STEWARD_OPERATIONS]);
    for (const tool of STEWARD_TOOL_DEFINITIONS) expect(tool.inputSchema.additionalProperties).toBe(false);
    expect(stewardRoutePermitted("POST", "/api/delivery/v2/deliver")).toBe(true);
    expect(stewardRoutePermitted("POST", "/api/delivery/v2/apply")).toBe(false);
    expect(stewardRoutePermitted("GET", "/api/delivery/v2/command")).toBe(true);
  });
});

describe("the server enforces it for the Steward credential", () => {
  it("pairs a restricted session that names the Steward as its actor", async () => {
    const paired = await routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/session/pair", headers: { origin: ORIGIN }, body: { code: issuePairingCode({ root }).code, kind: "steward" } }, context());
    expect(paired?.status).toBe(200);
    expect(paired?.json.actor).toBe("era-steward");
    const owner = await routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/session/pair", headers: { origin: ORIGIN }, body: { code: issuePairingCode({ root }).code } }, context());
    expect(owner?.json.actor).toBe("owner");
  });

  it.each([
    ["POST", "/api/delivery/v2/apply", { run_id: "r", action: "apply", command_id: "c" }],
    ["POST", "/api/delivery/v2/decision", { run_id: "r", decision: "approve" }],
    ["POST", "/api/delivery/v2/answer", {}],
    ["POST", "/api/delivery/v2/message", { run_id: "r", body: "hi" }],
    ["POST", "/api/delivery/v2/control", { action: "refresh-readiness", renewAuthorization: true, command_id: randomUUID() }],
    ["POST", "/api/delivery/v2/control", { run_id: "r", action: "cancel", command_id: "c" }],
    ["POST", "/api/delivery/v2/test-gate", { result: "passed" }],
    ["POST", "/api/delivery/v2/allowances", { action: "top-up" }],
    ["POST", "/api/delivery/v2/mode", { mode: "v1" }],
    ["POST", "/api/delivery/v2/support", { action: "authorize" }],
    ["GET", "/api/delivery/v2/queue", undefined],
    ["GET", "/api/delivery/v2/test-gate", undefined],
    ["GET", "/api/delivery/v2/allowances", undefined],
  ])("refuses %s %s for the Steward but not for the owner", async (method, path, body) => {
    const refused = await routeDeliveryV2({ method, path, headers: stewardHeaders(), body: body as Loose, query: new URLSearchParams() }, context());
    expect(refused?.status).toBe(403);
    expect(refused?.json.error).toBe("steward-operation-not-permitted");
    const owner = await routeDeliveryV2({ method, path, headers: ownerHeaders(), body: body as Loose, query: new URLSearchParams() }, context());
    expect(owner?.json.error).not.toBe("steward-operation-not-permitted");
  });

  it("cannot edit planning with the Steward credential", () => {
    const refused = routePlanning({ headers: stewardHeaders(), body: {} }, { root, pmDir: root, data: {}, allowedOrigins: [ORIGIN] } as unknown as Parameters<typeof routePlanning>[1]);
    expect(refused).toMatchObject({ status: 403, json: { error: "steward-operation-not-permitted" } });
  });

  it("attributes a Steward Start to the Steward even if the caller leaves the label off or claims another", async () => {
    const headers = stewardHeaders();
    const body = { command_id: randomUUID(), file: "Budget/4 - Checklist.md", expectId: "BUD-14", executor: "claude" };
    const started = await routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/deliver", headers, body }, context());
    expect(started?.status).toBe(200);
    expect(store.getReceipt("steward:" + body.command_id)).toMatchObject({ kind: "steward-initiation", actor: "era-steward" });
    const impostor = await routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/deliver", headers, body: { ...body, command_id: randomUUID(), initiatedBy: "owner" } }, context());
    expect(impostor?.status).toBe(409); // same pending item; and the label was overwritten, not trusted
    expect(delivered).toHaveLength(1);
  });

  it("leaves the ordinary owner session exactly as capable as before", async () => {
    const refused = await routeDeliveryV2({ method: "GET", path: "/api/delivery/v2/queue", headers: ownerHeaders(), query: new URLSearchParams() }, context({ journey: { ...fixtureJourney, queue: () => ({ slots: [] }) } }));
    expect(refused?.status).toBe(200);
  });
});

describe("start-delivery", () => {
  it("persists the intent before the request leaves, then returns the run link", async () => {
    const client = await pairedClient();
    let intentSeenBeforePost = false;
    const inner = routeFetch();
    const spy = (async (url: string, init: Loose = {}) => {
      if (init.method === "POST" && String(url).endsWith("/deliver")) {
        const dir = join(root, ".delivery", "v2", "steward", "intents");
        intentSeenBeforePost = existsSync(dir) && readdirSync(dir).length === 1 && JSON.parse(readFileSync(join(dir, readdirSync(dir)[0]), "utf8")).state === "pending";
      }
      return inner(url, init);
    }) as unknown as typeof fetch;
    const spied = createStewardClient({ root, baseUrl: ORIGIN, fetchImpl: spy, now: () => at });
    const result = await spied.startDelivery({ id: "bud-14", executor: "claude" });
    expect(intentSeenBeforePost).toBe(true);
    expect(result).toMatchObject({ ok: true, status: "started", run_id: "r-fixture", link: ORIGIN + "/#/delivery/run/r-fixture" });
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({ file: "Budget/4 - Checklist.md", expectId: "BUD-14", expectLine: ROW, executor: "claude-agent-sdk" });
    expect(client).toBeTruthy();
  });

  it("never mints a second request: a repeated call returns the same run and sends no second Start", async () => {
    const client = await pairedClient();
    const first = await client.startDelivery({ id: "BUD-14", executor: "claude" });
    const again = await client.startDelivery({ id: "BUD-14", executor: "claude" });
    expect(again).toMatchObject({ status: "started", run_id: "r-fixture", request_id: first.request_id });
    expect(posts("/api/delivery/v2/deliver")).toBe(1);
    expect(delivered).toHaveLength(1);
  });

  it("recovers the same receipt after a lost reply, without a second Start", async () => {
    const client = await pairedClient();
    failNext = { after: 1, only: "/api/delivery/v2/deliver" }; // the server processes the Start; the reply never arrives
    const first = await client.startDelivery({ id: "BUD-14", executor: "claude" });
    expect(first).toMatchObject({ ok: false, status: "uncertain" });
    const recovered = await client.startDelivery({ id: "BUD-14", executor: "claude" });
    expect(recovered).toMatchObject({ ok: true, status: "started", run_id: "r-fixture", request_id: first.request_id });
    expect(posts("/api/delivery/v2/deliver")).toBe(1);
    expect(delivered).toHaveLength(1);
  });

  it("resends the SAME request id when the first attempt never reached the server", async () => {
    const client = await pairedClient();
    failNext = { before: 1, only: "/api/delivery/v2/deliver" };
    const first = await client.startDelivery({ id: "BUD-14", executor: "claude" });
    expect(first.status).toBe("uncertain");
    const second = await client.startDelivery({ id: "BUD-14", executor: "claude" });
    expect(second).toMatchObject({ status: "started", request_id: first.request_id });
    expect(delivered).toHaveLength(1);
  });

  it("reports one blocker and never accepts model-supplied permission to retry", async () => {
    const client = await pairedClient({ readiness: async () => ({ ready: false, blockers: [{ gate: "docker", state: "blocked", code: "docker-stopped", detail: "Docker is not running" }] }) });
    const blocked = await client.startDelivery({ id: "BUD-14", executor: "claude" });
    expect(blocked).toMatchObject({ ok: false, status: "blocked", blocker: "docker-stopped" });
    expect(blocked.message).toMatch(/Tell the owner and stop/u);
    const again = await client.startDelivery({ id: "BUD-14", executor: "claude" });
    expect(again).toMatchObject({ ok: false, blocker: "already-refused" });
    expect(posts("/api/delivery/v2/deliver")).toBe(1);

    const fixed = createStewardClient({ root, baseUrl: ORIGIN, fetchImpl: routeFetch({ readiness: async () => ({ ready: true }) }), now: () => at });
    const retried = await fixed.startDelivery({ id: "BUD-14", executor: "claude", owner_confirmed_fix: true });
    expect(retried).toMatchObject({ ok: false, blocker: "already-refused", request_id: blocked.request_id });
    expect(await handleStewardOperation(fixed, "start-delivery", { id: "BUD-14", owner_confirmed_fix: true })).toMatchObject({ status: "invalid-arguments" });
    expect(posts("/api/delivery/v2/deliver")).toBe(1);
    expect(store.getReceipt("steward:" + blocked.request_id)).toBeTruthy();
  });

  it("refuses a second UUID server-side after a recorded refusal, even with retry claims", async () => {
    const headers = stewardHeaders();
    const first = { command_id: randomUUID(), file: "Budget/4 - Checklist.md", expectId: "BUD-14", executor: "claude" };
    const ctx = context({ readiness: async () => ({ ready: false, blockers: [{ code: "docker-stopped" }] }) });
    expect((await routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/deliver", headers, body: first }, ctx))?.status).toBe(409);
    const second = await routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/deliver", headers, body: { ...first, command_id: randomUUID(), owner_confirmed_fix: true } }, context());
    expect(second).toMatchObject({ status: 409, json: { error: "steward-request-conflict", command_id: first.command_id } });
    expect(delivered).toHaveLength(0);
    // The owner's normal launch remains available after fixing the blocker.
    expect((await routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/deliver", headers: ownerHeaders(), body: { ...first, command_id: randomUUID() } }, context()))?.status).toBe(200);
    expect(delivered).toHaveLength(1);
  });

  it("a fresh tool installation cannot launch again for a historical closed run", async () => {
    const original = { command_id: randomUUID(), file: "Budget/4 - Checklist.md", expectId: "BUD-14", executor: "claude" };
    expect((await routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/deliver", headers: ownerHeaders(), body: original }, context()))?.status).toBe(200);
    store.insertRun({ run_id: "r-fixture", work_id: "w-fixture", contract_id: "c-fixture", contract_revision: 1 });
    store.updateRun("r-fixture", { lifecycle: "CLOSED", closed_outcome: "verified_candidate" });
    const client = await pairedClient();
    const status = await client.readRun({ run_id: "r-fixture" });
    expect(status.ok).toBe(true);
    const attempted = await client.startDelivery({ id: "BUD-14", executor: "claude" });
    expect(attempted).toMatchObject({ ok: false, status: "conflict" });
    expect(delivered).toHaveLength(1);
    expect(store.listRuns()).toHaveLength(1);
  });

  it("refuses without a paired Steward credential, and for items it cannot find or tell apart", async () => {
    const unpaired = newClient();
    expect(await unpaired.startDelivery({ id: "BUD-14", executor: "claude" })).toMatchObject({ ok: false, status: "pairing-required" });
    const client = await pairedClient();
    expect(await client.startDelivery({ id: "NOPE-1", executor: "claude" })).toMatchObject({ ok: false, status: "unknown-item" });
    expect(posts("/api/delivery/v2/deliver")).toBe(0);
  });

  it("takes the sole permitted executor and the lane's suggestion, as the launch screen does", async () => {
    const executors = { executors: [{ id: "claude", available: true, permitted: true, suggestions: { focused: { model: "claude-test", effort: "low" } } }, { id: "codex", available: false, permitted: false }] };
    const client = await pairedClient({ describeExecutors: async () => executors });
    const started = await client.startDelivery({ id: "BUD-14" });
    expect(started.ok).toBe(true);
    expect(delivered[0]).toMatchObject({ executor: "claude-agent-sdk", model: "claude-test", effort: "low", workProfile: "focused" });
  });

  it("asks the owner when more than one executor is permitted", async () => {
    const executors = { executors: [{ id: "claude", available: true, permitted: true }, { id: "codex", available: true, permitted: true }] };
    const client = await pairedClient({ describeExecutors: async () => executors });
    expect(await client.startDelivery({ id: "BUD-14" })).toMatchObject({ ok: false, status: "executor-required" });
    expect(posts("/api/delivery/v2/deliver")).toBe(0);
  });
});

describe("reads and waiting", () => {
  it("renders a request and a run as short templates with ids and timestamps", async () => {
    const client = await pairedClient();
    const started = await client.startDelivery({ id: "BUD-14", executor: "claude" });
    const request = await client.readRequest({ request_id: started.request_id });
    expect(request.message).toContain("BUD-14");
    expect(request.message).toContain(started.request_id.slice(0, 8));
    expect(request.message).toContain("confirmed " + at);
    expect(request.message).toContain("run r-fixture");
    const run = await client.readRun({ run_id: "r-fixture" });
    expect(run.message).toContain("run r-fixture · WAITING (plan-review) · owner next: Review the plan");
    expect(run.message).toContain("Delivery 0 tok · cost unknown");
    expect(run.message).toContain("Chat not measured");
    expect(posts("/api/delivery/v2/deliver")).toBe(1);
    expect(await client.readRun({ run_id: "r-missing" })).toMatchObject({ ok: false, status: "unknown-run" });
  });

  it("keeps the last confirmed result and says it is stale when the connection drops; it never starts or repairs", async () => {
    const client = await pairedClient();
    const started = await client.startDelivery({ id: "BUD-14", executor: "claude" });
    await client.readRun({ run_id: "r-fixture" });
    const before = posts("/api/delivery/v2/deliver");
    at = "2026-10-24T10:30:00.000Z";
    failNext = { before: 100 };
    const stale = await client.readRun({ run_id: "r-fixture" });
    expect(stale).toMatchObject({ ok: true, stale: true, last_confirmed_at: "2026-10-24T10:00:00.000Z" });
    expect(stale.message).toMatch(/stale since 2026-10-24T10:00:00.000Z/u);
    const staleRequest = await client.readRequest({ request_id: started.request_id });
    expect(staleRequest.stale).toBe(true);
    const never = await client.waitForChanges({ run_id: "r-never-read", timeout_seconds: 1 });
    expect(never).toMatchObject({ ok: false, stale: true, changed: false });
    expect(posts("/api/delivery/v2/deliver")).toBe(before);
    expect(delivered).toHaveLength(1);
  });

  it("renders the real Applied owner-action shape", async () => {
    const client = await pairedClient({ journey: { ...fixtureJourney, detail: () => ({ ok: true, run: { run_id: "r-fixture", lifecycle: "CLOSED", closed_outcome: "verified_candidate" }, ownerAction: { kind: "none", label: "Applied" }, jobs: [] }) } });
    const view = await client.readRun({ run_id: "r-fixture" });
    expect(view.message).toContain("owner next: Applied");
    expect(view.message).not.toContain("[object Object]");
  });

  it("wakes on a change and gives up quietly at the deadline", async () => {
    let clock = 0;
    const client = await pairedClient({}, { nowMs: () => clock, sleep: async (ms: number) => { clock += ms; } });
    const first = await client.waitForChanges({ run_id: "r-fixture", timeout_seconds: 5 });
    expect(first).toMatchObject({ ok: true, changed: false });
    const quiet = await client.waitForChanges({ run_id: "r-fixture", since: first.token, timeout_seconds: 5 });
    expect(quiet).toMatchObject({ changed: false, token: first.token });
    expect(clock).toBeGreaterThanOrEqual(5000);

    fixtureJourney.detail = ((original) => (run_id: string) => {
      const view = original(run_id) as Loose;
      return view.ok ? { ...view, run: { ...view.run, waiting_reason: "checking" }, ownerAction: "Await checks" } : view;
    })(fixtureJourney.detail);
    const changed = await client.waitForChanges({ run_id: "r-fixture", since: first.token, timeout_seconds: 5 });
    expect(changed).toMatchObject({ changed: true });
    expect(changed.token).not.toBe(first.token);
  });

  it("validates arguments before any request is made", async () => {
    const client = await pairedClient();
    const before = fetchLog.length;
    expect(await handleStewardOperation(client, "read-run", { run_id: "../etc" })).toMatchObject({ ok: false, status: "invalid-arguments" });
    expect(await handleStewardOperation(client, "wait-for-changes", {})).toMatchObject({ ok: false, status: "invalid-arguments" });
    expect(await handleStewardOperation(client, "wait-for-changes", { run_id: "r-fixture", request_id: randomUUID() })).toMatchObject({ ok: false, status: "invalid-arguments" });
    expect(await handleStewardOperation(client, "start-delivery", { id: "BUD-14", shell: "rm -rf" })).toMatchObject({ ok: false, status: "invalid-arguments" });
    expect(fetchLog.length).toBe(before);
  });
});

describe("the tool server", () => {
  const rpc = (client: Loose, method: string, params: Loose = {}, id: number | null = 1) => handleMcpMessage(client, { jsonrpc: "2.0", id, method, params } as Loose);

  it("advertises exactly the four tools", async () => {
    const client = await pairedClient();
    const listed = (await rpc(client, "tools/list"))!.result as Loose;
    expect(listed.tools.map((tool: Loose) => tool.name)).toEqual([...STEWARD_OPERATIONS]);
    expect((await rpc(client, "initialize", { protocolVersion: "2025-03-26" }))!.result).toMatchObject({ protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "era-steward-tools" } });
    expect(await rpc(client, "notifications/initialized", {}, null)).toBeNull();
    expect((await rpc(client, "nope"))!.error!.code).toBe(-32601);
  });

  it.each([
    ["codex", "generic-delegation-refused"],
    ["claude", "generic-delegation-refused"],
    ["run-agent-task", "generic-delegation-refused"],
    ["shell", "shell-execution-refused"],
    ["powershell", "shell-execution-refused"],
    ["apply", "owner-action-refused"],
    ["approve-plan", "owner-action-refused"],
  ])("refuses a call to %s without touching the network", async (name, code) => {
    const client = await pairedClient();
    const before = fetchLog.length;
    const reply = (await rpc(client, "tools/call", { name, arguments: { command: "whoami" } }))!.result as Loose;
    expect(reply.isError).toBe(true);
    expect(reply.content[0].text).toContain(code);
    expect(fetchLog.length).toBe(before);
    expect(delivered).toHaveLength(0);
  });

  it("runs an allowed tool end to end", async () => {
    const client = await pairedClient();
    const reply = (await rpc(client, "tools/call", { name: "start-delivery", arguments: { id: "BUD-14", executor: "claude" } }))!.result as Loose;
    expect(reply.isError).toBe(false);
    expect(reply.content[0].text).toContain("r-fixture");
  });

  it("stores only the session token, under the gitignored .delivery tree", async () => {
    await pairedClient();
    const stored = JSON.parse(readFileSync(join(root, ".delivery", "v2", "steward", "session.json"), "utf8"));
    expect(Object.keys(stored).sort()).toEqual(["base", "paired_at", "token"]);
  });
});

import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { routeDeliveryV2, setDispatchMode } from "../../scripts/delivery-v2/entry.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { CSRF_HEADER, SESSION_COOKIE, issuePairingCode, pairSession, sessionView } from "../../scripts/delivery-v2/local-auth.mjs";
import { listStewardRequests } from "../../scripts/delivery-v2/steward-requests.mjs";
import { journeyFor, makeHarness, seedRoot, SELECT, writePolicy } from "./fixtures/v2-harness";

it("reconciles one launch across disconnect, cancellation and a fresh launch without duplicating jobs or changing old receipts", async () => {
  const root = mkdtempSync(join(tmpdir(), "era-launch-cancel-"));
  seedRoot(root);
  writePolicy(root);
  const store = openStore({ path: join(root, ".delivery/v2/supervisor.sqlite") });
  const harness = makeHarness(root);
  const journey = journeyFor({ root, data: join(root, ".delivery/v2"), store, harness });
  try {
    setDispatchMode({ root, mode: "v2", actor: "owner" });
    const paired = pairSession({ root, code: issuePairingCode({ root }).code });
    const cookie = SESSION_COOKIE + "=" + paired.token;
    const headers = { origin: "http://127.0.0.1:4317", cookie, [CSRF_HEADER]: String(sessionView({ root, headers: { cookie } }).csrf) };
    const context = { root, store, journey, allowedOrigins: [headers.origin], stewardRequests: () => listStewardRequests(store, 180000) };
    const send = (path: string, body: Record<string, unknown>) => routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/" + path, body, headers }, context);
    const read = (path: string, id?: string) => routeDeliveryV2({ method: "GET", path: "/api/delivery/v2/" + path, headers, query: new URLSearchParams(id ? { id } : {}) }, context);
    const launch = { ...SELECT, command_id: randomUUID(), executor: "claude", model: "claude-test", effort: "low", workProfile: "focused" };
    const first = await send("deliver", launch);
    expect(first?.status).toBe(200);
    const runId = String(first!.json.run_id);
    await journey.idle();
    // A dropped reply is recovered with GET; a repeated POST returns its old result.
    expect((await read("command", launch.command_id))?.json.outcome).toEqual(first!.json);
    expect((await send("deliver", launch))?.json).toEqual(first!.json);
    expect((await send("deliver", { ...launch, command_id: randomUUID() }))?.json.error).toBe("launch-request-conflict");
    expect(store.listJobs(runId)).toHaveLength(1);
    expect(harness.calls).toHaveLength(1);
    const priorReceipt = store.getReceipt("launch:" + launch.command_id);
    const stopped = await send("control", { run_id: runId, action: "stop", command_id: randomUUID() });
    expect(stopped?.json).toMatchObject({ ok: true, closed: true });
    const detail = (await read("run", runId))!.json;
    expect(detail.run).toMatchObject({ lifecycle: "CLOSED", closed_outcome: "cancelled" });
    expect(detail.ownerAction).toMatchObject({ kind: "none", label: "Cancelled" });
    expect(store.listOutstandingJobs()).toEqual([]);
    expect(store.listJobs(runId).every((job: { status: string; reservation_open: number }) => job.status === "finished" && !job.reservation_open)).toBe(true);
    const summaries = (await read("runs"))!.json;
    expect(summaries.runs.find((run: { run_id: string }) => run.run_id === runId)).toMatchObject({ closed_outcome: "cancelled", active: false });
    expect(summaries.requests[0]).toMatchObject({ run_id: runId, terminal: true, stage: "closed", status: "cancelled" });
    expect((await read("command", launch.command_id))!.json.request).toMatchObject({ run_id: runId, terminal: true, status: "cancelled" });
    const fresh = await send("deliver", { ...launch, command_id: randomUUID() });
    expect(fresh?.status).toBe(200);
    expect(fresh!.json.run_id).not.toBe(runId);
    await journey.idle();
    expect(harness.calls).toHaveLength(2); // exactly one plan per explicit launch; no build or repair
    expect(store.listAllJobs()).toHaveLength(2);
    expect(store.getReceipt("launch:" + launch.command_id)).toEqual(priorReceipt);
    expect((await read("command", launch.command_id))!.json.outcome).toEqual(first!.json);
    expect((await read("run", String(fresh!.json.run_id)))!.json.ownerAction.kind).toBe("review-plan");
    expect(store.listDecisions(String(fresh!.json.run_id))).toEqual([]);
  } finally {
    await journey.idle();
    store.close();
    for (const path of harness.workspaces.values()) rmSync(path, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

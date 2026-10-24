import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  routeDeliveryV2,
  setDispatchMode,
} from "../../scripts/delivery-v2/entry.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { createDeliveryV2Context } from "../../scripts/delivery-v2/service.mjs";
import {
  CSRF_HEADER,
  SESSION_COOKIE,
  issuePairingCode,
  pairSession,
  sessionView,
} from "../../scripts/delivery-v2/local-auth.mjs";
import {
  acceptStewardRequest,
  listStewardRequests,
  stewardCommandState,
  stewardStaleMs,
  updateStewardRequest,
} from "../../scripts/delivery-v2/steward-requests.mjs";
import {
  createCommandJournal,
  reconcileClaimedCommand,
} from "../../scripts/pm/relay.mjs";
import type { StewardRequest } from "../../scripts/pm/app/types";

let root: string, store: ReturnType<typeof openStore>, at: string;
let headers: Record<string, string>;
const body = () => ({
  initiatedBy: "era-steward",
  command_id: randomUUID(),
  file: "Delivery/4 - Checklist.md",
  expectId: "DLV-140",
  executor: "codex",
});
const requests = (): StewardRequest[] => listStewardRequests(store, 180000);
const context = () => ({
  root,
  store,
  allowedOrigins: ["http://127.0.0.1:4317"],
  now: () => at,
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "era-steward-fixture-"));
  at = "2026-10-20T10:00:00.000Z";
  store = openStore({
    path: join(root, ".delivery", "v2", "supervisor.sqlite"),
    now: () => at,
  });
  setDispatchMode({ root, mode: "v2", actor: "owner" });
  const paired = pairSession({ root, code: issuePairingCode({ root }).code });
  const cookie = SESSION_COOKIE + "=" + paired.token;
  headers = {
    origin: "http://127.0.0.1:4317",
    cookie,
    [CSRF_HEADER]: String(sessionView({ root, headers: { cookie } }).csrf),
  };
});
afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

describe("durable Steward initiation through the real Start entry", () => {
  it("allows a fresh request after confirmed cancellation while preserving the old receipt and outcome", () => {
    const original = body();
    acceptStewardRequest(store, original, "owner", at);
    store.insertRun({ run_id: "r-cancelled", work_id: "w-fixture", contract_id: "c-fixture", contract_revision: 1 });
    updateStewardRequest(store, original.command_id, "run-created", at, { ok: true, run_id: "r-cancelled" });
    const before = store.getReceipt("steward:" + original.command_id);
    const next = body();
    expect(acceptStewardRequest(store, next, "owner", at)).toMatchObject({ conflict: true, command_id: original.command_id });
    store.updateRun("r-cancelled", { lifecycle: "CLOSED", closed_outcome: "cancelled" });
    expect(acceptStewardRequest(store, next, "owner", at)).toMatchObject({ created: true });
    expect(store.getReceipt("steward:" + original.command_id)).toEqual(before);
    expect(stewardCommandState(store, original.command_id, 180000)).toMatchObject({ recorded: true, outcome: { ok: true, run_id: "r-cancelled" }, request: { terminal: true, status: "cancelled" } });
    expect(requests()).toHaveLength(2);
    expect(store.listAllJobs()).toHaveLength(0);
  });

  it("commits acceptance before readiness and retains a prelaunch blocker without a run", async () => {
    const request = body();
    const response = await routeDeliveryV2(
      {
        method: "POST",
        path: "/api/delivery/v2/deliver",
        headers,
        body: request,
      },
      {
        ...context(),
        readiness: async () => {
          expect(requests()[0]).toMatchObject({
            command_id: request.command_id,
            initiatedBy: "ERA Steward",
            stage: "readiness",
            acceptedAt: at,
          });
          expect(store.listRuns()).toHaveLength(0);
          return {
            ready: false,
            blockers: [
              { gate: "policy", state: "blocked", code: "grant-expired" },
            ],
          };
        },
      },
    );
    expect(response?.status).toBe(409);
    expect(requests()[0]).toMatchObject({
      status: "blocked",
      run_id: null,
      blocker: { code: "delivery-not-ready" },
      stage: "blocked",
    });
    const evidence = requests()[0].evidence;
    const repeated = await routeDeliveryV2(
      {
        method: "POST",
        path: "/api/delivery/v2/deliver",
        headers,
        body: request,
      },
      context(),
    );
    expect(repeated?.status).toBe(409);
    expect(requests()).toHaveLength(1);
    expect(requests()[0].evidence).toEqual(evidence);
    expect(store.listAllJobs()).toHaveLength(0);
  });

  it("records mode, executor and missing-policy failures before a run exists", async () => {
    for (const failure of ["mode", "executor", "policy"]) {
      setDispatchMode({
        root,
        mode: failure === "mode" ? "v1" : "v2",
        actor: "owner",
      });
      const request = {
        ...body(),
        ...(failure === "executor" ? { executor: "absent" } : {}),
      };
      const result = await routeDeliveryV2(
        {
          method: "POST",
          path: "/api/delivery/v2/deliver",
          headers,
          body: request,
        },
        context(),
      );
      expect(result?.status).toBe(409);
      expect(
        requests().find((row) => row.command_id === request.command_id)?.blocker
          ?.code,
      ).toMatch(/dispatch-disabled|unknown-executor|no-deliver-policy/);
    }
    expect(requests()).toHaveLength(3);
    expect(store.listRuns()).toHaveLength(0);
  });

  it("does not re-enter readiness or admission for concurrent or duplicate initiation", async () => {
    let release!: () => void,
      calls = 0;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const request = body();
    const ctx = {
      ...context(),
      readiness: async () => {
        await wait;
        return { ready: true };
      },
      journey: {
        deliver: async () => {
          calls++;
          return { ok: true, run_id: "r-fixture" };
        },
      },
    };
    const send = (payload = request) =>
      routeDeliveryV2(
        {
          method: "POST",
          path: "/api/delivery/v2/deliver",
          headers,
          body: payload,
        },
        ctx,
      );
    const first = send();
    expect((await send())?.json.refusals[0].code).toBe(
      "command-without-recorded-outcome",
    );
    expect(
      (await send({ ...request, command_id: randomUUID() }))?.json.error,
    ).toBe("steward-request-conflict");
    expect((await send({ ...request, executor: "claude" }))?.json.error).toBe(
      "steward-request-conflict",
    );
    release();
    expect((await first)?.json.run_id).toBe("r-fixture");
    expect((await send())?.json.run_id).toBe("r-fixture");
    expect(calls).toBe(1);
    expect(requests()).toHaveLength(1);
  });

  it("keeps an exception uncertain, survives restart, and never automatically retries", async () => {
    const request = body();
    let calls = 0;
    const ctx = {
      ...context(),
      readiness: async () => {
        throw new Error("fixture collector unavailable");
      },
    };
    expect(
      (
        await routeDeliveryV2(
          {
            method: "POST",
            path: "/api/delivery/v2/deliver",
            headers,
            body: request,
          },
          ctx,
        )
      )?.status,
    ).toBe(503);
    const path = store.path;
    store.close();
    store = openStore({ path, now: () => at });
    at = "2026-10-20T11:00:00.000Z";
    const repeated = await routeDeliveryV2(
      {
        method: "POST",
        path: "/api/delivery/v2/deliver",
        headers,
        body: request,
      },
      {
        ...context(),
        readiness: async () => {
          calls++;
          return { ready: true };
        },
      },
    );
    expect(repeated?.json.refusals[0].code).toBe(
      "command-without-recorded-outcome",
    );
    expect(calls).toBe(0);
    expect(requests()[0]).toMatchObject({
      stage: "reconciliation-required",
      status: "pending",
      blocker: null,
      lastConfirmedAt: "2026-10-20T10:00:00.000Z",
    });
  });

  it("recovers a committed launch after a lost response without evaluating runtime or readiness", async () => {
    const request = body();
    await routeDeliveryV2(
      {
        method: "POST",
        path: "/api/delivery/v2/deliver",
        headers,
        body: request,
      },
      {
        ...context(),
        journey: {
          deliver: async () => {
            store.admitCommand({
              command_id: request.command_id,
              kind: "Deliver",
              actor: sessionView({ root, headers }).actor!,
              payload: request,
              subject_id: "r-original",
            });
            store.recordCommandOutcome(request.command_id, {
              ok: true,
              run_id: "r-original",
            });
            throw new Error("reply lost");
          },
        },
      },
    );
    const service = createDeliveryV2Context({
      ROOT: root,
      port: 4317,
      openStore: () => store,
      runtimeFactory: () => {
        throw new Error("must not construct a runtime");
      },
      journeyFactory: () => {
        throw new Error("must not construct a journey");
      },
    });
    expect(service.stewardRequests()).toEqual([]); // Publication never opens a store.
    const response = await routeDeliveryV2(
      {
        method: "GET",
        path: "/api/delivery/v2/command",
        query: new URLSearchParams({ id: request.command_id }),
        headers,
      },
      service,
    );
    expect(response?.json).toMatchObject({
      recorded: true,
      outcome: { run_id: "r-original" },
      request: { command_id: request.command_id },
    });
    expect(service.stewardCommandState(request.command_id)).toMatchObject({
      recorded: true,
      outcome: { run_id: "r-original" },
    });
    expect(service.stewardRequests()).toMatchObject([
      { command_id: request.command_id, run_id: "r-original" },
    ]);
  });

  it("validates the attributed entry and uses the authenticated actor", async () => {
    const request = body();
    expect(
      (
        await routeDeliveryV2(
          { method: "POST", path: "/api/delivery/v2/deliver", body: request },
          context(),
        )
      )?.status,
    ).toBe(401);
    expect(
      (
        await routeDeliveryV2(
          {
            method: "POST",
            path: "/api/delivery/v2/deliver",
            headers,
            body: { ...request, command_id: "invalid" },
          },
          context(),
        )
      )?.status,
    ).toBe(400);
    expect(requests()).toEqual([]);
    acceptStewardRequest(store, request, "original-actor", at);
    expect(acceptStewardRequest(store, request, "different-actor", at)).toEqual(
      { conflict: true },
    );
    expect(
      (
        await routeDeliveryV2(
          {
            method: "GET",
            path: "/api/delivery/v2/command",
            query: new URLSearchParams({ id: request.command_id }),
            headers,
          },
          context(),
        )
      )?.status,
    ).toBe(404);
  });
});

describe("observations are separate from job truth", () => {
  it("keeps job progress separate from a silent coordinator and never renews its timestamp", () => {
    const request = body();
    acceptStewardRequest(store, request, "owner", at);
    store.insertRun({
      run_id: "r-progress",
      work_id: "w-fixture",
      contract_id: "c-fixture",
      contract_revision: 1,
    });
    updateStewardRequest(store, request.command_id, "run-created", at, {
      ok: true,
      run_id: "r-progress",
    });
    at = "2026-10-20T10:10:00.000Z";
    store.updateRun("r-progress", { waiting_reason: "checking" });
    expect(requests()[0]).toMatchObject({
      status: "checking",
      stage: "checking",
      terminal: false,
      lastConfirmedAt: "2026-10-20T10:00:00.000Z",
      jobUpdatedAt: at,
      blocker: null,
    });
    expect(store.getRun("r-progress")?.lifecycle).toBe("DRAFT");
    expect(store.listAllJobs()).toHaveLength(0);
  });

  it.each(["completed", "failed", "cancelled"])(
    "preserves terminal %s and evidence after silence and late coordination",
    (outcome) => {
      const request = body();
      acceptStewardRequest(store, request, "owner", at);
      store.insertRun({
        run_id: "r-terminal",
        work_id: "w-fixture",
        contract_id: "c-fixture",
        contract_revision: 1,
      });
      updateStewardRequest(store, request.command_id, "run-created", at, {
        ok: true,
        run_id: "r-terminal",
      });
      at = "2026-10-20T10:00:15.000Z";
      store.updateRun("r-terminal", {
        lifecycle: "CLOSED",
        closed_outcome: outcome,
      });
      store.appendRunEvent("r-terminal", "run.closed");
      store.putResult({
        result_id: "result-fixture",
        result_version: 1,
        run_id: "r-terminal",
        projection_status: "current",
      });
      updateStewardRequest(
        store,
        request.command_id,
        "failed",
        "2026-10-20T11:00:00.000Z",
        { ok: false, error: "late coordinator" },
      );
      expect(requests()[0]).toMatchObject({
        status: outcome,
        stage: "closed",
        terminal: true,
        blocker: null,
        lastConfirmedAt: "2026-10-20T10:00:00.000Z",
        jobUpdatedAt: at,
        result: { result_id: "result-fixture" },
        runEvidence: { kind: "run.closed" },
      });
      const before = store.db.prepare("SELECT total_changes() AS n").get();
      requests();
      requests();
      expect(store.db.prepare("SELECT total_changes() AS n").get()).toEqual(
        before,
      );
    },
  );

  it("reconciles a prelaunch refusal through the existing relay journal, but never executes an interrupted request", () => {
    const request = body();
    acceptStewardRequest(store, request, "owner", at);
    const journal = createCommandJournal({ dir: root });
    const cmd = { id: request.command_id, type: "v2-deliver" };
    journal.record(cmd.id, "claimed");
    journal.record(cmd.id, "started");
    const reader = {
      commandState: (id: string) => stewardCommandState(store, id, 180000),
    };
    expect(reconcileClaimedCommand(cmd, journal, reader).action).toBe(
      "unknown",
    );
    updateStewardRequest(store, cmd.id, "blocked", at, {
      ok: false,
      error: "delivery-not-ready",
    });
    expect(reconcileClaimedCommand(cmd, journal, reader)).toMatchObject({
      action: "report",
      outcome: { ok: false, error: "delivery-not-ready" },
    });
  });

  it("bounds stale configuration and retains the recorded timestamp across passive reads", () => {
    for (const value of [
      undefined,
      "invalid",
      "0",
      "-1",
      "999999999",
      "Infinity",
    ])
      expect(stewardStaleMs(value)).toBe(180000);
    expect(stewardStaleMs("5000")).toBe(5000);
    acceptStewardRequest(store, body(), "owner", at);
    at = "2026-10-21T10:00:00.000Z";
    expect(requests()[0].lastConfirmedAt).toBe("2026-10-20T10:00:00.000Z");
  });
});

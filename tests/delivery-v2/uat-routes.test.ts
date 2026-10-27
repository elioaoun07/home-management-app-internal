// DLV-145 — the HTTP surface: only the paired owner session reaches the UAT
// record; the actor is the session's, never the body's; a run's identity comes
// from the supervisor, not the request.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { routeDeliveryV2 } from "../../scripts/delivery-v2/entry.mjs";
import { CSRF_HEADER, SESSION_COOKIE, issuePairingCode, pairSession, sessionView } from "../../scripts/delivery-v2/local-auth.mjs";
import { readUat } from "../../scripts/delivery-v2/uat.mjs";

type Loose = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const ORIGIN = "http://127.0.0.1:4317";
const NOW = "2026-10-25T10:00:00.000Z";
let ROOT: string;
let detail: Loose;
let identity: Loose | null;

beforeEach(() => {
  identity = null;
  ROOT = mkdtempSync(join(tmpdir(), "era-uat-routes-"));
  detail = {
    ok: true,
    run: { lifecycle: "CLOSED", closed_outcome: "verified" },
    work: { title: "Remove a pending split", alias: "BUD-83", campaign: "Budget", file: "Budget/4 - Checklist.md" },
    contract: { revision: 3 },
    plans: [{ revision: 2 }],
    candidate: { candidate_id: "cand-1", generation: "g1" },
    result: { result_version: 1 },
    applications: [{ state: "applied" }],
  };
});
afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

function session(kind: "browser" | "steward") {
  const { code } = issuePairingCode({ root: ROOT });
  const paired: Loose = pairSession({ root: ROOT, code, kind });
  const cookie = SESSION_COOKIE + "=" + paired.token;
  const csrf = String(sessionView({ root: ROOT, headers: { cookie } }).csrf);
  return { origin: ORIGIN, "sec-fetch-site": "same-origin", cookie, [CSRF_HEADER]: csrf, "x-era-actor": "mallory" };
}
const ctx = () => ({ root: ROOT, allowedOrigins: [ORIGIN], now: () => NOW, hasStore: () => true, sourceIdentity: () => { if (!identity) throw new Error("no git"); return identity; }, journey: { detail: (id: string) => (id === "r-aaaaaaaaaaaa" ? detail : { ok: false }) } });
const call = (headers: Loose, method: string, body?: Loose, query = "") =>
  routeDeliveryV2({ method, path: "/api/delivery/v2/uat", query: new URLSearchParams(query), body: body ?? {}, headers }, ctx() as Loose) as Promise<Loose>;
const get = (headers: Loose, query = "") => call(headers, "GET", undefined, query);
const post = (headers: Loose, body: Loose) => call(headers, "POST", body);

const content = {
  summary: "Split removal",
  scenarios: [
    { id: "M1", title: "Remove the tag", criteria: ["AC-1"], steps: [{ action: "Open Activity.", expected: "The list appears." }, { action: "Uncheck Split.", expected: "An Undo toast shows." }] },
  ],
};

describe("authority", () => {
  it("refuses an anonymous client, forged actor and the Steward credential on every UAT verb", async () => {
    const anonymous = { "sec-fetch-site": "same-origin", "x-era-actor": "owner" };
    expect((await get(anonymous)).status).toBe(401);
    expect((await post(anonymous, { action: "signoff", handover_id: "uat-x", revision: 1, command_id: "c" })).status).toBe(401);
    const steward = session("steward");
    expect((await get(steward)).status).toBe(403);
    for (const action of ["signoff", "result", "feedback"]) expect((await post(steward, { action })).status).toBe(403);
    expect(readUat({ root: ROOT }).receipts).toHaveLength(0);
  });

  it("records the session's actor, not the one the request names", async () => {
    const owner = session("browser");
    const imported = await post(owner, { action: "import", delivery_ref: "docs/a.md#b", work_id: "BUD-83", campaign: "Budget", content, source_revision: "735d3881", ready: true, actor: "mallory" });
    expect(imported.status).toBe(200);
    const handover = imported.json.handover;
    const result = await post(owner, { action: "result", handover_id: handover.handover_id, revision: 1, scenario_id: "M1", result: "pass", command_id: "c-1", actor: "mallory" });
    expect(result.json.receipt.actor).toBe("owner");
  });
});

describe("handover lifecycle over HTTP", () => {
  it("lists a slim view, reads one in full, and refuses malformed or stale input", async () => {
    const owner = session("browser");
    const imported = await post(owner, { action: "import", delivery_ref: "docs/a.md#b", work_id: "BUD-83", campaign: "Budget", content });
    const id = imported.json.handover.handover_id;
    const list = await get(owner);
    expect(list.json.handovers).toHaveLength(1);
    expect(list.json.handovers[0].scenarios[0]).toEqual({ id: "M1", title: "Remove the tag", required: true, result: "pending", draft: false, steps: 2 });
    const full = await get(owner, "id=" + id);
    expect(full.json.handover.scenarios[0].steps).toHaveLength(2);
    expect((await get(owner, "id=uat-nope")).status).toBe(404);
    expect((await post(owner, { action: "result", handover_id: id, revision: 1, scenario_id: "M1", result: "maybe", command_id: "c" })).status).toBe(400);
    expect((await post(owner, { action: "unknown" })).status).toBe(400);
    expect((await post(owner, { action: "result", handover_id: id, revision: 1, scenario_id: "M1", result: "fail", command_id: "c-2" })).status).toBe(400);
    expect((await post(owner, { action: "result", handover_id: id, revision: 7, scenario_id: "M1", result: "pass", command_id: "c-3" })).status).toBe(409);
    expect((await post(owner, { action: "result", handover_id: "uat-nope", revision: 1, scenario_id: "M1", result: "pass", command_id: "c-4" })).status).toBe(404);
  });

  it("a direct delivery needs an exact revision to be ready, then the owner's attestation and PASS to be signed", async () => {
    const owner = session("browser");
    const id = (await post(owner, { action: "import", delivery_ref: "docs/a.md#b", work_id: "BUD-83", campaign: "Budget", content, environment: { target: "hosted" } })).json.handover.handover_id;
    // No revision given and the checkout cannot be read: refused, not guessed. A loose name is not a revision.
    expect((await post(owner, { action: "ready", handover_id: id })).status).toBe(409);
    expect((await post(owner, { action: "ready", handover_id: id, source_revision: "main" })).status).toBe(400);
    // Results need a ready handover.
    expect((await post(owner, { action: "result", handover_id: id, revision: 1, scenario_id: "M1", result: "pass", command_id: "c-0" })).json.refusals[0].code).toBe("handover-draft");
    const ready = await post(owner, { action: "ready", handover_id: id, source_revision: "735d3881" });
    expect(ready.json.handover).toMatchObject({ status: "ready", revision: 2, binding: { kind: "source", source_revision: "735d3881" } });
    await post(owner, { action: "result", handover_id: id, revision: 2, scenario_id: "M1", result: "pass", command_id: "c-5" });
    const blocked = await post(owner, { action: "signoff", handover_id: id, revision: 2, command_id: "c-6" });
    expect(blocked.status).toBe(409);
    expect(blocked.json.refusals.map((r: Loose) => r.code)).toEqual(["not-available"]);
    await post(owner, { action: "availability", handover_id: id, revision: 2, available: true, build: "735d3881", command_id: "c-7" });
    const signed = await post(owner, { action: "signoff", handover_id: id, revision: 2, command_id: "c-8" });
    expect(signed.json).toMatchObject({ ok: true, handover: { acceptance: { state: "accepted", shipped: true }, signoff: { actor: "owner" } } });
  });

  it("binds a direct delivery to the checkout's own identity when no revision is given", async () => {
    const owner = session("browser");
    const id = (await post(owner, { action: "import", delivery_ref: "docs/a.md#b", work_id: "BUD-83", campaign: "Budget", content })).json.handover.handover_id;
    identity = { source_revision: "abcdef1234567", files_digest: "d".repeat(64), changed: 3 };
    const ready = await post(owner, { action: "ready", handover_id: id });
    expect(ready.json.handover.binding).toMatchObject({ kind: "source", source_revision: "abcdef1234567", files_digest: "d".repeat(64) });
  });

  it("takes a run's identity from the supervisor, binds its candidate, and goes stale on a replacement", async () => {
    const owner = session("browser");
    const imported = await post(owner, { action: "import", run_id: "r-aaaaaaaaaaaa", work_id: "SCH-1", campaign: "Schedule", title: "Spoofed", content, ready: true });
    expect(imported.json.handover).toMatchObject({ status: "ready", subject: { run_id: "r-aaaaaaaaaaaa", work_id: "BUD-83", campaign: "Budget", title: "Remove a pending split" }, binding: { candidate_id: "cand-1", result_version: 1, plan_revision: 2, contract_revision: 3 }, availability: { state: "available" }, stale: false });
    const id = imported.json.handover.handover_id;
    expect((await post(owner, { action: "import", run_id: "r-unknown", content })).status).toBe(404);
    await post(owner, { action: "result", handover_id: id, revision: 1, scenario_id: "M1", result: "pass", command_id: "c-9" });
    detail.candidate = { candidate_id: "cand-2", generation: "g2" };
    const stale = await post(owner, { action: "signoff", handover_id: id, revision: 1, command_id: "c-10" });
    expect(stale.json.refusals.map((r: Loose) => r.code)).toEqual(["stale-candidate"]);
    expect((await get(owner, "id=" + id)).json.handover).toMatchObject({ stale: true, acceptance: { state: "superseded" } });
    detail.candidate = { candidate_id: "cand-1", generation: "g1" };
    expect((await post(owner, { action: "signoff", handover_id: id, revision: 1, command_id: "c-11" })).json).toMatchObject({ ok: true, handover: { acceptance: { shipped: true } } });
  });

  it("saves feedback with a stable command id and shows it as saved until the importer commits it", async () => {
    const owner = session("browser");
    const id = (await post(owner, { action: "import", run_id: "r-aaaaaaaaaaaa", content, ready: true })).json.handover.handover_id;
    const body = { action: "feedback", handover_id: id, revision: 1, scenario_id: "M1", step: 2, classification: "bug", observation: "No Undo toast", command_id: "fb-1" };
    const first = await post(owner, body);
    const again = await post(owner, body);
    expect(first.json.handover.feedback).toHaveLength(1);
    expect(again.json.repeated).toBe(true);
    expect(first.json.handover.feedback[0]).toMatchObject({ state: "submitted", import: { status: "saved" }, expected: "An Undo toast shows." });
    const thread = first.json.handover.feedback[0].thread_id;
    const withdrawn = await post(owner, { action: "feedback-withdraw", thread_id: thread, command_id: "fb-2" });
    expect(withdrawn.json.handover.feedback[0].state).toBe("withdrawn");
  });
});

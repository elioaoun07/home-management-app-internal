import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AUTHORIZATION_REL, renewAuthorization, renewedGrant } from "../../scripts/delivery-v2/authorization.mjs";
import { buildGrant, loadExecutionPolicy } from "../../scripts/delivery-v2/policy.mjs";
import { createDeliveryV2Context } from "../../scripts/delivery-v2/service.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { routeDeliveryV2 } from "../../scripts/delivery-v2/entry.mjs";
import { inspectReadiness } from "../../scripts/delivery-v2/inspect-readiness.mjs";
import { CSRF_HEADER, REMOTE_ACTOR_HEADER, SESSION_COOKIE, issuePairingCode, pairSession, sessionView } from "../../scripts/delivery-v2/local-auth.mjs";
import { seedRoot, writePolicy, SELECT, makeHarness, journeyFor, plannedRun } from "./fixtures/v2-harness";

const roots: string[] = [];
const contexts: ReturnType<typeof createDeliveryV2Context>[] = [];
const stores: ReturnType<typeof openStore>[] = [];
afterEach(() => {
  contexts.splice(0).forEach(ctx => ctx.close());
  stores.splice(0).forEach(store => store.close());
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
});
const now = "2026-10-24T12:00:00.000Z", oldExpiry = "2026-10-20T12:00:00.000Z";
function fixture(expiry: string | null = oldExpiry) {
  const root = mkdtempSync(join(tmpdir(), "era-authorization-")); roots.push(root); seedRoot(root);
  writePolicy(root, { grant: { permitted_effects: ["native_dispatch", "protected_check"], expires_at: expiry } });
  return { root, file: join(root, ".delivery/v2/execution-policy.json"), journal: join(root, AUTHORIZATION_REL) };
}
const policy = (root: string) => loadExecutionPolicy({ root }).policy!;
function renew(root: string, at = now, command_id: string = randomUUID()) {
  return renewAuthorization({ root, policy: policy(root), actor: "owner:test", command_id, now: at });
}
function headers(root: string, remote = false) {
  const { code } = issuePairingCode({ root });
  const paired = pairSession({ root, code, kind: remote ? "bridge" : "browser" });
  if (remote) return { authorization: "Bearer " + paired.token, [REMOTE_ACTOR_HEADER]: "supabase:owner-phone" };
  const cookie = SESSION_COOKIE + "=" + paired.token;
  return { cookie, [CSRF_HEADER]: sessionView({ root, headers: { cookie } }).csrf };
}

describe("owner authorization through Check readiness", () => {
  it("renews expired authority, preserves settings and survives restart without growing time on reads", () => {
    const f = fixture(), original = readFileSync(f.file, "utf8"), before = policy(f.root);
    const receipt = renew(f.root);
    const after = policy(f.root);
    expect(receipt.expires_at).toBe("2026-10-25T12:00:00.000Z");
    expect(after.authorization.renewedAt).toBe(now);
    expect(after.grant.expires_at).toBe(receipt.expires_at);
    expect({ ...after, grant: before.grant, authorization: before.authorization }).toEqual(before);
    expect(readFileSync(f.file, "utf8")).toBe(original);
    const saved = readFileSync(f.journal, "utf8");
    expect(policy(f.root)).toEqual(after);
    expect(readFileSync(f.journal, "utf8")).toBe(saved);
  });

  it("replays one request exactly and retains receipts when a later click renews again", () => {
    const f = fixture(), id = randomUUID(), first = renew(f.root, now, id);
    const replay = renew(f.root, "2026-10-25T12:00:00.000Z", id);
    expect(replay).toEqual({ ...first, repeated: true });
    const later = renew(f.root, "2026-10-25T12:00:00.000Z");
    expect(later.expires_at).toBe("2026-10-26T12:00:00.000Z");
    expect(JSON.parse(readFileSync(f.journal, "utf8")).receipts).toEqual([
      Object.fromEntries(Object.entries(first).filter(([key]) => key !== "repeated")),
      Object.fromEntries(Object.entries(later).filter(([key]) => key !== "repeated")),
    ]);
  });

  it.each([null, "2027-01-01T00:00:00.000Z"])("never shortens an existing authorization (%s)", expiry => {
    const f = fixture(expiry);
    expect(renew(f.root).expires_at).toBe(expiry);
    expect(policy(f.root).grant.expires_at).toBe(expiry);
  });

  it("binds renewal to exact settings, even when a file edit forgot to bump its revision", () => {
    const f = fixture(), first = renew(f.root), prior = policy(f.root);
    const raw = JSON.parse(readFileSync(f.file, "utf8")); raw.concurrency.maxJobs += 1;
    writeFileSync(f.file, JSON.stringify(raw));
    const changed = policy(f.root);
    expect(changed.authorization.key).not.toBe(prior.authorization.key);
    expect(changed.grant.expires_at).toBe(oldExpiry);
    expect(() => renew(f.root, now, first.command_id)).toThrow("different actor or policy");
  });

  it("extends only bound runs without rewriting grants or revocation versions", () => {
    const f = fixture(), initial = policy(f.root);
    const grant = buildGrant({ policy: initial, contract: { contract_id: "contract", revision: 1 }, profile: { profile_id: "profile" } });
    renew(f.root);
    const extended = renewedGrant(grant, policy(f.root));
    expect(extended).toEqual({ ...grant, expires_at: "2026-10-25T12:00:00.000Z" });
    expect(grant.expires_at).toBe(oldExpiry);
    expect(renewedGrant({ ...grant, authorization_key: "different" }, policy(f.root)).expires_at).toBe(oldExpiry);
    expect(renewedGrant({ ...grant, authorization_key: undefined }, policy(f.root)).expires_at).toBe(oldExpiry);
    expect(renewedGrant(grant, { ...policy(f.root), policy_revision: 99 })).toBe(grant);
  });

  it("refuses a corrupt journal and keeps the approved policy intact", () => {
    const f = fixture(), original = readFileSync(f.file, "utf8");
    writeFileSync(f.journal, "corrupt");
    expect(loadExecutionPolicy({ root: f.root })).toMatchObject({ ok: false, refusals: [{ code: "authorization-unreadable" }] });
    expect(readFileSync(f.file, "utf8")).toBe(original);
    expect(readFileSync(f.journal, "utf8")).toBe("corrupt");
  });

  it("keeps a plan approval usable after renewal and preserves its original grant receipt", async () => {
    const f = fixture();
    renew(f.root);
    const store = openStore({ path: join(f.root, ".delivery/v2/test.sqlite") }); stores.push(store);
    const harness = makeHarness(f.root);
    let at = now;
    const journey = journeyFor({ root: f.root, data: join(f.root, ".test"), store, harness, overrides: { now: () => at } });
    try {
      const { run_id, plan } = await plannedRun(journey, "plan-once");
      const run = store.getRun(run_id)!;
      const original = store.getGrant(String(run.grant_id));
      at = "2026-10-25T13:00:00.000Z";
      renew(f.root, at);
      const approved = await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: plan.revision, decision: "approve", command_id: "approve-once", actor: "owner" });
      expect(approved.ok).toBe(true);
      await journey.idle();
      expect(journey.detail(run_id).run.closed_outcome).toBe("verified_candidate");
      expect(store.getGrant(String(run.grant_id))).toEqual(original);
      expect(harness.calls.map(call => call.access)).toEqual(["read-only", "write"]);
    } finally {
      for (const dir of harness.workspaces.values()) roots.push(dir);
    }
  });

  it.each([false, true])("requires authenticated explicit consent and uses the real actor (remote=%s)", async remote => {
    const f = fixture(), ctx = createDeliveryV2Context({ ROOT: f.root });
    contexts.push(ctx);
    // Provider observations are synthetic; a blocked readiness still retains the
    // owner's explicit time-only authorization and never starts a delivery.
    ctx.refreshReadiness = async () => ({ ready: false, authorization: policy(f.root).authorization });
    const body = { action: "refresh-readiness", renewAuthorization: true, command_id: String(randomUUID()), selection: { file: SELECT.file, id: SELECT.expectId } };
    const send = (h: Record<string, unknown> = {}, b = body) => routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/control", headers: h, body: b }, ctx);
    expect((await send())!.status).toBe(401);
    expect(existsSync(f.journal)).toBe(false);
    const paired = headers(f.root, remote);
    expect((await send(paired, { ...body, command_id: "invalid" }))!.status).toBe(400);
    expect(existsSync(f.journal)).toBe(false);
    expect((await send(paired, { ...body, renewAuthorization: false }))!.status).toBe(200);
    expect(existsSync(f.journal)).toBe(false);
    const outcome = await send({ ...paired, "x-era-actor": "forged" });
    expect(outcome!.status).toBe(200);
    expect(outcome!.json.readiness.authorization.expiresAt > oldExpiry).toBe(true);
    const receipt = JSON.parse(readFileSync(f.journal, "utf8")).receipts[0];
    expect(receipt.actor).toBe(remote ? "remote:supabase:owner-phone" : sessionView({ root: f.root, headers: paired }).actor);
    expect(ctx.hasStore()).toBe(false);
  });

  it("does not authorize through passive reads or Start's internal refresh", async () => {
    const f = fixture(), ctx = createDeliveryV2Context({ ROOT: f.root });
    contexts.push(ctx);
    const selection = { file: SELECT.file, id: SELECT.expectId, executor: "claude", model: "claude-test", effort: "low" };
    await ctx.readiness(selection);
    await ctx.refreshReadiness(selection);
    expect(existsSync(f.journal)).toBe(false);
    expect(policy(f.root).grant.expires_at).toBe(oldExpiry);
  });

  it("does not invalidate another item's observation context when only renewal time changes", async () => {
    const f = fixture(); renew(f.root);
    const selected = { root: f.root, file: SELECT.file, id: SELECT.expectId, executor: "claude", model: "claude-test", effort: "low", now };
    const before = await inspectReadiness(selected);
    renew(f.root, "2026-10-24T13:00:00.000Z");
    const after = await inspectReadiness(selected);
    expect(after.authorization.expiresAt).not.toBe(before.authorization.expiresAt);
    expect(after.contextFingerprint).toBe(before.contextFingerprint);
  });
});

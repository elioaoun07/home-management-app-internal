// PM Delivery V2 — S1.4 fixtures: the entry point.
//
// F-ID, F-AUTH, F-JOB, F-RESULT and F-COMMAND at the seam where a click becomes
// an admitted Run. The interesting assertions are the refusals: a stale row, a
// cross-origin POST, a reused command id, and — the one this slice exists for —
// a V1 client that never reloaded trying to launch after the switch.
//
// The V1 guard is tested against V1's *real* router (`routeDelivery` from
// scripts/delivery/server-routes.mjs), not a copy of its path list. A guard
// asserted against a duplicated table is a guard that silently stops matching the
// thing it guards.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authorizeGrant, revokeGrant } from "../../scripts/delivery-v2/contracts.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import {
  DISPATCH_MODES,
  ENTRY_REFUSALS,
  V1_WRITE_ROUTES,
  authenticateCommand,
  deliverSelection,
  dispatchModePath,
  guardV1Route,
  isLoopbackOrigin,
  projectRun,
  readDispatchMode,
  routeDeliveryV2,
  setDispatchMode,
  setExecutorSelection,
} from "../../scripts/delivery-v2/entry.mjs";
import { createDeliveryV2Context, listActiveV1Writers } from "../../scripts/delivery-v2/service.mjs";
import { CSRF_HEADER, SESSION_COOKIE, issuePairingCode, pairSession, sessionView } from "../../scripts/delivery-v2/local-auth.mjs";
import { routeDelivery } from "../../scripts/delivery/server-routes.mjs";

/**
 * Projections are JSDoc-typed records with optional halves — present on success,
 * absent on refusal. Tests read the success half through this rather than
 * widening the production type, so the optionality stays real for callers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const field = (value: Record<string, any>, key: string): any => value[key];

const CHECKLIST = [
  "# Checklist",
  "",
  "## Now",
  "",
  "- [ ] **BUD-14** quick-amount control emits 20 _(friction - S)_",
  "- [ ] **BUD-15** unrelated row _(annoyance - S)_",
  "",
].join("\n");

const EDITED = CHECKLIST.replace("emits 20", "emits 25");

/** What the owner clicked: BUD-14's alias and exact line, not merely its ordinal. */
const BUD14 = "- [ ] **BUD-14** quick-amount control emits 20 _(friction - S)_";
const WITNESS = { alias: "BUD-14", line: BUD14 };
const EDITED_WITNESS = { alias: "BUD-14", line: BUD14.replace("emits 20", "emits 25") };
const REORDERED = CHECKLIST.replace("- [ ] **BUD-14**", "- [ ] **BUD-99** inserted above _(friction - S)_\n- [ ] **BUD-14**");

const BOOK = ["## Acceptance Criteria Index", "", "### BUD-14", "", "- **Acceptance:** the control emits 20.", ""].join("\n");

let ROOT: string;
let store: ReturnType<typeof openStore>;
let clock = 0;

function grantWith(overrides: Record<string, unknown> = {}) {
  return authorizeGrant({
    contract_id: "placeholder",
    contract_revision: 1,
    permitted_effects: ["native_dispatch", "candidate_export"],
    permitted_executors: ["p-1"],
    resource_policy: { unit: "usd", allowance: null },
    ...overrides,
  });
}

/** Deliver the selected row, binding the grant to the contract the selection froze. */
function deliver(overrides: Record<string, unknown> = {}) {
  const base = {
    store,
    raw: CHECKLIST,
    file: "Budget/4 - Checklist.md",
    cbidx: 0,
    witness: WITNESS,
    bookRaw: BOOK,
    requestedDisposition: "verified_candidate",
    scratchScope: { root: "scratch" },
    publicationScope: { allowedPaths: ["src/features/amount.ts"] },
    profileAdmission: { admitted: true, refusals: [], profile_id: "p-1" },
    backend_id: "fake-backend",
    reservation: { unit: "usd", amount: null, basis: "no monetary reading from this backend" },
    instruction: "change the quick-amount control",
    workspace: { root: "C:/scratch/run" },
    command: { command_id: "cmd-1", actor: "owner" },
    ...overrides,
  } as Parameters<typeof deliverSelection>[0];

  // The grant has to name the contract the *selection* produces, which is only
  // knowable after freezing. A first pass with a throwaway grant yields the
  // contract id; the real call uses a grant bound to it.
  if (!overrides.grant) {
    const probe = deliverSelection({ ...base, grant: grantWith(), command: { command_id: "probe", actor: "owner" } });
    // A probe that refused has no contract — the selection itself was the
    // refusal, which is the case some fixtures are exercising. Fall through with
    // the placeholder grant so the real call reproduces the same refusal.
    base.grant = probe.contract
      ? grantWith({
          contract_id: probe.contract.contract_id,
          contract_revision: probe.contract.revision,
          ...((overrides.grantOverrides as object) || {}),
        })
      : grantWith();
  }
  return deliverSelection(base);
}

beforeEach(() => {
  clock = 0;
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-entry-"));
  store = openStore({
    path: join(ROOT, ".delivery", "v2", "supervisor.sqlite"),
    now: () => "2026-09-07T00:00:" + String(clock++).padStart(2, "0") + ".000Z",
  });
});

afterEach(() => {
  try {
    store.close();
  } catch {
    /* closed by a test */
  }
  try {
    rmSync(ROOT, { recursive: true, force: true });
  } catch {
    /* leftover temp dir */
  }
});

describe("the installation-wide dispatch switch", () => {
  it.each([
    { raw: CHECKLIST.replace("- [ ] **BUD-14**", "- [x] **BUD-14**"), reason: "work-completed" },
    { bookRaw: BOOK + "\n**Execution:** owner\n", reason: "owner-check" },
    { bookRaw: BOOK + "\n**Implementation:** done\n", reason: "work-completed" },
    { file: "Plans/UAT.md", reason: "not-actionable-source" },
  ])("does not create a run for non-actionable work: $reason", ({ reason, ...overrides }) => {
    const outcome = deliver(overrides);
    expect(outcome.ok).toBe(false);
    expect(outcome.refusals).toContainEqual({ code: "selection-refused", detail: reason });
    expect(store.listRuns()).toHaveLength(0);
  });
  it("defaults to v1 when no switch has been set", () => {
    const mode = readDispatchMode({ root: ROOT });
    expect(mode.mode).toBe("v1");
    expect(mode.note).toMatch(/defaulting to v1/u);
  });

  it("defaults to v1 on an unreadable or unrecognised switch file", () => {
    const path = dispatchModePath(ROOT);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, "{ not json", "utf8");
    expect(readDispatchMode({ root: ROOT }).mode).toBe("v1");
    writeFileSync(path, JSON.stringify({ mode: "v3" }), "utf8");
    // A missing or corrupt switch must never silently enable v2 dispatch.
    expect(readDispatchMode({ root: ROOT }).mode).toBe("v1");
  });

  it("persists a switch and reads it back", () => {
    const outcome = setDispatchMode({ root: ROOT, mode: "v2", actor: "owner", now: "2026-09-07T10:00:00.000Z" });
    expect(outcome.ok).toBe(true);
    expect(readDispatchMode({ root: ROOT })).toMatchObject({ mode: "v2", actor: "owner" });
    expect(JSON.parse(readFileSync(dispatchModePath(ROOT), "utf8")).schema).toBe("delivery-v2/dispatch-mode@1");
  });

  it("refuses to switch to v2 while a V1 writer is active", () => {
    const outcome = setDispatchMode({ root: ROOT, mode: "v2", actor: "owner", activeV1Writers: ["s-20260907-aaaa"] });
    expect(outcome.ok).toBe(false);
    expect(outcome.refusals[0].code).toBe(ENTRY_REFUSALS.V1_WRITER_ACTIVE);
    expect(readDispatchMode({ root: ROOT }).mode).toBe("v1"); // unchanged
  });

  it("refuses to switch back to v1 while a V2 job is unreconciled", () => {
    setDispatchMode({ root: ROOT, mode: "v2", actor: "owner" });
    const outcome = setDispatchMode({ root: ROOT, mode: "v1", actor: "owner", unreconciledV2Jobs: ["j-1"] });
    expect(outcome.ok).toBe(false);
    expect(outcome.refusals[0].code).toBe(ENTRY_REFUSALS.V2_JOB_UNRECONCILED);
    // S1.4 stop/rollback: an unknown dispatch is not turned into a fresh V1 launch.
    expect(outcome.refusals[0].note).toMatch(/not turned into a fresh V1 launch/u);
    expect(readDispatchMode({ root: ROOT }).mode).toBe("v2");
  });

  it("refuses an unknown mode and an unattributed switch", () => {
    expect(setDispatchMode({ root: ROOT, mode: "v3", actor: "owner" }).refusals[0].code).toBe(ENTRY_REFUSALS.BAD_MODE);
    expect(setDispatchMode({ root: ROOT, mode: "v2", actor: "" }).refusals[0].code).toBe(ENTRY_REFUSALS.UNAUTHENTICATED);
    expect(DISPATCH_MODES).toEqual(["v1", "v2"]);
  });

  it("counts a V1 session with an unreadable state file as still active", () => {
    const sessionsDir = join(ROOT, "sessions");
    mkdirSync(join(sessionsDir, "s-open"), { recursive: true });
    mkdirSync(join(sessionsDir, "s-done"), { recursive: true });
    mkdirSync(join(sessionsDir, "s-broken"), { recursive: true });
    writeFileSync(join(sessionsDir, "s-open", "state.json"), JSON.stringify({ state: "BUILDING" }), "utf8");
    writeFileSync(join(sessionsDir, "s-done", "state.json"), JSON.stringify({ state: "SHIPPED" }), "utf8");
    writeFileSync(join(sessionsDir, "s-broken", "state.json"), "{ truncated", "utf8");
    // An unreadable writer is not a drained one.
    expect(listActiveV1Writers({ sessionsDir })).toEqual(["s-broken", "s-open"]);
  });
});

describe("F-COMMAND — a stale V1 client cannot launch after the switch", () => {
  const ctx = () => ({ ROOT, PM_DIR: ROOT, PM_REL: "", SESSIONS_DIR: join(ROOT, "sessions") });

  it("lets every V1 write route through in v1 mode", async () => {
    for (const path of V1_WRITE_ROUTES) {
      expect(guardV1Route({ mode: "v1", method: "POST", path }).allowed).toBe(true);
    }
  });

  it("refuses every V1 write route in v2 mode, through V1's own router", async () => {
    setDispatchMode({ root: ROOT, mode: "v2", actor: "owner" });
    for (const path of V1_WRITE_ROUTES) {
      const result = await routeDelivery(
        { method: "POST", path, query: new URLSearchParams(), body: { sessionId: "s-cached" } },
        ctx(),
      );
      expect(result).not.toBeNull();
      expect(result!.status).toBe(409);
      expect(result!.json.error).toBe(ENTRY_REFUSALS.V1_ROUTE_DISABLED);
    }
  });

  it("keeps V1 history and read routes available in v2 mode", async () => {
    setDispatchMode({ root: ROOT, mode: "v2", actor: "owner" });
    const result = await routeDelivery(
      { method: "GET", path: "/api/delivery/sessions", query: new URLSearchParams(), body: {} },
      ctx(),
    );
    // Architecture §10: historical V1 inspection remains available and no active
    // legacy session is converted.
    expect(result).not.toBeNull();
    expect(result!.status).toBe(200);
  });

  it("does not touch routes V1 does not own", () => {
    expect(guardV1Route({ mode: "v2", method: "GET", path: "/api/delivery/session" }).allowed).toBe(true);
    expect(guardV1Route({ mode: "v2", method: "POST", path: "/api/delivery/preflight" }).allowed).toBe(true);
  });
});

describe("F-COMMAND — local requests are authenticated, not merely local", () => {
  it("refuses a cross-origin POST even though it reached loopback", () => {
    const outcome = authenticateCommand({
      headers: { origin: "https://evil.example", "x-era-actor": "owner" },
      allowedOrigins: ["http://127.0.0.1:4317"],
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe(403);
    expect(outcome.refusal!.code).toBe(ENTRY_REFUSALS.CROSS_ORIGIN);
  });

  it("refuses a cross-site request whose Origin header is absent", () => {
    const outcome = authenticateCommand({
      headers: { "sec-fetch-site": "cross-site", "x-era-actor": "owner" },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.refusal!.detail).toMatch(/sec-fetch-site/u);
  });

  it("refuses an unattributed request", () => {
    const outcome = authenticateCommand({ headers: { origin: "http://127.0.0.1:4317" } });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe(401);
    expect(outcome.refusal!.code).toBe(ENTRY_REFUSALS.UNAUTHENTICATED);
  });

  it("accepts a same-origin loopback request with an actor", () => {
    const outcome = authenticateCommand({
      headers: {
        origin: "http://127.0.0.1:4318",
        "sec-fetch-site": "same-origin",
        "x-era-actor": "owner",
        "x-era-installation": "desk",
      },
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.actor).toBe("owner");
    expect(outcome.installation).toBe("desk");
  });

  it("parses the origin rather than prefix-matching it", () => {
    expect(isLoopbackOrigin("http://127.0.0.1:4317")).toBe(true);
    expect(isLoopbackOrigin("http://localhost:9999")).toBe(true);
    // The reason this is parsed: a naive startsWith would accept these.
    expect(isLoopbackOrigin("http://127.0.0.1.evil.example")).toBe(false);
    expect(isLoopbackOrigin("http://localhost.evil.example")).toBe(false);
    expect(isLoopbackOrigin("file://")).toBe(false);
    expect(isLoopbackOrigin("")).toBe(false);
  });
});

describe("F-ID / F-AUTH — selection reaches admission, or refuses before spending anything", () => {
  it("admits a selected row and persists only its WorkRef mapping", () => {
    const outcome = deliver();
    expect(outcome.ok).toBe(true);
    expect(outcome.job!.status).toBe("reserved");
    expect(outcome.job!.dispatch_started_at).toBeNull();

    // One mapping, for the row actually selected. The sibling row in the same
    // file is not adopted just because it was parsed.
    const refs = store.listWorkRefs();
    expect(refs).toHaveLength(1);
    expect(String(refs[0].alias)).toBe("BUD-14");
    expect(store.getContract(outcome.contract!.contract_id, outcome.contract!.revision)).not.toBeNull();
  });

  it("re-resolves the witnessed row after a reorder instead of admitting the row now at its ordinal", () => {
    const first = deliver();
    // BUD-99 is prepended after the click, so the clicked ordinal 0 now names it.
    // Plan finding 3: the ordinal used to freeze BUD-99 here. The witness binds
    // the launch to BUD-14 wherever it now sits.
    const second = deliver({ raw: REORDERED });
    expect(second.ok).toBe(true);
    expect(second.workRef!.alias).toBe("BUD-14");
    expect(second.workRef!.work_id).toBe(first.workRef!.work_id);
    expect(second.run_id).toBe(first.run_id);
    expect(store.listWorkRefs().map((ref: { alias: unknown }) => String(ref.alias))).toEqual(["BUD-14"]);
  });

  it("refuses a selection with no witness before any store write", () => {
    const outcome = deliver({ raw: REORDERED, witness: null, command: { command_id: "cmd-blind", actor: "owner" } });
    expect(outcome.ok).toBe(false);
    expect(outcome.refusals).toEqual([{ code: ENTRY_REFUSALS.SELECTION, detail: "missing-selection-witness" }]);
    expect(store.listWorkRefs()).toHaveLength(0);
  });

  it("refuses a launch whose witnessed row has since been edited", () => {
    // The owner chose the row while it read "emits 25"; it now reads "emits 20".
    const outcome = deliver({ witness: EDITED_WITNESS, command: { command_id: "cmd-stale", actor: "owner" } });
    expect(outcome.ok).toBe(false);
    expect(outcome.refusals).toEqual([{ code: ENTRY_REFUSALS.SELECTION, detail: "stale-source" }]);
    expect(store.listWorkRefs()).toHaveLength(0);
  });

  it("refuses a grant frozen against different words", () => {
    const edited = deliver({ raw: EDITED, witness: EDITED_WITNESS, command: { command_id: "cmd-edited", actor: "owner" } });
    // An edited intent must not launch under a contract frozen from other words.
    const stale = deliver({
      command: { command_id: "cmd-stale-2", actor: "owner" },
      grant: grantWith({ contract_id: edited.contract!.contract_id, contract_revision: 1 }),
    });
    expect(stale.ok).toBe(false);
    expect(JSON.stringify(stale.refusals)).toMatch(/contract-revision-moved|source-stale/u);
  });

  it("binds the Master Book acceptance: an edited criterion invalidates a grant for the old contract", () => {
    const original = deliver();
    expect(original.contract!.acceptance_fingerprint).toMatch(/^sha256:/u);
    // The checkbox row is untouched; only the book's BUD-14 section changed.
    const moved = deliver({
      bookRaw: BOOK.replace("emits 20.", "emits 20 and announces it."),
      command: { command_id: "cmd-book", actor: "owner" },
      grant: grantWith({ contract_id: original.contract!.contract_id, contract_revision: 1 }),
    });
    expect(moved.contract!.source_fingerprint).toBe(original.contract!.source_fingerprint);
    expect(moved.contract!.contract_id).not.toBe(original.contract!.contract_id);
    expect(moved.ok).toBe(false);
    expect(JSON.stringify(moved.refusals)).toMatch(/contract-revision-moved|source-stale/u);
  });

  it("refuses when the Master Book holds two sections for the selected ID", () => {
    const outcome = deliver({ bookRaw: BOOK + "\n### bud-14\n\n- a second copy\n", command: { command_id: "cmd-two-books", actor: "owner" } });
    expect(outcome.ok).toBe(false);
    expect(outcome.refusals).toEqual([{ code: ENTRY_REFUSALS.SELECTION, detail: "ambiguous-acceptance" }]);
  });

  it("refuses an ambiguous selection before any command is spent", () => {
    const duplicated = CHECKLIST.replace("- [ ] **BUD-15** unrelated row _(annoyance - S)_", "- [ ] **BUD-14** duplicate alias _(annoyance - S)_");
    const outcome = deliver({ raw: duplicated, command: { command_id: "cmd-dupe", actor: "owner" } });
    expect(outcome.ok).toBe(false);
    expect(outcome.refusals[0].code).toBe(ENTRY_REFUSALS.SELECTION);
    expect(outcome.refusals[0].detail).toBe("ambiguous-alias");
    // Nothing was reserved and no command id was consumed.
    expect(store.listJobs(outcome.run_id || "")).toHaveLength(0);
  });

  it("returns the same admitted outcome for a duplicate start", () => {
    const first = deliver();
    const again = deliver();
    expect(again.duplicate).toBe(true);
    expect(again.ok).toBe(true);
    expect(again.job!.job_id).toBe(first.job!.job_id);
    expect(store.listJobs(first.run_id).length).toBe(1);
  });

  it("conflicts on the same command id with a different payload", () => {
    const first = deliver();
    const conflict = deliver({
      command: { command_id: "cmd-1", actor: "owner", payload: { something: "else" } },
    });
    expect(conflict.ok).toBe(false);
    expect(JSON.stringify(conflict.refusals)).toMatch(/command-conflict/u);
    expect(store.listJobs(first.run_id).length).toBe(1);
  });

  it("conflicts on the same command id from another actor", () => {
    deliver();
    const conflict = deliver({ command: { command_id: "cmd-1", actor: "someone-else" } });
    expect(conflict.ok).toBe(false);
    expect(JSON.stringify(conflict.refusals)).toMatch(/command-conflict/u);
  });

  it("refuses under a revoked grant", () => {
    const probe = deliver();
    const revoked = revokeGrant(
      grantWith({ contract_id: probe.contract!.contract_id, contract_revision: probe.contract!.revision }),
    );
    const outcome = deliver({ grant: revoked, command: { command_id: "cmd-revoked", actor: "owner" } });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome.refusals)).toMatch(/grant-revoked/u);
  });

  it("refuses when the executor profile is not admitted", () => {
    const outcome = deliver({
      profileAdmission: {
        admitted: false,
        refusals: [{ code: "confinement-unproven", detail: "filesystem.hostSecretRead" }],
        profile_id: "p-1",
      },
      command: { command_id: "cmd-profile", actor: "owner" },
    });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome.refusals)).toMatch(/hostSecretRead/u);
  });
});

describe("F-RESULT — a reload shows the current unknown, decision and result", () => {
  it("projects the run from persisted records after a restart", () => {
    const admitted = deliver();
    const jobId = admitted.job!.job_id;
    store.markDispatchStarted(jobId, "2026-09-07T12:00:00.000Z");
    store.updateJob(jobId, {
      status: "unknown",
      outcome: null,
      observations_json: null,
      reason: "launch acknowledgement lost",
      reservation_open: 1,
      publication_revoked: 0,
    });
    store.putDecision({
      decision_id: "dec-1",
      run_id: admitted.run_id,
      subject_id: admitted.contract!.contract_id,
      subject_revision: 1,
      kind: "scope",
      answer: null,
    });

    const path = join(ROOT, ".delivery", "v2", "supervisor.sqlite");
    store.close();
    // A new process. Nothing is held in memory; everything below is read back.
    const reopened = openStore({ path, now: () => "2026-09-07T13:00:00.000Z" });
    const view = projectRun({ store: reopened, run_id: admitted.run_id });

    expect(view.ok).toBe(true);
    expect(field(view, "run").run_id).toBe(admitted.run_id);
    expect(view.unknownJobs).toHaveLength(1);
    expect(field(view, "unknownJobs")[0].reason).toMatch(/acknowledgement lost/u);
    expect(view.decisions).toHaveLength(1);
    expect(field(view, "jobs")[0].reservationOpen).toBe(true);
    expect(view.ownerAction).toBe("Reconcile 1 outstanding job");
    // The result is honest about the run rather than provisionally green.
    expect(field(view, "result").candidateVerified).toBe(false);
    expect(field(view, "result").workComplete).toBe(false);
    expect(field(view, "result").unknown_jobs_or_effects).toHaveLength(1);
    reopened.close();
    store = reopened;
  });

  it("names a concrete owner action for a reserved-but-undispatched run", () => {
    const admitted = deliver();
    const view = projectRun({ store, run_id: admitted.run_id });
    expect(view.ownerAction).toBe("Dispatch");
  });

  it("refuses to project a run it does not have", () => {
    const view = projectRun({ store, run_id: "r-nope" });
    expect(view.ok).toBe(false);
    expect(view.refusal!.code).toBe(ENTRY_REFUSALS.UNKNOWN_RUN);
  });
});

describe("the HTTP surface", () => {
  // A paired browser session: the actor comes from it, never from a header or body.
  const pairedHeaders = () => {
    const { code } = issuePairingCode({ root: ROOT });
    const paired = pairSession({ root: ROOT, code });
    const cookie = SESSION_COOKIE + "=" + paired.token;
    const csrf = String(sessionView({ root: ROOT, headers: { cookie } }).csrf);
    return { origin: "http://127.0.0.1:4317", "sec-fetch-site": "same-origin", cookie, [CSRF_HEADER]: csrf, "x-era-actor": "mallory" };
  };
  const ctx = () => ({ root: ROOT, store, allowedOrigins: ["http://127.0.0.1:4317"] });

  it("serves the mode unauthenticated, because reading it changes nothing", async () => {
    const res = await routeDeliveryV2({ method: "GET", path: "/api/delivery/v2/mode", headers: {} }, ctx());
    expect(res!.status).toBe(200);
    expect(res!.json.mode).toBe("v1");
  });

  it("refuses a cross-origin mode switch", async () => {
    const res = await routeDeliveryV2(
      { method: "POST", path: "/api/delivery/v2/mode", body: { mode: "v2" }, headers: { origin: "https://evil.example", "x-era-actor": "owner" } },
      ctx(),
    );
    expect(res!.status).toBe(403);
    expect(res!.json.error).toBe(ENTRY_REFUSALS.CROSS_ORIGIN);
    expect(readDispatchMode({ root: ROOT }).mode).toBe("v1");
  });

  it("refuses a command that only names its actor", async () => {
    const res = await routeDeliveryV2(
      { method: "POST", path: "/api/delivery/v2/mode", body: { mode: "v2", actor: "owner" }, headers: { "sec-fetch-site": "same-origin", "x-era-actor": "owner" } },
      ctx(),
    );
    expect(res!.status).toBe(401);
    expect(readDispatchMode({ root: ROOT }).mode).toBe("v1");
  });

  it("refuses a deliver in v1 mode", async () => {
    const res = await routeDeliveryV2(
      { method: "POST", path: "/api/delivery/v2/deliver", body: {}, headers: pairedHeaders() },
      ctx(),
    );
    expect(res!.status).toBe(409);
    expect(res!.json.error).toBe(ENTRY_REFUSALS.V2_ROUTE_DISABLED);
  });

  it("refuses a deliver that names no executor, whatever the installation once selected", async () => {
    setDispatchMode({ root: ROOT, mode: "v2", actor: "owner" });
    setExecutorSelection({ root: ROOT, choice: "codex", actor: "owner" });
    const res = await routeDeliveryV2(
      { method: "POST", path: "/api/delivery/v2/deliver", body: {}, headers: pairedHeaders() },
      ctx(),
    );
    expect(res!.status).toBe(409);
    expect(res!.json.error).toBe(ENTRY_REFUSALS.NO_EXECUTOR);
  });

  it("refuses a deliver in v2 mode when no pilot policy is installed", async () => {
    setDispatchMode({ root: ROOT, mode: "v2", actor: "owner" });
    const res = await routeDeliveryV2(
      { method: "POST", path: "/api/delivery/v2/deliver", body: { executor: "codex" }, headers: pairedHeaders() },
      ctx(),
    );
    // The honest default: wiring the route did not authorize a gate policy.
    expect(res!.status).toBe(409);
    expect(res!.json.error).toBe(ENTRY_REFUSALS.NO_POLICY);
  });

  it("runs an installed policy in v2 mode with the run's executor and the session's actor", async () => {
    setDispatchMode({ root: ROOT, mode: "v2", actor: "owner" });
    const seen: Record<string, unknown>[] = [];
    const res = await routeDeliveryV2(
      { method: "POST", path: "/api/delivery/v2/deliver", body: { file: "x", cbidx: 0, executor: "codex", actor: "mallory" }, headers: pairedHeaders() },
      {
        ...ctx(),
        deliver: async (input: Record<string, unknown>) => {
          seen.push(input);
          return { ok: true, run_id: "r-1" };
        },
      },
    );
    expect(res!.status).toBe(200);
    // The authenticated actor is what the policy receives, not whatever the body
    // or a header claimed.
    expect(seen[0].actor).toBe("owner");
    expect(seen[0].executor).toBe("codex-exec-sdk");
  });

  it("retires the installation-wide executor selection route", async () => {
    const res = await routeDeliveryV2(
      { method: "POST", path: "/api/delivery/v2/executor", body: { executor: "claude" }, headers: pairedHeaders() },
      ctx(),
    );
    expect(res!.status).toBe(410);
    expect(res!.json.error).toBe(ENTRY_REFUSALS.SELECTION_PER_RUN);
  });

  it("returns null for a path it does not own", async () => {
    expect(await routeDeliveryV2({ method: "GET", path: "/api/delivery/sessions", headers: {} }, ctx())).toBeNull();
  });
});

describe("the local service", () => {
  it("does not create a store until a request needs one", () => {
    const storePath = join(ROOT, ".delivery", "v2", "supervisor.sqlite");
    store.close(); // the suite's own handle holds the file open on Windows
    rmSync(join(ROOT, ".delivery"), { recursive: true, force: true });
    let opened = 0;
    const ctx = createDeliveryV2Context({
      ROOT,
      openStore: (args: { path: string }) => {
        opened += 1;
        return openStore(args);
      },
    });
    // Reading the mode and asking about outstanding jobs on a fresh install must
    // not bring a database into existence.
    expect(readDispatchMode({ root: ROOT }).mode).toBe("v1");
    expect(ctx.unreconciledV2Jobs()).toEqual([]);
    expect(opened).toBe(0);
    expect(storePath).toBeTruthy();
    ctx.close();
  });

  it("leaves deliver unconfigured by default", () => {
    expect(createDeliveryV2Context({ ROOT }).deliver).toBeNull();
  });
});

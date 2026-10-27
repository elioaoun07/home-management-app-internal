// DLV-145 — the canonical UAT record: validation, binding, append-only owner
// receipts, the sign-off gate and feedback. Offline temp roots only: no
// provider, Apply, Git write or application data.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  bindDirect,
  bindRun,
  dispositionFeedback,
  freezeHandover,
  listUat,
  readImportStatus,
  readUat,
  recordAvailability,
  recordResult,
  retractSignOff,
  saveDraft,
  signOff,
  submitFeedback,
  validateContent,
  viewOne,
  withdrawFeedback,
} from "../../scripts/delivery-v2/uat.mjs";
import { gateState } from "../../scripts/delivery-v2/test-gate.mjs";

type Loose = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});
const tempRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "era-uat-"));
  roots.push(root);
  return root;
};

const T0 = "2026-10-25T10:00:00.000Z";
const at = (minutes: number) => new Date(Date.parse(T0) + minutes * 60_000).toISOString();
let seq = 0;
const cmd = () => `c-${++seq}`;

const scenario = (id: string, extra: Loose = {}) => ({
  id,
  title: `Scenario ${id}`,
  purpose: "feature",
  required: true,
  criteria: ["AC-1"],
  steps: [
    { action: "Open the test address.", expected: "The home screen appears." },
    { action: "Select Save.", expected: "A saved row appears." },
  ],
  cleanup: "None — read-only",
  ...extra,
});
const content = (extra: Loose = {}) => ({ summary: "Link two transactions", scenarios: [scenario("T-1"), scenario("T-2", { criteria: ["AC-2"] })], ...extra });
const runCtx = (extra: Loose = {}) => ({ run: { candidate_id: "cand-1", generation: "g1", result_version: 1, plan_revision: 2, contract_revision: 3, applied: true, ...extra } });
const subject = { run_id: "r-aaaaaaaaaaaa", work_id: "BUD-83", campaign: "Budget", title: "Remove a pending split" };

function ready(root: string, overrides: Loose = {}) {
  const frozen: Loose = freezeHandover({
    root,
    subject,
    binding: bindRun(runCtx().run),
    environment: { target: "local", build: "b1" },
    content: content(),
    criteria: ["AC-1", "AC-2"],
    ready: true,
    now: T0,
    ...overrides,
  });
  expect(frozen.ok).toBe(true);
  return frozen.handover;
}
const pass = (root: string, handover: Loose, id: string, minutes = 1) =>
  recordResult({ root, handover_id: handover.handover_id, revision: handover.revision, scenario_id: id, result: "pass", command_id: cmd(), actor: "owner", now: at(minutes) });

describe("handover content validation", () => {
  it("reports every shape the spec calls incomplete, and never repairs it", () => {
    const codes = (raw: unknown, criteria: string[] = []) => (validateContent(raw, { criteria }).problems as Loose[]).map((problem) => problem.code);
    expect(codes(null)).toContain("content-missing");
    expect(codes({ scenarios: [] })).toContain("no-scenarios");
    expect(codes({ scenarios: [scenario("A"), scenario("a")] })).toContain("duplicate-scenario-id");
    expect(codes({ scenarios: [scenario("A", { steps: [] })] })).toContain("no-steps");
    expect(codes({ scenarios: [scenario("A", { steps: [{ action: "Open it." , expected: "" }] })] })).toContain("step-missing-expectation");
    expect(codes({ scenarios: [scenario("A", { steps: [{ action: "", expected: "x" }] })] })).toContain("step-missing-action");
    expect(codes({ scenarios: [scenario("A", { steps: [{ action: "x".repeat(1501), expected: "y" }] })] })).toContain("text-too-long");
    expect(codes({ scenarios: [scenario("A", { required: false })] })).toContain("no-required-scenario");
    expect(codes({ scenarios: [scenario("A")] }, ["AC-1", "AC-9"])).toEqual(["criterion-uncovered"]);
    expect(codes({ scenarios: Array.from({ length: 41 }, (_, i) => scenario(`S${i}`)) })).toContain("too-many-scenarios");
    expect(codes({ scenarios: [scenario("A", { id: "bad id" })] })).toContain("scenario-id-invalid");
  });

  it("accepts a complete handover with every required criterion covered", () => {
    expect(validateContent(content(), { criteria: ["AC-1", "AC-2"] })).toMatchObject({ ok: true, problems: [] });
  });
});

describe("freezing a handover", () => {
  it("is draft until a trusted binding makes it ready, and an invalid body is incomplete with its problems", () => {
    const root = tempRoot();
    const draft: Loose = freezeHandover({ root, subject, content: content(), now: T0 });
    expect(draft.handover).toMatchObject({ status: "draft", revision: 1, binding: null });
    const bad: Loose = freezeHandover({ root, subject: { delivery_ref: "docs/x.md#y" }, content: { scenarios: [scenario("A", { steps: [] })] }, ready: true, binding: bindRun(runCtx().run), now: T0 });
    expect(bad.handover.status).toBe("incomplete");
    expect(bad.handover.problems.map((problem: Loose) => problem.code)).toContain("no-steps");
    expect(freezeHandover({ root, subject, content: content(), ready: true, binding: null, now: T0 })).toMatchObject({ ok: false, refusals: [{ code: "binding-missing" }] });
  });

  it("takes identity and digest from the supervisor: an identical re-freeze keeps one revision, a changed body or candidate adds one", () => {
    const root = tempRoot();
    const first = ready(root);
    const again: Loose = freezeHandover({ root, subject, binding: bindRun(runCtx().run), environment: { target: "local", build: "b1" }, content: content(), criteria: ["AC-1", "AC-2"], ready: true, now: at(30) });
    expect(again).toMatchObject({ ok: true, repeated: true });
    expect(readUat({ root }).handovers).toHaveLength(1);
    const edited: Loose = freezeHandover({ root, subject, binding: bindRun(runCtx().run), environment: { target: "local", build: "b1" }, content: content({ summary: "Changed" }), ready: true, now: at(31) });
    expect(edited.handover.revision).toBe(first.revision + 1);
    const replaced: Loose = freezeHandover({ root, subject, binding: bindRun(runCtx({ candidate_id: "cand-2" }).run), environment: { target: "local", build: "b1" }, content: content({ summary: "Changed" }), ready: true, now: at(32) });
    expect(replaced.handover.revision).toBe(first.revision + 2);
    expect(first.content_digest).not.toBe(edited.handover.content_digest);
  });

  it("binds a direct delivery to an exact source revision and refuses a loose one", () => {
    expect(bindDirect({ delivery_ref: "docs/a.md#b", source_revision: "735d3881" })).toMatchObject({ kind: "source", source_revision: "735d3881" });
    expect(bindDirect({ delivery_ref: "docs/a.md#b", source_revision: "main" })).toBeNull();
    expect(bindRun({ candidate_id: null })).toBeNull();
  });
});

describe("owner receipts", () => {
  it("are append-only, idempotent by command id, and stamped by the server", () => {
    const root = tempRoot();
    const handover = ready(root);
    const input = { root, handover_id: handover.handover_id, revision: handover.revision, scenario_id: "T-1", result: "pass", command_id: "same", actor: "owner", now: at(1) };
    const first: Loose = recordResult(input);
    expect(first).toMatchObject({ ok: true, repeated: false, receipt: { actor: "owner", received_at: at(1), observed_at: at(1) } });
    expect(recordResult({ ...input, now: at(9) })).toMatchObject({ ok: true, repeated: true });
    expect(readUat({ root }).receipts).toHaveLength(1);
    const second: Loose = recordResult({ ...input, command_id: "other", result: "fail", note: "Wrong total", now: at(2) });
    expect(second.receipt.supersedes).toBe(first.receipt.receipt_id);
    expect(readUat({ root }).receipts).toHaveLength(2);
    expect(viewOne({ root, handover_id: handover.handover_id, now: at(3) })!.scenarios[0]).toMatchObject({ result: "fail", attempts: 2 });
  });

  it("refuse missing actor, unknown scenario, bad result, future time, and a note-less failure", () => {
    const root = tempRoot();
    const h = ready(root);
    const base = { root, handover_id: h.handover_id, revision: h.revision, scenario_id: "T-1", result: "pass", command_id: cmd(), actor: "owner", now: at(1) };
    expect(recordResult({ ...base, actor: "" })).toMatchObject({ ok: false, refusals: [{ code: "actor-missing" }] });
    expect(recordResult({ ...base, command_id: "" })).toMatchObject({ ok: false, refusals: [{ code: "command-id-missing" }] });
    expect(recordResult({ ...base, scenario_id: "nope" })).toMatchObject({ ok: false, refusals: [{ code: "unknown-scenario" }] });
    expect(recordResult({ ...base, result: "maybe" })).toMatchObject({ ok: false, refusals: [{ code: "result-invalid" }] });
    expect(recordResult({ ...base, observed_at: at(60) })).toMatchObject({ ok: false, refusals: [{ code: "time-in-future" }] });
    expect(recordResult({ ...base, result: "fail" })).toMatchObject({ ok: false, refusals: [{ code: "note-required" }] });
    expect(recordResult({ ...base, result: "blocked", note: "No account" })).toMatchObject({ ok: true });
    expect(recordResult({ ...base, command_id: cmd(), step: 9 })).toMatchObject({ ok: false, refusals: [{ code: "step-invalid" }] });
    expect(recordResult({ ...base, command_id: cmd(), revision: 99 })).toMatchObject({ ok: false, refusals: [{ code: "stale-revision" }] });
    expect(recordResult({ ...base, command_id: cmd(), handover_id: "uat-nope" })).toMatchObject({ ok: false, refusals: [{ code: "unknown-handover" }] });
  });

  it("refuse results against a draft: it is bound to no build", () => {
    const root = tempRoot();
    const draft: Loose = freezeHandover({ root, subject, content: content(), now: T0 }).handover;
    expect(draft.status).toBe("draft");
    expect(recordResult({ root, handover_id: draft.handover_id, revision: 1, scenario_id: "T-1", result: "pass", command_id: cmd(), actor: "owner", now: at(1) })).toMatchObject({ ok: false, refusals: [{ code: "handover-draft" }] });
    expect(readUat({ root }).receipts).toHaveLength(0);
  });

  it("refuse results against an incomplete handover", () => {
    const root = tempRoot();
    const bad: Loose = freezeHandover({ root, subject, content: { scenarios: [scenario("A", { steps: [{ action: "Open it.", expected: "" }] })] }, now: T0 });
    expect(bad.handover.status).toBe("incomplete");
    expect(recordResult({ root, handover_id: bad.handover.handover_id, revision: 1, scenario_id: "A", result: "pass", command_id: cmd(), actor: "owner", now: at(1) })).toMatchObject({ ok: false, refusals: [{ code: "handover-incomplete" }] });
  });

  it("a torn last line neither loses earlier records nor blocks the next append", () => {
    const root = tempRoot();
    const h = ready(root);
    pass(root, h, "T-1");
    const path = join(root, ".delivery", "v2", "uat", "receipts.ndjson");
    writeFileSync(path, readFileSync(path, "utf8") + '{"kind":"result","rece');
    expect(readUat({ root })).toMatchObject({ corrupt: 1 });
    expect(pass(root, h, "T-2")).toMatchObject({ ok: true });
    expect(readUat({ root }).receipts).toHaveLength(2);
  });
});

describe("the sign-off gate", () => {
  const sign = (root: string, h: Loose, extra: Loose = {}) => signOff({ root, handover_id: h.handover_id, revision: h.revision, command_id: cmd(), actor: "owner", now: at(10), context: runCtx(), ...extra });
  const codes = (outcome: Loose) => outcome.refusals.map((refusal: Loose) => refusal.code);

  it("refuses Pending, FAIL and BLOCKED required cases, then accepts once every one has a current PASS", () => {
    const root = tempRoot();
    const h = ready(root);
    expect(codes(sign(root, h))).toContain("required-not-passed");
    pass(root, h, "T-1");
    recordResult({ root, handover_id: h.handover_id, revision: 1, scenario_id: "T-2", result: "fail", note: "Total is wrong", command_id: cmd(), actor: "owner", now: at(2) });
    expect(sign(root, h)).toMatchObject({ ok: false, refusals: [{ code: "required-not-passed", detail: ["T-2"] }] });
    recordResult({ root, handover_id: h.handover_id, revision: 1, scenario_id: "T-2", result: "blocked", note: "No account", command_id: cmd(), actor: "owner", now: at(3) });
    expect(codes(sign(root, h))).toContain("required-not-passed");
    pass(root, h, "T-2", 4);
    const signed: Loose = sign(root, h);
    expect(signed).toMatchObject({ ok: true, receipt: { kind: "signoff", actor: "owner", environment: "local", binding: { candidate_id: "cand-1" } } });
    const view = viewOne({ root, handover_id: h.handover_id, contextFor: () => runCtx(), now: at(11) })!;
    expect(view.acceptance).toEqual({ state: "accepted", shipped: true });
  });

  it("an optional case can stay untested; a required one cannot be made optional by the caller", () => {
    const root = tempRoot();
    const h = ready(root, { content: content({ scenarios: [scenario("T-1"), scenario("T-2", { criteria: ["AC-2"], required: false })] }), criteria: ["AC-1"] });
    pass(root, h, "T-1");
    expect(sign(root, h)).toMatchObject({ ok: true });
    const attempt: Loose = recordResult({ root, handover_id: h.handover_id, revision: 1, scenario_id: "T-1", result: "fail", note: "Broke again", command_id: cmd(), actor: "owner", now: at(12) });
    expect(attempt.ok).toBe(true);
    expect(viewOne({ root, handover_id: h.handover_id, contextFor: () => runCtx(), now: at(13) })!.acceptance.shipped).toBe(false);
  });

  it("is repeat-safe and refuses a second sign-off until it is retracted", () => {
    const root = tempRoot();
    const h = ready(root);
    pass(root, h, "T-1");
    pass(root, h, "T-2");
    const input = { command_id: "sign-1" };
    expect(sign(root, h, input)).toMatchObject({ ok: true, repeated: false });
    expect(sign(root, h, input)).toMatchObject({ ok: true, repeated: true });
    expect(codes(sign(root, h))).toEqual(["already-signed"]);
    const retract: Loose = retractSignOff({ root, handover_id: h.handover_id, revision: 1, command_id: cmd(), reason: "Found a regression", actor: "owner", now: at(20) });
    expect(retract.ok).toBe(true);
    const view = viewOne({ root, handover_id: h.handover_id, contextFor: () => runCtx(), now: at(21) })!;
    expect(view.acceptance.shipped).toBe(false);
    expect(readUat({ root }).receipts.filter((row: Loose) => row.kind === "signoff")).toHaveLength(1);
    expect(sign(root, h)).toMatchObject({ ok: true });
  });

  it("needs a ready handover, a current candidate and an available build", () => {
    const root = tempRoot();
    const draft: Loose = freezeHandover({ root, subject: { ...subject, run_id: "r-bbbbbbbbbbbb" }, content: content(), now: T0 }).handover;
    expect(codes(sign(root, draft))).toContain("handover-draft");
    const h = ready(root);
    pass(root, h, "T-1");
    pass(root, h, "T-2");
    expect(codes(sign(root, h, { context: runCtx({ candidate_id: "cand-2" }) }))).toContain("stale-candidate");
    expect(sign(root, h, { context: runCtx({ applied: false }) })).toMatchObject({ ok: false, refusals: [{ code: "not-available", detail: "awaiting" }] });
    expect(sign(root, h, { context: null })).toMatchObject({ ok: false, refusals: [{ code: "not-available", detail: "unknown" }] });
    // The owner can attest that a hosted/phone build serves this version.
    const hosted = ready(root, { subject: { ...subject, run_id: null, delivery_ref: "direct:BUD-83" }, binding: bindDirect({ delivery_ref: "direct:BUD-83", source_revision: "735d3881" }), environment: { target: "hosted", build: "735d3881" } });
    pass(root, hosted, "T-1");
    pass(root, hosted, "T-2");
    expect(codes(signOff({ root, handover_id: hosted.handover_id, revision: 1, command_id: cmd(), actor: "owner", now: at(10) }))).toContain("not-available");
    recordAvailability({ root, handover_id: hosted.handover_id, revision: 1, available: true, build: "735d3881", command_id: cmd(), actor: "owner", now: at(11) });
    expect(signOff({ root, handover_id: hosted.handover_id, revision: 1, command_id: cmd(), actor: "owner", now: at(12) })).toMatchObject({ ok: true });
  });

  it("a cancelled run with no candidate shows No candidate and cannot be signed", () => {
    const root = tempRoot();
    const h: Loose = freezeHandover({ root, subject, content: content(), now: T0 }).handover;
    const view = viewOne({ root, handover_id: h.handover_id, contextFor: () => ({ run: { candidate_id: null, applied: false } }), now: at(1) })!;
    expect(view.acceptance.state).toBe("no-candidate");
    expect(view.blockers.map((blocker: Loose) => blocker.code)).toContain("no-candidate");
  });

  it("Apply, a green check and the test gate's Proceed anyway never stand in for it", () => {
    const root = tempRoot();
    const h = ready(root);
    // An applied candidate with a passed/override test-gate record: none of it is a UAT receipt.
    const gate = gateState({ applications: [{ application_id: "a-1", run_id: "r-1", state: "applied", created_at: T0, updated_at: T0 }], records: [{ application_id: "a-1", result: "failed", proceed: true }] });
    expect(gate.locked).toBe(false);
    expect(codes(sign(root, h))).toContain("required-not-passed");
    expect(readUat({ root }).receipts).toHaveLength(0);
  });

  it("a replacement candidate or revised content starts Pending again and leaves the earlier receipts readable", () => {
    const root = tempRoot();
    const h = ready(root);
    pass(root, h, "T-1");
    pass(root, h, "T-2");
    sign(root, h);
    const v2: Loose = freezeHandover({ root, subject, binding: bindRun(runCtx({ candidate_id: "cand-2" }).run), environment: { target: "local", build: "b2" }, content: content(), criteria: ["AC-1", "AC-2"], ready: true, now: at(40) });
    expect(v2.handover.revision).toBe(2);
    const view = viewOne({ root, handover_id: h.handover_id, contextFor: () => runCtx({ candidate_id: "cand-2" }), now: at(41) })!;
    expect(view.scenarios.map((entry: Loose) => entry.result)).toEqual(["pending", "pending"]);
    expect(view.acceptance.state).toBe("pending");
    expect(readUat({ root }).receipts.filter((row: Loose) => row.revision === 1)).toHaveLength(3);
    expect(recordResult({ root, handover_id: h.handover_id, revision: 1, scenario_id: "T-1", result: "pass", command_id: cmd(), actor: "owner", now: at(42) })).toMatchObject({ ok: false, refusals: [{ code: "stale-revision" }] });
  });

  it("a newer attempt for the same work supersedes an unaccepted older one", () => {
    const root = tempRoot();
    const older = ready(root);
    freezeHandover({ root, subject: { ...subject, run_id: "r-cccccccccccc" }, binding: bindRun({ candidate_id: "cand-9" }), environment: { target: "local" }, content: content(), criteria: ["AC-1", "AC-2"], ready: true, now: at(90) });
    const listed = listUat({ root, now: at(91) }).handovers;
    expect(listed.find((view: Loose) => view.handover_id === older.handover_id)!.acceptance.state).toBe("superseded");
  });
});

describe("feedback", () => {
  const base = (h: Loose, extra: Loose = {}) => ({ root: "", handover_id: h.handover_id, revision: h.revision, scenario_id: "T-1", step: 2, classification: "bug", observation: "Saved row never appeared", command_id: cmd(), actor: "owner", now: at(5), ...extra });

  it("saves a Needs-changes thread with the exact step and its expected result, and a repeat is the same thread", () => {
    const root = tempRoot();
    const h = ready(root);
    const input = base(h, { root, command_id: "fb-1" });
    const saved: Loose = submitFeedback(input);
    expect(saved).toMatchObject({ ok: true, feedback: { thread_id: expect.stringMatching(/^fb-/), revision: 1, step_action: "Select Save.", expected: "A saved row appears.", subject: { work_id: "BUD-83", campaign: "Budget" }, state: "submitted" } });
    expect(submitFeedback(input)).toMatchObject({ ok: true, repeated: true, feedback: { thread_id: saved.feedback.thread_id } });
    expect(readUat({ root }).feedback).toHaveLength(1);
  });

  it("blocks sign-off before any import, and a plain comment never does", () => {
    const root = tempRoot();
    const h = ready(root);
    pass(root, h, "T-1");
    pass(root, h, "T-2");
    submitFeedback(base(h, { root, classification: "comment", observation: "Nice" }));
    expect(signOff({ root, handover_id: h.handover_id, revision: 1, command_id: cmd(), actor: "owner", now: at(10), context: runCtx() })).toMatchObject({ ok: true });
    retractSignOff({ root, handover_id: h.handover_id, revision: 1, command_id: cmd(), actor: "owner", now: at(11) });
    const bug: Loose = submitFeedback(base(h, { root }));
    const refused: Loose = signOff({ root, handover_id: h.handover_id, revision: 1, command_id: cmd(), actor: "owner", now: at(12), context: runCtx() });
    expect(refused.refusals.map((refusal: Loose) => refusal.code)).toContain("feedback-unresolved");
    const view = viewOne({ root, handover_id: h.handover_id, contextFor: () => runCtx(), now: at(13) })!;
    expect(view.acceptance.state).toBe("needs-changes");
    expect(view.feedback.find((thread: Loose) => thread.thread_id === bug.feedback.thread_id)).toMatchObject({ import: { status: "saved" } });
  });

  it("new feedback on an accepted version reopens it to needs-changes without erasing the sign-off receipt", () => {
    const root = tempRoot();
    const h = ready(root);
    pass(root, h, "T-1");
    pass(root, h, "T-2");
    signOff({ root, handover_id: h.handover_id, revision: 1, command_id: cmd(), actor: "owner", now: at(10), context: runCtx() });
    submitFeedback(base(h, { root, now: at(30) }));
    const view = viewOne({ root, handover_id: h.handover_id, contextFor: () => runCtx(), now: at(31) })!;
    expect(view.acceptance).toEqual({ state: "needs-changes", shipped: false });
    expect(view.signoff).toMatchObject({ actor: "owner" });
  });

  it("amends the same thread, and withdrawal or an explicit disposition (with a reason) releases the gate", () => {
    const root = tempRoot();
    const h = ready(root);
    pass(root, h, "T-1");
    pass(root, h, "T-2");
    const first: Loose = submitFeedback(base(h, { root }));
    const amended: Loose = submitFeedback(base(h, { root, thread_id: first.feedback.thread_id, observation: "Row appears only after reload" }));
    expect(amended.feedback).toMatchObject({ thread_id: first.feedback.thread_id, revision: 2 });
    expect(viewOne({ root, handover_id: h.handover_id, now: at(6) })!.feedback).toHaveLength(1);
    expect(dispositionFeedback({ root, thread_id: first.feedback.thread_id, kind: "follow-up", reason: "", command_id: cmd(), actor: "owner", now: at(7) })).toMatchObject({ ok: false, refusals: [{ code: "reason-required" }] });
    expect(dispositionFeedback({ root, thread_id: first.feedback.thread_id, kind: "follow-up", reason: "Separate polish request", work_id: "BUD-90", command_id: cmd(), actor: "owner", now: at(7) })).toMatchObject({ ok: true });
    expect(signOff({ root, handover_id: h.handover_id, revision: 1, command_id: cmd(), actor: "owner", now: at(8), context: runCtx() })).toMatchObject({ ok: true });
    const second: Loose = submitFeedback(base(h, { root, command_id: cmd() }));
    expect(withdrawFeedback({ root, thread_id: second.feedback.thread_id, command_id: cmd(), actor: "owner", now: at(9) })).toMatchObject({ ok: true, feedback: { state: "withdrawn" } });
    expect(submitFeedback(base(h, { root, thread_id: second.feedback.thread_id }))).toMatchObject({ ok: false, refusals: [{ code: "thread-closed" }] });
  });

  it("a disposition cannot waive a failed required scenario", () => {
    const root = tempRoot();
    const h = ready(root);
    pass(root, h, "T-1");
    recordResult({ root, handover_id: h.handover_id, revision: 1, scenario_id: "T-2", result: "fail", note: "Broken", command_id: cmd(), actor: "owner", now: at(2) });
    const thread: Loose = submitFeedback(base(h, { root, scenario_id: "T-2" }));
    dispositionFeedback({ root, thread_id: thread.feedback.thread_id, kind: "follow-up", reason: "Later", command_id: cmd(), actor: "owner", now: at(3) });
    const refused: Loose = signOff({ root, handover_id: h.handover_id, revision: 1, command_id: cmd(), actor: "owner", now: at(4), context: runCtx() });
    expect(refused.refusals.map((refusal: Loose) => refusal.code)).toEqual(["required-not-passed"]);
  });

  it("validates classification, observation, scenario and step", () => {
    const root = tempRoot();
    const h = ready(root);
    expect(submitFeedback(base(h, { root, classification: "idea" }))).toMatchObject({ ok: false, refusals: [{ code: "classification-invalid" }] });
    expect(submitFeedback(base(h, { root, observation: "  " }))).toMatchObject({ ok: false, refusals: [{ code: "observation-required" }] });
    expect(submitFeedback(base(h, { root, scenario_id: "nope" }))).toMatchObject({ ok: false, refusals: [{ code: "unknown-scenario" }] });
    expect(submitFeedback(base(h, { root, step: 9 }))).toMatchObject({ ok: false, refusals: [{ code: "step-invalid" }] });
    expect(submitFeedback(base(h, { root, scenario_id: null, step: 1 }))).toMatchObject({ ok: false, refusals: [{ code: "step-invalid" }] });
  });

  it("shows the import journal's outcome on the thread", () => {
    const root = tempRoot();
    const h = ready(root);
    const thread: Loose = submitFeedback(base(h, { root }));
    const journal = join(root, ".pm", "uat-import.jsonl");
    expect(existsSync(journal)).toBe(false);
    expect(readImportStatus({ root })).toEqual({});
    const id = thread.feedback.thread_id;
    const importStatus = { [id]: { status: "imported", workId: "BUD-90", campaign: "Budget" } };
    expect(viewOne({ root, handover_id: h.handover_id, importStatus, now: at(9) })!.feedback[0].import).toMatchObject({ status: "imported", workId: "BUD-90" });
  });
});

describe("wizard drafts", () => {
  it("save position and notes with compare-and-set, and read stale once the handover revision moves", () => {
    const root = tempRoot();
    const h = ready(root);
    const first: Loose = saveDraft({ root, handover_id: h.handover_id, revision: 1, position: { scenario_id: "T-1", step: 2 }, notes: { "T-1": "Row missing" }, base_rev: 0, now: at(1) });
    expect(first).toMatchObject({ ok: true, rev: 1 });
    expect(saveDraft({ root, handover_id: h.handover_id, revision: 1, position: null, notes: {}, base_rev: 0, now: at(2) })).toMatchObject({ ok: false, refusals: [{ code: "draft-conflict" }] });
    expect(viewOne({ root, handover_id: h.handover_id, now: at(3) })!.draft).toMatchObject({ position: { scenario_id: "T-1", step: 2 }, notes: { "T-1": "Row missing" }, rev: 1 });
    freezeHandover({ root, subject, binding: bindRun(runCtx({ candidate_id: "cand-2" }).run), environment: { target: "local" }, content: content(), criteria: ["AC-1", "AC-2"], ready: true, now: at(4) });
    const view = viewOne({ root, handover_id: h.handover_id, now: at(5) })!;
    expect(view.draft).toBeNull();
    expect(view.staleDraft).toBe(true);
    expect(readUat({ root }).receipts).toHaveLength(0);
  });
});

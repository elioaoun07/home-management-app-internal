// R76 / R78 — the UAT wizard's pure model, the Delivery home grouping and the
// server-rendered wizard markup. Interactions (Back / Next, Save, dialogs) are
// checked in a real browser; no DOM library is installed here.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { groupDelivery } from "../../scripts/pm/app/deliveryHomeModel";
import {
  blockerText,
  clearPending,
  clampPosition,
  deviceLabel,
  feedbackDefaults,
  feedbackState,
  forRun,
  groupUat,
  reviewUat,
  uatReviewGroup,
  initialPosition,
  listPending,
  move,
  needsTest,
  noteRequired,
  progress,
  readLocalDraft,
  readPending,
  runUatLabel,
  staleLocalDraft,
  uatLabel,
  workHref,
  writeLocalDraft,
  writePending,
} from "../../scripts/pm/app/uatModel";
import { Wizard } from "../../scripts/pm/app/UatWizard";
import type { UatFeedbackThread, UatHandover, UatSummary, V2RunSummary } from "../../scripts/pm/app/types";

const at = (minutes: number) => new Date(Date.parse("2026-10-25T10:00:00.000Z") + minutes * 60_000).toISOString();

const scenario = (id: string, result: UatHandover["scenarios"][number]["result"] = "pending", extra: Partial<UatHandover["scenarios"][number]> = {}) => ({
  id,
  title: `Scenario ${id}`,
  purpose: "feature",
  required: true,
  criteria: [],
  draft: false,
  setup: "",
  starting: "",
  steps: [
    { action: `Open the ${id} address.`, expected: "The home screen appears." },
    { action: "Select Save.", expected: "A saved row appears." },
    { action: "Reload.", expected: "The row remains." },
  ],
  defect: null,
  cleanup: "None — read-only",
  limits: null,
  result,
  receipt: null,
  attempts: 0,
  ...extra,
});
function handover(extra: Partial<UatHandover> = {}): UatHandover {
  return {
    handover_id: "uat-1",
    revision: 1,
    revisions: 1,
    status: "ready",
    subject: { type: "run", run_id: "r-1", delivery_ref: "run:r-1", work_id: "BUD-83", campaign: "Budget", title: "Remove a pending split" },
    binding: { kind: "candidate", candidate_id: "cand-1" },
    environment: { target: "local", build: "b1", url: null, device: null },
    created_at: at(0),
    summary: "",
    setup: "Use the isolated test account.",
    limits: "",
    problems: [],
    counts: { pass: 0, fail: 0, blocked: 0, pending: 2 },
    availability: { state: "available", evidence: "applied" },
    stale: false,
    acceptance: { state: "pending", shipped: false },
    signoff: null,
    signable: false,
    blockers: [{ code: "required-not-passed", detail: ["A", "B"] }],
    feedback: [],
    draft: null,
    staleDraft: false,
    draftRev: 0,
    supersededBy: null,
    scenarios: [scenario("A"), scenario("B")],
    ...extra,
  };
}
const summary = (extra: Partial<Omit<UatSummary, "scenarios">> & { scenarios?: UatHandover["scenarios"] } = {}): UatSummary => {
  const full = handover(extra);
  return { ...full, scenarios: full.scenarios.map((entry) => ({ id: entry.id, title: entry.title, required: entry.required, result: entry.result, draft: entry.draft, steps: entry.steps.length })) };
};
const thread = (extra: Partial<UatFeedbackThread> = {}): UatFeedbackThread => ({
  thread_id: "fb-1",
  state: "submitted",
  classification: "bug",
  urgency: "next",
  revision: 1,
  handover_revision: 1,
  scenario_id: "A",
  step: 2,
  observation: "No saved row appeared",
  expected: "A saved row appears.",
  actual: "",
  received_at: at(1),
  undoable_until: at(3),
  disposition: null,
  import: null,
  ...extra,
});

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
}
beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("labels and grouping", () => {
  it("keeps drafts and incomplete instructions discoverable without offering sign-off", () => {
    const draft = summary({ status: "draft", subject: { type: "direct", run_id: null, delivery_ref: "direct:R80", work_id: "R80", campaign: "PM Tooling", title: "Restore browser access" } });
    const incomplete = summary({ handover_id: "incomplete", status: "incomplete" });
    const stale = summary({ handover_id: "stale", stale: true });
    const feedback = summary({ handover_id: "feedback", acceptance: { state: "needs-changes", shipped: false } });
    const superseded = summary({ handover_id: "old-draft", status: "draft", acceptance: { state: "superseded", shipped: false } });
    const list = [draft, incomplete, stale, feedback, superseded, summary({ handover_id: "ready" })];
    expect(list.map(uatReviewGroup)).toEqual(["not-ready", "not-ready", "not-ready", "feedback", "history", "to-test"]);
    expect(reviewUat(list, "all", "r80")).toEqual([draft]);
    expect(reviewUat(list, "not-ready", "browser PM")).toEqual([draft]);
    expect(reviewUat(list, "to-test", "R80")).toEqual([]);
  });

  it("says Draft or Incomplete before any acceptance word, and Test / Testing / Shipped after", () => {
    expect(uatLabel({ status: "draft", acceptance: { state: "pending", shipped: false } })).toBe("Draft");
    expect(uatLabel({ status: "incomplete", acceptance: { state: "pending", shipped: false } })).toBe("Incomplete");
    expect(uatLabel(summary())).toBe("Test");
    expect(uatLabel(summary({ acceptance: { state: "in-progress", shipped: false } }))).toBe("Testing");
    expect(uatLabel(summary({ acceptance: { state: "accepted", shipped: true } }))).toBe("Shipped");
    expect(uatLabel(summary({ acceptance: { state: "needs-changes", shipped: false } }))).toBe("Needs changes");
    expect(uatLabel(summary({ acceptance: { state: "no-candidate", shipped: false } }))).toBe("No candidate");
  });

  it("counts required passes only", () => {
    const item = summary({ scenarios: [scenario("A", "pass"), scenario("B", "fail"), scenario("C", "pass", { required: false })] });
    expect(progress(item)).toEqual({ done: 1, total: 2 });
  });

  it("only a ready, current handover waiting on the owner is a Test row; drafts and finished records are records", () => {
    const list = [
      summary({ handover_id: "ready", created_at: at(3) }),
      summary({ handover_id: "testing", created_at: at(5), acceptance: { state: "in-progress", shipped: false } }),
      summary({ handover_id: "draft", status: "draft", created_at: at(4) }),
      summary({ handover_id: "stale", stale: true, created_at: at(2) }),
      summary({ handover_id: "shipped", acceptance: { state: "accepted", shipped: true }, created_at: at(1) }),
      summary({ handover_id: "changes", acceptance: { state: "needs-changes", shipped: false }, created_at: at(6) }),
    ];
    const { needs, records } = groupUat(list);
    expect(needs.map((item) => item.handover_id)).toEqual(["testing", "ready"]);
    expect(records.map((item) => item.handover_id)).toEqual(["changes", "draft", "stale", "shipped"]);
    expect(needs.length + records.length).toBe(list.length);
    expect(needsTest(list[3])).toBe(false);
  });

  it("finds the newest handover for a run and words an Earlier-deliveries row without one", () => {
    const list = [summary({ handover_id: "old", created_at: at(1) }), summary({ handover_id: "new", created_at: at(9) }), summary({ handover_id: "other", subject: { type: "run", run_id: "r-2", delivery_ref: "run:r-2", work_id: "X-1", campaign: "Budget", title: null } })];
    expect(forRun(list, "r-1")?.handover_id).toBe("new");
    expect(forRun(undefined, "r-1")).toBeUndefined();
    expect(runUatLabel({ closed_outcome: "cancelled", application: null }, undefined)).toBe("No candidate");
    expect(runUatLabel({ closed_outcome: "verified_candidate", application: null }, undefined)).toBe("UAT unrecorded");
    expect(runUatLabel({ closed_outcome: "failed", application: null }, undefined)).toBeNull();
    expect(runUatLabel({ closed_outcome: "verified_candidate", application: null }, list[1])).toBe("Test");
  });

  it("words each sign-off blocker briefly", () => {
    expect(blockerText({ code: "required-not-passed", detail: ["A", "B"] })).toBe("2 to pass");
    expect(blockerText({ code: "not-available", detail: "awaiting" })).toBe("Build not confirmed");
    expect(blockerText({ code: "feedback-unresolved", detail: [] })).toBe("Feedback open");
    expect(blockerText({ code: "something-new", detail: null })).toBe("something-new");
  });
});

describe("Delivery home", () => {
  const closed = (run_id: string, extra: Partial<V2RunSummary> = {}) =>
    ({ run_id, engine: "v2", title: `${run_id} Title`, alias: run_id.toUpperCase(), file: null, campaign: "Budget", lifecycle: "CLOSED", closed_outcome: "verified_candidate", waiting_reason: null, executor: "codex", model: null, effort: null, stage: "x", branch: null, active: false, ownerAction: "Applied", created_at: at(0), updated_at: at(0), ...extra }) as V2RunSummary;

  it("lists a delivery awaiting the owner's test once, under Needs you, and not again in Earlier deliveries", () => {
    const groups = groupDelivery({ v2Runs: [closed("r-1"), closed("r-2")], requests: [], v1Runs: [], uat: [summary(), summary({ handover_id: "uat-9", status: "draft", subject: { type: "run", run_id: "r-2", delivery_ref: "run:r-2", work_id: "X-2", campaign: "Budget", title: null } })] });
    expect(groups.needs.map((row) => row.kind)).toEqual(["uat"]);
    expect(groups.past.map((entry) => (entry.row.kind === "v2" ? entry.row.run.run_id : ""))).toEqual(["r-2"]);
    expect(groups.records.map((item) => item.handover_id)).toEqual(["uat-9"]);
  });

  it("keeps a known pending test when the queue is unavailable, and changes nothing when there are no tests", () => {
    const withTest = groupDelivery({ v2Runs: [closed("r-1")], queue: null, requests: [], v1Runs: [], uat: [summary()] });
    expect(withTest.needs).toHaveLength(1);
    const without = groupDelivery({ v2Runs: [closed("r-1")], requests: [], v1Runs: [] });
    expect(without.needs).toHaveLength(0);
    expect(without.records).toEqual([]);
    expect(without.past).toHaveLength(1);
  });
});

describe("step navigation", () => {
  const h = handover();
  it("starts at the first scenario that is not yet passed, or at the saved place", () => {
    expect(initialPosition(handover({ scenarios: [scenario("A", "pass"), scenario("B")] }))).toEqual({ scenario_id: "B", step: 0 });
    expect(initialPosition(handover({ draft: { position: { scenario_id: "B", step: 2 }, notes: {}, rev: 1, saved_at: at(0) } }))).toEqual({ scenario_id: "B", step: 2 });
    expect(initialPosition(handover({ draft: { position: { scenario_id: "gone", step: 2 }, notes: {}, rev: 1, saved_at: at(0) } }))).toEqual({ scenario_id: "A", step: 0 });
    expect(clampPosition(h, { scenario_id: "A", step: 99 })).toEqual({ scenario_id: "A", step: 2 });
  });

  it("moves step by step, then scenario to scenario, and stops at either end", () => {
    expect(move(h, { scenario_id: "A", step: 0 }, 1)).toEqual({ scenario_id: "A", step: 1 });
    expect(move(h, { scenario_id: "A", step: 2 }, 1)).toEqual({ scenario_id: "B", step: 0 });
    expect(move(h, { scenario_id: "B", step: 0 }, -1)).toEqual({ scenario_id: "A", step: 2 });
    expect(move(h, { scenario_id: "A", step: 0 }, -1)).toBeNull();
    expect(move(h, { scenario_id: "B", step: 2 }, 1)).toBeNull();
  });

  it("asks for a note on Fail and Blocked only, and prefills the report from the failed step", () => {
    expect(noteRequired("fail")).toBe(true);
    expect(noteRequired("blocked")).toBe(true);
    expect(noteRequired("pass")).toBe(false);
    const failed = handover({ scenarios: [scenario("A", "fail"), scenario("B")] });
    expect(feedbackDefaults(failed, { scenario_id: "A", step: 1 })).toMatchObject({ classification: "bug", scenario_id: "A", step: 2, action: "Select Save.", expected: "A saved row appears." });
    expect(feedbackDefaults(failed, { scenario_id: "B", step: 0 }).classification).toBe("change");
  });
});

describe("feedback receipts", () => {
  it("shows Feedback saved until the import commits, then the work ID with an Open work link", () => {
    const now = Date.parse(at(2));
    expect(feedbackState(thread(), now)).toEqual({ label: "Feedback saved", tone: "wait", undo: true });
    expect(feedbackState(thread(), Date.parse(at(4))).undo).toBe(false);
    expect(feedbackState(thread({ import: { status: "importing" } }), now).label).toBe("Importing");
    const imported = thread({ import: { status: "imported", workId: "BUD-91", campaign: "Budget" } });
    expect(feedbackState(imported, now).label).toBe("Work BUD-91");
    expect(workHref(imported)).toBe("#/work/Budget/BUD-91");
    expect(workHref(thread())).toBeNull();
    expect(feedbackState(thread({ import: { status: "blocked", cause: "no campaign" } }), now).tone).toBe("warn");
    expect(feedbackState(thread({ state: "withdrawn" }), now).label).toBe("Withdrawn");
    expect(feedbackState(thread({ classification: "comment" }), now).label).toBe("Comment saved");
  });
});

describe("durable local copies", () => {
  it("restores a draft for the same revision only and calls an older one stale", () => {
    const store = new MemoryStorage();
    writeLocalDraft(store, { handover_id: "uat-1", revision: 1 }, { position: { scenario_id: "A", step: 2 }, notes: { A: "typed" } });
    expect(readLocalDraft(store, { handover_id: "uat-1", revision: 1 })).toMatchObject({ position: { scenario_id: "A", step: 2 }, notes: { A: "typed" } });
    expect(readLocalDraft(store, { handover_id: "uat-1", revision: 2 })).toBeNull();
    expect(staleLocalDraft(store, { handover_id: "uat-1", revision: 2 })).toBe(true);
    expect(staleLocalDraft(store, { handover_id: "uat-1", revision: 1 })).toBe(false);
  });

  it("keeps an unconfirmed command with its id until a receipt clears it", () => {
    const store = new MemoryStorage();
    writePending(store, "uat-1", "feedback", { command_id: "c-1", body: { action: "feedback" } });
    writePending(store, "uat-1", "result:A", { command_id: "c-2", body: { action: "result" } });
    writePending(store, "uat-2", "feedback", { command_id: "c-3", body: {} });
    expect(listPending(store, "uat-1").map((entry) => entry.intent).sort()).toEqual(["feedback", "result:A"]);
    expect(readPending(store, "uat-1", "feedback")?.command_id).toBe("c-1");
    clearPending(store, "uat-1", "feedback");
    expect(readPending(store, "uat-1", "feedback")).toBeNull();
    expect(listPending(store, "uat-1")).toHaveLength(1);
  });

  it("works without storage", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); }, key: () => null, length: 0 };
    expect(readLocalDraft(broken, { handover_id: "uat-1", revision: 1 })).toBeNull();
    expect(() => writeLocalDraft(broken, { handover_id: "uat-1", revision: 1 }, { position: { scenario_id: "A", step: 0 }, notes: {} })).not.toThrow();
    expect(listPending(broken, "uat-1")).toEqual([]);
  });
});

describe("the wizard markup", () => {
  const render = (h: UatHandover, offline = false) => renderToStaticMarkup(createElement(Wizard, { handover: h, refreshError: null, offline }));

  it("opens on the first unpassed step with its action, expected result and the three result choices", () => {
    const html = render(handover());
    expect(html).toContain("Remove a pending split");
    expect(html).toContain("Step 1 of 3");
    expect(html).toContain("Open the A address.");
    expect(html).toContain("The home screen appears.");
    expect(html).toContain("Pass");
    expect(html).toContain("Fail");
    expect(html).toContain("Blocked");
    expect(html).toContain("All steps");
    expect(html).toContain("Needs changes");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*(?:<[^>]+>)*Sign off/u);
    expect(html).toContain("2 to pass");
  });

  it("enables Sign off only when the server says it is signable", () => {
    const html = render(handover({ signable: true, blockers: [] }));
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>[^<]*(?:<[^>]+>)*Sign off/u);
  });

  it("labels a Draft and offers no result controls or sign-off against it", () => {
    const html = render(handover({ status: "draft", signable: false, blockers: [{ code: "handover-draft", detail: null }] }));
    expect(html).toContain(">Draft<");
    expect(html).toContain("Step 1 of 3");
    expect(html).toContain("Mark ready");
    expect(html).not.toContain("uat-result-buttons");
  });

  it("shows an incomplete handover's problems and no steps to run", () => {
    const html = render(handover({ status: "incomplete", scenarios: [], problems: [{ code: "step-missing-expectation", detail: null, scenario: "A", step: 3 }] }));
    expect(html).toContain(">Incomplete<");
    expect(html).toContain("A · step 3 step missing expectation");
    expect(html).not.toContain("Step 1 of");
    expect(html).not.toContain("uat-card");
  });

  it("shows the sign-off receipt and Retract once accepted, with no result controls", () => {
    const html = render(handover({ acceptance: { state: "accepted", shipped: true }, signoff: { receipt_id: "rc-1", actor: "owner", received_at: at(50), build: "b1", environment: "local" }, scenarios: [scenario("A", "pass"), scenario("B", "pass")] }));
    expect(html).toContain("Shipped");
    expect(html).toContain("Retract");
    expect(html).not.toContain("uat-result-buttons");
  });

  it("marks a stale candidate and an outdated draft, and an offline browser", () => {
    const html = render(handover({ stale: true, staleDraft: true }), true);
    expect(html).toContain(">Stale<");
    expect(html).toContain("Outdated draft");
    expect(html).toContain(">Offline<");
  });

  it("lists saved feedback with the receipt state and the work link once imported", () => {
    const html = render(handover({ feedback: [thread({ thread_id: "fb-1" }), thread({ thread_id: "fb-2", observation: "Second", import: { status: "imported", workId: "BUD-91", campaign: "Budget" } })] }));
    expect(html).toContain("Feedback saved");
    expect(html).toContain("Work BUD-91");
    expect(html).toContain('href="#/work/Budget/BUD-91"');
    expect(html).toContain("Open work");
    expect(html).toContain("Withdraw");
  });

  it("is labelled for assistive technology and keyboard order, without a number input", () => {
    const html = render(handover());
    expect(html).toContain('aria-label="Scenarios"');
    expect(html).toContain('aria-label="Result"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-current="step"');
    expect(html).not.toContain('type="number"');
  });
});

describe("device label", () => {
  it("keeps the browser and system, not the whole user-agent string", () => {
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36")).toBe("Chrome 155 · Windows");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari 18 · iPhone");
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0.0.0 Mobile Safari/537.36")).toBe("Chrome 141 · Android");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/133.0")).toBe("Firefox 133 · Windows");
    expect(deviceLabel("")).toBe("Browser");
  });
});

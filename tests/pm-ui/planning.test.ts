import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { applyPlanningCommand, emptyPlanning, validatePlanning } from "../../scripts/pm/shared/planning.mjs";
import { acquirePlanningWriteLock, buildPlanningFacts, observePlanningProgress, planningCommandState, planningSnapshot, readPlanning, routePlanning, writePlanningCommand } from "../../scripts/pm/planning.mjs";
import { issuePairingCode, pairBridgeSession, pairSession, sessionCookie, sessionView } from "../../scripts/delivery-v2/local-auth.mjs";
import { assembleSnapshot } from "../../scripts/pm/relay-shared.mjs";
import { buildCorpusRows, createCommandJournal, executePlanningCommand, reconcileClaimedCommand } from "../../scripts/pm/relay.mjs";

const NOW = "2026-10-05T07:00:00.000Z";
const DATA = {
  generatedAt: NOW,
  cancelledLog: "",
  files: [
    { relPath: "Budget/4 - Checklist.md", raw: "# Checklist\n## Now\n- [ ] **BUD-1** Totals _(friction - S)_\n- [ ] **BUD-2** Follow totals _(friction - M)_" },
    { relPath: "Budget/Budget — Master Book.md", raw: "# Budget\n## Purpose & ownership\nKeep totals.\n## Acceptance Criteria Index\n### BUD-1\n**Outcome:** Correct totals.\n**Acceptance:** Totals are correct.\n### BUD-2\n**Outcome:** Follow totals.\n**Acceptance:** Display total.\n**Depends on:** BUD-1\n## Shipped Log\n" },
  ],
};
const facts = () => buildPlanningFacts(DATA);
const witnesses = (current = facts()) => Object.fromEntries(Object.entries(current).flatMap(([key, fact]) => fact.criteriaRevision ? [[key, fact.criteriaRevision]] : []));
const member = (workId = "BUD-1") => ({ workId, origin: { file: "Budget/4 - Checklist.md", alias: workId }, points: 1, reviewMinutes: 15 });
const draft = (id = "sprint-1") => ({ id, name: "Totals week", goal: "Reliable totals", startDate: "2026-10-05", endExclusive: "2026-10-12", timezone: "Asia/Beirut", strategy: "balanced" as const, capacity: { unit: "points" as const, available: 6, reviewMinutes: 90 }, members: [member()] });
const base = (revision = 0) => ({ command_id: randomUUID(), expectedRevision: revision });
const saved = () => applyPlanningCommand(emptyPlanning(), { ...base(), action: "save", sprint: draft() }, { facts: facts(), now: NOW });
const active = () => applyPlanningCommand(saved(), { ...base(1), action: "start", sprintId: "sprint-1", criteriaRevisions: witnesses() }, { facts: facts(), now: NOW });
const temporary: string[] = [];
function workspace() {
  const root = mkdtempSync(join(tmpdir(), "era-planning-"));
  temporary.push(root);
  const pmDir = join(root, "pm");
  mkdirSync(pmDir);
  return { root, pmDir, data: DATA };
}
afterEach(() => {
  for (const root of temporary.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir()) + "\\era-planning-") && !resolve(root).startsWith(resolve(tmpdir()) + "/era-planning-")) throw new Error("Refuse cleanup outside test workspace");
    rmSync(root, { recursive: true, force: true });
  }
});

describe("references-only weekly planning", () => {
  it("validates calendar days, timezone, duplicate references and copied backlog fields", () => {
    for (const sprint of [
      { ...draft(), startDate: "2026-02-30" },
      { ...draft(), timezone: "Earth/Unknown" },
      { ...draft(), endExclusive: "2026-10-04" },
      { ...draft(), members: [member(), member()] },
      { ...draft(), members: [{ ...member(), title: "Copied backlog" }] },
    ]) expect(() => applyPlanningCommand(emptyPlanning(), { ...base(), action: "save", sprint }, { facts: facts() })).toThrow();
    const result = saved();
    expect(result.sprints[0].members[0]).not.toHaveProperty("title");
    expect(result.sprints[0].startDate).toBe("2026-10-05");
    expect(result.sprints[0].timezone).toBe("Asia/Beirut");
  });

  it("upserts multiple drafts atomically and rejects stale revision or missing work", () => {
    const result = applyPlanningCommand(emptyPlanning(), { ...base(), action: "save-many", sprints: [draft(), draft("sprint-2")] }, { facts: facts() });
    expect(result.revision).toBe(1);
    expect(result.sprints).toHaveLength(2);
    expect(() => applyPlanningCommand(result, { ...base(), action: "save", sprint: draft() }, { facts: facts() })).toThrow(/changed/);
    expect(() => applyPlanningCommand(result, { ...base(1), action: "save", sprint: { ...draft(), members: [member("BUD-99")] } }, { facts: facts() })).toThrow(/no longer open/);
  });

  it("replans a shorter horizon atomically without leaving superseded draft members", () => {
    const planned = applyPlanningCommand(emptyPlanning(), { ...base(), action: "save-many", sprints: [draft(), draft("sprint-2"), draft("outside-range")] }, { facts: facts(), now: NOW });
    const command = { ...base(1), action: "save-many", sprints: [draft()], replaceDraftIds: ["sprint-1", "sprint-2"] };
    const replaced = applyPlanningCommand(planned, command, { facts: facts(), now: NOW });
    expect(replaced.revision).toBe(2);
    expect(replaced.sprints.map((sprint) => sprint.id).sort()).toEqual(["outside-range", "sprint-1"]);
    expect(planned.sprints).toHaveLength(3);
    expect(() => applyPlanningCommand(replaced, { ...command, command_id: randomUUID() }, { facts: facts(), now: NOW })).toThrow(/changed/);
    const cleared = applyPlanningCommand(replaced, { ...base(2), action: "save-many", sprints: [], replaceDraftIds: ["sprint-1"] }, { facts: facts(), now: NOW });
    expect(cleared.sprints.map((sprint) => sprint.id)).toEqual(["outside-range"]);
    expect(() => applyPlanningCommand(planned, { ...base(1), action: "save-many", sprints: [], replaceDraftIds: ["missing"] }, { facts: facts(), now: NOW })).toThrow(/no longer a draft/);
  });

  it("never replaces active or closed commitments in a draft replan", () => {
    const started = active();
    const command = { ...base(2), action: "save-many", sprints: [draft("new")], replaceDraftIds: ["sprint-1"] };
    expect(() => applyPlanningCommand(started, command, { facts: facts(), now: NOW })).toThrow(/no longer a draft/);
    expect(started.sprints[0].state).toBe("active");
    const closed = applyPlanningCommand(started, { ...base(2), action: "close", sprintId: "sprint-1" }, { facts: facts(), now: NOW });
    expect(() => applyPlanningCommand(closed, { ...command, ...base(3) }, { facts: facts(), now: NOW })).toThrow(/no longer a draft/);
    expect(closed.sprints[0].state).toBe("closed");
  });

  it("freezes commitment and prevents concurrent active sprints", () => {
    const started = active();
    expect(started.sprints[0].commitment?.members[0].criteriaRevision).toBe(facts()["BUD-1"].criteriaRevision);
    expect(() => applyPlanningCommand(started, { ...base(2), action: "save", sprint: draft() }, { facts: facts() })).toThrow(/frozen/);
    const second = applyPlanningCommand(started, { ...base(2), action: "save", sprint: draft("sprint-2") }, { facts: facts() });
    expect(() => applyPlanningCommand(second, { ...base(3), action: "start", sprintId: "sprint-2", criteriaRevisions: witnesses() }, { facts: facts() })).toThrow(/one sprint/);
    const modified = structuredClone(started);
    modified.sprints[0].members[0].points = 99;
    expect(() => validatePlanning(modified)).toThrow(/history/);
  });

  it.each([
    { points: 1, reviewMinutes: null },
    { points: null, reviewMinutes: 15 },
    { points: null, reviewMinutes: null },
    { points: 10, reviewMinutes: 120 },
  ])("starts with optional or over-capacity estimates and preserves them: %j", (estimates) => {
    const result = applyPlanningCommand(emptyPlanning(), { ...base(), action: "save", sprint: { ...draft(), members: [{ ...member(), ...estimates }] } }, { facts: facts(), now: NOW });
    const started = applyPlanningCommand(result, { ...base(1), action: "start", sprintId: "sprint-1", criteriaRevisions: witnesses() }, { facts: facts(), now: NOW });
    expect(started.sprints[0].state).toBe("active");
    expect(validatePlanning(JSON.parse(JSON.stringify(started))).sprints[0].commitment?.members[0]).toMatchObject(estimates);
    const closed = applyPlanningCommand(started, { ...base(2), action: "close", sprintId: "sprint-1" }, { facts: facts(), now: NOW });
    expect(closed.sprints[0].closed?.carryover).toEqual(["BUD-1"]);
  });

  it("still requires an explicit size for unsplit large work", () => {
    const current = facts();
    current["BUD-1"].effort = "L";
    current["BUD-1"].reasons = [{ code: "size-needs-split" }];
    const result = applyPlanningCommand(emptyPlanning(), { ...base(), action: "save", sprint: { ...draft(), members: [{ ...member(), points: null, reviewMinutes: null, estimateSource: "override" }] } }, { facts: current, now: NOW });
    expect(() => applyPlanningCommand(result, { ...base(1), action: "start", sprintId: "sprint-1", criteriaRevisions: witnesses(current) }, { facts: current, now: NOW })).toThrow(/Split or estimate large work/);
  });

  it("allows planned dependencies, but refuses cycles and unmet outside prerequisites", () => {
    const dependentOnly = applyPlanningCommand(emptyPlanning(), { ...base(), action: "save", sprint: { ...draft(), members: [member("BUD-2")] } }, { facts: facts() });
    expect(() => applyPlanningCommand(dependentOnly, { ...base(1), action: "start", sprintId: "sprint-1", criteriaRevisions: witnesses() }, { facts: facts() })).toThrow(/dependency-open/);
    const together = applyPlanningCommand(emptyPlanning(), { ...base(), action: "save", sprint: { ...draft(), members: [member(), member("BUD-2")] } }, { facts: facts() });
    expect(applyPlanningCommand(together, { ...base(1), action: "start", sprintId: "sprint-1", criteriaRevisions: witnesses() }, { facts: facts() }).sprints[0].state).toBe("active");
    const cyclic = structuredClone(DATA);
    cyclic.files[1].raw = cyclic.files[1].raw.replace("### BUD-2", "**Depends on:** BUD-2\n### BUD-2");
    const cycleFacts = buildPlanningFacts(cyclic);
    expect(cycleFacts["BUD-1"].reasons).toContainEqual({ code: "dependency-cycle", with: "BUD-1" });
    expect(() => applyPlanningCommand(together, { ...base(1), action: "start", sprintId: "sprint-1", criteriaRevisions: witnesses(cycleFacts) }, { facts: cycleFacts })).toThrow(/dependency-cycle/);
  });

  it("preserves scope changes, cancellations apart from delivery, and explicit carryover", () => {
    const changed = applyPlanningCommand(active(), { ...base(2), action: "add-member", sprintId: "sprint-1", member: member("BUD-2"), criteriaRevisions: witnesses() }, { facts: facts(), now: NOW });
    expect(changed.sprints[0].scopeChanges[0].action).toBe("add");
    const closed = applyPlanningCommand(changed, { ...base(3), action: "close", sprintId: "sprint-1" }, { facts: { ...facts(), "BUD-1": { ...facts()["BUD-1"], status: "cancelled" } }, now: NOW });
    expect(closed.sprints[0].closed).toEqual({ at: NOW, delivered: [], cancelled: ["BUD-1"], carryover: ["BUD-2"] });
    expect(closed.sprints).toHaveLength(1);
    const next = applyPlanningCommand(closed, { ...base(4), action: "save", sprint: { ...draft("sprint-2"), members: [] } }, { facts: facts(), now: NOW });
    const carried = applyPlanningCommand(next, { ...base(5), action: "carryover", fromSprintId: "sprint-1", sprintId: "sprint-2", workIds: ["BUD-2"] }, { facts: facts(), now: NOW });
    expect(carried.sprints[1].members.map((entry) => entry.workId)).toEqual(["BUD-2"]);
    expect(carried.sprints[0].closed).toEqual(closed.sprints[0].closed);
    const removed = applyPlanningCommand(changed, { ...base(3), action: "remove-member", sprintId: "sprint-1", workId: "BUD-2" }, { facts: facts(), now: NOW });
    expect(removed.sprints[0].scopeChanges.map((change) => change.action)).toEqual(["add", "remove"]);
    const corrupt = structuredClone(removed);
    corrupt.sprints[0].scopeChanges = [];
    expect(() => validatePlanning({ ...corrupt, sprints: [{ ...corrupt.sprints[0], members: [] }] })).toThrow(/history/);
  });

  it("resolves only exact IDs in declared plan dependencies through canonical prerequisite states", () => {
    const data = structuredClone(DATA);
    data.files[0].raw += "\n- [ ] **HUB-43** Inline actions _(friction - M)_\n- [ ] **HUB-38** History _(friction - S)_\n- [ ] **HUB-42** Targets _(friction - S)_\n- [x] **HUB-40** Checked prerequisite _(friction - S)_";
    data.files[1].raw = data.files[1].raw.replace("## Shipped Log", [
      "### HUB-43",
      "**Acceptance:** Actions follow known targets.",
      "**Provenance:** Audit.",
      "<!--\n```delivery-plan-v1\n{\"dependencies\":[\"HUB-86\"]}\n```\n-->",
      "```delivery-plan-v1",
      JSON.stringify({ dependencies: ["HUB-38/42 for targets; HUB-39, HUB-40, HUB-41, HUB-44", "HUB-43 self, HUB-4.3bx invalid suffix and #hub-85 anchor are not prerequisites"], unknowns: ["HUB-87"], scope: ["HUB-88"], comments: ["HUB-89"] }),
      "```",
      "## Shipped Log",
      "- ✅ 2026-10-04 — **HUB-39** Archived prerequisite.",
    ].join("\n"));
    data.cancelledLog = "# Cancelled Log\n## Budget\n- ❌ 2026-10-04 — **HUB-41** Cancelled prerequisite.\n";
    const current = buildPlanningFacts(data)["HUB-43"];
    expect(current.dependencies).toEqual(["HUB-38", "HUB-42", "HUB-39", "HUB-40", "HUB-41", "HUB-44"]);
    expect(current.state).toBe("blocked");
    expect(current.reasons).toEqual([
      { code: "dependency-open", with: "HUB-38" },
      { code: "dependency-open", with: "HUB-42" },
      { code: "dependency-cancelled", with: "HUB-41" },
      { code: "dependency-unresolved", with: "HUB-44" },
    ]);
  });

  it("refreshes canonical completion, cancellation and criteria without storing copied state", () => {
    const changed = structuredClone(DATA);
    changed.files[0].raw = changed.files[0].raw.replace("[ ] **BUD-1**", "[x] **BUD-1**");
    changed.files[1].raw += "- ✅ 2026-10-06 — **BUD-9** Archived.\n";
    const changedFacts = buildPlanningFacts(changed);
    expect(changedFacts["BUD-1"].status).toBe("completed");
    expect(changedFacts["BUD-9"].status).toBe("completed");
    expect(changedFacts["BUD-2"].reasons).not.toContainEqual({ code: "dependency-open", with: "BUD-1" });
    changed.files[1].raw = changed.files[1].raw.replace("Totals are correct.", "Totals retain rounding.");
    expect(buildPlanningFacts(changed)["BUD-1"].criteriaRevision).not.toBe(facts()["BUD-1"].criteriaRevision);
    changed.files[0].raw = changed.files[0].raw.replace(/- \[x\] \*\*BUD-1\*\*[^\n]*\n/u, "");
    expect(buildPlanningFacts(changed)["BUD-1"]).toBeUndefined();
  });

  it.each(["held", "completed", "missing"])("restores historical membership when current work is %s", (status) => {
    const started = active();
    const removed = applyPlanningCommand(started, { ...base(2), action: "remove-member", sprintId: "sprint-1", workId: "BUD-1" }, { facts: facts(), now: NOW });
    const current = status === "missing" ? {} : { ...facts(), "BUD-1": { ...facts()["BUD-1"], criteriaRevision: "changed-since-removal", ...(status === "completed" ? { status: "completed" } : { state: "blocked", reasons: [{ code: "held", with: null }] }) } };
    const restored = applyPlanningCommand(removed, { ...base(3), action: "restore-member", sprintId: "sprint-1", workId: "BUD-1" }, { facts: current, now: NOW });
    expect(restored.sprints[0].members).toEqual(started.sprints[0].members);
    expect(restored.sprints[0].scopeChanges.at(-1)).toEqual({ at: NOW, action: "add", workId: "BUD-1", member: started.sprints[0].members[0], criteriaRevision: started.sprints[0].commitment?.members[0].criteriaRevision });
  });

  it("restores the latest added criteria witness instead of refreshing or using the initial commitment", () => {
    const removed = applyPlanningCommand(active(), { ...base(2), action: "remove-member", sprintId: "sprint-1", workId: "BUD-1" }, { facts: facts(), now: NOW });
    const revised = { ...facts(), "BUD-1": { ...facts()["BUD-1"], criteriaRevision: "approved-later-criteria" } };
    const added = applyPlanningCommand(removed, { ...base(3), action: "add-member", sprintId: "sprint-1", member: { ...member(), points: 2, reviewMinutes: 30 }, criteriaRevisions: witnesses(revised) }, { facts: revised, now: NOW });
    const removedAgain = applyPlanningCommand(added, { ...base(4), action: "remove-member", sprintId: "sprint-1", workId: "BUD-1" }, { facts: revised, now: NOW });
    const restored = applyPlanningCommand(removedAgain, { ...base(5), action: "restore-member", sprintId: "sprint-1", workId: "BUD-1" }, { facts: {}, now: NOW });
    expect(restored.sprints[0].members).toEqual(added.sprints[0].members);
    expect(restored.sprints[0].scopeChanges.at(-1)?.criteriaRevision).toBe("approved-later-criteria");
    expect(restored.sprints[0].commitment).toEqual(added.sprints[0].commitment);
  });

  it("refuses stale or unmatched removal inverses and any draft or closed restoration", () => {
    const started = active();
    const removed = applyPlanningCommand(started, { ...base(2), action: "remove-member", sprintId: "sprint-1", workId: "BUD-1" }, { facts: facts(), now: NOW });
    const command = { ...base(3), action: "restore-member", sprintId: "sprint-1", workId: "BUD-1" };
    expect(() => applyPlanningCommand(removed, { ...command, expectedRevision: 2 }, { facts: {}, now: NOW })).toThrow(/changed/);
    expect(() => applyPlanningCommand(removed, { ...command, workId: "BUD-2" }, { facts: {}, now: NOW })).toThrow(/not this member's removal/);
    expect(() => applyPlanningCommand(started, { ...command, expectedRevision: 2 }, { facts: {}, now: NOW })).toThrow(/not this member's removal/);
    expect(() => applyPlanningCommand(saved(), { ...command, expectedRevision: 1 }, { facts: {}, now: NOW })).toThrow(/Only active/);
    const closed = applyPlanningCommand(removed, { ...base(3), action: "close", sprintId: "sprint-1" }, { facts: {}, now: NOW });
    expect(() => applyPlanningCommand(closed, { ...command, expectedRevision: 4 }, { facts: {}, now: NOW })).toThrow(/Only active/);
    const restored = applyPlanningCommand(removed, command, { facts: {}, now: NOW });
    expect(() => applyPlanningCommand(restored, { ...command, ...base(4) }, { facts: {}, now: NOW })).toThrow(/not this member's removal/);
  });

  it("closes and transfers only selected unfinished work atomically", () => {
    const withDraft = applyPlanningCommand(active(), { ...base(2), action: "save", sprint: { ...draft("next-week"), members: [] } }, { facts: facts(), now: NOW });
    const closed = applyPlanningCommand(withDraft, { ...base(3), action: "close", sprintId: "sprint-1", carryover: ["BUD-1"], carryoverTo: "next-week" }, { facts: facts(), now: NOW });
    expect(closed.sprints[0].state).toBe("closed");
    expect(closed.sprints[1].members[0].carriedFromSprintId).toBe("sprint-1");
    expect(() => applyPlanningCommand(withDraft, { ...base(3), action: "close", sprintId: "sprint-1", carryover: ["BUD-2"], carryoverTo: "next-week" }, { facts: facts(), now: NOW })).toThrow(/not unfinished/);
    expect(withDraft.sprints[0].state).toBe("active");
    expect(withDraft.sprints[1].members).toEqual([]);
    expect(() => applyPlanningCommand(withDraft, { ...base(3), action: "close", sprintId: "sprint-1", carryover: ["BUD-1"] }, { facts: facts(), now: NOW })).toThrow(/together/);
  });

  it("keeps completed implementation and owner evidence outside ready planning", () => {
    const implemented = structuredClone(DATA);
    implemented.files[1].raw = implemented.files[1].raw.replace("### BUD-2", "**Implementation:** done\n### BUD-2");
    expect(buildPlanningFacts(implemented)["BUD-1"].reasons).toContainEqual({ code: "work-completed", with: null });
    const owner = structuredClone(DATA);
    owner.files[1].raw = owner.files[1].raw.replace("### BUD-2", "**Provenance:** Audit.\n**Readiness:** Owner evidence first.\n### BUD-2");
    expect(buildPlanningFacts(owner)["BUD-1"].reasons).toContainEqual({ code: "owner-evidence", with: null });
    owner.files[1].raw = owner.files[1].raw.replace("Owner evidence first.", "Held after migration.");
    expect(buildPlanningFacts(owner)["BUD-1"].reasons).toContainEqual({ code: "held", with: null });
  });

  it.each([
    ["BUD-63", "Owner DB evidence and bounded implementation draft.", "owner-evidence"],
    ["BUD-83", "Implementation draft; refresh owner RLS evidence before certifying the race.", "owner-evidence"],
    ["BUD-9", "Trigger held; refactor only when a real feature touches it.", "held"],
    ["KIT-5", "decision held.", "decision-required"],
    ["TRIP-6", "Decision held.", "decision-required"],
    ["TRIP-10", "Decision held — scope remains undecided.", "decision-required"],
  ])("keeps the explicit %s readiness declaration gated", (_id, readiness, code) => {
    const data = structuredClone(DATA);
    data.files[1].raw = data.files[1].raw.replace("### BUD-2", `**Provenance:** Audit.\n**Readiness:** ${readiness}\n### BUD-2`);
    const current = buildPlanningFacts(data);
    expect(current["BUD-1"].reasons).toContainEqual({ code, with: null });
    expect(current["BUD-1"].state).not.toBe("ready");
    expect(() => applyPlanningCommand(saved(), { ...base(1), action: "start", sprintId: "sprint-1", criteriaRevisions: witnesses(current) }, { facts: current, now: NOW })).toThrow(/Needs input/);
  });

  it.each([
    ["HLTH-25", "- **Reading guide:** Owner-executed; read only to interpret a failure."],
    ["NAT-1", "**Readiness:** Owner setup only; no engineering dispatch."],
    ["OUT-20", '```delivery-plan-v1\n{"dependencies":["Owner DB evidence before migration design; OUT-19 for phone/deployment witness"]}\n```'],
  ])("keeps the explicit %s owner execution prerequisite outside ready planning", (_id, declaration) => {
    const data = structuredClone(DATA);
    data.files[1].raw = data.files[1].raw.replace("### BUD-2", `**Provenance:** Audit.\n${declaration}\n### BUD-2`);
    const current = buildPlanningFacts(data);
    expect(current["BUD-1"].reasons).toContainEqual({ code: "owner-evidence", with: null });
    expect(current["BUD-1"].state).not.toBe("ready");
    expect(() => applyPlanningCommand(saved(), { ...base(1), action: "start", sprintId: "sprint-1", criteriaRevisions: witnesses(current) }, { facts: current, now: NOW })).toThrow(/Needs input/);
  });

  it("does not turn unknowns, comments or unrelated owner prose into prerequisites", () => {
    const data = structuredClone(DATA);
    const declaration = [
      "**Readiness:** implementation draft.",
      "Owner DB evidence may be requested during acceptance.",
      "<!--\n- **Reading guide:** Owner-executed; obsolete text.\n**Readiness:** Owner setup only; no engineering dispatch.\n```delivery-plan-v1",
      '{"dependencies":["Owner DB evidence before migration design"]}',
      "```\n-->",
      "```delivery-plan-v1",
      '{"dependencies":[],"unknowns":["Owner DB evidence before migration design"],"comments":["Owner-executed"]}',
      "```",
    ].join("\n");
    data.files[1].raw = data.files[1].raw.replace("### BUD-2", `${declaration}\n### BUD-2`);
    expect(buildPlanningFacts(data)["BUD-1"].state).toBe("ready");
  });

  it("refuses unseen acceptance changes while replaying an already committed command", () => {
    const plan = saved();
    const command = { ...base(1), action: "start", sprintId: "sprint-1", criteriaRevisions: witnesses() };
    const changedData = structuredClone(DATA);
    changedData.files[1].raw = changedData.files[1].raw.replace("Totals are correct.", "Totals retain rounding.");
    const changedFacts = buildPlanningFacts(changedData);
    expect(() => applyPlanningCommand(plan, command, { facts: changedFacts, now: NOW })).toThrow(/Acceptance changed/);
    expect(() => applyPlanningCommand(plan, { ...command, criteriaRevisions: {} }, { facts: facts(), now: NOW })).toThrow(/Acceptance changed/);
    const committed = applyPlanningCommand(plan, command, { facts: facts(), now: NOW });
    expect(applyPlanningCommand(committed, command, { facts: changedFacts, now: NOW })).toEqual(committed);
    const changedIncoming = { ...changedFacts, "BUD-2": { ...changedFacts["BUD-2"], criteriaRevision: "new-criteria" } };
    expect(() => applyPlanningCommand(committed, { ...base(2), action: "add-member", sprintId: "sprint-1", member: member("BUD-2"), criteriaRevisions: witnesses() }, { facts: changedIncoming, now: NOW })).toThrow(/Acceptance changed/);
  });

  it("admits independent new scope without reapproving existing blocked or stale members", () => {
    const three = structuredClone(DATA);
    three.files[0].raw += "\n- [ ] **BUD-3** Independent _(friction - S)_";
    three.files[1].raw = three.files[1].raw.replace("## Shipped Log", "### BUD-3\n**Outcome:** Independent.\n**Acceptance:** Verified independently.\n## Shipped Log");
    const current = buildPlanningFacts(three);
    const plan = applyPlanningCommand(emptyPlanning(), { ...base(), action: "save", sprint: { ...draft(), members: [member(), member("BUD-2")] } }, { facts: current, now: NOW });
    const started = applyPlanningCommand(plan, { ...base(1), action: "start", sprintId: "sprint-1", criteriaRevisions: witnesses(current) }, { facts: current, now: NOW });
    const removed = applyPlanningCommand(started, { ...base(2), action: "remove-member", sprintId: "sprint-1", workId: "BUD-1" }, { facts: current, now: NOW });
    const stale = { ...current, "BUD-2": { ...current["BUD-2"], criteriaRevision: "changed-after-start" } };
    const added = applyPlanningCommand(removed, { ...base(3), action: "add-member", sprintId: "sprint-1", member: member("BUD-3"), criteriaRevisions: witnesses(stale) }, { facts: stale, now: NOW });
    expect(added.sprints[0].members.map((entry) => entry.workId)).toEqual(["BUD-2", "BUD-3"]);
    expect(added.sprints[0].commitment?.members.find((entry) => entry.workId === "BUD-2")?.criteriaRevision).toBe(current["BUD-2"].criteriaRevision);
    expect(added.sprints[0].scopeChanges.at(-1)?.criteriaRevision).toBe(current["BUD-3"].criteriaRevision);
  });
});

describe("planning persistence and relay", () => {
  it("observes CLI completion, reopen and cancellation once without invented dates", () => {
    const env = workspace();
    writeFileSync(join(env.pmDir, "_Planning.json"), JSON.stringify(active()), "utf8");
    expect(observePlanningProgress({ ...env, now: NOW }).recorded).toBe(1);
    const baseline = readFileSync(join(env.root, ".pm", "planning-observations.json"), "utf8");
    expect(observePlanningProgress({ ...env, now: "2026-10-05T08:00:00.000Z" }).recorded).toBe(0);
    const completed = structuredClone(DATA);
    completed.files[0].raw = completed.files[0].raw.replace("[ ] **BUD-1**", "[x] **BUD-1**");
    expect(observePlanningProgress({ ...env, data: completed, now: "2026-10-06T08:00:00.000Z" }).recorded).toBe(1);
    // Simulate a crash after journalling but before writing the derived checkpoint.
    writeFileSync(join(env.root, ".pm", "planning-observations.json"), baseline, "utf8");
    expect(observePlanningProgress({ ...env, data: completed, now: "2026-10-06T09:00:00.000Z" }).recorded).toBe(0);
    expect(JSON.parse(readFileSync(join(env.root, ".pm", "planning-observations.json"), "utf8")).sequence).toBe(2);
    expect(observePlanningProgress({ ...env, data: DATA, now: "2026-10-07T08:00:00.000Z" }).recorded).toBe(1);
    const cancelled = structuredClone(DATA);
    cancelled.files[0].raw = cancelled.files[0].raw.replace(/- \[ \] \*\*BUD-1\*\*[^\n]*\n/u, "");
    cancelled.cancelledLog = "# Cancelled Log\n## Budget\n- ❌ 2026-10-08 — **BUD-1** Cancelled.\n";
    expect(observePlanningProgress({ ...env, data: cancelled, now: "2026-10-08T08:00:00.000Z" }).recorded).toBe(1);
    const lines = readFileSync(join(env.root, ".pm", "planning-observations.ndjson"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(lines.map((event) => event.status)).toEqual(["open", "completed", "open", "cancelled"]);
    expect(lines.map((event) => event.receiptDate)).toEqual([null, null, null, "2026-10-08"]);
    expect(lines.every((event) => event.occurredAt === null)).toBe(true);
    expect(lines[0].kind).toBe("baseline");
    expect(lines[1].observedAt).toBe("2026-10-06T08:00:00.000Z");
  });

  it("keeps closed outcomes stable when source work later reopens", () => {
    const env = workspace();
    const doneFacts = { ...facts(), "BUD-1": { ...facts()["BUD-1"], status: "completed" } };
    const closed = applyPlanningCommand(active(), { ...base(2), action: "close", sprintId: "sprint-1" }, { facts: doneFacts, now: NOW });
    writeFileSync(join(env.pmDir, "_Planning.json"), JSON.stringify(closed), "utf8");
    expect(observePlanningProgress({ ...env, now: "2026-10-09T08:00:00.000Z" }).recorded).toBe(1);
    expect(observePlanningProgress({ ...env, data: DATA, now: "2026-10-10T08:00:00.000Z" }).recorded).toBe(0);
    const event = JSON.parse(readFileSync(join(env.root, ".pm", "planning-observations.ndjson"), "utf8").trim());
    expect(event.status).toBe("completed");
    expect(event.receiptDate).toBeNull();
    expect(event.observedAt).toBe("2026-10-09T08:00:00.000Z");
  });

  it("refuses a live writer without changing its lock or the revision", () => {
    const env = workspace();
    const release = acquirePlanningWriteLock(env.root);
    const command = { ...base(), action: "save", sprint: draft() };
    try {
      expect(() => writePlanningCommand({ ...env, command, now: NOW })).toThrow(/being edited/);
      expect(() => writePlanningCommand({ ...env, command, now: NOW })).toThrow(/being edited/);
      expect(readPlanning(env.pmDir).revision).toBe(0);
    } finally { release(); }
    expect(writePlanningCommand({ ...env, command, now: NOW }).planning.revision).toBe(1);
  });

  it("recovers after the OS kills a lock owner and preserves CAS and replay", async () => {
    const env = workspace();
    const command = { ...base(), action: "save", sprint: draft() };
    writePlanningCommand({ ...env, command, now: NOW });
    const child = spawn(process.execPath, ["--input-type=module", "-e", [
      "import { DatabaseSync } from 'node:sqlite';",
      "const db = new DatabaseSync(process.env.ERA_PLANNING_TEST_LOCK);",
      "db.exec('BEGIN IMMEDIATE');",
      "process.send({locked:true});",
      "setInterval(() => {}, 1000);",
    ].join("\n")], {
      windowsHide: true,
      env: { ...process.env, ERA_PLANNING_TEST_LOCK: join(env.root, ".pm", "planning-lock.sqlite") },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    try {
      const [ready] = await once(child, "message");
      expect(ready).toEqual({ locked: true });
      expect(() => writePlanningCommand({ ...env, command, now: NOW })).toThrow(/being edited/);
    } finally {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
    expect(writePlanningCommand({ ...env, command, now: NOW }).replayed).toBe(true);
    expect(() => writePlanningCommand({ ...env, command: { ...base(), action: "save", sprint: draft("stale") }, now: NOW })).toThrow(/changed/);
    expect(writePlanningCommand({ ...env, command: { ...base(1), action: "save", sprint: draft("next") }, now: NOW }).planning.revision).toBe(2);
  });

  it("atomically persists revisions and command receipts, with safe retry and conflict", () => {
    const env = workspace();
    const command = { ...base(), action: "save", sprint: draft() };
    const result = writePlanningCommand({ ...env, command, now: NOW });
    expect(result.planning.revision).toBe(1);
    expect(writePlanningCommand({ ...env, command, now: NOW }).replayed).toBe(true);
    expect(() => writePlanningCommand({ ...env, command: { ...command, sprint: { ...draft(), name: "Different" } } })).toThrow(/reused/);
    expect(() => writePlanningCommand({ ...env, command: { ...base(), action: "save", sprint: draft("other") } })).toThrow(/changed/);
    expect(readPlanning(env.pmDir).revision).toBe(1);
    expect(readFileSync(join(env.root, ".pm", "planning-events.ndjson"), "utf8").trim().split("\n")).toHaveLength(1);
  });

  it("keeps Undo bound to the original applied revision after delayed receipt recovery", () => {
    const env = workspace();
    const original = { ...base(), action: "save", sprint: draft() };
    expect(writePlanningCommand({ ...env, command: original, now: NOW }).appliedRevision).toBe(1);
    writePlanningCommand({ ...env, command: { ...base(1), action: "save", sprint: { ...draft(), goal: "A later owner edit" } }, now: NOW });
    const replay = writePlanningCommand({ ...env, command: original, now: NOW });
    expect(replay.planning.revision).toBe(2);
    expect(replay.appliedRevision).toBe(1);
    expect(planningCommandState(env.pmDir, original.command_id)?.outcome.appliedRevision).toBe(1);
    expect(() => writePlanningCommand({ ...env, command: { ...base(replay.appliedRevision), action: "delete-draft", sprintId: "sprint-1" }, now: NOW })).toThrow(/changed/);
    expect(readPlanning(env.pmDir).sprints[0].goal).toBe("A later owner edit");
  });

  it("surfaces malformed planning without hiding the canonical backlog or overwriting it", () => {
    const env = workspace();
    expect(planningSnapshot(env.pmDir, DATA).planning?.revision).toBe(0);
    writeFileSync(join(env.pmDir, "_Planning.json"), "{broken", "utf8");
    const snapshot = planningSnapshot(env.pmDir, DATA);
    expect(snapshot.planning).toBeNull();
    expect(snapshot.planningError).toMatch(/repair/);
    expect(snapshot.planningReadiness["BUD-1"].status).toBe("open");
    expect(() => writePlanningCommand({ ...env, command: { ...base(), action: "save", sprint: draft() } })).toThrow(/repair/);
  });

  it("authenticates planning and carries the identical plan through relay snapshots", async () => {
    const env = workspace();
    const command = { ...base(), action: "save", sprint: draft() };
    expect(routePlanning({ body: command }, env).status).toBe(401);
    const paired = pairBridgeSession({ root: env.root });
    if (!paired.token) throw new Error("Expected fresh bridge credential");
    const installation_id = "inst-aabbccddeeff";
    const cmd = { id: command.command_id, type: "planning", user_id: "owner-1", payload: { installation_id, body: command } };
    const result = await executePlanningCommand({ cmd, installation_id, credential: paired.token, route: (req) => routePlanning(req, env) });
    expect(result.ok).toBe(true);
    const snapshot = { ...DATA, ...planningSnapshot(env.pmDir, DATA) };
    const corpus = buildCorpusRows({ data: snapshot, installation_id });
    const docs = new Map(corpus.upserts.map((row) => [row.payload.relPath, row.payload]));
    expect(assembleSnapshot(corpus.manifest.payload, docs).snapshot?.planning).toEqual(snapshot.planning);
    const wrong = await executePlanningCommand({ cmd, installation_id: "inst-000000000000", credential: paired.token, route: (req) => routePlanning(req, env) });
    expect(wrong.error).toBe("installation-mismatch");
    const journal = createCommandJournal({ dir: join(env.root, "journal") });
    journal.record(cmd.id, "claimed", { type: "planning" });
    journal.record(cmd.id, "started", { type: "planning" });
    const recovered = reconcileClaimedCommand(cmd, journal, null, (id) => planningCommandState(env.pmDir, id));
    expect(recovered.action).toBe("report");
    expect(recovered.outcome.planning.revision).toBe(1);
  });

  it("accepts a paired browser cookie on the scoped sprint route", () => {
    const env = workspace();
    const code = issuePairingCode({ root: env.root }).code;
    const paired = pairSession({ root: env.root, code });
    expect(paired.ok).toBe(true);
    const cookie = `era_v2_session=${paired.token}`;
    const csrf = sessionView({ root: env.root, headers: { cookie } }).csrf;
    expect(sessionCookie(paired.token)).toContain("Path=/api/delivery/v2;");
    expect("/api/delivery/v2/planning".startsWith("/api/delivery/v2/")).toBe(true);
    const response = routePlanning({
      headers: { cookie, "x-era-csrf": csrf, "sec-fetch-site": "same-origin" },
      body: { ...base(), action: "save", sprint: draft() },
    }, env);
    expect(response.status).toBe(200);
    expect(readPlanning(env.pmDir).sprints).toHaveLength(1);
  });
});

// DLV-175. The owner's view of a paused Acceptance Check; static render, no server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import { LocalAcceptance } from "../../scripts/pm/app/LocalAcceptance";
import { OwnerStationDetail } from "../../scripts/pm/app/OwnerStationDetail";
import { LocalRunReview } from "../../scripts/pm/app/LocalRunReview";
import { localRunLabel, localRunStages } from "../../scripts/pm/app/localRunModel";
import { currentOwnerStation, ownerStationState } from "../../scripts/pm/app/ownerStations";
import { localDriveStatus } from "../../scripts/pm/drive-local-status.mjs";
import { localBoardActionAllowed } from "../../scripts/pm/app/localBoardActions";
import { attemptLabel } from "../../scripts/pm/app/localRunModel";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { localRunAttention } from "../../scripts/pm/app/localRunAttention";
import { FoundryHud } from "../../scripts/pm/app/stage/hud/FoundryHud";
import { buildStatus, renderStatusMarkdown } from "../../scripts/pm/drive-publish.mjs";
import { createServerCodeWatch } from "../../scripts/pm/server-code.mjs";

const head = "6350b28d2058d0215b8f002983deb04821d0d2bd";
const acceptance = {
  state: "paused" as const,
  error: null,
  counts: { met: 2, missed: 1, unclear: 0 },
  criteria: [
    { id: "outcome", source: "Outcome", text: "ERA gets \"Add Racha as a Contact\" right.", state: "met" as const, evidence: ["contacts.ts:20"], by: "reviewer" as const },
    { id: "owner1", source: "Owner comment", text: "the form for creating a Contact should fire", state: "missed" as const, evidence: ["Only an Open link is added"], by: "reviewer" as const },
    { id: "uat", source: "UAT steps", text: "The draft UAT steps let the owner check each criterion above on the candidate.", state: "met" as const, evidence: ["hub93-open-detail"], by: "reviewer" as const },
  ],
};
const paused: LocalRunView = {
  run_id: "local-02f6ab40-4cff-4ff7-b08b-13efa41f4498", phase: "acceptance-paused", workspace: "C:/fixture/HUB-93", branch: "delivery/HUB-93",
  head, current_head: head, canShip: false, canUndo: false, interrupted: false,
  work: { id: "HUB-93", title: "ERA gets \"Add Racha as a Contact\" right", campaign: "Hub & ERA" },
  checks: [], activity: [], usage: null, handover: null,
  acceptance, revisions: [], revision_limit: 2, revisions_used: 1, canRequestChanges: true, canStop: true, canRecheckAcceptance: false,
};
const render = (run: LocalRunView, readOnly = false) =>
  renderToStaticMarkup(createElement(LocalAcceptance, { run, busy: false, act: () => {}, readOnly }));

describe("DLV-175 paused Acceptance Check", () => {
  it("shows each verdict and the owner's two decisions with the revision budget", () => {
    const html = render(paused);
    expect(html).toContain("2 met · 1 missed · 0 unclear");
    expect(html).toContain("the form for creating a Contact should fire");
    expect(html).toContain("Only an Open link is added");
    expect(html).toContain(">Request changes</button>");
    expect(html).toContain(">Stop run</button>");
    expect(html).toContain("1 of 2");
    expect(html).not.toContain("Check again");
    expect(render(paused, true)).not.toContain("<button");
  });
  it("lets Game mode send the decision the server admits", () => {
    expect(localBoardActionAllowed(paused, false, "request-changes")).toBe(true);
    expect(localBoardActionAllowed(paused, false, "stop")).toBe(true);
    expect(localBoardActionAllowed(paused, false, "check-acceptance")).toBe(false);
    expect(localBoardActionAllowed({ ...paused, canRecheckAcceptance: true }, false, "check-acceptance")).toBe(true);
    expect(localBoardActionAllowed({ ...paused, canRequestChanges: false }, false, "request-changes")).toBe(false);
    expect(localBoardActionAllowed(paused, true, "request-changes")).toBe(false);
    expect(localBoardActionAllowed({ ...paused, phase: "uat-ready" }, false, "stop")).toBe(false);
  });
  it("disables Request changes once the revision limit is spent and offers Check again only after a reviewer failure", () => {
    const spent = render({ ...paused, canRequestChanges: false, revisions_used: 2 });
    expect(spent).toMatch(/<button class="primary" disabled="">Request changes<\/button>/u);
    expect(render({ ...paused, canRecheckAcceptance: true, acceptance: { ...acceptance, error: "The reviewer returned no verdict" } }))
      .toContain(">Check again</button>");
  });
  it("places the decision at the Test station and holds Handover until a pass", () => {
    expect(localRunLabel(paused)).toBe("Misses acceptance");
    expect(localRunStages(paused).map(stage => [stage.label, stage.state]).slice(0, 4))
      .toEqual([["Build", "done"], ["Check", "done"], ["Acceptance", "stopped"], ["Test", "pending"]]);
    expect(ownerStationState(paused, "test")).toBe("current");
    expect(currentOwnerStation(paused)).toBe("test");
    const html = renderToStaticMarkup(createElement(OwnerStationDetail, { run: paused, station: "test", busy: false, act: () => {}, patch: null }));
    expect(html).toContain("Request changes");
    expect(html).not.toContain("Awaiting test handover");
    expect(localRunLabel({ phase: "stopped" })).toBe("Stopped");
    expect(currentOwnerStation({ ...paused, phase: "stopped" })).toBe("cleanup");
  });
  it("offers Discard from Test on an unmerged candidate and New attempt once it is closed", () => {
    const ready = { ...paused, phase: "uat-ready", acceptance: { ...acceptance, state: "passed" as const } };
    const test = (run: LocalRunView) => renderToStaticMarkup(createElement(OwnerStationDetail,
      { run, station: "test", busy: false, act: () => {}, patch: null, onSelectStation: () => {} }));
    expect(test(ready)).toContain(">Discard</button>");
    expect(test({ ...ready, applied: { at: "", files: [], main_head: head, pm_error: null } })).not.toContain(">Discard</button>");
    expect(test(paused)).not.toContain(">Discard</button>");
    for (const phase of ["discarded", "stopped"]) {
      const html = renderToStaticMarkup(createElement(LocalRunReview, { run: { ...paused, phase }, busy: false, act: () => {}, patch: null }));
      expect(html).toContain(`href="#/deliver/Hub%20%26%20ERA/HUB-93?from=%2Fdelivery%2Frun%2F${paused.run_id}">New attempt</a>`);
    }
    expect(renderToStaticMarkup(createElement(LocalRunReview, { run: ready, busy: false, act: () => {}, patch: null }))).not.toContain("New attempt");
  });
  it("mirrors the pause to Drive as an owner action and a blocker", () => {
    const record = { lane: "local", phase: "acceptance-paused", base: "a9e41198dcfc897c5f88b4dcb5cb983be67428c1", head, checks: [],
      work: { id: "HUB-93", title: "HUB-93" }, acceptance, revisions: [{ n: 1 }] };
    const status = localDriveStatus({ run: { run_id: paused.run_id, work_id: "HUB-93", lifecycle: "ACTIVE", created_at: "", updated_at: "" },
      record, live: null, jobs: { total: 1, byStatus: {} }, reviewFolder: "05 - Session Review" });
    expect(status.ownerActions).toEqual([{ kind: "local-acceptance", key: "local-acceptance:" + paused.run_id, label: "Decide on acceptance findings" }]);
    expect(status.blockers).toEqual([{ kind: "acceptance", ref: "1 missed · 0 unclear" }]);
    expect(status.evidence.acceptance).toMatchObject({ state: "paused", revisions_used: 1, criteria: [{ id: "outcome", state: "met" }, { id: "owner1", state: "missed" }, { id: "uat" }] });
    expect(status.evidence.acceptance!.criteria[0].text).toBe("ERA gets \"Add Racha as a Contact\" right.");
    expect(status.evidence.acceptance!.criteria[1].evidence).toEqual(["Only an Open link is added"]);
    expect(status.evidence.review_document).toBe("05 - Session Review/" + paused.run_id + ".md");
  });
});

// The HUB-93 second pause: revision 1 was refused at Seal by a lint warning and rolled back.
describe("DLV-175 a failed revision, seen by the owner and by a Drive supervisor", () => {
  const workspace = "C:/Users/fixture/budget-app-delivery/HUB-93-15f95526";
  const failure = { code: "commit-hook" as const, step: "Seal", stage: "lint",
    detail: `${workspace.replace(/\//gu, "\\")}\\src\\components\\web\\WebCatalogue.tsx\n  354:9  warning  'handleToggleFavorite' is assigned a value but never used\nESLint found too many warnings (maximum: 0).` };
  const failedRevision = { n: 1, ordinal: 1, requested_at: "2026-11-25T12:51:47.768Z", finished_at: "2026-11-25T13:05:06.984Z", from_head: head,
    note: "Open a prefilled contact creation form before saving anything.", findings: [], state: "failed" as const, failure,
    attempt_patch: ".delivery/local-history/x/revision-1-attempt.patch" };
  const afterFailure: LocalRunView = { ...paused, workspace, revisions: [failedRevision], revisions_used: 0, canReuseAttempt: true, attempt: { n: 2, of: 2 },
    acceptance: { ...acceptance, head, finished_at: "2026-11-25T12:17:13.407Z" },
    candidates: [{ n: 1, head, base: head, sealed_at: "", revision: null, patch: null, checks: [], acceptance: null, outcome: "revision-requested" }] };

  it("marks a second try and a revision beside the item ID in Game and in Calm", () => {
    expect(attemptLabel({ attempt: { n: 1, of: 1 } })).toBeNull();
    expect(attemptLabel({ attempt: { n: 2, of: 2 } })).toBe("Attempt 2");
    expect(attemptLabel(afterFailure)).toBe("Attempt 2 · Revision 1 failed");
    expect(attemptLabel({ ...afterFailure, revision: 2, revisions: [failedRevision, { ...failedRevision, n: 2, state: "building" }] }))
      .toBe("Attempt 2 · Revision 1/2");
    const timeline = buildTimeline(afterFailure), snapshot = sceneAt(timeline, Date.parse("2026-11-25T13:10:00Z"));
    const hud = renderToStaticMarkup(createElement(FoundryHud, { snapshot, timeline, attention: localRunAttention(afterFailure, new Set(), Date.now()) }));
    expect(hud).toContain('<span class="run-game-tag run-game-attempt">Attempt 2 · Revision 1 failed</span>');
    const calm = renderToStaticMarkup(createElement(LocalRunReview, { run: afterFailure, busy: false, act: () => {}, patch: null }));
    expect(calm).toContain("HUB-93 · Local · Attempt 2 · Revision 1 failed");
  });

  it("leads with the failed revision, labels the older verdict and retries from the kept changes", () => {
    const html = render(afterFailure);
    expect(html.indexOf("Revision 1 failed")).toBeLessThan(html.indexOf("<h3>Acceptance"));
    expect(html).toContain("<strong>Revision 1 failed · Seal · lint</strong>");
    // Repository-relative, without the worktree path.
    expect(html).toContain("<pre>src\\components\\web\\WebCatalogue.tsx\n  354:9  warning  &#x27;handleToggleFavorite&#x27;");
    expect(html).not.toContain("budget-app-delivery");
    expect(html).toContain("<h3>Acceptance · candidate 1</h3>");
    expect(html).toContain(">Open a prefilled contact creation form before saving anything.</textarea>");
    expect(html).toContain(">Retry revision</button>");
    expect(html).not.toContain("checkbox");
    expect(html).toContain("0 of 2");
    expect(render(paused)).toContain(">Request changes</button>");
  });

  it("tells the Drive supervisor that PM waits on the owner, why, since when, and what failed", () => {
    const record = { lane: "local", phase: "acceptance-paused", base: "a9e41198dcfc897c5f88b4dcb5cb983be67428c1", head, checks: [], workspace,
      work: { id: "HUB-93", title: "HUB-93" }, revision_limit: 2, revision: null, revisions: [failedRevision],
      acceptance: { ...acceptance, finished_at: "2026-11-25T12:16:40.000Z", head } };
    const live = { attempt: { n: 2, of: 2 }, ownerAction: "acceptance-paused", ownerActionKind: "local-acceptance", active: false,
      events: [{ at: "2026-11-25T13:05:06.987Z", text: "Revision 1 failed at Seal (lint) · restored 6350b28d2058 · not counted" }] };
    const run = { run_id: paused.run_id, work_id: "HUB-93", lifecycle: "ACTIVE", created_at: "", updated_at: "2026-11-25T13:05:06.985Z" };
    const status = localDriveStatus({ run, record, live, jobs: { total: 1, byStatus: {} }, reviewFolder: "05 - Session Review" });
    expect(status.blockers).toEqual([{ kind: "acceptance", ref: "1 missed · 0 unclear" }, { kind: "revision-failed", ref: "revision 1 · Seal · lint" }]);
    expect(status.attention).toEqual({ state: "waiting-owner", since: "2026-11-25T13:05:06.987Z", action: "Decide on acceptance findings",
      reason: "Acceptance paused · 1 missed · 0 unclear · revision 1 failed at Seal (lint), earlier candidate restored" });
    expect(status.evidence.acceptance!.findings).toEqual([{ id: "owner1", source: "Owner comment", state: "missed",
      text: "the form for creating a Contact should fire", evidence: ["Only an Open link is added"] }]);
    expect(status.evidence.revisions).toMatchObject({ limit: 2, used: 0, active: null,
      history: [{ n: 1, ordinal: 1, state: "failed", counted: false, note: failedRevision.note, failure: { code: "commit-hook", step: "Seal", stage: "lint" } }] });
    // Repository-relative: the worktree path never reaches Drive.
    expect(status.evidence.revisions!.history[0].failure!.detail).toMatch(/^src\\components\\web\\WebCatalogue\.tsx 354:9 warning/u);
    expect(JSON.stringify(status)).not.toContain("budget-app-delivery");
    expect(status.evidence.attempt).toEqual({ n: 2, of: 2 });
    expect(status.evidence.events).toEqual(live.events);

    const delivery = { available: true, runs: [status], requests: [] };
    const server = { pid: 4242, started_at: "2026-11-25T11:38:27.000Z", restart_needed: true, changed_file: "scripts/pm/drive-local-status.mjs" };
    const summary = buildStatus({ delivery, rollups: null, publish: { documents: 0, skipped: [], driveEdits: [] }, now: "2026-11-25T13:40:21.103Z", server });
    expect(summary).toMatchObject({ paused: true, server, attention: [{ run_id: paused.run_id, work_id: "HUB-93", state: "waiting-owner" }] });
    const md = renderStatusMarkdown(summary, summary.generatedAt);
    expect(md.indexOf("## Now")).toBeLessThan(md.indexOf("## Pending owner actions"));
    expect(md).toContain("**restart needed**: scripts/pm/drive-local-status.mjs changed after start");
    expect(md).toContain(`- **Waiting for the owner** · HUB-93 · attempt 2 of 2 · Acceptance paused · 1 missed · 0 unclear · revision 1 failed at Seal (lint), earlier candidate restored · since 2026-11-25T13:05:06.987Z · next: Decide on acceptance findings · run ${paused.run_id}`);
    expect(md).toContain("  - missed · Owner comment · the form for creating a Contact should fire — Only an Open link is added");
    expect(md).toContain("  - Revision 1 failed at Seal (lint): src\\components\\web\\WebCatalogue.tsx 354:9 warning");
    expect(md).toContain("  - Owner note (revision 1): Open a prefilled contact creation form");
    expect(md).toContain("  - Latest event 2026-11-25T13:05:06.987Z: Revision 1 failed at Seal (lint)");
  });

  it("says working, with the revision, while a revision builds; and interrupted when no supervisor drives it", () => {
    const record = { lane: "local", phase: "building", base: head, head, checks: [], workspace, work: { id: "HUB-93", title: "HUB-93" },
      revision_limit: 2, revision: 2, revisions: [failedRevision, { ...failedRevision, n: 2, state: "building", failure: undefined, finished_at: undefined }] };
    const run = { run_id: paused.run_id, work_id: "HUB-93", lifecycle: "ACTIVE", created_at: "", updated_at: "2026-11-25T14:00:00.000Z" };
    const working = localDriveStatus({ run, record, live: { active: true }, jobs: { total: 1, byStatus: {} }, reviewFolder: "05 - Session Review" });
    expect(working.attention).toMatchObject({ state: "working", reason: "Building · revision 1 of 2", action: null });
    const stuck = localDriveStatus({ run, record, live: { active: false, ownerAction: "Interrupted" }, jobs: { total: 1, byStatus: {} }, reviewFolder: "05 - Session Review" });
    expect(stuck.attention).toMatchObject({ state: "blocked" });
    expect(stuck.attention.reason).toContain("Interrupted while building");
    expect(buildStatus({ delivery: { available: true, runs: [working], requests: [] }, rollups: null, publish: { documents: 0, skipped: [], driveEdits: [] }, now: "" }).paused).toBe(false);
  });

  it("knows when PM runs server code older than the checkout", () => {
    let at = 1;
    const read = createServerCodeWatch({ root: "C:/fixture", pid: 7, now: () => "2026-11-25T11:38:27.000Z", scan: () => ({ at, path: "scripts/pm/drive-local-status.mjs" }) });
    expect(read()).toEqual({ pid: 7, started_at: "2026-11-25T11:38:27.000Z", restart_needed: false, changed_file: null });
    at = 2;
    expect(read()).toEqual({ pid: 7, started_at: "2026-11-25T11:38:27.000Z", restart_needed: true, changed_file: "scripts/pm/drive-local-status.mjs" });
  });
});

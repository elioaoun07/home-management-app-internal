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
    expect(status.evidence.review_document).toBe("05 - Session Review/" + paused.run_id + ".md");
  });
});

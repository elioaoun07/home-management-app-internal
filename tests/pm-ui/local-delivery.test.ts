import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  LocalActions,
  LocalReadinessPanel,
} from "../../scripts/pm/app/LocalDelivery";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import { LocalRunReview } from "../../scripts/pm/app/LocalRunReview";
import { BlackBox } from "../../scripts/pm/app/BlackBox";
import {
  localCheckLabel,
  localRunStages,
} from "../../scripts/pm/app/localRunModel";

describe("Local delivery controls", () => {
  const base = {
    phase: "uat-ready",
    head: "abc",
    canShip: false,
    canUndo: false,
    interrupted: false,
    handover: null,
  };
  const actions = (run = base, busy = false) =>
    renderToStaticMarkup(
      createElement(LocalActions, { run, busy, act: () => {} }),
    );
  // DLV-167: Merge replaces Ship, whose push targets `origin` rather than the owner's remote.
  it("keeps Merge disabled until the supervisor confirms current-head checks, review, UAT and no repo conflicts", () => {
    expect(actions()).toMatch(/disabled="">Merge/);
    expect(actions({ ...base, canMerge: true } as typeof base)).not.toMatch(/disabled="">Merge/);
    expect(actions({ ...base, canMerge: true } as typeof base, true)).toMatch(
      /disabled="">Merge/,
    );
    expect(actions({ ...base, canShip: true })).not.toContain(">Ship<");
  });
  it("leaves legacy pushes visible for inspection without invoking retired commands", () => {
    expect(actions({ ...base, phase: "shipped", canUndo: true })).not.toContain(">Undo<");
    expect(actions({ ...base, phase: "push-pending" })).toContain("Legacy push needs manual review");
    expect(actions({ ...base, phase: "push-pending" })).not.toContain(">Retry push<");
  });
  it("keeps recovery actions available for interrupted attempts and merges", () => {
    for (const phase of ["preparing", "building", "checking"]) {
      expect(actions({ ...base, phase, interrupted: true })).toContain(">Cancel<");
      expect(actions({ ...base, phase, interrupted: true }, true)).toMatch(/disabled="">Cancel/);
    }
    expect(actions({ ...base, phase: "merging", canShip: true })).not.toMatch(/disabled="">Ship/);
    expect(actions({ ...base, phase: "cancelled", interrupted: true })).not.toContain(">Cancel<");
  });
  it("shows only the three Local checks plus labelled advisories", () => {
    const html = renderToStaticMarkup(
      createElement(LocalReadinessPanel, {
        data: {
          ready: true,
          facts: {
            source: { state: "pass", code: "clean" },
            authentication: { state: "pass", code: "subscription" },
            environment: { state: "pass", code: "lock" },
            coordination: { state: "advisory", code: "busy" },
            modelAvailability: { state: "advisory", code: "unknown" },
            budget: { state: "advisory", code: "unknown" },
          },
        },
      }),
    );
    expect(html.match(/Passed/gu)).toHaveLength(3);
    expect(html.match(/Advisory/gu)).toHaveLength(3);
    expect(html).not.toContain("Qualification");
    expect(html).not.toContain("Pair");
  });
});

describe("Local session review", () => {
  const run: LocalRunView = {
    run_id: "local-fixture",
    phase: "failed",
    workspace: "C:/fixture/worktree",
    branch: "delivery/HUB-118",
    head: null,
    current_head: "base",
    canShip: false,
    canUndo: false,
    interrupted: false,
    work: {
      id: "HUB-118",
      title: "HUB-118 Require host sign-in — criteria",
      campaign: "Hub & ERA",
      brief:
        "**Outcome:** Host sign-in.\n\n- **Acceptance:** Anonymous bulk read returns 401.",
    },
    settings: { executor: "claude", model: "fixture-model", effort: "medium" },
    checks: [],
    activity: [
      { at: "2026-11-14T18:23:35Z", summary: "Native session started" },
    ],
    usage: null,
    handover: null,
    error: "native session exited 1: TypeError: Cannot freeze\nstack trace",
  };
  it("shows the owner stations and the failure before opening session evidence", () => {
    const html = renderToStaticMarkup(
      createElement(LocalRunReview, {
        run,
        busy: false,
        act: () => {},
        patch: null,
      }),
    );
    expect(html).toContain('aria-label="Owner stations"');
    for (const label of ["Test", "Review", "Merge", "Commit", "Push", "Clean up"])
      expect(html).toContain(label + "</button>");
    expect(html).toContain("Session evidence");
    expect(html).not.toContain('role="tabpanel"');
    expect(html).toContain("Agent could not start");
    expect(html).toContain("<summary>Error details</summary>");
    expect(html).toContain("Cannot freeze");
    expect(html).toContain("New attempt");
    expect(html).toContain("<h1>Require host sign-in</h1>");
    expect(html).not.toContain(">Passed<");
  });
  it("never marks unobserved steps or null-exit checks as completed", () => {
    expect(localRunStages(run).map((stage) => stage.state)).toEqual([
      "stopped",
      ...Array(6).fill("pending"),
    ]);
    expect(
      localRunStages({
        ...run,
        phase: "preparing",
        error: undefined,
        activity: [],
      }).map((stage) => stage.state),
    ).toEqual(["current", ...Array(6).fill("pending")]);
    expect(
      localRunStages({
        ...run,
        phase: "checking",
        head: "candidate",
        error: undefined,
      }).map((stage) => stage.state),
    ).toEqual(["done", "current", ...Array(5).fill("pending")]);
    expect(localCheckLabel(undefined)).toBe("Not run");
    expect(
      localCheckLabel({
        name: "test",
        exit: null,
        stdout: "",
        stderr: "",
        error: null,
      }),
    ).toBe("Inconclusive");
  });
  it.each(["Calm", "Game"])("shows the structured reason before collapsed raw output in %s", mode => {
    const structured = { ...run, error: "raw fixture hook chatter", failure: { code: "native-error", step: "Build", detail: "Sandbox required but unavailable" } } satisfies LocalRunView;
    const html = renderToStaticMarkup(mode === "Game" ? createElement(BlackBox, { run: structured }) : createElement(LocalRunReview, { run: structured, busy: false, act: () => {}, patch: null }));
    expect(html).toContain("Agent ended early");
    expect(html.indexOf("Sandbox required but unavailable")).toBeLessThan(html.indexOf("<summary>Error details</summary>"));
    expect(html).toMatch(/<details[^>]*><summary>Error details<\/summary>/u);
    expect(html.indexOf("raw fixture hook chatter")).toBeGreaterThan(html.indexOf("<summary>Error details</summary>"));
  });
});

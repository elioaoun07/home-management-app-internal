import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  LocalActions,
  LocalReadinessPanel,
} from "../../scripts/pm/app/LocalDelivery";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import { LocalRunReview } from "../../scripts/pm/app/LocalRunReview";
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
  it("keeps Ship disabled until the supervisor confirms current-head checks, review and UAT", () => {
    expect(actions()).toMatch(/disabled="">Ship/);
    expect(actions({ ...base, canShip: true })).not.toMatch(/disabled="">Ship/);
    expect(actions({ ...base, canShip: true }, true)).toMatch(
      /disabled="">Ship/,
    );
  });
  it("offers Undo after a shipped merge and Retry push for a retained merge", () => {
    expect(actions()).not.toContain(">Undo<");
    expect(actions({ ...base, phase: "shipped", canUndo: true })).toContain(
      ">Undo<",
    );
    expect(actions({ ...base, phase: "push-pending" })).toContain(
      ">Retry push<",
    );
    expect(actions({ ...base, phase: "push-pending" })).not.toMatch(
      /disabled="">Retry push/,
    );
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
  it("retains all review sections and a concise failure with the stack disclosed", () => {
    const html = renderToStaticMarkup(
      createElement(LocalRunReview, {
        run,
        busy: false,
        act: () => {},
        patch: null,
      }),
    );
    for (const label of [
      "Delivery stages",
      "Plan",
      "Verification",
      "Activity",
      "Changes",
    ])
      expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain("Agent could not start");
    expect(html).toContain("<summary>Error details</summary>");
    expect(html).toContain("Cannot freeze");
    expect(html).toContain("New attempt");
    expect(html.match(/Not run/gu)).toHaveLength(4);
    expect(html).toContain("Host sign-in");
    expect(html).not.toContain(">Passed<");
  });
  it("never marks unobserved steps or null-exit checks as completed", () => {
    expect(localRunStages(run).map((stage) => stage.state)).toEqual([
      "done",
      "stopped",
      "pending",
      "pending",
      "pending",
    ]);
    expect(
      localRunStages({
        ...run,
        phase: "preparing",
        error: undefined,
        activity: [],
      }).map((stage) => stage.state),
    ).toEqual(["current", "pending", "pending", "pending", "pending"]);
    expect(
      localRunStages({
        ...run,
        phase: "checking",
        head: "candidate",
        error: undefined,
      }).map((stage) => stage.state),
    ).toEqual(["done", "done", "current", "pending", "pending"]);
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
});

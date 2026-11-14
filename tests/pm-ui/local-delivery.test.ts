import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalActions, LocalReadinessPanel } from "../../scripts/pm/app/LocalDelivery";

describe("Local delivery controls", () => {
  const base = { phase: "uat-ready", head: "abc", canShip: false, canUndo: false, interrupted: false, handover: null };
  const actions = (run = base, busy = false) => renderToStaticMarkup(createElement(LocalActions, { run, busy, act: () => {} }));
  it("keeps Ship disabled until the supervisor confirms current-head checks, review and UAT", () => {
    expect(actions()).toMatch(/disabled="">Ship/);
    expect(actions({ ...base, canShip: true })).not.toMatch(/disabled="">Ship/);
    expect(actions({ ...base, canShip: true }, true)).toMatch(/disabled="">Ship/);
  });
  it("offers Undo after a shipped merge and Retry push for a retained merge", () => {
    expect(actions()).not.toContain(">Undo<");
    expect(actions({ ...base, phase: "shipped", canUndo: true })).toContain(">Undo<");
    expect(actions({ ...base, phase: "push-pending" })).toContain(">Retry push<");
    expect(actions({ ...base, phase: "push-pending" })).not.toMatch(/disabled="">Retry push/);
  });
  it("shows only the three Local checks plus labelled advisories", () => {
    const html = renderToStaticMarkup(createElement(LocalReadinessPanel, { data: { ready: true, facts: {
      source: { state: "pass", code: "clean" }, authentication: { state: "pass", code: "subscription" }, environment: { state: "pass", code: "lock" },
      coordination: { state: "advisory", code: "busy" }, modelAvailability: { state: "advisory", code: "unknown" }, budget: { state: "advisory", code: "unknown" },
    } } }));
    expect(html.match(/Passed/gu)).toHaveLength(3); expect(html.match(/Advisory/gu)).toHaveLength(3);
    expect(html).not.toContain("Qualification"); expect(html).not.toContain("Pair");
  });
});

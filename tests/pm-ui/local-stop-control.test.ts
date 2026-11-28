// DLV-178: one visible exit per Local run, in both room headers.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { LocalStopControl, stopMode } from "../../scripts/pm/app/LocalStopControl";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";

const run = (fields: Partial<LocalRunView>) => ({ run_id: "local-00000000-0000-0000-0000-000000000000", phase: "building",
  workspace: "C:/repo-delivery/DLV-900", branch: "delivery/DLV-900", ...fields }) as LocalRunView;
const render = (view: LocalRunView) => renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() },
  createElement(LocalStopControl, { run: view, busy: false, act: () => {} })));

describe("LocalStopControl", () => {
  it("stops working runs, stops a paused check, and discards resting candidates that still hold a worktree", () => {
    for (const phase of ["preparing", "building", "checking", "accepting"]) expect(stopMode(run({ phase }))).toBe("cancel");
    expect(stopMode(run({ phase: "acceptance-paused", canStop: true }))).toBe("stop");
    expect(stopMode(run({ phase: "acceptance-paused", canStop: false }))).toBeNull();
    for (const phase of ["uat-ready", "refresh-conflict", "refresh-failed", "failed", "cancelled", "stopped"])
      expect(stopMode(run({ phase }))).toBe("discard");
    expect(stopMode(run({ phase: "failed", cleaned_at: "2026-11-28T00:00:00Z" }))).toBeNull();
    expect(stopMode(run({ phase: "uat-ready", merge_pending: { main_head: "abc" } }))).toBeNull();
    for (const phase of ["merged", "committed", "pushed", "discarded", "shipped"]) expect(stopMode(run({ phase }))).toBeNull();
  });
  it("renders one labelled button naming the worktree it deletes", () => {
    expect(render(run({ phase: "building" }))).toContain('aria-label="Stop"');
    expect(render(run({ phase: "building" }))).toContain('title="C:/repo-delivery/DLV-900"');
    expect(render(run({ phase: "uat-ready" }))).toContain('aria-label="Discard"');
    expect(render(run({ phase: "merged" }))).toBe("");
  });
});

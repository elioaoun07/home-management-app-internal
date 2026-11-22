import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalActions } from "../../scripts/pm/app/LocalDelivery";
import {
  localBoardActionAllowed,
  attentionActionAllowed,
} from "../../scripts/pm/app/localBoardActions";
import { localRunAttention } from "../../scripts/pm/app/localRunAttention";
import { boardRun, epoch } from "./local-board-fixtures";

describe("R123 attention command admission", () => {
  it("matches canonical buttons across phase, busy and recovery capability combinations", () => {
    for (const phase of [
      "preparing",
      "building",
      "checking",
      "uat-ready",
      "push-pending",
      "revert-push-pending",
      "failed",
      "shipped",
    ]) {
      for (let mask = 0; mask < 32; mask++) {
        const busy = !!(mask & 1),
          run = boardRun({
            phase,
            head: mask & 2 ? "candidate" : null,
            canShip: !!(mask & 4),
            canMerge: !!(mask & 4),
            canUndo: !!(mask & 8),
            interrupted: !!(mask & 16),
          });
        const html = renderToStaticMarkup(
          createElement(LocalActions, { run, busy, act: () => {} }),
        );
        // DLV-167: Ship is never offered; Merge replaces it, Retry push remains.
        expect(html).not.toMatch(/>Ship<\/button>/);
        for (const [action, label] of [
          ["review", "Review diff"],
          ["merge", "Merge"],
          ["ship", "Retry push"],
          ["undo", "Undo"],
          ["cancel", "Cancel"],
        ] as const) {
          const button = html.match(
            new RegExp(`<button([^>]*)>${label}</button>`),
          );
          expect(
            localBoardActionAllowed(run, busy, action),
            `${phase}/${mask}/${action}`,
          ).toBe(!!button && !button[1].includes("disabled"));
        }
      }
    }
  });
  it("DLV-167 shows changed files as an alert and the next step after a merge", () => {
    const conflicted = renderToStaticMarkup(createElement(LocalActions, { busy: false, act: () => {}, run: boardRun({
      phase: "uat-ready", head: "candidate", canMerge: false,
      mergePlan: { files: [{ status: "M", path: "src/a.ts" }], conflicts: [{ path: "src/a.ts", committed: true, uncommitted: false }], branch: "main", expected: "main" },
    }) }));
    expect(conflicted).toContain('role="alert"');
    expect(conflicted).toContain("<code>src/a.ts</code>");
    expect(conflicted).toMatch(/<button[^>]*disabled[^>]*>Merge<\/button>/);
    const merged = renderToStaticMarkup(createElement(LocalActions, { busy: false, act: () => {}, run: boardRun({
      phase: "shipped", head: "candidate", applied: { at: "2026-11-22T10:00:00Z", files: ["a", "b"], main_head: "abc", pm_error: null },
    }) }));
    expect(merged).toContain("Merged 2 files · commit and push in your repo");
    expect(merged).not.toContain(">Merge</button>");
    expect(merged).not.toContain(">Undo</button>");
  });
  it("keeps local opens available while blocking a busy retry command", () => {
    const run = boardRun({
      phase: "push-pending",
      work: { id: "R123", title: "Fixture", brief: "Recorded brief" },
    });
    const items = localRunAttention(run, new Set(), epoch);
    expect(
      attentionActionAllowed(
        run,
        true,
        items.find((item) => item.kind === "retry")!,
      ),
    ).toBe(false);
    expect(
      attentionActionAllowed(
        run,
        true,
        items.find((item) => item.kind === "plan")!,
      ),
    ).toBe(true);
  });
  it("does not offer an inert Test action without recorded handover data", () => {
    const run = boardRun({ phase: "uat-ready" });
    const item = localRunAttention(run, new Set(), epoch).find(
      (item) => item.kind === "test",
    )!;
    expect(item.action.href).toBeUndefined();
    expect(attentionActionAllowed(run, false, item)).toBe(false);
  });
});

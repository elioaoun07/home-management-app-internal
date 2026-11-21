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
            canUndo: !!(mask & 8),
            interrupted: !!(mask & 16),
          });
        const html = renderToStaticMarkup(
          createElement(LocalActions, { run, busy, act: () => {} }),
        );
        for (const [action, label] of [
          ["review", "Review diff"],
          ["ship", phase === "push-pending" ? "Retry push" : "Ship"],
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

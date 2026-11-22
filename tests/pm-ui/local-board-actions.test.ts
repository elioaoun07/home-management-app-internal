import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalActions, type LocalRunView } from "../../scripts/pm/app/LocalDelivery";
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
        expect(html).not.toMatch(/>(Ship|Undo|Retry push)<\/button>/);
        for (const [action, label] of [
          ["merge", "Merge"],
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
    expect(conflicted).toContain(">Recheck</button>");
    expect(conflicted).not.toContain(">Merge</button>");
    const merged = renderToStaticMarkup(createElement(LocalActions, { busy: false, act: () => {}, run: boardRun({
      phase: "shipped", head: "candidate", applied: { at: "2026-11-22T10:00:00Z", files: ["a", "b"], main_head: "abc", pm_error: null },
    }) }));
    expect(merged).toContain("Merged in your folder");
    expect(merged).not.toContain(">Merge</button>");
    expect(merged).not.toContain(">Undo</button>");
  });
  it("keeps local opens available while blocking a busy retry command", () => {
    const run = boardRun({
      phase: "push-pending",
      work: { id: "R123", title: "Fixture", brief: "Recorded brief" },
    });
    const items = localRunAttention(run, new Set(), epoch);
    expect(items.some(item => item.kind === "retry")).toBe(false);
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

  it("shows the conditional abort, retries checks without a rebase, and resumes a partially copied merge", () => {
    const plan = { files: [{ status: "M", path: "app.ts" }], conflicts: [{ path: "app.ts", committed: true, uncommitted: false }],
      branch: "main", expected: "main", canRefresh: true, refreshBase: "new-base",
      refreshCommands: [["git", "rebase", "--onto", "new-base"], ["git", "rebase", "--abort"]] };
    const render = (changes: Partial<LocalRunView>) => renderToStaticMarkup(
      createElement(LocalActions, { run: boardRun({ phase: "uat-ready", head: "candidate", mergePlan: plan, ...changes }), busy: false, act: () => {} }));
    const conflict = render({});
    expect(conflict).toContain("On rebase conflict");
    expect(conflict).toContain("git rebase --abort");
    expect(conflict).toContain(">Refresh</button>");
    expect(render({ phase: "refresh-failed", mergePlan: { ...plan, refreshCommands: [] } })).toContain(">Retry checks</button>");
    const partial = render({ canMerge: true, merge_pending: { main_head: "new-base" } });
    expect(partial).toContain(">Resume merge</button>");
    expect(partial).not.toContain("git rebase");
    expect(partial).not.toContain("<summary>Discard</summary>");
    const legacy = render({ phase: "merged", mergePlan: null, applied: { at: "now", main_head: "base", files: ["a"], pm_error: null } });
    expect(legacy).toContain("<summary>Discard worktree</summary>");
    const committed = render({ phase: "committed", publication: { action: "push", recover: true, commands: [["git", "ls-remote", "internal"]],
      files: [], reason: null, token: "bound" } });
    expect(committed).toContain("<summary>Discard worktree</summary>");
    expect(committed).toContain(">Verify push</button>");
  });
});

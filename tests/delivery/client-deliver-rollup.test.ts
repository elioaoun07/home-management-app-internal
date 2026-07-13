import { describe, expect, it } from "vitest";
import { fileTasks } from "../../scripts/pm/shared/tasks.mjs";
import { deliverEligibility } from "../../scripts/pm/src/features/delivery/deliveryStore.js";

describe("checklist rollup Deliver shortcut", () => {
  const raw = [
    "## Now",
    "- `[_skip]` display-only row",
    "- [ ] **N4** Open work _(blocker - S)_",
    "```md",
    "- [ ] fenced fake",
    "```",
    "- [x] completed work",
  ].join("\n");

  it("derives checkbox identity from the shared scanner without skipped rows", () => {
    expect(fileTasks(raw).map((task) => [task.cbidx, task.state])).toEqual([[0, "open"], [1, "done"]]);
  });

  it("only exposes delivery for open topic tasks without an active session", () => {
    const task = { ...fileTasks(raw)[0], file: "Budget/4 - Checklist.md", module: "Budget" };
    expect(deliverEligibility(task, [], ["Budget"]).eligible).toBe(true);
    expect(deliverEligibility({ ...task, state: "done" }, [], ["Budget"]).eligible).toBe(false);
    expect(deliverEligibility(task, [{ sessionId: "s1", state: "BUILDING", item: { pmFile: task.file, cbidx: task.cbidx } }], ["Budget"])).toMatchObject({ eligible: false, sessionId: "s1" });
  });

  it("keeps non-topic tasks out of Delivery", () => {
    const task = { ...fileTasks(raw)[0], file: "Notes.md", module: "Command Center" };
    expect(deliverEligibility(task, [], ["Budget"]).eligible).toBe(false);
  });
});

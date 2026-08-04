import { describe, expect, it } from "vitest";
import { moveCheckboxUnderHeading } from "../../scripts/pm/mutations.mjs";
import { fileTasks } from "../../scripts/pm/shared/tasks.mjs";

const board = `# Demo

## Now

- [ ] **D-1** First item _(blocker - S)_
- [ ] **D-2** Second item _(friction - M)_

## Next

- [ ] **D-3** Third item _(annoyance - S)_

## Later

- [ ] **D-4** Fourth item _(parked - L)_
`;

describe("checklist lane moves", () => {
  it("moves the selected task under the requested heading", () => {
    const expectedLine = "- [ ] **D-1** First item _(blocker - S)_";
    const result = moveCheckboxUnderHeading(board, 0, "Later", expectedLine);

    expect(result.ok).toBe(true);
    expect(result.fromHeading).toBe("Now");
    expect(fileTasks(result.raw).find((task) => task.idChip === "D-1")?.section).toBe("Later");
    expect(fileTasks(result.raw).filter((task) => task.idChip === "D-1")).toHaveLength(1);
  });

  it("refuses a stale line instead of moving a different task", () => {
    expect(moveCheckboxUnderHeading(board, 0, "Next", "an older version")).toEqual({
      ok: false,
      reason: "stale-line",
    });
  });

  it("requires the destination heading to exist", () => {
    expect(moveCheckboxUnderHeading(board, 0, "Someday", null)).toEqual({
      ok: false,
      reason: "heading-not-found",
    });
  });
});

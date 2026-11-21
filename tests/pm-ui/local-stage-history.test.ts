import { describe, expect, it } from "vitest";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { localStageGame } from "../../scripts/pm/app/stage/game";
import { boardRun, epoch, passedChecks, row } from "./local-board-fixtures";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";

const rows = () => [
  row(0, "status", "Installing dependencies"),
  row(2, "status", "Native session started"),
  row(3, "edit", "src/a.ts"),
  row(10, "status", "Host checks started"),
  row(11, "status", "typecheck: 0"),
  row(12, "status", "lint: 0"),
  row(13, "status", "test: 0"),
  row(14, "status", "pm:lint: 0"),
  row(20, "status", "Ready for owner UAT"),
  row(25, "status", "Owner shipped merge"),
];
function facts(activity: LocalRunView["activity"]) {
  const run = boardRun({
    phase: "shipped",
    head: "candidate-a",
    checks: passedChecks(),
    activity,
  });
  const timeline = buildTimeline(run);
  return localStageGame(timeline, sceneAt(timeline, timeline.end ?? epoch));
}
const awardIds = (value: ReturnType<typeof facts>) =>
  value.badges.map((badge) => badge.id);
describe("Optional8 setup-prefix game compatibility", () => {
  it("retains First contact, First cut, Sprint and S with a real complete setup/Native trace", () => {
    const value = facts(rows());
    expect(value).toMatchObject({
      completeHistory: true,
      everStale: false,
      rank: "S",
    });
    expect(awardIds(value)).toEqual(
      expect.arrayContaining(["contact", "cut", "sprint"]),
    );
  });
  it("preserves the original Native-first capture behavior", () => {
    const value = facts(rows().slice(1));
    expect(value).toMatchObject({
      completeHistory: true,
      everStale: false,
      rank: "S",
    });
    expect(awardIds(value)).toEqual(
      expect.arrayContaining(["contact", "cut", "sprint"]),
    );
  });
  it.each(["message", "command", "tool"])(
    "a native %s quoting installation cannot prove a complete start",
    (kind) => {
      const value = facts([
        row(0, kind, "Installing dependencies"),
        ...rows().slice(1),
      ]);
      expect(value).toMatchObject({ completeHistory: false, rank: "A" });
      expect(awardIds(value)).not.toEqual(expect.arrayContaining(["contact"]));
      expect(awardIds(value)).not.toEqual(expect.arrayContaining(["cut"]));
      expect(awardIds(value)).not.toEqual(expect.arrayContaining(["sprint"]));
    },
  );
  it("a setup row without a genuine Native start does not prove complete history", () => {
    const value = facts([
      rows()[0],
      row(2, "message", "Native session started"),
      ...rows().slice(2),
    ]);
    expect(value).toMatchObject({ completeHistory: false, rank: "A" });
    expect(awardIds(value)).not.toContain("sprint");
  });
  it("an untyped setup observation cannot substitute for a supervisor status", () => {
    const value = facts([
      { at: rows()[0].at, summary: "Installing dependencies" },
      ...rows().slice(1),
    ]);
    expect(value.completeHistory).toBe(false);
  });
  it("the setup prefix does not waive the retained-history cap", () => {
    const value = facts([
      ...rows(),
      ...Array.from({ length: 190 }, (_, index) =>
        row(26 + index, "status", "Recorded observation"),
      ),
    ]);
    expect(value).toMatchObject({ completeHistory: false, rank: "A" });
    expect(awardIds(value)).not.toContain("sprint");
  });
});

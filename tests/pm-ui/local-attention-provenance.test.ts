import { describe, expect, it } from "vitest";
import { localRunAttention } from "../../scripts/pm/app/localRunAttention";
import { boardRun, epoch, handover, row } from "./local-board-fixtures";

describe("R123 attention supervisor provenance", () => {
  it.each(["message", "command", "tool"])(
    "a %s quoting Host checks started does not become the candidate boundary",
    (kind) => {
      const run = boardRun({
        head: "candidate-a",
        activity: [
          row(0, "status", "Native session started"),
          row(1, kind, "Host checks started"),
          row(2, "message", "Recorded final summary"),
          row(3, "status", "Host checks started"),
          row(4, "message", "Later note"),
        ],
      });
      expect(
        localRunAttention(run, new Set(), epoch + 10_000).find(
          (item) => item.kind === "summary",
        )?.detail,
      ).toBe("Recorded final summary");
    },
  );
  it.each(["message", "command", "tool"])(
    "a %s quoting Ready for owner UAT does not create a testing gate",
    (kind) => {
      const run = boardRun({
        phase: "building",
        handover: handover(),
        activity: [row(1, kind, "Ready for owner UAT")],
      });
      expect(
        localRunAttention(run, new Set(), epoch + 10_000).some(
          (item) => item.kind === "test",
        ),
      ).toBe(false);
    },
  );
});

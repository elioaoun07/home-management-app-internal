import { describe, expect, it } from "vitest";
import { createBoardPlayback } from "../../scripts/pm/app/stage/playback";
import type { CeremonyKind } from "../../scripts/pm/app/stage/director";
import { boardRun, row } from "./local-board-fixtures";
import { playbackInput } from "./local-board-playback-fixtures";

interface Case {
  summary: string;
  phase: string;
  state?: string;
  error?: string;
  kind: CeremonyKind;
  duration: number;
  check?: { exit: number | null; error: string | null };
}
const cases: Case[] = [
  {
    summary: "Native session started",
    phase: "building",
    kind: "boot",
    duration: 2500,
  },
  {
    summary: "Host checks started",
    phase: "checking",
    kind: "verify",
    duration: 2400,
  },
  {
    summary: "typecheck: 0",
    phase: "checking",
    kind: "gate-pass",
    duration: 900,
    check: { exit: 0, error: null },
  },
  {
    summary: "typecheck: 1",
    phase: "checking",
    kind: "gate-fail",
    duration: 1200,
    check: { exit: 1, error: null },
  },
  {
    summary: "typecheck: null",
    phase: "checking",
    kind: "gate-inconclusive",
    duration: 1200,
    check: { exit: null, error: null },
  },
  {
    summary: "typecheck: 0",
    phase: "checking",
    kind: "gate-inconclusive",
    duration: 1200,
    check: { exit: 0, error: "Recorded runner error" },
  },
  {
    summary: "Ready for owner UAT",
    phase: "uat-ready",
    state: "your-turn",
    kind: "handover",
    duration: 6000,
  },
  {
    summary: "Owner opened diff review",
    phase: "uat-ready",
    state: "your-turn",
    kind: "review",
    duration: 1800,
  },
  {
    summary: "Owner shipped merge",
    phase: "shipped",
    state: "shipped",
    kind: "launch",
    duration: 8000,
  },
  {
    summary: "Owner reverted merge",
    phase: "reverted",
    state: "reverted",
    kind: "reverted",
    duration: 1800,
  },
  {
    summary: "native session did not confirm success",
    phase: "failed",
    state: "failed",
    error: "native session did not confirm success",
    kind: "failure",
    duration: 5000,
  },
  {
    summary: "cancelled",
    phase: "cancelled",
    state: "cancelled",
    error: "cancelled",
    kind: "cancelled",
    duration: 3000,
  },
];

describe("R123 retained supervisor ceremony matrix", () => {
  it.each(cases)(
    "$kind preserves duration and evidence for $summary",
    (value) => {
      const initial = playbackInput(boardRun({ activity: [] }));
      const playback = createBoardPlayback(initial, 0);
      const next = playbackInput(
        boardRun({
          phase: value.phase,
          error: value.error,
          activity: [row(1, "status", value.summary)],
          checks: value.check
            ? [{ name: "typecheck", ...value.check, stdout: "", stderr: "" }]
            : [],
        }),
        { state: value.state ?? "live" },
      );
      playback.update(next, 6000);
      const opening = playback.sample(6000).ceremony;
      expect(opening).toMatchObject({ kind: value.kind, progress: 0 });
      expect(playback.sample(6000 + value.duration / 2).ceremony).toMatchObject(
        { kind: value.kind, progress: 0.5 },
      );
      expect(playback.sample(6000 + value.duration).ceremony).toMatchObject({
        kind: value.kind,
        progress: 1,
      });
      if (value.check)
        expect(opening).toMatchObject({
          check: "typecheck",
          exit: value.check.exit,
        });
      expect(playback.observations(6000).map((event) => event.summary)).toEqual(
        [value.error ? "Session failed · see error details" : value.summary],
      );
      expect(playback.observations(6000 + value.duration)).toEqual([]);
    },
  );
});

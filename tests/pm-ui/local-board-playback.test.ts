import { describe, expect, it } from "vitest";
import { createBoardPlayback } from "../../scripts/pm/app/stage/playback";
import { boardRun, row } from "./local-board-fixtures";
import { playbackInput } from "./local-board-playback-fixtures";

describe("R123 live board playback", () => {
  it("starts the mount boot at zero and releases it after the prescribed duration", () => {
    const playback = createBoardPlayback(playbackInput(), 1000);
    expect(playback.sample(1000).ceremony).toMatchObject({
      kind: "boot",
      progress: 0,
    });
    expect(playback.sample(2250).ceremony).toMatchObject({
      kind: "boot",
      progress: 0.5,
    });
    expect(playback.sample(3500).ceremony).toBeUndefined();
  });
  it("does not play mounted historical rows or emit their cues", () => {
    const input = playbackInput(
      boardRun({
        activity: [
          row(0, "status", "Native session started"),
          row(1, "edit", "src/old.ts"),
        ],
      }),
    );
    const playback = createBoardPlayback(input, 0);
    expect(playback.observations(3000)).toEqual([]);
    expect(playback.sample(3000)).toMatchObject({
      beat: null,
      backlog: 0,
      replay: null,
    });
    playback.update({ ...input }, 3100);
    expect(playback.observations(4000)).toEqual([]);
  });
  it("retains all six stages of a fresh edit and emits its start once", () => {
    const input = playbackInput(),
      playback = createBoardPlayback(input, 0);
    const next = playbackInput(
      boardRun({
        activity: [
          ...input.timeline.run.activity,
          row(1, "edit", "src/new.ts"),
        ],
      }),
    );
    playback.update(next, 6000);
    const expected = [
      [0, "think"],
      [500, "decide"],
      [900, "travel"],
      [2300, "work"],
      [3700, "deliver"],
      [4200, "remember"],
    ] as const;
    for (const [elapsed, stage] of expected)
      expect(playback.sample(6000 + elapsed).beat).toMatchObject({
        id: "native:1",
        stage,
      });
    expect(playback.observations(6000).map((event) => event.id)).toEqual([
      "native:1",
    ]);
    expect(playback.observations(10_400)).toEqual([]);
    expect(playback.sample(10_400).beat).toBeNull();
    playback.update(playbackInput(next.timeline.run), 11_000);
    expect(playback.sample(11_000).backlog).toBe(0);
  });
  it("an agent check remains neutral work, not a supervisor gate", () => {
    const initial = playbackInput(),
      playback = createBoardPlayback(initial, 0);
    playback.update(
      playbackInput(
        boardRun({
          activity: [
            ...initial.timeline.run.activity,
            row(1, "command", "pnpm typecheck"),
          ],
        }),
      ),
      6000,
    );
    expect(playback.sample(8500).beat).toMatchObject({
      action: "agent-check",
      stage: "work",
    });
    expect(playback.sample(8500).ceremony).toBeUndefined();
  });
  it("acts out a 120-row tied burst within twelve seconds and observes every start once", () => {
    const initial = playbackInput(),
      playback = createBoardPlayback(initial, 0);
    const activity = [
      ...initial.timeline.run.activity,
      ...Array.from({ length: 120 }, (_, index) =>
        row(1, "edit", `src/file-${index}.ts`, index + 1),
      ),
    ];
    playback.update(playbackInput(boardRun({ activity })), 6000);
    const seen = playback.observations(6000);
    seen.push(...playback.observations(18_001));
    expect(seen).toHaveLength(120);
    expect(new Set(seen.map((event) => event.id)).size).toBe(120);
    expect(playback.sample(18_001)).toMatchObject({ beat: null, backlog: 0 });
    expect(playback.observations(19_000)).toEqual([]);
  });
  it("preserves ceremony provenance and gate result payloads", () => {
    const initial = playbackInput(),
      playback = createBoardPlayback(initial, 0);
    playback.update(
      playbackInput(
        boardRun({
          phase: "checking",
          head: "candidate",
          activity: [
            ...initial.timeline.run.activity,
            row(1, "status", "Host checks started"),
          ],
        }),
      ),
      6000,
    );
    expect(playback.sample(7200).ceremony).toMatchObject({
      kind: "verify",
      progress: 0.5,
    });
    playback.update(
      playbackInput(
        boardRun({
          phase: "checking",
          head: "candidate",
          checks: [
            { name: "typecheck", exit: 0, error: null, stdout: "", stderr: "" },
          ],
          activity: [
            ...initial.timeline.run.activity,
            row(1, "status", "Host checks started"),
            row(2, "status", "typecheck: 0"),
          ],
        }),
      ),
      9000,
    );
    expect(playback.sample(9450).ceremony).toMatchObject({
      kind: "gate-pass",
      check: "typecheck",
      exit: 0,
      progress: 0.5,
    });
  });
  it.each(["signal-lost", "link-down"])(
    "suppresses beats and ceremonies in %s",
    (state) => {
      const input = playbackInput(),
        playback = createBoardPlayback(input, 0);
      const next = playbackInput(
        boardRun({
          activity: [
            ...input.timeline.run.activity,
            row(1, "edit", "src/new.ts"),
          ],
        }),
      );
      playback.update(next, 6000);
      playback.update({ ...next, state }, 6200);
      expect(playback.sample(6500)).toMatchObject({
        beat: null,
        beats: [],
        ceremony: undefined,
      });
    },
  );
  it.each(["signal-lost", "link-down"])(
    "does not emit queued work starts while %s is frozen",
    (state) => {
      const initial = playbackInput(),
        playback = createBoardPlayback(initial, 0);
      const next = playbackInput(
        boardRun({
          activity: [
            ...initial.timeline.run.activity,
            row(1, "edit", "src/a.ts"),
            row(2, "edit", "src/b.ts"),
          ],
        }),
      );
      playback.update(next, 6000);
      expect(playback.observations(6000).map((event) => event.id)).toEqual([
        "native:1",
      ]);
      playback.update({ ...next, state }, 6200);
      expect(playback.observations(12_000)).toEqual([]);
    },
  );
  it("ended/owner-waiting live states suppress ordinary work while keeping real ending ceremonies", () => {
    const input = playbackInput(),
      playback = createBoardPlayback(input, 0);
    const next = playbackInput(
      boardRun({
        phase: "failed",
        error: "git commit: hook failed",
        activity: [
          ...input.timeline.run.activity,
          row(1, "edit", "src/new.ts"),
          row(2, "status", "git commit: hook failed"),
        ],
      }),
      { state: "failed" },
    );
    playback.update(next, 6000);
    expect(playback.sample(7000)).toMatchObject({
      beat: null,
      ceremony: { kind: "failure", progress: 0.2 },
    });
  });
  it("a narrator quoting a milestone never starts a supervisor ceremony", () => {
    const input = playbackInput(),
      playback = createBoardPlayback(input, 0);
    playback.update(
      playbackInput(
        boardRun({
          activity: [
            ...input.timeline.run.activity,
            row(1, "message", "Ready for owner UAT"),
          ],
        }),
      ),
      6000,
    );
    expect(playback.sample(6200)).toMatchObject({
      beat: { action: "message" },
      ceremony: undefined,
    });
  });
  it("a signal loss does not turn absence into a new row", () => {
    const input = playbackInput(boardRun({ activity: [] })),
      playback = createBoardPlayback(input, 0);
    playback.update(
      {
        ...input,
        state: "signal-lost",
        snapshot: {
          ...input.snapshot,
          run: { ...input.snapshot.run, interrupted: true },
        },
      },
      6000,
    );
    expect(playback.observations(9000)).toEqual([]);
    expect(playback.sample(9000).replay).toBeNull();
  });
});

describe("R123 observation recovery", () => {
  it.each(["signal-lost", "link-down"])(
    "expires pending work across %s and acts out only a newly observed recovery row",
    (state) => {
      const initial = playbackInput(),
        playback = createBoardPlayback(initial, 0);
      const activity = [
        ...initial.timeline.run.activity,
        row(1, "edit", "src/a.ts"),
        row(2, "edit", "src/b.ts"),
      ];
      const queued = playbackInput(boardRun({ activity }));
      playback.update(queued, 6000);
      playback.observations(6000);
      playback.update({ ...queued, state }, 6200);
      expect(playback.observations(12_000)).toEqual([]);
      const whileLost = playbackInput(
        boardRun({
          activity: [...activity, row(3, "edit", "src/while-lost.ts")],
        }),
        { state },
      );
      playback.update(whileLost, 12_100);
      const recovered = { ...whileLost, state: "live" };
      playback.update(recovered, 13_000);
      expect(playback.observations(13_000)).toEqual([]);
      expect(playback.sample(13_000)).toMatchObject({
        beat: null,
        backlog: 0,
        ceremony: undefined,
      });
      const fresh = playbackInput(
        boardRun({
          activity: [
            ...whileLost.timeline.run.activity,
            row(4, "edit", "src/fresh.ts"),
          ],
        }),
      );
      playback.update(fresh, 14_000);
      expect(playback.sample(14_000).beat).toMatchObject({
        id: "native:4",
        stage: "think",
      });
      expect(playback.observations(14_000).map((event) => event.id)).toEqual([
        "native:4",
      ]);
      expect(playback.observations(15_000)).toEqual([]);
    },
  );
});

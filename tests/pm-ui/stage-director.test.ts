import { describe, expect, it } from "vitest";
import type { LocalActivityEvent } from "../../scripts/pm/app/localRunActivityModel";
import {
  activeBeatAt,
  activeBeatsAt,
  backlogPolicy,
  beatAt,
  beatAction,
  beatsStartingBetween,
  ceremonyAt,
  ceremonyForEvent,
  ceremonyForPhase,
  EDIT_BEAT_STAGES,
  makeFullEditTimeline,
  makeReplayTimeline,
  latestCeremonyAt,
  planBeats,
  planCeremonies,
  replayAt,
  presentationAtRecorded,
  remapPresentation,
  STAGE_TEMPOS,
  type StageTempo,
} from "../../scripts/pm/app/stage/director";

const event = (
  id = "native:1",
  kind: LocalActivityEvent["kind"] = "edit",
): LocalActivityEvent => ({
  id,
  at: "2026-11-15T10:00:00Z",
  kind,
  label: kind === "edit" ? "Edited route.ts" : "Read route.ts",
  detail: "src/app/api/route.ts",
  summary: "src/app/api/route.ts",
  station: kind === "edit" ? "forge" : "source",
  paths: ["src/app/api/route.ts"],
  command: null,
  agent: null,
});

describe("Foundry replay tempo continuity", () => {
  const pairs: [StageTempo, StageTempo][] = [
    [0.75, 1.5],
    [1.5, 0.75],
  ];
  it.each(pairs)(
    "keeps the same tied row and beat stage across%j to%j tempo",
    (from, to) => {
      const rows = [event("first"), event("second"), event("third")];
      const before = makeReplayTimeline(rows, { mode: "full", tempo: from });
      const after = makeReplayTimeline(rows, { mode: "full", tempo: to });
      const segment = before.segments.find(
        (entry) => entry.event?.id === "second",
      )!;
      const oldTime =
        segment.startAt + (segment.endAt - segment.startAt) * 0.63;
      const prior = replayAt(before, oldTime),
        current = replayAt(after, remapPresentation(before, after, oldTime));
      expect(prior.event?.id).toBe("second");
      expect(current.event?.id).toBe("second");
      expect(current.beat?.stage).toBe(prior.beat?.stage);
      expect(current.beat?.progress).toBeCloseTo(prior.beat!.progress);
      expect(current.recordedTime).toBe(prior.recordedTime);
      expect(remapPresentation(before, after, segment.startAt)).toBe(
        after.segments.find((entry) => entry.event?.id === "second")!.startAt,
      );
    },
  );
  it.each(pairs)(
    "preserves a real silence's fraction and timestamp across%j to%j tempo",
    (from, to) => {
      const rows = [
        event("read", "read"),
        { ...event("edit"), at: "2026-11-15T10:05:25Z" },
      ];
      const before = makeReplayTimeline(rows, { mode: "full", tempo: from }),
        after = makeReplayTimeline(rows, { mode: "full", tempo: to });
      const gap = before.segments.find((segment) => segment.kind === "gap")!;
      const time = gap.startAt + (gap.endAt - gap.startAt) * 0.45;
      const prior = replayAt(before, time),
        current = replayAt(after, remapPresentation(before, after, time));
      expect(current.gap).toMatchObject({ duration: 325000, tag: "5:25" });
      expect(current.gap?.progress).toBeCloseTo(0.45);
      expect(current.recordedTime).toBeCloseTo(prior.recordedTime!, 3);
    },
  );
  it("keeps ceremony progress and the final frame rather than replaying its entrance", () => {
    const rows = [
      { ...event("handover", "event"), summary: "Ready for owner UAT" },
    ];
    const before = makeReplayTimeline(rows, { mode: "full", tempo: 0.75 }),
      after = makeReplayTimeline(rows, { mode: "full", tempo: 1.5 });
    const mapped = remapPresentation(before, after, before.duration * 0.7);
    expect(replayAt(after, mapped).ceremony).toMatchObject({
      kind: "handover",
      progress: 0.7,
    });
    expect(remapPresentation(before, after, before.duration)).toBe(
      after.duration,
    );
  });
  it("retains Recap idle time and maps a missing gap by its real recorded timestamp", () => {
    const rows = [
      event("read", "read"),
      { ...event("edit"), at: "2026-11-15T10:05:25Z" },
    ];
    const slow = makeReplayTimeline(rows, { mode: "recap", tempo: 0.75 }),
      fast = makeReplayTimeline(rows, { mode: "recap", tempo: 1.5 });
    expect(remapPresentation(slow, fast, 5000)).toBe(5000);
    const full = makeReplayTimeline(rows, { mode: "full" });
    const gap = full.segments.find((segment) => segment.kind === "gap")!;
    expect(
      remapPresentation(
        full,
        fast,
        gap.startAt + (gap.endAt - gap.startAt) * 0.45,
      ),
    ).toBeCloseTo(9000);
  });
  it("falls back safely when the retained segment disappears or history is empty", () => {
    const rows = [
      event("first"),
      { ...event("last"), at: "2026-11-15T10:00:10Z" },
    ];
    const before = makeReplayTimeline(rows, { mode: "full" }),
      after = makeReplayTimeline(rows.slice(1), { mode: "full" }),
      empty = makeReplayTimeline([]);
    expect(remapPresentation(before, after, 1000)).toBe(0);
    expect(remapPresentation(empty, before, 0)).toBe(0);
    expect(remapPresentation(before, empty, 1000)).toBe(0);
  });
});

describe("Foundry recorded-row director", () => {
  it("plays the six literal Edit intervals at tempo one", () => {
    const row = event();
    const [beat] = planBeats([row], [], { startAt: 100 });
    expect(beat.event).toBe(row);
    expect(beat.duration).toBe(4400);
    expect(
      beat.stages.map((stage) => [
        stage.stage,
        stage.startAt - 100,
        stage.endAt - 100,
      ]),
    ).toEqual([
      ["think", 0, 500],
      ["decide", 500, 900],
      ["travel", 900, 2300],
      ["work", 2300, 3700],
      ["deliver", 3700, 4200],
      ["remember", 4200, 4400],
    ]);
    for (const stage of beat.stages) {
      expect(beatAt(beat, stage.startAt).stage).toBe(stage.stage);
      expect(beatAt(beat, stage.startAt).progress).toBe(0);
      expect(
        beatAt(beat, (stage.startAt + stage.endAt) / 2).progress,
      ).toBeCloseTo(0.5);
    }
  });

  it("multiplies every duration by the selected tempo", () => {
    for (const tempo of STAGE_TEMPOS) {
      const [beat] = planBeats([event()], [], { startAt: 5000, tempo });
      expect(beat.endAt - beat.startAt).toBe(4400 * tempo);
      expect(beat.stages.map((stage) => stage.endAt - stage.startAt)).toEqual(
        EDIT_BEAT_STAGES.map((stage) => (stage.end - stage.start) * tempo),
      );
    }
  });

  it("clamps arbitrary frames without inventing a fact or mutating an observation", () => {
    const row = Object.freeze(event());
    const [beat] = planBeats([row], [], { startAt: 1000 });
    expect(beatAt(beat, 0)).toMatchObject({
      event: row,
      stage: "think",
      progress: 0,
      pending: true,
      complete: false,
      elapsed: 0,
    });
    expect(beatAt(beat, 20_000)).toMatchObject({
      event: row,
      stage: "remember",
      progress: 1,
      pending: false,
      complete: true,
      elapsed: 4400,
    });
    expect(row.label).toBe("Edited route.ts");
    expect(row.paths).toEqual(["src/app/api/route.ts"]);
  });

  it("deduplicates stable IDs and preserves recorded order across queue additions", () => {
    const initial = planBeats([event("native:1")], [], { startAt: 100 });
    const queued = planBeats(
      [event("native:1"), event("native:2"), event("native:2")],
      initial,
      { startAt: 200 },
    );
    expect(initial).toHaveLength(1);
    expect(queued.map((beat) => beat.id)).toEqual(["native:1", "native:2"]);
    expect(queued[1].startAt).toBe(queued[0].endAt);
    expect(activeBeatAt(queued, queued[0].endAt)?.id).toBe("native:2");
    expect(activeBeatAt(queued, queued[1].endAt)).toBeNull();
  });

  it("stages native row kinds while keeping host checks as ceremonies", () => {
    expect(
      planBeats([
        event("read", "read"),
        event("command", "command"),
        event("check", "check"),
        event("message", "message"),
      ]).map((beat) => beat.action),
    ).toEqual(["read", "command", "message"]);
    const anonymous = {
      ...event(),
      label: "Edit requested",
      detail: null,
      paths: [],
    };
    expect(makeFullEditTimeline([anonymous])[0].event).toEqual(anonymous);
  });

  it("keeps queue policy explicit at every boundary", () => {
    for (const count of [0, 1])
      expect(backlogPolicy(count, 12_000)).toMatchObject({
        mode: "full",
        speed: 1,
        skipThink: false,
      });
    for (const count of [2, 3])
      expect(backlogPolicy(count, 0)).toMatchObject({
        mode: "accelerated",
        speed: 1.5,
        skipThink: false,
      });
    for (const count of [4, 5, 6])
      expect(backlogPolicy(count, 0)).toMatchObject({
        mode: "accelerated",
        speed: 2.5,
        skipThink: true,
      });
    for (const [count, lag] of [
      [7, 0],
      [1, 12_001],
    ])
      expect(backlogPolicy(count, lag)).toMatchObject({
        mode: "montage",
        montageBeatMs: 350,
        maxLagMs: 12_000,
      });
  });

  it("recognises search and an agent's own check without granting a result", () => {
    expect(
      beatAction({
        ...event("search", "read"),
        label: "Searched guest_portal_tags",
      }),
    ).toBe("search");
    const ownCheck = {
      ...event("own-check", "command"),
      station: "lab" as const,
      command: "pnpm typecheck",
      label: "Ran pnpm typecheck",
    };
    const [beat] = planBeats([ownCheck]);
    expect(beat.action).toBe("agent-check");
    expect(beat.station).toBe("lab");
    expect(ceremonyForEvent(ownCheck)).toBeNull();
  });

  it("keeps slate commands and messages at the last recorded station", () => {
    const plan = planBeats(
      [event("read", "read"), event("run", "command"), event("say", "message")],
      [],
      { policy: "full", station: "launch" },
    );
    expect(plan.map((beat) => beat.station)).toEqual([
      "source",
      "source",
      "source",
    ]);
    const [drone] = planBeats([
      { ...event(), agent: { role: "subagent", id: "real-agent" } },
    ]);
    expect(drone).toMatchObject({ actor: "subagent", actorId: "real-agent" });
  });

  it("accelerates small queues and omits Think only in the4–6policy", () => {
    const pair = planBeats([event("1"), event("2")]);
    expect(pair[0].mode).toBe("accelerated");
    expect(pair[0].duration).toBeCloseTo(4400 / 1.5);
    expect(pair[0].stages[0].stage).toBe("think");
    const four = planBeats(
      Array.from({ length: 4 }, (_, index) => event(String(index))),
    );
    expect(four[0].duration).toBeCloseTo(3900 / 2.5);
    expect(four[0].stages[0].stage).toBe("decide");
  });

  it("catches up a200-row burst inside12seconds without dropping any event", () => {
    const rows = Array.from({ length: 200 }, (_, index) =>
      event(`native:${index}`),
    );
    const queue = planBeats(rows, [], { startAt: 1000 });
    expect(queue).toHaveLength(200);
    expect(queue.every((beat) => beat.mode === "montage")).toBe(true);
    expect(Math.max(...queue.map((beat) => beat.endAt))).toBeCloseTo(13_000);
    expect(
      new Set(beatsStartingBetween(queue, 999, 13_000).map((beat) => beat.id))
        .size,
    ).toBe(200);
    expect(activeBeatsAt(queue, 1500).length).toBeGreaterThan(1);
    expect(activeBeatAt(queue, 1500)?.id).toBe(
      activeBeatsAt(queue, 1500).at(-1)?.id,
    );
  });

  it("preserves the active pose while replanning pending scenes after a burst", () => {
    const [first] = planBeats([event("first")], [], { startAt: 100 });
    const queue = planBeats(
      Array.from({ length: 12 }, (_, index) => event(`next:${index}`)),
      [first],
      { startAt: 600 },
    );
    expect(queue[0]).toBe(first);
    expect(queue.slice(1).every((beat) => beat.startAt >= first.endAt)).toBe(
      true,
    );
    expect(Math.max(...queue.map((beat) => beat.endAt))).toBeLessThanOrEqual(
      12_600,
    );
  });

  it("uses supervisor evidence for the prescribed ceremonies", () => {
    const recorded = (
      summary: string,
      kind: LocalActivityEvent["kind"] = "event",
    ) => ({ ...event(summary, kind), summary });
    const rows = [
      recorded("Native session started"),
      recorded("Host checks started"),
      recorded("Ready for owner UAT"),
      recorded("Owner shipped merge"),
      recorded("real failure", "failure"),
    ];
    expect(rows.map((row) => ceremonyForEvent(row)?.duration)).toEqual([
      2500, 2400, 6000, 8000, 5000,
    ]);
    const [ceremony] = planCeremonies([rows[0]], [], {
      startAt: 100,
      tempo: 1.5,
    });
    expect(ceremonyAt(ceremony, ceremony.endAt)).toMatchObject({
      kind: "boot",
      progress: 1,
      complete: true,
      duration: 3750,
    });
    expect(ceremonyForEvent(recorded("test: null", "check"))?.kind).toBe(
      "gate-inconclusive",
    );
    expect(
      ceremonyForEvent({
        ...recorded("pm:lint: 0", "check"),
        label: "Check inconclusive",
      })?.kind,
    ).toBe("gate-inconclusive");
    expect(ceremonyForEvent(recorded("test: 1", "check"))?.kind).toBe(
      "gate-fail",
    );
    expect(ceremonyForEvent(recorded("test: 0", "check"))?.kind).toBe(
      "gate-pass",
    );
    expect(
      ceremonyForEvent(recorded("aborted", "failure"), "cancelled")?.kind,
    ).toBe("cancelled");
    expect(ceremonyForPhase("cancelled")?.kind).toBe("cancelled");
  });

  it("never promotes quoted supervisor words or a shell command into evidence", () => {
    for (const kind of ["message", "command", "read", "edit"] as const) {
      expect(
        ceremonyForEvent({
          ...event("prose", kind),
          summary: "Owner shipped merge",
        }),
      ).toBeNull();
      expect(
        ceremonyForEvent({ ...event("prose", kind), summary: "test: 0" }),
      ).toBeNull();
    }
  });

  it("bounds live ceremony starts without shortening their prescribed duration", () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      ...event(String(index), "event"),
      summary: index === 19 ? "Owner shipped merge" : "Ready for owner UAT",
    }));
    const queue = planCeremonies(rows, [], { startAt: 1000, tempo: 1.5 });
    expect(queue).toHaveLength(20);
    expect(Math.max(...queue.map((entry) => entry.endAt))).toBeLessThanOrEqual(
      13_000,
    );
    expect(queue[0].duration).toBe(9000);
    expect(queue.at(-1)?.duration).toBe(12_000);
    expect(latestCeremonyAt(queue, 13_500)).toMatchObject({
      kind: "launch",
      complete: true,
      progress: 1,
    });
    const full = planCeremonies(rows, [], {
      startAt: 1000,
      tempo: 1.5,
      policy: "full",
    });
    expect(full.at(-1)!.endAt).toBeGreaterThan(13_000);
  });

  it("separates full presentation time from a real five-minute silence", () => {
    const start = Date.parse("2026-11-15T10:00:00Z");
    const first = {
      ...event("read", "read"),
      at: new Date(start).toISOString(),
    };
    const second = {
      ...event("edit"),
      at: new Date(start + 325_000).toISOString(),
    };
    const timeline = makeReplayTimeline([first, second], { mode: "full" });
    expect(timeline.segments.map((segment) => segment.kind)).toEqual([
      "beat",
      "gap",
      "beat",
    ]);
    expect(timeline.duration).toBe(4400 + 2000 + 4400);
    expect(replayAt(timeline, 4400)).toMatchObject({
      event: first,
      recordedTime: start,
      gap: { duration: 325_000, tag: "5:25", progress: 0 },
    });
    expect(replayAt(timeline, 5400).recordedTime).toBe(start + 162_500);
    expect(replayAt(timeline, 6400)).toMatchObject({
      event: second,
      recordedTime: start + 325_000,
      beat: { stage: "think", progress: 0 },
    });
    expect(replayAt(timeline, timeline.duration)).toMatchObject({
      complete: true,
      event: second,
      beat: { stage: "remember", progress: 1 },
    });
  });

  it("retains short gaps, equal-time row ordering and empty-history uncertainty", () => {
    const one = event("1"),
      two = event("2"),
      three = { ...event("3"), at: "2026-11-15T10:00:00.500Z" };
    const timeline = makeReplayTimeline([one, two, three], { mode: "full" });
    expect(timeline.events.map((row) => row.id)).toEqual(["1", "2", "3"]);
    expect(
      timeline.segments
        .filter((segment) => segment.kind === "gap")
        .map((segment) => [
          segment.realGap,
          segment.endAt - segment.startAt,
          segment.gapTag,
        ]),
    ).toEqual([[500, 500, null]]);
    expect(replayAt(makeReplayTimeline([], { mode: "full" }), 0)).toMatchObject(
      { recordedTime: null, event: null, complete: true },
    );
  });

  it("keeps Recap at20seconds while preserving the recorded clock and final outcome", () => {
    const first = event("1", "read"),
      last = {
        ...event("2", "event"),
        at: "2026-11-15T10:10:00Z",
        summary: "Owner shipped merge",
      };
    const timeline = makeReplayTimeline([first, last], { mode: "recap" });
    expect(timeline.duration).toBe(20_000);
    expect(replayAt(timeline, 10_000).recordedTime).toBe(
      Date.parse("2026-11-15T10:05:00Z"),
    );
    expect(replayAt(timeline, 20_000)).toMatchObject({
      event: last,
      ceremony: { kind: "launch", progress: 1 },
      complete: true,
    });
    const cancelled = makeReplayTimeline(
      [{ ...last, kind: "failure", summary: "aborted" }],
      { mode: "full", terminalPhase: "cancelled" },
    );
    expect(cancelled.segments[0].ceremony?.kind).toBe("cancelled");
  });

  it("reverses source time through Full silences and disambiguates equal-time IDs", () => {
    const one = event("1"),
      two = event("2"),
      three = { ...event("3"), at: "2026-11-15T10:05:00Z" };
    const plan = makeReplayTimeline([one, two, three], { mode: "full" });
    const at = Date.parse(one.at),
      later = Date.parse(three.at);
    expect(presentationAtRecorded(plan, at, "1")).toBe(0);
    expect(presentationAtRecorded(plan, at, "2")).toBe(4400);
    expect(presentationAtRecorded(plan, later)).toBe(plan.duration);
    expect(presentationAtRecorded(plan, later, "3")).toBe(10_800);
    const halfway = at + (later - at) / 2;
    expect(
      replayAt(plan, presentationAtRecorded(plan, halfway)).recordedTime,
    ).toBe(halfway);
    const recap = makeReplayTimeline([one, two, three], { mode: "recap" });
    expect(
      replayAt(recap, presentationAtRecorded(recap, halfway)).recordedTime,
    ).toBe(halfway);
    expect(presentationAtRecorded(makeReplayTimeline([]), at)).toBe(0);
  });
});

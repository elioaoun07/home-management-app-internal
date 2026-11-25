import { afterEach, expect, it, vi } from "vitest";
import { bakeBoardAssets, bakePartFacts } from "../../scripts/pm/app/stage/boardAssets";
import { buildBoardScene } from "../../scripts/pm/app/stage/boardScene";
import { bakeEra } from "../../scripts/pm/app/stage/actors/era";
import { bakeBuild } from "../../scripts/pm/app/stage/actors/build";
import { machineEvidence } from "../../scripts/pm/app/stage/machineEvidence";
import { createMotionPainter } from "../../scripts/pm/app/stage/renderMotion";
import { createMotionState } from "../../scripts/pm/app/stage/motion";
import { createBoardFx } from "../../scripts/pm/app/stage/fx";
import { boardFactKey, thinkBeadKey } from "../../scripts/pm/app/stage/facts";
import { stagePaletteFromColors } from "../../scripts/pm/app/stage/palette";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import type { BoardFacts } from "../../scripts/pm/app/stage/types";
import { boardRun, epoch, row } from "./local-board-fixtures";

afterEach(() => vi.unstubAllGlobals());
const noop = () => {};
function drawingContext() {
  const calls: { image: HTMLCanvasElement; mode: string }[] = [];
  const methods = {
    globalCompositeOperation: "source-over",
    createRadialGradient: () => ({ addColorStop: noop }),
    drawImage(image: HTMLCanvasElement) { calls.push({ image, mode: this.globalCompositeOperation }); },
  };
  const ctx = new Proxy(methods, { get: (target, key) => Reflect.get(target, key) ?? noop });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}
function messageFacts(): BoardFacts {
  const run = boardRun({ phase: "building", activity: [row(0, "message", "Updating the plan")] });
  const timeline = buildTimeline(run);
  return { snapshot: sceneAt(timeline, timeline.end ?? epoch), state: "live", zones: [],
    currentZone: "think", activeZone: "think", buildZone: "verify", buildGate: 2 };
}
it("draws the Think pad beneath its equipment, ERA in the aisle, and the cargo between the gate posts", () => {
  vi.stubGlobal("document", { createElement: () => {
    const { ctx } = drawingContext();
    return { getContext: () => ctx };
  } });
  const palette = stagePaletteFromColors([20, 30, 40, 1], [70, 180, 255, 1], [240, 245, 250, 1],
    [140, 150, 160, 1], [50, 60, 70, 1], [5, 10, 20, 1], [251, 191, 36, 1]);
  const facts = messageFacts(), evidence = machineEvidence(facts);
  const assets = bakeBoardAssets(palette), parts = bakePartFacts(assets, palette, facts, evidence);
  const surfaces = new Map<string, HTMLCanvasElement>();
  const scenery = buildBoardScene(palette, facts, parts, assets, evidence, surfaces);
  const era = bakeEra(palette), build = bakeBuild(facts.snapshot, palette);
  const { ctx, calls } = drawingContext();
  const glow = assets.glows.build;
  const frame = { beat: null, elapsed: 1, vitality: 0, heat: 0, tempo: 1 as const, reducedMotion: true };
  createMotionPainter(createMotionState(), createBoardFx()).draw(ctx, {
    ...assets, facts, evidence, palette, glow, smoke: glow, ownerGlow: glow, scenery, era, build,
  }, frame, 0);
  const layers = [
    [assets.padLights.think.image, "source-over"],
    [surfaces.get("think"), "destination-out"],
    [parts.think?.image, "source-over"],
    [era.image, "source-over"],
    [surfaces.get("verify2rear"), "destination-out"],
    [build.image, "source-over"],
    [parts.verify?.image, "source-over"],
    [surfaces.get("verify2front"), "destination-out"],
  ] as const;
  let previous = -1;
  for (const [image, mode] of layers) {
    const index = calls.findIndex(call => call.image === image && call.mode === mode);
    expect(index).toBeGreaterThan(previous);
    previous = index;
  }
});

it("invalidates the cached event beads when replay changes the visible history behind the same last event", () => {
  const facts = messageFacts(), event = facts.snapshot.events.at(-1)!;
  const changed = { ...facts, snapshot: { ...facts.snapshot,
    events: [{ ...event, id: "prior", kind: "edit" as const }, ...facts.snapshot.events] } };
  expect(thinkBeadKey(changed.snapshot)).toBe("1" + thinkBeadKey(facts.snapshot));
  expect(boardFactKey(changed)).not.toBe(boardFactKey(facts));
});

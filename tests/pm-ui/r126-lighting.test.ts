import { describe, expect, it } from "vitest";
import { desaturateColor, eraShell, stagePaletteFromColors } from "../../scripts/pm/app/stage/palette";
import { padPoolAlpha } from "../../scripts/pm/app/stage/renderMotion";
import { boardFactKey } from "../../scripts/pm/app/stage/facts";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { zoneEvidence } from "../../scripts/pm/app/stage/zoneModel";
import type { BoardFacts } from "../../scripts/pm/app/stage/types";
import { boardRun, epoch, handover } from "./local-board-fixtures";

const rgb = (value: string) => value.match(/[\d.]+/gu)!.slice(0, 3).map(Number);
const saturation = (values: number[]) => {
  const high = Math.max(...values) / 255, low = Math.min(...values) / 255;
  return high === low ? 0 : (high - low) / (1 - Math.abs(high + low - 1));
};
describe("zone light and ERA identity", () => {
  it("dims unreached colour by 35% saturation while retaining lightness", () => {
    const source = "rgba(40,120,240,0.5)", dim = desaturateColor(source);
    expect(saturation(rgb(dim))).toBeCloseTo(saturation(rgb(source)) * 0.65, 3);
    expect(Math.max(...rgb(dim)) + Math.min(...rgb(dim))).toBe(280);
    expect(dim).toMatch(/,0\.500\)$/u);
  });
  it.each([[56, 189, 248], [244, 114, 182]])("makes ERA the most saturated shell with one top-left key light: %j", (r, g, b) => {
    const palette = stagePaletteFromColors([30, 40, 50, 1], [r, g, b, 1], [230, 240, 250, 1], [130, 140, 150, 1], [40, 50, 60, 1], [10, 20, 30, 1], [251, 191, 36, 1]);
    const shell = eraShell(palette), tones = [shell.top, shell.left, shell.right];
    for (const tone of tones) expect(saturation(rgb(tone))).toBeCloseTo(1, 3);
    for (const material of Object.values(palette.zones)) expect(saturation(rgb(shell.top))).toBeGreaterThanOrEqual(saturation(rgb(material.top)));
    const light = tones.map(value => rgb(value).reduce((a, channel) => a + channel, 0));
    expect(light[0]).toBeGreaterThan(light[1]);
    expect(light[1]).toBeGreaterThan(light[2]);
  });
  it("pulses only the light strength at 0.5 Hz, with a static reduced pose", () => {
    const samples = [0, 0.5, 1, 1.5, 2].map(value => padPoolAlpha(value));
    [0.65, 0.8, 0.65, 0.5, 0.65].forEach((value, index) => expect(samples[index]).toBeCloseTo(value, 8));
    for (const time of [0, 0.2, 1.5, 50]) expect(padPoolAlpha(time, true)).toBe(0.65);
  });
});

function facts(): BoardFacts {
  const snapshot = sceneAt(buildTimeline(boardRun()), epoch + 1000);
  return { snapshot, state: "live", zones: zoneEvidence(snapshot).zones };
}
describe("new art facts invalidate the state cache", () => {
  it("notices an actual handover ID without manufacturing one from the phase", () => {
    const value = facts(), before = boardFactKey(value);
    value.snapshot.run.handover = handover();
    expect(boardFactKey(value)).not.toBe(before);
  });
  it("notices recorded check starts/exits but leaves output streaming outside state redraws", () => {
    const value = facts(), before = boardFactKey(value);
    value.snapshot.run.checks = [{ name: "test", started_at: new Date(epoch).toISOString(), exit: null, error: null, stdout: "", stderr: "" }];
    const started = boardFactKey(value);
    expect(started).not.toBe(before);
    value.snapshot.run.checks[0].stdout = "Recorded output";
    expect(boardFactKey(value)).toBe(started);
    value.snapshot.run.checks[0].exit = 0;
    expect(boardFactKey(value)).not.toBe(started);
  });
});

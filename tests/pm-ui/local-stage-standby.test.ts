import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FoundryStandby,
  standbyPhase,
} from "../../scripts/pm/app/stage/FoundryStandby";

describe("Foundry loading boot", () => {
  it("sequences empty architecture and the Gate arrival over2.5seconds", () => {
    expect(standbyPhase(0)).toEqual({
      circuits: 0,
      machines: [0, 0, 0, 0],
      era: 0,
      settled: false,
    });
    const first = standbyPhase(1000);
    expect(first.circuits).toBe(1);
    expect(first.machines[0]).toBeGreaterThan(first.machines[1]);
    expect(first.machines[1]).toBeGreaterThan(first.machines[2]);
    expect(first.era).toBe(0);
    expect(standbyPhase(2500)).toEqual({
      circuits: 1,
      machines: [1, 1, 1, 1],
      era: 1,
      settled: true,
    });
    expect(standbyPhase(9000)).toEqual(standbyPhase(2500));
  });
  it("composes the final empty bay immediately under reduced motion", () => {
    expect(standbyPhase(0, true)).toEqual(standbyPhase(2500));
    expect(standbyPhase(-100)).toEqual(standbyPhase(0));
  });
  it("shows Loading without a fabricated run, progress bar or recorded count", () => {
    const html = renderToStaticMarkup(createElement(FoundryStandby));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status">Loading</span>');
    expect(html).toContain('class="foundry-standby-canvas" aria-hidden="true"');
    expect(html).toContain('href="#/delivery"');
    expect(html).toContain('role="switch" aria-label="Game layer"');
    expect(html).not.toMatch(
      /data-(?:plates|seals|combo|progress|run-id|fact)=|progressbar|href="[^"\s]*\/delivery\/run\//u,
    );
    const text = html.replace(/<[^>]*>/gu, " ");
    expect(text).not.toMatch(/\b(?:Files|Checks|local-[\w-]+|HUB-\d+|R122)\b|\d+\s*%/u);
  });
});

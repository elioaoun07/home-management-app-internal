import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Telemetry } from "../../scripts/pm/app/stage/hud/Telemetry";
import { LocalRunTools } from "../../scripts/pm/app/LocalRunTools";
import { LocalRunConsole } from "../../scripts/pm/app/LocalRunConsole";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { boardRun, epoch, row } from "./local-board-fixtures";

describe("R126 mission dock", () => {
  it("shows recorded reads separately from paths only observed through edits", () => {
    const run = boardRun({ activity: [
      row(0, "status", "Native session started"),
      row(1, "command", "cat src/read.ts"),
      row(2, "edit", "src/one.ts"),
      row(3, "edit", "src/two.ts"),
      row(4, "edit", "src/three.ts"),
    ] });
    const counts = sceneAt(buildTimeline(run), epoch + 4000).counts;
    expect(counts).toMatchObject({ files: 4, reads: 1, edits: 3 });
    const html = renderToStaticMarkup(createElement(Telemetry, {
      counts, combo: 0, charge: 0, at: epoch + 4000,
      signalTimes: [], phase: run.phase, partial: true,
    }));
    expect(html).toContain("<b>1+</b> read");
    expect(html).toContain("<b>3</b> edits");
    expect(html).not.toContain("<b>4+</b> read");
  });

  it("shares one six-tab list with the drawer panel's stable accessibility IDs", () => {
    const run = boardRun(), timeline = buildTimeline(run);
    const html = renderToStaticMarkup(createElement("div", null,
      createElement(LocalRunTools, { id: "mission", tool: "brief", onSelect: () => {},
        passed: 0, files: 0, open: true }),
      createElement(LocalRunConsole, {
        id: "mission", showTools: false, run, timeline, snapshot: sceneAt(timeline, epoch),
        replay: false, patch: null, tool: "brief", setTool: () => {},
        panel: { current: null }, busy: false, act: () => {}, fileFilter: null,
        setFileFilter: () => {},
      }),
    ));
    expect(html.match(/role="tablist"/gu)).toHaveLength(1);
    expect(html.match(/role="tab"/gu)).toHaveLength(6);
    expect(html).toContain('id="mission-panel" role="tabpanel" aria-labelledby="mission-brief"');
    expect(html).toContain('id="mission-brief" aria-controls="mission-panel" aria-selected="true" aria-expanded="true"');
  });
});

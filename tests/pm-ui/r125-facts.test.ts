import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { displayTitle } from "../../scripts/pm/app/localRunModel";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { FoundryHud } from "../../scripts/pm/app/stage/hud/FoundryHud";
import { Telemetry } from "../../scripts/pm/app/stage/hud/Telemetry";
import { presenceTitle } from "../../scripts/pm/app/tabPresence";
import { boardRun, epoch, row } from "./local-board-fixtures";

describe("R125 recorded titles and telemetry", () => {
  it.each([
    ["HUB-118 Require host sign-in — criteria", "Require host sign-in"],
    ["HUB-118 HUB-118 Require host sign-in — criteria", "Require host sign-in"],
    ["Require host sign-in", "Require host sign-in"],
    ["HUB-1180 Separate item", "HUB-1180 Separate item"],
  ])("cleans stored heading %s", (title, expected) => {
    expect(displayTitle({ work: { id: "HUB-118", title } })).toBe(expected);
  });

  it("uses the same display title in the Game heading", () => {
    const run = boardRun({
      work: {
        id: "HUB-118",
        title: "HUB-118 HUB-118 Require host sign-in — criteria",
      },
    });
    const timeline = buildTimeline(run);
    const html = renderToStaticMarkup(
      createElement(FoundryHud, {
        snapshot: sceneAt(timeline, epoch),
        timeline,
      }),
    );
    expect(html).toContain(">Require host sign-in</h1>");
    expect(html).not.toContain("— criteria");
    expect(html.match(/HUB-118/gu)).toHaveLength(1);
    expect(presenceTitle(run.work.id, "failed", 1, displayTitle(run))).toBe(
      "◆ 1 · HUB-118 · Require host sign-in",
    );
  });

  const telemetry = (phase: string) => {
    const run = boardRun({
      phase,
      activity: [
        row(0, "status", "Native session started"),
        row(1, "command", "Get-Content -LiteralPath src/recorded.ts"),
      ],
    });
    const snapshot = sceneAt(buildTimeline(run), epoch + 10_000);
    return renderToStaticMarkup(
      createElement(Telemetry, {
        phase,
        combo: 0,
        charge: 0,
        counts: snapshot.counts,
        at: epoch + 10_000,
        signalTimes: [epoch + 1000],
      }),
    );
  };

  it.each(["failed", "cancelled", "shipped", "reverted"])(
    "shows no signal clock after %s",
    (phase) => {
      expect(telemetry(phase)).not.toContain("<time>");
    },
  );

  it("retains the signal clock while building and calls file observations read", () => {
    const html = telemetry("building");
    expect(html).toContain("<time>0:09</time>");
    expect(html).toContain("<b>1</b> read");
    expect(html).not.toContain(" files");
  });
});

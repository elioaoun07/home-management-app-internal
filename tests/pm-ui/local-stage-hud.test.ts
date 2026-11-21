import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { localRunAttention } from "../../scripts/pm/app/localRunAttention";
import {
  FoundryHud,
  ZoneChip,
} from "../../scripts/pm/app/stage/hud/FoundryHud";
import { Debrief } from "../../scripts/pm/app/Debrief";
import { AttentionCard } from "../../scripts/pm/app/stage/hud/AttentionCard";

const epoch = Date.parse("2026-11-15T10:00:00Z");
const row = (seconds: number, kind: string, summary: string) => ({
  at: new Date(epoch + seconds * 1000).toISOString(),
  kind,
  summary,
  seq: seconds,
  job_id: "native",
});
function run(changes: Partial<LocalRunView> = {}): LocalRunView {
  return {
    run_id: "local-hud-fixture",
    phase: "building",
    workspace: "C:/fixture",
    branch: "delivery/R123",
    head: null,
    current_head: null,
    canShip: false,
    canUndo: false,
    interrupted: false,
    work: {
      id: "R123",
      title: "HUD fixture",
      brief: "Recorded owner objective",
    },
    activity: [row(0, "status", "Native session started")],
    checks: [],
    usage: null,
    handover: null,
    ...changes,
  };
}
function markup(
  value: LocalRunView,
  time?: number,
  staged = false,
  failure?: string,
) {
  const timeline = buildTimeline(value),
    at = time ?? timeline.end ?? epoch;
  const snapshot = sceneAt(timeline, at);
  return renderToStaticMarkup(
    createElement(FoundryHud, {
      snapshot,
      timeline,
      attention: localRunAttention(value, new Set(), at),
      stagedMessage: staged
        ? snapshot.events.findLast((event) => event.kind === "message")
        : null,
      failure: failure
        ? createElement("div", { className: "stage-black-box" }, failure)
        : undefined,
      actions: createElement("button", null, "Cancel"),
    }),
  );
}

describe("R123 board HUD", () => {
  it("disables a blocked primary action while retaining local SQL acknowledgement", () => {
    const item = {
      id: "sql",
      kind: "sql",
      level: "act",
      zone: "test",
      title: "Run SQL",
      state: "open",
      since: null,
      action: { label: "Copy path", run: "copy-path" },
    } as const;
    const html = renderToStaticMarkup(
      createElement(AttentionCard, { item, canAct: () => false }),
    );
    expect(html).toContain('class="primary" disabled=""');
    expect(html).toContain('class="secondary" aria-pressed="false"');
  });
  it("keeps the eleven-zone track and the one title above separate board and rail regions", () => {
    const html = markup(run());
    expect(html.match(/aria-label="Delivery stages"/gu)).toHaveLength(1);
    expect(html.match(/<i data-zone=/gu)).toHaveLength(11);
    expect(html.match(/<h1 /gu)).toHaveLength(1);
    expect(html).toContain(">HUD fixture</h1>");
    for (const label of ["SETUP", "BUILD", "VERIFY", "TEST", "SHIP"])
      expect(html).toContain(`>${label}</b>`);
    expect(html).toContain("LINE 2/11");
    expect(html).toContain('class="board-hud"');
    expect(html).toContain('class="board-rail"');
    expect(html).not.toContain('class="foundry-mission"');
    expect(html).not.toContain('class="foundry-terminal"');
  });
  it("keeps actions in the attention rail and settings behind its trigger", () => {
    const html = markup(run());
    expect(html).toContain('aria-label="Settings" aria-haspopup="dialog"');
    expect(html).toContain("NEEDS YOU");
    expect(html).toContain(">Brief</h3>");
    expect(html).toContain(">Open</button>");
    expect(html).toMatch(
      /<footer class="run-game-commandbar"[^>]*><button>Cancel<\/button><\/footer>/u,
    );
    expect(html).not.toContain("Recorded owner objective");
  });
  it("keeps telemetry factual without printing a terminal or old narration on mount", () => {
    const activity = [
      row(0, "status", "Native session started"),
      row(1, "command", "pnpm recorded"),
      row(2, "message", "Recorded narration"),
    ];
    const html = markup(run({ activity }));
    expect(html).toContain("<b>1</b> commands");
    expect(html).not.toContain("pnpm recorded");
    expect(html).not.toContain('data-text="Recorded narration"');
    expect(html).not.toContain("Thinking about");
  });
  it("shows only a staged recorded message and cannot leak narration beyond the historical cursor", () => {
    const value = run({
      activity: [
        row(0, "status", "Native session started"),
        row(1, "message", "Earlier narration"),
        row(10, "command", "pnpm future"),
        row(11, "message", "Future narration"),
      ],
    });
    const html = markup(value, epoch + 1000, true);
    expect(html).toContain('data-text="Earlier narration"');
    expect(html).not.toContain("Future narration");
    expect(html).not.toContain("pnpm future");
  });
  it("renders the supplied failure once inside the rail, without a rank or floating result panel", () => {
    const html = markup(
      run({
        phase: "failed",
        error: "git commit: hook failed",
        activity: [
          row(0, "status", "Native session started"),
          row(1, "edit", "src/a.ts"),
          row(2, "status", "git commit: hook failed"),
        ],
      }),
      undefined,
      false,
      "Commit hook failed",
    );
    expect(html.match(/Commit hook failed/gu)).toHaveLength(1);
    expect(html).toContain('class="board-failure-card"');
    expect(html).not.toContain('class="board-rank');
    expect(html).not.toContain('class="board-results');
  });
  it("keeps end-of-run token normalization consistent with the retained debrief", () => {
    const value = run({
      phase: "shipped",
      usage: { input: 120, output: 30, cachedInput: 80, reasoningOutput: 10 },
      activity: [
        row(0, "status", "Native session started"),
        row(2, "status", "Owner shipped merge"),
      ],
    });
    expect(markup(value)).toContain("<dt>Tokens</dt><dd>150</dd>");
    expect(
      renderToStaticMarkup(createElement(Debrief, { run: value })),
    ).toContain("<dt>Tokens</dt><dd>150</dd>");
    expect(
      markup({ ...value, usage: { input: 120, output: null } }),
    ).not.toContain("<dt>Tokens</dt>");
  });
  it("marks retained peak flow as a lower bound when the start of history is unavailable", () => {
    const activity = [
      row(0, "status", "Native session started"),
      ...Array.from({ length: 199 }, (_, index) =>
        row(index + 1, "edit", "src/a.ts"),
      ),
    ];
    expect(markup(run({ phase: "shipped", activity }))).toContain(
      "<dt>Peak flow</dt><dd>200+</dd>",
    );
  });
  it("uses one truthful zone chip and no placeholder command", () => {
    expect(
      renderToStaticMarkup(
        createElement(ZoneChip, { zone: "build", label: "src/a.ts" }),
      ),
    ).toContain('data-zone="build"');
    expect(
      renderToStaticMarkup(createElement(ZoneChip, { zone: null, label: "" })),
    ).toContain("hidden");
  });
});

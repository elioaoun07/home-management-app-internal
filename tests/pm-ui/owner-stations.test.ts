import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OwnerStationDetail } from "../../scripts/pm/app/OwnerStationDetail";
import { OwnerRoom } from "../../scripts/pm/app/OwnerRoom";
import { OWNER_STATIONS, activeOwnerStation, currentOwnerStation, ownerStationState } from "../../scripts/pm/app/ownerStations";
import { boardRun, handover } from "./local-board-fixtures";

describe("Owner workstations", () => {
  it("marks the workflow step while another station is being inspected", () => {
    const run = boardRun({ phase: "uat-ready", head: "candidate", risk: { required: true, flagged: [] }, handover: handover(true) });
    const html = renderToStaticMarkup(createElement(OwnerRoom, {
      run, current: activeOwnerStation(run), selected: "merge", onSelect: vi.fn(),
    }));
    const buttons = html.match(/<button\b[^>]*>/gu) ?? [];
    const current = buttons.filter(button => button.includes('aria-current="step"'));
    expect(current).toHaveLength(1);
    expect(current[0]).toContain('data-station="review"');
    expect(buttons.find(button => button.includes('aria-pressed="true"'))).toContain('data-station="merge"');
  });

  it("leaves the board unmarked before handover and after the owner finishes", () => {
    expect(activeOwnerStation(boardRun())).toBeNull();
    expect(activeOwnerStation(boardRun({ phase: "cleaned", cleaned_at: "now" }))).toBeNull();
    expect(activeOwnerStation(boardRun({ phase: "discarded" }))).toBeNull();
    expect(activeOwnerStation(boardRun({ phase: "refresh-conflict" }))).toBe("merge");
    expect(activeOwnerStation(boardRun({ phase: "acceptance-paused" }))).toBe("test");
  });

  it("keeps a legacy merge inspectable without inventing a commit or push", () => {
    const run = boardRun({ phase: "merged", applied: { at: "now", files: ["example.ts"], main_head: "base", pm_error: null },
      publication: { action: "commit", token: null, reason: "No verified file list", files: [], commands: [] } });
    expect(currentOwnerStation(run)).toBe("commit");
    expect(ownerStationState(run, "merge")).toBe("done");
    expect(ownerStationState(run, "commit")).toBe("stopped");
    expect(ownerStationState(run, "push")).toBe("pending");
    const act = vi.fn();
    for (const { id } of OWNER_STATIONS) {
      const html = renderToStaticMarkup(createElement(OwnerStationDetail, { run, station: id, act, busy: false, patch: null }));
      if (id === "commit") {
        expect(html).toContain("No verified file list");
        expect(html).toContain('disabled="">Commit</button>');
      } else expect(html).not.toContain(">Commit</button>");
    }
    expect(act).not.toHaveBeenCalled();
  });

  it("requires an explicit review and excludes live controls and patch bytes from replay", () => {
    const run = boardRun({ phase: "uat-ready", head: "candidate", risk: { required: true, flagged: [] }, handover: handover(true) });
    expect(currentOwnerStation(run)).toBe("review");
    const props = { run, station: "review" as const, act: vi.fn(), busy: false, patch: "@@ -5 +7 @@\n-old value\n+new value" };
    const live = renderToStaticMarkup(createElement(OwnerStationDetail, props));
    expect(live).toContain('data-kind="added"');
    expect(live).toContain('aria-label="Wrap lines"');
    expect(live).toContain('data-wrap="true"');
    expect(live).toContain("new value");
    expect(live).toContain(">Mark reviewed</button>");
    const replay = renderToStaticMarkup(createElement(OwnerStationDetail, { ...props, readOnly: true }));
    expect(replay).not.toContain("new value");
    expect(replay).not.toContain("Mark reviewed");
    expect(props.act).not.toHaveBeenCalled();
  });

  it("offers the read-only review station when an older file-copy merge needs a manual commit", () => {
    const run = boardRun({ phase: "merged", applied: { at: "now", files: ["source.ts"], main_head: "base", pm_error: null },
      publication: { action: "commit", token: null, reason: "This older merge has no verified file list. Review and commit it manually.", files: [], commands: [] } });
    const html = renderToStaticMarkup(createElement(OwnerStationDetail, { run, station: "commit", busy: false,
      patch: null, act: vi.fn(), onSelectStation: vi.fn() }));
    expect(html).toContain(">Manual</span>");
    expect(html).toContain(">Review changes</button>");
    expect(html).not.toContain(">Commit</button>");
  });
});

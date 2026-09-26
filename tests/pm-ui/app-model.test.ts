import { describe, expect, it } from "vitest";
import {
  buildWorld,
  bucketOf,
  discover,
  historyDays,
  pastOutcomeV1,
  pastOutcomeV2,
  runFor,
  backPath,
  workPath,
} from "../../scripts/pm/app/model";
import type { Snapshot } from "../../scripts/pm/app/types";
const source: Snapshot = {
  generatedAt: "2026-09-10T12:00:00Z",
  files: [
    {
      relPath: "Hub & ERA/4 - Checklist.md",
      raw: "## Now\r\n- [ ] **HUB-39** Proactive household briefing _(friction - M)_\r\n- [ ] **HUB-42** Retry cached changes _(friction - M)_\r\n## Next\r\n- [ ] **HUB-5** Typography _(annoyance - S)_\r\n",
    },
    {
      relPath: "Hub & ERA/Hub & ERA — Master Book.md",
      raw: "## Purpose & ownership\nA household assistant.\n## Acceptance Criteria Index\n### HUB-39\n**Outcome:** Proactive briefing.\n- **Depends on:** HUB-42.\n### HUB-42\n**Outcome:** Preserve offline edits.\n### HUB-5\n**Outcome:** Readable labels.\n- **Gate:** Verify AI, mobile and household.\n**Provenance:** AI study.\n## Shipped Log\n- ✅ 2026-09-09 — **HUB-1** Shipped briefing.\n",
    },
    {
      relPath: "Research/Options.md",
      raw: "## Now\n- [ ] **HUB-999** Not executable _(friction - M)_\n",
    },
    {
      relPath: "_Archive/Old/4 - Checklist.md",
      raw: "## Now\n- [ ] **HUB-998** Archived _(friction - M)_\n",
    },
  ],
  cancelledLog: "## Hub & ERA\n- ❌ 2026-09-09 — **HUB-2** Removed.\n",
};
describe("React PM application model", () => {
  it("keeps canonical identity and CRLF source witnesses through focused navigation", () => {
    const world = buildWorld(source);
    expect(world.work.map((work) => work.id)).toEqual([
      "HUB-39",
      "HUB-42",
      "HUB-5",
    ]);
    expect(world.work[0].rawLine).toBe(
      "- [ ] **HUB-39** Proactive household briefing _(friction - M)_\r",
    );
    const href = workPath(world.work[0], "/explore?q=AI&lane=waiting");
    expect(decodeURIComponent(href.split("from=")[1])).toBe(
      "/explore?q=AI&lane=waiting",
    );
    expect(backPath("//example.com")).toBe("/");
  });
  it("partitions waiting work without losing its canonical priority", () => {
    const world = buildWorld(source);
    expect(world.work[0].section).toBe("Now");
    expect(world.work.map(bucketOf)).toEqual(["waiting", "now", "next"]);
  });
  it("discovers related outcomes without verification and provenance false positives", () => {
    const work = buildWorld(source).work;
    expect(discover(work, "AI").map((item) => item.id)).toEqual(["HUB-39"]);
    expect(discover(work, "Offline").map((item) => item.id)).toEqual([
      "HUB-42",
    ]);
    expect(discover(work, "Typography").map((item) => item.id)).toEqual([
      "HUB-5",
    ]);
    expect(discover(work, "HUB-39 household")).toHaveLength(1);
  });
  it("counts dated shipments separately from cancelled history", () => {
    const world = buildWorld(source);
    const days = historyDays(world.history, new Date("2026-09-10T22:00:00Z"));
    expect(days).toHaveLength(14);
    expect(days.find((day) => day.date === "2026-09-09")?.count).toBe(1);
    expect(world.history).toHaveLength(2);
  });
  it("ties active Delivery to campaign and stable ID rather than shifted ordinals", () => {
    const work = buildWorld(source).work[0];
    const run = {
      sessionId: "s",
      state: "BUILDING",
      item: { id: work.id, campaign: work.module, cbidx: 999 },
      agent: "claude",
    };
    expect(runFor(work, [run])?.sessionId).toBe("s");
    expect(
      runFor(work, [{ ...run, item: { ...run.item, campaign: "Kitchen" } }]),
    ).toBeUndefined();
    expect(runFor(work, [{ ...run, state: "SHIPPED" }])).toBeUndefined();
  });
  it("sorts finished deliveries into apply / applied / cancelled / other", () => {
    expect(pastOutcomeV1({ state: "SHIPPED" })).toBe("applied");
    expect(pastOutcomeV1({ state: "CANCELLED" })).toBe("cancelled");
    expect(pastOutcomeV1({ state: "FAILED" })).toBe("other");
    const v2 = (closed_outcome: string | null, state?: string) =>
      pastOutcomeV2({ closed_outcome, application: state ? { application_id: "a", state } : null });
    expect(v2("verified_candidate")).toBe("apply");
    expect(v2("verified_candidate", "conflict")).toBe("apply");
    expect(v2("verified_candidate", "applied")).toBe("applied");
    expect(v2("cancelled")).toBe("cancelled");
    expect(v2("useful_partial")).toBe("other");
    expect(v2("failed")).toBe("other");
  });
});

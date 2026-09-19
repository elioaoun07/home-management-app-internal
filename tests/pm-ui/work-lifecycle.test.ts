import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  buildWorld,
  canDeliver,
  doneReceipts,
} from "../../scripts/pm/app/model";
import { deliveryBlockReason } from "../../scripts/pm/shared/work-lifecycle.mjs";
import type { Snapshot } from "../../scripts/pm/app/types";
import { WorkView, selectionFromRoute } from "../../scripts/pm/app/Work";
import { OutcomeButton } from "../../scripts/pm/app/components";

const snapshot: Snapshot = {
  generatedAt: "2026-09-15T12:00:00Z",
  files: [
    {
      relPath: "Delivery/4 - Checklist.md",
      raw: "## Now\n- [ ] **DLV-90** Reject zero tests _(friction - S)_\n- [ ] **DLV-98** Record native trial _(friction - M)_\n- [x] **DLV-115** Confirm rollback _(friction - M)_\n",
    },
    {
      relPath: "Delivery/Delivery — Master Book.md",
      raw: "## Acceptance Criteria Index\n### DLV-90\n**Outcome:** Reject zero tests.\n**Kind:** verification\n### DLV-98\n**Execution:** owner\n**UAT:** pending\n### DLV-115\n**Outcome:** Confirm rollback.\n### DLV-116\n**Outcome:** Read plans and diffs.\n**Implementation:** done\n**UAT:** pending\n## Shipped Log\n- ✅ 2026-09-15 — **DLV-116** Plan reader implemented; owner UAT pending.\n- ✅ 2026-09-14 — **DLV-116** Earlier implementation evidence.\n- ✅ 2026-09-13 — **DLV-90** Earlier fix, subsequently reopened.\n",
    },
    {
      relPath: "Plans/Owner UAT.md",
      raw: "## Now\n- [ ] **DLV-200** Tap the phone _(friction - S)_\n",
    },
  ],
};
vi.mock("../../scripts/pm/app/state", async (original) => ({
  ...(await original<typeof import("../../scripts/pm/app/state")>()),
  useWorld: () => ({ world: buildWorld(snapshot), runs: [], connected: true }),
  useRoute: () => ({
    full: "/work/Delivery/DLV-116",
    query: new URLSearchParams(),
  }),
  useCommand: () => ({ isPending: false }),
}));
vi.mock("../../scripts/pm/app/DeliveryV2", () => ({
  useV2Runs: () => ({ data: { runs: [] } }),
  V2RunLink: () => null,
}));

describe("actionable work and completed implementation", () => {
  it("keeps manual owner checks out of Work and route selection, while automated verification stays deliverable", () => {
    const world = buildWorld(snapshot);
    expect(world.work.map((work) => work.id)).toEqual(["DLV-90", "DLV-115"]);
    expect(canDeliver(world.work[0])).toBe(true);
    expect(
      selectionFromRoute(
        world,
        ["deliver", "Delivery", "DLV-98"],
        new URLSearchParams(),
      ),
    ).toBeUndefined();
  });
  it("deduplicates done receipts, retains owner-pending status, and excludes reopened work", () => {
    const world = buildWorld(snapshot);
    expect(doneReceipts(world).map((entry) => entry.workId)).toEqual([
      "DLV-116",
    ]);
    expect(doneReceipts(world)[0].raw).toContain("owner UAT pending");
    expect(world.history).toHaveLength(3);
  });
  it("keeps a pending owner gate blocking its dependent without turning the gate into deliverable work", () => {
    const gated = structuredClone(snapshot);
    gated.files[1].raw = gated.files[1].raw.replace(
      "**Kind:** verification",
      "**Kind:** verification\n**Depends on:** DLV-98",
    );
    const world = buildWorld(gated);
    expect(world.work[0].dependencies[0].status).toBe("Owner UAT");
    expect(canDeliver(world.work[0])).toBe(false);
  });
  it("renders completed scope and evidence without a Deliver or CLI implementation action", () => {
    const html = renderToStaticMarkup(
      createElement(WorkView, { campaign: "Delivery", id: "DLV-116" }),
    );
    expect(html).toContain("Read plans and diffs.");
    expect(html).toContain(">Done<");
    expect(html).toContain("owner UAT pending");
    expect(html).not.toContain("deliver-button");
    expect(html).not.toContain("Open in CLI");
  });
  it("shows no Deliver button for checked work before its completion sweep", () => {
    const work = buildWorld(snapshot).work[1];
    expect(
      renderToStaticMarkup(
        createElement(OutcomeButton, { work, from: "/explore" }),
      ),
    ).toBe("");
  });
  it.each([
    ["Delivery/4 - Checklist.md", "done", "", "work-completed"],
    [
      "Delivery/4 - Checklist.md",
      "open",
      "**Implementation:** done",
      "work-completed",
    ],
    [
      "Delivery/4 - Checklist.md",
      "open",
      "**Execution:** owner",
      "owner-check",
    ],
    [
      "Delivery/4 - Checklist.md",
      "open",
      "**Execution:** typo",
      "invalid-execution-kind",
    ],
    ["Plans/UAT.md", "open", "", "not-actionable-source"],
    ["_Archive/Delivery/4 - Checklist.md", "open", "", "not-actionable-source"],
  ])("refuses %s / %s / %s", (file, state, contract, reason) => {
    expect(deliveryBlockReason({ file, state, contract })).toBe(reason);
  });
});

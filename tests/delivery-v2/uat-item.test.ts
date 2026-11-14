import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authoredItemScenarios,
  itemUatPlan,
  matchingItemHandovers,
} from "../../scripts/delivery-v2/uat-item.mjs";
import { routeUat } from "../../scripts/delivery-v2/uat-routes.mjs";
import { activeItemHandovers } from "../../scripts/delivery-v2/uat-item-selection.mjs";
import {
  freezeHandover,
  listUat,
  readUat,
} from "../../scripts/delivery-v2/uat.mjs";

let root: string;
const bookPath =
  "ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md";
const instructions = [
  "# Tests",
  "## R51 — Retained item",
  "**Acceptance:** R51/R65",
  "**Setup:** Open the copied fixture.",
  "1. Open Sessions. Expect a status board.",
  "2. Open the item. Expect its test steps.",
  "## R65 — Another item",
  "1. Open a different item. Expect different instructions.",
].join("\n");
const book = [
  "# PM",
  "### R51",
  "**Outcome:** Retained item.",
  "**Implementation:** done",
  "**UAT:** pending",
  "**UAT instructions:** [Test steps](<../../../docs/uat.md#r51--retained-item>)",
  "### R65",
  "**Outcome:** Another item.",
].join("\n");
const now = "2026-11-14T14:00:00.000Z";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "era-uat-item-"));
  mkdirSync(join(root, "ERA Notes/10 - Project Management/PM Tooling"), {
    recursive: true,
  });
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, bookPath), book);
  writeFileSync(join(root, "docs/uat.md"), instructions);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const planFor = (id = "R51") => {
  const plan = itemUatPlan({ root, campaign: "PM Tooling", id });
  if (!plan.ok || !plan.content) throw new Error("Expected a known item");
  return { ...plan, content: plan.content };
};

describe("per-item authored tests", () => {
  it("previews only the exact linked scenario without writing a handover", () => {
    const plan = planFor("r51");
    expect(plan).toMatchObject({
      ok: true,
      available: true,
      id: "R51",
      title: "Retained item.",
    });
    expect(plan.content.scenarios).toHaveLength(1);
    expect(plan.content.scenarios[0].steps).toEqual([
      { action: "Open Sessions.", expected: "A status board." },
      { action: "Open the item.", expected: "Its test steps." },
    ]);
    expect(readUat({ root }).handovers).toHaveLength(0);
  });
  it("selects a child heading and standard duplicate anchor, never the whole document", () => {
    const doc =
      "## Group\n### Phone\n1. Open mobile. Expect a page.\n### Phone\n1. Open desktop. Expect another page.\n## Other\n1. Ignore me. Expect irrelevant content.";
    const chosen = authoredItemScenarios(doc, "docs/uat.md", "phone-1");
    if (!chosen) throw new Error("Expected the child scenario");
    expect(chosen.content.scenarios).toHaveLength(1);
    expect(chosen.content.scenarios[0].steps[0].action).toBe("Open desktop.");
    expect(authoredItemScenarios(doc, "docs/uat.md", "missing")).toBeNull();
    expect(authoredItemScenarios(doc, "docs/uat.md", null)).toBeNull();
  });
  it("keeps missing expectations incomplete and does not manufacture tests from acceptance", () => {
    writeFileSync(
      join(root, "docs/uat.md"),
      instructions.replace(" Expect a status board.", ""),
    );
    const incomplete = planFor();
    expect(incomplete.available).toBe(false);
    expect(incomplete.content.scenarios[0].steps[0].expected).toBe("");
    writeFileSync(
      join(root, bookPath),
      "### R51\n**Acceptance:** The UI is readable.\n**UAT:** pending",
    );
    const absent = planFor();
    expect(absent.available).toBe(false);
    expect(absent.content.scenarios).toEqual([]);
    expect(itemUatPlan({ root, campaign: "../docs", id: "R51" })).toEqual({
      ok: false,
      code: "unknown-item",
    });
  });
  it("retains every explicitly linked scenario and recognizes shared criteria exactly", () => {
    writeFileSync(
      join(root, bookPath),
      book.replace(
        "#r51--retained-item>)",
        "#r51--retained-item>) · [Second](<../../../docs/uat.md#r65--another-item>)",
      ),
    );
    const plan = planFor();
    expect(plan.content.scenarios).toHaveLength(2);
    expect(
      plan.content.scenarios.every((scenario: { criteria: string[] }) =>
        scenario.criteria.includes("R51"),
      ),
    ).toBe(true);
    const shared = {
      subject: { campaign: "PM Tooling", work_id: "R65" },
      scenarios: [{ criteria: ["R51", "R65"] }],
      stale: false,
      created_at: now,
    };
    expect(matchingItemHandovers([shared], "PM Tooling", "R51")).toEqual([
      shared,
    ]);
    expect(matchingItemHandovers([shared], "PM Tooling", "R5")).toEqual([]);
  });
});

describe("owner Start test", () => {
  const auth = { kind: "browser", actor: "owner" };
  let clock = now;
  beforeEach(() => {
    clock = now;
  });
  const ctx = () => ({
    root,
    now: () => clock,
    sourceIdentity: () => ({
      source_revision: "abcdef1234567",
      files_digest: null,
    }),
  });
  const post = (body: object, actor = auth) => {
    const result = routeUat(
      {
        method: "POST",
        path: "/api/delivery/v2/uat",
        body,
        query: new URLSearchParams(),
      },
      actor,
      ctx(),
    );
    if (!result) throw new Error("Expected a UAT response");
    return result;
  };
  it("binds authored steps but leaves results and availability pending; retry keeps the same revision", () => {
    const plan = planFor();
    const body = {
      action: "start-item",
      campaign: "PM Tooling",
      work_id: "R51",
      revision: plan.revision,
      command_id: "same-click",
    };
    const first = post(body);
    expect(first.status).toBe(200);
    expect(first.json.handover).toMatchObject({
      status: "ready",
      counts: { pending: 1, pass: 0 },
      availability: { state: "unknown" },
      signoff: null,
      binding: { source_revision: "abcdef1234567" },
    });
    // A lost response retries the original request without a second write.
    expect(post(body).json).toMatchObject({
      ok: true,
      repeated: true,
      handover: { revision: 1 },
    });
    expect(readUat({ root }).handovers).toHaveLength(1);
    expect(readUat({ root }).receipts).toHaveLength(0);
  });
  it.each(["draft", "incomplete"])(
    "does not reopen the retired ready attempt behind a newer %s",
    (status) => {
      const plan = planFor();
      const body = {
        action: "start-item",
        campaign: "PM Tooling",
        work_id: "R51",
        revision: plan.revision,
        command_id: "first-attempt",
      };
      const first = post(body).json.handover;
      clock = "2026-11-14T14:01:00.000Z";
      const newer = freezeHandover({
        root,
        subject: { ...plan.subject, delivery_ref: `new-${status}` },
        content:
          status === "draft"
            ? plan.content
            : { ...plan.content, scenarios: [] },
        criteria: ["R51"],
        now: clock,
      });
      expect(newer.ok).toBe(true);
      const projected = listUat({ root, now: clock }).handovers;
      const retired = projected.find(
        (row) => row.handover_id === first.handover_id,
      );
      expect(retired).toMatchObject({
        stale: false,
        acceptance: { state: "superseded" },
      });
      expect(
        activeItemHandovers(projected, plan.revision).map((row) => row.status),
      ).toEqual([status]);
      expect(post(body)).toMatchObject({
        status: 409,
        json: { error: "handover-retired" },
      });
      expect(readUat({ root }).handovers).toHaveLength(2);
      clock = "2026-11-14T14:02:00.000Z";
      const restarted = post({ ...body, command_id: "new-owner-start" });
      expect(restarted.status).toBe(200);
      expect(restarted.json.handover.handover_id).not.toBe(first.handover_id);
      expect(restarted.json.handover).toMatchObject({
        status: "ready",
        counts: { pending: 1, pass: 0 },
        supersededBy: null,
      });
    },
  );
  it("changed authored instructions cannot reuse a direct binding or revive an old retry", () => {
    const plan = planFor();
    const body = {
      action: "start-item",
      campaign: "PM Tooling",
      work_id: "R51",
      revision: plan.revision,
      command_id: "old-instructions",
    };
    const first = post(body).json.handover;
    writeFileSync(
      join(root, "docs/uat.md"),
      instructions.replace("Open Sessions.", "Open the new Sessions view."),
    );
    const changed = planFor();
    expect(changed.revision).not.toBe(plan.revision);
    expect(first.stale).toBe(false);
    expect(activeItemHandovers([first], changed.revision)).toEqual([]);
    expect(post(body)).toMatchObject({
      status: 409,
      json: { error: "handover-retired" },
    });
    expect(readUat({ root }).handovers).toHaveLength(1);
    clock = "2026-11-14T14:01:00.000Z";
    const next = post({
      ...body,
      revision: changed.revision,
      command_id: "new-instructions",
    });
    expect(next.status).toBe(200);
    expect(next.json.handover.handover_id).not.toBe(first.handover_id);
    expect(next.json.handover.scenarios[0].steps[0].action).toBe(
      "Open the new Sessions view.",
    );
    expect(next.json.handover.counts).toEqual({
      pending: 1,
      pass: 0,
      fail: 0,
      blocked: 0,
    });
  });
  it("excludes source-independent supersession and missing candidates from active selection", () => {
    const entry = {
      status: "ready",
      created_at: now,
      stale: false,
      source: { kind: "import", ref: "authored" },
      acceptance: { state: "accepted" },
      supersededBy: null as string | null,
    };
    expect(activeItemHandovers([entry], "new-revision")).toEqual([entry]);
    expect(
      activeItemHandovers([{ ...entry, supersededBy: "newer" }], undefined),
    ).toEqual([]);
    expect(
      activeItemHandovers(
        [{ ...entry, acceptance: { state: "no-candidate" } }],
        undefined,
      ),
    ).toEqual([]);
    expect(activeItemHandovers([{ ...entry, stale: true }], undefined)).toEqual(
      [],
    );
  });
  it("rejects stale previews, reused command identities and non-owner preparation", () => {
    const plan = planFor();
    const body = {
      action: "start-item",
      campaign: "PM Tooling",
      work_id: "R51",
      revision: plan.revision,
      command_id: "bound-click",
    };
    expect(post({ ...body, revision: "0".repeat(64) }).status).toBe(409);
    expect(post(body, { kind: "steward", actor: "owner" }).status).toBe(403);
    expect(post(body, { kind: "bridge", actor: "owner" }).status).toBe(403);
    expect(post(body).status).toBe(200);
    expect(post({ ...body, work_id: "R65" }).status).toBe(409);
    expect(readFileSync(join(root, bookPath), "utf8")).toBe(book);
  });
});

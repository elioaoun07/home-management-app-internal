import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  checkGroups,
  defaultReviewTab,
  outcomeSummary,
  tokenSplit,
  planMarkdown,
  reviewStatus,
  reviewTabs,
} from "../../scripts/pm/app/deliveryReviewModel";
import {
  ChecksReview,
  PlanReview,
  UsageSummary,
} from "../../scripts/pm/app/DeliveryReview";
import { deliveryReviewFixture } from "./fixtures/delivery-review";
import { normalizePlanBody } from "../../scripts/delivery-v2/interaction.mjs";

describe("Delivery decision workspace", () => {
  it("keeps Changes as the final review step", () => {
    expect(reviewTabs).toEqual(["outcome", "plan", "checks", "activity", "changes"]);
  });
  it("opens the work needing attention and distinguishes rolled-back from verified", () => {
    const d = deliveryReviewFixture();
    // A recorded result opens Outcome; application checks still open Verification.
    expect(defaultReviewTab(d)).toBe("outcome");
    expect(reviewStatus(d)).toBe("Rolled back");
    d.ownerAction = { kind: "application-checks", label: "Checks" };
    expect(defaultReviewTab(d)).toBe("checks");
    d.plans[0].status = "proposed";
    expect(defaultReviewTab(d)).toBe("plan");
  });
  it("summarizes the outcome from recorded facts only", () => {
    const d = deliveryReviewFixture();
    const summary = outcomeSummary(d);
    expect(["verified", "inconclusive", "failed", "closed", "in-progress"]).toContain(summary.verdict);
    expect(summary.good.length + summary.attention.length).toBeGreaterThan(0);
    d.resources = { ...(d.resources as NonNullable<typeof d.resources>), provenance: { ...(d.resources as NonNullable<typeof d.resources>).provenance, measuredTokens: { input: 487742, cachedInput: 425472, output: 5694 } } };
    // Uncached, cached and output kept apart, with reasoning identified as a
    // subset of output. `raw` is null here: this fixture's provenance carries no
    // separate provider counter, so there is nothing to contrast.
    expect(tokenSplit(d.resources)).toEqual({ fresh: 62270, cached: 425472, output: 5694, reasoning: 0, total: 493436, raw: null });
  });
  it("uses the latest criterion revision and observation without dropping history", () => {
    const d = deliveryReviewFixture();
    const groups = checkGroups(d.evidence.slice().reverse());
    expect(groups).toHaveLength(2);
    expect(
      groups.every(
        (g) => g.current.state === "satisfied" && g.previous.length === 1,
      ),
    ).toBe(true);
    const newerRevision = {
      ...d.evidence[0],
      criterion_revision: 2,
      state: "stale",
    };
    expect(checkGroups([...d.evidence, newerRevision])[0].current.state).toBe(
      "stale",
    );
  });
  it("renders readable check names and keeps old inconclusive checks out of the current summary", () => {
    const html = renderToStaticMarkup(
      createElement(ChecksReview, { detail: deliveryReviewFixture() }),
    );
    expect(html).toContain("2 of 2 passed");
    expect(html).toContain("History navigation");
    expect(html.match(/class="review-check"/g)).toHaveLength(2);
    expect(html).toContain("Previous runs");
    expect(html).toContain("No test count");
    expect(html).not.toContain("Receipt");
    expect(html).not.toContain("stdout and stderr");
  });
  it("places approval after all plan content and exposes an actual plan export", () => {
    const d = deliveryReviewFixture();
    const html = renderToStaticMarkup(
      createElement(PlanReview, {
        detail: d,
      }, createElement("button", null, "Approve")),
    );
    expect(html.indexOf("Approve")).toBeGreaterThan(
      html.indexOf("Acceptance checks"),
    );
    expect(html).toContain("Artifacts");
    expect(html).toContain("plan.md");
    const markdown = planMarkdown(d.plans[0]);
    expect(markdown).toContain(d.plans[0].body.steps[3].title);
    expect(markdown).not.toContain(d.plans[0].digest);
    expect(markdown).not.toContain(d.plans[0].plan_id);
    expect(markdown).not.toContain("[object Object]");
  });
  it("shows prepared material before approval and preserves it in the plan export", () => {
    const d = deliveryReviewFixture();
    const plan = d.plans.at(-1)!;
    plan.body.preparation = { kind: "selected-item", provenance: "Owner-reviewed task", acceptance_fingerprint: "binding-v2:fixture" };
    plan.body.acceptance = ["The label opens the selected record"];
    plan.body.invariants = ["Preserve keyboard activation"];
    plan.body.exclusions = ["No other labels"];
    const html = renderToStaticMarkup(createElement(PlanReview, { detail: d }, createElement("button", null, "Approve")));
    expect(html).toContain("From task");
    for (const text of [...plan.body.acceptance, ...plan.body.invariants, ...plan.body.exclusions]) {
      expect(html).toContain(text);
      expect(html.indexOf(text)).toBeLessThan(html.indexOf("Approve"));
      expect(planMarkdown(plan)).toContain(text);
    }
    expect(planMarkdown(plan)).toContain("Source: Owner-reviewed task");
  });
  it("shows one readable token comparison without receipt fields", () => {
    const html = renderToStaticMarkup(
      createElement(UsageSummary, {
        resources: deliveryReviewFixture().resources,
      }),
    );
    expect(html).toContain("Tokens");
    expect(html).toContain("284,243");
    // "threshold" implied a live ceiling. The allowance is checked when a job is
    // admitted and never interrupts one that is running (F10).
    expect(html).toContain("200,000 admission limit");
    expect(html).toContain("+84,243");
    expect(html).not.toContain("Estimated");
    expect(html).not.toContain("Reserved");
    expect(html).not.toContain("Allowance");
  });
  it("preserves long scope and every question in an approvable plan", () => {
    const long = "Detail ".repeat(200);
    const input = {
      outcome: long,
      steps: Array.from({ length: 30 }, (_, i) => `Step ${i} ${long}`),
      questions: Array.from({ length: 25 }, (_, i) => ({
        text: `Question ${i} ${long}`,
        blocking: true,
      })),
    };
    const { body, readable } = normalizePlanBody(input);
    expect(readable).toBe(true);
    expect(body.outcome).toBe(long.trim());
    expect(body.steps).toHaveLength(30);
    expect(body.steps[29].title).toBe(input.steps[29].trim());
    expect(body.questions).toHaveLength(25);
    expect(body.questions[24].text).toBe(input.questions[24].text.trim());
  });
});

import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  checkGroups,
  defaultReviewTab,
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
    expect(reviewTabs).toEqual(["plan", "checks", "activity", "changes"]);
  });
  it("opens the work needing attention and distinguishes rolled-back from verified", () => {
    const d = deliveryReviewFixture();
    expect(defaultReviewTab(d)).toBe("changes");
    expect(reviewStatus(d)).toBe("Rolled back");
    d.ownerAction = { kind: "review-result", label: "Review" };
    expect(defaultReviewTab(d)).toBe("checks");
    d.plans[0].status = "proposed";
    expect(defaultReviewTab(d)).toBe("plan");
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
  it("shows one readable token comparison without receipt fields", () => {
    const html = renderToStaticMarkup(
      createElement(UsageSummary, {
        resources: deliveryReviewFixture().resources,
      }),
    );
    expect(html).toContain("Tokens");
    expect(html).toContain("284,243");
    expect(html).toContain("200,000 threshold");
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

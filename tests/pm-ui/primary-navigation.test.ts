import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  deliveryNavState,
  primarySection,
  PrimaryNavigation,
} from "../../scripts/pm/app/PrimaryNavigation";
import type { RunSummary, V2RunSummary } from "../../scripts/pm/app/types";

const run = (lifecycle: string, active = false) =>
  ({ lifecycle, active }) as V2RunSummary;

describe("Delivery navigation activity", () => {
  it("tracks V2 work and protected checking, with no activity from closed candidates", () => {
    expect(
      deliveryNavState([], [run("ACTIVE"), run("CLOSED", true)], true),
    ).toEqual({ count: 1, state: "running" });
    expect(deliveryNavState([], [run("WAITING", true)], true).state).toBe(
      "running",
    );
    expect(deliveryNavState([], [run("CLOSED")], true)).toEqual({
      count: 0,
      state: "idle",
    });
  });
  it("keeps waiting sessions visible without claiming execution or animating stale facts", () => {
    expect(deliveryNavState([], [run("WAITING")], true)).toEqual({
      count: 1,
      state: "waiting",
    });
    expect(deliveryNavState([], [run("ACTIVE", true)], false)).toEqual({
      count: 1,
      state: "unconfirmed",
    });
  });
  it("retains the legacy session signal and ignores terminal legacy receipts", () => {
    const runs = [
      { state: "IMPLEMENTING" },
      { state: "CANCELLED" },
      { state: "SHIPPED" },
    ] as RunSummary[];
    expect(deliveryNavState(runs, [], true)).toEqual({
      count: 1,
      state: "running",
    });
  });
  it.each([false, true])(
    "shares destination order, links and accessible running status (mobile=%s)",
    (mobile) => {
      const html = renderToStaticMarkup(
        createElement(PrimaryNavigation, {
          section: "/sessions",
          mobile,
          delivery: { count: 1, state: "running" },
        }),
      );
      expect(
        [...html.matchAll(/<strong>(.*?)<\/strong>/g)].map((match) => match[1]),
      ).toEqual(["Bridge", "Plan", "Sessions", "Setup", "Score"]);
      expect(html).toContain('href="#/sprints"');
      expect(html).not.toContain('href="#/launch"');
      expect(html).toContain(
        'href="#/sessions" class="nav-delivery" data-delivery-state="running"',
      );
      expect(html).toContain(
        'aria-label="Sessions, 1 running" aria-current="page"',
      );
      expect(html).toContain('aria-hidden="true"');
    },
  );
});

describe("Primary destination selection", () => {
  it.each([
    ["explore"],
    ["space", "Budget"],
    ["work", "Budget", "BUD-1"],
    ["module", "Budget"],
    ["project"],
    ["projects"],
    ["deliver", "Budget", "BUD-1"],
    ["launch"],
    ["launch", "BUD-1"],
    ["delivery", "new"],
  ])("keeps %j within Plan", (...parts) => {
    expect(primarySection(parts)).toBe("/sprints");
  });
  it.each([
    { parts: [], expected: "/bridge" },
    { parts: ["home"], expected: "/bridge" },
    { parts: ["bridge"], expected: "/bridge" },
    { parts: ["delivery"], expected: "/sessions" },
    { parts: ["delivery", "run", "local-1"], expected: "/sessions" },
    { parts: ["delivery", "test", "uat-1"], expected: "/sessions" },
    { parts: ["uat-item", "Budget", "BUD-1"], expected: "/sessions" },
    { parts: ["sessions"], expected: "/sessions" },
    { parts: ["setup"], expected: "/setup" },
    { parts: ["skill-tools"], expected: "/sprints" },
    { parts: ["score"], expected: "/score" },
    { parts: ["analytics"], expected: "/score" },
    { parts: ["dashboard"], expected: "/score" },
    { parts: ["sprints"], expected: "/sprints" },
    { parts: ["library"], expected: "" },
    { parts: ["unknown"], expected: "" },
  ])("selects $expected for $parts", ({ parts, expected }) => {
    expect(primarySection(parts)).toBe(expected);
  });
  it.each([false, true])(
    "marks Plan current without stealing Sessions status (mobile=%s)",
    (mobile) => {
      const html = renderToStaticMarkup(
        createElement(PrimaryNavigation, {
          section: primarySection(["deliver", "Budget", "BUD-1"]),
          mobile,
          delivery: { count: 1, state: "waiting" },
          setupNeedsAttention: true,
        }),
      );
      expect(html).toContain('href="#/sprints" aria-current="page"');
      expect(html).toContain('aria-label="Sessions, 1 waiting"');
      expect(html).toContain('aria-label="Setup, attention needed"');
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    },
  );
});

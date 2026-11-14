import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deliveryNavState, PrimaryNavigation } from "../../scripts/pm/app/PrimaryNavigation";
import type { RunSummary, V2RunSummary } from "../../scripts/pm/app/types";

const run = (lifecycle: string, active = false) => ({ lifecycle, active }) as V2RunSummary;

describe("Delivery navigation activity", () => {
  it("tracks V2 work and protected checking, with no activity from closed candidates", () => {
    expect(deliveryNavState([], [run("ACTIVE"), run("CLOSED", true)], true))
      .toEqual({ count: 1, state: "running" });
    expect(deliveryNavState([], [run("WAITING", true)], true).state).toBe("running");
    expect(deliveryNavState([], [run("CLOSED")], true)).toEqual({ count: 0, state: "idle" });
  });
  it("keeps waiting sessions visible without claiming execution or animating stale facts", () => {
    expect(deliveryNavState([], [run("WAITING")], true)).toEqual({ count: 1, state: "waiting" });
    expect(deliveryNavState([], [run("ACTIVE", true)], false))
      .toEqual({ count: 1, state: "unconfirmed" });
  });
  it("retains the legacy session signal and ignores terminal legacy receipts", () => {
    const runs = [{ state: "IMPLEMENTING" }, { state: "CANCELLED" }, { state: "SHIPPED" }] as RunSummary[];
    expect(deliveryNavState(runs, [], true)).toEqual({ count: 1, state: "running" });
  });
  it.each([false, true])("shares destination order, links and accessible running status (mobile=%s)", mobile => {
    const html = renderToStaticMarkup(createElement(PrimaryNavigation, {
      section: "/sessions", mobile, delivery: { count: 1, state: "running" },
    }));
    expect([...html.matchAll(/<strong>(.*?)<\/strong>/g)].map(match => match[1]))
      .toEqual(["Bridge", "Launch", "Sessions", "Setup", "Score"]);
    expect(html).toContain('href="#/sessions" class="nav-delivery" data-delivery-state="running"');
    expect(html).toContain('aria-label="Sessions, 1 running" aria-current="page"');
    expect(html).toContain('aria-hidden="true"');
  });
});

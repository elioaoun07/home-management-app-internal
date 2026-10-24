import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LaunchReadiness } from "../../scripts/pm/app/LaunchReadiness";
import { evaluateReadiness, LAUNCH_GATES, readinessFact } from "../../scripts/delivery-v2/readiness.mjs";
import type { V2Readiness, V2ReadinessSelection } from "../../scripts/pm/app/types";

const selection: V2ReadinessSelection = { file: "PM Tooling/4 - Checklist.md", id: "R44", executor: "codex", model: "fixture", effort: "low", workProfile: "focused" };
function result(blocked = false): V2Readiness {
  const facts = Object.fromEntries(LAUNCH_GATES.map(gate => [gate, readinessFact("satisfied", gate)]));
  if (blocked) facts.policy = readinessFact("blocked", "grant-expired");
  return { ...evaluateReadiness({ selection, facts }), expiresAt: new Date(Date.now() + 60_000).toISOString() } as V2Readiness;
}
function render(props: Partial<Parameters<typeof LaunchReadiness>[0]> = {}) {
  return renderToStaticMarkup(createElement(LaunchReadiness, {
    result: result(), connected: true, loading: false, checking: false, disabled: false, onCheck: () => {}, ...props,
  }));
}

it("shows explicit pending feedback and disables the real check control", () => {
  const html = render({ checking: true });
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('role="status" aria-live="polite"');
  expect(html).toContain("Checking readiness…");
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Checking…<\/button>/u);
  expect(html).not.toContain("Checks passed");
});

it("confirms a completed check even when the same blockers remain", () => {
  const html = render({ result: result(true), checkedAt: Date.now() });
  expect(html).toContain("Setup required");
  expect(html).toContain("Checked ");
  expect(html).toContain("Authorization expired — check readiness");
  expect(html).not.toContain("Checks passed");
  expect(html).toContain('<details class="launch-check-details">');
  expect(html).toContain("10/11");
});

it("makes request failures visible without treating cached ready facts as success", () => {
  const html = render({ error: new Error("Laptop did not respond"), checkedAt: Date.now() });
  expect(html).toContain("Check failed");
  expect(html).toContain('role="alert">Laptop did not respond');
  expect(html).not.toContain("Checks passed");
  expect(html).not.toContain("Checked ");
  expect(html).toContain("Previous checks");
});

it("distinguishes fresh readiness, expiry, unavailable data and offline state", () => {
  expect(render()).toContain("Checks passed");
  expect(render({ result: { ...result(), expiresAt: new Date(0).toISOString() } })).toContain("Checks at Start");
  expect(render({ result: null })).toContain("Readiness unavailable");
  expect(render({ result: null, loading: true })).toContain("Loading readiness…");
  expect(render({ connected: false, disabled: true })).toContain("Laptop offline");
});

it("makes the authorization effect and its separate expiry visible", () => {
  const authorization = { key: "fixture", expiresAt: "2026-10-25T12:00:00.000Z", renewedAt: "2026-10-24T12:00:00.000Z" };
  const html = render({ result: { ...result(), authorization } });
  expect(html).toContain("Renews authorization · 24h");
  expect(html).toContain("Authorized until");
  expect(html).toContain('dateTime="2026-10-25T12:00:00.000Z"');
  expect(render({ result: { ...result(), authorization: { ...authorization, expiresAt: null } } })).toContain("Confirms saved authorization");
});

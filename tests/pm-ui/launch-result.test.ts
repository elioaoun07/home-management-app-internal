import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LaunchResult } from "../../scripts/pm/app/LaunchResult";
import { evaluateReadiness, LAUNCH_GATES, readinessFact } from "../../scripts/delivery-v2/readiness.mjs";

it("retains the actual Start timeout and request identity instead of passive check labels", () => {
  const facts = Object.fromEntries(LAUNCH_GATES.map(gate => [gate, readinessFact("satisfied", gate)]));
  facts.modelAvailability = readinessFact("unknown", "native-model-unprobed");
  const readiness = { ...evaluateReadiness({ facts }), nativeModelDiagnostics: { code: "native-probe-timeout" },
    collection: { stages: [{ name: "native-model", outcome: "blocked", code: "native-model-unavailable", durationMs: 10000 }] } };
  const html = renderToStaticMarkup(createElement(LaunchResult, { commandId: "original-command",
    failure: { message: "delivery not ready", payload: { ok: false, error: "delivery-not-ready", readiness }, receivedAt: "2026-10-24T11:54:28.000Z" } }));
  expect(html).toContain("Start blocked");
  expect(html).toContain("Model check timed out");
  expect(html).toContain("original-command");
  expect(html).toContain("native-probe-timeout");
  expect(html).toContain('dateTime="2026-10-24T11:54:28.000Z"');
  expect(html).not.toContain("Checked at Start");
  expect(html).not.toContain("Try again");
});

it("shows a collection failure without treating previousReadiness as fresh evidence", () => {
  const html = renderToStaticMarkup(createElement(LaunchResult, { failure: { message: "Readiness check failed; no run was started.",
    payload: { error: "readiness-collection-failed", previousReadiness: { ready: true } } } }));
  expect(html).toContain("Readiness check failed; no run was started.");
  expect(html).not.toContain("Checks passed");
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  coordinatorStatus,
  StewardRequests,
} from "../../scripts/pm/app/StewardRequests";
import type { StewardRequest } from "../../scripts/pm/app/types";
import { evaluateReadiness, LAUNCH_GATES, readinessFact } from "../../scripts/delivery-v2/readiness.mjs";
import type { V2Readiness } from "../../scripts/pm/app/types";

const at = "2026-10-20T10:00:00.000Z",
  now = Date.parse(at);
export const request: StewardRequest = {
  command_id: "8bdd1632-0bdc-4b8d-8642-b87cb019ebaa",
  initiatedBy: "ERA Steward",
  actor: "owner-fixture",
  workId: "DLV-140",
  file: "Delivery/4 - Checklist.md",
  acceptedAt: at,
  startedAt: at,
  lastConfirmedAt: at,
  staleAfterMs: 180000,
  stage: "readiness",
  status: "pending",
  terminal: false,
  run_id: null,
  jobUpdatedAt: null,
  blocker: null,
  result: null,
  runEvidence: null,
  evidence: [{ stage: "accepted", at, code: "steward-request-accepted" }],
};
const render = (row = request, time = now) =>
  renderToStaticMarkup(
    createElement(StewardRequests, { requests: [row], now: time }),
  );

describe("shared desktop/phone Steward status", () => {
  it("keeps the recorded Start timeout visible after live observations expire", () => {
    const facts = Object.fromEntries(LAUNCH_GATES.map(gate => [gate, readinessFact("satisfied", gate)]));
    facts.modelAvailability = readinessFact("unknown", "native-model-unprobed");
    const readiness: V2Readiness = { ...evaluateReadiness({ facts }), status: "blocked", authority: "inspection-only",
      selection: { file: request.file, id: request.workId, executor: "codex", model: null, effort: null, workProfile: "focused" },
      blockers: [{ gate: "modelAvailability", state: "unknown", code: "native-model-unprobed" }],
      nextActions: [], expiresAt: null, nativeModelDiagnostics: { code: "native-probe-timeout" },
      collection: { stages: [{ name: "native-model", outcome: "blocked", code: "native-model-unavailable", durationMs: 10000 }] } };
    expect(render({ ...request, status: "blocked", blocker: { code: "delivery-not-ready", readiness } })).toContain("Model check timed out");
  });
  it("preserves ordinary owner attribution for the same request receipt", () => {
    expect(render({ ...request, initiatedBy: "Owner" })).toContain("Initiated by Owner");
    expect(render({ ...request, initiatedBy: "Owner" })).not.toContain("Initiated by ERA Steward");
  });
  it("attributes the actual entry with identity, timestamps, stage and evidence before a run", () => {
    const html = render();
    for (const text of [
      "Initiated by ERA Steward",
      request.command_id,
      "Accepted",
      "Started",
      at,
      "readiness",
      "Confirmed",
      "owner-fixture",
      "steward request accepted",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("Open delivery");
  });

  it("derives Status unconfirmed at the threshold without a new update or server failure", () => {
    expect(coordinatorStatus(request, now + 179999)).toBe("Confirmed");
    expect(coordinatorStatus(request, now + 180000)).toBe("Status unconfirmed");
    expect(
      coordinatorStatus({ ...request, staleAfterMs: 5000 }, now + 5000),
    ).toBe("Status unconfirmed");
    expect(
      coordinatorStatus({ ...request, lastConfirmedAt: "invalid" }, now),
    ).toBe("Status unconfirmed");
    expect(
      coordinatorStatus(
        { ...request, lastConfirmedAt: "2026-10-21T10:00:00Z" },
        now,
      ),
    ).toBe("Status unconfirmed");
    const html = render(request, now + 180000);
    expect(html).toContain("Status unconfirmed");
    expect(html).toContain("pending");
    expect(html).not.toContain("failed");
  });

  it.each(["completed", "failed", "cancelled", "blocked", "running"])(
    "keeps known %s separate from coordinator silence",
    (status) => {
      const html = render(
        {
          ...request,
          status,
          stage: status,
          terminal: ["completed", "failed", "cancelled"].includes(status),
          run_id: "r-evidence",
          jobUpdatedAt: "2026-10-20T10:05:00Z",
          blocker: status === "blocked" ? { code: "policy-expired" } : null,
          runEvidence: { seq: 7, kind: "run.observed", at },
          result: { result_id: "result-1", version: 2, at, record: {} },
        },
        now + 360000,
      );
      expect(html).toContain(status);
      expect(html).toContain("Status unconfirmed");
      expect(html).toContain("#/delivery/run/r-evidence");
      expect(html).toContain("result-1");
      expect(html).toContain("run.observed");
      expect(html).toContain("#7");
      if (status === "blocked")
        expect(html).toContain("Blocker: policy expired");
    },
  );
});

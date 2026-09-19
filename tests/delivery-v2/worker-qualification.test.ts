// Command Center Phase 3 — the worker qualification harness, without Docker.
// The receipt it assembles must be loadable only against its own binding and must
// carry the battery's verdicts unchanged, including an unobserved egress control.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { assembleReceipt, batteryDockerfile, readImageBinding } from "../../scripts/delivery-v2/probes/worker-qualification.mjs";
import { classifyControls, validateNegativeControl } from "../../scripts/delivery-v2/probes/codex-qualification.mjs";
import { loadQualification, writeQualificationReceipt } from "../../scripts/delivery-v2/qualification.mjs";
import { boundaryBindingDigest, makeBoundaryConfig } from "../../scripts/delivery-v2/worker-boundary.mjs";
import { describeProfile } from "../../scripts/delivery-v2/adapters/claude.mjs";
import { admitProfile } from "../../scripts/delivery-v2/adapters/adapter.mjs";

const records = (overrides: Record<string, string> = {}) =>
  [
    ["scratch-write", "escaped"],
    ["outside-write", "denied"],
    ["git-mutation", "denied"],
    ["host-secret-read", "denied"],
    ["link-escape", "denied"],
    ["network-egress", "inconclusive"],
    ["store-access", "denied"],
    ["descendant-spawn", "denied"],
  ].map(([canary, outcome]) => ({ canary, outcome: overrides[canary] || outcome }));

const unconfined = ["scratch-write", "outside-write", "git-mutation", "host-secret-read", "link-escape", "store-access", "descendant-spawn"].map((canary) => ({
  canary,
  outcome: "escaped",
  heartbeatStarted: true,
}));

const boundary = makeBoundaryConfig({ image: "era-delivery-v2-worker:local" });

function verdict(hardened: { canary: string; outcome: string }[]) {
  const negativeControl = validateNegativeControl(unconfined);
  const controls = classifyControls(hardened, { evidenceRef: "worker-qualification:run:worker", descendantSurvived: false });
  const unverified = Object.entries(controls).filter(([, control]) => !control.verified).map(([id]) => id);
  return { negativeControl, controls, unverified, failing: [], met: true };
}

describe("worker qualification receipts", () => {
  it("adds present-but-forbidden decoys on top of the exact worker image", () => {
    const dockerfile = batteryDockerfile("era-delivery-v2-worker:local");
    expect(dockerfile.split("\n")[0]).toBe("FROM era-delivery-v2-worker:local");
    expect(dockerfile).toMatch(/\/host-private\/secret\.txt/u);
    expect(dockerfile).toMatch(/chmod 0700 \/host-private \/supervisor/u);
    expect(dockerfile.trim().split("\n").pop()).toBe("USER 10001:10001");
  });

  it("refuses to state a binding for an image that does not carry the executor", () => {
    const fakeDocker = (args: string[]) =>
      args[0] === "image" ? { status: 0, stdout: "sha256:image\n", stderr: "" } : { status: 0, stdout: JSON.stringify({ era: "probe", sdk: { "claude-agent-sdk": null }, battery_digest: "sha256:b" }), stderr: "" };
    expect(readImageBinding({ boundary, backend_id: "claude-agent-sdk", docker: fakeDocker }).binding).toBeNull();
  });

  it("binds the receipt to the image's own SDK version, boundary and battery", () => {
    const fakeDocker = (args: string[]) =>
      args[0] === "image"
        ? { status: 0, stdout: "sha256:image\n", stderr: "" }
        : { status: 0, stdout: JSON.stringify({ era: "probe", sdk: { "claude-agent-sdk": "0.3.207" }, battery_digest: "sha256:battery" }), stderr: "" };
    const { binding } = readImageBinding({ boundary, backend_id: "claude-agent-sdk", docker: fakeDocker });
    expect(binding).toEqual({ backend_id: "claude-agent-sdk", sdk_version: "0.3.207", boundary_digest: boundaryBindingDigest(boundary, "sha256:image"), battery_digest: "sha256:battery" });
  });

  it("keeps an inconclusive egress canary unverified, so the executor stays unqualified", () => {
    const root = mkdtempSync(join(tmpdir(), "era-v2-wq-"));
    try {
      const binding = { backend_id: "claude-agent-sdk", sdk_version: "0.3.207", boundary_digest: "sha256:bd", battery_digest: "sha256:bt" };
      const worker = verdict(records());
      const receipt = assembleReceipt({ backend_id: "claude-agent-sdk", binding, worker, checker: worker, run: "run", observed_at: "2026-09-12T00:00:00.000Z" });
      const controls = receipt.controls as Record<string, { state: string; verified: boolean }>;
      expect(controls["network.egress"]).toMatchObject({ state: "unknown", verified: false });
      expect(controls["filesystem.hostSecretRead"]).toMatchObject({ state: "supported", verified: true });
      writeQualificationReceipt({ root, receipt });
      const loaded = loadQualification({ root, backend_id: "claude-agent-sdk", binding });
      expect(loaded.ok).toBe(true);
      const profile = describeProfile({ observations: loaded.observations, qualification_ref: loaded.qualification_ref });
      expect(profile.qualified).toBe(false);
      expect(profile.unverifiedControls).toEqual(["network.egress"]);
      expect(admitProfile(profile).admitted).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("records an escape as a finding that refuses the profile", () => {
    const worker = verdict(records({ "host-secret-read": "escaped" }));
    const receipt = assembleReceipt({
      backend_id: "codex-exec-sdk",
      binding: { backend_id: "codex-exec-sdk", sdk_version: "0.144.1", boundary_digest: "sha256:bd", battery_digest: "sha256:bt" },
      worker,
      checker: worker,
      run: "run",
      observed_at: "2026-09-12T00:00:00.000Z",
    });
    expect((receipt.controls as Record<string, { state: string; verified: boolean }>)["filesystem.hostSecretRead"]).toMatchObject({ state: "unsupported", verified: true });
  });
});

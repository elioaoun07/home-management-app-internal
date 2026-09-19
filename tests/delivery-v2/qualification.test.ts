// Command Center Phase 3 — qualification receipts bound to executor, runtime and
// boundary (DLV-96). A receipt supplies observations; admission rules are unchanged.
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  QUALIFICATION_DIR,
  QUALIFICATION_REFUSALS,
  loadQualification,
  makeQualificationReceipt,
  verifyQualificationReceipt,
  writeQualificationReceipt,
} from "../../scripts/delivery-v2/qualification.mjs";
import { describeProfile as describeClaude } from "../../scripts/delivery-v2/adapters/claude.mjs";
import { describeProfile as describeCodex } from "../../scripts/delivery-v2/adapters/codex.mjs";
import { admitProfile } from "../../scripts/delivery-v2/adapters/adapter.mjs";

const BINDING = { sdk_version: "0.3.207", boundary_digest: "sha256:boundary", battery_digest: "sha256:battery" };
const CONTROL_IDS = [
  "filesystem.scratchWrite",
  "filesystem.outsideScratchWrite",
  "filesystem.hostSecretRead",
  "filesystem.linkEscape",
  "network.egress",
  "process.descendantsAfterStop",
  "store.workerAccess",
];

function controls(overrides: Record<string, object> = {}) {
  return Object.fromEntries(
    CONTROL_IDS.map((id) => [id, { state: "supported", verified: true, evidence_ref: "harness:run-1:worker", note: "synthetic", ...(overrides[id] || {}) }]),
  );
}

function receipt(input: Record<string, unknown> = {}) {
  return makeQualificationReceipt({
    backend_id: "claude-agent-sdk",
    binding: BINDING,
    controls: controls(),
    negativeControl: { valid: true },
    harness: { name: "worker-qualification", run: "run-1" },
    observed_at: "2026-09-12T00:00:00.000Z",
    ...input,
  } as Parameters<typeof makeQualificationReceipt>[0]);
}

let ROOT: string;

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-qual-"));
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

const load = (binding: Record<string, string> | null = BINDING, backend_id = "claude-agent-sdk") =>
  loadQualification({ root: ROOT, backend_id, binding });

function admitFrom(loaded: ReturnType<typeof load>, describe = describeClaude) {
  const profile = describe(
    loaded.ok ? { observations: loaded.observations, qualification_ref: loaded.qualification_ref, observed_at: loaded.observed_at } : {},
  );
  return { profile, admission: admitProfile(profile, { requireConfinement: true }) };
}

describe("no receipt, no qualification", () => {
  it("keeps the profile unqualified when nothing was observed", () => {
    const loaded = load();
    expect(loaded.ok).toBe(false);
    expect(loaded.refusals[0].code).toBe(QUALIFICATION_REFUSALS.NONE);
    expect(admitFrom(loaded).admission.admitted).toBe(false);
  });

  it("qualifies nothing when the runtime cannot state its binding", () => {
    writeQualificationReceipt({ root: ROOT, receipt: receipt() });
    const loaded = load(null);
    expect(loaded.ok).toBe(false);
    expect(loaded.refusals[0].code).toBe(QUALIFICATION_REFUSALS.NO_BINDING);
  });
});

describe("a bound receipt", () => {
  it("admits the executor it was taken for, through the unchanged admission rules", () => {
    writeQualificationReceipt({ root: ROOT, receipt: receipt() });
    const loaded = load();
    expect(loaded.ok).toBe(true);
    const { profile, admission } = admitFrom(loaded);
    expect(profile.qualified).toBe(true);
    expect(admission.admitted).toBe(true);
    // The monetary bound is still refused on the interface finding, not the receipt.
    expect(profile.resources.strictBound).toBe(false);
  });

  it("does not qualify the other executor", () => {
    writeQualificationReceipt({ root: ROOT, receipt: receipt() });
    const loaded = load(BINDING, "codex-exec-sdk");
    expect(loaded.ok).toBe(false);
    expect(loaded.considered.map((entry: { verdict: string }) => entry.verdict)).toContain(QUALIFICATION_REFUSALS.BACKEND);
    expect(admitFrom(loaded, describeCodex).admission.admitted).toBe(false);
  });

  it.each([
    ["sdk_version", "0.3.208"],
    ["boundary_digest", "sha256:another-image"],
    ["battery_digest", "sha256:edited-canary"],
  ])("refuses a receipt whose %s differs from the runtime", (field, value) => {
    writeQualificationReceipt({ root: ROOT, receipt: receipt() });
    const loaded = load({ ...BINDING, [field]: value });
    expect(loaded.ok).toBe(false);
    expect(loaded.refusals[0].code).toBe(QUALIFICATION_REFUSALS.BINDING);
  });

  it("refuses a receipt edited after it was written", () => {
    writeQualificationReceipt({ root: ROOT, receipt: receipt({ controls: controls({ "filesystem.hostSecretRead": { state: "unsupported" } }) }) });
    const dir = join(ROOT, ...QUALIFICATION_DIR.split("/"));
    const file = join(dir, readdirSync(dir)[0]);
    const edited = JSON.parse(readFileSync(file, "utf8"));
    edited.controls["filesystem.hostSecretRead"].state = "supported";
    writeFileSync(file, JSON.stringify(edited), "utf8");
    expect(verifyQualificationReceipt(edited)).toBe(false);
    const loaded = load();
    expect(loaded.ok).toBe(false);
    expect(loaded.considered[0].verdict).toBe(QUALIFICATION_REFUSALS.TAMPERED);
  });
});

describe("the battery stays truthful", () => {
  it("records nothing as verified when the negative control was invalid", () => {
    const made = receipt({ negativeControl: { valid: false, failures: [{ canary: "host-secret-read", reason: "did not escape unconfined" }] } });
    expect(Object.values(made.controls).every((control: { verified: boolean }) => !control.verified)).toBe(true);
    writeQualificationReceipt({ root: ROOT, receipt: made });
    expect(admitFrom(load()).admission.admitted).toBe(false);
  });

  it("leaves the profile unqualified while network egress is unobserved", () => {
    writeQualificationReceipt({
      root: ROOT,
      receipt: receipt({ controls: controls({ "network.egress": { state: "unknown", verified: false, evidence_ref: null } }) }),
    });
    const { profile, admission } = admitFrom(load());
    expect(profile.qualified).toBe(false);
    expect(profile.unverifiedControls).toContain("network.egress");
    expect(admission.admitted).toBe(false);
  });

  it("never reads older qualification or feasibility records as qualifying", () => {
    const dir = join(ROOT, ...QUALIFICATION_DIR.split("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "q-old.json"), JSON.stringify({ schema: "delivery-v2/qualification@1", backend_id: "claude-agent-sdk", controls: controls() }), "utf8");
    writeFileSync(join(dir, "feasibility-x.json"), JSON.stringify({ schema: "delivery-v2/isolation-feasibility@1" }), "utf8");
    const loaded = load();
    expect(loaded.ok).toBe(false);
    expect(loaded.considered).toEqual([]);
  });
});

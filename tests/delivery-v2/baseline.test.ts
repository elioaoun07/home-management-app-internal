// PM Delivery V2 — S0.2 fixtures: the native-baseline record and the FAST local
// profile's resource-policy basis.
//
// The baseline is the comparison every later stage is judged against, so the
// assertions here are all about what the record refuses to say: it will not
// invent an observer, will not turn an unmeasured minute into a zero, and will
// not report a comparison between two samples that are not comparable.
//
// The profile assertions lock the current, honest answer — nothing is qualified —
// so flipping a flag in fast-local.json without running the S1.1 fixtures fails
// here rather than silently authorizing a pilot.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ContractError, makeResourceBasis } from "../../scripts/delivery-v2/contracts.mjs";
import {
  BASELINE_ARTIFACT_DIR,
  OWNER_EFFORT_FIELDS,
  baselineArtifactPath,
  comparabilityReport,
  planBaselineRecord,
  recordBaselineObservation,
  totalOwnerMinutes,
} from "../../scripts/delivery-v2/baseline.mjs";

const PLAN = {
  work_id: "w-000000000001",
  contract_id: "c-000000000001",
  contract_revision: 1,
  requestedDisposition: "verified_deployment",
};

const OBSERVER = { observed_by: "owner (Elio)", observed_at: "2026-09-07T10:00:00.000Z" };

const FULL_EFFORT = {
  setup: 4,
  explanation: 6,
  decisions: 3,
  monitoring: 10,
  recovery: 0,
  review: 12,
  application: 5,
  release: 8,
  maintenance: 0,
};

describe("planBaselineRecord", () => {
  it("starts with every owner-effort field unknown, not zero", () => {
    const record = planBaselineRecord(PLAN);
    expect(record.status).toBe("planned");
    expect(record.observed_by).toBeNull();
    expect(record.observedDisposition).toBe("none");
    for (const field of OWNER_EFFORT_FIELDS) expect(record.ownerEffortMinutes[field]).toBeNull();
    expect(record.unknownEffortFields).toEqual([...OWNER_EFFORT_FIELDS]);
  });

  it("carries the requested disposition and an unqualified resource basis", () => {
    const record = planBaselineRecord(PLAN);
    expect(record.requestedDisposition).toBe("verified_deployment");
    expect(record.resourceBasis.strictBound).toBe(false);
    expect(record.resourceBasis.enforcementProfile).toBe("unqualified");
    expect(record.resourceBasis.unknown.length).toBeGreaterThan(0);
  });

  it("derives a stable id and a gitignored artifact path", () => {
    expect(planBaselineRecord(PLAN).baseline_id).toBe(planBaselineRecord(PLAN).baseline_id);
    expect(BASELINE_ARTIFACT_DIR).toBe(".delivery/v2/artifacts/baselines");
    expect(baselineArtifactPath("C:\\repo\\", "b-1")).toBe("C:/repo/.delivery/v2/artifacts/baselines/b-1.json");
  });

  it("refuses a record that does not name its work and contract", () => {
    expect(() => planBaselineRecord({ ...PLAN, work_id: "" })).toThrow(ContractError);
  });
});

describe("recordBaselineObservation", () => {
  it("refuses an unattributed or undated observation", () => {
    const record = planBaselineRecord(PLAN);
    expect(() => recordBaselineObservation(record, { ...OBSERVER, observed_by: "" })).toThrow(ContractError);
    expect(() => recordBaselineObservation(record, { ...OBSERVER, observed_at: "" })).toThrow(ContractError);
  });

  it("keeps unmeasured fields unknown and lists them", () => {
    const observed = recordBaselineObservation(planBaselineRecord(PLAN), {
      ...OBSERVER,
      ownerEffortMinutes: { setup: 4, review: 12 },
      closed_outcome: "verified_candidate",
      observedDisposition: "verified_candidate",
      elapsedMs: 3_600_000,
    });
    expect(observed.status).toBe("observed");
    expect(observed.ownerEffortMinutes.setup).toBe(4);
    expect(observed.ownerEffortMinutes.release).toBeNull();
    expect(observed.unknownEffortFields).toContain("release");
    expect(observed.unknownEffortFields).not.toContain("setup");
  });

  it("rejects a negative or non-numeric measurement rather than coercing it", () => {
    const record = planBaselineRecord(PLAN);
    expect(() => recordBaselineObservation(record, { ...OBSERVER, ownerEffortMinutes: { setup: -1 } })).toThrow(
      ContractError,
    );
    expect(() =>
      recordBaselineObservation(record, {
        ...OBSERVER,
        ownerEffortMinutes: { setup: "about ten" as unknown as number },
      }),
    ).toThrow(ContractError);
  });

  it("rejects a closed outcome or observed disposition outside the canonical enums", () => {
    const record = planBaselineRecord(PLAN);
    expect(() => recordBaselineObservation(record, { ...OBSERVER, closed_outcome: "shipped" })).toThrow(ContractError);
    expect(() => recordBaselineObservation(record, { ...OBSERVER, observedDisposition: "done" })).toThrow(ContractError);
  });

  it("does not mutate the planned record it was derived from", () => {
    const planned = planBaselineRecord(PLAN);
    recordBaselineObservation(planned, { ...OBSERVER, ownerEffortMinutes: FULL_EFFORT });
    expect(planned.status).toBe("planned");
  });
});

describe("totalOwnerMinutes", () => {
  it("never zero-fills — an unmeasured bucket comes back as unknown", () => {
    const observed = recordBaselineObservation(planBaselineRecord(PLAN), {
      ...OBSERVER,
      ownerEffortMinutes: { setup: 4, review: 12 },
    });
    const total = totalOwnerMinutes(observed);
    expect(total.measuredMinutes).toBe(16);
    expect(total.complete).toBe(false);
    expect(total.unknownFields).toContain("application");
  });

  it("reports complete only when every bucket was measured", () => {
    const observed = recordBaselineObservation(planBaselineRecord(PLAN), {
      ...OBSERVER,
      ownerEffortMinutes: FULL_EFFORT,
    });
    const total = totalOwnerMinutes(observed);
    expect(total.complete).toBe(true);
    expect(total.measuredMinutes).toBe(48);
  });
});

describe("comparabilityReport", () => {
  const native = recordBaselineObservation(planBaselineRecord({ ...PLAN, method: "ordinary-native" }), {
    ...OBSERVER,
    ownerEffortMinutes: FULL_EFFORT,
    closed_outcome: "verified_candidate",
    observedDisposition: "verified_candidate",
  });

  it("refuses a sample that has not been observed", () => {
    const planned = planBaselineRecord({ ...PLAN, method: "delivery-v2" });
    const report = comparabilityReport(native, planned);
    expect(report.comparable).toBe(false);
    expect(report.blockers.join(" ")).toContain("not been observed");
  });

  it("refuses to compare a patch with a deployment", () => {
    const supervised = recordBaselineObservation(planBaselineRecord({ ...PLAN, method: "delivery-v2" }), {
      ...OBSERVER,
      ownerEffortMinutes: FULL_EFFORT,
      closed_outcome: "verified_candidate",
      observedDisposition: "verified_deployment",
    });
    const report = comparabilityReport(native, supervised);
    expect(report.comparable).toBe(false);
    expect(report.blockers.join(" ")).toContain("a patch is not comparable with a deployment");
  });

  it("refuses a comparison with unmeasured owner effort on either side", () => {
    const supervised = recordBaselineObservation(planBaselineRecord({ ...PLAN, method: "delivery-v2" }), {
      ...OBSERVER,
      ownerEffortMinutes: { ...FULL_EFFORT, review: null },
      closed_outcome: "verified_candidate",
      observedDisposition: "verified_candidate",
    });
    const report = comparabilityReport(native, supervised);
    expect(report.comparable).toBe(false);
    expect(report.blockers.join(" ")).toContain("unmeasured owner effort");
  });

  it("refuses samples of different contracts even when both are complete", () => {
    const other = recordBaselineObservation(
      planBaselineRecord({ ...PLAN, method: "delivery-v2", contract_id: "c-000000000002" }),
      { ...OBSERVER, ownerEffortMinutes: FULL_EFFORT, observedDisposition: "verified_candidate" },
    );
    expect(comparabilityReport(native, other).blockers).toContain("different contract revisions");
  });

  it("compares two complete like-for-like samples and reports both totals", () => {
    const supervised = recordBaselineObservation(planBaselineRecord({ ...PLAN, method: "delivery-v2" }), {
      ...OBSERVER,
      ownerEffortMinutes: { ...FULL_EFFORT, explanation: 1, monitoring: 2 },
      closed_outcome: "verified_candidate",
      observedDisposition: "verified_candidate",
    });
    const report = comparabilityReport(native, supervised);
    expect(report.comparable).toBe(true);
    expect(report.native.measuredMinutes).toBe(48);
    expect(report.supervised.measuredMinutes).toBe(35);
  });
});

describe("resource-policy basis", () => {
  it("refuses to claim a strict bound under an unqualified enforcement profile", () => {
    expect(() => makeResourceBasis({ strictBound: true })).toThrow(ContractError);
  });

  it("requires a stated reason whenever the strict bound is refused", () => {
    expect(() => makeResourceBasis({ strictBound: false })).toThrow(ContractError);
    expect(makeResourceBasis({ strictBoundRefusalReason: "no qualified whole-job bound" }).strictBound).toBe(false);
  });

  it("keeps the four cost provenances separate and unknowns explicit", () => {
    const basis = makeResourceBasis({
      providerReported: 1.24,
      unknown: ["reconciled invoice not yet available"],
      strictBoundRefusalReason: "no qualified whole-job bound",
    });
    expect(basis.reconciledBilled).toBeNull();
    expect(basis.estimatedApiEquivalent).toBeNull();
    expect(basis.subscriptionConsumption).toBeNull();
    expect(basis.providerReported).toBe(1.24);
    expect(basis.unknown).toEqual(["reconciled invoice not yet available"]);
  });
});

describe("FAST local profile", () => {
  const profile = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../scripts/delivery-v2/profiles/fast-local.json", import.meta.url)), "utf8"),
  );

  it("states that nothing is qualified yet", () => {
    expect(profile.status).toBe("unqualified");
    expect(profile.executor.qualified).toBe(false);
    expect(profile.isolation.qualified).toBe(false);
  });

  it("stays unqualified even now that a qualification record exists", () => {
    // S1.1 ran the F-ISOLATION battery, so there is a reference. A reference is
    // evidence that someone looked, not evidence that the answer was good: three
    // containment controls were observed to fail and one is still unobserved.
    expect(profile.executor.qualification_ref).toMatch(/^qualification:/u);
    expect(profile.executor.qualified).toBe(false);
    expect(profile.isolation.observed.ran).toBe(true);
    expect(profile.isolation.observed.results["filesystem.hostSecretRead"]).toMatch(/^UNSUPPORTED/u);
  });

  it("names Codex exec/SDK as the first executor candidate", () => {
    expect(profile.executor.candidate).toBe("codex-exec-sdk");
  });

  it("refuses a strict monetary bound and says why", () => {
    expect(profile.resourcePolicy.strictBound).toBe(false);
    expect(profile.resourcePolicy.strictBoundRefusalReason).toMatch(/whole-job/);
    expect(profile.resourcePolicy.separateProvenance).toHaveLength(4);
  });

  it("keeps the owner non-negotiables and the candidate-only endpoint", () => {
    expect(profile.dispositionPolicy).toMatchObject({
      maxAutomaticDisposition: "verified_candidate",
      gitWrites: false,
      worktrees: false,
      permissionBypass: false,
      productionDatabaseWrites: false,
      releaseAuthority: "owner",
    });
  });

  it("encodes the evidence rules the S0.2 fixtures prove", () => {
    expect(profile.evidencePolicy.zeroSelectedTestsIs).toBe("missing");
    expect(profile.evidencePolicy.malformedRequiredReviewIs).toBe("inconclusive");
    expect(profile.evidencePolicy.forbiddenSubstitutes.behaviour).toContain("source_match");
    expect(profile.evidencePolicy.repairDispatchLimit).toBe(1);
  });
});

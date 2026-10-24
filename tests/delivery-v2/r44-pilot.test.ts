import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { policyTemplate, validateExecutionPolicy, WORK_PROFILE_CONTRACTS } from "../../scripts/delivery-v2/policy.mjs";
import { prepareR44Pilot, r44InputManifest, r44SourceInputs, R44_CLIENT_ROOTS, R44_CONTEXT, R44_PUBLICATION } from "../../scripts/delivery-v2/r44-pilot.mjs";
import { provisionScratch, walkTrusted } from "../../scripts/delivery-v2/scratch.mjs";

it("supplies every client source for the plan's recount plus config, helper and fixture inputs through the real snapshot loader", () => {
  const root = process.cwd();
  const include = r44SourceInputs(root);
  expect(include).toEqual([...new Set(include)].sort());
  expect(include).toEqual(expect.arrayContaining(R44_CONTEXT));
  for (const directory of R44_CLIENT_ROOTS) {
    const expected = walkTrusted({ root: join(root, directory) }).entries
      .filter(entry => /\.[cm]?[jt]sx?$/u.test(entry.path)).map(entry => `${directory}/${entry.path}`);
    expect(expected.length).toBeGreaterThan(0);
    expect(include.filter(path => path.startsWith(directory + "/"))).toEqual(expected);
  }
  const scratchRoot = mkdtempSync(join(tmpdir(), "era-r44-inputs-"));
  try {
    const snapshot = provisionScratch({ scratchRoot, hostRoot: root, include });
    expect(snapshot.refusals).toEqual([]);
    expect(snapshot.supplied.map(entry => ({ path: entry.path, sha256: entry.sha256 }))).toEqual(r44InputManifest(root, include));
    for (const path of include) expect(readFileSync(join(scratchRoot, path))).toEqual(readFileSync(join(root, path)));
    expect(include.some(path => /(^|\/)(\.delivery|\.git|\.env|node_modules)(\/|$)/u.test(path))).toBe(false);
  } finally { rmSync(scratchRoot, { recursive: true, force: true }); }
}, 60000); // Full 700-file Windows snapshot exercises real reparse/path checks.

it("stages an expired candidate-only draft with the exact Focused limits without changing the input policy", () => {
  const installed = policyTemplate({ executor: "codex", authorized_by: "fixture owner" });
  const before = JSON.stringify(installed);
  const prepared = prepareR44Pilot({ root: process.cwd(), installed });
  expect(JSON.stringify(installed)).toBe(before);
  expect(validateExecutionPolicy(prepared.policy).ok).toBe(true);
  expect(prepared.policy.policy_revision).toBe(installed.policy_revision + 1);
  expect(prepared.policy.authorized_by).toContain("PENDING");
  expect(Date.parse(prepared.policy.grant.expires_at)).toBe(0);
  expect(prepared.selection).toMatchObject({ expectId: "R44", executor: "codex", model: "gpt-6-luna", effort: "low", workProfile: "focused" });
  expect(WORK_PROFILE_CONTRACTS.focused).toMatchObject({ maxPlanJobs: 1, maxImplementationJobs: 1, repairDispatchLimit: 0 });
  expect(prepared.policy.execution).toEqual({ maxRequestedDisposition: "verified_candidate", repairDispatchLimit: 0, retryAutomatically: false });
  expect(prepared.policy.publicationScope.allowedPaths).toEqual(R44_PUBLICATION);
  expect(prepared.policy.checks).toEqual(installed.checks);
  expect(prepared.policy.resources).toEqual(installed.resources);
  expect(prepared.policy.grant.permitted_effects).toEqual(installed.grant.permitted_effects);
});

// Owner allowance settings (Settings panel, 2026-09-19), pure: the overlay the
// journey applies to the policy's shared allowance and each run's grant.
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ALLOWANCES_REL,
  applyAllowanceChange,
  defaultAllowances,
  effectiveGrant,
  effectivePolicy,
  fleetWindow,
  readAllowances,
  runAllowance,
  startOfLocalDay,
  writeAllowances,
} from "../../scripts/delivery-v2/allowances.mjs";
import { resourceSummary } from "../../scripts/delivery-v2/jobs.mjs";

type Loose = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const NOW = "2026-09-19T15:00:00.000Z";
const change = (settings: Loose, body: Loose, extra: Loose = {}): Loose => applyAllowanceChange(settings, body, { actor: "owner", now: NOW, ...extra });

let dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe("allowance settings", () => {
  it("defaults to the policy's amounts and lifetime window", () => {
    const settings = defaultAllowances();
    expect(fleetWindow({ settings, policyFleetAllowance: 200000, now: NOW })).toEqual({ limit: 200000, source: "policy", period: "reset", since: null });
    expect(runAllowance({ settings, grantAllowance: 200000, run_id: "r-1" })).toEqual({ base: 200000, extra: 0, allowance: 200000 });
  });

  it("a daily window starts at local midnight, or at a later reset", () => {
    let settings = change(defaultAllowances(), { action: "fleet", limit: 300000, period: "day" }).settings;
    expect(fleetWindow({ settings, policyFleetAllowance: 200000, now: NOW })).toMatchObject({ limit: 300000, source: "settings", since: startOfLocalDay(NOW) });
    settings = change(settings, { action: "fleet-reset" }).settings;
    expect(fleetWindow({ settings, policyFleetAllowance: 200000, now: NOW }).since).toBe(NOW);
    // The next day, midnight is later than yesterday's reset.
    const tomorrow = "2026-09-20T15:00:00.000Z";
    expect(fleetWindow({ settings, now: tomorrow }).since).toBe(startOfLocalDay(tomorrow));
  });

  it("tops up a run, resets it to a fresh allowance, and never double-adds a retried command", () => {
    let settings = defaultAllowances();
    settings = change(settings, { action: "run-add", run_id: "r-1", amount: 50000, command_id: "c-1" }).settings;
    const retried = change(settings, { action: "run-add", run_id: "r-1", amount: 50000, command_id: "c-1" });
    expect(retried.repeated).toBe(true);
    expect(runAllowance({ settings: retried.settings, grantAllowance: 200000, run_id: "r-1" }).allowance).toBe(250000);
    settings = change(settings, { action: "run-reset", run_id: "r-1" }, { usedFor: () => 284243 }).settings;
    expect(runAllowance({ settings, grantAllowance: 200000, run_id: "r-1" })).toEqual({ base: 200000, extra: 284243, allowance: 484243 });
  });

  it("a task default replaces the grant's base; a grant with no ceiling stays without one", () => {
    const settings = change(defaultAllowances(), { action: "task", limit: 120000 }).settings;
    expect(runAllowance({ settings, grantAllowance: 200000, run_id: "r-1" }).allowance).toBe(120000);
    expect(runAllowance({ settings: defaultAllowances(), grantAllowance: null, run_id: "r-1" }).allowance).toBeNull();
  });

  it("refuses invalid amounts, unknown runs and unknown actions", () => {
    expect(change(defaultAllowances(), { action: "fleet", limit: -1 }).ok).toBe(false);
    expect(change(defaultAllowances(), { action: "fleet", limit: 1.5 }).ok).toBe(false);
    expect(change(defaultAllowances(), { action: "run-add", run_id: "r-x", amount: 10 }, { knownRun: () => false }).ok).toBe(false);
    expect(change(defaultAllowances(), { action: "run-add", run_id: "r-1", amount: 0 }).ok).toBe(false);
    expect(change(defaultAllowances(), { action: "drop-table" }).ok).toBe(false);
  });

  it("overlays the policy and grant without mutating either", () => {
    const settings = change(change(defaultAllowances(), { action: "fleet", limit: 400000 }).settings, { action: "run-add", run_id: "r-1", amount: 1000 }).settings;
    const policy = Object.freeze({ policy_revision: 2, concurrency: Object.freeze({ maxWriters: 1, fleetAllowance: 200000 }) });
    const grant = Object.freeze({ grant_id: "g", revocation_version: 0, resource_policy: Object.freeze({ unit: "tokens", allowance: 200000, strict: false }) });
    expect(effectivePolicy(policy, { settings, now: NOW }).concurrency.fleetAllowance).toBe(400000);
    expect(effectiveGrant(grant, { settings, run_id: "r-1" }).resource_policy).toEqual({ unit: "tokens", allowance: 201000, strict: false });
    expect(policy.concurrency.fleetAllowance).toBe(200000);
    expect(grant.resource_policy.allowance).toBe(200000);
    expect(effectiveGrant(grant, { settings, run_id: "r-2" })).toBe(grant);
  });

  it("round-trips the file and reports a corrupt one instead of trusting it", () => {
    const root = mkdtempSync(join(tmpdir(), "era-allowances-"));
    dirs.push(root);
    expect(readAllowances({ root })).toMatchObject({ ok: true, error: null });
    const settings = change(defaultAllowances(), { action: "fleet", limit: 300000, period: "day" }).settings;
    writeAllowances({ root, settings });
    expect(readAllowances({ root }).settings.fleet).toEqual({ limit: 300000, period: "day" });
    expect(JSON.parse(readFileSync(join(root, ALLOWANCES_REL), "utf8")).history).toHaveLength(1);
    mkdirSync(join(root, ".delivery", "v2"), { recursive: true });
    writeFileSync(join(root, ALLOWANCES_REL), "{ not json");
    const broken = readAllowances({ root });
    expect(broken.ok).toBe(false);
    expect(broken.settings.fleet.limit).toBeNull();
  });
});

describe("usage window", () => {
  it("counts only readings observed from the window start; open reservations always count", () => {
    const store: Loose = {
      listJobs: () => [{ job_id: "j-1", reservation_open: 1, reservation_unit: "tokens", reservation_amount: 50000, status: "running" }],
      listUsageReadings: () => [
        { input: 100000, output: 1000, unit: "tokens", observed_at: "2026-09-18T10:00:00.000Z" },
        { input: 20000, output: 500, unit: "tokens", observed_at: "2026-09-19T10:00:00.000Z" },
      ],
    };
    expect(resourceSummary(store, { unit: "tokens" })).toMatchObject({ settled: 121500, reserved: 50000 });
    expect(resourceSummary(store, { unit: "tokens", since: "2026-09-19T00:00:00.000Z" })).toMatchObject({ settled: 20500, reserved: 50000 });
  });
});

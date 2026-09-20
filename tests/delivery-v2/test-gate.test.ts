// Owner test gate: after an Apply leaves files written, a new delivery waits for
// the owner's laptop test result; a failure proceeds only with an explicit override.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { gateState, readTestGate, recordTestResult } from "../../scripts/delivery-v2/test-gate.mjs";

type Loose = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const app = (id: string, state: string, at = "2026-09-19T15:20:00.000Z") => ({ application_id: id, run_id: "r-1", state, created_at: at, updated_at: at });
let roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});
const tempRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "era-gate-"));
  roots.push(root);
  return root;
};

describe("owner test gate", () => {
  it("stays open with no applications, or only rolled-back and refused ones", () => {
    expect(gateState({ applications: [], records: [] }).locked).toBe(false);
    expect(gateState({ applications: [app("a-1", "rolled-back"), app("a-2", "conflict")], records: [] }).locked).toBe(false);
  });

  it("locks after an Apply and unlocks on a passed result", () => {
    const root = tempRoot();
    const applications = [app("a-1", "applied")];
    expect(gateState({ applications, records: [] })).toMatchObject({ locked: true, application: { application_id: "a-1" } });
    const outcome: Loose = recordTestResult({ root, applications, change: { application_id: "a-1", result: "passed", command_id: "c-1" }, actor: "owner", now: "t" });
    expect(outcome).toMatchObject({ ok: true, state: { locked: false } });
    expect(recordTestResult({ root, applications, change: { application_id: "a-1", result: "passed", command_id: "c-1" }, actor: "owner", now: "t" })).toMatchObject({ repeated: true });
    expect(readTestGate({ root }).records).toHaveLength(1);
  });

  it("keeps a failed result locked until the owner explicitly proceeds", () => {
    const root = tempRoot();
    const applications = [app("a-1", "checks-failed")];
    expect(recordTestResult({ root, applications, change: { application_id: "a-1", result: "failed" }, actor: "owner", now: "t" })).toMatchObject({ ok: true, state: { locked: true } });
    const override: Loose = recordTestResult({ root, applications, change: { application_id: "a-1", result: "failed", proceed: true }, actor: "owner", now: "t2" });
    expect(override.state).toMatchObject({ locked: false, record: { result: "failed", proceed: true } });
  });

  it("asks again after the next Apply and refuses results for an older one", () => {
    const root = tempRoot();
    const first = [app("a-1", "applied", "2026-09-19T15:00:00.000Z")];
    recordTestResult({ root, applications: first, change: { application_id: "a-1", result: "passed" }, actor: "owner", now: "t" });
    const second = [...first, app("a-2", "applied", "2026-09-19T16:00:00.000Z")];
    expect(gateState({ applications: second, records: readTestGate({ root }).records })).toMatchObject({ locked: true, application: { application_id: "a-2" } });
    expect(recordTestResult({ root, applications: second, change: { application_id: "a-1", result: "passed" }, actor: "owner", now: "t" }).ok).toBe(false);
    expect(recordTestResult({ root, applications: second, change: { application_id: "a-2", result: "maybe" }, actor: "owner", now: "t" }).ok).toBe(false);
  });
});

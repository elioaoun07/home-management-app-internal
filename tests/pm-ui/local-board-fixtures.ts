import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import type {
  UatHandover,
  V2Plan,
  V2Question,
} from "../../scripts/pm/app/types";

export const epoch = Date.parse("2026-11-15T12:00:00Z");
export const at = (seconds: number) =>
  new Date(epoch + seconds * 1000).toISOString();
export const row = (
  seconds: number,
  kind: string,
  summary: string,
  seq = seconds,
) => ({ at: at(seconds), kind, summary, seq, job_id: "native" });
export function boardRun(changes: Partial<LocalRunView> = {}): LocalRunView {
  return {
    run_id: "local-board-fixture",
    phase: "building",
    workspace: "C:/fixture",
    branch: "delivery/R123",
    head: null,
    current_head: null,
    canShip: false,
    canUndo: false,
    interrupted: false,
    work: { id: "R123", title: "Board fixture" },
    activity: [row(0, "status", "Native session started")],
    checks: [],
    usage: null,
    handover: null,
    ...changes,
  };
}
export const passedChecks = (): LocalRunView["checks"] =>
  ["typecheck", "lint", "test", "pm:lint"].map((name, index) => ({
    name,
    exit: 0,
    error: null,
    stdout: "",
    stderr: "",
    started_at: at(10 + index),
    finished_at: at(11 + index),
  }));
export function handover(accepted = false): UatHandover {
  return {
    handover_id: "handover-fixture",
    revision: 1,
    revisions: 1,
    status: "ready",
    subject: {
      type: "run",
      run_id: "local-board-fixture",
      delivery_ref: "local:fixture",
      work_id: "R123",
      campaign: null,
      title: "Board fixture",
    },
    binding: { kind: "candidate", source_revision: "candidate-a" },
    environment: { target: "local", build: null, url: null, device: null },
    created_at: at(20),
    summary: "Recorded summary",
    setup: "",
    limits: "",
    problems: [],
    counts: {
      pass: accepted ? 1 : 0,
      fail: 0,
      blocked: 0,
      pending: accepted ? 0 : 1,
    },
    availability: { state: "available", evidence: null },
    stale: false,
    acceptance: { state: accepted ? "accepted" : "pending", shipped: false },
    signoff: null,
    signable: true,
    blockers: [],
    feedback: [],
    draft: null,
    staleDraft: false,
    draftRev: 0,
    supersededBy: null,
    scenarios: [
      {
        id: "scenario-a",
        title: "Recorded scenario",
        required: true,
        result: accepted ? "pass" : "pending",
        draft: false,
        purpose: "",
        criteria: [],
        setup: "",
        starting: "",
        steps: [{ action: "Open", expected: "Visible" }],
        defect: null,
        cleanup: "",
        limits: null,
        receipt: null,
        attempts: 0,
      },
    ],
  };
}
export function futurePlan(status = "proposed"): V2Plan {
  return {
    plan_id: "plan-fixture",
    revision: 1,
    status,
    malformed: false,
    body: {
      outcome: "Recorded outcome",
      scope: [],
      steps: [],
      risks: [],
      unknowns: [],
      checks: [],
      questions: [],
    },
    raw_text: null,
    digest: "fixture",
    contract_revision: 1,
    created_at: at(1),
  };
}
export function futureQuestion(
  id: string,
  blocking = false,
  status = "open",
): V2Question {
  return {
    question_id: id,
    plan_revision: 1,
    stage: "build",
    text: "Choose deployment?\nOptions:\nA. Local (Recommended)\nB. Hosted",
    blocking,
    status,
    answer: null,
  };
}

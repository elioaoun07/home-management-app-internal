import type { V2RunDetail } from "../../../scripts/pm/app/types";

/** Synthetic DLV-107-shaped run. No recorded result here is owner acceptance. */
export function deliveryReviewFixture(): V2RunDetail {
  const at = "2026-09-14T16:10:00Z";
  const plan = {
    outcome:
      "Correct the completed-item fallback so “See what changed” opens the campaign’s story for shipped and discarded receipts.",
    scope: ["scripts/pm/app/Work.tsx"],
    steps: [
      {
        title:
          "Change the fallback link from `view=story` to SpaceView’s existing `tab=story` contract.",
      },
      {
        title:
          "Preserve `spacePath(campaign)` so spaces and `&` stay encoded correctly.",
      },
      {
        title: "Verify the link for synthetic shipped and discarded receipts.",
      },
      { title: "Confirm Board and List navigation remains unchanged." },
    ],
    checks: [
      "Shipped and discarded links open Story.",
      "Campaigns with spaces and & resolve correctly.",
    ],
    risks: ["Existing links must keep the campaign identity."],
    unknowns: [],
    questions: [],
  };
  return {
    ok: true,
    engine: "v2",
    run: {
      run_id: "r-uat-preview",
      lifecycle: "CLOSED",
      closed_outcome: "verified_candidate",
      waiting_reason: null,
      created_at: at,
      updated_at: at,
    },
    work: {
      title: "Open completed items in campaign history",
      alias: "DLV-107",
      file: "Delivery/4 - Checklist.md",
      campaign: "Delivery",
    },
    contract: {
      contract_id: "contract-preview",
      revision: 1,
      requestedDisposition: "candidate",
    },
    settings: {
      executor: "codex",
      backend_id: "codex-exec-sdk",
      model: "gpt-5.6-luna",
      effort: "low",
      work_profile: "focused",
      qualification_ref: null,
      history: [],
    },
    stage: {
      stages: ["Plan", "Build", "Check", "Review"],
      current: 3,
      branch: null,
    },
    plans: [
      {
        plan_id: "plan-preview",
        revision: 1,
        status: "approved",
        malformed: false,
        body: plan,
        raw_text: JSON.stringify(plan, null, 2),
        digest: "sha256:synthetic-plan",
        contract_revision: 1,
        created_at: at,
      },
    ],
    questions: [],
    messages: [],
    jobs: [
      {
        job_id: "j-preview",
        purpose: "implement",
        access: "write",
        backend_id: "codex-exec-sdk",
        status: "complete",
        outcome: "completed",
        dispatched: true,
        native_ref: "thread-preview",
        stop: null,
        requested: { model: "gpt-5.6-luna", effort: "low" },
        effective: null,
        reservation: { unit: "tokens", amount: 50000, open: false },
        reason: null,
        created_at: at,
      },
    ],
    agents: [
      {
        role: "main",
        id: null,
        executor: "codex",
        model: "gpt-5.6-luna",
        lastAction: "Updated the history fallback",
        lastAt: at,
      },
    ],
    activity: [
      {
        job_id: "j-preview",
        at,
        kind: "command",
        agent: { role: "main" },
        summary: 'rg -n "view=story|tab=story" scripts/pm/app/Work.tsx',
      },
      {
        job_id: "j-preview",
        at,
        kind: "message",
        agent: { role: "main", executor: "codex" },
        summary:
          "Updated the history fallback in `Work.tsx`.\n\n- Preserved campaign encoding.\n- Verified shipped and discarded navigation.",
      },
    ],
    candidate: {
      candidate_id: "cand-preview",
      generation: "C1",
      changed: [{ path: "scripts/pm/app/Work.tsx", kind: "update" }],
      refusals: [],
    },
    candidates: [
      {
        candidate_id: "cand-preview",
        generation: "C1",
        changed: [{ path: "scripts/pm/app/Work.tsx", kind: "update" }],
        created_at: at,
      },
    ],
    applications: [
      {
        application_id: "app-preview",
        candidate_id: "cand-preview",
        result_ref: "result-preview@5",
        state: "rolled-back",
        revision: 3,
        writes: 1,
        ops: [],
        conflicts: [],
        refusals: [],
        unrelatedDrift: [],
        migrationPaths: [],
        checks: null,
        failed: null,
        rollback: {
          restored: ["scripts/pm/app/Work.tsx"],
          deleted: [],
          recreated: [],
          foreign: [],
        },
        inspected: null,
        created_at: at,
        updated_at: at,
      },
    ],
    evidence: [
      "dlv107-existing-pm-regression",
      "dlv107-history-navigation",
    ].flatMap((id) => [
      {
        criterion_id: id,
        criterion_revision: 1,
        state: "inconclusive",
        reason: "malformed-observation",
        label: "inconclusive",
        counts: { selected: null, executed: null, skipped: 0 },
        exitCode: 0,
        runner: "Protected checker",
        command: null,
        output: "Output not retained",
        created_at: at,
      },
      {
        criterion_id: id,
        criterion_revision: 1,
        state: "satisfied",
        reason: null,
        label: "satisfied",
        counts: { selected: 6, executed: 6, skipped: 0 },
        exitCode: 0,
        runner: "Protected checker",
        command: ["node", "history-check.mjs"],
        output: "Output not retained",
        created_at: "2026-09-14T19:08:49Z",
      },
    ]),
    result: {
      result_id: "result-preview",
      result_version: 5,
      candidateVerified: true,
      workComplete: true,
      observedDisposition: "candidate",
      requestedDisposition: "candidate",
      closed_outcome: "verified_candidate",
      remaining_obligations: [],
      next_safe_action: "apply",
      projection_status: "complete",
      projection_reason: null,
    },
    resources: {
      unit: "tokens",
      settled: 284243,
      reserved: 0,
      unknown: [],
      openReservations: 0,
      provenance: {
        providerReportedUsd: null,
        measuredTokens: { input: 281732, output: 2511, total: 284243 },
        reconciledBilled: null,
        subscriptionUsage: null,
        availableQuota: null,
      },
      allowance: 200000,
      strict: false,
      thresholdUsd: null,
    },
    ownerAction: { kind: "apply", label: "Apply" },
    events: [],
  };
}

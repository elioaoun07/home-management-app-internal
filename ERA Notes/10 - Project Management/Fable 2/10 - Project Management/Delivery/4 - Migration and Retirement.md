---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Proposed sequence; no step is started."
---

# Delivery — migration to the Local lane and what to retire

[Fable 2 index](<../../_index.md>) · [Diagnosis](<1 - Diagnosis.md>) · [Local lane design](<2 - Local Lane Design.md>) · [Gate disposition](<3 - Gate Disposition.md>) · [Supervisor contract](<5 - Supervisor Contract.md>)

## Sequence

Each step is useful alone and reversible. Nothing is deleted until the Local lane has delivered real items.

| Step | Outcome | Item | Exit evidence |
|---|---|---|---|
| L0 | Hard Rule 26's tool deny list matches every tool namespace, and the service-role key no longer sits in a file an agent's shell reads by default | [R84](<../../../PM Tooling/PM Tooling — Master Book.md#r84>) | A cloud session and a local session both refuse a Supabase write tool |
| L1 | A Local run exists end to end from the CLI: worktree, scrubbed environment, native session with repo skills, host checks, recorded result | [DLV-150](<../../../Delivery/Delivery — Master Book.md#dlv-150>) | One small non-risk item built on a branch with a host check receipt |
| L2 | Start needs three checks and no pairing on loopback; the launch screen shows one button | [DLV-151](<../../../Delivery/Delivery — Master Book.md#dlv-151>) | Fresh browser on `127.0.0.1` reaches a running session in one click |
| L3 | Guardrails are code: environment allowlist, risk-domain classifier, review hold | [DLV-152](<../../../Delivery/Delivery — Master Book.md#dlv-152>) | A diff touching `src/lib/balance.ts` cannot be shipped before review; a UI-only diff can |
| L4 | Ship merges after UAT sign-off; `main` is protected; Undo is a revert | [DLV-153](<../../../Delivery/Delivery — Master Book.md#dlv-153>) | One item shipped and one reverted through the Command Center |
| L5 | A disposable development database for agents and UAT | [DLV-154](<../../../Delivery/Delivery — Master Book.md#dlv-154>) | The worktree build runs against non-production data |
| L6 | After five items shipped through the Local lane, retire what the confined path alone needs | [DLV-155](<../../../Delivery/Delivery — Master Book.md#dlv-155>), DLV-103, R6 | Line counts below drop; suites stay green |

L0 does not depend on anything and should go first. L1–L4 are one coherent programme; L5 can run in parallel.

## What becomes removable at L6

| Surface | Size at 8da80ae | Used by |
|---|---|---|
| Delivery V1 engine, `scripts/delivery/` | 16,584 lines | Still imported by `scripts/pm-server.mjs`, `scripts/pm/bridge.mjs` and three V2 modules. V1 is frozen; DLV-103 already owns retirement |
| Container boundary, qualification, checker staging, compiler pinning (`worker-boundary`, `runtime-image`, `qualification`, `stage-checker-environment`, `setup-checker-deps`, `dependency-environment`, `compiler-*`, `checker-*`, `probes/`, `worker/`) | 5,203 lines (2,570 in the top-level modules, 2,633 in `probes/` and `worker/`) | Confined V2 only |
| Policy, authorization, allowances, coordination reservations | 2,157 lines (`policy`, `authorization`, `allowances`, `coordination`) | Confined V2 only |
| Classic Preact UI: `scripts/pm/client.js`, `styles.css`, `body.html` | 6,940 lines | `?ui=classic` fallback; R6 owns the retirement check |
| Second UI generation, `scripts/pm/src/` | 4,165 lines, 69 files | Built by `scripts/pm/build.mjs`; the default app is `scripts/pm/app/` |
| Tests that exist only for the above | a large share of the 117 files in `tests/delivery` and `tests/delivery-v2` | Follow the code they test |

Do not delete the confined path before the owner confirms unattended or phone-started delivery is no longer wanted. If it is still wanted, keep it frozen and stop extending it.

## Risks of the change

| Risk | Mitigation |
|---|---|
| An agent reads production keys from the main checkout | Key out of the repo directory (L0), environment allowlist (L3), dev database (L5). Stated residual risk until L5 |
| A risk-domain change slips through because its path is not on the list | The list is versioned in one file with a test per domain; any route importing `supabaseAdmin` is matched by content, not path |
| Two worktrees edit the same file | Surfaced as a merge conflict at Ship; `Touches` overlap is shown at Start |
| The agent's own checks pass but the suite fails | The supervisor's host run is the recorded result, and CI runs again on merge |
| Local lane work lands without a PM trace | Ship writes the Shipped Log entry and sweeps the checklist line (Hard Rule 25) |
| Effort drifts back into tooling | Convention §6 already limits consecutive meta-only sessions; L1–L4 name the product outcome they unblock: draining the backlog in [Backlog Health](<../Portfolio/Backlog Health.md>) |

## Owner decisions still needed

1. Confirm the worktree location (outside the repository directory is recommended so editors and watchers do not index it).
2. Choose the development database option for L5 (hosted second project recommended).
3. Say whether phone-started delivery is still a goal. That alone decides whether the confined path is frozen or retired.
4. Turn on branch protection for `main` when L4 lands.

---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Proposed dispositions for the Local lane only; the confined V2 path keeps every mechanism."
---

# Delivery — gate disposition for the Local lane

[Fable 2 index](<../../_index.md>) · [Diagnosis](<1 - Diagnosis.md>) · [Local lane design](<2 - Local Lane Design.md>) · [Migration](<4 - Migration and Retirement.md>) · [Supervisor contract](<5 - Supervisor Contract.md>)

**Keep** = still blocks. **Advisory** = shown, never blocks. **Drop** = not evaluated in the Local lane.

## Launch gates (`scripts/delivery-v2/readiness-contract.mjs:3`)

| Gate | Local lane | Reason |
|---|---|---|
| policy | Drop | Replaced by four fixed guardrails in code, not an installed, revisioned, expiring document |
| selection | Keep, simplified | Executor, model and effort are still chosen per run; validate against the installed catalogue only |
| source | Keep, simplified | Base branch known and working tree clean. No frozen source or check-input bindings |
| coordination | Advisory | Show overlapping `Touches` and other open branches; git reports real conflicts at Ship |
| runtime | Drop | No image, no confinement binding |
| authentication | Keep | The subscription CLI is signed in and no API key is present |
| modelAvailability | Advisory | A wrong model fails in seconds at session start; a pre-flight probe is not worth a gate |
| environment | Keep, simplified | `node_modules` matches the lockfile in the worktree. No managed receipt, no pinned compiler program |
| qualification | Drop | Nothing to qualify without a boundary |
| checks | Drop as a gate | The supervisor runs the repo's own commands afterwards; they do not need pinning beforehand |
| budget | Advisory | Show usage and warn at a threshold; subscription limits are the hard stop |

Three checks remain blocking at Start: **source**, **authentication**, **environment**. Tracked as [DLV-151](<../../../Delivery/Delivery — Master Book.md#dlv-151>).

## Everything around the gates

| Mechanism | Local lane | Reason |
|---|---|---|
| Browser pairing on loopback | Drop | The server binds `127.0.0.1`; a second factor on the same machine protects nothing the worktree boundary does not. Keep pairing for LAN and relay access |
| Execution policy revisions, grants, expiry, renewal receipts | Drop | See policy gate |
| Plan approval before code | Advisory by default, **Keep** for risk-domain items | The owner chose review for money, recurrence, auth/RLS and migrations only |
| One-job and repair limits | Drop | The agent iterates until its own checks pass or it stops |
| `Touches` reservation and writer slots | Advisory | Worktrees isolate; merges arbitrate |
| Fleet and per-run token allowances | Advisory | A lifetime allowance has already queued a run forever once (2026-09-15) |
| Container worker and separate checker | Drop | See [Diagnosis](<1 - Diagnosis.md>) |
| Typecheck inside the protected checker (DLV-133) | Drop | Host typecheck after the agent stops |
| Candidate tests requirement (`requireTests`) | Keep | A change with no test evidence is reported as not tested, as today |
| Quiesce, export, freeze, frozen diff | Drop | The branch is the candidate |
| Protected Apply and rollback journal | Drop | Merge and `git revert` |
| Owner test gate | Merge into UAT | One acceptance step instead of two |
| UAT handover scenarios and wizard | Keep | The owner's stated flow is deliver → UAT → ship |
| Shipped only on explicit sign-off | Keep | Unchanged |
| Pre-launch readiness report | Drop | Three checks do not need a report contract |
| Live activity, cancel, attempt history, token display | Keep | Unchanged |
| Environment scrub and tool deny rules | **New, Keep** | [DLV-152](<../../../Delivery/Delivery — Master Book.md#dlv-152>), [R84](<../../../PM Tooling/PM Tooling — Master Book.md#r84>) |
| Risk-domain path classifier | **New, Keep** | [DLV-152](<../../../Delivery/Delivery — Master Book.md#dlv-152>) |
| Branch protection on `main` | **New, Keep** | [DLV-153](<../../../Delivery/Delivery — Master Book.md#dlv-153>) |

## Existing open Delivery items under this direction

Proposed only. The checklist is unchanged; the owner decides each one.

| Item | Proposed disposition | Why |
|---|---|---|
| DLV-133 Typecheck inside the protected checker | Park | Only the confined path needs it |
| DLV-137 One readiness result (held on DLV-133) | Replace with DLV-151 for Local; park the rest | Eleven gates collapse to three |
| DLV-118 Runnable checks and bounded context for Fast lane | Close as superseded once DLV-150 delivers one item | The Local lane is the fast lane |
| DLV-114 Token ceiling during a native job | Park | Already advisory for supervised use |
| DLV-111 Refresh sign-ins before unattended launches | Park | Not a supervised concern |
| DLV-113 Revise a checked candidate | Close as superseded | On a branch the session simply continues |
| DLV-121 Page frozen diffs | Park | No frozen diffs in the Local lane |
| DLV-109, DLV-122 Live activity, cancel | Keep | Both carry over |
| DLV-117 Recommend model and effort per item | Keep, and feed it from [Model Tiers](<../../Model Tiers/_Routing.md>) | Tier routing is now written down per item |
| DLV-146 Worker emits the structured UAT handover | Keep, raise | UAT is the centre of the relaxed flow |
| DLV-52, DLV-84 Type and hook-dependency debt | Keep | Independent of the lane |
| DLV-103 Retire V1 | Raise | 16,584 lines kept alive for a frozen path ([Migration](<4 - Migration and Retirement.md>)) |

---
created: 2026-09-20
updated: 2026-09-20
type: plan
status: draft
owner: Elio
evidence_cutoff: "2026-09-20; source 6342346b, policy revision 6, read-only local runtime inspection"
---

# Delivery Optimization Closeout

## Decision and ownership

**The optimization code is installed locally, but savings and reliable end-to-end operation are not yet demonstrated.** Finish the major reliability gaps and run one controlled real-task comparison. Do not start another broad optimization project.

This is the owner's requested draft, not authorization to launch workers, change policy, declare acceptance or publish. [Delivery's checklist](<../Delivery/4 - Checklist.md>) remains the execution backlog; [owner UAT](<../../../docs/Delivery-UAT.md>) owns manual results. The existing [consumption plan](<../Research/Delivery — Consumption Optimization Plan.md>) and [Delivery V2](<Delivery V2.md>) retain their contracts. This document supplies the current delta and a concrete test sequence. No new campaign IDs are needed.

Scope: major consumption, recovery, verification and delivery-path failures. Minor UI adjustments, guide cleanup, historical backfill and model tuning are deferred. One successful trial supports a bounded adoption decision; it cannot establish that all delivery modes have no defects.

## What is already done

| Earlier concern | Evidence checked now | Disposition |
|---|---|---|
| Optimization exists only in the working tree | Commits `6ef7a107`, `974b8cae`, `6342346b`; initial working-tree change was the activation receipt in the Master Book | Resolved for the implementation |
| Old worker prevents activation | Docker lists `era-delivery-v2-worker:subscriptions`, built 2026-09-20 13:36 +03, image `749107ee3705`; installed policy revision 6 pins its full digest | Rebuild completed |
| Executor requalification missing | New Claude `qr-fc129a00756e` and Codex `qr-27bb9b3ac48e` receipts bind boundary `9993ae2a…`, with required controls verified | Completed; recheck readiness at launch |
| Subscription windows with missing identities produce a false delta | `subscription-window.mjs:126–146` rejects missing identities, differing resets and decreasing readings; current tests pass | Fixed; shared percentages still do not measure exact job consumption |
| Profile propagation, compact briefs and prepared plans missing | Current `task-input.mjs`, `policy.mjs:991`, `entry.mjs:567`, `journey.mjs:1127`; focused/brief/instruction fixtures pass | Implemented; live behavior pending |

The Master Book's activation receipt records a supervisor restart, no bridge start and no phone deployment. Docker/image and receipt files were independently inspected; a fresh provider readiness probe and device verification were not performed in this review.

**Fresh verification:** 147 tests passed across `task-input`, `focused-delivery`, `task-brief-boundary`, `worker-task-brief`, `instructions`, `usage-normalization`, `subscription-window`, `typecheck`, `verification-gate` and `journey`. These are deterministic tests, not new provider jobs or a real compiler/device run. Structural graph evidence is in `.tmp/delivery-optimization-review/`; it is navigation evidence only.

## Major gaps and order of work

| Priority / owner | Missing outcome | Required evidence |
|---|---|---|
| 1 — DLV-118; owner trials DLV-98/99/102 | **An actually runnable optimized task and measured savings.** Local store still has three closed runs, four old jobs, zero prepared plans and zero subscription observation records. No Master Book has a prepared-plan block. Policy 6 still snapshots BUD-83 transaction files and runs split-bill checks; it cannot certify the proposed Kitchen task. | Prepare the exact trial scope, source closure and independent checks; demonstrate prepared eligibility before launch; execute the comparison below. Reuse the completed worker activation. |
| 2 — DLV-108 | **Recovery after a job has finished.** `journey.mjs:1245–1250` releases the worker before `afterJob`; `store.mjs:786–790` scans only reserved/active/paused/unknown jobs. A crash between terminal settlement and plan/result creation remains outside that recovery scan. The existing active-job recovery test does not prove this boundary. | Durable, idempotent completion transition; inject failures before/after settlement, cleanup, plan creation, candidate freeze and result recording, reopen the store, reconcile twice. Exactly one plan/candidate/result transition, no new provider dispatch, no doubled usage. Retain output until durable recovery succeeds. Required before unattended/restart-safe acceptance. |
| 3 — DLV-114, with DLV-109 for visible progress | **Consumption can still overrun during a job.** Installed policy is `strict: false`, with a 200,000-token allowance and 50,000-token reservation. `journey.mjs:383–395` explicitly reports Codex turn limits unsupported. Admission thresholds and reservations are not an in-job token ceiling. | Qualified readings/stop behavior for the selected provider, observed termination, preserved partial artifacts and no automatic redispatch. Requested hard caps refuse where a whole-job bound is unavailable. Do not label an observed stop with possible overshoot a hard cap. Clear activity/last-observed status and a tested owner Stop path support supervised operation. |
| 4 — DLV-133 and DLV-120; DLV-113 for revision | **The failure path is incomplete.** Typecheck defaults to host `spawnSync` (`typecheck.mjs:255–303`, `journey.mjs:317`); ordinary protected-check output is hashed, not retained (`checks.mjs:503–526`). Guidance on a checked candidate still lacks the bounded revision workflow described by DLV-113. | Compile baseline/candidate with the complete pinned program and dependencies in the checker; retain bounded redacted diagnostic output; demonstrate one intentional failure and one successful control. A failed candidate has a clear next action and retains its evidence. Until DLV-113 lands, close/export and explicitly authorize a successor; do not expect queued Guidance or Recheck to create another implementation. |
| 5 — DLV-104 UAT, DLV-111; DLV-122 for waiting-run control | **Real phone and interrupted-operation acceptance remains pending.** Bridge and phone bundle were not activated by the rebuild. The waiting-run screen still lacks its cancel action; unattended credential renewal remains partly implemented. | Owner-managed relay setup/deployment, phone launch/review/approval/Apply and reconnect replay with stable command IDs; waiting-run cancellation releases reservations without dispatch; expired/revoked sign-in refuses with a reconnect action. Agents do not start a production-writing bridge or apply relay SQL (Hard Rule 26). |

Implementation order for a full closeout: recovery → checker isolation/diagnostics → consumption stop and activity → bounded revision/waiting controls → real trial → phone/expiry acceptance. Implement narrow slices under existing IDs; do not rebuild completed interfaces.

A **supervised measurement-only trial** can precede some reliability fixes only with explicit acceptance of the remaining limitations and an owner-supplied threshold/wall-time/stop policy. It proves neither a hard cap nor unattended operation. If a hard token ceiling is required for the trial, DLV-114 qualification is a launch prerequisite. Never silently weaken strict mode or enlarge allowances to make the experiment finish. DLV-118's existing DLV-114/117 dependencies remain; a small experiment does not complete that umbrella item.

Not major blockers for this experiment: DLV-134 historical backfill (keep its inferred acceptance unapproved; use fresh readings), DLV-123 cosmetic defects, DLV-121 historical artifact paging, mass advisory-guide migration, broad model recommendation tuning. Existing binding Reading guides are a conservative compatibility rule, not a reason to rewrite 237 items. Freeze the trial's source text during each arm. Full DLV-117 acceptance is separate from recording an explicit qualified selection for this test.

## Real delivery test: KIT-11 cooking count

**Proposed task:** [KIT-11 — Return the correct cooking count](<../Kitchen/Kitchen — Master Book.md#kit-11>), still open and unfixed at this cutoff. `src/app/api/recipes/[id]/cooking-log/route.ts:116–124` requests `{ count: "exact", head: true }`, then reads `data.length` and falls back to 1. This is meaningful product work with a small observable result: a recipe with several cooking logs should not keep showing one cook.

Use this same task for both arms. Do not use BUD-83 (money-sensitive, excluded from the prepared path), DLV-134 (unapproved inferred acceptance), a completed item, or Delivery infrastructure (protected Apply paths). KIT-11 is a **candidate**, not yet declared eligible: it lacks declared Touches, a reviewed prepared block and runnable trusted checks. If preparation finds broader behavior or unresolved risk, stop the prepared experiment and retain the normal staged workflow; never remove risk words to evade screening.

### Preparation, before spending model tokens

1. Recheck that KIT-11 remains open and the defect exists. Agree the narrow contract: use count metadata; valid zero stays zero; null/missing/error must not overwrite a known count with a fabricated value. Preserve the existing cooking-log write and unrelated recipe fields. Proposed error behavior for owner review: retain the already-successful log response and omit an unknown count update, avoiding a retry that creates a second log. If a different error contract is needed, resolve it before either run.
2. Prepare a trusted behavioral oracle against the **real route** with a stubbed Supabase client. Proposed artifact: `tests/delivery-oracles/kit11-cooking-count.mjs` (not created by this review). Verify count 4 with null body, count 0 with null body, missing count and error; include one-insert-only and unrelated-stat controls. The original source must fail the nonzero case and a temporary corrected control must pass. A regex asserting the patch's spelling is insufficient. No production data is read or written.
3. Add reviewed `Touches` for only `src/app/api/recipes/[id]/cooking-log/route.ts`. Prepare a task-specific policy revision: exact source/import closure, selected Kitchen section/checklist, pinned oracle/config and dependencies; publication restricted to that route; required behavioral criterion and typecheck. Keep trusted oracle files out of writer publication. Confirm the checker can load the real route and all imports. All `oracle_ref` files must exist in `checks.inputs` and the snapshot. The BUD-83 policy is not reusable as-is.
4. Draft the complete `delivery-plan-v1` material: outcome, acceptance, exact scope, steps, invariants, exclusions, criterion IDs, risks, empty unknowns/dependencies, low-risk review and provenance. Record `ownerReviewed: true` only after actual owner review. Keep the identical engineering specification available to both arms; only B uses the activating fence. Run `preparedPlanFor()` with real files/policy to verify eligibility before creating B. An ineligible result is **Blocked**, not permission to substitute a staged run and call it prepared.
5. Pin the code revision, source-file hashes, policy/checker inputs, worker image/SDK/boundary, criteria and selected provider/model/effort. Choose a currently qualified subscription entry explicitly and keep it fixed. No provider fallback. Owner records the per-run allowance, enforcement mode and stop/wall-time limits; no new amounts are inferred here. Charge all AI used for specification/oracle/preparation to the measurement ledger; record owner preparation minutes too.
6. Freeze the baseline before either attempt. Use separate native sessions and scratch with identical engineering inputs. Predeclare order **A then B** and record provider-cache/order effects as a limitation. Close/release A's reservation through supported controls after preserving its candidate/evidence, before B; do not delete its run. If input isolation cannot be established, the pair is invalid. Save policy before/after revisions so normal operation can be restored without overwriting later edits.

### Two runs, then one application

| Step | Owner action | Pass condition |
|---|---|---|
| A — corrected staged Focused | Work → Kitchen → KIT-11 → Deliver. Select recorded executor/model/effort and Focused. The specification is present as ordinary reviewed material, without the activating prepared fence. Review and approve its plan. | One planning job and one implementation job; zero automatic repairs. Same criteria pass. Preserve candidate A; do not Apply it. |
| Transition | Preserve A's receipts and close/release its scope. Adopt the same reviewed material as the prepared block for B before B's fresh selection. | Source implementation and oracle hashes unchanged. Contract fingerprints may differ because the source format differs; record both and verify identical behavioral obligations. B receives none of A's discovered fixes, conversation or candidate bytes. |
| B — prepared Focused | Open the same item and Deliver with identical settings. Inspect Plan before approval, then approve once. | Plan marked From task; `plan.job_id = null`; **zero jobs and no job reservation before approval**. After approval, exactly one implementation job and zero repairs. An unexpected planning job is a failed optimization test. |
| Both — verification | Inspect all criteria, counts, typecheck, scope and Changes. | Same behavioral acceptance; positive executed counts; no new compile errors or inconclusive verification; only the approved route changes. No model-run test/build/Git attempts; necessary targeted reads and brief use visible where telemetry permits. Missing telemetry stays unknown. |
| B — Apply | Review the successful candidate and explicitly Apply once, then refresh/check status. | Exact frozen bytes applied once; integrated checks pass; application identity and history survive refresh. Run the route oracle against integrated code. Use a stubbed/local test environment for the recipe-count display at desktop and about 390px; do not log real production cooking records for this test. |
| B — inverse | Rollback → review operations → Cancel; then preview again and confirm. | Cancel changes no files. Confirm restores exact before-image, keeps receipts and releases the candidate's reservation correctly. Run the baseline oracle and expect the original defect to return. |
| Final disposition | Choose whether to keep the verified fix. | Rollback success alone leaves KIT-11 unfixed. Restore it only through a freshly valid supported Apply/reverification path or reviewed manual integration; record final tests and actual disposition. Mark implementation shipped only when the corrected code is retained. Never repeatedly retry a refused old Apply. |

Keep the A/B measurement clean: perform repeat-command, stop, crash and deliberately failing-check drills separately on isolated fixtures/test installations. If an arm fails, retain all its tokens and evidence, stop the comparison and fix the blocker; do not silently retry until a cheap success appears. A legitimate new scope question fails prepared readiness and requires a separately authorized Investigate attempt.

### Measurement and decision sheet

Fill actual values after execution; all are **Pending** now.

| Observation | A staged | B prepared |
|---|---|---|
| Run / native session / source hashes / model / effort | Pending | Pending |
| Planning / implementation / repair jobs | Expected 1 / 1 / 0 | Expected 0 / 1 / 0 |
| Raw readings and normalization version/baseline | Pending | Pending |
| Fresh input / cached input / output / reasoning subset | Pending | Pending |
| Total normalized tokens, including attributable preparation and failures | Pending | Pending |
| AI requests, when observable; wasted tool calls separately | Pending | Pending |
| Wall time / checker time / owner preparation and review minutes | Pending | Pending |
| Subscription before/after, reset identity, other account use | Pending | Pending |
| Behavioral checks / typecheck / scope / owner review | Pending | Pending |
| Apply / integrated checks / rollback / final disposition | Candidate only | Pending |

Compute tokens as normalized **input + output**; cached input is a subset of input, reasoning a subset of output. Do not add either again or silently omit cached input. Retain raw counters and continuation baselines. Unknown normalization means the comparison cannot pass. The earlier 589,176 → 493,436 correction is accounting, not saved work.

Report workflow savings as `(A total − B total) / A total`, with a complete cost ledger. Count shared preparation consistently in both workflow scenarios; assign extra prepared-format work to B, never omit it. Also report actual combined experiment expenditure once. Show one-time preparation and repeated-use cost separately. Include failed attempts and any AI-assisted review. Do not equate token percentage with subscription allowance percentage; missing/reset/decreasing/coarse observations remain unavailable or descriptive, never zero-cost proof.

**Narrow optimization passes only if** B actually removes the planning job, both candidates satisfy the same acceptance, B reduces total normalized consumption including its extra preparation, and owner effort/failures do not worsen. Otherwise report no demonstrated benefit or an unresolved tradeoff. No arbitrary savings target is invented. One pair compares prepared versus corrected staged Focused; it does not isolate every earlier prompt optimization or prove savings across the backlog/providers. Keep default rollout narrow and assess later ordinary runs as total consumption across all attempts per successfully verified outcome.

## Reliability and phone acceptance after the comparison

| Drill / canonical ownership | Required result |
|---|---|
| DLV-108 — terminal-job restart, both adapters | Reopen isolated store at each terminal/post-processing boundary and reconcile twice: exactly-once transition, no extra native job, no doubled usage, artifacts recoverable. Never crash the owner's only useful run to discover this bug. |
| DLV-114/109 — stop and exhaustion | Script usage crossings, duplicate events, end-only counters and process loss; then a bounded real stop witness for the chosen provider. Report overshoot and observed container termination. Unsupported hard-cap mode refuses before dispatch. |
| DLV-133/120 — checker failure | Deliberate behavioral failure, zero tests, missing dependency and compile error remain distinct; readable retained diagnostics; Recheck adds checker evidence with no AI job. Stale candidate/check evidence cannot Apply. |
| DLV-113/122 — recovery actions | Recorded findings have a bounded explicit revision action or a clearly recorded successor; waiting-run Cancel/Stop releases only settled reservations, never invents an observed stop. Replayed commands do not launch twice. |
| DLV-104 UAT / DLV-111 — physical phone | After the owner confirms relay setup and current bundle deployment, exercise launch, plan review/approval and Apply from a phone on a separate real eligible task. Lose a command response, reconnect and resolve the same command ID; no duplicate job/Apply. Offline shows stale state and blocks writes. Expiry/revocation gives reconnect, never paid fallback. |
| DLV-118 — native context loss | Recover the exact brief/scope/plan after an observed native compaction or supported context-recovery witness. Pointer fixtures alone do not prove compaction. Do not spend tokens merely to force compaction in the small comparison; if absent, leave this specific claim unverified. |

Desktop savings, Apply reliability, enforced bounds, restart recovery, real phone operation and native compaction each receive their own PASS / FAIL / BLOCKED result in UAT. A desktop success cannot close the others. DLV-98's separate native baseline and DLV-102's broader operating-trial requirements also remain; this two-arm comparison does not replace them.

## Handoff and retirement

Next implementation session: start with DLV-108 and the checker evidence gaps, then prepare KIT-11's concrete oracle/policy/specification for review. Do not repeat activation unless source/image/binding changed. The owner starts the actual runs only after the launch packet states the exact task, qualified selection, limits, unresolved limitations and expected checks.

Record results in `docs/Delivery-UAT.md` and dated evidence under the existing campaign IDs. Archive this plan after the comparison and major-gap decisions are incorporated into the Master Book; keep failed/blocked observations and raw measurement references. Do not mark optimization complete merely because this draft or deterministic tests exist.

---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
plan_revision: "2.1"
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# PM Delivery — Current System Diagnosis

> **Evidence baseline retained; target updated to revision 2.1.** The D01–D18 source findings, artifacts and test receipt below belong to the original 2026-09-06 investigation. They were not rerun by the documentation refactor. The owner accepted the ownership reassessment; the current normative target is the [V2 Architecture](<PM Delivery — V2 Architecture.md>) and bounded [Execution Portfolio](<PM Delivery — Execution Portfolio.md>), not the earlier inner-effect core.

## 1. Finding and study scope

**V1 contains useful engineering assets, but its organizing boundaries do not support the desired autonomy.** Work is often identified by document position, authority by phase/gate name, proof by resolvable artifact references, and completion by several mutable files. The same missing identity and effect boundary recurs across selection, execution, billing, recovery, acceptance and mobile control.

The accepted target is a small delivery supervisor around qualified native jobs, isolated candidates, protected checks and explicit disposition. Preserve the useful V1 assets without owning the native engineering loop. Start reading [Target Product](<PM Delivery — Target Product.md>) for the experience, [V2 Architecture](<PM Delivery — V2 Architecture.md>) for the shared contracts and [Migration Strategy](<PM Delivery — Migration Strategy.md>) for the alternative comparison. The Execution Portfolio is ready for later bounded implementation; no stage or operational policy change was executed by this documentation task.

Research contract was read end to end: [ASTRA V2 brief](<../../../../../docs/ASTRA-PM-COMMAND-CENTER-V2=STUDY.md>). Baseline HEAD `d6e0260`, 2026-09-06. The brief was already modified at task start and has been preserved. `git diff --stat 3106164..HEAD -- scripts/delivery scripts/pm scripts/pm-server.mjs src/components/pm-live src/features/pm-live` returned no changes; previous ASTRA source findings were therefore still relevant, but were rechecked at the affected seams.

Orientation covered start-task, Feature Map, Design Doctrine, Delivery/PM Tooling Master Books and queues, Command Center's Architecture/Experience/Orchestration/Packets, Delivery and PM Tooling ASTRA studies, the 10x Portfolio and Contradiction Register. The Feature Map has no PM/Delivery entry; Master Books supplied the source router. Existing Graphify data contains older PM document relationships, not the current runtime map; it was used for orientation only.

Three parallel read-only audits covered runtime/evidence/history, context/providers/agents, and corpus/product/relay. Findings below distinguish source inspection, synthetic reproductions, historical local artifacts and proposals. No live DB, bridge, paid provider run or implementation was started. Browser/device behavior and live production configuration were not inspected.

## 2. What V1 actually is

V1 is a local agent runner attached to a Markdown-backed project application, with an outbound relay feeding a separate phone application.

| Part | Present implementation | Value / limit |
|---|---|---|
| Work corpus | Campaign Master Books, checklists, Inbox, convention-aware scanner | Portable intent and memory; document ordinals are weak runtime identity |
| PM application | Preact local desktop, static HTML export and hosted `/pm` | Shared useful UI; static surfaces are dated snapshots |
| Phone | React/Next `/pm/live` over `pm_live` and `pm_commands` | Useful status/control without exposing local server; receipt/freshness gaps |
| Runner | `scripts/delivery/run-session.mjs`, 14-state transition model | Extensive accumulated safeguards; phase handlers coordinate too many nontransactional effects |
| Agent structure | One primary thread with activity labels; independent roles planned | Continuity is real; role labels do not establish independent review |
| Persistence | `state.json`, packet, decisions, events, transcript, ledger, finish artifacts | Excellent forensic raw material; files can disagree across crash/resume |
| Governance | Three approval records, typed risky plan approval, one-writer restrictions, bounded lanes | Real controls; repeated gates cannot substitute for identity, isolation or correct proof |
| Context/resources | Lane reading lists, native session reuse, context packages, token/cost totals | Strong useful concepts with unit, delivery and accounting gaps |

Sources: `scripts/pm/ui.mjs:18`; `src/components/pm-live/PmLiveApp.tsx:63`; `scripts/delivery/state-machine.mjs:10`; `scripts/delivery/agent-registry.mjs:105`; `scripts/delivery/fsx.mjs:33`; Master Books' source maps.

## 3. Why it evolved this way

The history shows practical reactions to real incidents: phase gates made owner oversight explicit; persisted artifacts made a failed run reconstructable; lane policies reduced excessive context; session reuse addressed cold cache cost; the phone's accidentally destructive checkbox led to grant/revoke distinctions; parse failures led to earlier usage recording and structured-output normalization.

These were reasonable local repairs. Their accumulation produced a system where phases carry both workflow and recovery behavior. For example, rejecting a plan returns to SPEC_READY because that is where a new plan turn is dispatched (`state-machine.mjs:116`). The accompanying explanation documents the previous mismatch. That is evidence of an overloaded model, not proof that the repair itself was wrong.

The prior ASTRA studies recommended tightening existing seams under an explicit preserve-V1/freeze constraint. This study preserves their evidence and removes that target-design restriction under the owner's new contract. The old freeze is not a reason to stop this research; it remains historical/current operational policy until an implementation change is actually authorized.

## 4. Current evidence register

| ID | Verified source / artifact | Finding |
|---|---|---|
| D01 | `scripts/pm/mutations.mjs:24`; `scripts/pm/shared/tasks.mjs:58`; `scripts/pm/src/app/store.js:103` | Stale ordinal plus same checkbox state can target a newly inserted item; postponement shares ordinal identity. Synthetic reproduction checked inserted R-9 instead of intended R-1. |
| D02 | `scripts/pm/archive.mjs:222`, `:259`, `:384`; `scripts/pm/bridge.mjs:587`, `:619` | Archive writes files sequentially; desktop Undo lacks postimage comparison. Bridge's stronger Undo is worth preserving, but its journal follows the effect. |
| D03 | `scripts/delivery/server-routes.mjs:1469`, `:1605`; desktop `SessionDetail.jsx:268`; phone `SessionDetailView.tsx:55` | Gate name is checked; reviewed artifact/candidate revision is not bound to the decision. Stale same-kind approval is a source-derived race, not an executed exploit. |
| D04 | `scripts/delivery/instant.mjs:256`, `:318`; `acceptance.mjs:148` | Exact transformation is not enforced: declared lines may coexist with surplus edits. Every criterion can be promoted using generic diff evidence. Reproduced on current pure functions. |
| D05 | `scripts/delivery/run-session.mjs:2306`, `:2361`, `:4123`, `:4172` | Zero selected tests may pass; missing/invalid review verdict need not block. `{}` being parseable is weaker than a valid review. Zero-test result reproduced using an injected command runner. |
| D06 | `scripts/delivery/run-session.mjs:1774`, `:1853`, `:4115`, `:4214`, `:4716` | Failed-attempt spend can disappear on retry success; REVIEW can start paid UAT before persistence/cap boundary. DLV-95 repaired a narrower parse-order leak. |
| D07 | `scripts/delivery/drivers/claude.mjs:575`, `:1319`; `run-session.mjs:1059` | Reused segment cost readings and token deltas have different scope. Summing cumulative dollars overcounts earlier turns. Billing basis remains unverified. |
| D08 | `scripts/delivery/usage.mjs:139`; `run-session.mjs:625`, `:1752`; `context-policy.mjs:65` | Processed input/cache throughput is used as resident context. Rotation can discard continuity for the wrong reason. |
| D09 | `scripts/delivery/memory.mjs:32`; `context-assembly.mjs:146`; `run-session.mjs:499`, `:687` | Investigation fields are declared but unpopulated; normal rotation saves a package without delivering its rendered content to the fresh turn. |
| D10 | `scripts/delivery/fsx.mjs:33`, `:65`; `run-session.mjs:4716`; `server-routes.mjs:83`, `:463` | Individual file writes do not commit the session as a unit. Build ownership is inferred from state, including ACCEPTED. Heartbeat already exists at `run-session.mjs:4722`; a new timer is not the missing primitive. |
| D11 | `.delivery/sessions/s-20260822-093143-t7tm/state.json:4`; `artifacts/finish/manifest.json:3`; `writeback.done:2` | State is ACCEPTED with six met criteria; older finish is BLOCKED/runner-crash with zero met. Writeback marker says `tickedCheckbox:false`, `driftReason:drift`. This proves inconsistent records, not incorrect product code. |
| D12 | `src/features/pm-live/usePmLive.ts:143`; `scripts/pm/bridge.mjs:1127`, `:1135`, `:1149` | Phone waiter is registered after insert; timeout becomes failure without same-ID reconciliation. Claimed commands are not drained again, and completion-update error is unchecked. |
| D13 | `src/features/pm-live/cache.ts:13`; `usePmLive.ts:35`, `:47`; `store.ts:73`; `scripts/pm/bridge.mjs:935` | Cache is not owner-bound, hydration precedes authentication, full reads merge, and relay revision counters restart in memory. These are client/projection findings, not current RLS evidence. |
| D14 | `scripts/pm/bridge.mjs:171`, `:203`, `:629`; `src/components/pm-live/CaptureSheet.tsx:26` | Captures enter New; task publication filters to Now/Next/Later. Fresh pure builder read 7 open Inbox captures but relayed 0 Inbox rows. Capture returns no stable work identity. |
| D15 | `scripts/pm/src/features/activity/ActivityView.jsx:24`; `scripts/pm/src/features/tasks/TasksView.jsx:40` | Activity combines latest session summaries and file mtimes, not a full event audit. Native task capture exposes Markdown ID/severity grammar. |
| D16 | `scripts/delivery/drivers/claude.mjs:337`, `:425`; `drivers/codex.mjs:16`, `:289`; `run-session.mjs:1591` | Useful permission controls are not equivalent across providers. Shell checks are heuristic; post-turn guards detect after effects. Codex ignores maxTurns. Exact containment requires adapter/OS conformance. |
| D17 | `scripts/delivery/drivers/claude.mjs:1036`; `drivers/codex.mjs:237` | Both adapters perform a generative preflight without conserving that usage in the run ledger. Credential inheritance policy also lacks an explicit environment allowlist. |
| D18 | `scripts/delivery/finish-package.mjs:79`; `server-routes.mjs:1886` | `build:null` can repopulate already-completed plan steps as remaining; PM writeback failure can still leave a done marker that suppresses another attempt. |

Additional permission inference: current Claude documentation says auto-approved operations can skip `canUseTool`, whereas the driver configures `acceptEdits` and callback-based checks without a universal hook. This weakens any universal pre-write claim. It was not tested as an exploit; installed-version behavior needs an isolated conformance fixture. [Claude permission evaluation](https://code.claude.com/docs/en/agent-sdk/permissions).

## 5. What the history does and does not establish

Read every direct local session directory containing `state.json`: **16 records: 14 CANCELLED, one SHIPPED, one ACCEPTED**. The cohort mixes synthetic fixtures, repeated diagnostics, smoke work and different implementation revisions. It is not a representative failure rate.

The SHIPPED record is `s-20260725-181118-xdl9`, a DLV-28 tooling smoke task. The ACCEPTED record is the HUB-1 product attempt above. The evidence disproves the old absolute “no product attempt” premise, but does not establish two trustworthy shipped product completions.

The Aug22 transcript contains 17 sealed rows with 11 unique turn IDs. Its ledger has requirements, questions and decisions, but zero rejected-approach/file-index/test-result records. Raw persistence enabled this diagnosis; its semantic integrity still needs work.

Do not carry forward historical defects already fixed as if they remain current: overwritten human/budget gate state, FAST's original huge required reading list, lint scanning emitted files, initial SDK session-ID collision, INSTANT's whole-dirty-tree diff, and the original nested-array `.map` crash. Their lessons become regression fixtures. Current issues are the narrower D-register findings.

## 6. Valuable assets versus architectural debt

**Preserve:** scanner/parser behavior and fixtures, source-preview containment, useful board/search/filter components, offline snapshot honesty, guarded postimage Undo invariant, explicit truncation, outbound relay topology, pure-function testing style, fake drivers, normalized transcript capture, Windows artifact writing helpers, owner decision history, native session reuse and domain rules.

**Replace at the delivery boundary:** ordinal execution identity, gate-name-only decisions, phase-sized authoritative persistence, freely interpreted acceptance references, mutable finish authority, unqualified provider interchangeability and model access to shared authoritative state. Native jobs own their inner tool/context lifecycle; ERA records dispatch, decisions, candidate/evidence and actual disposition.

**Retire after cutover:** legacy desktop assets, redundant activity-as-agent roles, four public lanes, model turns that only format a result, repeated context summary layers and duplicate client interpretations of cost/status. Code volume alone is not a reason to rewrite. The reason is that correctness depends on facts which V1 cannot bind together consistently.

## 7. Research verification receipt

Ran inspected, fixture-based tests:

`pnpm exec vitest run tests/delivery/acceptance.test.ts tests/delivery/instant.test.ts tests/delivery/finish-package.test.ts tests/delivery/state-machine.test.ts`

Result: **4 files / 382 tests passed**. This is scoped regression evidence, not full-system validation. Then imported current helpers without repository writes and demonstrated:

1. Approved `25 → 20` plus an unrelated same-file boolean change still passed INSTANT.
2. Offline exactly-once and physical-phone delivery criteria both became met/diff from a synthetic filename.
3. An injected zero-test, exit-zero command result produced validation success; no actual validation subprocess ran.
4. A completed step returned as remaining when `build:null` at REVIEWING.
5. A prepended open row received a stale ordinal toggle.
6. Seven open Inbox captures produced zero Inbox rows in the pure relay task builder.

Some existing tests encode the weaker filename-evidence semantics (`tests/delivery/acceptance.test.ts:48`). Passing tests and the counterexamples therefore coexist. V2 must strengthen propositions, not simply grow the test count.

Live billing, current DB constraints/policies, deployed phone behavior, process isolation and quantitative owner-time savings remain unverified. The study makes no claim to have measured them. [Red Team](<PM Delivery — Red Team.md>) converts these limits into acceptance requirements.

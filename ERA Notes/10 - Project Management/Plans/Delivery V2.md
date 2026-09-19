---
created: 2026-09-06
updated: 2026-09-12
type: delivery-plan
status: active
owner: Elio
plan_revision: "2.2"
---

# Delivery V2

**Purpose:** select a current PM item, delegate engineering to a qualified native executor, and return an independently checked result with less total owner work. This is the accepted delivery specification; [Delivery's checklist](<../Delivery/4 - Checklist.md>) alone owns priority and completion. [Delivery's Master Book](<../Delivery/Delivery — Master Book.md>) owns current operation and history. This document replaces the ten Autonomous Delivery planning documents; their [preserved originals](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Execution Portfolio.md>) retain detailed fixture designs and dated research.

**Status at 2026-09-09:** S0/S1 contract, adapter, store, checker and entry code exists. Claude and Codex are selectable through one boundary; neither profile is admissible. The configured Deliver path admits work but stops before dispatch. The ordinary native baseline and real product pilot have not run. Synthetic fixtures and an installation smoke establish their stated code boundaries; they do not establish autonomous delivery. Do not read historical statements such as “no code exists” or “S1 shipped” as the current stage status.

**Adopted 2026-09-11 ([Command Center](<Command Center.md>), revision 2.2):** executor, model and effort are chosen per run from allowed, qualified profiles (superseding installation-wide selection; DLV-97). V2's review moments are plan approval and final application. Phone use is a core milestone (DLV-104). The target adds an owner-triggered protected Apply (DLV-105), then bounded parallel candidates (DLV-106). V2 entry now requires a selection witness and freezes the Master Book acceptance revision (V2-I01). A container runtime met the battery's required worker/checker controls on synthetic assets; no executor profile is admissible yet (DLV-96).

**Phase 3 (2026-09-12, code and synthetic evidence):** per-run executor/model/effort, trusted-local commands (paired session + CSRF, bridge-derived remote actors), exclusive dispatch claims with a last-moment recheck, unit-specific resource settlement, bound qualification receipts, the container worker/checker (`worker-boundary.mjs`) and one V2 run lifecycle (`journey.mjs`: plan → approval → implementation → protected checks → Result) are implemented and fixture-verified for both executors. Real battery runs in the pinned worker image leave `network.egress` unverified for both, so neither profile is admitted and nothing dispatches; no real run, baseline or pilot exists. Status and per-backend gaps: [Command Center Phase 3](<Command Center.md#phase-3--make-one-native-v2-delivery-dependable-locally>).

**Phase 4 (2026-09-12, code and synthetic evidence):** the phone relays V2 commands with durable recovery (DLV-104) and an owner-triggered protected Apply is implemented locally and through the relay (DLV-105). The relay migration is unapplied and no real candidate exists, so application of real work is unobserved. Status: [Command Center Phase 4](<Command Center.md#phase-4--deliver-the-same-workflow-from-the-phone>).

**Phase 5 (2026-09-12, code and synthetic evidence):** up to two independent candidates can write at once (DLV-106). Rule-based admission yields Can run together, Must follow or Needs scope check, with reasons. Waiting runs are queued, a writer that grows into another reservation pauses, and applications are serialized and rechecked on the changed source. One writer per candidate, a derived lease and V1's lock are unchanged. No real pair has run. Status: [Command Center Phase 5](<Command Center.md#phase-5--enable-dependable-parallel-items>).

## Operating boundary

V1 remains the running dispatch path with its existing three recorded gate decisions, scoped INSTANT interaction exception, owner shipping, and no Git writes/worktrees/permission bypass. Its August 6 freeze remains: DLV-92/93 require two real product completions and limit intervening fixes to one reliability, one simplification and one validation remedy. An ACCEPTED HUB-1 attempt with inconsistent finish artifacts is not evidence that this threshold passed.

The owner separately authorized September 7 S0/S1 construction and September 9 executor/policy wiring. Those dated authorizations explain the code already landed; they do not repeal the V1 freeze, enact V2's standing-authority model, or authorize a paid pilot. V1 repairs serve continued V1 use and are not blanket prerequisites to a separately authorized V2 pilot. Before V2 can dispatch, its qualified boundary, exact operating grant and pilot policy must exist.

No worker writes the host checkout, Git metadata, production database, supervisor store, protected checker or release credentials. Initial output is a checked candidate for owner application; an owner-triggered protected Apply (DLV-105) is implemented (2026-09-12) as an explicit owner command only, writing the approved candidate's bytes and checking the integrated source in the checker; no real candidate has been applied. A requested deployment remains outstanding until its required observation exists. No automatic provider fallback, duplicate retry after uncertain dispatch, or weaker containment is admitted to make a profile launchable.

## Ownership and invariants

Three components have distinct responsibilities:

- **Supervisor:** selected work, immutable contract, permissions/resources, job admission, decisions, reconciliation and result projection.
- **Native executor:** investigation, routine planning, tools, editing, ordinary test/repair, conversation, compaction and permitted internal investigators inside confined scratch.
- **Protected checker and disposition observer:** actual candidate identity, eligible observations, acceptance and observed application/release. Writer claims cannot certify these facts.

Markdown owns work intent and queue state. `scripts/delivery-v2/` implements the delivery boundary; local `.delivery/v2/` SQLite records and immutable artifacts own execution facts. Existing desktop/phone snapshots are projections. Selected-item mappings do not migrate the whole backlog into another PM database.

| ID | Invariant | Proof family |
|---|---|---|
| V2-I01 | Selection binds exact work and source revision; ordinal or ambiguous alias cannot launch another item. | F-ID |
| V2-I02 | Every dispatch/resume/disposition uses current unrevoked authority for exact contract, effects and resources. | F-AUTH |
| V2-I03 | Worker and descendants cannot escape scratch, read undeclared secrets or alter authoritative records. | F-ISOLATION |
| V2-I04 | Job identity and reservation precede dispatch; uncertain start/stop is reconciled without blind retry. | F-JOB |
| V2-I05 | Consumption and unresolved reservations are conserved in their declared units; strict limits require whole-job enforcement. | F-COST |
| V2-I06 | Trusted import freezes and identifies candidate bytes/environment before checks; the writer cannot change the oracle or receipts. | F-EVIDENCE |
| V2-I07 | Only eligible fresh observations satisfy a criterion; missing, malformed, stale and waived evidence never becomes passing. | F-EVIDENCE |
| V2-I08 | One versioned Result distinguishes job outcome, evidence, requested/observed disposition and work completion. | F-RESULT / F-PUBLISH |
| V2-I09 | Continuation preserves decisions and useful findings, rechecks inputs/authority, and cannot revive revoked rights. | F-RESUME |
| V2-I10 | Commands bind actor, installation, target and payload; same-ID reconciliation and owner-bound projections preserve intent. | F-COMMAND |

### Record contract

| Record | Minimum responsibility |
|---|---|
| WorkRef | Stable work identity, exact origin locator, human alias, source fingerprint, mapping revision. |
| Contract | Immutable work/source revision, outcome, exclusions, scratch/publication scope, criteria, requested disposition and policy references. |
| Grant | Exact contract/policy revision, permitted executors/effects, resource policy, expiry/revocation and actor/decision references. |
| Run | Engagement identity, contract, lifecycle, active grant/job, waiting obligations and current Result. |
| Job | Unique admitted dispatch, run/contract/grant, purpose, request/input manifest, reservation, qualified profile, execution reference, dispatch marker, observations and artifacts. |
| Decision | Exact proposition/revision, kind, actor, answer, evidence seen and supersession. |
| Candidate | Trusted identity for code or research, base/output manifests, diff/report, environment and artifact hashes. |
| Evidence | Criterion revision, candidate, approved observer/oracle/config/fixture/environment, actual outcome and raw artifacts. |
| Result | Versioned contract/candidate, job outcomes, criterion states, requested/observed disposition, obligations, unknown effects/resources and safe next action. |
| Boundary receipt | Command/job/check/disposition/projection identity, applicable actor/payload, before/after state and observed/unknown result. |

These are logical responsibilities, not instructions to add one table per row. Existing `contracts.mjs`, `store.mjs` and related modules own implemented schemas. Reuse them; schema changes require an explicit slice. Field-level design remains in [Architecture §4](<../_Archive/Studies/Autonomous Delivery/PM Delivery — V2 Architecture.md#4-minimal-records-and-ownership>).

### Lifecycle and completion

Run lifecycle is `DRAFT | ACTIVE | WAITING | CLOSED`; closed outcome is `verified_candidate | useful_partial | failed | cancelled`. A closed run gets a linked successor for further engineering; later disposition receipts append Result versions without rewriting history.

Job status is `reserved | active | paused | finished | unknown`; terminal outcome is `succeeded | failed | cancelled`. Persist `dispatch_started_at` before invoking the executor. Missing native identity after that marker does not prove that dispatch never happened.

Requested disposition is `research | verified_candidate | applied_change | verified_deployment`; observed disposition is `none` or a disposition actually established. These are distinct requirements, not an automatic numerical ladder.

`candidateVerified` requires every required candidate criterion satisfied by eligible fresh evidence, valid artifact identity/publication scope, and no unresolved integrity/authority violation. Unknown cost remains explicit and reserved even when a candidate is technically verified.

`workComplete` additionally requires every requested destination criterion and no unresolved consequential effect or resource obligation. A waiver remains a recorded limitation, not automatic verified completion. An owner-approved new Contract can change the desired result; the model cannot quietly lower it. Failed PM writeback is a pending projection, never a reason to repeat engineering.

Detailed predicates and schema: [Evidence §6](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Evidence & Autonomy.md#6-one-result-and-an-honest-completion-predicate>).

## Executor qualification and resources

The canonical adapter exposes `describeProfile`, `start`, `inspect`, `resume`, `stop`, and `exportCandidate`. Persist `executionRef = { backend_id, dispatch_key: job_id, native_ref? }` before dispatch. Every paid start/resume/repair/reviewer dispatch gets a new Job and admission; read-only inspect/reattach does not. Native continuation may retain a session without merging reservations or reviving authority.

Claude and Codex are explicitly selected per installation through the same registry. There is no default/substituted provider and no per-request override of installation selection. *Superseded 2026-09-11:* selection moves to each run, from the installation's allowed and qualified profiles, still never defaulted or substituted (DLV-97). *(IMPLEMENTED 2026-09-12 in code; the installation selection route now refuses.)* Each job reconciles through its own executor. The September 9 decision supersedes the earlier one-adapter-only construction suggestion; one writer and independent qualification still apply.

Qualify the actual executor/runtime/OS/configuration with disposable canaries: permitted scratch writes; forbidden host reads/writes; secret/environment isolation; network/connectors; links/reparse escapes; protected-store/checker access; and descendant behavior after stop. A copied checkout and a shell denylist are not confinement. Checker execution of candidate code needs its own protected boundary. A relevant runtime/config change invalidates affected qualification.

As recorded September 9, Codex's restricted-token probe denied outside writes/network but allowed synthetic host-secret, link-escape and supervisor-store reads; descendant stopping was unobserved. Claude's controls were unobserved, rather than proven failed. Both profiles refuse admission. A real boundary must pass the existing unmodified battery; relocating the store or hiding only the canary does not solve host-wide reads. **DLV-96** owns this remaining outcome (formerly reused open DLV-94).

Resources retain their provenance: reconciled billed cost, provider/list cost, estimated equivalent cost, subscription usage and processed tokens are separate. A strict monetary promise requires a justified complete-job bound including native retries, internal investigators, compaction, paid tools and in-flight margin. Token/time/turn limits are not dollar caps. Both current SDK profiles lack the proven whole-job monetary bound; a threshold profile requires an explicit weaker policy, not a fabricated cap. Paid preflight/diagnostic work needs its own prior reservation.

The execution-policy document already supports executors, effects, resource unit/allowance/strictness, reservation basis, expiry, disposition ceiling and repair limit. It cannot grant publication, disable qualification/confinement or authorize automatic unknown-job retry. Its dispatch half remains **DLV-97** (formerly reused open DLV-95): scratch provisioning, protected check plan, and authorized admission-to-dispatch route. Owner choices still required are per-job confirmation versus standing policy, actual FAST allowance/unit, and default eligible criteria.

Exact profile/fixture contract: [Context §3–4](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Context & Agent Model.md#4-bounded-qualification-fixtures>). Dated provider documentation in the original is historical; inspect installed interfaces and current primary documentation when implementing qualification.

## Verification and recovery

Define a criterion's proposition, scenario/scope, eligible observer, independent oracle, freshness inputs, whether it is required for candidate/disposition, and forbidden substitutes before implementation. Source replacement can prove an expressly structural request; a working control requires behavioral evidence. A file path, screenshot or zero-test success cannot prove offline replay or physical-device behavior.

Evidence states are `missing | satisfied | failed | inconclusive | stale | waived`. A protected check records actual argv/procedure, candidate and environment identities, observer/config/oracle, start/finish outcome, selected/executed/skipped counts and artifact hashes. Writer-authored logs remain attributed inputs. Changes to tests, verifier, grants or acceptance policy require scrutiny under the prior trusted policy. Candidate C1's evidence cannot silently certify repaired C2.

Freeze candidate bytes after quiescing the writer. Protected checks run outside the writer's authority; scope checks cover the complete candidate diff. Begin with conservative freshness invalidation and existing test/compiler/browser tools, not a general evidence framework.

Persist reservation/intent before launch and raw usage before parsing optional prose. Unknown launch retains identity and reservation, reconciling by native reference or dispatch key only where the backend supports it. Cancellation revokes future dispatch/publication immediately; show stop requested until observation establishes stopping or containment. A successor never shares writable scratch with a possibly live predecessor.

Keep SQLite local, with durable writes and immutable artifacts verified before references are committed. Backup includes consistent records plus referenced artifact manifests. Restore verifies references and reconciles outstanding jobs before dispatch. Missing artifacts block dependent evidence. Rollback disables new dispatch, drains/reconciles, preserves unknown reservations/results, and restores the supported dispatch mode only when safe; deleting history or replaying an uncertain launch is not rollback.

Use existing PM selection/results, not a replacement dashboard. Authenticate local commands and reject cross-origin requests. Remote grants remain unavailable until actor/revision binding, same-ID receipt recovery and owner/schema-bound snapshots are proven. Complete reads replace snapshots; failed reads preserve explicitly stale same-owner state. Static views and heartbeat alone cannot authorize an action.

Fixture families and detailed expected failures: [Evidence §9](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Evidence & Autonomy.md#9-canonical-fixture-families>). Historical negative witnesses D01–D18 remain in [Diagnosis §4](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Current System Diagnosis.md#4-current-evidence-register>); keep them even when V1 code retires.

## FAST, DEEP and continuation

FAST and DEEP are effort/evidence policies over one system. FAST normally uses one native engineering conversation, protected checks and at most one supervisor-initiated repair within the Grant; native internal repair remains within the admitted job. Add independent semantic review for a concrete uncertainty/consequence, not as a compulsory formatting phase.

DEEP permits bounded investigation before implementation scope is settled. It retains source facts, attributed reports, unknowns, discriminating probes and consequential rejected approaches. Missing production/device facts require the named observer, not a larger model.

Prefer native session continuity and native compaction. ERA stores what it actually supplies at launch/resume and one portable Checkpoint at meaningful wait/handoff/pause boundaries. Checkpoint contains run/contract identity, source/candidate, binding decisions, consequential findings with source refs and reconsider triggers, remaining questions/criteria with resolver/next action, native record pointers, and the next safe action. It is not a transcript copy, mandatory seven-part dossier or paid summary after every turn.

Before resume/replacement, reconcile the predecessor, recheck source/contract/grant/profile/resources, invalidate stale findings and isolate the successor. Decisions remain binding while findings remain verifiable assertions. Separate reviewer jobs repeat admission and accounting; one writer owns the candidate.

Detailed handoff contract: [Context §5–7](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Context & Agent Model.md#5-launch-input-and-one-portable-checkpoint>). [FAST journey](<../_Archive/Studies/Autonomous Delivery/PM Delivery — FAST.md#4-complete-journey-quick-amount-preset>) and [DEEP journey](<../_Archive/Studies/Autonomous Delivery/PM Delivery — DEEP DIVE.md#3-complete-journey-duplicate-or-lost-offline-capture>) are illustrative acceptance scenarios, not uncompleted product tasks.

## Delivery sequence and canonical work map


| Stage | Current disposition | Canonical remaining work |
|---|---|---|
| S0.1 — selected WorkRef/Contract | Code and 24 synthetic fixtures shipped September 7. | No duplicate implementation task. |
| S0.2 — proof and ordinary-native baseline | Criterion/baseline machinery and 48 synthetic fixtures shipped; no real baseline recorded. | **DLV-98:** select a suitable product item and record the comparable ordinary-native workflow, all owner effort and requested destination. |
| S1.1 — backend/scratch qualification | Adapter, snapshot/candidate and battery code shipped; two adapters selectable September 9; neither profile admissible. | **DLV-96:** qualify real read/descendant boundary without weakening battery/profile. |
| S1.2 — durable admission/reconciliation | Store/job code and fake fault fixtures shipped. | No duplicate rebuild; remaining real recovery proof belongs to pilot/S2. |
| S1.3 — protected checks/Result | Checker and Result code with injected-runner fixtures shipped. | No duplicate rebuild; real candidate/check evidence belongs to pilot. |
| S1.4 — entry and real product pilot | Entry/switch/auth/projection wiring shipped; policy admission wired; no dispatch or product pilot. | **DLV-97:** dispatch policy path; **DLV-99:** separately authorized product pilot after DLV-96/97/98, including forced restart and actual outcome/owner effort. |
| S2.1 — failure matrix | Planned; not proven by S1's partial synthetic coverage. | **DLV-100:** complete crash/artifact/grant/revocation/backup-restore matrix after pilot; production changes only for reproduced failed contracts. |
| S2.2 — DEEP continuation | Planned; Checkpoint schema is not a resumed engagement. | **DLV-101:** authorized interrupted DEEP investigation/implementation with fresh-session continuation and measured repeated work. |
| S2.3 — value decision | Planned; no comparable sample set exists. | **DLV-102:** reach three comparable FAST samples total, include failures plus interrupted DEEP/native baseline, then record continue/narrow/delegate-more. |
| S3.1 — access or availability | DEC-15 resolved 2026-09-11: phone use is a core milestone; managed hosting stays optional. | **DLV-104** phone command/cache recovery; PM Tooling **R63** shared phone views. |
| S3.2 — publication policy | DEC-16 resolved 2026-09-11: owner-triggered protected Apply is the target; manual application until it lands; no Git/publication/deploy authority. | **DLV-105**; deployment obligations stay pending. |
| Parallel candidates | Adopted 2026-09-11 after Apply. Code and fixtures 2026-09-12: two writers, rule-based admission and queue, serialized rechecked application; no real pair. | **DLV-106**: an owner-approved real pair after DLV-96; sprint integration with PM Tooling R61. |
| S3.3 — retirement | Conditional after demonstrated replacement; no bulk conversion. | **DLV-103:** retire only supported redundant V1 paths after drain, old-client refusal, history/export and restore drill. Keep held until S2's decision supports cutover. |

All S0/S1 implementation history is retained in the Master Book and [portfolio implementation log](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Execution Portfolio.md#7-implementation-log>). Exact original slices and fixture/file boundaries: [S0](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Execution Portfolio.md#2-s0--contract-and-native-baseline>), [S1](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Execution Portfolio.md#3-s1--one-supervised-delivery-slice>), [S2](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Execution Portfolio.md#4-s2--recovery-and-comparative-proof>), [S3](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Execution Portfolio.md#5-s3--conditional-access-publication-and-retirement>). Archived file allowlists are starting points to revalidate; they cannot override current scope or the canonical queue.

## Comparative proof, cutover and stop rules

Compare equivalent product outcome, evidence and requested disposition. Include setup, clarification, monitoring, recovery, decisions, review, application, release and maintaining Delivery; unknown minutes remain unknown. Include failed attempts and actual resource basis. Three FAST results and one interrupted DEEP engagement are operating samples, not statistical safety claims. A tooling smoke or patch-only outcome cannot stand in for deployed product success.

Before switching dispatch mode, drain/reconcile V1 writers; enforce the installation-wide `v1|v2` choice on every server write entry so cached clients cannot bypass it. Preserve V1 reads and originals. Existing owner source edits remain possible and invalidate relevant candidate/application assumptions. Do not build a dual-engine scheduler, import all sessions, or block the owner's editor as an invented prerequisite.

A false completion, containment escape, unauthorized effect or duplicate consequential effect disables the affected capability until causal repair and evidence exist. If the supervisor does not reduce total owner effort, stop expansion and retain useful contracts, checks, board and result links. A native/managed workflow is an acceptable permanent outcome. Conditional access/publication/retirement work follows measured needs; the old broad six-stage runtime, per-tool ledger, general context engine and bespoke host integrator are superseded.

Original reassessment/cutover rationale and old Stage 0–5 to S0–S3 map: [Migration §4–7](<../_Archive/Studies/Autonomous Delivery/PM Delivery — Migration Strategy.md#4-migrate-only-the-selected-work>). This plan and any supporting research confer no new operational permission.

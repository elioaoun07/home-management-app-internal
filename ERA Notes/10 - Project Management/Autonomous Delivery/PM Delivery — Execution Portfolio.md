---
created: 2026-09-06
updated: 2026-09-06
type: delivery-plan
status: active
owner: Elio
plan_revision: "2.1"
---

# PM Delivery — Execution Portfolio

> **V2.1 plan, not implementation.** The owner accepted the ownership reassessment and authorized this documentation refactor. No slice below is shipped, no provider is qualified by this document, and no live job, migration, operational gate change or release is authorized here. S0–S3 replace the original Stage 0–5 blueprint; the pointer map is in [Migration Strategy](<PM Delivery — Migration Strategy.md>).

## 1. Execution contract for every future slice

Read [V2 Architecture](<PM Delivery — V2 Architecture.md>), [Evidence & Autonomy](<PM Delivery — Evidence & Autonomy.md>), [Context & Agent Model](<PM Delivery — Context & Agent Model.md>) and the relevant [Diagnosis](<PM Delivery — Current System Diagnosis.md>) witnesses before implementation. Architecture owns the schemas and V2-I01–V2-I10; Evidence owns F-ID, F-AUTH, F-ISOLATION, F-JOB, F-COST, F-EVIDENCE, F-RESULT, F-RESUME, F-COMMAND and F-PUBLISH. This portfolio names fixtures against those contracts rather than redefining enums or success semantics.

Proposed code lives under **scripts/delivery-v2/**; proposed tests under **tests/delivery-v2/**; proposed local runtime storage under **.delivery/v2/** uses SQLite plus immutable artifacts. These paths/modules are planning boundaries, not existing implementations. Do not add an ORM, event framework, generic broker or duplicate public type package without a demonstrated requirement. Keep new authoritative schemas in one module and reuse them at entry/projection boundaries.

Every slice states exact files, input/output, dependency, invariant, fixtures, observable exit and stop/rollback behavior. Implement only that slice; a newly discovered gap becomes an explicit dependency rather than an improvised subsystem. Split a slice if its proof cannot fit one reviewable change. New fixture names below are **proposed fixtures**, not tests reported as passing today.

All simulated provider/process fixtures use disposable files, synthetic secrets and fake endpoints. Do not run real providers, production relay or paid preflights as test setup. Real product samples require separate implementation/pilot authorization. Current no-Git-write/no-worktree/no-bypass/no-production-write rules remain binding. No worker writes the host checkout, store, trusted evidence, acceptance policy or publication credentials. Missing confinement means read-only assistance or a stop, never unsandboxed write access.

For every sample, preserve requested disposition even when only a candidate is available. Record owner setup, explanation, decisions, recovery, review, application and release effort as well as outcome, latency, cost basis and limitations. Unobserved owner minutes remain unknown. The comparison is against the same required outcome and evidence.

## 2. S0 — Contract and native baseline

**Stage exit:** one eligible product item has a frozen outcome/evidence/disposition contract, and a comparable ordinary-native workflow has an honest baseline record. No backlog migration or new dashboard.

### S0.1 — Select and freeze one item

- **Files:** proposed scripts/delivery-v2/contracts.mjs, work-ref.mjs and tests/delivery-v2/work-ref.test.ts. Read existing scripts/pm/shared/md-scan.mjs, scripts/pm/shared/tasks.mjs and scripts/delivery/packet.mjs; reuse parsing, not ordinal authority.
- **Input → output:** current selected Markdown block and fingerprint → validated WorkRef and immutable Contract revision. Human ID is an alias; source locator and fingerprint protect selection. Preserve required disposition and unresolved criteria.
- **Dependency/invariant:** canonical Architecture contracts; F-ID/F-AUTH/F-RESULT. Store only mappings for selected items. No V1 state or source mutation.
- **Fixtures:** selection-reordered.md prepends R-9 before selected R-1 and must still resolve R-1; selection-edited.md changes its text and must require a new revision; duplicate human IDs must produce conflict; a deployment request retains that disposition when candidate-only execution is proposed.
- **Done:** deterministic selection/contract output and resolving source references; re-reading identical content yields the same mapping/revision. No existing checklist is rewritten.
- **Stop/rollback:** ambiguous source stays unselected. Remove only new generated projection/mapping in a disposable test; preserve source and previously issued contracts.

### S0.2 — Specify the proof and measure the native baseline

- **Files:** proposed scripts/delivery-v2/profiles/fast-local.json, a pilot record under .delivery/v2/artifacts/ and tests/delivery-v2/fixtures/fast-control/. Use canonical artifact references; do not create a new PM campaign.
- **Input → output:** selected product outcome, standing policy and actual environment → explicit check plan, resource-policy basis, requested disposition and native baseline record. A display-value change requires a click/action-value observation, not just a string match.
- **Dependency/invariant:** S0.1; F-EVIDENCE/F-COST/F-RESULT. The owner or a trusted previously established checker approves the observation plan independently of the writer.
- **Fixtures:** a button displaying 20 whose action still emits 25 fails the behavioral criterion; an unrelated boolean change fails scope if the approved change is exact. Use fake action handlers, no financial mutations.
- **Done:** criteria state what passes/fails, who can observe it and which source/environment identity matters. Separately authorized ordinary-native work records all owner effort and outstanding release obligations; do not invent a baseline from prior smoke sessions.
- **Stop/rollback:** if no safe relevant product task or observation exists, narrow the pilot explicitly without weakening the item's outcome. No baseline job runs under this planning authorization.

## 3. S1 — One supervised delivery slice

**Stage exit:** one separately authorized product task passes its required local checks on a frozen candidate, survives a forced interruption/restart, and appears in the existing PM experience with its actual remaining application/release action. Implement the four slices in order; fake fixtures precede the real pilot.

### S1.1 — Qualify one native backend and scratch boundary

- **Files:** proposed scripts/delivery-v2/adapters/codex.mjs, candidate.mjs, tests/delivery-v2/backend-profile.test.ts and isolation.test.ts. Read scripts/delivery/drivers/codex.mjs, tests/delivery/drivers-codex.test.ts and the native interfaces in Context. Reuse stream/injection seams only after checking their contracts.
- **Input → output:** pinned adapter/runtime configuration and fixture workspace → qualification profile plus native execution reference/candidate export through the canonical adapter methods. Codex exec/SDK is the first candidate; no second backend or live app-server UI is required.
- **Dependency/invariant:** S0.1–S0.2; F-ISOLATION/F-JOB/F-COST. Describe actual writable/readable roots, permitted network/connectors, credentials and stopping scope. A copied checkout is not itself a security boundary; exclude .git, production secrets and authoritative control files. Qualify launch in that metadata-free snapshot using the selected interface's supported non-Git option (Codex CLI --skip-git-repo-check or its supported SDK equivalent); never create .git to satisfy a repository check.
- **Fixtures:** attempted outside-scratch write/read, fake-secret access, .git mutation, reparse/symlink escape, fake disallowed network call, inherited child process after stop and worker access to store/verifier. Exercise boundary enforcement with disposable canaries, not merely the generated settings object.
- **Done:** record supported/unsupported controls on the intended host with pinned versions; candidate export cannot publish or certify. Prove or refuse the strict whole-job monetary profile, including inner requests/retries/subagents/paid tools and in-flight margin. Explicit threshold admission is a different owner-authorized policy.
- **Stop/rollback:** no qualified scratch confinement means no autonomous edit pilot. No qualified hard bound means no strict monetary promise. Disable the profile and preserve diagnostics; never turn off the sandbox to pass.

### S1.2 — Persist admission, jobs and unknown outcomes

- **Files:** proposed scripts/delivery-v2/store.mjs, jobs.mjs, tests/delivery-v2/jobs.test.ts and store.test.ts. Read scripts/delivery/fsx.mjs and scripts/delivery/drivers/fake.mjs; the latter supplies scripted failure/event seams, not OS containment proof.
- **Input → output:** current WorkRef/Contract, unrevoked Grant, profile, resource reservation and unique Job ID → durable executionRef with backend_id and dispatch_key equal to job_id, plus optional native_ref → native status/usage readings → reconciled receipt or explicit unknown. Each new native start/resume/repair/review dispatch gets a Job ID; read-only inspect/reattach is not new paid work.
- **Dependency/invariant:** S1.1; F-AUTH/F-JOB/F-COST. Choose and pin one locally compatible SQLite binding with transaction/backup support. Persist intent/reservation/executionRef before launch and dispatch_started_at immediately before calling the backend; absent native_ref does not prove no dispatch. Check current revisions, expiry, effects and allowance before every paid continuation. Native tools never transact against this store.
- **Fixtures:** lost-launch-ack accepts launch then drops its response; restart inspects/reconciles without issuing a second start. failed-then-success retains first-job usage; duplicate-usage does not double-count cumulative readings; unknown-cost keeps reservation; revoked-resume refuses new paid work; lost-stop-ack revokes publication but does not report stopped. Reuse failStartSession, throwsEvery and throwsUsage ideas from the V1 fake.
- **Done:** transactional crash/restore retains records and artifact references; duplicate admission is idempotent; failed/unknown work remains visible and resource-accounted. No native transcript event needs a corresponding authoritative database transaction.
- **Stop/rollback:** inspect by dispatch key only where the qualified backend supports it; otherwise a lost start acknowledgment remains unknown and reserved. Never blindly retry. Disable dispatch and preserve store/artifacts; deleting unknown jobs is not recovery.

### S1.3 — Freeze, check and report the actual candidate

- **Files:** proposed scripts/delivery-v2/checks.mjs, results.mjs, tests/delivery-v2/evidence.test.ts and results.test.ts. Read tests/delivery/acceptance.test.ts, instant.test.ts, finish-package.test.ts and validation-baseline.test.ts; preserve counterexamples while rejecting generic filename-as-proof semantics.
- **Input → output:** stopped/reconciled writer export → frozen code or research candidate identity → protected independently selected check execution → evidence and Result with actual disposition, pending obligations and raw references. Bind and emit the minimal canonical Checkpoint from Context §5 at candidate handoff/task-level wait/planned pause, using its shared shape in contracts.mjs; fresh-session continuation is qualified in S2.2. The candidate cannot alter trusted check selection or mint its receipt.
- **Dependency/invariant:** S1.2; F-EVIDENCE/F-RESULT/F-PUBLISH. Use a clean controlled check environment without publication credentials. Pin trusted checker inputs outside the writer; changes to tests/config/lockfiles or acceptance rules trigger independent scrutiny and evidence invalidation.
- **Fixtures:** exit-zero with zero tests fails required behavior; arbitrary existing proof file fails; a required malformed review stays inconclusive, while optional malformed engineer prose does not block independently sufficient evidence; surplus edit and stale bound action fail the S0 fixture; candidate mutation stales proof; missing artifact blocks completion; build:null must not resurrect completed work; a verified candidate does not complete a required deployment.
- **Done:** one result evaluator drives view/export/continuation; evidence records actual commands, counts and identities. Required local observations pass for the candidate; missing phone/live-DB/release evidence remains an obligation. Initial FAST policy allows at most one supervisor-dispatched post-check repair, only within the current Grant/resource policy. Native inner repairs remain inside the whole-job bound; they are not separately scheduled ERA Jobs. Further escalation needs available standing authority or a concrete decision.
- **Stop/rollback:** any false completion disables the affected evidence profile. Preserve useful output and failed observations; no waiver becomes verified success.

### S1.4 — Connect existing selection to one real product pilot

- **Files:** proposed scripts/delivery-v2/cli.mjs/entry adapter; narrow integration in scripts/delivery/server-routes.mjs and scripts/pm/src/features/delivery/ for dispatch mode, selection and result. Add tests/delivery-v2/pilot-entry.test.ts. Reuse current board/search/styles and result surface; no new app or dashboard.
- **Input → output:** selected item + applicable policy → admitted Run/Job → visible result and concrete outstanding owner action. One local service persists an installation-wide v1|v2 dispatch switch. Store only selected WorkRef mappings, not an adoption registry.
- **Dependency/invariant:** S1.3; F-ID/F-AUTH/F-JOB/F-RESULT/F-COMMAND. Before V2 dispatch, drain/reconcile V1 writers. In V2 mode, stale V1 launch/resume/fork and other write-capable routes refuse server-side; history/read routes remain available. Future implementation authorization identifies the pilot's gate policy explicitly.
- **Fixtures:** duplicate start returns the same admitted outcome; same command ID with another actor/payload conflicts; unauthenticated/cross-origin local requests refuse; stale selected source refuses launch; active V1 writer prevents mode switch; cached V1 client cannot launch/resume/fork after switch; reload shows current unknown/decision/result. Exercise the existing desktop surface at 390px if it changes.
- **Done:** after fake fixtures and boundary qualification, one separately authorized non-tooling product job produces required local evidence and a coherent result after a forced restart. Measure review/application/release effort even if the owner performs those steps. Product work closes only when its requested disposition and evidence are fulfilled.
- **Stop/rollback:** disable new V2 admission; revoke/reconcile active work and preserve candidates/results. Switch back only after V2 writers are confirmed drained/reconciled; do not turn an unknown dispatch into a fresh V1 launch. Direct development remains available, without pretending to control the owner's editor.

## 4. S2 — Recovery and comparative proof

**Stage exit:** three comparable FAST samples in total, plus one interrupted DEEP engagement, support a decision about owner-effort savings and the next actual gap. This is a small operating sample, not a statistical safety claim. One executor and one contract model serve both modes.

### S2.1 — Complete the failure matrix

- **Files:** extend proposed jobs.test.ts, store.test.ts, evidence.test.ts and results.test.ts under tests/delivery-v2; alter production modules only for a reproduced failing contract.
- **Input → output:** fault at each persisted launch/receipt/export boundary → reconciled record or honest unknown with no unintended new authority.
- **Dependency/invariant:** S1; F-AUTH/F-JOB/F-COST/F-EVIDENCE/F-RESULT. Use fake clock/process/event injection and temporary SQLite/artifacts.
- **Fixtures:** crash before dispatch versus after provider acceptance; partial/missing artifact; expired grant during native wait; revoked job emits a late result; repeated start response; changed contract before repair/review; backup restore with unresolved cost. Verify current authority on resume, not only initial launch.
- **Done:** each row names observed state, next permitted action and preserved reservation/artifact; cancellation never promises termination before acknowledgment. Re-run only affected contract suites.
- **Stop/rollback:** unknown external effects keep relevant scope paused; late writers cannot publish. Keep the last qualified profile and preserve incident records.

### S2.2 — Resume DEEP work without a custom context engine

- **Files:** proposed scripts/delivery-v2/continuation.mjs and tests/delivery-v2/continuation.test.ts; adapter changes only for native resume/export. Read scripts/delivery/memory.mjs and context-assembly.mjs for D08/D09 witnesses, not mandatory dossier shapes.
- **Input → output:** current contract/decisions, executionRef, candidate and meaningful source-bound findings → native resume or compact portable checkpoint → authorized successor Job. Include rejected approaches only when they prevent rediscovery, and link raw evidence.
- **Dependency/invariant:** S2.1; F-RESUME/F-AUTH/F-COST/F-EVIDENCE. Native conversation continuity is default. Snapshot what ERA actually passes; do not infer provider occupancy from processed tokens or require every inner read to be indexed.
- **Fixtures:** forced fresh session receives a recorded owner answer, rejected hypothesis, open evidence and current candidate; changed source invalidates its dependent finding; no undocumented transcript dependency is required to find the next safe action. Two outstanding jobs never share writable scratch.
- **Done:** one authorized real DEEP investigation/implementation survives interruption and fresh-session continuation without re-asking a settled decision; repeated work and missing understanding are measured, not declared impossible. Independent review is added only for a concrete semantic uncertainty.
- **Stop/rollback:** improve the checkpoint if it fails; do not automatically add vector storage, paid summarizers or more agents. Inconclusive review remains an obligation.

### S2.3 — Decide whether the supervisor earns expansion

- **Files:** append immutable pilot comparison artifacts and a concise campaign record; no runtime feature is a default deliverable of this slice.
- **Input → output:** native baseline, three FAST samples and interrupted DEEP sample, including failures → explicit continue/narrow/delegate-more decision with measured gaps.
- **Dependency/invariant:** S2.1–S2.2; F-RESULT. Compare the same scope, evidence and requested disposition; separate observed cost/list cost/estimates/subscription usage and unknowns.
- **Fixtures/checks:** comparison rejects a missing failed attempt, omitted owner application time, tooling smoke passed off as product work, or patch-only completion compared with deployed completion. Manual observations may remain unknown without false precision.
- **Done:** record owner-active minutes where observed, avoidable decisions, repeated explanation, recovery effort, verified outcomes, escaped defects, latency and maintenance/setup cost. Choose only the next consequential burden.
- **Stop/rollback:** if value is weak, stop expansion and keep the PM board, contract/check templates and result links. If an external workflow is better, migrate the job adapter/links rather than defend custom ownership.

## 5. S3 — Conditional access, publication and retirement

These slices are independent choices after S2. Implement only the one justified by evidence and separately authorized scope. S3 is not a mandatory platform completion checklist.

### S3.1 — Remove an observed access or availability burden

- **Files:** choose either existing scripts/pm/bridge.mjs, src/features/pm-live/ and src/components/pm-live/ for a narrow mobile projection/decision change, **or** one proposed managed-backend adapter. Do not combine a mobile rewrite with a hosting platform. Add F-COMMAND or backend qualification fixtures as appropriate.
- **Input → output:** authenticated revision-bound decision/command → durable same-ID receipt; alternatively, qualified managed job → the same Job/candidate/result contract. SDK/exec with persisted task-level escalation is default; a live per-tool approval client needs a demonstrated requirement.
- **Dependency/invariant:** S2.3; F-COMMAND/F-AUTH/F-JOB/F-COST. Phone cache must be owner-bound and stale state explicit. Managed hosting needs its own runtime/cost/credential qualification; documented beta capability alone is insufficient.
- **Fixtures:** lost command acknowledgment, same ID/different payload, stale decision, actor switch, duplicate tap, relay restart and full-snapshot replacement; for hosting, lost launch/stop, environment/candidate export and resource-bound conformance. Require owner-provided physical-phone/live-relay evidence where current policy prevents direct inspection.
- **Done:** the chosen owner burden measurably decreases without weaker authority or truthful status. A sleeping local runner remains visibly queued unless qualified hosting actually removes that dependence.
- **Stop/rollback:** keep mobile read-only when provenance is unproven; disable only the unqualified host/profile. Production relay changes require owner-applied manual SQL under existing rules, never a back door.

### S3.2 — Resolve publication policy without building a host integrator

- **Files:** result/pending-obligation projection first; conventional CI/publication configuration only after a separate written policy amendment permits it. No mandatory integration journal or worktree module.
- **Input → output:** verified frozen candidate + explicit permitted publication action → application/release receipt and required environment observation, or precise owner handoff. One owner action may authorize related steps while evidence stays distinct.
- **Dependency/invariant:** S2.3; F-PUBLISH/F-AUTH/F-EVIDENCE/F-RESULT. No Git writes/worktrees under current policy. Production DB writes remain owner-only. Changes to trust/acceptance rules need independent authorization under the previously trusted version.
- **Fixtures:** candidate changed after approval; host/source drift; candidate applied but deployment absent; deployment identifier differs from checked version; owner applies SQL without supplied verification; duplicate receipt; failed PM writeback. Never infer production success from a local build.
- **Done:** either manual handoff is accepted as the operating boundary with measured effort, or an explicitly authorized established publication path proves the requested disposition. Required deployment stays pending until observed.
- **Stop/rollback:** retain pending obligations and last valid evidence; reconcile uncertain publication before retry. Do not overwrite owner edits, weaken disposition, or create a bespoke integrator to avoid a policy decision.

### S3.3 — Retire only demonstrated redundancy

- **Files:** selected V1 entry/runner/UI paths and compatibility tests, named from actual references at cutover. Preserve .delivery/sessions/ originals and useful readers/exports.
- **Input → output:** supported-path inventory and active-session list → bounded retirement diff plus restored-fallback drill.
- **Dependency/invariant:** applicable S3 choice or S2 evidence alone; F-ID/F-JOB/F-RESULT. No active work depends on removed code; known cached desktop/phone server routes cannot bypass retirement.
- **Fixtures:** active V1 session blocks deletion; old client tries retired launch; historical result still opens; export includes raw pointers; restore recovers artifacts and unknown reservations. Test affected paths rather than claim all providers/devices are qualified.
- **Done:** obsolete phase/summary/status machinery disappears for the supported path and owner effort is remeasured. No bulk session conversion or raw-history deletion.
- **Stop/rollback:** disable new successor launches, reconcile/drain active jobs, restore the supported dispatch mode/profile and preserve artifacts. Never replay an unknown launch to make rollback look complete.

## 6. Scope and completion discipline

S0 and the S1 vertical path are the only initial investment. S2 decides what comes next; S3 choices are conditional. A product pilot must happen before provider parity, full PM migration, a new dashboard, generic context/effect infrastructure or a universal observer library. Existing V1 hazards that block continued use may receive narrow fixes independently.

For future implementation, finish each slice with: exact changed files; applicable invariant/fixture families; actual command/observer receipts; missing live/device/provider evidence; useful product artifact; owner effort and cost basis; stop/rollback state. A green unit suite is evidence for its tested boundary, not delivery success.

This refactor changes planning documents only. The prior study's test counts and pure probes remain historical receipts in Diagnosis. None of the proposed fixtures, backend qualification, pilots, migrations or release paths above has run as part of this plan update.

---
created: 2026-09-20
updated: 2026-09-20
type: research
status: proposed
owner: Elio
---

# Delivery — Consumption Optimization Plan

## Recommendation

**Make Focused delivery reuse an already complete work specification as the plan the owner approves, followed by one AI engineering job. Keep investigation for work that still needs a plan.** Use the selected item's reading guide to start inspection in the right place, then follow current-code evidence into necessary dependencies. Keep the existing supervisor, approval, candidate, checker, Apply and phone relay.

This removes a potentially redundant AI planning stage and its accumulated transcript for eligible tasks. It does **not** remove the owner's plan approval or the engineer's obligation to inspect current code. The owner reviews the existing specification rendered as a concrete plan; the engineer then reads, implements and reports within that approval. If inspection disproves the plan or requires broader authority, stop for a revised plan through the existing workflow.

For tasks that cannot supply a complete plan without guessing, retain today's plan → approval → resumed build, but make its Focused investigation a short validation of known scope, led by the guide. Do not create a second delivery engine, universal fresh-thread policy, paid guide-writing stage or another backlog documentation campaign.

**The expected saving is fewer unnecessary model requests and less context carried through later requests. Its size is unmeasured.** This is a stronger opportunity than further accounting corrections, but a shortcut that increases failed candidates or owner preparation is a loss. Start with one small, well-specified, low-risk fixture; do not infer readiness from file count or a `Touches` list alone.

### What stays and what changes

| Keep | Change |
| --- | --- |
| Exact work identity, scope, acceptance, grants and owner-selected executor/model/effort | Reuse a complete existing specification instead of making an AI restate it |
| Revision-bound plan approval, including on the phone | Permit a proposed plan with no planning job; clearly record its source |
| Current-code inspection and justified dependency reads | Start at task-specific files/symbols/tests; batch independent reads and compatible edits |
| Frozen candidates, protected criteria, required typecheck, explicit Apply, rollback and post-Apply owner gate | Supply a small recoverable task brief so fresh or compacted conversations need not rediscover the task |
| Existing repair limits, resource admission, subscription-only guard and uncertain-job reconciliation | Correct profile propagation and distinguish advisory guidance from binding requirements |

## Evidence and diagnosis

### Scope of this review

Reviewed on 2026-09-20 against working-tree HEAD `d4aaf034`, **including uncommitted Delivery changes**. The Delivery Master Book's latest evidence is in its dated entries, not its `updated: 2026-09-15` frontmatter. The latest commit affecting the inspected Delivery paths is `a0870bec` (September 19); September 20 normalization, verification and prompt fixes are present in the working tree. An installed worker image is a separate deployment fact: this review does not establish that it contains every host-side change.

Starting records: [AI Reading Guides](<Delivery — AI Reading Guides.md>), [Token Consumption Investigation](<Delivery — Token Consumption Investigation.md>), and [Token Consumption Fixes](<Delivery — Token Consumption Fixes.md>). Selected Master Book sections: DLV-118, DLV-114, DLV-119, DLV-133 and DLV-134, plus relevant dated state/shipped entries. The accepted [Delivery V2 specification](<../Plans/Delivery V2.md>) supplies the approval and confinement invariants. Older operational claims in that specification are historical.

No Delivery session, provider call, additional AI worker, live experiment, production inspection or runtime-state write was performed. The original BUD-83 forensic work and pinned counter-semantics investigation were reused, not repeated. Source references below are repository-relative `path:line` anchors as inspected in this review; symbols are the durable identifiers.

### Main remaining causes

| Finding | Evidence and impact | Confidence |
| --- | --- | --- |
| Accumulated context is reused across many model requests | BUD-83 planning made approximately 6–7 requests and building approximately 11–13. Planning's estimated 22–27k end context continued into the build. Current `journey.mjs:1783` and `:1195` still choose that continuity; `adapters/codex.mjs:668` resumes the native thread. | Mechanism confirmed; request/context magnitudes are historical estimates, not new measurements |
| Every launch still pays for AI planning, even when much of the plan exists already | `journey.mjs:935` forces read-only investigation; `entry.mjs:579` unconditionally admits a job after creating the run. BUD-83's existing six criteria and exact five-file scope largely reappeared in its plan. | Confirmed duplication in that example; net savings from removing planning remain a hypothesis because the build reused its reads |
| Focused has only a modest prompt distinction, with inconsistent propagation | `interaction.mjs:328` changes one sentence; Focused still requests the same plan shape. Job-count/repair limits are real (`policy.mjs:84`, `journey.mjs:1657`), but queued investigation omits the profile. See the path correction below. | Confirmed code behavior; frequency and consumption impact unknown |
| Guide advice is mixed with requirements and fingerprinted as acceptance | `work-ref.mjs:160` returns the whole item section; `:173` fingerprints it. Editing only a guide changes that fingerprint. | Confirmed by pure local probes; needless approval disruption is possible, but this review did not inspect live waiting runs |
| Repairs can require rediscovery rather than targeted correction | `repairInstruction` supplies failed criterion IDs/states/reasons, no full plan or guide. Normal repairs resume the builder, but fresh fallback lacks that history. General checker output is hashed rather than retained (`checks.mjs:503`); typecheck diagnostics are retained separately. | Confirmed limitation; no repair occurred in the investigated BUD-83 run, so it did not cause that run's consumption |

The evidence does **not** support unchanged-file rereading as the dominant problem. The previous investigation found about 31 redundant lines; most repeated reads covered changed code or different ranges. Do not ban verification reads or impose arbitrary file/request quotas. Several independent commands in one tool interaction can save a round trip; one enormous repository dump can instead increase all subsequent inputs. Batch only what is already known to be relevant, preserve errors and output limits, and keep dependent reads/edits sequential.

### What has already been fixed

The September 19 investigation's provisional causes must not be presented as still unfixed:

- **Accounting:** `usage-normalization.mjs:110` normalizes provider semantics; `jobs.mjs:610` derives increments using the parent thread's raw reading. Raw receipts and normalization provenance remain available. Legacy rows are not restated.
- **Observability:** `worker/runner.mjs:53` / `:159` bracket work with subscription observations; `subscription-window.mjs:113` compares them separately from tokens.
- **Small real waste:** `interaction.mjs:299` prohibits duplicate executor test/build commands; `:318` explains the no-Git snapshot and external verifier. `journey.mjs:1142` replaces duplicated plan JSON with a reference on eligible same-thread implementation continuations.
- **Quality:** `journey.mjs:1453` adds deterministic typecheck evidence; `:2390` separately refuses Apply when required evidence is missing, failed or stale. Read-only inspection of installed policy revision 5 confirmed typecheck is enabled and required. No policy was changed.
- **Control honesty:** Codex has no enforced `maxTurns` here (`journey.mjs:386`). Installed policy remains non-strict; admission estimates are not an in-job ceiling. DLV-114 remains separate work.

The accounting correction saves **zero actual tokens**. Using the established pinned counter interpretation, the BUD-83 breakdown is:

| Stage | Uncached input | Cached input | Output, including reasoning | Reasoning subset | Total input + output |
| --- | ---: | ---: | ---: | ---: | ---: |
| Planning | 29,086 | 65,024 | 1,630 | 222 | 95,740 |
| Build increment | 33,184 | 360,448 | 4,064 | 828 | 397,696 |
| Whole delivery attempt | **62,270** | **425,472** | **5,694** | **1,050** | **493,436** |

Source: Investigation §3.3, interpreted using Fixes §1 and the current normalization fixtures. The old stored sum was 589,176 because the resumed counter included planning again. Cached input is part of input; reasoning is part of output. Neither is added twice. Most volume was cached, but cached tokens cannot be discarded from the efficiency comparison or assumed to consume no subscription allowance.

BUD-83 is also **not a successful quality baseline**: the historical verified candidate contained the documented `supabaseAdmin.from` defect and was not applied. Today's typecheck addresses that defect class; the historical status cannot certify an equivalent successful delivery.

### Correction to the profile finding

The guide report's “every run investigates as investigate” conclusion is too broad:

| Path | Current behavior |
| --- | --- |
| Direct launch with explicit `workProfile: focused` | Correct Focused instruction (`journey.mjs:939`); the shared launch UI sends this field (`scripts/pm/app/DeliveryV2.tsx:454`) |
| Direct launch without an explicit profile | `policy.mjs:951` can store a Focused recommendation, while the prompt and initial limits use the raw request/default Investigate; `:975` does not pass the resolved profile to the instruction callback |
| Queued investigation admitted later | `admitQueued` calls `instructionFor` (`journey.mjs:690`), whose investigation branch omits profile (`:604`) |
| Ordinary plan approval/revision | Implementation and revised investigation explicitly receive the stored profile (`:1784`, `:1795`) |
| Build resumed after an answered blocking question | The implementation call at `:1838` omits profile; job-count enforcement still uses stored settings |

Fix all call paths to use the same resolved profile for prompt **and supported limits**. This is a small correctness fix, not evidence that all prior consumption came from a wrong profile. The existing profile tests exercise the recommendation helper; they do not prove this end-to-end propagation.

## How reading guides should work

### Current delivery and inheritance

A deterministic count confirmed **26 open DLV items and 26 guides**. That is Delivery coverage, not evidence that BUD, SCH or all ERA tasks have guides. BUD-83 predates this guide pass.

1. **Planning:** `acceptanceNow` → `acceptanceText` → `investigationInstruction` supplies the selected item's entire section under “Acceptance.” Its guide already reaches this stage. Neither the coverage report nor every guide is injected.
2. **Normal building:** plan approval continues the job that produced the plan; the native thread normally contains the original acceptance, guide and reads. Absence from the latest implementation prompt does **not** imply absence from context.
3. **Normal repair:** `journey.mjs:1611` continues the last writer, normally inheriting the same information. Focused has zero automatic repairs; Investigate uses the permitted policy limit.
4. **Fresh fallback/handoff:** implementation retains full plan JSON when no usable prior reference exists, but not necessarily the original acceptance or guide. Repair's standalone prompt is especially thin. Explicit handoff supplies plan plus selected checkpoint fields (`interaction.mjs:399`); `journey.mjs:2173` does not fill that checkpoint with the selected guide or original acceptance and supersedes the old approval.
5. **Compaction:** a native thread ID is not proof every original detail remains available. The plan-reference predicate checks job/thread lineage, not retained context or compaction. Its comment promises conservative fallback, but there is no compaction check in that predicate. Do not claim compacted conversations are fully covered today.

### Minimum reliable treatment

Use **one small task brief**, derived deterministically from the selected item and existing run records. Include binding outcome/acceptance/exclusions, scope and check references, approved plan/decisions when present, then a distinctly labelled **advisory reading guide**. Preserve its source revision/digest. Reuse job request records and existing artifact/snapshot plumbing; no retrieval service, guide database or AI summary job is needed.

- At the first engineering stage—planning or direct implementation—supply the selected guide and necessary binding task facts explicitly.
- On ordinary same-thread continuation, rely on history and supply a short reference to a recoverable brief/approved plan available in the worker snapshot. Do not repeat the whole Master Book section.
- On a fresh thread, known compaction or uncertain continuity, supply the compact binding brief and approved plan explicitly, with the guide if useful. A persistent recovery reference also covers unobservable native compaction; do not build a compaction detector just to avoid a small prompt. Keep the authoritative copy outside writer control.
- For authorized repair, include the failed candidate identity and bounded actionable diagnostics when available, retaining the same scope and decisions. Do not enable more repairs as part of this optimization. Missing diagnostics remain missing; the model must not invent a cause or a pass.

Guides name starting points, not read limits or permission grants. Verify paths/symbols against the supplied source; follow imports, callers, types and tests when needed. A stale guide should prompt a targeted search, not blind execution or automatic task failure. A missing guide falls back to the existing Feature Map and task scope. If necessary source lies outside the authorized snapshot, report the missing input and request an authorized scope/source update; do not expand access automatically.

Maintain guides only when useful facts are learned during real work. No mandatory new guide, complete guide audit or paid guide authoring before every delivery. For scale, the inspected DLV-118/133/134 guides were 889/708/841 characters, versus 1,921/1,668/1,519 characters for their complete sections. These are character counts, not measured token savings. Preparing elaborate guides can easily consume more than they save on one-off tasks.

### Guidance updates must not redefine approved work

Introduce a versioned separation for **new contracts**: binding item text retains acceptance, exclusions, dependencies, holds, scope and any other normative conditions; the explicitly delimited reading-guide block is stored separately as advisory context. Do not reduce the fingerprint to only the `Acceptance` bullet, and do not strip arbitrary prose with a broad regex. Some existing guides state invariants: preserve those obligations in binding text during an explicitly reviewed adoption, rather than silently discarding them.

Freeze the guide version used by a run. A later advisory edit can serve new runs without automatically mutating the old run's inputs. If a new finding changes scope, criteria, permissions or the approved plan, use the existing revision and approval process. Keep legacy contracts on their original whole-section fingerprint rule; never reinterpret their hashes or automatically clear an existing stale approval. This review reproduced guide-only fingerprint changes in memory for DLV-118/133/134, but did not confirm the reported DLV-90 waiting-run state.

**DLV-134's inferred acceptance is still unapproved.** The wording exists at Master Book `:152`, while its provenance does not itself encode an owner decision. It must not qualify for prepared-plan execution or become authorized through this report. Historical normalization is an accounting project, not a prerequisite for saving tokens on newly measured runs.

## Smallest coherent implementation

### 1. Correct the existing Focused path and task input

Unify resolved-profile propagation in `policy.mjs` / `journey.mjs`, including direct, queued, revised and question-resumed work. Keep the model/effort selection unchanged. Add the selected brief/guide handling in `work-ref.mjs` / `interaction.mjs` and dispatch preparation. Use current code and a small number of grouped reads to validate known scope; avoid a new planning essay. The deterministic recommendation should use binding risk/scope facts, not incidental risk words inside advisory reading instructions.

Prove profile-path parity, missing/stale guide fallback, current-source inspection, fresh/continued context handling, and the versioned acceptance behavior. Existing contracts and approvals must keep their prior meaning. This first slice is useful independently, even for tasks that still require investigation.

### 2. Let eligible Focused work reuse its existing plan

Add a narrow, owner-visible prepared-plan route within the same lifecycle. Qualify only when the selected work already supplies an unambiguous outcome, explicit implementation steps, bounded scope/exclusions, relevant invariants and independently runnable acceptance checks, with no unresolved consequential decisions or dependencies. Readiness requires explicit provenance/owner review; the existing keyword heuristic and `Touches` list are insufficient. Initially exclude money, recurrence, auth/RLS, migrations and ambiguous cross-module work. BUD-83's unresolved balance/ownership/cache questions illustrate why detailed acceptance alone is insufficient.

Render that existing material as a proposed plan using deterministic assembly. Do not invent steps, risks or empty “no unknowns” claims to make it eligible. If the material needs substantive AI reasoning to become a plan, use the existing guided investigation path and account for it. Do not move the same paid planning into guide preparation.

Reuse `recordPlan`, `decidePlan`, `approvalFor` and the normal write-job admission. `plans.job_id` is nullable (`store.mjs:244`), and approval binds plan/contract/grant rather than requiring an AI author (`interaction.mjs:185`). `journey.mjs:1773` already permits an implementation with no planning predecessor. Record preparation provenance in the existing plan/event records; never manufacture a planning job or usage receipt.

**Actual required change:** separate run/contract/grant preparation from the unconditional `admitJob` in `entry.mjs:562`. Preserve selection witnesses, HELD/dependency gates, policy/qualification checks, idempotency, coordination and resource checks; repeat applicable checks at real dispatch as today. Do not shortcut by starting an investigation and cancelling it. Require the same owner plan approval before any writing; then start the one engineering job with the full approved brief. If the engineer discovers a material mismatch, stop without broadening scope and return to revision/investigation. Keep the existing explicit escalation route rather than automatically adding another attempt.

Reuse the existing Plan review and phone `v2-deliver` / `v2-decision` / `v2-control` / `v2-apply` transport (`relay-shared.mjs:30`; phone `relay/transport.ts:393`). No new laptop-only preparation or approval ceremony. Synthetic relay/replay tests and eventual real-phone verification are still required; code reuse is not a device acceptance claim.

### 3. Prove it locally, then compare one task with approval

Before any provider use, exercise prepared-plan creation with **zero provider dispatch before approval**, duplicate phone commands, stale source/acceptance/plan/grant, missing checks, revoked authority, queued admission and scope growth. Verify the new path cannot produce a more permissive Result or Apply decision than the existing one for identical candidate/evidence inputs. Retain negative compiler fixtures, zero-test/inconclusive failures and checker-integrity tests. Test both adapters' instruction assembly without calling either provider.

The proposed scope belongs with DLV-118, but does not complete its entire acceptance or remove its declared DLV-114/117 dependencies. Adopting a separately bounded slice is an owner decision; do not silently rewrite the checklist, policies or accepted specification. Implement the no-planning-job path only with explicit approval of that workflow change.

## Trade-offs and remaining limits

- **Fewer stages can lose early discoveries.** The engineer must still inspect before editing, and a disqualified task must return to investigation. Count those escalations and all wasted attempts. Restricting the first trial to genuinely prepared work is essential.
- **Fresh versus resumed build is not settled.** Keep resume after an actual investigation. Starting fresh saves inherited input but loses cached context and can cause more reads or mistakes. The prepared-plan path starts fresh because no planning conversation exists; it does not imply every build should start fresh. Defer the earlier four-run handoff experiment unless residual data points to that choice.
- **Verification is stronger, not complete.** The host compiler overlay checks the current checkout plus candidate, includes uncommitted baseline work, and costs roughly 3–4 minutes in the prior measured runs. It is outside the model but outside the isolated checker container. Baseline subtraction, config/environment inconclusive outcomes, behavioral coverage and device checks retain their limits. Keep it required; DLV-133's isolation work is separate from token reduction.
- **The owner laptop test gate remains a remote-operation limit.** It records an application-specific owner assertion after Apply, not a continuously source-bound automated receipt (`test-gate.mjs:45`). Preserve it and its explicit Proceed decision; the new flow must add no further laptop dependence. Do not claim phone-only end-to-end verification while that requirement stands.
- **Budget and repair limits are not efficiency measurements.** No in-job token stop exists; larger reservations do not make work cheaper. Current Focused disables automatic repair; do not raise that limit to rescue the experiment. General failure logs are still limited, and post-candidate revision is separate outstanding work.

## Verifying savings without lowering quality

**Smallest useful approved comparison: one eligible frozen task, two independent end-to-end attempts.** A uses the current corrected staged Focused workflow; B uses the same prepared specification and brief with the AI planning job omitted. Use the same source/snapshot, pinned SDK/image, executor/model/effort, criteria/oracles, required typecheck, owner approvals and repair policy. Use independent native sessions and scratch; run serially, choose the order before starting and record it. No arm sees the other's plan discoveries or candidate. Apply neither automatically. If preparation needs new AI work, include it in B's total.

This compares the proposed workflow, not handoff strategy in isolation. One pair can reject a bad shortcut or justify limited use; it cannot establish a general savings percentage. Do not pay for a larger benchmark up front. If this pair fails or is ambiguous, keep the staged path; collect further evidence only with separate approval and a specific unanswered question.

Record for **each entire attempt**, including guide/spec preparation, planning, building, escalation, repair and AI-assisted review:

- Provider raw counters and normalized increments; uncached input, cached input, output, reasoning subset, and cache-creation counters where applicable. Preserve provider-specific semantics and unknowns. Do not rank variants on uncached input plus output alone.
- Request count when actually observable, otherwise label it unavailable; tool/activity rows are not requests. Record context/output sizes, necessary versus wasted commands, wall time, checker time and owner preparation/review time.
- Every required criterion, scope/integrity result, compiler result, new defect, failed candidate and owner review verdict. Both candidates must satisfy the same behavioral requirements and mobile expectations, not merely compile. Candidate verification and integrated/owner acceptance remain different outcomes.
- Before/after observations for each shared subscription window, timestamps, reset identity, account concurrency and missing readings. Run without other known account use if possible. Rounded or delayed percentages cannot precisely attribute a job; zero observed movement is not proof of free work. A missing reset identity or a reset/decrease makes that comparison unusable. The current helper can compare two null reset identities (`subscription-window.mjs:104`, `:126`), so inspect the records rather than trusting every displayed delta.

The code labels a same-window difference an “upper bound”; treat that as conditional on timely, monotonic, sufficiently precise observations, **not a rigorous bound from a coarse shared meter**. Official OpenAI documentation also states that model, context, reasoning, tool use and caching affect allowance consumption: [Codex usage limits](https://learn.chatgpt.com/docs/pricing#what-are-the-usage-limits-for-my-plan). Do not convert tokens to subscription percentages or apply API/credit prices to included subscription use.

Adopt B narrowly only if it preserves quality and approvals, reduces total work across preparation through successful verification, and does not increase owner burden or failed attempts. Include cached input in that judgment. If token categories move in opposing directions and subscription observations cannot distinguish the result, report the trade-off as unresolved. For subsequent ordinary use, track aggregate consumption **across all attempts divided by successfully verified outcomes**, not only the winning candidate's spend. Report application/owner acceptance separately. No success means no favorable per-success ratio.

### Verification performed for this report

Local deterministic command:

```text
node_modules/.bin/vitest.cmd run tests/delivery-v2/instructions.test.ts tests/delivery-v2/usage-normalization.test.ts tests/delivery-v2/subscription-window.test.ts tests/delivery-v2/verification-gate.test.ts --maxWorkers=2
```

Result: **4 files, 39 tests passed**. Pure read-only Node probes confirmed guide coverage/counts, selected section sizes, guide-only fingerprint changes and the recommendation/default-prompt mismatch. Source tracing established the actual launch/queue/approval/repair paths. The real-compiler timings and defect reproduction are prior evidence from the Fixes report, not rerun measurements. No full app typecheck, UI/device run or production experiment was needed for this documentation-only change. Runtime code, policies, acceptance criteria, existing reports and delivery state remain untouched.

**Concrete next action:** approve a bounded DLV-118 implementation slice for the corrected Focused profile/brief handling and the narrowly eligible prepared-plan path, with deterministic approval/verification/relay tests. Keep all live comparison runs separately gated on your approval; do not start with another whole-system investigation or guide-writing pass.

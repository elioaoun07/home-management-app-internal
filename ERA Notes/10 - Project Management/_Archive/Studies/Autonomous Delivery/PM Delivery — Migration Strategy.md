---
created: 2026-09-06
updated: 2026-09-06
type: delivery-plan
status: baseline-frozen
owner: Elio
plan_revision: "2.1"
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# PM Delivery — Migration Strategy

## 1. Adopted planning direction

**Make V2 a delivery supervisor over native coding jobs.** ERA retains the selected outcome, authority, resources, candidate, protected evidence and honest final disposition. A qualified coding environment owns the engineering conversation, tools, routine investigation/edit/test/repair loop, context management and native session continuity.

This document replaces the earlier recommendation to construct the full contract/effect/evidence runtime before proving its product value. The owner accepted the [first-principles reassessment](<../../../../../docs/ASTRA-Ideas.MD#point-2-reassessment>) and requested this plan refactor. That authorizes documentation work; implementation, live jobs, operational gate changes and deployment remain separate actions. The historical findings in [Diagnosis](<PM Delivery — Current System Diagnosis.md>) remain evidence, not a mandate to preserve either architecture.

The canonical contracts and invariant names are in [V2 Architecture](<PM Delivery — V2 Architecture.md>); proof requirements and fixture families are in [Evidence & Autonomy](<PM Delivery — Evidence & Autonomy.md>). [Execution Portfolio](<PM Delivery — Execution Portfolio.md>) supplies the bounded S0–S3 slices. Do not implement the superseded six-stage portfolio from old copies or references.

## 2. Compare complete owner experiences

The comparison is architectural judgment until real samples exist. Compare the same requested outcome, restrictions, evidence and release obligation; a fast patch cannot win by omitting work another path performs.

| Option | What ERA retains | Benefit | Cost or unresolved requirement | Decision |
|---|---|---|---|---|
| Ordinary native coding workflow | PM source, reusable instructions/checks, result links | Lowest integration cost; mature engineering interaction | Owner still launches, supplies context, follows missing evidence and reconnects outcomes to items | Required baseline; acceptable permanent outcome if supervision adds little |
| Small delivery supervisor + one native backend | Selected-item contract, job admission/reconciliation, candidate/evidence/result, exceptions | Removes repeated owner coordination while reusing the runtime | Requires real boundary qualification and a small durable store | First implementation candidate |
| Existing managed or issue-to-PR workflow | ERA-specific contract/policy and only missing adapters/projections | Can outsource hosting, job persistence and more workflow | Availability, privacy, permitted Git operations, cost limits and actual evidence must fit | Evaluate when it can remove a demonstrated burden; may replace more of ERA |
| Broad custom delivery runtime | Inner calls, tool broker, context lifecycle, generic orchestration and host application machinery | Potential control where native boundaries cannot express a requirement | Largest ongoing qualification and recovery burden; no measured need for most of it | Do not build by default; justify a specific missing guarantee first |

Selective V1 repairs remain valid while V1 is used. They are neither prerequisites to the pilot nor an automatic commitment to continue V1. A repair should carry a concrete incident witness and a bounded usefulness period.

One backend comes first. The initial candidate is Codex exec/SDK on the existing Windows host, subject to the qualification in [Context & Agent Model](<PM Delivery — Context & Agent Model.md>). Installed CLI flags and published sandbox features are not proof of containment or cost enforcement on this installation. A strict monetary profile must be refused unless the backend supplies the required whole-job bound; a separately authorized threshold profile must describe its weaker guarantee. Do not invent a dollar cap or add an inner tool broker just to make the first provider qualify. Initial FAST supervision allows one post-check repair dispatch within the Grant; ordinary inner repair remains the native runtime's work under its qualified whole-job limit.

Managed hosting is a conditional alternative, not a proven winner. If local execution availability dominates owner effort, compare a qualified managed runner before building distributed scheduling. If a managed workflow meets the same contract with less total work, delegate more and remove redundant ERA components.

## 3. Preserve the current operating boundary

The [Delivery Master Book](<../../../Delivery/Delivery — Master Book.md>) remains the authority for V1 operation: no Git writes/worktrees, no permission bypass, the existing human gates and owner-controlled shipping. Production Supabase writes remain forbidden by the repository rules. This plan does not amend those policies.

V2's first engineering worker writes only to disposable private scratch. It has no host-checkout write access, production credentials, release authority, supervisor-store access or ability to mint trusted receipts. The supervisor freezes a candidate and the independent checker observes it. A changed filesystem outside scratch is not made safe by noticing it afterward.

The earliest useful result is a checked candidate and a precise owner application/release handoff. **Requested disposition remains binding.** If Item X asks for deployed behavior, the item remains open until the identified deployment and required observation exist. A closed engineering run can contain useful partial work; it cannot convert the requested deployment into a candidate-only promise. Contract publicationScope describes allowed output paths/change constraints; the Grant separately permits candidate handoff, application or release effects. Neither field silently rewrites the promised endpoint.

The longer-term policy choice is explicit: retain manual application, or separately authorize a conventional isolated branch/PR/CI path. Reconsidering the Git restriction is a possible future decision, not permission to create a worktree now. A bespoke multi-file host integrator and universal editor-exclusion system are not prerequisites to V2. If manual application costs erase the supervisor's savings, report that rather than hiding it outside the comparison.

## 4. Migrate only the selected work

Markdown remains intent authority. At selection, create a WorkRef for the chosen item and freeze the source fingerprint and Contract revision. Reordering alone must not retarget the selection; a changed or ambiguous item requires re-resolution. A later intent edit supersedes the active snapshot explicitly. Do not import the entire backlog, rewrite checklist IDs, migrate historical session state or turn the new store into the authority for all PM work.

The initial pilot uses **one local delivery service and an installation-wide v1|v2 dispatch switch**, not simultaneous engines with a shared per-item ownership platform. Before switching to V2, drain and reconcile active V1 writers. In V2 dispatch mode, stale V1 launch/resume/fork and other write-capable route paths refuse server-side. Preserve V1 reads, history and exports. The implementation authorization must identify the pilot's gate policy explicitly; this planning document does not deactivate V1 gates.

| Boundary | Initial rule | Expansion or retirement condition |
|---|---|---|
| Existing work corpus | Read selected source with its locator and fingerprint; retain human IDs as aliases | Expand mappings only as more work is selected |
| V1 sessions/history | Read originals and link raw records; never convert acceptance claims into verified V2 evidence | Preserve historical reader/export permanently where useful |
| Delivery admission | One installation-wide dispatch mode after existing writers drain; stale incompatible write routes refuse | No per-item adoption registry or dual-engine scheduler prerequisite |
| Native session | Persist executionRef and resume where safe; each authorized paid dispatch has its own Job record | Successor session only after authority/resources/inputs are checked |
| Existing PM UI | Reuse item selection and add the minimum launch/result/decision projection | Redesign only where observed owner friction warrants it |
| PM completion | Derive from valid result and requested disposition; publication/projection receipts remain separate | Guarded idempotent update only when the actual item can be identified safely |
| Phone/relay | Retain useful read-only status under existing policy | New grants require proven actor/revision binding and receipt reconciliation |

Disabling a button is not dispatch exclusion. Test the server paths used by old cached clients as well as the new entry. Direct engineering remains available: one managed product writer does not claim control over the owner's editor. Private candidates protect the host checkout; owner/source changes invalidate relevant evidence and future application assumptions.

Where PM writeback cannot safely update an identified row without conflicting with other edits, keep a separate result link and explicit pending projection. Do not overwrite a shared checklist from a saved whole-file preimage. A failed projection never fabricates completion or forces the owner to reconstruct the run.

## 5. Small stages, early product evidence

| Stage | Owner-visible exit | Prerequisites deliberately excluded |
|---|---|---|
| **S0 — Contract and native baseline** | A representative selected task has measurable criteria, permitted effects, requested disposition and a comparable native-workflow record | Full backlog import, new dashboard, broad storage migration |
| **S1 — One supervised delivery slice** | One authorized product task yields a frozen independently checked candidate, honest remaining action and recoverable job/result | Every V1 repair, provider parity, phone grants, automatic host integration |
| **S2 — Recovery and comparative proof** | Three FAST samples in total and one interrupted DEEP engagement show outcomes, failures and total owner effort against the baseline | Universal observer framework, context database, generic subagent scheduler |
| **S3 — Conditional access, publication and retirement** | Only the measured next burden is removed; supported V1 paths can retire without losing history | Mandatory mobile rebuild, distributed hosting, bespoke apply journal |

The portfolio defines concrete slices and fixtures. These samples are operational evidence, not a statistical reliability claim. Include unsuccessful work and setup/review/application/release time. Do not infer savings from model latency or count tooling smoke tasks as household product outcomes.

Old-stage pointers are retired as follows:

| Superseded portfolio | Replacement |
|---|---|
| Stage 0 — broad import/view and shared runtime entities | S0 selected WorkRef/contract and baseline; minimal store arrives with S1 |
| Stage 1 — universal attempt/effect/reservation kernel | S1 coarse native Job boundary, confinement, evidence and first product pilot |
| Stage 2 — general observer/evidence machinery | Necessary protected checks in S1; additional real-task proof in S2 |
| Stage 3 — seven-part dossier/compiler/fresh challenger | S2 native resume first, small portable checkpoint and selective challenge |
| Stage 4 — dependable desktop/phone redesign | Existing surface in S1; conditional mobile/hosting slice in S3 |
| Stage 5 — bespoke integration journal and broad retirement | Explicit handoff from S1; conditional conventional publication and scoped retirement in S3 |

## 6. Keep, narrow, remove or defer

| Asset or mechanism | Disposition | Reason and proof needed |
|---|---|---|
| PM corpus, domain rules, owner decisions, raw transcripts and postmortems | Keep | Portable intent and evidence survive provider replacement |
| Scanner/search/UI, safe path/diff helpers, fake-driver seams | Reuse selectively | Verify unchanged input contracts; green tests alone do not justify old semantics |
| Immutable contract, grant, candidate identity and eligible evidence | Keep | Required relationship between requested work and trustworthy result |
| Job admission, cost reservation, unknown-state recovery and cancellation fence | Keep at coarse boundaries | Every new/resumed/repair/review dispatch rechecks authority/resources; unknown launch/stop is reconciled |
| Generic per-tool/per-model-call effect ledger | Remove from default target | Native runtime owns inner engineering; consequential external actions remain separate authorized operations |
| Four lanes, fixed formatting calls, activity-as-agent catalog | Remove from successor target | Effort/evidence policies and selective specialist jobs replace ceremony; V1 gates stay binding until explicitly changed |
| Context rotation, occupancy inferred from processed tokens, mandatory dossier producers | Delegate/narrow | Native continuity plus portable checkpoints at meaningful boundaries |
| Criterion checks and evidence freshness | Keep concrete | Begin with required observers and conservative invalidation; no universal evidence dependency engine |
| Full identity/adoption migration and wholesale history import | Defer | Selected-item mappings solve the pilot's actual need |
| Multiple backend parity and automatic switching | Defer | Qualify one backend; preserve exportable contracts/candidates/results |
| Desktop rewrite and phone grant/key infrastructure | Defer | Reuse existing surface; justify with observed owner-effort benefit |
| Custom host application journal | Remove as prerequisite | Manual handoff now; established publication path only after policy decision |
| V1 runtime and legacy desktop files | Retire selectively later | No active dependent work, history/export intact, covered entry paths and restore drill |

Do not delete current V1 gates, scripts, fixtures or artifacts because the successor plans fewer concepts. Deletion follows cutover evidence. Preserve the negative witnesses from D01–D18 even when the triggering implementation disappears.

## 7. Cutover, rollback and stopping investment

Before enabling a task profile, demonstrate the applicable invariant/fixture families in [Evidence & Autonomy](<PM Delivery — Evidence & Autonomy.md>): selected identity, unrevoked authority, scratch confinement, recoverable Job dispatch, qualified resources, protected evidence and truthful result. Code, configuration and provider/runtime versions belong in that qualification record. An upgrade or changed trust boundary triggers relevant requalification; the old result does not cover every future version.

Before retiring a V1 entry path, reconcile its active sessions, retain raw history/exports, prove known desktop/phone routes cannot still launch it, and rehearse reopening the supported fallback. Retire by supported entry path or work class, not by converting unfinished sessions. A partly executed V2 job never becomes a new V1 session merely because its UI is easier to operate.

Rollback means disable new launches, revoke future publication authority, stop or reconcile native jobs, preserve unknown reservations and freeze/export candidates/results. A stop request is not proof of termination. Unconfirmed effects remain explicit. Switch dispatch mode back only after V2 writers are confirmed drained/reconciled and the previous profile is safe. Deleting the V2 store, clearing reservations, replaying an unknown launch or overwriting the host checkout is not rollback.

Expansion stops when the supervisor creates false completion, cannot enforce its advertised boundary, cannot reconcile unknown work, or saves little total owner effort. Keep safe result inspection and useful independent assets. A narrower native workflow is an acceptable final product, not a failed migration. Add custom machinery only for a recurring, evidenced gap whose benefit exceeds build and maintenance effort.

## 8. Independent recommendation after refactor

V2 should become the small place where a selected item becomes an accountable commitment, a constrained native job, an independently examined candidate and a truthful outcome. It should not become a competing coding environment. FAST and DEEP share that delivery architecture; their effort, evidence and continuation needs differ.

The next implementation decision, when separately authorized, is **S0 followed by one S1 product pilot**. Preserve V1's memory and operational safety while testing whether supervision removes more owner work than it creates. Continue only on that evidence.

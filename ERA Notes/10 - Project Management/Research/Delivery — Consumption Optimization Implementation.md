---
created: 2026-09-20
updated: 2026-09-20
type: implementation-report
status: active
owner: Elio
---

# Delivery — Consumption Optimization Implementation

Implemented the owner-approved bounded slice of the [Consumption Optimization Plan](<Delivery — Consumption Optimization Plan.md>). **DLV-118 remains open. No consumption saving has been measured.** No provider/model calls, live Delivery sessions, additional AI workers, consumption experiments, deployment or production writes were performed. Existing unrelated working-tree edits, runtime policy and historical sessions were preserved.

## Implemented behavior

The resolved profile now drives the initial instruction and supported native limits, including a recommended Focused profile when the request omitted one. Queued investigation, revisions, question continuations and handoff use the stored profile. Executor/model/effort remain unchanged; no configured allowance, profile ceiling or repair budget was increased.

A brief is derived from the selected item's section and the run's existing records: binding task text, contract/acceptance identity, allowed scope and criterion references, relevant plan revision, owner answers and frozen advisory guide. Authorized repairs also carry the failed candidate identity/generation, retaining existing bounded failure reasons in their instruction; missing diagnostic detail is not invented. It does not load other items' guides, the guide report, or planning transcripts. Exact bytes and their digest live in the supervisor job request; the worker receives a content-addressed read-only `/tmp/era-task-brief-….json` copy outside the source snapshot. Claude gets Read access to that exact supplied input; other tool decisions retain the existing guard. Both native SDK bridges carry the same input.

Fresh or uncertain continuity receives the brief explicitly. A known continued context receives a recovery pointer, including for unobservable native compaction. An incapable fixture/runtime receives full inline input; production worker binding requires `task_brief_version: 1` so an old image cannot silently omit recovery. Inline acceptance/plan duplicates are removed where the instruction has the known shape. A prepared brief includes its reviewed material once in the plan, retaining surrounding binding text; unrecognized prepared-source fields make the task ineligible rather than silently losing requirements. Necessary current-code inspection and dependency discovery remain explicit requirements. Guides are starting points, never permissions or read ceilings. Missing authorized inputs or a material mismatch must stop with a blocking question.

New contracts carry a `binding-v2:` acceptance fingerprint. Exactly one standalone pair of `<!-- delivery:advisory:v1 -->` / `<!-- /delivery:advisory -->` markers separates advisory content. All other selected-section text stays binding. Malformed/duplicate delimiters bind the whole section. Existing Reading guide bullets remain binding, since some contain invariants. Existing contracts keep their old whole-section fingerprint **and** binding interpretation; no approvals/hashes are migrated. A run freezes its guide; later advisory-only edits affect new runs. No campaign guide was automatically converted.

## Eligible and ineligible work

The accepted source format is documented in [Delivery V2 — Bounded Focused extension](<../Plans/Delivery V2.md#bounded-focused-extension--2026-09-20>). An eligible selected section explicitly supplies one `delivery-plan-v1` JSON block with an owner-reviewed outcome, acceptance, steps, exact scope, invariants, exclusions, criterion IDs, provenance and low-risk declaration. Unknowns and dependencies must explicitly be empty. Required candidate checks and their pinned runnable inputs must already exist. Scope must fit Touches, publication authority and exact snapshot entries. Initial exclusions cover money, recurrence, auth/RLS, migrations and indicated cross-module work; **DLV-134 is explicitly ineligible**. Keyword/path screening is conservative, not proof of semantic completeness: the owner still reviews the exact proposed plan, and the engineer still inspects current code.

Eligible work deterministically records a proposed plan with provenance and `job_id: null`. There is no planning dispatch, artificial planning job, reservation or fabricated usage. Existing Plan review shows its acceptance, invariants and exclusions on desktop and the shared phone surface. The existing owner approval is required before the one engineering job. Qualification, current grants, source/approval freshness, holds/dependencies, coordination and resource admission are checked normally at actual dispatch. Preparing a plan does not consume a worker slot; approval can queue when capacity is unavailable.

Preparation witnesses authorized source/check-file hashes, including missing-file state. Current source and the supplied snapshot must still match before execution. Selected checklist/Master Book files use the existing semantic selection and versioned acceptance witnesses, allowing irrelevant or advisory-only edits without rebinding the run. This is a bounded input witness, not a fingerprint of the whole repository or compiler environment.

Ineligible or incomplete material takes the normal investigation route; no missing steps/checks are invented. Revise on an unapproved prepared plan starts the ordinary read-only investigation, then requires approval of the new revision. A prepared candidate outside its approved scope stops at **Review scope** before verification; Recheck cannot turn that violation into a verified result. When broader work is necessary, use existing Close and a newly authorized Investigate attempt. A blocking build question does not grant another Focused implementation job. Post-candidate revision remains separate outstanding work.

Both paths use the same checker, required compiler verdict, Result evaluation, final review and explicit Apply, including integrated checks and the existing owner laptop test gate. Phone commands use the existing V2 transport and durable command identity; no new phone-only or desktop-only ceremony was introduced.

## Affected files

| Files | Change in this slice |
| --- | --- |
| `scripts/delivery-v2/task-input.mjs` (new), `work-ref.mjs` | Brief construction, explicit readiness checks, versioned advisory/binding treatment and source recheck. |
| `scripts/delivery-v2/policy.mjs`, `entry.mjs` | Resolved profile/input freeze, prepared source witnesses and transactional no-job preparation using existing plan/command records. |
| `scripts/delivery-v2/journey.mjs`, `interaction.mjs` | Profile propagation, dispatch/recovery input, retained handoff input, prepared scope stop, approval-bound prepared-plan fields. |
| `scripts/delivery-v2/worker-boundary.mjs`, `worker/runner.mjs`, `worker/task-brief.mjs` (new) | Both SDK payload bridges, capability probe, exact recovery-file materialization and Read guard. |
| `scripts/pm/app/DeliveryReview.tsx`, `deliveryReviewModel.ts`, `types.ts`, `DeliveryV2.tsx` | Prepared-plan fields/provenance in review and Markdown; short Review scope state. Existing unrelated UI work retained. |
| New `tests/delivery-v2/task-input.test.ts`, `focused-delivery.test.ts`, `task-brief-boundary.test.ts`, `worker-task-brief.test.ts` | Pure input/versioning, lifecycle, queue, safety parity, adapter transport and isolated recovery-file fixtures. |
| `tests/delivery-v2/executor-selection.test.ts`, `tests/pm-relay.test.ts`, `tests/pm-ui/delivery-review.test.ts` | New-contract fingerprint assertion, prepared phone replay, review/export fields. |
| `Plans/Delivery V2.md`, `Delivery/Delivery — Master Book.md`, Feature Map `cross-cutting/pm-command-center.md`, this report | Accepted bounded behavior, partial PM trace, source routing and limitations. Checklist acceptance and dependencies unchanged. |

## Local validation

All engineering/provider responses and compiler outcomes in lifecycle fixtures are scripted; these tests do not call either model. The ordinary repository TypeScript check is real.

| Check | Actual result, 2026-09-20 |
| --- | --- |
| Delivery V2 + PM UI + both relay suites, excluding the three esbuild files listed below; `vitest run … --maxWorkers=2` | **823 passed, 4 existing Docker tests skipped; 62 files passed, 1 skipped.** |
| `react-app-build.test.ts`, `build-smoke.test.ts`, `static-twin.test.ts`, approved rerun outside the filesystem sandbox | **3 passed**, including the final scope-review UI change. Aggregate: **826 passed, 4 skipped**. |
| Final repair identity / prepared-brief deduplication changes: `journey.test.ts`, `task-input.test.ts`, `focused-delivery.test.ts` | **76 passed** (overlap with the aggregate above, not extra tests). TypeScript and affected-file lint rerun passed. |
| Repository `tsc --noEmit -p .` | Passed, zero errors. |
| ESLint over all 20 changed runtime/UI/test files | Passed, zero errors or warnings. |
| `node scripts/pm/lint.mjs` | Passed, 0 errors / 0 warnings. DLV-118 remains unchecked. |
| `node scripts/pm/check-docs.mjs` | Passed: 11 campaign pairs, 237 unique tasks, 40 active Markdown files. |
| `node scripts/check-feature-index.mjs`; scoped `git diff --check` | Passed. No new route/page/navigation entry needed. |

Reproduction: run `node_modules/.bin/vitest.cmd run tests/delivery-v2 tests/pm-ui tests/pm-relay.test.ts tests/pm-live-relay.test.ts --maxWorkers=2`. In this environment, run the three esbuild files separately with the approved filesystem access and exclude those same files from the sandboxed run. No Docker/provider opt-in flags were set.

Coverage includes legacy/new fingerprints, binding drift, frozen guides, fresh/continued recovery, recommended/queued profiles, incomplete material, holds/dependencies, no job before approval, changed source and snapshot, stale plan revisions, revoked grants, duplicate/replayed launch and approval from the phone, scope growth, failed/inconclusive/zero-test verification, missing/stale candidate verification at Apply, and a successful prepared check/Apply fixture. Both adapter bridges preserve instructions, brief bytes and continuity without invoking SDK models. Recovery materialization is tested using an isolated in-memory filesystem, including identical replay and changed-byte/link refusal.

The existing broader suites retain negative compiler, checker integrity, coordination, qualification, authority, review, relay and Apply coverage. No separate test framework was added. Initial failures were corrected: fixture V2 dispatch mode, the new versioned fingerprint expectation and inferred JavaScript parameter types. Three esbuild tests initially hit sandbox ancestor-directory access denial; their approved rerun outside the sandbox passed.

Remaining limits:

- No rebuilt-container or real-provider test. Four existing opt-in Docker cases remain skipped. Native compaction recovery is supported by a durable input and tested transport/materialization, not a real compaction observation.
- Browser discovery returned no available browser. Shared-component render/export and relay tests pass; responsive visual checks and real-phone acceptance remain unverified.
- Readiness is intentionally explicit and conservative. No current task was opted into the JSON source format; no guide-authoring pass was performed. A detailed prose section or file list alone still investigates.
- Required compiler checks retain their existing host execution/baseline and freshness limits. Stored verdict freshness checks candidate identity and changed paths, not every checkout/configuration byte; Apply preview re-evaluates on current source. Checker isolation remains DLV-133. DLV-114's in-job stopping, DLV-134's unapproved acceptance and historical accounting remain untouched.

## Activation and next owner action

**The worker image needs rebuilding.** `worker/runner.mjs` and `worker/task-brief.mjs` are image contents, not hot-loaded host code. Use the existing worker build/setup mechanism, pin the resulting runtime/image and proxy boundary consistently, and requalify affected executor profiles against that binding. Old qualification/image bindings must not be reused to bypass the new capability requirement. No image, boundary, credentials or installed policy was changed here.

**Reload/restart the local PM supervisor and bridge before use**, after safely reconciling existing work. New backend modules and cached runtime binding need loading; the local PM app is built by its existing startup/watcher. The hosted phone bundle needs the normal future application rebuild/deployment to display the new prepared-plan fields; that deployment was not performed or authorized by this task. Its command schema is unchanged. No DB migration is required.

Next: review this implementation and its test evidence, then arrange runtime activation/requalification and device verification as a separate operational step. An owner-approved real low-risk specification can subsequently adopt the explicit prepared source format; each run still needs Plan approval. **Any live comparison remains separately gated on owner approval.** Passing deterministic tests proves these local behaviors, not reduced tokens, subscription consumption, cost or owner effort.

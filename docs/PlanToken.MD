Proceed with a focused implementation based on:

ERA Notes/10 - Project Management/Research/Delivery — Token Consumption Investigation.md

Goal: make Delivery’s accounting trustworthy, close the verification gap, and remove confirmed unnecessary work. Do not redesign Delivery or assume that starting fresh build conversations is cheaper.

Read the report and the relevant current code first. Account for changes already implemented after the investigated run, including DLV-127 and DLV-128. Reuse existing mechanisms and tests wherever possible.

## Boundaries

- Implement the smallest coherent fixes described below.
- Do not launch Delivery sessions, additional AI workers/subagents, or consumption experiments.
- Local deterministic tests are allowed. Use fixtures or isolated copies, not mutations of historical sessions.
- Do not apply or repair BUD-83 itself in this task. Preserve its candidate and historical evidence.
- Preserve unrelated uncommitted work, worker confinement, owner approvals, and subscription-only restrictions.
- Do not increase budgets, enable automatic repairs, upgrade Codex, or silently broaden permissions.
- Do not open credential files or bypass denied access. Request a narrowly scoped owner-provided export if evidence requires it.
- Resolve ordinary implementation details yourself. Ask only when a genuine permission, scope, or product decision blocks progress.

## 1. Verify and fix accounting

Settle whether the installed Codex version reports per-turn or thread-cumulative usage after resume. Use the pinned implementation/source and available sanitized token events—not SDK comments or numerical plausibility alone.

If cumulative accounting is confirmed:

- Derive incremental usage from the correct previous reading for that thread.
- Preserve raw readings separately from normalized values and record the normalization basis.
- Prevent double counting across resumed jobs and duplicate/replayed events.
- Handle missing baselines, counter resets, and unsupported semantics explicitly; do not silently manufacture complete totals.
- Keep UI totals, job/session summaries, and allowance settlement consistent.

For the BUD-83 fixture, cumulative accounting would imply:

- Planning: 95,740.
- Additional build usage: 397,696.
- Whole session: 493,436.
  These are conditional expectations, not numbers to force the implementation to produce.

Do not blindly sum every token_count event: repeated snapshots may not represent new usage. Do not apply Codex-specific rules to Claude.

If decisive evidence remains unavailable, document the precise blocker and continue independent fixes. Do not ship speculative normalization.

Display uncached input, cached input, and output separately. Keep reasoning identified as a subset where applicable. Do not label uncached tokens “real work” or equate token totals with subscription consumption.

## 2. Record consumption observations and show honest limits

Persist available subscription-window observations before and after jobs, using the existing integration:

- Usage percentage.
- Window/reset identity.
- Observation timestamp.
- Availability or collection errors.

Label these as shared subscription-window observations, not exact per-job consumption. Handle resets, missing values, and possible concurrent usage.

Make the budget UI distinguish estimates, reservations, and admission-only allowances from genuinely enforced limits. Do not present maxTurns as enforced for Codex when it is not supported.

Do not build a new live-budget enforcement system or introduce an arbitrary reservation multiplier in this task. Clearly disclose the remaining limitation and completed overruns.

## 3. Close the verification gap before Apply

Add deterministic typechecking outside the model, using the protected verification path.

Establish that the checker has the required source files, dependencies, project configuration, and relevant generated types. Installing TypeScript alone is not proof of a valid checking environment.

Requirements:

- Validate the exact candidate, with evidence bound to the checked inputs.
- Revalidate when relevant inputs or the integration target change.
- Prevent Apply from treating missing, failed, or stale required verification as a pass.
- Distinguish candidate defects, pre-existing baseline diagnostics, and environment failures.
- An incomplete checking environment must remain inconclusive, not pass through baseline subtraction.
- Retain bounded, sanitized diagnostic artifacts outside model context—not hashes alone.
- Preserve the existing manual laptop gate as an additional safeguard; it is not a substitute for checking the current candidate before Apply.

Use an isolated regression fixture reproducing supabaseAdmin.from versus supabaseAdmin().from to prove the checker detects the defect. Do not edit the historical candidate.

If trustworthy typechecking requires broader infrastructure work, report that boundary and make the missing verification explicit rather than claiming the gap is solved.

## 4. Remove confirmed small waste

- Tell workers accurately that /work lacks Git metadata and identify the supported verification responsibilities.
- Respect the current deterministic-check arrangement; do not reintroduce duplicate model-driven test runs.
- Avoid inserting the full approved plan again only when the exact approved revision is reliably available to the resumed thread.
- Keep a full-plan fallback for fresh threads, changed revisions, compaction, or uncertain context availability.
- Do not ban legitimate rereads of changed files or different ranges.
- Keep the existing resume strategy. Do not remove planning or change model/effort.

## 5. Validate and report

Run relevant deterministic regression tests for accounting, observation handling, prompt construction, verification, and Apply gating. Do not use live model calls to validate these fixes.

Create:
ERA Notes/10 - Project Management/Research/Delivery — Token Consumption Fixes.md

Include:

1. Implemented changes and affected files.
2. Evidence establishing the accounting semantics, or the remaining blocker.
3. Test commands and actual results.
4. What changes reporting versus what can reduce real consumption.
5. Remaining verification and budget limitations.
6. A short proposal for a later owner-approved fresh-versus-resume comparison.

That future comparison must isolate the handoff difference: identical source, approved planning checkpoint, model/effort, environment instructions, and checks; independent executions without cross-contamination. Measure all token categories, interpretable allowance observations, time, and quality—not uncached input alone. Do not execute it now.

Finish with the report path, a brief implementation summary, and any decisions still required from me. Do not claim measured savings without a measurement.

---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Delivery — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>). Evidence cutoff: `3106164`; local artifacts reviewed 2026-09-06. Deltas [Delivery — Master Book](<../Delivery — Master Book.md>) at `updated: 2026-08-01`, with later August entries treated as evidence rather than ignored. Phase 3 specifies future work only; all implementation gates below are **NOT RUN**.
>
> Evidence and ranking: [ASTRA Book](<Delivery — ASTRA Book.md>). Cost/context forensic details: [Command Center — ASTRA Orchestration](<../../Command Center/Command Center — ASTRA Orchestration.md>). Cross-surface finish consistency belongs to CC-3 in [Command Center — ASTRA Packets](<../../Command Center/Command Center — ASTRA Packets.md>).

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-DLV-1 | EXTENDS → DLV-87/88 | DLV-87 / DLV-88 | Existing cost prerequisites; no new queue item |
| ASTRA-DLV-2 | EXTENDS → DLV-87 | DLV-87 | After 1; retain spend/checkpoint before launch |
| ASTRA-DLV-3 | EXTENDS → DLV-69 | DLV-69 | HELD by freeze; correct context units before digest work |
| ASTRA-DLV-4 | EXTENDS → DLV-90 | DLV-90 | Existing prerequisite: zero tests is NOT_TESTED |
| ASTRA-DLV-5 | EXTENDS → DLV-93 | DLV-93 | HELD; competes with 6/R-5 for ONE validation slot |
| ASTRA-DLV-6 | EXTENDS → DLV-93 | DLV-93 | HELD; alternative to 5/R-5, not additive |
| ASTRA-DLV-7 | EXTENDS → DLV-69 | DLV-69 | HELD; after 3 and freeze eligibility |
| ASTRA-DLV-8 | EXTENDS → DLV-86 | DLV-86 | After 1/2 receipts; current phase forecast, not old aggregate |

## 1 · Dispatch, freeze and capacity

These eight sheets refine existing DLV work; they do not allocate eight immediate sessions. Six M + two S cost up to seven sessions, about 3.5 weeks at the owner's total two-session weekly capacity. **Do not spend that whole interval on Delivery.** The Aug6 freeze and DLV-92/93 experiment remain binding.

- 1/2 refine existing cost prerequisites; 4 refines DLV-90. Complete the minimum required proof, then run the selected product item under DLV-92's constraints.
- 5 and 6 are **alternatives competing for DLV-93's single validation-fix allowance after DLV-92**, not two sequential automatic approvals.
- 3/7 remain held DLV-69 work until two genuine product completions or a specifically authorized, product-run-demonstrated need makes them eligible.
- 8 fixes units in the existing DLV-86 forecast after receipts are clean. It does not authorize the frozen auto-calibration/confidence-band platform.
- DLV-89's “one confirmation” is not permission to delete any of the three gate decisions or typed risk approval. Preserve current gate policy unless the owner records a specific amendment.
- The current census does not prove two genuine product completions. A later HUB-1 ACCEPTED state and an older BLOCKED finish package require CC-3 reconciliation, not an assumed SHIPPED outcome.

**Common PM/documentation allowlist P, part of every sheet:** `ERA Notes/10 - Project Management/Delivery/4 - Checklist.md`; `ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md`; `ERA Notes/10 - Project Management/Delivery/ASTRA/Delivery — ASTRA Book.md`; `ERA Notes/10 - Project Management/Delivery/ASTRA/Delivery — ASTRA Packets.md`. Only update the named parent, its evidence and affected contract sections during future implementation. No such parent edits are authorized in this study phase.

**Common forbidden set F, part of every sheet:** `src/components/ui/**`; `src/components/hub/HubPage.tsx` (no sanctioned rider here); `migrations/schema.sql` without a paired migration; every path outside that sheet's exact allowlist plus P. No git writes, DB calls, live-driver launches, new dependency, production-connected script or modifications of historical session artifacts. Tests use fake SDK/drivers and temporary fixtures.

**Common gate G, part of every sheet:** run the named regression command with verbose results, then `pnpm typecheck`, `pnpm lint`, and `pnpm pm:lint`. Required result: each exits 0, each named regression actually executes, no test-count decline. Record command, exit code and relevant output. A zero-match/skipped regression is not a pass. The existing PM lint failure for missing DLV-77 SQL must be resolved through separately authorized evidence-based work before implementation completion; do not invent a migration to silence it.

**Common NOT done N, part of every sheet:** migration written ≠ **APPLIED**; test file ≠ test in CI include; local pass ≠ evidence pasted; emitted diagnostic ≠ enforced invariant; child complete ≠ parent complete. No sheet below claims real billing, phone delivery or end-to-end product completion.

**PM dispatch rule:** a parent stays unchecked until all its own acceptance criteria pass, even if a child here ships. Append the stated partial Shipped Log sentence with actual date, commit and artifact. No new canonical DLV integer is allocated by these study IDs. Copy P/F/G/N and the STOP block with any individually dispatched sheet so its allowlist and constraints remain self-contained.

### STOP block — S1–S12, included in every sheet

- **S1:** Any file outside the exact allowlist needs editing.
- **S2:** A live DB operation is required. Hand the owner a manual runbook and wait for **APPLIED** evidence; never execute it.
- **S3:** Typecheck/lint/tests are red, tests disappear, or the targeted regression does not execute.
- **S4:** HubPage grows or its internals must be imported.
- **S5:** A new dependency is required; no exception is granted here.
- **S6:** The work exceeds one 2–4h session; split at a verified boundary instead of stretching an M.
- **S7:** A visibility symptom appears; obtain Hard Rule 27's owner DB-state evidence before diagnosing routes.
- **S8:** Money/schedule semantics or cost-unit semantics are ambiguous; preserve unknown and obtain the missing evidence.
- **S9:** An AI proposal would write without the required owner confirmation.
- **S10:** A second queue, state machine, accounting engine, digest engine or overlapping validation system would be introduced.
- **S11:** Work enters D2's excluded scope.
- **S12:** Existing /era layout or styling would change.

## 2 · Plan reconciliation

| Study ID | Classification | Existing parent | Product item unblocked | Eligibility / refinement |
|---|---|---|---|---|
| ASTRA-DLV-1 | EXTENDS → DLV-87/DLV-88 | Cost completeness and cost basis | HUB-47 / E-11 | Existing cost prerequisites; correct cumulative units |
| ASTRA-DLV-2 | EXTENDS → DLV-87 | No silently uncapped spend | HUB-47 / E-11 | After 1; conserve returned retry bank and checkpoint before UAT |
| ASTRA-DLV-3 | EXTENDS → DLV-69 | Correct inherited context | HUB-47 / E-11 | Held; request context separated from throughput |
| ASTRA-DLV-4 | EXTENDS → DLV-90 | Zero tests never PASSED | HUB-37 / E-01 | Existing prerequisite queue |
| ASTRA-DLV-5 | EXTENDS → DLV-93 | One post-experiment validation fix | HUB-47 / E-11 | Conditional after DLV-92; competes with 6 |
| ASTRA-DLV-6 | EXTENDS → DLV-93 | One post-experiment validation fix | HUB-47 / E-11 | Conditional after DLV-92; alternative to 5 |
| ASTRA-DLV-7 | EXTENDS → DLV-69 | Rotation receives its digest | HUB-47 / E-11 | After 3 and freeze eligibility |
| ASTRA-DLV-8 | EXTENDS → DLV-86 | Existing forecast, truthful units | HUB-37 / E-01 and HUB-47 / E-11 | After 1/2; no new calibration platform |

Product references identify useful work made safer; they do not assert that each full parent meets DLV-92's size, nonvisual and no-money/security criteria. Select an eligible bounded product slice explicitly at that experiment's launch.

**Retained parent obligations:** DLV-87 still requires unknown-cost/provider launch policy; DLV-88 still requires owner-confirmed billing basis and honest labels; DLV-86 still requires provenance and measured effort treatment when sufficient clean observations exist. DLV-68/91 retain stub/progress/ownership work; no replacement packet is invented here. DLV-52/84 type/hook debt remains module-by-module. DLV-77 stays owner-only with current DB evidence. DLV-92/93 retain their product experiments and governance conditions.

## 3 · Execution sheets

### ASTRA-DLV-1 · Normalize cumulative SDK cost once · M · H · Phase 0 support

**Outcome:** A reused provider session records each incremental charge once without presenting an estimate as a cash bill.

**Prereqs:** DLV-87/DLV-88 scope accepted; inspect the installed SDK result contract and Orchestration's redacted Aug6 receipt fixture. No migration required or presumed APPLIED. Unknown billing basis remains unknown. No paid provider call is needed.

**Skills:** start-task → fix-bug → money-rules → finish-task.

**Files:** `scripts/delivery/drivers/claude.mjs`; `scripts/delivery/drivers/driver.mjs`; `scripts/delivery/usage.mjs`; `tests/delivery/drivers-claude.test.ts`; `tests/delivery/drivers-claude-segments.test.ts`; `tests/delivery/usage.test.ts`; plus P. F applies.

**Contract:** At the adapter boundary retain the raw cumulative value and its query/process-epoch provenance; return an incremental charge for the observed attempt. Carry the cursor in the existing driver segment/ref representation. Do not subtract across a fresh query, restart, counter reset or unknown baseline. Re-normalizing the same result cannot advance the cursor twice. Separate provider-reported, estimated and unknown values; do not relabel SDK API-equivalent cost as confirmed cash billing. If safe restart recovery requires a wider durable receipt migration than these files support, stop at S1/S6 and hand off that requirement.

**DB change?:** No. Existing local driver/ref artifacts only; no DB migration or APPLIED claim.

**AI call added?:** No new call. Existing result normalization changes; verification uses the fake SDK.

**Money/schedule math?:** Yes, Delivery cost only. Cumulative $0.10 → $0.30 → $0.45 yields incremental $0.10, $0.20, $0.15 and total $0.45, not $0.85. New-query $0.04 is independent; an unexplained decrease is unknown, never negative/free. Before/after fixture and tests required.

**Gate:**

```powershell
pnpm exec vitest run tests/delivery/drivers-claude.test.ts tests/delivery/drivers-claude-segments.test.ts tests/delivery/usage.test.ts --reporter=verbose
```

Exit 0; executed cases cover cumulative deltas, repeated normalization, new query, restart/reset ambiguity and reported-versus-estimated provenance. Existing streaming reuse and failure cases stay green. Then G.

**PM:** Keep DLV-87/DLV-88 unchecked until all parent criteria pass. Partial Shipped Log: `- ✅ YYYY-MM-DD — **DLV-87** (ASTRA-DLV-1 partial) SDK cumulative cost is normalized to scoped incremental receipts (also refines DLV-88); provenance and reset tests: <evidence>.`

**NOT done:** N applies. SDK telemetry is not proof of actual billing; this does not repair historical session files or add provider pricing.

**STOP:** S1–S12. Product item unblocked: HUB-47 / E-11; this is Delivery support, not completion of that product item.

### ASTRA-DLV-2 · Conserve retries and checkpoint the paid-turn boundary · M · H · Phase 0 support

**Outcome:** A successful retry includes its failed attempts, and an exhausted review cannot spend another UAT turn.

**Prereqs:** ASTRA-DLV-1; current DLV-87 policy retained. No migration required or presumed APPLIED. This is the returned-attempt bank plus the existing REVIEW→UAT boundary, not a new receipt database or watchdog.

**Skills:** start-task → fix-bug → money-rules → finish-task.

**Files:** `scripts/delivery/run-session.mjs`; `tests/delivery/run-session.test.ts`; `tests/delivery/runner-crash.test.ts`; `tests/delivery/failure-scenarios.test.ts`; plus P. F applies.

**Contract:** Fold the failed-attempt bank into successful and guard-failed turn returns exactly once; retain reported/estimated provenance from 1. After REVIEW completes, persist its receipt and phase checkpoint before UAT. Apply the existing budget/stop controls at that boundary. Resume a checkpointed review that the existing handler admitted directly into pending UAT after owner-authorized continuation; do not repay REVIEW. Existing review-validity policy is unchanged here; ASTRA-DLV-6 separately enforces valid review meaning and is not a prerequisite for this accounting repair. Keep the same state machine and three gates. Inject a crash between checkpoint and UAT to prove replay safety. A process crash inside an unfinished SDK attempt remains an explicit unknown receipt; durable allocation/stub work stays DLV-68, not a silently enlarged packet.

**DB change?:** No. Existing local state/artifacts only.

**AI call added?:** No added call; prevents an unauthorized next existing call. Fake driver only in verification.

**Money/schedule math?:** Yes. Failed attempt $0.02 plus successful retry $0.03 must produce $0.05. Existing session $0.45 plus REVIEW $0.10 under a $0.50 cap records $0.55, starts zero UAT calls, and preserves $0.55 on restart. Returning the checkpoint cannot add the same $0.10 twice.

**Gate:**

```powershell
pnpm exec vitest run tests/delivery/run-session.test.ts tests/delivery/runner-crash.test.ts tests/delivery/failure-scenarios.test.ts --reporter=verbose
```

Exit 0; named cases prove failed→success conservation, guard failure retains spend, cap crossed by REVIEW prevents UAT, crash after REVIEW preserves cost, and resumed UAT does not rerun REVIEW. Then G.

**PM:** Keep DLV-87 unchecked until unknown-cost/provider launch criteria also pass. Partial Shipped Log: `- ✅ YYYY-MM-DD — **DLV-87** (ASTRA-DLV-2 partial) Retry receipts conserve spend and REVIEW checkpoints before UAT/cap enforcement; fake-driver crash evidence: <evidence>.`

**NOT done:** N applies. This does not promise an exact cash cap while a single provider attempt is in flight, nor reconstruct unobserved spend after arbitrary process death.

**STOP:** S1–S12. Product item unblocked: HUB-47 / E-11; this is Delivery support, not completion of that product item.

### ASTRA-DLV-3 · Separate request context from token throughput · M · H · Held until freeze eligibility

**Outcome:** The context gauge and rotation trigger describe a request's footprint instead of the total traffic of a long tool loop.

**Prereqs:** DLV-69 eligibility under the Aug6 freeze: two real product completions or an explicit authorized product-run-demonstrated need. Identify provider request-level telemetry in the installed SDK before editing. No migration required or presumed APPLIED.

**Skills:** start-task → fix-bug → finish-task.

**Files:** `scripts/delivery/drivers/claude.mjs`; `scripts/delivery/drivers/driver.mjs`; `scripts/delivery/usage.mjs`; `scripts/delivery/run-session.mjs`; `scripts/delivery/context-policy.mjs`; `tests/delivery/drivers-claude.test.ts`; `tests/delivery/usage.test.ts`; `tests/delivery/context-policy.test.ts`; `tests/delivery/run-session-context.test.ts`; plus P. F applies.

**Contract:** Capture latest and peak input-side request footprint from deduplicated request/message identities; carry it separately from total result usage. Feed the measured latest footprint, its provenance and window estimate into the existing rotation policy. Preserve total throughput for usage/cost only. Absent request telemetry yields unknown; do not divide aggregate traffic by a guessed request count or silently substitute zero. Keep owner-requested rotation and existing retry-based advisory behavior. No threshold retuning without a clean unit.

**DB change?:** No.

**AI call added?:** No new call; use existing request events.

**Money/schedule math?:** No money or schedule calculation changes. Required unit fixture: ten requests of 50,000 input-side tokens produce 500,000 throughput but 50,000 latest/peak context, not 500,000 occupancy.

**Gate:**

```powershell
pnpm exec vitest run tests/delivery/drivers-claude.test.ts tests/delivery/usage.test.ts tests/delivery/context-policy.test.ts tests/delivery/run-session-context.test.ts --reporter=verbose
```

Exit 0; executed cases cover repeated chunks of one request, multiple requests, unknown provider telemetry, true high-context rotation, and high-throughput/low-context no-rotation. Then G.

**PM:** Keep DLV-69 unchecked until its digest-consumption criterion also passes. Partial Shipped Log: `- ✅ YYYY-MM-DD — **DLV-69** (ASTRA-DLV-3 partial) Rotation uses request context with explicit unknown telemetry; throughput no longer masquerades as occupancy: <evidence>.`

**NOT done:** N applies. No new context manager, provider comparison, model recommendation, threshold tuning or automatic freeze waiver.

**STOP:** S1–S12. Product item unblocked: HUB-47 / E-11; this is Delivery support, not completion of that product item.

### ASTRA-DLV-4 · Zero selected tests means NOT_TESTED · S · H · Phase 0 support

**Outcome:** A targeted run that executes no tests cannot be reported as passed.

**Prereqs:** DLV-90; inspect installed Vitest reporting supported by the current package before choosing count extraction. No new dependency, migration or APPLIED prerequisite.

**Skills:** start-task → fix-bug → finish-task.

**Files:** `scripts/delivery/run-session.mjs`; `scripts/delivery/validation-baseline.mjs`; `scripts/delivery/instant.mjs`; `tests/delivery/run-session.test.ts`; `tests/delivery/validation-baseline.test.ts`; `tests/delivery/run-session-instant.test.ts`; plus P. F applies.

**Contract:** Record an explicit outcome with selected-file and executed-test counts from structured runner output where available. Zero files or zero executed tests is NOT_TESTED, not `ok:true`. A governed skip remains a skip with its reason; do not forge test evidence. INSTANT cannot use NOT_TESTED to satisfy its first-pass validation prerequisite; follow the existing escalation/owner decision path. Preserve stdout excerpts for diagnosis, but do not rely on one English message as the only detector.

**DB change?:** No.

**AI call added?:** No new call is added by the check itself. A formerly false INSTANT pass can take its existing review/escalation path; do not hide that cost.

**Money/schedule math?:** No.

**Gate:**

```powershell
pnpm exec vitest run tests/delivery/run-session.test.ts tests/delivery/validation-baseline.test.ts tests/delivery/run-session-instant.test.ts --reporter=verbose
```

Exit 0; executed cases cover zero matching files, files with all tests skipped, one real passing test, one failing test, and INSTANT NOT_TESTED escalation. Output proves the cases ran. Then G.

**PM:** Tick DLV-90 only after these semantics reach its validation artifact and INSTANT consumer. Shipped Log: `- ✅ YYYY-MM-DD — **DLV-90** (ASTRA-DLV-4) Targeted zero-test runs record NOT_TESTED and cannot satisfy INSTANT validation; count-based regressions: <evidence>.`

**NOT done:** N applies. A regression test existing on disk is insufficient; HUB-37/E-01 still owns CI inclusion and executed workflow evidence.

**STOP:** S1–S12. Product item unblocked: HUB-37 / E-01; this is Delivery support, not completion of that product item.

### ASTRA-DLV-5 · Bind INSTANT edits and acceptance to their proof · M · H · After DLV-92, conditional validation slot

**Outcome:** INSTANT accepts only the approved replacement and leaves unrelated behavioral criteria unproven.

**Prereqs:** ASTRA-DLV-4; DLV-92 evidence; owner selects this as DLV-93's one validation fix instead of ASTRA-DLV-6. No migration required or presumed APPLIED. Preserve all three gate decisions.

**Skills:** start-task → fix-bug → finish-task.

**Files:** `scripts/delivery/instant.mjs`; `scripts/delivery/acceptance.mjs`; `scripts/delivery/run-session.mjs`; `tests/delivery/instant.test.ts`; `tests/delivery/acceptance.test.ts`; `tests/delivery/run-session-instant.test.ts`; plus P. F applies.

**Contract:** Verify that the entire session-attributed added/removed edit matches the approved replacement; surplus changes in the same file escalate, even below 20 lines. Preserve existing dirty-baseline scoping. Add an explicit approved association between an AC and its allowed proof class in the existing spec/acceptance artifact, limited here to declaration equivalence and executed validation. Runtime/device/owner-observation ACs remain unmet until that evidence exists. Do not infer proof class from keyword heuristics or mark every AC met. General file existence stays a provenance pointer, not behavioral proof. If generalizing the schema would exceed M, narrow INSTANT eligibility to an explicitly approved declaration-only AC contract and hand the remainder back.

**DB change?:** No.

**AI call added?:** No new call on a valid exact edit; existing real review handles mismatches. No additional reviewer architecture.

**Money/schedule math?:** No product money/schedule logic changes. The negative fixture intentionally uses an offline transaction AC: it must remain unmet without the domain test.

**Gate:**

```powershell
pnpm exec vitest run tests/delivery/instant.test.ts tests/delivery/acceptance.test.ts tests/delivery/run-session-instant.test.ts --reporter=verbose
```

Exit 0; exact declared replacement passes; an extra same-file boolean edit escalates; an unrelated existing file cannot satisfy a runtime AC; a two-phone AC remains unmet after a synthetic file edit; dirty-baseline exclusions remain valid. Then G.

**PM:** Do not tick DLV-93 merely for this fix: its next genuine product run remains required. Partial Shipped Log: `- ✅ YYYY-MM-DD — **DLV-93** (ASTRA-DLV-5 validation slice) INSTANT rejects surplus edits and binds AC status to an approved proof class; next product run still pending: <evidence>.`

**NOT done:** N applies. No claim that test passage proves physical phone delivery. ASTRA-DLV-6 is not automatically authorized after this sheet.

**STOP:** S1–S12. Product item unblocked: HUB-47 / E-11; this is Delivery support, not completion of that product item.

### ASTRA-DLV-6 · Require a valid review before UAT · S · H · After DLV-92, alternative validation slot

**Outcome:** An unreadable or missing review verdict stops before UAT with its spend preserved.

**Prereqs:** ASTRA-DLV-2; DLV-92 evidence; owner selects this as DLV-93's one validation fix instead of ASTRA-DLV-5. No migration required or presumed APPLIED.

**Skills:** start-task → fix-bug → finish-task.

**Files:** `scripts/delivery/run-session.mjs`; `scripts/delivery/acceptance.mjs`; `tests/delivery/run-session.test.ts`; `tests/delivery/acceptance.test.ts`; plus P. F applies.

**Contract:** Require the existing documented review verdict enum and readable required findings before advancing. A missing/unknown verdict, unreadable findings, or structurally invalid finding is a blocked review, not an empty pass. Preserve supported JSON-string array normalization when it yields valid arrays. Keep diagnostic events, raw evidence and accumulated usage. Valid BLOCK follows the existing fix loop; valid PASS/PASS_WITH_NOTES follows current UAT. No new state or gate.

**DB change?:** No.

**AI call added?:** No extra routine call. Retrying a blocked malformed review remains an explicit existing owner decision.

**Money/schedule math?:** No new money algorithm. Existing malformed-review receipt must remain intact; test it with a known $0.10 fixture.

**Gate:**

```powershell
pnpm exec vitest run tests/delivery/run-session.test.ts tests/delivery/acceptance.test.ts --reporter=verbose
```

Exit 0; missing verdict, unknown verdict and malformed findings start zero UAT calls; valid stringified arrays normalize; valid PASS/BLOCK preserve their paths; malformed review retains $0.10 charged usage. Then G.

**PM:** Leave DLV-93 unchecked pending its second product experiment. Partial Shipped Log: `- ✅ YYYY-MM-DD — **DLV-93** (ASTRA-DLV-6 validation slice) Invalid review meaning cannot advance to UAT; usage-preserving regressions: <evidence>.`

**NOT done:** N applies. This fixes review validity; it does not repair arbitrary AC evidence or authorize ASTRA-DLV-5 as an additional validation slice.

**STOP:** S1–S12. Product item unblocked: HUB-47 / E-11; this is Delivery support, not completion of that product item.

### ASTRA-DLV-7 · Feed the existing rotation package once · M · H · Held until freeze eligibility

**Outcome:** A fresh rotated provider session receives the decisions and exploration summary already assembled on disk.

**Prereqs:** ASTRA-DLV-3 and DLV-69 freeze eligibility; inspect existing rotation and explicit-handoff behavior together. No migration required or presumed APPLIED.

**Skills:** start-task → fix-bug → finish-task.

**Files:** `scripts/delivery/run-session.mjs`; `scripts/delivery/prompts.mjs`; `scripts/delivery/context-assembly.mjs`; `tests/delivery/run-session-context.test.ts`; `tests/delivery/run-session-handoff.test.ts`; `tests/delivery/prompts.test.ts`; plus P. F applies.

**Contract:** Use the rendered package already saved by performRotation as bounded input to the first subsequent fresh-session prompt. Record its snapshot identity and consumption at the existing session boundary; do not inject it again into every warm turn. Preserve open owner questions, decisions, pins and exact source pointers. A restart before confirmed consumption may resend only under a clearly defined fresh-session rule; do not silently mark a failed send consumed. Keep handoff verification behavior and the current tool allowlists. No new summarizer or retrieval store.

**DB change?:** No.

**AI call added?:** No additional call. Prefix the next already-planned call with the existing bounded package.

**Money/schedule math?:** No.

**Gate:**

```powershell
pnpm exec vitest run tests/delivery/run-session-context.test.ts tests/delivery/run-session-handoff.test.ts tests/delivery/prompts.test.ts --reporter=verbose
```

Exit 0; fake driver observes the selected digest and owner decision in the first fresh-session prompt, no duplicate on the next warm turn, retry/restart obeys the consumption contract, and explicit handoff still verifies context. Then G.

**PM:** Tick DLV-69 only after both correct context inputs and rotated package consumption pass its acceptance. Shipped Log: `- ✅ YYYY-MM-DD — **DLV-69** (ASTRA-DLV-3/7) Rotation consumes the existing bounded context package with request-level context evidence; fake-driver prompt trace: <evidence>.`

**NOT done:** N applies. A context snapshot on disk does not prove the next model received it; the captured prompt is the gate.

**STOP:** S1–S12. Product item unblocked: HUB-47 / E-11; this is Delivery support, not completion of that product item.

### ASTRA-DLV-8 · Give the active forecast consistent units · M · H · Phase 0 support after receipt repair

**Outcome:** The flight-check forecast uses clean evidence without multiplying a historical phase total twice.

**Prereqs:** ASTRA-DLV-1/2; DLV-86 scope remains the current forecaster, not frozen auto-calibration/confidence bands. Use only histories whose receipt provenance passes the new contract; historical damaged totals are ineligible. No migration required or presumed APPLIED.

**Skills:** start-task → fix-bug → money-rules → finish-task.

**Files:** `scripts/delivery/recommendation.mjs`; `scripts/delivery/server-routes.mjs`; `tests/delivery/recommendation.test.ts`; `tests/delivery/server-routes.test.ts`; plus P. F applies.

**Contract:** Make history explicitly carry per-phase totals and observed traversal counts, then normalize to a per-traversal prior before multiplying expected traversals once. Reject samples with missing counts, ambiguous receipt units or incomplete provenance instead of treating them as zero. Preserve the current three-sample threshold, lane shape and registry source of truth. Before three clean comparable observations, retain labeled static priors; do not invent measured precision. Record existing model/effort/lane provenance and refuse to present unlike observations as directly comparable; any expanded statistical calibration is held.

**DB change?:** No.

**AI call added?:** No new call; read existing validated artifacts.

**Money/schedule math?:** Yes, forecast token/cost units. Three histories each have BUILDING total 300 tokens over three traversals: prior is 100/traversal; an M forecast with three traversals is 300, not 900. Preserve four token buckets and apply existing local price inputs once; missing pricing stays unknown.

**Gate:**

```powershell
pnpm exec vitest run tests/delivery/recommendation.test.ts tests/delivery/server-routes.test.ts --reporter=verbose
```

Exit 0; executed fixtures prove 300/3×3=300, unequal traversal counts normalize correctly, fewer than three clean samples stays static, ambiguous legacy receipts are excluded, and INSTANT does not forecast absent review/UAT calls. Then G.

**PM:** Keep DLV-86 unchecked until its remaining measured-effort/provenance criteria are satisfied with adequate clean data. Partial Shipped Log: `- ✅ YYYY-MM-DD — **DLV-86** (ASTRA-DLV-8 partial) Active forecast distinguishes phase totals from per-traversal priors and excludes ambiguous history; clean-unit regressions: <evidence>.`

**NOT done:** N applies. A repaired equation is not a calibrated prediction; no live sample acquisition or historical data rewrite is included.

**STOP:** S1–S12. Product item unblocked: HUB-47 / E-11; this is Delivery support, not completion of that product item.

## ASTRA 10× Findings

**High-confidence leverage moves (3):**

1. **EXTENDS → DLV-87/DLV-88:** ASTRA-DLV-1/2 normalize and conserve one receipt instead of patching every budget/forecast display; Book F1/F2 provide the evidence.
2. **EXTENDS → DLV-90/DLV-93:** ASTRA-DLV-4 plus the eligible validation alternative makes absent proof a real state, not green by omission; Book F3–F5.
3. **EXTENDS → DLV-69, held:** ASTRA-DLV-3/7 reuse existing request telemetry and digest artifacts to remove false rotations and repeated exploration; Book F6.

**Simplification / deletion (1):** **EXTENDS → DLV-69:** remove throughput from occupancy decisions instead of tuning around a wrong unit (`usage.mjs:137`; `context-policy.mjs:65–76`).

**Frontier (1):** **NEW, parked:** the Book's artifact-evidence replay experiment has no immediate packet. Two genuine completions, exact evidence reconstruction and a measured 30% reduction in owner review time are its prerequisites.

**Uncomfortable finding (1):** Eight plausible tooling sheets already represent up to seven scarce sessions. The freeze is justified: select the few that make the next product task safe, then obtain product evidence before spending the remainder (Delivery checklist §Now; Design Doctrine §6).

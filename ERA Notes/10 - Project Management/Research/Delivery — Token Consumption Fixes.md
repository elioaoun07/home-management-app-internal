---
created: 2026-09-20
updated: 2026-09-20
type: implementation-report
status: active
owner: Elio
evidence_cutoff: 2026-09-20T01:40Z
---

# Delivery — Token Consumption Fixes

[PM home](<../_index.md>) · Campaign: [Delivery](<../Delivery/Delivery — Master Book.md>) · Investigation: [Token Consumption Investigation](<Delivery — Token Consumption Investigation.md>)

> Implementation of the four workstreams in the investigation's §7. No Delivery session was launched, no AI worker or subagent was started, and no consumption experiment was run. Everything measured below is a local deterministic run. The BUD-83 candidate and its evidence are untouched.

---

## 1. The accounting question is settled: the Codex counter is thread-cumulative

The investigation left F3 open — whether `turn.completed.usage` is per-turn or cumulative for the thread after a resume — and named the rollout file as the artifact that would settle it. It is settled from the pinned implementation instead, which is stronger: it says what the counter *is*, not what one run's numbers are consistent with.

The chain, all at tag `rust-v0.144.1` (the version `@openai/codex-sdk` 0.144.1 bundles):

1. `codex-rs/exec/src/event_processor_with_jsonl_output.rs:520-521` emits `TurnCompleted { usage: self.usage_from_last_total() }`.
2. `usage_from_last_total()` (`:117-126`) reads `usage.total`, **not** `usage.last`.
3. `ThreadTokenUsage.total` is `TokenUsageInfo.total_token_usage` (`codex-rs/app-server-protocol/src/protocol/v2/thread.rs:1381-1396`).
4. `total_token_usage` accumulates every request: `append_last_usage` does `total.add_assign(last)` (`codex-rs/protocol/src/protocol.rs:2066-2069`).
5. On resume the session seeds that counter from the last `TokenCount` event in the rollout — `last_token_info_from_rollout` at `codex-rs/core/src/session/mod.rs:1496-1501`, called from the `InitialHistory::Resumed` branch at `:1368-1372`. So the total carries across `codex.resumeThread`.

Corroboration from local data, independent of the source: 332 Codex rollouts under `~/.codex/sessions` all show `total_token_usage` growing monotonically while `last_token_usage` tracks a single request, and six of them — forked/resumed threads — open with a `total` already in the millions while their first `last` is small or zero. The counter demonstrably survives a new process on the same conversation.

The SDK's own doc comment ("usage during a turn") is what made this look per-turn for two runs. It describes the type, not the exec layer's choice of counter.

**Consequence for run r-83dddb67fea9**, now enforced by fixture:

| Quantity | Before | After |
|---|---:|---:|
| Planning job | 95,740 | 95,740 |
| Build job (own spend) | 493,436 | **397,696** |
| Session total | **589,176** | **493,436** |

These are the investigation's conditional expectations, reproduced exactly (`tests/delivery-v2/usage-normalization.test.ts`). The 589,176 figure was one run counted twice, not tokens the plan paid for twice.

### What changed in the code

- **`scripts/delivery-v2/usage-normalization.mjs`** (new). Counter semantics as data (`per-turn` / `thread-cumulative` / `unknown`), per-reading normalization, and the baseline rules. Statuses: `direct`, `delta`, `thread-start`, `baseline-missing`, `counter-reset`, `unsupported-semantics`. Only the first three are "complete"; the rest keep the raw value and mark the total as not a measurement.
- **`adapters/codex.mjs`** declares `thread-cumulative` on every reading and no longer *sums* turns within a dispatch — under a cumulative counter turn 2 already contains turn 1, so the dispatch's raw state is its largest reading. Replayed readings of the same turn are still merged by replacement.
- **`adapters/claude.mjs`** declares `per-turn` explicitly. The Codex rule is not applied to Claude anywhere; the semantics travel with the reading.
- **`jobs.mjs`** (`recordDispatchResult`) derives each reading's increment against the correct previous reading *for that thread*: the parent job's raw reading when `continues_job_id` names a job on the same `native_ref`, chained across turns within a job. A resume that fell back to a fresh thread subtracts nothing.
- **`store.mjs`** schema 7 keeps both: the existing columns now hold normalized values (so every existing consumer is correct without change), new `raw_*` columns hold the provider's own numbers (the next job's baseline), and `counter_semantics` + `normalization_json` record the basis. Rows written earlier have `normalization_json IS NULL`, which means "raw, uninterpreted" and is reported as such.
- **`resourceSummary`** exposes `provenance.rawProviderTokens` beside `measuredTokens`, plus a `normalization` health block, and adds any unnormalizable reading to `unknown` so an allowance check cannot treat it as settled.

### Double counting, resets and missing baselines

- **Across resumed jobs** — the hole that produced 589,176 — is closed by the delta.
- **Duplicate/replayed events** were already handled by turn-keyed replacement and the `(job_id, reading_key)` primary key; both are still fixtured.
- **A missing baseline** (parent on the same thread recorded no reading) stores the raw value with status `baseline-missing`, flags the run, and never pretends the job spent the whole thread total.
- **A counter that decreases** is a reset, not a refund: the raw value is kept, the reading is marked incomplete, and nothing negative enters a total.
- **Undeclared semantics** are left uninterpreted rather than guessed.

**Historical rows are not rewritten.** The BUD-83 run still displays its stored 589,176 with the qualification attached, because retroactively editing a historical session's accounting is exactly the kind of silent restatement this work exists to stop. What the owner sees now is both numbers and the reason they differ. If you want history normalized, that is a one-off migration to decide separately.

---

## 2. Subscription-window observations are recorded, and labelled as shared

`prepareSubscription` read `used_percent` and threw it away (F9). It now returns the usage snapshot; the worker normalizes it in-process and emits only percentages, window identity, reset instant and plan tier — the raw payload never crosses the container boundary.

- **`scripts/delivery-v2/subscription-window.mjs`** (new) normalizes both providers' shapes, records `unavailable` (never 0%) when a reading fails, and compares two observations only when they are the same window instance — a window that reset between them yields a note, not a negative "saving".
- **`worker/subscription.mjs`** gains `readSubscriptionWindows`, a read-only probe that never throws and gates nothing.
- **`worker/runner.mjs`** emits the preflight observation before the job and takes a second reading after the SDK stream closes.
- **`worker-boundary.mjs`** relays both as `era_subscription` records; the adapters keep them beside the token counters, and `jobs.mjs` stores them on the job (`jobs.subscription_json`).

Every label says what this is: *shared subscription-window observations bracketing this job; the difference is an upper bound on what this job consumed and is attributable to it only if nothing else used the account in between.* No code converts a percentage into tokens or into a per-job cost.

### Budget honesty

- The allowance reads **"admission limit"** in the UI, not "threshold", with a hover saying it is checked when a job is admitted and does not stop a running one.
- A job's reservation is tagged `admission-estimate` in the projection. (For the investigated build it was 50,000 against ~398,000 actually spent.)
- `maxTurns` is no longer recorded as a limit for Codex: `nativeLimitsFor` sets it null with `unsupported: ["maxTurns"]` and a basis line, because it is never passed to that SDK and a Codex job is one turn anyway.
- Tokens display as **uncached · cached · out** (reasoning shown as a subset of output when present). "Fresh" is gone as a label and nothing is described as "real work". Where the provider counter differs from the normalized total, both are shown.

No live budget enforcement was built and no reservation multiplier was introduced. In-job stopping remains DLV-114; the completed overrun of run r-83dddb67fea9 (settled against a 400,000 allowance) stays visible.

---

## 3. The verification gap is closed before Apply — with a real compiler

A deterministic typecheck now runs outside the model, and Apply refuses without it.

**What it compiles.** Not the 29-file snapshot — that is not a program, and `tsc` over it would report hundreds of unresolved-module errors in both baseline and candidate, which baseline subtraction would happily cancel into a "pass". It compiles **the host checkout with the candidate's bytes overlaid**, which is also the integration target Apply will write to.

**How, without copying or writing.** The first implementation staged a copy of the source tree per check; on this machine that copy alone ran **over twelve minutes** of pure I/O for ~2,100 files before it was abandoned. `scripts/delivery-v2/typecheck-runner.mjs` instead overlays the candidate inside a TypeScript `CompilerHost`: `readFile`/`fileExists`/`getSourceFile` answer from the frozen candidate for changed paths and from the checkout for everything else. Nothing is copied and the checkout is never written — the same rule Apply operates under.

**Environment completeness is established, not assumed** (`environmentVerdict`): the compiler must have started, a tsconfig must exist, the baseline must be free of environment-shaped diagnostics (TS2307/2688/5012/5083/6053/6059/18003), and a non-zero exit with nothing parseable is a failed compiler, not a failed candidate. Any of these → **inconclusive**, never a pass, and never baseline subtraction. A candidate that touches `tsconfig*.json`, `package.json`, a lockfile or `node_modules` also makes the check inconclusive, because then it is not independent of the candidate.

**Binding and staleness.** The verdict records `checked_inputs` (candidate id + the exact changed paths). `verificationIsFresh` rejects a verdict for another candidate or a different changed set. Because the check is injected into `evidenceFor`, it re-runs both when checks run and at Apply preview time (`reassess`), so a moved integration target is re-graded rather than inherited.

**Apply gating.** `candidateVerified` now requires it (`required_for: "candidate"`), and `applyCandidate` additionally refuses with `required-verification-missing-failed-or-stale` when the latest result carries no typecheck entry at all — the case of a result recorded before this existed, which proves nothing about typechecking and must not pass through.

**Artifacts.** Bounded, sanitized diagnostics (max 200, messages clipped to 400 chars, no absolute paths, no environment values) are written to `.delivery/v2/artifacts/typecheck/<verification_id>.json` and linked from the evidence record. Hashes alone would leave the owner with "something failed"; nothing is fed back to the model.

**The manual laptop gate is untouched.** DLV-128's post-Apply owner test gate still locks the next delivery. It validates *checkout + candidate* after the fact; this validates *this candidate* before Apply. Both, as the plan asks.

### Proof against the real defect

An isolated fixture reproduces candidate C1's shape — `supabaseAdmin` exported as a function, used as a client — and a real `tsc` program is run over it. The historical candidate is not read or edited.

Additionally, the checker was run against **this checkout** with a synthetic candidate carrying the same defect (scratch only; nothing written to the repo):

| Scenario | Environment | Baseline | Candidate | Verdict | Wall clock |
|---|---|---:|---:|---|---:|
| Harmless addition | complete | 0 | 0 | `satisfied` | 232 s |
| `supabaseAdmin.from(...)` injected | complete | 0 | 1 | **`failed`** | 186 s |

The failing run's single diagnostic: `src/lib/utils/splitBill.ts(95,24): error TS2339: Property 'from' does not exist on type '() => SupabaseClient<...>'.` **This is the defect that reached `verified_candidate` on 2026-09-19.** It is now caught before Apply.

The checker also found its own first real bug during this work: eight TS2345 diagnostics from a stale JSDoc signature left behind by the rewrite. Fixed; the repo typecheck is clean.

**Cost and remaining limits.** ~90–120 s per compile, so ~3–4 minutes per verification (two compiles), on the host, with no model tokens. That is slower than `pnpm typecheck` (~35 s) because the CLI reuses its incremental build info and this does not; making the overlay incremental is possible but was not attempted, since a wrong cache here would be a false pass. Two honest limits remain: the check runs on the **host**, not in the protected container (the container has neither the source closure nor TypeScript — the `/deps` volume holds 41 packages, vitest and React, no `typescript`), so it is deterministic and outside the model but not inside the checker's isolation boundary; and it grades a candidate against the checkout **as it is now**, so uncommitted work in the tree is part of the baseline.

---

## 4. Confirmed small waste removed

- **`/work` has no Git.** Every executor prompt now carries `WORKSPACE_FACTS`: the workspace is a file snapshot with no Git metadata, git commands fail, report changes in the reply instead. Run r-83dddb67fea9 spent a whole request discovering this (F6).
- **Who verifies what** is stated in the same sentence, so "do not run tests" does not read as "nothing is checked" and invite a substitute.
- **The plan is no longer sent twice** into a resumed thread (F7) — but only when the dispatcher has established that this job really is resuming the thread that produced that exact plan revision (`planReferenceRequest`, decided at dispatch, where `priorRef` is known, not at admission). Every uncertain case keeps the full JSON: fresh thread, continuity fallback, a plan produced by a different job, repairs, or an instruction that does not contain the plan verbatim. The rewritten instruction is persisted to `request_json`, because the stored request must be what was sent.
- **No duplicate model-driven test runs** were reintroduced; `NO_TEST_RUNS` (DLV-128) is unchanged, and legitimate re-reads of changed files or different ranges are not restricted.
- **The resume strategy, planning, model and effort are unchanged.**

---

## 5. Tests and results

All local and deterministic. No live model calls.

| Command | Result |
|---|---|
| `npx vitest run tests/delivery-v2/usage-normalization.test.ts` | 18 passed |
| `npx vitest run tests/delivery-v2/typecheck.test.ts` | 22 passed (includes the real-`tsc` regression fixture) |
| `npx vitest run tests/delivery-v2/subscription-window.test.ts` | 7 passed |
| `npx vitest run tests/delivery-v2/instructions.test.ts` | 6 passed |
| `npx vitest run tests/delivery-v2/verification-gate.test.ts` | 8 passed |
| `npx vitest run tests/delivery-v2` | 574 passed, 4 skipped |
| `npx vitest run tests/delivery-v2 tests/pm-ui` | 741 passed, 4 skipped, 1 failed (see below) |
| `npx vitest run tests/pm-ui` | 168 passed |
| `npx tsc --noEmit -p .` | clean |
| `npx eslint scripts/delivery-v2 scripts/pm/app tests/delivery-v2 tests/pm-ui` | clean |

The one failure in the combined run is `tests/pm-ui/react-app-build.test.ts`, which builds the PM bundle and times out at its 5 s limit under parallel load. It passes on its own and in the pm-ui suite alone (both above). It is a pre-existing timeout, not a regression from this work, and its 5 s budget was left alone rather than raised to hide it.

Two existing fixtures were changed, both deliberately:

- `tests/delivery-v2/backend-profile.test.ts` asserted that distinct Codex turns are **summed**. Under the settled semantics they must not be; the fixture now asserts the cumulative reading with the reason in a comment.
- `tests/pm-ui/delivery-review.test.ts` asserted the label "200,000 threshold"; it is now "admission limit", and `tokenSplit` gained `reasoning` and `raw`.

### Files

New: `scripts/delivery-v2/usage-normalization.mjs`, `subscription-window.mjs`, `typecheck.mjs`, `typecheck-runner.mjs`; tests `usage-normalization`, `subscription-window`, `typecheck`, `instructions`, `verification-gate`.

Changed: `adapters/codex.mjs`, `adapters/claude.mjs`, `jobs.mjs`, `store.mjs` (schema 7), `journey.mjs`, `policy.mjs`, `interaction.mjs`, `worker-boundary.mjs`, `worker/runner.mjs`, `worker/subscription.mjs`, `scripts/pm/app/{deliveryReviewModel.ts,DeliveryReview.tsx,DeliveryV2.tsx,types.ts}`, `.delivery/v2/execution-policy.json` (revision 5: the required typecheck).

---

## 6. What changes reporting versus what can reduce real consumption

**Reporting only — no tokens saved:**

- The cumulative-counter normalization. The 589,176 → 493,436 correction changes what the number *means*; the same work was done either way. Nothing about it makes the next run cheaper.
- Subscription-window observations, the raw-vs-normalized display, the "admission limit" label, the reservation tag, and dropping the inert `maxTurns`.

**Can reduce real consumption — small, and unmeasured here:**

- The no-Git clause removes a request class that was pure loss: one full request re-sending ~40–48k of context to run three commands that cannot work, plus its share of the final answer. On the investigated run that is one request out of ~11–13.
- The plan reference removes ~0.4k tokens from every request of a resumed build (≈5k of volume on that run).

**No percentage saving is claimed, because none was measured.** Both changes are structural removals of known-wasted work; their size on the next real run is unknown until a run happens.

**Improves reliability, not cost:** the deterministic typecheck and the Apply gate. They spend host CPU and no model tokens.

---

## 7. Remaining limitations

1. **Historical accounting is not restated.** Runs recorded before schema 7 keep their raw totals and are labelled, not corrected.
2. **The typecheck runs on the host**, not in the protected checker container, because that container has neither the source closure nor TypeScript. It is deterministic, outside the model and outside the writer's authority, but it is not behind the same isolation boundary as the other criteria. Moving it there means shipping a dependency volume with `typescript` and the full source closure — real infrastructure work, not a config line.
3. **The baseline is the current working tree**, uncommitted changes included. That is the honest integration target, but it means a dirty tree's own errors are subtracted as pre-existing.
4. **~3–4 minutes per verification** on this machine. Acceptable for now; incremental reuse is the obvious optimization and was deliberately not attempted.
5. **No in-job budget enforcement.** The allowance remains admission-time only; a job that overruns is still only discovered at completion (DLV-114).
6. **Subscription windows are shared and coarse.** A bracket is attributable to a job only when nothing else used the account meanwhile, and the code says so everywhere rather than implying otherwise.
7. **The first real run after this change may surface an inconclusive typecheck** rather than a verified candidate — that is the gate working, and the artifact will say exactly why.

---

## 8. Proposal: the fresh-versus-resume comparison (not executed)

To be run only with your approval, once the fixes above have been exercised on at least one ordinary delivery.

**What it must isolate.** Exactly one difference: whether the build resumes the planning thread or starts a fresh one carrying the approved plan. Everything else is held identical — same work item and source revision, same approved planning checkpoint, same model and effort, same environment instructions (including the no-Git clause), same declared criteria, same required typecheck.

**Design.** Two comparable items (4–6 files each, detailed acceptance, one protected oracle each). For each item, two independent executions:

- **A — current:** build resumes the planning thread.
- **B — variant:** build starts a fresh thread with the full plan JSON and the plan job's file list.

Independence matters: separate runs, separate threads, no shared session volume, and B must never resume anything A produced. Run order alternated across the two items so provider-side cache warmth cannot favour one arm.

**Measure, per arm:**

1. Normalized tokens by category — uncached input, cached input, output, reasoning — from the now-correct accounting, not a single total.
2. The provider's raw counter alongside, so the normalization can be audited on real data.
3. Subscription-window observations before and after, with a note on whether anything else used the account.
4. Wall clock, and request count where the rollout makes it readable.
5. Quality: protected criteria including the typecheck, and your review verdict on the candidate.

**Acceptance.** Adopt B only if quality is equal or better on both items *and* uncached input plus output is lower on both. Otherwise keep resume. A tie is not a reason to change a working handoff.

**Cost.** Four paid runs. Do not start it until you decide.

---

## 9. Decisions I need from you

1. **Run the typecheck as required?** It is enabled as `required` in policy revision 5 — the next delivery cannot reach `verified_candidate` or Apply without a clean typecheck of the candidate. If you would rather watch it for a run or two first, set `checks.requiredVerifications.typecheck.enforcement` to `"advisory"`: the verdict is still recorded and shown, and it blocks nothing.
2. **Normalize historical runs?** The BUD-83 session still reads 589,176 (with the provider-counter note). I can write a one-off, idempotent migration that recomputes the deltas and keeps the raw values — say the word and I will produce the runbook for you to run, not run it.
3. **The comparison in §8** — four paid runs, only on your approval.
4. Investigation §8's questions 1, 2, 4 and 5 remain open and unanswered by this work: whether your plan usage visibly dropped during the run, why you added +200k before approving the build, whether bounded automatic repair is authorized, and whether Focused delivery should skip model planning when the criteria already carry an exact Touches list.

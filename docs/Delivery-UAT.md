# Delivery — owner UAT

**2026-09-20 optimization closeout:** the [new draft test sequence](<../ERA Notes/10 - Project Management/Plans/Delivery Optimization Closeout.md>) proposes two isolated KIT-11 attempts (staged Focused versus prepared Focused), then one reviewed Apply/rollback cycle. It updates the optimization experiment sequence without replacing the existing acceptance obligations below. Task-specific policy/oracle preparation and owner review are still required; no new session has run. Record separate results for measured savings, Apply/rollback, terminal-job recovery, token-stop enforcement and physical phone operation. Every new actual result remains **Pending**.

2026-09-15 · [Request → delivered](Delivery-Requests.md) · [Delivery checklist](<../ERA Notes/10 - Project Management/Delivery/4 - Checklist.md>)

**Decision now: UI changes ready for owner UAT; unattended Delivery is not accepted.** DLV-114 still lacks qualified in-job token stopping. The new UI labels a dispatch threshold honestly; it is not a hard token cap.

**2026-09-19 owner decision:** UI refactor **accepted on laptop** (U1–U7; U7a not run; phone pending relay migration). Findings logged as DLV-122 (token allowance blocks runs silently, no Cancel for a waiting run) and DLV-123 (four small screen defects).

**2026-09-26 owner scope decision:** Delivery closes as **accepted for supervised use, laptop + phone** once this evidence exists: the KIT-11 A→B trial (both arms), Apply/rollback on B, and one phone pass. U19 (container typecheck) and U20 (real stop witness) move to enhancements; enforcement stays `advisory`. Agent re-check 2026-09-26: 933 tests pass; U1–U3, U5, U6 re-observed headless at 1440/390 px on `r-c1d69bb666cf` with no overflow or page errors; DLV-123 fixed; both executors ready and qualified once Docker was running.

## Step 1 — Test the implemented interface (no new Delivery session)

**Work > To do = remaining implementation. Work > Done = completed implementation and its evidence.** UAT rows are manual checks, with implementation status and your actual test result recorded separately. UAT Pending never means you should Deliver a completed item again.

**Implemented and moved to Done:** DLV-97/104/105/106/112/115/116/119/120 and R51/R63/R64/R65. Their local implementation evidence is in the PM completion records; owner acceptance remains pending here. **DLV-120 shipped 2026-09-20** — protected-check output is now retained, redacted and classified, and Verification carries a closed **Log** disclosure on any check that is not a pass (U11). Historical/large-artifact paging is **DLV-121**. R55/R62 and DLV-117/118 now describe remaining engineering only.

Restart `pnpm pm` to load the server changes, then refresh Delivery. Open the existing **DLV-107 / r-c1d69bb666cf** attempt. Its candidate was previously applied and rolled back; later Apply conflicts are valid history. This is a review exercise, not a request to reapply its old candidate.

Repeat the same route on a phone through `/pm/live` after the existing relay setup is working. A narrow laptop window proves layout only; it does not prove phone commands or offline recovery.

Record each result as `PASS / FAIL / BLOCKED`, with a screenshot or short observation. **Pending means not tested by the owner.**

| ID / implemented scope | Do this | Expected result | Implementation | Owner UAT result |
|---|---|---|---|---|
| U1 · R64/R66 | Open the session on desktop and phone. | Readable status and Plan → Verification → Activity → Changes tabs. Changes is last. No sideways page scrolling or content hidden by bottom navigation. | Done | PASS desktop (agent-run 2026-09-19, owner glance) · phone BLOCKED: relay migration unapplied |
| U2 · DLV-116/R66 | Open Plan, then plan.md from Artifacts; download and close it. | Scope, Steps, Checks, Risks and Unknowns are visible without expanding rows. Artifacts sit at right on desktop and below the plan on phone. The reader shows the same revision without internal IDs/digests. | Done | PASS — Download not clicked (file download needs owner OK) |
| U3 · DLV-112/R66 | Open Verification. | One current result per criterion with a plain test count/status. Previous runs are visible below it; no receipt IDs, runner names or output-retention prose. | Done | PASS — nit: empty timestamp-only row under each current result |
| U4 · DLV-116 | Changes → Work.tsx. | Modified file; recorded change is `view=story` → `tab=story`. A diff appears only when both hashes verify; otherwise a specific unavailable state. | Done | PASS — view=story → tab=story diff shown |
| U5 · DLV-119/R66 | Read Tokens in the status card. | **284,243** against **200,000 threshold**, with **+84,243** visible. No Estimated/Unknown/Reserved/Allowance rows. | Done | PASS — 284,243 / 200,000 / +84,243 |
| U6 · R55/R64 | Switch tabs → refresh → Back/Forward → return to the item and reopen the attempt. | Selected tab and item context survive; previous applications remain reachable. | Done | PASS — nit: item page hides the attempt link inside collapsed Scope and evidence |
| U7 · R64/R66 (stored activity) | Activity → Messages / All activity. | Readable messages and events, plus visible status, timestamps, executor settings and run ID. No Session details or Jobs disclosure. Live streaming remains DLV-109 / U12. | Done | PASS |
| U7a · R66 | Open DLV-90 launch and tap Claude while it is unavailable. | No recommendation/scope/fleet/helper copy. The Claude card says Unavailable; tapping it states the actual worker or subscription blocker and offers Retry. | Done | Agent headless 2026-09-26 (Docker stopped): card Unavailable, tap opens blocker + Retry — but it blamed sign-in; fixed to "Its Delivery worker is offline." Owner glance pending |

## Step 2 — Run new sessions on open backlog items

**DLV-90 and KIT-11 are still open in the checklists; DLV-108 was implemented on 2026-09-20 and is no longer a candidate task.** As of 2026-09-15, They were selected as real implementation tasks for testing Delivery. This UI refactor did not implement them. Start a separate Delivery session for each selected task after Step 1; the installed policy must cover that task first.

These are the items to **Deliver**. The U1–U18 rows describe what to observe while reviewing or running them; those rows are never Delivery tasks themselves.

Use **Work → item → Deliver**. In V2, **Fast lane = stored `focused`** and **Deep dive = stored `investigate`**. Select an available, qualified subscription executor/model/effort; record the exact selection below. Never bypass a refusal or increase a limit just to finish UAT.

| Lane | Actual checklist item | Bounded task / expected evidence | Application boundary |
|---|---|---|---|
| Fast lane, Delivery-specific | **[DLV-90](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-90>) — Reject zero-test validation as NOT_TESTED** | Reproduce exit 0 with zero selected tests; it must remain Not tested and cannot satisfy V1 INSTANT validation. Include a nonzero passing control. Fast plan/build stays bounded. | Candidate-only if it changes protected `scripts/delivery/`; Apply must refuse those paths. V2 executing this item does not authorize a V1 native trial. |
| ~~Deep dive, Delivery-specific~~ | ~~**DLV-108** — Recover completed jobs after restart~~ | **No longer available as a UAT task: fixed directly on 2026-09-20** (schema-8 settlement marker, second recovery scan, resumable `afterJob`). Per the “already fixed” rule below, record “already satisfied” rather than manufacturing another edit; pick a different deep-dive task. | — |
| Fast lane, end-to-end product trial | **[KIT-11](<../ERA Notes/10 - Project Management/Kitchen/Kitchen — Master Book.md#kit-11>) — Return the correct cooking count** | Handle actual HEAD/count metadata; synthetic zero, nonzero and error cases. Empty response body must not become a false zero. | Suitable for Apply/rollback if the final candidate stays within approved, unprotected paths. Use isolated test data. |

**Recommended order:** U1–U7 → candidate-only DLV-90 → candidate-only DLV-108 → KIT-11 for Apply/rollback. If a selected item is already fixed when you start, verify its acceptance and record “already satisfied”; do not manufacture another edit. These examples do not waive their checklist holds, worker qualification or the existing resource gates.

**KIT-11 preparation is complete as of 2026-09-20 — it is prepared, not launched.** The protected oracle `tests/delivery-oracles/kit11-cooking-count.mjs` exists and discriminates (current source fails 4 of 12; a corrected control passes 12 of 12; both reproduce inside the pinned worker image with no network and a read-only candidate). Execution policy **revision 7** is prepared and validated at `.delivery/v2/preparations/kit11-policy.ready.json` but **not installed** — installed is still revision 6 (BUD-83), so starting KIT-11 today is **Blocked**, not a failed result. The `delivery-plan-v1` body, both arms' Master Book section text and the verified eligibility report are in `.delivery/v2/preparations/kit11/`, with `ownerReviewed` deliberately still `false`. Read `.delivery/v2/preparations/kit11/LAUNCH-PACKET.md` before launching: it carries the pinned identity, the prerequisites, the seven decisions owed by you and the preparation cost ledger. **Do not run `setup-checker-deps.mjs` before this trial** — it would recreate the dependency volume without `esbuild` and stop both oracles running; see the packet's finding.

**KIT-11 A→B trial — status 2026-09-20: BLOCKED at step 0, no arm run.** Read-only check found: installed policy is still revision 6 (BUD-83 scope; KIT-11 route not writable); revision 7 not installed; the Kitchen Master Book `### KIT-11` has neither the `Touches` line nor any plan material, so `ownerReviewed` cannot have been reviewed or recorded; no enforcement mode, wall-time, per-run allowance or executor/model/effort has been chosen (enforcement absent → advisory; `executor.json` = claude only as the default backend, not a recorded trial selection). Route baseline unchanged (`c4554faeda558654…`). Zero jobs, runs, reservations or tokens; measurement sheet in the closeout plan stays entirely Pending. Result: **Blocked, not failed.** Next owner action: review `plan.json` and answer the launch-packet decisions.

Each new item also needs matching allowed paths and trusted checks in the installed execution policy. A policy prepared for DLV-107 does not certify DLV-90 or KIT-11. A missing scope/check configuration is **Blocked**, not a passed UAT result; record the refusal before changing configuration.

### Model and effort

Lane, model and reasoning effort are three separate choices. Fast lane does not automatically mean Luna or low effort. Checklist `S`/`M` describes task size, not a model setting.

| Item | Lane | Suggested model / effort | Why |
|---|---|---|---|
| DLV-90 | Fast lane | GPT-5.6 Luna / low | Small, specific validation fix with clear pass/fail controls. |
| KIT-11 | Fast lane | GPT-5.6 Luna / medium | Bounded count fix, with zero/nonzero/error cases to trace. |
| ~~DLV-108~~ | — | — | Implemented directly 2026-09-20; not a Delivery task any more. |

These are engineering recommendations, not measured results for these tasks. Use them only when offered by the qualified subscription executor. Official OpenAI documentation describes [Luna and its effort settings](https://developers.openai.com/api/docs/models/gpt-5.6-luna) and [Sol and its effort settings](https://developers.openai.com/api/docs/models/gpt-5.6-sol); it does not certify this Delivery installation. No API-key or paid fallback is implied.

## During a new run

| ID / checklist coverage | Do this | Expected result | Implementation | Owner UAT result |
|---|---|---|---|---|
| U8 · DLV-117/118 | Select the lane, executor, model and effort; Start once. | Selected settings persist. Fast lane has one plan and one build, without automatic repair; Deep dive investigates before approval. No silent provider switch. | Partial: DLV-117/118 remain | Pending |
| U9 · DLV-116 | Read the proposed plan, request one concrete revision, inspect both versions. | Earlier plan stays readable; approval is offered only for the latest proposal. New content appears before its Approve control. | Done | Pending |
| U10 · DLV-116 | Approve the latest plan once. | Exactly one approval/implementation; Plan and Changes identities remain consistent after refresh. | Done | Pending |
| U11 · DLV-112/120 | Inspect a failing, zero-test or unreadable check; use Recheck once. Open its **Log** disclosure. | Failed / Not tested / Couldn’t verify remain distinct, and the outcome line names which: Runner never started / Output unreadable / No tests selected / Tests failed. The log shows the checker's own text with `<candidate>` / `<checkout>` in place of absolute paths and no token-shaped values; a passing check shows no Log. Recheck runs checks, not another model job. A log that was not retained says so rather than rendering empty. | Done: DLV-120 implemented 2026-09-20 | Pending |
| U12 · DLV-109/114 | During work, compare activity and usage with the latest observation. Set `resources.enforcement` to `"threshold"` with a limit you are willing to lose, and watch the Usage panel say **stop limit** rather than **admission limit**. | Activity rows appear while the job is still running, not only at the end. At 80% a `Near limit` warning is recorded once. At the limit the job stops, the run reads **Limit reached**, the partial candidate is kept, overshoot is shown as a number, and nothing redispatches. No fabricated live reading, and no run labelled as hard-capped. | Ready: DLV-109/114 implemented 2026-09-20 — `npx vitest run tests/delivery-v2/budget-stop.test.ts` (25 cases, both executors). **Deterministic only:** these are scripted SDKs, so the real stop witness (U20) is the remaining evidence. | Pending |
| U13 · DLV-105/116 | On KIT-11, inspect each file and apply the verified candidate. | Exact approved bytes applied; integrated checks pass; status becomes Applied. Protected paths or later source edits refuse cleanly. | Done | Pending |
| U14 · DLV-115 | Roll back → inspect operations → Cancel. | No file changes. Dialog traps focus; Cancel/Escape returns to the invoking button. | Done | Pending |
| U15 · DLV-115 | Roll back again → confirm. | Modified files restored, true new files deleted, deleted files recreated. Pre-existing untracked files survive. Candidate/history remains readable. | Done | Pending |
| U16 · DLV-115 | In an isolated fixture, edit an affected file after preview, then confirm. | Stale preview refuses; later edits survive. Partial restoration is labelled and remains recoverable. | Done | Pending |
| U17 · DLV-104 | On phone: lose a response, reconnect, then Check status. | Same command ID resolves; no duplicate approval/Apply. Offline shows last known state and disables writes. | Done | Pending |
| U18 · DLV-108 | Run the restart fault fixtures for both executors. | One durable transition after recovery, retained output on write failure, no extra dispatch. | Ready: DLV-108 implemented 2026-09-20 — `npx vitest run tests/delivery-v2/journey.test.ts -t "DLV-108"` (14 cases, both executors, each boundary reconciled twice) | Pending |
| U19 · DLV-133 | Stage the checker's compiler, then require isolation: `node scripts/delivery-v2/setup-checker-deps.mjs`, set `checks.requiredVerifications.typecheck.isolation` to `"checker"`, and run `ERA_V2_DOCKER=1 pnpm exec vitest run tests/delivery-v2/typecheck.docker.test.ts`. | The script reports a `typescript` version. The gated pair passes: the deliberate `supabaseAdmin.from` candidate FAILS with TS2339 and the correct one is SATISFIED, both with `environment.producer = protected-checker`. A volume without a compiler is refused by name, not graded. A later verification records `protected-checker`, not `host-checkout`. | Ready: implemented 2026-09-20, container witness unrun (needs a Docker daemon; builds an image). **Caution (found 2026-09-20):** `setup-checker-deps.mjs` deletes and recreates `era-dlv107-dependencies` from a pinned list with no `esbuild`, which is what the BUD-83 and KIT-11 oracles need to run; and it copies from this Windows checkout, which has no linux esbuild binary to copy. Decide that before running it, and not before the KIT-11 trial. | Pending |
| U20 · DLV-114 | The bounded real stop witness, on the chosen provider only. Pick a low limit and a task you are willing to lose, set `enforcement: "threshold"`, launch, and watch it cross. | The stream ends at the crossing and no further turn is billed. The worker's termination is observed (the container is gone), not assumed. The reported overshoot matches the provider's own final counters. No second job of any purpose is dispatched afterwards. If the provider keeps billing after the abort, that is a FAIL and threshold mode must go back to advisory. | **Not implementable by an agent.** Requires a real provider job and the owner's own limits; no fixture can establish it. | Pending |
| U22 · DLV-111 | **Setup first (owner):** relay migration `migrations/2026-07-25_pm-mobile-relay.sql` run in the Supabase SQL Editor; `scripts/pm/bridge.mjs` started by you with its env set; the current PM bundle deployed so `/pm/live` serves this build; the Delivery supervisor restarted on this build; Docker running; both worker sign-in volumes connected (`setup-subscriptions.mjs`); phone signed in to the relay. Then, on the laptop, let a sign-in lapse (or sign out of the CLI) and open the Deliver screen on the phone. | Executor shows "Reconnect needed. Open Claude Code once." (Codex: "Run codex once."); Deliver is disabled; no job, run or token is created; no other executor is substituted and no API-key or paid option appears. After reconnecting on the laptop the executor turns ready on the next check with no manual volume step. | Fixtures done | Pending |
| U21 · DLV-114 | Ask for a hard cap: set `resources.enforcement` to `"hard-cap"` and try to launch. | Launch refuses before anything is dispatched, naming `strict-bound-unavailable`. It does **not** run under a threshold instead. No run, job or token is created. | Ready: implemented 2026-09-20 — covered deterministically in `budget-stop.test.ts` | Pending |

## Owner-run checks

These retained IDs describe manual acceptance or operating trials. They are **not Delivery tasks** and have no Deliver action. All are Pending; none was silently accepted or discarded. Open their original criteria in the linked Master Book sections before testing.

| Retained ID | Owner action / expected result | Actual |
|---|---|---|
| [DLV-72](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-72>) | Verify the retained V1 phone drill-down, question answer, push link and bounded snapshot. Applies to the legacy view only. | Pending |
| [DLV-77](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-77>) | Supply the current relay command constraint; confirm allowed command types before any manual migration. | Pending |
| [DLV-78](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-78>) | Run the isolated V1 INSTANT witness only if its existing holds are cleared; record escalation and all limits. | Pending |
| [DLV-92](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-92>) | Measure one eligible V1 product delivery, with owner attention, elapsed time and useful result. | Pending |
| [DLV-93](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-93>) | After the first V1 trial, respect the bounded fix allowance and measure a second product item. | Pending |
| [DLV-98](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-98>) | Record the native baseline for the same eligible product task, with provenance and owner time. | Pending |
| [DLV-99](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-99>) | Run the eligible product item through V2, then compare its reviewed result with the baseline. | Pending |
| [DLV-100](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-100>) | Exercise the isolated real-boundary failure matrix; no duplicate effects or fabricated success. | Pending |
| [DLV-101](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-101>) | Interrupt/resume an admitted Deep dive; preserve progress and fresh authorization. | Pending |
| [DLV-102](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-102>) | Compare all three Fast lane results, including failures, plus baseline and Deep dive; record continue/hold. | Pending |
| [R42](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r42>) | Verify legacy mobile swipe, haptics, safe areas and PWA install if retaining that view. | Pending |

Additional acceptance of completed implementation: **R51** stale task action/Undo preserves newer edits; **R63/DLV-104** real phone relay shows the same data and resolves the same command after reconnect; **DLV-106** two independently scoped real runs remain isolated and their applications serialize. Implementation: Done. Owner results: Pending. Do not start a session on those completed IDs to perform these checks.

## PM lifecycle checks

| Check | Expected | Actual |
|---|---|---|
| Work > Done > R64 | Done status, completion evidence, scope and available session history; no Deliver action. | Pending |
| Work > To do | DLV-90/108, KIT-11 and explicit remaining engineering; no completed IDs or owner-run IDs listed above. | Pending |
| Old Deliver link for a completed or owner-only ID | Opens no launch form; direct backend submission also refuses. | Pending |
| UAT failure | Record FAIL here. Reopen the implementation item only for a demonstrated defect, or add a specific hotfix; pending owner testing alone does not reopen it. | Pending |

## Evidence to send back

| Field | Actual |
|---|---|
| Item / run ID / date | |
| Lane / executor / model / effort | |
| Plan revision / candidate / result version | |
| Device / browser / theme | |
| Selected limit and enforcement mode | |
| Observed overshoot at the stop, if any | |
| Tokens / elapsed time / minutes you intervened | |
| Failed UAT IDs + expected vs actual + screenshot | |
| Decision: ship / hold / hotfix / roll back | |

## Decision rules

| Decision | Use it when |
|---|---|
| **Accept the UI refactor** | U1–U7a, plan revision/approval, keyboard/mobile review and rollback dialog checks pass. Keep runtime gaps tracked separately. |
| **Accept bounded Delivery** | Both lanes produce useful, reviewed evidence; KIT-11 applies/restores correctly; no duplicate actions or misleading states. Phone acceptance additionally needs U17. |
| **Hold / hotfix** | Required output is missing, a reader/action is unusable, checks are unclear, restart recovery fails, or token control differs from what was authorized. Record the failed UAT ID and affected candidate. |
| **Roll back the applied candidate** | Applied behavior regresses or an approved requirement fails. Inspect the inverse first; cancel on conflicts and preserve later edits. Avoid a blanket repository reset: this checkout contains unrelated work. |
| **Do not accept unattended use** | DLV-109/114 have code but no real stop witness (U20), DLV-108 has code but no owner restart acceptance (U18), or DLV-104 lacks real acceptance. Passing screenshots and synthetic tests cannot certify those capabilities. An observed stop in a scripted fixture is not an observed stop by a provider. |

## Agent verification, separate from owner UAT

2026-09-15 lifecycle refactor: **800 tests passed**, four opt-in Docker tests skipped; typecheck and lint passed. **28 browser observations** at 320/390/1440 px covered To do/Done, readable completion status, retained history and refused old launch links, using actual campaign documents with synthetic sessions. Evidence: `.tmp/work-lifecycle/`. Physical-phone and owner acceptance cells remain Pending.

Local synthetic browser checks cover desktop/mobile layout, tabs, plan reader, revision selection and rollback cancellation; production provider runs and a physical phone relay were not exercised. Automated suites cover the supervisor and hash-verified diff reader. The current session's exact results are recorded in the Delivery and PM Tooling Master Books; all owner Actual cells above intentionally remain Pending.

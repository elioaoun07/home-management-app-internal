# R44 delivery acceptance — 2026-10-24

Initial record at 13:48 UTC on ElioLaptop; final post-Apply validation below supersedes the historical checkpoints. **The owner applied the same run's C1: application `app-497cee609b88` is terminal Applied, with both integrated protected checks satisfied.** A separately authorized local repair fixes C1's fixture process-startup timeouts; frozen C1 and its receipts remain unchanged. Final automation passes; physical-phone UAT, owner review of the post-Apply diff and sign-off remain pending. This is not a guarantee of 100% reliability.

## Historical cancellation checkpoint — 13:48 UTC

| Item | Observed evidence |
| --- | --- |
| Cancelled current run | `r-69bc10ef3c60`, [local run](http://127.0.0.1:4317/#/delivery/run/r-69bc10ef3c60) |
| Original request | `ad7e0e33-e41e-4947-afbc-a548940c3883`, attributed to Owner |
| Accepted / started | `2026-10-24T13:21:46.205Z` / `13:21:46.209Z` |
| Before cancellation | Plan review; one proposed plan; Codex / `gpt-6-luna` / low / focused; 44,366 recorded tokens |
| Cancellation action | Activity → **Stop delivery**, clicked once, only on this run |
| Terminal evidence | Run heading **Cancelled**; request stage **closed**; job state **cancelled**; updated `2026-10-24T13:30:55.171Z` |
| Work still running | Delivery queue **Writers 0/1, Jobs 0/1**, confirmed again immediately before the proposed fresh launch; no active R44 card |
| Independent process check | Read-only `docker ps`: no delivery worker, checker or readiness container running; only existing egress infrastructure and unrelated Supabase containers |
| Older run | `r-262a6aee5ed3` remains historical and untouched |
| Fresh repair-validation Start count | **0**; no fresh UUID/run/provider job was created by this repair phase |

The coordinator's **Status unconfirmed** is its launch-coordination clock, last updated `13:22:28.579Z`. It is independent of the later job/cancellation evidence. Passive reads must not invent a heartbeat or change the terminal outcome. This label is not evidence that cancellation failed.

## What was actually repaired

The checkout already contained the DLV-143 durable Start receipts, exact refusal retention, GET-only command recovery, and native probe's 30-second session budget inside the unchanged 45-second outer limit. Those changes were inspected and tested, not reimplemented. Other pre-existing checkout changes were preserved.

Two remaining presentation errors were reproduced on the real cancelled run:

1. `ActivityReview` rendered the workflow stage under **Status**, so the header/request said Cancelled while the run details said Plan. It now reuses `reviewStatus`, including terminal outcomes and Stop requested.
2. `defaultReviewTab` preferred a saved proposed plan even after closure. Closed runs now open Outcome; application-check actions retain Verification priority, and an active proposed plan still opens Plan. Stored plan artifacts remain available as history.

Files changed for this follow-up: `scripts/pm/app/DeliveryReview.tsx`, `scripts/pm/app/deliveryReviewModel.ts`, `tests/pm-ui/delivery-review.test.ts`, and new `tests/delivery-v2/launch-cancel-recovery.test.ts`, plus this report and the existing routing/runbook/PM documentation. No execution policy, model, budget, grant, security boundary, protected oracle, installed environment or backend lifecycle behavior was changed.

## Automated evidence

All tests are offline/scripted; the paid-API block remains enabled. There was no live native metadata probe or provider turn during this repair phase.

| Check | Result |
| --- | --- |
| Initial focused identity/cancellation/local recovery/relay suites | 180 passed, 9 files |
| Review regression + new real-entry/lifecycle integration | 15 passed, including 5 added cases |
| Delivery V2 + PM UI + relay/bridge aggregate | Initially 1,380 passed, 10 failed, 8 existing opt-in skips across 103 files |
| Seven affected suites rerun under ordinary Windows permissions and external temp root | 127 passed, zero failed/skipped, original assertions/deadlines unchanged |
| Reconciled latest result for each assertion across those 103 files | **1,390 passed, zero unresolved failures, 8 existing opt-in skips**; this is a reconciled result, not one clean aggregate invocation |
| `pnpm typecheck` | Passed after correcting one implicit parameter type in the new test |
| ESLint over the four changed code/test files | Passed |
| `pnpm pm:build-app` | Passed: 1,106,904 B JS + 239,586 B CSS |
| `pnpm pm:lint`, `pnpm docs:check` | Passed |
| `pnpm pm:check-docs` | Fails on 15 pre-existing missing October 18–19 temporary recovery-evidence links; no historical evidence fabricated |

The first restricted test process failed before test execution on temp-file renames. Setting a workspace temp root allowed the focused tests, but the broad suite then exposed sandbox junction/loopback restrictions, an intentional scratch-outside-host guard, and one large-manifest deadline. The seven affected suites passed unchanged using the normal writable Windows temp folder with sandbox approval. No limit was relaxed and no failure was converted into a skip.

The new integration case traverses the real authenticated entry, SQLite receipt store and journey using a scripted SDK: Start → GET recovery/replay → reject another active-work UUID → plan → Stop → closed/cancelled → no outstanding jobs or reservations → consistent command/list/detail/request projections → explicit fresh Start with a distinct run → exactly one plan per launch → owner plan-review gate. Original receipts and old command outcomes remain byte-for-byte unchanged. No synthetic approval or Apply is needed in that case.

Machine records are in `.tmp/r44-acceptance-20261024/`: `aggregate-tests.json`, `environment-rerun.json`, `new-regressions.json`, and `review-regressions.json`. These local temporary records are supplemental; this Markdown retains the durable outcome and limitations.

## Browser evidence

- Actual served `127.0.0.1:4317` cancelled run: Activity **Status = Cancelled**, matching its heading/request; reopening without a tab parameter selects Outcome. This was verified after the existing frontend watcher rebuilt; no PM service was restarted.
- Actual mobile viewport 390 × 844, Blue: no horizontal overflow and the same terminal status. Viewport override was reset afterward.
- Isolated current-source fixture, 390 × 844, Pink palette scoped to the synthetic page: one synthetic Start, lost response, reload, **Unresolved request** with no Start, one **Check status**, exact **Model check timed out** result, reload preserving the same refusal. Visible fixture counters remained `starts: 1`, `checks: 1`; command ID remained `4a8bcc86-1b4d-4ee3-9a00-b3d7e2c70b72`. No operational endpoint or provider was available to that fixture. No horizontal overflow. The fixture server was stopped.
- An attempted operational theme switch was denied by automatic approval because it changes a saved setting. It was not executed or retried. Pink was checked only through the isolated page palette, without changing the user's operational preference.
- Phone relay/status parity is covered by the local fixtures. A deployed `/pm/live` shell, real phone and parent-chat automatic synchronization were not witnessed in this phase. A chat update must report the current recorded checkpoint rather than infer ongoing execution from a prior message.

## Fresh-launch blocker and owner checkpoints

The installed policy is current: permitted executor Codex, saved focused selection `gpt-6-luna / low`, per-run 600,000-token advisory allowance, one job/writer, and recorded authorization through `2026-10-25T13:18:01.258Z`. This is saved authority, not proof of fresh runtime/model availability; normal Start still has to collect its admission evidence. No Check readiness renewal or policy edit was performed.

After confirming cancellation, idle queue and passing local checks, the normal Steward R44 page offered **Previous delivery cancelled → New delivery**. Automatic approval **denied New delivery before execution**, stating that trusted user authorization covered the earlier single Start and cancellation but not an additional delivery. No retry, alternate entrypoint or backend workaround was used. The active browser intent therefore still points to the cancelled run; the fresh Start count remains zero. There is no fresh run/plan to approve.

Required next authorization: **“Authorize New delivery and one fresh R44 Start under the current saved policy; stop at the exact-plan approval gate or listed blocker.”** Once that authority is accepted, use the normal controls, retain the new command/run identity, and never retry an uncertain dispatch. A current refusal is a blocker, not permission to widen policy or repair the environment.

Remaining owner checks:

1. Authorize the fresh launch above, then inspect its real plan and exact revision/contract. Confirm the scope remains `eslint.config.mjs` and `tests/pm-ui/raw-fetch-guard.test.ts`, including the R48 recount. The cancelled run's old proposal must never be approved as the fresh run.
2. Approve that exact new plan yourself. Observe one implementation, protected oracle/typecheck, immutable candidate/result, and declared resource limits. Stop on unknown/failure; no repeated paid pilots.
3. Review candidate changes and evidence before any separate owner Apply. Verify integrated checks and phone-visible state, then record owner acceptance. No Apply, commit, push or deployment is authorized by this report.

If a backend restart becomes necessary, the owner must stop the existing bridge in its own terminal and start exactly one `pnpm pm --bridge`, preserving policy, pairing, journals, receipts, database and volumes. Agents cannot restart the production-publishing bridge under Hard Rule 26. This repair changed only frontend presentation and tests, and its frontend is already served; no backend restart was performed or claimed necessary.

**Disposition:** cancellation and local fixes verified; fresh live launch denied; real end-to-end candidate/sign-off pending. A 100% success guarantee is not established.

## Authorized live continuation — 2026-10-24, 13:54–13:59 UTC

The owner explicitly answered **“yes authorized”** to New delivery and ONE fresh R44 Start at `13:54:23Z`. This materially new approval permitted one retry of the previously denied New delivery action. No gate was bypassed.

Immediately before proceeding, the existing R44 request still showed closed/cancelled and the live Delivery queue showed **Writers 0/1, Jobs 0/1**, with no active/pending R44 duplicate. **New delivery** completed normally; **Start was clicked exactly once**. No Check readiness renewal, policy change or bridge restart occurred.

| Live identity/state | Verified evidence |
| --- | --- |
| Request | `01eb4365-2a29-4884-9967-151c6552cb41`, **Initiated by ERA Steward** |
| Accepted / started | `2026-10-24T13:56:34.393Z` / `13:56:34.398Z` |
| Admission | Observed at `13:57:12.528Z` |
| Fresh run | [`r-46688acd1b86`](http://127.0.0.1:4317/#/delivery/run/r-46688acd1b86), distinct from both cancelled historical runs |
| Planning progress | Request progressed readiness → admission → investigate/queued → running → **plan review**; final job-update timestamp `2026-10-24T13:58:42.110Z` |
| Final owner checkpoint | Run **Review plan**, proposed **revision 1**; Approve enabled; no blocking questions; Unknowns None |
| Configured execution | Codex / `gpt-6-luna` / low / focused; unchanged 600,000-token advisory allowance |
| Recorded planning usage | **78,066 tokens**; no implementation or candidate/check result exists at this checkpoint |
| Local planning receipt | `j-64ef23027895.json`, `subscription-ready`, backend `codex-exec-sdk`, created `13:58:17Z`; this is the sole new job receipt during this observed single-run interval. The normal UI does not expose a supervisor job-ID field; the ID is identified from this local receipt rather than a directly read supervisor row. |

Plan revision 1 has the exact two-path scope:

- `eslint.config.mjs`
- `tests/pm-ui/raw-fetch-guard.test.ts`

Its four steps add a warn-level `no-restricted-syntax` override in the four client trees; match literal direct POST/PATCH/PUT/DELETE fetch calls while preserving GET/omitted-method/safeFetch/server exclusions; add focused `ESLint.lintText` fixtures; and record the actual finding baseline for R48 without changing existing writers or allowances. The plan explicitly distinguishes **421 textual method/fetch matches** from a validated violation count; that number is not an accepted R48 baseline. Computed/aliased methods and indirect calls remain outside the syntax check.

The plan's checks explicitly say **no tests, lint, typecheck, or build commands were run during planning**. The earlier 1,390 offline tests validate the orchestration/UI repair, not a candidate that has not yet been implemented. Readiness/admission passing and a completed provider planning job are now live evidence; build, protected oracle/typecheck, candidate, integrated verification and phone acceptance are still pending.

**Next owner action:** open this fresh run, review **Plan r1**, and approve that exact plan/contract through the normal owner control if acceptable. The agent stopped at this gate, did not approve or revise the plan, did not Apply, and did not send a second Start. The cancelled run's old proposal remains history. Any later Apply remains a separate owner decision.

**Current disposition:** one authorized fresh Start completed planning successfully and is waiting for exact-plan approval. The earlier New delivery denial is resolved by explicit approval; there is no outstanding launch-permission blocker. Full end-to-end sign-off is not yet established.

## Approval/build observation — 2026-10-24, 14:04–14:07 UTC (interim)

The exact same run `r-46688acd1b86` now visibly records **Plan r1 approved** following the owner's approval. No agent approval or extra Start was sent. Build produced frozen candidate **C1**, exactly two files (`eslint.config.mjs` modified; `tests/pm-ui/raw-fetch-guard.test.ts` created), **Not applied**. Recorded run usage is **322,267 tokens** under the unchanged advisory allowance. The new local implementation subscription receipt is `j-d757e66d2fc0.json` (14:03:59Z; receipt-based identification, not a direct supervisor-row read).

Protected **Fetch guard passed 36/36**. The current recorded request stage/state remains **checking**, with **Check** on the run and **1/1** on Verification. Required typecheck and a final Result/verified-candidate disposition have **not yet been verified**. The UI simultaneously offers **Outcome unknown / Reconcile**; no Reconcile, Retry or Apply was clicked. A brief Offline/last-known transition cleared on the subsequent read. This is an interim checkpoint, not acceptance or a verified candidate. No blocking question is displayed.

## Final live result — 2026-10-24, 14:10–14:11 UTC

**Same run:** [`r-46688acd1b86`](http://127.0.0.1:4317/#/delivery/run/r-46688acd1b86?tab=changes). **Request:** `01eb4365-2a29-4884-9967-151c6552cb41`. No second Start, duplicate approval, Reconcile, repair, paid retry, policy change or Apply was performed.

The supervisor, inspected through a disposable main-plus-WAL byte snapshot, records:

| Record | Authoritative outcome |
| --- | --- |
| Run | **CLOSED / verified_candidate**, updated `2026-10-24T14:09:28.019Z` |
| Result | **`res-a20e5a5a072c@1`**, `candidateVerified: true`, projection **current**, no remaining obligations or unknown jobs/effects |
| Candidate | **C1 / `cand-b20dc2d745ce`**, exactly the two approved paths, unchanged frozen evidence |
| Plan | **`plan-14008cda8f1c`, revision 1, approved**; owner decision recorded at `14:03:20.884Z` |
| Planning job | **`j-64ef23027895`**, finished / succeeded, after-state done, reservation closed |
| Implementation job | **`j-d757e66d2fc0`**, finished / succeeded, after-state done, reservation closed |
| Usage | **322,267 tokens settled; 0 reserved; no unknown usage** under advisory enforcement |
| Application | **None**; `applications` contains no row for this run |

Job IDs are now directly corroborated by supervisor rows, superseding the earlier receipt-only identification limitation.

Required protected checks:

- **`r44-fetch-guard` satisfied**, evidence `e-709910645ede`: 36 selected, 36 executed, zero skipped. This validates the guard's supported call shapes, client scopes, warning severity and exclusions.
- **`delivery-typecheck` satisfied**, verification `tc-afac89143c00`: isolated **protected-checker**, TypeScript **5.9.2**, Node **22.23.2**, pinned program **2,812 files**, fingerprint `sha256:6a9cb0e70a664a8ff4111a352ad8d4c0585b64a01c4a560a61a9774a8ea4863d`; baseline/candidate/introduced/pre-existing diagnostics all zero. Started `14:05:42.338Z`, finished `14:09:23.849Z`, exit 0. The retained output marks the separate candidate compilation phase **“not run”**; the receipt is not evidence that the newly authored Vitest fixture suite itself was executed. No independent full test/build suite for the candidate is claimed.

`typecheck.satisfied` was recorded at `14:09:23.852Z`; Result v1 at `14:09:28.016Z`; `projection.written` at `14:09:28.052Z`. The several-minute interval was still active checking, not a terminal failure. No paid recovery or repeated check was needed.

The live store itself was never opened for SQLite writes or checkpointing. Main/WAL bytes were copied into a new disposable workspace folder only after a stable hash read; the copy was opened read-only with `query_only=ON`, returned `integrity_check = ok`, and live main/WAL hashes still matched after inspection (`snapshotCurrent: true`). Compact evidence is `.tmp/r44-acceptance-20261024/final-live-result.json`; original snapshot bytes and evidence remain in that directory's `store-observation-*` folder. Frozen C1 and live run evidence were not rewritten.

Reloaded served UI agrees: request **closed / verified candidate**, header **Candidate verified**, Outcome **Verified / Result v1**, Verification **2/2**, exactly two changes **Not applied**. The **Changes** tab visibly offers the owner **Apply** button; it was not clicked. Coordinator **Status unconfirmed** remains its separate, older initiation clock and does not override this final result.

Reconcile was inspected rather than invoked: its recovery pass can also schedule reserved jobs and drain the queue, so it cannot be described globally as a GET-only observation. The transient Reconcile prompt during active checking is a presentation limitation; it was not necessary for this run to finish. The earlier intermittent Offline view cleared, and a reload obtained the current final result without restarting the bridge.

**Owner next action:** review frozen C1 and both receipts in this same run. If acceptable, use the separate owner **Apply** action, then confirm integrated checks and manual/phone UAT before final sign-off. The dynamic/aliased-call limitation and unvalidated 421 textual-match baseline remain explicit review caveats; no bulk R48 cleanup is included. **Current stop point: verified candidate at owner Apply/UAT gate, not shipped or owner-accepted.**

## Owner Apply and final integrated validation - 2026-10-24

The owner reported Applied at 14:14:59 UTC. No agent Apply was sent. Authoritative application `app-497cee609b88`, command `c8164c30-97a0-4243-82d2-8cbaf379c9a1`, binds this run, frozen C1 and `res-a20e5a5a072c@1`, plan digest `aplan-38d5d1041723`. It finished **Applied**, revision 5, at **14:23:46.583Z**. Receipt **`rc-app-497cee609b88-applied`** at 14:23:46.585Z records integrated candidate `cand-388fd1a807ad`, Fetch guard evidence `e-5562d9c32b6c` and typecheck `tc-353cc63b0f91`, both satisfied. P1 pre-write reassessment and final A1 checks passed; no remaining integrity failures or gaps. The harmless pre-write drift was this run's PM Master Book projection.

Before any post-Apply repair, both integrated paths matched frozen C1 exactly; unrelated tracked source/test hashes matched their pre-Apply baseline. Both older R44 runs remained CLOSED/cancelled. Run disposition remains verified_candidate while its separate application is Applied: these describe different records. The served desktop and 390 x 844 mobile view both showed Applied, two changes, and both checks passed. Reload retained the same run/result/application identities; there was no additional Start, Apply or provider work. Mobile was browser emulation, not a physical phone.

### Original failure and separately authorized local repair

Direct execution of C1's newly authored fixture suite exposed **five failures**, each `Test timed out in 5000ms`. The original tests launched a full ESLint process in every async case. The unchanged suite also failed alone (roughly 6.9-8.7 seconds per case); the first integrated aggregate was **1,390 passed, five failed, eight existing opt-in skips**. Protected guard 36/36 and protected typecheck had passed; they did not execute these authored fixtures. Those earlier receipts are preserved and do not assert that this suite passed.

The owner-authorized repair changes only local `tests/pm-ui/raw-fetch-guard.test.ts`: stage the same five client/server fixtures in an owned temporary directory, invoke the real ESLint CLI/config once in shared setup, map its five results to the unchanged behavioral assertions, then remove that temporary directory. No deadlines, selectors, warning levels, assertions, skips or paid-API blocking were weakened. An explicit string-map type fixes a typecheck error found during repair. The repaired suite passes 5/5; measured shared setup was about 2.9 seconds and individual assertions 0-1 ms.

| File identity | SHA-256 |
| --- | --- |
| Frozen C1 `eslint.config.mjs`, also current config | `2c5f052daf9e259df5651c86bb64bad74c4cd93bae1de52b25ac02a12602310e` |
| Frozen C1 original fixture, unchanged in frozen generation | `42d3646b594c819211727f5170727fc1d082742c11f8dcdcdb403d456afaafef` |
| Final local post-Apply fixture | `ee37adc483a354bd61d9b600214ec43c3716b2a06df17181b9152ec7d040d6a0` |

Frozen C1 remains at `C:/Users/aoune/AppData/Local/era-delivery-v2/a1c73a32d026/generations/r-46688acd1b86/C1`. **The final checkout no longer equals C1 for the fixture.** This is a visible, uncommitted post-Apply repair, not a substituted candidate or a rewritten Apply receipt. Exact diff and hashes are `.tmp/r44-acceptance-20261024/post-apply-fixture.diff` and `post-apply-hashes.json`; the committed-source deliverable is the actual test file plus this durable explanation.

### Final automated outcomes

| Check | Final outcome |
| --- | --- |
| Delivery V2 + PM UI + relay/bridge aggregate, one invocation | **1,395 passed, zero failed, eight existing opt-in skips**, 104 files (`post-repair-aggregate.json`) |
| Final fixture after explicit map type | **5 passed**, zero failed (`post-repair-final-fixture.json`) |
| Host integrated `pnpm typecheck` | **Passed**, exit 0 after repair |
| ESLint on R44 config and final fixture | **Passed**, exit 0 |
| PM frontend build | **Passed**, exit 0; 1,106,904 B JS + 239,586 B CSS |
| Independent protected/oracle guard | **36 passed**, zero failed/skipped (`applied-oracle.log`) |
| Explicit literal/dynamic limitation probes | **7 cases passed** (`dynamic-limitations.json`) |

The aggregate preceded the final type-only map annotation; fixture/typecheck/lint passed again afterward. No behavior changed in that annotation. All tests were offline/replay-only. No main application production build, physical phone or deployed relay validation is claimed.

### Actual R48 baseline and limitations

Actual ESLint evaluation of **692 files** found **96 guard warnings in 34 files**: components 61, features 27, hooks 8, contexts 0. Every guard finding is severity 1; no fatal diagnostics or other errors. The **421 textual matches are not the violation baseline**. Existing unrelated rules account for the remainder of 756 total warnings; no bulk mutation replacement or severity promotion occurred.

POST/PATCH/PUT/DELETE literals on direct `fetch` calls warn in the four intended client trees. GET, omitted method, `safeFetch`, nested header `method` and server routes remain unaffected. Dynamic methods, aliased calls, computed method keys and `window.fetch` remain outside this syntax guard. Separate seven-case real-CLI probes confirm the documented dynamic/alias limits.

### Remaining acceptance and reporting limits

1. Owner reviews the local post-Apply fixture diff and the final evidence above. No further Apply or paid pilot is needed for this test-only local repair.
2. On a physical phone through the normal paired relay, open this exact run and confirm Applied, C1/two paths and both checks; reconnect/reload must preserve identities without a new Start. Record actual expected/observed results. This is untested here, not a failed phone test.
3. Owner records final acceptance/sign-off. R44 remains open pending that decision; R48 retains the 96-warning burn-down separately.

Timely chat reporting is still a limitation: planning finished 13:58:42, but the owner-facing checkpoint was 14:02:12; final Result existed 14:09:28, but the update arrived 14:13:56. Local status recovery and final UI agreement passed; automatic parent-chat synchronization was not established. No guaranteed 100% success rate is claimed.

Final `pm:lint`, `docs:check`, `pm:archive` (nothing to sweep), `pm:dashboard` and `git diff --check` pass. `pm:check-docs` still fails on 15 pre-existing missing October 18-19 temporary evidence links; no targets were fabricated. Unrelated source/test hash comparison remained unchanged after the local repair. A final read-only `docker ps` check could not open Docker's local named pipe (Access is denied); its fresh container listing is unavailable, rather than evidence of a worker still running. Earlier cancellation/worker checks and final terminal supervisor/checker receipts remain the established evidence; no denied Docker action was retried.

No bridge restart, policy/model/budget change, additional provider job, commit, push, deployment or unrelated source repair was performed. All validation commands have finished. Current disposition: **Applied plus an explicitly documented local test-only repair; automated acceptance passed, owner/manual acceptance pending.**

## Later fixture startup correction — 2026-10-24

During the Steward sign-off review, the local fixture's shared ESLint CLI process timed out at its existing 30-second bound before its five assertions ran. A bounded diagnostic reproduced plugin loading stalls. The fixture now uses one real ESLint API instance at the repository root, loading the unchanged `eslint.config.mjs` and linting the same virtual client/server filenames. Positive/negative cases, assertions, warning severity, exclusions, child timeout and per-test deadlines are preserved. It passed **5/5** alone in 2.26 seconds and in the final **241/241** Steward/auth/relay/fixture regression invocation across 13 files. Typecheck and scoped lint pass.

The current local fixture SHA-256 is `e8315a401bef18d5f400a30ec3e69cfa69404ad6dfd7578e235671581298fdfa`, superseding the earlier local `ee37…` hash above. Its diff from original C1 is retained at `.tmp/steward-fix-review/raw-fetch-fixture.diff`. Original C1, application receipts and the earlier repair evidence are preserved. This is an additional local test-only correction, not a replacement candidate or new Apply. [Current Steward acceptance status](ERA-Steward-Signoff-Plan-2026-10-24.md#review-corrections-and-sign-off--2026-10-24).

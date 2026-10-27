# Delivery UAT — current attempts and recent direct deliveries

Drafted 2026-10-25. [UAT home](Delivery-UAT.md) · [Workflow specification](<../ERA Notes/10 - Project Management/Plans/Delivery UAT Sign-off and Feedback.md>)

This is the owner's test script, not a record that these tests passed. It covers **all eight retained V2 attempts** plus **nine recent direct delivery scopes** awaiting owner acceptance. Repeated attempts remain separate. Existing owner decisions and historical observations stay in [Delivery UAT](Delivery-UAT.md) and the linked acceptance reports.

**Readiness:** the read-only attempt-review steps below are ready to follow once the existing Command Center is accessible. Product mutation scenarios and operational checks are **Draft / setup required** until the delivering agent supplies the exact candidate/build and isolated data described below. No new owner result was recorded on 2026-10-25. A missing build or fixture is **Blocked**, not a failed feature. A cancelled attempt with no candidate has no product acceptance to sign.

## Before you begin

1. On the laptop, open the existing PM Command Center browser tab. If it is not open, use the address printed by your already-running `pnpm pm` terminal; the usual address is `http://127.0.0.1:4317/`. **Expected:** Home, Sprints, Delivery, Work and Analytics are visible. If the server is unavailable, record Blocked and have its owner restore access.
2. Select **Delivery**. Open **Earlier deliveries** when the item is not under **Needs you**, **In progress** or **Waiting**. **Expected:** existing attempts are listed; opening them does not start a new delivery.
3. Open the named item, then **Activity**. Read **Run ID** and compare it with the table below. **Expected:** the exact attempt matches. For repeated item names, use the table's `#/delivery/run/...` fragment in the same PM browser address to open the intended attempt directly.
4. Record the displayed build/version, browser/device and test date. For a phone, use the existing signed-in `/pm/live` Command Center and the same run fragment. **Expected:** the same run, candidate and application state. A narrow laptop window checks layout; it does not replace this phone pass.
5. Follow the numbered scenario for that item. Write what actually happened against the failing step, including expected versus actual and a screenshot when useful. **Expected:** each scenario ends with your own Pass, Fail or Blocked observation. Record it in **Test steps** once this scenario has been loaded and marked ready (see the [UAT home](Delivery-UAT-Scenarios-2026-10-25.md#how-to-use-a-scenario)); until then, record it beside the scenario or in the existing UAT record.

These instructions do not start a provider job, Apply a candidate, renew authority, publish to Drive or change production data automatically. Scenarios marked **owner action** describe future deliberate owner testing. The delivering agent must provision isolated fixtures and exact build identity before handing those scenarios over. Do not use real household money as test data.

## Attempt coverage

Inventory source: a read-only SQLite transaction against `.delivery/v2/supervisor.sqlite` on 2026-10-25, with each contract's outcome and candidate manifest inspected. Dates below are recorded UTC creation dates, not owner test dates.

| Item / attempt | Created | Candidate / application evidence | Scenario and disposition |
|---|---|---|---|
| DLV-107 · `r-c1d69bb666cf` | 2026-09-14 | C1 `cand-33d28f42e41a`; one rolled-back application and four later conflicts | [V2-107](#v2-107--open-the-right-campaign-history): review ready; old candidate is not applied |
| DLV-90 · `r-8e7f635c1466` | 2026-09-15 | Cancelled; no candidate or application | [V2-CANCEL](#v2-cancel--review-a-cancelled-attempt): product UAT not applicable to this attempt |
| BUD-83 · `r-83dddb67fea9` | 2026-09-19 | C1 `cand-f6ae4776ef53`; no application | [V2-83](#v2-83--remove-an-accidental-pending-split): draft; candidate-bound test environment required |
| KIT-11 · `r-54d5cf10d995` | 2026-09-26 | C1 `cand-a3861f76acb1`; no application; first trial arm | [V2-11-A](#v2-11-a--review-the-unapplied-cooking-count-attempt): review ready; separate product build required |
| KIT-11 · `r-fa5c81702ec7` | 2026-09-26 | C1 `cand-1935997dbdd3`; reassessment failed, then rolled back, then `app-d34c1586e1d3` applied | [V2-11-B](#v2-11-b--save-two-cooking-logs-and-check-the-count): historical owner Passed gate retained; new detailed scenarios Pending |
| R44 · `r-262a6aee5ed3` | 2026-10-19 | Cancelled; no candidate or application | [V2-CANCEL](#v2-cancel--review-a-cancelled-attempt): separate retained attempt, no product sign-off |
| R44 · `r-69bc10ef3c60` | 2026-10-24 | Cancelled; no candidate or application | [V2-CANCEL](#v2-cancel--review-a-cancelled-attempt): also covers the corrected cancellation display |
| R44 · `r-46688acd1b86` | 2026-10-24 | C1 `cand-b20dc2d745ce`; Result `res-a20e5a5a072c@1`; `app-497cee609b88` applied | [V2-44](#v2-44--review-the-raw-fetch-guard): owner review Pending; local fixture differs from frozen C1 |

**Historical evidence retained:** KIT-11's owner-recorded Passed gate and the 2026-10-18 physical-phone reconnection/Applied observation remain valid for their recorded scope. They do not certify every newly written scenario, a new deployment, or R44. R44's owner Apply is application evidence, not UAT acceptance.

## V2-107 — open the right campaign history

**Acceptance:** [DLV-107](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-107>). **Original symptom:** a completed item's old link opened the campaign board rather than its history. **Data:** retained run `r-c1d69bb666cf`; for the behavior test, the implementer supplies an isolated PM browser fixture with one shipped and one discarded item, their old detail URLs, and a campaign named `Hub & ERA`. That fixture is not supplied by this documentation task.

**V2-107-M1 — inspect the retained delivery (ready for read-only review)**

1. Open PM **Delivery → Earlier deliveries → DLV-107**, then **Activity**. **Expected:** Run ID is `r-c1d69bb666cf`.
2. Select **Changes**, then `Work.tsx`. **Expected:** the candidate changes the history query from `view=story` to `tab=story`. If the retained diff is unavailable, record Blocked with that message.
3. Read the application history on **Changes**. **Expected:** the earlier rollback and later conflicts remain visible; the attempt is not described as currently applied. Leave Apply and rollback controls untouched.

**V2-107-M2 — follow an old item link (draft until fixture URL is supplied)**

1. Open the supplied old detail URL for the fixture's shipped item. **Expected:** its completion record or the old-item fallback appears.
2. In the current completion record, select the campaign link above the item title. If the fixture deliberately exercises the old missing-item fallback, select **See what changed**. **Expected:** the campaign opens with **The story so far** selected, and the shipped receipt is visible. The address contains `tab=story`.
3. Repeat with the supplied discarded item's old URL. **Expected:** the discarded receipt appears in that campaign's history.
4. Repeat in the `Hub & ERA` fixture campaign. **Expected:** the space and ampersand do not break the destination.
5. Return to the campaign's normal work view and switch Board/List. **Expected:** both normal work views still open. Repeat at approximately 390 px width; no horizontal page scrolling.

**Actual:** Pending. **Reset:** close fixture tabs; no live PM item is shipped/discarded for this test. **Limit:** current source has a richer completion-record view than the original September candidate, so a current-source pass is a regression observation, not a fresh certification of the rolled-back C1.

## V2-CANCEL — review a cancelled attempt

**Type:** historical-state review. Repeat the full sequence separately for DLV-90 `r-8e7f635c1466`, R44 `r-262a6aee5ed3` and R44 `r-69bc10ef3c60`. **Prerequisite:** updated local PM UI; physical-phone repetition requires the corresponding hosted UI. **Data:** only those existing records.

1. Open the attempt using its exact `#/delivery/run/<run ID>` fragment in the existing PM tab. **Expected:** the closed attempt opens on **Outcome**, rather than reopening an approvable plan.
2. Select **Activity**. Compare **Run ID** and **Status**. **Expected:** the exact run ID and a cancelled/closed status; it must not say that the cancelled run is still planning.
3. Open **Plan** only to inspect any historical proposal. **Expected:** retaining a proposal does not make this cancelled attempt active or approve it.
4. Return to **Delivery**, reopen the same attempt and refresh the browser. **Expected:** the same cancellation remains. No new run is created by viewing history.
5. For the two R44 cancellations, open `#/delivery/run/r-46688acd1b86` afterward. **Expected:** the later applied R44 attempt is separate; it has not overwritten either cancellation.

**Actual:** Pending for each of the three review passes. **Product UAT:** not applicable; none produced a candidate. **Reset:** none, read-only. **Evidence gap:** DLV-90's frozen contract references the earlier `dlv107-*` criteria despite its DLV-90 title. This is a historical contract mismatch; it is not evidence that zero-test validation passed. A future DLV-90 candidate needs its own correct acceptance and test script. Do not restart any of these attempts to manufacture acceptance evidence.

## V2-83 — remove an accidental pending split

**Acceptance:** [BUD-83](<../ERA Notes/10 - Project Management/Budget/Budget — Master Book.md#bud-83>). **Type:** feature, permissions, money regression and Undo. **Readiness:** Draft / blocked until the implementer supplies C1 or a replacement candidate in an isolated two-user test household. The retained candidate is unapplied. The ordinary checkout's transaction detail does not currently contain this candidate's Split control.

**Prepared data the implementer must provide:** owner A and linked partner B, each with a separate browser session; dates set to the test day; `UAT83-Pending` owned by A with a pending split to B, creator amount USD 10 and no completed split; `UAT83-Plain` with no split; `UAT83-Completed` already completed by B; a second pending split `UAT83-Other` whose notification must remain. Record both account balances and balance-history counts after setup. Supply the environment URL and accounts; do not ask the tester to discover IDs or seed a live database.

**V2-83-M1 — remove the pending tag and undo**

1. In A's browser, open the supplied application URL at `/expense` in mobile mode. Tap **Activity** in the bottom navigation, then **Spending**. **Expected:** today's prepared transactions appear. This view currently has no description search field; find the named row in the short prepared list.
2. Tap `UAT83-Pending` once. **Expected:** its transaction details open and **Split** is checked and enabled.
3. Uncheck **Split**. **Expected:** the pending split is removed; an Undo toast appears. The transaction amount and both account balances remain at their recorded starting values.
4. Immediately press **Undo** on that toast. **Expected:** the same split request is restored for partner B, with the same transaction and amount; no second transaction or balance-history entry is created.
5. Close the details, reopen `UAT83-Pending`, then reload the page and reopen it again. **Expected:** the restored Split state persists; it is not only an optimistic screen update.

**V2-83-M2 — partner list and notification update**

1. With the fixture reset to a pending split, open B's prepared browser session and its pending split notification/list. The implementer must supply the exact entry point for the candidate build. **Expected:** both `UAT83-Pending` and `UAT83-Other` are present.
2. On A, return to **Expense → Activity → Spending**, open `UAT83-Pending` and uncheck **Split**. This time let the Undo toast expire. **Expected:** that request is removed.
3. On B, refresh the pending split list and notifications. **Expected:** only `UAT83-Pending` disappears; `UAT83-Other` remains. B's balance is unchanged.
4. On A, reload and reopen the transaction. **Expected:** it has no Split tag. The implementer verifies that only the five specified split fields were cleared and that balance history did not change; the owner records the visible behavior separately.

**V2-83-M3 — plain, completed and nonowner transactions**

1. On A, open **Activity → Spending → UAT83-Plain**. **Expected:** no Split tag.
2. Close it and open `UAT83-Completed`. **Expected:** Split is visible and checked, but cannot be unchecked. Trying it does not alter money or history.
3. On B, open `UAT83-Pending` after the fixture has restored the request. **Expected:** Split is visible but read-only for B; B cannot remove A's request.
4. Have the implementer replay the stale-client completion/removal race in the isolated route fixture. **Expected:** a completed split cannot be removed by a stale request, and a completion after removal cannot move money. Record the replay receipt separately from the owner's UI result.

**Actual:** Pending for M1–M3. **Reset:** use M1's Undo immediately; after M2/M3 the implementer restores the isolated fixture, including its notification state and recorded balances. Do not delete real transactions to clean up.

**Known source-review discrepancy, not an owner Fail:** frozen C1 unconditionally renders the Split row, including when `split_requested` is false. M2 step 4 and M3 step 1 deliberately retain the accepted requirement of no tag; do not weaken their expected result to match C1. This candidate also needs current household/RLS evidence before its cross-user/race behavior can be certified. No production visibility investigation or data change was performed here.

## V2-11-A — review the unapplied cooking-count attempt

**Acceptance:** [KIT-11](<../ERA Notes/10 - Project Management/Kitchen/Kitchen — Master Book.md#kit-11>). **Data:** first arm `r-54d5cf10d995`, candidate `cand-a3861f76acb1`.

1. Open **Delivery → Earlier deliveries → KIT-11** and check **Activity → Run ID** until it is `r-54d5cf10d995`. **Expected:** this is the first arm, not the later applied attempt.
2. Open **Verification**. **Expected:** its own recorded cooking-count result is shown. Record the displayed result without substituting the second arm's checks.
3. Open **Changes**, then `route.ts` under `recipes/[id]/cooking-log`. **Expected:** only that API file changed, and no application record makes this first candidate applied.
4. If product behavior for this first arm must be accepted, have the implementer expose its exact candidate in a separate isolated environment and run V2-11-B-M1/M2 there, recording **this** run and candidate. **Expected:** evidence stays attached to the first arm; a second-arm pass is not copied across.

**Actual:** Pending. **Reset:** none for review; restore the isolated recipe fixture if step 4 is commissioned. **Limit:** an unapplied candidate cannot be tested by opening the unchanged production recipe screen.

## V2-11-B — save two cooking logs and check the count

**Acceptance:** [KIT-11](<../ERA Notes/10 - Project Management/Kitchen/Kitchen — Master Book.md#kit-11>). **Original symptom:** the count stayed at an invented fallback of 1 because the count request had no response body. **Identity:** `r-fa5c81702ec7`, C1 `cand-1935997dbdd3`, applied through `app-d34c1586e1d3`. Current source still matches this candidate's changed route hash, listed below; deployed build identity has not been verified here.

**Prepared data:** isolated recipe `UAT11 Toast`, one instruction `Toast bread`, default servings 1, no cooking logs and count 0. The implementer supplies the matching test build and recipe. Saving feedback writes a cooking log; do this only in that isolated environment or through a separately chosen owner test.

**V2-11-B-M1 — count increments instead of staying at one**

1. Open the supplied application URL at `/recipe`. In **Search recipes...**, type `UAT11 Toast`. **Expected:** the prepared recipe appears without a positive `x` count badge.
2. Open the recipe. Select **Start Cooking**. Leave servings at 1 and select **Start**. **Expected:** the cooking screen opens on **Prep**.
3. Select **Let's Cook!**. Then select the **Done** phase at the top. **Expected:** the feedback page opens. This test records a fixture log; you do not need to physically cook.
4. Under **Overall Rating**, select four stars, then select **Save Feedback** once. **Expected:** the cooking screen closes; the recipe has one cooking log and the visible count becomes `1x` on its card / **Cooked 1 times** in its details.
5. Repeat steps 2–4 once more, keeping four stars. **Expected:** **Cooking Log (2)** and `2x` / **Cooked 2 times**, rather than remaining at one. The two log timestamps are present and the average rating stays four stars.
6. Close the recipe, refresh the browser, search `UAT11 Toast` again and reopen it. **Expected:** two logs and count 2 persist. There is no third log caused by reopening.

**V2-11-B-M2 — zero and unavailable counts (implementer-assisted replay)**

1. Open the attempt's **Verification** tab and the retained cooking-count check evidence. **Expected:** the evidence belongs to this second candidate, not the first arm.
2. Ask the implementer to show the isolated replay for a reported count of zero. **Expected:** `times_cooked` is written as 0, not 1; the already-created log is still returned.
3. Inspect the replays for missing count metadata and a failed count query. **Expected:** neither overwrites the recipe count with an invented value, and each returns the log already written so the caller is not prompted into a duplicate insert.
4. Inspect the same replay's rating and timestamp assertions. **Expected:** the rating calculation and both timestamps retain their existing behavior. Save the replay receipt alongside the manual result, not as a substitute for M1.

**Actual:** Pending for the newly drafted M1/M2. **Historical owner acceptance:** retained separately, not reset. **Reset:** the implementer restores `UAT11 Toast` to the isolated zero-log snapshot. **Limits:** error/zero metadata cases require deterministic replay; do not break production connectivity or edit production logs to create them. Existing historical recipes stuck at 1 are not repaired by this feature.

## V2-44 — review the raw-fetch guard

**Acceptance:** [R44](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r44>). **Type:** developer-tooling check; there is no new household-app button. **Data:** `r-46688acd1b86`, C1 `cand-b20dc2d745ce`, Result `res-a20e5a5a072c@1`, application `app-497cee609b88`. Read the [acceptance report](R44-Delivery-Acceptance-2026-10-24.md) before assigning the local fixture repair to the frozen candidate.

**V2-44-M1 — review the delivered change**

1. Open PM **Delivery**, select the applied R44 attempt, then **Activity**. **Expected:** Run ID is `r-46688acd1b86`; the two earlier cancelled R44 attempts are different records.
2. Select **Outcome**, then **Verification**. **Expected:** the retained candidate is Verified and its Fetch guard and typecheck evidence are readable. Do not infer that the candidate-authored test suite ran just because those two checks passed.
3. Select **Changes → eslint.config.mjs**. **Expected:** the guard targets client components/features/hooks/contexts and uses warning severity. It does not promote existing warnings to errors or replace existing application calls.
4. Open `raw-fetch-guard.test.ts` in **Changes**. **Expected:** the frozen C1 fixture is shown. Compare it with the later local repair described in the acceptance report; their hashes differ intentionally.
5. Read the application history. **Expected:** `app-497cee609b88` is Applied. Repeat steps 1–5 on the physical phone through `/pm/live`; record that result separately.

**V2-44-M2 — observe the tooling rule on the current corrected checkout**

1. Have the implementer identify the corrected checkout and show its two hashes from the appendix below. **Expected:** config matches C1; the test is the corrected local fixture, not C1's original bytes.
2. Open a terminal in `C:\Users\aoune\WebApp\budget-app` and run `pnpm exec vitest run tests/pm-ui/raw-fetch-guard.test.ts`. **Expected:** the five existing fixture tests pass; a timeout/failure is recorded as observed, not ignored. This is an offline replay suite, not a provider trial.
3. Open the fixture in the editor and compare the cases with the command's result: client literal POST/PATCH/PUT/DELETE, GET, `safeFetch`, server routes and warning severity. **Expected:** supported raw client mutations warn; safe/read calls and server exclusions are preserved.
4. Record that computed methods and aliases are outside this syntax rule's guarantee. **Expected:** the report does not claim complete detection or R48's wider cleanup.

**Actual:** Pending. **Reset:** close the terminal/editor; fixture tests need no real transaction or file edit by the tester. **Limit:** M2 certifies the identified corrected local source only. It cannot retroactively certify the original candidate-authored tests, and no paid/live provider call is needed.

## Direct delivery coverage

These scopes were implemented directly in the working tree, not in nine new Delivery runs. Evidence cutoff for this draft is HEAD `735d3881` plus the inspected 2026-10-25 working tree. The source has uncommitted R74/R75 and Steward changes. The implementer must supply the final source manifest and served/deployed build before these become build-bound handovers. Existing fixture evidence is linked; no new fixture or browser run is claimed here.

| Item | Scenario | Current handover limitation |
|---|---|---|
| [DLV-139](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-139>) | [DIRECT-139](#direct-139--one-start-checks-readiness) | Operational one-Start behavior needs an explicitly chosen owner pilot or isolated fixture |
| [DLV-140](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-140>) | [DIRECT-140](#direct-140--follow-the-same-steward-request) | Retained run can be inspected; unresolved/stale states need supplied fixtures |
| [DLV-141](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-141>) | [DIRECT-141](#direct-141--read-the-launch-screen) | Desktop source/fixture evidence exists; deployed phone identity required |
| [DLV-142](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-142>) | [DIRECT-142](#direct-142--renew-only-when-you-choose) | Explicit Check renews authority; owner must choose to test it |
| [DLV-143](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-143>) | [DIRECT-143](#direct-143--keep-a-failed-starts-exact-result) | Retained cancellations can be inspected; lost/refused Start replay fixture needed |
| [DLV-144](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-144>) | [DIRECT-144](#direct-144--steward-tools-usage-and-candidate-tests) | Dot connection and permissions remain separate unresolved integration evidence |
| [R73](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r73>) | [DIRECT-73](#direct-73--find-delivery-in-the-navigation) | Running/waiting/stale/reduced-motion cases need existing isolated fixture |
| [R74](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r74>) | [DIRECT-74](#direct-74--read-the-drive-mirror) | Real initial publish is recorded; current sync/phone evidence not observed here |
| [R75](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r75>) | [DIRECT-75](#direct-75--find-each-delivery-once) | Idle desktop/390 px recorded; active/waiting/unavailable fixture coverage separate |

## DIRECT-139 — one Start checks readiness

**Type:** defect regression. **Original symptom:** readiness expired between a separate Check and Start; a stopped Docker engine could be described as a missing dependency volume. **Prerequisite:** implementer-provided isolated launch fixture with live/provider dispatch blocked, or a separately owner-authorized bounded pilot. Use the fixture first; do not launch R44 again because it appears in these examples.

1. Open the supplied launch fixture at `#/deliver/<its item ID>`. **Expected:** the correct item and its permitted selection appear; a sole permitted executor is preselected.
2. Open **Settings** and note executor, lane, model and effort. Close it. **Expected:** the selection remains unchanged.
3. With the fixture's passive gates satisfied and live checks stale, press **Start** once. **Expected:** progress appears and the same request collects fresh readiness; you are not asked to race a separate Ready window.
4. Wait for the fixture's success. **Expected:** one run opens, with one planning attempt and a plan requiring owner review. Stop before Approve.
5. Reset the fixture to its stopped-Docker case and repeat once. **Expected:** **Start blocked** identifies Docker as not running; no run/job exists. A generic missing-volume diagnosis is not substituted.
6. Open **Start details**, then reload. **Expected:** the same request and blocker remain. The implementer confirms fixture request counts: repeated viewing caused no dispatch.

**Actual:** Pending. **Reset:** close/reset the isolated fixture. **Limits:** source-change-during-collection, collector failure and current-ready skip are verified by replay cases linked under DLV-139; request those receipts if not supplied. An operational pilot needs its own approved item and budget, not this draft's example ID.

## DIRECT-140 — follow the same Steward request

**Data:** retained R44 run `r-46688acd1b86`; additional unresolved/stale fixture. **Type:** request identity and liveness.

1. Open **Delivery** and the latest applied R44 attempt. **Expected:** attribution says **ERA Steward**, with the full request card on the run page.
2. Open the request's **Evidence** disclosure and note its request ID, run ID, stage and last-confirmed time. **Expected:** the request links to `r-46688acd1b86`; a timestamp is evidence of confirmation, not a new job.
3. Refresh, then open the same run on the physical phone. **Expected:** request/run identity and terminal result agree. Each device can independently show connection freshness.
4. Open the supplied unresolved request fixture and leave it past its configured stale interval (default three minutes). **Expected:** **Status unconfirmed** appears while the last known job state stays unchanged. It must not turn into a failed job or retry.
5. Open the fixture's original request again after a simulated lost response. **Expected:** the original receipt is recovered; the fixture records no second Start or replacement UUID.

**Actual:** Pending. **Reset:** none for the retained run; close/reset the fixture. **Limit:** owner versus Steward attribution records the entry used and authenticated PM actor; it does not prove the external chat's permissions or tool use.

## DIRECT-141 — read the launch screen

**Prerequisite:** current local frontend and matching phone deployment; isolated fixtures for pending/error states. **Data:** a supplied nonexecuting launch fixture. [Existing runbook](ERA-Steward-Runbook.md#launch-ui-acceptance--dlv-141).

1. Open its launch page. **Expected:** a short item title, **Settings**, readiness card and distinct main action; V1 progress steps are absent in V2.
2. Open **Settings**. Read the four choices, then close it. **Expected:** executor/lane/model/effort are accessible without permanently filling the screen.
3. In the fixture, press **Check readiness** once. **Expected:** **Checking readiness…** immediately; Check, Start and competing settings changes are disabled while it runs.
4. Let the fixture return unchanged blockers. **Expected:** completion still shows a checked time and **Setup required**. Open **Check details** for the actual gates.
5. Switch the fixture to success, then request failure. **Expected:** success shows **Checks passed** or **Checks at Start** as appropriate; failure shows **Check failed** and its error, with old evidence only under **Previous checks**.
6. Switch to a confirmed cancelled-intent fixture. Select **Open delivery**, return, then **New delivery**. **Expected:** Open reaches the old cancellation; New preserves its history and reveals Start without launching. An unknown intent instead keeps **Check status**.
7. Repeat at 390 and 320 px, Blue and Pink. **Expected:** buttons remain readable/tappable, no horizontal scroll, and bottom navigation does not cover the action.

**Actual:** Pending. **Reset:** close/reset fixtures and restore the tester's theme/viewport. **Limit:** do not interrupt the operational bridge to create an error case; a real Check also renews authority under DLV-142.

## DIRECT-142 — renew only when you choose

**Owner action:** Check readiness changes the authorization expiry. **Prerequisites:** valid installed policy, updated server and local frontend, owner pairing, corresponding updated phone frontend, and an owner decision to perform this check. No Start is needed. [Authority contract](ERA-Steward-Runbook.md#check-readiness-renews-saved-authority-dlv-142).

1. Open the chosen item's launch page. Write down **Authorized until**, selected settings and existing setup blockers. **Expected:** these are the current saved facts.
2. Press **Check readiness** once. **Expected:** pending feedback, then an expiry at least 24 hours after this explicit click; a longer existing expiry is not shortened. Genuine setup blockers may still remain.
3. Refresh the page and wait for passive updates. **Expected:** the same expiry persists; merely reading the page does not extend it again. Start remains untouched.
4. On the matching phone shell, open the same launch page and read the expiry. **Expected:** it agrees with desktop. If choosing to test phone renewal, press Check once and confirm the new expiry appears on both devices.
5. In the supplied isolated replay, resend the same Check UUID, change policy settings, and supply an unreadable renewal journal. **Expected:** replay adds no time; changed settings cannot inherit the old renewal; corrupt evidence refuses. The installed policy bytes, usage, scope and approval requirements remain unchanged.

**Actual:** Pending. **Reset:** fixture cases reset their temporary journal. A deliberate operational renewal has no pretend Undo: retain its receipt and record the new expiry; do not edit the live journal to restore an older time. **Limit:** the full ongoing-run/legacy-grant cases need the existing authorization replay receipts, not a new live provider run.

## DIRECT-143 — keep a failed Start's exact result

**Original symptom:** a model metadata timeout became generic “delivery not ready”; reload lost details and recovery could resend a write. **Prerequisite:** implementer-provided refused/lost-response launch fixture using the current frontend. [Runbook](ERA-Steward-Runbook.md#one-start-result--dlv-143).

1. Open the fixture launch page and press **Start** once. Let its model-check timeout response arrive. **Expected:** **Start blocked** names the actual timeout rather than only a generic failure.
2. Expand **Start details**. Copy the request ID and exact blocker. **Expected:** the failed request's own readiness snapshot is retained.
3. Reload, then select **Check status** if recovery is offered. **Expected:** the same request ID and failure return; the fixture network log shows GET-only recovery and still one Start.
4. Allow passive readiness to change in the fixture. **Expected:** the original **Start blocked** record remains visible; newer readiness does not rewrite its cause.
5. Repeat with a lost-response/unknown fixture. **Expected:** unknown remains attached to the original request; it does not automatically turn into a new Start.
6. Run V2-CANCEL for `r-69bc10ef3c60` on the actual read-only history. **Expected:** cancellation appears consistently on Outcome and Activity, while the later applied R44 attempt remains separate.

**Actual:** Pending. **Reset:** close/reset the fixture. **Limit:** these checks do not promise the upstream model service will respond; the bounded native metadata timeout and cleanup need their retained replay evidence. No fresh operational Start is required for this script.

## DIRECT-144 — Steward tools, usage and candidate tests

**Acceptance:** DLV-144 Phases 1–3; [existing M1–M5 observations](Delivery-UAT.md#era-steward-sign-off--2026-10-24) remain authoritative history. **Prerequisites:** complete the [separate Dot connection checklist](ERA-Steward-Dot-Connection-Setup-2026-10-25.md) through its actual owner connection/permissions steps; running updated bridge/tool server; existing restricted pairing. Missing connection is Blocked, not assumed configured.

**DIRECT-144-M1 — ask for an existing run without delegating a coding task**

1. Open the installed ERA Steward private plugin's tool catalogue in ChatGPT. **Expected:** `start-delivery`, `read-request`, `read-run`, `wait-for-changes` are discovered. Local Codex registration alone does not satisfy this step.
2. In the connected Dot conversation, request: “Use read-run for r-46688acd1b86; do not start another delivery.” **Expected:** a direct typed tool call returns that run, its Applied owner-next state, checks and evidence time.
3. Request `wait-for-changes` for that same run with a five-second timeout. **Expected:** the same run returns; no coding-agent Work task or Start is created by these reads.
4. Follow the connection checklist's owner step to revoke Dot's general local-computer access, then repeat step 2 through the private plugin. **Expected:** the restricted tunnel read still works. Record the actual permission configuration; a model's verbal claim is not sufficient.
5. Restart only the tool-server process when the owner chooses, then repeat the same read. **Expected:** identity persists and no new delivery is launched.

**DIRECT-144-M2 — inspect usage and protected test evidence**

1. In PM open **Delivery → applied R44 → Activity** and find **Support**. **Expected:** Delivery and Support usage are separate; missing Support/Chat measurements remain unknown or not measured rather than zero-cost claims.
2. Compare the connected tool's read-run usage lines with the same attempt. **Expected:** Delivery / Support / Chat coverage is explicit, with known subtotals labelled; historical unmeasured support is not invented.
3. Open the implementer-supplied candidate-tests replay evidence: passing candidate, failing candidate, skipped/missing tests, changed test bytes and integrated Apply checks. **Expected:** only complete clean tests for the exact current candidate satisfy the gate; all negatives prevent verification/Apply, with owner approval still required.
4. Inspect the linked support-ledger replay: no authorization, one authorized job, duplicate job, missing usage and exhausted allowance. **Expected:** no automatic support is admitted; unknown usage/job limits block another job. This ledger accounts for support, not external runtime enforcement.
5. Repeat the run/usage inspection on the physical phone. **Expected:** same run and evidence; a deployment gap is Blocked, not Passed from a desktop screenshot.

**Actual:** Pending for M1/M2. **Reset:** no data changes for reads; leave deliberate owner permission changes as recorded in the setup checklist. **Limits:** a hard ban on all Dot cloud delegation, a hard spending cap and measurement of unreported Chat usage are not established. The October 24 synthetic checker positive/negative results remain historical evidence; this script does not repeat setup, install policy or launch a new model job.

## DIRECT-73 — find Delivery in the navigation

**Prerequisite:** current local frontend; updated phone frontend for the real-phone pass. Isolated fixture supplied for active/waiting/unavailable states.

1. Open PM Home. Read the main navigation left to right. **Expected:** **Home → Sprints → Delivery → Work → Analytics**, with Delivery raised slightly and its label visible.
2. Select each destination, then return to Delivery. **Expected:** all five destinations still work; the center placement has not changed their targets.
3. On the phone, scroll to the bottom of a long page. **Expected:** the last content and controls remain above the navigation; there is no horizontal page scroll at 390/320 px.
4. Open the fixture showing a running delivery, then navigate to Work. **Expected:** Delivery softly alternates gold/purple on both pages. Switch the fixture to waiting, closed, stale/offline and read-error states. **Expected:** waiting is steady; closed/unconfirmed states do not animate as current execution.
5. In the fixture browser's reduced-motion setting, request reduced motion. **Expected:** a static signal replaces animation. Repeat in Blue and Pink.

**Actual:** Pending. **Reset:** restore theme/reduced-motion/viewport preferences and close the fixture. **Limit:** do not start a real job just to see the animation.

## DIRECT-74 — read the Drive mirror

**Prerequisite:** the existing owner-configured Drive folder has synchronized, with the publisher already running. This is a read-only inspection; no new publication is required by this draft. [R74 evidence](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r74>) records an initial 47-document publish and an unchanged second pass, not today's freshness.

1. Open Google Drive or File Explorer and open **ERA PM Command Center** (`G:\My Drive\ERA PM Command Center` on this laptop). **Expected:** **01 - PM Documentation**, **02 - Delivery Status**, **03 - Steward Proposals**.
2. Open **02 - Delivery Status → status.md**. Note the published/evidence time and find R44 `r-46688acd1b86`. **Expected:** identity and application state can be compared with the actual PM run; a stale/unavailable snapshot is labelled as such.
3. Open its run link, using the normal signed-in `/pm/live` origin if the copied file exposes a relative `/pm/live#...` path. **Expected:** it opens that exact R44 run. If the link cannot resolve from Drive, record the exact broken link as feedback; do not count text containing a URL as a working link.
4. Open **01 - PM Documentation → PM → PM Tooling** and the Master Book/checklist copies. **Expected:** they are identifiable mirrors of local canonical documents. Open the Docs copy of **Delivery-UAT.md** when present. **Expected:** its historical observations are readable and have not become fresh Pass results.
5. Ask the implementer to show the existing isolated publisher fixtures for repeated unchanged publication, missing Drive folder, interrupted/hung write, edit preservation and secret withholding. **Expected:** unchanged files are not rewritten; failure retains stale evidence; external edits are preserved under Proposals before replacement; no change from Drive is imported into local PM work.

**Actual:** Pending. **Reset:** close files; do not edit real Drive mirrors to test conflict handling. **Limits:** the current R74 mirror is one-way and does not implement UAT feedback import, sign-off or durable candidate handover display. A rolling status list is not an inventory of every historical delivery.

## DIRECT-75 — find each delivery once

**Prerequisite:** current R75 local bundle; equivalent phone deployment for device acceptance. **Data:** eight V2 attempts above plus existing V1 history; active/waiting/unavailable fixtures supplied by implementer.

1. Open PM **Delivery**. **Expected:** applicable sections appear in this order: **Needs you**, **In progress**, **Waiting**, **In focus**, **Earlier deliveries**. Empty sections are hidden except In focus.
2. Find BUD-83 under the section reflecting its pending Apply decision. **Expected:** one row for `r-83dddb67fea9`; it is not repeated in In focus or Earlier deliveries.
3. Expand **Earlier deliveries** and select its outcome filter. Open each of the three R44 attempts from the coverage table. **Expected:** three different runs, one row apiece; the request with a run is attribution on its row rather than another copy of the run.
4. For a retained blocked request without a run, open **Request**. **Expected:** the same full request card and blocker appear; no imaginary run is created to display it.
5. Open the supplied In progress/Waiting fixture. **Expected:** the waiting row retains its actual verdict; **Writers/Jobs** appears once in the first occupied running/waiting section, with an **i** hint. When the fixture is idle, the capacity line disappears. **Overlaps** replaces Pairs.
6. Repeat the list at 390 px. **Expected:** the status column stays visible, the row opens the intended run and no horizontal page scrolling is needed.
7. In the fixture, make the queue unavailable while retaining a known Apply decision. **Expected acceptance extension:** the decision must remain findable with unavailable/stale evidence. Record the observed behavior separately: the [follow-up UAT plan](<../ERA Notes/10 - Project Management/Plans/Delivery Manual UAT.md>) already identifies this as a remaining gap, not part of R75's proven shipped scope.

**Actual:** Pending. **Reset:** restore the filter/viewport and close fixtures. **Limits:** current history is capped at 50 rows and filter selection is local view state; do not assume Load more or return-filter retention has been implemented. These are follow-up requirements in the linked plan.

## Evidence and identity appendix

The following retained changed-file bytes were rehashed read-only on 2026-10-25 and matched their candidate manifests. This checks identity only; it is not a test of the feature. No aggregate candidate digest is invented. All five candidates' retained roots existed. Cancelled attempts have no candidate to hash.

| Candidate | Changed path | SHA-256 |
|---|---|---|
| DLV-107 C1 | `scripts/pm/app/Work.tsx` | `7585c0fe7728e9286b454bd93712e9ef386cec84f49d3e1ac6298efeaee51446` |
| BUD-83 C1 | `src/app/api/transactions/[id]/route.ts` | `ee0467f90614cf3e904742b66c14b6b32bc0a88340223f942469e42d6c364b77` |
| BUD-83 C1 | `src/components/dashboard/TransactionDetailModal.tsx` | `ed838a9e99902c10c71a399be5c298725af2a9dca15bdda591f7999fffee8bdc` |
| BUD-83 C1 | `src/features/transactions/useDashboardTransactions.ts` | `6631577c0195e21757527a92817103517c2c74881710f77a9934924e6c5d81d3` |
| BUD-83 C1 | `src/lib/utils/splitBill.test.ts` | `630b551f4e64fd6630d934c9e73a9dd88e12d9eaf176a1ae7e63a201d4fba4a9` |
| BUD-83 C1 | `src/lib/utils/splitBill.ts` | `07189f0499f1dc414ade3bd4233fd18bf0e37988f3c6c59cac36afe66da63af9` |
| KIT-11 first C1 | `src/app/api/recipes/[id]/cooking-log/route.ts` | `a7423f7dc5183e039978a060a27f5e8eb90032ba237cbabb1816b3a88104f008` |
| KIT-11 second C1; current route | same path | `4b04c6e0eb3296f51ea42de81e7831433e75b8e6e92aa3c90156952acf3617d7` |
| R44 C1; current config | `eslint.config.mjs` | `2c5f052daf9e259df5651c86bb64bad74c4cd93bae1de52b25ac02a12602310e` |
| R44 C1 | `tests/pm-ui/raw-fetch-guard.test.ts` | `42d3646b594c819211727f5170727fc1d082742c11f8dcdcdb403d456afaafef` |
| R44 corrected local fixture | same path | `e8315a401bef18d5f400a30ec3e69cfa69404ad6dfd7578e235671581298fdfa` |

Source navigation checked against [PM Feature Map](<../ERA Notes/01 - Architecture/Feature Map/cross-cutting/pm-command-center.md>), [OutcomeReview](../scripts/pm/app/OutcomeReview.tsx), [DeliveryHome](../scripts/pm/app/DeliveryHome.tsx), [LaunchResult](../scripts/pm/app/LaunchResult.tsx), [PrimaryNavigation](../scripts/pm/app/PrimaryNavigation.tsx), [ActivityView](../src/components/activity/ActivityView.tsx), [MobileNav](../src/components/layouts/MobileNav.tsx), [RecipeDetailView](../src/components/web/RecipeDetailView.tsx) and [RecipeCookingMode](../src/components/web/RecipeCookingMode.tsx). Direct-scope server/UI source and runbook were inspected; exact final build manifests remain the delivering agent's handover obligation.

**Automated verification:** none run by this drafting task. Existing checks and counts belong to their dated Master Book/runbook receipts. **Not exercised:** all owner walkthroughs, production or fixture mutations, mobile/phone UI, live providers, readiness renewal, Apply/rollback, service restart, deployment, publishing and Dot integration. These are deliberate evidence gaps, not silently Passed results.

## Record your result

Copy this small record once for each scenario ID you actually perform. Keep separate entries for the two KIT-11 candidates, three cancelled attempts, desktop and phone, and any replacement build.

| Field | Your observation |
|---|---|
| Scenario / work ID | |
| Run / candidate or direct source manifest | |
| Tested build / environment / device | |
| Tester / date and time | |
| Result | Pending until observed; then Pass / Fail / Blocked |
| Step / expected / actual | |
| Screenshot or evidence link | |
| Cleanup completed / remaining | |

Feedback remains evidence until the separately specified PM feedback importer exists. Drafting this document does not create defects, change a stored result, mark a delivery Shipped, or reopen completed engineering work.

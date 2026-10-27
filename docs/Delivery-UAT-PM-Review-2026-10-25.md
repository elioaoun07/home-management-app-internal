# PM and Delivery — owner test wizards

Drafted 2026-10-25 from HEAD `735d3881` plus the current working tree. These are instructions, not test results. **Actual for every new scenario: Pending.** Earlier observations in [Delivery UAT](Delivery-UAT.md) remain historical evidence; this document does not reset them.

These scenarios cover completed PM/Delivery capabilities still awaiting owner acceptance. [Current attempts](Delivery-UAT-Current-Attempts-2026-10-25.md) identifies the individual V2 candidates and recent direct deliveries. [Legacy attempts](Delivery-UAT-Legacy-Attempts-2026-10-25.md) accounts for every retained V1 session. No open engineering item is declared complete here.

## Before starting

1. On your laptop, open the **existing Command Center bookmark**. If it is unavailable, stop and record **Blocked — Command Center unavailable**. Starting or restarting `pnpm pm` can import reports and refresh projections; it is not required just to read this handover.
2. On your phone, open ERA, then enter `/pm/live` after the site's address. Sign in with your usual owner account. Check that the laptop/installation name matches the laptop you are testing. If it shows an unavailable or stale connection, record that before continuing.
3. Record the served source revision/build, laptop browser and phone/browser. A 390-pixel laptop window can check layout, but cannot establish a physical-phone pass. These documents were written from source; the running server and hosted phone build were not inspected in this session.
4. Use the named saved runs below. Do not start a new Delivery just to populate a screen. Where a case requires an active run, failure or copied test environment that does not exist, its prerequisite is **Blocked**, not a failed feature.
5. After a scenario, record its ID, result, the step where the result differed, what you saw, device/build and optional screenshot. Until the new sign-off feature is built, send that feedback to the maintainer or record it alongside the existing UAT entry; the current Outcome tab has no per-delivery UAT wizard.

Read-only scenarios need no cleanup. For command-based tooling checks below, open a terminal in `C:\Users\aoune\WebApp\budget-app`, copy the command exactly, wait for its final summary and retain that summary. These are existing offline fixture suites, not instructions to start providers or alter policy. Their success is automated evidence; mark the manual observation separately.

## Coverage

| Completed scope / original UAT | Wizard | Coverage limit |
|---|---|---|
| R64, R66; U1, U2, U4, U6, U7 | PM-M1, PM-M2 | Phone, zoom and current served-build acceptance still pending |
| DLV-116; U2, U4, U9, U10 | PM-M2, PM-M5 | New plan/revision/approval needs a suitable authorized attempt |
| DLV-112, DLV-120; U3, U11 | PM-M3 | Historical absent logs stay absent |
| DLV-119; U5 | PM-M4 | Raw historical counters remain historical |
| DLV-97; U8–U10 | PM-M5 | Existing R44 evidence review; no new dispatch |
| DLV-105, DLV-115; U13–U16 | PM-M6 | Real Apply history retained; destructive edge cases use fixtures |
| DLV-104, R63; U17 | PM-M7 | Real lost-command/restart witness remains conditional |
| DLV-106 | PM-M8 | Real parallel-provider witness not performed |
| R65, R51 | PM-M9 | Stale writes use copied fixtures |
| R69 | PM-M10 | Supplied question choices need an existing question or fixture |
| R61; U24–U26 | PM-M11 | Phone planning needs its deployed relay migration/capability |
| DLV-108; U18 | PM-M12 | Offline recovery evidence does not prove real-boundary recovery |
| DLV-109, DLV-135; U12/U23 implemented slices | PM-M12 | Observe a future separately authorized run; do not launch one here |
| DLV-77, DLV-100, DLV-101; U19–U22 and U7a | PM-M13 | Owner prerequisites, parked witnesses or unfinished scope |

Acceptance sources: [PM Tooling Master Book](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#acceptance-criteria-index>) and [Delivery Master Book](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#acceptance-criteria-index>). Each ID above is the exact criterion section in its owning book; the scenario headings below retain those IDs for lookup.

## PM-M1 — Find a delivery and read it on both screens

**Acceptance:** R64/R66; original U1/U6/U7. **Type:** interface regression. **Data:** saved R44 run `r-46688acd1b86`. **Coverage:** draft until the served build is recorded.

1. In Command Center, click **Delivery** in the main navigation. Expect the Delivery home screen.
2. Open **Earlier deliveries** if R44 is not already visible, then select the R44 attempt. If several have the same title, use this exact address suffix: `#/delivery/run/r-46688acd1b86`. Expect the existing attempt, not a new launch screen.
3. Click **Activity**, scroll to **Run**, and compare **Run ID** with `r-46688acd1b86`. Expect an exact match before continuing.
4. Click **Outcome**, **Plan**, **Verification**, **Activity**, then **Changes**. Expect readable content in each tab. The current interface includes **Outcome** before the older four-tab sequence; its presence is correct.
5. Leave **Verification** selected, refresh the page, then use browser Back and Forward. Expect the selected tab and same attempt to follow the URL. Return to Delivery and reopen the attempt; verify its identity again.
6. Repeat steps 1–5 on the phone. Scroll to the last row of each tab and tap its controls. Expect no sideways page scrolling, clipped text or content hidden behind the bottom navigation.
7. On the laptop, set browser zoom to 200%, then move through the tabs using Tab and Enter. Expect visible keyboard focus and readable reflow. Restore the original zoom.

**Reset:** restore zoom; close any opened reader. **Actual:** Pending. A new physical-phone result does not replace an earlier desktop result.

## PM-M2 — Read the complete plan and its frozen changes

**Acceptance:** DLV-116, R64/R66; U2/U4. **Type:** feature and regression. **Data:** R44 run above; historical DLV-107 run `r-c1d69bb666cf` for the original navigation fix.

1. Open R44 using PM-M1 and click **Plan**. Expect its recorded plan revision and Scope/Steps. Scroll through any populated Acceptance, Invariants, Exclusions and Questions sections. **Risks** and **Unknowns** remain visible and say **None** when empty; the other empty sections may be omitted.
2. Under **Artifacts**, click **plan.md**. Expect a reader containing the same selected revision and steps. Close the reader; keyboard focus should return to the control that opened it.
3. Click the download icon labelled **Download plan.md**. Open the downloaded `plan-r<revision>.md` in a text editor. Compare the beginning and last step with the screen; neither end should be clipped. **Expect:** The downloaded plan matches the selected on-screen revision, including its first and last steps.
4. If **Plan revision** is offered, select an earlier revision, then **Latest plan**. Expect both to remain readable. If only one revision exists, record this subcase as Blocked — no earlier revision; do not invent one.
5. Click **Changes**, then `eslint.config.mjs`. Expect a frozen diff or a specific unavailable reason. Close it, then open the other recorded changed file. A missing snapshot must not display the current working file as if it were the frozen candidate.
6. Open `#/delivery/run/r-c1d69bb666cf`, click **Changes**, then `Work.tsx`. The historical fix should show `view=story` replaced by `tab=story` if the retained snapshots verify. A labelled missing/hash-mismatch result is a storage limitation, not proof the fix failed. **Expect:** The retained diff shows view=story replaced by tab=story, or gives a specific missing/hash-mismatch limitation.
7. Repeat reader open/close on the phone. Expect one-column content and usable close control without losing the selected attempt.

**Reset:** delete only the plan download you created if no longer wanted. **Limits:** large/historical paging is still DLV-121. Approval is tested separately in PM-M5. **Actual:** Pending.

## PM-M3 — Understand a passing, failed or inconclusive check

**Acceptance:** DLV-112/DLV-120; U3/U11. **Type:** defect regression. **Former symptom:** exit-zero checks with unreadable/missing counts looked inconclusive without a useful explanation.

1. Open R44 `r-46688acd1b86`, then **Verification**. Expect one current result per required check and a visible passed/total count.
2. Read each check's name, result, count and date. Compare it with the run's saved verification receipt; an exit code alone must not substitute for a nonzero test count. **Expect:** Check names, outcomes, nonzero test counts and recorded dates agree with the saved receipt.
3. Open historical DLV-107 `r-c1d69bb666cf`, then **Verification**. Where **Previous runs** appears, read the earlier inconclusive entries. Expect those historical outcomes to remain visible rather than becoming retrospective passes.
4. For a non-passing check with a **Log** disclosure, expand it. Expect retained checker text and the actual failure layer. If no output was retained, today's UI omits **Log** rather than displaying a separate unavailable explanation. Record **Historical log unavailable**; missing historical output is not a newly failed check and cannot prove that it passed. The older U11 request for explicit unavailable wording remains a presentation gap.
5. In a terminal, run `pnpm exec vitest run tests/delivery-v2/evidence.test.ts`. Expect a nonzero test count with no failures. Review the assertions for zero/unknown output and the separate failed/inconclusive outcomes; retain the actual result rather than copying an old count.
6. On a suitable authorized failed-check attempt only, use **Recheck** once and compare Activity before/after. Expect another check result, not another implementation/model job. If none exists, mark this subcase Blocked; do not rerun an accepted historical candidate just to create evidence.

**Edge:** **Check status** recovers an existing command receipt; it is not Recheck. **Reset:** close Log; no runtime mutation is needed for steps 1–5. **Actual:** Pending.

## PM-M4 — Count tokens once

**Acceptance:** DLV-119; U5. **Type:** defect regression. **Former symptom:** cached/reasoning subsets were added twice.

1. Open `#/delivery/run/r-c1d69bb666cf` and locate **Tokens**. Expect the normalized total **284,243**, with the historical **200,000 threshold** and **84,243** excess if those historical allowance facts remain available.
2. Click **Outcome** and read Fresh, Cached, Output and Total. Expect their displayed normalization to agree with the main token total; reasoning is a subset of output, not another billable addend.
3. Open **Activity** and inspect the saved usage messages. An old raw **482,416** observation may remain in history. Expect it to be retained as history, not substituted for the normalized current total.
4. Refresh and reopen the same run. Expect the total not to increase merely because you reloaded it.
5. Repeat on the phone. Expect the same total and unknown values to remain unknown, rather than becoming zero.

**Reset:** none. **Limits:** this historical Codex example does not independently validate every provider's accounting semantics. **Actual:** Pending.

## PM-M5 — Keep plan approval separate from implementation and Apply

**Acceptance:** DLV-97/DLV-116; U8/U9/U10. **Type:** authority and revision regression.

1. Open R44 `r-46688acd1b86`, click **Activity**, and read the recorded sequence. Expect the plan, owner approval, implementation and protected checks to be distinguishable events.
2. Click **Plan** and record its revision; click **Changes** and record the candidate generation. Expect both to refer to this same run after refresh.
3. Read **Application history**. Expect owner Apply to be a separate event; a verified candidate alone did not deploy or accept the feature.
4. For the revision/approval subcase, wait until you have a separately authorized delivery already waiting for plan review. Open **Plan**, read all steps, enter one concrete correction in the **Changes** field under **Approve plan**, then click **Revise**. Expect a new revision while the previous plan stays readable. This prerequisite is currently unobserved; do not launch a delivery for this document.
5. Select the earlier revision. Expect it not to offer approval as the current plan. Click **Latest plan**, review it, and click **Approve** once only when you intend that work to execute.
6. Refresh immediately after approval. Expect the same run and one implementation job; an uncertain response must not invite a new Start. Record the original command identity if receipt recovery is needed.

**Reset:** steps 1–3 are read-only. Steps 4–6 intentionally consume an existing authorized delivery; retain its artifacts. **Actual:** Pending; the active-plan subcase is Blocked until its prerequisite exists.

## PM-M6 — Review Apply and safely test rollback

**Acceptance:** DLV-105/DLV-115; U13–U16. **Type:** application and inverse regression.

1. Open KIT-11 `#/delivery/run/r-fa5c81702ec7`, then **Changes**. Read **Application history**. Expect the failed reassessment, rolled-back application and later Applied application to remain separate records.
2. Open R44 `#/delivery/run/r-46688acd1b86`, then **Changes**. Expect its Applied receipt for `app-497cee609b88`; retained history does not prove the whole current checkout still equals that candidate.
3. If **Roll back** is available, click it once to open **Roll back?**. Read the previewed file operations, then click **Cancel**. Expect the dialog to close, focus to return to the invoking button, and no application state or source bytes to change. Repeat and press Escape to check the same cancellation path.
4. To verify actual rollback without undoing your work, open a terminal and run `pnpm exec vitest run tests/delivery-v2/apply.test.ts`. The suite constructs disposable source trees; expect a nonzero passing count.
5. Review the fixture cases covering added/deleted/untracked files, later owner edits, stale confirmation, duplicate commands and interruption. Expect refusal or partial-state evidence to preserve the later edit; an unrelated file must not be removed.
6. Record the exact fixture summary separately from the dialog observation. A fixture pass does not replace the historical owner's real Apply/rollback evidence or prove another deployment. **Expect:** The fixture summary and dialog observation are separate from historical owner Apply/rollback evidence.

**Reset:** cancel the preview; the fixture suite owns its temporary data. Do not confirm rollback on the working repository for this UAT. **Actual:** Pending.

## PM-M7 — Open the same delivery on a phone and recover connection state

**Acceptance:** DLV-104/R63; U17. **Type:** phone parity and isolation. **Prerequisites:** current hosted `/pm/live`, owner-applied relay setup, paired bridge, physical phone; an owner-controlled second test account only for the isolation case.

1. On the laptop, open R44 `r-46688acd1b86`, then **Activity**. Write down Run ID and status. **Expect:** Activity identifies run r-46688acd1b86 and its recorded status.
2. On the phone, open ERA `/pm/live`, sign in, choose the same laptop if asked, tap **Delivery**, and open that run. Expect identical identity and recorded status without retrieving a laptop pairing code for the hosted relay route.
3. Turn on airplane mode on the phone. Keep the run open. Expect an offline/stale/unavailable state; cached content must not be presented as freshly observed and command controls must not silently execute.
4. Turn airplane mode off and wait for reconnection. Reopen the same run. Expect the original identity and current server state, not a duplicate delivery.
5. If a command was already pending before this test, use **Check status** once after reconnecting. Expect recovery of that command's receipt. With no pending command, record this subcase Blocked — no pending command; do not create an Apply or approval merely to lose its response.
6. For account isolation, sign out and sign in with the designated second test account. Expect none of the first owner's cached delivery content to appear. Sign back in as the original owner and confirm the original installation/run returns. Skip this subcase as Blocked if no second test account exists.

**Reset:** restore connectivity and original account. **Limits:** an actual bridge crash between effect and receipt requires a separately prepared recovery exercise; airplane mode alone does not prove it. **Actual:** Pending.

## PM-M8 — Keep conflicting deliveries apart

**Acceptance:** DLV-106. **Type:** tooling coordination. **Data:** existing isolated fixture pairs; no live simultaneous providers.

1. In a terminal, run `pnpm exec vitest run tests/delivery-v2/parallel.test.ts tests/delivery-v2/coordination.test.ts tests/pm-ui/coordination-model.test.ts`. **Expect:** All three fixture suites finish with a nonzero passing count and no live delivery is started.
2. Wait for the final summary. Expect every selected file to pass with a nonzero test count; save any failure text unchanged.
3. Open `tests/delivery-v2/parallel.test.ts` in your editor. Find the case with two disjoint writers and a third waiting. Read its expected states alongside the result. Expect at most two admitted writers and a reason for the third waiting.
4. Read the overlap, unknown-job and prerequisite cases. Expect unknown/stopped-but-unconfirmed work to keep its slot, overlapping scope to wait, and unmet prerequisites to refuse execution.
5. In Command Center, click **Delivery**. If a real waiting attempt exists, open it and compare its stated reason with its prerequisites/scope. Expect a reason rather than a misleading Ready status. If none exists, record the visual subcase Blocked — no waiting attempt.

**Reset:** none; the tests manage their fixtures. **Limits:** actual provider isolation and overlapping real Apply remain unobserved. **Actual:** Pending.

## PM-M9 — Find completed work without delivering it again

**Acceptance:** R65/R51. **Type:** lifecycle and stale-write regression.

1. In Command Center, click **Work**, then **Done**. In **Find completed work**, type `R64`. **Expect:** The completed-work view retains search R64 and displays its matching completion record.
2. Open R64. Expect a completion record, **UAT pending** where declared, and readable scope/evidence. An owner-only acceptance task must not become an actionable Deliver item.
3. Expand **Scope and evidence** and follow any retained Delivery history link. Expect the saved attempt, not a fresh launch. Use Back; expect your completed-work search to survive.
4. Change from **Done** to **To do** without clearing the search. Expect the search text to remain and results to follow the selected lifecycle.
5. For stale writes and Undo, run `pnpm exec vitest run tests/pm-ui/ordinal-parity.test.ts tests/pm-ui/archive.test.ts tests/pm-ui/task-move.test.ts tests/pm-ui/shared-parsing.test.ts` in the terminal. **Expect:** The four fixture suites pass with nonzero counts for stale writes, guarded Undo, archive and identity parsing.
6. Read the passing/failing summary and the stale-row/Undo fixture cases. Expect reordered rows to keep identity, changed rows to refuse stale actions, and Undo to preserve later edits. These fixtures deliberately mutate copied documents, not your backlog.

**Reset:** clear the search if desired. **Actual:** Pending. **Earlier deliveries** rows now carry a UAT word (Shipped, Testing, Needs changes, UAT unrecorded, No candidate); Work, Sprints and Analytics do not yet (R79), so do not expect a **Shipped** label there.

## PM-M10 — Navigate Home, search and Analytics

**Acceptance:** R69. **Type:** interface regression.

1. Click **Home**. Under **Your work**, click **Now**. Expect a Work view filtered to the same queue, with source IDs visible on rows.
2. Enter a real item ID in **Find work**, switch between **Board** and **List**, then between **To do** and **Done**. Expect the typed search and applicable campaign filters to survive; an empty result is valid when that item does not belong to the selected lifecycle.
3. Click **Analytics**. Read **In focus**, then expand **Daily records** beneath **The last 14 days**. **Expect:** Analytics shows In focus and Daily records opens beneath The last 14 days.
4. Select a date with records. Expect the actual dated receipts, with the displayed count matching the receipt list. Multiple receipts for one ID are records, not proof of multiple unique features.
5. Open the same installation using `#/dashboard`. Expect the Analytics view through its retained alias.
6. For supplied Delivery question choices, open an existing waiting question that actually contains options. Select an option and edit the answer before sending. Expect selection to fill editable text without sending it automatically. If no such question exists, mark this subcase Blocked and use the existing question fixture review for engineering evidence; do not invent options for a free-text question.
7. Repeat steps 1–4 on the phone. Expect readable controls and no clipped search, cards or bottom content.

**Reset:** clear search and close the selected date. Do not send a question answer unless it is your intended answer to that live delivery. **Actual:** Pending.

## PM-M11 — Edit a sprint and keep its identity across devices

**Acceptance:** R61; U24–U26. **Type:** planning. **Prerequisites:** disposable copied PM environment with one draft week and two distinct unfinished test items; current phone planning relay capability for the phone subcase. Do not rename/start/close the owner's real week just to test.

1. Open the copied Command Center URL supplied with the fixture. Click **Sprints**, select the draft week and note its dates and two item IDs. Expect a draft, not an already active week.
2. Click **Edit week**, change its name to `UAT week`, and click **Save week**. Refresh. Expect the name, dates and membership to remain in the same week.
3. Open the same fixture on the phone and select that week. Expect the same saved values and selected week after refresh. If the phone is connected to the real installation instead of the copy, stop this subcase.
4. Click **Start sprint** on the draft week. Expect its commitment to become active without starting a Delivery provider job. Open one eligible item and its **Deliver** view, then go Back without pressing Start there; **Start sprint** and Delivery **Start** are different actions.
5. Have the fixture maintainer supply its copied completion receipt for one test item. Refresh Sprints and Analytics. Expect that item to count once; cancellation must not count as delivery.
6. Click **Close week**, select the destination under **Carry to** and only the still-unfinished item, then click **Close week** in the sheet. Expect the closed result to remain fixed and only that selected item to appear in the next draft.
7. In a fresh copy, disconnect the phone around one draft save, reconnect, and inspect its pending command with **Check status** where offered. Expect one saved change or an explicit stale/conflict result, never duplicate membership or a second week.

**Reset:** fixture maintainer restores the copied planning data after recording results. **Offline alternative:** `pnpm exec vitest run tests/pm-ui/planning.test.ts` checks the existing lifecycle fixtures; it is not a physical-phone pass. **Actual:** Pending; interactive steps are Blocked until the copied desktop/phone environment is supplied.

## PM-M12 — Recover an interrupted job and observe live activity

**Acceptance:** DLV-108; completed DLV-109/DLV-135 slices; U18/U23 and activity portion of U12.

1. Open a terminal and run `pnpm exec vitest run tests/delivery-v2/journey.test.ts -t DLV-108`. Expect selected nonzero recovery cases to pass. Other tests filtered out by the name are not evidence for this scenario.
2. Read the selected restart/recovery assertions. Expect retained output, one durable transition and no replacement model dispatch when recovery repeats.
3. During your next separately authorized real Delivery, open its **Activity** tab while it is building. Expect observations to appear before the job ends; a missing update stays unconfirmed rather than being guessed.
4. Keep the page open as it enters verification. Expect connection health and controls to remain responsive during checks. Record observed timestamps and any Offline transition; do not press Stop simply to prove the button exists.
5. Open the same run on the phone. Expect the same observed state and original run identity. Compare after completion; retained history should agree with what you observed live.

**Reset:** none. **Limits:** no run is started by this handover. A real restart/crash experiment needs its own bounded setup. Token-stop acceptance is not established by seeing activity. **Actual:** Pending.

## PM-M13 — Keep owner prerequisites and deferred witnesses explicit

These are accounted-for dispositions, not completed product sign-offs.

| Record | Step-by-step owner route | Expected / limit |
|---|---|---|
| DLV-77 | Open the [PM Relay Setup](<../ERA Notes/06 - Setup & Onboarding/PM Relay Setup.md>); locate its current required command schema; have the owner provide the current constraint evidence; compare it with the documented command types before any phone command test. | Missing historical migration text alone does not prove production failure. Pending owner evidence; no agent DB call. |
| DLV-100 | Open [Delivery V2](<../ERA Notes/10 - Project Management/Plans/Delivery V2.md>); locate S2.1/failure matrix; choose the separately approved boundary case and limits; record the real interruption/denial and recovered identity. | Parked enhancement. Blocked until an owner-approved real-boundary exercise exists; offline fixtures do not close it. |
| DLV-101 | In the same plan, locate S2.2; complete its DLV-100 prerequisite; open the selected Deep dive run, record its pinned context, interrupt/resume only under that exercise, compare the resulting receipts. | Parked enhancement. No current run is authorized by these instructions. |
| DLV-114 / U20/U21 | Read the retained token-limit acceptance and choose a separately authorized bounded real witness before configuring or starting anything. Existing `tests/delivery-v2/budget-stop.test.ts` provides only the offline refusal/threshold cases. | Hard-cap refusal and real abort/billing observation are different. Remaining engineering/owner witness is not claimed done. |
| DLV-133 / U19 | Open the current recovery record in [Delivery UAT](Delivery-UAT.md#recovery-acceptance--dlv-133--dlv-137--dlv-138-2026-10-17); read the newest qualified-environment receipt and its identity before planning another test. | The old U19 setup command is historical and must not be replayed over retained dependencies. No new preparation or installation. |
| DLV-111 / U22 | Open current hosted `/pm/live`; select the existing installation; inspect an already unavailable executor, if one exists; record the exact reconnect message and disabled launch state. | Do not sign out an active worker to manufacture the condition. Reconnect/idle-refresh scope is still open; use current setup, not the old U22 migration list. |
| R66 / U7a | On an eligible current item, open Deliver → Settings; select an already unavailable executor if present; read the actual blocker, then leave without Start or Retry. | Old cancelled DLV-90 is not an eligible launch target. A missing unavailable executor is a Blocked subcase, not a failure. |

DLV-92/93/72/78 and R42 owner checks were explicitly cancelled when V1 was frozen. DLV-98/99/102 were replaced by the KIT-11 A/B trial. Their retained history stays in the Master Books and the [current-attempt inventory](Delivery-UAT-Current-Attempts-2026-10-25.md); this backfill does not revive them.

## PM-M14 — Restore Delivery identity, navigation and browser access

**Acceptance:** [R80](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r80>). **Type:** regression. **Actual:** Pending. **Data:** existing saved attempts only; no new delivery is needed. Use the updated local PM build; hosted phone access needs the corresponding deployment.

1. Open the existing PM bookmark and select **Delivery**. If **Pair this browser** appears, open a terminal in the project directory, run `pnpm pm:pair`, copy its newly printed code into **Code**, then select **Pair**. Expect V2 history to return without starting any delivery. A code is single-use; request a new one if the form reports it expired or used.
2. Expand **Earlier deliveries**. Expect each retained row to show its recorded item number (for example HUB-1, BUD-14, KIT-11 or R44), campaign and recorded date/time. Older V1 responses provide only an update timestamp, labelled **Updated**; it is not presented as the creation time. Missing historical identity must be explicit rather than invented. Repeated attempts remain separate, newest first.
3. Select an outcome filter, open a row, then use its Back control. Expect the same expanded history and selected filter. If more than 50 matching attempts exist, select **Load more** and verify older rows become reachable. Fewer records means the pagination subcase is not applicable.
4. Select the header menu icon labelled **More navigation**. Expect **Activity**, **Decisions**, **Idea inbox** and **Documents**. Open each, then return to Delivery. Expect the chosen destination to open, the sheet to close and the five main tabs to remain available. Local **Reference tools** is absent where the transport cannot serve it.
5. On a phone-width browser, repeat steps 2–4. Expect visible IDs, reachable menu/close controls, no horizontal page scrolling and readable content above the bottom navigation. Record a physical-phone pass separately.
6. For lost-session and queue-failure cases, use the retained isolated browser fixture evidence supplied with R80. Expect Pair for revoked access, unavailable/last-known status on failed reads, and no **Nothing running** claim from unavailable data. A real outage/revocation is not required to accept the ordinary navigation steps.
7. Inspect an old V1 accepted attempt and a V2 Applied attempt. Expect **Accepted** and **Applied** to remain distinct; neither is a new owner UAT sign-off.

**Reset:** close the menu and restore the preferred filter. Pairing changes only this local browser's access. **Limits:** no delivery/Apply/Check readiness is part of this scenario; the offline fixture does not certify the original browser's cookie or hosted phone deployment.

## PM-M15 — Find test steps and return to the review list

**Acceptance:** [R81](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r81>). **Type:** navigation regression. **Actual:** Pending. **Setup:** updated local PM Command Center with the existing imported handovers; no launch or Apply is needed.

1. Refresh PM Command Center and select **Delivery**. **Expect:** **Review & sign off** appears at the top, before **Delivery actions** or **In focus**; opening a collapsed history list is unnecessary.
2. In **Work ID or title**, enter `R80`. **Expect:** matching handovers show their work number, campaign, title, date and readiness. Search spans all statuses, including drafts.
3. Select **View steps** on the R80 row. **Expect:** its test wizard opens with the work number and **Draft** state, setup and numbered instructions. Draft results and sign-off remain disabled; do not select **Mark ready** without confirming the matching delivered build.
4. Use the wizard's **Back** control, then refresh the page. **Expect:** the search `R80`, selected **All** filter and matching list remain.
5. Clear the search and select **Not ready**, then **All**. Select **Load more** until it disappears. **Expect:** older imported scenarios remain reachable, including those beyond 50; every row has its recorded identity and state.
6. Select **To test**. **Expect:** only current ready handovers appear, with **Start test** or **Continue**. If none is ready, the empty state identifies preparation as pending rather than asking for sign-off. Do not promote drafts merely to fill this list.
7. When a verified ready handover is supplied, select **Start test**, review **Setup**, and use **Next** and **All steps**. **Expect:** the same scenario actions and expected results appear; the final **Sign off** action remains subject to required passes and build confirmation. Record this subcase Blocked until such a handover exists.
8. Repeat steps 1–5 at a phone-width viewport and in the alternate theme. **Expect:** the review controls, work IDs, instructions and Back control stay readable and operable without horizontal page scrolling. Record a real phone result separately.

**Reset:** clear the search and return to the preferred review filter. **Limits:** the isolated browser fixture proves navigation and draft/ready presentation, not owner test results, hosted availability or phone-relay capability (R79).

## Evidence and untested limits

Source controls were read from `scripts/pm/app/{DeliveryV2,DeliveryReview,OutcomeReview,Explore,Work,Home,AnalyticsOverview,Sprints}.tsx`, with the PM Feature Map and owning Master Book criteria. No UI, provider, policy, Apply, relay, production-data or owner acceptance action was executed while drafting these steps. Direct-source scenarios need a served revision recorded before they can be called ready. Fixtures do not establish device behavior, production RLS, provider billing or exact current deployment.

For feedback use: `Scenario | item/run | step | expected | actual | PASS/FAIL/BLOCKED | build | device | date | evidence`. Preserve observations that disagree with these drafts; they may indicate stale wording or a defect. Do not silently change the acceptance expectation to match an incorrect implementation.

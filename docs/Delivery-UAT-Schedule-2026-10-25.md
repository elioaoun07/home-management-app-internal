---
created: 2026-10-25
type: uat
status: draft
owner: Elio
---

# Schedule deliveries — owner test wizard

[UAT home](Delivery-UAT.md) · [Schedule Master Book](<../ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md>)

These are novice walkthroughs for the **nine Schedule items explicitly recorded as implementation done / UAT pending** on 25 October 2026. Each new result starts **Pending**. Existing engineering results remain in the Master Book. SCH-28 is still implementation work and is not included as a delivered feature.

**Build binding:** these are direct-source deliveries, not retained V2 candidates. The drafts use HEAD `735d3881` plus the existing working tree, with source changes checked since the October delivery receipts. Before testing, the implementer supplies the served build/commit and changed-file manifest, app address and environment. Record those alongside tester, local date/time, browser and device. A source file existing on the laptop does not prove the phone is running it.

## Choose the test

| Item | What you will do | Scenario | Availability / new result |
|---|---|---|---|
| [SCH-20](<../ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md#sch-20>) | Open Chores, assign, move and unassign one routine | [S20](#s20--open-chores-and-place-one-routine) | Prepared data/build needed; Pending |
| [SCH-22](<../ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md#sch-22>) | Install Chores alongside Expense | [S22](#s22--install-chores-beside-expense) | Physical Android phone and current manifests needed; Pending |
| [SCH-23](<../ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md#sch-23>) | Install a second app through the in-app button | [S23](#s23--install-a-second-app-from-its-page) | Physical Android phone; Pending |
| [SCH-24](<../ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md#sch-24>) | Save a complete reminder; inspect a dormant trigger item | [S24](#s24--a-saved-reminder-keeps-all-its-details) | Owner migration/RLS evidence required; Pending |
| [SCH-25](<../ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md#sch-25>) | Save 30 chore placements, Undo, then check offline recovery | [S25](#s25--save-many-chores-and-undo-the-batch) | SCH-24 then SCH-25 migrations required; Pending |
| [SCH-26](<../ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md#sch-26>) | Complete one chore across three rooms | [S26](#s26--complete-all-rooms-of-one-chore) | Prepared grouped placements; Pending |
| [SCH-27](<../ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md#sch-27>) | Search, stage and discard assignments | [S27](#s27--find-and-stage-chores-on-a-phone) | Prepared Catalogue definitions; Pending |
| [SCH-29](<../ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md#sch-29>) | Assign beyond a target and create an Any-time chore | [S29](#s29--assign-an-extra-chore-and-use-any-time) | Prepared target history / writable test environment; Pending |
| [SCH-30](<../ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md#sch-30>) | Done, Reopen and routine placement respond immediately | [S30](#s30--done-reopen-and-routine-placement-update-immediately) | Prepared data; controlled slow/refusal fixtures for edge cases; Pending |

## Prepare once

The delivering implementer prepares this data and records its exact IDs before handing over the test. Missing data is **Blocked**, not a task for the tester to invent. Use an isolated test household where possible. These instructions are for the owner to execute; no production write, migration, install or live API call was performed when drafting them.

- Two signed-in household test users, with their existing names and different person colors; both phones if partner checks will run.
- A chosen test week with future Monday–Sunday dates. Write its actual dates here before starting. All-day dates use the device's Beirut local calendar. Do not move the phone clock to create a past/future case.
- Three test rooms: **UAT Kitchen**, **UAT Bedroom**, **UAT Hall**.
- A Catalogue chore **UAT Sweep**, tagged to all three rooms, weekly target 3, with no placements in the chosen week. A second **UAT Dust**, also in the three rooms, supports search/staging checks.
- A real flexible routine item **UAT Iron**, owned by the tester, with at least two available slots in the chosen period. This is different from a Catalogue template; Move/Unassign tests depend on that distinction.
- For S25, ten Catalogue chore definitions **UAT Batch 01** through **UAT Batch 10**, each tagged to the three test rooms, eligible on the test date. This produces exactly 30 placements without including ordinary household chores.
- For S29, **UAT Laundry** in one test room with a weekly target of 2 and two recorded completed placements on Monday and Friday of that test week; Saturday has no placement. Record both IDs. A separate empty **UAT Tidy** template can be used for Any time.
- For S24 triggers, one owned test NFC tag **UAT Tag** with two known states, and the current state different from the required state. Record the tag/state values. No physical NFC action is needed to verify dormant creation.

**Database readiness:** owner evidence must establish [SCH-24 atomic creation](../migrations/2026-10-11_atomic-item-create.sql), then [SCH-25 bulk creation](../migrations/2026-10-17_items-bulk-create.sql), in the tested environment. Room features also need their already delivered room migrations. The [RLS runbook](<../ERA Notes/01 - Architecture/Database RLS Posture.md>) governs the evidence. This document does not claim any migration is applied. Without it, mark dependent cases Blocked; a missing-migration refusal is not a successful save.

**Result format:** `Scenario / step | Pass, Fail or Blocked | actual observation | tester | date/time | served build | device | screenshot or receipt`. Capture failures before cleanup. Until PM sign-off is implemented, record these entries here or in the existing linked UAT record; writing this document does not activate feedback importing.

## S20 — Open Chores and place one routine

**Covers:** SCH-20 navigation, responsive agenda, assignment, same-slot movement, Unassign, Undo and visibility. **Actual:** Pending.

1. Open the app in your phone browser. In the address bar, open `/chores` on the same app address. Expect the Chores agenda, its week/date strip and person controls, with no Reminders filter bar or Budget form.
2. Tap **Today**, then **Week**. Expect the view to change between a selected-day agenda and the selected week. Tap the next-week arrow until the prepared test week appears; tap its Monday. Expect that date to be selected, without moving any chore.
3. Tap the **Library** book icon near the week heading. Expect Catalogue to open in **Chores**. Find **UAT Sweep** in its test rooms, then use the browser Back button to return to Chores.
4. Open `/reminders?tab=chores` in the address bar. Expect to arrive at Chores. Return to the prepared week/date if navigation resets it.
5. Tap **Assign** (or the selected day's **+**). In **Search**, enter **UAT Iron**. Expand its row using the downward chevron; tap the prepared Monday. Expect that day to be staged. Leave its time blank / **All day** and choose **Me**.
6. Tap **Save 1**. Expect exactly one UAT Iron occurrence on Monday with **All day** and your person attribution. Reload and return to Monday; expect one occurrence, not two.
7. Tap the **UAT Iron** title to open details. Under **Move to**, tap Tuesday in the same period. Expect Monday to lose that occurrence and Tuesday to gain it. Tap the toast's **Undo** promptly; expect it back on Monday.
8. Open the Monday occurrence again and tap **Unassign**. Expect it off the agenda and available to assign again. Tap **Undo** promptly; expect the original placement restored.
9. In Chores, switch **Today / Week** and revisit the same date. Expect one UAT Iron placement with the same day/time, without a duplicate from Move or Undo. The older SCH-20 handover also asks for Calendar/Focus parity; current Focus deliberately filters chores out, so do not fail this test merely because UAT Iron is absent there. Calendar parity needs a separately confirmed calendar entry point and remains untested here.
10. On the partner's phone, open `/chores` and the same week/day, then **Both**. Expect the same placement and the same person's color. **Me** on that phone means the partner, not the first tester. Record the second phone separately.

**Regression:** repeat the navigation/read steps in a desktop web view and one other theme. Tap **Hide days** / **Show days**, reload and verify the saved preference. A 390 px browser view is layout evidence only; retain a separate real-phone result.

**Reset:** open only the test UAT Iron occurrence → **Unassign**, and allow the request to finish. Confirm it is absent after reload. Restore the original theme/person filter if changed. Flexible routine assignment does not have an offline queue; do not treat its offline refusal as a failed S25 batch feature.

## S22 — Install Chores beside Expense

**Covers:** SCH-22 disjoint install scopes and the Chores launch identity. **Former symptom:** installing Expense first caused a later Chores install to be treated as already installed. **Actual:** Pending; requires a physical Android phone for final install acceptance.

1. Use Chrome on the test phone, outside an installed app window. Open the served build's `/expense`. Confirm the existing Expense/Budget icon belongs to the current narrow-scope build. If the phone still has a pre-SCH-22 root-scoped Budget installation, record Blocked until the owner chooses its one-time replacement; do not uninstall every app as a workaround. **Expect:** Expense opens in regular Chrome and the existing install uses the narrow-scope build, or the legacy root-scoped prerequisite is recorded as Blocked.
2. Leave Expense installed. In the same Chrome browser, open `/chores` on the same origin. Expect the app's **Install** pill once the browser offers installation.
3. Tap the **in-app Install** pill. Expect the native install dialog to identify **Chores**, not Expense. Confirm installation as the owner.
4. Return to the phone's home screen and tap the new **Chores** icon. Expect Chores to open in its own standalone window, without landing in the Expense form.
5. Return to the home screen and tap **Expense**. Expect Expense still to open normally. The two icons must coexist.
6. Close and reopen Chores once. Expect the same Chores start page. Record the browser version, both installed identities and a screenshot of the icons.

**Regression/limits:** use the page's Install control, not Chrome's three-dot menu. An emulator without signed-in Play services may prove only prompt/shortcut behavior. A hidden Install pill can mean already installed, session dismissal, stale manifests or missing installability; record which evidence is available rather than declaring Pass.

**Reset:** no data cleanup. Keep the test installation if desired, or let the owner remove only the newly created Chores test install. Existing unrelated apps stay untouched.

## S23 — Install a second app from its page

**Covers:** SCH-23 in-app install prompt, suppression and session dismissal. **Actual:** Pending.

1. With Expense installed on the Android test phone, open regular Chrome and navigate to the same origin's `/chat`. Expect **Install** on the page if Hub Chat is not already installed and installation is available.
2. Tap **Install**. Expect the native dialog to name **Hub Chat**. Confirm it, then launch its home-screen icon; expect Chat, with the in-app Install pill hidden in standalone mode.
3. Return to Chrome, reload `/chat`, and wait for the browser's installation result. Expect no prompt inviting a duplicate installed Hub Chat app. Record any remaining pill rather than installing a duplicate.
4. Open `/activity-log`. Expect this shared floating Install pill to be absent; that page owns its separate install UI.
5. For dismissal, use a supported app page that is not installed on the test profile. Tap the pill's **Dismiss** cross. Navigate away and back in the same browser session; expect the shared pill to stay dismissed. In a new browser session with a fresh install event, expect it to become eligible again. Record Blocked if no uninstalled test app is available.
6. On a second clean test profile/phone, start with Hub Chat installed and Expense absent. Open `/expense` → in-app **Install** → confirm → launch Expense. Expect the reverse install order to work too. This is a separate result; the first ordering does not prove it.

**Reset:** owner may remove only newly added test installs. Do not clear the primary phone's whole browser storage to test dismissal. iOS uses a different install mechanism and is not certified by this Android case.

## S24 — A saved reminder keeps all its details

**Covers:** SCH-24 complete source creation, dormant trigger consistency and truthful failures. **Former symptom:** a parent could be reported saved while required child effects were missing. **Actual:** Pending; blocked until the environment's migration and access evidence is supplied.

1. On the test phone, open `/expense`. Double-tap the center **Add** button to open its two-option menu, then tap **Reminder**. A single tap repeats the previous selection. Expect the **Remember to...** input and reminder form.
2. Type **UAT SCH24 complete**. Tap **Tomorrow**, then **Morning**. Expect the chosen date and **09:00** shown. Record the actual calendar date before saving.
3. Tap the three-dot **More options** control. Under **Alert**, tap **15m**. Leave **Repeat** unset. Close the options panel. Expect the form still to show the same title/date/time and a 15-minute-before alert.
4. Tap **Create Reminder** once. Expect a complete success or a concrete failure/unknown-save message. If it says to check Schedule, stop creating and perform the inspection in step 5; do not tap Create again to guess whether it saved.
5. Open `/reminders`, select **Focus** and the recorded date, then tap **UAT SCH24 complete**. Expect exactly one reminder with the correct 09:00 due time and 15-minute-before alert (08:45 that day). Open **Edit** to inspect the saved alert/date values, then cancel without changing them. Reload and reopen; expect the same values.
6. Create a second fresh reminder named **UAT SCH24 dormant** through the same Add → Reminder form. Open **More options** → **Triggers**. In **NFC Tag**, select **UAT Tag**; in **When state is**, select the prepared state that is not currently active. Expect the create button to say **Create (Dormant) Reminder**.
7. Tap it once. Open `/expense` → **Activity** → **Journal**. Set the date filter to include the new item's date (today for this undated test item), then tap **UAT SCH24 dormant**. Expect the detail badge **dormant**. Compare its saved trigger tag/state with the implementer's retained source receipt; the detail modal alone does not expose all prerequisite fields. Reload and reopen the same item; expect its identity/status preserved. A normal active agenda omitting a dormant item is not proof of a failed write. Mark trigger verification Blocked if its receipt is missing.
8. Repeat the complete reminder case in the prepared authorized partner context. Expect the intended shared visibility and saved child values. Unrelated-user denial remains a separate access-fixture check; an empty list alone does not prove authorization is correct.

**Failure/edge acceptance, implementer-assisted:** the owner cannot safely manufacture a required child-write failure or lost commit acknowledgement by random tapping. Run the existing isolated tests from the repository terminal: `pnpm exec vitest run src/lib/items/create.database.test.ts`. Inspect the resulting named cases for child rollback, dormant/activation failure and complete controls; a nonzero green count is supporting automated evidence only. The delivering implementer must also supply the existing route/offline fixture receipt for lost responses, missing RPC and held unknown replay. Keep those criteria unaccepted if evidence is absent. Do not remove a production RPC to test the failure path.

**Reset:** use the source's Undo immediately if offered; otherwise open each specifically named test item in its supplied source view and delete only that item after capturing evidence. Record both IDs. The dormant item needs a known cleanup path before the test starts. Actual push delivery and Google Calendar delivery are separate acceptance and are not proved by saved local fields.

## S25 — Save many chores and Undo the batch

**Covers:** SCH-25 optimistic bulk assignment, same-identity retry, partial refusal and offline queue. **Former symptom:** many separate saves timed out, showed misleading offline/failure state and risked duplicate retries. **Actual:** Pending.

1. Open `/chores`, select the prepared test week and its Monday, then tap **Assign**. Type **UAT Batch** in **Search**. Expect only the ten prepared chore definitions / 30 eligible room placements.
2. Under **Assign all 30 shown**, tap **Me** once while the form is opened for the prepared Monday. Expect **Save 30**, all on that selected day. If the count differs, stop and fix the prepared-data inventory; do not include ordinary household chores to reach 30. Do not tap Me again: on the same selection that can take the staging back.
3. Tap **Save 30** once. Expect the sheet to close and all 30 placements to appear before a slow server answers. With **Group** on, expect ten groups with three rooms each; expand groups or switch Group off to count the 30 rows.
4. Wait for the save result, then reload and return to Monday. Expect exactly the same 30 placements. No duplicates or false “not saved” rows should appear after a confirmed successful save.
5. To test Undo while its toast is available, repeat with a fresh batch/date and tap **Undo** immediately after the **30 assigned** toast. Expect all rows in that batch removed. Reload after synchronization; expect none of that batch to return. Record this run separately from step 4.
6. For offline behavior, open and load Chores/Assign while online with a fresh unassigned test batch. Enable airplane mode and turn Wi-Fi off as needed; return to the already loaded page. Stage the 30 placements and tap Save once. Expect them visible on the same device as pending local work, without inventing server confirmation.
7. Keep that app session open, restore connectivity and wait for synchronization. Reload only after the queue settles. Expect each prepared placement exactly once. Check the partner's **Both** view afterward; pending local rows were not required to appear there before sync.
8. Repeat the offline save with fresh data, but tap the batch **Undo** before reconnecting. Restore connectivity. Expect that batch not to be created by later replay.

**Controlled refusal/slow response:** use an isolated fixture supplied by the implementer. Refuse one of 30 entries; expect 29 remain and the refused entry returns to Assign with **1 not saved**. For a missing migration, expect a final **not saved** result and restaged entries, not an offline queue retry. For a slow response, inspect retained request evidence for identical IDs on retry. Do not deliberately remove migrations or interrupt production writes.

**Technical count:** current code chunks creation at 25 items, so 30 placements normally mean **at most two initial bulk POSTs**, not 30 creates and not necessarily one POST. Retries are additional same-ID attempts. Queue entries are per chunk. The UI count alone cannot prove request count or idempotency; attach the fixture/network receipt. Existing support: `src/lib/items/bulk.database.test.ts`, `src/features/items/bulkItems.test.ts`, `src/app/api/items/bulk/route.test.ts`.

**Reset:** use the batch Undo while offered. If it expires, stop and use the implementer's recorded test-ID cleanup in the isolated environment; do not clear the whole offline queue or delete unrelated chores. Undo racing a replay already in flight and external Google backup remain recorded limits, not certified by the before-reconnect case.

## S26 — Complete all rooms of one chore

**Covers:** SCH-26 grouped completion and one Undo. **Actual:** Pending. **Data:** three open UAT Sweep room placements on the same test date, initially assigned to the tester.

1. Open `/chores`, choose the prepared date, and select **Me**. Ensure **Group** is selected. Expect one **UAT Sweep** row with **3 rooms**. The current label is Group; old delivery notes called it Layers.
2. Tap the **UAT Sweep** title, not its check circle. Expect the three individual room rows to expand. Tap again to collapse; no completion should be recorded from expanding.
3. Tap the group's check circle once. Expect all three open rooms to leave the open agenda together and appear individually under **Completed**. The count should increase by three.
4. Tap **Undo** on the completion toast promptly. Expect all three rooms open again and the group restored. Expand it; each room must be open.
5. Expand the group and complete only **UAT Kitchen** with its individual check. Expect only that room completed and the other two still open. Undo that action.
6. For the partner guard, use a separate prepared group containing a partner-owned room, select **Both**, and tap its group check. Expect an **Override** decision before completion. Dismiss it first: expect no rooms changed. Only the owner may choose Override for the separate confirmation check.
7. In a fresh open group, enable airplane mode after loading the page. Complete the group once, then reconnect. Expect three completed rooms exactly once. The technical receipt should show one grouped operation, not one independent completion per room.

**Reset:** Undo the group completion promptly; if testing persistence first, reopen each specifically named completed test room afterward and confirm all three open. No new DB objects are needed for grouping itself; prepared room/placement data still depends on prior setup. Partial-refusal fixtures must show only refused rooms reopen with **N not saved**; UI happy-path results do not establish that case.

## S27 — Find and stage chores on a phone

**Covers:** SCH-27 search, visible bulk counts, person controls, persistent tabs, fixed-height dialog and safe discard. **Actual:** Pending. This scenario can stop before saving household data.

1. Open `/chores` at normal phone width, select the test date and tap **Assign**. Expect the Search input and **Rooms / Chores** tabs, with a stable-height sheet and internally scrollable content.
2. Tap **Rooms**, then **UAT Kitchen**. Expect chores for that room while the Rooms/Chores tabs remain reachable.
3. Find **UAT Sweep** and tap its **+ Mon** (or the prepared selected weekday) chip. Expect one staged placement and **Save 1**. These are staged edits, not saved agenda rows.
4. Tap **Chores**, then type **UAT Dust** in **Search**. Expect matching chore rows. The earlier hidden Sweep placement must stay staged; Save should still include it.
5. Under **Assign all N shown** for the visible Dust results, tap **Me** once for the form's selected test day. Expect only those matching rows added to the staged count. Clear Search; expect the hidden Sweep selection still present.
6. Expand a staged row with its chevron. Tap the partner's name, then **Me**. Expect the row's staged person indicator to follow each selection; no swipe is required.
7. Tap the sheet's close cross. Expect **N unsaved** with **Discard / Keep / Save**. Tap **Keep**. Expect the same staged rows and counts still available.
8. Close again and tap **Discard**. Expect the staged changes gone and no new placements on the agenda. Reopen Assign; expect the last Rooms/Chores tab remembered, with no discarded drafts silently restored.
9. Repeat the quick sequence **Assign → UAT Kitchen → + selected day → Save 1** with one fresh test placement. Count the four taps after the date has already been selected. Expect one placement. Use its toast Undo promptly.

**Regression:** repeat search/open-row/close at 360–390 px with the keyboard open, and in the other theme. Save/Discard, tabs and text must remain reachable without horizontal page scrolling. This is not a promise that an arbitrary large template will fit without vertical scrolling.

**Reset:** Discard staged changes; Undo the single saved test placement. Restore the previous tab preference if desired.

## S29 — Assign an extra chore and use Any time

**Covers:** SCH-29 defaults, met-target extras, one-tap person staging, duplicate-day guard and recurrence-free chores. **Actual:** Pending.

1. Open `/chores` in a fresh test-browser profile with no prior Group preference. Expect **Me** and **Group** selected. On the partner phone, Me must select that partner. Do not clear the primary phone's entire storage to manufacture this precondition.
2. Select Saturday in the prepared UAT Laundry week. Tap **Assign** and search **UAT Laundry**. Expect the already completed target to be shown as an amber **2/2**, while Saturday remains selectable.
3. Expand the row and tap Saturday, choose **Me**, then **Save 1**. Expect the additional placement on Saturday with amber **3/2**. Reaching 2/2 must not prevent this extra assignment.
4. Open Assign for Saturday again and search UAT Laundry. Expect the already-on-Saturday placement to be unavailable/omitted. The same chore may be offered on another untaken day; the target alone must not disable it. Undo or unassign the extra test placement after recording it.
5. Open Assign on another prepared free day → **Chores**. On **UAT Sweep**, tap the header's **Me** once. Expect all three eligible rooms staged for you. Tap Me again; expect those staged rooms removed. Repeat once with the partner button and verify person attribution before using **Discard**.
6. Check a normal **Assign all N** bulk bar with extras and Any-time definitions present. Expect extras and Any-time chores not automatically swept into its count or selections; choose those intentionally by their own row when needed.
7. Tap **Library** to open Catalogue → Chores. Tap **+ / Add Item**. In **Name**, enter **UAT Tidy Any time**; choose **Any time** beside Weekly / 2 weeks / Monthly. Select **UAT Hall** under Rooms, then tap **Create**. Expect the new chore saved without a target number.
8. Return to `/chores` → Assign and search that exact name. Expect it available without a period counter. Use **Next week** in the assignment sheet and search again; expect it available there too. Do not save a placement merely to check availability.

**Regression/limits:** this target behavior applies to Catalogue chore definitions. A true flexible routine such as UAT Iron still stops at its period target. The desktop To plan sidebar intentionally omits extras. Neither behavior is a failure of this slice.

**Reset:** Discard all unsaved staged choices. Undo or unassign only the extra Laundry placement. Keep the isolated Any-time template until evidence is recorded, then remove only that named template through its existing Catalogue action; the implementer supplies its ID and cleanup action before the test if the current view hides deletion. Do not change a household's real Laundry target to construct this test.

## S30 — Done, Reopen and routine placement update immediately

**Covers:** SCH-30 immediate row state, Undo, busy guard, offline completion and optimistic routine placement. **Actual:** Pending.

1. Open `/chores`, select the prepared date and use **Group** off to expose one owned test chore row. Tap its check circle once. Expect it to move into **Completed** immediately, before the request finishes.
2. Tap **Undo** on the toast. Expect it back in the open agenda immediately. Reload after the operation settles; expect the reverted state retained.
3. Complete it again, expand **Completed**, tap its title and choose **Reopen**. Expect the row open immediately. Tap that action's **Undo**; expect it completed again. Then reopen it for the next case.
4. In a controlled slow-response test environment, tap Done twice quickly while the first request is pending. Expect the second tap ignored, one completion and no duplicate occurrence. Ordinary fast Wi-Fi is insufficient to certify this timing case; attach the supplied delayed-response fixture result.
5. After loading the open row online, enable airplane mode and turn off Wi-Fi. Tap Done once. Expect the row completed locally. Reconnect and wait for sync; expect one completed occurrence. Do not confuse “shown done” with server-confirmed while still offline.
6. With connectivity restored, use Assign to place the prepared flexible **UAT Iron** on a free day. Expect its slot to appear immediately. Open it → **Move to** another free day in the same period: expect the visible move immediately. Open it → **Unassign**: expect immediate removal. Use Undo promptly to reverse each operation when testing its inverse.
7. On desktop, use **To plan** → UAT Sweep → **Assign** → available weekday. Expect its new Catalogue placement to show immediately as well. Record this separately from the mobile Save batch.
8. Under the implementer's controlled refused-write fixture, tap Done. Expect the optimistic change to revert with **Not saved**, rather than leave a permanently completed row. Repeat a failed routine slot write and expect its refetched source state restored.

**Regression:** a partner-owned chore still requires Override; a declined Override changes nothing. Row, detail-sheet and Sunday check-in completion entry points need separate observations; the same result on one entry point does not certify all three. Skip, Postpone, one-off Unassign and undated placement are not made optimistic by SCH-30. Flexible slot writes still have no offline queue.

**Reset:** restore test rows to their initial open state; unassign only test routine/desktop-created placements and verify after reload. Retain any failed/unknown write's ID before cleanup. Supporting replay-only fixtures are `src/features/items/bulkComplete.test.ts` and `src/features/items/flexibleScheduleCache.test.ts`.

## Untested limits and evidence sources

These steps were drafted from current source and existing delivery evidence. No scenario was executed, no live account data was changed, no phone install was performed and no manual result was upgraded to Pass. All nine item results remain Pending; missing setup/build/application evidence makes the dependent execution Blocked.

Current labels/actions were checked in [ChoresView](../src/components/chores/ChoresView.tsx), [assignment panel](../src/components/chores/ChoreAssignPanel.tsx), [detail sheet](../src/components/chores/ChoreSheet.tsx), [group row](../src/components/chores/ChoreGroupRow.tsx), [Catalogue chore form](../src/components/web/ChoreItemDialog.tsx), [Install prompt](../src/components/pwa/InstallAppPrompt.tsx), [mobile reminder form](../src/components/reminder/MobileReminderForm.tsx), [mobile navigation](../src/components/layouts/MobileNav.tsx) and [entry selector](../src/components/navigation/SemiDonutFAB.tsx). The [Chores overview](<../ERA Notes/02 - Standalone Modules/Chores/Overview.md>) and [Items overview](<../ERA Notes/02 - Standalone Modules/Items & Reminders/Overview.md>) explain setup and offline boundaries.

Source/receipt corrections applied in this wording: **Group** replaces the historical Layers label; 30-item creates use 25-item chunks; new desktop per-row creates use the bulk path under SCH-30; true flexible routines remain distinct from Catalogue templates; [Focus currently excludes chores](../src/components/planner/WebDayPlanner.tsx), despite the older SCH-20 handover suggesting that check. None of these drafts certifies Calendar parity, push delivery, external Google Calendar cleanup, current RLS, deployments or new recurrence behavior.

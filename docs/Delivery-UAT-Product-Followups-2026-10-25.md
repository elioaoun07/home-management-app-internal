# Delivery UAT — completed product scopes awaiting owner checks

Drafted 2026-10-25. [Scenario index](Delivery-UAT-Scenarios-2026-10-25.md) · [UAT home](Delivery-UAT.md)

These are step-by-step drafts for completed product work whose PM records retain owner/device acceptance. They supplement the retained Delivery-attempt wizards. They do not close broad open integration gates or claim that authored SQL is installed. Source labels were checked against HEAD `735d3881` plus the current working tree; no deployed build, device pass or new automated result was obtained in this drafting task.

**Before testing:** the delivering agent supplies an isolated application URL, exact served source/build identity, required applied-schema evidence and the prepared records named below. Open that URL in a browser, sign in with the provided test account, then append the route given in the scenario. Use a second signed-in browser/phone for partner tests. Missing setup means **Blocked**; the tester should not need to invent data or write SQL. These fixtures are requirements for handover, not fixtures created by this documentation task.

All new **Actual** results are **Pending**. Record scenario ID, tester, date/time, build, device, failing step, expected/actual and evidence. Existing historical Pass observations remain in their original records. At the end of a family, the implementer restores its isolated fixture snapshot; do not delete real household records for cleanup. No medicine described here is a treatment instruction: the names and doses are dummy application inputs only.

## Coverage and boundaries

| Delivered scope | Existing owner gate / evidence | Wizard |
|---|---|---|
| HLTH-24 medication course/checklist; HLTH-26 dosing options | [HLTH-25](<../ERA Notes/10 - Project Management/Healthcare/Healthcare — Master Book.md#hlth-25>); base/earlier PRN application owner-reported, Evening upgrade/device witness separate | [HEALTH](#health--medication-checklist-and-schedule) |
| KIT-20 typed Catalogue partial edits/revisions | [KIT-25](<../ERA Notes/10 - Project Management/Kitchen/Kitchen — Master Book.md#kit-25>); migration application owner-reported, two-phone stale-save witness pending | [CATALOGUE](#catalogue--keep-edits-and-detect-a-stale-save) |
| OUT-1–6, OUT-9–11 wardrobe/cutout/builder foundation | [OUT-19](<../ERA Notes/10 - Project Management/Outfits/Outfits — Master Book.md#out-19>) | [OUTFITS](#outfits--photograph-a-garment-and-save-an-outfit) |
| Trips planner, packing/categories, documents and document-refresh correction; TRIP-37/42 attachments/preset/Overview; TRIP-38 account-only activation; TRIP-34/35/40/41 tagging/spend | [Trips Shipped Log](<../ERA Notes/10 - Project Management/Trips/Trips — Master Book.md#shipped-log>), [TRIP-18](<../ERA Notes/10 - Project Management/Trips/Trips — Master Book.md#trip-18>), [TRIP-32](<../ERA Notes/10 - Project Management/Trips/Trips — Master Book.md#trip-32>) | [TRIPS](#trips--plan-pack-and-read-trip-spending) |
| NOTIF-1.1–1.6 daily-summary routing; source-present finite bell/urgency | [Notifications Shipped Log](<../ERA Notes/10 - Project Management/Notifications & Alerts/Notifications & Alerts — Master Book.md#shipped-log>), [NOTIF-2.1](<../ERA Notes/10 - Project Management/Notifications & Alerts/Notifications & Alerts — Master Book.md#notif-21>) | [NOTIFICATIONS](#notifications--one-arrival-signal-and-the-right-destination) |
| BUD-53 import review; BUD-55 FX parsing; BUD-59 wrapped description; BUD-78 embedded amount | [Budget Shipped Log](<../ERA Notes/10 - Project Management/Budget/Budget — Master Book.md#shipped-log>) | [IMPORT](#import--review-statement-rows-without-losing-them) |

**Not reopened or claimed complete:** broader Healthcare privacy/Google alarm gates; KIT-26/27 policy/strict-precondition rollout; Outfits AI tagging/planning/wear and >100-path behavior; Trips cascade verification TRIP-1/2/3 and re-enablement TRIP-39; broad notification delivery/recipient guarantees; import recovery and future audit-mode work. Tests below observe only the delivered behavior and name remaining gaps explicitly.

## HEALTH — medication checklist and Schedule

**Prepared data:** own dummy profile `UAT Health`, linked second user, no real medication records. Matching schema must include the medication RPCs, two-way Schedule triggers and the Evening upgrade. Record the fixture timezone as `Asia/Beirut` and use its test date. [Acceptance](<../ERA Notes/10 - Project Management/Healthcare/Healthcare — Master Book.md#hlth-26>) · [UI source](../src/app/healthcare/MedicationsSection.tsx).

### HEALTH-M1 — course, times, taken state and Undo

1. Open `/healthcare` and select `UAT Health`. Scroll to **Medications**, then select **Add**. **Expected:** a medication form for that profile opens.
2. Enter **Name** `UAT Course`, **Dose** `2 pills`, choose **Full course**, then **With or without food**. Set **First dose** to the fixture date at 08:00, select **Morning + evening**, and enter **Days** `2`. **Expected:** **Times** contains 08:00 and 20:00.
3. Select **Add medication**. **Expected:** the row shows the saved dose/course, and **Doses** lists the two scheduled opportunities for the fixture day. Reopen the medication and confirm the values survived saving.
4. Open `/reminders` in another tab and select **Focus**. Under the weekday at the top, select the date field and choose the fixture date; the left/right arrows are **Previous day** and **Next day** if only one day away. Scroll to the selected day's item list. **Expected:** two reminders for `UAT Course · 2 pills`, at **8:00 AM** and **8:00 PM**, with no duplicates. Open either reminder by tapping its title to check the urgent priority, then close its detail view.
5. Return to Health and tap the circular **Not taken** control for 08:00. **Expected:** it becomes **Taken**. Refresh the Schedule tab. Select the top toolbar's checkmark icon labelled **Show completed** if completed rows are hidden, then expand **Completed (1)** below the open item. **Expected:** the 8:00 AM reminder has a green checked square and a crossed-out title; only one matching occurrence exists.
6. In Schedule, tap the empty rounded square at the far left of the **8:00 PM** reminder. **Expected:** its square becomes green and checked, and its title is crossed out. Return to Health and refresh. **Expected:** the evening dose is Taken. Tap that taken dose in Health to unmark it, then refresh Schedule. **Expected:** the 8:00 PM reminder returns to the open list with an empty square and an uncrossed title.
7. Edit the same medicine to **3×** per day with three distinct times and save. **Expected:** three reminders replace the two; the morning taken state remains associated with its matching dose, and old duplicate reminders do not remain.
8. In Health, use the row's **Delete medication** trash action, then immediately press the toast's **Undo**. **Expected:** deletion removes the associated reminders; Undo restores the medicine, reminders and taken state. Reload both views to confirm.

**Actual:** Pending. **Reset:** use the immediate Undo, then have the implementer restore the dummy profile snapshot. **Limits:** a correct reminder row is not proof of push delivery; HEALTH-M3 covers that separate observation.

### HEALTH-M2 — eight-hour gap and Morning/Evening opportunities

1. Open `/healthcare → UAT Health → Medications → Add`. Enter `UAT Gap`, **Dose** `1 pill`, choose **As needed**, **With food**, **Min hours apart** `8`, and **When needed for** `UAT symptom`. Leave the daily maximum and named opportunities blank. Select **Add medication**. **Expected:** the medicine appears as needed with the eight-hour gap and food instruction; it creates no course reminder.
2. In **Doses**, press **Take** for `UAT Gap` once. **Expected:** one dose is logged and the wait until the next permitted dose is shown. A second immediate take is unavailable; a duplicate request must not create another log.
3. Press the dose toast's **Undo**. **Expected:** that dose disappears and the wait caused solely by it clears. The implementer supplies the isolated replay for exactly before/at eight hours, so the owner need not wait eight real hours.
4. Add a second medicine named `UAT Slots`, **Dose** `1 pill`, **As needed**, **Empty stomach**. Under **Dose opportunities**, select **Morning** and **Evening**. Save. **Expected:** the Doses card shows those two named controls; it does not show Noon as a new opportunity.
5. Tap Morning once, then Evening once. **Expected:** each shows Taken, with one log per opportunity for the local day. Tapping a taken slot unmarks that slot; it must not silently add a second dose.
6. Reload the page. **Expected:** the chosen state persists. In the implementer's isolated next-local-day replay, both opportunities become available for the new day while yesterday's history remains. Historical Noon logs, if supplied, are retained as history rather than renamed.

**Actual:** Pending. **Reset:** Undo the dummy takes and restore the fixture. **Limits:** server gap/daily-max/retry cases need the retained isolated PGlite evidence; a disabled button alone does not establish enforcement. No real medicine is taken during this software test.

### HEALTH-M3 — phone reminder delivery

1. On the actual test phone, open the prepared dummy course with its next reminder a few minutes ahead. Confirm that the owner has allowed notifications for this test installation. **Expected:** the medication and matching Schedule occurrence are visible before the due time.
2. Background the app and wait for that due time once. **Expected:** the notification arrives for the named dummy dose; record scheduled time, arrival time, phone/OS and screenshot.
3. Tap the notification. **Expected:** the relevant reminder/dose can be identified without opening an unrelated record. Return to Health and confirm any deliberate completion appears once.
4. If no push arrives, record Blocked/Fail with the actual observation and request the external scheduler's last-run evidence. **Expected:** nobody marks cron delivery Passed merely because the route exists.

**Actual:** Pending. **Reset:** implementer removes the dummy course through fixture reset. **Limit:** this does not establish Google Calendar physical alarms or all household privacy behavior.

## CATALOGUE — keep edits and detect a stale save

**Prepared data:** shared editable Places item `UAT Cafe` in a supplied category, initially Notes `Original`, plus one metadata key invisible in the form, `uat_hidden: keep`. Both test phones can read/edit this fixture item. KIT-25 records the revision migration already applied by the owner; confirm the test environment separately rather than repeating production SQL. [Acceptance](<../ERA Notes/10 - Project Management/Kitchen/Kitchen — Master Book.md#kit-20>) · [form](../src/components/web/CatalogueItemDialog.tsx).

### CATALOGUE-M1 — one field changes, hidden fields survive, Undo restores

1. Open `/catalogue`. Select the supplied **Places** module, then the category containing `UAT Cafe`. Use **Search items...** if shown at that level and enter `UAT Cafe`. **Expected:** the prepared item is visible.
2. Open the item's menu and select **Edit**. **Expected:** **Edit Place** opens with Name, Google Maps Link, Address, Phone, Notes and Tags; unrelated task fields are not introduced.
3. Change **Notes** from `Original` to `UAT first edit`, then select **Save Changes**. **Expected:** only that field changes; the other visible values remain.
4. Immediately press **Undo** on the save toast. Reopen the editor. **Expected:** Notes is `Original`; the implementer's read-only fixture inspection confirms `uat_hidden` stayed `keep` through save and Undo.
5. Edit again, clear a previously filled optional field and save. Reload and reopen. **Expected:** the cleared field stays cleared while untouched fields and hidden metadata survive.

**Actual:** Pending. **Reset:** restore the isolated item snapshot. **Limit:** browser inspection cannot prove hidden-key preservation by itself; retain the accompanying fixture read evidence.

### CATALOGUE-M2 — two phones edit the same revision

1. On both phones, open `/catalogue → Places → supplied category → UAT Cafe → Edit`. **Expected:** both start with Notes `Original` and the same initial revision, confirmed by the implementer.
2. On phone B, type `B unsaved` into Notes and leave the editor open. **Expected:** B's text is visible and unsaved.
3. On phone A, change Notes to `A saved` and press **Save Changes**. **Expected:** A closes the editor with its saved value.
4. On phone B, press **Save Changes**. **Expected:** **Changed elsewhere — reopen to see the latest** appears, and B's typed input remains in the open editor. It must not silently overwrite A.
5. Record B's input, close/reopen its editor, and read Notes. **Expected:** the saved value is `A saved`. If choosing to reapply B's edit, type it again against the new revision and save deliberately.
6. Refresh A. **Expected:** it reflects whichever deliberate latest save succeeded. Observe at approximately 390 px; the error and input remain usable.

**Actual:** Pending. **Reset:** fixture reset to `Original`. **Limit:** revision-less old-client strict refusal and partner RLS rollout remain KIT-27/KIT-26; this test does not close them.

## OUTFITS — photograph a garment and save an outfit

**Prepared data:** two personal test accounts, an ordinary garment photo with no sensitive content, applied wardrobe/outfit schema/private storage evidence, and a wardrobe fixture with at most 100 image paths. [Owner gate OUT-19](<../ERA Notes/10 - Project Management/Outfits/Outfits — Master Book.md#out-19>) · [capture UI](../src/components/outfits/AddGarmentSheet.tsx).

### OUTFITS-M1 — photo, cutout, manual tags and reopen

1. On phone A, open `/outfits`, then **Wardrobe**. Tap the plus action **Add garment**. **Expected:** **Add Garment** opens.
2. Select **Choose from Gallery** and choose the supplied photo. For a separate camera pass, select **Take Photo** instead. Start timing. **Expected:** processing feedback appears; record the first-use model download time separately from the warmed capture time.
3. When **Review Cutout** appears, select **Cutout**, inspect its transparent background, then select **Use cutout**. **Expected:** the garment remains visible with transparency rather than a solid rectangle. If removal fails, record that failure; **Keep original** is a fallback, not a passed cutout test.
4. Enter the name `UAT White Shirt`, select the top garment slot and suitable manual tags, then press **Save to wardrobe**. **Expected:** one garment appears in the Wardrobe grid with its cutout. Record elapsed warmed time against the under-one-minute owner criterion.
5. Open that garment once, close it, reload and reopen. **Expected:** image and tags persist. Do not double-tap while testing single-tap detail behavior.
6. Have the implementer record the network trace for the ≤100-path screen. **Expected:** one batch signed-URL request covers every requested image; one request with missing images is not a pass.

**Actual:** Pending on each phone separately. **Reset:** restore the isolated wardrobe after evidence is saved. **Limits:** first-download delay is reported, not hidden; >100-path coverage remains OUT-21/DEC-08. AI tagging is not implemented by these delivered slices.

### OUTFITS-M2 — compose, save and preserve personal ownership

1. In the prepared wardrobe, ensure a top, bottom and shoes exist. Open `/outfits → Outfits → Build a new outfit`. **Expected:** the paper-doll builder appears.
2. Swipe the top, bottom and shoes rows to select the named fixture garments. **Expected:** each selected piece changes in its corresponding slot without replacing the other slots.
3. Select **Save**. Enter Name `UAT Friday`, Occasion `Test`, then **Save outfit**. **Expected:** one named outfit appears in the gallery with the selected composition.
4. Reload, reopen `UAT Friday`, and compare the garments. **Expected:** the saved selection remains.
5. On phone B, signed in as the other user, open `/outfits`. **Expected:** A's garments and outfit are not listed; B has a separate personal wardrobe even though the users share a household. Repeat a separate capture under B to confirm normal own access.
6. Have the implementer show the isolated cross-user record/image access negative test. **Expected:** direct access is refused; an empty list alone is insufficient privacy evidence. If there is a visibility failure, use current `db-state.json` evidence before diagnosing route code.
7. On A, open a garment used by `UAT Friday` and inspect its archive/delete action without confirming destruction. **Expected:** the existing “used in N outfits” warning identifies usage. Full deletion/restore semantics remain their own open gate.

**Actual:** Pending. **Reset:** restore fixture snapshots for both users. **Limits:** saved composition is observed; transactional multirow composition/recovery remains OUT-20. Planner, wear history, AI tagging and PWA installation are not certified by this wizard.

## TRIPS — plan, pack and read trip spending

**Prepared data:** isolated household trip `UAT Winter` with dates tomorrow through three days later, currency EUR, linked test users A/B; dummy PDF/image under 5 MB; no real travel or money. For spending, prepare expense account `UAT EUR` and `UAT USD`, a EUR 20 transaction in the trip account also tagged to the trip, a USD 10 tagged transaction in the other expense account, plus excluded draft/deleted/income rows. Record balances before any tag tests. Applied-schema/partner-access evidence is a prerequisite under TRIP-18/32.

**Current behavior wins over old lifecycle prose:** `TRIP_CASCADE_ENABLED` is **false**. TRIP-38 activation creates the expense account and sets status; it does not skip chores, pause events, cancel tasks or skip meals. TRIP-1/2/3's complete cascade witnesses remain open and must not be run under assumptions from the earlier Overview.

### TRIPS-M1 — place, ticket and stable Overview

1. Open `/trips`, then `UAT Winter`. Select **Places**. **Expected:** the trip's itinerary opens; the tabs remain Overview / Places / Packing / Docs.
2. Use the itinerary's add-place action to open **Add place**. Enter Name `UAT Museum`, a fixture day and start time. Select an appropriate type chip, then **Ticket / QR** and choose the supplied dummy PDF. **Expected:** the selected filename appears; secondary fields remain under **More**.
3. Open **More**, enter Confirmation `UAT123` and a short note, then select **Add**. **Expected:** the place appears once with its chosen time and ticket.
4. Open its edit sheet, select **Ticket 1**, then return. **Expected:** the attached file opens using authorized access. Use **Add another** for a second dummy attachment; save and reopen. **Expected:** both files remain distinct.
5. Remove only the second attachment with **Remove attachment**, then **Save**. **Expected:** the first remains available; the removed one no longer appears on this place.
6. Open **Overview**. **Expected:** countdown and the next scheduled activity are prominent; with two prepared scheduled places, the second appears in **After**. Switch between tabs repeatedly. **Expected:** the tabs do not jump under your finger, notes/actions are in Overview content, and the sheet footer remains reachable at 390 px.

**Actual:** Pending. **Reset:** restore the isolated trip/files. **Limit:** final attachment support is multiple files (up to ten), despite the earliest TRIP-37 paragraph saying one; test the current schema/build. Missing attachment migration blocks that subcase, not a reason to claim upload success.

### TRIPS-M2 — preview a packing preset and keep unchecked rows out

1. Open `/trips → UAT Winter → Packing`. Tap the sparkles **Presets** action. **Expected:** presets open even when the list already contains an item.
2. Choose **Winter / Christmas**. **Expected:** a grouped checklist preview appears before anything is added.
3. Uncheck one named item and note the displayed **Add N** count. Press **Add N** once. **Expected:** exactly the selected entries are added; the unchecked entry is absent and existing packing entries remain.
4. Open a category, mark one prepared item packed, then reopen the trip and category. **Expected:** its packed state persists. Category icons/colors remain distinct, including Shoes and a compound category supplied by the fixture.
5. At 390 px, scroll the preview and return to its footer. **Expected:** checkboxes and Add remain reachable, with side padding and no horizontal overflow.
6. If the implementer supplies the separate checkpoint fixture and current schema evidence, use the **Packing checkpoint** menu → **Save checkpoint**, change one packed state, then **Revert to checkpoint**. **Expected:** that exact snapshot returns. A failed/zero-row save must not be treated as success; report it under the existing checkpoint gate rather than accepting on a toast alone.

**Actual:** Pending. **Reset:** restore isolated packing snapshot. **Limit:** step 6 is gated by existing TRIP-18/4 evidence; it does not close the known checkpoint acknowledgment defect by inspection.

### TRIPS-M3 — partner Docs, reopen and retry

1. On A, open `/trips → UAT Winter → Docs → Add`. Enter **Title** `UAT Ticket`, choose the appropriate **Type**, and use **File (photo or PDF)** to select the dummy file. Select **Add document**. **Expected:** it appears once in Documents.
2. On B, open the same household trip and **Docs**. **Expected:** `UAT Ticket` appears even if B previously opened an empty Docs tab before A added it.
3. Select its **Open file** icon. **Expected:** the authorized dummy document opens. Return to the trip, switch to another tab and back to Docs. **Expected:** it remains visible.
4. On B, add `UAT Partner Ticket` using the same steps. On A, leave and return to Docs or refocus the app. **Expected:** A sees B's permitted addition.
5. In the implementer's failed-read fixture, open Docs. **Expected:** **Couldn't load documents** and the retry action appear, rather than **No documents yet**. Restore the fixture response and select Retry. **Expected:** the real list returns.

**Actual:** Pending. **Reset:** restore isolated records/storage. **Limit:** the production household policy is not inferred from source or this draft; supply current owner evidence. An unexpected empty list invokes the repository's RLS-first investigation rule.

### TRIPS-M4 — account-only activation and completion

1. In the isolated fixture, open a dated, not-yet-active `UAT Winter` and select its Overview activation action. **Expected:** **Activate Trip** describes creating the dedicated expense account, with no enabled cascade promise.
2. Select **Activate** once. **Expected:** the trip becomes active and exactly one zero-balance expense account is linked to it. There is no “Trip not found or access denied” error for its actual owner.
3. Reload the trip and inspect the supplied Schedule/meal/payment baseline alongside the implementer's row comparison. **Expected:** chores, event pauses/actions, meals and recurring payments remain unchanged; only the intended account/status work occurred.
4. Select the Overview return/completion action, **I'm back home**, and complete the sheet's action. **Expected:** status becomes completed and the expense account remains for records; no schedule cascade is invented or reversed.
5. Have the implementer show the isolated repeat/retry case. **Expected:** retry does not create another account or move balances. Record any unverified case rather than inferring it from a single click.

**Actual:** Pending. **Reset:** restore the isolated account/trip snapshot; no live account deletion. **Limit:** this verifies TRIP-38 only. It does not accept the disabled household/solo cascade or authorize TRIP-39 re-enablement.

### TRIPS-M5 — transaction tag, currency totals and deduplication

1. Open `/trips → UAT Winter → Overview`. Tap the expenses card to expand its rows. **Expected:** EUR 20 and USD 10 are separate totals; the EUR transaction that belongs to both the account and tag appears once, not twice. Draft/deleted/income fixture rows are excluded.
2. In the mobile Expense view, open **Activity → Spending** and the prepared USD transaction. Open its **Trip** row, select `UAT Winter` (or remove/reapply its existing tag), and save the transaction through the normal editor. **Expected:** the tag changes without moving its account, amount or balance.
3. Return to the trip's Overview and reload. **Expected:** adding/removing the tag changes inclusion of that USD row once; EUR totals are unchanged. No conversion merges the two currencies.
4. In the isolated Statement Import review, open a new debit row's editor from **Review → Transactions**. Choose `UAT Winter` in **Trip**. **Expected:** its staged create action retains the tag. The implementer-assisted isolated commit creates one tagged transaction and only its ordinary transaction balance effect.
5. Inspect a credit/refund, transfer and already-matched row in that same review. **Expected:** they do not acquire an unsupported trip tag through this flow. Existing matched transactions can instead use the transaction editor.

**Actual:** Pending. **Reset:** restore the isolated transaction/import snapshot; never use ordinary transaction deletion as import rollback. **Limits:** TRIP-32's old manual-FX/account-link acceptance needs an identified current control and worked rounding fixture before exact clicks can be issued. Current `TripFormSheet` exposes Currency but no manual FX or existing-account picker. Record that handover gap as Blocked rather than inventing controls. The current TRIP-40 expense card deliberately performs no currency conversion.

## NOTIFICATIONS — one arrival signal and the right destination

**Prepared data:** isolated notification fixture with zero unread initially, one normal unread, one urgent unread and one daily-items-summary notification; actual test phones with permission only for the separately chosen push pass. [Bell source](../src/components/notifications/NotificationBell.tsx) · [routing registry](../src/lib/notifications/registry.tsx).

### NOTIFICATIONS-M1 — finite bell, readable count and reduced motion

1. Open the application page containing the header bell, such as `/expense`. With no unread fixture notifications, inspect the bell. **Expected:** its accessible label says all caught up and no unread count appears.
2. Have the fixture deliver one ordinary notification while the page is already open. **Expected:** the bell rings briefly, then rests after about one second; the count remains readable as 1. It must not keep ringing merely because the notification stays unread.
3. Leave it unread, switch tabs and return. **Expected:** reading/refocusing does not fabricate another arrival. The ordinary unread badge uses the theme's calm color.
4. Deliver one urgent fixture notification. **Expected:** count becomes 2 and the urgent signal is distinguishable; accessibility announces `Notifications, 2 unread, urgent`.
5. Open the bell and read/resolve the prepared notifications through their normal actions. **Expected:** the count follows actual unread state; when it reaches zero, the bell returns to rest after its brief caught-up indication.
6. Turn on the test phone's reduced-motion preference, reload and repeat the arrival case. **Expected:** the unread signal is static. Repeat under each supported application theme, checking contrast and no clipping at phone width.

**Actual:** Pending. **Reset:** restore phone motion/theme preferences and the isolated notification fixture. **Limit:** this is the existing NOTIF-2.1 owner gate, not proof of every recipient/delivery policy.

### NOTIFICATIONS-M2 — daily items summary opens Schedule

1. Open the app bell and select the prepared **daily items summary** notification. **Expected:** the destination is `/reminders`, showing Schedule rather than Expense.
2. Open `/alerts` and select that same summary in the fixture. **Expected:** it resolves to `/reminders` consistently.
3. On an owner-chosen physical-phone push pass, background the installed app, then tap the corresponding daily-items-summary system notification when it actually arrives. **Expected:** the service-worker path also opens `/reminders`. Record the served build/service-worker version and device.
4. In the fixture, open a **daily_reminder** expense reminder separately. **Expected:** its intended `/expense` destination remains intact; fixing items summaries did not redirect every reminder type.
5. Repeat the summary deep link after reopening the app. **Expected:** it still resolves to Schedule once, without a duplicate notification or unrelated record being opened.

**Actual:** Pending. **Reset:** fixture reset; do not manually run production cron routes. **Historical scope:** NOTIF-1.1–1.6 were found complete by the September 2 baseline with original ship date unrecorded. This draft adds no new ship date or claim that all six were separate implemented changes.

## IMPORT — review statement rows without losing them

**Prepared data:** isolated import account `UAT USD`, separate `UAT EUR`, linked partner account, a saved review session with a previously skipped person transfer and transaction, and sanitized PDF fixtures reproducing the exact line-wrap layouts below. The implementer supplies files and a fresh disposable browser profile so a real saved import session is not overwritten. This script stops before real-money **Save**. Parser tests alone do not validate PDF extraction, so use an actual PDF fixture for the click-through cases.

**Common entry for each import scenario:** open `/statement-import` (also reached from Settings → Statement Import), select the named account in **Choose an account**, then **Upload statement** and choose the supplied PDF. Wait until Review appears. **Expected:** the account/currency are explicit; selecting a row/category stages decisions and does not commit money.

### IMPORT-M1 — BUD-53 restored rows stay visible

1. Open the supplied saved review session. Select **Skipped → Previously skipped**. Find `UAT Transfer` and select **Restore**. **Expected:** it moves to **Review → Transfers**, with the destination indicated by the restoration feedback.
2. Open **Review → Transfers**, choose its partner destination account and leave the tab open. **Expected:** the row stays in place with its staged decision and chosen account name, rather than disappearing back into Skipped.
3. Change that fixture row to its transaction/spending interpretation, open the category editor and select the prepared expense category. **Expected:** the row remains visible; the selected category is named rather than reverting to **Choose category**.
4. Restore the prepared ordinary transaction from **Skipped → Previously skipped**, then choose its category under **Review → Transactions**. **Expected:** it also remains in the review list after the choice.
5. Refresh the disposable browser and resume the session. **Expected:** both restored decisions and destination/category names remain. A briefly loading partner account list must not erase the chosen destination label.
6. Select **Skipped** and inspect **This import**, **Previously skipped**, and **Own moves** where they contain data. **Expected:** reasons are visible; own-account moves do not offer an inappropriate Restore action.
7. Select **Ready**, the last main tab. **Expected:** staged Money / Matches / Memory effects are separated, with the signed net amount reflecting the prepared fixture. Nothing has been committed merely by opening Ready. Stop before Save.

**Actual:** Pending. **Reset:** close the disposable browser or use the isolated session's discard action; preserve real IndexedDB sessions. **Historical evidence:** BUD-53's shipped receipt explicitly says browser acceptance was still pending.

### IMPORT-M2 — BUD-55 exchange rate is not the transaction amount

1. Use the common entry with `UAT USD` and the supplied wrapped-exchange PDF: description `Own Account Exchange: USD to EUR`, continuation `at 0.852 - to <fixture account> -`, then money columns `200.00 - 1,909.46`. **Expected:** parsing reaches Review.
2. Select **Review → Transfers → Exchange**. **Expected:** the exchange row shows USD 200.00; it is not a skipped USD 0.85 row.
3. Open its details. **Expected:** the complete bank wording still includes rate 0.852 and the fixture destination; the description has not become only the destination-account fragment.
4. Choose the prepared EUR destination and inspect Ready. **Expected:** the intended FX pair is USD → EUR and the converted amount for this exact rate is EUR 170.40. Stop before Save.
5. In the supplied wrong-currency-destination fixture, inspect the staged decision. **Expected:** this EUR quote is not silently applied to a different destination currency. Keep this as a replay if the normal picker correctly prevents choosing that destination.

**Actual:** Pending. **Reset:** discard only the isolated review. **Limit:** the scenario validates this parse/review shape; it does not claim a currency conversion occurred or balances changed.

### IMPORT-M3 — BUD-59 wrapped transfer keeps both ends of its wording

1. Upload the supplied sanitized PDF whose person-transfer description begins before the dated amounts line and ends after it, including a page break: `Transfer to UAT PERSON via Mobile - meal`, then dated amount 14.00, then `two burgers`. **Expected:** review opens without an orphan unnamed transaction.
2. Select **Review → Transfers → People**. **Expected:** one UAT PERSON row for USD 14.00, not **(no merchant)** under ordinary Transactions.
3. Open the bank wording/details. **Expected:** the full description includes both `meal` and `two burgers`, in the right order.
4. Inspect the fixture's immediately preceding and following transaction rows. **Expected:** their descriptions and amounts remain unchanged; the statement's verification/QR footer has not been appended to a merchant name.

**Actual:** Pending for this new fixture/build. **Reset:** discard the isolated review. **Historical evidence preserved:** BUD-59's receipt already records a successful live upload and corrected row display in August; this is a regression draft, not a claim that the earlier observed check never happened.

### IMPORT-M4 — BUD-78 embedded Out amount does not reject the PDF

1. Upload the supplied EUR fixture containing the three-line shape `Transfer to UAT PERSON`, `via Mobile - Out: 105.02`, and actual columns `31.46 - 323.03`. **Expected:** the import reaches Review rather than failing the whole file with 422/`amounts_unreadable`.
2. Open **Review → Transfers → People** and the fixture row. **Expected:** the transaction's outgoing amount is EUR 31.46, its balance is 323.03 where bank detail displays it, and `Out: 105.02` remains description text rather than the money column.
3. Inspect the implementer's parse diagnostics for that same uploaded fixture. **Expected:** zero rejected rows for this shape. If using the owner's original historical fixture, its recorded corpus size was 75 rows; do not demand 75 from a deliberately smaller sanitized fixture.
4. Run the supplied malformed-money negative replay. **Expected:** genuinely unreadable money columns still reject; the correction has not turned every malformed PDF into success. Stop before Save.

**Actual:** Pending. **Reset:** discard isolated review. **Limit:** the original receipt records parser/corpus tests, not a fresh owner pass for this draft.

## Handover gaps to resolve before these are Ready

The exact served builds, prepared isolated records/PDFs, current owner-applied schema evidence and actual phones were not available as acceptance fixtures in this documentation task. The delivering agent must attach them rather than send the owner away to design the tests. Each scenario above remains Draft until those prerequisites are supplied; its manual result stays Pending until observed.

The following broader requirements remain explicitly untestable as current shipped behavior: disabled Trips household/solo cascades; an identified current account-link/manual-FX control for TRIP-32; Outfits >100-path coverage and unbuilt AI/planner/wear features; full medication/notification external scheduler and Google alarm guarantees; strict Catalogue old-client rollout; future import audit-mode/recovery work. Keep their original owners and work IDs.

No source code, schema, runtime state, owner result or production data was changed by this backfill. Automated evidence remains in dated Master Book receipts and existing fixture suites. Drafting a wizard is not acceptance or a new delivery.

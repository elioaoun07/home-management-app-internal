# Hub and ERA — owner UAT walkthroughs

[All delivery UAT scenarios](Delivery-UAT-Scenarios-2026-10-25.md) · [UAT workflow specification](<../ERA Notes/10 - Project Management/Plans/Delivery UAT Sign-off and Feedback.md>)

**Prepared:** 25 October 2026. **Coverage:** completed Hub/ERA delivery slices with pending owner/device acceptance, plus the explicitly incomplete HUB-105/HUB-107 disposition. **Instruction status:** source-checked draft. **Actual result for every new scenario below: Pending — not run.** Existing historical results in the [Master Book](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md>) remain unchanged.

These are instructions for a person using the app. They are not a claim that the current production build contains the changes. Before testing, the delivering agent must bind this handover to the exact candidate/source hashes, deployed build, prerequisites and acceptance revision using the [Delivery UAT identity template](Delivery-UAT.md#candidate-handover-template). A missing build, migration, fixture or enabled feature is **BLOCKED**, not FAIL and not PASS. No app mutation, paid-model call, migration, test execution or owner sign-off was performed while drafting this file.

## Start here

1. Obtain the test-build web address and the prepared test account from the delivery handover. Sign in. **Expect:** the account name matches the supplied tester; the build/version matches the handover. If either is missing, stop and record BLOCKED.
2. Use a disposable test household for scenarios that save, delete, transfer, report or change privacy. The preparer supplies the named records below and a reset procedure. **Expect:** there is no need to use real money, real appointments or another person's private data to finish these tests.
3. Run the phone pass on an actual phone. Record the phone/browser and repeat the visual cases on desktop; use the supplied Blue and Frost theme configurations. **Expect:** results distinguish a physical-phone pass from a narrow desktop window.
4. To open ERA, replace the path after the test site's name with `/era`. If only a dim central ERA mark appears, tap it once. **Expect:** the **ERA / Budget / Schedule / Recipes / Brain / Artifacts** view row and the **Message ERA** input become available. On a phone inside a module view, tap the speech-bubble button labelled **Open chat with ERA** to reveal the input. **Close chat** closes that drawer.
5. The arrow beside **Message ERA** is **Send**. The sparkle button is **Ask AI**. Use **Send** unless a scenario explicitly says Ask AI. **Expect:** native typing/capture cases do not need a paid interpretation call. AI/speech cases remain BLOCKED until the owner starts the bounded live pass; this document does not authorize an agent to run it.
6. After each scenario, record its ID, PASS/FAIL/BLOCKED, the observed result, build, device, tester and date. If something differs, note the exact step and keep a screenshot if helpful. **Expect:** no scenario is accepted merely because it has instructions.

**Prepared records:** own USD accounts `Drawer` ($1,000) and `Wallet` ($100); a separate own LBP account and matching categories; a shopping chat `UAT Groceries` with group `Spinneys`; a Budget chat `UAT Budget`; a Reminder chat `UAT Reminders`; an owned one-time reminder `UAT dentist` with a known date/time; a unique recipe `UAT Orange Chicken` whose ingredient list is printed in the handover; a future empty dinner slot; an own historical reminder titled `Call mom`, coffee expenses and milk shopping rows for memory; a second test account/phone with different private history. The preparer supplies actual dates and test-record links. A scenario needing absent data stays BLOCKED; the tester does not have to invent setup.

**Rollout gates:** source reminder/event saves require the SCH-24 source migration; extended Artifacts require HUB-91's artifact migration; saved agent execution requires HUB-104's journal migration and enabled build flag; lexicon requires HUB-83's migration; Activity Log requires HUB-72's migration. Obtain owner-supplied application/current DB evidence before those cases. Written SQL alone is not evidence it ran. Existing dependencies and untouched engineering gaps remain open.

## Coverage map

| Delivered item / acceptance | Walkthrough |
|---|---|
| [HUB-115](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-115>) top-layer motion | H01 |
| [HUB-112](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-112>) native composer | H02; H04–H05 |
| [HUB-113](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-113>) composer memory | H03–H05 |
| [HUB-75](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-75>) amount parsing | H04 |
| [HUB-97](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-97>) shopping grammar | H05 |
| [HUB-94](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-94>) events/places; [HUB-88](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-88>) location request; [HUB-89](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-89>) contact request; [HUB-90](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-90>) artifact contract | H06 |
| [HUB-76](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-76>) effect tiers; [HUB-78](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-78>) questions/handoffs; [HUB-80](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-80>) lexicon; [HUB-84](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-84>) follow-ups; [HUB-6](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-6>) split handoff | H07; voice opt-in receipt for reused HUB-84 is separately covered in H09 |
| [HUB-86](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-86>) conversation; [HUB-52](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-52>) History; [HUB-85](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-85>) Report | H08; existing combined owner gate remains [HUB-83](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-83>) |
| [HUB-73](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-73>) selection; [HUB-74](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-74>) composer sizing; [HUB-16](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-16>) voice time | H09 |
| [HUB-100](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-100>) AI shopping; [HUB-103](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-103>) compound plans; [HUB-109](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-109>) effective consent | H10–H11 |
| [HUB-104](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-104>) saved execution | H11 |
| [HUB-108](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-108>) confirmation/context hardening | H10–H12; its privacy/recurrence boundaries are not a claim of full source idempotency |
| [HUB-106](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-106>) adaptive context | H12 |
| [HUB-98](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-98>) provider failure handling | H13 |
| [HUB-72](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-72>) Activity Log | H14 |
| [HUB-105](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-105>) discovery/evaluation; [HUB-107](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-107>) provider migration | Partial-slice disposition after H14; neither is marked complete here |

## H01 — ERA motion and readable navigation

**Acceptance:** HUB-115. **Type:** visual/regression. **Data:** no new records. **Actual:** Pending.

1. Open `/era`, tap the dim mark if necessary, and leave the screen idle for ten seconds. **Expect:** a single wake ripple and slow atmosphere around the mark; readable text and stationary reading surfaces.
2. Select **Budget**, **Schedule**, **Recipes**, **Brain**, then **ERA**. **Expect:** the active highlight and mark change with the selected view, without a blank jump or decoration blocking a tap.
3. In **ERA**, tap **Message ERA** and type `remind me to UAT call tomorrow at 5pm` without sending. **Expect:** the mark/composer adopt Schedule's identity; text stays readable and suggestions remain tappable.
4. Clear the draft using **Clear text**. Select **Budget** and, on the phone, open and close **Open chat with ERA** three times. **Expect:** the drawer opens visibly each time, closes completely and leaves its launcher usable.
5. With a prepared long conversation open, scroll older replies. **Expect:** ambient movement is subdued while reading and never moves the message text.
6. Have the tester's device configured for reduced motion, reload `/era`, and repeat steps 1–4. **Expect:** static atmosphere and immediate/quiet transitions instead of orbit, sheen or travelling movement. Record this pass separately if reduced motion cannot be enabled.
7. Repeat in the second supplied theme and on desktop. **Expect:** readable controls and no page-wide sideways scrolling.

**Reset:** clear unsent text; restore the device's original reduced-motion/theme setting. **Limit:** this checks presentation and basic navigation, not source writes or live running tasks.

## H02 — One clear next question while typing a reminder

**Acceptance:** HUB-112, current refinements under HUB-113. **Type:** defect/feature. **Actual:** Pending.

1. Open `/era` and focus **Message ERA**. Type `Remind me tomorrow at 5pm`. **Expect:** ERA asks for the missing title; it does not invent “Day” or jump directly to an alert question. The former defect treated the start of “today” as filler and invented a title.
2. Press Enter while the title is missing. **Expect:** the question calls attention to the missing detail; no reminder is sent.
3. Replace the sentence with `Remind me to UAT call`. **Expect:** one question asks for the missing date/time; choices have full names and wrap within the screen.
4. Choose a future date/time suggestion. **Expect:** the sentence/summary now contains that actual day and time, with no duplicate word fragment. Tap the underlined date/time in the summary and choose a different offered value. **Expect:** the correction replaces the old value.
5. Delete the time from the sentence. **Expect:** the missing-time question returns and Send cannot silently accept a parser default. Restore an explicit `tomorrow at 5pm`.
6. Tap the ellipsis button labelled **Change action**. Inspect its vertical action choices, then close the sheet without changing the action. **Expect:** the sentence remains and unrelated module tabs have not crowded the question. Where **More** is offered, open it and use its **Search** field; expect an opaque sheet with full labels.
7. On a phone, select **Schedule**, open **Open chat with ERA**, repeat steps 1–6, then use **Close chat** while a helper sheet is open. Reopen chat. **Expect:** no stranded helper panel, clipped keyboard controls or hidden last reply.
8. With the source migration verified and only the isolated test account in use, send `Remind me to UAT call tomorrow at 5pm no alert`. Open the resulting reminder's Artifact from **Artifacts**, selecting today's date if needed. **Expect:** exactly one reminder with the requested local date, 17:00 and no alert; the source detail is the evidence, not merely ERA's success sentence.
9. Use the create action's **Undo** when offered, or the supplied test-record cleanup procedure. **Expect:** only this test reminder is removed.

**Reset:** clear unsent input and remove the single test reminder. **Limit:** actual push delivery is not tested by “no alert”; unknown saves must be inspected, not resent. Current code uses **Change action**, **More/Browse lists** and tappable summary values; old “Details” wording is not used as an invented button.

## H03 — Personal completion, known phrases and explicit time

**Acceptance:** HUB-113. **Type:** feature/regression/privacy. **Data:** prepared own `Call mom`, coffee and milk history; partner has a unique private title absent from this account. **Actual:** Pending.

1. Open `/era`, focus **Message ERA**, and type `remind me to ca`. **Expect:** own-history `Call mom` is offered, with a faint remaining completion where appropriate. The partner-only title is absent.
2. Accept once with the first suggestion chip; clear and repeat using Tab on desktop, right arrow at the end of the input, and right swipe on the phone. **Expect:** each completion adds the missing text once and preserves typing focus. Record each input method separately.
3. Type `remind me to call mom ` including the final space. Choose one combined day/time suggestion. **Expect:** both fields are set, and offered times are in the future relative to the test clock.
4. Replace the draft in turn with `15$ pharmacy`, `remember to UAT call tomorrow at 5pm`, `we're out of milk`, `buy milk and eggs`, `add milk`, `coffee 4`, and `call mom tomorrow at 5`. **Expect:** the understood action and next missing details match expense/reminder/shopping; the last three depend on the prepared own/history records. Do not send these parser-inspection drafts.
5. In the **ERA** view, replace the draft with `Gaz yaris 38`, `spent 2 hours studying`, `buy milk tomorrow`, then a title absent from memory such as `call UAT stranger tomorrow`. **Expect:** none is silently turned into a ready native capture merely from its number or generic verb. Budget-face shorthand is a separate behavior.
6. Type `remind me to UAT check tonight at 9pm`. **Expect:** the summary says 9 PM, not the former evening default 8 PM. No `at 9pm` fragment remains in the title. Do not send if tonight has already passed; use the prepared clock fixture for that boundary.
7. Type `I paid $5 for coffee yesterday from Wallet`. **Expect:** a $5 expense on the USD Wallet account, description Coffee, yesterday's local date, and the remembered category where available. The account phrase is not part of Coffee. Change to an explicitly LBP amount; expect a compatible LBP account/question, never silent currency conversion to the remembered USD Wallet.
8. On the second test account, repeat step 1 using its own known title. **Expect:** that account's suggestions, with no first-account private title/account default.

**Reset:** clear all unsent drafts. **Limits:** test the early-morning “yesterday” boundary using an isolated supplied clock/build, not by changing real financial records or the phone clock. Failed/offline memory reads may reduce suggestions; they must not invent history. Record that boundary BLOCKED if no fixture is supplied.

## H04 — Dollar suffixes and LBP thousands produce the right draft

**Acceptance:** HUB-75, HUB-112, HUB-113. **Type:** money parser regression. **Actual:** Pending.

1. Open `/era`, select **Budget**, and open the chat drawer on a phone. Record the supplied USD account's current balance. **Expect:** it matches the fixture baseline.
2. Enter `spent 12$ on UAT coffee`. Use the offered account/category choices if required, then select **Send**. **Expect:** one $12 expense draft; the account balance is unchanged because it is a draft.
3. Open **Change** on the result, or its supplied draft link. **Expect:** the expense form is prefilled with 12 USD and the intended account/description. Do not submit/confirm the transaction. Return to ERA and use the draft's **Undo** or supplied draft cleanup.
4. Repeat steps 2–3 separately for `paid 300$ for UAT supplies`, `UAT coffee 4$`, and `paid $2,000 for UAT rent`. **Expect:** draft amounts 300, 4 and 2,000 respectively; the last case must not become 2. Undo each draft before the next case.
5. Select the prepared LBP account and submit `500k lbp UAT groceries` through the same native path. **Expect:** 500,000 native LBP; no USD draft and no balance change before confirmation. Inspect and Undo it.
6. On the USD default, type an unmarked `500k` expense. **Expect:** a currency question/clarification instead of guessing USD. Clear it. Type `spent 2 hours studying` and `I bought 2 shirts`. **Expect:** no expense draft from those counts.

**Reset:** Undo/remove each test draft; verify original account balances. **Limits:** this validates parsing and draft handoff, not transaction posting or split calculations. Some older Feature Map prose incorrectly says transaction amounts are stored in thousands; the delivered HUB-75 receipt and amount contract specify native 500000 LBP.

## H05 — Shopping lists, groups and multiline capture

**Acceptance:** HUB-97, HUB-112, HUB-113. **Type:** feature/regression. **Data:** empty `UAT Groceries`, existing `Spinneys` group, historical milk/eggs rows; a second long-named shopping chat for the list picker. **Actual:** Pending.

1. Open `/era` and type `Add UAT milk, UAT bread, UAT eggs. To spinneys shopping list`. If the helper asks for a list, select **UAT Groceries**; use **Browse lists** and **Search** if necessary. Select **Send**. **Expect:** three separate items on the chosen list, under Spinneys when that group exists.
2. Open `/chat`, find **UAT Groceries** in the thread list and tap it. **Expect:** each named item appears once. Return to ERA and use the action's **Undo**, then reopen the list. **Expect:** those three test rows are gone.
3. Repeat steps 1–2 with `Add UAT milk, UAT bread and UAT eggs to spinneys shopping list`, then `Add UAT milk to shopping chat`, then `Add to shopping list UAT milk, UAT bread and UAT eggs`. **Expect:** every requested item is included; punctuation and word order do not drop a row. Undo after each trial.
4. Type a multiline shopping capture with one item on each line, including `UAT bread and butter` as one line. Use Enter to add another line, then **Send**. **Expect:** Enter creates a newline; Send creates one row per line, retaining “bread and butter” as one item rather than splitting its internal “and”. Inspect and Undo.
5. Begin another capture, choose one list/group, then change the list from the underlined summary. **Expect:** the first list's group is not carried into the second. Current memory may infer a valid usual group, but a group is not a mandatory question; that is the HUB-113 refinement of HUB-112.
6. Add a unique test item with an unknown store name. **Expect:** the item is saved to General and the offered group choice is explicit; “weekly”/“usual” are not invented store groups. Decline any group creation and Undo the item.
7. Send `Don't add UAT milk to the shopping list`. Open the shopping chat again. **Expect:** no new row and no write confirmation that treats the negation as a command.
8. Begin `add milk` with the prepared history and then add a new line. **Expect:** the usual list/group can be inferred; “What else?” suggestions omit items already represented on that list/capture.

**Reset:** Undo each acknowledged test addition immediately; clear the final draft. **Limits:** an uncertain/partial result is not permission to repeat Send. Source exactly-once/bulk transport work remains HUB-46/HUB-116; this scenario does not certify it.

## H06 — Create a place/contact, use the place and open its Artifact

**Acceptance:** HUB-94, HUB-88, HUB-89, HUB-90. **Type:** feature/defect. **Data:** no existing `UAT Kobeize` place or `UAT Laura` contact; source/artifact migrations verified. **Actual:** Pending.

**Known source divergence, found while drafting:** the current typed composer passes a structured event capture to `resolveScheduleCapture` (`resolveIntent.ts:233–234`), which creates the event without the older `events.ts` resolver's **Where? / Save to Places?** follow-up. Steps 3–6 retain the accepted behavior to check; they are not a claim those controls will appear on this candidate. Before calling this section Ready, the delivering agent must resolve or explicitly carry that gap and supply a reachable test path. If the follow-up is missing in an owner test, record that exact observation; do not silently pass the feature because the event alone saved. Complete any required date/time/end-time questions the current composer shows before sending an event.

1. Open `/era`, enter `Add UAT Kobeize as a location` in **Message ERA**, and select **Send**. **Expect:** a place is saved with an acknowledged result, rather than the former generic “not sure” reply.
2. Select **Artifacts**, select today's date, and tap the `UAT Kobeize` Place row. **Expect:** the actual catalogue item opens. In `/catalogue`, **Places** contains the same item.
3. Return to ERA and send `Add an event UAT dinner tomorrow at 8pm`. **Expect:** an event exists first, followed by **Where?** and saved-place/Skip choices. Choose `UAT Kobeize`. **Expect:** the event's location is that place.
4. Open the event's Artifact and read its source detail. **Expect:** tomorrow at 20:00, correct title and location. Return to ERA and send `Add an event UAT lunch at UAT Kobeize tomorrow at 1pm`. **Expect:** location is recognized without another Where question; inspect the event to verify 13:00 and the place.
5. For a fresh event, answer **Where?** with `UAT New Cafe`, then choose **Save** on `Save "UAT New Cafe" to Places?`. **Expect:** the event keeps the location and a separate Place artifact opens the new catalogue item. In a separate disposable trial, choose **No**; expect the event location to remain without a saved Place.
6. Send `Add an event UAT undated dinner`. **Expect:** **When?** with no event created until a date is supplied. Start a different explicit command instead of answering. **Expect:** the new command is not stored as the previous event's location/date. Clear/decline unfinished work.
7. Send `Add UAT Laura as a contact person`. Select **Artifacts** and open the Contact row. **Expect:** `UAT Laura` opens inside Catalogue → **Contacts**, replacing the former missed request.
8. From **Artifacts**, choose **Household activity →**. Find the matching ERA message row for the test creation and select **Open**. **Expect:** it reaches the same source item, where the installed artifact/Activity support applies; an old pre-artifact row is not this test.
9. Use each supported per-record Undo/cleanup procedure. **Expect:** only the test event/place/contact rows are removed; their deletion/history is represented honestly.

**Reset:** remove only named test records; the preparer supplies any cleanup path without a supported inverse. **Limits:** HUB-92 still owns remaining entity-specific deep links and HUB-102 missing inverses. Do not demand an item-level Open/Undo that their unfinished scope has not delivered. Saved alias-tag reuse can be tested with a preseeded place alias; no geofencing is claimed.

## H07 — Explicit consent, follow-ups, learned choices and split handoff

**Acceptance:** HUB-76, HUB-78, HUB-80, HUB-84, delivered HUB-6 slice. **Type:** feature/money safety/regression. **Data:** isolated Drawer $1,000 / Wallet $100; supplied one-time and recurring reminders; Spinneys group. **Actual:** Pending.

1. Open `/era` and send `Don't transfer $300 from Drawer to Wallet`. Repeat separately with `What if I transfer $300 from Drawer to Wallet?`, `If I paid 50 for gas`, and `Rita said she spent 20$`. **Expect:** no transfer/expense is executed. Inspect the prepared accounts after the first two; balances remain $1,000/$100.
2. Send `I took 300$ from Drawer`. Choose **Wallet** from the destination chips. **Expect:** a **Confirm / Dismiss** card with the actual source, destination and amount; balances remain unchanged before confirmation.
3. Choose **Dismiss** and inspect balances. **Expect:** no transfer. Repeat step 2 and select **Confirm** once. **Expect:** Drawer $700, Wallet $400. Use **Undo** once. **Expect:** $1,000/$100 again; no duplicate reverse transfer.
4. In a new chat, send `move the UAT dentist to Friday`, using the one-time reminder prepared by the tester. **Expect:** ERA resolves the actual reminder, asks if a name is ambiguous, and shows the intended date before any required confirmation. Complete the normal confirmation, inspect its source detail, then send `make it 5pm instead`. **Expect:** the same reminder changes to 17:00; no unrelated reminder changes. Restore the fixture's original date/time.
5. Repeat by name with the supplied recurring reminder. **Expect:** **This one / Series** choices and the relevant confirmation; decline the change for this smoke test. This does not certify all recurrence behavior.
6. Send `Add UAT salt to my shopping list`, then `make it under Spinneys group`. Open `/chat` → **UAT Groceries**. **Expect:** that item moves to Spinneys instead of the former wrong-domain “what should I reschedule?” question. Use the move's **Undo**; expect its original group. Remove the test item with its original cleanup action.
7. Send `spent 12$ on UAT coffee`, then `no, 15`. Inspect the draft through **Change**. **Expect:** one current $15 draft; no posted expense or balance change. Undo the correction and inspect $12, then remove the draft.
8. With lexicon rollout verified, repeat step 2's same destination choice twice, undoing the transfer each time. On the offered **Always** control, choose it and confirm the reviewed transfer. Undo its money effect. **Expect:** a future matching request fills Wallet without another destination question, but still shows Confirm. Send `Forget that`; expect the default to stop applying. Repeat under the second account; it must not inherit the first account's default.
9. Send `split 60$ dinner with Racha`, substituting the prepared partner name if different. Select **Open** on the handoff. **Expect:** `/expense?era=…` opens with **Split** enabled and **Total bill** 60. Inspect **Who owes you?** and the participant/amount controls; do not submit. Refresh before editing and confirm the handoff still names the same capture. **Expect:** no money moved just by opening the form.

**Reset:** restore account balances via the actual Undo, restore reminder date/time, remove drafts/shopping fixtures, revoke the test default and discard the unsaved split form. **Limits:** the old HUB-6 acceptance paragraph still says Later, but its 27 September shipped receipt and current source prove only the precision-form handoff described here. This scenario does not accept unfinished split/currency business changes. Test alias override/deleted-account invalidation through prepared fixtures; do not delete a real account for UAT.

## H08 — Conversation, New chat, History and Report

**Acceptance:** HUB-86, HUB-52, HUB-85; combined owner witness HUB-83. **Type:** feature/regression. **Actual:** Pending.

1. Open `/era` and send a supported read such as `what time is it`. **Expect:** your message appears immediately in your person color, a thinking state is shown, and ERA's reply sits above the composer with readable text. Its newest reply animates once.
2. Refresh the page. **Expect:** the same conversation remains; old replies do not type out again, and bookkeeping text such as `handoff consumed` is absent.
3. Tap the toolbar icon labelled **New chat** (or the same icon in the mobile drawer). **Expect:** previous cards/questions disappear and the hub returns to its idle arrangement. Send `move it to 5pm`. **Expect:** no earlier reminder is changed from the old “it”; a clarification/limit is acceptable.
4. Tap **History**, select a known earlier conversation, and read the preview. **Expect:** conversations are titled from their first message and grouped under **Today / Yesterday / This week / Earlier**. Opening a preview alone does not resume it.
5. Select **Continue**. **Expect:** that exact conversation becomes the active thread. Reopen **History**, preview the disposable test conversation, select **Archive**, then **Undo** in the toast. **Expect:** it disappears and returns as the same conversation.
6. Open a prepared conversation whose last activity was over 30 minutes ago. **Expect:** the quiet **New chat** divider/toolbar dot appears without forcing a new conversation. No need to wait 30 minutes if this dated fixture exists.
7. Open the supplied missed-response fixture in a test conversation. Tap **Report** under the reply (or its reply details), select **Missed**, enter `UAT: expected the named action`, and select **Send**. **Expect:** **Reported** appears. Tap **Undo** promptly. **Expect:** only the report marker disappears; messages remain.
8. Repeat step 7 and keep the report. After the two-minute grace period, start the supplied isolated PM instance with `pnpm pm` or use its normal report refresh. Open PM **Work**, choose **Hub & ERA**, and find the imported item under **Now / ERA reports**; also inspect **Sprints**. **Expect:** exactly one item contains the request, reply, expected note and transcript; a restart/refresh does not duplicate it. Use a test PM corpus so this exercise does not pollute the real backlog.
9. Repeat with a supplied wrong-result fixture and choose **Wrong**. **Expect:** the existing ERA-report importer classifies that report as its hotfix/blocker policy, distinct from the future UAT-feedback policy in the new specification.

**Reset:** Undo reports during their grace window; archive/restore only disposable conversations. For kept import fixtures, use the supplied isolated-corpus reset. **Limits:** filing Report writes data and importing creates real work if pointed at real stores; this walkthrough requires the disposable setup. It does not implement or validate the proposed delivery-UAT feedback importer.

## H09 — Household chat selection, phone composer and voice time

**Acceptance:** HUB-73, HUB-74, HUB-16; separate 29 September HUB-84 voice-opt-in receipt. **Type:** UI/regression/integration. **Actual:** Pending.

1. Open `/chat` and tap **UAT Budget** in the thread list. **Expect:** the thread title, search and **Chat options** control fit at phone width; the composer and its right-edge action are fully visible.
2. Leave the message field empty, then type `UAT coffee 4$`. **Expect:** the right action changes from **Record voice message** to **Send message**, remains fully visible, and the keyboard does not cover it. Clear the unsent message.
3. Long-press one of the supplied disposable messages and choose **Select messages**. Select two visible rows using their circles. **Expect:** **Add all**, **Delete all** and **Cancel selection** occupy a readable selection row.
4. Select **Add all**. **Expect:** the review sheet contains both selected addable rows and their amounts, with one account choice for the batch and a per-row Confirm choice. Close the review without saving. A message without a detectable Budget amount must not become an invented charge.
5. With two own disposable messages selected, choose **Delete all**, then **Delete for me**. **Expect:** they disappear only from this account; the second account still sees them. Tap **Undo**; expect both back.
6. Repeat on two own messages with **Delete for everyone**, then Undo. **Expect:** both accounts lose and regain the same messages. When selection includes a partner's message, **Delete for everyone** must not offer authority over that partner's row.
7. Open **Chat options** and the color filter, then select all visible messages. **Expect:** selection includes only visible filtered rows. Cancel selection and clear the filter. Confirm the new-chat control remains reachable from the thread list.
8. For the separately owner-started speech pass, open the chat's conversation control in **Chat options** and enable it. Say `Remind me to UAT voice check tomorrow at 4pm`. **Expect:** the shared ERA path retains tomorrow at 16:00 and saves through its normal confirmation/source rules. Inspect the resulting reminder's source detail. A spoken Confirm/Dismiss card can be answered **yes/no**; **no** must not write.
9. On `/era` before enabling voice, inspect the mic/speaker state. **Expect:** voice chat/listening and speaker output are opt-in on a fresh prepared profile; opening the page alone does not start the test conversation. Toggle only the requested control for the speech test, then disable it afterward.
10. In a separate disposable voice-message recording, inspect Cancel, waveform/timer/pause and Send at 320–390 px. Cancel the first recording; send a second only in the authorized speech test and use its **Undo**. **Expect:** controls fit, cancelled audio is not sent, and Undo removes the sent message.

**Reset:** Undo test deletions/messages, clear selection/filter, disable voice and remove the test reminder. **Limits:** bulk save/partial offline delivery still has HUB-116 follow-up; Azure/STT/TTS acceptance requires actual permission/setup and a bounded owner-started pass. This draft has not exercised paid speech.

## H10 — AI shopping and a reviewed recipe-to-meal plan

**Acceptance:** HUB-100, HUB-103, HUB-109, HUB-108. **Type:** feature/consent/regression. **Data:** isolated recipe, printed ingredient list, empty future dinner slot and test shopping list. **Actual:** Pending; live-model portion BLOCKED until owner starts the bounded pass.

1. Open `/era`, type `Could you pop UAT milk and UAT eggs onto the grocery list?`, and use **Ask AI** for this case. **Expect:** a supported shopping proposal with **Confirm / Dismiss**, not a claim that shopping lists do not exist. Inspect the effective items/list/group on the card.
2. Choose **Dismiss**, then open `/chat` → **UAT Groceries**. **Expect:** neither item was added. For the approved positive trial, request it again, inspect the card and Confirm once. **Expect:** the two actual items appear, with acknowledged Artifacts; a repeated confirmation does not add duplicates.
3. Enter `Plan UAT Orange Chicken for Friday dinner and add its ingredients to the shopping list`, with Friday/date supplied in the test handover. **Expect:** a bounded proposal for the actual unique recipe, actual date/dinner and shopping ingredients. Expand **Request** to compare the original wording with the effective fields.
4. Compare the displayed ingredients with the printed recipe. **Expect:** real ingredient names and intended list/group; unresolved dependencies are visibly pending, never guessed. If resolving a dependency changes a consequential value, a new effective confirmation is required before that write.
5. Select **Confirm** only when the displayed effect matches the request. Open `/meal-plan`, navigate to the supplied date, and inspect dinner; open `/chat` → **UAT Groceries**. **Expect:** the selected recipe in that slot and the actual ingredient rows, with completed/partial results represented separately.
6. Return to ERA → **Artifacts** and open the result links. **Expect:** completed actions are recorded and source views are fresh. Do not require a single “Undo everything” control; whole-plan rollback has not shipped.
7. For the supplied duplicate-recipe-name fixture, request the ambiguous recipe. **Expect:** clarification/refusal rather than silently choosing the first match. Dismiss and make no change.
8. For a supplied preview fixture whose descriptive model label is benign but its admitted fields differ, compare **Request** with the visible target/date/amount/list. **Expect:** the effective fields are displayed, not the benign label alone. This adversarial case requires an isolated prepared fixture; do not manipulate a real model/production request to create it.
9. Ask for a supported action mixed with unsupported pantry subtraction only in the owner-approved evaluation pass. **Expect:** no misleading whole-goal success; record the known unsupported-stock-subtraction defect under HUB-105/107 if it recurs. A partial allowed action is not an acceptance pass for the whole request.

**Reset:** use the per-record source cleanup supplied for meal/list fixtures; a missing inverse remains a disclosed limit. **Limits:** current-model interpretation, modified-target injection and failure-after-first-effect require their prepared fixture/owner pass. No live calls or whole-goal certification were performed here.

## H11 — Resume saved progress without repeating an uncertain write

**Acceptance:** HUB-104, HUB-109, HUB-108. **Type:** recovery/consent. **Prerequisites:** journal migration/flag enabled on the exact build; two devices signed into the same test account; a prepared interrupted read, pending confirmation and uncertain-write fixture. **Actual:** Pending; absent fixtures mean BLOCKED.

1. Open `/era` → **History**, select the supplied interrupted-plan conversation, then **Continue**. **Expect:** **Agent progress** restores the same source request and its completed steps.
2. For the saved pending-confirmation fixture, refresh the page. **Expect:** the effective values remain visible and the step still needs **Confirm**; reopening or **Resume** has not authorized the write.
3. Confirm the prepared safe step once, then reload. **Expect:** its completed output/Artifact remains and the step is not repeated. Open the same conversation on the second device and inspect the same run.
4. With the preparer supervising an isolated simultaneous-confirm fixture, press Confirm from both devices. **Expect:** one admitted attempt and one source effect. Record this separately from the normal single-device pass.
5. Open the fixture stopped at a date question. Answer that exact question, then use **Resume** when shown. **Expect:** the pending step completes and earlier completed steps are not replayed.
6. Open the interrupted read fixture and choose **Recover**; if the blocked read offers **Retry read**, use it once. **Expect:** only a safe read retries; earlier completed writes remain complete.
7. Open the uncertain shopping-write fixture. **Expect:** **Skip / Stop** or source inspection is available, but no automatic write retry. Inspect the supplied shopping-list link before any further choice. **Expect:** the UI never claims rollback or a complete success solely because a reply was lost.
8. On a prepared waiting plan, select **New chat** before further steps. **Expect:** later steps do not continue into the new conversation; old replies remain with the original chat. A fixture with a changed target/date/time zone must require fresh review or refuse, not reuse stale approval.

**Reset:** **Stop** only the disposable unfinished runs; restore fixtures through the supplied isolated reset. **Limits:** these instructions do not supply network-fault controls or authorize production interruption. Source writes and journal checkpoints are not one universal exactly-once transaction; HUB-46 remains open. Two-device and fault cases stay BLOCKED without a controlled setup.

## H12 — Context belongs to its speaker, chat and actual outcomes

**Acceptance:** HUB-106, HUB-108. **Type:** context/privacy/regression. **Data:** two isolated accounts with distinct private wording; prepared success, failed/reported-action and delayed-response fixtures. **Actual:** Pending; live interpretation needs the owner's bounded pass.

1. On the first account, open `/era` and state `For this UAT, I prefer the phrase quiet lunch for a light lunch`. Use the approved model path only if needed. **Expect:** the statement remains attributed to you; it is not silently installed as a household rule or current source fact.
2. Select **Recipes** and ask a related question such as `What did I call a light lunch?`. **Expect:** any recalled answer is attributed to your statement; lack of evidence is admitted. Record an incorrect confident answer as FAIL, not as learning.
3. In the same active chat, ask a keyword-free follow-up supplied in the test packet. **Expect:** it uses the current dialogue appropriately and does not silently reuse an expired/wrong target for a write.
4. Select **New chat** and ask a related recall question. **Expect:** bounded historical context may be recalled with attribution, while a pronoun like “it” does not authorize an old action. A new write still needs its applicable confirmation.
5. Sign out using the account menu and sign into the second prepared account, then open `/era`. Ask about the first account's unique phrase without supplying it. **Expect:** no disclosure or submission of the first account's private conversation tail. UI evidence alone cannot prove hidden request contents; the prepared privacy fixture/request receipt is required for that part.
6. Open the first account's prepared failed/reported-action conversation and ask about its outcome. **Expect:** failure, uncertainty or reported wrong behavior is not retold as a successfully completed action or used as authority for a new write.
7. In the delayed-response fixture, switch account or choose New chat while a read is pending. **Expect:** the late private result does not appear in the other account/chat, and a pending action cannot dispatch under the changed identity.
8. Type a recurring-reminder request such as `Remind me to UAT stretch every Monday at 9am`. **Expect:** the current supported handoff/refusal preserves recurrence; no ordinary one-time reminder is created and no misleading new date question silently drops the recurrence.

**Reset:** close disposable conversations, restore original sign-in and revoke any explicit test lexicon choice via **Forget that** where applicable. **Limits:** this is attributed, bounded retrieval, not permanent model training. Hidden payload privacy, quota/metering failures and delayed callbacks require isolated evidence; real model quality and account-switch timing are untested here.

## H13 — Provider failures stay honest and diagnosable

**Acceptance:** HUB-98, related truthful/metered failure scope HUB-108. **Type:** tooling/log verification plus owner observation. **Actual:** Pending.

1. Open the handover's replay evidence for [gemini.test.ts](../src/lib/ai/gemini.test.ts). Locate the primary-503 case. **Expect:** one fallback path is exercised and a passing assertion distinguishes it from the primary path. This is an evidence review; do not call a live provider to force an outage.
2. Locate the primary-400 and both-models-500 cases. **Expect:** 400 does not fallback; failure of both models remains an error, not a false rate-limit/success result.
3. Open the delivered [Ask AI proposal source](../src/lib/ai/eraAskProposal.ts) and the delivery's current provider note. **Expect:** the current ERA Ask AI path is identified as Claude; other Gemini routes retain their own fallback policy. Do not apply the old “Ask AI 503 means both Gemini models failed” interpretation to today's Claude path.
4. If an owner-observed real Ask AI failure already exists, open that deployment's server logs and search `[era-ask]` at the recorded time. **Expect:** a bounded actual model-error or unusable-answer reason can be linked to that request, without copying secrets into feedback. If no failure receipt exists, leave this operational observation Pending.
5. Open the corresponding ERA conversation. **Expect:** an honest unavailable/refused reply and no fabricated successful action. Inspect usage evidence separately: unknown/bounded usage remains labelled as such, not presented as a precise zero-cost success.

**Reset:** none — read-only review. **Limits:** hosted-log access and a matching failure receipt must be supplied; no new live outage test, automatic retry or recording refresh is authorized. The broader Claude migration remains HUB-107.

## H14 — Activity filters, source links and household privacy

**Acceptance:** HUB-72. **Type:** feature/privacy/integration. **Data:** installed Activity migration; a prepared activity matrix with public/private transactions, reminder create/complete, public/private/hidden chat, child records from each enabled module, a deleted row and enough events for pagination. Each fixture includes owner/partner expected visibility and creation time. **Actual:** Pending.

1. Open the test site's `/activity-log`. **Expect:** **Activity**, its own header and a chronological timeline. Missing setup produces an explicit setup/error state rather than a convincing empty history.
2. Tap **Activity information**. **Expect:** installed source coverage is visible. Compare it with the supplied enabled-module matrix; a source not installed is a limit, not an empty successful capture.
3. Set **Module** to Budget, **Feature** to the supplied transaction feature and **Person** to the first test account. Set **From** and **Through** to the supplied local date. **Expect:** only authorized matching events in that local-day range; no monetary values or private payloads leak into the log.
4. Open the known public transaction row with **Open**. **Expect:** its existing source page opens. Return and open the supplied reminder event. **Expect:** the reminder opens through `/reminders`, not the old missing `/items` route.
5. Switch to the second test account and repeat the same filters. **Expect:** public eligible events appear; partner-private/draft Budget events are entirely absent, including their titles.
6. Using the supplied before/after privacy fixtures, select their exact dates and source labels. **Expect:** a public-to-private source is no longer visible to the partner; making a previously private source public does not reveal earlier private snapshots; a replacement partner does not inherit a former household's history. These fixtures require current source permissions, not only old screenshots.
7. Set **Module** to Chat, then Kitchen/Shopping as appropriate for the provided chat fixtures. **Expect:** private/hidden messages follow the source thread and message visibility. Repeat the supplied child-record rows for each enabled module; capture and parent privacy must agree with the matrix.
8. Select **Person → System / external** for the supplied system/guest event. **Expect:** its actual system/external attribution and generic guest details, without guest names, message bodies, credentials or public slugs.
9. Clear filters, select a date range containing more than one page and choose **Load more**. **Expect:** older rows append without duplicates; a deleted source retains history without a broken **Open** action.
10. On the phone, use **Install Activity** if the browser offers installation, then open the new Activity icon. **Expect:** Activity launches independently alongside other installed apps. If the browser does not expose this control, record that device's install case BLOCKED and follow its documented browser install flow separately.
11. Return via **ERA home**, select **Artifacts**, then **Household activity →**. **Expect:** the same Activity page is discoverable from ERA. Inspect at 390 px: readable filters, no hidden bottom rows or horizontal overflow.

**Reset:** filters only; no source mutation is required to review prepared fixtures. **Limits:** capturing new real source changes and current DB/RLS/trigger correctness need the supplied owner-controlled setup. A preseeded screenshot alone cannot pass source-capture/privacy-transition cases. History begins when the migration was applied; no historical backfill is promised. Unlink/relink testing belongs in disposable accounts only.

## HUB-105 and HUB-107 — partial implementation, not full delivery acceptance

These IDs have `UAT: pending` but retain engineering/evaluation gates. They are not folded into a blanket completed-deliveries sign-off.

1. Open [HUB-105 criteria](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-105>) and the capability-discovery report supplied with its delivered slice. **Expect:** reviewed executable actions are distinct from unreviewed backend methods; a discovered route does not become callable automatically. H10 covers the delivered consent/dependency behavior only.
2. Read the current-prompt evidence status and the historical Gemini batch/paced receipts linked there. **Expect:** the one-call truncated batch, later paced pass and stale/missing individual replay fingerprints remain distinct; no inferred or fabricated new PASS.
3. Open [HUB-107 criteria](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#hub-107>) and its historical Haiku pass. **Expect:** the ERA-only provider slice and 11/12 result remain explicit, with the unsupported-stock-subtraction miss and remaining non-ERA migration still open.
4. Record **BLOCKED for full-item sign-off** until those engineering/evaluation gates and current deployment evidence are satisfied. **Expect:** no new paid test is started solely to fill a UAT checkbox.

**Actual:** Pending review; full-item acceptance unavailable. **Reset:** none. Historical model approvals are not authorization for another live pass.

## Evidence and remaining handover work

Current UI labels were checked in `EraShell.tsx`, `EraFaceNav.tsx`, `CommandBar.tsx`, `EraCaptureHelper.tsx`, `EraChatToolbar.tsx`, `EraChatDrawer.tsx`, `EraHistorySheet.tsx`, `EraReportCard.tsx`, `EraProposalCard.tsx`, `EraRunCards.tsx`, `HubPage.tsx`, `BulkConvertReviewSheet.tsx`, `MobileExpenseForm.tsx`, `ArtifactsView.tsx` and `ActivityLogClient.tsx`. The source routing and connected module overviews were read before those files. Hub's 11 October evidence cutoff was compared with subsequent scoped commits (`ded3d984`, `31ec4301`, `f47603aa`, `64d02d63`, `c598043b`) and current source; no runtime observation is inferred from git history.

The delivering agent still supplies the exact served build/source hashes, fixture URLs/record links, current migration/flag evidence, safe cleanup paths, adverse-state fixtures and required-versus-optional criterion mapping before marking an attempt's handover Ready. All new manual outcomes remain Pending. Cases needing missing rollout or fixtures are BLOCKED when the owner reaches them, with the missing prerequisite recorded. No item is marked Shipped by this document.

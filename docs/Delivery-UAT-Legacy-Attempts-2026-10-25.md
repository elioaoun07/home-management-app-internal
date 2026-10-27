---
created: 2026-10-25
type: uat
status: draft
owner: Elio
---

# Legacy Delivery attempts — owner walkthroughs

[UAT home](Delivery-UAT.md) · [Delivery Master Book](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md>)

This document accounts for **all 16 retained V1 sessions** observed on 25 October 2026. It supplies readable review steps and current-source regression drafts where completed work exists. It does not restart cancelled sessions or turn historical implementation receipts into new owner acceptance.

**Evidence:** each session's `packet.json`, `state.json` and named artifacts under `.delivery/sessions/`, read without changing them; current source at HEAD `735d3881` plus the existing working tree. A V1 `baseHead` is the starting revision, not a frozen delivered build. Product checks below therefore require the tester to record the actual served build first. Results added by this backfill are **Pending**; availability gates are listed separately.

## Before you begin

1. On the laptop, open the existing **PM Command Center** browser tab. Confirm it is connected to your laptop. If it is unavailable, record **Blocked — PM connection unavailable**; no new Delivery session is needed.
2. Click **Delivery** in the bottom or side navigation, then expand **Earlier deliveries**. Select the attempt named in the table. If several have the same title, compare its session ID.
3. If the list does not expose an old attempt, keep the PM address before `#` and replace the fragment with `#/delivery/session/` followed by its exact session ID. For example: `#/delivery/session/s-20260725-181118-xdl9`.
4. On the opened attempt, use **The story** to read its outcome and **Evidence** to open retained files. These are the current V1 labels; the V2 Plan/Outcome tabs are different.
5. Record results in this document until the proposed sign-off feature is built: scenario ID, **Pass / Fail / Blocked**, what you saw, tester, date, actual build, device and screenshot/file evidence. A historical run state stays unchanged.

On a phone, `/pm/live` may offer **V1 delivery → Open** instead of local V1 detail. Complete the evidence review on the laptop if that link cannot reach it; record phone access as Blocked, not Passed. Product mobile checks below are separate from PM phone access.

## Coverage of every retained attempt

The session ID links to its original local state file. “N/A” means no product candidate from that cancelled attempt is being offered for acceptance; it is not a successful test result. Every cancelled row uses [L1](#l1--review-a-cancelled-attempt), with its row-specific evidence and limits.

| Session / original item | Stored state | Available evidence / build limit | Owner walkthrough |
|---|---|---|---|
| [s-20260712-150339-7kw8](../.delivery/sessions/s-20260712-150339-7kw8/state.json) · Trips D2, recurring payments stay active during a trip | CANCELLED | Scope artifact only; no changed files. D2 survives as a campaign gate, not a current work ID. | L1; product UAT N/A |
| [s-20260712-204625-4qym](../.delivery/sessions/s-20260712-204625-4qym/state.json) · Trips D2 | CANCELLED | No artifacts or changed files. | L1; product UAT N/A |
| [s-20260715-214421-hvfk](../.delivery/sessions/s-20260715-214421-hvfk/state.json) · BUD-11, cache timings | CANCELLED | Plan/build/validation artifacts retained; build stopped at session limit; no recorded changed files. | L1; product UAT N/A |
| [s-20260722-203135-cv12](../.delivery/sessions/s-20260722-203135-cv12/state.json) · BUD-11 | CANCELLED | Baseline validation only; read-only-phase workspace violation. | L1; product UAT N/A |
| [s-20260722-205308-8sgn](../.delivery/sessions/s-20260722-205308-8sgn/state.json) · BUD-11 | CANCELLED | No artifacts or changed files. | L1; product UAT N/A |
| [s-20260722-221533-wous](../.delivery/sessions/s-20260722-221533-wous/state.json) · BUD-11 | CANCELLED | Baseline validation only; read-only-phase workspace violation. | L1; product UAT N/A |
| [s-20260722-225601-whdv](../.delivery/sessions/s-20260722-225601-whdv/state.json) · BUD-11 | CANCELLED | Plan/build/validation retained; build stopped at spending limit; no recorded changed files. | L1; product UAT N/A |
| [s-20260725-151324-23aw](../.delivery/sessions/s-20260725-151324-23aw/state.json) · DLV-28, smoke-test log | CANCELLED | Scope/plan/finish retained; no changed files. | L1; use L2 for the later accepted attempt |
| [s-20260725-154808-p1im](../.delivery/sessions/s-20260725-154808-p1im/state.json) · DLV-28 | CANCELLED | One recorded documentation change; review/UAT artifacts exist, but this attempt was cancelled. | L1; use L2 for the later accepted attempt |
| [s-20260725-181118-xdl9](../.delivery/sessions/s-20260725-181118-xdl9/state.json) · DLV-28 | SHIPPED | Accept event on 25 July, shipped event on 29 July. No deployed-app identity; documentation smoke test. | [L2](#l2--dlv-28-review-the-accepted-smoke-test-record); historical decision preserved |
| [s-20260729-121840-pdhx](../.delivery/sessions/s-20260729-121840-pdhx/state.json) · BUD-14, $20 amount chip | CANCELLED | Discovery process error; no artifacts or changed files. | L1; no candidate from this attempt |
| [s-20260730-104900-9mfu](../.delivery/sessions/s-20260730-104900-9mfu/state.json) · BUD-14 | CANCELLED | Scope/plan/finish; no changed files. | L1; no candidate from this attempt |
| [s-20260801-094951-jx8o](../.delivery/sessions/s-20260801-094951-jx8o/state.json) · BUD-14 | CANCELLED | Mobile form change retained; historical acceptance artifact says 0/3 met. Master Book separately records the feature completed. | L1 + [L3](#l3--bud-14-select-the-20-expense-amount); current-source regression Pending |
| [s-20260806-224840-o8xj](../.delivery/sessions/s-20260806-224840-o8xj/state.json) · DLV-86, forecast units | CANCELLED | Scope/finish only; no changed files. Current DLV-86 remains dependent on DLV-87/88; original aggregate-constant wording is obsolete. | L1; product UAT N/A |
| [s-20260822-093143-t7tm](../.delivery/sessions/s-20260822-093143-t7tm/state.json) · HUB-1, intent fallback | CANCELLED | Ten changed files recorded; acceptance artifact says 6/6 MET. Master Book separately records implementation and same-day follow-up. No owner result inferred. | L1 + [L4](#l4--hub-1-ambiguous-words-do-not-save-the-wrong-action); current-source regression Pending |
| [s3-accept-codex-1783968103139](../.delivery/sessions/s3-accept-codex-1783968103139/state.json) · S3-ACCEPT | CANCELLED | Synthetic fixture; `baseHead=read-only-acceptance`, no candidate/artifacts. | [L5](#l5--identify-the-synthetic-acceptance-fixture); product UAT N/A |

## L1 — Review a cancelled attempt

**Type:** historical evidence review. **Applies to:** each of the fourteen ordinary cancelled rows above, separately. **Prerequisite:** PM can open that exact session. **Data:** its session ID; no app records required. **Actual:** Pending for this documentation review. **Product acceptance:** N/A for the cancelled attempt.

1. Follow **Before you begin** and open the exact session ID from the row. Expect the original campaign/item title and **Cancelled**.
2. Click **The story**. Read **What happened** and any **Handoff**. Expect retained history, which may describe an earlier paused or incomplete phase. An old Handoff must not be treated as the latest runtime state.
3. Click **Evidence**. Open `spec.md` or `plan.md` if the table says it exists. Expect the original requested outcome, not a newly implemented feature. If there are no artifacts, expect **No artifacts recorded yet**.
4. For BUD-11 build attempts, read `validation-report.md` if present; for BUD-14 August 1 and HUB-1, read `acceptance.md`. Expect the recorded results exactly as retained, even when they differ from the terminal status or a later Master Book receipt. Do not change them to Pass.
5. Reload the browser. Expect the same session ID and Cancelled status. Record any missing evidence or mismatch against the exact row, then stop. Starting another delivery is not part of this review.

**Regression:** the two DLV-28 cancelled attempts must remain distinct from the accepted July 25 attempt. Likewise the three BUD-14 attempts must not merge into one “Passed” record.

**Reset:** close the evidence reader and return to Delivery. No source, runtime or household data changes.

## L2 — DLV-28: review the accepted smoke-test record

**Type:** tooling/documentation handover review. **Acceptance:** original packet outcome is a dated real FAST-lane smoke-test log; this is not an expense or reminder feature. **Identity:** `s-20260725-181118-xdl9`; starting HEAD `f6a6b7916089edcebb48fb40005447bed339dfb5`, dirty workspace. **Historical decision:** `accept` at `2026-07-25T15:50:30.545Z`, `shipped` at `2026-07-29T08:50:46.468Z`, retained in [events](../.delivery/sessions/s-20260725-181118-xdl9/events.ndjson). **New review result:** Pending.

1. Open PM → **Delivery** → **Earlier deliveries**, then this exact DLV-28 session. Expect the terminal shipped state, not a running session or a request to approve it again.
2. Click **Evidence** → `spec.md`, then `plan.md`. Expect a documentation task to record the real smoke attempt, including its date, session and outcome.
3. Open `build-log.md`, then `uat/summary.md`. Compare the recorded smoke attempt identity and outcome. A document saying the whole production app was tested would exceed this task's evidence. **Expect:** Both artifacts identify the same smoke attempt and its actual outcome, without claiming a whole-app production test.
4. Open `uat/manual-test-script.md`. The retained script contains only the generic instruction to run the app; it has no actual scenario steps. Record **legacy handover incomplete**. Preserve the historical accept/shipped events; missing instructions do not retroactively erase that owner decision. **Expect:** The script contains only the generic run-app instruction, with original acceptance and shipped events retained.
5. Return to **The story** and read Handoff. The retained `finish/summary.md` still describes the earlier budget pause at UAT_READY. Compare it with the later terminal state rather than treating it as a fresh blocker or restarting the session. **Expect:** Handoff retains the earlier UAT_READY budget-pause summary alongside the later terminal state.
6. Reload. Expect the same session and recorded artifacts. Record whether the history is understandable and whether any document is missing. No new provider run is required.

**Regression/limits:** this walkthrough validates access to historical evidence. It cannot establish the contents of a current deployed feature, replay the original launch or prove the archived campaign index still has the original shape. Any unavailable old index is an evidence gap.

**Reset:** close the reader. No mutation or cleanup required.

## L3 — BUD-14: select the $20 expense amount

**Type:** completed-feature regression; source-drafted, not browser-verified. **Acceptance:** the USD quick amounts include $20 instead of $25, and tapping $20 fills `20`. [Completion receipt](<../ERA Notes/10 - Project Management/Budget/Budget — Master Book.md#shipped-log>). The cancelled August 1 attempt's 0/3 artifact remains historical; this is a new current-build check. **Actual:** Pending.

**Before starting:** use a phone, or a browser approximately 390 px wide; sign in to a test account with an existing USD expense account. Record the actual app address/build and account name. Use a fresh expense form with no existing category/description. No transaction needs to be saved. If the environment cannot identify its build or no USD account exists, mark Blocked and name the missing setup.

1. In the app browser, open `/expense` on the same app address. Expect the expense entry form.
2. If **Account** is shown, tap the prepared USD account. If an account was preselected, tap its **Acct** chip at the top, then choose the USD account. Expect the chosen account name in the top chip.
3. Find the large amount input with `0.00` and the `$` symbol. If your configured form order starts elsewhere, use the back arrow to reach the amount step before choosing a category; stop as Blocked if the prepared form order does not expose that step without submitting. **Expect:** The amount step shows a large 0.00 input and a dollar symbol before submission.
4. Read the small amount buttons beneath the input. Expect **$5, $10, $20, $50, $100**. There should be no $25 button in this USD list.
5. Tap **$20** once. Expect the amount input to show **20** and $20 to become the selected chip. This tap must not submit a transaction.
6. Tap **$10**, then **$20**. Expect the field to replace its previous value with **10**, then **20**; it must not add the values together.
7. Tap the amount field and replace its contents with **12.50**. Expect 12.50 to remain editable. Tap **$20** once more; expect **20**.
8. Clear the amount field before leaving. Reload `/expense`, select the same account if necessary and confirm the USD chip list still includes $20. Record the observed values and a screenshot. **Expect:** The same USD account still offers the $20 chip after reload; no transaction has been submitted.

**Regression:** repeat steps 4–7 at normal phone width without sideways scrolling. If an existing EUR account is available, switching to it should show the corresponding € labels, not force the historical USD label; this currency-aware extension is current behavior, not a BUD-14 failure. No new account is needed for this optional check.

**Reset:** leave the amount empty and close the form. Do not advance through category selection or press the final add button; this scenario creates no spend.

**Source:** [mobile form](../src/components/expense/MobileExpenseForm.tsx) derives `QUICK_AMOUNTS` from [currency denominations](../src/lib/currency.ts), rather than the original hard-coded array. The USD values are still `5, 10, 20, 50, 100`.

## L4 — HUB-1: ambiguous words do not save the wrong action

**Type:** completed safety regression. [Completion and follow-up receipts](<../ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md#shipped-log>). **Former symptom:** “spent 2 hours studying” could draft a money transaction; weak/multi-domain words could choose the wrong module. **Actual:** Pending. Historical 6/6 MET is an engineering artifact, not an owner result.

**Availability:** the current `/era` composer and model fallback have changed since August. A plain clarification is no longer guaranteed: a router miss can invoke Ask AI. Run the app walkthrough only in an owner-started test environment with fake/replay AI and isolated household data, or as a separately owner-started live UAT. This draft authoring session makes no live call. Record the served build, selected Budget view and test conversation first. Without those prerequisites, keep the app scenario Blocked and use the offline check below.

1. Open the app at `/era`. Choose the **Budget** view. If the phone shows a chat launcher, open it to expose **Message ERA**. Start a fresh conversation using **New chat** so an earlier reminder or transaction is not the context for this test. **Expect:** A fresh Budget conversation shows Message ERA without earlier conversation context.
2. Tap **Message ERA**, type **spent 2 hours studying**, and use **Send**. Expect no transaction success, money draft, debit or transfer. The reply may clarify or hand off to the configured assistant; it must not turn “2 hours” into an amount.
3. If a confirmation card appears, read its fields without confirming it. A proposed financial action for this sentence is a failed observation; capture the card and stop. A model-generated suggestion is not evidence the deterministic router accepted it. **Expect:** No financial action is proposed; an unexpected proposal is recorded as a failure without confirming it.
4. Start another **New chat**, then type **spent** and send. Expect no completed money action and no confident action based solely on this weak word. Record the actual clarification/fallback rather than matching one historical sentence.
5. Start another **New chat**. Type **remind me to buy dinner ingredients** in **Message ERA**. Stop before supplying the remaining values or submitting a complete reminder. This covers the same-day strong-intent-over-keyword follow-up. **Expect:** the current native composer follows the reminder path and asks for the missing date/time, rather than proposing a recipe or money action.
6. Clear the unsent text. Reopen the test conversation and compare the responses with your observations. Record any unexpected draft/artifact and its ID; do not confirm it merely to complete the test. **Expect:** The test messages and responses remain visible, and any unexpected draft or artifact is recorded with its ID.

**Offline criterion review:** in the repository terminal, run `pnpm exec vitest run src/features/era/intents/rootIntentRouter.test.ts`. Expect a nonzero passing test count and no failed cases, including the named “spent 2 hours studying” and weak-money-word regressions. Record command output/build separately as automated evidence. It proves routing assertions, not the phone experience or model behavior. No recording refresh or live provider call is needed.

**Reset:** clear unsent text and leave all proposed writes unconfirmed. Keep the isolated conversation as evidence; if the scenario unexpectedly created a source record, record its identity and use that source's existing Undo in the test environment. Do not remove unrelated history.

**Source and limits:** [router fixture](../src/features/era/intents/rootIntentRouter.test.ts), [turn entry point](../src/features/era/useEraTurn.ts), [composer](../src/components/era/CommandBar.tsx). Later native capture may intercept the reminder before the old router; phone behavior does not replace the offline router criterion. Voice, household sharing, actual reminders and live AI interpretation are outside this historical slice.

## L5 — Identify the synthetic acceptance fixture

**Type:** inventory review. **Item:** S3-ACCEPT, `s3-accept-codex-1783968103139`. **Product UAT:** N/A — synthetic read-only acceptance fixture, no delivered feature. **Review result:** Pending.

1. Open its exact V1 session using the route in **Before you begin**. Expect the S3 provider-neutral analysis title and Cancelled status.
2. Click **Evidence**. Expect no candidate/product handover; the local packet identifies an acceptance fixture and `baseHead` is `read-only-acceptance`.
3. Record that this is excluded from product sign-off. Return to Delivery. It must not become a new implementation item solely because no owner product test exists. **Expect:** Delivery reopens and this synthetic harness smoke remains excluded from product sign-off.

**Reset:** none; review only.

## Evidence limits and result form

No browser walkthrough, physical-phone pass, deployment or automated test was run while drafting this file. Current source labels were inspected; historical artifacts and states were inventoried read-only. V1 scripts for DLV-28 and HUB-1 had empty scenario content, now explicitly covered above. BUD-14 and HUB-1 shipped-log receipts coexist with cancelled session states; neither record has been rewritten to force agreement.

Use one entry per attempt/scenario: `Session / scenario | Pass, Fail or Blocked | step | actual observation | tester | date | served build | device | evidence`. For a failure, include what you expected and what happened; the proposed feedback importer will eventually turn eligible submitted failures into linked work, but it is not implemented by this document.

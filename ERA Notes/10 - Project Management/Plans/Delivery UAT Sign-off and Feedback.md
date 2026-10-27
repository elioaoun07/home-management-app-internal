---
created: 2026-10-25
updated: 2026-10-25
type: specification
status: ready-for-implementation-planning
owner: Elio
evidence_cutoff: 2026-10-25; HEAD 735d3881 plus current working tree; local source review only
---

# Delivery UAT wizard, sign-off and feedback

Every delivery must give the owner a usable, step-by-step test wizard. The owner tests the delivered version, records feedback, and explicitly signs it off. A successful sign-off makes that delivery **Shipped**. Submitted **Needs changes** feedback becomes a linked defect or work item on the next `pnpm pm` startup, ready for the normal prioritization and delivery process.

This is the separate build specification requested on 25 October 2026. It extends [Delivery Manual UAT](<Delivery Manual UAT.md>) and the existing [candidate handover requirement](../../../docs/Delivery-UAT.md#candidate-handover-template). It specifies proposed runtime behavior; none of it is declared implemented by this document. Delivery owns the handover and acceptance contract; PM Tooling owns the wizard, canonical work-item import and projections. Allocate bounded follow-up IDs in their existing Master Books/checklists before implementation. R74/R75 remain completed within their recorded scope. This document is not another task queue.

**Implementation status (2026-10-25):** the four §8 slices are built as code under [DLV-145](<../Delivery/Delivery — Master Book.md#dlv-145>), [R76](<../PM Tooling/PM Tooling — Master Book.md#r76>), [R77](<../PM Tooling/PM Tooling — Master Book.md#r77>) and [R78](<../PM Tooling/PM Tooling — Master Book.md#r78>); offline tests and an isolated desktop Chrome pass only, owner UAT pending. Not built, registered separately: worker-emitted handovers and supervisor capture ([DLV-146](<../Delivery/Delivery — Master Book.md#dlv-146>)); the phone relay, Work/Sprints/Analytics labels and Ship-action gating ([R79](<../PM Tooling/PM Tooling — Master Book.md#r79>)). Departures from this text: a **Draft** accepts no results until **Mark ready** binds it (run candidate, or the checkout's HEAD plus a changed-files digest for a direct delivery); undo after import records the withdrawal for the owner rather than removing generated text; direct deliveries are not auto-staled when the checkout moves.

## 1. The owner journey

1. Open PM Command Center and select **Delivery**.
2. Find the delivered item in **Needs you**, labelled **Test**. The row names the item and attempt date so repeated deliveries are distinguishable.
3. Open the item, select **Outcome**, then **Test steps**. Read the short setup card: where to open the delivered build, which account/device to use, and the exact sample data needed.
4. Select **Start test**. Follow one numbered action at a time. Each action includes what should appear after it; **Back** and **Next** retain progress. **All steps** offers a printable/scannable view of the same content.
5. For each scenario, record **Pass**, **Fail** or **Blocked**. A failed or blocked scenario asks for one short feedback field; screenshots/evidence links are optional. **Save** keeps a partially completed test.
6. Once all required scenarios pass, select **Sign off**. The delivery becomes **Shipped**, with the owner, date and tested build attached.
7. If something fails, select **Needs changes**, enter what happened, and **Submit**. The receipt immediately shows **Feedback saved**. After the next `pnpm pm` startup imports it, the receipt shows the linked work ID and **Open work**.
8. When that work is delivered, return to the new attempt's **Test steps**, repeat the failed case and relevant regression cases, then sign off the new version. Prior results and feedback remain accessible.

The setup and steps do not presume knowledge of module names, hidden buttons or navigation. Instructions begin at an address or a named app entry point and explain each intervening screen. The wizard is a reading/recording surface: opening it never launches a session, applies a candidate, calls an AI provider or changes application data.

## 2. What counts as a wizard scenario

Draft scenarios alongside acceptance before implementation. Finalize their actual routes, button labels and expected values from the delivered candidate before inviting owner UAT. Draft wording for an unbuilt feature is visibly **Draft**; it cannot be presented as instructions for the current build.

Each scenario contains:

| Field | Required content |
|---|---|
| Identity | Stable scenario ID, title, original work ID and acceptance criterion references. |
| Purpose | Feature, defect reproduction, regression, edge case or tooling/document review. |
| Setup | Exact build URL/entry point, device/browser, role, sign-in state, fixtures and any owner-only prerequisite. |
| Starting state | The screen and records that must exist before step 1; concrete sample values. |
| Steps | Ordered `{ action, expected }` pairs. One understandable action per step; visible result, not “works correctly”. |
| Defect context | Original trigger and former symptom, then the corrected expectation. Do not reinstall a broken version. |
| Coverage | Required/optional designation tied to acceptance, adjacent regression and failure/retry cases when relevant. |
| Cleanup | Exact Undo/delete/reset instructions for isolated fixtures, or “None — read-only”. |
| Limits | What cannot be tested, why, and the evidence or setup needed. |

Use concrete visible labels, including an accessible label/location for an icon-only action. Explain how to find the test record and what to do if it is absent. Include save/reload/reopen when persistence is part of acceptance. A command-line/tooling item gets a real review or fixture-verification procedure, not invented app clicks. Put lengthy technical context behind a disclosure; shipped UI labels remain short under Hard Rule 28.

**Illustration only — the owner's transaction-linking example is not a claim that these controls exist today.** Before shipping this particular feature, its delivering agent must replace this draft with labels and routes verified against its candidate:

**Scenario:** Link two existing transactions. **Data:** isolated test transactions named `UAT Hotel` and `UAT Taxi`; note their amounts and account balances first. **Result:** Pending.

1. Open the supplied test-build address and sign in with the supplied test account. **Expect:** the app home screen appears.
2. Open **Expense**, then **Activities**. **Expect:** the transaction list appears.
3. Select the transaction search field, enter `UAT Hotel`, and open the matching row. **Expect:** its details show the recorded amount and account.
4. Select **Link transactions**. **Expect:** a transaction picker opens.
5. Search for `UAT Taxi` and select it. **Expect:** that transaction appears in the selected list once.
6. Select **Save**. **Expect:** the hotel details show the taxi as a linked transaction.
7. Close the details, refresh Activities, search for `UAT Hotel` and reopen it. **Expect:** the same link remains, without duplication.
8. Open the linked taxi. **Expect:** its original amount/account remain unchanged and the hotel relationship is visible as specified by the accepted design.
9. Return to the recorded balances. **Expect:** creating the relationship has not changed either balance or transaction amount.
10. Use the delivered unlink action to remove the test relationship, then reopen both records. **Expect:** the relationship is gone and both original transactions remain. If no unlink/Undo action exists in the delivered design, mark cleanup blocked and report that gap instead of inventing a control.

The delivering agent adds the design's duplicate-link, invalid-selection, household visibility and cancellation cases where those are acceptance obligations. A generic instruction such as “test transaction linking” is incomplete.

## 3. Separate implementation, availability and owner acceptance

The current [PM conventions](<../_Conventions.md#3-master-books-and-sources-of-truth>) deliberately make Work **Done** mean completed implementation, not owner acceptance. Preserve that fact and its historical records. Add the acceptance projection below; do not put an owner-only UAT task back into the Deliver queue or treat an unchecked manual test as unfinished engineering.

| Dimension | States and meaning |
|---|---|
| Implementation | Existing planned/in-progress/complete/failed/cancelled facts remain authoritative. |
| Automated verification | Existing protected-check results; never converted to manual PASS. |
| Handover | Missing, draft, ready, incomplete or stale. Ready requires valid coverage and trusted candidate binding. |
| Availability | Available in the named environment, awaiting Apply/deployment/setup, rolled back, or unknown. Local Apply alone does not prove hosted availability. |
| Scenario result | Pending, PASS, FAIL or BLOCKED, always for a specific handover/build. |
| Delivery acceptance | Pending, in progress, needs changes, blocked, accepted or superseded. |
| Shipping projection | **Shipped** only for a valid explicit owner sign-off of the available version. Otherwise show the current engineering outcome plus its UAT state. |

**Sign-off gate:** every required scenario has a current PASS; required acceptance criteria have coverage; the candidate/build and handover are current; the named test environment contains that version; no required setup/Apply/deployment obligation is outstanding; the authenticated owner explicitly selects **Sign off**. Merely completing steps, saving comments, receiving a green automated check, pressing Apply, or allowing another delivery is insufficient. Optional cases can remain untested with disclosed limits. A required case cannot be made optional by the tester to bypass a failure; changing acceptance requires a recorded scope revision and refreshed handover.

Unresolved submitted **Needs changes** feedback for that version also blocks sign-off, including feedback saved but not yet imported on startup. Before signing, the owner must withdraw the feedback, accept a verified resolution on the appropriate retested version, or explicitly disposition a new request as separate follow-up work with a retained reason. That disposition cannot waive a failed required criterion. New Needs changes feedback against an already accepted current version moves its current acceptance projection to needs changes while preserving the earlier sign-off receipt; a report bound only to an older version does not silently revoke acceptance of a newer version.

Cancelled/failed attempts without a delivered testable candidate display **No candidate** and their actual outcome. They remain in history and can receive feedback, but are not presented as successful features awaiting sign-off. Documentation/investigation deliveries use explicit artifact-review scenarios and owner acceptance; absence of an application screen does not waive acceptance. An incomplete handover is a delivery defect to repair, not a request that the owner write the test script.

Historical Shipped Logs are retained as dated engineering receipts. Existing owner acceptance can be carried forward only with its original evidence and exact applicable version; otherwise label **UAT unrecorded**. Do not reset existing PASS/FAIL/BLOCKED results, silently accept old items, or create retrospective defects solely because a result is missing. Update user-facing **Ship** actions and metrics consistently so engineering archive operations cannot bypass the new sign-off gate. Keep the exact `## Shipped Log` parser heading until a separately reviewed migration changes it; document its historical meaning.

## 4. Versioned evidence and authority

Use one canonical UAT record linked to the existing delivery artifacts/runtime store. Both the wizard and Drive consume that record. Do not create a second Markdown task database or independent UAT implementation queue.

The trusted handover envelope binds installation, campaign/canonical work identity, acceptance revision, run/session or direct-delivery identity, candidate ID/generation/digest, Result and approved-plan revisions, handover revision/content digest, and relevant application/integrated-source identity. Direct deliveries without a run bind an exact source revision plus changed-file hashes and a unique delivery reference. Record tested environment/build and deployment evidence separately; do not infer those from the candidate hash.

The worker supplies scenario content during its existing implementation/repair/revision job. The supervisor validates bounds, schema, coverage and artifact integrity, supplies trusted identities, freezes the content, and exposes completeness. It recovers retained output after interruption without another model call. Missing/malformed output becomes **Handover incomplete**. Protected verification may retain its truthful green result, but the delivery cannot become Shipped or appear ready for owner testing. A replacement candidate or material acceptance/scenario change creates a new bound handover and relevant retest requirement; old receipts remain historical.

Owner observations are append-only receipts with a stable command ID, scenario/handover IDs, actor from authenticated authorization, observation timestamp, server receipt timestamp, device/browser, build/environment, result, feedback/evidence references and any superseded receipt. Step progress is a draft, never an acceptance receipt. Store time in UTC and display owner dates in Asia/Beirut; never trust a caller-supplied actor or future timestamp as authority. Required fields have bounded lengths/counts and server validation.

Only the authorized PM owner can sign off, retract sign-off or submit final outcomes. Existing paired desktop/phone authority and CSRF protections apply; household membership alone does not grant PM acceptance rights. Steward/AI may read and relay scenarios and recorded results, but cannot manufacture PASS, sign off, waive cases or interpret a comment as acceptance. Static `/pm` and the Drive mirror remain read-only.

An owner correction/Undo appends a superseding receipt and restores the appropriate pending/needs-changes state; it never deletes the audit trail. Failed UAT is not cleared by the existing **Proceed anyway** control for the laptop test gate. That control remains a separate authorization to continue Delivery, with its current restrictions, and never becomes Shipped.

## 5. Feedback becomes normal work on the next `pnpm pm`

**Needs changes + Submit** saves actionable feedback for import. A plain **Comment** is informational; pending/unstarted tests create nothing. **Blocked** records the missing condition. If that condition is a software defect, the owner can submit **Needs changes** for it; a missing deployment, account or owner-only setup remains an owner obligation instead of fake engineering work.

The feedback form needs the observation and a short choice: **Bug** (default for a failed existing criterion) or **Change** (a newly requested outcome). It pre-fills the failed scenario, exact step and expected result. Keep optional screenshots/links and fuller reproduction context behind **Details**. If the owner cannot identify the failure beyond a comment, preserve the comment and create a bounded investigation with that uncertainty; never invent a root cause or acceptance requirement.

Persist a feedback thread ID and revision, original wording, owner, delivery/candidate/build identity, affected scenarios/steps, expected versus actual, classification and import status. Edits append revisions. Importing another revision updates the same linked work item's evidence; it does not allocate another ID.

On each `pnpm pm` startup, after the canonical corpus and runtime store are available, run a bounded deterministic reconciliation:

1. Read submitted, unwithdrawn feedback whose Undo window has ended. Include older unprocessed records; do not rely on a rolling date or latest-50 list. Imported records are skipped except for unapplied amendments.
2. Resolve the original canonical item and owning campaign. Default the defect to that campaign; preserve cross-module links. An unresolved identity is retained as **Import blocked**, with a repair reason, not silently routed to Hub & ERA.
3. Check stable source markers and the import journal. Reuse a work item already linked to this feedback thread. Similar wording alone is not sufficient to merge unrelated reports; owner-directed merges preserve every source link.
4. Allocate one unused campaign ID, checking active and historical IDs/aliases. Create a normal unchecked work item in the existing campaign checklist, and its acceptance/evidence section in the matching Master Book. For a bug also create the severity-led Pain Inventory record. Default new feedback to **Next** for prioritization; an explicit owner-selected urgency may place it in **Now**. Never make every failed UAT a blocker.
5. Include `Kind`, original item/attempt links, stable `Source: UAT feedback <id>` marker, exact scenario/step, preserved owner comment, expected/actual result, build/device/date and a testable fix-and-retest outcome. A scope-changing request is `Kind: feature`; uncertain evidence is `Kind: investigation`. Leave unsupported source paths/dependencies unknown for normal triage.
6. Commit the checklist, Master Book, source mapping and import status as one recoverable logical operation. Only then expose **Open work** and the new ID on the delivery receipt. If an operation is interrupted, recover that same ID and missing writes before processing another attempt.
7. Refresh the shared PM corpus, delivery UAT projection, relevant sprint/analytics views and normal publication scheduling. A successful import is work creation only: it never starts an agent job, grants a budget, applies code or marks a defect fixed.

Reuse the existing corpus grammar, Markdown escaping/secret withholding, guarded writes, undo journal and compatible cross-process serialization. The existing ERA-report importer is an integration precedent, not proof of atomic multi-file writes. Protect UAT import against another PM process, monthly archive, manual edits and other ID allocators. Journal the intended ID and file witnesses before mutation, revalidate before commit, and retain before/after hashes. On conflict, keep feedback pending and show the cause. Recover a crash after either file write or after both files but before receipt update without losing feedback, duplicating a checkbox, reusing an ID or overwriting unrelated edits.

Keep imported, merged, cancelled and withdrawn source mappings durable so startup never resurrects an intentionally removed item. Undo before import withdraws feedback. Undo after import removes only unchanged generated content via existing guards; if the item was edited or dispatched, retain it and record the withdrawal for owner resolution. An explicit new regression after a prior defect was closed is a new feedback thread and normal new work, linked to its predecessor.

The importer uses local UAT evidence; it does not require production database access. Phone feedback uses the existing authenticated relay and command identity. Any additional relay schema needed must be delivered as an owner-run migration with schema pairing; agents never apply it. No model is required to import, classify the explicit choice, allocate IDs or render the wizard.

## 6. Desktop, phone and Steward behavior

Extend R75's existing **Needs you / In progress / Waiting / In focus / Earlier deliveries** grouping. Keep pending owner UAT visible once per attempt, including CLOSED/verified/applied engineering runs. Do not hide a known pending sign-off when queue loading fails; retain the last confirmed data labelled stale/unavailable. Awaiting deployment remains visible with its real prerequisite instead of a working **Start test** action. History needs attempt dates and pagination beyond 50 without losing selected filters or test progress.

Use the same UAT read model on desktop and `/pm/live`. At 390 px, show a clear step number, action, expectation and reachable controls without horizontal scrolling. Back navigation and reopening resume the same scenario/version. Keyboard operation, focus order, screen-reader labels and reduced motion must work. Feedback has **Saving**, **Saved**, **Pending sync** and a retryable error state; a timeout never says saved/failed without a receipt. Retain local draft text across reload, and recover the same command before retrying. Server revision conflicts require a refresh/review rather than last-write-wins acceptance. A changed candidate makes an old draft visibly stale.

R74's one-way Drive publication adds the canonical handover, completeness, UAT status, feedback-to-work links, attempt/build identity and evidence time. Retain handover documents independently of the rolling recent-run summary. Published links must resolve in Drive or open the correct Command Center attempt, not require a local `C:` path. If publication fails, local acceptance remains authoritative and the mirror reports stale/unavailable. Drive edits and Steward Proposals do not sign off or become imported feedback automatically. Steward may explain existing steps and report missing/stale handovers without an extra coding-agent session.

## 7. Existing source seams and important differences

Evidence was reviewed on 25 October against HEAD `735d3881` plus uncommitted changes. The Delivery book's dated October 19 evidence and subsequent scoped git history (`f2f127b1`, `51b1fa7e`, `4d1fa2a8`, `12ddc3a1`, `735d3881`) were inspected alongside current source; dates in book frontmatter were not treated as runtime certification. Preserve concurrent working-tree changes when implementing.

| Current evidence | Implementation seam / consequence |
|---|---|
| [OutcomeReview.tsx](../../../scripts/pm/app/OutcomeReview.tsx), lines 31–125, currently renders verdict, links, artifacts and token facts. | Add **Test steps** and acceptance summary here; no existing wizard is implied. Use the shared Delivery review model and transports. |
| [interaction.mjs](../../../scripts/delivery-v2/interaction.mjs), lines 363–428, implementation/repair/revision instructions do not require structured manual scenarios. | Extend those existing outputs and their artifact import/recovery; keep supervisor identity/validation in the existing journey/store path. |
| [test-gate.mjs](../../../scripts/delivery-v2/test-gate.mjs), lines 10–98, stores passed/failed/proceed for the newest written application and caps retained records at 50. [TestGate.tsx](../../../scripts/pm/app/TestGate.tsx) renders **Tests after Apply**. | This is a laptop test/launch gate, not per-delivery user acceptance. Reuse authenticated recording patterns, but do not overwrite it or use its truncating record file as the complete UAT history. |
| [Run.tsx](../../../scripts/pm/app/Run.tsx) and [bridge.mjs](../../../scripts/pm/bridge.mjs) retain V1 UAT/acceptance paths. | Adapt retained V1 records without fabricating V2 identities or erasing their observed results. A shared projection must preserve the original lifecycle semantics. |
| [era-issues.mjs](../../../scripts/pm/era-issues.mjs), lines 177–225 and 302–331, creates source-marked campaign work with a local journal; writes checklist then book then journal. [pm-server.mjs](../../../scripts/pm-server.mjs) invokes synchronization on startup. | Follow the deterministic importer pattern and shared write infrastructure, but add explicit crash/concurrency recovery for the new multi-file UAT operation. Ordinary Idea Inbox triage is documented separately; this verified startup hook is for ERA reports. |
| [drive-publish.mjs](../../../scripts/pm/drive-publish.mjs), lines 134–225, publishes bounded run status without manual scenarios/results. | Extend the read-only allowlist/projection and retained handover publication; keep one-way authority and stale handling. |
| [R75](<../PM Tooling/PM Tooling — Master Book.md#r75>) and [R74](<../PM Tooling/PM Tooling — Master Book.md#r74>) record current delivery grouping and Drive publishing. | Allocate follow-up scope, not duplicate or reopen their shipped outcomes. |

## 8. Bounded build sequence

Allocate the following outcomes under existing campaigns, with one owner per outcome and explicit dependencies. These are scope boundaries for the parallel implementation job, not independent task checkboxes or a model-selection plan.

| Slice | Owner | Completion condition |
|---|---|---|
| Canonical handover and owner receipts | Delivery | Versioned schema, candidate/acceptance binding, output validation/recovery, authenticated append-only results, explicit sign-off gate and historical/direct-delivery compatibility. |
| Wizard and delivery visibility | PM Tooling | Shared desktop/phone wizard, resumable drafts, Needs you classification, build prerequisites, comments and Sign off; depends on the canonical contract. |
| Feedback reconciliation into work | PM Tooling | Startup importer, stable feedback source mapping, canonical campaign routing, recoverable guarded writes/ID allocation, clear import outcome and no automatic execution. |
| Publication and lifecycle consistency | PM Tooling | Drive handovers, static/read-only projection, Work/Sprints/Analytics labels and archive compatibility distinguish engineering Done from accepted Shipped. |

Keep each slice's exact `Touches`, acceptance, dependencies and verification in its allocated Master Book section. Split a slice further if its executable scope exceeds one bounded implementation. Before code changes, follow the required add-feature/UI/API/cache playbooks and read schema only if schema work is actually needed. Update the PM Feature Map/Atlas and conventions in the same implementation session when navigation or lifecycle contracts change.

## 9. Acceptance and verification contract

Use offline fixtures and temporary copied PM corpora. No provider calls, production writes, real launch/Apply, account reconfiguration or deployment is needed for these engineering checks.

| Case | Required observation |
|---|---|
| Complete delivery | Existing job produces a validated, candidate-bound handover; every required criterion maps to usable steps; manual results begin Pending. |
| Missing/invalid content | Missing, malformed, oversized, empty, duplicate-ID, missing-expectation and omitted-criterion inputs show Handover incomplete and cannot sign off; no extra provider dispatch. |
| Identity and recovery | Tampered artifact, changed acceptance/candidate/build or interrupted completion never inherits a prior PASS; recovery retains one handover for the same valid output. |
| Owner acceptance | Authenticated owner can save progress/results and explicitly sign off only the matching available version; missing/Pending/FAIL/BLOCKED required cases refuse acceptance. |
| Unresolved rejection | Submitted Needs changes blocks sign-off even before import and even when scenario results are PASS; withdrawal/resolution/explicit separate-follow-up disposition is recorded, cannot waive required failure, and preserves earlier version receipts. |
| Authority boundaries | Steward, anonymous/static clients, forged actors and stale revisions cannot sign off; Apply, green checks and test-gate Proceed never imply acceptance. |
| Partial/legacy/direct work | Cancelled/no-candidate, historical V1, direct source delivery, unrecorded legacy UAT and docs-only review each show truthful states without invented runs/results. |
| Feedback import | One Needs changes thread creates one correctly owned work ID, book section and bug pain record where applicable, with verbatim sanitized feedback and reverse links. Informational comments/unstarted UAT create no work. |
| Duplicate/revision behavior | Repeated startup, double submit, lost reply, amended feedback, archived/deleted/merged targets and source-journal recovery never duplicate or resurrect work. |
| Interruption and concurrent edits | Crashes at every write boundary, two PM processes, archive/import races and changed file witnesses preserve unrelated text and reconcile to one complete item or a visible blocked import. |
| Retest and correction | Failed-case fix creates a fresh candidate-bound test; old failure remains linked. Sign-off retraction/Undo preserves history and reopens the acceptance state without silently deleting edited/dispatched work. |
| Layout and navigation | Desktop and 390 px: identical steps/status, accessible controls, preserved filter/progress, no horizontal overflow; required detail remains readable. |
| Offline and stale data | Draft survives reload; pending command recovers the same receipt; stale queue/publication never hides known UAT or claims success. |
| Projection and retention | Local, phone, Work/Sprints/Analytics and Drive agree by identity/version; >50 older pending attempts/handovers remain reachable; Drive remains read-only. |

After deterministic checks, an owner completes one isolated end-to-end example: open the actual delivered test build, follow the wizard, submit a controlled failure, restart PM to observe one linked defect, follow its corrected delivery, then sign off. Record actual device/build/date and results. If actual phone, deployment or an external integration is unavailable, record Pending/BLOCKED for that part; a 390 px browser proves layout only. This document records no test execution or owner acceptance.

## 10. Handoff and retirement

The parallel implementation job can start from this specification, allocating its canonical IDs first and linking them here. Scenario backfill is separately authored as UAT content; it does not imply this runtime feature exists. Retain the original manual-UAT plan as the rationale until its surviving requirements are incorporated into these IDs and the canonical UAT contract. After implementation and actual owner sign-off, archive superseded planning prose under the normal PM conventions; preserve current schema/workflow rules and all observed results.

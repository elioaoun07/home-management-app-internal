# ERA interaction design review

Research date: **2026-11-06** (Asia/Beirut). Analyzed commit: **`9cd4166691edd9367ea1bd9a604e0bec13ffe870`**, branch `main`.

This is a standalone, documentation-only product design review. It proposes six complete flows without changing the application. The central recommendation is to let a person **save what they know, leave immediately, and return without reconstructing context**. Classification, conversation, and planning should earn their place after capture.

## Read this package

| Document | Responsibility |
| --- | --- |
| [Interaction principles](INTERACTION-PRINCIPLES.md) | Shared language, state semantics, inputs, correction, accessibility, and decision rules |
| [Capture and retrieval flows](CAPTURE-AND-RETRIEVAL-FLOWS.md) | Six end-to-end flows, current evidence, friction, interactions, screen boundaries, and failure handling |
| [Home and navigation](HOME-AND-NAVIGATION.md) | A smaller shell, attention ordering, continuation, and controls to consolidate or remove |
| [Acceptance scenarios](ACCEPTANCE-SCENARIOS.md) | Concrete proposed behavior, cross-device checks, consistency review, and priorities |

## Evidence discipline and limits

- **Implemented** means a behavior is present in the inspected source at this commit. It does **not** mean production deployment or runtime correctness was verified.
- **Documented intent** means repository guidance describes the desired model. It is not proof of implementation.
- **Proposal** means a design decision in this package; none is implemented by this task.
- **Unknown / validation needed** means the repository cannot establish the answer, or the relevant behavior was not exercised.
- **Friction hypothesis** is an inference from the structure or interaction contract, not an observed user finding.

Method: followed the Feature Map, read module overviews and Design Doctrine, traced mounted navigation, composers, forms, drafts, history, attention controls, and recovery code. Source searches were read-only. Existing untracked `03-life-journeys/`, `16-product-research/`, and `RemainingTASKS.MD` were present before this task and were left untouched; they are not evidence of behavior in the analyzed commit.

No browser session, app render, device test, interview, database inspection, or paid API call was performed. No screenshots were visually reviewed. The checked screenshot locations (`public/atlas/screenshots` and image files under `docs`) supplied no application screenshots; the Atlas directory contains naming instructions [E21](#e21). Comments in older docs about past screenshots are not visual evidence for this review. Spacing, contrast, actual header crowding, keyboard occlusion, gesture conflicts, screen-reader output, and perceived speed all require validation.

Scope covers the cross-cutting shell; the Hub, ERA, Sync and Activity junctions; and relevant Transactions, Drafts, Items, and Dashboard standalone surfaces. This is a task-oriented sample, not a claim to have inspected every module or every CRUD path. Acceptance scenarios are **future criteria**, not a test-pass report.

## Main findings

| Finding | Evidence-backed observation | Design implication / hypothesis |
| --- | --- | --- |
| Capture asks for structure unevenly | Notes accept a line; Brain asks for label/value; native expense capture requires account, category, amount, description [E03](#e03), [E05](#e05), [E06](#e06) | A neutral save could avoid decisions that the person cannot yet make |
| Home has multiple meanings | Authenticated `/` redirects to `/dashboard`; a standalone header Home links to `/expense`; `/era` has its own views [E01](#e01), [E02](#e02) | One semantic Home destination would reduce route knowledge |
| Finding depends on remembering the container | Hub list search checks title/latest message; thread search runs after action hiding; ERA History groups conversations [E07](#e07), [E13](#e13) | Retrieval should cross containers and expose its coverage |
| Unfinished work is split across concepts | Expense drafts, schedule drafts, volatile form text, and gated execution runs differ [E08](#e08)–[E14](#e14) | One Continue entry should project these states without replacing their source stores |
| Attention is not identical to unread | Planner overdue, notifications, drafts, and execution progress have distinct meanings [E10](#e10), [E14](#e14), [E17](#e17), [E18](#e18) | Rank actionable facts; do not sum every badge into urgency |
| Recovery already has useful foundations | Handoff guards, artifact links, uncertain run states, and timeout distinctions exist [E14](#e14), [E20](#e20), [E24](#e24), [E25](#e25) | Extend these contracts instead of adding another assistant or retry system |

## Source evidence index

Paths link to repository files; `:line` labels identify the inspected evidence. Line anchors are for the analyzed snapshot and can drift after later changes.

### E01

**Implemented — entry and navigation.** [src/app/page.tsx:13](../../../src/app/page.tsx#L13) redirects authenticated users to `/dashboard`. [ConditionalHeader.tsx:170](../../../src/components/layouts/ConditionalHeader.tsx#L170) renders title plus role; its Home link targets `/expense` at line 185. [MobileNav.tsx:48](../../../src/components/layouts/MobileNav.tsx#L48) defines Activity and Plan; lines 116–140 suppress this shell on many standalone routes, including `/era`, `/chat`, `/dashboard`, and `/reminders`. Lines 162–170 send expense and reminder FAB choices to `/expense`, with different active tabs. These controls are not all mounted together.

### E02

**Implemented — alternate ERA shell.** [EraFaceNav.tsx:91](../../../src/components/era/EraFaceNav.tsx#L91) gates navigation on awake state; lines 107–143 provide ERA, Budget, Schedule, Recipes, Brain, Artifacts. [EraShell.tsx:451](../../../src/components/era/EraShell.tsx#L451) uses a desktop conversation panel and mobile drawer, with floating cards when the mobile drawer is closed. [TabContainer.tsx:146](../../../src/components/layouts/TabContainer.tsx#L146) selects a separate web container or mobile tab content.

### E03

**Implemented — native capture requirements.** [capture.ts:35](../../../src/features/era/capture.ts#L35) defines schedule fields and the capture union: expense needs account, positive amount, category, description, and date; shopping needs a list and items. [CommandBar.tsx:259](../../../src/components/era/CommandBar.tsx#L259) refuses a detected capture lacking a validated payload; its Send disabled condition appears near line 528. A parser suggestion is therefore consequential to the path to submission.

### E04

**Implemented — composer correction and keyboard behavior.** [CommandBar.tsx:142](../../../src/components/era/CommandBar.tsx#L142) stores cleared text for Undo. Lines 228–243 clear on submit and restore when `keepInput` is returned. Lines 415–445 handle Tab/Right completion, Escape helper dismissal, Enter submission for most kinds, and Ctrl/Cmd+Enter for shopping. Lines 490–540 expose voice reply, Ask AI, and Send controls. Completion can consume Tab when the caret is at the end.

### E05

**Implemented — raw notes within a chosen thread.** [HubPage.tsx:3110](../../../src/components/hub/HubPage.tsx#L3110) mounts NotesListView for a notes thread; lines 2399–2408 send content and optional topic. [NotesListView.tsx:76](../../../src/components/hub/NotesListView.tsx#L76) accepts a nonempty line on Enter and immediately clears the input. Lines 187–224 manage chapters/page navigation; lines 614–628 submit under the active topic. The notebook empty text is at lines 958–969. Thread creation exposes conversation name and purpose [HubPage.tsx:4896](../../../src/components/hub/HubPage.tsx#L4896).

### E06

**Implemented — Brain memory is structured.** [BrainDashboard.tsx:26](../../../src/components/era/dashboards/BrainDashboard.tsx#L26) requires label and value to save; its catch at line 42 supplies no inline error. Lines 109–127 render both inputs. [intents/brain.ts:4](../../../src/features/era/intents/brain.ts#L4) recognizes structured save phrases; lines 66–94 can save label/value or switch to Brain. This is not evidence of a general freeform thought inbox.

### E07

**Implemented — retrieval boundaries.** [HubPage.tsx:574](../../../src/components/hub/HubPage.tsx#L574) searches thread title and latest-message content. Lines 1756–1759 default to hiding messages with actions; lines 2237–2259 apply that filter before thread text search and color filtering. [NotesListView.tsx:478](../../../src/components/hub/NotesListView.tsx#L478) filters note content locally. [WebDashboard.tsx:649](../../../src/components/web/WebDashboard.tsx#L649) searches transaction descriptions within its existing filtered data; line 1512 labels it “Search descriptions…”. No reviewed surface establishes a universal cross-module record search.

### E08

**Implemented — expense drafts.** [api/drafts/route.ts:19](../../../src/app/api/drafts/route.ts#L19) reads the owner's `transactions` where `is_draft=true`; lines 81–99 require account and amount for creation and permit a null category. **Documented drift:** [Drafts/Overview.md:19](<../../../ERA Notes/02 - Standalone Modules/Drafts/Overview.md#L19>) describes `transaction_drafts` and delete/insert confirmation. Use the inspected API for this review, not that older table description. No database state was verified.

### E09

**Implemented — draft review and correction.** [DraftsDrawer.tsx:77](../../../src/components/expense/DraftsDrawer.tsx#L77) opens local edit fields; lines 101–119 require amount/category and show a success toast. [useDrafts.ts:302](../../../src/features/drafts/useDrafts.ts#L302) also shows success with Undo, whose operation deletes the confirmed transaction. This is a duplicate success-feedback path and does not promise restoration of the previous editable draft.

### E10

**Implemented / documented distinction — schedule drafts.** [DraftRemindersDrawer.tsx:59](../../../src/components/items/DraftRemindersDrawer.tsx#L59) confirms by changing status to pending and provides a reversal to draft; line 139 labels the separate drawer. [Drafts/Overview.md:21](<../../../ERA Notes/02 - Standalone Modules/Drafts/Overview.md#L21>) documents that schedule drafts are excluded by default and suppress alerts. Runtime notification behavior was not exercised.

### E11

**Implemented — partial form state.** [ExpenseFormContext.tsx:50](../../../src/components/expense/ExpenseFormContext.tsx#L50) holds amount, account, category, description, step, and date in React state. [MobileReminderForm.tsx:286](../../../src/components/reminder/MobileReminderForm.tsx#L286) similarly holds parsed input and fields locally. [useEraStore.ts:123](../../../src/features/era/useEraStore.ts#L123) initializes transcript, pending questions, and proposal in a Zustand store without persistence middleware. This does not guarantee recovery after reload. [TabContainer.tsx:162](../../../src/components/layouts/TabContainer.tsx#L162) hides rather than unmounts its mobile tab bodies, so some tab switches can retain state during the session.

### E12

**Implemented — precision form asymmetry.** [MobileReminderForm.tsx:669](../../../src/components/reminder/MobileReminderForm.tsx#L669) requires title, requires start/end date/time for events, and permits an undated reminder; date-only reminder input becomes noon at lines 731–734. It resets after awaited success and shows a generic failure at lines 770–773. [MobileExpenseForm.tsx:873](../../../src/components/expense/MobileExpenseForm.tsx#L873) gates posting on amount/account/category, with debtor name conditional; lines 930–943 clear fields before the request completes. This source does not establish universal automatic incomplete-form draft saving.

### E13

**Implemented — conversation resumption.** [EraHistorySheet.tsx:60](../../../src/components/era/EraHistorySheet.tsx#L60) groups history by recency; lines 70–77 preview another conversation before Continue. Lines 150–160 distinguish retry and empty. [useEraConversation.ts:124](../../../src/features/era/useEraConversation.ts#L124) stores a best-effort per-device New chat marker; lines 285 onward resume a conversation. [useHubPersistence.ts:131](../../../src/features/hub/useHubPersistence.ts#L131) persists active Hub view/thread, not proof of persistence of every unsent field.

### E14

**Implemented, gated — saved execution.** [execution/state.ts:14](../../../src/features/era/execution/state.ts#L14) enables durable runs only when `NEXT_PUBLIC_ERA_DURABLE_EXECUTION` equals `true`. [EraRunCards.tsx:119](../../../src/components/era/EraRunCards.tsx#L119) shows load failure and progress; lines 197–214 provide Confirm, Resume, Recover, Stop, Skip, and Retry read by state. Deployment flag and migration readiness are unknown here; do not promise durable plans for every user.

### E15

**Implemented — AI proposal review.** [EraProposalCard.tsx:74](../../../src/components/era/EraProposalCard.tsx#L74) displays action previews and optional Request detail; lines 98–145 distinguish Open from Confirm and offer Dismiss. Lines 40–48 support an explicit Always preference for some native choices.

### E16

**Implemented — dismissal is not reversal.** [useEraAskAI.ts:719](../../../src/features/era/useEraAskAI.ts#L719) cancels unfinished durable work while retaining committed facts; without a durable run it clears the active proposal. Failure reports “Couldn't dismiss. Refresh and resume.” No universal Undo-dismiss is established by this path.

### E17

**Implemented — attention in Schedule.** [reminders/page.tsx:73](../../../src/app/reminders/page.tsx#L73) defines Focus, Chores, Assign; lines 255–300 offer Plan my day and an overdue toggle/count. [WebDayPlanner.tsx:573](../../../src/components/planner/WebDayPlanner.tsx#L573) excludes chores; lines 710–770 filter ownership and active states, expand daily occurrences, and compute a 30-day overdue window. A separate undated-item pool is selected at lines 809 onward. This is not a complete all-time obligation list.

### E18

**Implemented — notification semantics.** [NotificationModal.tsx:80](../../../src/components/notifications/NotificationModal.tsx#L80) requests up to 20 notifications, includes read, excludes actioned, and configures read-info auto-archive. Lines 342–361 archive informational notices, dismiss actionable notices, navigate to `/alerts`, and mark read independently. [NotificationBell.tsx:30](../../../src/components/notifications/NotificationBell.tsx#L30) displays unread count. Unread therefore cannot safely mean “things you must do”.

### E19

**Implemented — activity is a trace.** [ActivityLogClient.tsx:70](../../../src/app/activity-log/ActivityLogClient.tsx#L70) defaults to a seven-day date range and offers module/feature/actor filters. Lines 342–371 distinguish invalid dates, error, pending, and empty. [artifacts.ts:1](../../../src/lib/era/artifacts.ts#L1) explains assistant-write traces and a shared entity/deep-link registry. Activity, Artifacts, and a task list have different scopes.

### E20

**Implemented — latency is not offline.** [safeFetch.ts:14](../../../src/lib/safeFetch.ts#L14) sets an eight-second default and distinguishes offline errors from request timeouts; lines 32–35 explicitly reject enqueueing on timeout alone. Calling code owns queuing; the wrapper is not proof that every write works offline.

### E21

**Available artifact instructions, not screenshots.** [public/atlas/screenshots/README.md:1](../../../public/atlas/screenshots/README.md#L1) explains mobile/desktop filenames and missing-image placeholders. No pixels were inspected in this task.

### E22

**Documented intent.** [Hub Chat/Overview.md:21](<../../../ERA Notes/03 - Junction Modules/Hub Chat/Overview.md#L21>) positions Hub as daily input and module pages as precision tools. [Design Doctrine.md:19](<../../../ERA Notes/01 - Architecture/Design Doctrine.md#L19>) prioritizes low capture cost and trustworthy foresight; its Ten Questions cover household rights, offline, Undo, exactly-once execution, and AI review. These guide proposals rather than certify shipped behavior.

### E23

**Documented guidance.** [Common Patterns.md:24](<../../../ERA Notes/01 - Architecture/Common Patterns.md#L24>) describes optimistic rollback; section 3 requires fresh ID-based detail state. This is desired engineering discipline, not evidence every current component conforms.

### E24

**Implemented — handoff safeguards.** [useEraHandoff.ts:4](../../../src/features/era/useEraHandoff.ts#L4) describes owner-bound, expired, and consumed states and draft cleanup after save. [MobileExpenseForm.tsx:306](../../../src/components/expense/MobileExpenseForm.tsx#L306) guards against overwriting existing edits before applying a handoff. These are foundations to reuse; this review did not prove exactly-once execution across every failure boundary.

### E25

**Implemented — source links.** [artifacts.ts:49](../../../src/lib/era/artifacts.ts#L49) defines entity links and optional inverses; lines 60–65 route deleted records to Recycle Bin and Hub records to their thread. [WebDayPlanner.tsx:555](../../../src/components/planner/WebDayPlanner.tsx#L555) loads a deep-linked item by ID even outside visible day sections.

### E26

**Implemented — conversation can invoke AI.** [useEraTurn.ts:365](../../../src/features/era/useEraTurn.ts#L365) may escalate a router miss for a language gap, agent plan, or recent dialogue, excluding negated writes. [CommandBar.tsx:268](../../../src/components/era/CommandBar.tsx#L268) separately exposes manual Ask AI. [useEraTurn.ts:571](../../../src/features/era/useEraTurn.ts#L571) shares an in-flight lock and reports uncertain outcomes on outer failure. A raw thought sent here is not equivalent to an explicitly saved note.

### E27

**Implemented — mobile accommodation, not visual proof.** [EraShell.tsx:94](../../../src/components/era/EraShell.tsx#L94) measures `visualViewport` for keyboard changes. [CommandBar.tsx:113](../../../src/components/era/CommandBar.tsx#L113) measures composer height and grows the textarea. [EraFaceNav.tsx:80](../../../src/components/era/EraFaceNav.tsx#L80) scrolls active pills into view. Actual touch, zoom, screen-reader, and device-keyboard behavior remains unverified.

## Prioritized direction

1. **P0 — Protect interruption and trust:** retain input, distinguish saved/queued/uncertain, consolidate success feedback, and make correction reachable beyond a toast.
2. **P1 — Make capture and return cheap:** neutral Save, common Find, and one Continue entry over existing source state. Start with the reviewed record types; disclose incomplete search coverage.
3. **P2 — Reduce navigation and attention noise:** one Home meaning, fewer header controls, factual attention ordering, and reversible recommendation dismissal.

The detailed sequence, tradeoffs, validation gates, and final consistency review are in [Acceptance scenarios](ACCEPTANCE-SCENARIOS.md#prioritized-recommendations). No recommendation is marked shipped.

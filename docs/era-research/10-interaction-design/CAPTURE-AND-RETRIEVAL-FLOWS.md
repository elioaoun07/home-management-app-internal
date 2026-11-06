# Six interaction flows

Baseline: [commit, method, and evidence](README.md). **Implemented** describes inspected source; **intent** describes repository guidance; **friction** is a hypothesis; **proposal** describes future behavior; **unknown** needs validation. The shared state/input contract is in [Interaction principles](INTERACTION-PRINCIPLES.md). Screen names below describe responsibilities, not commitments to add new routes.

## F1. Capture an unstructured thought

**Goal:** “Keep this before I forget it.” Example: “Maybe a quieter birthday dinner, ask Maya.” Successful capture does not require a plan, reminder, memory fact, conversation, or household announcement.

### Today and friction

**Implemented:** A Hub notes thread accepts a nonempty line and optional active chapter; Enter submits and clears its input. Notes are backed by Hub messages [E05](README.md#e05). Reaching or creating that container can involve choosing a thread, conversation name, purpose, and privacy. Brain's manual form requires label/value, and its native save patterns expect structured phrasing [E06](README.md#e06). ERA command input follows parsing/conversation rather than guaranteeing a raw note save; some misses escalate to AI [E26](README.md#e26).

**Intent:** Hub is the primary daily input surface, with precision forms for detailed work [E22](README.md#e22).

**Friction hypothesis:** remembering which kind of “note” the app expects, choosing a notebook, or waiting for interpretation can cost more attention than the thought itself. The page-flip/chapter model introduces navigation state before it proves useful. This is not an observed complaint or a measured latency result.

### Proposed interaction

1. Open Capture from Home or a persistent capture entry. Existing focused editors retain their own actions; do not overlay a second input on them.
2. Type or dictate the thought. The composer starts private and shows **Only me**. No title, chapter, category, date, or classification question appears.
3. Tap **Save**. Retain original wording and creation time. Optional display title derives from the first line and remains editable.
4. After acknowledgement, show a compact row/receipt with **Saved**, **Open**, and Undo. The person can leave immediately. No mandatory assistant reply follows.
5. On reopening, offer **Edit**, **Make reminder**, and contextual conversion under More. Converted records retain a link to the original thought. The raw thought remains findable without becoming a task to clear.

**Essential:** nonempty text and app-established owner. **Optional:** title, attachment where already supported, related item, classification, date, household sharing, conversion. Sharing is explicit and never inferred from the last household conversation. Voice permission is requested only after choosing voice; denied voice leaves typing usable.

**Screen responsibilities:** Capture owns raw input, privacy, local retention, and save receipt. Record detail owns editing and optional conversion. Source reminder/expense editor owns all structured validation. Find owns retrieval. Neither Capture nor Home owns category administration or a notebook setup wizard.

### Failure, empty, and correction

| Condition | Proposed response / concise copy |
| --- | --- |
| Blank input | Disable Save; placeholder **Keep a thought…**; no empty record |
| First use | Input is the empty state; no introductory banner |
| Offline, local write succeeded | **Kept on this device**; sync indicator; no claim of cloud save |
| Local storage unavailable | Keep visible text; **Couldn't keep this** with **Copy** and **Retry**; do not clear |
| Server refuses save | Keep local text and error on that row; **Couldn't save** / **Retry** |
| Response lost after sending | **Check save**; reconcile by capture identity before retrying; no duplicate note |
| Dictation unavailable | **Type instead**; preserve any transcript already captured |

Undo of a successful save returns the text to the editor and removes only that saved capture when safe. Edit remains after the toast expires. An acknowledged deletion supports source restoration; it must not remove a separately committed linked reminder. A double tap creates one identity, not two notes.

**Context variants:** desktop can retain a compact capture field beside recent records; mobile uses a single keyboard-aware sheet and reachable Save. Keyboard uses Ctrl/Cmd+Enter, with Enter preserving multiline text. In a five-second interruption, typing plus one Save is sufficient; optional conversion stays out of the path.

**Acceptance anchors:** [F1-A–D](ACCEPTANCE-SCENARIOS.md#f1-capture-a-thought). **Unknown:** whether users expect personal versus household default, whether one personal capture container can reuse Hub notes cleanly, and whether dictation transcription is acceptable for this content. Those need user and technical validation before implementation; this review does not choose a new database table.

## F2. Record quickly without premature classification

**Goal:** “Keep a fact now; I can complete it later.” Example: “Coffee 4, paid cash” when currency/account/category is not yet certain. This differs from F1 because a structured action may follow, but ambiguity must not block the initial save.

### Today and friction

**Implemented:** `/api/drafts` can create an expense draft with account and amount, permitting no category, but cannot accept arbitrary text alone [E08](README.md#e08). Draft review requires amount/category to confirm [E09](README.md#e09). Native expense capture additionally requires description and category [E03](README.md#e03). The precision expense form gates posting on amount/account/category, has optional split/debt/receipt paths, and clears fields before completion [E12](README.md#e12). An undated title-only reminder is allowed in the mobile precision form, while events require dates/times [E12](README.md#e12).

**Intent:** incomplete everyday input should be cheap to retain, and structured pages should serve precision [E22](README.md#e22). Documentation about universal incomplete-form draft saving is not established by the inspected form; the older draft table description also differs from the API [E08](README.md#e08).

**Friction hypothesis:** “quick” may still demand accounting decisions or route through a conversation. Different required fields across entry paths make it unclear whether a missing category means nothing was saved, a draft exists, or money was posted.

### Proposed interaction

1. Save “Coffee 4, paid cash” through the same neutral Capture. The receipt says **Saved**, with no money icon implying a posting and no account balance change.
2. On that receipt or later detail, choose **Record expense**. Pre-fill only supported facts. Mark uncertain values as suggestions, not accepted choices. “4” remains currency-ambiguous until resolved.
3. Open a compact source review: amount, currency/account, category, date. Ask one missing essential at a time. Defaults are visible and editable; no AI conversation is required to select them.
4. Either **Record** or leave. Leaving retains a linked draft/partial conversion in Continue; the original capture remains a saved record. Creating a draft never pretends to post money.
5. On confirmed source success, show **Recorded** plus **Open** and Undo. Link capture and transaction; the conversion disappears from Continue. Do not display two independent unfinished copies.

**Essential for initial save:** raw text only. **Essential for posting:** positive amount, currency-consistent account, category and effective date under today's source contract. **Optional:** merchant description, subcategory, receipt, trip, split/debt mode. Keep advanced fields behind Details. A stated currency cannot be replaced with the account's currency silently. Classification may be inferred for preview but requires the same review as other financial values.

For “Call the garage” the same saved record can become an untimed reminder without invented dates. A timed reminder must resolve timing explicitly. A request for a recurring action opens the existing recurrence editor; this flow introduces no new recurrence parser or engine.

**Screen responsibilities:** Capture saves the original; conversion review shows consequences; source form owns posting, currency/date validation and optional detail; Continue shows only unfinished conversion; source detail owns later correction.

### Failure, empty, and correction

- Empty conversion fields preserve the raw capture. Copy: **Amount**, **Account**, **Category**, **Not yet**. Do not create a fake category or zero-value posting.
- No eligible account: **No account** → **Add account** or **Not yet**. Returning from account setup restores the review; raw capture is already safe.
- Known validation refusal: focus the field and preserve all others. Example: **Choose a USD account**. No success receipt.
- Offline: raw capture can be retained locally; structured posting queues only if that source supports a safe operation identity. Otherwise **Kept on this device** and **Record when online**. Never invent universal offline posting support [E20](README.md#e20).
- Lost write response: **Check transaction**; preserve review and identity, suppress automatic resubmission until reconciled.

Undo after posting reverses the linked financial operation through the source and restores the editable conversion where safe. This is a proposal beyond the current delete-only draft-confirmation inverse [E09](README.md#e09). Before posting, changing account clears/revalidates dependent category choices. After posting, correction opens the actual transaction; it does not create another one from the raw text.

**Context variants:** desktop can show original text next to compact review; mobile shows one column and Details as one sheet. Keyboard can reach every required selector and Record without pointer use. Short interruption ends at raw Save; completing classification is never required to leave.

**Acceptance anchors:** [F2-A–D](ACCEPTANCE-SCENARIOS.md#f2-record-without-classifying). **Unknown:** appetite for category-free *posted* transactions is a separate money-model decision, explicitly outside this proposal. Validate whether the short review is faster than the current familiar grid before replacing that grid.

## F3. Find and reopen an old item

**Goal:** “Find the thing about the garage; I don't remember whether I wrote a note, reminder, or chat.” Success is opening the original item, not receiving a plausible AI summary.

### Today and friction

**Implemented:** Hub thread-list search checks titles and latest messages. Thread search is applied after messages with actions are hidden by default; color adds another filter. Notes have local content search. The web transaction view searches descriptions in its filtered data [E07](README.md#e07). ERA History groups past conversations and opens preview/Continue [E13](README.md#e13). Activity Log filters a date-bounded trace; artifact links and direct item-ID loading offer useful reopening foundations [E19](README.md#e19), [E25](README.md#e25).

**Friction hypothesis:** a user can search the right words in the wrong scope and conclude the record is gone. Converting a message can hide it from the default thread search. Opening an entire chat to resume work is unnecessary when the real target is its transaction or reminder.

### Proposed interaction

1. Open **Find** from any ordinary app surface. Empty query shows recent records and a separate recent-search list; neither requires an AI request.
2. Type “garage”. Search the allowed source records across captures, notes/messages, items, transaction descriptions, and structured memories in the initial scope. Search conversations as conversations, with matching snippets; do not mix their titles with entity results without labels.
3. Results show title/snippet, type, date, and personal/household attribution. Exact text matches precede approximate suggestions. Optional filters narrow after initial results. Completed/converted records remain findable; default source-list filters must not silently exclude them.
4. Single click/tap opens the original detail by source identity. A converted capture shows its linked record; do not make the user replay chat. Back restores query, filters, result position, and focus.
5. If the person chooses **Continue chat**, explicitly resume that conversation instead of confusing it with reopening a record. No write occurs merely by viewing a result.

**Essential:** query or selection of a recent result. **Optional:** type/module, person, date range, completed/archived/deleted scope. Deleted records appear only with **Include deleted**, route to recovery, and never silently recreate themselves. No module or date is required before the first search.

**Screen responsibilities:** Find owns query, coverage, filtering and navigation state. Source detail owns current content/actions/permissions. History owns conversation lifecycle. Activity remains evidence of past actions, not the universal search database. Search must recheck current rights, including cached snippets, before rendering private content.

### Failure, empty, and correction

| Condition | Proposed response |
| --- | --- |
| No query | Recent records; **Find anything…** |
| No matches with filters | **No matches** / **Clear filters**; preserve query |
| No matches without filters | **No matches**; optional **Include archived**; no unsolicited capture creation |
| Some sources failed | Keep results; **Some results unavailable** / **Retry**; identify unavailable source in details |
| Offline/cache only | **On this device** with last refresh in detail; do not claim exhaustive results |
| Deleted target | **Deleted** / **Open bin** where authorized |
| Missing or newly private target | **Unavailable**; remove stale private snippet; return to results without revealing the owner or content |

Find needs no Undo because it is read-only. Editing/deleting/restoring a result uses the source inverse; a failed edit retains the edit draft. Clearing a filter is not data deletion. Do not imply that clearing search history deletes records.

**Context variants:** desktop may use a result/detail split; mobile uses full-screen detail with predictable Back. Proposed Ctrl/Cmd+K opens Find outside editors; arrows choose, Enter opens, Escape returns focus. A short interruption can end after opening a result; reopening Find retains the last query during the session without marking the record done.

**Acceptance anchors:** [F3-A–E](ACCEPTANCE-SCENARIOS.md#f3-find-and-reopen). **Unknown:** cross-source indexing, exhaustive pagination, permission-aware caching, ranking quality, and household query vocabulary need technical/user validation. A first release must name its covered sources; it cannot label partial results “everything”.

## F4. Understand what actually needs attention

**Goal:** “I have thirty seconds. What needs me?” Successful orientation identifies a useful next action without asking the person to maintain another dashboard.

### Today and friction

**Implemented:** Reminders offers Focus, Chores, Assign, planning, completed controls and an overdue count/toggle. The planner separates chores, ownership, dated occurrences and undated items, with a 30-day overdue lookback [E17](README.md#e17). Notifications distinguish unread, archived and dismissed; the modal has a bounded list and `/alerts` destination [E18](README.md#e18). Draft and execution work live elsewhere [E09](README.md#e09), [E10](README.md#e10), [E14](README.md#e14).

**Intent:** ERA should return foresight for captured facts, protect trust, and avoid unnecessary UI text [E22](README.md#e22).

**Friction hypothesis:** unread counts, overdue items, unfinished captures and suggestions can look like competing obligations. Requiring a manually curated daily plan before the app is useful adds another task. “Nothing today” is misleading if the actual problem is a source-load failure or a hidden scope.

### Proposed interaction

1. Home opens a compact **Needs attention** section derived from existing source state. No setup or daily review checklist is required.
2. Order known facts: (a) uncertain consequential saves requiring checking; (b) explicit deadlines/appointments and actionable overdue items relevant to this person; (c) waiting decisions the person initiated. Within deadlines, use effective time, not the AI's unsupported urgency score.
3. Show up to three initial rows, plus **View all**. Each row has one short basis (“Due 15:00”, “Check payment”, “Your approval”) and one primary action. Remaining work is accessible; it is not silently discarded or declared low importance.
4. A separate **Continue** entry exposes interrupted work. Saved thoughts are not tasks. AI suggestions appear after factual attention and never outrank an actual deadline. Informational unread notifications remain in their bell/history.
5. Open detail, complete, postpone, or review. Reconcile the relevant source and remove/update all representations of that same actionable occurrence. No second completion checkbox in Home with its own state.

**Essential:** none to view. Action-specific inputs only: a new date for postponement, explicit occurrence/series scope when needed, or approval after preview. **Optional:** person filter, source filter, existing full day planner. Planning is opt-in; no daily prioritization, mood score, widget sorting, or “inbox zero” routine.

**Screen responsibilities:** Home summarizes and links; source list/detail owns exact actions and occurrence rules; notification center owns delivery/read state; Continue owns resumption; AI reason detail explains a suggestion. Home neither invents due dates nor mutates records on load.

### Failure, empty, and correction

- Fully loaded with no relevant facts: **Nothing due now**. Continue and Find remain accessible; no celebratory demand to clear the rest of the app.
- Source missing/stale: **Schedule unavailable** / **Retry**; show known rows with freshness context. Never show global “All clear”. Old data must not authorize a financial retry.
- Many overdue items: group by source/time and expose **View all**. Preserve old obligations outside the current planner lookback in source history or explicitly disclose the window; do not assume a 30-day calculation is exhaustive.
- Household ambiguity: default to the person's actionable work; label household/partner items and permissions. Unassigned household obligations need an explicit visibility policy, not a silent exclusion.
- Failed complete/postpone: retain the row and attempted values; mark pending versus confirmed correctly. Copy **Couldn't update** / **Retry** only when safe.

Undo restores the exact occurrence/status/date. Dismissing a notification never completes its task. Hiding a recommendation never deletes its source. Removing a row due to filtering is not an action on the record.

**Context variants:** desktop gives the same ranked list alongside capture; mobile presents the first action without horizontal scanning. Keyboard follows row → action → detail order; no hover-only reasons. In a short visit, the user can see one next commitment and leave without acknowledging every row.

**Acceptance anchors:** [F4-A–D](ACCEPTANCE-SCENARIOS.md#f4-understand-attention). **Unknown:** ordering usefulness, acceptable row limit, urgent-event policies, and actual cron/push liveness need user/runtime evidence. Do not infer a live proactive system merely from available route code.

## F5. Resume interrupted work

**Goal:** “Where was I?” Example: a half-edited expense, unsent thought, a reminder conversion missing a date, or an AI plan stopped after one committed step.

### Today and friction

**Implemented:** expense and reminder draft drawers are separate. Expense edits and reminder input use React state; ERA pending transcript/questions/proposals are transient store fields [E09](README.md#e09)–[E11](README.md#e11). Some mobile tab bodies remain mounted, preserving in-session state [E11](README.md#e11). Hub persists view/thread; ERA History resumes saved conversations and a device marker preserves New chat semantics [E13](README.md#e13). Durable execution offers state-specific progress/recovery controls behind an environment flag [E14](README.md#e14). Handoff refuses expired/consumed proposals and protects existing edits [E24](README.md#e24).

**Friction hypothesis:** restoring the right screen is not the same as restoring the unsent work. A user can be inside the correct conversation yet have lost the sentence or draft fields. Multiple draft drawers conceal unfinished work from someone who does not remember its module.

### Proposed interaction

1. Retain nonempty editor content automatically as owner-bound unfinished work. A successful local checkpoint supports **Kept on this device**. The source-specific draft or durable run remains authoritative where it exists.
2. Home exposes one **Continue · 2** entry, counting unique work identities rather than every linked representation. Opening it shows plain rows: “Coffee 4 — Account missing”, “Birthday thought — Unsent”, “Move appointments — 1 of 3 done”. These are proposed examples, not existing labels.
3. Select a row to reopen its exact editor, source record or saved execution state. Restore original content and deliberate choices; focus the next missing input. Do not replay the command or execute anything on opening.
4. Revalidate changed accounts, recipients, dates, permissions and proposal targets. Keep the person's values visible when invalid; ask only for the affected field. For relative dates, show the resolved date and original capture time; never silently turn yesterday's “tomorrow” into tomorrow again.
5. Finish, **Keep**, or **Discard**. Finishing removes the continuation only after confirmed source success. Discard affects unfinished work only and offers Undo. A previously committed step remains a committed source fact.

**Essential:** choose retained work; no new title/category or summary. **Optional:** sort/filter by type, review history, copy text, discard. Empty unsent editors are not retained rows. Merely saving a raw thought does not make a continuation. Device-only entries are marked; another device sees only synchronized work.

**Screen responsibilities:** Continue aggregates identities/states and routes back. Original editor owns fields and checkpoints. Execution journal owns completed steps and consent. Source detail owns verification of uncertain writes. History owns conversation selection. None becomes a second task list.

### Failure, empty, and correction

| Condition | Proposed response |
| --- | --- |
| No unfinished work | **Nothing to continue**; Capture and Find remain available |
| Local retention failed | Keep text visible; **Couldn't keep this** / **Copy**; do not promise reload recovery |
| Another device/source changed | **Changed since then** / **Review changes**; preserve local edits as a recoverable branch until resolved |
| Removed account or lost access | **Choose account** or **Unavailable**; no cross-owner reuse of retained data |
| Run state unavailable | **Couldn't load progress** / **Retry**; no blind reconstruction from assistant prose |
| Uncertain write | **Check app** → exact source; do not offer an unconditional write Retry |
| Durable feature unavailable | Show only independently retained text/source drafts; do not promise resumable committed steps |

Discard Undo restores the same unsent text/fields and source link. Undoing a completed write is a separate source action. Closing a sheet, pressing Back, or starting a new capture does not discard previous work. Global sign-out/account switching hides the prior owner's retained content; retention/deletion policy requires explicit implementation review.

**Context variants:** desktop may resume beside the originating list; mobile opens one editor with Back to Continue. Keyboard can select the row, edit, and save without reconstructing navigation. After a short interruption or reload, no duplicate records appear and the user can tell whether the work was merely kept, queued, committed, or uncertain.

**Acceptance anchors:** [F5-A–E](ACCEPTANCE-SCENARIOS.md#f5-resume-interrupted-work). **Unknown:** browser-kill durability, local-storage limits, conflict resolution, owner scoping of all legacy caches, and deployed durable-run support. A web app cannot promise recovery of keystrokes never persisted before process termination.

## F6. Act on or dismiss an AI recommendation

**Goal:** “Understand this suggestion, choose, and move on.” Example: ERA proposes moving a reminder to tomorrow. The person should not need another conversational exchange to accept, adjust, defer, or dismiss.

### Today and friction

**Implemented:** proposal cards display effective action previews with Confirm/Dismiss; handoffs use Open. Some native cards offer Always. Durable runs show completed/remaining steps and recovery actions when enabled [E14](README.md#e14), [E15](README.md#e15). Dismiss cancels unfinished durable work but preserves committed facts; otherwise it clears the proposal [E16](README.md#e16). Artifact links provide source reopening [E25](README.md#e25).

**Intent:** AI proposes, the person confirms, and source operations enforce correctness [E22](README.md#e22).

**Friction hypothesis:** generic Confirm hides which action is being authorized, Dismiss can be mistaken for Undo, and ephemeral cards can disappear without an obvious recovery path. Explaining a suggestion through a fresh chat may cost more than reviewing a small source preview. This is not evidence that current action previews are absent.

### Proposed interaction

1. Present a compact recommendation adjacent to its relevant source or factual attention row. Show actual target, before/after change, effective date/time, assignee/privacy where consequential, and **Why** as optional detail. One card per source change; no duplicate card in every dashboard.
2. Primary action names the effect: **Move reminder**, **Record expense**, or **Open form**. **Adjust** opens the existing source editor with proposed values. It does not require arguing with the model.
3. Secondary **Dismiss** hides this suggestion without changing the underlying item. **Later** appears only if deferred suggestions are demonstrably useful; it is not required to launch this flow. Dismiss needs no reason and does not train a permanent preference.
4. On accept, revalidate effective targets/rights and apply the reviewed change through the existing source capability. While submitting, prevent duplicate confirmation. If the source has materially changed, show the changed preview and require fresh consent.
5. Acknowledge the actual result with one receipt, source Open, and a source-correct Undo where available. For multi-step work, show completed and remaining effects. Stop cancels only the latter. For dismissal, offer **Dismissed · Undo** and a short-lived recent-dismissal recovery entry accessible from recommendation history.

**Essential:** explicit consent to current, concrete effects; any missing source-required input. **Optional:** Why, Adjust, source detail, deferred time, explicit future preference. Accepting once must never imply Always. A long natural-language rationale is not required. A read-only advice card has **Open** or **Dismiss**, never a mutation-like Confirm.

**Screen responsibilities:** recommendation card owns concise explanation and choice. Source preview/editor owns precise parameters. Source capability owns write and result. Continue owns an accepted-but-interrupted run; recommendation history owns dismissed-suggestion recovery. Conversation preserves context but is not the transaction ledger or the only place actions can be found.

### Failure, empty, and correction

- No recommendation: render no placeholder requiring maintenance. Do not fabricate tips to fill space.
- AI unavailable/rate-limited: **AI unavailable**; **Open form** remains available. A previously saved thought is unaffected; no repeated automatic calls on page open.
- Evidence expired or target changed: **Changed since suggested** → updated preview; no execution based on stale consent.
- Save definitely refused: retain the card and edits; short source-specific error, safe Retry only when no write occurred.
- Result uncertain: **Check result** linked to source; do not claim success or automatically repeat. Progress must retain any known committed steps.
- Dismiss failure: retain the card as **Couldn't dismiss** / **Retry**. Do not silently remove it locally while pretending a durable dismissal exists.

Undo accept reverses only verified reversible effects. Nonreversible/externally delivered effects must be disclosed before consent and offer a correction path afterward, never a fake universal Undo. Undo dismiss restores the same still-valid suggestion without accepting it. If stale, restore it as needing review. Re-showing a dismissed recommendation requires meaningful source change, not a new visit or rephrased AI text.

**Context variants:** desktop card may sit beside source detail; mobile presents preview above reachable actions in a sheet, without requiring scrolling a long chat to find Confirm. Keyboard reaches Why/Adjust/primary/Dismiss predictably and returns focus after resolution. A short interruption can end with Dismiss; acceptance can be deferred without losing source context.

**Acceptance anchors:** [F6-A–E](ACCEPTANCE-SCENARIOS.md#f6-act-on-or-dismiss-a-recommendation). **Unknown:** deployed recommendation generation/expiry, demand for Later, usefulness of explicit Always rules, safe inverse coverage, and ranking against real obligations. Validate with replayed examples before changing proactive delivery.

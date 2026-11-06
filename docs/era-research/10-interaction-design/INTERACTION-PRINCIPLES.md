# Interaction principles

Baseline, scope, evidence labels, and commit: [README](README.md). Everything specified below is a **proposal** unless explicitly labeled otherwise. This is an interaction contract, not a storage schema or implementation plan.

## 1. Capture is complete before classification

A thought is valid without a title, folder, category, due date, recipient, or AI interpretation. Save the original text first. Optional “Make reminder” or “Record expense” comes afterward and must not replace the original without an explicit user action. An unclassified capture can remain a useful record indefinitely; it is not a backlog the person must clear.

**Implemented:** Notes already accept a line inside a chosen thread, while native capture and Brain impose different structured requirements [E03](README.md#e03), [E05](README.md#e05), [E06](README.md#e06). Extend the existing raw-note concept and reuse source operations. Do not create a competing memory store, assistant, or offline engine.

## 2. Separate Save, Ask, Review, and commitment

Use one capture surface with **Save** as its primary action. A secondary **Ask ERA** submits a question/request to the assistant. Saving never invokes inference or waits for a reply. On reopening a saved capture, optional conversion actions can open the existing structured editor. This keeps a thought such as “maybe cancel the gym” from becoming an executed instruction.

Existing intentional command and precision-form paths remain shortcuts. A recognized command can offer a compact action preview; the person can always save the raw text instead. Do not remove the current manual Ask AI escape hatch: its placement can be simplified, but it remains available within the Ask path. AI money/schedule proposals continue to require review [E15](README.md#e15), [E22](README.md#e22).

**Friction hypothesis:** conversation is valuable when it resolves uncertainty, but it makes “keep this sentence” harder if it asks for a date, requests a category, produces a long acknowledgment, or escalates to a model [E03](README.md#e03), [E26](README.md#e26).

## 3. Give every state a different promise

These are semantic distinctions, not six extra navigation tabs.

| State | User-facing meaning | Where it belongs | What it must never imply |
| --- | --- | --- | --- |
| Unsent work | Text/fields retained automatically; no source action | Continue → original editor | A posted expense or scheduled alert |
| Saved capture | Original content saved as a record, with no imposed action | Find, recent records | A task requiring classification |
| Draft record | Partial structured expense/item awaiting completion or review | Continue → source review | Money posted or reminders active |
| AI proposal | Suggested change, awaiting consent | Contextual card; Continue if saved | Consent merely because it was read |
| Pending sync | A supported source operation is safely queued | Its row and Continue | Server confirmation or availability on another device |
| Needs checking | A request may have committed; result is unknown | Continue with source link | Safe permission to repeat the write |
| Committed record | Source operation acknowledged | Source detail and Find | That every external side effect, such as push delivery, was verified |

**Implemented:** transaction drafts, schedule drafts, conversation state, and gated execution progress differ today [E08](README.md#e08)–[E14](README.md#e14). Continue is a projection over them, not another authoritative copy. A saved capture does not enter Continue unless its editor contains unfinished changes or the person explicitly starts a conversion.

## 4. Require inputs at the point they become necessary

| Action | Essential now | Optional / deferred |
| --- | --- | --- |
| Save thought or quick record | Non-whitespace content; current signed-in owner established by the app | Title, type, category, date, tags, related record; voice is an alternate input |
| Post expense | Confirmed positive amount, currency/account, category under the current source contract, effective date | Description, subcategory, receipt, trip, split; conditional split/debt details appear only when selected |
| Activate reminder | Meaningful title; explicit timing choice if a timed reminder is requested | No date is valid for an untimed item; priority, location, recurrence, alerts, assignee remain deliberate options |
| Create event | Title and valid start/end under current source contract | Location, notes, recurrence, guests/assignee where supported |
| Find | Query, or selection of a recent record | Module/type/date/person filters |
| Resolve attention | The selected action; a new date only for rescheduling | Reason, notes, daily plan |
| Resume | The retained work identifier | Reclassification, retyping, summary from memory |
| Accept AI proposal | Explicit consent to an identifiable, current preview; missing source-required values | Explanation request, future preference, reason for dismissal |

The proposed expense conversion reuses today's category requirement [E09](README.md#e09), [E12](README.md#e12); neutral capture bypasses it by saving text, not by fabricating an “Uncategorized” financial posting. A date-only reminder must show its effective alert/timing before activation; do not silently present the current noon conversion as the person's chosen time [E12](README.md#e12).

## 5. Minimize visible choices, retain precision

First view: input, visible private/household scope, primary action, and one secondary entry to more detail. Keep precision tools available for complex tasks. Put optional receipt, recurrence, advanced alerts, priority, location, category administration, and layout customization behind Details or their source editor. A prefilled value is editable, never permission to hide a consequential account, recipient, currency, date, or recurrence scope.

Remove role subtitles that repeat the title, duplicate acknowledgments, and permanent starter controls once typing begins. Do not solve information density by shrinking hit targets. Keep person identity stable across devices; color supplements labels and never carries ownership or urgency alone.

## 6. Attention must justify an interruption

Home is a transient view of existing facts, not a daily worksheet. Derive it from source state without asking the person to assign priorities every morning. A saved thought, unread informational notice, late item, pending consent, and uncertain payment are different things. Only a small number of relevant actions appear initially; remaining items are accessible without a red “debt” badge.

Show the time/source basis for attention in one short clause, such as “Due 15:00” or “Save unverified”. Never claim “All clear” when a required source failed to load. Recommendations have an optional reason detail, a source link, and an explicit expiry condition. Reopening Home does not regenerate an ignored recommendation.

## 7. Leaving is an ordinary action

Auto-retain nonempty work while typing and at blur/background boundaries. “Kept on this device” is allowed only after local persistence succeeds; “Saved” requires the corresponding acknowledged record save. Do not claim survival if storage is unavailable or a browser kills the process before any write.

Return restores fields, deliberate choices, caret/focus where practical, and the current source identity. Ask only for the next genuinely missing value. Never overwrite an in-progress form with a handoff or another device's edit. Scope retained work to the signed-in owner and conversation; sign-out/account switching must not reveal another person's content. Device-only work cannot promise cross-device availability [E11](README.md#e11), [E13](README.md#e13), [E24](README.md#e24).

## 8. Correction is more durable than a toast

One successful mutation produces one receipt, one optional four-second Undo toast, and an Open path. The source detail retains Edit and, where a true inverse exists, Undo after the toast expires. Undo must name its scope: undo one occurrence versus series, remove a posting versus restore the prior draft, cancel unfinished plan steps versus reverse completed writes.

For proposed raw-note conversion, Undo restores the pre-conversion editable state and reverses only the linked source change where safe. Keep provenance; do not delete unrelated later edits. If reversal is unsafe after another person's change, explain “Changed since then” and open the current source. Delete and dismiss are reversible according to source capabilities; no generic success toast may promise an inverse that does not exist. Current draft confirmation Undo removes the transaction rather than proving full draft restoration [E09](README.md#e09).

Retry is safe for failed reads and known-not-started operations. A timeout after sending a write is a “Needs checking” state, with a source link and reconciliation before any repeat. Never turn a slow API into “Offline” merely because it timed out [E20](README.md#e20).

## 9. Same meaning across devices, different layout

| Context | Interaction contract |
| --- | --- |
| Desktop | Persistent Find and Capture entries; source detail may open beside results. Do not duplicate a global composer and a second active chat input. Close returns to the same query/scroll position. |
| Mobile | Capture reachable in one tap from ordinary app surfaces; one sheet at a time, safe-area padding, reachable Save above the keyboard. Detail may occupy the screen; Back restores the originating list. Gestures have visible equivalents. |
| Keyboard-first | Proposed Ctrl/Cmd+K opens Find outside text editing; visible Find remains available. Capture uses Ctrl/Cmd+Enter to submit across kinds, Enter for newline. Tab moves focus; explicit Right-arrow or a labeled action accepts completion. Escape closes the top layer while retaining text, then returns focus to its launcher. Do not intercept IME composition. |
| Short interruption | Save without replying to a question; leave immediately; return through Continue or Find. No onboarding, forced categorization, daily planning, or notification-clearing prerequisite. |

The keyboard convention is a proposal requiring migration and user validation: current CommandBar Enter behavior varies by detected kind and Tab may accept a completion [E04](README.md#e04). Existing `visualViewport` handling is a useful base, not proof that the mobile layout passes [E27](README.md#e27).

## 10. Validate judgment without creating another maintenance task

Run the six scripted tasks with the household on phone and desktop. Measure decisions before save, backtracks, wrong-container searches, abandoned input, and ability to explain whether an action happened. Suggested targets in this package are acceptance goals, not measured current performance. Use local fixtures/replay data; no production writes or paid API probes are needed for design review.

Before building, validate privacy expectations for raw captures, Save versus Ask terminology, the Home destination, persistent recovery scope, and whether chapter/page-flip notes help actual use. Visual QA must cover 390 px width, landscape, keyboard open, large text/zoom, both household themes, reduced motion, and assistive technology. Keep decisions tied to a failed or improved scenario rather than growing a wishlist.

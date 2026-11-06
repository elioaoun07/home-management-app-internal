# Acceptance scenarios and final review

Baseline: [README](README.md), commit **`9cd4166691edd9367ea1bd9a604e0bec13ffe870`**. These are **proposed acceptance scenarios**, not executed tests or claims of current support. Use isolated fixtures and replayed AI responses; no live production writes or paid API calls are required. Current implementation evidence is linked from each flow in [Capture and retrieval](CAPTURE-AND-RETRIEVAL-FLOWS.md).

## Common completion contract

Each scenario must establish: what content survived, who can see it, whether a source action happened, which exact entity/occurrence changed, whether the operation can be corrected, and what happens after interruption. “A toast appeared” alone is insufficient. Never infer successful posting from assistant prose or absence of an error.

## F1. Capture a thought

| ID | Given / when | Required observable result |
| --- | --- | --- |
| F1-A | Signed-in user on Home types “Maybe a quieter birthday dinner, ask Maya” and taps Save | One personal saved capture with original text and time; no title, date, folder, category, recipient or conversation setup required. No reminder, financial mutation, household message, or model call. One receipt says Saved. |
| F1-B | User submits a multiline thought using keyboard, then opens it from Recent | Enter inserts a newline; Ctrl/Cmd+Enter saves once; original line breaks survive. Tab reaches controls without accepting completion. IME Enter does not submit mid-composition. |
| F1-C | Network unavailable; local persistence succeeds; user closes and reopens the app | Text is recovered under the same owner with Kept on this device status. Another device is not promised the content. After acknowledged sync, one saved identity exists; status becomes Saved. |
| F1-D | User saves then uses Undo, or edits after the toast expires | Undo removes only that capture and restores its text to the editor when safe. Persistent Edit opens the current record. Linked committed records are not silently removed. Blank/whitespace Save creates nothing. |

**User-validation goal:** saving a thought should require one deliberate action after text entry and no classification decision. Measure this in prototype use; it is not a measured baseline.

## F2. Record without classifying

| ID | Given / when | Required observable result |
| --- | --- | --- |
| F2-A | User saves “Coffee 4, paid cash” without an account/category/currency | The text is safely retained; no balance changes, fabricated category, inferred currency commitment, or mandatory question. Receipt offers optional Record expense. |
| F2-B | User chooses Record expense, then leaves after choosing amount/account | Original capture remains saved. One linked unfinished conversion appears in Continue. On return, deliberate choices survive; only category/date or other genuinely missing source essentials require completion. |
| F2-C | User confirms USD 4 on a USD account/category and double-taps Record | Exactly one source transaction and one feedback receipt exist; balance changes once. Capture links to that transaction. Reopening the capture does not offer a second independent posting of the same conversion. |
| F2-D | User changes account to a different currency, or no eligible account exists | Incompatible amount/category assumptions cannot silently carry through. Review asks for the affected choice; Not yet preserves raw capture. Creating an account and returning does not lose the text or other valid edits. |

Also exercise the sister path: “Call the garage” saved as a thought, converted to an untimed reminder without a due date; then an explicit timed reminder with a visible effective date/time/alert. A recurring request opens the existing recurrence editor and never becomes a one-time write silently. Posting Undo reverses the linked source effect and restores editable work where safe; if source changes make that unsafe, it opens a correction review.

## F3. Find and reopen

| ID | Given / when | Required observable result |
| --- | --- | --- |
| F3-A | A “garage” note, completed reminder and transaction description exist in different allowed sources; user searches garage with no filters | All covered matches are discoverable with type, date, snippet and attribution. No module/date choice is required. Coverage is explicit; unsupported or failed sources are not implied searched. |
| F3-B | A budget message was converted and is hidden by the thread's default action filter | Find can retrieve the original message and linked source result. Opening the transaction reaches its actual detail rather than an empty day or an unrelated chat. |
| F3-C | User narrows to reminders, opens an old result, then presses Back | Query, filters, list position and keyboard focus return. No read action recreates an item, completes it, or changes its due date. |
| F3-D | Filter yields zero results, then one source times out while others return | Zero-with-filter says No matches with Clear filters. Partial failure keeps good results and says Some results unavailable with Retry. Neither state claims the record never existed. |
| F3-E | A cached match becomes private/unlinked/deleted before opening | Current permissions control both snippet and detail. Unauthorized content is removed without revealing its identity to the wrong viewer. An authorized deleted record routes to recovery under Include deleted; it is not silently recreated. |

Keyboard variant: Ctrl/Cmd+K outside editors opens Find; arrows select, Enter opens, Escape closes and restores focus. Mobile variant: detail can fill the screen; Back behaves like desktop Close. Empty-query recent records do not expose another person's device cache.

## F4. Understand attention

| ID | Given / when | Required observable result |
| --- | --- | --- |
| F4-A | One uncertain payment save, an appointment at 15:00, eight overdue tasks, five unread info notices, a saved thought and an AI suggestion exist | Home initially shows a bounded factual list: check consequential save, time-bound commitment, then relevant obligation/decision. View all reaches remaining work. Info unread count, raw thought and AI suggestion do not crowd out commitments or become an additive urgency score. |
| F4-B | User marks notifications read, dismisses one, then opens Schedule | No related task becomes completed or deleted merely from read/dismiss. Source obligation still appears if actionable; delivery state changes independently. |
| F4-C | User completes one recurring occurrence from Home and then uses Undo | Only the reviewed occurrence changes; Schedule and Home agree. Undo restores it with the correct date/status. Series scope requires explicit selection before a series mutation. |
| F4-D | No due work exists in loaded sources, but Schedule fails to load | Home shows Schedule unavailable and Retry; it never says global All clear. When all required sources load and none have due work, Nothing due now is allowed. Continue and Find remain available without a daily planning step. |

Additional boundary: create an obligation older than the planner's current 30-day overdue window and a chore excluded from that planner. A broad Home claim must either include these through proper source contracts or disclose its coverage. A bounded initial list is not permission to hide older records from View all/search. Owner/partner/unassigned responsibility rules must be explicitly tested with two identities.

## F5. Resume interrupted work

| ID | Given / when | Required observable result |
| --- | --- | --- |
| F5-A | User edits expense amount/description/account, backgrounds the phone, then reloads after a successful retention checkpoint | Continue opens the same editor with the same text and selections, not a blank form or a posted transaction. It identifies device-only retention honestly. Focus lands at the next required value. |
| F5-B | One raw capture links to a conversion draft and a continuation | Continue counts one unfinished work identity. Completing it removes the continuation only after source success; the original capture remains searchable. A plain saved capture with no unfinished conversion never inflates Continue. |
| F5-C | With durable execution enabled and supported, one of three plan steps committed before interruption | Resume shows the committed source receipt and two remaining steps; it does not repeat step one. Materially changed effects require fresh consent. Stop cancels only unfinished steps. With the feature unavailable, no durable-resume guarantee is displayed. |
| F5-D | User resumes yesterday's “tomorrow”, a removed account, or a source edited on another device | Original capture time and resolved date remain visible. No silent date rollover, account substitution or overwrite. Local edits remain recoverable; only changed essential fields require review. |
| F5-E | User closes a sheet, starts New chat, discards a partial editor, then uses Undo discard | Close/Back retain work; New chat resets conversational reference without discarding unrelated editors. Discard removes only the chosen unfinished work; Undo restores its fields and link. Previously committed facts remain intact. |

Short-interruption variant: retain work, navigate to another module for ten seconds, return, and finish without retyping. Cross-device variant: only acknowledged synchronized work is available remotely. Immediate browser termination before a checkpoint cannot be claimed recoverable; test and state that boundary.

## F6. Act on or dismiss a recommendation

| ID | Given / when | Required observable result |
| --- | --- | --- |
| F6-A | Replayed AI response proposes moving a specific reminder from Friday 10:00 to Saturday 10:00 | Card shows actual target, old/new date/time and relevant ownership/scope. Move reminder, Adjust and Dismiss are usable without another model turn. Why is optional. No mutation occurs on display. |
| F6-B | User adjusts time, then double-taps the effect-named action | One current preview authorizes one source change; edited value is used. One receipt links to the source. Undo uses the source inverse; the toast is not the sole later correction route. Accept does not imply Always. |
| F6-C | User dismisses a recommendation, reopens Home, then uses dismissal Undo/history | Underlying task is unchanged. Same suggestion stays dismissed across visits. Undo restores it without executing it; stale content restores in review state. No reason or permanent preference is required. |
| F6-D | Source target or permission changes after preview but before confirmation | The changed action cannot execute under stale consent. Updated preview requires fresh confirmation, or the inaccessible target is unavailable without leaking content. |
| F6-E | Write result is uncertain, dismissal fails, or the AI service is unavailable | Uncertain write offers Check result and no blind retry. Failed dismissal retains the card with Couldn't dismiss. AI unavailability preserves saved input and access to the source form. Completed plan steps remain visible and are never described as undone by Dismiss. |

For nonreversible or externally delivered effects, preview must identify the limitation before consent and offer a real correction path. Reject a generic Undo label that cannot restore the relevant state. Validate whether Later is needed before adding another reminder queue.

## Cross-cutting recovery and accessibility cases

| ID | Setup / action | Required result |
| --- | --- | --- |
| X1 | Local persistence quota/permission fails while typing | Text remains visible; Couldn't keep this plus Copy/Retry. No Saved or guaranteed reload recovery. |
| X2 | Known offline before sending versus timeout after sending | Offline can retain/queue only through supported source paths. Timeout alone never flips global Offline or enqueues a duplicate write; uncertain effects go to checking. |
| X3 | Server saved but response was lost, then app reloads | Same work identity reconciles to one source result; no automatic second money/schedule action. Until reconciliation, Needs checking remains visible. |
| X4 | Two linked household identities, then unlink/sign-out/account switch | Current source rights apply to capture, Find, Continue and recommendations; private cached content never crosses owners. Sharing a raw thought requires an explicit choice. |
| X5 | 390 px phone, long text/name, keyboard open, then landscape | Save/primary action and latest editable text remain reachable; no fixed-header/footer occlusion, stacked modal chain, or required horizontal scan. Back retains work. Must be tested visually on a real rendered surface. |
| X6 | Keyboard only, screen reader, IME, 200% text/zoom, reduced motion | Named controls, clear focus, status announcement, no focus trap; Escape returns focus; Tab navigates; composition does not submit; motion is optional. Gesture actions have visible equivalents. |
| X7 | Toast expires while user is interrupted | Source detail still supports Edit and the applicable safe inverse/recovery path. No ambiguous generic Undo that affects another operation. |
| X8 | Query succeeds with zero rows versus errors/stale cache | Empty, unavailable and device-cache-only states have different copy and truthful coverage. No automatic writes on load or “helpful” recreation. |
| X9 | User enters through authenticated root, Home from a module, an installed standalone app, and a record deep link | Proposed root/Home lead to the canonical `/era` Home. Standalone launches and deep links still reach their intended source tool/record. Back restores origin; no existing unsent work is discarded or auto-submitted. |

## Validation plan and evidence required

| Validation | Method and record | Status in this review |
| --- | --- | --- |
| Structural claims | Read cited source at analyzed commit; distinguish code from comments/docs | Completed for this sample; evidence index in README |
| Capture cost | Observe F1/F2: count decisions, taps after typing, backtracks and abandoned input | Not run; target is raw save with no classification decision |
| Retrieval | Seed known fixtures across covered types; ask household to find them without naming modules | Not run; record missing sources and incorrect opens, not just query response time |
| Attention usefulness | Replay F4 set; ask user to identify next commitment and explain why | Not run; validate ranking and bounded-list size |
| Recovery confidence | Interrupt F5 at typing, pre-send, post-send, post-commit/pre-ack boundaries | Not run; record exactly which states survive and on which device |
| Recommendation understanding | Replay F6 and ask user what Accept, Dismiss and Stop would change | Not run; success is correct effect/scope understanding without more chat |
| Visual/device/accessibility | Render actual UI/prototype at mobile/desktop sizes and test X5/X6 | Not run; no app screenshots or browser render inspected |
| Deployment behavior | Owner supplies flag/migration state, source permissions, scheduler traces where relevant | Unknown; repository code is not production evidence |

Do not run a live model to evaluate a button label. Use fixed proposals and failure receipts. Do not mark a scenario passing merely because a source component exists or a documentation statement says it should work.

## Final consistency review

This is a review of the **written design**, not functional verification of ERA.

| Consistency question | Resolution across the package |
| --- | --- |
| Are “implemented”, “intent”, “proposal”, and unknowns separated? | README defines the labels; each flow separates evidence from inference. No proposed universal capture/search/Continue behavior is presented as shipped. |
| Do six flows each specify the full interaction? | Each includes current evidence, friction, numbered proposal, essential/optional inputs, screen responsibilities, short copy, error/empty handling, Undo/correction, modality variants, acceptance anchors and unknowns. |
| Is raw capture a task backlog? | No. It is complete when saved; classification is optional. Only unfinished editing/conversion enters Continue. |
| Does Home become a second source of truth? | No. Attention and Continue project source state; completion and correction remain source operations. A row may have multiple links but one work identity. |
| Can one operation be counted/confirmed twice? | Capture links conversion to one source identity; Continue deduplicates it; one receipt owns feedback. Double taps/lost acknowledgments require identity-based reconciliation. This is a criterion, not a claimed existing guarantee. |
| Do Save and Ask mean the same thing? | No. Save retains text without model interpretation; Ask is a deliberate request. Existing direct commands and precision shortcuts remain available. |
| Is AI consent concrete and current? | Previews show effective effects; changed targets require fresh consent. Viewing/resuming/dismissing cannot authorize a write. |
| Does Dismiss undo committed work? | No. Suggestion dismissal affects the suggestion; Stop cancels unfinished plan steps; committed writes use source correction/inverses. |
| Does Undo always restore a draft today? | No. Current expense-draft Undo removes a transaction [E09](README.md#e09). Restoring editable conversion state is explicitly a proposal. |
| Are offline and timeout conflated? | No. Local retention, source-supported queueing, acknowledged save and uncertain sent request have distinct promises. |
| Are private captures accidentally shared? | Proposed raw save defaults to visible Only me; sharing is explicit. User expectation and all cache/ACL paths need validation. |
| Does proposed Find imply unrestricted household access? | No. Current permissions govern results/snippets/detail. Coverage and partial failures are visible. |
| Are desktop/mobile semantics aligned? | Same entities, actions and states; desktop split views versus mobile full-screen/sheets. Proposed keyboard conventions are consistent and identified as a change from current behavior. |
| Is Home's proposed destination concrete? | `/era` is the proposed canonical root/Home target; direct module installs and deep links retain their destination. User validation is a gate before implementation, not a missing design decision. |
| Are navigation overlaps exaggerated? | No simultaneous duplicate-header claim: existing suppression is acknowledged. Semantic duplicate controls and success toasts are distinguished from unverified visual clutter. |
| Are source/docs discrepancies hidden? | No. Expense draft table/confirmation prose differs from inspected API; Feature Map hints are treated as routes to inspect, not source proof [E08](README.md#e08). |
| Is the work executable without a generic wishlist? | Recommendations below map to failed scenarios and remove decisions/controls. No daily maintenance dashboard or new module suite is required. |

## Prioritized recommendations

Priorities describe proposed delivery order, not severity-ranked measured bugs or a committed roadmap. Keep product decisions separate from their eventual implementation scope.

| Priority | Recommendation / simplification | Why first; evidence | Acceptance gate / dependency |
| --- | --- | --- | --- |
| P0.1 | Retain nonempty work; never clear the only recoverable copy before acknowledgement; expose unknown saves distinctly | Transient editor/store state and early clearing are evident [E04](README.md#e04), [E11](README.md#e11), [E12](README.md#e12). Losing work undermines every flow. | F5-A, X1–X4; owner-bound retention and source reconciliation must be designed before claiming universal recovery |
| P0.2 | Consolidate draft success feedback and specify true inverses/correction paths | Component/hook duplicate feedback and delete-only inverse are concrete [E09](README.md#e09). This is a small, bounded simplification. | F2-C, F6-B, X7; one action/receipt, correct balance and draft state after correction |
| P1.1 | Add neutral Save to the primary capture surface, reusing raw notes and existing source conversions | Removes upfront title/type/account/category pressure without weakening posting contracts [E03](README.md#e03), [E05](README.md#e05), [E08](README.md#e08). | F1, F2; validate Save/Ask distinction and privacy default; avoid a new memory/queue system |
| P1.2 | Provide one Find entry, initially covering explicitly named core sources; reopen by source ID | Current searches are scoped and thread action filters can hide content [E07](README.md#e07). Retrieval makes low-structure capture trustworthy. | F3, X4, X8; permission-aware coverage/pagination and result-state retention |
| P1.3 | Expose Continue over existing drafts/editors/runs; deduplicate linked work | Separate drawers and gated durability leave resumption fragmented [E09](README.md#e09)–[E14](README.md#e14). | F5; depends on P0.1. Do not promise cross-device or durable-run support without deployment evidence |
| P2.1 | Unify Home meaning; trim role subtitles, redundant launchers and empty-composer starters | Multiple entry meanings and shells are code-evidenced; actual visual density is unknown [E01](README.md#e01), [E02](README.md#e02). | Household navigation study, X5/X6; preserve standalone installs/deep links and explicit manual Ask AI |
| P2.2 | Replace competing urgency badges with a small derived factual attention list; keep planning optional | Planner/notification/draft states differ [E17](README.md#e17), [E18](README.md#e18). | F4; validate relevance, source coverage and ownership. No daily cleanup habit |
| P2.3 | Use effect-named recommendation actions, direct Adjust, and reversible dismissal | Existing previews/confirmation are a strong base; dismissal lacks a universal inverse [E15](README.md#e15), [E16](README.md#e16). | F6; expiry/deduplication and inverse coverage; test before changing proactive frequency |
| Conditional removal | Make chapter/page-turn notes optional for retrieval; keep advanced form fields behind Details | Existing interaction state is real, but its usability cost is a hypothesis [E05](README.md#e05), [E12](README.md#e12). | Observe users first; preserve content and precision features. Remove presentation complexity only if it costs more than it helps |

### Stop conditions for expanding scope

Do not add a new dashboard, queue, AI model path, daily review ritual, or classification taxonomy unless a named scenario cannot be satisfied using the current sources and simpler controls. Do not treat extra AI conversation as the default fix for a missing button or a hidden draft. Before implementation, resolve privacy, recovery boundaries, search coverage and the Home destination with users; validate visual assumptions on a rendered surface.

### Documentation delivery checks

Only the five requested Markdown files belong to this task. Existing files, code, tests, schema, PM records, Atlas and generated assets remain untouched. No UI behavior changed, so runtime/typecheck/lint/API/DB tests cannot validate these proposals and were not run. Local verification checks file inventory, source/link targets, terminology, scenario coverage and diff scope. Future implementation requires its own source-module playbooks and real mobile/user validation.

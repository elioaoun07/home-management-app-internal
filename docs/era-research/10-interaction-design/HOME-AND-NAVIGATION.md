# Home and navigation

Baseline: [README](README.md). **Implemented observations** below come from source, not visual inspection. All target layouts and control changes are **proposals** pending user and visual validation.

## Current structure and likely costs

| Implemented observation | Evidence | Friction hypothesis |
| --- | --- | --- |
| Authenticated root opens `/dashboard`; standalone header Home opens `/expense` | [E01](README.md#e01) | “Home” may mean history or entry depending on origin |
| Mobile expense shell has Activity / central capture FAB / Plan; reminder choice switches tab while using `/expense` | [E01](README.md#e01) | Route, module, and visible action are not the same mental model |
| Many standalone pages suppress MobileNav; `/era` has its own awake-gated face navigation | [E01](README.md#e01), [E02](README.md#e02) | Moving between assistant, modules, and capture can require learning separate shells |
| Standalone header includes module title, role subtitle, Home, bell, account; open Hub thread suppresses global shell | [E01](README.md#e01) | Role subtitles can repeat context; the suppression already prevents some stacking |
| ERA has face pills, history/new-chat controls, composer tools, and different desktop/mobile conversation placement | [E02](README.md#e02), [E04](README.md#e04), [E13](README.md#e13) | Capture and navigation may compete for attention; actual density needs visual validation |
| Hub has title/latest-message search, thread search, purpose/privacy/color filters, and action-hiding state | [E07](README.md#e07) | Retrieval can depend on hidden scope or remembering the original container |
| Draft confirmation can show success in component and hook | [E09](README.md#e09) | Two receipts can make one mutation feel like two actions and compete with Undo |
| Planner, notification modal, Activity Log and Artifacts each cover different facts | [E17](README.md#e17)–[E19](README.md#e19) | Their labels/counts should not be combined into one unexplained urgency badge |

These are semantic overlaps across contexts, not proof that every control is simultaneously visible. In particular, do not report a double header on `/era` or an open Hub thread: ConditionalHeader explicitly hides there [E01](README.md#e01).

## Proposed destination model

Use **`/era` as the proposed canonical Home**, with the capture/attention/Continue responsibilities below. This replaces neither source records nor precision tools. Ordinary Home links and the authenticated root would lead there; existing direct module URLs and installed-module launches would still open their intended tools. This is a proposed product decision requiring owner validation before any route changes, not a redirect implemented by this task. Preserve external deep links and origin-aware Back.

| Destination / entry | Owns | Does not own |
| --- | --- | --- |
| Home | Capture entry, small derived attention list, Continue entry, recent records | A mandatory daily plan, duplicate module dashboards, complete transaction editing |
| Capture | Raw save, scope, retention status; secondary Ask ERA path | Category setup, new chat setup, automatic interpretation on Save |
| Find | Cross-source retrieval with explicit coverage; recent records | Mutating search results, unverified AI answers replacing originals |
| Continue | Projection of unfinished editors, source drafts, pending sync/checks and saved runs | A new canonical draft store or a queue of all unclassified thoughts |
| Modules | Existing precision tools: Budget, Schedule, Kitchen and others | Forcing people through a module before saving a thought |
| Hub Chat | Household conversation and its source-linked message actions | Automatically sharing a personal capture or being the sole retrieval route |
| Ask ERA | Deliberate requests, clarification, reviewed recommendations and plans | A required middleman for Save, Find, field edits or dismissals |
| Activity / history | Audit trail, past conversations, completed actions and recovery links | Deciding what is due simply because it was recently unread |

Home and Ask ERA can share the product's top layer without treating every input as a conversation. Reuse one composer implementation where practical; **Save** and **Ask ERA** are different explicit actions on the same text, not two active text boxes. Existing direct commands remain available in the Ask path; explicit precision-form shortcuts remain useful for familiar repeat actions.

### Desktop

A stable rail offers **Home**, **Find**, and **Modules**, with a visible Capture action. Continue sits on Home and is reachable from the rail's work entry if there is unfinished work. The main area prioritizes capture and factual attention; source detail may open beside a list. A deliberate Ask path opens the existing conversation in that work area. Do not retain a second floating conversation over an already active editor.

Keep keyboard equivalents visible in help, not in permanent explanatory headers. Proposed Ctrl/Cmd+K opens Find outside text entry; Ctrl/Cmd+Enter submits capture; Escape closes the top layer and restores focus. Search and capture are separate commands so a partial record is not accidentally submitted as a query.

### Mobile

Use a stable, small primary navigation: **Home**, **Find**, **Modules**, with Capture as the prominent action. Continue is a Home entry, not a fourth badge demanding clearance. A module detail/editor may replace the bar with its own Back and action footer while preserving origin. Standalone installs may keep local navigation but must provide consistent access to Home/Capture without nesting global and local headers.

Capture opens one sheet; opening Details replaces or advances within that sheet rather than stacking a chain of independently dismissible overlays. Save remains above the software keyboard, with safe-area offsets. Closing/back retains work. A swipe shortcut can remain only if the visible Back/action offers the same result. Do not make long press, double tap, hover, or sideways face-pill scrolling the only way to reach an essential action.

This is a semantic target, not a pixel wireframe. Device tests must establish reachable targets, footer clearance, keyboard layout, and how installed modules reconnect to Home [E27](README.md#e27).

## Home without daily maintenance

Proposed order, derived from existing records:

1. **Capture** — one input/entry, privacy indicator, Save. No setup prompt for a new household.
2. **Needs attention** — at most three initial factual rows, then View all. Order uncertain consequential saves before time-bound obligations, then initiated decisions waiting for consent. Urgent timing is derived from source facts; recommendations do not outrank actual commitments.
3. **Continue · N** — one entry with a compact most-recent unfinished preview; N counts unique work identities. Do not repeat the same uncertain save as two separate unresolved tasks. Its Home attention row links to the same continuation.
4. **Recent** — recent saved/opened records for quick return. Ordinary saved thoughts live here and in Find even if never classified.

Suppress empty attention/Continue sections rather than filling them with tips. A new user sees capture and simple navigation, not an empty productivity dashboard. If an important source failed, show its concise unavailable state instead of a reassuring global empty message. No mandatory morning reset, manual widget arrangement, daily Top 3, inbox clearing, or affirmation of every overdue item.

Attention is bounded presentation, not bounded truth. View all must expose remaining relevant source facts and clearly label its time range. Current planner overdue calculations look back 30 days [E17](README.md#e17); a proposed all-obligations view cannot reuse that window silently. Ownership labels distinguish the user's action, household action, and partner-only information. Person color follows identity rather than viewer role.

## Consolidate, simplify, or remove

| Change | Concrete proposal | Safeguard / validation |
| --- | --- | --- |
| Consolidate Home controls | One meaning and destination, with origin-preserving Back | Validate existing installed-app and deep-link expectations before implementation |
| Remove redundant header text | Drop role subtitles such as “Task Manager” when the module title already conveys context | Retain title, identity, essential action and access to help; verify actual visual hierarchy |
| Consolidate capture launchers | One accessible Capture entry per active shell; hide redundant FAB/composer launcher when the editor is already open | Keep direct precision shortcuts available; do not add a universal overlay above forms |
| Simplify empty composer | No permanent row of four starter icons; expose recent/relevant shortcuts on focus or under More | Preserve discoverability of voice and manual Ask AI; test first use |
| Consolidate draft discovery | One Continue entry opens existing source review, including schedule drafts and gated saved runs | Retain source identity and inverse; no duplicated draft database |
| Remove duplicate success feedback | One receipt/Undo owner for draft confirmation | Current component/hook duplication is code-evidenced [E09](README.md#e09); regression check one action produces one feedback event |
| Simplify Find scope | Search original and converted records without inheriting hidden action filters | Expose narrowed filters; keep current permission checks; avoid private cached snippets |
| Reduce retrieval page flipping | Default raw-capture retrieval to a searchable list; make chapters/page-turn presentation optional if users value it | Notes already has page/topic interaction state [E05](README.md#e05); do not claim it is visually broken or delete chapters/data |
| Simplify quick forms | Hide receipt, recurrence, advanced alerts, assignee and category administration until relevant | Preserve source validation and the full precision editor; visible consequences before commitment |
| Separate trace from attention | Give Activity Log and Artifacts one history entry with clearly named scopes | Keep both underlying traces; do not merge storage or imply all activity is assistant activity |
| Reduce conversation overhead | Save, Open, Adjust, Dismiss and exact source edits operate directly | Keep chat for ambiguity, explanations, compound requests and deliberate help |
| Remove maintenance requirements | No daily triage of captured thoughts, no mandatory day plan, no configurable Home widget system in this proposal | Existing planners remain opt-in precision tools |

Do not add new dashboards for each of the six flows, global badges for every state, or a new “organize your inbox” habit. A recommendation history view is only for undoing dismissal/reviewing recent suggestions; it is not another queue the person must empty.

## Navigation and state rules

- Opening a detail from Home, Find, Continue, or chat preserves the origin and returns there on Back. Browser Back and visible Back agree.
- A source link opens the entity by ID even when it lies outside the current date/filter view, reusing existing artifact and item-deep-link patterns [E25](README.md#e25).
- Switching surfaces retains unsent work under its owner and work identity; it never executes or discards it. New chat resets conversational focus, not unrelated retained editor work.
- One active recommendation card per work identity. Multiple entry points can link to it without creating multiple confirmations.
- Local-only, pending-sync, confirmed and uncertain states use text, not color alone. A loading failure is not an empty list.
- Closing a source detail returns focus to its result/row. Closing Capture returns focus to Capture. Opening Find must not replace or submit text in an active editor.

## Validation before changing the shell

**User validation:** ask the household to capture a vague thought, log an ambiguous spend, find a converted message, locate a draft from yesterday, distinguish unread from due, and dismiss a recommendation. Observe wrong turns and explain-back of save state. Compare the proposed Home destination with their current shortcuts; do not assume the assistant must replace every standalone install.

**Visual/device validation:** actual phone at approximately 390 px, landscape, keyboard expanded, multiline input, 200% text/zoom where supported, long names, both identity themes, reduced motion, touch and screen reader. Verify no stacked headers, clipped Save, obscured last row, focus trap, or forced horizontal scan. None was visually tested in this review.

**Technical validation:** cross-source search coverage and ACLs; safe owner-bound retention; continuation deduplication; current run feature flag/migrations; compatible deep links; source-specific inverse availability. These are build prerequisites, not reasons to expand this documentation task into implementation.

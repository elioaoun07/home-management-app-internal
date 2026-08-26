---
created: 2026-05-30
updated: 2026-08-26
type: master-book
status: active
owner: Elio
consolidates: "_index, 1 - Feature State, 2 - Vision & Roadmap, 3 - Action Plan, FABLED, FABLED 2, FABLED 3, ERAHUB.MD (originals in ../_Archive/Hub & ERA/)"
tags:
  - pm/master-book
  - scope/module
  - module/hub
---

# Hub & ERA - Master Book

> **Campaign:** Hub & ERA · prefix `HUB` · working queue → [4 · Checklist](<4 - Checklist.md>)

## Identity & North Star

"Hub & ERA" groups the conversational flagship — **Hub Chat** (the top-layer primary interface per CLAUDE.md), **Message Actions**, the **ERA AI Assistant**, and **Voice Conversation**. It is the app's **brain and front door**, and it spans 🟢 Core (Hub Chat) down to 🟡 New/Thin (ERA, Voice): the most differentiated work in the app, and the least protected.

Today the Hub is an excellent _reactive_ surface — you talk, it parses, it acts. **ERA is only as smart as the graphs it reads**, and it barely reads Schedule (time) and Budget (money) proactively. The moat isn't a better chat box; it's an assistant that knows the household and speaks first, correctly, at the right moment.

**Vision in one line:** _turn ERA from a chat box that answers into a household brain that anticipates — reading the full time + money graph and speaking first, at the right moment, with the right context._

**Source:** `src/features/{hub,era,voice-conversation}/`, `src/components/hub/`, `src/app/{chat,alerts}/`, `src/app/api/{hub,ai-chat}/`, `src/lib/ai/gemini.ts`. Vault: [Hub Chat](<../../03 - Junction Modules/Hub Chat/Overview.md>) · [AI Assistant](<../../03 - Junction Modules/AI Assistant/Overview.md>) · [Message Actions](<../../03 - Junction Modules/Message Actions/Overview.md>).

**Standing contracts (owner-approved, execute — do not redesign):** [ERA Awakening — Master Execution Plan](<../ERA Awakening — Master Execution Plan (2026-07-06).md>) is the execution contract; [ERA Top View — Design Study (2026-07-17)](<../ERA Top View — Design Study (2026-07-17).md>) specifies the Hub L-0 glance as the _pull_ mouth of the briefing brain (shared signal registry, a single `get_era_topview_bundle()` RPC, drafts-only actions). Top View packets sequence **behind** Awakening WP-03/04/11; WP-04 always wins.

## Current State (verified)

**Maturity 4.2 / 10 as of 2026-07-18 (FABLED 3), +0.2 vs 2026-07-02.** The flagship's paradox in sharper form: notification delivery got a genuinely well-engineered visibility policy with the cluster's first test, while `HubPage.tsx` crossed 5,978 LOC and ERA — the app's namesake — still has never spoken first.

| Dimension           | Score  | Evidence                                                                                                                                                                                          |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reactive chat (Hub) | 7      | private threads + per-user receipts shipped (`0f33396`)                                                                                                                                           |
| Intent architecture | 8 (+1) | fixture-covered + graceful fallback (HUB-1), and as of HUB-12 every routed intent **actually resolves** — no intent still falls through to a "Coming soon" reply while writing nothing (2026-08-22) |
| Test protection     | 5 (+1) | **three test files now**: `chatNotificationPolicy.test.ts` (2 green), `rootIntentRouter.test.ts` (39 green, table-driven, HUB-1), `resolveIntent.test.ts` (14 green, HUB-12 — pins side effect *and* reply together). Intent routing and its side effects are no longer untested |
| Proactive reach     | 2      | Top View study specifies the pull mouth; nothing renders yet                                                                                                                                      |
| Voice resilience    | 4      | no window changes; dead `sttCapture.ts` / `vadGate.ts` still on disk                                                                                                                              |
| Code health         | 3      | `HubPage.tsx` **5,978 LOC** (+180 since v2) — ~2.4% of the codebase in one file, growing ~+90/month                                                                                               |
| Handoff readiness   | 3      | the 6k-line `HubPage.tsx` makes this the riskiest junction for lower-tier edits; message actions cascade into money and items (the intent router is now fixture-covered, HUB-1 2026-08-22)        |

| Sub-feature                    | Tier | Reality                                                                                                                                                                                                                                                                               |
| ------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hub Chat                       | 🟢   | threads with purposes, realtime, voice messages, message actions, shopping mode, full-screen in-thread, edge-swipe-back, bulk convert (`BulkConvertReviewSheet`) with unconfirmed rows saved as **draft items** (`items.status='draft'`, reviewed via `DraftRemindersDrawer`)         |
| Message Actions                | 🔵   | Hub message → transaction / reminder / item — the bridge that makes chat _do_ things                                                                                                                                                                                                  |
| AI Assistant (ERA)             | 🟡   | the flagship: intent router, faces, widgets, wake listener, budget submit, household context; `src/features/era/` is the largest feature dir (28 files). Intent router fixture-covered with a graceful `clarify` fallback (`intents/rootIntentRouter.test.ts`, HUB-1 2026-08-22); `resolveIntent` is now the single owner of every intent's side effect **and** its reply, including `draftTransaction`, which no longer runs on a parallel CommandBar path (HUB-12 2026-08-22). |
| Voice Conversation             | 🟡   | Azure STT/TTS/wake, conversation engine, intent classifier, greeting cache (shipped May 2026). External-dependency heavy → fragile; wake-word needs external setup (only openWakeWord viable — vendor decision closed)                                                                |
| Faces / widgets                | 🟡   | ERA's visual responses and inline widgets surface module data in chat                                                                                                                                                                                                                 |
| Proactive briefings            | 🟡   | reads Schedule + Budget context; reactive parsing solid, proactive reach shallow                                                                                                                                                                                                      |
| Notification visibility policy | 🔵   | `chatNotificationPolicy.ts` (33 lines, pure, tested): private threads excluded from immediate push **and** cron fallback; every public purpose eligible                                                                                                                               |

## Pain Inventory

- 🟠 **`HubPage.tsx` is 5,978 LOC and growing ~+90/month** — the app's largest file, ~2.4% of the codebase. Every Hub feature pays a comprehension tax; lower-tier models effectively cannot edit it safely.
- 🟠 **ERA still never speaks first** — the identity gap, unchanged through two audits and one design study. Studies are leading shipments 2:0 in this cluster. The Top View study de-risked the _what_; the _ship_ is still absent.
- 🟠 **Voice is external-dependency fragile** — Azure STT/TTS/wake plus external wake-word setup means failures are often environmental, not code. Graceful degradation and setup docs matter more than features here.
- 🟡 **`/chat` voice conversation speaks in a different voice from ERA — and its reminders don't save.** `voice-conversation/speechTemplates.ts` is a parallel, un-pooled reply surface ("Reminder set: {title}.") that never got the HUB-15 treatment, and `intentClassifier.extractReminderTitle` strips the date with `/\b(in|at|on|tomorrow|today|tonight|next)\b.*$/` and discards it. Worse, `HubPage.onSetReminder` posts a chat message and opens `AddReminderFromMessageModal` defaulted to *today, next hour* — so "Reminder set" is spoken before anything is set, and the parsed time is lost. Should route through `resolveDraftReminder` + the shared pools. Surfaced 2026-08-22 (HUB-15). *(Scope narrowed 2026-08-25 — HUB-17 fixed the same failure class on `/era`, which had it worse: zero voice handlers wired at all, so it spoke false success on every native intent, not just reminders. This bullet now tracks `/chat`/`HubPage.tsx` only; HUB-16 has the reapplication plan.)*
- 🟡 **`resolveMonthSpend`'s `partner` scope reports the household total.** Known and commented in `intents/resolvers/budget.ts` ("too costly" to make the second call), but the *formatter* still says "Your partner has spent $X" — so the number is confidently wrong, not merely coarse. Either do the two-call split or make the wording honest. Surfaced 2026-08-22 while wiring HUB-12; untouched by that work.
- 🟡 **`showAnalytics` uses calendar months, `monthSpend` uses the custom month start.** `/api/analytics` buckets by `tx.date.slice(0,7)`; `resolveMonthSpend` goes through `getDefaultDateRange(monthStartDay)`. Ask ERA both questions on the 3rd of the month with a day-25 billing cycle and the two answers disagree. Surfaced 2026-08-22 (HUB-12).
- 🟡 **Policy asymmetry: two sources of nudge-truth.** `chatNotificationPolicy` governs push/cron delivery, but in-app badge/dot logic lives separately in the receipts path. They agree today; nothing enforces that they keep agreeing.
- 🟡 Dead voice files on their **third** flag — `src/features/voice-conversation/sttCapture.ts`, `vadGate.ts`. Same class as Schedule's `MobileItemForm`.
- 🟡 Conversation-store consolidation — three stores since June, unchanged.

## Shipped Log

- ✅ 2026-06-16 — Hub bulk convert ("Multi-add" → `BulkConvertReviewSheet`) with unconfirmed rows saved as draft items (`items.status='draft'`, reviewed via `DraftRemindersDrawer`)
- ✅ 2026-06-16 — bulk-convert "complete transaction" rule tightened: a budget row auto-confirms only with Amount + Category + Subcategory (description = the chat message); any missing field forces a draft
- ✅ 2026-06-16 — full-screen in-thread view (global header hidden) + edge-swipe-back to the thread list
- ✅ 2026-07-10 — **notification visibility policy** (`0f33396`): `chatNotificationPolicy.ts` (33 lines, pure, **the cluster's first test file**) makes visibility the single choke point — private threads excluded from immediate push and cron fallback
- ✅ 2026-07-10 — per-user receipts extended to shopping child messages: `unread_reply_count` drives the item dot, opening the item thread marks replies read, realtime restores the dot only for a _newer_ partner reply
- ✅ 2026-07-10 — net complexity went **down** with a feature for the first time in this cluster (`useHubPersistence.ts` −27, `chat-notifications` cron −17), and the vault docs were updated in the same commit
- ✅ 2026-07-17 — ERA Top View design study recorded as the standing spec for proactive
- ✅ 2026-08-22 — **HUB-1** intent-routing tests + graceful fallback (`src/features/era/intents/rootIntentRouter.test.ts`, 38 green) — new `clarify` Intent member (`ambiguous`/`weak`) threaded through `types.ts`, `intents/{index,budget}.ts`, `replyFormatter.ts`, `resolveIntent.ts` and `CommandBar.tsx`; a misrecognized intent now asks the user to clarify instead of firing a wrong action. `spent 2 hours studying` no longer drafts a transaction; a weak money word no longer confidently switches faces; a multi-face utterance routes to `clarify` instead of letting fixed FACE_KEYS order decide. `pnpm test` green (1697), no new deps
- ✅ 2026-08-22 — **HUB-1 follow-up** post-delivery review caught two false negatives in the same-day landing: the flat cross-face fallback let a bare `switchFace` keyword echo tie with a fully slot-filled intent ("remind me to buy dinner ingredients" wrongly went to `clarify/ambiguous` instead of `draftReminder`), and the active face's own weak `clarify` short-circuited before other faces' routers ran at all ("remind me to buy groceries" with Budget active never reached schedule). Fixed in `intents/index.ts` by tiering cross-face hits (slot-filled kinds beat bare `switchFace`) and letting a weak local `clarify` step aside for a stronger cross-face hit. One row corrected, one row added to the fixture (39 green). `pnpm test` green (1699), no new deps
- ✅ 2026-08-22 — **HUB-12** ERA Phase 2 intents: `draftReminder`, `showAnalytics`, and `draftTransaction` all resolve for real. Three intents had been reaching `resolveIntent`, falling through to `replyFormatter`'s "Coming soon" string and writing nothing — the worst failure shape in the taxonomy, since the reply reads like success. Now: `draftReminder` → `POST /api/items` via `resolvers/schedule.ts` (`parseSmartText` for title/date/recurrence, `localToISO` for the UTC instant, **`due_at` omitted entirely when `confidence.date === 0`** so we never invent a due time that fires an alert immediately); `showAnalytics` → `GET /api/analytics?months=2` summarizing the current month with a top-3 category list and a month-over-month delta; `draftTransaction` moved **off** its parallel CommandBar path onto the resolver, with `useEraBudgetSubmit.submit` injected as a `ResolveDeps` capability so the Undo toast (Hard Rule #1) and cache invalidation stay exactly where they were while the dispatcher becomes the single owner of "intent → reply". Reply and side effect can no longer disagree: a failed draft now says so instead of returning "Drafting $25.00…". New fixture `src/features/era/intents/resolveIntent.test.ts` (14 green). `pnpm test` green (1715), typecheck clean, no new deps
- ✅ 2026-08-22 — **HUB-15** ERA stopped reading from a script. Every reply was a single hardcoded string, so the fifth reminder of the day came back word-for-word identical to the first — the tell that collapses the illusion of an assistant that's listening. New `src/lib/era/phrasing.ts` holds the mechanics (`pick`/`fill`/`say`, `describeWhen`, `money`, `plural`, `listOut`, `errorReply`, time-aware `greeting`) and every situation across all four faces now owns a **pool** of slot-templated phrasings drawn at random — ~40 pools, 4–10 variants each, covering reminders, schedule, spend, analytics, drafts, recipes, memory, greetings, clarify/unknown and the in-flight interstitials. Lives in `src/lib/` because ERA and voice-conversation are both standalone feature dirs and may not import each other. Four rules are written into the module header and enforced by test: **every variant carries the same facts** (variation is connective tissue only), slots rather than concatenation, no personality-of-the-day, and an error's *diagnosis* is never randomized — only its apology and retry nudge. New fixtures `src/lib/era/phrasing.test.ts` (23) and a variant harness in `resolveIntent.test.ts` that drives `Math.random` across its range, collects every sentence a pool can emit, and asserts the payload survives in **all** of them (a future "breezier" variant that drops the due time or the amount fails). `pnpm test` green (1741), typecheck clean, no new deps
- ✅ 2026-08-22 — **HUB-15 fallout** building the pools surfaced four defects in the phrasing engine, all caught by the sample harness before shipping: `fill` orphaned a separator when a slot was empty (`"one,."`, `"one —."`); it inserted a space in front of *every* slot, so `"{Title}"` rendered `" Water the plant"`; fixing that naively removed the space where a template deliberately wrote the slot flush so an empty one left no gap, giving `$25under Car / Fuel` — resolved by keeping a template-written space, and otherwise adding one unless the slot sits at the start or against an opening delimiter; and `money()` with `minimumFractionDigits: 0` rendered `$1,240.5`, which reads as a typo. Also fixed: sentence-casing after an opener that ends in a full stop (`"Checked. in August…"`), `lowerFirst` de-capitalizing the pronoun "I", and plural disagreement in two schedule pools used only when count > 1 ("There's 3 things due today")
- ✅ 2026-08-22 — **HUB-12 title fix** the schedule router had been copying the whole utterance into the reminder title, so "remind me to call the bank" created an item literally titled "remind me to call the bank". It now stores `parseSmartText`'s cleaned title. Doing so exposed a latent bug in `smartTextParser.extractTitle` shared with **MobileReminderForm and BulkConvertReviewSheet**: every optional filler word in the lead-in strippers was unanchored, so the group ate the *prefix* of the real first word — "remind me tomorrow" titled the item **"Morrow"** and "schedule an appointment" became **"N appointment"**. Fixed by anchoring each optional group with `\b` (13 patterns). Three rows in `rootIntentRouter.test.ts` updated from raw to clean titles
- ✅ 2026-08-26 — **HUB-23** ERA "Ask AI" (Slice 4, delivers WP-10): the manual escape hatch for when the deterministic router can't handle a request — a sparkle button in `CommandBar`, always visible, never auto-triggered (locked decision). `fetchBudgetContext`/`fetchMonthlyTrend` were extracted verbatim from `api/ai-chat/route.ts` into `src/lib/ai/context.ts` (Next.js route files can only export HTTP methods, so anything meant for reuse — this is now the SECOND consumer, `/api/era/ask` — has to live in `lib`); a new `fetchScheduleContext` gives the schedule face upcoming items + every NFC tag with its declared states and live `current_state`. `src/lib/ai/eraAskProposal.ts` asks Gemini for structured JSON — either `{kind:"prose"}` or `{kind:"propose_nfc_reminder", reminderTitle, nfcTagId, targetState}` — using the exact same three-layer pattern `analysisReport.ts` established: `responseSchema` constrains the shape, Zod validates it, and critically, **the model's `nfcTagId`/`targetState` are never trusted blindly** — `parseAskAIResponse` degrades to plain prose unless they match a real tag in `ScheduleContext`, so a hallucinated identifier can never reach a confirm card, let alone a write. This directly answers the owner's own worked example: "remind me when I arrive home" has no date for `parseSmartText`, so Slice 3 now asks "when should I remind you?" — tapping Ask AI instead of answering resends that same sentence to Gemini with the household's real NFC tags in context, and (if a tag plausibly matches) renders a confirm card; Confirm performs the two deterministic writes (`POST /api/items` then `POST /api/items/[id]/prerequisites`) only after the tap — the model never writes anything itself (Doctrine Q10). One proposal kind shipped, deliberately (HUB-24) — this is the owner's real scenario, not a framework built ahead of a second use case. New `src/lib/ai/eraAskProposal.test.ts` (13 cases) pins the safety gate directly: a well-formed proposal naming a tag that doesn't exist degrades to prose every time, and a forced model failure/malformed response never throws and never proposes. `pnpm test` green (1903), typecheck clean, 0 new lint issues, no new deps.
- ✅ 2026-08-26 — **HUB-20** Meal planning joins ERA (Slice 5): three new Chef intents — `listRecipes` ("what recipes do I have"), `assignMeal` ("assign chicken to thursday dinner" → resolves the dish against `/api/recipes`, the day against the existing `parseSmartText` day-of-week logic reused rather than writing a second parser, and upserts via `POST /api/meal-plans`, which already updates-in-place on a taken slot and already 400s with a clear message when there's no household — this resolver surfaces that message instead of re-deriving the household check), and `mealPlanGaps` ("what's unassigned this week" → the next 7 days with no `meal_plans` row at all, pure client compute over one fetch, no new aggregation engine). Dates are never parsed into `Date` objects from bare strings — `formatDate()` (local calendar fields) builds the query range and `` `${date}T12:00:00` `` anchors the display label — the module's documented UTC-midnight-drift trap. New tests in `resolveIntent.test.ts` (7 cases) caught exactly that trap once, in the TEST itself: a first draft used `.toISOString().slice(0,10)` to build mock `planned_date` values and silently dropped a day in this environment's timezone. `pnpm test` green (1886), typecheck clean, 0 new lint issues, no new deps.
- ✅ 2026-08-26 — **HUB-19** Reminder time becomes a required slot (Slice 3): `resolveDraftReminder` no longer writes an undated item when `parseSmartText` finds no date — it asks ("Got \"Call the bank\" — when should I remind you?") and returns a `pending` question. A new `EraPendingTurn` (one shape, one missing slot — `title`) lives in `useEraStore` (in-memory only; a reload loses it, same as any other browser state) and `useEraTurn.runTurn` checks it before the normal router: if a question is outstanding, the WHOLE next utterance is handed to `resolvePendingReminderAnswer` as the answer, never reclassified as a fresh command. A date-shaped answer ("tomorrow at 4pm") completes the reminder through the same write path as a one-shot request; anything else flushes the title to a reviewable `items.status = 'draft'` row — the same rule bulk-convert already uses — rather than losing it or misreading it as an unrelated command. This directly answers the owner's own complaint: ERA previously "logged the reminder without mentioning the time" and moved on; now it either gets a real time or the item waits in Drafts for one. Deliberately NOT built: a general multi-slot framework, or handling the case where the "answer" is actually a genuinely new unrelated command (that command gets treated as a failed time-answer and flushes the pending reminder to draft — a known, documented rough edge, not a silent gap). `resolveIntent.test.ts` gained a `resolvePendingReminderAnswer` suite (3 cases) plus two rewritten `draftReminder` tests (the old "omits due_at" and "never implies a nudge" tests asserted the now-removed undated-write behavior). `pnpm test` green, typecheck clean, no new deps.
- ✅ 2026-08-26 — **HUB-18** Budget capability set (Slice 2): four new intents — `transfer` ("transfer $50 from wallet to savings", self-transfers only, fuzzy account-name matching against the user's own accounts, direct write via the existing `POST /api/transfers` + its already-correct `DELETE` inverse), `recordDebt` ("John owes me $30 for lunch" → `POST /api/debts/standalone`, a pure receivable with zero balance effect at creation or settlement, deliberately not the linked-transaction debt flow which needs an account the router can't reliably parse from one utterance), `listDrafts`, and `confirmDraft` (confirms via the same `PATCH /api/drafts/[id]` the Drafts drawer uses, which overwrites the row rather than partial-patching — this resolver re-fetches the draft's full fields and echoes them back unchanged except `is_draft`). Also fixed in the same session: **HUB-13** (`showAnalytics` now re-sources its headline expense/transactionCount/top-categories from the same custom-billing-month `/api/transactions` window `monthSpend` uses, instead of `/api/analytics`'s calendar-month bucket — income/savings-rate and the previous-period comparison deliberately stay calendar-based, a narrower fix, not a re-architecture) and **HUB-14** (`/api/transactions` has no server-side scope filter at all — it always returns both household members' rows tagged with `user_id` — so "partner" scope was quietly returning the household total under a "your partner has spent" label; now scoped client-side from data already fetched, zero extra round trips, and "self"/"partner" without a resolvable current-user id return an honest error instead of a mislabeled household number). `resolveIntent.test.ts` gained 5 cases for HUB-13/14 and router fixtures for all four new intents. No Undo toast on transfer/recordDebt/confirmDraft — same precedent as `draftReminder`: a real, immediate write confirmed by the spoken reply, undoable from each module's own page. Deliberately deferred: debt *settlement* (no clean Undo inverse exists via the current API — PATCH only supports incremental settlement, not restoring a prior state), expense-split, recurring add/skip (tracked as HUB-22). `pnpm test` green, typecheck clean, 0 new lint issues, no new deps.
- ⚠️ **Live verification gap (2026-08-26):** Slices 2/3/4/5 above are typecheck-clean and test-covered but were only PARTIALLY live-verified (Slice 4 not live-verified at all — built after the stale-server discovery) — the dev server on port 3000 during this session turned out to be serving a stale build (its `.next/dev/build-manifest.json` predated several of these edits) and visibly echoed removed phrasing after the changes landed. Tracked as **HUB-21**. Two harmless undated test reminders ("Water the plants", "Feed the cat") are still in the live DB from the partial verification attempt.
- ✅ 2026-08-25 — **HUB-17** ERA Hub (`/era`) voice had never actually worked: `EraShell` mounted `useConversationMode` with only `onWillSpeak` wired, so `conversationEngine.executeNativeIntent` optional-chained through five missing handlers and then spoke `successTemplate(intent)` unconditionally anyway — "Added $25 to Fuel" while writing nothing, for every native voice intent on the app's own flagship page. Fixed by adding an optional `runTurn?: (text) => Promise<{reply, kind}>` to `ConversationHandlers` (`conversationEngine.ts`) that replaces the legacy five-callback path when present; `EraShell` wires it to a new `src/features/era/useEraTurn.ts` — the same hook `CommandBar` now calls for typed input, so both surfaces run one classify (`rootIntentRouter.parse`) → one resolve (`resolveIntent`) → one persist (`era_messages`) path and cannot disagree on a reminder's due time or a draft's fate. The legacy `/chat` path (`HubPage.tsx`, untouched) got the same false-success fix defensively but keeps its own `classifyIntent`/`speechTemplates.ts` — that's HUB-16, now correctly scoped to `/chat` only. Also: the single-line `eraReply` display became `EraThreadTranscript`, a scrollable multi-turn view of `era_messages` (the owner's ask — "not only a single response, but a full conversation thread"), typewriter effect scoped to the newest row only via a ref-based guard (a state-based guard was tried first and re-triggered the effect on its own update, killing the interval a tick after it started — caught before shipping by adding temporary trace logging and reproducing live). Six confirmed-zero-importer components deleted (`FaceCanvas`, `EraHubView`, `QuickFaceChips`, `EraFaceCard`, `FacePlaceholder`, `FaceHeader`, `EraTranscript`); dead `useEraStore.turns`/`pushTurn`/`clearTurns`/`eraActions` removed. `pnpm test` green (1861, +0 new — no new test file; existing `rootIntentRouter.test.ts`/`resolveIntent.test.ts` are the regression net for the unchanged classify/resolve logic this reuses), typecheck clean, 0 new lint issues, no new deps. Verified live against the dev DB via the actual `/era` UI: a real reminder ("remind me to call the bank tomorrow at 4pm") saved with correct `due_at`, `monthSpend`/`todaySchedule` resolved correctly — then removed via the app's own delete endpoint (Hard Rule 26: no direct DB writes, even to clean up test data)
- ✅ 2026-08-06 — **HUB-11** per-message color tags + color filter (`hub_messages.color`, `src/features/hub/messageColors.ts`) — compose-bar palette picker (sticky per-thread), long-press-to-recolor, header filter button; Multi-add's "Select all" now scopes to the active color filter so a mixed budget thread can be swept color-by-color instead of in one undifferentiated pass (migration `2026-08-06_hub-message-color.sql`, pending manual run)

## Delivery session log

_(Delivery runner appends dated progress bullets here automatically.)_

- 2026-08-22 — **HUB-1** delivery session `s-20260822-093143-t7tm` ended **paused — needs a decision** at NEEDS_DECISION. 0 file(s) changed.

## Vision & Decisions

### Track A — internal enhancements

| Enhancement                | Today                                                                                  | The dream                                                                                                  | Effort |
| -------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| Harden intent routing      | table-driven fixtures + graceful `clarify` fallback shipped _(IMPLEMENTED 2026-08-22)_ | a misrecognized intent clarifies instead of firing a wrong action — done                                   | M      |
| Decompose `HubPage.tsx`    | 5,978 LOC single file                                                                  | split into testable units so Hub changes stop being high-risk                                              | M–L    |
| Voice graceful degradation | Azure-dependent, fails environmentally                                                 | clear fallback when STT/TTS/wake is unavailable, setup docs, degradation tests                             | M      |
| Richer faces / widgets     | faces + inline widgets exist                                                           | more module widgets in-chat (balance, today, low-stock) with fresh cache                                   | M      |
| Expense-split from chat    | message → transaction                                                                  | split a bill conversationally in the Hub                                                                   | M      |
| Unify nudge-truth          | two paths                                                                              | make the receipts/badge path consult `chatNotificationPolicy` (or a shared predicate) + one parity fixture | S–M    |

### Track B — bridges into ERA

ERA is _defined_ by its reads into other modules; most of these are the receiving end of bridges the other campaigns propose.

- **ERA ← Schedule** — read the whole week's shape: recurring due, overdue routines, household-assigned items by person.
- **ERA ← Budget** — warn before a recurring payment overdraws; surface overspend.
- **ERA ← Kitchen** — "low on 3 staples, nothing planned Thursday".
- **ERA ← Trips** — re-entry briefing: "you're back tomorrow, N chores/routines resume".
- **Smart notification timing** — quiet hours + weekly digest instead of daily noise, driven from ERA's read of what actually matters.

### The bets, in order

1. **Harden the flagship** — intent-routing fixtures shipped _(HUB-1, 2026-08-22)_; voice graceful degradation still open (HUB-2). An Azure outage with no fallback is now the most damaging remaining failure to the product's identity.
2. **Briefing enrichment ← Schedule + Budget** — the biggest felt upgrade and the moat. Coordinate so both ends ship together.
3. **Decompose `HubPage.tsx`** — one pure-concern extraction per session, using `chatNotificationPolicy.ts` + its test as the template. Sustained, this reverses the growth curve without a risky big-bang; best done _as_ the substrate for in-chat briefings so the refactor buys a feature.

> Resist piling proactive features onto the intent router faster than you harden it — a confidently-wrong assistant erodes trust faster than a quiet one. Harden, then anticipate.

### Not now

- ❌ Don't pile proactive features onto the intent router faster than its fixtures grow.
- ❌ Don't decompose `HubPage.tsx` "just because" — do it with the briefing work.
- ❌ Don't add new Voice features before graceful degradation exists.
- ❌ **No further design studies until something proactive renders.** The Top View study is the last allowed spec artifact; execute WP-04 (briefing v0.5) first. Recorded as a decision, enforced by the meta-work budget rule.
- ❌ Don't re-decide wake-word vendors — that decision is closed (only openWakeWord viable).

## Acceptance Criteria Index

### HUB-1

- **Acceptance:** a table-driven fixture covers ≥30 utterances across money/item/shopping/ambiguous/hostile inputs, asserting intent + slots; a misrecognized intent clarifies instead of mis-acting; `pnpm test` green.

### HUB-2

- **Acceptance:** with no Azure connection the voice path degrades with a visible, non-crashing state, the wake-word setup is documented, and a degradation test exists.

### HUB-3

- **Acceptance:** ERA's briefing reads at least one of Schedule/Budget proactively and renders it — visibly smarter than reactive-only.

### HUB-5

- **Acceptance:** each extraction moves one pure concern out of `HubPage.tsx` with its own test, and the file's line count goes down rather than up in that session.

## Successor Briefing

**Who should read this:** you are about to touch Hub Chat, ERA, message actions or voice. This is a **Junction** — changes cascade into Budget, Items and Shopping List. It contains the app's largest file and its least-tested critical path.

**First 10 minutes:**

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/hub src/features/era src/features/voice-conversation src/components/hub src/app/api/hub src/app/api/ai-chat
npx vitest run src/features/hub/chatNotificationPolicy.test.ts    # 2 green expected
wc -l src/components/hub/HubPage.tsx                              # if >6,100, the growth curve worsened — note it
```

Then read the vault docs for every connected standalone you'll touch (Junction rule) → `src/features/hub/messageActions.ts` (the cascade surface) → the Top View study if doing anything proactive.

**Task-tier map:**

| Task archetype                                | Tier        | Route                                                                                                                                        |
| --------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat UI polish, thread list, badges           | any-model   | `ui-guardrails`; if the edit lands inside `HubPage.tsx`, extract first or keep the diff <30 lines                                            |
| A pure-policy extraction from HubPage (+test) | any-model   | copy `chatNotificationPolicy.ts` + its test — the sanctioned refactor ritual                                                                 |
| New notification-delivery rules               | mid-tier+   | change `chatNotificationPolicy.ts` **and** its test together; the policy is the only delivery truth                                          |
| New/changed intents, resolvers, formatters    | mid-tier+   | you are editing a money-adjacent router — extend `intents/rootIntentRouter.test.ts` (HUB-1) with a row for your intent as part of the change |
| Message actions (chat → transactions/items)   | mid-tier+   | Junction cascade: read the Budget + Items vault docs first; all mutations through drafts/proposal                                            |
| Voice pipeline, wake word, degradation states | human-first | vendor verdicts recorded; dead files pending deletion — don't "fix" them                                                                     |
| Proactive/briefing architecture               | human-first | the Awakening plan + Top View study are owner-approved contracts; execute WPs, don't redesign                                                |

**Out-of-depth tells — stop if:** you're adding a conditional inside `HubPage.tsx` instead of extracting; an AI response path writes to money/items without a draft; you're about to add a fourth conversation store; you're re-deciding wake-word vendors.

**Trap registry:**

| Trap                                    | Symptom                                               | Guard                                                                                       |
| --------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Private threads are delivery-excluded   | "notification never arrived" on private chats         | by design — check thread visibility before debugging cron                                   |
| Receipts vs policy duality              | dot shows but no push (or reverse)                    | two truth paths; check both before "fixing" either                                          |
| `AnalysisReport` is a JSON contract     | free-text AI answers break the dashboard              | the contract + deterministic fallback are the spec; never let the model improvise the shape |
| Focus briefing cache (module hard rule) | stale briefing after a data change                    | invalidate on the listed mutations                                                          |
| `safeFetch` timeout on AI calls         | app flags offline during long generations             | `timeoutMs: 60_000` on every AI route call (Hard Rule 6)                                    |
| Shopping list legacy queue              | offline shopping edits use the OLD localStorage queue | hub shopping list only — don't migrate it, don't add to it                                  |

**Verification manifest:**

| Claim                      | Command                                                                                                   | Expected                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Policy test green          | `npx vitest run src/features/hub/chatNotificationPolicy.test.ts`                                          | 2 pass                                                        |
| HubPage size               | `wc -l src/components/hub/HubPage.tsx`                                                                    | ≈5,978 (2026-07-18)                                           |
| Dead voice files           | `ls src/features/voice-conversation/sttCapture.ts src/features/voice-conversation/vadGate.ts 2>/dev/null` | present until deleted                                         |
| Intent fixtures exist yet? | `npx vitest run src/features/era/intents/rootIntentRouter.test.ts`                                        | 39 pass (HUB-1 landed 2026-08-22, same-day fix below; Test protection rescored 4) |
| ERA speaks first yet?      | `grep -rn "get_era_topview_bundle" src migrations/schema.sql`                                             | no hits = still pull-only                                     |

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [\_Conventions](../_Conventions.md)
- Contracts: [ERA Awakening — Master Execution Plan](<../ERA Awakening — Master Execution Plan (2026-07-06).md>) · [ERA Top View — Design Study](<../ERA Top View — Design Study (2026-07-17).md>)
- Vault: [Hub Chat](<../../03 - Junction Modules/Hub Chat/Overview.md>) · [AI Assistant](<../../03 - Junction Modules/AI Assistant/Overview.md>) · [Message Actions](<../../03 - Junction Modules/Message Actions/Overview.md>)
- Pre-consolidation originals (including the raw `ERAHUB.MD` planning transcript): `../_Archive/Hub & ERA/`

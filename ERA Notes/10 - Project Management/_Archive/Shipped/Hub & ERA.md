---
created: 2026-11-11
updated: 2026-11-25
type: archive
status: superseded
owner: Elio
---

# Hub & ERA — shipped work

> Written by `pnpm pm:ship`. Full receipts and acceptance criteria of completed Hub & ERA items, plus Master Book state-log entries older than the newest 3. The [Master Book](<../../Hub & ERA/Hub & ERA — Master Book.md>) keeps one dated line per item in its Shipped Log. Nothing under `_Archive/` is read by a PM tool.

## Shipped items

### HUB-114

- ✅ 2026-10-12 — **HUB-114** ERA DOT follows the sentence being typed: when the composer detects a capture ("Remind me to…"), the big DOT, background glow and toolbar mark switch to that module — reminders and events the Schedule clock, spends Budget, shopping Recipes; clearing the text restores the hub/face look. Phone swipe left/right on the content area steps ERA → Budget → Schedule → Recipes → Brain → Artifacts (AI Usage excluded; fields and sideways-scrolling strips keep their own swipes; active pill scrolls into view). Files: `CommandBar.tsx`, `EraShell.tsx`, `EraFaceNav.tsx`, `useEraStore.ts` (`captureModuleKey`), `features/era/swipeNav.ts` (+3 tests). Typecheck/lint green; browser-verified via DOM (hue 190→256 + clock cue on typing, swipe sequence + end stops + vertical ignored) on desktop with synthetic touches — not on a real phone.

### HUB-110

- ✅ 2026-10-11 — **HUB-110** ERA AI Usage tab (desktop only, next to Artifacts): one month at a time, a table per local day of the chats that reached the model (click → reopens the chat), AI calls (auto-escalations counted separately), input/output tokens and estimated $ cost, with month totals. Counts only the `ai_messages` receipts `/api/era/ask` writes per model call (`era-ask` + `era-ask-auto`), so native-only turns never count and escalated ones do; chats are linked through their `ai_answer` rows. Cost uses list prices per `model_used` (Claude Haiku 5.5 $0.10/$0.50 per 1M; legacy Gemini Flash assumed $0.30/$2.50); recorded input includes cache reads at the full rate, so Claude estimates lean high. Pre-Claude receipts left `model_used` null on the input row and are priced from their output row. No migration. Files: `api/era/ai-usage/route.ts`, `features/era/{aiUsage,useEraAiUsage}.ts`, `dashboards/AiUsageView.tsx`, `EraFaceNav.tsx`, `EraShell.tsx`, `useEraStore.ts`. 12 unit tests, typecheck green, desktop browser-verified against live October data; chat-link click and the phone viewport not exercised. *(Amended 2026-10-12: Haiku 5.5 calls with a prompt over 100K tokens are now priced at the long-prompt rate $0.50/$2.50 per 1M, paired per call from the input receipt; 13 tests.)*

### HUB-101

- ✅ 2026-10-10 — **HUB-101** ERA Artifacts view: browse by day (‹ › skip days with nothing, calendar greys them out), grouped by module in each module's ERA hue, and a persistent Undo/Redo per row derived from the row's live state (`POST /api/era/actions/status`; no stored flag, no migration). Reversal reuses the app's own soft-delete + Recycle Bin restore for reminders, events, contacts, places, drafts and transfers. Money fix: `/api/recycle-bin/restore` now re-applies transfer balances (it only cleared deleted_at, so every restored transfer left both accounts off), is compare-and-set against a double restore, and re-arms never-fired alerts that DELETE had switched off; `DELETE /api/drafts/[id]` now 404s a confirmed draft instead of reporting success. Files: `ArtifactsView.tsx`, `useEraArtifacts.ts`, `artifacts.ts`, `api/era/actions/{route,status/route}.ts`. Typecheck, lint and 488 targeted tests green (restore route 8 new); not browser-verified.

### HUB-84

- ✅ 2026-09-29 — **HUB-84** ERA Top Layer voice chat is off by default: mic icon toggles `voiceChatEnabled` (wake-word engine, fallback listener, Azure prewarm/greeting preload all gated); speaker stays opt-in via its icon. Files: `useEraStore.ts`, `EraShell.tsx`, `CommandBar.tsx`, `useConversationMode.ts`. Typecheck green; not browser-verified.
- ✅ 2026-09-27 — **HUB-84** follow-up from the owner's second test: "make it under Spinneys group" with nothing in focus now asks "Change what?" AND waits — chips list the newest open list items, and a typed name ("Salt") completes the edit; edits that name the item ("Move salt under spinneys group") find it on the list by name; "it" is rebuilt from the conversation's saved results after a reload (`focusRehydrate.ts`, 30-minute window). Tests: `amend.test.ts` (32), Gym pilot +2.
- ✅ 2026-09-27 — **HUB-84** Follow-ups edit the last result, whatever its type: typed focus memory, `followUp.ts` field parser, `amendLast` routing by referent type, edit contracts for shopping (group/quantity/rename/remove), drafts (amount/category, replace create-then-delete) and transfer cards (amount/destination → new Confirm card); group in the first sentence; "New group · X?" when none matches. Gym: fast path 90.1% held-out, zero wrong money effects (correction gap closed). Device witness in HUB-83. [Criteria](#hub-84).

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h07--explicit-consent-follow-ups-learned-choices-and-split-handoff>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** A follow-up edits the last result, whatever its type.

- **Acceptance:** "make it / put it / change it / under X / no, 15 / to savings instead / call it … / remove it" resolve against the most recent result of any type and apply through that type's edit contract; values resolve against real data (one → apply, several → chips, none → offer to create behind a card); Undo only where demonstrated; money keeps its tier; unsupported types get an honest limit, never a wrong-domain question; the same fields work in the first sentence.
- **Evidence:** `src/features/era/intents/resolvers/amend.test.ts` (27 cases incl. the owner's sequence and export sentence); Gym pilot 8 follow-up sequences; the old correction gap (`spent 12$` → `no, 15`) is closed, fast path zero wrong money effects.
- **Reading guide:** `focusMemory.ts`, `intents/followUp.ts`, `intents/index.ts` (`amendLast`), `intents/resolvers/amend.ts`, `resolvers/shopping.ts` (groups), `useEraTurn.ts` (`registerResultFocus`, Undo receipt).

### HUB-72

- ✅ 2026-09-26 — **HUB-72** Household Activity Log implementation: `/activity-log`, own hook/API/install manifest/icons, menu and Artifacts entry points, source triggers and permission-aware paged RPC. Covers 80 sources across Budget, Schedule/NFC, Chat, Kitchen, Catalogue, Trips, Healthcare, Outfits, ERA, Guest Portal, Notifications and Settings. 33 isolated database/API tests cover capture, privacy, parent inheritance, rollback/upserts, cursor/date bounds, raw-access denial, optional tables and reapplication. See [acceptance](<../../Hub & ERA/Hub & ERA — Master Book.md#hub-72>) for evidence and pending owner UAT; migration has **not** been applied to production.

### HUB-36

- ✅ 2026-09-02 — **HUB-36** removed the avoidable latency chain behind the owner-reported slow ERA Top Layer: established-thread message inserts are optimistic and serialized in a background per-conversation queue, so intent/model work no longer waits for the user row and text/TTS no longer wait for the assistant row; first-turn conversation creation remains correctly awaited for its required parent id. `/api/era/ask` now overlaps independent quota/rate-limit reads and request-hash/context work, `fetchBudgetContext` collapses eight sequential post-account reads into one concurrent layer, Schedule fetches items/tags together, and non-critical AI usage inserts run via Next `after()`. Command Bar replies now use Azure Speech SDK PCM sentence streaming (`useEraReplyTTS`) instead of downloading a complete `/api/tts` MP3 before playback, with browser `speechSynthesis` fallback. False Offline mode root cause fixed in `safeFetch`: its own timeout and caller abort are no longer classified as lost connectivity or queueable failures; a timeout launches a de-duplicated `/api/health` probe and only confirmed network failures transition global state. Regression coverage: `safeFetch.test.ts` + `connectivityManager.test.ts` + `ttsQueue.test.ts` (8 cases); typecheck and targeted tests green.

### 2026-07-10 · notification visibility policy

- ✅ 2026-07-10 — **notification visibility policy** (`0f33396`): `chatNotificationPolicy.ts` (33 lines, pure, **the cluster's first test file**) makes visibility the single choke point — private threads excluded from immediate push and cron fallback

### HUB-1

- ✅ 2026-08-22 — **HUB-1** intent-routing tests + graceful fallback (`src/features/era/intents/rootIntentRouter.test.ts`, 38 green) — new `clarify` Intent member (`ambiguous`/`weak`) threaded through `types.ts`, `intents/{index,budget}.ts`, `replyFormatter.ts`, `resolveIntent.ts` and `CommandBar.tsx`; a misrecognized intent now asks the user to clarify instead of firing a wrong action. `spent 2 hours studying` no longer drafts a transaction; a weak money word no longer confidently switches faces; a multi-face utterance routes to `clarify` instead of letting fixed FACE_KEYS order decide. `pnpm test` green (1697), no new deps [Owner UAT draft, 2026-10-25](<../../../../docs/Delivery-UAT-Legacy-Attempts-2026-10-25.md#l4--hub-1-ambiguous-words-do-not-save-the-wrong-action>); historical result unchanged.

### 2026-08-22 · HUB-1 follow-up

- ✅ 2026-08-22 — **HUB-1 follow-up** post-delivery review caught two false negatives in the same-day landing: the flat cross-face fallback let a bare `switchFace` keyword echo tie with a fully slot-filled intent ("remind me to buy dinner ingredients" wrongly went to `clarify/ambiguous` instead of `draftReminder`), and the active face's own weak `clarify` short-circuited before other faces' routers ran at all ("remind me to buy groceries" with Budget active never reached schedule). Fixed in `intents/index.ts` by tiering cross-face hits (slot-filled kinds beat bare `switchFace`) and letting a weak local `clarify` step aside for a stronger cross-face hit. One row corrected, one row added to the fixture (39 green). `pnpm test` green (1699), no new deps

### HUB-12

- ✅ 2026-08-22 — **HUB-12** ERA Phase 2 intents: `draftReminder`, `showAnalytics`, and `draftTransaction` all resolve for real. Three intents had been reaching `resolveIntent`, falling through to `replyFormatter`'s "Coming soon" string and writing nothing — the worst failure shape in the taxonomy, since the reply reads like success. Now: `draftReminder` → `POST /api/items` via `resolvers/schedule.ts` (`parseSmartText` for title/date/recurrence, `localToISO` for the UTC instant, **`due_at` omitted entirely when `confidence.date === 0`** so we never invent a due time that fires an alert immediately); `showAnalytics` → `GET /api/analytics?months=2` summarizing the current month with a top-3 category list and a month-over-month delta; `draftTransaction` moved **off** its parallel CommandBar path onto the resolver, with `useEraBudgetSubmit.submit` injected as a `ResolveDeps` capability so the Undo toast (Hard Rule #1) and cache invalidation stay exactly where they were while the dispatcher becomes the single owner of "intent → reply". Reply and side effect can no longer disagree: a failed draft now says so instead of returning "Drafting $25.00…". New fixture `src/features/era/intents/resolveIntent.test.ts` (14 green). `pnpm test` green (1715), typecheck clean, no new deps

### HUB-15

- ✅ 2026-08-22 — **HUB-15** ERA stopped reading from a script. Every reply was a single hardcoded string, so the fifth reminder of the day came back word-for-word identical to the first — the tell that collapses the illusion of an assistant that's listening. New `src/lib/era/phrasing.ts` holds the mechanics (`pick`/`fill`/`say`, `describeWhen`, `money`, `plural`, `listOut`, `errorReply`, time-aware `greeting`) and every situation across all four faces now owns a **pool** of slot-templated phrasings drawn at random — ~40 pools, 4–10 variants each, covering reminders, schedule, spend, analytics, drafts, recipes, memory, greetings, clarify/unknown and the in-flight interstitials. Lives in `src/lib/` because ERA and voice-conversation are both standalone feature dirs and may not import each other. Four rules are written into the module header and enforced by test: **every variant carries the same facts** (variation is connective tissue only), slots rather than concatenation, no personality-of-the-day, and an error's *diagnosis* is never randomized — only its apology and retry nudge. New fixtures `src/lib/era/phrasing.test.ts` (23) and a variant harness in `resolveIntent.test.ts` that drives `Math.random` across its range, collects every sentence a pool can emit, and asserts the payload survives in **all** of them (a future "breezier" variant that drops the due time or the amount fails). `pnpm test` green (1741), typecheck clean, no new deps

### 2026-08-22 · HUB-15 fallout

- ✅ 2026-08-22 — **HUB-15 fallout** building the pools surfaced four defects in the phrasing engine, all caught by the sample harness before shipping: `fill` orphaned a separator when a slot was empty (`"one,."`, `"one —."`); it inserted a space in front of *every* slot, so `"{Title}"` rendered `" Water the plant"`; fixing that naively removed the space where a template deliberately wrote the slot flush so an empty one left no gap, giving `$25under Car / Fuel` — resolved by keeping a template-written space, and otherwise adding one unless the slot sits at the start or against an opening delimiter; and `money()` with `minimumFractionDigits: 0` rendered `$1,240.5`, which reads as a typo. Also fixed: sentence-casing after an opener that ends in a full stop (`"Checked. in August…"`), `lowerFirst` de-capitalizing the pronoun "I", and plural disagreement in two schedule pools used only when count > 1 ("There's 3 things due today")

### 2026-08-22 · HUB-12 title fix

- ✅ 2026-08-22 — **HUB-12 title fix** the schedule router had been copying the whole utterance into the reminder title, so "remind me to call the bank" created an item literally titled "remind me to call the bank". It now stores `parseSmartText`'s cleaned title. Doing so exposed a latent bug in `smartTextParser.extractTitle` shared with **MobileReminderForm and BulkConvertReviewSheet**: every optional filler word in the lead-in strippers was unanchored, so the group ate the *prefix* of the real first word — "remind me tomorrow" titled the item **"Morrow"** and "schedule an appointment" became **"N appointment"**. Fixed by anchoring each optional group with `\b` (13 patterns). Three rows in `rootIntentRouter.test.ts` updated from raw to clean titles

### HUB-23

- ✅ 2026-08-26 — **HUB-23** ERA "Ask AI" (Slice 4, delivers WP-10): the manual escape hatch for when the deterministic router can't handle a request — a sparkle button in `CommandBar`, always visible, never auto-triggered (locked decision). `fetchBudgetContext`/`fetchMonthlyTrend` were extracted verbatim from `api/ai-chat/route.ts` into `src/lib/ai/context.ts` (Next.js route files can only export HTTP methods, so anything meant for reuse — this is now the SECOND consumer, `/api/era/ask` — has to live in `lib`); a new `fetchScheduleContext` gives the schedule face upcoming items + every NFC tag with its declared states and live `current_state`. `src/lib/ai/eraAskProposal.ts` asks Gemini for structured JSON — either `{kind:"prose"}` or `{kind:"propose_nfc_reminder", reminderTitle, nfcTagId, targetState}` — using the exact same three-layer pattern `analysisReport.ts` established: `responseSchema` constrains the shape, Zod validates it, and critically, **the model's `nfcTagId`/`targetState` are never trusted blindly** — `parseAskAIResponse` degrades to plain prose unless they match a real tag in `ScheduleContext`, so a hallucinated identifier can never reach a confirm card, let alone a write. This directly answers the owner's own worked example: "remind me when I arrive home" has no date for `parseSmartText`, so Slice 3 now asks "when should I remind you?" — tapping Ask AI instead of answering resends that same sentence to Gemini with the household's real NFC tags in context, and (if a tag plausibly matches) renders a confirm card; Confirm performs the two deterministic writes (`POST /api/items` then `POST /api/items/[id]/prerequisites`) only after the tap — the model never writes anything itself (Doctrine Q10). One proposal kind shipped, deliberately (HUB-24) — this is the owner's real scenario, not a framework built ahead of a second use case. New `src/lib/ai/eraAskProposal.test.ts` (13 cases) pins the safety gate directly: a well-formed proposal naming a tag that doesn't exist degrades to prose every time, and a forced model failure/malformed response never throws and never proposes. `pnpm test` green (1903), typecheck clean, 0 new lint issues, no new deps.

### HUB-20

- ✅ 2026-08-26 — **HUB-20** Meal planning joins ERA (Slice 5): three new Chef intents — `listRecipes` ("what recipes do I have"), `assignMeal` ("assign chicken to thursday dinner" → resolves the dish against `/api/recipes`, the day against the existing `parseSmartText` day-of-week logic reused rather than writing a second parser, and upserts via `POST /api/meal-plans`, which already updates-in-place on a taken slot and already 400s with a clear message when there's no household — this resolver surfaces that message instead of re-deriving the household check), and `mealPlanGaps` ("what's unassigned this week" → the next 7 days with no `meal_plans` row at all, pure client compute over one fetch, no new aggregation engine). Dates are never parsed into `Date` objects from bare strings — `formatDate()` (local calendar fields) builds the query range and `` `${date}T12:00:00` `` anchors the display label — the module's documented UTC-midnight-drift trap. New tests in `resolveIntent.test.ts` (7 cases) caught exactly that trap once, in the TEST itself: a first draft used `.toISOString().slice(0,10)` to build mock `planned_date` values and silently dropped a day in this environment's timezone. `pnpm test` green (1886), typecheck clean, 0 new lint issues, no new deps.

### HUB-19

- ✅ 2026-08-26 — **HUB-19** Reminder time becomes a required slot (Slice 3): `resolveDraftReminder` no longer writes an undated item when `parseSmartText` finds no date — it asks ("Got \"Call the bank\" — when should I remind you?") and returns a `pending` question. A new `EraPendingTurn` (one shape, one missing slot — `title`) lives in `useEraStore` (in-memory only; a reload loses it, same as any other browser state) and `useEraTurn.runTurn` checks it before the normal router: if a question is outstanding, the WHOLE next utterance is handed to `resolvePendingReminderAnswer` as the answer, never reclassified as a fresh command. A date-shaped answer ("tomorrow at 4pm") completes the reminder through the same write path as a one-shot request; anything else flushes the title to a reviewable `items.status = 'draft'` row — the same rule bulk-convert already uses — rather than losing it or misreading it as an unrelated command. This directly answers the owner's own complaint: ERA previously "logged the reminder without mentioning the time" and moved on; now it either gets a real time or the item waits in Drafts for one. Deliberately NOT built: a general multi-slot framework, or handling the case where the "answer" is actually a genuinely new unrelated command (that command gets treated as a failed time-answer and flushes the pending reminder to draft — a known, documented rough edge, not a silent gap). `resolveIntent.test.ts` gained a `resolvePendingReminderAnswer` suite (3 cases) plus two rewritten `draftReminder` tests (the old "omits due_at" and "never implies a nudge" tests asserted the now-removed undated-write behavior). `pnpm test` green, typecheck clean, no new deps.

### HUB-18

- ✅ 2026-08-26 — **HUB-18** Budget capability set (Slice 2): four new intents — `transfer` ("transfer $50 from wallet to savings", self-transfers only, fuzzy account-name matching against the user's own accounts, direct write via the existing `POST /api/transfers` + its already-correct `DELETE` inverse), `recordDebt` ("John owes me $30 for lunch" → `POST /api/debts/standalone`, a pure receivable with zero balance effect at creation or settlement, deliberately not the linked-transaction debt flow which needs an account the router can't reliably parse from one utterance), `listDrafts`, and `confirmDraft` (confirms via the same `PATCH /api/drafts/[id]` the Drafts drawer uses, which overwrites the row rather than partial-patching — this resolver re-fetches the draft's full fields and echoes them back unchanged except `is_draft`). Also fixed in the same session: **HUB-13** (`showAnalytics` now re-sources its headline expense/transactionCount/top-categories from the same custom-billing-month `/api/transactions` window `monthSpend` uses, instead of `/api/analytics`'s calendar-month bucket — income/savings-rate and the previous-period comparison deliberately stay calendar-based, a narrower fix, not a re-architecture) and **HUB-14** (`/api/transactions` has no server-side scope filter at all — it always returns both household members' rows tagged with `user_id` — so "partner" scope was quietly returning the household total under a "your partner has spent" label; now scoped client-side from data already fetched, zero extra round trips, and "self"/"partner" without a resolvable current-user id return an honest error instead of a mislabeled household number). `resolveIntent.test.ts` gained 5 cases for HUB-13/14 and router fixtures for all four new intents. No Undo toast on transfer/recordDebt/confirmDraft — same precedent as `draftReminder`: a real, immediate write confirmed by the spoken reply, undoable from each module's own page. Deliberately deferred: debt *settlement* (no clean Undo inverse exists via the current API — PATCH only supports incremental settlement, not restoring a prior state), expense-split, recurring add/skip (tracked as HUB-22). `pnpm test` green, typecheck clean, 0 new lint issues, no new deps.

### HUB-17

- ✅ 2026-08-25 — **HUB-17** ERA Hub (`/era`) voice had never actually worked: `EraShell` mounted `useConversationMode` with only `onWillSpeak` wired, so `conversationEngine.executeNativeIntent` optional-chained through five missing handlers and then spoke `successTemplate(intent)` unconditionally anyway — "Added $25 to Fuel" while writing nothing, for every native voice intent on the app's own flagship page. Fixed by adding an optional `runTurn?: (text) => Promise<{reply, kind}>` to `ConversationHandlers` (`conversationEngine.ts`) that replaces the legacy five-callback path when present; `EraShell` wires it to a new `src/features/era/useEraTurn.ts` — the same hook `CommandBar` now calls for typed input, so both surfaces run one classify (`rootIntentRouter.parse`) → one resolve (`resolveIntent`) → one persist (`era_messages`) path and cannot disagree on a reminder's due time or a draft's fate. The legacy `/chat` path (`HubPage.tsx`, untouched) got the same false-success fix defensively but keeps its own `classifyIntent`/`speechTemplates.ts` — that's HUB-16, now correctly scoped to `/chat` only. Also: the single-line `eraReply` display became `EraThreadTranscript`, a scrollable multi-turn view of `era_messages` (the owner's ask — "not only a single response, but a full conversation thread"), typewriter effect scoped to the newest row only via a ref-based guard (a state-based guard was tried first and re-triggered the effect on its own update, killing the interval a tick after it started — caught before shipping by adding temporary trace logging and reproducing live). Six confirmed-zero-importer components deleted (`FaceCanvas`, `EraHubView`, `QuickFaceChips`, `EraFaceCard`, `FacePlaceholder`, `FaceHeader`, `EraTranscript`); dead `useEraStore.turns`/`pushTurn`/`clearTurns`/`eraActions` removed. `pnpm test` green (1861, +0 new — no new test file; existing `rootIntentRouter.test.ts`/`resolveIntent.test.ts` are the regression net for the unchanged classify/resolve logic this reuses), typecheck clean, 0 new lint issues, no new deps. Verified live against the dev DB via the actual `/era` UI: a real reminder ("remind me to call the bank tomorrow at 4pm") saved with correct `due_at`, `monthSpend`/`todaySchedule` resolved correctly — then removed via the app's own delete endpoint (Hard Rule 26: no direct DB writes, even to clean up test data)

### HUB-11

- ✅ 2026-08-06 — **HUB-11** per-message color tags + color filter (`hub_messages.color`, `src/features/hub/messageColors.ts`) — compose-bar palette picker (sticky per-thread), long-press-to-recolor, header filter button; Multi-add's "Select all" now scopes to the active color filter so a mixed budget thread can be swept color-by-color instead of in one undifferentiated pass (migration `2026-08-06_hub-message-color.sql`, pending manual run)

### HUB-25

- ✅ 2026-08-27 — **HUB-25** `/era` Activity log (owner request: "an inbox... showing everything the application created/updated... history of today", worked example was "remind me to water the plant" leaving no trail back to the reminder). New `era_actions` log table (migration `2026-08-26_era-actions.sql`, **pending manual run**) + `POST/GET /api/era/actions`; a single logging point (`src/features/era/logEraAction.ts`) maps each of ERA's 8 write-producing intents (`draftReminder`, `confirmDraft`, `draftTransaction`, `transfer`, `recordDebt`, `assignMeal`, `memorySave`, plus the Ask-AI NFC-reminder proposal confirm) to a title + deep-link route, called from `useEraTurn.runTurn` and `useEraAskAI.confirmProposal` — never from inside a resolver, so the mapping has exactly one owner. New `useEraActivity` hook filters to the caller's local "today" client-side (server has no reliable local timezone to filter by). Deep-linking required real wiring, not just a route string: `WebDayPlanner` gained an `initialOpenItemId` prop that fetches the item directly via `useItem` and opens `ItemDetailModal` regardless of which day-section it's in (reminders had no query-param deep-link at all before this); `WebDashboard` gained the same for transactions (`openId` search param → reuse the already-loaded page's row, or fetch `/api/transactions/[id]` and map it into the modal's `Transaction` shape). Transfers/debts still have no per-record detail view anywhere in the app, so their Activity rows land on `/expense` without opening anything — a real gap, not silently glossed over. **Surfaced as a new "Artifacts" chip in `EraFaceNav.tsx`** (`ArtifactsView.tsx`, a new dashboard alongside Budget/Schedule/Chef/Brain — `useEraStore`'s `EraView` gained a third `"activity"` value) — deliberately additive, not a redesign. *(Correction: this landed first as a full hub-layout redesign — orb shrunk to a top-left icon, scatter widgets turned into a grid, the "ERA" pill removed — which the owner explicitly rejected: "Oh hell no! Revert the Initial view! Just add an additional chip on top... YOU MUST REVERT TO HOW IT WAS WITH THE ANIMATION AND EVERYTHING!" `EraShell.tsx`/`EraFaceNav.tsx`/`HubScatterWidgets.tsx` were reverted to their pre-session state via `git restore` and the Activity feature re-shipped as the chip described above. Lesson captured in memory `feedback-no-unrequested-ui-redesign`.)* No new deps.

### 2026-08-27 · HUB-25 fix

- ✅ 2026-08-27 — **HUB-25 fix** Activity reminder deep-link 404'd — `logEraAction.ts` built `/items?openId=...` but Items/Reminders has always lived at `/reminders` (no `src/app/items/` route ever existed). Both routes in `buildPayload`'s `draftReminder` case and `logEraNfcReminder` corrected to `/reminders?openId=...`. Any `era_actions` row logged before this fix still carries the stale `/items` route and will 404 until superseded (not rewritten — Hard Rule #26, no direct DB writes).

### HUB-26

- ✅ 2026-08-27 — **HUB-26** Named-day schedule queries answered for the wrong day (Stage 0 of the ERA conversational-context plan, `.claude/plans/is-something-like-that-graceful-clock.md`): "what's on my schedule Saturday?" always answered for TODAY because `scheduleRouter`'s regex matched on the generic word "schedule" and never looked at the day named in the sentence. `todaySchedule` gained an optional `dateISO` slot the router now fills from `parseSmartText` (reusing its day-of-week/relative-date parsing — a second parser was not written); `resolveScheduleForDay` replaces `resolveTodaySchedule`, rebuilt on `fetchItems` (the same household-resolved `get_schedule_bundle` RPC bundle the day planner uses, newly exported from `useItems.ts`) and `getOccurrencesForDay` (same occurrence-expansion the day planner uses, via a newly-exported `fetchAllOccurrenceActions`) so ERA and the Schedule module read the identical source of truth and can't disagree. The reply changed shape too, per the plan's own acceptance bar ("return actual schedule items and times instead of only a count") — `formatScheduleForDay` now lists each item's title and local time; overdue stays a today-only concept (skipped for a named future/past day) and the "clean slate" pool is reserved for the true empty-today-and-nothing-overdue case, not just an empty named day. Caught mid-build: `parseSmartText`'s type detector reads "schedule" as an EVENT noun, which routes its parsed date into `startDate` instead of `dueDate` — both the router's day extraction and the reschedule resolver (HUB-27) fall back to `startDate`/`startTime` when `dueDate`/`dueTime` are empty, rather than silently losing the parse. New fixtures: a named-day router row (asserts day-of-week, not an exact date, since "Saturday" is relative to whenever the suite runs) and three `resolveScheduleForDay` cases in `resolveIntent.test.ts` (named-day items surface, a different day's items don't leak in, honest error when no user). `pnpm test` green (1926), typecheck clean, 0 new lint issues, no new deps.

### HUB-27

- ✅ 2026-08-27 — **HUB-27** Capability registry + focus memory (Stage 1 of the same plan) — the two building blocks the plan's other worked example needed: `"Remind me to water the plants Saturday at 10." → "Change it to 11."` failed before this because ERA had no reschedule capability at all AND no memory of what "it" meant. New `src/features/era/focusMemory.ts` (pure, no DB) holds the last 10 entities ERA created/touched, 30-min TTL, newest-first, de-duped by id; `resolveFocusRef` implements the design doc's resolution order for what Stage 1's router can actually supply — a pronoun (it/that/this/that one/this one) resolves to the most recent live entity of the required type, and returns `null` (never a guess) when nothing qualifies, matching "never guess when multiple valid entities exist." `useEraStore` gained `focusEntities` + `pushFocusEntity`; `useEraTurn.runTurn` pushes the touched reminder after a create/reschedule/complete (never a delete — a deleted item should fall OUT of focus). Three new intents reuse focus memory: `reminderReschedule` ("change it to 11" — a bare time keeps the reminder's OWN existing date and only shifts the time, since defaulting to today could silently move something backwards; a full date+time overrides both), `reminderComplete` (non-recurring only — occurrence-safety guard: a chat pronoun can't disambiguate WHICH occurrence of a recurring item, so those are pointed at the app instead of guessed), `reminderDelete` (soft-delete via the existing Recycle-Bin route). All three are deliberately pronoun-GATED in the router regex (`\b(?:change|move|push|reschedule|shift)\b...\b(?:it|that|this)\b`), not verb-gated — "move" also means transfer money or move a meal, so requiring the pronoun is what stops "move $100 to savings" and "move dinner to Wednesday" from colliding with Budget's and Chef's own vocabulary (regression-tested). New `src/features/era/capabilities/` (Layer 4 from the plan's architecture): `EraCapability` interface + a 5-entry registry (`schedule.forDay`, `reminder.create/reschedule/complete/delete`) that wraps these resolvers with Zod slot schemas — not consumed by the deterministic router (which calls resolvers directly, unchanged), but the substrate Ask AI (Stage 3, not built this session) will validate structured proposals against instead of trusting a model to invent both the action and its shape. Deliberately deferred: `reminder.setRecurrence` (the plan's own caveat — "only if the backend already supports it" — updating a recurrence rule via chat needs occurrence-aware handling, a recurrence-safety-gated addition, not a small one) and Stages 2–5 (queued below as HUB-28..31). New fixtures: `focusMemory.test.ts` (17 cases, pure), `capabilities/registry.test.ts` (8 cases, schema contract), plus router + resolver cases for all three new intents including the two cross-face regression tests above. `pnpm test` green (1968), typecheck clean, 0 new lint issues, no new deps.

### 2026-08-31 · HUB-27 enhancement: named-target support

- ✅ 2026-08-31 — **HUB-27 enhancement: named-target support** — Stage 1's three reminder intents now also accept named targets, not only pronouns. `src/features/era/intents/schedule.ts` gained fallback patterns for `reminderReschedule` ("Move dentist reminder to 5"), `reminderComplete` ("Mark dentist done"), and `reminderDelete` ("Delete dentist reminder") by extracting the named target and resolving it via `resolveEntityRef` (the same fuzzy-title matcher the template learner uses). Each fallback tries pronouns first (recent context wins), then falls back to named-target matching; if the name is ambiguous or not found, `resolveEntityRef` returns `null` and the router gracefully falls through to Ask AI / clarify instead of guessing — the same "never guess when ambiguous" rule both surfaces already enforce. Reuses existing `resolveEntityRef` from `focusMemory.ts` (imported, no new logic). No new tests, relies on existing `rootIntentRouter.test.ts` and manual verification against live DB (Stage 1 regression). `pnpm test` green (1926), typecheck clean, 0 new lint issues, no new deps.

### 2026-08-27 · HUB-28..31

- ✅ 2026-08-27 — **HUB-28..31** ERA conversational-context plan, Stages 2–5 — the loop the owner's plan aimed for: *native miss → Ask AI → map to existing capability → ERA validates → execute → learn phrasing → similar future request works natively without AI.* Built on HUB-26/27's capability registry and focus memory, all four stages in one session:

### 2026-08-27 · HUB-28..31 fix

- ✅ 2026-08-27 — **HUB-28..31 fix** own real-usage testing of the session above surfaced a pre-existing routing bug (not caused by the new work — Layer 2 only runs after Layer 1 misses, and neither router file had been touched): `"what's on my schedule this Saturday"` asked with a non-schedule active face returned `clarify: ambiguous` instead of answering, and the bare word `"Schedule"` returned `unknown`. Root causes: `brainRouter`'s `RECALL_PATTERNS[0]` (`/^what(?:'s| is| was)\s+.../`) is broad enough to match almost any "what's X" question as a memory recall, so it collided with `scheduleRouter`'s legitimate `todaySchedule` match whenever Schedule wasn't ALREADY the active face (the existing "named-day schedule query" fixture only ever ran with `active: "schedule"`, which short-circuits before the cross-face ambiguity check runs — it never actually exercised this path); and `scheduleRouter`'s generic face-switch word list had every schedule-domain noun except the word "schedule" itself. Fixed with a new `OTHER_DOMAIN_RE` guard in `brain.ts` (recall patterns skip entirely when schedule/budget/chef vocabulary is present — mirrors each face's own trigger words rather than inventing a parallel list) and adding "schedule" to `scheduleRouter`'s generic switch. Two new root-router regression rows in `rootIntentRouter.test.ts` reproduce the exact reported conversation with a non-schedule active face (the case the old fixtures missed). `pnpm test` green (2017), typecheck clean, 0 new lint issues, no new deps. HUB-28–31's own behavior untouched.

### HUB-32

- ✅ 2026-08-27 — **HUB-32** mobile-only design pass on `/era` (owner: pill nav was clipping "Artifacts" with no way to reach it, the orbital ring rendered as an off-center oval, and a module dashboard's floating CommandBar + transcript ate most of a phone screen with an oversized empty gap above it). Desktop (`md:`+) untouched throughout — explicit owner constraint, verified structurally (every change gated by a `md:` Tailwind class or the existing `useIsMobile()` 768px flag) since this session's browser tooling couldn't force a real ≥768px viewport to screenshot. Fixes, all in `src/components/era/`: (1) `EraFaceNav.tsx` pill row gained `overflow-x-auto scrollbar-hide` + `shrink-0` on every pill so it scrolls instead of clipping; (2) `EraShell.tsx`'s mobile ring — root cause was `transform: translate(-50%,-50%)` used to center it, but `.era-hub-ring-inner`'s own `era-orbit-breathe` CSS animation owns the `transform` property outright and silently discards any inline transform value, which is what produced the off-center oval; fixed by giving the wrapper an explicit `160×160` box and centering the ring with `inset` math instead (never touches `transform`); (3) `dashboardTop` was computed from the desktop 3-ring block's height (`RING_H=500`) on every breakpoint — added a `RING_H_MOBILE` constant so mobile's much smaller single-ring mark doesn't over-reserve space above the dashboard; (4) new `EraChatDrawer.tsx` — mobile module/activity views now hide the floating CommandBar/transcript behind a chat-bubble FAB that opens a bottom sheet (confirmed with the owner over a bottom-sheet-vs-side-panel choice); `CommandBar` and the newly-exported `EraThreadTranscript` both gained a `variant?: "floating" | "embedded"` prop so the sheet reuses their mic/send/AI/realtime logic verbatim instead of duplicating it — `"floating"` (default) renders byte-identical to before. Caught and fixed during live testing: the sheet's close button correctly flipped React state (`open:false`, confirmed via the fiber's `memoizedProps`) but never unmounted — `AnimatePresence`'s exit-complete tracking was getting interfered with by the still-mounted embedded transcript's own re-renders (realtime messages, typewriter interval) while it was mid-exit, leaving a stuck, invisible, click-through-inert node forever. Fixed by dropping `AnimatePresence` for the backdrop/sheet entirely — they stay permanently mounted (only while the drawer is even eligible to show) and animate via `open` directly (`animate={{y: open?0:"100%"}}`, `pointerEvents: open?"auto":"none"`), which sidesteps exit-completion callbacks altogether. `pnpm typecheck` clean, `pnpm lint` 0 new warnings; live-verified via Chrome automation at a 390×844 viewport (pill scroll, ring centering via `getBoundingClientRect`, dashboard spacing, drawer open/close/send round-trip through `useEraTurn`) — no component tests existed for these UI files before or after (matches sibling era components, which are logic-tested, not UI-tested). *(Follow-up same day: the ring was still off-center horizontally relative to the "Good afternoon" greeting, spotted by the owner from a screenshot. Root cause: the 160×160 ring wrapper is a plain block box inside a WIDER shared parent — sized by the greeting text's own wrapped-line width, not by the ring — so it defaulted to flush-left instead of centered, while the greeting text only *looked* centered because `text-align:center` centers text within that same wide box. One-line fix: `mx-auto` on the wrapper. Re-verified — ring/mark/greeting/viewport centers all land on the same x-coordinate via `getBoundingClientRect`.)*

### 2026-08-27 · HUB-32 polish

- ✅ 2026-08-27 — **HUB-32 polish** owner liked the mobile chat-bubble FAB's (`EraChatDrawer.tsx`, from HUB-32 above) module-hue color but wanted it glossy/gradient instead of flat — `background` changed from a flat `var(--era-accent)` fill to a 3-stop `linear-gradient` still driven off the same `--era-hue`/`--era-sat`/`--era-lum` vars (so it keeps tracking the active module color), plus an absolutely-positioned specular highlight overlay and a layered `boxShadow` (ambient hue-tinted glow + inset top/bottom sheen) for a raised, glassy look. Not live-verified in-browser this session (owner flagged as worth a follow-up check).

### 2026-08-27 · owner-reported bug fix: "Transfer 2$ from my account to drawer" never…

- ✅ 2026-08-27 — owner-reported bug fix: `"Transfer 2$ from my account to drawer"` never transferred anything — ERA replied only "Switched to Budget." Root cause: `budgetRouter`'s transfer regex (`intents/budget.ts`) required the `$` to precede the digits (`\$?(\d+...)`), so a trailing-symbol amount ("2$") never matched; the utterance then fell through every other pattern (no spend verb, so no `draftTransaction` either) until the generic domain-noun check matched "account" and fired a bare `switchFace` to Budget with no write. Fixed by making the currency marker optional on both sides of the digits, mirroring `extractAmount`'s existing token shape. New regression row in `rootIntentRouter.test.ts` ("transfer with trailing dollar sign on the amount"). `pnpm vitest run rootIntentRouter.test.ts` green (65/65), no new deps. `recordDebt`'s regex had the same leading-`$`-only gap — fixed in HUB-35, below.

### HUB-33

- ✅ 2026-08-31 — **HUB-33** closed the four real gaps in HUB-27..31's "native miss → Ask AI → learn → native next time" loop that a fresh audit found (owner asked to revisit the whole pipeline against the original spec — see the session's own plan file, `i-need-to-revisit-optimized-rocket.md`, for the full before/after map):

### HUB-34

- ✅ 2026-08-31 — **HUB-34** two verified defects in HUB-33's taught-template loop, surfaced by an owner-requested second-opinion review of the whole pipeline (checked claim-by-claim against the code first — most of the review's other suggestions, e.g. new `slot_types`/`confidence`/`specificity` columns, were speculative or already true and deliberately NOT taken; see the session's own plan file for the full accept/reject table):

### HUB-35

- ✅ 2026-08-31 — **HUB-35** native-router coverage + collision hardening pass across all three per-face Layer 1 routers (`intents/{schedule,budget,chef}.ts`), requested as a standalone audit rather than a bug report. The HUB-27 named-target enhancement (same day) had shipped with no new tests; this pass closed the gaps that left plus two money-wrong false positives and several unguarded cross-face collisions:

### HUB-73

- ✅ 2026-09-27 — **HUB-73** Unified message selection for bulk add/delete, deletion scope with Undo, and a compact mobile thread header. Typecheck passed; authenticated mobile runtime acceptance pending. [Criteria](#hub-73).

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h09--household-chat-selection-phone-composer-and-voice-time>) (drafted 2026-10-25; original results and remaining engineering gates retained).

- Long press a Budget or Reminder message, select several visible rows, and review them through Add all. Selection also offers Delete all; delete scope distinguishes personal hiding from deleting own messages for everyone. Undo restores either action.
- At 390 px, the thread title, search and Chat options remain on screen; selection controls occupy their own row without horizontal clipping. The new chat button remains visible in the thread list.
- Repository evidence: `pnpm typecheck` clean on 2026-09-27. Device and authenticated end-to-end verification remain pending.

Item plans use the [execution-plan convention](<../../_Conventions.md#9-item-execution-plans>). Read only the selected ID, its declared dependencies and relevant source; planning does not certify deployment or mark work complete.

### HUB-74

- ✅ 2026-09-27 — **HUB-74** Replaced the layered mic/send/fallback controls with one 48px action, allowed the input to shrink, removed the duplicate conversation toggle from the row, and aligned voice recorder controls. Voice upload now uses `safeFetch` with a 60-second timeout and an Undo action. Typecheck and changed-file lint pass; device visual acceptance pending. [Criteria](#hub-74).

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h09--household-chat-selection-phone-composer-and-voice-time>) (drafted 2026-10-25; original results and remaining engineering gates retained).

- At 320–390 px, the color control, message field and 48px action remain on screen. Empty Budget/Reminder input shows Mic; entered text shows Send; sending disables the action while pending.
- Voice recording keeps Cancel, waveform/timer/pause and Send within the same width. Upload uses `safeFetch` with a long-call timeout, and Undo removes the returned message ID. The fixed composer leaves room for the device safe area and for the last message to scroll above it.
- Repository evidence: typecheck and changed-file lint pass on 2026-09-27; authenticated device visual verification is pending.

### HUB-75

- ✅ 2026-09-27 — **HUB-75** One shared amount extractor (`src/lib/nlp/amount.ts`) for ERA's budget router, Hub `messageTransactionParser` and the voice classifier: `12$`, `300$`, `4$`, `500k lbp` (500000 native LBP), `20 euros`; transfer/debt grammars read the same phrase. Verbless marked capture (`coffee 4$`) drafts only on the Budget face. ERA drafts a marked amount only on an own account in that currency and asks "Which currency?" for an unmarked `k` amount on a non-LBP default. Evidence: `amount.test.ts` + router rows; full suite 3160 passed; typecheck clean. Drift corrected: the acceptance's "stored under the LBP-in-thousands rule" is wrong — accounts store native amounts; thousands applies only to the exchange rate and LBP-change field. [Criteria](#hub-75).
- ✅ 2026-09-27 — **HUB-75** follow-up from the HUB-77 Gym: 🔴 `paid $2,000 for rent` drafted $2 because `parseSpeechExpense` (the draft write path and the mic) split thousands commas — fixed in its tokenizer; verbless capture no longer drafts `I took 300$ from Drawer` or `make it 20$ instead`. Regression rows in `amount.test.ts` and the router suite; Gym B gate has zero non-gap wrong money effects.

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h04--dollar-suffixes-and-lbp-thousands-produce-the-right-draft>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA reads suffix-currency and `k`-thousands amounts through one shared amount extractor.

- **Acceptance:** `spent 12$ on coffee`, `paid 300$` and `coffee 4$` parse to 12/300/4 on every face that reaches the budget router. `500k lbp groceries` gives 500,000 LBP, stored under the LBP-in-thousands preference rule *(corrected 2026-09-27: accounts store native amounts, so it is 500000 on an LBP account; the thousands rule covers only the exchange rate and LBP-change field)*. `spent 2 hours studying` and `I bought 2 shirts` still create no draft. ERA and Hub chat share one extractor instead of two regex copies.
- **Money math:** parsing only. Account $100 plus `spent 12$ on coffee` gives one $12 expense draft, and the balance stays $100 until the draft is confirmed.
- **Gate:** existing `rootIntentRouter.test.ts` and `messageTransactionParser` tests pass, with added rows for `12$`, `300$`, `4$`, `500k lbp` and the non-money counterexamples.
- **Reading guide:** `src/features/era/intents/budget.ts` (`MARKED_AMOUNT_RE`, `extractAmount`) and `src/lib/nlp/messageTransactionParser.ts` (`extractAmount`). Confirm the LBP storage convention in the Preferences vault doc before scaling `k`.

### HUB-16

- ✅ 2026-09-27 — **HUB-16** Hub `/chat` voice uses the shared ERA turn engine (`runTurn`), so voice reminders keep their time; `intentClassifier.ts` and the five legacy callbacks deleted; `HubPage.tsx` 6,004 → 5,972 lines (rider rule). Voice now confirms/dismisses cards by "yes"/"no". Device witness in HUB-83. [Criteria](#hub-16).

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h09--household-chat-selection-phone-composer-and-voice-time>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** Preserve voice reminder time through the shared turn engine.

- **Acceptance:** `/chat` voice reminders lose the time and don't save *(now packet **E-13**, the one sanctioned `HubPage.tsx` rider)* — gives HubPage's voice engine `runTurn`, deletes `intentClassifier.ts` and the five legacy callbacks.

**Provenance:** [4 - Checklist.md](<../2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The one sanctioned `HubPage.tsx` rider this window — voice reminders lose their time and fail to save. The fix is to give HubPage's voice engine the shared turn engine: `runTurn` from `src/features/era/useEraTurn.ts` (already used by `src/components/era/CommandBar.tsx`), replacing `src/features/voice-conversation/intentClassifier.ts` and the five legacy callbacks in `src/components/hub/HubPage.tsx` (6,275 lines — verified 2026-09-20). Check every importer of `intentClassifier.ts` before deleting it (`conversationEngine.ts`, `hooks/useConversationMode.ts`, `index.ts`). The lost value is a time, so `.claude/skills/timezone-handling/SKILL.md` and `src/lib/utils/date.ts` apply; the reminder write is `src/app/api/items/route.ts`. Because it is a rider, HUB-5's rule applies: the file's line count must go *down* in this session.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Extend existing `src/features/era/intents/resolveIntent.test.ts` and voice fixtures for a named reminder at 16:00, bare follow-up time and rejected capture. Confirm one write and preserved local time/UTC payload; run `pnpm typecheck` and `pnpm lint` and verify typed/voice parity on /chat.

```delivery-plan-v1
{
  "outcome": "Hub Chat voice reminders use the shared ERA turn engine and retain their requested time.",
  "acceptance": [
    "HubPage supplies runTurn instead of the legacy five-callback path.",
    "Legacy classifier retirement follows zero-live-consumer proof, and the sanctioned HubPage rider reduces its size."
  ],
  "scope": [
    "src/components/hub/HubPage.tsx",
    "src/features/voice-conversation",
    "src/features/era/useEraTurn.ts",
    "src/features/era/intents/resolveIntent.test.ts"
  ],
  "steps": [
    "Reproduce the time-loss fixture and inventory classifier/callback consumers, including voice cancellation/greeting behavior.",
    "Wire HubPage's conversation engine to useEraTurn with the required host dependencies; preserve confirmation and capture recovery.",
    "Remove the five legacy callbacks and retire intentClassifier only after shared control-word/greeting behavior and importer checks pass.",
    "Verify one requested time and one resulting reminder across typed and voice hosts; record the extraction size change."
  ],
  "invariants": [
    "One classifier/resolver owns action meaning; no duplicate side effects.",
    "Time conversion uses canonical local-to-UTC helpers.",
    "An absent or failed handler cannot speak a success acknowledgment."
  ],
  "exclusions": [
    "Wake changes, broad HubPage reorganization or a separate voice implementation."
  ],
  "risks": [
    "Deleting the classifier may also delete shared cancel/sleep vocabulary still used by the engine."
  ],
  "unknowns": [
    "All remaining classifier exports/importers and host-specific policies must be checked before deletion."
  ],
  "dependencies": [],
  "risk": "high",
  "provenance": "2026-09-26: HubPage.tsx:1848 still uses onSetReminder; conversationEngine.ts:513-522 selects shared runTurn or legacy classifier. Accepted HUB-16/HUB-5 rider retained.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-80

- ✅ 2026-09-27 — **HUB-80** Household lexicon (repository): `era_lexicon` migration + owner-only RLS, `/api/era/lexicon`, aliases / "Always" defaults / examples / "Forget", re-bound every turn; templates frozen. Gate test passes; owner migration and device witness are HUB-83. [Criteria](#hub-80).

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h07--explicit-consent-follow-ups-learned-choices-and-split-handoff>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA learns household aliases and defaults through a semantic lexicon that re-binds every turn, replacing phrase templates.

- **Acceptance:**
  - Migration and storage:
    - A `migrations/YYYY-MM-DD_era-lexicon.sql` file creates `era_lexicon` with its RLS policy in the same file (Hard Rules #24/#27). `schema.sql` reflects the end state. The owner runs the migration.
    - Templates are frozen (no new rows) and then converted only where their meaning can be recovered. The rest stay as evidence.
    - HUB-64's criteria still pass.
  - Rule kinds and learning:
    - Supported rule kinds: aliases, conditional defaults and corrected examples.
    - The cache stores interpretations and re-binds actor, focus, clock, permissions and defaults.
    - Always/Forget work, and a repeated choice offers "Always" once.
    - A correction is an example, not permission for a default.
  - Scope and invalidation:
    - The partner never inherits a person's rules.
    - Account deletion, access loss or household unlink invalidates dependent rules.
- **Gate:** sequence cases first try → correction → Always → paraphrase → override → forget. Zero repeated questions after Always, and zero partner-default misuse.
- **Depends:** HUB-78, HUB-47, HUB-64.
- **Status 2026-09-27 — implemented in the repository; owner migration pending (HUB-83).** `migrations/2026-09-27_era-lexicon.sql` (+ `schema.sql`) creates `era_lexicon` with owner-only RLS. `/api/era/lexicon` (GET/POST/DELETE-as-revoke; 503 until the table exists), `useEraLexicon` mirror, pure rules in `lexicon.ts` re-bound to current accounts every turn. Kinds: alias ("the box means Drawer"), default (the card's "Always", offered only after a repeated choice), example (every chip choice — evidence, never a default). "Forget that" revokes the last applied rule. A default fills the slot but the result is still a Confirm card. Templates frozen (no new rows; existing ones still match, HUB-64 intact). Gate test `lexicon.test.ts`: first try → choice → repeat → Always → paraphrase (no question) → override → forget; partner and deleted-account rules are inert.

### HUB-6

- ✅ 2026-09-27 — **HUB-6** Split from chat: "split 60$ dinner with Racha" opens `/expense?era=<id>` with the Split toggle on and the total filled; Budget keeps every split rule (owner decision 2026-09-27: open the existing form). [Criteria](#hub-6).

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h07--explicit-consent-follow-ups-learned-choices-and-split-handoff>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** Expense-split from chat (gap 8a).

- **Acceptance:** Expense-split from chat (gap 8a) — untouched by this plan; still Later.

**Provenance:** [4 - Checklist.md](<../2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Untouched by the current plan and still Later — do not absorb it into HUB-22, which says so explicitly. When it starts: the split-bill machinery already exists end to end — `src/lib/utils/splitBill.ts` (`getTransactionDisplayAmount`, `getTransactionDisplayDescription`), `src/app/api/transactions/split-bill/route.ts`, `src/contexts/SplitBillContext.tsx` and `src/components/expense/SplitBillModal.tsx` — so this is a chat entry point onto it, not new money logic. The conversion path is `src/features/hub/messageActions.ts` and `src/components/hub/AddTransactionFromMessageModal.tsx`. BUD-83 is changing the split tag semantics and BUD-76 holds the currency contract; both land first. `.claude/skills/money-rules/SKILL.md`.

**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Compare the existing split-bill form/route with a proposed chat entry using fake data. Before implementation, agree the minimum review flow and run the owning Budget money/currency fixtures; verify draft creation has no balance effect and confirmation uses the existing inverse.

```delivery-plan-v1
{
  "outcome": "A chat message can enter the existing expense-split workflow without duplicating its financial rules.",
  "acceptance": [
    "The chat entry preserves the reviewed participants, amounts/currency and confirmation semantics.",
    "The resulting records and Undo are owned by Budget; splitting remains distinct from HUB-22 debt/recurring actions."
  ],
  "scope": [],
  "steps": [
    "Read the existing useSplitBill, SplitBillModal and split-bill route contracts alongside BUD-83/BUD-76.",
    "Map a representative source message to the fields already required by that workflow; identify only genuinely missing user intent.",
    "Prepare the smallest concrete entry/review proposal and confirm unresolved split meaning or participant defaults before choosing an implementation scope.",
    "Once accepted and producer contracts pass, plan a bounded adapter using the existing form/endpoint and source-message linkage."
  ],
  "invariants": [
    "Chat cannot invent a partner share, currency conversion or silently confirmed expense.",
    "The source message and returned financial record IDs remain traceable.",
    "No second split calculator or generic money writer."
  ],
  "exclusions": [
    "Implementing speculative split modes, bulk conversion atomicity or altering debt settlement."
  ],
  "risks": [
    "The current short acceptance does not specify how an incomplete chat split should obtain the missing share."
  ],
  "unknowns": [
    "Owner's intended chat review/default behavior and current accepted Budget split/currency contracts."
  ],
  "dependencies": [
    "BUD-83",
    "BUD-76"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and accepted Top Layer constraints. Revalidate cited source contracts and prerequisite receipts at dispatch; no live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-78

- ✅ 2026-09-27 — **HUB-78** Understanding engine pilot: chip turn state, by-name reminders with this one / series, `?era=` handoff to `/expense`, shopping-add, outcome on every turn; Gym pilot 15/15, fast path 82.6% held-out; mobile confirm card fixed (it rendered behind the chat sheet). Device witness pending. [Criteria](#hub-78).

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h07--explicit-consent-follow-ups-learned-choices-and-split-handoff>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** The shared Understanding engine is proven through three unlike flows. The marginal cost of the next capability is measured.

- **Acceptance:** Plan §4 components 1–9 extend `src/features/era/` and its registry; there is no parallel registry. These flows pass as Gym sequences:
  - **Transfer:** `I took 300$ from Drawer` → destination chips → Confirm → verified outcome, and a timeout gives `uncertain`.
  - **Reminder by name:** `move the dentist to Friday` with no focus resolves among authorized items. A recurring item asks *this one / series*. `make it 5 instead` then corrects the same item.
  - **Handoff:** a spend "Change" and an unresolvable spend open `/expense` prefilled through `?era=<messageId>`, which survives reload. The transfer handoff reuses the existing shortcut.
  - **Marginal cost:** shopping-add is built on the finished engine, and its hours are recorded.
- **Budget:** 5 sessions, hard stop at 6. At the checkpoint, record the marginal hours and re-estimate HUB-79–82 in this book. If a new family costs more than 2 sessions, HUB-79 becomes handoff-first.
- **Depends:** HUB-76; HUB-77's decision rule (routing mode); HUB-47 consumes this outcome contract.
- **Checkpoint 2026-09-27 — pilot complete in one session (repository; device witness pending).**
  - Components: turn state = `EraPendingTurn` `slot` kind + chip taps (`EraAskChips`, structured, never re-parsed; non-answers are new requests); speech-act gate (HUB-76); fast path = routers; model on miss only (HUB-77 decision); adapters = resolvers + `nativeActions.ts` + `resolvers/shopping.ts`; effect tiers + `deriveOutcome` in `engine.ts`; outcome persisted on every assistant row; handoff = `era_messages` row + `GET/POST /api/era/messages/[id]` (owner RLS, expiry, append-only consumption) + `useEraHandoff` in the expense form.
  - Flows (Gym `pilot.jsonl`, 15/15): `I took 300$ from Drawer` → [Wallet][Savings][Other] → Confirm, timeout → uncertain; `move the dentist to Friday` (no focus) → by-name lookup among own reminders, recurring → This one / Series (both Confirm; "this one" writes an occurrence exception through `/api/items/[id]/actions`, rule untouched), `make it 5 instead` → same item; unresolvable spend and draft "Change" → `/expense?era=<id>`; transfer "Other" reuses the `refill-wallet` shortcut.
  - **Marginal cost:** shopping-add on the finished engine ≈ 0.3 session (adapter ~70 lines, one grammar, tests). Below the 2-session threshold, so HUB-79 stays inline-first.
  - Re-estimate: HUB-79 ≈ 3 sessions, HUB-80 ≈ 3 (+ owner migration run), HUB-81 ≈ 3, HUB-82 ≈ 2.
  - Gym after the pilot: fast path B 82.6% held-out (was 73.4%), zero non-gap wrong money effects. Two money bugs caught by the gate before they shipped (`taxi 250k` → $250,000; Franco transfer drafted as spend).
- **Money math:** as HUB-76.
- **Reading guide:**
  - `useEraTurn.ts`, `intents/index.ts`, `capabilities/registry.ts`, `useEraAskAI.ts`, `/api/era/ask/route.ts`
  - `src/features/transfers/hooks.ts`, `src/components/layouts/TabContainer.tsx:63-70`
  - items routes, `src/lib/smartTextParser.ts`
  - Plan: [§4](<../../Plans/ERA Top Layer.md#4-architecture--one-pipeline>).

### HUB-77

- ✅ 2026-09-27 — **HUB-77** ERA Gym: `tests/era-gym/` (159 full-context cases — 87 synthetic, 72 from the owner export — all mandatory slices), real router + pure resolvers against a fake household, path C Understand prototype, record/replay (72 live calls, `gemini-3.8-flash`), `REPORT.md`. Decision: keep model on miss/conflict only (C − A = +10.2 held-out points, 3 wrong money). Found and fixed two money bugs (HUB-75 follow-up). CI wiring rides HUB-37; replay runs in `pnpm test`. [Criteria](#hub-77).

**Outcome:** An ERA Gym measures correct final state, and a recorded three-way routing comparison decides the model's role.

- **Acceptance:**
  - `tests/era-gym/*.jsonl` sequences carry full context (face, page, turn state, focus, lexicon, clock/timezone, actor) plus the expected final state and tier.
  - The seed is the 47 synthetic sentences plus the owner's export. It includes the mandatory slices in plan §7: `300$`, `500k`, Arabic/Franco, speech acts, corrections, partner cases, response loss and voice.
  - A development-time script runs paths A, B and C with a live model at no more than 500 calls per run, records the responses, and replays them in CI.
  - The report covers correct final state, wrong money effects, questions per task, p50/p95 latency and tokens.
  - The plan §7 decision rule result is recorded in this book.
- **Owner export (Hard Rule #26: the owner runs it; read-only):**

  ```sql
  select u.created_at, u.user_id, u.content as said, u.intent_kind as routed,
         a.content as replied, a.intent_payload as outcome
  from public.era_messages u
  left join lateral (
    select content, intent_payload from public.era_messages a
    where a.conversation_id = u.conversation_id and a.role = 'assistant'
      and a.created_at >= u.created_at
    order by a.created_at limit 1) a on true
  where u.role = 'user'
  order by u.created_at desc limit 500;

  select hm.created_at, hm.sender_user_id, hm.content, ma.action_type
  from public.hub_message_actions ma
  join public.hub_messages hm on hm.id = ma.message_id
  order by hm.created_at desc limit 300;
  ```

- **Depends:** HUB-37 for CI.
- **Reading guide:** `src/features/era/intents/rootIntentRouter.test.ts` (fixture style), `src/lib/ai/eraAskProposal.ts`, `src/lib/ai/gemini.ts`. Plan: [§7](<../../Plans/ERA Top Layer.md#7-measurement--the-era-gym>).
- **Status 2026-09-27 — complete; decision recorded (see Final below).**
  - Built: `tests/era-gym/` — `synthetic.jsonl` (87 full-context cases, 43 held out, all mandatory slices; reconstructed from the study's recorded examples because the original 47 were not retained), `gym.ts` (real router + real pure resolvers against a fake household; effect-level final state), `understand.ts` (path C prototype of plan §4 component 4), `gym.test.ts` (CI replay + release gates), `record.test.ts` (`ERA_GYM_RECORD=1`, ≤500 calls), `recordings/model-responses.json`, `REPORT.md`. CI wiring still rides HUB-37; the replay runs in `pnpm test`.
  - Live run 2026-09-27, `gemini-3.8-flash`, 51 calls, synthetic corpus only:

    | Path | Correct (all) | Held-out | Wrong money | Questions/task | p50 / p95 ms | Tokens in / out |
    |---|---|---|---|---|---|---|
    | A today | 58/87 (66.7%) | 27/43 (62.8%) | 1 | 0.10 | 2721 / 4972 | 7547 / 460 |
    | B fast path | 53/87 (60.9%) | 25/43 (58.1%) | 1 | 0.11 | – | 0 |
    | C fast path + model | 70/87 (80.5%) | 35/43 (81.4%) | 2 | 0.09 | 2519 / 4892 | 28166 / 1217 |

  - **Decision rule (plan §7), provisional: keep "model on miss or conflict only".** C − A = +18.6 held-out points (needs ≥ 20); C wrong money = 2 (needs 0: one is the shared HUB-78 correction gap, the other `mark rent as paid` → `reminder.complete` on "rent", caught behind a confirm card); C p50 = 2519 ms (needs ≤ 2500). The verdict holds with or without the shared gap. Per the rule, HUB-79 effort goes to adapters and handoff. Re-run with the owner export before HUB-78 extends past its pilot; the export can change the verdict.
  - Gym findings fixed the same day: `I took 300$ from Drawer` and `make it 20$ instead` drafted spends (HUB-75's verbless capture, tightened); `paid $2,000 for rent` drafted **$2** (pre-existing: `parseSpeechExpense` split thousands commas — the router read 2000, the draft wrote 2).
  - **Final 2026-09-27 (owner export ingested).** `migrations/output.md` → `tests/era-gym/household.jsonl` (72 cases: 51 ERA turns, 21 Hub budget conversions; actor from sender id). Re-recorded: 159 cases, 79 held out, 72 live calls in total.

    | Path | Held-out | Wrong money | p50 / p95 ms |
    |---|---|---|---|
    | A today | 60/79 (75.9%) | 1 (shared correction gap) | 2800 / 4972 |
    | B fast path | 58/79 (73.4%) | 1 (same) | – |
    | C fast path + model | 68/79 (86.1%) | 3 | 2448 / 4277 |

    **Decision recorded: keep "model on miss or conflict only" (U-1 condition not met).** C − A = +10.2 held-out points (needs ≥ 20); C wrong money = 3 — `Elio pay 5 groceries dekken` (Racha's note to Elio) drafted $5, plus `mark rent as paid` → `reminder.complete` and the shared correction gap. Real usage is dominated by what the fast path already reads (reminders, pronoun reschedules, fuel drafts with change, transfers, recipes), so HUB-79 effort goes to fast-path grammar, adapters and handoff. The model stays on misses; re-run the Gym when the prompt, catalog or model changes.
  - Real-data fast-path misses queued for HUB-79: `Nudge it to 7pm!`, `Postpone the reminder to 6pm.`, `Hello ERA`/`hello yeah`, bare `Cordon bleu` on Chef, a 7-word `15$ pharmacy …` capture, `Gaz yaris 38`, and shopping-add.

### HUB-76

- ✅ 2026-09-27 — **HUB-76** Speech-act gate (`intents/speechAct.ts`) on every routed write: negated/hypothetical/question/conditional/reported → `clarify{speechAct}`, negations never escalate. Native transfer, debt record and reminder delete (plus destructive taught templates) now return a `native_action` confirm card; `nativeActions.ts` executes on tap with Undo (transfer DELETE, debt DELETE, Recycle Bin restore; Undo runs once). A timeout after a money POST replies *uncertain*, never retried. Cross-currency transfers and non-USD debts are refused. Evidence: `nativeActions.test.ts` asserts Drawer $1,000/Wallet $100 → card with zero POSTs → $700/$400 after tap → $1,000/$100 after one Undo, second Undo no-op; `speechAct.test.ts`; four acceptance router rows. Typecheck clean; not exercised on a device (local dev points at the production DB). [Criteria](#hub-76).

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h07--explicit-consent-follow-ups-learned-choices-and-split-handoff>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** No ERA interpreter moves money or deletes records without the tier its effect requires. Negated and hypothetical sentences never execute.

- **Acceptance:**
  - A speech-act gate classifies negation, hypothetical/question form, conditional, and quoted or reported speech. None of these can produce a fast-path write.
  - Native transfer and debt record render the same confirm card as AI proposals, and show Undo after execution.
  - Native reminder delete requires Confirm.
  - Router rows cover `Don't transfer $300 from Drawer to Wallet`, `What if I transfer $300 from Drawer to Wallet?`, `If I paid 50 for gas` and `Rita said she spent 20$`.
- **Money math:** Drawer $1,000 / Wallet $100.
  - The negated sentence gives no card and no change.
  - `Transfer $300 from Drawer to Wallet` gives a card. Balances stay $1,000/$100 until the tap, then become $700/$400.
  - Undo restores $1,000/$100 exactly once.
  - A timeout after the POST reports `uncertain` and never retries on its own.
- **Gate:** router suite plus a resolver test with mocked `safeFetch` showing zero POSTs before confirm. `pnpm typecheck` passes.
- **Reading guide:** `src/features/era/intents/budget.ts` (transfer/debt grammars), `intents/resolvers/budget.ts` (`resolveTransfer`, `resolveRecordDebt`), `intents/resolvers/schedule.ts` (`resolveReminderDelete`), and the `useEraAskAI` confirm card to reuse. Plan: [§5](<../../Plans/ERA Top Layer.md#5-effect-policy>). Follow `money-rules`.

### HUB-86

- ✅ 2026-10-03 — **HUB-86** The ERA chat is a conversation: bubbles in the person's color, 15–16 px ERA replies, time breaks, a thinking indicator for every turn, the confirm card and chips as the newest turn, a jump-to-latest control; in hub view an open conversation lifts the DOT to its module-mode position (idle hub unchanged). New chat clears "it" and every open question/card, survives a reload, and a 30-minute-quiet chat shows a "New chat" divider and a toolbar dot. First turns of a fresh chat render optimistically (`ensure_conversation`). Also fixed: bookkeeping system rows leaking into the transcript and Ask AI history; cards floating over the thread. (`thread.test.ts`; read-only live dev check; [acceptance](#hub-86); device witness in HUB-83.)

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h08--conversation-new-chat-history-and-report>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** The ERA chat reads like a conversation on web and mobile, and New chat starts clean.
**Kind:** feature
**Touches:** `src/components/era/EraConversation.tsx`, `src/components/era/EraShell.tsx`, `src/components/era/EraChatToolbar.tsx`, `src/components/era/EraChatDrawer.tsx`, `src/features/era/thread.ts`, `src/features/era/useEraConversation.ts`, `src/features/era/useEraStore.ts`, `src/features/era/useEraTurn.ts`, `src/app/api/era/messages/route.ts`

- **Acceptance:** the person's messages are bubbles in their own color and ERA's replies are 15–16 px text; time breaks after 30 min or a new day; ERA shows it is thinking for every turn (typed, voice, chip); the confirm card and question chips are the newest turn and never cover the thread; the newest reply types out once and never replays on load. In hub view an open conversation moves the ERA DOT to its module-mode position and the thread fills the space to the command bar; with no conversation the hub is unchanged. New chat clears focus memory, open questions/cards, the pending Ask AI retry and the last applied rule; the next sentence opens a new conversation and survives a reload. After 30 min of silence a "New chat" divider and a toolbar dot appear without forcing anything. A fresh chat's first sentence renders optimistically (client-named conversation, `ensure_conversation` on the first write).
- **Evidence (2026-10-03):** `src/features/era/thread.test.ts` (breaks, grouping, hidden system rows, quiet window, active-conversation choice, titles, history groups). Live dev check on the owner's data through the running app (read-only: no message sent, nothing written): 680 px column centred between the risen DOT and the bar, user bubbles 15 px blue (blue-theme owner), ERA text 16 px, breaks `Sun · 5:11 PM`, quiet divider and toolbar dot on a silent chat, Report card opening with Wrong preselected for a done turn, New chat unmounting the thread. Motion could not be watched (the automation tab was hidden, so animation frames were paused); device acceptance in HUB-83.
- **Fixed on the way:** `handoff_consumed` system rows rendered in the transcript as "› handoff consumed" and reached Ask AI's history as user turns; the confirm card and chips floated over the transcript at the same position.
- **Reading guide:** `thread.ts` decides, `EraConversation.tsx` renders, `useEraConversation.ts` owns which conversation is active (`pickActiveConversation`, `eraConversationTarget`, `useStartNewEraChat`).

### HUB-85

- ✅ 2026-10-03 — **HUB-85** Report from the ERA chat: a quiet Report chip under a missed reply (and on any reply's details), Missed / Wrong + "Expected…", a server-built snapshot of the turns, outcomes and ERA actions stored as a system `era_messages` row, a "Reported" marker and Undo. Imported into Now › ERA reports by PM Tooling R72. (`issueReport.test.ts`, `thread.test.ts`, `tests/pm-era-issues.test.ts`; [acceptance](#hub-85); first real report is the owner's, HUB-83.)

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h08--conversation-new-chat-history-and-report>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** A missed or wrongly handled ERA request can be reported with its history, and lands as Hub & ERA work.
**Kind:** feature
**Touches:** `src/app/api/era/issues/route.ts`, `src/app/api/era/issues/[id]/route.ts`, `src/lib/era/issueReport.ts`, `src/features/era/useEraIssues.ts`, `src/components/era/EraReportCard.tsx`, `src/features/era/useEraAskAI.ts`, `scripts/pm/era-issues.mjs`

- **Acceptance:** under a reply that missed (router miss with no AI follow-up, failed or uncertain outcome, or an Ask AI prose answer to a missed request) the thread offers a quiet Report chip; any ERA reply's details offer Report too; a refused negation never offers it. The card takes Missed / Wrong (preselected from the reply) and an optional "Expected…" note. The server stores a snapshot — the request, ERA's reply, up to 24 turns with intent and outcome, and the ERA actions logged in that window — as a system row in the same conversation; the thread shows "Reported"; Undo removes only that row. The PM bridge imports each report once (after the 2-minute Undo grace) into Now › **ERA reports** as a `**Kind:** bug` item with the transcript; Wrong = hotfix (blocker), Missed = defect (friction).
- **Evidence (2026-10-03):** `src/lib/era/issueReport.test.ts` (request/reply selection, window cut, action window, bounds); `thread.test.ts` (offer rules, preselected kind); `tests/pm-era-issues.test.ts` (import shape, lint grammar, once-only, grace, ID allocation, Markdown neutralised, secrets withheld). Not exercised against production: filing a report writes to the DB, so the first real report is the owner's (HUB-83).
- **Reading guide:** `useEraIssues.ts` → `POST /api/era/issues` → `buildIssueSnapshot`; import in `scripts/pm/era-issues.mjs`; Sprints lane in `scripts/pm/app/sprintModel.ts#eraHotfixes`.

### HUB-52

- ✅ 2026-10-03 — **HUB-52** ERA History: titled, grouped past chats with read-only preview, Continue (clean context) and Archive with Undo; no schema change. ([acceptance](#hub-52).)

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h08--conversation-new-chat-history-and-report>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** Reopen ERA sessions with deterministic titles.

- **Acceptance:** *(E-18)* ERA sessions picker + reopen + deterministic titles (no LLM). *(Inbox 2026-08-27; plan sacrifice #1 if a gate is missed.)*

**Provenance:** [4 - Checklist.md](<../2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Implementation (2026-10-03):** `src/components/era/EraHistorySheet.tsx` (side panel on desktop, bottom sheet on phones; Today / Yesterday / This week / Earlier; tap = read-only preview; Continue = `PATCH /api/era/conversations/[id] {action:"resume"}` with a clean context; Archive = `{action:"archive"}` with Undo). Titles: `conversationTitle` in `src/features/era/thread.ts` from each chat's first sentence, served by `GET /api/era/conversations?history=1` (chats with no sentence are left out). No schema change. Live dev check (read-only): 32 chats titled and grouped, preview read-only with Archive / Continue.
- **Reading guide:** Sessions picker, reopen, and deterministic titles — the acceptance says **no LLM** for the title, so derive it from the first user message plus a date using plain string logic. The storage already exists: `src/app/api/era/conversations/route.ts` and `src/app/api/era/messages/route.ts`; read their shapes and `src/features/era/queryKeys.ts` before adding fields. UI is `src/components/era/EraChatDrawer.tsx` / `EraShell.tsx`. Determinism means the same conversation always yields the same title — no timestamp-of-render, no random tiebreak. Hard Rule #28 for the picker's chrome.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Proposed session fixtures cover empty/long first messages, identical titles, reopen/archive, missing session and owner switch. Assert no LLM request for titles and correct conversation identity; run `pnpm typecheck` and `pnpm lint` and verify picker navigation at 390×844.

```delivery-plan-v1
{
  "outcome": "ERA sessions can be reopened or archived with deterministic nonempty titles.",
  "acceptance": [
    "The picker uses existing conversation/message storage and opens the selected thread.",
    "Titles derive deterministically from existing content/date without a model call; archiving retains history."
  ],
  "scope": [
    "src/app/api/era/conversations/route.ts",
    "src/features/era/useEraConversation.ts",
    "src/features/era/queryKeys.ts",
    "src/components/era/EraChatDrawer.tsx",
    "src/components/era/EraShell.tsx"
  ],
  "steps": [
    "Read current conversation ownership, pagination and archive fields before proposing any storage change.",
    "Derive a short deterministic title from available first-message content with a stable fallback; use IDs to disambiguate selection.",
    "Add the compact picker and reopen/archive controls through the existing conversation hook, preserving ordered persistence.",
    "Verify archived/history access and missing/unauthorized-session handling; propose a migration only if the current schema lacks the accepted archive contract."
  ],
  "invariants": [
    "No generated titles, render-time timestamps or random identity.",
    "Changing selection cannot append new messages to the previous conversation.",
    "Archived transcripts remain history rather than current reference truth."
  ],
  "exclusions": [
    "A fourth assistant store, transcript redesign or deleting old conversations."
  ],
  "risks": [
    "Cached selection and background message queues can attach a reply to the wrong conversation if identity is implicit."
  ],
  "unknowns": [
    "Current archive support and paging behavior require inspection; widen scope explicitly before schema changes."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 planning from current item acceptance, reading guide and Plans/ERA Top Layer.md; source/schema and predecessor receipts require dispatch-time revalidation. No live certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HUB-89

- ✅ 2026-10-04 — **HUB-89** ERA handles "Add Laura as a contact person" — [criteria](#hub-89)

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h06--create-a-placecontact-use-the-place-and-open-its-artifact>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA handles "Add Laura as a contact person".

**Kind:** bug
**Source:** ERA report cc4540f4-4dd4-49bf-bad7-d01a44c46909 · missed · owner · 2026-10-03 18:51 (Asia/Beirut)

- **Acceptance:** This request ends in the right outcome — done with Undo, one confirm card, one question with chips, a prefilled form, or an honest limit with a door — never a wrong action or a dead end. An ERA Gym case replays the transcript below.
- **Expected:** Unable to add a contact
- **Reading guide:** start at `src/features/era/useEraTurn.ts` (one turn), then the router in `src/features/era/intents/` and the capability's resolver; add the sentence to `tests/era-gym/`.

**Transcript**

- You · 18:51 — Add Laura as a contact person _(unknown)_
- ERA · 18:51 — I missed that. Ask me about today, about money, about dinner — or just tell me something to keep. _(unknown · answered)_ ← reported

### HUB-90

- ✅ 2026-10-04 — **HUB-90** Every ERA write leaves an Artifact that opens the item — [criteria](#hub-90)

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h06--create-a-placecontact-use-the-place-and-open-its-artifact>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** Every ERA write leaves an Artifact that opens the item.

**Kind:** bug
**Touches:** src/lib/era/artifacts.ts, src/features/era/recordArtifacts.ts, src/features/era/intents/resolvers/, src/features/era/nativeActions.ts, src/features/era/useEraTurn.ts, src/features/era/useEraAskAI.ts, src/app/api/era/actions/route.ts, src/app/api/activity-log/route.ts, src/features/activity-log/types.ts, src/components/web/WebCatalogue.tsx, migrations/2026-10-04_era-artifacts-any-entity.sql

- **Acceptance:** Any create, update or delete ERA performs appears in /era → Artifacts with its entity label and opens the item (or the Recycle Bin when deleted); the Activity Log's ERA message row opens the same target. No per-intent mapping: adapters return `artifacts`, `recordArtifacts` logs them, `ERA_ARTIFACT_ENTITIES` builds every link. `src/features/era/artifacts.contract.test.ts` fails when a write path returns no artifact.
- **Evidence (2026-10-04):** contract test 18 write paths green (mutation-checked: dropping memory.save's artifact turns it red); `pnpm vitest run tests/era-gym src/features/era src/lib/era src/features/activity-log src/app/api/activity-log src/app/api/era` 490 passed, Gym B ✗ list unchanged (20 known misses); typecheck clean. Read-only browser check: `/catalogue?item=<Racha>` opens Racha's detail inside Contacts; `/api/activity-log?module=era` returns 200 (pre-contract rows carry no artifacts, so they keep `/era`).
- **Reading guide:** `src/lib/era/artifacts.ts` → `src/features/era/recordArtifacts.ts` → any resolver's `artifacts:` line; `/era-wire` step 5.

### HUB-88

- ✅ 2026-10-04 — **HUB-88** ERA handles "Add Kobeize as a location" — [criteria](#hub-88)

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Hub-2026-10-25.md#h06--create-a-placecontact-use-the-place-and-open-its-artifact>) (drafted 2026-10-25; original results and remaining engineering gates retained).

**Outcome:** ERA handles "Add Kobeize as a location".

**Kind:** bug
**Source:** ERA report 07b5ac48-9aac-4526-abf1-6bed5f72096b · missed · owner · 2026-10-03 18:35 (Asia/Beirut)

- **Acceptance:** This request ends in the right outcome — done with Undo, one confirm card, one question with chips, a prefilled form, or an honest limit with a door — never a wrong action or a dead end. An ERA Gym case replays the transcript below.
- **Expected:** Adding a Location to Catalogue
- **Resolved 2026-10-04 (HUB-94):** `addPlace` grammar (`intents/brain.ts`) → `resolveAddPlace` saves to Catalogue → Places via the Catalogue routes, with Undo and a `place` Artifact. Gym cases `report-hub-88`, `-b` and `-neg` pass.
- **Reading guide:** start at `src/features/era/useEraTurn.ts` (one turn), then the router in `src/features/era/intents/` and the capability's resolver; add the sentence to `tests/era-gym/`.

**Transcript**

- You · 18:35 — Add Kobeize as a location _(unknown)_
- ERA · 18:35 — Not sure what you're after. Try your schedule, your spending, a recipe, or something to remember. _(unknown · answered)_ ← reported

### HUB-112

- ✅ 2026-10-12 — **HUB-112** Add native sentence completion for reminders, expenses and shopping; refactor into a unified chatbot composer with wrapped choices, readable summary, correction/details sheets and keyboard-aware layout — [criteria](<../../Hub & ERA/Hub & ERA — Master Book.md#hub-112>); 70 focused tests and machine checks pass, mobile/browser acceptance pending.

### 2026-10-12 · ERA composer mic/send are one WhatsApp-style button: mic when empty,…

- ✅ 2026-10-12 — ERA composer mic/send are one WhatsApp-style button: mic when empty, Send when text; tap toggles voice, hold listens until release — four icon-only starter chips above the bar (expense, reminder, event, shopping) write "I paid " / "Remind me to " / "Add an event for " / "Add to shopping list " — `CommandBar.tsx`; phone acceptance of release-sends-phrase pending.

### HUB-118

- ✅ 2026-11-21 — **HUB-118** Require host sign-in for Guest Portal bulk reads — [criteria](<../../Hub & ERA/Hub & ERA — Master Book.md#hub-118>) (Implementation: public guest drinks/allergies routes no longer accept all; host view GET /api/guest-portal/admin/orders (401/403/404/200 incl. household partner) read via service role after ownership check; /g/drinks-admin uses only it. Replay tests: bulkReads.test.ts (red before fix, green after), admin/orders/route.test.ts; typecheck + eslint clean; dev-server curl anonymous -> 401/400. Owner UAT + guest_drinks RLS migration run pending.)

### HUB-123

- ✅ 2026-11-25 — **HUB-123** Contacts file under a category from ERA and Catalogue; the thread clears the starter pills — [criteria](<../../Hub & ERA/Hub & ERA — Master Book.md#hub-123>) (Gym report-hub-123..-i + report-hub-95 red→green, known misses unchanged (20); contract rows contact.create(category)/update/category/newCategory + Undo; 785 ERA tests pass; typecheck clean; local read-only check: thread clears pills, Catalogue Category select renders)

### HUB-93

- ✅ 2026-11-25 — **HUB-93** ERA gets "Add Racha as a Contact" right — [criteria](<../../Hub & ERA/Hub & ERA — Master Book.md#hub-93>) (Plain add of a new contact opens the prefilled Catalogue form (Open door, nothing saved); ported from Local candidate 5dcada5e into the HUB-123 work; Gym report-hub-89/-b/-c/-93 handed_off; ERA + Gym suites pass. UAT pending.)

## State log

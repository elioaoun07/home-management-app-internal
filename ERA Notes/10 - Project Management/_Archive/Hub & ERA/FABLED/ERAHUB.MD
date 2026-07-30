ady to code?

Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
ERA Hub GODMODE — Top-Layer Interface Overhaul

ntext

e ERA Hub is the app's declared top-layer primary interface, but today /chat opens into a bare thread list rendered by a 5,506-line monolith (src/components/hub/HubPage.tsx) that hides its own header/tabs in standalone mode. The oactive half of the product (briefings, alerts, signals) has no home surface; the NLP parser exists but is buried behind long-press → modal; ERA lives in a separate parallel view instead of being woven into conversations. Goal: professional (decomposed, consistent, themed, tested), alive (presence, motion, ambient ERA), intuitive (a Today deck + a composer that understands you as you type). ↓
↓
This overhaul deliberately pulls forward FAR roadmap items N9 (HubPage decomposition) and N10 (brief-as-Hub-card surface) — the redesign becomes the substrate the briefing backend (N1–N8) later lands into. It does not touch FAR P0 items (tests/decisions run as their own workstream) and does not resolve the conversation split-brain (N2) — it just doesn't make it worse.

Decisions locked with the user ↓

1.  Home = Living Today deck — greeting + ERA presence, pulse strip, swipeable signal cards, smart composer, threads below. ↓
2.  Feed & Scoreboard fold into the deck — views collapse from 4 tabs to: Home · Threads · ERA. Alerts fold into home. (/alerts page keeps working — push payloads target it.)
3.  Ambient ERA — @era in any household thread gets an in-thread AI reply visible to both partners. ↓
4.  Full GODMODE, phased — decompose first; every phase independently shippable.

Verified facts that shape the plan (don't re-derive) ↓

- /chat mounts <HubPage standalone initialThreadId> (src/app/chat/page.tsx:50, pt-16); /alerts mounts standalone + allowedViews=["alerts","feed"] + hideHeader. In standalone-without-allowedViews, only ChatView renders (HubPage.tsx:314) — switcher (284), DailyPulse (277), ScoreboardView (324) never show on /chat.
- Dead code to delete, not extract: ScoreboardView + LeaderboardRow (~4907–5033), DailyPulse (336–392, also broken — returns undefined after loading), AIAssistantItem (986–1014), score viewOption. ↓
- hub_messages.sender_user_id is NOT NULL (FK auth.users) but source CHECK already includes 'ai' (migrations/schema.sql:284,304) → ambient ERA = sender is requesting user + source:"ai", zero migration.
- getMessageStyles keys off message_type/isMe and ignores source — must branch on source === "ai" before the isMe check or ERA replies render as the requester's bubble. ↓
- Read receipts live in hub_message_receipts (separate table); HubMessage.status is attached server-side.
- Hub query keys are inline arrays everywhere (["hub","threads"]…) — no qk.\* hub entries exist. ↓
- @tanstack/react-virtual already a dep; ShoppingListView.tsx:1125 uses useVirtualizer.
- parseMessageForTransaction (src/lib/nlp/messageTransactionParser.ts) and parseSmartText (src/lib/smartTextParser.ts) are local/free — currently unused in the composer. ↓
- fetchBudgetContext (~696) and logMessagesToDatabase (~558) are private inside src/app/api/ai-chat/route.ts — Phase 3 extracts them to src/lib/ai/.
- Deep links: DeepLinkHandler.tsx / NotificationModal.tsx route to /alerts and /chat?thread=ID; useHubState() (src/features/hub/useHubPersistence.ts:160) persists activeView/activeThreadId; TabContext deep-link effects live at HubPage.tsx:237–264. All must keep working. ↓
- 25 console.\* calls in HubPage (cluster ~2226–2770) violate Hard Rule 22.
- MobileNav is hidden on /chat, yet composer sits at fixed bottom-[72px] — a legacy 72px dead zone to reclaim.

--- ↓
Phase 0 — Decomposition (FAR N9) — the substrate
↓
Objective: 5,506 → ~200-line shell + extracted modules. Behavior-preserving (move, don't rewrite). ShoppingListView, NotesListView, both message modals, voice components, ItemChatSheet, ProductComparisonSheet untouched.
↓
Target tree

src/components/hub/ ↓
HubPage.tsx // shell: useHubState, TabContext effects, view routing (~200 LOC)
shared/purposeConfig.tsx // PURPOSE_CONFIG + PurposeIcons (from ~415–537); type from hooks.ts ThreadPurpose
shared/formatters.ts // formatDateSeparator, isDifferentDay, formatRelativeTime
views/ThreadListView.tsx // ChatView (392–851), list/search/filters only
views/ThreadItem.tsx // 853–983 ↓
views/FeedView.tsx // 4805–4904 (stays live for /alerts)
views/AlertsView.tsx // 5035–5491 (stays live for /alerts; drags lazy detail-modal imports + dismissed-alert helpers) ↓
views/HubSkeletons.tsx // normalized pulse placeholders per surface
conversation/ThreadConversation.tsx // 1629–3883 container (shopping/notes early-return branch stays here) ↓
conversation/ConversationHeader.tsx // ~2427–2718
conversation/MessageList.tsx // 2783–3149 (scroll, separators, message map; bubble JSX stays inline until Phase 4) ↓
conversation/MessageComposer.tsx // 3151–3360 (presence row, voice/send, ERA toggle)
conversation/MessageActionMenu.tsx // ~3373–3680
conversation/DeleteMessagesModal.tsx // ~3715–3870 ↓
conversation/MessageStatus.tsx // 1563–1627
conversation/AIConversationView.tsx // 1017–1172
conversation/AIThreadConversation.tsx // 1175–1561 (manual SSE — verbatim); shared aiTypes.ts exports AI_THREAD_ID ↓
modals/ThreadSettingsModal.tsx // 4016–4445
modals/CreateThreadModal.tsx // 4447–4803 ↓
src/features/hub/queryKeys.ts // NEW hubKeys._ emitting byte-identical arrays; adopt only in moved files for now
↓
Extraction order (one commit each; gates after each)
↓
Hygiene first, in place: delete ScoreboardView/LeaderboardRow/DailyPulse/AIAssistantItem + score viewOption; strip all 25 console._ (user-facing errors → toast.error, else silent); delete commented-out legacy blocks. Keep HubView ion + hideHeader prop (alerts-page compat). 2. shared/formatters.ts + shared/purposeConfig.tsx (pure; update 4 consumers). ↓ 3. src/features/hub/queryKeys.ts (identical arrays; zero behavior change). 4. Both modals (already prop-clean: householdId/onClose/onCreated; thread/onClose). 5. FeedView, AlertsView, ThreadItem, MessageStatus. 6. AIConversationView + AIThreadConversation (+ aiTypes.ts; AI_THREAD_ID is also used by ChatView — export it). 7. ThreadListView wholesale, then lift the conversation branch into HubPage (the one non-mechanical step): HubPage decides activeThreadId === AI_THREAD_ID → AIConversationView / activeThreadId → ThreadConversation / else list. Move↓useHouseholdRealtimeMessages(!activeThreadId ? householdId : null) (line 569) to the HubPage root so it survives view changes. Required so Phase 1's deck can render without mounting the list. 8. ThreadConversation wholesale (verify all flows), then internal splits: MessageComposer → ConversationHeader → MessageActionMenu + DeleteMessagesModal → MessageList. Move state with the component owning its DOM; never duplicate ↓state (39 useState/useRef live here). 9. HubSkeletons.tsx normalization. ↓

sks: closure state during step 8 splits; /alerts prop contract (allowedViews/initialView/hideHeader) must work verbatim.
↓

---

Phase 1 — Living Today deck (home surface)

Objective: /chat opens on the proactive deck. Zero new API routes, zero AI calls — rule-based composition of existing data. This card surface is what FAR N10/N6's briefing composer later lands into.
↓
New files
↓
src/components/hub/HubShellContext.tsx // { activeThreadId, openThread, openAI, openHome, view, setView } — wraps existing setters only
src/components/hub/home/TodayDeck.tsx // composition root: greeting, pulse, rail, composer, recent threads ↓
src/components/hub/home/GreetingHeader.tsx // time-aware greeting (UserContext name) + EraPresenceOrb slot
src/components/hub/home/PulseStrip.tsx // 3–4 stat chips
src/components/hub/home/SignalCardsRail.tsx // snap-x snap-mandatory rail; cards w-[85vw] max-w-sm snap-center ↓
src/components/hub/home/cards/SignalCard.tsx // base: tc.cardGradient + neo-card (non-floating, glass OK)
src/components/hub/home/cards/AlertsCard.tsx
src/components/hub/home/cards/TodayScheduleCard.tsx
src/components/hub/home/cards/ActivityCard.tsx // Feed's new home (top 5) ↓
src/components/hub/home/cards/BriefingCard.tsx // rule-based v1 via composeBriefing(signals) — NO AI call
src/features/hub/useTodaySignals.ts // derives all deck data from existing hooks ↓
src/features/hub/useAlertActions.ts // dismiss/snooze/confirm extracted from AlertsView for reuse
↓
Modified

- HubPage.tsx — view model → "home" | "threads" | "era"; slim segmented control when no thread open; legacy mapping at both ingress points (useHubState read + hubDefaultView effect): chat→threads, feed|score|alerts→home. ↓
- useHubPersistence.ts — normalize legacy stored hub-active-view on read.
- src/app/chat/page.tsx — skeleton mirrors deck; composer offset bottom-[72px] → bottom-0 + safe-area inset (MobileNav is hidden here); keep pt-16.
- src/app/alerts/page.tsx — unchanged (push payloads target it; retiring it is a separate later decision).
- TabContext — no type change; normalize in HubPage.
  ↓
  Data sources (all existing)
  ↓
  ┌────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Element │ Source │ ↓
  ├────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Greeting │ UserContext + time of day │
  ├────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤ ↓
  │ Pulse: unread │ sum unread_count from useHubThreads() │
  ├────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Pulse: alerts │ useHubAlerts() minus getDismissedAlerts() │
  ├────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤ ↓
  │ Pulse: today count │ useItems() (schedule bundle RPC) filtered to today — verify field names in src/features/items/useItems.ts │
  ├────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤ ↓
  │ Pulse: budget pace │ useHubStats().total_spent_month ÷ days elapsed of custom month (startOfCustomMonth, src/lib/utils/date.ts, prefs monthStartDay); spend-only chip if no cheap allocations hook │
  ├────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤ ↓
  │ Cards │ same hooks + useHubFeed() │
  └────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
  ↓
  Risks: empty states (zero alerts/items) must look intentional; first-paint-from-localStorage stays instant; all 4 themes via tc.\* only; person-absolute colors on partner-attributed activity (Rule 14).

---

Phase 2 — Smart composer (intuitive)
↓
Objective: the composer understands money/reminder intents as you type — locally, debounced, free.
↓
New files
↓
c/components/hub/composer/SmartComposer.tsx // wraps MessageComposer; intent layer; used in threads AND home deck
c/components/hub/composer/IntentChipBar.tsx // ghost chip ("→ $35 Groceries [✓]") + quick chips (+Expense +Remind +Shop) + destination chip (home mode)
src/components/hub/composer/SlashPalette.tsx // OPTIONAL, last; floating panel = opaque tc.bgPage (Rule 15) ↓
src/features/hub/useComposerIntent.ts // debounce 300ms → parseMessageForTransaction(text, categories) + parseSmartText(text)
src/features/hub/threadRouting.ts // pickTargetThread(intentKind, threads): budget/reminder/shopping purpose → thread, else most recent
src/lib/nlp/messageTransactionParser.test.ts // NEW vitest (first hub-adjacent unit tests)
src/features/hub/threadRouting.test.ts // NEW vitest
↓
havior
↓
Chip shows when txn amount parses (confidence ≥ threshold) or parseSmartText finds date/time (≥ 0.6). Categories: hoist the exact useMyAccounts() + useCategories(defaultAccount.id) wiring from ThreadConversation (~1761–1765) into SmartComposer. ↓
Confirm v1 = prefilled modal, not one-tap: chip tap → send message via useSendMessage → open AddTransactionFromMessageModal (props initialAmount/initialCategoryId/initialSubcategoryId/initialDate/initialDescription verified) → isting useAddTransaction + useCreateMessageAction + Undo toast. Reminder chip → AddReminderFromMessageModal seeded from ParsedItem. One-tap is a fast-follow once parse precision is proven.
Home mode: destination chip ("→ Budget") via threadRouting; send posts to resolved thread; toast "Sent to Budget" with Undo (soft-delete endpoint).

- Voice/ERA: reuse InlineVoiceRecorder + ConversationToggle + useConversationMode as wired today; home sessionId voice-home. ↓
  Intent layer disabled when !isReallyOnline(). Numeric inputs: type="text" inputMode="decimal" (Rule 19).

- ase 3 — Ambient ERA (@era in any thread)
  ↓
  Objective: @era what's our budget looking like? in a shared thread → ERA replies in-thread for both partners. No DB migration (sender = requester, source:"ai").
  ↓
  New/modified
  ↓
  src/lib/ai/budgetContext.ts // NEW: fetchBudgetContext moved verbatim out of api/ai-chat/route.ts
  src/lib/ai/aiMessageLog.ts // NEW: logMessagesToDatabase moved verbatim (token accounting stays unified)
  src/app/api/ai-chat/route.ts // imports the two extracted helpers (mechanical) ↓
  src/app/api/hub/era-reply/route.ts // NEW
  src/features/hub/useEraReply.ts // NEW client hook
  src/components/hub/conversation/EraMessageBubble.tsx // violet/fuchsia + ERA orb avatar + label ↓

  Route — POST /api/hub/era-reply
  ↓
  Zod body { thread_id: uuid, prompt: string, message_id?: uuid } (Rule 12).
  supabaseServer auth → thread fetch → household membership check (copy api/hub/messages/route.ts:439–460). 3. Rate limits: checkUserRateLimit + request-hash + monthly token gate (same src/lib/ai/rateLimit.ts helpers as ai-chat) → 429 with retryAfter. ↓
  Context: fetchBudgetContext(supabase, user.id) + last ~15 thread messages (content, sender name, source) + thread purpose → generateSystemPrompt + "replying inside a shared household chat, be brief" addendum. 5. sendMessageToGemini buffered (streaming into a shared thread = broadcasting partials; deferred). ↓
  Insert hub_messages { household_id, thread_id, sender_user_id: user.id, source: "ai", message_type: "text", content } + mirror the receipts insert from the messages POST (~500–630) so partner unread works. 23505 → 409. Errors → ror_logs, no console.\*. 7. Token log to ai_messages with session_id: "hub-era-{thread_id}". ↓
  export const dynamic = "force-dynamic", export const maxDuration = 60.

ient

- Composer detects /(^|\s)@era\b/i → mention highlight. On send: normal useSendMessage first, then safeFetch("/api/hub/era-reply", { timeoutMs: 60_000 }) (Rule 6 — mandatory, else false offline). Pending: local "ERA is thinking…" r↓w (typing-dots, violet). Success: setQueryData append + broadcast on the exact thread-{id}/household-{id} new-message channels useSendMessage uses, so the partner sees it. Strictly user-gesture — never from useEffect.
- Rendering: branch msg.source === "ai" before isMe in getMessageStyles/MessageList → EraMessageBubble (from-violet-500/20 to-fuchsia-500/20 border-violet-500/30); skip MessageStatus for ai bubbles. ↓
  Documented trade-off: ERA replies count as "sent by requester" in receipts — acceptable v1; nullable-sender alternative would need a migration + RLS review (deferred; if flipped later, Rule 24 applies).
  ↓

---

Phase 4 — Conversation polish (professional) ↓

- Extract conversation/MessageBubble.tsx with React.memo; stabilize touch handlers/style getters with useCallback.
- Date separators for all thread purposes (currently gated to reminder/budget, ~line 2856). ↓
  Action badges: replace hardcoded bg-emerald-500/20 shell with tc.bgSurface/tc.border (keep per-action icon colors).
  Scroll restoration on filter/search toggle: capture nearest-visible message id → scrollIntoView({ block: "center" }).
- Virtualize MessageList only if the ShoppingListView.tsx:1125 useVirtualizer pattern drops in cleanly — messages cap at 200/fetch, memo may suffice; measure first. ↓
- Finish hubKeys adoption across hooks.ts, useHubPersistence.ts, messageActions.ts (same arrays — cache-safe; cache-invalidation skill auto-applies).

Phase 5 — Alive layer ↓

- src/lib/motionVariants.ts (confirmed absent): spring configs + variants matching documented curves — (0.34,1.56,0.64,1) enter-pop, (0.68,-0.55,0.265,1.55) spring-bounce, (0.4,0,0.2,1) standard; listStagger, cardEnter, fadeUp, ↓essScale.
- home/EraPresenceOrb.tsx — idle pulse / thinking / speaking; reuse ConversationOrb internals from src/features/voice-conversation/; orb animates "thinking" while an era-reply is pending. ↓
  shared/threadTheme.ts — centralize the ${thread.color}03/15/30/80 gradient recipes currently inlined in header/list/composer.
  Micro-interactions: message-in spring (AnimatePresence in MessageList), send whoosh, unread badge-enter, deck listStagger.
- src/lib/haptics.ts — haptic("light"|"success"|"warning") guarded by "vibrate" in navigator; replaces inline navigator.vibrate(50) (~line 1847); add to chip confirm + send. ↓
- .shimmer across HubSkeletons (calm theme's subdued shimmer vars already exist, globals.css:76–101).
- Animations never hardcode backgrounds (Rule 10); floating palettes stay tc.bgPage (Rule 15).

--- ↓
Verification (every phase)
↓
Gates per commit: pnpm typecheck · pnpm lint · pnpm test · pnpm build (prebuild regenerates atlas).
↓
nual mobile-viewport regression script (run via pnpm dev, devtools mobile):

1.  /chat → instant list from cache → open general thread → send (optimistic + delivered tick) → long-press → transaction modal → Undo toast works. ↓
    Shopping thread (ShoppingListView intact: drag, check, groups) · notes thread · budget thread (voice recorder + ERA toggle) · AI view (list + streaming).
    Deep links: push-style /chat?thread=X opens the thread; /alerts renders alerts+feed tabs, dismiss/snooze work.
2.  Offline: kill network → banner + queued send; intent chips disabled. ↓
3.  Phase 1+: deck on all 4 themes; empty states; legacy hub-active-view localStorage values don't crash.
4.  Phase 3: two browsers — @era in shared thread → both see user msg then ERA bubble; double-fire hits 429 toast; private thread works; token usage visible in AI Usage page.
    ↓
    New unit tests: messageTransactionParser.test.ts, threadRouting.test.ts (Phase 2).

Cross-cutting obligations (Hard Rules 23/25 — same session as each phase) ↓

PM: ERA Notes/10 - Project Management/Hub & ERA/ files 1–3 (✅ + dates, checkboxes, (IMPLEMENTED YYYY-MM-DD)); FAR Execution Checklist/1 - Master Checklist — tick N9 at Phase 0 end; annotate N10 at Phase 1 ("card surface shipped; composer pending N6"); mirror in 2 - Weekly Schedule. ↓
Feature Map: ERA Notes/01 - Architecture/Feature Map/junction/hub-chat.md file list per phase.
Vault: augment ERA Notes/03 - Junction Modules/Hub Chat/Overview.md (component map, @era flow, sender semantics, "check source before isMe" gotcha).

- Atlas: update Hub Chat entry at Phase 1 (navigation change) and Phase 3 (@era); no new routes anywhere in this plan.
  No new conversations store (FAR N2 stays free to merge later): ERA hub replies live in hub_messages; token logs in ai_messages.

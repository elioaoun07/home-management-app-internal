# AI Assistant (ERA)

**Type:** Junction
**Route:** `/era`
**Vault doc:** `ERA Notes/03 - Junction Modules/AI Assistant/`

## What it does

ERA is the application's assistant interface. A command bar routes typed/voice input to native intents or reviewed model-proposed actions (budget, schedule, chef, brain), reuses existing source operations and replies in ERA's voice. Each module is a "face" with its own hue. Executable and proactive reach is bounded; page navigation does not imply an action adapter, and cron liveness needs separate evidence. Voice uses STT/TTS; wake-word code exists but is not the accepted product target.

**Since 2026-10-04 (HUB-94):** ERA also creates events (`draftEvent`) and saves places (`addPlace`) to Catalogue → Places.

**Capability set (as of 2026-08-26):** query (todaySchedule, monthSpend, showAnalytics, listRecipes, mealPlanGaps, memoryRecall) · write (draftTransaction, draftReminder, transfer, recordDebt, confirmDraft, assignMeal, memorySave) · multi-turn slot filling (a `draftReminder` with no date asks a question instead of writing undated — see `EraPendingTurn` / `useEraTurn.ts`) · manual AI handoff ("Ask AI" — see `useEraAskAI.ts` / `EraActiveProposal`, the confirm-card pattern for an AI-proposed action). Full intent list: `src/features/era/types.ts`.

## Files at a glance

- **Page entry**: `src/app/era/page.tsx`
- **Shell components**:
  - `src/components/era/EraShell.tsx` — the shell; `conversing` (hub view + an open conversation) moves the DOT to its module-mode position and mounts the thread below it (HUB-86)
  - `src/components/era/EraConversation.tsx` — the conversation thread (HUB-86, replaced `EraThreadTranscript`): layouts `stage` / `panel` / `sheet` / `preview`; renders what `src/features/era/thread.ts` decides (breaks, groups, Report offer, quiet nudge); confirm card + chips + Report card are its newest turn
  - `src/components/era/EraChatToolbar.tsx` — History / New chat icons (hub) + `useActiveThreadState`; `EraHistorySheet.tsx` — past chats (HUB-52); `EraReportCard.tsx` — Report (HUB-85); `EraProposalCard.tsx` — confirm card (moved out of EraShell); `eraHues.ts` — module hues
  - `src/components/era/CommandBar.tsx`
  - `src/components/era/EraFaceNav.tsx`
  - `src/components/era/EraDots.tsx`
  - `src/components/era/HubScatterWidgets.tsx`
  - `src/components/era/EraChatDrawer.tsx` — mobile-only (`md:hidden`) chat bubble + bottom sheet for module/activity dashboard views, so the floating CommandBar/transcript don't permanently eat a phone screen. It embeds `CommandBar variant="embedded"` and `EraConversation layout="sheet"`, with History / New chat in its header. Backdrop/sheet stay mounted and animate via the `open` prop directly (no `AnimatePresence` mount/unmount) — the embedded transcript's own re-renders (realtime, typewriter) were interfering with `AnimatePresence`'s exit-complete tracking and left it stuck-but-invisible.
  - *(deleted 2026-08-25, HUB-17 — confirmed zero importers: `EraHubView.tsx`, `EraTranscript.tsx`, `EraFaceCard.tsx`, `QuickFaceChips.tsx`, `FaceHeader.tsx`, `FaceCanvas.tsx`, `FacePlaceholder.tsx`)*
- **Face widgets** (one per face): `src/components/era/face-widgets/`
- **Dashboards**: `src/components/era/dashboards/`
- **AI assistant component** (in-app chat surface): `src/components/ai/AIChatAssistant.tsx`
- **Hooks**:
  - `src/features/era/useEraConversation.ts` — optimistic transcript rows plus ordered per-conversation background persistence; active-conversation choice (`explicitConversation` + `pickActiveConversation`), `eraConversationTarget` (a fresh chat names its conversation client-side; the first write sends `ensure_conversation`), New chat (`useStartNewEraChat`, survives reload via a localStorage marker), History (`useEraConversationHistory`, `useResumeEraConversation`, `useArchiveEraConversation`)
  - `src/features/era/thread.ts` — pure thread view-model (HUB-86/85/52): `buildThread`, `reportOfferId`, `isQuiet`, `pickActiveConversation`, `conversationTitle`, `historyGroup`; tests in `thread.test.ts`
  - `src/features/era/useEraIssues.ts` — file / undo a Report (HUB-85); snapshot shape in `src/lib/era/issueReport.ts`
  - `src/features/era/useEraBudgetSubmit.ts`
  - `src/features/era/useEraStore.ts`
  - `src/features/era/useEraHousehold.ts`
  - `src/features/era/useEraWakeListener.ts`
  - `src/features/era/useEraAskAI.ts` — "Ask AI" (Slice 4): `askAI()` calls `/api/era/ask`; `confirmProposal()`/`dismissProposal()` act on `activeProposal`
  - `src/features/era/engine.ts` — outcome contract, effect tiers, `?era=` handoff shape (HUB-78)
  - `src/features/era/nativeActions.ts` — executes native confirm cards + their Undo (HUB-76/78/79)
  - **Artifacts ("ERA using the app's functionality")**: `src/lib/era/artifacts.ts` (entity registry, `eraArtifact()`, deep links), `src/features/era/recordArtifacts.ts` (the one logger), `src/features/era/intents/resolvers/routeWrite.ts` (adapter template), `src/app/api/era/actions/route.ts`, `src/components/era/dashboards/ArtifactsView.tsx`, `src/features/era/widgets/useEraArtifacts.ts` (day browse + persistent Undo/Redo), `src/app/api/era/actions/status/route.ts`; contract test `src/features/era/artifacts.contract.test.ts`. "ERA did X but it's not in Artifacts / Open goes to the wrong page" starts here.
  - **AI Usage tab (how much AI ERA uses, desktop only)**: `src/components/era/dashboards/AiUsageView.tsx`, `src/features/era/aiUsage.ts` (what counts, local-day buckets, model price table — update rates here), `src/features/era/useEraAiUsage.ts`, `src/app/api/era/ai-usage/route.ts` (reads `ai_messages` era-ask receipts + `era_messages` ai_answer rows). "Cost looks wrong / a chat is missing" starts here.
  - `src/features/era/intents/speechAct.ts` — speech-act gate on every write (HUB-76)
  - `src/features/era/intents/resolvers/slots.ts`, `slotBuilders.ts`, `reminderLookup.ts` — chip questions, reminders by name (HUB-78)
  - `src/features/era/intents/resolvers/budgetFamilies.ts`, `shopping.ts`, `estate.ts` — income/split handoff, balance, recurring cover, shopping-add, activity/purchases reads (HUB-79/81)
  - `src/features/era/lexicon.ts`, `useEraLexicon.ts`, `src/app/api/era/lexicon/route.ts` — household lexicon (HUB-80)
  - `src/features/era/reach.ts` — module reach registry; generates `ERA Reach Matrix.md` (HUB-81)
  - `src/features/era/useEraHandoff.ts`, `src/app/api/era/messages/[id]/route.ts` — precision-form handoff (HUB-78)
  - `src/lib/nlp/amount.ts` — the one amount extractor (HUB-75)
  - `src/features/era/intents/followUp.ts`, `intents/resolvers/amend.ts` — follow-ups edit the last result by its type (HUB-84)
  - **Events + Places (HUB-94/88):** `src/features/era/intents/eventText.ts` (sentence → title / "at place" / date-time), `intents/resolvers/events.ts` (write the event, then "When?"/"Where?"/"Save to Places?"), `intents/resolvers/places.ts` (Catalogue → Places module, alias-tag matching, save), `intents/freeTextAnswer.ts` (a free-text answer never swallows a new command); tests `intents/eventText.test.ts` + Gym `reports.jsonl` `hub-94-*`. "ERA didn't recognise my place" starts at `matchPlace` / the place's tags.
  - `src/components/era/EraAskChips.tsx` — chip row for one-question turns (HUB-78)
  - `tests/era-gym/` — ERA Gym corpus, harness, record/replay (HUB-77)
- **Intent layer**:
  - **Final hardening (2026-10-11, HUB-108):** `useEraAskAI.ts` binds model proposals to owner/chat/request time, rechecks before each default-mode step and before publishing private reads, and routes single actions through `capabilities/plan.ts`. `types.ts` owns `EraRequestContext`. `useEraAskAI.test.ts` exercises the actual hook/store/executor boundary, including owner/New chat changes, live targets, missing artifacts and NFC partial writes. `intents/resolvers/schedule.hardening.test.ts` verifies parsed recurrence never becomes a one-time write or pending question. `eraAskProposal.ts` refuses invalid proposals deterministically and reports provider metering to `/api/era/ask/route.ts`; route tests cover complete usage and unavailable quotas. See the Overview's final review for current guarantees, source defects, test gaps and rollout gates.
  - **Capability discovery (2026-10-10, HUB-105):** `capabilities/discovery.ts` derives model input/output schemas and module availability from the executable registry and `reach.ts`. `app.capabilities` is a read-only introspection action. `registry.ts` owns purpose, source routes and semantic limits; no parallel prompt slot descriptions. `scripts/era/apiInventory.ts` scans exported Next handlers without importing routes; `pnpm era:capabilities` writes `.tmp/era-capabilities/report.json`. `coverage.test.ts` rejects missing source routes/methods. New routes are unreviewed candidates, never automatically executable. `plan.ts` preflights real dependency data against all consumers before later writes.
  - **Agent plans (2026-10-10, HUB-103):** `capabilities/plan.ts` validates and executes up to six ordered registered actions with typed output bindings; `workflowReads.ts` supplies unique owned-reminder lookup and real recipe ingredients; `applyResult.ts` records partial artifacts and invalidates source caches; `confirmation.ts` consumes a shared card once. `useEraTurn` hands compound/dependent recipe requests to the existing `/api/era/ask`; `useEraAskAI` runs reads directly and writes after Confirm. Tests: `capabilities/plan.test.ts`, `tests/era-gym/agent{,-record}.test.ts` (live interpretations replay in CI).
  - **Execution durability (2026-10-10, HUB-104):** `src/features/era/execution/{state,client,projection,useEraRuns}.ts` owns saved progress, attempt fencing, explicit recovery and native question continuation; `src/app/api/era/runs/route.ts` creates/lists owner-bound runs and `[id]/route.ts` validates versioned transitions. `src/components/era/EraRunCards.tsx` restores unfinished work in the original conversation. `migrations/2026-10-10_era-execution-journal.sql` is the owner-run migration; enable `NEXT_PUBLIC_ERA_DURABLE_EXECUTION=true` only afterward. Tests in `execution/` cover actual migration transactions in isolated PostgreSQL, client interruptions and source adapters. This does not replace the offline queue or make source writes exactly once; see the Overview's HUB-104 limits.
  - `src/features/era/intentRouter.ts`
  - `src/features/era/useEraTurn.ts` — **the one entry point from "a sentence" to "a reply"** (HUB-17). Classifies via `rootIntentRouter`, resolves via `resolveIntent`, renders transcript rows optimistically, persists them in order without holding up the reply, and updates the store. `CommandBar` (typed) and `EraShell`'s voice wiring (spoken, via `ConversationHandlers.runTurn`) both call this and nothing else.
  - `src/features/era/replyFormatter.ts`
  - `src/features/era/faceRegistry.ts`
  - `src/features/era/intents/index.ts`, `resolveIntent.ts`
  - `src/features/era/intents/{budget,schedule,chef,brain}.ts`
  - `src/features/era/intents/resolvers/{budget,schedule,chef,brain}.ts`
  - `src/features/era/intents/formatters/{budget,schedule,chef,brain}.ts`
  - `src/lib/era/phrasing.ts` — ERA's voice: `pick`/`fill`/`say`, `describeWhen`, `money`, `greeting`. Reply POOLS live in the per-face formatters.
  - Tests: `src/features/era/intents/rootIntentRouter.test.ts` (routing), `resolveIntent.test.ts` (side effect + reply), `src/lib/era/phrasing.test.ts` (phrasing mechanics)
  - `src/features/era/widgets/{useBudgetSummary,useScheduleSummary,useChefSummary,useBrainSummary}.ts`
- **Voice conversation** (`src/features/voice-conversation/`):
  - `index.ts`
  - `conversationEngine.ts`
  - `sttCapture.ts`, `azureSTT.ts`, `azureTTS.ts`, `azureWake.ts`
  - `vadGate.ts`, `audioContext.ts`
  - `ttsQueue.ts`, `speechTemplates.ts`, `greetingCache.ts`
  - `intentClassifier.ts`
  - `components/ConversationOrb.tsx`, `ConversationToggle.tsx`
  - `hooks/useConversationMode.ts`, `hooks/useEraReplyTTS.ts`
- **API routes**:
  - `src/app/api/ai-chat/` ← main inference endpoint
  - `src/app/api/era/ask/` ← ERA "Ask AI" handoff: manual tap or guarded language-gap auto-escalation; domain writes still require explicit confirmation
  - `src/app/api/era/conversations/` (`?history=1`) + `conversations/[id]/` (PATCH resume / archive) ← History (HUB-52)
  - `src/app/api/era/issues/` (POST) + `issues/[id]/` (DELETE = Undo) ← Report (HUB-85); imported into Hub & ERA by `scripts/pm/era-issues.mjs` (R72)
  - `src/app/api/azure-speech/` ← STT/TTS bridge
  - `src/app/api/tts/`
  - `src/app/api/suggest-schedule/`
- **Context assembly** (`src/lib/ai/context.ts`, WP-10): `fetchBudgetContext`/`fetchMonthlyTrend` and `fetchScheduleContext`; independent PostgREST reads run concurrently so context gathering pays two latency layers (account ids, then dependent data) rather than one layer per table
- **Adaptive context (HUB-106, 2026-10-10):** `src/lib/ai/eraAdaptiveContext.ts` (bounded, attributed episodes/choices/usage/gaps and history merge), `eraAdaptiveContextSource.ts` (request-scoped private reads, source coverage, per-read aborts), `src/features/era/adaptiveTurn.ts` (owner-only cached history and recent-dialogue escalation). `/api/era/ask` supplies personal context on every face; `useEraAskAI` sends the conversation/owner-bound tail and persists a source receipt; `useEraConversation` attributes optimistic rows to their capture session. Tests beside the two context files, `eraAdaptiveContext.integration.test.ts`, `adaptiveTurn.test.ts`, `conversationOwnership.test.ts`, and `/api/era/ask/route.test.ts`. No new memory store or phrase rules. “ERA forgot what I said” starts here; historical context never grants a target ID or consent.
- **Ask AI proposal contract** (`src/lib/ai/eraAskProposal.ts`): Claude structured output (`generateClaudeJson` in `src/lib/ai/anthropic.ts`, default `claude-haiku-5-5`, JSON schema `ASK_AI_RESPONSE_SCHEMA`, effort `low`; server-side refusal fallback only on models that accept it) → Zod validation → deterministic capability/plan admission. NFC tag/state must match the supplied Schedule context. Rejected single/NFC proposals return a deterministic no-action refusal, never model-authored success prose. No source write happens in this route.
- **DB tables**: AI session usage rows in the AI Usage module's tables
- **Avatar**: `src/components/shared/EraAvatar.tsx`, `src/components/shared/ERAMark.tsx`

## Common edit scenarios

- **"Confirm differs from what ERA actually writes / changed effective target"** → `src/features/era/capabilities/effectiveAction.ts`, `preview.ts`, `registry.ts` confirmation contracts and `plan.ts`; shared UI `src/components/era/EraActionPreview.tsx`, `EraProposalCard.tsx`, `EraRunCards.tsx`. Live lookup gates are in the schedule/budget/chef/shopping resolvers; transient continuation is `useEraAskAI.ts`, saved consent/reload in `execution/state.ts` and `client.ts`. Regression fixtures: `effectiveAction.test.ts` and `useEraAskAI.test.ts` (HUB-109).
- **"ERA claims a reminder/event succeeded with missing alert/trigger"** → source `src/lib/items/createContract.ts`, `/api/items` and prerequisite routes, the three create hooks in `src/features/items/useItems.ts`, and `migrations/2026-10-11_atomic-item-create.sql` (SCH-24). ERA schedule/routeWrite/NFC adapters require the complete source envelope; a parent ID alone is an unknown completion. Lost responses cannot authorize retry.

- **"Add a new intent / face"** →
  1. New face entry in `src/features/era/faceRegistry.ts`.
  2. New folder under `src/features/era/intents/{name}.ts` + `resolvers/{name}.ts` + `formatters/{name}.ts`.
  3. Register in `intents/index.ts` and `resolveIntent.ts`. **Both.** A `case` missing from `resolveIntent` does not fail loudly — it falls through to `replyFormatter` and returns a plausible-sounding reply while writing nothing (this is what HUB-12 fixed for `draftReminder` / `showAnalytics`).
  4. New widget hook under `widgets/`.
  5. UI in `src/components/era/face-widgets/` and `dashboards/`.
  6. Add a row to `intents/rootIntentRouter.test.ts` (routing) and a case to `intents/resolveIntent.test.ts` (the write it performs + the reply it returns).
- **"Make an intent actually do something"** → the resolver in `intents/resolvers/`, never the caller. If the side effect needs React (accounts, query client, a toast), inject it via `ResolveDeps` in `resolveIntent.ts` the way `draftTransaction` takes `submitBudgetDraft`; do not branch on `intent.kind` inside `CommandBar`.
- **"Change command bar UI"** → `src/components/era/CommandBar.tsx`. It calls `useEraTurn().runTurn()` and nothing else — do not reintroduce classify/resolve/persist logic here (that's what caused HUB-16-class divergence in the first place).
- **"Edit voice mode flow"** → `src/features/voice-conversation/conversationEngine.ts` is the orchestrator. On `/era`, `handleTranscript` calls `handlers.runTurn` (the shared brain, see `useEraTurn.ts`) when present; the legacy `classifyIntent` + five-callback path only runs where `runTurn` isn't wired (`/chat`/`HubPage.tsx`). Wake-word in `azureWake.ts` (still needs external setup — see project memory).
- **"Change ERA's voice / persona"** → the reply POOLS in `src/features/era/intents/formatters/{budget,schedule,chef,brain}.ts` and `src/features/era/replyFormatter.ts`; the mechanics (and the generic greeting / ack / error pools) in `src/lib/era/phrasing.ts`. `/chat`'s legacy voice path still has its own un-pooled `speechTemplates.ts` (HUB-16) — `/era`'s voice now goes through the same pools as typed (HUB-17).
- **"ERA sounds repetitive / robotic"** → add variants to the relevant pool. Read the four rules in the header of `src/lib/era/phrasing.ts` first — above all, **every variant must state the same facts**; the variant harness in `resolveIntent.test.ts` fails a phrasing that drops one.
- **"Edit the proactive briefing"** → see the briefing/insight calls in widget hooks + Focus briefing cache rule (vault Hard Rule).

## Gotchas

- **System rows are bookkeeping, not conversation.** `era_messages` holds `handoff_consumed` and `issue_report` system rows. The thread hides the first and shows the second as a "Reported" marker (`thread.ts#isVisible`); Ask AI's history excludes both. Any new reader of `era_messages` must filter `role === "system"` the same way.
- **New chat is client state.** It clears focus memory ("it"), open questions/cards and the miss Ask AI would retry (`resetConversationContext`), and marks the session `explicitConversation = null`; the next sentence names a new conversation. Nothing server-side changes until that sentence is sent.

- AI endpoints are slow → **always** pass `timeoutMs: 60_000` (or higher) to `safeFetch()` (Hard Rule #6).
- **"I couldn't reach the AI just now. Try again in a moment, or use the app directly."** is the server's fallback in `generateAskAIResponse` (the shorter client copy without "or use the app directly" means the route itself returned non-200). The reason is logged as `[era-ask] …` in the Vercel log (HUB-98). **An AI reply to a sentence the router handles means the ✨ Ask AI button was tapped**: it sends typed text straight to `/api/era/ask`, while `useEraTurn` only calls the AI on a router miss (HUB-99).
- **Two providers (2026-10-11):** Ask AI (`/api/era/ask`) runs on Claude (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`); every other AI route still uses Gemini. No key → the deterministic "couldn't reach the AI" prose. The SDK retries once (40 s timeout) — no Gemini fallback.
- `generateContentWithFallback` (`src/lib/ai/gemini.ts`, non-Ask-AI routes) moves to the fallback model on 429 **and** 5xx (overloaded); other errors rethrow at once.
- Focus briefing cache has its own Hard Rule (see AI Assistant vault doc).
- Faces 6–10 (Health/Trip/Fitness/Outfit/Memory) are roadmap, not shipped.
- **Pending questions are routed by kind and request context.** `useEraTurn.ts` / `intents/freeTextAnswer.ts` distinguish a new command from an answer; compound agent requests begin a fresh request. Genuine reminder date answers go to `resolvePendingReminderAnswer`; parsed recurrence is refused before either a write or a misleading new date question. Journal-backed answers must finish their owning step, not re-run the original command.
- **Never parse a bare `YYYY-MM-DD` into a `Date` with `new Date(str)`** for anything meal-planning or schedule related — it parses as UTC midnight and drifts a day in any negative-UTC-offset timezone (and the reverse in positive-offset ones, which is what actually bit a first draft of the `mealPlanGaps` test in this repo's own CI timezone). Use `formatDate()` (`src/lib/utils/date.ts`, local calendar fields) to go FROM a `Date`, and anchor at noon (`` `${dateStr}T12:00:00` ``) when going the other way for display.

## Connected modules

- Broad navigation awareness; actual reads and writes are limited to the capability registry, native resolvers and explicitly assembled context sources. ERA does not read every standalone.
- **Hub Chat** — ERA's proactive surfaces render in the Hub.
- **AI Usage** — token consumption written here.
- **Watch UI** — voice entry shares the conversation engine.

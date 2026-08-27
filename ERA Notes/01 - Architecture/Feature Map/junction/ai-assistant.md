# AI Assistant (ERA)

**Type:** Junction
**Route:** `/era`
**Vault doc:** `ERA Notes/03 - Junction Modules/AI Assistant/`

## What it does

ERA is the proactive AI co-pilot. It lives across all modules: a command bar parses typed/voice input into intents (budget, schedule, chef, brain), runs the corresponding action, and replies in ERA's voice. Each module is a "face" with its own hue. Voice mode includes wake-word listening, STT, intent classification, TTS.

**Capability set (as of 2026-08-26):** query (todaySchedule, monthSpend, showAnalytics, listRecipes, mealPlanGaps, memoryRecall) · write (draftTransaction, draftReminder, transfer, recordDebt, confirmDraft, assignMeal, memorySave) · multi-turn slot filling (a `draftReminder` with no date asks a question instead of writing undated — see `EraPendingTurn` / `useEraTurn.ts`) · manual AI handoff ("Ask AI" — see `useEraAskAI.ts` / `EraActiveProposal`, the confirm-card pattern for an AI-proposed action). Full intent list: `src/features/era/types.ts`.

## Files at a glance

- **Page entry**: `src/app/era/page.tsx`
- **Shell components**:
  - `src/components/era/EraShell.tsx` — also defines `EraThreadTranscript` (HUB-17), the scrollable multi-turn view above the command bar; reads `era_messages` via the same hooks as `useEraConversation.ts`
  - `src/components/era/CommandBar.tsx`
  - `src/components/era/EraFaceNav.tsx`
  - `src/components/era/EraDots.tsx`
  - `src/components/era/HubScatterWidgets.tsx`
  - `src/components/era/EraChatDrawer.tsx` — mobile-only (`md:hidden`) chat bubble + bottom sheet for module/activity dashboard views, so the floating CommandBar/transcript don't permanently eat a phone screen. `CommandBar` and `EraShell`'s exported `EraThreadTranscript` both take a `variant?: "floating" | "embedded"` prop (default `"floating"`, byte-identical to before) so the sheet reuses their logic instead of duplicating it. Backdrop/sheet stay mounted and animate via the `open` prop directly (no `AnimatePresence` mount/unmount) — the embedded transcript's own re-renders (realtime, typewriter) were interfering with `AnimatePresence`'s exit-complete tracking and left it stuck-but-invisible.
  - *(deleted 2026-08-25, HUB-17 — confirmed zero importers: `EraHubView.tsx`, `EraTranscript.tsx`, `EraFaceCard.tsx`, `QuickFaceChips.tsx`, `FaceHeader.tsx`, `FaceCanvas.tsx`, `FacePlaceholder.tsx`)*
- **Face widgets** (one per face): `src/components/era/face-widgets/`
- **Dashboards**: `src/components/era/dashboards/`
- **AI assistant component** (in-app chat surface): `src/components/ai/AIChatAssistant.tsx`
- **Hooks**:
  - `src/features/era/useEraConversation.ts`
  - `src/features/era/useEraBudgetSubmit.ts`
  - `src/features/era/useEraStore.ts`
  - `src/features/era/useEraHousehold.ts`
  - `src/features/era/useEraWakeListener.ts`
  - `src/features/era/useEraAskAI.ts` — "Ask AI" (Slice 4): `askAI()` calls `/api/era/ask`; `confirmProposal()`/`dismissProposal()` act on `activeProposal`
- **Intent layer**:
  - `src/features/era/intentRouter.ts`
  - `src/features/era/useEraTurn.ts` — **the one entry point from "a sentence" to "a reply"** (HUB-17). Classifies via `rootIntentRouter`, resolves via `resolveIntent`, persists to `era_messages`, updates the store. `CommandBar` (typed) and `EraShell`'s voice wiring (spoken, via `ConversationHandlers.runTurn`) both call this and nothing else.
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
  - `hooks/useConversationMode.ts`
- **API routes**:
  - `src/app/api/ai-chat/` ← main inference endpoint
  - `src/app/api/era/ask/` ← ERA "Ask AI" manual handoff (Slice 4, HUB-23) — never invoked by the router, only an explicit UI tap; performs no writes itself
  - `src/app/api/azure-speech/` ← STT/TTS bridge
  - `src/app/api/tts/`
  - `src/app/api/suggest-schedule/`
- **Context assembly** (`src/lib/ai/context.ts`, WP-10): `fetchBudgetContext`/`fetchMonthlyTrend` (moved here from `api/ai-chat/route.ts` — route files can only export HTTP methods, so anything meant for reuse has to live in `lib`) and `fetchScheduleContext` (new — upcoming items + NFC tags/states, feeds the Ask AI schedule-face prompt)
- **Ask AI proposal contract** (`src/lib/ai/eraAskProposal.ts`): Gemini structured output (`responseSchema`) → Zod-validated `AskAIResponse` → a `propose_nfc_reminder` is enriched and returned as `AskAIResult` ONLY when its `nfcTagId`/`targetState` match a real row in `ScheduleContext` — otherwise it degrades to prose. Same three-layer safety pattern as `analysisReport.ts`.
- **DB tables**: AI session usage rows in the AI Usage module's tables
- **Avatar**: `src/components/shared/EraAvatar.tsx`, `src/components/shared/ERAMark.tsx`

## Common edit scenarios

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

- AI endpoints are slow → **always** pass `timeoutMs: 60_000` (or higher) to `safeFetch()` (Hard Rule #6).
- Focus briefing cache has its own Hard Rule (see AI Assistant vault doc).
- Faces 6–10 (Health/Trip/Fitness/Outfit/Memory) are roadmap, not shipped.
- **A pending question consumes the next turn unconditionally.** If `useEraStore.pendingTurn` is set (currently only "what time for this reminder?"), the next utterance is NEVER reclassified through the router — it's handed straight to `resolvePendingReminderAnswer`. A genuinely new, unrelated command sent right after ERA asks a question gets treated as a failed time-answer and flushes the pending reminder to a draft. Known, documented rough edge (HUB-19) — not a bug to "fix" by guessing intent.
- **Never parse a bare `YYYY-MM-DD` into a `Date` with `new Date(str)`** for anything meal-planning or schedule related — it parses as UTC midnight and drifts a day in any negative-UTC-offset timezone (and the reverse in positive-offset ones, which is what actually bit a first draft of the `mealPlanGaps` test in this repo's own CI timezone). Use `formatDate()` (`src/lib/utils/date.ts`, local calendar fields) to go FROM a `Date`, and anchor at noon (`` `${dateStr}T12:00:00` ``) when going the other way for display.

## Connected modules

- All modules — ERA reads context from every standalone.
- **Hub Chat** — ERA's proactive surfaces render in the Hub.
- **AI Usage** — token consumption written here.
- **Watch UI** — voice entry shares the conversation engine.

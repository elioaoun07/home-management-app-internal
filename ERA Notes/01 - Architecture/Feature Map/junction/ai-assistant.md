# AI Assistant (ERA)

**Type:** Junction
**Route:** `/era`
**Vault doc:** `ERA Notes/03 - Junction Modules/AI Assistant/`

## What it does

ERA is the proactive AI co-pilot. It lives across all modules: a command bar parses typed/voice input into intents (budget, schedule, chef, brain), runs the corresponding action, and replies in ERA's voice. Each module is a "face" with its own hue. Voice mode includes wake-word listening, STT, intent classification, TTS.

## Files at a glance

- **Page entry**: `src/app/era/page.tsx`
- **Shell components**:
  - `src/components/era/EraShell.tsx`
  - `src/components/era/EraHubView.tsx`
  - `src/components/era/EraTranscript.tsx`
  - `src/components/era/CommandBar.tsx`
  - `src/components/era/EraFaceNav.tsx`
  - `src/components/era/EraFaceCard.tsx`
  - `src/components/era/QuickFaceChips.tsx`
  - `src/components/era/FaceHeader.tsx`
  - `src/components/era/FaceCanvas.tsx`
  - `src/components/era/FacePlaceholder.tsx`
  - `src/components/era/EraDots.tsx`
  - `src/components/era/HubScatterWidgets.tsx`
- **Face widgets** (one per face): `src/components/era/face-widgets/`
- **Dashboards**: `src/components/era/dashboards/`
- **AI assistant component** (in-app chat surface): `src/components/ai/AIChatAssistant.tsx`
- **Hooks**:
  - `src/features/era/useEraConversation.ts`
  - `src/features/era/useEraBudgetSubmit.ts`
  - `src/features/era/useEraStore.ts`
  - `src/features/era/useEraHousehold.ts`
  - `src/features/era/useEraWakeListener.ts`
- **Intent layer**:
  - `src/features/era/intentRouter.ts`
  - `src/features/era/replyFormatter.ts`
  - `src/features/era/faceRegistry.ts`
  - `src/features/era/intents/index.ts`, `resolveIntent.ts`
  - `src/features/era/intents/{budget,schedule,chef,brain}.ts`
  - `src/features/era/intents/resolvers/{budget,schedule,chef,brain}.ts`
  - `src/features/era/intents/formatters/{budget,schedule,chef,brain}.ts`
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
  - `src/app/api/azure-speech/` ← STT/TTS bridge
  - `src/app/api/tts/`
  - `src/app/api/suggest-schedule/`
- **DB tables**: AI session usage rows in the AI Usage module's tables
- **Avatar**: `src/components/shared/EraAvatar.tsx`, `src/components/shared/ERAMark.tsx`

## Common edit scenarios

- **"Add a new intent / face"** →
  1. New face entry in `src/features/era/faceRegistry.ts`.
  2. New folder under `src/features/era/intents/{name}.ts` + `resolvers/{name}.ts` + `formatters/{name}.ts`.
  3. Register in `intents/index.ts` and `resolveIntent.ts`.
  4. New widget hook under `widgets/`.
  5. UI in `src/components/era/face-widgets/` and `dashboards/`.
- **"Change command bar UI"** → `src/components/era/CommandBar.tsx`.
- **"Edit voice mode flow"** → `src/features/voice-conversation/conversationEngine.ts` is the orchestrator. Wake-word in `azureWake.ts` (still needs external setup — see project memory).
- **"Change ERA's voice / persona"** → `src/features/era/replyFormatter.ts` + `speechTemplates.ts`.
- **"Edit the proactive briefing"** → see the briefing/insight calls in widget hooks + Focus briefing cache rule (vault Hard Rule).

## Gotchas

- AI endpoints are slow → **always** pass `timeoutMs: 60_000` (or higher) to `safeFetch()` (Hard Rule #6).
- Focus briefing cache has its own Hard Rule (see AI Assistant vault doc).
- Faces 6–10 (Health/Trip/Fitness/Outfit/Memory) are roadmap, not shipped.

## Connected modules

- All modules — ERA reads context from every standalone.
- **Hub Chat** — ERA's proactive surfaces render in the Hub.
- **AI Usage** — token consumption written here.
- **Watch UI** — voice entry shares the conversation engine.

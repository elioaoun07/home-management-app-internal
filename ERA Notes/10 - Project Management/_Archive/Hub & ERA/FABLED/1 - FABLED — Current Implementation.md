---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/hub-era
---

# Hub & ERA · FABLED 1 — Current Implementation

> **FABLED:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> How the flagship is *actually* built, verified against `main` 2026-06-10. Authoritative code maps stay in the vault docs ([Hub Chat](<../../../03 - Junction Modules/Hub Chat/Overview.md>), [AI Assistant](<../../../03 - Junction Modules/AI Assistant/Overview.md>)); this is the cluster-level X-ray.

---

## 1 · The three subsystems

Hub & ERA is really three systems sharing one surface:

1. **Hub Chat** — the realtime household messaging layer (threads, voice messages, shopping mode, item chats).
2. **ERA** — the assistant: an **intent system** (`features/era/intents/`) + faces/widgets + the Gemini layer.
3. **Voice Conversation** — the Azure STT/TTS pipeline that wraps ERA in speech.

**Mount points (verified — the Feature Index used to say `src/app/hub/`, which does not exist; fixed 2026-06-10):**
- `src/app/chat/page.tsx` → `<HubPage standalone initialThreadId=…>` (hydration-guarded)
- `src/app/alerts/page.tsx` → `<HubPage>` restricted to Alerts/Feed views
- `src/components/hub/HubPage.tsx` — **202 KB / ~5,506 LOC**, the largest file in the app; it owns thread state, message rendering, ERA invocation, voice-mode callbacks, and shopping-mode switching.

## 2 · Hub Chat — data plane

**Client:** `features/hub/` — `hooks.ts` (44 KB; threads/messages/realtime queries), `useHubPersistence.ts` (15 KB; the *legacy localStorage offline queue* — intentional for shopping list only, per architecture rule: don't add to it), `itemLinksHooks.ts`, `usePartnerId.ts`, `messageActions.ts` (the chat→transaction/reminder/item bridge).

**API:** `src/app/api/hub/` — `messages/route.ts` (**42 KB** — the real message engine: send/edit/react/voice/system messages), `item-links` (32 KB), `threads` (11 KB), `shopping-groups` (10 KB), `topics`, `voice-message`, `message-actions`, `stats`, `alerts`, `feed`, `mark-read`, `item-chat-photo`.

**DB:** `hub_chat_threads`, `hub_messages`, `hub_message_actions` (+ shopping/item-link satellites — check `schema.sql`).

**Realtime:** browser Supabase singleton (`lib/supabase/client.ts` — required for realtime subscriptions). Message Actions modals (`AddTransactionFromMessageModal`, `AddReminderFromMessageModal`) turn any message into a Budget/Schedule record.

## 3 · ERA — the intent system (the part most worth knowing)

`features/era/` is a clean **face-based architecture** that the vault doc undersells:

```
intents/
├── index.ts          ← rootIntentRouter: registry of per-face routers
├── resolveIntent.ts  ← matching: utterance → face + intent
├── brain.ts · budget.ts · chef.ts · schedule.ts     ← intent definitions per face
├── resolvers/…       ← per-face data fetching (what the intent needs)
└── formatters/…      ← per-face reply formatting (how ERA says it)
widgets/
└── useBrainSummary · useBudgetSummary · useChefSummary · useScheduleSummary
```

- **Four faces** = four domains: **brain** (memories/household), **budget**, **chef** (kitchen), **schedule**. Each face has intents → resolver → formatter → summary widget. `faceRegistry.ts` maps face → visual; `replyFormatter.ts` normalizes output; `useEraStore.ts` (Zustand) holds conversation state; `useEraWakeListener.ts` listens for the wake event; `useEraBudgetSubmit.ts` is the direct money-entry path.
- `intentRouter.ts` is a **back-compat re-export shim** over `intents/index.ts` (`stubIntentRouter` alias) — the real router is the per-face registry.
- **Adding a capability = adding an intent to one face** (definition + resolver + formatter), not touching a monolith. This is the extension seam for everything in [file 4](<4 - FABLED — Future Enhancements.md>).

**Gemini layer:** `src/lib/ai/gemini.ts` (17 KB — model calls), `rateLimit.ts` (8 KB), `tokenUtils.ts`. **API:** `api/ai-chat/route.ts` (**30 KB** — context injection: transactions + items + household; both batch and `stream/route.ts` for token streaming, used by Hub text chat since May), `api/era/conversations|messages` (conversation persistence). Hard Rule: AI calls must pass long `timeoutMs` to `safeFetch` (default 3 s would kill them); the Focus briefing is cached 24 h (module hard rule).

## 4 · Voice Conversation — the Azure pipeline

(Heavy detail in memory `project_voice_conversation`; summary:)

- **STT:** `azureSTT.ts` — Azure Speech SDK continuous recognition; token minted by `api/azure-speech/token` (9-min cache). Lazy-loaded; **never import the SDK server-side**.
- **TTS:** `azureTTS.ts` — streaming synthesis → Int16 PCM → AudioWorklet `public/voice/pcm-player.worklet.js`; first audio ~100 ms. Voice: `en-US-AvaMultilingualNeural` (keep).
- **Engine:** `conversationEngine.ts` (16 KB state machine) + `ttsQueue.ts` (sentence streaming) + `intentClassifier.ts` (voice-side classification) + `speechTemplates.ts` + `greetingCache.ts` (3 pre-fetched hour-variant greetings via REST `api/tts`).
- **Barge-in:** first STT interim word while ERA speaks kills the worklet node instantly.
- **Wake word:** still regex on STT transcripts (`azureWake.ts` is the stub awaiting a trained `.table` model + `NEXT_PUBLIC_WAKE_MODEL_ENABLED=true`).
- **Dead code on disk:** `sttCapture.ts` + `vadGate.ts` — the *old* Web Speech/VAD path, **no longer imported** (verified per memory; delete candidates → [file 3](<3 - FABLED — Optimization Plan.md>)).

## 5 · Size & risk map

| File | Size | Risk |
|---|---|---|
| `components/hub/HubPage.tsx` | 202 KB (~5,506 LOC) | Largest file in the app; owns 3 subsystems' UI glue. Every Hub change is high-regression-risk. |
| `components/hub/ShoppingListView.tsx` | 107 KB (~3,181 LOC) | Second largest; shared with Kitchen cluster. |
| `components/hub/NotesListView.tsx` | 56 KB | Same pattern forming. |
| `api/hub/messages/route.ts` | 42 KB | Message engine + side effects in one route. |
| `api/ai-chat/route.ts` | 30 KB | Context injection + model call + parsing in one route. |

## 6 · Test reality

**Zero tests across all three subsystems** (the 28-test suite covers lib money/date only). The intent system is the most testable surface (pure resolvers/formatters) and the most valuable to cover — see [file 3 · O1](<3 - FABLED — Optimization Plan.md>).

---
created: 2026-05-10
updated: 2026-05-10
type: feature
module: hub-chat
module-type: junction
tags:
  - type/feature
  - module/hub-chat
  - feature/voice-conversation
---

# ERA Voice Conversation Mode

> **Feature directory:** `src/features/voice-conversation/`
> **API route (streaming):** `src/app/api/ai-chat/stream/route.ts`
> **Available on:** Budget + Reminder threads only (thread purpose gate in `ThreadConversation`)
> **Status:** Shipped — May 2026

---

## Overview

A foreground voice conversation mode that lets users speak to ERA naturally. Activated via a sparkle button (✨) in the thread header or the `ConversationToggle` button in the input bar. ERA listens, classifies intent, executes native actions, and speaks back using Azure Neural TTS.

---

## Architecture — Five Tiers

### T0: Wake / Activation
- No always-on wake word (requires Picovoice Porcupine integration — see below)
- **Current activation:** Tap the ✨ button in thread header → enables conversation mode; tap again → wakes ERA
- Or tap the `ConversationToggle` mic button in the input bar (replaces standard mic button visually)
- **Barge-in:** Tap while ERA is speaking to interrupt immediately

### T1: Speech Capture
- `src/features/voice-conversation/sttCapture.ts`
- Wraps `webkitSpeechRecognition` / `SpeechRecognition`
- 500 ms silence window triggers `onFinal` callback (VAD simulation)
- Restarts continuously while state is `listening`
- Not available on Firefox (degrades gracefully — ConversationToggle hidden when unsupported)

### T2: Intent Classification
- `src/features/voice-conversation/intentClassifier.ts`
- Extends `src/lib/nlp/messageTransactionParser.ts` with verb anchors
- Returns typed `Intent` with `confidence` (0–1)
- Intent kinds: `log_expense`, `set_reminder`, `add_to_shopping`, `query_balance`, `query_items`, `cancel`, `sleep`, `unknown`

### T3a: Native Handlers
Routed in `conversationEngine.ts` based on confidence thresholds:
- **≥ 0.85**: execute immediately via `onLogExpense` / `onSetReminder` / `onAddToShopping` callbacks
- **0.50–0.85**: ask spoken confirmation ("Log $4.50 to Coffee?"), wait for yes/no
- **< 0.50 or unknown**: offer AI fallback ("Want me to dig deeper?")

Native actions in `HubPage.tsx` wire to existing infrastructure:
- `onLogExpense` → `sendMessage.mutateAsync()` → `setTransactionModalData()` → opens `AddTransactionFromMessageModal` pre-filled
- `onSetReminder` → `sendMessage.mutateAsync()` → `setReminderModalData()` → opens `AddReminderFromMessageModal` pre-filled
- `onAddToShopping` → sends each item as hub message to the shopping thread

### T3b: AI Handler (Gemini Streaming)
- `src/lib/ai/geminiStream.ts` — `streamMessageToGemini()` async generator
- `src/app/api/ai-chat/stream/route.ts` — SSE endpoint (`text/event-stream`)
- Events: `{ type: "chunk", text }` | `{ type: "done" }` | `{ type: "error", error }`
- Same auth + rate limit + token budget as `/api/ai-chat`
- `maxDuration = 60` set on the route

### T4: TTS Playback
- `src/features/voice-conversation/ttsQueue.ts`
- Sentence-streaming: splits text on `.!?`, fetches each sentence from `/api/tts`, plays sequentially
- Voice: `en-US-AvaMultilingualNeural` (Azure Neural TTS)
- First audio byte audible ~400 ms after ERA starts generating (well before full response)
- Barge-in stops playback immediately

### T5: Conversation State Machine
- `src/features/voice-conversation/conversationEngine.ts`
- States: `off → idle → listening → classifying → confirming | executing | ai_streaming → speaking → listening (loop)`
- **Continuation window:** 12 s — mic stays open after ERA finishes speaking
- **Confirmation timeout:** 5 s — if no yes/no, treats as implicit "no"
- **Control intents:** "stop"/"cancel" → immediate cancel; "thanks ERA"/"goodbye ERA" → sleep

---

## Component Hierarchy

```
ThreadConversation (HubPage.tsx)
├── useConversationMode (hooks/useConversationMode.ts) ← orchestration hook
│   └── createConversationEngine (conversationEngine.ts) ← state machine
│       ├── createSTTCapture (sttCapture.ts) ← Web Speech API
│       ├── createTTSQueue (ttsQueue.ts) ← Azure TTS sentence streaming
│       └── classifyIntent (intentClassifier.ts) ← NLP routing
├── ConversationOrb (components/ConversationOrb.tsx) ← animated state indicator
└── ConversationToggle (components/ConversationToggle.tsx) ← input bar button
```

---

## Future: Picovoice Porcupine Wake Word

To enable "Hey ERA" always-on wake word:

1. Sign up at [picovoice.ai](https://picovoice.ai)
2. In Picovoice Console, train a custom keyword "Hey ERA" → download `.ppn` file
3. Get an AccessKey from the console
4. `pnpm add @picovoice/porcupine-web @picovoice/web-voice-processor`
5. Add `NEXT_PUBLIC_PICOVOICE_KEY=your-key` to `.env.local`
6. Drop `hey-era.ppn` into `public/wake/hey-era.ppn`
7. Build `src/features/voice-conversation/wakeWord.ts` using `PorcupineWorker`:
   ```ts
   import { PorcupineWorker } from "@picovoice/porcupine-web";
   const worker = await PorcupineWorker.create(accessKey, [{ builtin: null, label: "hey-era", sensitivity: 0.5 }], /* model */ null, audioInputDevices[0]);
   worker.onmessage = (e) => { if (e.data.label === "hey-era") engine.triggerWake(); };
   ```
8. In `useConversationMode.ts`, mount the worker alongside the conversation engine

**Free tier:** 3 unique devices — fits the household model perfectly.

---

## Design Constraints / Gotchas

- **Background listening impossible on PWA.** Screen lock stops mic. Capacitor shell would unlock this — see `project_capacitor_shell.md` memory.
- **Firefox:** Web Speech API not supported. `ConversationToggle` and `ConversationOrb` are hidden when `isSpeechRecognitionSupported()` returns false.
- **iOS quirk:** Web Speech API on iOS Safari requires a user gesture to start each recognition session. The restart loop in `sttCapture.ts` (via `onEnd` + timeout) handles this but may have a 100–200 ms gap between turns on iOS.
- **TTS cost:** Azure Neural TTS is ~$16 per 1M characters. ERA voice responses are kept short (512 token max output on the streaming route).
- **safeFetch timeout:** AI stream calls bypass `safeFetch` and use native `fetch` with `AbortSignal.timeout(60_000)`. This is intentional — the SSE stream must not be killed by the 8 s safeFetch timeout.
- **`console.log` in gemini.ts:** Hard Rule #22 — the `console.warn` calls in `generateContentWithFallback` (existing code) should be addressed separately. The new `streamMessageToGemini` function has none.

---

## Env Vars Required

| Variable | Where | Purpose |
|---|---|---|
| `AZURE_TTS_KEY` | Already in `.env.local` | TTS synthesis |
| `AZURE_TTS_REGION` | Already in `.env.local` | TTS endpoint |
| `GEMINI_API_KEY` | Already in `.env.local` | AI streaming |
| `NEXT_PUBLIC_PICOVOICE_KEY` | Future — not yet required | Wake word detection |

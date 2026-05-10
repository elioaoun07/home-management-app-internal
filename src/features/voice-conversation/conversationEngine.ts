"use client";

import { classifyIntent, type Intent } from "./intentClassifier";
import { createSTTCapture, type STTCapture } from "./sttCapture";
import { createTTSQueue, type TTSQueue } from "./ttsQueue";
import {
  CANCEL_ACK,
  confirmTemplate,
  DIG_DEEPER_PROMPT,
  SLEEP_ACK,
  successTemplate,
  WAKE_ACK,
} from "./speechTemplates";

export type ConversationState =
  | "off"
  | "idle"           // Wake word armed, waiting for "Hey ERA"
  | "listening"      // Mic open, waiting for speech
  | "classifying"    // Transcript received, processing intent
  | "confirming"     // Waiting for yes/no on medium-confidence intent
  | "executing"      // Running native action
  | "ai_streaming"   // Gemini streaming response
  | "speaking"       // TTS playing back ERA's response
  | "sleeping";      // Conversation ended, returning to idle

export interface ConversationHandlers {
  onStateChange?: (state: ConversationState) => void;
  onTranscriptChange?: (transcript: string) => void;
  /** Called when ERA is about to speak. Return true to cancel the utterance. */
  onWillSpeak?: (text: string) => void;
  /** Native action callbacks — implement these in HubPage to write to DB */
  onLogExpense?: (intent: Extract<Intent, { kind: "log_expense" }>) => Promise<void>;
  onSetReminder?: (intent: Extract<Intent, { kind: "set_reminder" }>) => Promise<void>;
  onAddToShopping?: (intent: Extract<Intent, { kind: "add_to_shopping" }>) => Promise<void>;
  onQueryBalance?: () => Promise<string>;
  onQueryItems?: (filter: "today" | "overdue" | "open") => Promise<string>;
  /** Fetch available categories for intent classification */
  getCategories?: () => Array<{ id: string; name: string; parent_id?: string | null; subcategories?: Array<{ id: string; name: string }> }>;
  /** Session ID for AI message logging */
  sessionId?: string;
}

interface EngineConfig {
  handlers: ConversationHandlers;
  /** Ms of silence in LISTENING state before returning to IDLE. Default 12000. */
  continuationWindowMs?: number;
  /** Ms to wait for yes/no confirmation before treating as "no". Default 5000. */
  confirmationTimeoutMs?: number;
  /** High confidence threshold — auto-execute above this. Default 0.85. */
  highConfidenceThreshold?: number;
}

/** Confidence below which we ask "want me to dig deeper?" rather than confirm. */
const AI_FALLBACK_THRESHOLD = 0.50;

export interface ConversationEngine {
  /** Start conversation mode — opens mic, arms wake-word simulation. */
  startConversation(): void;
  /** Stop conversation mode — closes mic, resets state. */
  stopConversation(): void;
  /** Signal that the user said "Hey ERA" (or long-pressed). Transitions idle→listening. */
  triggerWake(): void;
  /** Immediately stop TTS playback (barge-in support). */
  bargeIn(): void;
  readonly currentState: ConversationState;
}

export function createConversationEngine(config: EngineConfig): ConversationEngine {
  const {
    handlers,
    continuationWindowMs = 12_000,
    confirmationTimeoutMs = 5_000,
    highConfidenceThreshold = 0.85,
  } = config;

  let state: ConversationState = "off";
  let stt: STTCapture | null = null;
  let tts: TTSQueue | null = null;
  let continuationTimer: ReturnType<typeof setTimeout> | null = null;
  let confirmationTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingIntent: Intent | null = null;
  let pendingConfirmIsDigDeeper = false;
  let isStopped = false;

  function setState(s: ConversationState) {
    state = s;
    handlers.onStateChange?.(s);
  }

  function clearTimers() {
    if (continuationTimer) { clearTimeout(continuationTimer); continuationTimer = null; }
    if (confirmationTimer) { clearTimeout(confirmationTimer); confirmationTimer = null; }
  }

  function armContinuationWindow() {
    clearTimers();
    continuationTimer = setTimeout(() => {
      if (state === "listening" || state === "speaking") {
        setState("idle");
        startListeningSTT(); // re-arm STT in idle — waiting for wake
      }
    }, continuationWindowMs);
  }

  function speak(text: string, onDone?: () => void) {
    handlers.onWillSpeak?.(text);
    tts?.stop();
    tts = createTTSQueue({
      onDone: () => {
        if (isStopped) return;
        onDone?.();
      },
    });
    tts.push(text);
    tts.flush();
    setState("speaking");
  }

  async function executeNativeIntent(intent: Intent) {
    setState("executing");
    try {
      if (intent.kind === "log_expense") await handlers.onLogExpense?.(intent);
      else if (intent.kind === "set_reminder") await handlers.onSetReminder?.(intent);
      else if (intent.kind === "add_to_shopping") await handlers.onAddToShopping?.(intent);
      else if (intent.kind === "query_balance") {
        const result = await handlers.onQueryBalance?.();
        if (result) {
          speak(result, () => { setState("listening"); startListeningSTT(); armContinuationWindow(); });
          return;
        }
      } else if (intent.kind === "query_items") {
        const result = await handlers.onQueryItems?.(intent.filter);
        if (result) {
          speak(result, () => { setState("listening"); startListeningSTT(); armContinuationWindow(); });
          return;
        }
      }

      const confirmation = successTemplate(intent);
      speak(confirmation, () => {
        setState("listening");
        startListeningSTT();
        armContinuationWindow();
      });
    } catch {
      speak("Something went wrong. Try again.", () => {
        setState("listening");
        startListeningSTT();
        armContinuationWindow();
      });
    }
  }

  async function invokeAI(transcript: string) {
    setState("ai_streaming");
    tts = createTTSQueue({
      onDone: () => {
        if (isStopped) return;
        setState("listening");
        startListeningSTT();
        armContinuationWindow();
      },
    });

    try {
      const response = await fetch("/api/ai-chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: transcript,
          sessionId: handlers.sessionId,
          chatHistory: [],
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok || !response.body) {
        throw new Error("AI stream unavailable");
      }

      setState("speaking");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; text?: string; error?: string };
            if (event.type === "chunk" && event.text) tts?.push(event.text);
            if (event.type === "done") tts?.flush();
            if (event.type === "error") {
              tts?.stop();
              speak("I couldn't reach the AI. Try again.", () => {
                setState("listening");
                startListeningSTT();
                armContinuationWindow();
              });
              return;
            }
          } catch {
            // ignore malformed event
          }
        }
      }
      tts?.flush();
    } catch {
      tts?.stop();
      speak("I couldn't reach the AI right now.", () => {
        setState("listening");
        startListeningSTT();
        armContinuationWindow();
      });
    }
  }

  function handleTranscript(transcript: string) {
    if (isStopped || !transcript.trim()) return;
    clearTimers();

    // If in CONFIRMING state, interpret new speech as yes/no answer
    if (state === "confirming" && pendingIntent) {
      const lower = transcript.toLowerCase().trim();
      const isYes = /^(yes|yeah|yep|sure|do it|go ahead|confirm|ok|okay|correct|right)\b/i.test(lower);
      const isNo = /^(no|nope|never mind|cancel|don'?t|stop)\b/i.test(lower);

      if (isYes) {
        if (pendingConfirmIsDigDeeper) {
          const t = (pendingIntent as Extract<Intent, { kind: "unknown" }>).transcript;
          pendingIntent = null;
          invokeAI(t);
        } else {
          const intent = pendingIntent;
          pendingIntent = null;
          executeNativeIntent(intent);
        }
        return;
      }

      if (isNo) {
        pendingIntent = null;
        speak(CANCEL_ACK, () => {
          setState("listening");
          startListeningSTT();
          armContinuationWindow();
        });
        return;
      }
      // Not a clear yes/no — treat as new utterance
    }

    setState("classifying");
    const categories = handlers.getCategories?.() ?? [];
    const intent = classifyIntent(transcript, categories);

    // Barge-in: stop TTS the moment we start classifying
    tts?.stop();

    if (intent.kind === "cancel") {
      speak(CANCEL_ACK, () => {
        setState("listening");
        startListeningSTT();
        armContinuationWindow();
      });
      return;
    }

    if (intent.kind === "sleep") {
      speak(SLEEP_ACK, () => setState("idle"));
      return;
    }

    if (intent.confidence >= highConfidenceThreshold) {
      // High confidence → execute immediately
      executeNativeIntent(intent);
      return;
    }

    if (intent.confidence >= AI_FALLBACK_THRESHOLD) {
      // Medium confidence → ask for confirmation
      pendingIntent = intent;
      pendingConfirmIsDigDeeper = false;
      const question = confirmTemplate(intent);
      setState("confirming");
      speak(question, () => {
        startConfirmationTimer();
      });
      return;
    }

    if (intent.kind === "unknown") {
      // Offer AI fallback
      pendingIntent = intent;
      pendingConfirmIsDigDeeper = true;
      setState("confirming");
      speak(DIG_DEEPER_PROMPT, () => {
        startConfirmationTimer();
      });
      return;
    }

    // Low-confidence non-unknown — still offer confirmation
    pendingIntent = intent;
    pendingConfirmIsDigDeeper = false;
    const question = confirmTemplate(intent);
    setState("confirming");
    speak(question, () => {
      startConfirmationTimer();
    });
  }

  function startConfirmationTimer() {
    confirmationTimer = setTimeout(() => {
      // Timeout = implicit "no"
      pendingIntent = null;
      setState("listening");
      startListeningSTT();
      armContinuationWindow();
    }, confirmationTimeoutMs);
  }

  function startListeningSTT() {
    stt?.abort();
    if (isStopped) return;
    stt = createSTTCapture({
      onInterim: (t) => handlers.onTranscriptChange?.(t),
      onFinal: (t) => {
        handlers.onTranscriptChange?.(t);
        handleTranscript(t);
      },
      onError: (e) => {
        if (e.error === "not-allowed") {
          setState("off");
        } else {
          setState("listening");
          startListeningSTT();
          armContinuationWindow();
        }
      },
      onEnd: () => {
        // Restart STT if still in listening state (Web Speech API stops itself)
        if ((state === "listening" || state === "idle") && !isStopped) {
          setTimeout(() => {
            if ((state === "listening" || state === "idle") && !isStopped) {
              startListeningSTT();
            }
          }, 100);
        }
      },
    });
    stt.start();
  }

  return {
    get currentState() {
      return state;
    },

    startConversation() {
      isStopped = false;
      setState("idle");
    },

    stopConversation() {
      isStopped = true;
      clearTimers();
      stt?.abort();
      tts?.stop();
      setState("off");
    },

    triggerWake() {
      if (state === "off" || isStopped) return;
      clearTimers();
      tts?.stop();
      pendingIntent = null;
      setState("listening");
      speak(WAKE_ACK, () => {
        if (!isStopped) {
          startListeningSTT();
          armContinuationWindow();
        }
      });
    },

    bargeIn() {
      tts?.stop();
      if (state === "speaking" || state === "ai_streaming") {
        setState("listening");
        startListeningSTT();
        armContinuationWindow();
      }
    },
  };
}

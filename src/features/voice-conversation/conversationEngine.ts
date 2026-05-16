"use client";

import { classifyIntent, type Intent } from "./intentClassifier";
import { createSTTCapture, type STTCapture } from "./sttCapture";
import { createTTSQueue, type TTSQueue } from "./ttsQueue";
import {
  CANCEL_ACK,
  confirmTemplate,
  DIG_DEEPER_PROMPT,
  getWakeGreeting,
  SLEEP_ACK,
  successTemplate,
} from "./speechTemplates";
import { getCachedGreeting } from "./greetingCache";
import { getAudioContext } from "./audioContext";

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
  /** User's first name — personalizes the wake greeting. */
  userName?: string;
  /**
   * Called when the engine activates.
   * `source === "speech"` means the wake phrase was heard.
   * `source === "trigger"` means the user tapped/clicked.
   */
  onWake?: (source: "speech" | "trigger") => void;
}

/** Confidence below which we ask "want me to dig deeper?" rather than confirm. */
const AI_FALLBACK_THRESHOLD = 0.50;

/**
 * Wake phrase pattern. Accepts: "ERA", "Hey ERA", "Hi ERA", "Hello ERA", "OK ERA".
 * Uses \b (not ^) so it survives Chrome prefixing with a space or filler word.
 * The \b before the optional prefix ensures "area" doesn't match.
 */
const WAKE_PATTERN = /\b(hey|hi|hello|ok|okay)?\s*e\.?r\.?a\.?\b/i;

export interface ConversationEngine {
  /** Start conversation mode — opens mic, arms wake-word detection. */
  startConversation(): void;
  /** Stop conversation mode — closes mic, resets state. */
  stopConversation(): void;
  /** Signal that the user said "Hey ERA" (or long-pressed). Transitions idle→listening. */
  triggerWake(): void;
  /** Immediately stop TTS playback (barge-in support). */
  bargeIn(): void;
  /**
   * Called by an external VAD gate when speech energy is detected in idle state.
   * Arms a fresh STT instance to determine if it's the wake phrase.
   */
  armIdleSTT(): void;
  readonly currentState: ConversationState;
}

export function createConversationEngine(config: EngineConfig): ConversationEngine {
  const {
    handlers,
    continuationWindowMs = 12_000,
    confirmationTimeoutMs = 5_000,
    highConfidenceThreshold = 0.85,
    userName,
    onWake,
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
        startListeningSTT(); // re-arm STT in idle — listening for "Hey ERA"
      }
    }, continuationWindowMs);
  }

  /**
   * Plays the wake greeting using a cached AudioBuffer (instant) if available,
   * falling back to the live TTS fetch path.
   */
  function speakGreeting(onDone: () => void) {
    const greeting = getWakeGreeting(userName);
    handlers.onWillSpeak?.(greeting);
    tts?.stop();

    const cachedBuf = getCachedGreeting(greeting);
    if (cachedBuf) {
      setState("speaking");
      try {
        const ac = getAudioContext();
        if (ac.state === "suspended") {
          // Context not yet unlocked — fall through to live TTS
          throw new Error("suspended");
        }
        const node = ac.createBufferSource();
        node.buffer = cachedBuf;
        node.connect(ac.destination);
        node.onended = () => { if (!isStopped) onDone(); };
        node.start();
        return;
      } catch {
        // Fall through to live TTS
      }
    }

    // Live TTS path (also handles the first wake before cache is warm)
    tts = createTTSQueue({
      onDone: () => {
        if (isStopped) return;
        onDone();
      },
    });
    tts.push(greeting);
    tts.flush();
    setState("speaking");
  }

  /**
   * Shared wake logic — called by triggerWake() (click/long-press) and by
   * wake phrase detection (speech). Kill the current STT first so its abort()
   * clears the sttCapture silence timer — preventing any stale onFinal from
   * firing into intent classification while ERA is speaking the greeting.
   */
  function activateListening(source: "speech" | "trigger" = "speech") {
    clearTimers();
    stt?.abort();
    stt = null;
    tts?.stop();
    pendingIntent = null;
    onWake?.(source);
    setState("listening");

    if (source === "speech") {
      // Voice wake: play greeting (cached or live), then open mic for user's command.
      speakGreeting(() => {
        if (!isStopped) {
          startListeningSTT();
          armContinuationWindow();
        }
      });
    } else {
      // Click/tap wake: no greeting TTS — go straight to listening.
      startListeningSTT();
      armContinuationWindow();
    }
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
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
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

    // Ignore any stale STT results that fire while TTS is playing
    if (state === "speaking") return;

    // In idle state, only respond to the wake phrase — ignore everything else
    if (state === "idle") {
      if (WAKE_PATTERN.test(transcript)) {
        activateListening("speech");
      }
      return;
    }

    clearTimers();

    // If in CONFIRMING state, interpret new speech as yes/no answer
    if (state === "confirming" && pendingIntent) {
      // Wake phrase escapes confirmation — user is re-addressing ERA
      if (WAKE_PATTERN.test(transcript.trim())) {
        activateListening("speech");
        return;
      }
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
      executeNativeIntent(intent);
      return;
    }

    if (intent.confidence >= AI_FALLBACK_THRESHOLD) {
      pendingIntent = intent;
      pendingConfirmIsDigDeeper = false;
      const question = confirmTemplate(intent);
      setState("confirming");
      speak(question, () => { startConfirmationTimer(); });
      return;
    }

    if (intent.kind === "unknown") {
      pendingIntent = intent;
      pendingConfirmIsDigDeeper = true;
      setState("confirming");
      speak(DIG_DEEPER_PROMPT, () => { startConfirmationTimer(); });
      return;
    }

    pendingIntent = intent;
    pendingConfirmIsDigDeeper = false;
    const question = confirmTemplate(intent);
    setState("confirming");
    speak(question, () => { startConfirmationTimer(); });
  }

  function startConfirmationTimer() {
    confirmationTimer = setTimeout(() => {
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
      onInterim: (t) => {
        handlers.onTranscriptChange?.(t);
        // Fast-path: detect wake phrase on interim results so we don't wait
        // for the 500ms silence window before responding.
        if (state === "idle" && WAKE_PATTERN.test(t)) {
          activateListening("speech");
        }
      },
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
        stt = null; // mark as ended so armIdleSTT check knows it's safe to restart
        if ((state === "listening" || state === "idle") && !isStopped) {
          setTimeout(() => {
            // Skip if VAD already armed a fresh STT while we were waiting
            if ((state === "listening" || state === "idle") && !isStopped && !stt) {
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
      startListeningSTT(); // Begin listening for "Hey ERA" immediately
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
      activateListening("trigger");
    },

    bargeIn() {
      tts?.stop();
      if (state === "speaking" || state === "ai_streaming") {
        setState("listening");
        startListeningSTT();
        armContinuationWindow();
      }
    },

    armIdleSTT() {
      if (state === "idle" && !isStopped) {
        startListeningSTT();
      }
    },
  };
}

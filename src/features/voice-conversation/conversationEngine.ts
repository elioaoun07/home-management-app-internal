"use client";

import { CANCEL_WORDS, NO_WORDS, SLEEP_WORDS, YES_WORDS } from "./controlWords";
import { createAzureSTT, type AzureSTTCapture as STTCapture } from "./azureSTT";
import { createTTSQueue, type TTSQueue } from "./ttsQueue";
import { CANCEL_ACK, DIG_DEEPER_PROMPT, getWakeGreeting, SLEEP_ACK } from "./speechTemplates";
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
  /**
   * The unified ERA brain (`useEraTurn` — see `src/components/era/EraShell.tsx`).
   * Classifies AND resolves the transcript through the exact same router +
   * resolvers the typed command bar uses, so voice and typed can never
   * disagree on what a reminder's due date was or whether a draft actually
   * saved (HUB-16). When present, this REPLACES the legacy `onLogExpense` /
   * `onSetReminder` / … handlers below for this engine instance — see
   * `handleTranscript`. `kind` is the resolved intent's discriminant; the
   * engine uses it, together with `aiHandled`, to decide whether to offer
   * the AI dig-deeper prompt (`kind === "unknown" && !aiHandled` — Stage C's
   * useEraTurn already auto-escalates a language-gap miss and sets
   * `aiHandled: true`, so this only still offers for a capability gap).
   */
  runTurn?: (text: string) => Promise<{ reply: string; kind: string; aiHandled?: boolean; awaitingConfirm?: boolean }>;
  /**
   * Stage C2 — ERA's registry-aware "Ask AI" (`useEraAskAI.askAI`), wired
   * only on the ERA engine instance (EraShell) alongside `runTurn`. When
   * present, the spoken "yes, dig deeper" confirmation calls THIS — the same
   * registry-aware Ask AI a typed tap uses. HUB-82: wired on every engine
   * instance (ERA and Hub); the old `/api/ai-chat/stream` voice path is gone.
   */
  askAI?: (text: string) => Promise<string>;
  /**
   * HUB-82 — the turn left a confirm card (money, delete): a spoken "yes"
   * confirms it, "no" dismisses. `confirmProposal` resolves to the reply to
   * speak. Wired on every engine instance next to `runTurn`.
   */
  confirmProposal?: () => Promise<string>;
  dismissProposal?: () => void;
  /** Category names used only as STT phrase hints. */
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
  /** User's first name — personalizes the wake greeting. */
  userName?: string;
  /**
   * Called when the engine activates.
   * `source === "speech"` means the wake phrase was heard.
   * `source === "trigger"` means the user tapped/clicked.
   */
  onWake?: (source: "speech" | "trigger") => void;
}

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
    userName,
    onWake,
  } = config;

  let state: ConversationState = "off";
  let stt: STTCapture | null = null;
  let tts: TTSQueue | null = null;
  let continuationTimer: ReturnType<typeof setTimeout> | null = null;
  let confirmationTimer: ReturnType<typeof setTimeout> | null = null;
  /** What a spoken yes/no answers: a dig-deeper offer or a confirm card. */
  let pendingConfirm: { kind: "digDeeper"; transcript: string } | { kind: "proposal" } | null = null;
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
   * wake phrase detection (speech). Close the current Azure recognizer so no
   * stale transcript fires into intent classification while ERA is speaking.
   */
  function activateListening(source: "speech" | "trigger" = "speech") {
    clearTimers();
    stt?.abort();
    stt = null;
    tts?.stop();
    pendingConfirm = null;
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

  /**
   * The unified path: one call into the shared ERA brain, one reply to
   * speak. No confidence-tier branching — an intent the router isn't sure
   * about already comes back as `clarify`/`unknown` with a question baked
   * into `reply` (see rootIntentRouter + resolveIntent), so there is nothing
   * left for this engine to gate on except whether to offer the AI
   * dig-deeper prompt.
   */
  async function handleUnifiedTurn(transcript: string) {
    setState("executing");
    try {
      const { reply, kind, aiHandled, awaitingConfirm } = await handlers.runTurn!(transcript);

      // Stage C — a language-gap miss was already auto-escalated by
      // useEraTurn; `reply` is the AI's real answer, so just speak it below
      // instead of offering an escalation that already happened.
      if (kind === "unknown" && !aiHandled) {
        pendingConfirm = { kind: "digDeeper", transcript };
        speak(DIG_DEEPER_PROMPT, () => {
          setState("confirming");
          startConfirmationTimer();
        });
        return;
      }

      // HUB-82 — a confirm card is up: read it out, then take yes/no.
      if (awaitingConfirm && handlers.confirmProposal) {
        pendingConfirm = { kind: "proposal" };
        speak(reply, () => {
          setState("confirming");
          startConfirmationTimer();
        });
        return;
      }

      speak(reply, () => {
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

  /**
   * Stage C2 — the ERA engine instance's dig-deeper path (a capability-gap
   * miss; a language-gap one never reaches here — see handleUnifiedTurn).
   * Calls the SAME `useEraAskAI.askAI` a typed "Ask AI" tap uses, so a voice
   * escalation can render a real proposal and learn a taught template
   * (HUB-30) instead of only ever getting prose back.
   * Not streamed (askAI awaits one JSON response) — the visual state and
   * error handling otherwise mirror `invokeAI` below.
   */
  async function invokeEraAskAI(transcript: string) {
    setState("ai_streaming");
    try {
      const reply = await handlers.askAI!(transcript);
      speak(reply, () => {
        setState("listening");
        startListeningSTT();
        armContinuationWindow();
      });
    } catch {
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

    // CONFIRMING: the next utterance answers the open yes/no.
    if (state === "confirming" && pendingConfirm) {
      // Wake phrase escapes confirmation — user is re-addressing ERA
      if (WAKE_PATTERN.test(transcript.trim())) {
        activateListening("speech");
        return;
      }
      const lower = transcript.toLowerCase().trim();
      const open = pendingConfirm;
      if (YES_WORDS.test(lower)) {
        pendingConfirm = null;
        if (open.kind === "proposal") {
          void confirmProposalByVoice();
        } else if (handlers.askAI) {
          invokeEraAskAI(open.transcript);
        } else {
          speak("I can't dig deeper here.", () => {
            setState("listening");
            startListeningSTT();
            armContinuationWindow();
          });
        }
        return;
      }
      if (NO_WORDS.test(lower)) {
        pendingConfirm = null;
        if (open.kind === "proposal") handlers.dismissProposal?.();
        speak(CANCEL_ACK, () => {
          setState("listening");
          startListeningSTT();
          armContinuationWindow();
        });
        return;
      }
      // Not a clear yes/no — treat as a new utterance (the card stays up).
      pendingConfirm = null;
    }

    setState("classifying");
    tts?.stop(); // Barge-in: stop TTS the moment we start classifying

    // Cancel/sleep are voice-session control, not household actions — never
    // sent to the ERA router (see controlWords.ts).
    const lower = transcript.toLowerCase().trim();
    if (CANCEL_WORDS.test(lower)) {
      speak(CANCEL_ACK, () => {
        setState("listening");
        startListeningSTT();
        armContinuationWindow();
      });
      return;
    }
    if (SLEEP_WORDS.test(lower)) {
      speak(SLEEP_ACK, () => setState("idle"));
      return;
    }

    if (handlers.runTurn) {
      void handleUnifiedTurn(transcript);
      return;
    }

    speak("Voice isn't connected to ERA here.", () => {
      setState("listening");
      startListeningSTT();
      armContinuationWindow();
    });
  }

  async function confirmProposalByVoice() {
    setState("executing");
    try {
      const reply = await handlers.confirmProposal!();
      speak(reply || "Done.", () => {
        setState("listening");
        startListeningSTT();
        armContinuationWindow();
      });
    } catch {
      speak("That didn't go through.", () => {
        setState("listening");
        startListeningSTT();
        armContinuationWindow();
      });
    }
  }

  function startConfirmationTimer() {
    confirmationTimer = setTimeout(() => {
      pendingConfirm = null;
      setState("listening");
      startListeningSTT();
      armContinuationWindow();
    }, confirmationTimeoutMs);
  }

  function startListeningSTT() {
    if (stt !== null) return; // Azure STT already running — continuous, no restart needed
    if (isStopped) return;

    stt = createAzureSTT({
      phraseHints: handlers.getCategories?.()?.flatMap((c) => [
        c.name,
        ...(c.subcategories?.map((s) => s.name) ?? []),
      ]) ?? [],
      onInterim: (t) => {
        handlers.onTranscriptChange?.(t);
        // Instant barge-in: any recognized word while ERA is speaking cuts her off
        if ((state === "speaking" || state === "ai_streaming") && t.trim()) {
          tts?.stop();
          setState("listening");
          armContinuationWindow();
          return;
        }
        if (state === "idle" && WAKE_PATTERN.test(t)) {
          activateListening("speech");
        }
      },
      onFinal: (t) => {
        handlers.onTranscriptChange?.(t);
        handleTranscript(t);
      },
      onError: (msg) => {
        if (msg.includes("not-allowed") || msg.includes("denied")) {
          setState("off");
        } else {
          // Network/Azure error — null out so the restart loop can kick in
          stt = null;
          if (!isStopped) {
            setTimeout(() => { if (!isStopped && !stt) startListeningSTT(); }, 500);
          }
        }
      },
      onEnd: () => {
        stt = null;
        if (!isStopped) {
          // Restart after unexpected session end (e.g. server timeout)
          setTimeout(() => { if (!isStopped && !stt) startListeningSTT(); }, 100);
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createConversationEngine, type ConversationHandlers, type ConversationState } from "../conversationEngine";
import { isSpeechRecognitionSupported } from "../sttCapture";
import { createVADGate } from "../vadGate";

export interface UseConversationModeOptions {
  enabled: boolean;
  handlers: ConversationHandlers;
  /** User's first name — personalizes the wake greeting. */
  userName?: string;
  /**
   * Called when the engine activates.
   * `source === "speech"` = wake phrase heard (auto-enable speaker).
   * `source === "trigger"` = user tapped/clicked (leave speaker as-is).
   */
  onWake?: (source: "speech" | "trigger") => void;
}

export interface UseConversationModeResult {
  isSupported: boolean;
  state: ConversationState;
  transcript: string;
  /** Call when user long-presses the mic or says the wake word. */
  wake(): void;
  /** Stop ERA mid-sentence and return to listening. */
  bargeIn(): void;
  /** Enable/disable conversation mode. */
  toggle(): void;
  isEnabled: boolean;
}

/**
 * Public hook for ERA voice conversation mode.
 * Mounts/unmounts the conversation engine reactively with the `enabled` flag.
 * Includes a VAD gate that arms fresh STT on speech detection — eliminates the
 * STT restart-gap where wake words fired between recognition sessions were lost.
 */
export function useConversationMode(opts: UseConversationModeOptions): UseConversationModeResult {
  const [state, setState] = useState<ConversationState>("off");
  const [transcript, setTranscript] = useState("");
  const [isEnabled, setIsEnabled] = useState(opts.enabled);
  const engineRef = useRef<ReturnType<typeof createConversationEngine> | null>(null);
  const handlersRef = useRef(opts.handlers);
  const onWakeRef = useRef(opts.onWake);

  // Keep handlers + callbacks up-to-date without recreating the engine
  useEffect(() => {
    handlersRef.current = opts.handlers;
  }, [opts.handlers]);

  useEffect(() => {
    onWakeRef.current = opts.onWake;
  }, [opts.onWake]);

  // Create/destroy engine + VAD when isEnabled changes
  useEffect(() => {
    if (!isEnabled || !isSpeechRecognitionSupported()) {
      engineRef.current?.stopConversation();
      engineRef.current = null;
      setState("off");
      return;
    }

    const engine = createConversationEngine({
      handlers: {
        get onStateChange() { return handlersRef.current.onStateChange; },
        get onTranscriptChange() { return handlersRef.current.onTranscriptChange; },
        get onWillSpeak() { return handlersRef.current.onWillSpeak; },
        get onLogExpense() { return handlersRef.current.onLogExpense; },
        get onSetReminder() { return handlersRef.current.onSetReminder; },
        get onAddToShopping() { return handlersRef.current.onAddToShopping; },
        get onQueryBalance() { return handlersRef.current.onQueryBalance; },
        get onQueryItems() { return handlersRef.current.onQueryItems; },
        get getCategories() { return handlersRef.current.getCategories; },
        get sessionId() { return handlersRef.current.sessionId; },
      },
      continuationWindowMs: 12_000,
      confirmationTimeoutMs: 5_000,
      highConfidenceThreshold: 0.85,
      userName: opts.userName,
      onWake: (source) => onWakeRef.current?.(source),
    });

    // VAD gate: fires armIdleSTT when voice energy is detected locally.
    // Threshold 0.010 captures normal speech at comfortable distances.
    // Onset 5 frames (~80ms) prevents false triggers from pops/door slams.
    const vad = createVADGate({
      onSpeechStart: () => {
        engine.armIdleSTT();
      },
      threshold: 0.010,
      onsetFrames: 5,
      silenceMs: 600,
    });

    engine.startConversation();
    engineRef.current = engine;

    // Start VAD async — if mic is denied or unavailable, VAD silently degrades.
    // The engine falls back to continuous STT via armIdleSTT being never called
    // (user can still wake via click/triggerWake).
    vad.start().catch(() => {});

    return () => {
      vad.stop();
      engine.stopConversation();
      engineRef.current = null;
    };
  }, [isEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state + transcript from engine callbacks
  useEffect(() => {
    handlersRef.current = {
      ...opts.handlers,
      onStateChange: (s) => {
        setState(s);
        opts.handlers.onStateChange?.(s);
      },
      onTranscriptChange: (t) => {
        setTranscript(t);
        opts.handlers.onTranscriptChange?.(t);
      },
    };
  }, [opts.handlers]);

  const wake = useCallback(() => {
    engineRef.current?.triggerWake();
  }, []);

  const bargeIn = useCallback(() => {
    engineRef.current?.bargeIn();
  }, []);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  return {
    isSupported: isSpeechRecognitionSupported(),
    state,
    transcript,
    wake,
    bargeIn,
    toggle,
    isEnabled,
  };
}

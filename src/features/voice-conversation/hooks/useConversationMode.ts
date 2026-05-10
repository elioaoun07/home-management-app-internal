"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createConversationEngine, type ConversationHandlers, type ConversationState } from "../conversationEngine";
import { isSpeechRecognitionSupported } from "../sttCapture";

export interface UseConversationModeOptions {
  enabled: boolean;
  handlers: ConversationHandlers;
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
 */
export function useConversationMode(opts: UseConversationModeOptions): UseConversationModeResult {
  const [state, setState] = useState<ConversationState>("off");
  const [transcript, setTranscript] = useState("");
  const [isEnabled, setIsEnabled] = useState(opts.enabled);
  const engineRef = useRef<ReturnType<typeof createConversationEngine> | null>(null);
  const handlersRef = useRef(opts.handlers);

  // Keep handlers up-to-date without recreating the engine
  useEffect(() => {
    handlersRef.current = opts.handlers;
  }, [opts.handlers]);

  // Create/destroy engine when isEnabled changes
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
    });

    engine.startConversation();
    engineRef.current = engine;

    return () => {
      engine.stopConversation();
      engineRef.current = null;
    };
  }, [isEnabled]);

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

"use client";

import { useEffect, useRef } from "react";
import { useEraStore } from "./useEraStore";

// Anchored to start so "the ERA of..." never triggers. Accepts: "ERA",
// "Hey ERA", "Hi ERA", "Hello ERA", "OK ERA", "Okay ERA".
const WAKE_PATTERN = /^(hey|hi|hello|ok|okay)?\s*e\.?r\.?a\.?\b/i;

/**
 * Background STT listener that fires wake() when "Hey ERA" is detected.
 * Runs only while !isAwake. Cleans up automatically once ERA wakes.
 * Silently no-ops if the browser lacks SpeechRecognition support.
 *
 * Pass enabled=false when the conversation engine is running its own STT
 * to avoid two SpeechRecognition instances conflicting.
 */
export function useEraWakeListener({ enabled = true }: { enabled?: boolean } = {}) {
  const isAwake = useEraStore((s) => s.isAwake);
  const wake = useEraStore((s) => s.wake);

  // Use refs so inner callbacks never hold stale closures
  const stoppedRef = useRef(false);
  const recRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (!enabled || isAwake) return;
    if (typeof window === "undefined") return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    stoppedRef.current = false;

    function startListening() {
      if (stoppedRef.current) return;

      const rec: SpeechRecognition = new SpeechRecognitionAPI();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (e: SpeechRecognitionEvent) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const text = e.results[i][0].transcript;
          if (WAKE_PATTERN.test(text)) {
            stoppedRef.current = true;
            rec.abort();
            wake();
            return;
          }
        }
      };

      rec.onend = () => {
        // Web Speech API self-terminates on silence — restart to stay armed
        if (!stoppedRef.current) {
          setTimeout(startListening, 150);
        }
      };

      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        // Mic denied: give up silently. "no-speech"/"aborted": let onend restart.
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          stoppedRef.current = true;
        }
      };

      try {
        rec.start();
        recRef.current = rec;
      } catch {
        // Already running — ignore
      }
    }

    startListening();

    return () => {
      stoppedRef.current = true;
      recRef.current?.abort();
      recRef.current = null;
    };
  }, [enabled, isAwake, wake]);
}

"use client";

export interface STTResult {
  transcript: string;
  isFinal: boolean;
}

export interface STTCapture {
  start(): void;
  stop(): void;
  abort(): void;
  isSupported: boolean;
}

/** Silence window in ms after which we consider speech ended. */
const SILENCE_MS = 500;

/**
 * Thin wrapper around the Web Speech API.
 * Fires onInterim continuously and onFinal once speech ends (silence or explicit stop).
 * onError fires for mic-denied (error.error === "not-allowed") and other errors.
 */
export function createSTTCapture(opts: {
  lang?: string;
  onInterim: (transcript: string) => void;
  onFinal: (transcript: string) => void;
  onError: (error: SpeechRecognitionErrorEvent) => void;
  onEnd?: () => void;
}): STTCapture {
  const w = typeof window !== "undefined" ? (window as any) : null;
  const SpeechRecognitionImpl =
    w?.SpeechRecognition || w?.webkitSpeechRecognition || null;

  if (!SpeechRecognitionImpl) {
    return {
      start: () => {},
      stop: () => {},
      abort: () => {},
      isSupported: false,
    };
  }

  let rec: SpeechRecognition | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let accumulatedFinal = "";

  function clearSilenceTimer() {
    if (silenceTimer !== null) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  function fireAfterSilence(transcript: string) {
    clearSilenceTimer();
    silenceTimer = setTimeout(() => {
      if (transcript.trim()) opts.onFinal(transcript.trim());
    }, SILENCE_MS);
  }

  const capture: STTCapture = {
    isSupported: true,

    start() {
      accumulatedFinal = "";
      clearSilenceTimer();

      const instance: SpeechRecognition = new SpeechRecognitionImpl();
      rec = instance;
      instance.lang = opts.lang ?? "en-US";
      instance.continuous = true;
      instance.interimResults = true;
      instance.maxAlternatives = 1;

      instance.onresult = (event: SpeechRecognitionEvent) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            accumulatedFinal += text + " ";
          } else {
            interimText += text;
          }
        }
        const combined = (accumulatedFinal + interimText).trim();
        opts.onInterim(combined);
        fireAfterSilence(accumulatedFinal.trim() || combined);
      };

      // onspeechend may not exist on all browser builds — use optional assignment
      (instance as any).onspeechend = () => {
        // Speech API detected end of utterance — fire sooner than silence timer
        fireAfterSilence(accumulatedFinal.trim());
      };

      instance.onerror = (event: SpeechRecognitionErrorEvent) => {
        // "no-speech" is normal (silence); anything else propagates
        if (event.error !== "no-speech") {
          opts.onError(event);
        }
      };

      instance.onend = () => {
        opts.onEnd?.();
      };

      try {
        instance.start();
      } catch {
        // May throw if already running; ignore
      }
    },

    stop() {
      clearSilenceTimer();
      if (accumulatedFinal.trim()) {
        opts.onFinal(accumulatedFinal.trim());
      }
      rec?.stop();
      rec = null;
    },

    abort() {
      clearSilenceTimer();
      rec?.abort();
      rec = null;
    },
  };

  return capture;
}

export function isSpeechRecognitionSupported(): boolean {
  const w = typeof window !== "undefined" ? (window as any) : null;
  return !!(w?.SpeechRecognition || w?.webkitSpeechRecognition);
}

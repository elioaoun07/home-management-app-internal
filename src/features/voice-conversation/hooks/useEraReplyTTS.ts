"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prewarmAzureSpeech } from "../azureSTT";
import { prewarmTTSWorklet } from "../azureTTS";
import { createTTSQueue, type TTSQueue } from "../ttsQueue";

function cleanForBrowserSpeech(text: string): string {
  return text
    .replace(
      /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu,
      "",
    )
    .replace(/[*_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Low-latency speech for short ERA replies. Azure streams PCM sentence by
 * sentence; browser speech synthesis is the silent fallback when Azure is
 * unavailable. Briefing audio keeps its separate full-document hook.
 */
export function useEraReplyTTS() {
  const queueRef = useRef<TTSQueue | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    prewarmAzureSpeech();
    prewarmTTSWorklet();
  }, []);

  const stop = useCallback(() => {
    queueRef.current?.stop();
    queueRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsLoading(false);
    setIsPlaying(false);
  }, []);

  const speakWithBrowser = useCallback((rawText: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsLoading(false);
      setIsPlaying(false);
      return;
    }

    const speech = cleanForBrowserSpeech(rawText);
    if (!speech) {
      setIsLoading(false);
      setIsPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speech);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((voice) =>
        ["Ava", "Samantha", "Google US English", "Microsoft Jenny"].some(
          (name) => voice.name.includes(name),
        ),
      ) ??
      voices.find((voice) => voice.lang === "en-US") ??
      voices.find((voice) => voice.lang.startsWith("en")) ??
      null;
    utterance.rate = 1;
    utterance.onstart = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => {
      setIsLoading(false);
      setIsPlaying(false);
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  const play = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      stop();
      setIsLoading(true);

      const queue: TTSQueue = createTTSQueue({
        onStateChange: (state) => {
          setIsLoading(state === "fetching");
          setIsPlaying(state === "playing");
        },
        onError: () => {
          queue.stop();
          if (queueRef.current === queue) queueRef.current = null;
          speakWithBrowser(text);
        },
        onDone: () => {
          if (queueRef.current === queue) queueRef.current = null;
          setIsLoading(false);
          setIsPlaying(false);
        },
      });

      queueRef.current = queue;
      queue.push(text);
      queue.flush();
    },
    [speakWithBrowser, stop],
  );

  useEffect(() => stop, [stop]);

  return { play, stop, isPlaying, isLoading };
}

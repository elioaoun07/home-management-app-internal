"use client";

import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { briefingToSpeech } from "@/lib/tts/briefingToSpeech";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Hook for playing briefing text via Azure Neural TTS with graceful
 * fallback to browser speechSynthesis.
 */
export function useBriefingTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  /** Clean up current audio + ObjectURL */
  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  /** Browser speechSynthesis fallback — extracted from the old WebTodayView code */
  const fallbackSpeak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    // Lightweight text cleanup for speechSynthesis (no SSML)
    const emojiRegex =
      /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
    let speech = text.replace(emojiRegex, "");
    speech = speech.replace(/"([^"]+)"/g, "$1");

    // Conversational rewrites (same spirit as briefingToSpeech but plain text)
    speech = speech.replace(
      /(\d+) items? remains? for the rest of today\./gi,
      "You've got $1 more things on your plate today.",
    );
    speech = speech.replace(
      /You have (\d+) items? on your agenda today\./gi,
      "You've got $1 things lined up today.",
    );
    speech = speech.replace(
      /Currently:\s*"?([^".\n]+)"?\s*at\s*(\d+(?::\d+)?\s*(?:AM|PM))\./gi,
      "Right now you're on $1.",
    );
    speech = speech.replace(
      /Next up at\s*(\d+(?::\d+)?\s*(?:AM|PM)):\s*"?([^".\n]+)"?\./gi,
      "Next up at $1 is $2.",
    );
    speech = speech.replace(
      /In (\d+) minutes:\s*"?([^".\n]+)"?\./gi,
      "And in about $1 minutes you've got $2.",
    );
    speech = speech.replace(
      /💡\s*Heads up:\s*You have (\d+) items coming up in the next 2 hours\./gi,
      "Just a heads up, you have $1 things coming up in the next couple of hours.",
    );
    speech = speech.replace(
      /📦\s*Don't forget to prepare:/gi,
      "Oh, and don't forget to prepare,",
    );

    // Collapse "Key priorities for today:\n  1. X\n  2. Y" into a sentence
    speech = speech.replace(
      /Key priorities for today:\s*\n([\s\S]*?)(?=\n\n|$)/gi,
      (_, listBlock: string) => {
        const items = listBlock
          .split("\n")
          .map((l: string) => l.replace(/^\s*\d+\.\s*/, "").trim())
          .filter(Boolean);
        if (items.length === 0) return "";
        if (items.length === 1) return `Your top priority is ${items[0]}.`;
        if (items.length === 2)
          return `Your top priorities are ${items[0]} and ${items[1]}.`;
        return `Your top priorities are ${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}.`;
      },
    );

    // Collapse bullet lists into sentences
    speech = speech.replace(/[•●▸▹►]\s+/g, "");

    // Clean up formatting
    speech = speech.replace(/\s*[–—]\s*/g, ", ");
    speech = speech.replace(/(\d+):00\s*(AM|PM)/gi, "$1 $2");
    speech = speech.replace(/\n+/g, ", ");
    speech = speech.replace(/\.{3,}/g, ", ");
    speech = speech.replace(/…/g, ", ");
    speech = speech.replace(/,\s*,/g, ",");
    speech = speech.replace(/\s+/g, " ").trim();

    // Pick best available voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      "Samantha",
      "Allison",
      "Ava",
      "Google US English",
      "Microsoft Jenny",
      "Microsoft Aria",
      "Microsoft Zira",
    ];
    let voice: SpeechSynthesisVoice | null = null;
    for (const pv of preferred) {
      const found = voices.find((v) => v.name.includes(pv));
      if (found) {
        voice = found;
        break;
      }
    }
    if (!voice) {
      voice =
        voices.find((v) => v.lang === "en-US") ||
        voices.find((v) => v.lang.startsWith("en")) ||
        null;
    }

    const utterance = new SpeechSynthesisUtterance(speech);
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  /** Play briefing text — tries Azure Neural TTS, falls back to speechSynthesis */
  const play = useCallback(
    async (rawText: string) => {
      // If already playing, stop instead
      if (isPlaying || isLoading) {
        cleanup();
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        return;
      }

      setIsLoading(true);

      try {
        const ssml = briefingToSpeech(rawText);

        const res = await safeFetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ssml }),
          timeoutMs: 15_000,
        });

        if (!res.ok) {
          throw new Error(`TTS API returned ${res.status}`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          cleanup();
        };

        audio.onerror = () => {
          cleanup();
          // Fall back to browser TTS on audio playback error
          toast.warning("Using fallback voice quality", {
            icon: ToastIcons.error,
            duration: 3000,
          });
          fallbackSpeak(rawText);
        };

        setIsLoading(false);
        setIsPlaying(true);
        await audio.play();
      } catch {
        setIsLoading(false);
        cleanup();

        // Fall back to browser speechSynthesis
        toast.warning("Using fallback voice quality", {
          icon: ToastIcons.error,
          duration: 3000,
        });
        fallbackSpeak(rawText);
      }
    },
    [isPlaying, isLoading, cleanup, fallbackSpeak],
  );

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { play, pause, stop, isPlaying, isLoading };
}

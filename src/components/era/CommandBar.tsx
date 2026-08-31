"use client";

// src/components/era/CommandBar.tsx
// Floating command pill at the bottom of the ERA hub.
//
// Hard Rules honored:
//   #1  every toast has Undo (inside useEraBudgetSubmit)
//   #6  uses safeFetch (inside useEraBudgetSubmit + useCreateEraMessage)
//   #15 command pill uses tc.bgPage — opaque, not glass

import { useEraAskAI } from "@/features/era/useEraAskAI";
import { useEraStore } from "@/features/era/useEraStore";
import { useEraTurn } from "@/features/era/useEraTurn";
import type { FaceKey } from "@/features/era/types";
import { useBriefingTTS } from "@/hooks/useBriefingTTS";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ArrowRight, Mic, MicOff, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const PLACEHOLDERS: Record<FaceKey, string> = {
  budget: 'Talk to ERA — "How much did I spend this month?"',
  schedule: 'Talk to ERA — "What do I have to do today?"',
  chef: 'Talk to ERA — "I want to cook pasta tonight"',
  brain: 'Talk to ERA — "Remember the car maintenance number is 70-123456"',
};

export function CommandBar({
  variant = "floating",
}: {
  variant?: "floating" | "embedded";
} = {}) {
  const tc = useThemeClasses();
  const pendingTranscript = useEraStore((s) => s.pendingTranscript);
  const setPendingTranscript = useEraStore((s) => s.setPendingTranscript);
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const voiceReplyEnabled = useEraStore((s) => s.voiceReplyEnabled);
  const setVoiceReplyEnabled = useEraStore((s) => s.setVoiceReplyEnabled);
  const pendingTurn = useEraStore((s) => s.pendingTurn);
  const lastMissText = useEraStore((s) => s.lastMissText);
  const setLastMissText = useEraStore((s) => s.setLastMissText);

  const { runTurn } = useEraTurn();
  const { askAI, askingAI } = useEraAskAI();
  const tts = useBriefingTTS();
  const [busy, setBusy] = useState(false);

  // Mic / speech recognition state
  const [micActive, setMicActive] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const micSupportedRef = useRef<boolean>(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;
    micSupportedRef.current = Boolean(SpeechRecognition);
  }, []);

  const startMic = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec: SpeechRecognition = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setPendingTranscript(transcript);
    };
    rec.onend = () => {
      setMicActive(false);
      // Auto-submit on silence if something was transcribed
      // (submit reads latest pendingTranscript via store directly)
      setTimeout(() => {
        const text = useEraStore.getState().pendingTranscript.trim();
        if (text) submitText(text);
      }, 50);
    };
    rec.onerror = () => setMicActive(false);

    recognitionRef.current = rec;
    rec.start();
    setMicActive(true);
  }, [setPendingTranscript]);

  const stopMic = useCallback(() => {
    recognitionRef.current?.stop();
    setMicActive(false);
  }, []);

  const submitText = useCallback(
    async (text: string) => {
      if (!text || busy) return;
      setBusy(true);
      setPendingTranscript("");

      const { reply } = await runTurn(text).catch(() => ({
        reply: "Something went wrong. Try again.",
      }));

      if (voiceReplyEnabled) {
        tts.play(reply);
      }

      setBusy(false);
    },
    [busy, runTurn, setPendingTranscript, voiceReplyEnabled, tts],
  );

  const submit = useCallback(async () => {
    const text = pendingTranscript.trim();
    await submitText(text);
  }, [pendingTranscript, submitText]);

  // Manual escape hatch (locked decision: always visible, never auto-triggered).
  // With nothing typed, "Ask AI" re-sends whatever ERA was already asking about
  // — the owner's exact scenario: ERA asked "when should I remind you?", the
  // date parser couldn't handle "when I arrive home", so AI gets a shot at it
  // with the original sentence instead of the blank input box. A2 extends the
  // same fallback to a plain router miss (unknown/clarify): runTurn cleared
  // the input on submit, so without `lastMissText` this button would go dark
  // right when it's needed and the owner would have to retype the sentence.
  const askAIClick = useCallback(async () => {
    const text = pendingTranscript.trim() || pendingTurn?.rawText || lastMissText || "";
    if (!text || busy || askingAI) return;
    setPendingTranscript("");
    setLastMissText(null);
    await askAI(text).catch(() => {});
  }, [
    pendingTranscript,
    pendingTurn,
    lastMissText,
    busy,
    askingAI,
    setPendingTranscript,
    setLastMissText,
    askAI,
  ]);

  const canAskAI =
    Boolean(pendingTranscript.trim() || pendingTurn || lastMissText) && !busy && !askingAI;

  const placeholder = PLACEHOLDERS[activeFaceKey] ?? "Talk to ERA…";

  const form = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={[
          "era-command-pill flex w-full items-center gap-3 rounded-full px-5 py-3.5",
          variant === "floating" ? "max-w-[660px]" : "",
          tc.bgPage,
        ].join(" ")}
        style={{
          border: "1px solid var(--era-border-subtle, rgba(255,255,255,0.1))",
          transition: "border-color 0.5s ease",
        }}
      >
        {/* Mic button */}
        <button
          type="button"
          aria-label={micActive ? "Stop listening" : "Voice input"}
          onClick={micActive ? stopMic : startMic}
          disabled={!micSupportedRef.current && !micActive}
          className={[
            "flex-shrink-0 transition-opacity",
            !micSupportedRef.current ? "opacity-20 cursor-not-allowed" : "",
            micActive ? "opacity-100" : "opacity-50 hover:opacity-80",
          ].join(" ")}
          style={
            micActive
              ? undefined
              : { color: "var(--era-accent-faint, rgba(255,255,255,0.35))" }
          }
        >
          {micActive ? (
            <MicOff
              className="size-4 animate-pulse"
              style={{ color: "var(--era-accent)" }}
              aria-hidden
            />
          ) : (
            <Mic className="size-4" aria-hidden />
          )}
        </button>

        {/* Text input */}
        <input
          type="text"
          inputMode="text"
          value={pendingTranscript}
          onChange={(e) => setPendingTranscript(e.target.value)}
          placeholder={placeholder}
          aria-label="Ask ERA"
          disabled={busy}
          suppressHydrationWarning
          className="flex-1 bg-transparent text-sm text-white/80 outline-none placeholder:text-white/28 disabled:opacity-50"
          autoComplete="off"
        />

        {/* Speaker toggle */}
        <button
          suppressHydrationWarning
          type="button"
          aria-label={
            voiceReplyEnabled ? "Mute ERA replies" : "Enable voice replies"
          }
          onClick={() => setVoiceReplyEnabled(!voiceReplyEnabled)}
          className="flex-shrink-0 transition-opacity"
          style={{
            opacity: voiceReplyEnabled ? 1 : 0.38,
            color: voiceReplyEnabled
              ? "var(--era-accent, rgba(255,255,255,0.8))"
              : "var(--era-accent-faint, rgba(255,255,255,0.35))",
          }}
        >
          {voiceReplyEnabled ? (
            <Volume2 className="size-4" aria-hidden />
          ) : (
            <VolumeX className="size-4" aria-hidden />
          )}
        </button>

        {/* Ask AI — manual handoff, always visible (locked decision) */}
        <button
          type="button"
          aria-label="Ask AI"
          title="Ask AI"
          onClick={askAIClick}
          disabled={!canAskAI}
          className={[
            "flex-shrink-0 transition-opacity",
            canAskAI ? "opacity-60 hover:opacity-100" : "opacity-20 cursor-not-allowed",
            askingAI ? "animate-pulse" : "",
          ].join(" ")}
          style={{ color: "var(--era-accent, rgba(255,255,255,0.8))" }}
        >
          <Sparkles className="size-4" aria-hidden />
        </button>

        {/* Submit */}
        <button
          type="submit"
          aria-label="Send"
          disabled={!pendingTranscript.trim() || busy}
          className="flex-shrink-0 rounded-full p-1.5 transition-all disabled:opacity-20"
          style={{ color: "var(--era-accent, white)" }}
        >
          <ArrowRight className="size-4" />
        </button>
      </form>
  );

  if (variant === "embedded") return form;

  return (
    <div
      className={[
        "absolute inset-x-0 z-30 flex justify-center px-5",
        "bottom-[80px] md:bottom-5",
      ].join(" ")}
    >
      {form}
    </div>
  );
}

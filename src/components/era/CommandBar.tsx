"use client";

// src/components/era/CommandBar.tsx
// Floating command pill at the bottom of the ERA hub.
//
// Hard Rules honored:
//   #1  every toast has Undo (inside useEraBudgetSubmit)
//   #6  uses safeFetch (inside useEraBudgetSubmit + useCreateEraMessage)
//   #15 command pill uses tc.bgPage — opaque, not glass

import { getFace } from "@/features/era/faceRegistry";
import { rootIntentRouter } from "@/features/era/intentRouter";
import { resolveIntent } from "@/features/era/intents/resolveIntent";
import type { FaceKey, Intent } from "@/features/era/types";
import { useEraBudgetSubmit } from "@/features/era/useEraBudgetSubmit";
import {
  useActiveEraConversation,
  useCreateEraMessage,
} from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import { useBriefingTTS } from "@/hooks/useBriefingTTS";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ArrowRight, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const PLACEHOLDERS: Record<FaceKey, string> = {
  budget: 'Talk to ERA — "How much did I spend this month?"',
  schedule: 'Talk to ERA — "What do I have to do today?"',
  chef: 'Talk to ERA — "I want to cook pasta tonight"',
  brain: 'Talk to ERA — "Remember the car maintenance number is 70-123456"',
};

function intentPayload(intent: Intent): Record<string, unknown> {
  const { kind: _kind, ...rest } = intent as Intent & { rawText?: string };
  return rest as Record<string, unknown>;
}

export function CommandBar() {
  const tc = useThemeClasses();
  const pendingTranscript = useEraStore((s) => s.pendingTranscript);
  const setPendingTranscript = useEraStore((s) => s.setPendingTranscript);
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const setActiveFace = useEraStore((s) => s.setActiveFace);
  const setHubModuleKey = useEraStore((s) => s.setHubModuleKey);
  const setLastIntent = useEraStore((s) => s.setLastIntent);
  const voiceReplyEnabled = useEraStore((s) => s.voiceReplyEnabled);
  const setVoiceReplyEnabled = useEraStore((s) => s.setVoiceReplyEnabled);
  const setEraReply = useEraStore((s) => s.setEraReply);

  const budgetSubmit = useEraBudgetSubmit();
  const { data: activeConversation } = useActiveEraConversation();
  const createMessage = useCreateEraMessage();
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
      setEraReply("");
      const intent = rootIntentRouter.parse(text);
      setLastIntent(intent);
      if (intent.kind !== "unknown" && intent.kind !== "greeting") {
        setActiveFace(intent.face);
        setHubModuleKey(getFace(intent.face).eraModuleKey);
      }
      setBusy(true);

      let conversationId = activeConversation?.id ?? null;

      try {
        const userResult = await createMessage.mutateAsync({
          conversation_id: conversationId,
          role: "user",
          content: text,
          intent_kind: intent.kind,
          intent_face:
            intent.kind === "unknown" || intent.kind === "greeting"
              ? null
              : intent.face,
          intent_payload: intentPayload(intent),
        });
        conversationId = userResult.conversation_id;
      } catch (err) {
        console.error("[era] failed to persist user message", err);
      }

      // Budget draft (legacy path)
      let draftTransactionId: string | null = null;
      if (intent.kind === "draftTransaction") {
        const result = await budgetSubmit.submit(text);
        if (result.ok) {
          draftTransactionId = result.draftId;
        }
      }

      // Resolve assistant reply
      const { text: reply, metadata } = await resolveIntent(intent).catch(
        () => ({
          text: "Something went wrong. Try again.",
          metadata: undefined,
        }),
      );

      try {
        await createMessage.mutateAsync({
          conversation_id: conversationId,
          role: "assistant",
          content: reply,
          intent_kind: intent.kind,
          intent_face:
            intent.kind === "unknown" || intent.kind === "greeting"
              ? null
              : intent.face,
          intent_payload: metadata ?? intentPayload(intent),
          draft_transaction_id: draftTransactionId,
        });
      } catch (err) {
        console.error("[era] failed to persist assistant reply", err);
      }

      setEraReply(reply);

      // Speak if voice is enabled
      if (voiceReplyEnabled) {
        tts.play(reply);
      }

      setBusy(false);
    },
    [
      busy,
      activeConversation,
      createMessage,
      budgetSubmit,
      setLastIntent,
      setActiveFace,
      setHubModuleKey,
      setPendingTranscript,
      setEraReply,
      voiceReplyEnabled,
      tts,
    ],
  );

  const submit = useCallback(async () => {
    const text = pendingTranscript.trim();
    await submitText(text);
  }, [pendingTranscript, submitText]);

  const placeholder = PLACEHOLDERS[activeFaceKey] ?? "Talk to ERA…";

  return (
    <div
      className={[
        "absolute inset-x-0 z-30 flex justify-center px-5",
        "bottom-[80px] md:bottom-5",
      ].join(" ")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={[
          "era-command-pill flex w-full max-w-[660px] items-center gap-3 rounded-full px-5 py-3.5",
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
    </div>
  );
}

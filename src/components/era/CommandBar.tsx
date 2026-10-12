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
import { useEraReplyTTS } from "@/features/voice-conversation";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  ArrowUp,
  LoaderCircle,
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useEraCapture } from "@/features/era/useEraCapture";
import type { NativeCapture } from "@/features/era/capture";
import { captureMarks, type CaptureMark } from "@/features/era/captureAssist";
import { completeCaptureText } from "@/features/era/captureProgress";
import { EraCaptureHelper } from "./EraCaptureHelper";
import styles from "./EraComposer.module.css";
import { ERAMark } from "@/components/shared/ERAMark";
import { MODULE_COLORS } from "./eraHues";

/** The sentence with ERA's understood phrases marked; drawn behind the real text. */
function highlighted(text: string, marks: CaptureMark[]): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  for (const mark of marks) {
    if (mark.start > at) out.push(text.slice(at, mark.start));
    out.push(
      <mark key={mark.start} className={styles.mark}>
        {text.slice(mark.start, mark.end)}
      </mark>,
    );
    at = mark.end;
  }
  out.push(text.slice(at));
  return out;
}

export function CommandBar({
  variant = "floating",
  active = true,
}: {
  variant?: "floating" | "embedded";
  active?: boolean;
} = {}) {
  const tc = useThemeClasses();
  const pendingTranscript = useEraStore((s) => s.pendingTranscript);
  const setPendingTranscript = useEraStore((s) => s.setPendingTranscript);
  const voiceReplyEnabled = useEraStore((s) => s.voiceReplyEnabled);
  const setVoiceReplyEnabled = useEraStore((s) => s.setVoiceReplyEnabled);
  const pendingTurn = useEraStore((s) => s.pendingTurn);
  const lastMissText = useEraStore((s) => s.lastMissText);
  const setLastMissText = useEraStore((s) => s.setLastMissText);

  const { runTurn } = useEraTurn();
  const { askAI, askingAI } = useEraAskAI();
  const { play: speakReply } = useEraReplyTTS();
  const [busy, setBusy] = useState(false);
  // Focus primes ERA's typing memory, so completions are ready by the first word.
  const [primed, setPrimed] = useState(false);
  const helper = useEraCapture(pendingTranscript, { primed });
  const markModule =
    helper.kind === "expense"
      ? "financial"
      : helper.kind === "shopping"
        ? "recipe"
        : helper.kind
          ? "schedule"
          : "chat";
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const moveCaret = useRef(false);
  const [atEnd, setAtEnd] = useState(true);
  const [nudge, setNudge] = useState({ step: "", n: 0 });
  useLayoutEffect(() => {
    if (variant !== "floating") return;
    const form = formRef.current;
    const shell = form?.closest<HTMLElement>(".era-shell");
    if (!form || !shell) return;
    const measure = () =>
      shell.style.setProperty(
        "--era-composer-height",
        `${form.offsetHeight}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(form);
    return () => {
      observer.disconnect();
      shell.style.removeProperty("--era-composer-height");
    };
  }, [variant]);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
    if (moveCaret.current) {
      input.setSelectionRange(input.value.length, input.value.length);
      moveCaret.current = false;
    }
    if (mirrorRef.current) mirrorRef.current.scrollTop = input.scrollTop;
  }, [pendingTranscript]);
  const refocus = () => {
    inputRef.current?.focus();
  };
  const setText = (next: string) => {
    moveCaret.current = true;
    setAtEnd(true);
    setPendingTranscript(next);
    refocus();
  };
  const editLocation = (location: string) => {
    const index = location
      ? pendingTranscript.toLowerCase().indexOf(location.toLowerCase())
      : -1;
    if (index >= 0) {
      inputRef.current?.setSelectionRange(index, index + location.length);
      setAtEnd(false);
    } else setText(completeCaptureText(pendingTranscript, "at"));
  };
  const ghost = helper.ghost && atEnd && !busy && active ? helper.ghost : null;
  const acceptGhost = () => {
    if (ghost) setText(ghost.text);
  };
  const marks =
    helper.kind && helper.assist
      ? captureMarks(helper.kind, pendingTranscript, helper.assist.now, {
          accounts: helper.accounts,
          location: helper.fields.location,
        })
      : [];

  // Voice chat stays off until the mic is tapped.
  const micActive = useEraStore((s) => s.voiceChatEnabled);
  const setVoiceChatEnabled = useEraStore((s) => s.setVoiceChatEnabled);
  const toggleMic = useCallback(
    () => setVoiceChatEnabled(!useEraStore.getState().voiceChatEnabled),
    [setVoiceChatEnabled],
  );

  const submitText = useCallback(
    async (text: string, capture?: NativeCapture) => {
      if (!text || busy) return;
      setBusy(true);
      setPendingTranscript("");

      const { reply, keepInput } = await runTurn(
        text,
        capture ? { capture } : {},
      ).catch(() => ({
        reply: "Something went wrong. Try again.",
        keepInput: true,
      }));
      // HUB-37 — a capture that never left the device keeps its text.
      if (keepInput) setPendingTranscript(text);
      else helper.reset();

      if (voiceReplyEnabled) {
        speakReply(reply);
      }

      setBusy(false);
    },
    [
      busy,
      runTurn,
      setPendingTranscript,
      voiceReplyEnabled,
      speakReply,
      helper,
    ],
  );

  const submit = useCallback(async () => {
    const text =
      pendingTranscript.trim() || (helper.capture ? `Add ${helper.kind}` : "");
    if (helper.kind && !helper.capture) return;
    await submitText(text, helper.capture ?? undefined);
  }, [pendingTranscript, submitText, helper]);

  // Manual escape hatch (locked decision: always visible, never auto-triggered).
  // With nothing typed, "Ask AI" re-sends whatever ERA was already asking about
  // — the owner's exact scenario: ERA asked "when should I remind you?", the
  // date parser couldn't handle "when I arrive home", so AI gets a shot at it
  // with the original sentence instead of the blank input box. A2 extends the
  // same fallback to a plain router miss (unknown/clarify): runTurn cleared
  // the input on submit, so without `lastMissText` this button would go dark
  // right when it's needed and the owner would have to retype the sentence.
  const askAIClick = useCallback(async () => {
    const text =
      pendingTranscript.trim() || pendingTurn?.rawText || lastMissText || "";
    if (!text || busy || askingAI) return;
    setPendingTranscript("");
    setLastMissText(null);
    const reply = await askAI(text).catch(() => null);
    if (reply && voiceReplyEnabled) speakReply(reply);
  }, [
    pendingTranscript,
    pendingTurn,
    lastMissText,
    busy,
    askingAI,
    setPendingTranscript,
    setLastMissText,
    askAI,
    voiceReplyEnabled,
    speakReply,
  ]);

  const canAskAI =
    Boolean(pendingTranscript.trim() || pendingTurn || lastMissText) &&
    !busy &&
    !askingAI;

  const showHelper = active && !!helper.kind && !busy;
  const composer = (
    <form
      id={formId}
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className={`${styles.composer} ${tc.bgPage} ${variant === "floating" ? "max-w-[660px]" : ""}`}
      style={
        {
          "--capture-hue": helper.kind
            ? MODULE_COLORS[markModule].hue
            : "var(--era-hue, 190)",
        } as CSSProperties
      }
    >
      {showHelper && (
        <EraCaptureHelper
          key={helper.kind}
          helper={helper}
          text={pendingTranscript}
          busy={busy}
          nudge={nudge.step === helper.step ? nudge.n : 0}
          setText={setText}
          editLocation={editLocation}
          refocus={refocus}
        />
      )}
      <div className={styles.inputWrap}>
        {(marks.length > 0 || ghost) && !busy && (
          <div ref={mirrorRef} aria-hidden className={styles.mirror}>
            {highlighted(pendingTranscript, marks)}
            {ghost && <span className={styles.ghost}>{ghost.suffix}</span>}
          </div>
        )}
        <textarea
          ref={inputRef}
          rows={2}
          inputMode="text"
          value={pendingTranscript}
          onChange={(event) => {
            if (!pendingTranscript.trim() && event.target.value.trim())
              helper.begin();
            if (!event.target.value.trim()) helper.reset();
            setPendingTranscript(event.target.value);
          }}
          onFocus={() => setPrimed(true)}
          onSelect={(event) =>
            setAtEnd(
              event.currentTarget.selectionStart ===
                event.currentTarget.value.length &&
                event.currentTarget.selectionEnd ===
                  event.currentTarget.value.length,
            )
          }
          onScroll={(event) => {
            if (mirrorRef.current)
              mirrorRef.current.scrollTop = event.currentTarget.scrollTop;
          }}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            swipe.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
          }}
          onTouchEnd={(event) => {
            // Swipe right across the sentence accepts the faint completion.
            const start = swipe.current;
            swipe.current = null;
            const touch = event.changedTouches[0];
            if (
              start &&
              ghost &&
              touch.clientX - start.x > 56 &&
              Math.abs(touch.clientY - start.y) < 28 &&
              Date.now() - start.t < 600
            )
              acceptGhost();
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            const input = event.currentTarget;
            const caretAtEnd =
              input.selectionStart === input.value.length &&
              input.selectionEnd === input.value.length;
            if (
              ghost &&
              caretAtEnd &&
              ((event.key === "Tab" && !event.shiftKey) ||
                event.key === "ArrowRight")
            ) {
              event.preventDefault();
              acceptGhost();
              return;
            }
            if (event.key === "Escape") helper.dismiss();
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              (helper.kind !== "shopping" || event.ctrlKey || event.metaKey)
            ) {
              event.preventDefault();
              // A missing detail: point at the question instead of sending.
              if (helper.kind && !helper.capture)
                setNudge((old) => ({ step: helper.step, n: old.n + 1 }));
              else formRef.current?.requestSubmit();
            }
          }}
          placeholder="Message ERA"
          aria-label="Message ERA"
          aria-describedby={ghost ? `${formId}-completion` : undefined}
          disabled={busy || !active}
          suppressHydrationWarning
          className={styles.input}
          autoComplete="off"
        />
        {ghost && (
          <span id={`${formId}-completion`} className="sr-only">
            Press Tab to complete {ghost.suffix.trim()}
          </span>
        )}
      </div>
      <div className={styles.toolbar}>
        <span className={styles.assistantBrand} aria-hidden="true">
          <ERAMark
            module={markModule}
            size={24}
            className={styles.assistantMark}
          />
          <span className={styles.brandName}>ERA</span>
        </span>
        <button
          type="button"
          suppressHydrationWarning
          aria-label={micActive ? "Stop listening" : "Voice input"}
          aria-pressed={micActive}
          onClick={toggleMic}
          disabled={busy || !active}
          className={styles.iconButton}
          style={
            micActive ? { opacity: 1, color: "var(--era-accent)" } : undefined
          }
        >
          {micActive ? (
            <MicOff className="size-[18px]" aria-hidden />
          ) : (
            <Mic className="size-[18px]" aria-hidden />
          )}
        </button>
        <button
          type="button"
          suppressHydrationWarning
          aria-label={
            voiceReplyEnabled ? "Mute ERA replies" : "Enable voice replies"
          }
          aria-pressed={voiceReplyEnabled}
          onClick={() => setVoiceReplyEnabled(!voiceReplyEnabled)}
          disabled={!active}
          className={styles.iconButton}
        >
          {voiceReplyEnabled ? (
            <Volume2 className="size-[18px]" aria-hidden />
          ) : (
            <VolumeX className="size-[18px]" aria-hidden />
          )}
        </button>
        <span className={styles.spacer} />
        <button
          type="button"
          aria-label="Ask AI"
          title="Ask AI"
          onClick={askAIClick}
          disabled={!canAskAI || !active}
          className={`${styles.iconButton} ${styles.aiButton} ${askingAI ? "animate-pulse" : ""}`}
        >
          <Sparkles className="size-[18px]" aria-hidden />
        </button>
        <button
          type="submit"
          aria-label="Send"
          data-ready={helper.capture && !busy ? "true" : undefined}
          disabled={
            !pendingTranscript.trim() ||
            busy ||
            !active ||
            (!!helper.kind && !helper.capture)
          }
          className={`${styles.iconButton} ${styles.send}`}
        >
          {busy ? (
            <LoaderCircle className="size-[18px] animate-spin" aria-hidden />
          ) : (
            <ArrowUp className="size-[18px]" aria-hidden />
          )}
        </button>
      </div>
    </form>
  );

  if (variant === "embedded") return composer;
  return (
    <div
      className={`absolute inset-x-0 z-30 flex justify-center px-4 ${styles.floating}`}
    >
      {composer}
    </div>
  );
}

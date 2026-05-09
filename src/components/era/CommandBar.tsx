"use client";

// src/components/era/CommandBar.tsx
// Floating command pill at the bottom of the ERA hub.
// All chat/intent/budget logic is preserved from Phase 0.5.
//
// Hard Rules honored:
//   #1  every toast has Undo (inside useEraBudgetSubmit)
//   #6  uses safeFetch (inside useEraBudgetSubmit + useCreateEraMessage)
//   #15 command pill uses tc.bgPage — opaque, not glass

import { stubIntentRouter } from "@/features/era/intentRouter";
import { formatReply } from "@/features/era/replyFormatter";
import type { FaceKey, Intent } from "@/features/era/types";
import { useEraBudgetSubmit } from "@/features/era/useEraBudgetSubmit";
import {
  useActiveEraConversation,
  useCreateEraMessage,
} from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ArrowRight, Mic } from "lucide-react";
import { useCallback, useState } from "react";

const PLACEHOLDERS: Record<FaceKey, string> = {
  budget:   'Talk to ERA — "I spent $25 on fuel"',
  schedule: 'Talk to ERA — "Remind me about the dentist"',
  chef:     'Talk to ERA — "What can I cook tonight?"',
  brain:    'Talk to ERA — "I got a new laptop"',
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
  const setLastIntent = useEraStore((s) => s.setLastIntent);

  const budgetSubmit = useEraBudgetSubmit();
  const { data: activeConversation } = useActiveEraConversation();
  const createMessage = useCreateEraMessage();
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    const text = pendingTranscript.trim();
    if (!text || busy) return;
    const intent = stubIntentRouter.parse(text);
    setLastIntent(intent);
    if (intent.kind !== "unknown") {
      setActiveFace(intent.face);
    }
    setPendingTranscript("");
    setBusy(true);

    let conversationId = activeConversation?.id ?? null;

    try {
      const userResult = await createMessage.mutateAsync({
        conversation_id: conversationId,
        role: "user",
        content: text,
        intent_kind: intent.kind,
        intent_face: intent.kind === "unknown" ? null : intent.face,
        intent_payload: intentPayload(intent),
      });
      conversationId = userResult.conversation_id;
    } catch (err) {
      console.error("[era] failed to persist user message", err);
    }

    let reply = formatReply(intent);
    let draftTransactionId: string | null = null;

    if (intent.kind === "draftTransaction") {
      const result = await budgetSubmit.submit(text);
      if (result.ok) {
        draftTransactionId = result.draftId;
        reply = `Saved a draft of $${result.parsed.amount?.toFixed(2)}${
          result.parsed.categoryName ? ` in ${result.parsed.categoryName}` : ""
        }. Review it in Drafts to confirm.`;
      } else {
        reply = result.message;
      }
    }

    try {
      await createMessage.mutateAsync({
        conversation_id: conversationId,
        role: "assistant",
        content: reply,
        intent_kind: intent.kind,
        intent_face: intent.kind === "unknown" ? null : intent.face,
        intent_payload: intentPayload(intent),
        draft_transaction_id: draftTransactionId,
      });
    } catch (err) {
      console.error("[era] failed to persist assistant reply", err);
    }

    setBusy(false);
  }, [
    pendingTranscript,
    busy,
    activeConversation,
    createMessage,
    budgetSubmit,
    setLastIntent,
    setActiveFace,
    setPendingTranscript,
  ]);

  const placeholder = PLACEHOLDERS[activeFaceKey] ?? 'Talk to ERA…';

  return (
    // Positioned above MobileNav on mobile (72px) + gap; above nothing on desktop
    <div
      className={[
        "absolute inset-x-0 z-30 flex justify-center px-5",
        // mobile: sits above mobile nav
        "bottom-[80px] md:bottom-5",
      ].join(" ")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={[
          // Hard Rule #15: opaque, not glass
          // Border color driven by ERA hue via .era-command-pill CSS (follows modal)
          "era-command-pill flex w-full max-w-[660px] items-center gap-3 rounded-full border px-5 py-3.5",
          tc.bgPage,
        ].join(" ")}
      >
        {/* Mic — left anchor (disabled for now) */}
        <button
          type="button"
          aria-label="Voice input (coming soon)"
          disabled
          className="flex-shrink-0 opacity-25"
        >
          <Mic className={["size-4", tc.textFaint].join(" ")} />
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
          className={[
            "flex-1 bg-transparent text-sm outline-none placeholder:opacity-35 disabled:opacity-50",
            tc.text,
          ].join(" ")}
          autoComplete="off"
        />

        {/* Submit */}
        <button
          type="submit"
          aria-label="Send"
          disabled={!pendingTranscript.trim() || busy}
          className={[
            "flex-shrink-0 rounded-full p-1.5 transition-opacity disabled:opacity-25",
            tc.text,
            tc.bgHover,
          ].join(" ")}
        >
          <ArrowRight className="size-4" />
        </button>
      </form>
    </div>
  );
}

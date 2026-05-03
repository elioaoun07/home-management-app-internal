"use client";

// src/components/era/CommandBar.tsx
// Phase 0.5 command bar.
//
// What's wired:
//   - Budget face + draftTransaction intent → runs the existing NLP parser
//     (parseSpeechExpense) and saves to /api/drafts via useEraBudgetSubmit.
//     Same pipeline as the mic on the mobile expense form.
//   - Everything else → "coming soon" reply (formatReply). Face still
//     switches for visual feedback.
//   - Every user message + assistant reply is persisted to era_messages so
//     the transcript survives reload and syncs across devices.
//
// Hard Rules honored:
//   #1  every toast has Undo (handled inside useEraBudgetSubmit)
//   #6  uses safeFetch (inside useEraBudgetSubmit + useCreateEraMessage)
//   #15 command bar uses tc.bgPage, not neo-card

import { stubIntentRouter } from "@/features/era/intentRouter";
import { formatReply } from "@/features/era/replyFormatter";
import type { Intent } from "@/features/era/types";
import { useEraBudgetSubmit } from "@/features/era/useEraBudgetSubmit";
import {
  useActiveEraConversation,
  useCreateEraMessage,
} from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { Mic, Send } from "lucide-react";
import { useCallback, useState } from "react";
import { QuickFaceChips } from "./QuickFaceChips";

/** Build a JSONB-safe intent_payload from the discriminated Intent union. */
function intentPayload(intent: Intent): Record<string, unknown> {
  // Strip rawText (already in `content`) and the `kind`/`face` discriminants
  // (already in their own columns). Keep everything else.
  const { kind: _kind, ...rest } = intent as Intent & { rawText?: string };
  return rest as Record<string, unknown>;
}

export function CommandBar() {
  const tc = useThemeClasses();
  const pendingTranscript = useEraStore((s) => s.pendingTranscript);
  const setPendingTranscript = useEraStore((s) => s.setPendingTranscript);
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

    // Persist user message. The first call may auto-create a conversation;
    // we capture its id for the assistant reply that follows.
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
      // Persistence failed (offline + queue full, or RLS error). Continue
      // anyway so the user still gets a reply. They can retry by retyping.
      console.error("[era] failed to persist user message", err);
    }

    let reply = formatReply(intent);
    let draftTransactionId: string | null = null;

    // Budget face — actually save a draft.
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

    // Persist assistant reply.
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
      // Same fallback as above — UI gets the reply via React Query
      // invalidation if the user message succeeded.
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

  return (
    <div
      className={[
        // Opaque page bg per Hard Rule #15 — never neo-card on overlays.
        tc.bgPage,
        "flex w-full flex-col gap-2 border-t px-3 py-2 md:px-4 md:py-3",
        tc.border,
      ].join(" ")}
    >
      {/* Mobile-only chip row; desktop has the rail in EraShell. */}
      <div className="md:hidden">
        <QuickFaceChips orientation="row" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={[
          "flex items-center gap-2 rounded-2xl border px-3 py-2",
          tc.border,
          tc.focusWithinBorder,
          "bg-black/20",
        ].join(" ")}
      >
        <input
          type="text"
          inputMode="text"
          // Hard Rule #19 (mobile number inputs) — n/a here, this is text.
          value={pendingTranscript}
          onChange={(e) => setPendingTranscript(e.target.value)}
          placeholder='Try "I paid $25 for car fuel"'
          aria-label="Ask ERA"
          disabled={busy}
          suppressHydrationWarning
          className={[
            "flex-1 bg-transparent outline-none placeholder:opacity-60 disabled:opacity-50",
            tc.text,
          ].join(" ")}
          autoComplete="off"
        />

        <button
          type="button"
          aria-label="Voice input (coming soon)"
          title="Voice input — coming soon"
          disabled
          className={["rounded-full p-2 opacity-50", tc.textMuted].join(" ")}
        >
          <Mic className="size-4" />
        </button>

        <button
          type="submit"
          aria-label="Send"
          disabled={!pendingTranscript.trim() || busy}
          className={[
            "rounded-full p-2 transition-opacity disabled:opacity-30",
            tc.text,
            tc.bgHover,
          ].join(" ")}
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}

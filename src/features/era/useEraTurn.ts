"use client";

// src/features/era/useEraTurn.ts
// The one entry point for turning user input — typed or spoken — into an
// ERA reply. CommandBar (typed) and EraShell's voice wiring (spoken) both
// call this hook and nothing else; neither classifies nor resolves
// independently. That is what keeps the two surfaces from disagreeing on
// what a reminder's due date was or whether a draft actually saved (HUB-16) —
// there is exactly one code path from "a sentence" to "a reply", not a
// second implementation shadowing it.
//
// Slice 3 adds one piece of state to that path: `pendingTurn`. When ERA has
// asked a question (currently only "what time?" for a reminder with no
// date), the NEXT turn is intercepted here and handed to the pending
// resolver instead of the normal classify step — the whole next utterance is
// treated as the answer, not reclassified as a fresh command. See
// `resolvePendingReminderAnswer` in `intents/resolvers/schedule.ts`.

import { useCallback } from "react";
import { getFace } from "./faceRegistry";
import { rootIntentRouter } from "./intentRouter";
import { resolveIntent } from "./intents/resolveIntent";
import { resolvePendingReminderAnswer } from "./intents/resolvers/schedule";
import type { Intent } from "./types";
import { useEraBudgetSubmit } from "./useEraBudgetSubmit";
import {
  useActiveEraConversation,
  useCreateEraMessage,
} from "./useEraConversation";
import { useEraStore } from "./useEraStore";

function intentPayload(intent: Intent): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...intent };
  delete rest.kind;
  return rest;
}

export interface EraTurnResult {
  intent: Intent;
  reply: string;
  metadata?: Record<string, unknown>;
}

export function useEraTurn() {
  const setActiveFace = useEraStore((s) => s.setActiveFace);
  const setHubModuleKey = useEraStore((s) => s.setHubModuleKey);
  const setLastIntent = useEraStore((s) => s.setLastIntent);
  const setEraReply = useEraStore((s) => s.setEraReply);
  const pendingTurn = useEraStore((s) => s.pendingTurn);
  const setPendingTurn = useEraStore((s) => s.setPendingTurn);

  const budgetSubmit = useEraBudgetSubmit();
  const { data: activeConversation } = useActiveEraConversation();
  const createMessage = useCreateEraMessage();

  const runTurn = useCallback(
    async (text: string): Promise<EraTurnResult> => {
      // A question is outstanding — this turn answers it, full stop. It is
      // never reclassified through the normal router (see module doc above).
      const pending = pendingTurn;
      const intent: Intent = pending
        ? { kind: "draftReminder", face: "schedule", title: pending.title, rawText: text }
        : rootIntentRouter.parse(text);

      if (!pending) setLastIntent(intent);

      const isFaceless =
        intent.kind === "unknown" ||
        intent.kind === "greeting" ||
        intent.kind === "clarify";

      if (!pending && !isFaceless) {
        setActiveFace(intent.face);
        setHubModuleKey(getFace(intent.face).eraModuleKey);
      }

      let conversationId = activeConversation?.id ?? null;

      try {
        const userResult = await createMessage.mutateAsync({
          conversation_id: conversationId,
          role: "user",
          content: text,
          intent_kind: intent.kind,
          intent_face: isFaceless ? null : intent.face,
          intent_payload: intentPayload(intent),
        });
        conversationId = userResult.conversation_id;
      } catch (err) {
        console.error("[era] failed to persist user message", err);
      }

      const {
        text: reply,
        metadata,
        pending: nextPending,
      } = await (pending
        ? resolvePendingReminderAnswer(pending, text)
        : resolveIntent(intent, { submitBudgetDraft: budgetSubmit.submit })
      ).catch(() => ({
        text: "Something went wrong. Try again.",
        metadata: undefined as Record<string, unknown> | undefined,
        pending: null,
      }));

      setPendingTurn(nextPending ?? null);

      const draftTransactionId =
        typeof metadata?.draftId === "string" ? metadata.draftId : null;

      try {
        await createMessage.mutateAsync({
          conversation_id: conversationId,
          role: "assistant",
          content: reply,
          intent_kind: intent.kind,
          intent_face: isFaceless ? null : intent.face,
          intent_payload: metadata ?? intentPayload(intent),
          draft_transaction_id: draftTransactionId,
        });
      } catch (err) {
        console.error("[era] failed to persist assistant reply", err);
      }

      setEraReply(reply);

      return { intent, reply, metadata };
    },
    [
      pendingTurn,
      setPendingTurn,
      activeConversation,
      createMessage,
      budgetSubmit,
      setLastIntent,
      setActiveFace,
      setHubModuleKey,
      setEraReply,
    ],
  );

  return { runTurn, budgetSubmitReady: budgetSubmit.ready };
}

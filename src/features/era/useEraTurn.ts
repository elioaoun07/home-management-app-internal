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

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getFace } from "./faceRegistry";
import { rootIntentRouter } from "./intentRouter";
import { resolveIntent } from "./intents/resolveIntent";
import { resolvePendingReminderAnswer } from "./intents/resolvers/schedule";
import { logEraAction, logEraCapabilityAction } from "./logEraAction";
import { classifyMiss, type MissClassification } from "./missTracking";
import { useEraTemplates } from "./templates/useEraTemplates";
import { deriveLearnedVocab } from "./templates/vocabGrowth";
import type { EraPendingTurn, Intent } from "./types";
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

/**
 * Stage 1 focus memory — push whichever reminder this turn created or
 * touched, so a follow-up like "change it to 11" has something to resolve
 * against. Reads `metadata.itemId`/`metadata.title` set by the resolver;
 * `reminderDelete` deliberately never sets `itemId` (see its resolver's
 * doc comment) so a deleted reminder falls OUT of focus instead of back in.
 */
function pushFocusFromResult(
  intent: Intent,
  pending: EraPendingTurn | null,
  metadata: Record<string, unknown> | undefined,
): void {
  const relevant =
    pending !== null || // completed a "what time?" question → draftReminder
    intent.kind === "draftReminder" ||
    intent.kind === "reminderReschedule" ||
    intent.kind === "reminderComplete" ||
    (intent.kind === "capabilityAction" &&
      intent.capabilityId !== "reminder.delete" &&
      intent.capabilityId !== "schedule.forDay");
  if (!relevant) return;

  const itemId = typeof metadata?.itemId === "string" ? metadata.itemId : null;
  const title = typeof metadata?.title === "string" ? metadata.title : null;
  if (!itemId || !title) return;

  useEraStore
    .getState()
    .pushFocusEntity({ id: itemId, type: "reminder", title, addedAt: Date.now() });
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
  const queryClient = useQueryClient();
  // Stage 4 (HUB-30) — keeps useEraStore().templates current for the
  // router's Layer 2 matcher; see that hook's doc comment.
  useEraTemplates();

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
      if (intent.kind === "capabilityAction") {
        logEraCapabilityAction(intent.capabilityId, metadata, queryClient);
      } else {
        logEraAction(intent.kind, metadata, queryClient);
      }
      pushFocusFromResult(intent, pending, metadata);

      const draftTransactionId =
        typeof metadata?.draftId === "string" ? metadata.draftId : null;

      // Stage 2 (HUB-28) — a "clarify"/"unknown" turn is a router miss.
      // Classify it (language gap vs capability gap) and fold the result
      // into this same era_messages row's intent_payload — no new table,
      // reusing intent_kind as the miss signal itself (see missTracking.ts).
      const missClassification: MissClassification | null =
        !pending && (intent.kind === "clarify" || intent.kind === "unknown")
          ? classifyMiss(text, deriveLearnedVocab(useEraStore.getState().templates))
          : null;

      try {
        await createMessage.mutateAsync({
          conversation_id: conversationId,
          role: "assistant",
          content: reply,
          intent_kind: intent.kind,
          intent_face: isFaceless ? null : intent.face,
          intent_payload: missClassification
            ? { ...(metadata ?? intentPayload(intent)), ...missClassification }
            : (metadata ?? intentPayload(intent)),
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
      queryClient,
    ],
  );

  return { runTurn, budgetSubmitReady: budgetSubmit.ready };
}

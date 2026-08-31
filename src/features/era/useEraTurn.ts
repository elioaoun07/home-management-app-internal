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
//
// Stage C reopens useEraAskAI's "manual escape hatch only" decision under a
// specific guard: a router miss (`unknown`/`clarify`) that `classifyMiss`
// (missTracking.ts) reads as a LANGUAGE gap — a registered capability
// plausibly covers this, the phrasing just didn't parse — auto-escalates to
// Ask AI instead of returning the canned "I didn't catch that" line. A
// CAPABILITY gap (nothing in the registry covers this at all) never
// escalates automatically; it stays a deterministic reply and keeps feeding
// the build-queue signal missClassification already existed for. This is a
// heuristic, not a guarantee (missTracking.ts's own doc comment says so) —
// worst case a language-gap guess escalates something Ask AI can't help
// with either, which just costs one AI call, capped per day server-side
// (see /api/era/ask/route.ts's DAILY_AUTO_ESCALATION_CAP).

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
import { useEraAskAI } from "./useEraAskAI";
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
  /**
   * Stage C — true when a language-gap miss was already auto-escalated to
   * the AI, so `reply` is the AI's real answer, not the canned "I didn't
   * catch that" line. `intent.kind` stays "unknown"/"clarify" either way
   * (the ROUTER still missed — this only says what happened next), so a
   * caller that gates behavior on `kind === "unknown"` (voice's dig-deeper
   * offer — see conversationEngine.ts) needs this to avoid re-offering an
   * escalation that already happened.
   */
  aiHandled?: boolean;
}

export function useEraTurn() {
  const setActiveFace = useEraStore((s) => s.setActiveFace);
  const setHubModuleKey = useEraStore((s) => s.setHubModuleKey);
  const setLastIntent = useEraStore((s) => s.setLastIntent);
  const setEraReply = useEraStore((s) => s.setEraReply);
  const pendingTurn = useEraStore((s) => s.pendingTurn);
  const setPendingTurn = useEraStore((s) => s.setPendingTurn);
  const setLastMissText = useEraStore((s) => s.setLastMissText);

  const budgetSubmit = useEraBudgetSubmit();
  const { data: activeConversation } = useActiveEraConversation();
  const createMessage = useCreateEraMessage();
  const queryClient = useQueryClient();
  // Stage C — the auto-escalation path below reuses this hook's askAI
  // verbatim (same request, same proposal rendering, same template
  // learning) rather than a second implementation of any of it.
  const { askAI } = useEraAskAI();
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

      // A2 — a miss (unknown/clarify) keeps its raw text around so "Ask AI"
      // stays usable after the input box clears; a resolved turn (whether it
      // hit a router or answered a pending question) forgets it.
      const isMiss = !pending && (intent.kind === "clarify" || intent.kind === "unknown");
      setLastMissText(isMiss ? text : null);

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

      // Stage 2 (HUB-28) — a "clarify"/"unknown" turn is a router miss.
      // Classify it (language gap vs capability gap) BEFORE deciding what to
      // do next — Stage C's auto-escalation reads this same classification.
      const missClassification: MissClassification | null = isMiss
        ? classifyMiss(text, deriveLearnedVocab(useEraStore.getState().templates))
        : null;

      // Stage C — a language-gap miss escalates to the AI automatically; a
      // capability-gap miss (nothing in the registry covers this) never
      // does. The user message above is already persisted, so `askAI` must
      // not persist it a second time — it persists its own assistant reply
      // and manages the proposal/template-learning flow exactly as a manual
      // tap would.
      if (isMiss && missClassification?.missKind === "language-gap") {
        // Handled (or at least attempted) automatically — the manual "Ask
        // AI" fallback no longer needs to hold this text around.
        setLastMissText(null);
        const reply = await askAI(text, { skipUserMessage: true, auto: true }).catch(
          () => "Something went wrong. Try again.",
        );
        return { intent, reply, metadata: undefined, aiHandled: true };
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
      askAI,
      setLastIntent,
      setLastMissText,
      setActiveFace,
      setHubModuleKey,
      setEraReply,
      queryClient,
    ],
  );

  return { runTurn, budgetSubmitReady: budgetSubmit.ready };
}

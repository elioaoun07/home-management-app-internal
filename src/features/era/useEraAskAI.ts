"use client";

// src/features/era/useEraAskAI.ts
// ERA "Ask AI" (Slice 4) — the escape hatch to the AI. Originally a manual-
// only button (locked decision: no auto-escalation, no surprise quota burn);
// Stage C reopens that decision under a specific guard — see useEraTurn.ts's
// module doc. Both entry points funnel through THIS hook and this route, so
// there is exactly one place that builds the request, renders a proposal,
// and learns a template — never a second implementation for the auto path.
//
// Sends the current face + recent thread history to POST /api/era/ask. The
// model either answers in prose (persisted to the thread like any other
// reply) or proposes a specific action, rendered as a confirm card via
// `activeProposal`. Nothing is written until `confirmProposal()` runs —
// Doctrine Q10: the model proposes, the human confirms, the deterministic
// path executes.

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { AskAIResult } from "@/lib/ai/eraAskProposal";
import { safeFetch } from "@/lib/safeFetch";
import { getCapability } from "./capabilities/registry";
import { logEraCapabilityAction, logEraNfcReminder } from "./logEraAction";
import { eraKeys } from "./queryKeys";
import { learnTemplateFromProposal, shouldLearnFrom } from "./templates/learn";
import type { EraActiveProposal } from "./types";
import {
  useActiveEraConversation,
  useCreateEraMessage,
  useEraMessages,
} from "./useEraConversation";
import { useEraStore } from "./useEraStore";

export function useEraAskAI() {
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const pendingTurn = useEraStore((s) => s.pendingTurn);
  const setPendingTurn = useEraStore((s) => s.setPendingTurn);
  const activeProposal = useEraStore((s) => s.activeProposal);
  const setActiveProposal = useEraStore((s) => s.setActiveProposal);
  const focusEntities = useEraStore((s) => s.focusEntities);
  const askingAI = useEraStore((s) => s.askingAI);
  const setAskingAI = useEraStore((s) => s.setAskingAI);
  const setEraReply = useEraStore((s) => s.setEraReply);

  const { data: activeConversation } = useActiveEraConversation();
  const { data: messagesData } = useEraMessages(activeConversation?.id ?? null);
  const createMessage = useCreateEraMessage();
  const queryClient = useQueryClient();

  const askAI = useCallback(
    async (
      question: string,
      opts: {
        skipUserMessage?: boolean;
        auto?: boolean;
        conversationId?: string | null;
      } = {},
    ): Promise<string> => {
      const { skipUserMessage = false, auto = false } = opts;
      let conversationId =
        opts.conversationId === undefined
          ? (activeConversation?.id ?? null)
          : opts.conversationId;
      setAskingAI(true);

      try {
        // C1 — when useEraTurn escalates a miss automatically, it already
        // persisted the user's turn as part of its normal flow; persisting
        // it again here would duplicate the era_messages row.
        if (!skipUserMessage) {
          const userMessage = {
            conversation_id: conversationId,
            role: "user" as const,
            content: question,
          };

          if (conversationId) {
            void createMessage.mutateAsync(userMessage).catch(() => {});
          } else {
            try {
              const userResult = await createMessage.mutateAsync(userMessage);
              conversationId = userResult.conversation_id;
            } catch {
              conversationId = null;
            }
          }
        }

        const history = (messagesData?.messages ?? []).slice(-8).map((m) => ({
          role:
            m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        }));

        // Focus memory lives in browser state — send the single most recent
        // reminder so the server can resolve a "FOCUS" sentinel in a
        // propose_action proposal (see eraAskProposal.ts). `useEraStore`
        // already keeps this pruned/de-duped/newest-first.
        const focusEntity = focusEntities[0] ?? null;

        const res = await safeFetch("/api/era/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
            face: activeFaceKey,
            history,
            pendingReminderTitle: pendingTurn?.title,
            focusEntity,
            auto,
          }),
          timeoutMs: 60_000, // Hard Rule #6 — AI calls are slow
        });

        const result: AskAIResult = res.ok
          ? await res.json()
          : {
              kind: "prose",
              text: "I couldn't reach the AI just now. Try again in a moment.",
            };

        setPendingTurn(null); // Ask AI is a deliberate escape hatch — it ends the pending question either way.

        if (result.kind === "propose_nfc_reminder") {
          const proposal: EraActiveProposal = {
            kind: "propose_nfc_reminder",
            text: result.text,
            reminderTitle: result.reminderTitle,
            nfcTagId: result.nfcTagId,
            nfcTagLabel: result.nfcTagLabel,
            targetState: result.targetState,
          };
          setActiveProposal(proposal);
        } else if (result.kind === "propose_action") {
          const proposal: EraActiveProposal = {
            kind: "propose_action",
            text: result.text,
            capabilityId: result.capabilityId,
            slots: result.slots,
            sourceText: question,
          };
          setActiveProposal(proposal);
        }

        setEraReply(result.text);

        if (conversationId) {
          void createMessage
            .mutateAsync({
              conversation_id: conversationId,
              role: "assistant",
              content: result.text,
            })
            .catch(() => {});
        }

        return result.text;
      } finally {
        setAskingAI(false);
      }
    },
    [
      activeConversation,
      messagesData,
      activeFaceKey,
      pendingTurn,
      focusEntities,
      createMessage,
      setPendingTurn,
      setActiveProposal,
      setEraReply,
      setAskingAI,
    ],
  );

  const confirmProposal = useCallback(async () => {
    const proposal = activeProposal;
    if (!proposal) return;
    setActiveProposal(null);

    const conversationId = activeConversation?.id ?? null;
    let replyText: string;

    if (proposal.kind === "propose_action") {
      // Stage 3 (HUB-29) — slots were already validated + entity-resolved
      // server-side (eraAskProposal.ts) using the SAME Zod schema this
      // capability owns; execute() is the one existing code path this
      // reuses, never a second write implementation.
      const capability = getCapability(proposal.capabilityId);
      try {
        if (!capability) throw new Error("unknown capability");
        const result = await capability.execute(proposal.slots);
        replyText = result.text;
        logEraCapabilityAction(
          proposal.capabilityId,
          result.metadata,
          queryClient,
        );

        // Stage 4 (HUB-30) — learn a phrasing template from this SUCCESSFUL
        // execution only. A dismissed proposal never reaches here at all; a
        // proposal that reached here but returned a graceful error (HUB-34:
        // `shouldLearnFrom` — a resolver reports failure by RETURNING error
        // text, not throwing, so `result.ok` is the only reliable success
        // signal) teaches nothing either — a phrasing that didn't actually
        // work must never get memorized as if it did.
        const learned = shouldLearnFrom(result)
          ? learnTemplateFromProposal(
              proposal.sourceText,
              proposal.slots,
              capability,
            )
          : null;
        if (learned) {
          safeFetch("/api/era/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              capabilityId: proposal.capabilityId,
              patternText: learned.patternText,
              slotNames: learned.slotNames,
              sourceText: proposal.sourceText,
            }),
          })
            .then((res) => {
              if (res.ok)
                queryClient.invalidateQueries({
                  queryKey: eraKeys.templates(),
                });
            })
            .catch(() => {});
        }
      } catch {
        replyText = "That didn't go through — try it from the app directly.";
      }

      setEraReply(replyText);
      if (conversationId) {
        void createMessage
          .mutateAsync({
            conversation_id: conversationId,
            role: "assistant",
            content: replyText,
          })
          .catch(() => {});
      }
      return;
    }

    try {
      const itemRes = await safeFetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reminder",
          title: proposal.reminderTitle,
        }),
        timeoutMs: 8_000,
      });
      if (!itemRes.ok) throw new Error("item create failed");
      const { item } = (await itemRes.json()) as { item: { id: string } };

      const prereqRes = await safeFetch(`/api/items/${item.id}/prerequisites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition_type: "nfc_state_change",
          condition_config: {
            tag_id: proposal.nfcTagId,
            target_state: proposal.targetState,
          },
        }),
        timeoutMs: 8_000,
      });
      if (!prereqRes.ok) throw new Error("prerequisite create failed");

      replyText = `Set — "${proposal.reminderTitle}" fires when ${proposal.nfcTagLabel} reaches ${proposal.targetState}.`;
      logEraNfcReminder(item.id, proposal.reminderTitle, queryClient);
    } catch {
      replyText =
        "That didn't save — try setting the trigger from the item's own page instead.";
    }

    setEraReply(replyText);
    if (conversationId) {
      void createMessage
        .mutateAsync({
          conversation_id: conversationId,
          role: "assistant",
          content: replyText,
        })
        .catch(() => {});
    }
  }, [
    activeProposal,
    activeConversation,
    createMessage,
    setActiveProposal,
    setEraReply,
    queryClient,
  ]);

  const dismissProposal = useCallback(() => {
    setActiveProposal(null);
  }, [setActiveProposal]);

  return { askAI, askingAI, activeProposal, confirmProposal, dismissProposal };
}

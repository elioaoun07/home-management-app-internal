"use client";

// src/features/era/useEraAskAI.ts
// ERA "Ask AI" (Slice 4) — the manual escape hatch, always available, never
// triggered automatically by the router (locked decision: manual button,
// always visible — no auto-escalation, no surprise quota burn).
//
// Sends the current face + recent thread history to POST /api/era/ask. The
// model either answers in prose (persisted to the thread like any other
// reply) or proposes a specific action (Slice 4 ships exactly one kind:
// "trigger this reminder from an NFC tag"), rendered as a confirm card via
// `activeProposal`. Nothing is written until `confirmProposal()` runs —
// Doctrine Q10: the model proposes, the human confirms, the deterministic
// path executes.

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { AskAIResult } from "@/lib/ai/eraAskProposal";
import { safeFetch } from "@/lib/safeFetch";
import { logEraNfcReminder } from "./logEraAction";
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
  const askingAI = useEraStore((s) => s.askingAI);
  const setAskingAI = useEraStore((s) => s.setAskingAI);
  const setEraReply = useEraStore((s) => s.setEraReply);

  const { data: activeConversation } = useActiveEraConversation();
  const { data: messagesData } = useEraMessages(activeConversation?.id ?? null);
  const createMessage = useCreateEraMessage();
  const queryClient = useQueryClient();

  const askAI = useCallback(
    async (question: string) => {
      const conversationId = activeConversation?.id ?? null;
      setAskingAI(true);

      try {
        await createMessage.mutateAsync({
          conversation_id: conversationId,
          role: "user",
          content: question,
        });

        const history = (messagesData?.messages ?? [])
          .slice(-8)
          .map((m) => ({
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          }));

        const res = await safeFetch("/api/era/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
            face: activeFaceKey,
            history,
            pendingReminderTitle: pendingTurn?.title,
          }),
          timeoutMs: 60_000, // Hard Rule #6 — AI calls are slow
        });

        const result: AskAIResult = res.ok
          ? await res.json()
          : { kind: "prose", text: "I couldn't reach the AI just now. Try again in a moment." };

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
        }

        await createMessage.mutateAsync({
          conversation_id: conversationId,
          role: "assistant",
          content: result.text,
        });

        setEraReply(result.text);
      } finally {
        setAskingAI(false);
      }
    },
    [
      activeConversation,
      messagesData,
      activeFaceKey,
      pendingTurn,
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

    try {
      const itemRes = await safeFetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "reminder", title: proposal.reminderTitle }),
        timeoutMs: 8_000,
      });
      if (!itemRes.ok) throw new Error("item create failed");
      const { item } = (await itemRes.json()) as { item: { id: string } };

      const prereqRes = await safeFetch(`/api/items/${item.id}/prerequisites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition_type: "nfc_state_change",
          condition_config: { tag_id: proposal.nfcTagId, target_state: proposal.targetState },
        }),
        timeoutMs: 8_000,
      });
      if (!prereqRes.ok) throw new Error("prerequisite create failed");

      replyText = `Set — "${proposal.reminderTitle}" fires when ${proposal.nfcTagLabel} reaches ${proposal.targetState}.`;
      logEraNfcReminder(item.id, proposal.reminderTitle, queryClient);
    } catch {
      replyText = "That didn't save — try setting the trigger from the item's own page instead.";
    }

    await createMessage.mutateAsync({
      conversation_id: conversationId,
      role: "assistant",
      content: replyText,
    });
    setEraReply(replyText);
  }, [activeProposal, activeConversation, createMessage, setActiveProposal, setEraReply, queryClient]);

  const dismissProposal = useCallback(() => {
    setActiveProposal(null);
  }, [setActiveProposal]);

  return { askAI, askingAI, activeProposal, confirmProposal, dismissProposal };
}

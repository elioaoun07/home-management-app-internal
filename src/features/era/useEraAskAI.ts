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
import { ToastIcons } from "@/lib/toastIcons";
import { toast } from "sonner";
import { getCapability } from "./capabilities/registry";
import { eraArtifact, type EraArtifact } from "@/lib/era/artifacts";
import { recordEraArtifacts } from "./recordArtifacts";
import { executeNativeAction } from "./nativeActions";
import { eraKeys } from "./queryKeys";
import { learnTemplateFromProposal, shouldLearnFrom } from "./templates/learn";
import { AI_ANSWER_KIND } from "./thread";
import type { EraActiveProposal } from "./types";
import {
  eraConversationTarget,
  useActiveEraConversation,
  useCreateEraMessage,
  useEraMessages,
} from "./useEraConversation";
import { useEraStore } from "./useEraStore";

const TEMPLATES_FROZEN = true;

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
          // HUB-86 — a fresh chat names its conversation here (first write creates it).
          const target = conversationId
            ? { id: conversationId, ensure: false }
            : eraConversationTarget(queryClient, activeFaceKey);
          conversationId = target.id;
          void createMessage
            .mutateAsync({
              conversation_id: target.id,
              role: "user",
              content: question,
              ensure_conversation: target.ensure,
            })
            .catch(() => {});
        }

        // System rows (a consumed handoff, a filed report) are bookkeeping,
        // not something either side said.
        const history = (messagesData?.messages ?? [])
          .filter((m) => m.role !== "system")
          .slice(-8)
          .map((m) => ({
            role:
              m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          }));

        // Focus memory lives in browser state — send the single most recent
        // reminder so the server can resolve a "FOCUS" sentinel in a
        // propose_action proposal (see eraAskProposal.ts). `useEraStore`
        // already keeps this pruned/de-duped/newest-first.
        // HUB-84 — focus now holds every result type; the model's
        // "current focus reminder" must be the most recent REMINDER.
        const focusEntity = focusEntities.find((e) => e.type === "reminder") ?? null;

        const res = await safeFetch("/api/era/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
            face: activeFaceKey,
            history,
            pendingReminderTitle:
              pendingTurn?.kind === "draftReminder" ? pendingTurn.title : undefined,
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
              // HUB-85 — marks the answer as the model's, and whether it was
              // only prose, so the thread can offer Report on a missed request.
              intent_kind: AI_ANSWER_KIND,
              intent_payload: { aiKind: result.kind, auto },
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
      queryClient,
    ],
  );

  const confirmProposal = useCallback(async () => {
    const proposal = activeProposal;
    if (!proposal) return;
    setActiveProposal(null);

    // HUB-78 — a handoff card's only action opens the prefilled form.
    if (proposal.kind === "handoff") {
      proposal.open();
      return;
    }

    const conversationId = activeConversation?.id ?? null;
    let replyText: string;
    let artifacts: EraArtifact[] | undefined;
    // Every confirmed write ends the same way: log its artifacts, then the
    // assistant row carries them so the Activity Log can open the item.
    const finish = () => {
      recordEraArtifacts(artifacts, queryClient);
      setEraReply(replyText);
      if (conversationId) {
        void createMessage
          .mutateAsync({
            conversation_id: conversationId,
            role: "assistant",
            content: replyText,
            ...(artifacts?.length ? { intent_payload: { artifacts } } : {}),
          })
          .catch(() => {});
      }
    };

    // HUB-76 — a native router write held behind its tier. Executes through
    // the native resolvers (never a template, never Ask AI's catalog); the
    // receipt carries Undo only where an inverse exists.
    if (proposal.kind === "native_action") {
      const { action } = proposal;
      try {
        const result = await executeNativeAction(action, queryClient);
        replyText = result.text;
        if (result.outcome === "done") {
          artifacts = result.artifacts;
          const undo = result.undo;
          if (undo) {
            toast.success(proposal.text, {
              icon: ToastIcons.success,
              duration: 4000,
              action: {
                label: "Undo",
                onClick: async () => {
                  const ok = await undo().catch(() => false);
                  if (ok) toast.success("Undone", { icon: ToastIcons.success });
                  else toast.error("Couldn't undo");
                },
              },
            });
          }
        }
      } catch {
        replyText = "That didn't go through — try it from the app directly.";
      }

      finish();
      return;
    }

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
        if (result.ok !== false) artifacts = result.artifacts;

        // Stage 4 (HUB-30) — learn a phrasing template from this SUCCESSFUL
        // execution only. A dismissed proposal never reaches here at all; a
        // proposal that reached here but returned a graceful error (HUB-34:
        // `shouldLearnFrom` — a resolver reports failure by RETURNING error
        // text, not throwing, so `result.ok` is the only reliable success
        // signal) teaches nothing either — a phrasing that didn't actually
        // work must never get memorized as if it did.
        // HUB-80 — templates are FROZEN: no new era_templates rows. Existing
        // templates still match (HUB-64 safety intact); learning moves to the
        // household lexicon (era_lexicon).
        const learned = TEMPLATES_FROZEN
          ? null
          : shouldLearnFrom(result)
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

      finish();
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
      artifacts = [eraArtifact("reminder", "created", item.id, proposal.reminderTitle)];
    } catch {
      replyText =
        "That didn't save — try setting the trigger from the item's own page instead.";
    }

    finish();
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

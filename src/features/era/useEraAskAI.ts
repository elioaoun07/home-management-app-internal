"use client";

// src/features/era/useEraAskAI.ts
// ERA "Ask AI" (Slice 4) — the escape hatch to the AI. Originally a manual-
// only button (locked decision: no auto-escalation, no surprise quota burn);
// Stage C reopens that decision under a specific guard — see useEraTurn.ts's
// module doc. Both entry points funnel through THIS hook and this route, so
// there is exactly one place that builds the request, renders a proposal,
// and records its outcome — never a second implementation for the auto path.
//
// Sends the current face + recent thread history to POST /api/era/ask. The
// model either answers in prose (persisted to the thread like any other
// reply) or proposes a specific action, rendered as a confirm card via
// `activeProposal`. Nothing is written until `confirmProposal()` runs —
// Doctrine Q10: the model proposes, the human confirms, the deterministic
// path executes.

import { useQueryClient } from "@tanstack/react-query";
import { effectiveActionSchema } from "./capabilities/effectiveAction";
import { itemCreateReceiptSchema, createdItemIdentitySchema } from "@/lib/items/createContract";
import { useCallback } from "react";
import type { AskAIResult } from "@/lib/ai/eraAskProposal";
import { safeFetch } from "@/lib/safeFetch";
import { privateAskHistory } from "./adaptiveTurn";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ToastIcons } from "@/lib/toastIcons";
import { toast } from "sonner";
import { applyCapabilityResult } from "./capabilities/applyResult";
import {
  executePlan,
  planNeedsConfirmation,
  planOutcome,
  type EraPlanResult,
} from "./capabilities/plan";
import { formatDate } from "@/lib/utils/date";
import { takeProposalForConfirmation } from "./capabilities/confirmation";
import { eraArtifact, type EraArtifact } from "@/lib/era/artifacts";
import { recordEraArtifacts } from "./recordArtifacts";
import { executeNativeAction } from "./nativeActions";
import { eraKeys } from "./queryKeys";
import { AI_ANSWER_KIND } from "./thread";
import type { EraActiveProposal, EraRequestContext } from "./types";
import {
  eraConversationTarget,
  useActiveEraConversation,
  useCreateEraMessage,
  useEraMessages,
  type EraMessagesPage,
} from "./useEraConversation";
import { useEraStore } from "./useEraStore";
import { DURABLE_EXECUTION } from "./execution/state";
import {
  activateRun,
  createRun,
  executeRun,
  cachedActiveRun,
  beginAnswer,
  finishAnswer,
  changeRun,
  conversationStillActive,
} from "./execution/client";

/** Consent and relative dates belong to the originating request, including
 * when the optional journal is disabled. Never execute a card under a new user. */
async function assertRequestActive(context: EraRequestContext | undefined) {
  if (!context || !conversationStillActive(context.conversationId))
    throw new Error("Request suspended. Return to its chat or restate it.");
  const {
    data: { user },
  } = await supabaseBrowser().auth.getUser();
  if (
    user?.id !== context.ownerId ||
    !conversationStillActive(context.conversationId)
  )
    throw new Error("Request suspended. Return to its chat or restate it.");
  if (context.timeZone !== Intl.DateTimeFormat().resolvedOptions().timeZone)
    throw new Error("Time zone changed. Restate the request.");
}

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
  useEraMessages(activeConversation?.id ?? null);
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
      const state = useEraStore.getState();
      if (state.askingAI || (!skipUserMessage && state.turnInFlight))
        return state.eraReply;
      const referenceDate = new Date().toISOString();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let conversationId =
        opts.conversationId === undefined
          ? (activeConversation?.id ?? null)
          : opts.conversationId;
      setAskingAI(true);
      // The old request remains in its journal; this turn gets its own consent.
      useEraStore.setState({ activeRunId: null });

      try {
        // Check the current session before using a cached private transcript.
        // A stale household/cache identity cannot send another person's chat.
        const {
          data: { user },
        } = await supabaseBrowser().auth.getUser();
        const cachedConversation = queryClient
          .getQueryData<
            Array<{ id: string; user_id: string }>
          >(eraKeys.conversations())
          ?.find((c) => c.id === conversationId);
        const conversationOwner = cachedConversation?.user_id;
        if (
          !user ||
          (conversationOwner &&
            conversationOwner !== "local" &&
            conversationOwner !== user.id)
        ) {
          const text = "Start a new chat.";
          setEraReply(text);
          return text;
        }
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
        if (!conversationId) throw new Error("Start a new chat.");
        const requestContext: EraRequestContext = {
          ownerId: user.id,
          conversationId,
          referenceDate,
          timeZone,
        };

        // System rows (a consumed handoff, a filed report) are bookkeeping,
        // not something either side said.
        const latestMessages = conversationId
          ? (queryClient.getQueryData<EraMessagesPage>(
              eraKeys.messages(conversationId),
            )?.messages ?? [])
          : [];
        const history = privateAskHistory(
          latestMessages,
          user.id,
          conversationId,
        ).map((m) => ({
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
        const boundPersonalTurn = conversationOwner === user.id;
        const focusEntity = boundPersonalTurn
          ? (focusEntities.find((e) => e.type === "reminder") ?? null)
          : null;

        const res = await safeFetch("/api/era/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
            face: activeFaceKey,
            history,
            historyOwnerId: user.id,
            conversationId,
            pendingReminderTitle:
              boundPersonalTurn && pendingTurn?.kind === "draftReminder"
                ? pendingTurn.title
                : undefined,
            focusEntity,
            auto,
            localDate: formatDate(new Date(referenceDate)),
          }),
          timeoutMs: 60_000, // Hard Rule #6 — AI calls are slow
        });

        let result: AskAIResult = res.ok
          ? await res.json()
          : {
              kind: "prose",
              text: "I couldn't reach the AI just now. Try again in a moment.",
            };
        const contextReceipt = result.contextReceipt;
        // A response for a signed-out speaker must not attach to another user.
        const {
          data: { user: currentUser },
        } = await supabaseBrowser().auth.getUser();
        if (currentUser?.id !== user.id) return "Request suspended.";

        const aiKind = result.kind;
        let proposedPlan =
          result.kind === "propose_plan"
            ? result.plan
            : result.kind === "propose_action"
              ? {
                  steps: [
                    {
                      id: "action",
                      label: "Action",
                      capabilityId: result.capabilityId,
                      slots: result.slots,
                    },
                  ],
                }
              : undefined;
        // A model response arriving after New chat/History belongs to its
        // originating chat. Save its plan, but never attach it to the new one.
        if (conversationId && !conversationStillActive(conversationId)) {
          if (DURABLE_EXECUTION && proposedPlan)
            await createRun(
              proposedPlan,
              question,
              result.text,
              conversationId,
              queryClient,
              referenceDate,
            );
          void createMessage
            .mutateAsync({
              conversation_id: conversationId,
              role: "assistant",
              content: result.text,
              intent_kind: AI_ANSWER_KIND,
            })
            .catch(() => {});
          return result.text;
        }
        setPendingTurn(null);
        setActiveProposal(null);
        let agentRun: EraPlanResult | undefined;
        let durableRunId: string | undefined;
        if (DURABLE_EXECUTION && proposedPlan && conversationId) {
          try {
            const saved = await createRun(
              proposedPlan,
              question,
              result.text,
              conversationId,
              queryClient,
              referenceDate,
            );
            durableRunId = saved.id;
            if (!conversationStillActive(conversationId)) return result.text;
            activateRun(saved);
            if (planNeedsConfirmation(proposedPlan)) {
              result = {
                kind: "propose_plan",
                text: result.text,
                plan: proposedPlan,
              };
            } else {
              agentRun = (await executeRun(saved, queryClient)) ?? undefined;
              result = {
                kind: "prose",
                text: agentRun?.text ?? saved.state.text,
              };
            }
          } catch (error) {
            result = {
              kind: "prose",
              text:
                error instanceof Error
                  ? error.message
                  : "Couldn't save progress. Refresh and resume.",
            };
            proposedPlan = undefined;
          }
        }
        // Reads use real application results immediately. Model prose is never
        // used to manufacture a factual answer to a registered read.
        if (
          !DURABLE_EXECUTION &&
          proposedPlan &&
          !planNeedsConfirmation(proposedPlan)
        ) {
          agentRun = await executePlan(proposedPlan, {
            confirmed: false,
            referenceDate: new Date(referenceDate),
            beforeStep: () => assertRequestActive(requestContext),
            onStep: async (s) => {
              const {
                data: { user: currentUser },
              } = await supabaseBrowser().auth.getUser();
              const sameOwner = currentUser?.id === requestContext.ownerId;
              applyCapabilityResult(s.capabilityId, s.result, queryClient, {
                recordArtifacts: sameOwner,
                updateContext:
                  sameOwner &&
                  conversationStillActive(requestContext.conversationId),
              });
            },
          });
          result = { kind: "prose", text: agentRun.text };
        }

        // Source reads and journal calls can outlive the model request too.
        const {
          data: { user: publishingUser },
        } = await supabaseBrowser().auth.getUser();
        if (publishingUser?.id !== requestContext.ownerId)
          return "Request suspended.";
        const currentChat =
          conversationId && conversationStillActive(conversationId);
        if (result.kind === "propose_plan" && currentChat) {
          setActiveProposal({
            ...result,
            sourceText: question,
            requestContext,
          });
        } else if (result.kind === "propose_nfc_reminder" && currentChat) {
          const proposal: EraActiveProposal = {
            kind: "propose_nfc_reminder",
            text: result.text,
            reminderTitle: result.reminderTitle,
            nfcTagId: result.nfcTagId,
            nfcTagLabel: result.nfcTagLabel,
            targetState: result.targetState,
            requestContext,
          };
          setActiveProposal(proposal);
        } else if (result.kind === "propose_action" && currentChat) {
          const proposal: EraActiveProposal = {
            kind: "propose_action",
            text: result.text,
            capabilityId: result.capabilityId,
            slots: result.slots,
            sourceText: question,
            requestContext,
          };
          setActiveProposal(proposal);
        }

        if (currentChat) setEraReply(result.text);

        if (conversationId) {
          void createMessage
            .mutateAsync({
              conversation_id: conversationId,
              role: "assistant",
              content: result.text,
              // HUB-85 — marks the answer as the model's, and whether it was
              // only prose, so the thread can offer Report on a missed request.
              intent_kind: AI_ANSWER_KIND,
              intent_payload: {
                aiKind,
                auto,
                ...(contextReceipt ? { contextReceipt } : {}),
                ...(durableRunId ? { runId: durableRunId } : {}),
                ...(result.kind === "propose_plan"
                  ? { plan: result.plan }
                  : {}),
                ...(agentRun && proposedPlan
                  ? {
                      agentRun: planReceipt(agentRun),
                      outcome: planOutcome(proposedPlan, agentRun),
                    }
                  : proposedPlan
                    ? {
                        outcome: {
                          status: "awaiting_confirm",
                          capability: "agent.plan",
                          entityIds: [],
                          inverse: null,
                        },
                      }
                    : {}),
              },
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
    // Consume the current store value synchronously. Multiple hook instances
    // (typed, voice, mobile card) and rapid double taps share this guard.
    const proposal = takeProposalForConfirmation();
    if (!proposal) return;
    try {
      const durableRun = DURABLE_EXECUTION
        ? cachedActiveRun(queryClient, activeConversation?.id ?? null)
        : null;
      if (durableRun) {
        let runResult: EraPlanResult | null = null;
        if (proposal.kind === "propose_plan") {
          runResult = await executeRun(
            durableRun,
            queryClient,
            !durableRun.state.confirmed,
          );
        } else if (proposal.kind === "native_action") {
          // A step's additional confirmation (e.g. create a shopping group)
          // finishes that same step. Never replay its original shopping add.
          const answer = await beginAnswer(durableRun, queryClient);
          let result;
          try {
            const native = await executeNativeAction(
              proposal.action,
              queryClient,
            );
            result = { ...native, ok: native.outcome === "done" };
          } catch {
            result = {
              text: "Couldn't verify that action. Check the app.",
              ok: false,
            };
          }
          const saved = await finishAnswer(answer, result, queryClient);
          if (conversationStillActive(durableRun.conversation_id)) {
            applyCapabilityResult(
              durableRun.state.plan.steps.find((s) => s.id === answer.stepId)!
                .capabilityId,
              result,
              queryClient,
              { recordArtifacts: false },
            );
            useEraStore.getState().setEraReply(saved.state.text);
          }
        }
        if (runResult) {
          void createMessage
            .mutateAsync({
              conversation_id: durableRun.conversation_id,
              role: "assistant",
              content: runResult.text,
              intent_payload: {
                runId: durableRun.id,
                plan: durableRun.state.plan,
                agentRun: planReceipt(runResult),
                outcome: planOutcome(durableRun.state.plan, runResult),
                artifacts: runResult.steps.flatMap(
                  (s) => s.result.artifacts ?? [],
                ),
              },
            })
            .catch(() => {});
        }
        return;
      }
      // A recovered card cannot silently fall back to a non-durable dispatch
      // when its owner-scoped cache is still loading or unavailable.
      if (DURABLE_EXECUTION && useEraStore.getState().activeRunId)
        throw new Error("Load the saved plan before confirming.");
      // HUB-78 — a handoff card's only action opens the prefilled form.
      if (proposal.kind === "handoff") {
        proposal.open();
        return;
      }

      if (proposal.kind !== "native_action")
        await assertRequestActive(proposal.requestContext);

      const conversationId =
        proposal.requestContext?.conversationId ??
        activeConversation?.id ??
        null;
      let replyText: string;
      let artifacts: EraArtifact[] | undefined;
      let executionMetadata: Record<string, unknown> | undefined;
      // Every confirmed write ends the same way: log its artifacts, then the
      // assistant row carries them so the Activity Log can open the item.
      const finish = async () => {
        if (proposal.requestContext) {
          const {
            data: { user },
          } = await supabaseBrowser().auth.getUser();
          if (user?.id !== proposal.requestContext.ownerId) return;
        }
        recordEraArtifacts(artifacts, queryClient);
        if (conversationId && conversationStillActive(conversationId))
          setEraReply(replyText);
        if (conversationId) {
          void createMessage
            .mutateAsync({
              conversation_id: conversationId,
              role: "assistant",
              content: replyText,
              ...(artifacts?.length || executionMetadata
                ? {
                    intent_payload: {
                      ...executionMetadata,
                      ...(artifacts?.length ? { artifacts } : {}),
                    },
                  }
                : {}),
            })
            .catch(() => {});
        }
      };

      if (
        proposal.kind === "propose_plan" ||
        proposal.kind === "propose_action"
      ) {
        const plan =
          proposal.kind === "propose_plan"
            ? proposal.plan
            : {
                steps: [
                  {
                    id: "action",
                    label: "Action",
                    capabilityId: proposal.capabilityId,
                    slots: proposal.slots,
                  },
                ],
              };
        const run = await executePlan(plan, {
          confirmed: true,
          focus:
            useEraStore
              .getState()
              .focusEntities.find((e) => e.type === "reminder") ?? null,
          referenceDate: new Date(proposal.requestContext!.referenceDate),
          beforeStep: () => assertRequestActive(proposal.requestContext),
          beforeWrite: () => assertRequestActive(proposal.requestContext),
          consent: proposal.kind === "propose_plan" ? proposal.consent : undefined,
          resume: proposal.kind === "propose_plan" ? proposal.resume : undefined,
          onStep: async (s) => {
            const {
              data: { user },
            } = await supabaseBrowser().auth.getUser();
            const sameOwner = user?.id === proposal.requestContext!.ownerId;
            applyCapabilityResult(s.capabilityId, s.result, queryClient, {
              recordArtifacts: sameOwner,
              updateContext:
                sameOwner && conversationStillActive(conversationId!),
            });
          },
        });
        const next = run.steps.find(s => s.result.metadata?.effectiveAction);
        if (next) {
          const action = effectiveActionSchema.parse(next.result.metadata!.effectiveAction);
          const current = proposal.kind === "propose_plan" ? proposal.consent : undefined;
          useEraStore.getState().setActiveProposal({
            kind: "propose_plan", text: "Confirm the effective action.", plan,
            sourceText: proposal.sourceText, requestContext: proposal.requestContext,
            consent: { ...current, [next.id]: action },
            resume: run.steps.filter(s => ["done", "skipped"].includes(s.status)),
          });
        }
        replyText = run.text;
        // Artifacts are already recorded per step, including partial results.
        // Carry them on the conversation row without logging them twice.
        executionMetadata = {
          plan,
          agentRun: planReceipt(run),
          outcome: planOutcome(plan, run),
          artifacts: run.steps.flatMap((s) => s.result.artifacts ?? []),
        };
        await finish();
        return;
      }

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
                    if (ok)
                      toast.success("Undone", { icon: ToastIcons.success });
                    else toast.error("Couldn't undo");
                  },
                },
              });
            }
          }
        } catch {
          replyText = "That didn't go through — try it from the app directly.";
        }

        await finish();
        return;
      }

      try {
        const itemRes = await safeFetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "reminder",
            title: proposal.reminderTitle,
            prerequisites: [{ condition_type: "nfc_state_change", condition_config: { tag_id: proposal.nfcTagId, target_state: proposal.targetState } }],
          }),
          timeoutMs: 8_000,
        });
        if (!itemRes.ok) {
          const receipt = await itemRes.json().catch(() => null);
          if (["not_started", "rolled_back"].includes(receipt?.completion?.status)) {
            replyText = "Reminder was not saved.";
            executionMetadata = { outcome: { status: "failed", capability: "reminder.nfc", entityIds: [], inverse: null } };
            await finish();
            return;
          }
          throw new Error("Save unverified");
        }
        const json = await itemRes.json();
        const identity = createdItemIdentitySchema.safeParse(json);
        if (identity.success) artifacts = [eraArtifact("reminder", "created", identity.data.item.id, proposal.reminderTitle)];
        const { item } = itemCreateReceiptSchema.parse(json);
        artifacts = [
          eraArtifact("reminder", "created", item.id, proposal.reminderTitle),
        ];

        replyText = `Set — "${proposal.reminderTitle}" fires when ${proposal.nfcTagLabel} reaches ${proposal.targetState}.`;
        executionMetadata = {
          outcome: {
            status: "done",
            capability: "reminder.nfc",
            entityIds: [item.id],
            inverse: null,
          },
        };
      } catch {
        replyText = artifacts?.length
          ? "Reminder created; trigger unverified. Check Schedule."
          : "Couldn't verify the reminder. Check Schedule before retrying.";
        executionMetadata = {
          outcome: {
            status: "uncertain",
            capability: "reminder.nfc",
            entityIds: artifacts?.map((a) => a.id) ?? [],
            inverse: null,
          },
        };
      }
      applyCapabilityResult(
        "reminder.create",
        { text: replyText },
        queryClient,
        { recordArtifacts: false, updateContext: false },
      );
      await finish();
    } catch (error) {
      if (
        !activeConversation?.id ||
        conversationStillActive(activeConversation.id)
      )
        setEraReply(
          error instanceof Error
            ? error.message
            : "Couldn't save progress. Refresh and resume.",
        );
      queryClient.invalidateQueries({ queryKey: eraKeys.all });
    } finally {
      useEraStore.getState().setTurnInFlight(false);
    }
  }, [activeConversation, createMessage, setEraReply, queryClient]);

  const dismissProposal = useCallback(() => {
    const run = DURABLE_EXECUTION
      ? cachedActiveRun(queryClient, activeConversation?.id ?? null)
      : null;
    if (run) {
      // Dismiss cancels only unfinished work; committed facts stay intact.
      void changeRun(run, { type: "cancel" }, queryClient)
        .then(() => {
          if (useEraStore.getState().activeRunId === run.id)
            useEraStore.setState({
              activeRunId: null,
              pendingTurn: null,
              activeProposal: null,
            });
        })
        .catch(() => setEraReply("Couldn't dismiss. Refresh and resume."));
      return;
    }
    setActiveProposal(null);
  }, [setActiveProposal, queryClient, activeConversation?.id, setEraReply]);

  return { askAI, askingAI, activeProposal, confirmProposal, dismissProposal };
}

function planReceipt(run: EraPlanResult): Record<string, unknown> {
  return {
    status: run.status,
    steps: run.steps.map((s) => ({
      id: s.id,
      capabilityId: s.capabilityId,
      status: s.status,
      text: s.result.text,
      metadata: s.result.metadata,
      artifacts: s.result.artifacts,
    })),
  };
}

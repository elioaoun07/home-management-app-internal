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
// CAPABILITY gap outside a live dialogue stays a deterministic reply. During
// recent dialogue, unrecognized follow-ups also reach the model so they need
// not repeat a domain keyword. Both paths keep the same daily cap. This is a
// heuristic, not a guarantee (missTracking.ts's own doc comment says so) —
// worst case a language-gap guess escalates something Ask AI can't help
// with either, which just costs one AI call, capped per day server-side
// (see /api/era/ask/route.ts's DAILY_AUTO_ESCALATION_CAP).

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { qk } from "@/lib/queryKeys";
import { eraKeys } from "./queryKeys";
import { safeFetch } from "@/lib/safeFetch";
import { parseSmartText } from "@/lib/smartTextParser";
import { ToastIcons } from "@/lib/toastIcons";
import { deriveOutcome, handoffUrl, type EraHandoff } from "./engine";
import { getFace } from "./faceRegistry";
import { moneyIn } from "./intents/formatters/budget";
import { FREE_TEXT_SLOTS, isNewRequest } from "./intents/freeTextAnswer";
import { resolvePendingSlot } from "./intents/resolvers/slots";
import { patchDueAt } from "./nativeActions";
import { rootIntentRouter } from "./intentRouter";
import { resolveIntent, type ResolveResult } from "./intents/resolveIntent";
import { resolvePendingReminderAnswer } from "./intents/resolvers/schedule";
import { recordEraArtifacts } from "./recordArtifacts";
import { classifyMiss, type MissClassification } from "./missTracking";
import { useEraTemplates } from "./templates/useEraTemplates";
import { useEraLexicon } from "./useEraLexicon";
import { deriveLearnedVocab } from "./templates/vocabGrowth";
import type { FocusEntity } from "./focusMemory";
import type {
  EraActiveProposal,
  EraOutcome,
  EraPendingSlot,
  EraPendingTurn,
  Intent,
} from "./types";
import { useEraAskAI } from "./useEraAskAI";
import { useEraBudgetSubmit } from "./useEraBudgetSubmit";
import {
  eraConversationTarget,
  useActiveEraConversation,
  useCreateEraMessage,
  useEraMessages,
} from "./useEraConversation";
import { focusFromMessages } from "./focusRehydrate";
import { useEraStore } from "./useEraStore";
import { needsAgentPlan } from "./capabilities/plan";
import { classifySpeechAct } from "./intents/speechAct";
import { DURABLE_EXECUTION, nextStep } from "./execution/state";
import {
  cachedActiveRun,
  beginAnswer,
  finishAnswer,
  conversationStillActive,
} from "./execution/client";
import { applyCapabilityResult } from "./capabilities/applyResult";
import { hasRecentDialogue } from "./adaptiveTurn";
import { captureIntent, type NativeCapture } from "./capture";
import { capabilityOf } from "./engine";
import { invalidateAccountData } from "@/lib/queryInvalidation";
import type { EraMessagesPage } from "./useEraConversation";

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
    pending !== null || // answered a question (what time? / which one? / scope)
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

  useEraStore.getState().pushFocusEntity({
    id: itemId,
    type: "reminder",
    title,
    addedAt: Date.now(),
  });
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
  /** HUB-78 — the turn's single outcome (also persisted on the assistant row). */
  outcome?: EraOutcome;
  /**
   * HUB-37 — nothing was sent (offline refusal before the request left):
   * the command bar puts the text back so the person can resend it.
   * Never true after a timeout (uncertain) — that might duplicate.
   */
  keepInput?: boolean;
}

export function useEraTurn() {
  const setActiveFace = useEraStore((s) => s.setActiveFace);
  const setHubModuleKey = useEraStore((s) => s.setHubModuleKey);
  const setLastIntent = useEraStore((s) => s.setLastIntent);
  const setEraReply = useEraStore((s) => s.setEraReply);
  const setPendingTurn = useEraStore((s) => s.setPendingTurn);
  const setLastMissText = useEraStore((s) => s.setLastMissText);
  const setActiveProposal = useEraStore((s) => s.setActiveProposal);
  const setTurnInFlight = useEraStore((s) => s.setTurnInFlight);

  const budgetSubmit = useEraBudgetSubmit();
  const { data: activeConversation } = useActiveEraConversation();
  const createMessage = useCreateEraMessage();
  const queryClient = useQueryClient();
  const router = useRouter();
  // Stage C — the auto-escalation path below reuses this hook's askAI
  // verbatim (same request, same proposal rendering, same template
  // learning) rather than a second implementation of any of it.
  const { askAI } = useEraAskAI();
  // Stage 4 (HUB-30) — keeps useEraStore().templates current for the
  // router's Layer 2 matcher; see that hook's doc comment.
  useEraTemplates();
  // HUB-80 — the lexicon the resolvers read every turn.
  useEraLexicon();

  // HUB-84 — rebuild "it" from the conversation's saved results after a
  // reload (focus memory itself is page state). Once per conversation, and
  // only when nothing is in focus yet.
  const { data: messagesPage } = useEraMessages(activeConversation?.id ?? null);
  const rehydratedFor = useRef<string | null>(null);
  useEffect(() => {
    const convId = activeConversation?.id ?? null;
    if (!convId || rehydratedFor.current === convId || !messagesPage?.messages)
      return;
    rehydratedFor.current = convId;
    const store = useEraStore.getState();
    if (store.focusEntities.length > 0) return;
    for (const e of focusFromMessages(messagesPage.messages).reverse())
      store.pushFocusEntity(e);
  }, [activeConversation?.id, messagesPage]);

  const runTurnInner = useCallback(
    async (
      text: string,
      opts: { chip?: string; capture?: NativeCapture } = {},
    ): Promise<EraTurnResult> => {
      // Capture before a pending resolver can await/write. A chat switch must
      // never send the old answer or its receipts into the new conversation.
      const turnTarget = eraConversationTarget(
        queryClient,
        useEraStore.getState().activeFaceKey,
      );
      // HUB-78 — turn state (plan §4 component 1). An outstanding question
      // gets the first look at this turn, but it never swallows a new request.
      let pending: EraPendingTurn | null = useEraStore.getState().pendingTurn;
      let slotResolution: ResolveResult | null = null;
      let owningRun = DURABLE_EXECUTION
        ? cachedActiveRun(queryClient, activeConversation?.id ?? null)
        : null;
      let answer: Awaited<ReturnType<typeof beginAnswer>> | null = null;
      const nativeIntent = opts.capture ? captureIntent(opts.capture, text) : null;
      if (DURABLE_EXECUTION && useEraStore.getState().activeRunId && !owningRun)
        throw new Error("Load unfinished work before answering.");
      const suspendRun = () => {
        useEraStore.setState({
          activeRunId: null,
          pendingTurn: null,
          activeProposal: null,
        });
        owningRun = null;
        pending = null;
      };

      // A fresh compound command must reach the planner as a whole, even
      // when a previous turn left a date/group question open.
      if (nativeIntent || (!opts.chip && needsAgentPlan(text))) {
        if (owningRun) suspendRun();
        pending = null;
        setPendingTurn(null);
      }

      if (pending?.kind === "slot") {
        // HUB-94 — "When?"/"Where?" take free text, so a real new request
        // typed instead is handed to the router, never read as a date/place.
        const newRequest =
          !opts.chip &&
          (owningRun || FREE_TEXT_SLOTS.has(pending.capability)) &&
          isNewRequest(text);
        if (newRequest && owningRun) suspendRun();
        if (!newRequest && owningRun)
          answer = await beginAnswer(owningRun, queryClient);
        const answered = newRequest
          ? null
          : await resolvePendingSlot(
              pending as EraPendingSlot,
              text,
              opts.chip,
            ).catch(() => ({
              text: "Couldn't verify that answer. Check the app.",
              ok: false,
            }));
        if (answered && !("unmatched" in answered)) {
          slotResolution = answered as ResolveResult;
        } else {
          if (answer && owningRun) {
            await finishAnswer(
              answer,
              { text: owningRun.state.text, pending },
              queryClient,
            );
            answer = null;
            suspendRun();
          }
          pending = null;
          setPendingTurn(null);
        }
      } else if (pending?.kind === "draftReminder" && !hasDate(text)) {
        // "what time?" is open but this is plainly a new request: keep the
        // title as a reviewable draft (never lost) and handle the new one.
        const next = rootIntentRouter.parse(text);
        if (isConfident(next)) {
          if (owningRun) suspendRun();
          else void resolvePendingReminderAnswer(pending, "").catch(() => {});
          pending = null;
          setPendingTurn(null);
        } else if (owningRun) {
          return {
            intent: {
              kind: "draftReminder",
              face: "schedule",
              title: pending.title,
              rawText: text,
            },
            reply: owningRun.state.text,
            outcome: {
              status: "needs_input",
              capability: "agent.plan",
              entityIds: [],
              inverse: null,
            },
          };
        }
      }

      const intent: Intent = nativeIntent ?? (slotResolution
        ? {
            kind: "slotAnswer",
            face: (pending as EraPendingSlot).capability.startsWith("transfer")
              ? "budget"
              : "schedule",
            capability: (pending as EraPendingSlot).capability,
            rawText: text,
          }
        : pending?.kind === "draftReminder"
          ? {
              kind: "draftReminder",
              face: "schedule",
              title: pending.title,
              rawText: text,
            }
          : needsAgentPlan(text)
            ? { kind: "unknown", rawText: text }
            : rootIntentRouter.parse(text));
      const answeringQuestion = pending !== null;
      if (!answeringQuestion && owningRun) suspendRun();
      if (answeringQuestion && pending?.kind === "draftReminder" && owningRun)
        answer = await beginAnswer(owningRun, queryClient);

      if (!answeringQuestion) setLastIntent(intent);

      // A2 — a miss (unknown/clarify) keeps its raw text around so "Ask AI"
      // stays usable after the input box clears; a resolved turn (whether it
      // hit a router or answered a pending question) forgets it.
      const isMiss =
        !answeringQuestion &&
        (intent.kind === "clarify" || intent.kind === "unknown");
      setLastMissText(isMiss ? text : null);

      const isFaceless =
        intent.kind === "unknown" ||
        intent.kind === "greeting" ||
        intent.kind === "timeNow" ||
        intent.kind === "navigate" ||
        intent.kind === "forgetRule" ||
        intent.kind === "clarify";

      if (!answeringQuestion && !isFaceless) {
        setActiveFace(intent.face);
        setHubModuleKey(getFace(intent.face).eraModuleKey);
      }

      // HUB-86 — a fresh chat names its conversation here and the first write
      // creates it (`ensure`), so even the first turn renders optimistically
      // and persists in the per-conversation write queue: the assistant row
      // queues behind the row that creates its parent. Resolution starts now.
      const target = turnTarget;
      const conversationId: string | null = target.id;
      void createMessage
        .mutateAsync({
          conversation_id: conversationId,
          role: "user",
          content: text,
          intent_kind: intent.kind,
          intent_face: isFaceless ? null : intent.face,
          intent_payload: {
            ...intentPayload(intent),
            ...(opts.chip ? { chip: opts.chip } : {}),
          },
          ensure_conversation: target.ensure,
        })
        .catch(() => {});

      // Stage 2 (HUB-28) — a "clarify"/"unknown" turn is a router miss.
      // Classify it (language gap vs capability gap) BEFORE deciding what to
      // do next — Stage C's auto-escalation reads this same classification.
      const missClassification: MissClassification | null = isMiss
        ? classifyMiss(
            text,
            deriveLearnedVocab(useEraStore.getState().templates),
          )
        : null;

      // A live dialogue is additional evidence of a language gap: a follow-up
      // need not repeat a domain keyword. Outside it, keep the vocabulary gate.
      // HUB-76 — a NEGATED write never escalates.
      const negatedWrite =
        classifySpeechAct(text) === "negated" ||
        (intent.kind === "clarify" &&
          intent.reason === "speechAct" &&
          intent.act === "negated");
      if (
        isMiss &&
        !negatedWrite &&
        (missClassification?.missKind === "language-gap" ||
          needsAgentPlan(text) ||
          hasRecentDialogue(
            queryClient.getQueryData<EraMessagesPage>(
              eraKeys.messages(conversationId),
            )?.messages ?? [],
            conversationId,
          ))
      ) {
        setLastMissText(null);
        const reply = await askAI(text, {
          skipUserMessage: true,
          auto: true,
          conversationId,
        }).catch(() => "Something went wrong. Try again.");
        return { intent, reply, metadata: undefined, aiHandled: true };
      }

      const resolution: ResolveResult =
        slotResolution ??
        (await (
          (pending?.kind === "draftReminder"
            ? resolvePendingReminderAnswer(pending, text)
            : resolveIntent(intent, {
                submitBudgetDraft: budgetSubmit.submit,
              })) as Promise<ResolveResult>
        ).catch(() => ({
          text: "Something went wrong. Try again.",
          ok: false,
          metadata: undefined as Record<string, unknown> | undefined,
          pending: null,
        })));
      const {
        text: reply,
        metadata,
        pending: nextPending,
        proposal,
        handoff,
        navigate,
        focus: nextFocus,
        undo,
        artifacts,
      } = resolution;
      if (answer && owningRun) {
        const saved = await finishAnswer(answer, resolution, queryClient);
        const stepId = answer.stepId;
        const capabilityId = saved.state.plan.steps.find(
          (s) => s.id === stepId,
        )!.capabilityId;
        if (conversationStillActive(conversationId))
          applyCapabilityResult(capabilityId, resolution, queryClient, {
            recordArtifacts: false,
          });
        // A later step is now resumable; the original confirmed plan survives.
        if (!nextStep(saved.state)) useEraStore.setState({ activeRunId: null });
      }

      const currentChat = conversationStillActive(conversationId);
      if (currentChat) setPendingTurn(nextPending ?? null);
      // HUB-76 — a write held behind Confirm: show the card, write nothing.
      if (proposal && currentChat) setActiveProposal(proposal);
      // HUB-81 — a page door: one Open tap, no auto-navigation mid-conversation.
      if (navigate && currentChat)
        setActiveProposal({
          kind: "handoff",
          text: reply,
          open: () => router.push(navigate),
        });

      const outcome = deriveOutcome(intent, resolution);
      // Native helper writes share source cache refresh, including unknown saves.
      if (nativeIntent) {
        const refresh = () => {
          applyCapabilityResult(capabilityOf(intent) ?? "", resolution, queryClient, { recordArtifacts: false, updateContext: false });
          if (intent.kind === "draftTransaction")
            queryClient.invalidateQueries({ queryKey: eraKeys.widgets.budget() });
          // event.create is native-only and absent from the model registry.
          if (intent.kind === "draftEvent") {
            queryClient.invalidateQueries({ queryKey: qk.scheduleItems() });
            queryClient.invalidateQueries({ queryKey: eraKeys.widgets.schedule() });
          }
          // HUB-113 — the composer learns this wording for next time.
          queryClient.invalidateQueries({ queryKey: eraKeys.captureMemory() });
        };
        refresh();
        if (resolution.undo) {
          const inverse = resolution.undo;
          resolution.undo = async () => { try { return await inverse(); } finally { refresh(); } };
        }
      }
      // Every write's adapter returned its artifacts — one call, no per-feature mapping.
      if (!answer) recordEraArtifacts(artifacts, queryClient);
      if (currentChat)
        pushFocusFromResult(
          intent,
          answeringQuestion ? pending : null,
          metadata,
        );
      // HUB-84 — every editable result becomes "it" for the next follow-up.
      if (currentChat)
        registerResultFocus({
          intent,
          focus: nextFocus,
          proposal,
          handoff,
          metadata,
        });

      const draftTransactionId =
        typeof metadata?.draftId === "string" ? metadata.draftId : null;

      if (currentChat) setEraReply(reply);

      // The assistant row carries the outcome (HUB-47 reads only this) and,
      // for a spend, the handoff the precision form can open (component 9).
      const assistantWrite = conversationId
        ? createMessage
            .mutateAsync({
              conversation_id: conversationId,
              role: "assistant",
              content: reply,
              intent_kind: intent.kind,
              intent_face: isFaceless ? null : intent.face,
              intent_payload: {
                ...(metadata ?? intentPayload(intent)),
                ...(missClassification ?? {}),
                outcome,
                ...(handoff ? { handoff } : {}),
                // The Activity Log's ERA row opens the item from these.
                ...(artifacts?.length ? { artifacts } : {}),
              },
              draft_transaction_id: draftTransactionId,
            })
            .then((r) => r.message.id as string)
        : Promise.reject(new Error("no conversation"));
      assistantWrite.catch(() => {});

      const openHandoff = () =>
        assistantWrite
          .then((id) => router.push(handoffUrl(id)))
          .catch(() => toast.error("Couldn't open the form"));

      // Receipts (plan §5): one line, Undo only where an inverse exists.
      if (undo) {
        showUndoReceipt(reply, resolution.undo ?? undo);
      } else {
        showReceipt({
          intent,
          outcome,
          metadata,
          reply,
          handoff,
          openHandoff,
          queryClient,
          setActiveProposal,
        });
      }

      return {
        intent,
        reply,
        metadata,
        outcome,
        keepInput: metadata?.retryable === true,
      };
    },
    [
      setPendingTurn,
      createMessage,
      budgetSubmit,
      askAI,
      setLastIntent,
      setLastMissText,
      setActiveProposal,
      setActiveFace,
      setHubModuleKey,
      setEraReply,
      queryClient,
      activeConversation?.id,
      router,
    ],
  );

  // HUB-86 — the thread shows ERA thinking for the whole turn, whichever
  // surface started it (typed, voice or a chip).
  const runTurn = useCallback(
    async (
      text: string,
      opts: { chip?: string; capture?: NativeCapture } = {},
    ): Promise<EraTurnResult> => {
      // Typed and voice share this lock with confirmed agent execution.
      const state = useEraStore.getState();
      if (state.turnInFlight || state.askingAI)
        return {
          intent: { kind: "unknown", rawText: text },
          reply: state.eraReply,
          keepInput: true,
        };
      setTurnInFlight(true);
      const originatingConversation =
        useEraStore.getState().explicitConversation;
      try {
        return await runTurnInner(text, opts);
      } catch (error) {
        const reply =
          error instanceof Error
            ? error.message
            : "Couldn't save progress. Refresh and resume.";
        if (
          useEraStore.getState().explicitConversation ===
          originatingConversation
        )
          useEraStore.getState().setEraReply(reply);
        queryClient.invalidateQueries({ queryKey: eraKeys.all });
        return {
          intent: { kind: "unknown", rawText: text },
          reply,
          outcome: {
            status: "uncertain",
            capability: "agent.plan",
            entityIds: [],
            inverse: null,
          },
        };
      } finally {
        setTurnInFlight(false);
      }
    },
    [runTurnInner, setTurnInFlight, queryClient],
  );

  return { runTurn, budgetSubmitReady: budgetSubmit.ready };
}

/** HUB-84 — register the result a follow-up may edit next. */
function registerResultFocus(args: {
  intent: Intent;
  focus?: FocusEntity;
  proposal?: EraActiveProposal;
  handoff?: EraHandoff;
  metadata?: Record<string, unknown>;
}): void {
  const push = useEraStore.getState().pushFocusEntity;
  if (args.focus) {
    push(args.focus);
    return;
  }
  const p = args.proposal;
  if (p?.kind === "native_action" && p.action.type === "transfer") {
    push({
      id: "transfer-card",
      type: "transfer_card",
      title: p.text,
      addedAt: Date.now(),
      meta: { ...p.action },
    });
    return;
  }
  const m = args.metadata;
  if (typeof m?.draftId === "string" && args.handoff?.kind === "spend") {
    const h = args.handoff;
    push({
      id: m.draftId,
      type: "draft",
      title: typeof m.categoryName === "string" ? m.categoryName : "Draft",
      addedAt: Date.now(),
      meta: {
        draftId: m.draftId,
        accountId: h.accountId,
        amount: h.amount,
        currency: h.currency,
        categoryId: h.categoryId,
        subcategoryId: h.subcategoryId,
        description: h.description,
        date: h.date,
      },
    });
  }
}

function showUndoReceipt(label: string, undo: () => Promise<boolean>): void {
  const run = once(undo);
  toast.success(label, {
    icon: ToastIcons.success,
    duration: 4000,
    action: {
      label: "Undo",
      onClick: () =>
        run().then((ok) =>
          ok ? toast.success("Undone") : toast.error("Couldn't undo"),
        ),
    },
  });
}

function isConfident(intent: Intent): boolean {
  return !["clarify", "unknown", "greeting", "switchFace"].includes(
    intent.kind,
  );
}

function hasDate(text: string): boolean {
  const p = parseSmartText(text);
  return p.confidence.date > 0 && Boolean(p.dueDate);
}

function showReceipt(args: {
  intent: Intent;
  outcome: EraOutcome;
  metadata: Record<string, unknown> | undefined;
  reply: string;
  handoff: EraHandoff | undefined;
  openHandoff: () => void;
  queryClient: ReturnType<typeof useQueryClient>;
  setActiveProposal: (p: EraActiveProposal | null) => void;
}): void {
  const { outcome, metadata: m, handoff, openHandoff, queryClient } = args;

  if (outcome.status === "drafted" && typeof m?.draftId === "string") {
    const draftId = m.draftId;
    const amount = typeof m.amount === "number" ? m.amount : null;
    const title = [
      "Draft",
      amount !== null
        ? moneyIn(
            amount,
            typeof m.currency === "string" ? m.currency : undefined,
          )
        : null,
      typeof m.categoryName === "string" ? m.categoryName : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const undo = once(async () => {
      const res = await safeFetch(`/api/drafts/${draftId}`, {
        method: "DELETE",
      });
      queryClient.invalidateQueries({ queryKey: qk.drafts() });
      invalidateAccountData(queryClient, typeof m.accountId === "string" ? m.accountId : undefined);
      queryClient.invalidateQueries({ queryKey: eraKeys.widgets.budget() });
      return res.ok;
    });
    toast.success(title, {
      icon: ToastIcons.success,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () =>
          undo().then((ok) =>
            ok ? toast.success("Undone") : toast.error("Couldn't undo"),
          ),
      },
      cancel: { label: "Change", onClick: openHandoff },
    });
    return;
  }

  if (outcome.status === "handed_off" && handoff) {
    args.setActiveProposal({
      kind: "handoff",
      text: args.reply,
      open: openHandoff,
    });
    return;
  }

  if (outcome.status !== "done" || typeof m?.itemId !== "string") return;
  const itemId = m.itemId;
  const title = typeof m.title === "string" ? m.title : "Reminder";
  const label =
    typeof m.dueAt === "string" ? `${title} · ${formatDue(m.dueAt)}` : title;

  if (
    outcome.inverse === "reminder.patchDue" &&
    typeof m.previousDueAt === "string"
  ) {
    const previous = m.previousDueAt;
    const undo = once(() => patchDueAt(itemId, previous, queryClient));
    toast.success(label, {
      icon: ToastIcons.success,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () =>
          undo().then((ok) =>
            ok ? toast.success("Undone") : toast.error("Couldn't undo"),
          ),
      },
    });
  } else if (outcome.inverse === "reminder.delete") {
    const undo = once(async () => {
      const res = await safeFetch(`/api/items/${itemId}`, {
        method: "DELETE",
        timeoutMs: 8_000,
      });
      queryClient.invalidateQueries({ queryKey: qk.scheduleItems() });
      return res.ok;
    });
    toast.success(label, {
      icon: ToastIcons.success,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () =>
          undo().then((ok) =>
            ok ? toast.success("Undone") : toast.error("Couldn't undo"),
          ),
      },
    });
  }
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function once(fn: () => Promise<boolean>): () => Promise<boolean> {
  let ran = false;
  return async () => {
    if (ran) return false;
    ran = true;
    return fn();
  };
}

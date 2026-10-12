import { safeFetch } from "@/lib/safeFetch";
import type { QueryClient } from "@tanstack/react-query";
import {
  executePlan,
  type EraPlan,
  type EraPlanStepResult,
} from "../capabilities/plan";
import { applyCapabilityResult } from "../capabilities/applyResult";
import { eraKeys } from "../queryKeys";
import { useEraStore } from "../useEraStore";
import type { EraCapabilityResult } from "../capabilities/types";
import { effectiveActionSchema, type EffectiveAction } from "../capabilities/effectiveAction";
import {
  nextStep,
  runStatus,
  waitingContext,
  type EraRun,
  type RunCommand,
} from "./state";

export function cacheRun(qc: QueryClient, run: EraRun) {
  qc.setQueryData<EraRun[]>(
    eraKeys.runs(run.conversation_id, run.user_id),
    (old) => [run, ...(old ?? []).filter((r) => r.id !== run.id)],
  );
  qc.invalidateQueries({ queryKey: eraKeys.artifacts.all() });
}
export async function changeRun(
  run: EraRun,
  command: RunCommand,
  qc: QueryClient,
): Promise<EraRun> {
  const res = await safeFetch(`/api/era/runs/${run.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: run.version, command }),
    timeoutMs: 8_000,
  });
  if (!res.ok)
    throw new Error("Progress couldn't be saved. Refresh and resume.");
  const saved: EraRun = await res.json();
  cacheRun(qc, saved);
  return saved;
}
export async function createRun(
  plan: EraPlan,
  sourceText: string,
  text: string,
  conversationId: string,
  qc: QueryClient,
  requestDate?: string,
): Promise<EraRun> {
  const state = useEraStore.getState();
  const res = await safeFetch("/api/era/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    timeoutMs: 8_000,
    body: JSON.stringify({
      id: crypto.randomUUID(),
      conversationId,
      plan,
      sourceText,
      text,
      referenceDate: requestDate ?? new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      focus: state.focusEntities.find((e) => e.type === "reminder") ?? null,
    }),
  });
  if (!res.ok) throw new Error("Couldn't save the plan. Try again.");
  const saved: EraRun = await res.json();
  cacheRun(qc, saved);
  return saved;
}
export function activateRun(run: EraRun) {
  const context = waitingContext(run.state);
  useEraStore.setState({
    activeRunId: run.id,
    pendingTurn: context.pending,
    activeProposal:
      runStatus(run.state) === "awaiting_confirm"
        ? {
            kind: "propose_plan",
            plan: run.state.plan,
            sourceText: run.state.sourceText,
            text: run.state.text,
            requestContext: { ownerId: run.user_id, conversationId: run.conversation_id, referenceDate: run.state.referenceDate, timeZone: run.state.timeZone },
            consent: runConsent(run),
            resume: run.state.steps.filter(s => ["done", "skipped"].includes(s.status)).map(s => ({ id: s.id, capabilityId: run.state.plan.steps.find(p => p.id === s.id)!.capabilityId, status: s.status === "done" ? "done" : "skipped", result: s.result ?? { text: "Skipped" } })),
          }
        : context.proposal,
    eraReply: run.state.text,
  });
}
export function runConsent(run: EraRun): Record<string, EffectiveAction> {
  return Object.fromEntries(run.state.steps.flatMap(s => {
    const action = effectiveActionSchema.safeParse(s.result?.metadata?.effectiveAction);
    return action.success ? [[s.id, action.data]] : [];
  }));
}
export function cachedActiveRun(
  qc: QueryClient,
  conversationId: string | null,
): EraRun | null {
  const id = useEraStore.getState().activeRunId;
  const owner = qc.getQueryData<{ userId: string | null }>(
    eraKeys.household(),
  )?.userId;
  return (
    qc
      .getQueryData<EraRun[]>(eraKeys.runs(conversationId, owner))
      ?.find((r) => r.id === id) ?? null
  );
}
export function conversationStillActive(conversationId: string) {
  const explicit = useEraStore.getState().explicitConversation;
  return explicit === undefined || explicit === conversationId;
}
function isCurrent(run: EraRun, qc: QueryClient) {
  const store = useEraStore.getState();
  const owner = qc.getQueryData<{ userId: string | null }>(
    eraKeys.household(),
  )?.userId;
  return (
    store.activeRunId === run.id &&
    owner === run.user_id &&
    conversationStillActive(run.conversation_id)
  );
}
function assertCompatibleRun(run: EraRun) {
  if (run.state.schemaVersion !== 1)
    throw new Error("Update ERA before resuming this plan.");
  if (run.state.timeZone !== Intl.DateTimeFormat().resolvedOptions().timeZone)
    throw new Error(
      "Resume in the original time zone or revise the remaining request.",
    );
}

/** Only this wrapper dispatches a durable plan. Completed receipts are inputs,
 * not instructions to execute again. No work is queued/retried offline. */
export async function executeRun(
  input: EraRun,
  qc: QueryClient,
  confirm = false,
) {
  let run = input;
  assertCompatibleRun(run);
  if (confirm) run = await changeRun(run, { type: "confirm" }, qc);
  if (runStatus(run.state) !== "queued") {
    if (conversationStillActive(run.conversation_id)) activateRun(run);
    return null;
  }
  let attemptId = "";
  const resume: EraPlanStepResult[] = run.state.steps
    .filter((s) => ["done", "skipped"].includes(s.status))
    .map((s) => ({
      id: s.id,
      capabilityId: run.state.plan.steps.find((p) => p.id === s.id)!
        .capabilityId,
      status: s.status === "skipped" ? "skipped" : "done",
      result: s.result ?? { text: "Skipped" },
    }));
  const result = await executePlan(run.state.plan, {
    confirmed: run.state.confirmed,
    focus: run.state.focus,
    resume,
    referenceDate: new Date(run.state.referenceDate),
    consent: runConsent(run),
    beforeWrite: async () => {
      if (!isCurrent(run, qc)) throw new Error("Plan suspended. Resume from its conversation.");
    },
    beforeStep: async (step) => {
      if (!isCurrent(run, qc))
        throw new Error("Plan suspended. Resume from its conversation.");
      attemptId = crypto.randomUUID();
      run = await changeRun(
        run,
        { type: "begin", stepId: step.id, attemptId },
        qc,
      );
      if (!isCurrent(run, qc))
        throw new Error("Plan suspended. Resume from its conversation.");
    },
    onProgress: async (step, result) => {
      // Source data may already have changed even if the journal request fails.
      applyCapabilityResult(step.capabilityId, result, qc, {
        recordArtifacts: false,
        updateContext: false,
      });
      run = await changeRun(
        run,
        {
          type: "progress",
          stepId: step.id,
          attemptId,
          result: serializableResult(result),
        },
        qc,
      );
    },
    onStep: async (step) => {
      applyCapabilityResult(step.capabilityId, step.result, qc, {
        recordArtifacts: false,
        updateContext: false,
      });
      run = await changeRun(
        run,
        {
          type: "finish",
          stepId: step.id,
          attemptId,
          result: serializableResult(step.result),
        },
        qc,
      );
      // Persisted receipts own artifact logging. Continue cache/focus effects
      // only if the originating chat is still active.
      if (isCurrent(run, qc))
        applyCapabilityResult(step.capabilityId, step.result, qc, {
          recordArtifacts: false,
        });
    },
  });
  if (isCurrent(run, qc)) {
    activateRun(run);
    useEraStore.getState().setEraReply(result.text);
  }
  return result;
}

// JSON serialization removes optional undefined fields, not a second validator.
// API schemas validate the actual received result and reject function handoffs.
export function serializableResult(
  result: EraCapabilityResult,
): Extract<RunCommand, { type: "finish" }>["result"] {
  return JSON.parse(
    JSON.stringify({
      text: result.text,
      ok: result.ok,
      metadata: result.metadata,
      artifacts: result.artifacts,
      pending: result.pending,
      proposal: result.proposal,
      focus: result.focus,
    }),
  );
}

export async function beginAnswer(run: EraRun, qc: QueryClient) {
  assertCompatibleRun(run);
  const step = nextStep(run.state);
  if (!step || step.status !== "waiting")
    throw new Error("Question is no longer pending.");
  const attemptId = crypto.randomUUID();
  const saved = await changeRun(
    run,
    { type: "begin", stepId: step.id, attemptId, continuation: true },
    qc,
  );
  if (!isCurrent(saved, qc))
    throw new Error("Question suspended. Resume from its conversation.");
  return { run: saved, stepId: step.id, attemptId };
}
export async function finishAnswer(
  answer: Awaited<ReturnType<typeof beginAnswer>>,
  result: EraCapabilityResult,
  qc: QueryClient,
) {
  const step = answer.run.state.plan.steps.find((s) => s.id === answer.stepId);
  if (step)
    applyCapabilityResult(step.capabilityId, result, qc, {
      recordArtifacts: false,
      updateContext: false,
    });
  const saved = await changeRun(
    answer.run,
    {
      type: "finish",
      stepId: answer.stepId,
      attemptId: answer.attemptId,
      result: serializableResult(result),
    },
    qc,
  );
  if (isCurrent(saved, qc)) activateRun(saved);
  return saved;
}

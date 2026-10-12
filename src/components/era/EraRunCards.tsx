"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEraRuns } from "@/features/era/execution/useEraRuns";
import {
  activateRun,
  changeRun,
  executeRun,
  conversationStillActive,
  runConsent,
} from "@/features/era/execution/client";
import {
  DURABLE_EXECUTION,
  ATTEMPT_TIMEOUT_MS,
  nextStep,
  runStatus,
  type EraRun,
} from "@/features/era/execution/state";
import { useEraStore } from "@/features/era/useEraStore";
import { useCreateEraMessage } from "@/features/era/useEraConversation";
import { planOutcome } from "@/features/era/capabilities/plan";
import { getCapability } from "@/features/era/capabilities/registry";
import { eraArtifactHref } from "@/lib/era/artifacts";
import { eraKeys } from "@/features/era/queryKeys";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { EraActionPreview } from "./EraActionPreview";

const labels = {
  queued: "Ready",
  awaiting_confirm: "Confirm",
  running: "In progress",
  waiting: "Waiting",
  blocked: "Stopped",
  uncertain: "Check app",
  done: "Done",
  partial: "Partial",
  cancelled: "Stopped",
  skipped: "Skipped",
};

export function EraRunCards({
  conversationId,
  now,
}: {
  conversationId: string | null;
  now: number;
}) {
  const { data: runs, error } = useEraRuns(conversationId);
  const qc = useQueryClient();
  const createMessage = useCreateEraMessage();
  const tc = useThemeClasses();
  const busy = useEraStore((s) => s.turnInFlight || s.askingAI);
  const activeRunId = useEraStore((s) => s.activeRunId);
  const hasLiveContext = useEraStore((s) =>
    Boolean(s.pendingTurn || s.activeProposal),
  );
  const [failure, setFailure] = useState("");
  if (!DURABLE_EXECUTION) return null;
  const latestTerminal = (runs ?? []).find((r) =>
    ["done", "partial", "cancelled"].includes(runStatus(r.state)),
  );
  const visible = (runs ?? []).filter(
    (r) =>
      !["done", "partial", "cancelled"].includes(runStatus(r.state)) ||
      r.id === latestTerminal?.id,
  );
  const act = async (
    input: EraRun,
    action: "resume" | "confirm" | "recover" | "retry_read" | "skip" | "cancel",
  ) => {
    const store = useEraStore.getState();
    if (store.turnInFlight || store.askingAI) return;
    store.setTurnInFlight(true);
    setFailure("");
    try {
      let run = input;
      if (!["resume", "confirm"].includes(action))
        run = await changeRun(
          run,
          { type: action as "recover" | "retry_read" | "skip" | "cancel" },
          qc,
        );
      if (action === "cancel") {
        if (useEraStore.getState().activeRunId === run.id)
          useEraStore.setState({
            activeRunId: null,
            pendingTurn: null,
            activeProposal: null,
          });
        return;
      }
      if (!conversationStillActive(run.conversation_id)) return;
      activateRun(run);
      if (action === "resume" || action === "confirm") {
        const result = await executeRun(run, qc, action === "confirm");
        if (result)
          void createMessage
            .mutateAsync({
              conversation_id: run.conversation_id,
              role: "assistant",
              content: result.text,
              intent_payload: {
                runId: run.id,
                plan: run.state.plan,
                outcome: planOutcome(run.state.plan, result),
                artifacts: result.steps.flatMap(
                  (s) => s.result.artifacts ?? [],
                ),
              },
            })
            .catch(() => {});
      }
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Couldn't save progress.");
      qc.invalidateQueries({ queryKey: eraKeys.all });
    } finally {
      useEraStore.getState().setTurnInFlight(false);
    }
  };
  return (
    <div className="mt-4 space-y-3" aria-label="Agent progress">
      {(error || failure) && (
        <p role="status" className="text-[13px] text-white/60">
          {failure || "Couldn't load unfinished work."}
        </p>
      )}
      {visible.map((run) => {
        const status = runStatus(run.state);
        const step = nextStep(run.state);
        const interrupted =
          status === "running" &&
          now - (step?.startedAt ?? now) >= ATTEMPT_TIMEOUT_MS;
        const terminal = ["done", "partial", "cancelled"].includes(status);
        const liveCard =
          activeRunId === run.id &&
          hasLiveContext &&
          (status === "awaiting_confirm" || status === "waiting");
        const button = (text: string, action: Parameters<typeof act>[1]) => (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act(run, action)}
            className="min-h-10 rounded-full border border-white/15 px-3.5 text-[13px] text-white/80 disabled:opacity-40"
          >
            {text}
          </button>
        );
        const details = (
          <ol className="space-y-2 text-[13px] text-white/70">
            {run.state.plan.steps.map((s) => {
              const saved = run.state.steps.find((r) => r.id === s.id)!;
              return (
                <li key={s.id} className="break-words">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>{getCapability(s.capabilityId)?.confirmation?.title ?? getCapability(s.capabilityId)?.description ?? "Unavailable action"}</span>
                    <span className="text-white/40">
                      {labels[saved.status]}
                    </span>
                  </div>
                  {saved.result && (
                    <p className="mt-1 whitespace-pre-wrap">
                      {saved.result.text}
                    </p>
                  )}
                  {saved.result?.artifacts?.map((a) => (
                    <a
                      key={`${a.entity}:${a.id}:${a.action}`}
                      href={eraArtifactHref(a)}
                      className="mr-3 inline-block min-h-10 py-2 text-white/80 underline underline-offset-4"
                    >
                      {a.title}
                    </a>
                  ))}
                </li>
              );
            })}
          </ol>
        );
        return (
          <div
            key={run.id}
            className={`rounded-2xl border border-white/12 px-4 py-3 ${tc.bgPage}`}
          >
            {terminal ? (
              <details>
                <summary className="min-h-10 cursor-pointer break-words text-[13px] text-white/60">
                  {labels[status]} · {run.state.sourceText}
                </summary>
                {details}
              </details>
            ) : (
              <>
                <p className="mb-3 break-words text-[15px] text-white/90">
                  {run.state.sourceText}
                </p>
                {details}
                {status === "awaiting_confirm" && <EraActionPreview plan={run.state.plan} consent={runConsent(run)} referenceDate={run.state.referenceDate} timeZone={run.state.timeZone} completed={run.state.steps.filter(s => ["done", "skipped"].includes(s.status)).map(s => s.id)} />}
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {status !== "running" && button("Stop", "cancel")}
                  {["uncertain", "blocked", "waiting"].includes(status) &&
                    button("Skip", "skip")}
                  {interrupted && button("Recover", "recover")}
                  {status === "blocked" &&
                    getCapability(
                      run.state.plan.steps.find((s) => s.id === step?.id)!
                        .capabilityId,
                    )?.operation === "read" &&
                    button("Retry read", "retry_read")}
                  {!liveCard &&
                    status === "awaiting_confirm" &&
                    button("Confirm", "confirm")}
                  {!liveCard &&
                    (status === "queued" || status === "waiting") &&
                    button("Resume", "resume")}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

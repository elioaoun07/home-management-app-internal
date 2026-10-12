// One aggregate per plan. This is a progress journal, not an offline write queue.
import { z } from "zod";
import { eraArtifactSchema } from "@/lib/era/artifacts";
import { getCapability } from "../capabilities/registry";
import {
  planSchema,
  planNeedsConfirmation,
  type EraPlan,
} from "../capabilities/plan";
import type { EraCapabilityResult } from "../capabilities/types";
import type { EraPendingTurn, EraActiveProposal } from "../types";
import { effectiveActionSchema } from "../capabilities/effectiveAction";

export const DURABLE_EXECUTION =
  process.env.NEXT_PUBLIC_ERA_DURABLE_EXECUTION === "true";
export const ATTEMPT_TIMEOUT_MS = 120_000;
const jsonObject = z.record(z.string(), z.json());
const pendingSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("draftReminder"),
    title: z.string(),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    rawText: z.string(),
    createdAt: z.number(),
  }),
  z.object({
    kind: z.literal("slot"),
    capability: z.enum([
      "transfer.create",
      "reminder.pick",
      "reminder.scope",
      "recurring.link",
      "shopping.group",
      "amend.target",
      "event.when",
      "event.location",
      "place.save",
    ]),
    args: jsonObject,
    slot: z.string(),
    options: z.array(z.object({ label: z.string(), value: z.string() })),
    question: z.string(),
    rawText: z.string(),
    createdAt: z.number(),
  }),
]);
// Only the serializable native card used by a registered step's follow-up.
// Function-bearing handoffs never enter the execution journal.
const continuationSchema = z.object({
  kind: z.literal("native_action"),
  text: z.string(),
  action: z
    .object({
      type: z.literal("shoppingGroupCreate"),
      threadId: z.uuid(),
      name: z.string().min(1).max(100),
      messageIds: z.array(z.uuid()).min(1).max(50),
      previousGroupId: z.uuid().nullable(),
    })
    .strict(),
  sourceText: z.string(),
});
export const resultSchema = z
  .object({
    text: z.string().max(16000),
    ok: z.boolean().optional(),
    metadata: jsonObject.optional(),
    artifacts: z.array(eraArtifactSchema).max(200).optional(),
    pending: pendingSchema.nullable().optional(),
    proposal: continuationSchema.optional(),
    focus: z
      .object({
        id: z.string(),
        type: z.enum(["reminder", "shopping", "draft", "transfer_card"]),
        title: z.string(),
        addedAt: z.number(),
        meta: jsonObject.optional(),
      })
      .optional(),
  })
  .strict();
export type StepStatus =
  | "queued"
  | "running"
  | "done"
  | "waiting"
  | "blocked"
  | "uncertain"
  | "skipped";
export interface RunStep {
  id: string;
  status: StepStatus;
  result?: EraCapabilityResult;
  attemptId?: string;
  startedAt?: number;
}
export interface RunState {
  schemaVersion: 1;
  plan: EraPlan;
  sourceText: string;
  text: string;
  confirmed: boolean;
  cancelled: boolean;
  /** Calendar anchor supplied by the originating client; relative dates never drift on resume. */
  referenceDate: string;
  timeZone: string;
  steps: RunStep[];
  focus: import("../focusMemory").FocusEntity | null;
}
export interface EraRun {
  id: string;
  user_id: string;
  conversation_id: string;
  version: number;
  state: RunState;
  created_at: string;
  updated_at: string;
}
export const createRunSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    plan: planSchema,
    sourceText: z.string().min(1).max(4000),
    text: z.string().min(1).max(4000),
    referenceDate: z.iso.datetime(),
    timeZone: z.string().min(1).max(100),
    focus: z
      .object({
        id: z.string(),
        type: z.literal("reminder"),
        title: z.string(),
        addedAt: z.number(),
      })
      .nullable(),
  })
  .strict();
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("confirm") }),
  z.object({
    type: z.literal("begin"),
    stepId: z.string(),
    attemptId: z.uuid(),
    continuation: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("finish"),
    stepId: z.string(),
    attemptId: z.uuid(),
    result: resultSchema,
  }),
  z.object({
    type: z.literal("progress"),
    stepId: z.string(),
    attemptId: z.uuid(),
    result: resultSchema,
  }),
  z.object({ type: z.literal("recover") }),
  z.object({ type: z.literal("retry_read") }),
  z.object({ type: z.literal("skip") }),
  z.object({ type: z.literal("cancel") }),
]);
export type RunCommand = z.infer<typeof commandSchema>;

export function initialRun(input: z.infer<typeof createRunSchema>): RunState {
  return {
    schemaVersion: 1,
    plan: input.plan,
    sourceText: input.sourceText,
    text: input.text,
    referenceDate: input.referenceDate,
    timeZone: input.timeZone,
    focus: input.focus,
    confirmed: !planNeedsConfirmation(input.plan),
    cancelled: false,
    steps: input.plan.steps.map((s) => ({ id: s.id, status: "queued" })),
  };
}
export function nextStep(state: RunState): RunStep | undefined {
  return state.steps.find((s) => s.status !== "done" && s.status !== "skipped");
}
export function runStatus(state: RunState) {
  if (state.cancelled) return "cancelled";
  if (!state.confirmed) return "awaiting_confirm";
  const step = nextStep(state);
  return (
    step?.status ??
    (state.steps.some((s) => s.status === "skipped") ? "partial" : "done")
  );
}
export function resultStatus(
  capabilityId: string,
  result: EraCapabilityResult,
): StepStatus {
  if (effectiveActionSchema.safeParse(result.metadata?.effectiveAction).success) return "waiting";
  if (result.metadata?.completion === "failed" || result.metadata?.completion === "partial") return "blocked";
  if (result.metadata?.notDispatched === true) return "blocked";
  // Partial/unverified writes take precedence over a subsequent question/card.
  if (
    result.ok === false &&
    result.artifacts?.length &&
    result.metadata?.partial === true
  )
    return "uncertain";
  if (result.pending || result.proposal) return "waiting";
  if (result.ok === false || result.metadata?.found === false)
    return getCapability(capabilityId)?.operation === "read"
      ? "blocked"
      : "uncertain";
  if (
    getCapability(capabilityId)?.operation !== "read" &&
    !result.artifacts?.length
  )
    return "uncertain";
  return "done";
}
function mergeResult(
  previous: EraCapabilityResult | undefined,
  result: EraCapabilityResult,
): EraCapabilityResult {
  // Progress receipts are cumulative, continuation receipts may only contain the
  // final group move. Preserve earlier creates without multiplying them.
  const artifacts = new Map<
    string,
    NonNullable<EraCapabilityResult["artifacts"]>[number]
  >();
  for (const a of [...(previous?.artifacts ?? []), ...(result.artifacts ?? [])])
    artifacts.set(`${a.entity}:${a.id}:${a.action}`, a);
  return {
    ...result,
    metadata: { ...previous?.metadata, partial: false, effectiveAction: null, notDispatched: false, ...result.metadata },
    artifacts: [...artifacts.values()],
  };
}
/** Deterministic transition; CAS in PostgreSQL selects the one winning caller.
 * Reads never recover by writing. An explicit recover fences old attempts. */
export function transition(
  state: RunState,
  command: RunCommand,
  now: number,
): RunState {
  if (state.schemaVersion !== 1)
    throw new Error("Unsupported execution version");
  const next = structuredClone(state);
  const step = nextStep(next);
  const reject = () => {
    throw new Error("Execution changed. Refresh and resume.");
  };
  if (next.cancelled || !step) return reject();
  if (command.type === "cancel") {
    if (
      step.status === "running" &&
      now - (step.startedAt ?? now) < ATTEMPT_TIMEOUT_MS
    )
      return reject();
    next.cancelled = true;
    if (step.status === "running") {
      step.status = "uncertain";
      delete step.attemptId;
      delete step.startedAt;
    }
    return next;
  }
  if (command.type === "confirm") {
    if (next.confirmed) return reject();
    next.confirmed = true;
    if (step.status === "waiting" && effectiveActionSchema.safeParse(step.result?.metadata?.effectiveAction).success)
      step.status = "queued";
    return next;
  }
  if (!next.confirmed) return reject();
  const cap = getCapability(
    next.plan.steps.find((s) => s.id === step.id)!.capabilityId,
  );
  if (!cap) return reject();
  if (command.type === "recover") {
    if (
      step.status !== "running" ||
      now - (step.startedAt ?? now) < ATTEMPT_TIMEOUT_MS
    )
      return reject();
    step.status = cap.operation === "read" ? "queued" : "uncertain";
    delete step.attemptId;
    delete step.startedAt;
    next.text =
      cap.operation === "read"
        ? "Ready to resume."
        : "Check the app before continuing.";
  } else if (command.type === "retry_read") {
    if (step.status !== "blocked" || cap.operation !== "read") return reject();
    step.status = "queued";
    delete step.result;
  } else if (command.type === "skip") {
    if (!["waiting", "blocked", "uncertain"].includes(step.status))
      return reject();
    step.status = "skipped";
  } else if (command.type === "begin") {
    if (
      command.stepId !== step.id ||
      (command.continuation
        ? step.status !== "waiting"
        : step.status !== "queued")
    )
      return reject();
    step.status = "running";
    step.attemptId = command.attemptId;
    step.startedAt = now;
  } else {
    if (
      command.stepId !== step.id ||
      step.status !== "running" ||
      command.attemptId !== step.attemptId
    )
      return reject();
    const result = command.result as EraCapabilityResult;
    step.result = mergeResult(step.result, result);
    next.text = result.text;
    if (command.type === "progress") step.startedAt = now;
    if (command.type === "finish") {
      step.status = resultStatus(cap.id, step.result);
      if (effectiveActionSchema.safeParse(step.result.metadata?.effectiveAction).success) next.confirmed = false;
      delete step.attemptId;
      delete step.startedAt;
    }
  }
  return next;
}

/** Restore questions/cards only on explicit Resume; new requests can leave
 * an older run suspended without attaching its consent to a different turn. */
export function waitingContext(state: RunState): {
  pending: EraPendingTurn | null;
  proposal: EraActiveProposal | null;
} {
  const result = nextStep(state)?.result;
  return {
    pending: result?.pending ?? null,
    proposal: result?.proposal ?? null,
  };
}

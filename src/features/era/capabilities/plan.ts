// A bounded plan is data, never code or arbitrary HTTP. The registry is the
// only execution authority; every dependency is revalidated against real data.
import { z } from "zod";
import type { FocusEntity } from "../focusMemory";
import { resolveFocusRef } from "../focusMemory";
import { classifySpeechAct } from "../intents/speechAct";
import { getCapability } from "./registry";
import { inputSchema } from "./discovery";
import type { EraCapabilityResult } from "./types";
import type { EraOutcome } from "../types";
import { initialAction } from "./preview";
import { sameAction, waitingForConsent, type EffectiveAction } from "./effectiveAction";

export const MAX_PLAN_STEPS = 6;
const referenceSchema = z
  .object({ step: z.string().min(1), field: z.string().min(1) })
  .strict();
const stepSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
    capabilityId: z.string().min(1).max(80),
    label: z.string().trim().min(1).max(100),
    slots: z.record(z.string(), z.unknown()),
  })
  .strict();
export const planSchema = z
  .object({ steps: z.array(stepSchema).min(1).max(MAX_PLAN_STEPS) })
  .strict();
export type EraPlan = z.infer<typeof planSchema>;
export type EraPlanStep = EraPlan["steps"][number];
type Reference = z.infer<typeof referenceSchema>;
const forbidden = new Set(["__proto__", "prototype", "constructor"]);

function reference(value: unknown): Reference | null {
  const p = referenceSchema.safeParse(value);
  return p.success ? p.data : null;
}

/** Admission checks the WHOLE plan before any step may run. Literal slots
 * and dependency examples must satisfy the input schema. This is not a proof
 * that every possible output fits: execution preflights all actual consumers. */
export function validatePlan(
  input: unknown,
  focus?: FocusEntity | null,
  completedSteps: ReadonlySet<string> = new Set(),
): EraPlan | null {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return null;
  const earlier = new Map<string, EraPlanStep>();
  const steps: EraPlanStep[] = [];
  for (const step of parsed.data.steps) {
    const cap = getCapability(step.capabilityId);
    if (!cap || earlier.has(step.id) || (cap.operation !== "read" && !cap.confirmation)) return null;
    // Only executePlan's durable receipts grant this exemption. These steps
    // will be skipped; a completed pronoun must not expire the rest of a run.
    if (completedSteps.has(step.id)) {
      earlier.set(step.id, step);
      steps.push(step);
      continue;
    }
    const slots: Record<string, unknown> = {};
    const samples: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(step.slots)) {
      if (forbidden.has(key)) return null;
      const ref = reference(value);
      if (ref) {
        const source = earlier.get(ref.step);
        const sourceCap = source && getCapability(source.capabilityId);
        const declared = sourceCap?.outputs;
        const output =
          declared && Object.hasOwn(declared, ref.field)
            ? declared[ref.field]
            : undefined;
        if (!output || forbidden.has(ref.field)) return null;
        if (
          key === cap.entityRefSlot &&
          (!cap.referenceSource ||
            sourceCap?.entity !== cap.referenceSource.entity ||
            ref.field !== cap.referenceSource.field)
        )
          return null;
        slots[key] = ref;
        samples[key] = output.example;
      } else {
        if (key === cap.entityRefSlot) {
          if (value !== "FOCUS" || cap.entity !== "reminder") return null;
          const resolved = resolveFocusRef(
            "it",
            "reminder",
            focus ? [focus] : [],
          );
          if (!resolved) return null;
          slots[key] = resolved.id;
        } else slots[key] = value;
        samples[key] = slots[key];
      }
    }
    if (
      cap.entity === "reminder" &&
      cap.entityRefSlot &&
      typeof slots[cap.entityRefSlot] === "string" &&
      focus
    ) {
      slots.title = focus.title;
      samples.title = focus.title;
    }
    // Unknown slots must fail rather than being silently stripped by Zod.
    const schema = inputSchema(cap);
    if (!schema.safeParse(samples).success) return null;
    const admitted = { ...step, slots };
    earlier.set(step.id, admitted);
    steps.push(admitted);
  }
  return { steps };
}

export function planNeedsConfirmation(plan: EraPlan): boolean {
  return plan.steps.some(
    (s) => getCapability(s.capabilityId)?.operation !== "read",
  );
}

/** Same speech-act gate as native writes. Model interpretation grants no
 * new authority for negated, hypothetical or reported instructions. */
export function planAllowedForRequest(plan: EraPlan, text: string): boolean {
  if (!planNeedsConfirmation(plan)) return true;
  const moneyWrite = plan.steps.some((step) => {
    const cap = getCapability(step.capabilityId);
    return cap?.entity === "transaction" && cap.operation !== "read";
  });
  return classifySpeechAct(text, { strict: moneyWrite }) === "command";
}

export interface EraPlanStepResult {
  id: string;
  capabilityId: string;
  status: "done" | "blocked" | "failed" | "uncertain" | "pending" | "skipped";
  result: EraCapabilityResult;
}
export interface EraPlanResult {
  status: "done" | "stopped";
  text: string;
  steps: EraPlanStepResult[];
}

/** Inspect every uncompleted consumer, including bindings in saved receipts. */
function dependencyOutputsFit(
  plan: EraPlan,
  source: EraPlanStep,
  result: EraCapabilityResult,
  completed: ReadonlySet<string>,
): boolean {
  const cap = getCapability(source.capabilityId);
  return plan.steps.filter((step) => !completed.has(step.id)).every((consumer) =>
    Object.entries(consumer.slots).every(([key, value]) => {
      const ref = reference(value);
      if (ref?.step !== source.id) return true;
      const actual = result.metadata?.[ref.field];
      if (!cap?.outputs?.[ref.field]?.schema.safeParse(actual).success) return false;
      const target = getCapability(consumer.capabilityId)?.slots;
      return target instanceof z.ZodObject && Object.hasOwn(target.shape, key) &&
        target.shape[key].safeParse(actual).success;
    }),
  );
}

/** Use the existing outcome vocabulary so Report and future learning gates
 * see a verified result, rather than a second success/telemetry system. */
export function planOutcome(plan: EraPlan, run: EraPlanResult): EraOutcome {
  const artifacts = run.steps.flatMap((s) => s.result.artifacts ?? []);
  const last = run.steps.at(-1);
  const status = run.steps.some((s) => s.status === "uncertain")
    ? "uncertain"
    : run.steps.some((s) => s.status === "skipped")
      ? "partial"
      : run.status === "done"
        ? planNeedsConfirmation(plan)
          ? "done"
          : "answered"
        : last?.result.metadata?.effectiveAction
          ? "awaiting_confirm"
          : last?.status === "pending"
          ? "needs_input"
          : artifacts.length
            ? "partial"
            : last?.status === "uncertain"
              ? "uncertain"
              : "failed";
  return {
    status,
    capability: "agent.plan",
    entityIds: artifacts
      .map((a) => a.id)
      .filter((id): id is string => typeof id === "string"),
    inverse: null,
  };
}

/** Consume once in the UI before calling. No automatic retries, rollbacks
 * or continuation after a failure: completed steps are real application facts. */
export async function executePlan(
  plan: EraPlan,
  opts: {
    confirmed: boolean;
    focus?: FocusEntity | null;
    onStep?: (step: EraPlanStepResult) => void | Promise<void>;
    beforeStep?: (step: EraPlanStep) => Promise<void>;
    beforeWrite?: () => Promise<void>;
    resume?: EraPlanStepResult[];
    referenceDate?: Date;
    /** Consent snapshots are data shown on the card, never model descriptions. */
    consent?: Record<string, EffectiveAction>;
    onProgress?: (
      step: EraPlanStep,
      result: EraCapabilityResult,
    ) => Promise<void>;
  },
): Promise<EraPlanResult> {
  const stop = (steps: EraPlanStepResult[], text: string): EraPlanResult => ({
    status: "stopped",
    steps,
    text,
  });
  if (planNeedsConfirmation(plan) && !opts.confirmed)
    return stop([], "Confirm the plan first.");
  // Re-admit at execution. Previously resolved focus IDs must still be the
  // current live focus; leave dependencies symbolic until their step returns.
  const rebound: EraPlan = {
    steps: plan.steps.map((s) => {
      const cap = getCapability(s.capabilityId);
      const slots = { ...s.slots };
      if (cap?.entityRefSlot && typeof slots[cap.entityRefSlot] === "string") {
        if (slots[cap.entityRefSlot] !== opts.focus?.id) return s;
        slots[cap.entityRefSlot] = "FOCUS";
      }
      return { ...s, slots };
    }),
  };
  if (
    !validatePlan(
      rebound,
      opts.focus,
      new Set(
        opts.resume
          ?.filter((s) => ["done", "skipped"].includes(s.status))
          .map((s) => s.id),
      ),
    )
  ) {
    const text = "That plan is no longer valid. Revise the remaining request.";
    const first = plan.steps.find(
      (s) => !opts.resume?.some((r) => r.id === s.id),
    );
    if (first && opts.beforeStep && getCapability(first.capabilityId)) {
      await opts.beforeStep(first);
      const receipt: EraPlanStepResult = {
        id: first.id,
        capabilityId: first.capabilityId,
        status: "blocked",
        result: { text, ok: false, metadata: { notDispatched: true } },
      };
      await opts.onStep?.(receipt);
      return stop([...(opts.resume ?? []), receipt], text);
    }
    return stop(opts.resume ?? [], text);
  }

  const steps: EraPlanStepResult[] = [];
  const outputs = new Map<string, Record<string, unknown>>();
  const blocked = async (step: EraPlanStep, text: string) => {
    const receipt: EraPlanStepResult = {
      id: step.id,
      capabilityId: step.capabilityId,
      status: "blocked",
      result: { ok: false, text, metadata: { notDispatched: true } },
    };
    steps.push(receipt);
    await opts.onStep?.(receipt);
    return stop(steps, steps.map((s) => s.result.text).join("\n"));
  };
  const completed = new Set(opts.resume?.filter((saved) =>
    ["done", "skipped"].includes(saved.status),
  ).map((saved) => saved.id));
  const invalidSavedOutput = opts.resume?.some((saved) => {
    const source = plan.steps.find((step) => step.id === saved.id);
    return saved.status === "done" && source &&
      !dependencyOutputsFit(plan, source, saved.result, completed);
  });
  for (const step of plan.steps) {
    const saved = opts.resume?.find((s) => s.id === step.id);
    if (saved) {
      if (
        saved.capabilityId !== step.capabilityId ||
        !["done", "skipped"].includes(saved.status)
      )
        return stop(steps, "This step needs attention before resuming.");
      steps.push(saved);
      if (saved.status === "done")
        outputs.set(step.id, saved.result.metadata ?? {});
      continue;
    }
    await opts.beforeStep?.(step);
    if (invalidSavedOutput)
      return blocked(step, "Saved prerequisite data is missing or incompatible. Revise the request.");
    const cap = getCapability(step.capabilityId)!;
    const slots: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(step.slots)) {
      const ref = reference(value);
      if (ref) {
        const actual = outputs.get(ref.step)?.[ref.field];
        const source = plan.steps.find((s) => s.id === ref.step)!;
        const declared = getCapability(source.capabilityId)?.outputs;
        const output =
          declared && Object.hasOwn(declared, ref.field)
            ? declared[ref.field]
            : undefined;
        const p = output?.schema.safeParse(actual);
        if (!p?.success)
          return blocked(step, `${step.label}: prerequisite unavailable.`);
        slots[key] = p.data;
      } else slots[key] = value;
    }
    if (cap.entity === "reminder" && cap.entityRefSlot) {
      const target = reference(step.slots[cap.entityRefSlot]);
      const title = target
        ? outputs.get(target.step)?.title
        : opts.focus?.title;
      if (typeof title === "string") slots.title = title;
    }
    const parsed = inputSchema(cap).safeParse(slots);
    if (!parsed.success) return blocked(step, `${step.label}: invalid input.`);
    let result: EraCapabilityResult;
    let threw = false;
    try {
      const referenceDate = opts.referenceDate ?? new Date();
      const approved = opts.consent?.[step.id] ?? initialAction(step, referenceDate);
      const actual = initialAction({ ...step, slots: parsed.data as Record<string, unknown> }, referenceDate);
      if (cap.operation !== "read" && (opts.referenceDate || opts.consent) && !cap.confirmation?.resolveAtWrite && !sameAction(approved, actual)) {
        result = waitingForConsent(actual);
      } else {
        if (cap.operation !== "read" && !cap.confirmation?.resolveAtWrite) await opts.beforeWrite?.();
        result =
        opts.referenceDate || opts.onProgress || opts.consent
          ? await cap.execute(parsed.data, {
              referenceDate: opts.referenceDate,
              beforeWrite: async (actual) => {
                // Recheck owner/chat after source reads, immediately before dispatch.
                await opts.beforeWrite?.();
                return sameAction(approved, actual);
              },
              onProgress: opts.onProgress
                ? (result) => opts.onProgress!(step, result)
                : undefined,
            })
          : await cap.execute(parsed.data);
      }
    } catch {
      threw = true;
      result = {
        ok: false,
        text:
          cap.operation === "read"
            ? "Couldn't read that."
            : "Couldn't verify that action. Check the app before retrying.",
      };
    }
    // Validate ALL consumers of this receipt immediately. Checking a binding
    // only at its destination could commit an intervening meal before learning
    // that the same recipe's shopping ingredients are missing or invalid.
    if (result.ok !== false && !result.pending && !result.proposal && result.metadata?.found !== false) {
      if (!dependencyOutputsFit(plan, step, result, completed)) result = {
        ...result,
        ok: false,
        text: `${step.label}: prerequisite data is missing or incompatible.`,
      };
    }
    if (
      cap.operation !== "read" &&
      result.ok !== false &&
      !result.pending &&
      !result.proposal &&
      !result.artifacts?.length
    ) {
      result = {
        ...result,
        ok: false,
        text: "Couldn't verify that action. Check the app before retrying.",
      };
    }
    const status: EraPlanStepResult["status"] =
      result.metadata?.effectiveAction
        ? "pending"
        : result.metadata?.completion === "failed" || result.metadata?.completion === "partial"
          ? "failed"
        : result.metadata?.notDispatched === true
        ? "blocked"
        : result.ok === false &&
            result.artifacts?.length &&
            result.metadata?.partial === true
          ? "uncertain"
          : result.pending || result.proposal
            ? "pending"
            : result.ok === false
              ? cap.operation === "read"
                ? "blocked"
                : "uncertain"
              : result.metadata?.found === false
                ? "blocked"
                : "done";
    const receipt = {
      id: step.id,
      capabilityId: cap.id,
      status: threw && cap.operation === "read" ? ("failed" as const) : status,
      result,
    };
    steps.push(receipt);
    await opts.onStep?.(receipt);
    if (status !== "done")
      return stop(steps, steps.map((s) => s.result.text).join("\n"));
    outputs.set(step.id, result.metadata ?? {});
  }
  return {
    status: "done",
    text: steps.map((s) => s.result.text).join("\n"),
    steps,
  };
}

/** Detect explicit compound instructions before a single-action native
 * parser can consume only the first half. Entity lists (milk and eggs) stay native. */
export function needsAgentPlan(text: string): boolean {
  // Introspection is a registered read, rather than a router vocabulary miss
  // or an implicit navigation door swallowing "what can ERA do in Trips?".
  if (/\b(?:what|which)\s+(?:can\s+(?:you|era)\s+do|(?:features|capabilities|modules|functionality)\b)/i.test(text))
    return true;
  if (
    /\b(?:ingredients|everything for)\b/i.test(text) &&
    /\b(?:shopping|grocery|groceries)\b/i.test(text)
  )
    return true;
  return /(?:\band\b|\bthen\b|[;.]|\balso\b)\s+(?:(?:please|then)\s+)?(?:add|put|plan|assign|schedule|remind|move|reschedule|delete|remove|find|look up|show|tell|save|remember|check|list|mark)\b/i.test(
    text,
  );
}

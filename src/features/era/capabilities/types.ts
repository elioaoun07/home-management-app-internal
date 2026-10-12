// src/features/era/capabilities/types.ts
// ERA Stage 1 — Layer 4: the capability registry.
//
// A capability is NOT new business logic. It is a typed wrapper around
// functionality the application already has (an existing API route, an
// existing resolver) — see `registry.ts`. The registry exists so a later
// layer (Ask AI, Stage 3) can enumerate what ERA is actually allowed to do
// and validate a proposed action's slots against a real schema BEFORE it
// executes, instead of trusting a model to invent both the action and its
// shape. The built-in deterministic routers (Layer 1/2) call the resolvers
// directly and do not need to go through this registry — it becomes load-
// bearing once Ask AI starts producing structured proposals against it.

import type { EraArtifact } from "@/lib/era/artifacts";
import type { z } from "zod";

/** The application domains ERA can act on. Grows as new capabilities are added. */
export type EraEntityType =
  | "reminder"
  | "schedule"
  | "transaction"
  | "recipe"
  | "meal"
  | "shopping"
  | "application"
  | "memory";

/** Evidence for integration/coverage only. Never grants arbitrary HTTP or SQL. */
export type EraCapabilitySource =
  | { kind: "api"; path: string; methods: ("GET" | "POST" | "PATCH" | "PUT" | "DELETE")[] }
  | { kind: "rpc"; name: string };

export type EraCapabilityOperation =
  | "read"
  | "create"
  | "update"
  | "complete"
  | "delete";

export interface EraCapabilityResult {
  text: string;
  metadata?: Record<string, unknown>;
  /**
   * Explicit success signal — absent (or `true`) means success; `false`
   * means the wrapped resolver returned a graceful error reply rather than
   * throwing. Mirrors `ResolveResult.ok` (resolveIntent.ts) since every
   * `execute()` below forwards a resolver's return value verbatim. Read by
   * `useEraAskAI.confirmProposal` (HUB-34) to decide whether this execution
   * is worth teaching as a template — a phrasing that didn't actually work
   * must never get memorized as if it did.
   */
  ok?: boolean;
  /** Forwarded from the wrapped resolver (src/lib/era/artifacts.ts). */
  artifacts?: EraArtifact[];
  pending?: import("../types").EraPendingTurn | null;
  proposal?: import("../types").EraActiveProposal;
  focus?: import("../focusMemory").FocusEntity;
}

export interface EraExecutionContext {
  referenceDate?: Date;
  beforeWrite?: import("./effectiveAction").BeforeWrite;
  /** Awaited after each internal write, before another may dispatch. */
  onProgress?: (result: EraCapabilityResult) => Promise<void>;
}

export interface EraCapability<TSlots = unknown> {
  /** Stable id, e.g. "reminder.reschedule". Never user-facing. */
  id: string;
  entity: EraEntityType;
  operation: EraCapabilityOperation;
  /** Reviewed confirmation vocabulary; never taken from model prose. */
  confirmation?: {
    title: string;
    fields: Record<string, string>;
    resolveAtWrite?: boolean;
    initialValues?: (slots: Record<string, unknown>, referenceDate: Date) => Record<string, unknown>;
  };
  /** Feature Index owner and purpose; discovery is generated from these. */
  module: string;
  description: string;
  sources: EraCapabilitySource[];
  /** Semantic limits that cannot be expressed by an input schema. */
  constraints?: string[];
  /** Validates a proposed action's slots before `execute` ever runs. */
  slots: z.ZodType<TSlots>;
  /** True for an action a bad proposal could meaningfully hurt (deletes). */
  destructive?: boolean;
  /**
   * When set, names the slot key that identifies a SPECIFIC existing entity
   * (e.g. "itemId"). A model or a taught template is never trusted to supply
   * this directly — callers resolve it server/client-side via focus memory
   * (`resolveFocusRef`) before validation, the same "never guess when
   * ambiguous" rule focusMemory.ts already enforces. Absent for capabilities
   * that create or read rather than act on one known entity.
   */
  entityRefSlot?: string;
  /** Safe dependency outputs. Example checks slot compatibility at admission;
   * actual data must fit EVERY receiving slot before later steps may run. */
  outputs?: Record<string, { schema: z.ZodType; example: unknown }>;
  /** Allow entity references only from matching domain outputs. */
  referenceSource?: { entity: EraEntityType; field: string };
  /** Wraps the existing application code path — never reimplements it. */
  execute(
    slots: TSlots,
    context?: EraExecutionContext,
  ): Promise<EraCapabilityResult>;
}

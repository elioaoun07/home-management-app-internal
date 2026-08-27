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

import type { z } from "zod";

/** The application domains ERA can act on. Grows as new capabilities are added. */
export type EraEntityType = "reminder" | "schedule";

export type EraCapabilityOperation =
  | "read"
  | "create"
  | "update"
  | "complete"
  | "delete";

export interface EraCapabilityResult {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface EraCapability<TSlots = unknown> {
  /** Stable id, e.g. "reminder.reschedule". Never user-facing. */
  id: string;
  entity: EraEntityType;
  operation: EraCapabilityOperation;
  /** Validates a proposed action's slots before `execute` ever runs. */
  slots: z.ZodType<TSlots>;
  /** True for an action a bad proposal could meaningfully hurt (deletes). */
  destructive?: boolean;
  /**
   * Short, human/model-readable description of this capability's slot
   * shape — used ONLY to build the Ask AI prompt (Stage 3) so Gemini knows
   * what fields to fill. Never consumed by the deterministic router or by
   * validation itself; the Zod schema above is the actual contract.
   */
  promptSlots: string;
  /**
   * When set, names the slot key that identifies a SPECIFIC existing entity
   * (e.g. "itemId"). A model or a taught template is never trusted to supply
   * this directly — callers resolve it server/client-side via focus memory
   * (`resolveFocusRef`) before validation, the same "never guess when
   * ambiguous" rule focusMemory.ts already enforces. Absent for capabilities
   * that create or read rather than act on one known entity.
   */
  entityRefSlot?: string;
  /** Wraps the existing application code path — never reimplements it. */
  execute(slots: TSlots): Promise<EraCapabilityResult>;
}

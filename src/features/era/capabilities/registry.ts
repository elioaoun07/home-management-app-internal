// src/features/era/capabilities/registry.ts
// ERA Stage 1 — the actual catalog. Each entry wraps an existing resolver
// (which itself wraps an existing API route) — see types.ts's module doc
// for why this layer exists. Expose the most useful existing actions first;
// grow this list from real usage, not speculatively.

import { z } from "zod";
import { resolveMemoryRecall, resolveMemorySave } from "../intents/resolvers/brain";
import {
  resolveConfirmDraft,
  resolveListDrafts,
  resolveMonthSpend,
} from "../intents/resolvers/budget";
import {
  resolveAssignMeal,
  resolveListRecipes,
  resolveRecipeSearch,
} from "../intents/resolvers/chef";
import {
  resolveDraftReminder,
  resolveReminderComplete,
  resolveReminderDelete,
  resolveReminderReschedule,
  resolveScheduleForDay,
} from "../intents/resolvers/schedule";
import type { FaceKey } from "../types";
import type { EraCapability, EraEntityType } from "./types";

const scheduleForDay: EraCapability<{ dateISO?: string }> = {
  id: "schedule.forDay",
  entity: "schedule",
  operation: "read",
  slots: z.object({
    dateISO: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "expected yyyy-MM-dd")
      .optional(),
  }),
  promptSlots: "dateISO (optional, yyyy-MM-dd — omit for today)",
  execute: (slots) => resolveScheduleForDay(slots.dateISO),
};

const reminderCreate: EraCapability<{ rawText: string; title?: string }> = {
  id: "reminder.create",
  entity: "reminder",
  operation: "create",
  slots: z.object({
    rawText: z.string().min(1),
    title: z.string().min(1).optional(),
  }),
  promptSlots:
    "rawText (the user's request, verbatim — the app's own date parser reads it), title (optional, cleaned)",
  execute: (slots) => resolveDraftReminder(slots.rawText, slots.title),
};

const reminderReschedule: EraCapability<{
  itemId: string;
  whenText: string;
  title?: string;
}> = {
  id: "reminder.reschedule",
  entity: "reminder",
  operation: "update",
  slots: z.object({
    itemId: z.string().min(1),
    whenText: z.string().min(1),
    title: z.string().min(1).optional(),
  }),
  promptSlots:
    'itemId (identifies WHICH reminder — see the entity-reference rule below, never invent one), whenText (free text for the new day/time, e.g. "tomorrow at 5" or "11")',
  entityRefSlot: "itemId",
  execute: (slots) =>
    resolveReminderReschedule(slots.itemId, slots.title ?? null, slots.whenText),
};

const reminderComplete: EraCapability<{ itemId: string; title?: string }> = {
  id: "reminder.complete",
  entity: "reminder",
  operation: "complete",
  slots: z.object({
    itemId: z.string().min(1),
    title: z.string().min(1).optional(),
  }),
  promptSlots: "itemId (identifies WHICH reminder — see the entity-reference rule below)",
  entityRefSlot: "itemId",
  execute: (slots) => resolveReminderComplete(slots.itemId, slots.title ?? null),
};

const reminderDelete: EraCapability<{ itemId: string; title?: string }> = {
  id: "reminder.delete",
  entity: "reminder",
  operation: "delete",
  destructive: true,
  slots: z.object({
    itemId: z.string().min(1),
    title: z.string().min(1).optional(),
  }),
  promptSlots: "itemId (identifies WHICH reminder — see the entity-reference rule below)",
  entityRefSlot: "itemId",
  execute: (slots) => resolveReminderDelete(slots.itemId, slots.title ?? null),
};

// ─────────────────────────────── Stage D (plan) ───────────────────────────────
// Widens the registry past reminder/schedule so a taught template (HUB-30)
// can point at more of the app than five reminder actions. Each entry below
// wraps an existing resolver exactly like the five above — no new business
// logic, no new balance math (money-rules: `spend.month`/`draft.*` are reads
// or a status flip on an already-computed draft, never new money math).
//
// `transaction.draft` (log a new spend via chat) is DELIBERATELY NOT here —
// `resolveDraftTransaction` (resolvers/budget.ts) needs `useEraBudgetSubmit`,
// a React hook bound to the user's accounts/categories/query client
// (resolveIntent.ts's `ResolveDeps`, on purpose, keeps that out of any
// module-level singleton). Wiring a hook's live function into a plain
// `execute(slots)` call would mean either a stale closure or a new
// imperative-ref pattern for money-writing code — out of scope for widening
// the registry; revisit only with a specific need and its own review.

const spendMonth: EraCapability<{
  scope: "self" | "partner" | "household";
  categoryHint?: string;
}> = {
  id: "spend.month",
  entity: "transaction",
  operation: "read",
  slots: z.object({
    scope: z.enum(["self", "partner", "household"]),
    categoryHint: z.string().min(1).max(60).optional(),
  }),
  promptSlots: 'scope ("self" | "partner" | "household"), categoryHint (optional, e.g. "groceries")',
  execute: (slots) => resolveMonthSpend(slots.scope, slots.categoryHint),
};

const draftList: EraCapability<Record<string, never>> = {
  id: "draft.list",
  entity: "transaction",
  operation: "read",
  slots: z.object({}),
  promptSlots: "(no slots)",
  execute: () => resolveListDrafts(),
};

const draftConfirm: EraCapability<{ hint?: string }> = {
  id: "draft.confirm",
  entity: "transaction",
  operation: "update",
  slots: z.object({ hint: z.string().min(1).max(80).optional() }),
  promptSlots:
    "hint (optional — a word from the draft's description or category to disambiguate; omit for the most recent pending draft)",
  execute: (slots) => resolveConfirmDraft(slots.hint),
};

const recipeSearch: EraCapability<{ dish: string }> = {
  id: "recipe.search",
  entity: "recipe",
  operation: "read",
  slots: z.object({ dish: z.string().min(1).max(80) }),
  promptSlots: "dish (the recipe name to search for)",
  execute: (slots) => resolveRecipeSearch(slots.dish),
};

const recipeList: EraCapability<Record<string, never>> = {
  id: "recipe.list",
  entity: "recipe",
  operation: "read",
  slots: z.object({}),
  promptSlots: "(no slots)",
  execute: () => resolveListRecipes(),
};

const mealAssign: EraCapability<{
  dish: string;
  dayHint: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
}> = {
  id: "meal.assign",
  entity: "meal",
  operation: "create",
  slots: z.object({
    dish: z.string().min(1).max(80),
    dayHint: z.string().min(1).max(40),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  }),
  promptSlots:
    'dish (recipe name), dayHint (free text day, e.g. "tomorrow" or "Friday"), mealType (optional: breakfast|lunch|dinner|snack, default lunch)',
  execute: (slots) => resolveAssignMeal(slots.dish, slots.dayHint, slots.mealType),
};

const memorySave: EraCapability<{ label: string; value: string }> = {
  id: "memory.save",
  entity: "memory",
  operation: "create",
  slots: z.object({
    label: z.string().min(1).max(80),
    value: z.string().min(1).max(500),
  }),
  promptSlots: "label (what to call it), value (the thing to remember)",
  execute: (slots) => resolveMemorySave(slots.label, slots.value),
};

const memoryRecall: EraCapability<{ query: string }> = {
  id: "memory.recall",
  entity: "memory",
  operation: "read",
  slots: z.object({ query: z.string().min(1).max(80) }),
  promptSlots: "query (what to look up)",
  execute: (slots) => resolveMemoryRecall(slots.query),
};

/**
 * The full catalog, keyed by id. `reminder.setRecurrence` from the design
 * doc is deliberately NOT here yet — the doc's own caveat is "only if the
 * backend already supports it", and updating a recurrence rule via chat
 * needs occurrence-aware handling this session didn't build (see
 * `resolveReminderComplete`'s recurring-item guard for why that's not a
 * small addition). See the Stage D comment above for why `transaction.draft`
 * is the one budget action still missing.
 */
export const ERA_CAPABILITIES: Record<string, EraCapability<unknown>> = {
  [scheduleForDay.id]: scheduleForDay,
  [reminderCreate.id]: reminderCreate,
  [reminderReschedule.id]: reminderReschedule,
  [reminderComplete.id]: reminderComplete,
  [reminderDelete.id]: reminderDelete,
  [spendMonth.id]: spendMonth,
  [draftList.id]: draftList,
  [draftConfirm.id]: draftConfirm,
  [recipeSearch.id]: recipeSearch,
  [recipeList.id]: recipeList,
  [mealAssign.id]: mealAssign,
  [memorySave.id]: memorySave,
  [memoryRecall.id]: memoryRecall,
};

export function getCapability(id: string): EraCapability<unknown> | undefined {
  return ERA_CAPABILITIES[id];
}

/** Which ERA face owns a given capability's entity. */
const ENTITY_FACE: Record<EraEntityType, FaceKey> = {
  reminder: "schedule",
  schedule: "schedule",
  transaction: "budget",
  recipe: "chef",
  meal: "chef",
  memory: "brain",
};

export function entityFace(entity: EraEntityType): FaceKey {
  return ENTITY_FACE[entity];
}

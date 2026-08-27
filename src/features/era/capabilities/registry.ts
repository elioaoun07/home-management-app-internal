// src/features/era/capabilities/registry.ts
// ERA Stage 1 — the actual catalog. Each entry wraps an existing resolver
// (which itself wraps an existing API route) — see types.ts's module doc
// for why this layer exists. Expose the most useful existing actions first;
// grow this list from real usage, not speculatively.

import { z } from "zod";
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

/**
 * The full catalog, keyed by id. `reminder.setRecurrence` from the design
 * doc is deliberately NOT here yet — the doc's own caveat is "only if the
 * backend already supports it", and updating a recurrence rule via chat
 * needs occurrence-aware handling this session didn't build (see
 * `resolveReminderComplete`'s recurring-item guard for why that's not a
 * small addition). `transaction.*`, `recipe.*`, `mealPlan.*` similarly wait
 * until a real conversational need for THEM (not the Budget/Chef intents
 * that already exist and don't need a registry wrapper yet).
 */
export const ERA_CAPABILITIES: Record<string, EraCapability<unknown>> = {
  [scheduleForDay.id]: scheduleForDay,
  [reminderCreate.id]: reminderCreate,
  [reminderReschedule.id]: reminderReschedule,
  [reminderComplete.id]: reminderComplete,
  [reminderDelete.id]: reminderDelete,
};

export function getCapability(id: string): EraCapability<unknown> | undefined {
  return ERA_CAPABILITIES[id];
}

/** Which ERA face owns a given capability's entity — schedule and reminder both live on the Schedule face today. */
const ENTITY_FACE: Record<EraEntityType, FaceKey> = {
  reminder: "schedule",
  schedule: "schedule",
};

export function entityFace(entity: EraEntityType): FaceKey {
  return ENTITY_FACE[entity];
}

// src/lib/era/artifacts.ts
// The ERA Artifact contract — "ERA using the app's functionality" leaves a
// trace. Every ERA write (create / update / delete) returns `artifacts` from
// its adapter; one pipeline (src/features/era/recordArtifacts.ts) logs them to
// era_actions (the Artifacts tab) and onto the assistant message (so the
// Activity Log's ERA row opens the item, not /era).
//
// Adding a feature = one adapter returning `eraArtifact(...)` with an entity
// listed here. Adding an entity = one row below. Deep links are built HERE
// from the entity + id, never from captured text, so era_actions.route and
// the Activity Log share one source of truth.
//
// Pure module (no React, no fetch): imported by client code and API routes.

import { z } from "zod";

export const ERA_ARTIFACT_ACTIONS = ["created", "updated", "deleted"] as const;
export type EraArtifactAction = (typeof ERA_ARTIFACT_ACTIONS)[number];

/** Optional, validated context a deep link needs (never free text). */
export interface EraArtifactRef {
  /** yyyy-MM-dd — the day view that holds the item (Schedule). */
  date?: string;
  /** Hub thread id (shopping list rows). */
  thread?: string;
}

interface EntitySpec {
  label: string;
  href: (id: string | null, action: EraArtifactAction, ref: EraArtifactRef) => string;
}

const RECYCLE_BIN = "/recycle-bin";
const enc = encodeURIComponent;

/** Soft-deleted rows live in the Recycle Bin; anything else opens the item. */
const itemOr = (open: (id: string, ref: EraArtifactRef) => string, home: string) =>
  (id: string | null, action: EraArtifactAction, ref: EraArtifactRef) =>
    action === "deleted" ? RECYCLE_BIN : id ? open(id, ref) : home;

const thread = (ref: EraArtifactRef) => (ref.thread ? `/chat?thread=${enc(ref.thread)}` : "/chat");

export const ERA_ARTIFACT_ENTITIES = {
  reminder: {
    label: "Reminder",
    href: itemOr((id, ref) => `/reminders?openId=${enc(id)}${ref.date ? `&date=${ref.date}` : ""}`, "/reminders"),
  },
  transaction: { label: "Transaction", href: itemOr((id) => `/dashboard?openId=${enc(id)}`, "/dashboard") },
  draft: { label: "Draft", href: () => "/expense" },
  transfer: { label: "Transfer", href: () => "/expense" },
  debt: { label: "Debt", href: () => "/expense" },
  recurring_payment: { label: "Recurring", href: () => "/recurring" },
  meal_plan: { label: "Meal plan", href: () => "/meal-plan" },
  memory: { label: "Memory", href: () => "/era?face=brain" },
  event: {
    label: "Event",
    href: itemOr((id, ref) => `/reminders?openId=${enc(id)}${ref.date ? `&date=${ref.date}` : ""}`, "/reminders"),
  },
  contact: { label: "Contact", href: itemOr((id) => `/catalogue?item=${enc(id)}`, "/catalogue") },
  place: { label: "Place", href: itemOr((id) => `/catalogue?item=${enc(id)}`, "/catalogue") },
  catalogue_module: { label: "Catalogue module", href: () => "/catalogue" },
  shopping_item: { label: "Shopping", href: (_id, _action, ref) => thread(ref) },
  shopping_group: { label: "Shopping group", href: (_id, _action, ref) => thread(ref) },
} satisfies Record<string, EntitySpec>;

export type EraArtifactEntity = keyof typeof ERA_ARTIFACT_ENTITIES;
export const ERA_ARTIFACT_ENTITY_KEYS = Object.keys(ERA_ARTIFACT_ENTITIES) as [
  EraArtifactEntity,
  ...EraArtifactEntity[],
];

export interface EraArtifact {
  action: EraArtifactAction;
  entity: EraArtifactEntity;
  id: string | null;
  title: string;
  ref?: EraArtifactRef;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const eraArtifactRefSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    thread: z.string().regex(UUID).optional(),
  })
  .strip();

export const eraArtifactSchema = z.object({
  action: z.enum(ERA_ARTIFACT_ACTIONS),
  entity: z.enum(ERA_ARTIFACT_ENTITY_KEYS),
  id: z.string().regex(UUID).nullable(),
  title: z.string().trim().min(1).max(200),
  ref: eraArtifactRefSchema.optional(),
});

/** The one builder every adapter uses. A non-uuid id is dropped (no deep link to a fake row). */
export function eraArtifact(
  entity: EraArtifactEntity,
  action: EraArtifactAction,
  id: string | null | undefined,
  title: string,
  ref?: EraArtifactRef,
): EraArtifact {
  return {
    action,
    entity,
    id: typeof id === "string" && UUID.test(id) ? id : null,
    title: title.trim().slice(0, 200) || ERA_ARTIFACT_ENTITIES[entity].label,
    ...(ref ? { ref } : {}),
  };
}

export function eraArtifactLabel(entity: string): string {
  return (ERA_ARTIFACT_ENTITIES as Record<string, EntitySpec>)[entity]?.label ?? "Item";
}

export function eraArtifactHref(a: Pick<EraArtifact, "entity" | "id" | "action" | "ref">): string {
  const spec = (ERA_ARTIFACT_ENTITIES as Record<string, EntitySpec>)[a.entity];
  if (!spec) return "/era?face=artifacts";
  const ref = eraArtifactRefSchema.safeParse(a.ref ?? {});
  return spec.href(a.id, a.action, ref.success ? ref.data : {});
}

/** Validated artifacts from untrusted JSON (a stored message payload). */
export function parseEraArtifacts(value: unknown): EraArtifact[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const r = eraArtifactSchema.safeParse(v);
    return r.success ? [r.data as EraArtifact] : [];
  });
}

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

/**
 * The app module an artifact belongs to — the Artifacts view groups by it and
 * tints each group with the module's ERA hue (faces: src/components/era/eraHues.ts;
 * Catalogue has no face, so it gets its own).
 */
export const ERA_ARTIFACT_MODULES = {
  budget: { label: "Budget", hue: 175 },
  schedule: { label: "Schedule", hue: 256 },
  chef: { label: "Chef", hue: 28 },
  catalogue: { label: "Catalogue", hue: 300 },
  brain: { label: "Brain", hue: 220 },
} as const;
export type EraArtifactModule = keyof typeof ERA_ARTIFACT_MODULES;
export const ERA_ARTIFACT_MODULE_KEYS = Object.keys(ERA_ARTIFACT_MODULES) as EraArtifactModule[];

/**
 * Recycle Bin module ids (src/lib/recycleBin/registry.ts) whose soft-delete +
 * restore pair is the real, balance-correct undo/redo for an artifact's row.
 */
export type EraBinModule = "items" | "catalogue" | "transfers" | "drafts";

interface EntitySpec {
  label: string;
  module: EraArtifactModule;
  /** Present only where delete/restore is a complete inverse (soft-delete + restore route). */
  bin?: EraBinModule;
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
    module: "schedule",
    bin: "items",
    href: itemOr((id, ref) => `/reminders?openId=${enc(id)}${ref.date ? `&date=${ref.date}` : ""}`, "/reminders"),
  },
  transaction: { label: "Transaction", module: "budget", href: itemOr((id) => `/dashboard?openId=${enc(id)}`, "/dashboard") },
  draft: { label: "Draft", module: "budget", bin: "drafts", href: () => "/expense" },
  transfer: { label: "Transfer", module: "budget", bin: "transfers", href: () => "/expense" },
  debt: { label: "Debt", module: "budget", href: () => "/expense" },
  recurring_payment: { label: "Recurring", module: "budget", href: () => "/recurring" },
  meal_plan: { label: "Meal plan", module: "chef", href: () => "/meal-plan" },
  memory: { label: "Memory", module: "brain", href: () => "/era?face=brain" },
  event: {
    label: "Event",
    module: "schedule",
    bin: "items",
    href: itemOr((id, ref) => `/reminders?openId=${enc(id)}${ref.date ? `&date=${ref.date}` : ""}`, "/reminders"),
  },
  contact: { label: "Contact", module: "catalogue", bin: "catalogue", href: itemOr((id) => `/catalogue?item=${enc(id)}`, "/catalogue") },
  place: { label: "Place", module: "catalogue", bin: "catalogue", href: itemOr((id) => `/catalogue?item=${enc(id)}`, "/catalogue") },
  catalogue_module: { label: "Catalogue module", module: "catalogue", href: () => "/catalogue" },
  shopping_item: { label: "Shopping", module: "chef", href: (_id, _action, ref) => thread(ref) },
  shopping_group: { label: "Shopping group", module: "chef", href: (_id, _action, ref) => thread(ref) },
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

export function eraArtifactModule(entity: string): EraArtifactModule {
  return (ERA_ARTIFACT_ENTITIES as Record<string, EntitySpec>)[entity]?.module ?? "brain";
}

/**
 * What a row's persistent Undo/Redo acts on. Only created/deleted verbs of an
 * entity with a Recycle Bin pair qualify — an "updated" verb has no stored
 * before-image, so it has no inverse and gets no button (never a fake one).
 *   born "live"    → the artifact created the row: Undo trashes, Redo restores.
 *   born "trashed" → the artifact deleted the row: Undo restores, Redo trashes.
 */
export interface EraReversal {
  bin: EraBinModule;
  id: string;
  born: "live" | "trashed";
}

export function eraArtifactReversal(a: { entity: string; action: string; id: string | null }): EraReversal | null {
  if (!a.id) return null;
  const bin = (ERA_ARTIFACT_ENTITIES as Record<string, EntitySpec>)[a.entity]?.bin;
  if (!bin) return null;
  if (a.action === "created") return { bin, id: a.id, born: "live" };
  if (a.action === "deleted") return { bin, id: a.id, born: "trashed" };
  return null;
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

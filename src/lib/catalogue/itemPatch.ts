// src/lib/catalogue/itemPatch.ts
// KIT-20 / Catalogue C02 — the one contract for editing a catalogue item.
//
// metadata_json is edited by key, never replaced: `metadata_set` writes keys,
// `metadata_unset` removes keys, everything else survives untouched (fields a
// form doesn't know about, keys ERA or another module wrote). A legacy
// `metadata_json` body is treated as `metadata_set` — non-destructive.
//
// `expected_revision` is the stale-write guard (409 on mismatch). The DB
// trigger owns the increment (migrations/2026-10-04_catalogue-revision.sql).

import { z } from "zod";
import { CHORE_CATEGORIES } from "@/types/catalogue";

export type Metadata = Record<string, unknown>;

const METADATA_KEY_RE = /^[a-z][a-z0-9_]{0,63}$/;
const MAX_METADATA_BYTES = 32_000;

const metadataKey = z.string().regex(METADATA_KEY_RE, "invalid metadata key");
const metadataObject = z
  .record(metadataKey, z.unknown())
  .refine((m) => JSON.stringify(m).length <= MAX_METADATA_BYTES, "metadata too large");

const optText = z.string().max(10_000).nullable().optional();

export const catalogueItemPatchSchema = z
  .object({
    expected_revision: z.number().int().positive().optional(),
    category_id: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(500).optional(),
    description: optText,
    notes: optText,
    status: z.enum(["active", "completed", "in_progress", "paused", "cancelled", "archived"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent", "critical"]).optional(),
    icon: z.string().max(100).nullable().optional(),
    color: z.string().max(100).nullable().optional(),
    image_url: z.string().max(2_000).nullable().optional(),
    is_pinned: z.boolean().optional(),
    is_favorite: z.boolean().optional(),
    tags: z.array(z.string().max(100)).max(100).optional(),
    metadata_set: metadataObject.optional(),
    metadata_unset: z.array(metadataKey).max(200).optional(),
    /** Legacy full-object body — merged as metadata_set, never a replace. */
    metadata_json: metadataObject.optional(),
    progress_current: z.number().finite().nullable().optional(),
    progress_target: z.number().finite().nullable().optional(),
    progress_unit: z.string().max(50).nullable().optional(),
    next_due_date: z.string().max(40).nullable().optional(),
    frequency: z.string().max(50).nullable().optional(),
    position: z.number().int().optional(),
    item_type: z.enum(["reminder", "event", "task"]).nullable().optional(),
    location_context: z.enum(["home", "outside", "anywhere"]).nullable().optional(),
    location_url: z.string().max(2_000).nullable().optional(),
    preferred_time: z.string().max(20).nullable().optional(),
    preferred_duration_minutes: z.number().int().min(0).max(10_000).nullable().optional(),
    recurrence_pattern: z
      .enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly", "custom"])
      .nullable()
      .optional(),
    recurrence_custom_rrule: z.string().max(1_000).nullable().optional(),
    recurrence_days_of_week: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    subtasks_text: z.string().max(20_000).nullable().optional(),
    is_active_on_calendar: z.boolean().optional(),
    linked_item_id: z.string().uuid().nullable().optional(),
    item_category_ids: z.array(z.string().max(100)).max(50).optional(),
    is_public: z.boolean().optional(),
    is_flexible_routine: z.boolean().optional(),
    flexible_occurrences: z.number().int().min(1).max(31).optional(),
    is_chore: z.boolean().optional(),
    chore_category: z.enum(CHORE_CATEGORIES).nullable().optional(),
  })
  // Unknown keys are dropped, not rejected: shared create/edit payloads and
  // older app builds still send module_id etc. on edit.
  .strip();

export type CatalogueItemPatch = z.infer<typeof catalogueItemPatchSchema>;
/** What a client sends (before the schema's trims/defaults). */
export type CatalogueItemPatchInput = z.input<typeof catalogueItemPatchSchema>;

/** POST /api/catalogue/items body. */
export const catalogueItemCreateSchema = catalogueItemPatchSchema
  .omit({
    expected_revision: true,
    metadata_set: true,
    metadata_unset: true,
    is_active_on_calendar: true,
    linked_item_id: true,
    position: true,
    is_pinned: true,
    is_favorite: true,
  })
  .extend({
    module_id: z.string().uuid(),
    category_id: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(500),
  })
  .strip();

/** Free text → a safe PostgREST `ilike` pattern body (no filter-syntax chars, LIKE wildcards escaped). */
export function toIlikeTerm(search: string): string {
  return search
    .slice(0, 100)
    .replace(/[,()"'\\]/g, " ")
    .replace(/[%_]/g, (c) => `\\${c}`)
    .trim();
}

/** Scalar columns a patch may write (everything except the metadata/revision controls). */
export const PATCH_SCALAR_KEYS = Object.keys(catalogueItemPatchSchema.shape).filter(
  (k) => !["expected_revision", "metadata_set", "metadata_unset", "metadata_json"].includes(k),
) as Array<keyof CatalogueItemPatch>;

export class MetadataPatchError extends Error {}

/** set/unset from a patch body; legacy `metadata_json` folds into set. */
export function metadataOps(patch: Pick<CatalogueItemPatch, "metadata_set" | "metadata_unset" | "metadata_json">): {
  set: Metadata;
  unset: string[];
} {
  const set = { ...(patch.metadata_json ?? {}), ...(patch.metadata_set ?? {}) };
  const unset = [...new Set(patch.metadata_unset ?? [])];
  const overlap = unset.filter((k) => k in set);
  if (overlap.length > 0) throw new MetadataPatchError(`set and unset overlap: ${overlap.join(", ")}`);
  return { set, unset };
}

export function applyMetadataPatch(current: Metadata | null | undefined, set: Metadata, unset: string[]): Metadata {
  const next: Metadata = { ...(current ?? {}), ...set };
  for (const k of unset) delete next[k];
  return next;
}

/** The patch that puts every touched key back the way it was. */
export function metadataInverse(before: Metadata | null | undefined, set: Metadata, unset: string[]) {
  const prior = before ?? {};
  const inv = { set: {} as Metadata, unset: [] as string[] };
  for (const k of [...Object.keys(set), ...unset]) {
    if (k in prior) inv.set[k] = prior[k];
    else if (!inv.unset.includes(k)) inv.unset.push(k);
  }
  return inv;
}

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/**
 * Client side: turn a form's values for the keys it manages into set/unset.
 * Keys the form doesn't manage are never mentioned, so they survive the save.
 */
export function diffMetadata(
  original: Metadata | null | undefined,
  values: Metadata,
  managedKeys: readonly string[],
): { metadata_set?: Metadata; metadata_unset?: string[] } {
  const prior = original ?? {};
  const set: Metadata = {};
  const unset: string[] = [];
  for (const k of managedKeys) {
    const v = values[k];
    if (isBlank(v)) {
      if (k in prior) unset.push(k);
    } else if (JSON.stringify(v) !== JSON.stringify(prior[k])) {
      set[k] = v;
    }
  }
  return {
    ...(Object.keys(set).length > 0 ? { metadata_set: set } : {}),
    ...(unset.length > 0 ? { metadata_unset: unset } : {}),
  };
}

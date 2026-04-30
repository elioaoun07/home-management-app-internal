// src/lib/recycleBin/types.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type FilterKind =
  | "text"
  | "enum"
  | "dateRange"
  | "numericRange"
  | "boolean";

export interface FilterField {
  key: string;
  label: string;
  kind: FilterKind;
  /** DB column to filter on. */
  column: string;
  /** For enum filters. */
  options?: { value: string; label: string }[];
}

export interface RecycleBinRow {
  id: string;
  /** Human-friendly title rendered as the row's main label. */
  title: string;
  /** Secondary line (category, account, etc). */
  subtitle?: string;
  /** Right-aligned meta (amount, date, etc). */
  meta?: string;
  /** When the row entered the trash. */
  deletedAt: string;
  /** Anything extra a module wants to surface (raw row). */
  raw: Record<string, unknown>;
}

export interface RecycleBinModule<TRow = Record<string, unknown>> {
  /** Stable id (URL-safe). */
  id: string;
  label: string;
  /** Lucide / Futuristic icon name (string key resolved client-side). */
  icon: string;

  /** Supabase table. */
  table: string;
  /** Column that flags trash state. Almost always "deleted_at". */
  deletedAtColumn: string;
  /**
   * Column used to scope rows to a user's household.
   *  - "user_id"       => filter by user_id IN (self [, partner])
   *  - "household_id"  => filter by household_id = current household_link.id
   */
  scope: "user" | "household";

  /** Columns selected for the list view. */
  selectColumns: string;

  /** Text columns matched against the search query (ILIKE). */
  searchColumns: string[];

  /** Module-specific filter fields surfaced in the UI. */
  filterFields: FilterField[];

  /** Optional WHERE that further narrows what counts as "in this section".
   *  Example: drafts use the same `transactions` table but only `is_draft = true`.
   */
  baseFilter?: (query: any) => any;

  /** Convert a raw row into the generic display shape. */
  formatRow: (row: TRow) => RecycleBinRow;

  /** Side effects when restoring a row. Run server-side after `deleted_at` is cleared. */
  onRestore?: (ctx: {
    row: TRow;
    supabase: SupabaseClient;
    admin: SupabaseClient;
    userId: string;
  }) => Promise<void>;

  /** Side effects when permanently deleting a row. Run before the row is hard-deleted. */
  onPurge?: (ctx: {
    row: TRow;
    supabase: SupabaseClient;
    admin: SupabaseClient;
    userId: string;
  }) => Promise<void>;

  /** TanStack Query keys to invalidate after restore/purge so module UIs refresh. */
  invalidateKeys: string[][];
}

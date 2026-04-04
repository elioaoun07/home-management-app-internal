// src/types/nfc.ts
// TypeScript types for the NFC Tags system

export type UUID = string;

// ============================================
// NFC TAG
// ============================================

/** @deprecated Use NfcDbChecklistItem (from nfc_checklist_items table) instead */
export interface NfcChecklistItem {
  id: string;
  title: string;
  order: number;
}

/** @deprecated Checklists are now stored in nfc_checklist_items table */
export type NfcChecklists = Record<string, NfcChecklistItem[]>;

export interface NfcTag {
  id: UUID;
  user_id: UUID;
  tag_slug: string;
  label: string;
  location_name: string | null;
  icon: string | null;
  states: string[]; // e.g. ["leaving", "arriving"] or ["on", "off"]
  current_state: string | null;
  is_active: boolean;
  checklists: NfcChecklists; // legacy jsonb — kept for backward compat
  created_at: string;
  updated_at: string;
}

export interface CreateNfcTagInput {
  tag_slug: string;
  label: string;
  location_name?: string | null;
  icon?: string | null;
  states: string[];
}

export interface UpdateNfcTagInput {
  label?: string;
  location_name?: string | null;
  icon?: string | null;
  states?: string[];
  is_active?: boolean;
  checklists?: NfcChecklists;
}

// ============================================
// NFC CHECKLIST (DB table-backed)
// ============================================

/** A checklist item stored in nfc_checklist_items table */
export interface NfcDbChecklistItem {
  id: UUID;
  tag_id: UUID;
  state: string;
  title: string;
  order_index: number;
  source_tag_id: UUID | null;
  source_state: string | null;
  is_active: boolean;
  created_at: string;
  // Joined fields (populated at query time)
  source_tag_label?: string | null;
  source_tag_current_state?: string | null;
}

/** Checklist item enriched with completion status for a tap session */
export interface NfcChecklistItemWithStatus extends NfcDbChecklistItem {
  is_completed: boolean;
  is_auto_completed: boolean; // true when source_tag's state matches source_state
  completed_by: UUID | null;
  completed_at: string | null;
}

export interface CreateChecklistItemInput {
  state: string;
  title: string;
  order_index?: number;
  source_tag_id?: string | null;
  source_state?: string | null;
}

export interface UpdateChecklistItemInput {
  title?: string;
  order_index?: number;
  source_tag_id?: string | null;
  source_state?: string | null;
  is_active?: boolean;
}

// ============================================
// NFC STATE LOG
// ============================================

export interface NfcStateLog {
  id: UUID;
  tag_id: UUID;
  previous_state: string | null;
  new_state: string;
  changed_by: UUID;
  metadata_json: Record<string, unknown> | null;
  changed_at: string;
}

// ============================================
// NFC TAP RESULT
// ============================================

export interface NfcTapResult {
  tag: NfcTag;
  previous_state: string | null;
  new_state: string;
  state_log_id: UUID;
  triggered_items: TriggeredItem[];
  checklist_items: NfcChecklistItemWithStatus[];
  recent_activity: NfcStateLog[];
}

export interface TriggeredItem {
  id: UUID;
  title: string;
  type: string;
  priority: string;
  subtasks: Array<{
    id: UUID;
    title: string;
    done_at: string | null;
    order_index: number;
  }>;
}

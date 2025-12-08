// src/lib/supabase/reminder-app.ts
// Supabase client for the Reminder App database
// Used for cross-app item creation

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Reminder App Supabase credentials (from env)
const REMINDER_APP_SUPABASE_URL = process.env.REMINDER_APP_SUPABASE_URL!;
const REMINDER_APP_SUPABASE_SERVICE_KEY =
  process.env.REMINDER_APP_SUPABASE_SERVICE_KEY!;

let reminderAppClient: SupabaseClient | null = null;

/**
 * Get a Supabase client for the Reminder App database
 * Uses service role key for server-side operations
 */
export function getReminderAppClient(): SupabaseClient {
  if (!reminderAppClient) {
    if (!REMINDER_APP_SUPABASE_URL || !REMINDER_APP_SUPABASE_SERVICE_KEY) {
      throw new Error(
        "Reminder App Supabase credentials not configured. " +
          "Set REMINDER_APP_SUPABASE_URL and REMINDER_APP_SUPABASE_SERVICE_KEY in environment."
      );
    }

    reminderAppClient = createClient(
      REMINDER_APP_SUPABASE_URL,
      REMINDER_APP_SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return reminderAppClient;
}

// Types for Reminder App items
export type ItemType = "reminder" | "event" | "note";
export type ItemPriority = "low" | "normal" | "high" | "urgent";
export type ItemStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface ReminderAppItem {
  id?: string;
  user_id: string;
  type: ItemType;
  title: string;
  description?: string | null;
  priority?: ItemPriority;
  status?: ItemStatus;
  metadata_json?: Record<string, any> | null;
  responsible_user_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReminderDetails {
  item_id: string;
  due_at?: string | null;
  completed_at?: string | null;
  estimate_minutes?: number | null;
  has_checklist?: boolean;
}

export interface EventDetails {
  item_id: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  location_text?: string | null;
}

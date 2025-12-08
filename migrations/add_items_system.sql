-- Migration: Add Items System (Reminders, Events, Notes)
-- This migration adds the unified items system from the reminder app to support
-- reminders, events, and notes alongside the existing budget functionality.

-- ============================================
-- ENUM TYPES
-- ============================================

-- Item type enum
CREATE TYPE item_type_enum AS ENUM ('reminder', 'event', 'note');

-- Item priority enum  
CREATE TYPE item_priority_enum AS ENUM ('low', 'normal', 'high', 'urgent');

-- Item status enum
CREATE TYPE item_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Alert channel enum
CREATE TYPE alert_channel_enum AS ENUM ('push', 'email', 'sms', 'in_app');

-- Alert relative to enum
CREATE TYPE alert_relative_to_enum AS ENUM ('start', 'end', 'due');

-- Alert kind enum
CREATE TYPE alert_kind_enum AS ENUM ('absolute', 'relative');

-- ============================================
-- CORE TABLES
-- ============================================

-- Items table - the core entity for reminders, events, and notes
CREATE TABLE public.items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type item_type_enum NOT NULL,
  title text NOT NULL,
  description text,
  priority item_priority_enum NOT NULL DEFAULT 'normal',
  status item_status_enum,
  metadata_json jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  archived_at timestamp with time zone,
  is_public boolean NOT NULL DEFAULT false,
  responsible_user_id uuid NOT NULL,
  google_event_id text,
  CONSTRAINT items_pkey PRIMARY KEY (id),
  CONSTRAINT items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT items_responsible_user_fkey FOREIGN KEY (responsible_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX items_user_id_idx ON public.items(user_id);
CREATE INDEX items_type_idx ON public.items(type);
CREATE INDEX items_status_idx ON public.items(status);
CREATE INDEX items_created_at_idx ON public.items(created_at DESC);
CREATE INDEX items_archived_idx ON public.items(archived_at) WHERE archived_at IS NULL;

-- ============================================
-- ITEM CATEGORIES (for items)
-- ============================================

-- Item categories - different from budget categories
CREATE TABLE public.item_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color_hex text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  position integer NOT NULL DEFAULT 0,
  user_id uuid NOT NULL,
  CONSTRAINT item_categories_pkey PRIMARY KEY (id),
  CONSTRAINT item_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX item_categories_user_id_idx ON public.item_categories(user_id);

-- Junction table for items and their categories
CREATE TABLE public.item_category_mappings (
  item_id uuid NOT NULL,
  category_id uuid NOT NULL,
  CONSTRAINT item_category_mappings_pkey PRIMARY KEY (item_id, category_id),
  CONSTRAINT item_category_mappings_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE,
  CONSTRAINT item_category_mappings_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.item_categories(id) ON DELETE CASCADE
);

-- ============================================
-- REMINDER DETAILS
-- ============================================

-- Reminder-specific details
CREATE TABLE public.reminder_details (
  item_id uuid NOT NULL,
  due_at timestamp with time zone,
  completed_at timestamp with time zone,
  estimate_minutes integer CHECK (estimate_minutes IS NULL OR estimate_minutes >= 0),
  has_checklist boolean NOT NULL DEFAULT false,
  CONSTRAINT reminder_details_pkey PRIMARY KEY (item_id),
  CONSTRAINT reminder_details_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
);

-- ============================================
-- EVENT DETAILS
-- ============================================

-- Event-specific details
CREATE TABLE public.event_details (
  item_id uuid NOT NULL,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  location_text text,
  CONSTRAINT event_details_pkey PRIMARY KEY (item_id),
  CONSTRAINT event_details_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
);

CREATE INDEX event_details_start_idx ON public.event_details(start_at);
CREATE INDEX event_details_end_idx ON public.event_details(end_at);

-- ============================================
-- SUBTASKS
-- ============================================

-- Subtasks for items with checklists
CREATE TABLE public.item_subtasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_item_id uuid NOT NULL,
  title text NOT NULL,
  done_at timestamp with time zone,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_subtasks_pkey PRIMARY KEY (id),
  CONSTRAINT item_subtasks_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.items(id) ON DELETE CASCADE
);

CREATE INDEX item_subtasks_parent_idx ON public.item_subtasks(parent_item_id);

-- ============================================
-- ALERTS
-- ============================================

-- Alerts for reminders and events
CREATE TABLE public.item_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  kind alert_kind_enum NOT NULL,
  trigger_at timestamp with time zone,
  offset_minutes integer CHECK (offset_minutes IS NULL OR offset_minutes > 0),
  relative_to alert_relative_to_enum,
  repeat_every_minutes integer CHECK (repeat_every_minutes IS NULL OR repeat_every_minutes > 0),
  max_repeats integer CHECK (max_repeats IS NULL OR max_repeats > 0),
  channel alert_channel_enum NOT NULL DEFAULT 'push',
  active boolean NOT NULL DEFAULT true,
  last_fired_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT item_alerts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
);

CREATE INDEX item_alerts_item_id_idx ON public.item_alerts(item_id);
CREATE INDEX item_alerts_trigger_idx ON public.item_alerts(trigger_at) WHERE active = true;

-- ============================================
-- SNOOZES
-- ============================================

-- Snoozes for alerts
CREATE TABLE public.item_snoozes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL,
  item_id uuid NOT NULL,
  snoozed_until timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_snoozes_pkey PRIMARY KEY (id),
  CONSTRAINT item_snoozes_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.item_alerts(id) ON DELETE CASCADE,
  CONSTRAINT item_snoozes_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
);

-- ============================================
-- RECURRENCE RULES
-- ============================================

-- Recurrence rules for repeating items
CREATE TABLE public.item_recurrence_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  rrule text NOT NULL,
  start_anchor timestamp with time zone NOT NULL,
  end_until timestamp with time zone,
  count integer,
  CONSTRAINT item_recurrence_rules_pkey PRIMARY KEY (id),
  CONSTRAINT item_recurrence_rules_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
);

CREATE INDEX item_recurrence_item_idx ON public.item_recurrence_rules(item_id);

-- Recurrence exceptions
CREATE TABLE public.item_recurrence_exceptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  exdate timestamp with time zone NOT NULL,
  override_payload_json jsonb,
  CONSTRAINT item_recurrence_exceptions_pkey PRIMARY KEY (id),
  CONSTRAINT item_recurrence_exceptions_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.item_recurrence_rules(id) ON DELETE CASCADE
);

-- ============================================
-- ATTACHMENTS
-- ============================================

-- File attachments for items
CREATE TABLE public.item_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  storage_key text,
  file_url text,
  mime_type text,
  size_bytes bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT item_attachments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
);

CREATE INDEX item_attachments_item_idx ON public.item_attachments(item_id);

-- ============================================
-- ALERT PRESETS
-- ============================================

-- User-defined alert presets
CREATE TABLE public.item_alert_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  preset_config jsonb NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT item_alert_presets_pkey PRIMARY KEY (id),
  CONSTRAINT item_alert_presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX item_alert_presets_user_idx ON public.item_alert_presets(user_id);

-- ============================================
-- GOOGLE CALENDAR INTEGRATION
-- ============================================

-- Google Calendar tokens (if not already exists)
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  user_id uuid NOT NULL,
  google_refresh_token text NOT NULL,
  google_calendar_id text NOT NULL,
  google_access_token text,
  access_token_expires_at timestamp with time zone,
  connected_at timestamp with time zone NOT NULL DEFAULT now(),
  last_synced_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT google_calendar_tokens_pkey PRIMARY KEY (user_id),
  CONSTRAINT google_calendar_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_snoozes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_recurrence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_recurrence_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_alert_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for items
CREATE POLICY "Users can view own items" ON public.items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own items" ON public.items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items" ON public.items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own items" ON public.items
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for item_categories
CREATE POLICY "Users can view own item categories" ON public.item_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own item categories" ON public.item_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own item categories" ON public.item_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own item categories" ON public.item_categories
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for item_category_mappings (via item ownership)
CREATE POLICY "Users can manage item category mappings" ON public.item_category_mappings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND user_id = auth.uid())
  );

-- RLS Policies for reminder_details (via item ownership)
CREATE POLICY "Users can manage reminder details" ON public.reminder_details
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND user_id = auth.uid())
  );

-- RLS Policies for event_details (via item ownership)
CREATE POLICY "Users can manage event details" ON public.event_details
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND user_id = auth.uid())
  );

-- RLS Policies for item_subtasks (via item ownership)
CREATE POLICY "Users can manage item subtasks" ON public.item_subtasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.items WHERE id = parent_item_id AND user_id = auth.uid())
  );

-- RLS Policies for item_alerts (via item ownership)
CREATE POLICY "Users can manage item alerts" ON public.item_alerts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND user_id = auth.uid())
  );

-- RLS Policies for item_snoozes (via item ownership)
CREATE POLICY "Users can manage item snoozes" ON public.item_snoozes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND user_id = auth.uid())
  );

-- RLS Policies for item_recurrence_rules (via item ownership)
CREATE POLICY "Users can manage recurrence rules" ON public.item_recurrence_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND user_id = auth.uid())
  );

-- RLS Policies for item_recurrence_exceptions (via rule ownership)
CREATE POLICY "Users can manage recurrence exceptions" ON public.item_recurrence_exceptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.item_recurrence_rules r
      JOIN public.items i ON i.id = r.item_id
      WHERE r.id = rule_id AND i.user_id = auth.uid()
    )
  );

-- RLS Policies for item_attachments (via item ownership)
CREATE POLICY "Users can manage item attachments" ON public.item_attachments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND user_id = auth.uid())
  );

-- RLS Policies for item_alert_presets
CREATE POLICY "Users can view own alert presets" ON public.item_alert_presets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alert presets" ON public.item_alert_presets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alert presets" ON public.item_alert_presets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alert presets" ON public.item_alert_presets
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_categories_updated_at
  BEFORE UPDATE ON public.item_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_subtasks_updated_at
  BEFORE UPDATE ON public.item_subtasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_alerts_updated_at
  BEFORE UPDATE ON public.item_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_alert_presets_updated_at
  BEFORE UPDATE ON public.item_alert_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT ITEM CATEGORIES
-- ============================================

-- Insert will be done by users, but we can have system-wide defaults
-- that get copied to new users during onboarding

COMMENT ON TABLE public.items IS 'Core table for reminders, events, and notes';
COMMENT ON TABLE public.item_categories IS 'User-defined categories for organizing items';
COMMENT ON TABLE public.reminder_details IS 'Additional details specific to reminder items';
COMMENT ON TABLE public.event_details IS 'Additional details specific to event items';
COMMENT ON TABLE public.item_subtasks IS 'Checklist items for reminders';
COMMENT ON TABLE public.item_alerts IS 'Notification alerts for items';
COMMENT ON TABLE public.item_recurrence_rules IS 'Recurrence patterns for repeating items';

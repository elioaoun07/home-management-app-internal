-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- 
-- This schema is from the Reminder App, which has been MERGED into this Budget App.
-- See migrations/add_items_system.sql for the actual migration to add these tables.
--
-- The merged app now supports:
-- 1. Budget/Expense tracking (existing functionality)
-- 2. Reminders, Events, and Notes (from Reminder App)

CREATE TABLE public.alert_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  preset_config jsonb NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alert_presets_pkey PRIMARY KEY (id),
  CONSTRAINT alert_presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  kind USER-DEFINED NOT NULL,
  trigger_at timestamp with time zone,
  offset_minutes integer CHECK (offset_minutes IS NULL OR offset_minutes > 0),
  relative_to USER-DEFINED,
  repeat_every_minutes integer CHECK (repeat_every_minutes IS NULL OR repeat_every_minutes > 0),
  max_repeats integer CHECK (max_repeats IS NULL OR max_repeats > 0),
  channel USER-DEFINED NOT NULL DEFAULT 'push'::alert_channel_enum,
  active boolean NOT NULL DEFAULT true,
  last_fired_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT alerts_pkey PRIMARY KEY (id),
  CONSTRAINT alerts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  storage_key text,
  file_url text,
  mime_type text,
  size_bytes bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attachments_pkey PRIMARY KEY (id),
  CONSTRAINT attachments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color_hex text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  position integer NOT NULL DEFAULT nextval('categories_position_seq'::regclass),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.event_details (
  item_id uuid NOT NULL,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  location_text text,
  CONSTRAINT event_details_pkey PRIMARY KEY (item_id),
  CONSTRAINT event_details_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.google_calendar_tokens (
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
  CONSTRAINT google_calendar_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.item_categories (
  item_id uuid NOT NULL,
  category_id uuid NOT NULL,
  CONSTRAINT item_categories_pkey PRIMARY KEY (item_id, category_id),
  CONSTRAINT item_categories_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id),
  CONSTRAINT item_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  title text NOT NULL,
  description text,
  priority USER-DEFINED NOT NULL DEFAULT 'normal'::item_priority_enum,
  status USER-DEFINED,
  metadata_json jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  archived_at timestamp with time zone,
  is_public boolean NOT NULL DEFAULT false,
  responsible_user_id uuid NOT NULL,
  google_event_id text,
  CONSTRAINT items_pkey PRIMARY KEY (id),
  CONSTRAINT items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT items_responsible_user_fk FOREIGN KEY (responsible_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.recurrence_exceptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  exdate timestamp with time zone NOT NULL,
  override_payload_json jsonb,
  CONSTRAINT recurrence_exceptions_pkey PRIMARY KEY (id),
  CONSTRAINT recurrence_exceptions_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.recurrence_rules(id)
);
CREATE TABLE public.recurrence_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  rrule text NOT NULL,
  start_anchor timestamp with time zone NOT NULL,
  end_until timestamp with time zone,
  count integer,
  CONSTRAINT recurrence_rules_pkey PRIMARY KEY (id),
  CONSTRAINT recurrence_rules_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.reminder_details (
  item_id uuid NOT NULL,
  due_at timestamp with time zone,
  completed_at timestamp with time zone,
  estimate_minutes integer CHECK (estimate_minutes IS NULL OR estimate_minutes >= 0),
  has_checklist boolean NOT NULL DEFAULT false,
  CONSTRAINT reminder_details_pkey PRIMARY KEY (item_id),
  CONSTRAINT reminder_details_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.snoozes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL,
  item_id uuid NOT NULL,
  snoozed_until timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT snoozes_pkey PRIMARY KEY (id),
  CONSTRAINT snoozes_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.alerts(id),
  CONSTRAINT snoozes_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.subtasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_item_id uuid NOT NULL,
  title text NOT NULL,
  done_at timestamp with time zone,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subtasks_pkey PRIMARY KEY (id),
  CONSTRAINT subtasks_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.items(id)
);

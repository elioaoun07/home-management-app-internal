-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.account_balances (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  balance_set_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT account_balances_pkey PRIMARY KEY (id),
  CONSTRAINT account_balances_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT account_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  inserted_at timestamp with time zone NOT NULL DEFAULT now(),
  is_default boolean DEFAULT false,
  country_code text,
  location_name text,
  position integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.ai_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])),
  content text NOT NULL,
  parent_id uuid,
  sequence_num integer NOT NULL DEFAULT 0,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  included_budget_context boolean DEFAULT false,
  model_used text DEFAULT 'gemini-2.0-flash'::text,
  response_time_ms integer,
  is_edited boolean DEFAULT false,
  edited_at timestamp with time zone,
  original_content text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  total_tokens integer DEFAULT (COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)),
  CONSTRAINT ai_messages_pkey PRIMARY KEY (id),
  CONSTRAINT ai_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT ai_messages_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.ai_messages(id)
);
CREATE TABLE public.ai_sessions (
  id text NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New Conversation'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_archived boolean DEFAULT false,
  CONSTRAINT ai_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT ai_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.budget_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assigned_to text NOT NULL DEFAULT 'both'::text CHECK (assigned_to = ANY (ARRAY['user'::text, 'partner'::text, 'both'::text])),
  category_id uuid NOT NULL,
  subcategory_id uuid,
  account_id uuid NOT NULL,
  monthly_budget numeric NOT NULL DEFAULT 0 CHECK (monthly_budget >= 0::numeric),
  budget_month text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT budget_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT budget_allocations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT budget_allocations_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.user_categories(id),
  CONSTRAINT budget_allocations_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.user_categories(id),
  CONSTRAINT budget_allocations_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id)
);
CREATE TABLE public.cross_app_user_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  budget_app_user_id uuid NOT NULL UNIQUE,
  reminder_app_user_id uuid NOT NULL,
  display_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cross_app_user_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT cross_app_user_mappings_budget_app_user_id_fkey FOREIGN KEY (budget_app_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.default_categories (
  id uuid NOT NULL,
  name text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  parent_id uuid,
  sort_order integer NOT NULL,
  CONSTRAINT default_categories_pkey PRIMARY KEY (id),
  CONSTRAINT default_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.default_categories(id)
);
CREATE TABLE public.error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  error_message text NOT NULL,
  error_stack text,
  component_name text,
  user_agent text,
  url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT error_logs_pkey PRIMARY KEY (id),
  CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
CREATE TABLE public.events (
  id text NOT NULL,
  title text NOT NULL,
  notes text,
  start_at bigint NOT NULL,
  end_at bigint NOT NULL,
  all_day integer DEFAULT 0,
  repeat_rule text,
  timezone text,
  created_at bigint NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
  updated_at bigint NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
  user_id uuid,
  CONSTRAINT events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.future_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  target_amount numeric NOT NULL CHECK (target_amount > 0::numeric),
  current_saved numeric NOT NULL DEFAULT 0 CHECK (current_saved >= 0::numeric),
  urgency integer NOT NULL DEFAULT 3 CHECK (urgency >= 1 AND urgency <= 5),
  target_date date NOT NULL,
  recommended_monthly_savings numeric DEFAULT 0,
  icon text DEFAULT 'package'::text,
  color text DEFAULT '#38bdf8'::text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text, 'paused'::text])),
  allocations jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT future_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT future_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
CREATE TABLE public.household_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL,
  owner_email text,
  partner_user_id uuid,
  partner_email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT household_links_pkey PRIMARY KEY (id),
  CONSTRAINT household_links_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id),
  CONSTRAINT household_links_partner_user_id_fkey FOREIGN KEY (partner_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.hub_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  household_id uuid,
  alert_type text NOT NULL CHECK (alert_type = ANY (ARRAY['bill_due'::text, 'budget_warning'::text, 'budget_exceeded'::text, 'unusual_spending'::text, 'goal_milestone'::text, 'streak_at_risk'::text, 'weekly_summary'::text, 'monthly_summary'::text])),
  severity text NOT NULL DEFAULT 'info'::text CHECK (severity = ANY (ARRAY['action'::text, 'warning'::text, 'info'::text, 'success'::text])),
  title text NOT NULL,
  message text,
  recurring_payment_id uuid,
  category_id uuid,
  transaction_id uuid,
  is_read boolean DEFAULT false,
  is_dismissed boolean DEFAULT false,
  action_taken boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT hub_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT hub_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT hub_alerts_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id),
  CONSTRAINT hub_alerts_recurring_payment_id_fkey FOREIGN KEY (recurring_payment_id) REFERENCES public.recurring_payments(id),
  CONSTRAINT hub_alerts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.user_categories(id),
  CONSTRAINT hub_alerts_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
);
CREATE TABLE public.hub_chat_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  icon text DEFAULT '💬'::text,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_message_at timestamp with time zone DEFAULT now(),
  purpose text DEFAULT 'general'::text CHECK (purpose = ANY (ARRAY['general'::text, 'budget'::text, 'reminder'::text, 'shopping'::text, 'travel'::text, 'health'::text, 'notes'::text, 'other'::text])),
  external_url text,
  external_app_name text,
  CONSTRAINT hub_chat_threads_pkey PRIMARY KEY (id),
  CONSTRAINT hub_chat_threads_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id),
  CONSTRAINT hub_chat_threads_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.hub_daily_pulse (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pulse_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_available numeric,
  spent_yesterday numeric,
  under_budget_streak integer DEFAULT 0,
  has_due_bills boolean DEFAULT false,
  bills_due_today jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hub_daily_pulse_pkey PRIMARY KEY (id),
  CONSTRAINT hub_daily_pulse_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.hub_feed (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  user_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type = ANY (ARRAY['transaction_added'::text, 'transaction_edited'::text, 'transaction_deleted'::text, 'goal_created'::text, 'goal_progress'::text, 'goal_completed'::text, 'budget_alert'::text, 'milestone'::text, 'streak'::text])),
  transaction_id uuid,
  goal_id uuid,
  title text NOT NULL,
  subtitle text,
  amount numeric,
  icon text,
  color text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hub_feed_pkey PRIMARY KEY (id),
  CONSTRAINT hub_feed_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id),
  CONSTRAINT hub_feed_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT hub_feed_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT hub_feed_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.hub_household_goals(id)
);
CREATE TABLE public.hub_household_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  target_amount numeric NOT NULL CHECK (target_amount > 0::numeric),
  current_amount numeric DEFAULT 0,
  target_date date,
  icon text DEFAULT 'target'::text,
  color text DEFAULT '#38bdf8'::text,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT hub_household_goals_pkey PRIMARY KEY (id),
  CONSTRAINT hub_household_goals_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id),
  CONSTRAINT hub_household_goals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.hub_message_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['transaction'::text, 'reminder'::text, 'forward'::text, 'pin'::text])),
  transaction_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hub_message_actions_pkey PRIMARY KEY (id),
  CONSTRAINT hub_message_actions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.hub_messages(id),
  CONSTRAINT hub_message_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT hub_message_actions_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
);
CREATE TABLE public.hub_message_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'sent'::text CHECK (status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text])),
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hub_message_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT hub_message_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT hub_message_receipts_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.hub_messages(id)
);
CREATE TABLE public.hub_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  message_type text NOT NULL DEFAULT 'text'::text CHECK (message_type = ANY (ARRAY['text'::text, 'system'::text, 'transaction'::text, 'goal'::text, 'alert'::text])),
  content text,
  transaction_id uuid,
  goal_id uuid,
  alert_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  reply_to_id uuid,
  thread_id uuid,
  hidden_for ARRAY DEFAULT '{}'::uuid[],
  deleted_at timestamp with time zone,
  deleted_by uuid,
  CONSTRAINT hub_messages_pkey PRIMARY KEY (id),
  CONSTRAINT hub_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.hub_chat_threads(id),
  CONSTRAINT hub_messages_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id),
  CONSTRAINT hub_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES auth.users(id),
  CONSTRAINT hub_messages_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT hub_messages_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.hub_household_goals(id),
  CONSTRAINT hub_messages_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.hub_alerts(id),
  CONSTRAINT hub_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.hub_messages(id)
);
CREATE TABLE public.hub_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  feed_item_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction_type text NOT NULL CHECK (reaction_type = ANY (ARRAY['like'::text, 'comment'::text])),
  comment_text text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hub_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT hub_reactions_feed_item_id_fkey FOREIGN KEY (feed_item_id) REFERENCES public.hub_feed(id),
  CONSTRAINT hub_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.hub_user_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  household_id uuid,
  stat_period text NOT NULL CHECK (stat_period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text, 'alltime'::text])),
  period_start date NOT NULL,
  total_spent numeric DEFAULT 0,
  total_income numeric DEFAULT 0,
  transaction_count integer DEFAULT 0,
  under_budget_streak integer DEFAULT 0,
  logging_streak integer DEFAULT 0,
  daily_average numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hub_user_stats_pkey PRIMARY KEY (id),
  CONSTRAINT hub_user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT hub_user_stats_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id)
);
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
  CONSTRAINT item_alert_presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.item_alerts (
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
  CONSTRAINT item_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT item_alerts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.item_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  storage_key text,
  file_url text,
  mime_type text,
  size_bytes bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT item_attachments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.item_categories (
  item_id uuid NOT NULL,
  category_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT item_categories_pkey PRIMARY KEY (item_id, category_id),
  CONSTRAINT item_categories_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.item_recurrence_exceptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  exdate timestamp with time zone NOT NULL,
  override_payload_json jsonb,
  CONSTRAINT item_recurrence_exceptions_pkey PRIMARY KEY (id),
  CONSTRAINT item_recurrence_exceptions_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.item_recurrence_rules(id)
);
CREATE TABLE public.item_recurrence_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  rrule text NOT NULL,
  start_anchor timestamp with time zone NOT NULL,
  end_until timestamp with time zone,
  count integer,
  CONSTRAINT item_recurrence_rules_pkey PRIMARY KEY (id),
  CONSTRAINT item_recurrence_rules_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.item_snoozes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL,
  item_id uuid NOT NULL,
  snoozed_until timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_snoozes_pkey PRIMARY KEY (id),
  CONSTRAINT item_snoozes_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.item_alerts(id),
  CONSTRAINT item_snoozes_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.item_subtasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_item_id uuid NOT NULL,
  title text NOT NULL,
  done_at timestamp with time zone,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_subtasks_pkey PRIMARY KEY (id),
  CONSTRAINT item_subtasks_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.items(id)
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
  CONSTRAINT items_responsible_user_fkey FOREIGN KEY (responsible_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.merchant_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  merchant_pattern text NOT NULL,
  merchant_name text NOT NULL,
  category_id uuid,
  subcategory_id uuid,
  account_id uuid,
  use_count integer DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT merchant_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT merchant_mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT merchant_mappings_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.user_categories(id),
  CONSTRAINT merchant_mappings_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.user_categories(id),
  CONSTRAINT merchant_mappings_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id)
);
CREATE TABLE public.notification_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_id uuid,
  subscription_id uuid,
  title text NOT NULL,
  body text,
  tag text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'clicked'::text, 'dismissed'::text])),
  error_message text,
  sent_at timestamp with time zone,
  clicked_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_logs_pkey PRIMARY KEY (id),
  CONSTRAINT notification_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT notification_logs_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.item_alerts(id),
  CONSTRAINT notification_logs_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.push_subscriptions(id)
);
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_name text,
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.recurring_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  category_id uuid,
  subcategory_id uuid,
  name text NOT NULL,
  amount numeric NOT NULL,
  description text,
  recurrence_type text NOT NULL CHECK (recurrence_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text])),
  recurrence_day integer,
  next_due_date date NOT NULL,
  last_processed_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recurring_payments_pkey PRIMARY KEY (id),
  CONSTRAINT recurring_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT recurring_payments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT recurring_payments_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.user_categories(id),
  CONSTRAINT recurring_payments_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.user_categories(id)
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
CREATE TABLE public.reminder_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  item_type text NOT NULL DEFAULT 'task'::text CHECK (item_type = ANY (ARRAY['reminder'::text, 'event'::text, 'task'::text])),
  default_duration_minutes integer,
  default_start_time time without time zone,
  location_text text,
  icon text DEFAULT 'clipboard-list'::text,
  color text DEFAULT '#38bdf8'::text,
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reminder_templates_pkey PRIMARY KEY (id),
  CONSTRAINT reminder_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.statement_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  transactions_count integer DEFAULT 0,
  status text DEFAULT 'completed'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  CONSTRAINT statement_imports_pkey PRIMARY KEY (id),
  CONSTRAINT statement_imports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.subtasks (
  id text NOT NULL,
  task_id text NOT NULL,
  title text NOT NULL,
  done integer DEFAULT 0,
  position integer DEFAULT 0,
  CONSTRAINT subtasks_pkey PRIMARY KEY (id),
  CONSTRAINT subtasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.tags (
  id text NOT NULL,
  name text NOT NULL UNIQUE,
  user_id uuid,
  CONSTRAINT tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.task_tags (
  task_id text NOT NULL,
  tag_id text NOT NULL,
  CONSTRAINT task_tags_pkey PRIMARY KEY (task_id, tag_id),
  CONSTRAINT task_tags_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT task_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.tasks (
  id text NOT NULL,
  title text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'todo'::text CHECK (status = ANY (ARRAY['todo'::text, 'done'::text])),
  priority integer DEFAULT 0,
  due_at bigint,
  start_at bigint,
  all_day integer DEFAULT 0,
  list_id text,
  repeat_rule text,
  timezone text,
  remind_at bigint,
  snooze_until bigint,
  created_at bigint NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
  updated_at bigint NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
  completed_at bigint,
  search tsvector,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.transaction_templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  account_id uuid,
  category_id uuid,
  subcategory_id uuid,
  amount numeric NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transaction_templates_pkey PRIMARY KEY (id),
  CONSTRAINT transaction_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT transaction_templates_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT transaction_templates_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.user_categories(id),
  CONSTRAINT transaction_templates_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.user_categories(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  amount numeric NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  inserted_at timestamp with time zone NOT NULL DEFAULT now(),
  account_id uuid NOT NULL,
  category_id uuid,
  subcategory_id uuid,
  is_draft boolean NOT NULL DEFAULT false,
  voice_transcript text,
  confidence_score numeric,
  is_private boolean NOT NULL DEFAULT false,
  is_imported boolean NOT NULL DEFAULT false,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_category_fk FOREIGN KEY (category_id) REFERENCES public.user_categories(id),
  CONSTRAINT transactions_subcategory_fk FOREIGN KEY (subcategory_id) REFERENCES public.user_categories(id),
  CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#38bdf8'::text,
  inserted_at timestamp with time zone NOT NULL DEFAULT now(),
  parent_id uuid,
  account_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0 CHECK ("position" >= 0),
  visible boolean NOT NULL DEFAULT true,
  default_category_id uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  slug text DEFAULT lower(regexp_replace(name, '[^a-z0-9]+'::text, '-'::text, 'g'::text)),
  CONSTRAINT user_categories_pkey PRIMARY KEY (id),
  CONSTRAINT user_categories_default_fk FOREIGN KEY (default_category_id) REFERENCES public.default_categories(id),
  CONSTRAINT user_categories_parent_fk FOREIGN KEY (user_id) REFERENCES public.user_categories(id),
  CONSTRAINT user_categories_parent_fk FOREIGN KEY (parent_id) REFERENCES public.user_categories(id),
  CONSTRAINT user_categories_parent_fk FOREIGN KEY (user_id) REFERENCES public.user_categories(user_id),
  CONSTRAINT user_categories_parent_fk FOREIGN KEY (parent_id) REFERENCES public.user_categories(user_id),
  CONSTRAINT user_categories_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id)
);
CREATE TABLE public.user_onboarding (
  user_id uuid NOT NULL,
  account_type text NOT NULL CHECK (account_type = ANY (ARRAY['individual'::text, 'household'::text])),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_onboarding_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_onboarding_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_preferences (
  user_id uuid NOT NULL,
  theme text NOT NULL DEFAULT '''dark''::text'::text CHECK (theme = ANY (ARRAY['light'::text, 'dark'::text, 'wood'::text, 'system'::text, 'blue'::text, 'pink'::text])),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  section_order jsonb DEFAULT '["amount", "account", "category", "subcategory", "description"]'::jsonb,
  date_start text DEFAULT '''mon-1''::text'::text,
  CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.webauthn_credentials (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter integer NOT NULL,
  transports ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id),
  CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

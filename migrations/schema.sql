-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.account_balance_archives (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  year_month text NOT NULL,
  month_start_date date NOT NULL,
  month_end_date date NOT NULL,
  opening_balance numeric NOT NULL,
  closing_balance numeric NOT NULL,
  total_transaction_count integer NOT NULL DEFAULT 0,
  total_income numeric NOT NULL DEFAULT 0,
  total_expenses numeric NOT NULL DEFAULT 0,
  net_change numeric NOT NULL DEFAULT 0,
  total_transfers_in numeric NOT NULL DEFAULT 0,
  total_transfers_out numeric NOT NULL DEFAULT 0,
  transfer_count integer NOT NULL DEFAULT 0,
  total_adjustments numeric NOT NULL DEFAULT 0,
  adjustment_count integer NOT NULL DEFAULT 0,
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT account_balance_archives_pkey PRIMARY KEY (id),
  CONSTRAINT aba_account_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT aba_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.account_balance_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  previous_balance numeric NOT NULL DEFAULT 0,
  new_balance numeric NOT NULL,
  change_amount numeric NOT NULL,
  change_type text NOT NULL CHECK (change_type = ANY (ARRAY['initial_set'::text, 'manual_set'::text, 'manual_adjustment'::text, 'transfer_in'::text, 'transfer_out'::text, 'transaction_expense'::text, 'transaction_income'::text, 'transaction_deleted'::text, 'split_bill_paid'::text, 'split_bill_received'::text, 'draft_confirmed'::text, 'correction'::text, 'transaction'::text, 'transfer'::text, 'split_bill'::text, 'future_payment'::text, 'debt_settled'::text, 'auto_reconciliation'::text, 'statement_import'::text])),
  transaction_id uuid,
  transfer_id uuid,
  reason text,
  is_reconciliation boolean NOT NULL DEFAULT false,
  expected_balance numeric,
  discrepancy_amount numeric,
  discrepancy_explanation text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT account_balance_history_pkey PRIMARY KEY (id),
  CONSTRAINT abh_account_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT abh_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT abh_transaction_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT abh_transfer_fkey FOREIGN KEY (transfer_id) REFERENCES public.transfers(id)
);
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
CREATE TABLE public.account_daily_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  summary_date date NOT NULL,
  opening_balance numeric NOT NULL,
  closing_balance numeric NOT NULL,
  transaction_count integer NOT NULL DEFAULT 0,
  income_count integer NOT NULL DEFAULT 0,
  expense_count integer NOT NULL DEFAULT 0,
  total_income numeric NOT NULL DEFAULT 0,
  total_expenses numeric NOT NULL DEFAULT 0,
  net_transactions numeric NOT NULL DEFAULT 0,
  largest_income numeric,
  largest_income_desc text,
  largest_expense numeric,
  largest_expense_desc text,
  category_breakdown jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false,
  CONSTRAINT account_daily_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT ads_account_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT ads_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text, 'saving'::text])),
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
  model_used text DEFAULT 'gemini-flash-latest'::text,
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
CREATE TABLE public.ai_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  request_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_rate_limits_pkey PRIMARY KEY (id),
  CONSTRAINT ai_rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
CREATE TABLE public.ai_budget_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  budget_month text NOT NULL,
  week text NOT NULL CHECK (week = ANY (ARRAY['w0'::text, 'w1'::text, 'w2'::text, 'w3'::text, 'w4'::text])),
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  wallet_balance_used numeric NOT NULL DEFAULT 0,
  total_suggested numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_budget_suggestions_pkey PRIMARY KEY (id),
  CONSTRAINT ai_budget_suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT ai_budget_suggestions_unique UNIQUE (user_id, budget_month, week)
);
ALTER TABLE public.ai_budget_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own ai_budget_suggestions" ON public.ai_budget_suggestions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_budget_suggestions" ON public.ai_budget_suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_budget_suggestions" ON public.ai_budget_suggestions FOR DELETE USING (auth.uid() = user_id);
CREATE TABLE public.catalogue_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  parent_id uuid,
  depth integer NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 5),
  path text NOT NULL DEFAULT ''::text,
  icon text DEFAULT 'tag'::text,
  color text,
  position integer NOT NULL DEFAULT 0,
  is_expanded boolean NOT NULL DEFAULT true,
  archived_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_public boolean NOT NULL DEFAULT true,
  CONSTRAINT catalogue_categories_pkey PRIMARY KEY (id),
  CONSTRAINT catalogue_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT catalogue_categories_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.catalogue_modules(id),
  CONSTRAINT catalogue_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.catalogue_categories(id)
);
CREATE TABLE public.catalogue_item_calendar_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  catalogue_item_id uuid NOT NULL,
  item_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['added_to_calendar'::text, 'removed_from_calendar'::text, 'updated_recurrence'::text, 'paused'::text, 'resumed'::text])),
  recurrence_start_date date,
  recurrence_end_date date,
  recurrence_pattern text,
  recurrence_rrule text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_item_calendar_history_pkey PRIMARY KEY (id),
  CONSTRAINT cich_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT cich_catalogue_item_fkey FOREIGN KEY (catalogue_item_id) REFERENCES public.catalogue_items(id),
  CONSTRAINT cich_item_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);
CREATE TABLE public.catalogue_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL,
  category_id uuid,
  name text NOT NULL,
  description text,
  notes text,
  status USER-DEFINED NOT NULL DEFAULT 'active'::catalogue_item_status,
  priority USER-DEFINED NOT NULL DEFAULT 'normal'::catalogue_priority,
  icon text,
  color text,
  image_url text,
  position integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_favorite boolean NOT NULL DEFAULT false,
  tags ARRAY DEFAULT '{}'::text[],
  metadata_json jsonb DEFAULT '{}'::jsonb,
  progress_current numeric DEFAULT 0,
  progress_target numeric,
  progress_unit text,
  next_due_date date,
  frequency text,
  last_completed_at timestamp with time zone,
  archived_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  item_type text DEFAULT 'task'::text CHECK (item_type IS NULL OR (item_type = ANY (ARRAY['reminder'::text, 'event'::text, 'task'::text]))),
  location_context text CHECK (location_context IS NULL OR (location_context = ANY (ARRAY['home'::text, 'outside'::text, 'anywhere'::text]))),
  location_url text,
  preferred_time time without time zone,
  preferred_duration_minutes integer,
  recurrence_pattern text CHECK (recurrence_pattern IS NULL OR (recurrence_pattern = ANY (ARRAY['daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text]))),
  recurrence_custom_rrule text,
  recurrence_days_of_week ARRAY DEFAULT '{}'::integer[],
  subtasks_text text,
  is_active_on_calendar boolean DEFAULT false,
  linked_item_id uuid,
  item_category_ids ARRAY DEFAULT '{}'::text[],
  is_public boolean DEFAULT false,
  is_flexible_routine boolean NOT NULL DEFAULT false,
  flexible_occurrences integer NOT NULL DEFAULT 1 CHECK (flexible_occurrences >= 1 AND flexible_occurrences <= 31),
  CONSTRAINT catalogue_items_pkey PRIMARY KEY (id),
  CONSTRAINT catalogue_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT catalogue_items_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.catalogue_modules(id),
  CONSTRAINT catalogue_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.catalogue_categories(id),
  CONSTRAINT catalogue_items_linked_item_fkey FOREIGN KEY (linked_item_id) REFERENCES public.items(id)
);
CREATE TABLE public.catalogue_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type USER-DEFINED NOT NULL DEFAULT 'custom'::catalogue_module_type,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'folder'::text,
  color text NOT NULL DEFAULT '#3b82f6'::text,
  gradient_from text,
  gradient_to text,
  is_system boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  settings_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_public boolean NOT NULL DEFAULT true,
  CONSTRAINT catalogue_modules_pkey PRIMARY KEY (id),
  CONSTRAINT catalogue_modules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.catalogue_sub_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  position integer NOT NULL DEFAULT 0,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_sub_items_pkey PRIMARY KEY (id),
  CONSTRAINT catalogue_sub_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT catalogue_sub_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.catalogue_items(id)
);
CREATE TABLE public.cooking_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL,
  user_id uuid NOT NULL,
  version_id uuid,
  actual_prep_minutes integer,
  actual_cook_minutes integer,
  perceived_difficulty text CHECK (perceived_difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  substitutions jsonb DEFAULT '[]'::jsonb,
  servings_made integer,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  taste_notes text,
  general_notes text,
  would_make_again boolean,
  cooked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cooking_logs_pkey PRIMARY KEY (id),
  CONSTRAINT cooking_logs_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id),
  CONSTRAINT cooking_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT cooking_logs_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.recipe_versions(id)
);
CREATE TABLE public.debts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  debtor_name text NOT NULL,
  original_amount numeric NOT NULL CHECK (original_amount > 0::numeric),
  returned_amount numeric NOT NULL DEFAULT 0 CHECK (returned_amount >= 0::numeric),
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'archived'::text, 'closed'::text])),
  notes text,
  archived_at timestamp with time zone,
  closed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT debts_pkey PRIMARY KEY (id),
  CONSTRAINT debts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT debts_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
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
  location_text text, -- DEPRECATED: use items.location_text. Kept for backward compatibility.
  CONSTRAINT event_details_pkey PRIMARY KEY (item_id),
  CONSTRAINT event_details_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
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
CREATE TABLE public.guest_allergies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  session_id uuid NOT NULL,
  guest_name text,
  allergies text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT guest_allergies_pkey PRIMARY KEY (id),
  CONSTRAINT guest_allergies_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.guest_portal_tags(id),
  CONSTRAINT guest_allergies_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.guest_sessions(id)
);
CREATE TABLE public.guest_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  session_id uuid NOT NULL,
  sender text NOT NULL CHECK (sender = ANY (ARRAY['guest'::text, 'host'::text, 'bot'::text])),
  message text NOT NULL,
  guest_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT guest_chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT guest_chat_messages_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.guest_portal_tags(id),
  CONSTRAINT guest_chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.guest_sessions(id)
);
CREATE TABLE public.guest_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  feedback_type text NOT NULL CHECK (feedback_type = ANY (ARRAY['suggestion'::text, 'complaint'::text])),
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT guest_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT guest_feedback_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.guest_portal_tags(id)
);
CREATE TABLE public.guest_portal_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tag_slug text NOT NULL UNIQUE,
  label text,
  destination text NOT NULL DEFAULT 'welcome'::text,
  is_active boolean NOT NULL DEFAULT true,
  wifi_ssid text,
  wifi_password text,
  bio_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT guest_portal_tags_pkey PRIMARY KEY (id),
  CONSTRAINT guest_portal_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.guest_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  guest_name text,
  fingerprint text,
  user_agent text,
  ip_hash text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT guest_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT guest_sessions_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.guest_portal_tags(id)
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
CREATE TABLE public.household_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_email text,
  role text NOT NULL DEFAULT 'member'::text CHECK (role = ANY (ARRAY['owner'::text, 'partner'::text, 'viewer'::text])),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT household_members_pkey PRIMARY KEY (id),
  CONSTRAINT household_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id),
  CONSTRAINT household_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
  enable_item_urls boolean DEFAULT false,
  is_private boolean DEFAULT false,
  color text,
  deleted_at timestamp with time zone,
  CONSTRAINT hub_chat_threads_pkey PRIMARY KEY (id),
  CONSTRAINT hub_chat_threads_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id),
  CONSTRAINT hub_chat_threads_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
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
  CONSTRAINT hub_feed_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
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
  push_status text CHECK (push_status IS NULL OR (push_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text]))),
  push_sent_at timestamp with time zone,
  push_error text,
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
  archived_at timestamp with time zone,
  archived_reason text CHECK (archived_reason IS NULL OR (archived_reason = ANY (ARRAY['shopping_cleared'::text, 'transaction_created'::text, 'reminder_completed'::text, 'monthly_cleanup'::text, 'manual'::text]))),
  checked_at timestamp with time zone,
  checked_by uuid,
  item_url text,
  topic_id uuid,
  item_quantity text,
  has_links boolean DEFAULT false,
  source text DEFAULT 'user'::text CHECK (source = ANY (ARRAY['user'::text, 'inventory'::text, 'system'::text, 'ai'::text])),
  source_item_id uuid,
  voice_url text,
  voice_transcript text,
  voice_duration integer,
  meal_plan_id uuid,
  item_sort_order float,
  parent_item_id uuid,
  item_chat_photo_url text,
  CONSTRAINT hub_messages_pkey PRIMARY KEY (id),
  CONSTRAINT hub_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.hub_chat_threads(id),
  CONSTRAINT hub_messages_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id),
  CONSTRAINT hub_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES auth.users(id),
  CONSTRAINT hub_messages_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT hub_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.hub_messages(id),
  CONSTRAINT hub_messages_source_item_id_fkey FOREIGN KEY (source_item_id) REFERENCES public.catalogue_items(id),
  CONSTRAINT hub_messages_meal_plan_id_fkey FOREIGN KEY (meal_plan_id) REFERENCES public.meal_plans(id),
  CONSTRAINT hub_messages_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES auth.users(id),
  CONSTRAINT hub_messages_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.hub_notes_topics(id),
  CONSTRAINT hub_messages_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.hub_messages(id) ON DELETE CASCADE
);
CREATE TABLE public.hub_notes_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled'::text,
  icon text DEFAULT '📄'::text,
  color text DEFAULT '#3b82f6'::text,
  position integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hub_notes_topics_pkey PRIMARY KEY (id),
  CONSTRAINT hub_notes_topics_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.hub_chat_threads(id),
  CONSTRAINT hub_notes_topics_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
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
CREATE TABLE public.inventory_restock_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stock_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity_added numeric NOT NULL,
  quantity_before numeric NOT NULL DEFAULT 0,
  quantity_after numeric NOT NULL,
  source text NOT NULL DEFAULT 'manual'::text,
  restocked_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_restock_history_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_restock_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT inventory_restock_history_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.inventory_stock(id),
  CONSTRAINT inventory_restock_history_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.catalogue_items(id)
);
CREATE TABLE public.inventory_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity_on_hand numeric NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0::numeric),
  last_restocked_at timestamp with time zone DEFAULT now(),
  last_restocked_quantity numeric,
  estimated_runout_date date,
  auto_add_to_shopping boolean NOT NULL DEFAULT true,
  shopping_thread_id uuid,
  shopping_message_id uuid,
  last_added_to_shopping_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_stock_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_stock_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT inventory_stock_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.catalogue_items(id)
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
  CONSTRAINT item_alerts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
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
  CONSTRAINT item_attachments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
);
CREATE TABLE public.item_occurrence_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  occurrence_date timestamp with time zone NOT NULL,
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['completed'::text, 'postponed'::text, 'cancelled'::text, 'skipped'::text])),
  postponed_to timestamp with time zone,
  postpone_type text CHECK (postpone_type = ANY (ARRAY['next_occurrence'::text, 'tomorrow'::text, 'custom'::text, 'ai_slot'::text])),
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT item_occurrence_actions_pkey PRIMARY KEY (id),
  CONSTRAINT item_occurrence_actions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE,
  CONSTRAINT item_occurrence_actions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.item_recurrence_exceptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  exdate timestamp with time zone NOT NULL,
  override_payload_json jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_recurrence_exceptions_pkey PRIMARY KEY (id),
  CONSTRAINT item_recurrence_exceptions_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.item_recurrence_rules(id) ON DELETE CASCADE
);
CREATE TABLE public.item_recurrence_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  rrule text NOT NULL,
  start_anchor timestamp with time zone NOT NULL,
  end_until timestamp with time zone,
  count integer,
  phase_changed_at timestamp with time zone,
  previous_start_anchor timestamp with time zone,
  is_flexible boolean NOT NULL DEFAULT false,
  flexible_period text CHECK (flexible_period IS NULL OR (flexible_period = ANY (ARRAY['daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text]))),
  CONSTRAINT item_recurrence_rules_pkey PRIMARY KEY (id),
  CONSTRAINT item_recurrence_rules_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
);

-- Flexible routine schedules: one row per scheduled occurrence per period.
-- For N-times-per-period routines, occurrence_index distinguishes the slot (0..N-1).
CREATE TABLE public.item_flexible_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  period_start_date date NOT NULL,
  scheduled_for_date date NOT NULL,
  scheduled_for_time time without time zone,
  occurrence_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT item_flexible_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT item_flexible_schedules_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE,
  CONSTRAINT item_flexible_schedules_unique_slot UNIQUE (item_id, period_start_date, occurrence_index)
);
CREATE TABLE public.recurrence_pauses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  pause_start date NOT NULL,
  pause_end date,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT recurrence_pauses_pkey PRIMARY KEY (id),
  CONSTRAINT recurrence_pauses_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE,
  CONSTRAINT recurrence_pauses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE INDEX idx_recurrence_pauses_item_id ON public.recurrence_pauses(item_id);
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
CREATE TABLE public.item_subtask_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subtask_id uuid NOT NULL,
  occurrence_date timestamp with time zone NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_subtask_completions_pkey PRIMARY KEY (id),
  CONSTRAINT item_subtask_completions_subtask_id_fkey FOREIGN KEY (subtask_id) REFERENCES public.item_subtasks(id) ON DELETE CASCADE,
  CONSTRAINT item_subtask_completions_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.item_subtasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_item_id uuid NOT NULL,
  title text NOT NULL,
  done_at timestamp with time zone,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  occurrence_date timestamp with time zone,
  parent_subtask_id uuid,
  priority integer,
  kanban_stage text DEFAULT '''To Do''::text'::text,
  previous_kanban_stage text,
  CONSTRAINT item_subtasks_pkey PRIMARY KEY (id),
  CONSTRAINT item_subtasks_parent_subtask_id_fkey FOREIGN KEY (parent_subtask_id) REFERENCES public.item_subtasks(id) ON DELETE CASCADE,
  CONSTRAINT item_subtasks_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.items(id) ON DELETE CASCADE
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
  categories ARRAY DEFAULT '{}'::text[],
  subtask_kanban_stages jsonb DEFAULT '["To Do", "Later", "In Progress", "Done"]'::jsonb,
  subtask_kanban_enabled boolean DEFAULT false,
  location_context text CHECK (location_context IS NULL OR (location_context = ANY (ARRAY['home'::text, 'outside'::text, 'anywhere'::text]))),
  location_text text,
  CONSTRAINT items_pkey PRIMARY KEY (id),
  CONSTRAINT items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT items_responsible_user_fkey FOREIGN KEY (responsible_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.meal_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  household_id uuid NOT NULL,
  recipe_id uuid NOT NULL,
  planned_date date NOT NULL,
  meal_type text DEFAULT 'lunch'::text CHECK (meal_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text])),
  status text DEFAULT 'planned'::text CHECK (status = ANY (ARRAY['planned'::text, 'shopping_added'::text, 'cooked'::text, 'skipped'::text])),
  cooked_at timestamp with time zone,
  notes text,
  shopping_thread_id uuid,
  shopping_message_ids ARRAY DEFAULT '{}'::uuid[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT meal_plans_pkey PRIMARY KEY (id),
  CONSTRAINT meal_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT meal_plans_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id),
  CONSTRAINT meal_plans_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id),
  CONSTRAINT meal_plans_shopping_thread_id_fkey FOREIGN KEY (shopping_thread_id) REFERENCES public.hub_chat_threads(id)
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
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  preference_key text NOT NULL,
  enabled boolean DEFAULT true,
  frequency text DEFAULT 'daily'::text,
  custom_cron text,
  timezone text DEFAULT 'UTC'::text,
  days_of_week ARRAY DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7],
  quiet_start time without time zone,
  quiet_end time without time zone,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_sent_at timestamp with time zone,
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  icon text DEFAULT 'bell'::text,
  source USER-DEFINED NOT NULL DEFAULT 'system'::notification_source_enum,
  priority USER-DEFINED NOT NULL DEFAULT 'normal'::item_priority_enum,
  action_type USER-DEFINED,
  action_data jsonb,
  action_completed_at timestamp with time zone,
  alert_id uuid,
  item_id uuid,
  transaction_id uuid,
  is_read boolean DEFAULT false,
  is_dismissed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  group_key text,
  notification_type USER-DEFINED DEFAULT 'info'::notification_type_enum,
  push_sent_at timestamp with time zone,
  push_status text CHECK (push_status IS NULL OR (push_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'clicked'::text, 'dismissed'::text]))),
  push_error text,
  severity text DEFAULT 'info'::text CHECK (severity = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text, 'action'::text])),
  recurring_payment_id uuid,
  category_id uuid,
  household_id uuid,
  message_id uuid,
  action_url text,
  action_taken boolean DEFAULT false,
  snoozed_until timestamp with time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT in_app_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT in_app_notifications_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE,
  CONSTRAINT in_app_notifications_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT notifications_recurring_payment_id_fkey FOREIGN KEY (recurring_payment_id) REFERENCES public.recurring_payments(id),
  CONSTRAINT notifications_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.user_categories(id),
  CONSTRAINT notifications_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
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
  failed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON public.push_subscriptions (user_id) WHERE is_active = true;
CREATE TABLE public.push_event_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  subscription_id uuid,
  event_type text NOT NULL,
  device_name text,
  endpoint_preview text,
  error_code integer,
  error_message text,
  notification_id uuid,
  notification_title text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_event_logs_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_push_event_logs_user_created
  ON public.push_event_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_event_logs_event_type
  ON public.push_event_logs (event_type, created_at DESC);
CREATE TABLE public.recipe_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL,
  user_id uuid NOT NULL,
  version_label text NOT NULL,
  source text NOT NULL DEFAULT 'user'::text,
  is_active boolean DEFAULT false,
  ingredients jsonb DEFAULT '[]'::jsonb,
  steps jsonb DEFAULT '[]'::jsonb,
  prep_time_minutes integer,
  cook_time_minutes integer,
  servings integer DEFAULT 4,
  difficulty text DEFAULT 'medium'::text CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  category text,
  cuisine text,
  tags ARRAY DEFAULT '{}'::text[],
  description text,
  ai_prompt text,
  ai_reasoning text,
  tokens_used integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recipe_versions_pkey PRIMARY KEY (id),
  CONSTRAINT recipe_versions_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id),
  CONSTRAINT recipe_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  household_id uuid,
  name text NOT NULL,
  description text,
  image_url text,
  source_url text,
  ingredients jsonb DEFAULT '[]'::jsonb,
  steps jsonb DEFAULT '[]'::jsonb,
  prep_time_minutes integer,
  cook_time_minutes integer,
  servings integer DEFAULT 4,
  difficulty text DEFAULT 'medium'::text CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  category text,
  cuisine text,
  tags ARRAY DEFAULT '{}'::text[],
  ai_generated boolean DEFAULT false,
  ai_generation_prompt text,
  last_ai_update timestamp with time zone,
  feedback jsonb DEFAULT '[]'::jsonb,
  times_cooked integer DEFAULT 0,
  last_cooked_at timestamp with time zone,
  average_rating numeric,
  is_favorite boolean DEFAULT false,
  archived_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  active_version_id uuid,
  CONSTRAINT recipes_pkey PRIMARY KEY (id),
  CONSTRAINT recipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT recipes_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id),
  CONSTRAINT recipes_active_version_id_fkey FOREIGN KEY (active_version_id) REFERENCES public.recipe_versions(id)
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
  lbp_change_received numeric,
  is_private boolean NOT NULL DEFAULT false,
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
  actual_minutes integer CHECK (actual_minutes IS NULL OR actual_minutes >= 0),
  has_checklist boolean NOT NULL DEFAULT false,
  CONSTRAINT reminder_details_pkey PRIMARY KEY (item_id),
  CONSTRAINT reminder_details_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
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
CREATE TABLE public.shopping_item_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  url text NOT NULL,
  store_name text,
  product_title text,
  price numeric,
  currency text DEFAULT 'USD'::text,
  stock_status text,
  stock_quantity integer,
  image_url text,
  extra_info jsonb,
  last_fetched_at timestamp with time zone,
  fetch_error text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shopping_item_links_pkey PRIMARY KEY (id),
  CONSTRAINT shopping_item_links_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.hub_messages(id),
  CONSTRAINT shopping_item_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
  split_requested boolean DEFAULT false,
  collaborator_id uuid,
  collaborator_amount numeric,
  collaborator_description text,
  split_completed_at timestamp with time zone,
  collaborator_account_id uuid,
  lbp_change_received numeric,
  scheduled_date date,
  is_debt_return boolean NOT NULL DEFAULT false,
  parent_transaction_id uuid,
  statement_hash text,
  receipt_url text,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_category_fk FOREIGN KEY (category_id) REFERENCES public.user_categories(id),
  CONSTRAINT transactions_subcategory_fk FOREIGN KEY (subcategory_id) REFERENCES public.user_categories(id),
  CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT transactions_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES auth.users(id),
  CONSTRAINT transactions_collaborator_account_id_fkey FOREIGN KEY (collaborator_account_id) REFERENCES public.accounts(id),
  CONSTRAINT transactions_parent_transaction_id_fkey FOREIGN KEY (parent_transaction_id) REFERENCES public.transactions(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_statement_hash_uniq
  ON public.transactions(user_id, statement_hash)
  WHERE statement_hash IS NOT NULL;
CREATE TABLE public.transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_account_id uuid NOT NULL,
  to_account_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  description text DEFAULT ''::text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  transfer_type text NOT NULL DEFAULT 'self'::text CHECK (transfer_type = ANY (ARRAY['self'::text, 'household'::text])),
  recipient_user_id uuid,
  fee_amount numeric DEFAULT 0 CHECK (fee_amount >= 0::numeric),
  returned_amount numeric DEFAULT 0 CHECK (returned_amount >= 0::numeric),
  household_link_id uuid,
  CONSTRAINT transfers_pkey PRIMARY KEY (id),
  CONSTRAINT transfers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT transfers_from_account_id_fkey FOREIGN KEY (from_account_id) REFERENCES public.accounts(id),
  CONSTRAINT transfers_to_account_id_fkey FOREIGN KEY (to_account_id) REFERENCES public.accounts(id),
  CONSTRAINT transfers_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id),
  CONSTRAINT transfers_household_link_id_fkey FOREIGN KEY (household_link_id) REFERENCES public.household_links(id)
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
  CONSTRAINT user_categories_parent_fk FOREIGN KEY (user_id) REFERENCES public.user_categories(user_id),
  CONSTRAINT user_categories_parent_fk FOREIGN KEY (parent_id) REFERENCES public.user_categories(id),
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
  theme text NOT NULL DEFAULT '''dark''::text'::text CHECK (theme = ANY (ARRAY['light'::text, 'dark'::text, 'frost'::text, 'calm'::text, 'system'::text, 'blue'::text, 'pink'::text])),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  section_order jsonb DEFAULT '["amount", "account", "category", "subcategory", "description"]'::jsonb,
  date_start text DEFAULT '''mon-1''::text'::text,
  lbp_exchange_rate numeric,
  CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ============================================
-- NFC TAGS
-- ============================================
-- NOTE: item_status_enum was altered to include 'dormant':
-- ALTER TYPE item_status_enum ADD VALUE IF NOT EXISTS 'dormant';

CREATE TABLE public.nfc_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tag_slug text NOT NULL,
  label text NOT NULL,
  location_name text,
  icon text,
  states jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_state text,
  is_active boolean NOT NULL DEFAULT true,
  checklists jsonb NOT NULL DEFAULT '{}'::jsonb, -- { "leaving": [{ id, title, order }], ... }
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nfc_tags_pkey PRIMARY KEY (id),
  CONSTRAINT nfc_tags_tag_slug_key UNIQUE (tag_slug),
  CONSTRAINT nfc_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.nfc_state_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  previous_state text,
  new_state text NOT NULL,
  changed_by uuid NOT NULL,
  metadata_json jsonb,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nfc_state_log_pkey PRIMARY KEY (id),
  CONSTRAINT nfc_state_log_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.nfc_tags(id) ON DELETE CASCADE,
  CONSTRAINT nfc_state_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id)
);

CREATE INDEX idx_nfc_state_log_tag_id ON public.nfc_state_log (tag_id, changed_at DESC);

-- ============================================
-- ITEM PREREQUISITES (Trigger Engine)
-- ============================================
-- Condition types: nfc_state_change, item_completed, weather, time_window, schedule, custom_formula
-- Logic: prerequisites in the same logic_group are ANDed; different groups are ORed
-- Example: (group 0: nfc_state=leaving AND time_window=morning) OR (group 1: item_completed=pack-bag)

CREATE TABLE public.item_prerequisites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  condition_type text NOT NULL CHECK (condition_type IN ('nfc_state_change', 'item_completed', 'weather', 'time_window', 'schedule', 'custom_formula')),
  condition_config jsonb NOT NULL,
  logic_group integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  last_evaluated_at timestamp with time zone,
  last_result boolean,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_prerequisites_pkey PRIMARY KEY (id),
  CONSTRAINT item_prerequisites_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
);

CREATE INDEX idx_item_prerequisites_item_id ON public.item_prerequisites (item_id);
CREATE INDEX idx_item_prerequisites_condition_type ON public.item_prerequisites (condition_type) WHERE is_active = true;

-- ============================================
-- NFC CHECKLIST ITEMS (replaces jsonb checklists on nfc_tags)
-- ============================================
-- Persistent checklist definitions per tag + state.
-- source_tag_id / source_state enable cross-tag awareness:
--   e.g. "Turn off Oven" on main-door auto-checks when oven NFC current_state = 'off'

CREATE TABLE public.nfc_checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  state text NOT NULL,
  title text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  source_tag_id uuid,
  source_state text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nfc_checklist_items_pkey PRIMARY KEY (id),
  CONSTRAINT nfc_checklist_items_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.nfc_tags(id) ON DELETE CASCADE,
  CONSTRAINT nfc_checklist_items_source_tag_id_fkey FOREIGN KEY (source_tag_id) REFERENCES public.nfc_tags(id) ON DELETE SET NULL
);

CREATE INDEX idx_nfc_checklist_items_tag_state ON public.nfc_checklist_items (tag_id, state) WHERE is_active = true;

-- ============================================
-- NFC CHECKLIST COMPLETIONS (per tap session)
-- ============================================
-- Each completion is scoped to a specific state_log entry (tap session).
-- On next tap for the same state, a new state_log is created → fresh session.

CREATE TABLE public.nfc_checklist_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  checklist_item_id uuid NOT NULL,
  state_log_id uuid NOT NULL,
  completed_by uuid NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nfc_checklist_completions_pkey PRIMARY KEY (id),
  CONSTRAINT nfc_checklist_completions_item_fkey FOREIGN KEY (checklist_item_id) REFERENCES public.nfc_checklist_items(id) ON DELETE CASCADE,
  CONSTRAINT nfc_checklist_completions_log_fkey FOREIGN KEY (state_log_id) REFERENCES public.nfc_state_log(id) ON DELETE CASCADE,
  CONSTRAINT nfc_checklist_completions_user_fkey FOREIGN KEY (completed_by) REFERENCES auth.users(id),
  CONSTRAINT nfc_checklist_completions_unique UNIQUE (checklist_item_id, state_log_id)
);

-- ============================================
-- RLS POLICIES — ITEMS (household sharing)
-- ============================================
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_occurrence_actions ENABLE ROW LEVEL SECURITY;

-- items: own items + items assigned to me + partner's public items
CREATE POLICY "items_select" ON public.items FOR SELECT USING (
  user_id = auth.uid()
  OR responsible_user_id = auth.uid()
  OR (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM public.household_links
      WHERE active = true
      AND (
        (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
        OR (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
      )
    )
  )
);
CREATE POLICY "items_insert" ON public.items FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "items_update" ON public.items FOR UPDATE USING (
  user_id = auth.uid()
  OR responsible_user_id = auth.uid()
  OR (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM public.household_links
      WHERE active = true
      AND (
        (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
        OR (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
      )
    )
  )
);
CREATE POLICY "items_delete" ON public.items FOR DELETE USING (
  user_id = auth.uid()
  OR (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM public.household_links
      WHERE active = true
      AND (
        (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
        OR (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
      )
    )
  )
);

-- item_occurrence_actions: read/write for items you can access
CREATE POLICY "item_occurrence_actions_select" ON public.item_occurrence_actions FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_occurrence_actions.item_id
    AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (
        i.is_public = true
        AND EXISTS (
          SELECT 1 FROM public.household_links
          WHERE active = true
          AND (
            (owner_user_id = auth.uid() AND partner_user_id = i.user_id)
            OR (partner_user_id = auth.uid() AND owner_user_id = i.user_id)
          )
        )
      )
    )
  )
);
CREATE POLICY "item_occurrence_actions_insert" ON public.item_occurrence_actions FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_occurrence_actions.item_id
    AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (
        i.is_public = true
        AND EXISTS (
          SELECT 1 FROM public.household_links
          WHERE active = true
          AND (
            (owner_user_id = auth.uid() AND partner_user_id = i.user_id)
            OR (partner_user_id = auth.uid() AND owner_user_id = i.user_id)
          )
        )
      )
    )
  )
);

-- ============================================
-- RLS POLICIES — NFC TAGS (household sharing)
-- ============================================
ALTER TABLE public.nfc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_state_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_checklist_completions ENABLE ROW LEVEL SECURITY;

-- nfc_tags: owner or household partner
CREATE POLICY "nfc_tags_select" ON public.nfc_tags FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.household_links
    WHERE active = true
    AND (
      (owner_user_id = auth.uid() AND partner_user_id = nfc_tags.user_id)
      OR (partner_user_id = auth.uid() AND owner_user_id = nfc_tags.user_id)
    )
  )
);
CREATE POLICY "nfc_tags_insert" ON public.nfc_tags FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "nfc_tags_update" ON public.nfc_tags FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.household_links
    WHERE active = true
    AND (
      (owner_user_id = auth.uid() AND partner_user_id = nfc_tags.user_id)
      OR (partner_user_id = auth.uid() AND owner_user_id = nfc_tags.user_id)
    )
  )
);
CREATE POLICY "nfc_tags_delete" ON public.nfc_tags FOR DELETE USING (user_id = auth.uid());

-- nfc_state_log: readable by household, insertable by authenticated user
CREATE POLICY "nfc_state_log_select" ON public.nfc_state_log FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.nfc_tags t
    WHERE t.id = nfc_state_log.tag_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);
CREATE POLICY "nfc_state_log_insert" ON public.nfc_state_log FOR INSERT WITH CHECK (changed_by = auth.uid());

-- nfc_checklist_items: household can CRUD (both members manage)
CREATE POLICY "nfc_checklist_items_select" ON public.nfc_checklist_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.nfc_tags t
    WHERE t.id = nfc_checklist_items.tag_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);
CREATE POLICY "nfc_checklist_items_insert" ON public.nfc_checklist_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nfc_tags t
    WHERE t.id = nfc_checklist_items.tag_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);
CREATE POLICY "nfc_checklist_items_update" ON public.nfc_checklist_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.nfc_tags t
    WHERE t.id = nfc_checklist_items.tag_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);
CREATE POLICY "nfc_checklist_items_delete" ON public.nfc_checklist_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.nfc_tags t
    WHERE t.id = nfc_checklist_items.tag_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);

-- nfc_checklist_completions: household can read/write
CREATE POLICY "nfc_checklist_completions_select" ON public.nfc_checklist_completions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.nfc_checklist_items ci
    JOIN public.nfc_tags t ON t.id = ci.tag_id
    WHERE ci.id = nfc_checklist_completions.checklist_item_id
    AND (
      t.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = t.user_id)
          OR (partner_user_id = auth.uid() AND owner_user_id = t.user_id)
        )
      )
    )
  )
);
CREATE POLICY "nfc_checklist_completions_insert" ON public.nfc_checklist_completions FOR INSERT WITH CHECK (completed_by = auth.uid());
CREATE POLICY "nfc_checklist_completions_delete" ON public.nfc_checklist_completions FOR DELETE USING (completed_by = auth.uid());

-- =====================================================================
-- AI Usage module
-- Personal AI-model token-consumption tracker.
-- Data in ai_usage_models is OVERWRITTEN on each refresh cycle rollover
-- (current_usage_pct reset to 0, cycle_start_date advanced). No history
-- is stored on purpose. Session types survive as templates.
-- =====================================================================

CREATE TABLE public.ai_usage_models (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  refresh_frequency text NOT NULL CHECK (refresh_frequency = ANY (ARRAY['weekly'::text, 'monthly'::text])),
  cycle_start_date date NOT NULL DEFAULT CURRENT_DATE,
  cycle_start_day integer CHECK (cycle_start_day IS NULL OR (cycle_start_day >= 1 AND cycle_start_day <= 31)),
  -- Optional immutable anchor date. When set, cycles roll forward from this date
  -- (by 7 days for weekly, 1 calendar month for monthly), ignoring cycle_start_day.
  cycle_anchor_date date,
  current_usage_pct numeric(6,3) NOT NULL DEFAULT 0 CHECK (current_usage_pct >= 0::numeric),
  last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  position integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_models_pkey PRIMARY KEY (id),
  CONSTRAINT ai_usage_models_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT ai_usage_models_user_name_unique UNIQUE (user_id, name)
);
CREATE INDEX ai_usage_models_user_idx ON public.ai_usage_models (user_id, position);

CREATE TABLE public.ai_session_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model_id uuid NOT NULL,
  name text NOT NULL,
  estimated_usage_pct numeric(6,3) NOT NULL CHECK (estimated_usage_pct >= 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_session_types_pkey PRIMARY KEY (id),
  CONSTRAINT ai_session_types_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT ai_session_types_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_usage_models(id) ON DELETE CASCADE,
  CONSTRAINT ai_session_types_model_name_unique UNIQUE (model_id, name)
);
CREATE INDEX ai_session_types_model_idx ON public.ai_session_types (model_id);

ALTER TABLE public.ai_usage_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_session_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_models_select_own" ON public.ai_usage_models FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ai_usage_models_insert_own" ON public.ai_usage_models FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_usage_models_update_own" ON public.ai_usage_models FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_usage_models_delete_own" ON public.ai_usage_models FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "ai_session_types_select_own" ON public.ai_session_types FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ai_session_types_insert_own" ON public.ai_session_types FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_session_types_update_own" ON public.ai_session_types FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_session_types_delete_own" ON public.ai_session_types FOR DELETE USING (user_id = auth.uid());

-- ===========================================================================
-- ERA Persistence (Phase 0.5) — added 2026-05-03
-- ===========================================================================
CREATE TABLE public.era_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  active_face_key text NOT NULL DEFAULT 'budget'::text CHECK (active_face_key = ANY (ARRAY['budget'::text, 'schedule'::text, 'chef'::text, 'brain'::text])),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT era_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT era_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.era_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])),
  content text NOT NULL,
  intent_kind text,
  intent_face text,
  intent_payload jsonb,
  draft_transaction_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT era_messages_pkey PRIMARY KEY (id),
  CONSTRAINT era_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.era_conversations(id) ON DELETE CASCADE,
  CONSTRAINT era_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT era_messages_draft_transaction_id_fkey FOREIGN KEY (draft_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL
);

ALTER TABLE public.era_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.era_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY era_conversations_self ON public.era_conversations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY era_messages_self ON public.era_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
  icon text,
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
  CONSTRAINT user_categories_parent_fk FOREIGN KEY (parent_id) REFERENCES public.user_categories(user_id)
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

-- Plan My Day! — day-level planning for disrupted routines (wedding, holiday, etc.)
-- Run manually in Supabase SQL Editor.

CREATE TABLE public.day_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_date date NOT NULL,
  title text,
  intent text CHECK (intent IN ('rest', 'balanced', 'productive')),
  notes text,
  checkpoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT day_plans_pkey PRIMARY KEY (id),
  CONSTRAINT day_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT day_plans_user_id_plan_date_key UNIQUE (user_id, plan_date)
);

ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;

-- day_plans is a low-cardinality parent table (one row per user per day), same shape as
-- `items` — so the household EXISTS-subquery is embedded directly in SELECT, matching
-- items_select. Hard Rule #20 forbids this on HOT CHILD tables (item_alerts, item_subtasks,
-- etc.) re-evaluated per child row; it does not apply here. Without this, supabaseServer
-- (RLS as the calling user) would silently drop the partner's row no matter what the API
-- route requests — there is no way to "merge in app code" around RLS.
-- Insert/update/delete stay owner-only: a public plan is read-only for the partner.
CREATE POLICY day_plans_select ON public.day_plans AS PERMISSIVE FOR SELECT
  USING (
    (user_id = auth.uid())
    OR (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM household_links
        WHERE household_links.active = true
          AND (
            (household_links.owner_user_id = auth.uid() AND household_links.partner_user_id = day_plans.user_id)
            OR (household_links.partner_user_id = auth.uid() AND household_links.owner_user_id = day_plans.user_id)
          )
      )
    )
  );
CREATE POLICY day_plans_insert ON public.day_plans AS PERMISSIVE FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY day_plans_update ON public.day_plans AS PERMISSIVE FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY day_plans_delete ON public.day_plans AS PERMISSIVE FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX day_plans_user_date_idx ON public.day_plans (user_id, plan_date);

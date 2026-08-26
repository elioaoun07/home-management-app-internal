-- ERA Activity log: one row per write ERA makes on the user's behalf
-- (reminders, transactions, transfers, debts, meal-plan assignments, memory
-- saves), so the ERA Top View's Activity card can show "what did ERA do
-- today" and deep-link back to each record. See ERA Notes plan:
-- "ERA Top View — Activity Log + Top-Left Icon Redesign".
--
-- Run this manually in the Supabase SQL Editor (Hard Rule #26 — no agent
-- applies DB changes).

CREATE TABLE public.era_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  household_id uuid,
  action text NOT NULL CHECK (action = ANY (ARRAY['created'::text, 'updated'::text])),
  entity_type text NOT NULL CHECK (entity_type = ANY (ARRAY['reminder'::text, 'transaction'::text, 'transfer'::text, 'debt'::text, 'meal_plan'::text, 'memory'::text])),
  entity_id uuid,
  title text NOT NULL,
  route text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT era_actions_pkey PRIMARY KEY (id),
  CONSTRAINT era_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT era_actions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id)
);

CREATE INDEX era_actions_household_created_idx ON public.era_actions (household_id, created_at DESC);
CREATE INDEX era_actions_user_created_idx ON public.era_actions (user_id, created_at DESC);

ALTER TABLE public.era_actions ENABLE ROW LEVEL SECURITY;

-- Insert: a user may only ever log rows under their own id (household_id is
-- carried for the partner's read, not for who may write).
CREATE POLICY era_actions_insert_own ON public.era_actions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Select: own rows, or rows belonging to an active household the caller is
-- linked into. Small, low-frequency table (page-load only) — not a hot
-- child table, so the household_links lookup here doesn't fall under Hard
-- Rule #20's EXISTS-subquery ban.
CREATE POLICY era_actions_select_own_or_household ON public.era_actions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR household_id IN (
      SELECT id FROM public.household_links
      WHERE active = true
        AND (owner_user_id = auth.uid() OR partner_user_id = auth.uid())
    )
  );

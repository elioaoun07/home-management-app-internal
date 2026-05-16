-- Migration: 2026-05-16 Household Member Item Access Fix
--
-- WHAT THIS FIXES:
-- Household members (notify_all_household = true) and responsible users
-- can now complete, postpone, and cancel shared schedule items.
--
-- ROOT CAUSES (application layer — no schema changes):
-- 1. isAllHousehold check wrongly required is_public in addition to notify_all_household
-- 2. /actions route had no authorization check at all
-- 3. /[id] PATCH and DELETE had no ownership check
-- 4. Browser hooks wrote directly to Supabase (RLS blocked partner writes)
--    → Now route through supabaseAdmin() with explicit server-side auth checks
--
-- SCHEMA CHANGES REQUIRED:
-- Two missing UNIQUE constraints needed for upserts that were already in the code.

-- ============================================================================
-- 1. item_alert_suppressions — UNIQUE(item_id, occurrence_date)
--
-- The cancel action upserts to this table using onConflict: "item_id,occurrence_date".
-- Without this constraint PostgreSQL throws:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- ============================================================================
ALTER TABLE public.item_alert_suppressions
  ADD CONSTRAINT IF NOT EXISTS item_alert_suppressions_item_occurrence_unique
  UNIQUE (item_id, occurrence_date);

-- ============================================================================
-- 2. item_recurrence_exceptions — UNIQUE(rule_id, exdate)
--
-- Exception upserts rely on this. The constraint was in a migration that was
-- removed from the repo but may or may not have been applied to the live DB.
-- IF NOT EXISTS guards against re-applying.
-- ============================================================================
ALTER TABLE public.item_recurrence_exceptions
  ADD CONSTRAINT IF NOT EXISTS item_recurrence_exceptions_rule_exdate_unique
  UNIQUE (rule_id, exdate);

-- ============================================================================
-- SUPPORTING INDEXES
-- Auth checks in the routes query these columns on every action.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_items_responsible_user_id
  ON public.items (responsible_user_id);

CREATE INDEX IF NOT EXISTS idx_items_notify_all_household
  ON public.items (notify_all_household)
  WHERE notify_all_household = true;

CREATE INDEX IF NOT EXISTS idx_household_links_users_active
  ON public.household_links (owner_user_id, partner_user_id, active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_item_occurrence_actions_item_id
  ON public.item_occurrence_actions (item_id);

CREATE INDEX IF NOT EXISTS idx_item_alert_suppressions_item_occurrence
  ON public.item_alert_suppressions (item_id, occurrence_date);

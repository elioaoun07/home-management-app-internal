-- WHAT: Give the household partner row-level read access to `scope = 'household'`
--       trips and their children, and close the RLS gap on the two trip child
--       tables that were left unprotected.
-- WHY:  `trips`, `trip_places` and `trip_packing_items` have RLS ENABLED in the
--       live DB (verified 2026-08-04 via pg_class.relrowsecurity), but every
--       policy is own-user-only. The repo said the opposite — `Trips/Overview.md`
--       §"Visibility & access" and 2026-08-03_trips-planner-upgrade.sql:59-62 both
--       claim "no RLS on trips tables, access is app-layer only" — so the
--       household-aware policy was never written.
--
--       Consequence: a partner's `GET /api/trips` runs
--         .or(user_id.eq.me, and(user_id.eq.owner, scope.eq.household))
--       which is correct application logic, but RLS silently strips the owner's
--       rows before the filter is applied. The partner's trip list comes back
--       with their own trips only, with no error. Trip *detail* still worked,
--       because `get_trip_bundle()` is SECURITY DEFINER and bypasses RLS — which
--       is precisely why this stayed hidden.
--
--       `trip_packing_category` and `trip_documents` have RLS DISABLED entirely,
--       so they are readable/writable by any authenticated user through PostgREST
--       regardless of trip ownership. Both are closed here.
--
-- RUN:  Manually in Supabase SQL Editor. Idempotent and safe to re-run.
-- NOTE: All policies below are PERMISSIVE, so they are OR'd with the existing
--       own-user policies rather than replacing them. Nothing that works today
--       loses access. Existing policies are left untouched and unnamed here
--       precisely so this migration does not depend on their current names.

-- ---------------------------------------------------------------------------
-- 1. Household predicate, RLS-safe.
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the household_links lookup is not itself subject to RLS.
-- Touches only household_links, so it can be used inside a policy on `trips`
-- without any risk of recursing back through that policy.
CREATE OR REPLACE FUNCTION public.is_household_partner(p_other_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.household_links hl
     WHERE hl.active
       AND (
         (hl.owner_user_id = auth.uid() AND hl.partner_user_id = p_other_user_id)
         OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = p_other_user_id)
       )
  );
$function$;

-- ---------------------------------------------------------------------------
-- 2. Trip access predicate for the child tables.
-- ---------------------------------------------------------------------------
-- Mirrors getAccessibleTrip() (src/lib/tripAccess.ts) and the guard inside
-- get_trip_bundle() exactly: owner always, partner only when scope='household'.
--
-- Hard Rule #20 compliance: this is the rule's own PREFERRED option — a
-- SECURITY DEFINER function that owns the WHERE clause — not the banned
-- inline `EXISTS (SELECT 1 FROM parent …)` policy that re-evaluates a join per
-- scanned row. Reading `trips` inside a SECURITY DEFINER function bypasses the
-- trips policy (proven pattern: get_trip_bundle() already does exactly this),
-- so there is no policy recursion.
CREATE OR REPLACE FUNCTION public.trip_is_accessible(p_trip_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.trips t
     WHERE t.id = p_trip_id
       AND (
         t.user_id = auth.uid()
         OR (t.scope = 'household' AND public.is_household_partner(t.user_id))
       )
  );
$function$;

-- ---------------------------------------------------------------------------
-- 3. trips — partner may READ household trips. Writes stay owner-only.
-- ---------------------------------------------------------------------------
-- Deliberately SELECT-only: editing, activating, completing and deleting a trip
-- remain the owner's, matching the `isOwner` gate in the API routes and the
-- `trip.is_owner !== false` gate in TripDetail.tsx.
DROP POLICY IF EXISTS trips_select_household_partner ON public.trips;
CREATE POLICY trips_select_household_partner ON public.trips
  FOR SELECT TO authenticated
  USING (scope = 'household' AND public.is_household_partner(user_id));

-- ---------------------------------------------------------------------------
-- 4. trip_places / trip_packing_items — collaborative read + write.
-- ---------------------------------------------------------------------------
-- Per Trips/Overview.md: "Places/packing on an accessible trip are
-- collaboratively read+write" — the API routes already allow either member, so
-- the policies must too or every partner mutation silently affects zero rows.
DROP POLICY IF EXISTS trip_places_household_access ON public.trip_places;
CREATE POLICY trip_places_household_access ON public.trip_places
  FOR ALL TO authenticated
  USING (public.trip_is_accessible(trip_id))
  WITH CHECK (public.trip_is_accessible(trip_id));

DROP POLICY IF EXISTS trip_packing_items_household_access ON public.trip_packing_items;
CREATE POLICY trip_packing_items_household_access ON public.trip_packing_items
  FOR ALL TO authenticated
  USING (public.trip_is_accessible(trip_id))
  WITH CHECK (public.trip_is_accessible(trip_id));

-- ---------------------------------------------------------------------------
-- 5. trip_packing_category / trip_documents — close the open tables.
-- ---------------------------------------------------------------------------
-- These two had RLS disabled, so any authenticated user could read or write
-- every household's rows directly through PostgREST, bypassing the route-level
-- getAccessibleTrip() checks entirely. Enabling RLS with the same trip-scoped
-- predicate preserves current in-app behaviour (both members keep full access
-- to an accessible trip) while removing the direct-PostgREST hole.
ALTER TABLE public.trip_packing_category ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trip_packing_category_household_access ON public.trip_packing_category;
CREATE POLICY trip_packing_category_household_access ON public.trip_packing_category
  FOR ALL TO authenticated
  USING (public.trip_is_accessible(trip_id))
  WITH CHECK (public.trip_is_accessible(trip_id));

ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trip_documents_household_access ON public.trip_documents;
CREATE POLICY trip_documents_household_access ON public.trip_documents
  FOR ALL TO authenticated
  USING (public.trip_is_accessible(trip_id))
  WITH CHECK (public.trip_is_accessible(trip_id));

-- ---------------------------------------------------------------------------
-- 6. Verification — run as the PARTNER (c23cd730…), not the owner.
-- ---------------------------------------------------------------------------
-- Expected: the household trip 'Italy - August 2026' appears.
--   select id, name, user_id, scope from public.trips where scope = 'household';
--
-- Expected: true for a household trip owned by the partner.
--   select public.trip_is_accessible('8913dcff-f66b-47fd-9070-d737cf84a1c8');
--
-- Expected: the 9 packing categories are returned.
--   select id, name from public.trip_packing_category
--    where trip_id = '8913dcff-f66b-47fd-9070-d737cf84a1c8';
--
-- Rollback:
--   drop policy if exists trips_select_household_partner on public.trips;
--   drop policy if exists trip_places_household_access on public.trip_places;
--   drop policy if exists trip_packing_items_household_access on public.trip_packing_items;
--   drop policy if exists trip_packing_category_household_access on public.trip_packing_category;
--   drop policy if exists trip_documents_household_access on public.trip_documents;
--   alter table public.trip_packing_category disable row level security;
--   alter table public.trip_documents disable row level security;
--   drop function if exists public.trip_is_accessible(uuid);
--   drop function if exists public.is_household_partner(uuid);

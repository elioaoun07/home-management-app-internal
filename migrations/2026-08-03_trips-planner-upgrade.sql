-- migrations/2026-08-03_trips-planner-upgrade.sql
--
-- Trips module "planner mode" upgrade — itinerary timeline, packing 10x, documents
-- vault, and a read bundle RPC. Standalone-first: no reads/writes against accounts,
-- transactions, items, meal_plans, or catalogue. Deliberately does NOT touch the
-- trip lifecycle RPCs (activation/completion) or the side-effect ledger — those
-- stay behind the Trips campaign's unresolved verification gate (see Trips —
-- Master Book.md).
--
-- Run the whole file in the Supabase SQL Editor. Idempotent-ish: uses
-- IF NOT EXISTS / OR REPLACE throughout so it can be re-run safely.

-- =============================================================================
-- Phase 2 — packing: persisted custom categories + per-item assignment
-- =============================================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS custom_packing_categories jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.trips.custom_packing_categories IS
  'User-added packing category names for this trip (the 8 built-ins are a code constant, not stored). Array of plain strings.';

ALTER TABLE public.trip_packing_items
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.trip_packing_items.assigned_to IS
  'Optional: which household member this item is assigned to pack. Null = unassigned/either.';

-- =============================================================================
-- Phase 1 — itinerary: confirmation codes, address, end time
-- =============================================================================

ALTER TABLE public.trip_places
  ADD COLUMN IF NOT EXISTS confirmation_code text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS end_time time without time zone;

-- =============================================================================
-- Phase 4 — trip documents vault
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trip_documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  trip_id uuid NOT NULL,
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'other' CHECK (doc_type = ANY (ARRAY['passport'::text, 'visa'::text, 'ticket'::text, 'booking'::text, 'insurance'::text, 'other'::text])),
  storage_path text NOT NULL,
  expires_on date,
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trip_documents_pkey PRIMARY KEY (id),
  CONSTRAINT trip_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT trip_documents_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id)
);

-- No RLS — matches the existing app-layer-only access pattern for trips/trip_places/
-- trip_packing_items (see getAccessibleTrip() in src/lib/tripAccess.ts and the Pain
-- Inventory note added to the Trips Master Book in this same session). Adding a
-- naive `user_id = auth.uid()` policy here would break partner access to household
-- trips, same as it would for the other three tables — not fixed unilaterally.
--
-- *** CORRECTED 2026-08-04 — the paragraph above is factually wrong. ***
-- `pg_class.relrowsecurity` shows RLS was ENABLED on trips/trip_places/
-- trip_packing_items all along, with own-user-only policies — i.e. the very
-- `user_id = auth.uid()` policy this comment warned would break partner access
-- was already live and already breaking it (household trips were invisible to
-- the partner). Only trip_documents genuinely had RLS off, which left it open to
-- any authenticated user via PostgREST. Fixed in
-- migrations/2026-08-04_trips-household-rls.sql. This migration is left
-- unmodified because it has already been applied; do not re-run it.

-- =============================================================================
-- Phase 5 — get_trip_bundle: one round-trip read for Trip Detail
-- (mirrors get_schedule_bundle's shape/rationale further up this file)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_trip_bundle(p_trip_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  partner_id uuid;
  v_trip public.trips;
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Resolve active household partner (if any) — mirrors getActiveHouseholdPartnerId()
  SELECT CASE WHEN owner_user_id = uid THEN partner_user_id ELSE owner_user_id END
    INTO partner_id
    FROM public.household_links
   WHERE active = true
     AND (owner_user_id = uid OR partner_user_id = uid)
   ORDER BY created_at DESC
   LIMIT 1;

  -- Same access rule as getAccessibleTrip(): owner always; partner only on a
  -- household-scope trip. Solo trips stay private to their creator.
  IF v_trip.user_id != uid AND NOT (v_trip.scope = 'household' AND v_trip.user_id = partner_id) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'trip', to_jsonb(v_trip),
    'is_owner', (v_trip.user_id = uid),
    'places', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.scheduled_date NULLS LAST, p.position)
        FROM public.trip_places p
       WHERE p.trip_id = p_trip_id
    ), '[]'::jsonb),
    'packing', COALESCE((
      SELECT jsonb_agg(to_jsonb(i) ORDER BY i.position)
        FROM public.trip_packing_items i
       WHERE i.trip_id = p_trip_id
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(to_jsonb(d) ORDER BY d.expires_on NULLS LAST, d.position)
        FROM public.trip_documents d
       WHERE d.trip_id = p_trip_id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;

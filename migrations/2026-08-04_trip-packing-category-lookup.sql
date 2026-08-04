-- WHAT: Normalize trip packing categories into a lookup table and link packing
--       items to it.
-- WHY:  Packing categories are currently duplicated free text on each item,
--       which makes category management and lookup unreliable.
-- RUN:  Manually in Supabase SQL Editor. This migration is safe to re-run.
-- NOTE: No backfill is intentionally included. Existing `category` text and
--       `custom_packing_categories` JSON are retained for the owner to migrate.

-- 1. Per-trip packing category lookup. Trips use app-layer access checks, so
--    this child follows the existing trips-table pattern and has no RLS policy.
CREATE TABLE IF NOT EXISTS public.trip_packing_category (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trip_packing_category_pkey PRIMARY KEY (id)
);

-- Category names are unique within a trip regardless of case.
CREATE UNIQUE INDEX IF NOT EXISTS trip_packing_category_trip_name_key
  ON public.trip_packing_category (trip_id, lower(name));

CREATE INDEX IF NOT EXISTS trip_packing_category_trip_id_idx
  ON public.trip_packing_category (trip_id);

-- 2. Link new and migrated packing items to the category lookup. The legacy
--    text field remains untouched so the owner can backfill at their own pace.
ALTER TABLE public.trip_packing_items
  ADD COLUMN IF NOT EXISTS category_id uuid
  REFERENCES public.trip_packing_category(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trip_packing_items_category_id_idx
  ON public.trip_packing_items (category_id);

COMMENT ON TABLE public.trip_packing_category IS
  'Collaborative, per-trip packing category lookup. Access is enforced by trip API routes.';
COMMENT ON COLUMN public.trip_packing_items.category_id IS
  'Lookup to trip_packing_category. Legacy category text remains during manual backfill.';

-- 3. Include lookup categories and their linked packing records in the existing
--    detail bundle, preserving the one-round-trip Trip Detail read path.
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
    RETURN NULL;
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT CASE WHEN owner_user_id = uid THEN partner_user_id ELSE owner_user_id END
    INTO partner_id
    FROM public.household_links
   WHERE active = true
     AND (owner_user_id = uid OR partner_user_id = uid)
   ORDER BY created_at DESC
   LIMIT 1;

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
      SELECT jsonb_agg(
        to_jsonb(i) || jsonb_build_object('packing_category', to_jsonb(c))
        ORDER BY i.position
      )
        FROM public.trip_packing_items i
        LEFT JOIN public.trip_packing_category c ON c.id = i.category_id
       WHERE i.trip_id = p_trip_id
    ), '[]'::jsonb),
    'packing_categories', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.name)
        FROM public.trip_packing_category c
       WHERE c.trip_id = p_trip_id
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

-- WHAT: Soft-delete for packing items (in-context recycle bin) + a single
--       revertible "checkpoint" snapshot of packed status per trip.
-- WHY:  1) Deleting a packing item today is a hard DELETE; the client-side
--          Undo re-inserts a fresh row and loses packed_quantity/is_packed/
--          position. Soft delete (deleted_at) makes restore exact.
--       2) User wants to quick-save today's packing progress and revert to
--          it later if a stray tap changes something.
-- RUN:  Manually in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS guards).
-- NOTE: Checkpoint snapshot is NOT stored on the `trips` row. Per
--       migrations/db-state.json (generated 2026-08-04T10:06:44Z), `trips`
--       only has an owner-only ALL policy (trips_owner) + a partner
--       SELECT-only policy (trips_select_household_partner) — no partner
--       UPDATE policy exists. Packing is collaborative (both partners toggle
--       items), so the checkpoint needs its own child table with a
--       trip_is_accessible() policy, same as trip_packing_category. Writing
--       the snapshot onto `trips` instead would have silently no-op'd for
--       the non-owner partner (Hard Rule #27 failure mode).

-- 1. Soft delete on packing items.
ALTER TABLE public.trip_packing_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS trip_packing_items_trip_deleted_idx
  ON public.trip_packing_items (trip_id, deleted_at);

COMMENT ON COLUMN public.trip_packing_items.deleted_at IS
  'Soft delete. NULL = active. Set (not hard-deleted) so the in-context packing recycle bin can restore with exact quantity/packed state/category.';

-- No RLS policy change needed: trip_packing_items_household_access is
-- FOR ALL and does not filter on deleted_at, so soft-delete (UPDATE) and
-- restore (UPDATE) are already covered for both the owner and the active
-- household partner.

-- 2. Single-checkpoint packing snapshot, one row per trip (upserted).
CREATE TABLE IF NOT EXISTS public.trip_packing_checkpoints (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  snapshot jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trip_packing_checkpoints_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS trip_packing_checkpoints_trip_id_key
  ON public.trip_packing_checkpoints (trip_id);

ALTER TABLE public.trip_packing_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_packing_checkpoints_household_access ON public.trip_packing_checkpoints
  FOR ALL TO authenticated
  USING (public.trip_is_accessible(trip_id))
  WITH CHECK (public.trip_is_accessible(trip_id));

COMMENT ON TABLE public.trip_packing_checkpoints IS
  'One collaboratively-writable snapshot per trip: [{id, packed_quantity, is_packed}] for non-deleted packing items at last quick-save. Upserted on trip_id; revert applies it back onto trip_packing_items.';

-- 3. Exclude soft-deleted packing items from the bundle RPC's packing array
--    (mirrors the API route's GET filter — see task #2/#3).
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
         AND i.deleted_at IS NULL
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

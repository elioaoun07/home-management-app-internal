-- migrations/2026-07-17_healthcare-core.sql
--
-- WHAT: Healthcare module Phase 1 — health_profiles, health_allergies,
--       health_conditions, health_vaccines + RLS + get_health_bundle /
--       get_household_allergens SECURITY DEFINER RPCs.
-- WHY:  New Healthcare standalone module (allergies → recipe warnings,
--       medical history, vaccines). Medications land in Phase 2.
-- RUN:  manually in Supabase SQL Editor. Safe to re-run (idempotent guards).
--
-- Privacy model (user-confirmed):
--   * Profiles/conditions/vaccines are PRIVATE to the managing user unless
--     the profile has shared_with_household = true.
--   * Allergies are ALWAYS household-visible (partner cooking must see them)
--     — delivered via get_household_allergens(), not via table RLS.
--   * Table RLS stays owner-only (managing_user_id = auth.uid()); household
--     visibility is resolved inside the SECURITY DEFINER RPCs (Hard Rule 20:
--     no EXISTS-subquery policies on child tables).

-- ── 1. Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.health_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  managing_user_id uuid NOT NULL,
  user_id uuid,                       -- NULL = dependent without an account (child, parent)
  name text NOT NULL,
  date_of_birth date,
  blood_type text,
  notes text,
  shared_with_household boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT health_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT health_profiles_managing_user_id_fkey FOREIGN KEY (managing_user_id) REFERENCES auth.users(id),
  CONSTRAINT health_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT health_profiles_blood_type_check CHECK (
    blood_type IS NULL OR blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')
  )
);

CREATE TABLE IF NOT EXISTS public.health_allergies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  managing_user_id uuid NOT NULL,     -- denormalized from profile (Hard Rule 20 Option B)
  allergen text NOT NULL,
  severity text NOT NULL DEFAULT 'moderate',
  reaction_notes text,
  keywords text[] NOT NULL DEFAULT '{}',  -- editable ingredient match terms
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_allergies_pkey PRIMARY KEY (id),
  CONSTRAINT health_allergies_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT health_allergies_managing_user_id_fkey FOREIGN KEY (managing_user_id) REFERENCES auth.users(id),
  CONSTRAINT health_allergies_severity_check CHECK (
    severity IN ('mild','moderate','severe','anaphylaxis')
  )
);

CREATE TABLE IF NOT EXISTS public.health_conditions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  managing_user_id uuid NOT NULL,     -- denormalized from profile
  kind text NOT NULL DEFAULT 'condition',
  title text NOT NULL,
  notes text,
  occurred_on date,
  status text NOT NULL DEFAULT 'active',
  catalogue_item_id uuid,             -- optional link to a doctor/clinic catalogue item (Phase 3)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_conditions_pkey PRIMARY KEY (id),
  CONSTRAINT health_conditions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT health_conditions_managing_user_id_fkey FOREIGN KEY (managing_user_id) REFERENCES auth.users(id),
  CONSTRAINT health_conditions_catalogue_item_id_fkey FOREIGN KEY (catalogue_item_id) REFERENCES public.catalogue_items(id) ON DELETE SET NULL,
  CONSTRAINT health_conditions_kind_check CHECK (kind IN ('condition','surgery','doctor_visit')),
  CONSTRAINT health_conditions_status_check CHECK (status IN ('active','resolved'))
);

CREATE TABLE IF NOT EXISTS public.health_vaccines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  managing_user_id uuid NOT NULL,     -- denormalized from profile
  vaccine_name text NOT NULL,
  dose_label text,                    -- e.g. "Dose 1", "Booster"
  administered_on date,
  next_due_on date,                   -- Phase 4: booster reminder materialization
  provider text,
  lot_number text,
  notes text,
  catalogue_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_vaccines_pkey PRIMARY KEY (id),
  CONSTRAINT health_vaccines_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT health_vaccines_managing_user_id_fkey FOREIGN KEY (managing_user_id) REFERENCES auth.users(id),
  CONSTRAINT health_vaccines_catalogue_item_id_fkey FOREIGN KEY (catalogue_item_id) REFERENCES public.catalogue_items(id) ON DELETE SET NULL
);

-- ── 2. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS health_profiles_managing_user_id_idx ON public.health_profiles (managing_user_id);
CREATE INDEX IF NOT EXISTS health_allergies_profile_id_idx ON public.health_allergies (profile_id);
CREATE INDEX IF NOT EXISTS health_allergies_managing_user_id_idx ON public.health_allergies (managing_user_id);
CREATE INDEX IF NOT EXISTS health_conditions_profile_id_idx ON public.health_conditions (profile_id);
CREATE INDEX IF NOT EXISTS health_conditions_managing_user_id_idx ON public.health_conditions (managing_user_id);
CREATE INDEX IF NOT EXISTS health_vaccines_profile_id_idx ON public.health_vaccines (profile_id);
CREATE INDEX IF NOT EXISTS health_vaccines_managing_user_id_idx ON public.health_vaccines (managing_user_id);

-- ── 3. Trigger: keep denormalized managing_user_id in sync with the parent ──

CREATE OR REPLACE FUNCTION public.health_child_sync_managing_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  SELECT p.managing_user_id INTO NEW.managing_user_id
    FROM public.health_profiles p
   WHERE p.id = NEW.profile_id;
  IF NEW.managing_user_id IS NULL THEN
    RAISE EXCEPTION 'health profile % not found', NEW.profile_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS health_allergies_sync_owner ON public.health_allergies;
CREATE TRIGGER health_allergies_sync_owner
  BEFORE INSERT OR UPDATE OF profile_id ON public.health_allergies
  FOR EACH ROW EXECUTE FUNCTION public.health_child_sync_managing_user();

DROP TRIGGER IF EXISTS health_conditions_sync_owner ON public.health_conditions;
CREATE TRIGGER health_conditions_sync_owner
  BEFORE INSERT OR UPDATE OF profile_id ON public.health_conditions
  FOR EACH ROW EXECUTE FUNCTION public.health_child_sync_managing_user();

DROP TRIGGER IF EXISTS health_vaccines_sync_owner ON public.health_vaccines;
CREATE TRIGGER health_vaccines_sync_owner
  BEFORE INSERT OR UPDATE OF profile_id ON public.health_vaccines
  FOR EACH ROW EXECUTE FUNCTION public.health_child_sync_managing_user();

-- ── 4. RLS — owner-only direct policies (household reads go through RPCs) ───

ALTER TABLE public.health_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_vaccines  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['health_profiles','health_allergies','health_conditions','health_vaccines'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_owner_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL
           USING (managing_user_id = auth.uid())
           WITH CHECK (managing_user_id = auth.uid())',
        t || '_owner_all', t
      );
    END IF;
  END LOOP;
END $$;

-- ── 5. RPC: get_health_bundle — one call for the whole health page ──────────
-- Own profiles always; partner profiles only when shared_with_household = true.
-- Allergies ride with their profile here; the always-household-visible allergy
-- feed for recipes is get_household_allergens() below.

CREATE OR REPLACE FUNCTION public.get_health_bundle()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  partner_id uuid;
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT CASE
           WHEN owner_user_id = uid THEN partner_user_id
           ELSE owner_user_id
         END
    INTO partner_id
    FROM public.household_links
   WHERE active = true
     AND (owner_user_id = uid OR partner_user_id = uid)
   ORDER BY created_at DESC
   LIMIT 1;

  WITH visible_profiles AS (
    SELECT p.*
      FROM public.health_profiles p
     WHERE p.deleted_at IS NULL
       AND (
            p.managing_user_id = uid
         OR (partner_id IS NOT NULL AND p.managing_user_id = partner_id AND p.shared_with_household = true)
       )
  )
  SELECT jsonb_build_object(
    'profiles',   COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at) FROM visible_profiles v), '[]'::jsonb),
    'allergies',  COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at)
                              FROM public.health_allergies a
                              JOIN visible_profiles v ON v.id = a.profile_id), '[]'::jsonb),
    'conditions', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.occurred_on DESC NULLS LAST, c.created_at DESC)
                              FROM public.health_conditions c
                              JOIN visible_profiles v ON v.id = c.profile_id), '[]'::jsonb),
    'vaccines',   COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.administered_on DESC NULLS LAST, x.created_at DESC)
                              FROM public.health_vaccines x
                              JOIN visible_profiles v ON v.id = x.profile_id), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$function$;

-- ── 6. RPC: get_household_allergens — always household-visible allergy feed ─
-- Powers recipe allergen warnings for EVERY profile in the household,
-- regardless of shared_with_household (a partner cooking must see them).
-- Deliberately minimal: no notes, no medical detail — just what matching needs.

CREATE OR REPLACE FUNCTION public.get_household_allergens()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  partner_id uuid;
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT CASE
           WHEN owner_user_id = uid THEN partner_user_id
           ELSE owner_user_id
         END
    INTO partner_id
    FROM public.household_links
   WHERE active = true
     AND (owner_user_id = uid OR partner_user_id = uid)
   ORDER BY created_at DESC
   LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'profile_id', p.id,
           'profile_name', p.name,
           'allergen', a.allergen,
           'severity', a.severity,
           'keywords', to_jsonb(a.keywords)
         ) ORDER BY a.created_at), '[]'::jsonb)
    INTO result
    FROM public.health_allergies a
    JOIN public.health_profiles p ON p.id = a.profile_id
   WHERE p.deleted_at IS NULL
     AND (
          p.managing_user_id = uid
       OR (partner_id IS NOT NULL AND p.managing_user_id = partner_id)
     );

  RETURN result;
END;
$function$;

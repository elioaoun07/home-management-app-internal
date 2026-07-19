-- migrations/2026-07-18_outfits-catalog-and-builder.sql
--
-- WHAT: Outfits module Phase 1 + Phase 3 tables:
--       1. wardrobe_profiles  — per-user sizing profile (height/weight/sizes/notes)
--       2. wardrobe_items     — digitized garments (tags + storage paths for original/cutout)
--       3. outfits            — saved paper-doll compositions
--       4. outfit_items       — outfit ↔ garment junction, one garment per slot,
--                               denormalized user_id for flat RLS (Hard Rule 20)
--       + RLS on all four tables: flat user_id = auth.uid(), one policy per verb,
--         NO EXISTS-subquery policies anywhere.
-- WHY:  Outfits/Wardrobe module foundation — design of record:
--       ERA Notes/02 - Standalone Modules/Outfits/Overview.md (Migrations A + B).
--       Personal per user by locked decision D4 — deliberately NO household sharing.
-- RUN:  manually in Supabase SQL Editor. Safe to re-run (idempotent guards below).
-- NOTE: outfit_plans + set_outfit_plan_worn RPC (Migration C) are Phase 4 — NOT in this file.

-- ── 1. wardrobe_profiles ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wardrobe_profiles (
  user_id uuid NOT NULL,
  height_cm numeric,
  weight_kg numeric,
  sizes jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {"top":"M","bottom":"32","shoes":"43",...}
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wardrobe_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT wardrobe_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ── 2. wardrobe_items ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wardrobe_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('top','bottom','shoes','outerwear','accessory','headwear')),
  subcategory text,                            -- "t-shirt", "chinos", "sneakers"
  colors text[] NOT NULL DEFAULT '{}',
  brand text,
  size text,
  season text[] NOT NULL DEFAULT '{}',         -- subset of {'spring','summer','fall','winter'}
  formality text CHECK (formality IN ('casual','smart-casual','business','formal','athletic') OR formality IS NULL),
  style_tags text[] NOT NULL DEFAULT '{}',
  image_path text,                             -- storage path (original webp), never a URL
  cutout_path text,                            -- storage path (alpha webp), null if user kept original
  fit_note text,
  times_worn integer NOT NULL DEFAULT 0,
  last_worn_at timestamptz,
  ai_tagged boolean NOT NULL DEFAULT false,    -- provenance only; tags are user-confirmed before save
  ai_confidence numeric,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wardrobe_items_pkey PRIMARY KEY (id),
  CONSTRAINT wardrobe_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS wardrobe_items_user_slot_idx ON public.wardrobe_items (user_id, slot) WHERE archived_at IS NULL;

-- ── 3. outfits ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outfits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  occasion_hint text,                          -- "work", "date night"
  notes text,
  times_worn integer NOT NULL DEFAULT 0,
  last_worn_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outfits_pkey PRIMARY KEY (id)
);

-- ── 4. outfit_items (junction; denormalized user_id — server sets it on insert) ─

CREATE TABLE IF NOT EXISTS public.outfit_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),  -- DENORMALIZED for flat RLS (Hard Rule 20)
  outfit_id uuid NOT NULL REFERENCES public.outfits(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.wardrobe_items(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('top','bottom','shoes','outerwear','accessory','headwear')),
  CONSTRAINT outfit_items_pkey PRIMARY KEY (id),
  CONSTRAINT outfit_items_outfit_slot_key UNIQUE (outfit_id, slot)
);
CREATE INDEX IF NOT EXISTS outfit_items_outfit_idx ON public.outfit_items (outfit_id);
CREATE INDEX IF NOT EXISTS outfit_items_item_idx ON public.outfit_items (item_id);

-- ── 5. RLS — flat user_id policies, one per verb, on all four tables ──────────

ALTER TABLE public.wardrobe_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfit_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wardrobe_profiles','wardrobe_items','outfits','outfit_items'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_select_own') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (user_id = auth.uid())', t || '_select_own', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_insert_own') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_id = auth.uid())', t || '_insert_own', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_update_own') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t || '_update_own', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_delete_own') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (user_id = auth.uid())', t || '_delete_own', t);
    END IF;
  END LOOP;
END $$;

-- ── 6. Verification (run after — expect 4 tables, 16 policies) ────────────────
-- SELECT tablename, count(*) FROM pg_policies
--   WHERE tablename IN ('wardrobe_profiles','wardrobe_items','outfits','outfit_items')
--   GROUP BY tablename;

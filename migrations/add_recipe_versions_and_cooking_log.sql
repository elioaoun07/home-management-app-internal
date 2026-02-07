-- Migration: Recipe Versions & Cooking Log
-- Enables multi-version recipes (user vs AI) and structured cooking feedback
-- Created: 2026-02-07

-- =============================================================================
-- RECIPE VERSIONS TABLE
-- =============================================================================
-- Each recipe can have multiple versions: user-created, AI-optimized, AI-scaled
-- The "active" version is what shows by default in the recipe detail view

CREATE TABLE IF NOT EXISTS public.recipe_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL,
  user_id uuid NOT NULL,

  -- Version metadata
  version_label text NOT NULL,          -- e.g., "Original", "AI Optimized", "Mom's Version", "Scaled to 8 servings"
  source text NOT NULL DEFAULT 'user',  -- 'user' | 'ai_optimize' | 'ai_scale' | 'ai_generate' | 'url_extract'
  is_active boolean DEFAULT false,      -- Only one active version per recipe

  -- Recipe content snapshot
  ingredients jsonb DEFAULT '[]'::jsonb,
  steps jsonb DEFAULT '[]'::jsonb,
  prep_time_minutes integer,
  cook_time_minutes integer,
  servings integer DEFAULT 4,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  category text,
  cuisine text,
  tags text[] DEFAULT '{}'::text[],
  description text,

  -- AI metadata (if AI-generated)
  ai_prompt text,                       -- The prompt used to generate this version
  ai_reasoning text,                    -- Why AI made specific changes (shown as diff explanation)
  tokens_used integer,                  -- Token cost of generating this version

  -- Tracking
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT recipe_versions_pkey PRIMARY KEY (id),
  CONSTRAINT recipe_versions_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE,
  CONSTRAINT recipe_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Index for fast lookup by recipe
CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe_id ON public.recipe_versions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_active ON public.recipe_versions(recipe_id, is_active) WHERE is_active = true;

-- =============================================================================
-- COOKING LOG TABLE
-- =============================================================================
-- Structured feedback after each cook session (replaces the old feedback JSONB array)

CREATE TABLE IF NOT EXISTS public.cooking_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL,
  user_id uuid NOT NULL,
  version_id uuid,                       -- Which version was used (null = base recipe)

  -- Timing feedback
  actual_prep_minutes integer,
  actual_cook_minutes integer,

  -- Difficulty feedback
  perceived_difficulty text CHECK (perceived_difficulty IN ('easy', 'medium', 'hard')),

  -- Substitutions made
  substitutions jsonb DEFAULT '[]'::jsonb,
  -- Format: [{ "original": "lemon juice", "replaced_with": "lime juice", "notes": "worked well" }]

  -- Serving adjustments
  servings_made integer,                 -- How many servings they actually made

  -- Rating & notes
  rating integer CHECK (rating >= 1 AND rating <= 5),
  taste_notes text,                      -- e.g., "too salty", "perfectly seasoned", "needed more garlic"
  general_notes text,                    -- Any other feedback
  would_make_again boolean,

  -- Timestamps
  cooked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT cooking_logs_pkey PRIMARY KEY (id),
  CONSTRAINT cooking_logs_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE,
  CONSTRAINT cooking_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT cooking_logs_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.recipe_versions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cooking_logs_recipe_id ON public.cooking_logs(recipe_id);
CREATE INDEX IF NOT EXISTS idx_cooking_logs_user_id ON public.cooking_logs(user_id);

-- =============================================================================
-- ADD active_version_id to recipes table
-- =============================================================================
-- Quick pointer to which version is currently active

ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS active_version_id uuid;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_active_version_id_fkey
  FOREIGN KEY (active_version_id) REFERENCES public.recipe_versions(id) ON DELETE SET NULL;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooking_logs ENABLE ROW LEVEL SECURITY;

-- Recipe versions: visible to recipe owner + household members
CREATE POLICY "recipe_versions_select" ON public.recipe_versions
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_versions.recipe_id
      AND (
        r.user_id = auth.uid()
        OR r.household_id IN (
          SELECT id FROM public.household_links WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "recipe_versions_insert" ON public.recipe_versions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "recipe_versions_update" ON public.recipe_versions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "recipe_versions_delete" ON public.recipe_versions
  FOR DELETE USING (user_id = auth.uid());

-- Cooking logs: visible to recipe owner + household members
CREATE POLICY "cooking_logs_select" ON public.cooking_logs
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = cooking_logs.recipe_id
      AND r.household_id IN (
        SELECT id FROM public.household_links WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "cooking_logs_insert" ON public.cooking_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "cooking_logs_update" ON public.cooking_logs
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "cooking_logs_delete" ON public.cooking_logs
  FOR DELETE USING (user_id = auth.uid());

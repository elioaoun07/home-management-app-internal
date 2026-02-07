-- Migration: Add Recipes and Meal Planner tables
-- Created: 2026-02-03

-- =============================================================================
-- RECIPES TABLE
-- =============================================================================
-- Stores recipe information, either user-created or AI-generated
-- Ingredients and steps can be populated on first cook via AI

CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  household_id uuid, -- If set, recipe is shared with household
  
  -- Basic info
  name text NOT NULL,
  description text,
  image_url text,
  source_url text, -- Original recipe URL if imported
  
  -- Recipe content (can be null until AI generates on first cook)
  ingredients jsonb DEFAULT '[]'::jsonb,
  -- Format: [{ "name": "chicken", "quantity": "500", "unit": "g", "notes": "boneless" }]
  
  steps jsonb DEFAULT '[]'::jsonb,
  -- Format: [{ "step": 1, "instruction": "...", "duration_minutes": 5 }]
  
  -- Metadata
  prep_time_minutes integer,
  cook_time_minutes integer,
  servings integer DEFAULT 4,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  
  -- Tags & Categories (for filtering)
  category text, -- e.g., 'Main Course', 'Dessert', 'Soup'
  cuisine text, -- e.g., 'Lebanese', 'Chinese', 'Italian'
  tags text[] DEFAULT '{}'::text[], -- e.g., ['lent-friendly', 'gluten-free', 'high-protein']
  
  -- AI-related fields
  ai_generated boolean DEFAULT false,
  ai_generation_prompt text, -- Original prompt used to generate
  last_ai_update timestamp with time zone,
  
  -- User feedback (stored after cooking)
  feedback jsonb DEFAULT '[]'::jsonb,
  -- Format: [{ "date": "2026-02-03", "notes": "too salty", "rating": 4 }]
  
  -- Stats
  times_cooked integer DEFAULT 0,
  last_cooked_at timestamp with time zone,
  average_rating numeric(2,1),
  
  -- Standard fields
  is_favorite boolean DEFAULT false,
  archived_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT recipes_pkey PRIMARY KEY (id),
  CONSTRAINT recipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT recipes_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id)
);

-- =============================================================================
-- MEAL PLANS TABLE
-- =============================================================================
-- Links recipes to specific dates for meal planning

CREATE TABLE IF NOT EXISTS public.meal_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  household_id uuid NOT NULL, -- Meal plans are always household-shared
  
  recipe_id uuid NOT NULL,
  planned_date date NOT NULL,
  meal_type text DEFAULT 'lunch' CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  
  -- Status tracking
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'shopping_added', 'cooked', 'skipped')),
  cooked_at timestamp with time zone,
  
  -- Notes for this specific cooking instance
  notes text,
  
  -- Reference to shopping items added for this meal
  shopping_thread_id uuid,
  shopping_message_ids uuid[] DEFAULT '{}'::uuid[],
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT meal_plans_pkey PRIMARY KEY (id),
  CONSTRAINT meal_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT meal_plans_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household_links(id),
  CONSTRAINT meal_plans_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id),
  CONSTRAINT meal_plans_shopping_thread_id_fkey FOREIGN KEY (shopping_thread_id) REFERENCES public.hub_chat_threads(id)
);

-- =============================================================================
-- HUB MESSAGES: Add meal_plan reference
-- =============================================================================
-- Shopping items can reference which meal plan they belong to

ALTER TABLE public.hub_messages 
ADD COLUMN IF NOT EXISTS meal_plan_id uuid REFERENCES public.meal_plans(id);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON public.recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_household_id ON public.recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON public.recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON public.recipes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipes_is_favorite ON public.recipes(is_favorite) WHERE is_favorite = true;

CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON public.meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_household_id ON public.meal_plans(household_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_planned_date ON public.meal_plans(planned_date);
CREATE INDEX IF NOT EXISTS idx_meal_plans_recipe_id ON public.meal_plans(recipe_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_status ON public.meal_plans(status);

CREATE INDEX IF NOT EXISTS idx_hub_messages_meal_plan_id ON public.hub_messages(meal_plan_id) WHERE meal_plan_id IS NOT NULL;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

-- Recipes: Users can see their own + household shared recipes
CREATE POLICY recipes_select_policy ON public.recipes
  FOR SELECT USING (
    user_id = auth.uid() 
    OR household_id IN (
      SELECT id FROM public.household_links 
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

CREATE POLICY recipes_insert_policy ON public.recipes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY recipes_update_policy ON public.recipes
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY recipes_delete_policy ON public.recipes
  FOR DELETE USING (user_id = auth.uid());

-- Meal Plans: Household members can CRUD
CREATE POLICY meal_plans_select_policy ON public.meal_plans
  FOR SELECT USING (
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

CREATE POLICY meal_plans_insert_policy ON public.meal_plans
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

CREATE POLICY meal_plans_update_policy ON public.meal_plans
  FOR UPDATE USING (
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

CREATE POLICY meal_plans_delete_policy ON public.meal_plans
  FOR DELETE USING (
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

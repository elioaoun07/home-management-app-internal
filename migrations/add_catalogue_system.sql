-- Migration: Catalogue System
-- A flexible, hierarchical catalogue system for organizing life modules
-- Supports: Budget wishlist, Recipes, Tasks, Healthcare, Trips, and more

-- =============================================================================
-- PART 1: MODULE DEFINITIONS (Pre-defined + Custom modules)
-- =============================================================================

-- Create enum for built-in module types
DO $$ BEGIN
  CREATE TYPE catalogue_module_type AS ENUM (
    'budget',      -- Desired purchases, savings goals
    'recipe',      -- Meal planning, recipes
    'tasks',       -- Personal/work tasks
    'healthcare',  -- Doctors, exams, allergies
    'trips',       -- Travel destinations, journeys
    'fitness',     -- Gym workouts, exercises
    'learning',    -- Skills, courses, practice tracking
    'contacts',    -- Important contacts by category
    'documents',   -- Important documents tracking
    'custom'       -- User-defined modules
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Catalogue Modules table
-- Pre-defined modules are seeded, users can add custom modules
CREATE TABLE IF NOT EXISTS public.catalogue_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  -- Module identification
  type catalogue_module_type NOT NULL DEFAULT 'custom',
  name text NOT NULL,
  description text,
  
  -- Visual styling
  icon text NOT NULL DEFAULT 'folder',
  color text NOT NULL DEFAULT '#3b82f6',
  gradient_from text,
  gradient_to text,
  
  -- Module behavior
  is_system boolean NOT NULL DEFAULT false,  -- System modules can't be deleted
  is_enabled boolean NOT NULL DEFAULT true,  -- User can hide modules
  position integer NOT NULL DEFAULT 0,
  
  -- Metadata for module-specific features
  settings_json jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT catalogue_modules_pkey PRIMARY KEY (id),
  CONSTRAINT catalogue_modules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT catalogue_modules_unique_type UNIQUE (user_id, type, name)
);

-- =============================================================================
-- PART 2: CATEGORIES (Hierarchical categories within modules)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.catalogue_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL,
  
  -- Category identification
  name text NOT NULL,
  description text,
  
  -- Hierarchical structure (self-referencing for subcategories)
  parent_id uuid,
  depth integer NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 5),
  path text NOT NULL DEFAULT '',  -- Materialized path for efficient queries: /parent/child/
  
  -- Visual styling
  icon text DEFAULT 'tag',
  color text,
  
  -- Organization
  position integer NOT NULL DEFAULT 0,
  is_expanded boolean NOT NULL DEFAULT true,
  
  -- Soft delete support
  archived_at timestamp with time zone,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT catalogue_categories_pkey PRIMARY KEY (id),
  CONSTRAINT catalogue_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT catalogue_categories_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.catalogue_modules(id) ON DELETE CASCADE,
  CONSTRAINT catalogue_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.catalogue_categories(id) ON DELETE CASCADE
);

-- =============================================================================
-- PART 3: ITEMS (Flexible item storage with module-specific fields)
-- =============================================================================

-- Create enum for item status
DO $$ BEGIN
  CREATE TYPE catalogue_item_status AS ENUM (
    'active',
    'completed',
    'in_progress',
    'paused',
    'cancelled',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for priority
DO $$ BEGIN
  CREATE TYPE catalogue_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent',
    'critical'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.catalogue_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL,
  category_id uuid,
  
  -- Item identification
  name text NOT NULL,
  description text,
  notes text,
  
  -- Status and priority
  status catalogue_item_status NOT NULL DEFAULT 'active',
  priority catalogue_priority NOT NULL DEFAULT 'normal',
  
  -- Visual styling
  icon text,
  color text,
  image_url text,
  
  -- Organization
  position integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_favorite boolean NOT NULL DEFAULT false,
  
  -- Tags for flexible categorization
  tags text[] DEFAULT '{}',
  
  -- ==========================================================================
  -- MODULE-SPECIFIC FIELDS (JSONB for flexibility)
  -- ==========================================================================
  
  -- Budget module: { target_amount, current_saved, price_range, where_to_buy, links[] }
  -- Recipe module: { servings, prep_time, cook_time, ingredients[], steps[], dietary_tags[] }
  -- Tasks module: { due_date, estimated_duration, assigned_to, subtasks[] }
  -- Healthcare module: { doctor_name, specialty, phone, address, frequency, last_visit, next_appointment }
  -- Trips module: { location, country, estimated_cost, best_season, activities[] }
  -- Fitness module: { muscle_groups[], sets, reps, weight, duration, schedule[] }
  -- Learning module: { skill_level, total_hours, progress_percent, resources[], milestones[] }
  -- Contacts module: { phone, email, address, relationship, birthday }
  -- Documents module: { document_type, expiry_date, file_url, issuer }
  
  metadata_json jsonb DEFAULT '{}'::jsonb,
  
  -- Progress tracking (generic, used by many modules)
  progress_current numeric DEFAULT 0,
  progress_target numeric,
  progress_unit text,  -- e.g., '$', 'hours', 'reps', '%'
  
  -- Scheduling/reminders
  next_due_date date,
  frequency text,  -- 'daily', 'weekly', 'monthly', 'yearly', or cron
  last_completed_at timestamp with time zone,
  
  -- Soft delete support
  archived_at timestamp with time zone,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  
  CONSTRAINT catalogue_items_pkey PRIMARY KEY (id),
  CONSTRAINT catalogue_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT catalogue_items_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.catalogue_modules(id) ON DELETE CASCADE,
  CONSTRAINT catalogue_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.catalogue_categories(id) ON DELETE SET NULL
);

-- =============================================================================
-- PART 4: SUB-ITEMS (For nested items like task subtasks, recipe steps, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.catalogue_sub_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL,
  
  -- Sub-item details
  name text NOT NULL,
  description text,
  
  -- Status
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  
  -- Organization
  position integer NOT NULL DEFAULT 0,
  
  -- Optional metadata
  metadata_json jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT catalogue_sub_items_pkey PRIMARY KEY (id),
  CONSTRAINT catalogue_sub_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT catalogue_sub_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.catalogue_items(id) ON DELETE CASCADE
);

-- =============================================================================
-- PART 5: INDEXES
-- =============================================================================

-- Module indexes
CREATE INDEX IF NOT EXISTS idx_catalogue_modules_user_id ON public.catalogue_modules(user_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_modules_type ON public.catalogue_modules(type);
CREATE INDEX IF NOT EXISTS idx_catalogue_modules_position ON public.catalogue_modules(user_id, position);

-- Category indexes
CREATE INDEX IF NOT EXISTS idx_catalogue_categories_user_id ON public.catalogue_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_categories_module_id ON public.catalogue_categories(module_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_categories_parent_id ON public.catalogue_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_categories_path ON public.catalogue_categories(path);
CREATE INDEX IF NOT EXISTS idx_catalogue_categories_position ON public.catalogue_categories(module_id, position);

-- Item indexes
CREATE INDEX IF NOT EXISTS idx_catalogue_items_user_id ON public.catalogue_items(user_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_items_module_id ON public.catalogue_items(module_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_items_category_id ON public.catalogue_items(category_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_items_status ON public.catalogue_items(status);
CREATE INDEX IF NOT EXISTS idx_catalogue_items_priority ON public.catalogue_items(priority);
CREATE INDEX IF NOT EXISTS idx_catalogue_items_pinned ON public.catalogue_items(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_catalogue_items_tags ON public.catalogue_items USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_catalogue_items_next_due ON public.catalogue_items(next_due_date) WHERE next_due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalogue_items_position ON public.catalogue_items(module_id, category_id, position);

-- Sub-item indexes
CREATE INDEX IF NOT EXISTS idx_catalogue_sub_items_item_id ON public.catalogue_sub_items(item_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_sub_items_position ON public.catalogue_sub_items(item_id, position);

-- =============================================================================
-- PART 6: ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.catalogue_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_sub_items ENABLE ROW LEVEL SECURITY;

-- Module policies
CREATE POLICY "Users can view own modules"
  ON public.catalogue_modules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own modules"
  ON public.catalogue_modules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own modules"
  ON public.catalogue_modules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own non-system modules"
  ON public.catalogue_modules FOR DELETE
  USING (auth.uid() = user_id AND is_system = false);

-- Category policies
CREATE POLICY "Users can view own categories"
  ON public.catalogue_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON public.catalogue_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON public.catalogue_categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON public.catalogue_categories FOR DELETE
  USING (auth.uid() = user_id);

-- Item policies
CREATE POLICY "Users can view own items"
  ON public.catalogue_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own items"
  ON public.catalogue_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
  ON public.catalogue_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own items"
  ON public.catalogue_items FOR DELETE
  USING (auth.uid() = user_id);

-- Sub-item policies
CREATE POLICY "Users can view own sub-items"
  ON public.catalogue_sub_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sub-items"
  ON public.catalogue_sub_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sub-items"
  ON public.catalogue_sub_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sub-items"
  ON public.catalogue_sub_items FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- PART 7: TRIGGERS FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_catalogue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_catalogue_modules_updated_at ON public.catalogue_modules;
CREATE TRIGGER trigger_catalogue_modules_updated_at
  BEFORE UPDATE ON public.catalogue_modules
  FOR EACH ROW EXECUTE FUNCTION update_catalogue_updated_at();

DROP TRIGGER IF EXISTS trigger_catalogue_categories_updated_at ON public.catalogue_categories;
CREATE TRIGGER trigger_catalogue_categories_updated_at
  BEFORE UPDATE ON public.catalogue_categories
  FOR EACH ROW EXECUTE FUNCTION update_catalogue_updated_at();

DROP TRIGGER IF EXISTS trigger_catalogue_items_updated_at ON public.catalogue_items;
CREATE TRIGGER trigger_catalogue_items_updated_at
  BEFORE UPDATE ON public.catalogue_items
  FOR EACH ROW EXECUTE FUNCTION update_catalogue_updated_at();

DROP TRIGGER IF EXISTS trigger_catalogue_sub_items_updated_at ON public.catalogue_sub_items;
CREATE TRIGGER trigger_catalogue_sub_items_updated_at
  BEFORE UPDATE ON public.catalogue_sub_items
  FOR EACH ROW EXECUTE FUNCTION update_catalogue_updated_at();

-- =============================================================================
-- PART 8: FUNCTION TO INITIALIZE DEFAULT MODULES FOR NEW USERS
-- =============================================================================

CREATE OR REPLACE FUNCTION initialize_catalogue_modules(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Insert default modules if they don't exist
  INSERT INTO public.catalogue_modules (user_id, type, name, description, icon, color, gradient_from, gradient_to, is_system, position)
  VALUES
    (p_user_id, 'budget', 'Budget & Wishlist', 'Track desired purchases and savings goals', 'wallet', '#10b981', '#10b981', '#059669', true, 0),
    (p_user_id, 'tasks', 'Tasks', 'Organize personal, work, and home tasks', 'check-square', '#8b5cf6', '#8b5cf6', '#7c3aed', true, 1),
    (p_user_id, 'recipe', 'Recipes', 'Meal planning and recipe collection', 'chef-hat', '#f59e0b', '#f59e0b', '#d97706', true, 2),
    (p_user_id, 'healthcare', 'Healthcare', 'Doctors, appointments, and health tracking', 'heart-pulse', '#ef4444', '#ef4444', '#dc2626', true, 3),
    (p_user_id, 'trips', 'Trips & Travel', 'Dream destinations and journey planning', 'plane', '#06b6d4', '#06b6d4', '#0891b2', true, 4),
    (p_user_id, 'fitness', 'Fitness', 'Workout routines and exercise tracking', 'dumbbell', '#ec4899', '#ec4899', '#db2777', true, 5),
    (p_user_id, 'learning', 'Learning & Skills', 'Track skills, courses, and practice progress', 'graduation-cap', '#6366f1', '#6366f1', '#4f46e5', true, 6),
    (p_user_id, 'contacts', 'Contacts', 'Important contacts organized by category', 'users', '#14b8a6', '#14b8a6', '#0d9488', true, 7),
    (p_user_id, 'documents', 'Documents', 'Track important documents and expiry dates', 'file-text', '#64748b', '#64748b', '#475569', true, 8)
  ON CONFLICT (user_id, type, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 9: COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.catalogue_modules IS 'Life management modules - each module represents a major life area';
COMMENT ON TABLE public.catalogue_categories IS 'Hierarchical categories within modules for organization';
COMMENT ON TABLE public.catalogue_items IS 'Individual items/entries within categories with flexible metadata';
COMMENT ON TABLE public.catalogue_sub_items IS 'Nested sub-items for complex entries like task subtasks or recipe steps';

COMMENT ON COLUMN public.catalogue_items.metadata_json IS 'Module-specific fields stored as JSONB for flexibility';
COMMENT ON COLUMN public.catalogue_items.progress_current IS 'Generic progress tracking - current value';
COMMENT ON COLUMN public.catalogue_items.progress_target IS 'Generic progress tracking - target value';
COMMENT ON COLUMN public.catalogue_categories.path IS 'Materialized path for efficient hierarchical queries';

-- ============================================
-- CROSS-APP USER MAPPINGS
-- Migration: add_cross_app_user_mappings.sql
-- ============================================
-- Maps users between Budget App and Reminder App
-- Enables cross-app item creation with correct user attribution

-- 1. Create cross_app_user_mappings table
CREATE TABLE IF NOT EXISTS public.cross_app_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Budget App user ID (this app)
  budget_app_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Reminder App user ID (external app)
  reminder_app_user_id UUID NOT NULL,
  
  -- User display name (for reference)
  display_name TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique mapping per Budget App user
  UNIQUE(budget_app_user_id)
);

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_cross_app_mappings_budget_user 
  ON public.cross_app_user_mappings(budget_app_user_id);

CREATE INDEX IF NOT EXISTS idx_cross_app_mappings_reminder_user 
  ON public.cross_app_user_mappings(reminder_app_user_id);

-- 3. RLS Policies
ALTER TABLE public.cross_app_user_mappings ENABLE ROW LEVEL SECURITY;

-- Users can view their own mapping
CREATE POLICY "Users can view their own mapping"
  ON public.cross_app_user_mappings FOR SELECT
  USING (budget_app_user_id = auth.uid());

-- Only admins can insert/update mappings (use service role key)
CREATE POLICY "Service role can manage mappings"
  ON public.cross_app_user_mappings FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Insert initial mappings for the household
-- Your mapping
INSERT INTO public.cross_app_user_mappings (budget_app_user_id, reminder_app_user_id, display_name)
VALUES 
  ('1cb9c50a-2a41-4fb3-8e90-2e270ca28830', '222c44a5-6b17-4df4-9735-f8ddf5178f46', 'Elio')
ON CONFLICT (budget_app_user_id) DO UPDATE SET
  reminder_app_user_id = EXCLUDED.reminder_app_user_id,
  display_name = EXCLUDED.display_name,
  updated_at = NOW();

-- Wife's mapping
INSERT INTO public.cross_app_user_mappings (budget_app_user_id, reminder_app_user_id, display_name)
VALUES 
  ('c23cd730-b468-4b2f-8db0-8c8100f79f4b', '5e124102-190b-46e3-a4f5-e7d7c9409fda', 'Wife')
ON CONFLICT (budget_app_user_id) DO UPDATE SET
  reminder_app_user_id = EXCLUDED.reminder_app_user_id,
  display_name = EXCLUDED.display_name,
  updated_at = NOW();

-- 5. Comments for documentation
COMMENT ON TABLE public.cross_app_user_mappings IS 'Maps Budget App users to Reminder App users for cross-app item creation';
COMMENT ON COLUMN public.cross_app_user_mappings.budget_app_user_id IS 'User ID in the Budget App (this app)';
COMMENT ON COLUMN public.cross_app_user_mappings.reminder_app_user_id IS 'Corresponding user ID in the Reminder App';

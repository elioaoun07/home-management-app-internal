-- Migration: Add "calm" theme to user_preferences
-- This migration updates the theme CHECK constraint to include "calm"

-- Step 1: Drop the existing constraint
ALTER TABLE user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_theme_check;

-- Step 2: Add new constraint that includes "calm"
ALTER TABLE user_preferences 
ADD CONSTRAINT user_preferences_theme_check 
CHECK (theme = ANY (ARRAY['light'::text, 'dark'::text, 'frost'::text, 'calm'::text, 'system'::text, 'blue'::text, 'pink'::text]));

-- Migration: Add "frost" theme to user_preferences
-- This migration updates the theme CHECK constraint to include "frost" and replaces "wood"

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE user_preferences
DROP CONSTRAINT IF EXISTS user_preferences_theme_check;

-- Step 2: Migrate any existing "wood" theme users to "frost" BEFORE adding constraint
UPDATE user_preferences
SET theme = 'frost'
WHERE theme = 'wood';

-- Step 2b: Migrate any other invalid theme values to "blue"
UPDATE user_preferences
SET theme = 'blue'
WHERE theme IS NOT NULL 
  AND theme NOT IN ('light', 'dark', 'frost', 'system', 'blue', 'pink');

-- Step 3: Add the updated CHECK constraint with "frost"
ALTER TABLE user_preferences
ADD CONSTRAINT user_preferences_theme_check 
CHECK (theme = ANY (ARRAY['light'::text, 'dark'::text, 'frost'::text, 'system'::text, 'blue'::text, 'pink'::text]));

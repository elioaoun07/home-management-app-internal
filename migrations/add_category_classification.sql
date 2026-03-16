-- Migration: Add classification column to user_categories for 50/30/20 budgeting rule
-- Classification: 'need' (50%), 'want' (30%), 'saving' (20%)

ALTER TABLE user_categories
ADD COLUMN IF NOT EXISTS classification TEXT
CHECK (classification IN ('need', 'want', 'saving'));

COMMENT ON COLUMN user_categories.classification IS '50/30/20 budget rule classification: need, want, or saving';

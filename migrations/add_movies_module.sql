-- =============================================================================
-- STEP 1: Run this FIRST, then run Step 2 separately
-- =============================================================================

-- Add 'movies' to the catalogue_module_type enum
ALTER TYPE catalogue_module_type ADD VALUE IF NOT EXISTS 'movies';

-- =============================================================================
-- STEP 2: Run this AFTER Step 1 has been committed (separate execution)
-- =============================================================================

-- Add movies module for all users who have the catalogue system
INSERT INTO catalogue_modules (
  user_id,
  type,
  name,
  description,
  icon,
  color,
  gradient_from,
  gradient_to,
  is_system,
  position
)
SELECT DISTINCT
  cm.user_id,
  'movies'::catalogue_module_type,
  'Movies & Shows',
  'Track movies, TV shows, documentaries and what to watch next',
  'film',
  '#a855f7',
  '#a855f7',
  '#7c3aed',
  true,
  (SELECT COALESCE(MAX(position), 0) + 1 FROM catalogue_modules WHERE user_id = cm.user_id)
FROM catalogue_modules cm
WHERE NOT EXISTS (
  SELECT 1 FROM catalogue_modules cm2 
  WHERE cm2.user_id = cm.user_id AND cm2.type = 'movies'::catalogue_module_type
);

-- Add some default categories for the movies module
INSERT INTO catalogue_categories (
  user_id,
  module_id,
  name,
  description,
  icon,
  color,
  position
)
SELECT 
  cm.user_id,
  cm.id,
  category.name,
  category.description,
  category.icon,
  category.color,
  category.position
FROM catalogue_modules cm
CROSS JOIN (
  VALUES 
    ('To Watch', 'Movies and shows on my watchlist', 'clock', '#f59e0b', 1),
    ('Watched', 'Movies and shows I''ve seen', 'check-circle', '#22c55e', 2),
    ('Favorites', 'My all-time favorites', 'heart', '#ef4444', 3),
    ('Recommendations', 'Recommended by friends or critics', 'users', '#3b82f6', 4)
) AS category(name, description, icon, color, position)
WHERE cm.type = 'movies'::catalogue_module_type
AND NOT EXISTS (
  SELECT 1 FROM catalogue_categories cc 
  WHERE cc.module_id = cm.id AND cc.name = category.name
);

-- Migration: Seed Catalogue with Sample Data
-- Run this AFTER add_catalogue_system.sql and after user has logged in
-- Replace 'YOUR_USER_ID' with actual user UUID or run initialize_catalogue_modules first

-- This migration assumes the user's default modules are already created via initialize_catalogue_modules()
-- It adds sample categories and items for demonstration

-- Note: These are example entries. In production, this would be done via the UI.
-- This script uses a function to safely add sample data for a specific user.

CREATE OR REPLACE FUNCTION seed_catalogue_sample_data(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_budget_module_id uuid;
  v_tasks_module_id uuid;
  v_healthcare_module_id uuid;
  v_fitness_module_id uuid;
  v_learning_module_id uuid;
  v_trips_module_id uuid;
  v_cat_id uuid;
BEGIN
  -- Get module IDs
  SELECT id INTO v_budget_module_id FROM catalogue_modules WHERE user_id = p_user_id AND type = 'budget' LIMIT 1;
  SELECT id INTO v_tasks_module_id FROM catalogue_modules WHERE user_id = p_user_id AND type = 'tasks' LIMIT 1;
  SELECT id INTO v_healthcare_module_id FROM catalogue_modules WHERE user_id = p_user_id AND type = 'healthcare' LIMIT 1;
  SELECT id INTO v_fitness_module_id FROM catalogue_modules WHERE user_id = p_user_id AND type = 'fitness' LIMIT 1;
  SELECT id INTO v_learning_module_id FROM catalogue_modules WHERE user_id = p_user_id AND type = 'learning' LIMIT 1;
  SELECT id INTO v_trips_module_id FROM catalogue_modules WHERE user_id = p_user_id AND type = 'trips' LIMIT 1;

  -- =========================================================================
  -- BUDGET MODULE: Wishlist Categories and Items
  -- =========================================================================
  
  IF v_budget_module_id IS NOT NULL THEN
    -- Tech category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_budget_module_id, 'Tech & Electronics', 'Gadgets and electronic devices', 'monitor', '#3b82f6', 0)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, progress_current, progress_target, progress_unit, metadata_json, position)
    VALUES 
      (p_user_id, v_budget_module_id, v_cat_id, 'New MacBook Pro', 'M3 Pro 14-inch for development', 'high', ARRAY['work', 'computer'], 500, 2500, '$', '{"target_amount": 2500, "where_to_buy": "Apple Store"}'::jsonb, 0),
      (p_user_id, v_budget_module_id, v_cat_id, 'Sony WH-1000XM5', 'Noise cancelling headphones', 'normal', ARRAY['audio', 'work'], 0, 350, '$', '{"target_amount": 350}'::jsonb, 1);
    
    -- Home category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_budget_module_id, 'Home & Living', 'Furniture and home improvements', 'home', '#10b981', 1)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, progress_current, progress_target, progress_unit, metadata_json, position)
    VALUES 
      (p_user_id, v_budget_module_id, v_cat_id, 'Standing Desk', 'Electric adjustable desk', 'normal', ARRAY['office', 'health'], 100, 600, '$', '{"target_amount": 600}'::jsonb, 0),
      (p_user_id, v_budget_module_id, v_cat_id, 'Ergonomic Chair', 'Herman Miller Aeron or similar', 'high', ARRAY['office', 'health'], 0, 1200, '$', '{"target_amount": 1200}'::jsonb, 1);
    
    -- Vehicles category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_budget_module_id, 'Vehicles', 'Cars and transportation', 'car', '#f97316', 2)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, progress_current, progress_target, progress_unit, metadata_json, position)
    VALUES 
      (p_user_id, v_budget_module_id, v_cat_id, 'Electric Car', 'Tesla Model 3 or equivalent', 'low', ARRAY['eco', 'future'], 2000, 35000, '$', '{"target_amount": 35000}'::jsonb, 0);
  END IF;

  -- =========================================================================
  -- TASKS MODULE: Task Categories and Items
  -- =========================================================================
  
  IF v_tasks_module_id IS NOT NULL THEN
    -- Personal category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_tasks_module_id, 'Personal', 'Self-care and personal tasks', 'heart', '#ec4899', 0)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, position)
    VALUES 
      (p_user_id, v_tasks_module_id, v_cat_id, 'Self Care', 'Regular grooming and wellness', 'normal', ARRAY['routine', 'weekly'], 0),
      (p_user_id, v_tasks_module_id, v_cat_id, 'Meditation', '10-minute daily practice', 'normal', ARRAY['mental-health', 'daily'], 1);
    
    -- Add sub-items for Self Care
    INSERT INTO catalogue_sub_items (user_id, item_id, name, position)
    SELECT p_user_id, id, unnest, row_number() OVER () - 1
    FROM catalogue_items, unnest(ARRAY['Trim beard', 'Eyebrows', 'Face mask', 'Haircut'])
    WHERE name = 'Self Care' AND user_id = p_user_id
    LIMIT 4;
    
    -- Work category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_tasks_module_id, 'Work', 'Professional and career tasks', 'briefcase', '#6366f1', 1)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, position)
    VALUES 
      (p_user_id, v_tasks_module_id, v_cat_id, 'Career Planning', 'Review goals and progress quarterly', 'high', ARRAY['career', 'quarterly'], 0),
      (p_user_id, v_tasks_module_id, v_cat_id, 'Holiday Planning', 'Plan and book vacation days', 'normal', ARRAY['vacation'], 1);
    
    -- Home category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_tasks_module_id, 'Home', 'Household chores and maintenance', 'home', '#14b8a6', 2)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, frequency, position)
    VALUES 
      (p_user_id, v_tasks_module_id, v_cat_id, 'Laundry', 'Wash, dry, fold, iron', 'normal', ARRAY['chores', 'weekly'], 'weekly', 0),
      (p_user_id, v_tasks_module_id, v_cat_id, 'Take out trash', 'Garbage and recycling', 'normal', ARRAY['chores'], 'twice-weekly', 1),
      (p_user_id, v_tasks_module_id, v_cat_id, 'Deep cleaning', 'Thorough house cleaning', 'low', ARRAY['chores', 'monthly'], 'monthly', 2);
    
    -- Family category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_tasks_module_id, 'Family', 'Family-related tasks and events', 'users', '#f59e0b', 3)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, position)
    VALUES 
      (p_user_id, v_tasks_module_id, v_cat_id, 'Visit Parents', 'Regular visits to parents', 'high', ARRAY['family', 'monthly'], 0),
      (p_user_id, v_tasks_module_id, v_cat_id, 'Invite parents over', 'Host family dinner', 'normal', ARRAY['family'], 1);
  END IF;

  -- =========================================================================
  -- HEALTHCARE MODULE: Doctors and Exams
  -- =========================================================================
  
  IF v_healthcare_module_id IS NOT NULL THEN
    -- Doctors category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_healthcare_module_id, 'Doctors', 'Healthcare providers contacts', 'user', '#ef4444', 0)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, frequency, metadata_json, position)
    VALUES 
      (p_user_id, v_healthcare_module_id, v_cat_id, 'General Practitioner', 'Annual checkup', 'normal', ARRAY['primary-care'], 'yearly', '{"specialty": "General Medicine", "frequency": "yearly"}'::jsonb, 0),
      (p_user_id, v_healthcare_module_id, v_cat_id, 'Dentist', 'Teeth cleaning and checkup', 'normal', ARRAY['dental'], '6-months', '{"specialty": "Dentistry", "frequency": "every 6 months"}'::jsonb, 1),
      (p_user_id, v_healthcare_module_id, v_cat_id, 'Eye Doctor', 'Vision test and eye health', 'normal', ARRAY['vision'], 'yearly', '{"specialty": "Ophthalmology", "frequency": "yearly"}'::jsonb, 2);
    
    -- Exams category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_healthcare_module_id, 'Regular Exams', 'Routine health examinations', 'clipboard', '#f97316', 1)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, frequency, position)
    VALUES 
      (p_user_id, v_healthcare_module_id, v_cat_id, 'Blood Work', 'Complete blood count and metabolic panel', 'normal', ARRAY['lab-work'], 'yearly', 0),
      (p_user_id, v_healthcare_module_id, v_cat_id, 'Cholesterol Check', 'Lipid panel screening', 'normal', ARRAY['lab-work', 'heart'], 'yearly', 1);
    
    -- Allergies category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_healthcare_module_id, 'Allergies & Conditions', 'Known allergies and medical conditions', 'alert-triangle', '#dc2626', 2)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, position)
    VALUES 
      (p_user_id, v_healthcare_module_id, v_cat_id, 'Peanut Allergy', 'Severe allergic reaction to peanuts', 'critical', ARRAY['food-allergy', 'severe'], 0);
  END IF;

  -- =========================================================================
  -- FITNESS MODULE: Workout Routines
  -- =========================================================================
  
  IF v_fitness_module_id IS NOT NULL THEN
    -- Upper Body category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_fitness_module_id, 'Upper Body', 'Chest, back, shoulders, arms', 'dumbbell', '#8b5cf6', 0)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, metadata_json, position)
    VALUES 
      (p_user_id, v_fitness_module_id, v_cat_id, 'Bench Press', 'Chest exercise with barbell', 'normal', ARRAY['chest', 'compound'], '{"muscle_groups": ["chest", "triceps", "shoulders"], "sets": 4, "reps": 10}'::jsonb, 0),
      (p_user_id, v_fitness_module_id, v_cat_id, 'Pull-ups', 'Back exercise, bodyweight', 'normal', ARRAY['back', 'compound'], '{"muscle_groups": ["back", "biceps"], "sets": 3, "reps": 8}'::jsonb, 1),
      (p_user_id, v_fitness_module_id, v_cat_id, 'Shoulder Press', 'Overhead press with dumbbells', 'normal', ARRAY['shoulders'], '{"muscle_groups": ["shoulders", "triceps"], "sets": 3, "reps": 12}'::jsonb, 2);
    
    -- Lower Body category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_fitness_module_id, 'Lower Body', 'Legs, glutes, calves', 'move', '#ec4899', 1)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, metadata_json, position)
    VALUES 
      (p_user_id, v_fitness_module_id, v_cat_id, 'Squats', 'Compound leg exercise', 'high', ARRAY['legs', 'compound'], '{"muscle_groups": ["quads", "glutes", "hamstrings"], "sets": 4, "reps": 10}'::jsonb, 0),
      (p_user_id, v_fitness_module_id, v_cat_id, 'Deadlift', 'Full body compound movement', 'high', ARRAY['back', 'legs', 'compound'], '{"muscle_groups": ["hamstrings", "glutes", "back"], "sets": 4, "reps": 8}'::jsonb, 1),
      (p_user_id, v_fitness_module_id, v_cat_id, 'Calf Raises', 'Isolation for calves', 'low', ARRAY['calves'], '{"muscle_groups": ["calves"], "sets": 3, "reps": 15}'::jsonb, 2);
    
    -- Cardio category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_fitness_module_id, 'Cardio', 'Cardiovascular exercises', 'heart-pulse', '#ef4444', 2)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, metadata_json, position)
    VALUES 
      (p_user_id, v_fitness_module_id, v_cat_id, 'Running', 'Outdoor or treadmill', 'normal', ARRAY['cardio', 'outdoor'], '{"duration_mins": 30}'::jsonb, 0),
      (p_user_id, v_fitness_module_id, v_cat_id, 'HIIT Session', 'High intensity interval training', 'normal', ARRAY['cardio', 'intense'], '{"duration_mins": 20}'::jsonb, 1);
  END IF;

  -- =========================================================================
  -- LEARNING MODULE: Skills and Hobbies
  -- =========================================================================
  
  IF v_learning_module_id IS NOT NULL THEN
    -- Programming category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_learning_module_id, 'Programming', 'Software development skills', 'code', '#3b82f6', 0)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, progress_current, progress_target, progress_unit, metadata_json, position)
    VALUES 
      (p_user_id, v_learning_module_id, v_cat_id, 'React Advanced Patterns', 'Master React hooks and patterns', 'high', ARRAY['react', 'frontend'], 60, 100, '%', '{"skill_level": "intermediate", "resources": [{"title": "React Docs", "url": "https://react.dev"}]}'::jsonb, 0),
      (p_user_id, v_learning_module_id, v_cat_id, 'TypeScript Deep Dive', 'Advanced TypeScript features', 'normal', ARRAY['typescript', 'types'], 40, 100, '%', '{"skill_level": "intermediate"}'::jsonb, 1);
    
    -- Music category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_learning_module_id, 'Music', 'Musical instruments and theory', 'music', '#8b5cf6', 1)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, progress_current, progress_target, progress_unit, metadata_json, position)
    VALUES 
      (p_user_id, v_learning_module_id, v_cat_id, 'Piano - Moonlight Sonata', 'Beethoven Piano Sonata No. 14', 'normal', ARRAY['piano', 'classical'], 30, 100, '%', '{"skill_level": "intermediate", "practice_log": []}'::jsonb, 0),
      (p_user_id, v_learning_module_id, v_cat_id, 'Piano - Clair de Lune', 'Debussy classic piece', 'normal', ARRAY['piano', 'classical'], 10, 100, '%', '{"skill_level": "intermediate"}'::jsonb, 1),
      (p_user_id, v_learning_module_id, v_cat_id, 'Music Theory Basics', 'Learn scales, chords, and progressions', 'low', ARRAY['theory'], 20, 100, '%', '{"skill_level": "beginner"}'::jsonb, 2);
    
    -- App Development
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_learning_module_id, 'Side Projects', 'Personal app and project ideas', 'rocket', '#10b981', 2)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, status, tags, progress_current, progress_target, progress_unit, position)
    VALUES 
      (p_user_id, v_learning_module_id, v_cat_id, 'Budget App', 'Personal finance management app', 'high', 'in_progress', ARRAY['app', 'react', 'nextjs'], 80, 100, '%', 0),
      (p_user_id, v_learning_module_id, v_cat_id, 'Recipe Manager', 'Meal planning and recipe app', 'normal', 'active', ARRAY['app', 'future'], 0, 100, '%', 1);
  END IF;

  -- =========================================================================
  -- TRIPS MODULE: Travel Destinations
  -- =========================================================================
  
  IF v_trips_module_id IS NOT NULL THEN
    -- Europe category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_trips_module_id, 'Europe', 'European destinations', 'map-pin', '#6366f1', 0)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, metadata_json, position)
    VALUES 
      (p_user_id, v_trips_module_id, v_cat_id, 'Paris, France', 'City of lights', 'high', ARRAY['city', 'culture', 'food'], '{"country": "France", "estimated_cost": 3000, "best_season": "Spring/Fall", "activities": ["Eiffel Tower", "Louvre", "Montmartre"]}'::jsonb, 0),
      (p_user_id, v_trips_module_id, v_cat_id, 'Santorini, Greece', 'Beautiful island getaway', 'normal', ARRAY['beach', 'romantic'], '{"country": "Greece", "estimated_cost": 2500, "best_season": "Summer", "activities": ["Sunset at Oia", "Wine tasting", "Beach"]}'::jsonb, 1),
      (p_user_id, v_trips_module_id, v_cat_id, 'Swiss Alps', 'Mountain adventure', 'normal', ARRAY['mountains', 'skiing', 'nature'], '{"country": "Switzerland", "estimated_cost": 4000, "best_season": "Winter/Summer"}'::jsonb, 2);
    
    -- Asia category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_trips_module_id, 'Asia', 'Asian destinations', 'map-pin', '#f59e0b', 1)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, metadata_json, position)
    VALUES 
      (p_user_id, v_trips_module_id, v_cat_id, 'Tokyo, Japan', 'Modern meets traditional', 'high', ARRAY['city', 'culture', 'food', 'tech'], '{"country": "Japan", "estimated_cost": 5000, "best_season": "Spring/Fall", "activities": ["Cherry blossoms", "Shibuya", "Temples"]}'::jsonb, 0),
      (p_user_id, v_trips_module_id, v_cat_id, 'Bali, Indonesia', 'Tropical paradise', 'normal', ARRAY['beach', 'culture', 'relaxation'], '{"country": "Indonesia", "estimated_cost": 2000, "best_season": "April-October"}'::jsonb, 1);
    
    -- Americas category
    INSERT INTO catalogue_categories (user_id, module_id, name, description, icon, color, position)
    VALUES (p_user_id, v_trips_module_id, 'Americas', 'North and South American destinations', 'map-pin', '#10b981', 2)
    RETURNING id INTO v_cat_id;
    
    INSERT INTO catalogue_items (user_id, module_id, category_id, name, description, priority, tags, metadata_json, position)
    VALUES 
      (p_user_id, v_trips_module_id, v_cat_id, 'New York City', 'The Big Apple', 'normal', ARRAY['city', 'culture'], '{"country": "USA", "estimated_cost": 3500, "activities": ["Broadway", "Central Park", "Museums"]}'::jsonb, 0),
      (p_user_id, v_trips_module_id, v_cat_id, 'Machu Picchu, Peru', 'Ancient wonder', 'high', ARRAY['adventure', 'history', 'hiking'], '{"country": "Peru", "estimated_cost": 3000, "best_season": "May-October"}'::jsonb, 1);
  END IF;

END;
$$ LANGUAGE plpgsql;

-- Usage: Run this after user logs in for the first time
-- SELECT seed_catalogue_sample_data('user-uuid-here');

COMMENT ON FUNCTION seed_catalogue_sample_data IS 'Seeds sample catalogue data for demonstration purposes. Call with user UUID after they log in.';

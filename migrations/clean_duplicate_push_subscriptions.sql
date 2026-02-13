-- Migration: clean_duplicate_push_subscriptions.sql
-- Purpose: Clean up duplicate push subscriptions created when Android PWA restarts
-- Run this once to clean up existing duplicates

-- Delete duplicate subscriptions, keeping only the most recent one per user + device_name
WITH ranked_subscriptions AS (
  SELECT 
    id,
    user_id,
    device_name,
    last_used_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, device_name 
      ORDER BY last_used_at DESC NULLS LAST, created_at DESC
    ) as rn
  FROM push_subscriptions
),
duplicates AS (
  SELECT id FROM ranked_subscriptions WHERE rn > 1
)
DELETE FROM push_subscriptions
WHERE id IN (SELECT id FROM duplicates);

-- Also delete any subscriptions that haven't been used in 30+ days
DELETE FROM push_subscriptions
WHERE last_used_at < NOW() - INTERVAL '30 days';

-- Show remaining subscriptions
SELECT 
  user_id,
  device_name,
  COUNT(*) as count,
  MAX(last_used_at) as last_used
FROM push_subscriptions
GROUP BY user_id, device_name
ORDER BY last_used DESC;

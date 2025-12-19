-- ============================================================
-- DATABASE CLEANUP ANALYSIS - TABLES TO DROP
-- Generated: 2025-12-19
-- ============================================================
-- REVIEW EACH SECTION CAREFULLY BEFORE RUNNING
-- ============================================================


-- ============================================================
-- CATEGORY 1: LEGACY TABLES (superseded by `items` system)
-- ============================================================
-- These tables were replaced by the unified `items` table with
-- type='event', type='task', type='reminder'. The `items` system
-- is actively used throughout the codebase.
-- ============================================================

-- The old `events` table - replaced by items + event_details
-- Your code uses: items.type='event' + event_details table
DROP TABLE IF EXISTS public.events CASCADE;

-- The old `tasks` table - replaced by items.type='task'
DROP TABLE IF EXISTS public.tasks CASCADE;

-- The old `subtasks` table - replaced by item_subtasks
DROP TABLE IF EXISTS public.subtasks CASCADE;

-- Tags system for old tasks table - not used
DROP TABLE IF EXISTS public.task_tags CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;


-- ============================================================
-- CATEGORY 2: PLANNED BUT NEVER IMPLEMENTED
-- ============================================================
-- These tables exist in schema but have ZERO code references
-- in src/ directory - they were planned but never built.
-- ============================================================

-- WebAuthn/Passkey authentication - never implemented
DROP TABLE IF EXISTS public.webauthn_credentials CASCADE;

-- Alert presets for items - never implemented
DROP TABLE IF EXISTS public.item_alert_presets CASCADE;

-- Recurrence exceptions (skip specific dates) - only in docs, not code
DROP TABLE IF EXISTS public.item_recurrence_exceptions CASCADE;

-- Default categories - code uses hardcoded TypeScript constants instead
-- DROP TABLE IF EXISTS public.default_categories CASCADE;

-- Google Calendar sync - never implemented
DROP TABLE IF EXISTS public.google_calendar_tokens CASCADE;


-- ============================================================
-- CATEGORY 3: HUB FEATURES NEVER IMPLEMENTED
-- ============================================================
-- These hub_* tables exist but have no code using them.
-- ============================================================

-- Daily pulse widget - never implemented
DROP TABLE IF EXISTS public.hub_daily_pulse CASCADE;

-- Shared household goals - never implemented
DROP TABLE IF EXISTS public.hub_household_goals CASCADE;

-- Reactions to feed items - never implemented
DROP TABLE IF EXISTS public.hub_reactions CASCADE;


-- ============================================================
-- CATEGORY 4: CROSS-APP INTEGRATION (NO LONGER NEEDED)
-- ============================================================
-- User mappings between Budget App and external Reminder App.
-- Now using single app with multiple purposes.
-- ============================================================

-- Cross-app user mappings - no longer needed (single app now)
DROP TABLE IF EXISTS public.cross_app_user_mappings CASCADE;


-- ============================================================
-- SUMMARY
-- ============================================================
-- 
-- TABLES TO DROP (14 total):
-- 
-- Legacy (5):
--   1. events
--   2. tasks
--   3. subtasks
--   4. task_tags
--   5. tags
--
-- Planned but not implemented (5):
--   6. webauthn_credentials
--   7. item_alert_presets
--   8. item_recurrence_exceptions
--   9. default_categories
--   10. google_calendar_tokens
--
-- Hub features not implemented (3):
--   11. hub_daily_pulse
--   12. hub_household_goals
--   13. hub_reactions
--
-- Cross-app (no longer needed - single app now) (1):
--   14. cross_app_user_mappings
--
-- ============================================================
-- TABLES TO KEEP (39 total):
-- 
-- Core Finance:
--   - accounts, account_balances, transactions, user_categories
--   - budget_allocations, recurring_payments, future_purchases
--   - transaction_templates, merchant_mappings, statement_imports
--
-- Items System:
--   - items, item_alerts, item_attachments, item_subtasks
--   - item_snoozes, item_recurrence_rules, item_occurrence_actions
--   - event_details, reminder_details, reminder_templates
--
-- Hub & Messaging:
--   - household_links, hub_alerts, hub_chat_threads
--   - hub_messages, hub_message_actions, hub_message_receipts
--   - hub_notes_topics, hub_feed, hub_user_stats
--
-- AI:
--   - ai_sessions, ai_messages
--
-- Notifications:
--   - push_subscriptions, notification_logs
--   - notification_preferences, notification_templates
--   - in_app_notifications
--
-- User & Auth:
--   - user_preferences, user_onboarding
--   - error_logs
--
-- ============================================================


-- ============================================================
-- OPTIONAL: VERIFY BEFORE DROPPING
-- ============================================================
-- Run these queries to check if tables have any data:

-- SELECT 'events' as tbl, COUNT(*) FROM public.events
-- UNION ALL SELECT 'tasks', COUNT(*) FROM public.tasks
-- UNION ALL SELECT 'subtasks', COUNT(*) FROM public.subtasks
-- UNION ALL SELECT 'task_tags', COUNT(*) FROM public.task_tags
-- UNION ALL SELECT 'tags', COUNT(*) FROM public.tags
-- UNION ALL SELECT 'webauthn_credentials', COUNT(*) FROM public.webauthn_credentials
-- UNION ALL SELECT 'item_alert_presets', COUNT(*) FROM public.item_alert_presets
-- UNION ALL SELECT 'item_recurrence_exceptions', COUNT(*) FROM public.item_recurrence_exceptions
-- UNION ALL SELECT 'default_categories', COUNT(*) FROM public.default_categories
-- UNION ALL SELECT 'google_calendar_tokens', COUNT(*) FROM public.google_calendar_tokens
-- UNION ALL SELECT 'hub_daily_pulse', COUNT(*) FROM public.hub_daily_pulse
-- UNION ALL SELECT 'hub_household_goals', COUNT(*) FROM public.hub_household_goals
-- UNION ALL SELECT 'hub_reactions', COUNT(*) FROM public.hub_reactions;
